import { GoogleGenAI } from '@google/genai';
import {
  enforceAdminRateLimit,
  enforceSameOriginPostRequest,
  requireMulteiAdminAuth
} from '../../../utils/multeiAdminAuth';
import {
  discoverInstagramBusinessProfile,
  sanitizeInstagramHandle,
  type InstagramDiscoveredProfile,
  type InstagramServerConfig
} from '../../../utils/instagramGraph';

const DISCOVERY_MODELS = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest'
];

function buildCitySlug(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function suggestHandlesWithGemini(
  apiKey: string,
  cidade: string,
  estado: string
): Promise<{ prefeituraCandidates: string[]; transitoCandidates: string[] }> {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    return { prefeituraCandidates: [], transitoCandidates: [] };
  }

  const ai = new GoogleGenAI({ apiKey: cleanKey });
  const prompt = `Identifique o perfil oficial público no Instagram da Prefeitura Municipal de "${cidade}" (${estado}, Brasil) e, se existir um perfil próprio, da secretaria ou autarquia municipal de trânsito/mobilidade urbana dessa cidade.
Responda APENAS um objeto JSON válido (sem markdown) no formato:
{"prefeitura": ["arroba1", "arroba2"], "transito": ["arroba_transito1"]}
Regras:
- Inclua somente o nome de usuário sem "@" (apenas letras, números, ponto ou underline).
- Se não tiver certeza do órgão de trânsito, retorne lista vazia em "transito".`;

  for (const model of DISCOVERY_MODELS) {
    try {
      let responseText = '';
      try {
        const groundedRes = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.1
          }
        });
        responseText = String(groundedRes.text || '').trim();
      } catch {
        const plainRes = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });
        responseText = String(plainRes.text || '').trim();
      }

      if (!responseText) continue;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]) as {
        prefeitura?: unknown[];
        transito?: unknown[];
      };

      const prefeituraCandidates = Array.isArray(parsed.prefeitura)
        ? parsed.prefeitura.map(sanitizeInstagramHandle).filter(Boolean)
        : [];
      const transitoCandidates = Array.isArray(parsed.transito)
        ? parsed.transito.map(sanitizeInstagramHandle).filter(Boolean)
        : [];

      if (prefeituraCandidates.length > 0 || transitoCandidates.length > 0) {
        return { prefeituraCandidates, transitoCandidates };
      }
    } catch {
      continue;
    }
  }

  return { prefeituraCandidates: [], transitoCandidates: [] };
}

export default defineEventHandler(async (event) => {
  enforceSameOriginPostRequest(event);
  enforceAdminRateLimit(event, 'ig_discover', 25, 60_000);
  await requireMulteiAdminAuth(event);

  const body = (await readBody<Record<string, unknown>>(event).catch(() => null)) || {};
  const cidade = String(body.cidade || '').trim().slice(0, 80);
  const estado = String(body.estado || '').trim().toUpperCase().slice(0, 2);
  const manualPrefeitura = sanitizeInstagramHandle(body.manualPrefeitura);
  const manualTransito = sanitizeInstagramHandle(body.manualTransito);

  const runtimeConfig = useRuntimeConfig(event);
  const igConfig: InstagramServerConfig = {
    igUserId: String(runtimeConfig.igUserId || ''),
    igAccessToken: String(runtimeConfig.igAccessToken || ''),
    igGraphVersion: String(runtimeConfig.igGraphVersion || 'v27.0'),
    firebaseStorageBucket: String(runtimeConfig.public?.firebaseStorageBucket || '')
  };

  // Modo 1: Validação direta de @ informado manualmente pelo Admin
  if (manualPrefeitura || manualTransito) {
    const [prefProfile, transitoProfile] = await Promise.all([
      manualPrefeitura
        ? discoverInstagramBusinessProfile(manualPrefeitura, igConfig)
        : Promise.resolve<InstagramDiscoveredProfile | null>(null),
      manualTransito
        ? discoverInstagramBusinessProfile(manualTransito, igConfig)
        : Promise.resolve<InstagramDiscoveredProfile | null>(null)
    ]);

    return {
      ok: true,
      prefeitura: prefProfile,
      transito: transitoProfile
    };
  }

  if (!cidade || !/^[A-Z]{2}$/.test(estado)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe cidade e UF válidas para buscar o Instagram oficial.'
    });
  }

  // Modo 2: Descoberta automática assistida (Gemini + confirmação oficial na Meta business_discovery)
  const slug = buildCitySlug(cidade);
  const aiSuggestions = await suggestHandlesWithGemini(
    String(runtimeConfig.geminiServerApiKey || runtimeConfig.public?.geminiApiKey || ''),
    cidade,
    estado
  );

  const fallbackPrefCandidates = slug
    ? [
        `prefeitura${slug}`,
        `prefeiturade${slug}`,
        `pref${slug}`,
        `prefeitura.${slug}`,
        `pm${slug}`
      ]
        .map(sanitizeInstagramHandle)
        .filter(Boolean)
    : [];

  const uniquePrefCandidates = Array.from(
    new Set([...aiSuggestions.prefeituraCandidates, ...fallbackPrefCandidates])
  ).slice(0, 5);

  let verifiedPrefeitura: InstagramDiscoveredProfile | null = null;
  for (const candidate of uniquePrefCandidates) {
    const discovered = await discoverInstagramBusinessProfile(candidate, igConfig);
    if (discovered.verified) {
      verifiedPrefeitura = discovered;
      break;
    }
  }

  let verifiedTransito: InstagramDiscoveredProfile | null = null;
  const uniqueTransitoCandidates = Array.from(new Set(aiSuggestions.transitoCandidates)).slice(0, 3);
  for (const candidate of uniqueTransitoCandidates) {
    if (verifiedPrefeitura && candidate === verifiedPrefeitura.username) continue;
    const discovered = await discoverInstagramBusinessProfile(candidate, igConfig);
    if (discovered.verified) {
      verifiedTransito = discovered;
      break;
    }
  }

  return {
    ok: true,
    prefeitura:
      verifiedPrefeitura ||
      (uniquePrefCandidates[0]
        ? {
            verified: false,
            username: uniquePrefCandidates[0],
            reason: 'Sugestão automática não confirmada na Meta — revise o @ antes de salvar.'
          }
        : null),
    transito: verifiedTransito
  };
});
