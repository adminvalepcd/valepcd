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
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest'
];

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function normalizeAsciiLower(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildDeterministicMunicipalCandidates(cidade: string, estado: string): string[] {
  const norm = normalizeAsciiLower(cidade);
  const words = norm
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w));
  const fullSlug = words.join('');
  const rawSlug = norm.replace(/[^a-z0-9]/g, '');
  const ufLower = String(estado || '').toLowerCase();

  // Sigla de cidades compostas (ex.: "Belo Horizonte" -> "bh", "Juiz de Fora" -> "jf", "Porto Alegre" -> "poa")
  const initials = words.length >= 2 ? words.map((w) => w[0]).join('') : '';

  const candidates: string[] = [];
  if (initials.length >= 2) {
    candidates.push(
      `prefeitura${initials}`,
      `pref${initials}`,
      `p${initials}`,
      `prefeiturade${initials}`
    );
  }
  if (rawSlug) {
    candidates.push(
      `prefeitura${rawSlug}`,
      `prefeiturade${rawSlug}`,
      `pref${rawSlug}`,
      `prefeitura.${rawSlug}`,
      `prefeitura_${rawSlug}`,
      `prefeitura${rawSlug}${ufLower}`
    );
  }
  if (fullSlug && fullSlug !== rawSlug) {
    candidates.push(`prefeitura${fullSlug}`, `prefeiturade${fullSlug}`, `pref${fullSlug}`);
  }

  return Array.from(new Set(candidates.map(sanitizeInstagramHandle).filter(Boolean)));
}

function scoreVerifiedPrefeituraProfile(
  profile: InstagramDiscoveredProfile,
  cidade: string
): number {
  if (!profile.verified) return -1;
  const hay = normalizeAsciiLower(`${profile.name || ''} ${profile.biography || ''}`);
  const cityNorm = normalizeAsciiLower(cidade);
  const words = cityNorm.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  let score = 10;
  if (hay.includes('prefeitura') || hay.includes('municipio') || hay.includes('municipal')) {
    score += 40;
  }
  if (cityNorm && hay.includes(cityNorm)) {
    score += 35;
  } else if (words.length > 0 && words.every((w) => hay.includes(w))) {
    score += 25;
  }
  if (typeof profile.followersCount === 'number' && profile.followersCount >= 1000) {
    score += 15;
  }
  return score;
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
  const prompt = `Liste os usernames mais prováveis do perfil oficial público no Instagram da Prefeitura Municipal de "${cidade}" (${estado}, Brasil) e, se existir perfil próprio conhecido, do órgão/autarquia municipal de trânsito dessa cidade.
Inclua variações reais comuns no Brasil (por exemplo, siglas como prefeiturabh, prefsp, prefcuritiba, prefpoa, prefeituracontagem, etc.).
Responda APENAS um JSON válido no formato:
{"prefeitura": ["op1", "op2", "op3", "op4"], "transito": ["op_transito1", "op_transito2"]}
Regras: apenas usernames sem "@", sem URLs e sem explicações.`;

  for (const model of DISCOVERY_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });
      const responseText = String(res.text || '').trim();
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

  // Modo 2: Descoberta automática verificando existência real de cada candidato no Instagram
  const deterministicCandidates = buildDeterministicMunicipalCandidates(cidade, estado);
  const aiSuggestions = await suggestHandlesWithGemini(
    String(runtimeConfig.geminiServerApiKey || runtimeConfig.public?.geminiApiKey || ''),
    cidade,
    estado
  );

  const uniquePrefCandidates = Array.from(
    new Set([...deterministicCandidates.slice(0, 3), ...aiSuggestions.prefeituraCandidates, ...deterministicCandidates])
  ).slice(0, 8);

  const checkedPrefProfiles = await Promise.all(
    uniquePrefCandidates.map((cand) => discoverInstagramBusinessProfile(cand, igConfig))
  );

  const validScored = checkedPrefProfiles
    .filter((p) => p.verified)
    .map((p) => ({ profile: p, score: scoreVerifiedPrefeituraProfile(p, cidade) }))
    .filter((entry) => entry.score >= 35)
    .sort((a, b) => b.score - a.score);

  const verifiedPrefeitura = validScored[0]?.profile || null;
  const anyTokenExpired = checkedPrefProfiles.some((p) => p.metaTokenExpired);

  let verifiedTransito: InstagramDiscoveredProfile | null = null;
  const uniqueTransitoCandidates = Array.from(new Set(aiSuggestions.transitoCandidates)).slice(0, 4);
  if (uniqueTransitoCandidates.length > 0) {
    const checkedTransito = await Promise.all(
      uniqueTransitoCandidates
        .filter((c) => !verifiedPrefeitura || c !== verifiedPrefeitura.username)
        .map((cand) => discoverInstagramBusinessProfile(cand, igConfig))
    );
    verifiedTransito = checkedTransito.find((t) => t.verified) || null;
  }

  return {
    ok: true,
    prefeitura:
      verifiedPrefeitura || {
        verified: false,
        username: '',
        metaTokenExpired: anyTokenExpired,
        reason:
          'Não foi possível confirmar automaticamente o @ oficial desta prefeitura — digite o @ acima e clique em Validar.'
      },
    transito: verifiedTransito
  };
});
