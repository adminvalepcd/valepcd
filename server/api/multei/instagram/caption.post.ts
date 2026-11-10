import { GoogleGenAI } from '@google/genai';
import {
  enforceAdminRateLimit,
  enforceSameOriginPostRequest,
  requireMulteiAdminAuth
} from '../../../utils/multeiAdminAuth';
import {
  sanitizeInstagramCaption,
  sanitizeInstagramHandle
} from '../../../utils/instagramGraph';

const CAPTION_MODELS = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest'
];

function toHashtagToken(raw: string): string {
  const clean = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
  return clean ? clean.slice(0, 28) : 'Brasil';
}

function buildFallbackCityCaption(params: {
  cidade: string;
  estado: string;
  totalDia: number;
  resolvidosDia: number;
  transitoDia: number;
  mobilidadeDia: number;
  bairros: string[];
  instagramPrefeitura: string;
  instagramTransito: string;
}): string {
  const mentions = [
    params.instagramPrefeitura ? `@${params.instagramPrefeitura}` : '',
    params.instagramTransito ? `@${params.instagramTransito}` : ''
  ]
    .filter(Boolean)
    .join(' ');

  const bairrosLine =
    params.bairros.length > 0
      ? `📍 Bairros com registros hoje: ${params.bairros.slice(0, 5).join(', ')}.\n\n`
      : '';

  const cityTag = toHashtagToken(params.cidade);

  if (params.resolvidosDia > 0) {
    const pendentes = params.transitoDia + params.mobilidadeDia;
    const pendentesInfo =
      pendentes > 0
        ? `Ao mesmo tempo, ainda registramos hoje ${pendentes} ocorrência(s) aguardando fiscalização e providências (${params.transitoDia} de trânsito e ${params.mobilidadeDia} de mobilidade urbana).\n\n`
        : '';

    return sanitizeInstagramCaption(
      `✨ A transformação acontece em ${params.cidade} - ${params.estado}!\n\n` +
        `Hoje celebramos ${params.resolvidosDia} problema(s) de mobilidade urbana solucionado(s) e validado(s) pela comunidade no Multei. Quando há diálogo e ação, a cidade fica mais acessível para todas as pessoas!\n\n` +
        pendentesInfo +
        bairrosLine +
        `${mentions ? `${mentions}, seguimos` : 'Seguimos'} acompanhando as demandas mapeadas pelos cidadãos e colocamos a ONG Vale PCD totalmente à disposição para agendar uma reunião e firmar parceria gratuita de fornecimento de dados cívicos de acessibilidade.\n\n` +
        `📲 Registre ocorrências de forma 100% anônima em: www.valepcd.com.br/multei\n\n` +
        `#ValePCD #Multei #Acessibilidade #MobilidadeUrbana #Inclusao #${cityTag} #${params.estado}`
    );
  }

  return sanitizeInstagramCaption(
    `🚨 Hoje em ${params.cidade} - ${params.estado}: a comunidade registrou ${params.totalDia} ocorrência(s) de desrespeito à acessibilidade no mapa do Multei (${params.transitoDia} no trânsito e ${params.mobilidadeDia} em calçadas/mobilidade urbana).\n\n` +
      bairrosLine +
      `${mentions ? `Solicitamos um posicionamento de ${mentions}` : 'Cobramos atenção do poder público municipal'} quanto à fiscalização e manutenção desses pontos essenciais para o direito de ir e vir de pessoas com deficiência e idosos.\n\n` +
      `🤝 A ONG Vale PCD está de portas abertas para se reunir com a gestão de ${params.cidade} e firmar uma parceria institucional gratuita para compartilhar nossos dados georreferenciados e apoiar o planejamento da fiscalização.\n\n` +
      `📲 Denuncie também de forma anônima em: www.valepcd.com.br/multei\n\n` +
      `#ValePCD #Multei #Acessibilidade #VagaPcD #MobilidadeUrbana #FiscalizacaoCidada #${cityTag}`
  );
}

function buildFallbackReportCaption(params: {
  periodTitle: string;
  totalGeral: number;
  cidadesCount: number;
  infracoesTransito: number;
  mobilidadeUrbana: number;
  resolvidos: number;
  topCities: string[];
}): string {
  const resolvidosLine =
    params.resolvidos > 0
      ? `✅ ${params.resolvidos} problema(s) resolvido(s)\n`
      : '';
  const topCitiesLine =
    params.topCities.length > 0
      ? `\n🏙️ Destaque de participação: ${params.topCities.slice(0, 5).join(', ')}.\n`
      : '';

  return sanitizeInstagramCaption(
    `📊 ${params.periodTitle}!\n\n` +
      `Foram ${params.totalGeral} registros mapeados de forma anônima e colaborativa em ${params.cidadesCount} ${params.cidadesCount === 1 ? 'cidade' : 'cidades'}:\n` +
      `🚗 ${params.infracoesTransito} denúncias de trânsito\n` +
      `🚧 ${params.mobilidadeUrbana} ocorrências de mobilidade urbana\n` +
      resolvidosLine +
      topCitiesLine +
      `\nCada pino registrado pela comunidade ajuda a transformar invisibilidade em dado público para cobrar fiscalização e obras de acessibilidade.\n\n` +
      `🤝 Gestores públicos e apoiadores: conheçam nossa metodologia e saibam como firmar parceria gratuita com a ONG Vale PCD em https://valepcd.com.br/multei/sobre (link também na bio!).\n\n` +
      `#ValePCD #Multei #DadosCivicos #Acessibilidade #MobilidadeUrbana #Inclusao #CidadesAcessiveis`
  );
}

export default defineEventHandler(async (event) => {
  enforceSameOriginPostRequest(event);
  enforceAdminRateLimit(event, 'ig_caption', 30, 60_000);
  await requireMulteiAdminAuth(event);

  const body = (await readBody<Record<string, unknown>>(event).catch(() => null)) || {};
  const mode = body.mode === 'general_report' ? 'general_report' : 'city_daily';
  const variationSeed = Number(body.variationSeed || Date.now() % 1000);

  const runtimeConfig = useRuntimeConfig(event);
  const apiKey = String(
    runtimeConfig.geminiServerApiKey || runtimeConfig.public?.geminiApiKey || ''
  ).trim();

  if (mode === 'general_report') {
    const periodTitle = String(body.periodTitle || 'Essa semana no Multei').trim().slice(0, 80);
    const periodLabel = String(body.periodLabel || '').trim().slice(0, 80);
    const totalGeral = Math.max(0, Math.floor(Number(body.totalGeral || 0)));
    const cidadesCount = Math.max(0, Math.floor(Number(body.cidadesCount || 0)));
    const infracoesTransito = Math.max(0, Math.floor(Number(body.infracoesTransito || 0)));
    const mobilidadeUrbana = Math.max(0, Math.floor(Number(body.mobilidadeUrbana || 0)));
    const resolvidos = Math.max(0, Math.floor(Number(body.resolvidos || 0)));
    const topCities = Array.isArray(body.topCities)
      ? body.topCities.map((c) => String(c || '').trim().slice(0, 50)).filter(Boolean).slice(0, 6)
      : [];

    const fallback = buildFallbackReportCaption({
      periodTitle,
      totalGeral,
      cidadesCount,
      infracoesTransito,
      mobilidadeUrbana,
      resolvidos,
      topCities
    });

    if (!apiKey) {
      return { ok: true, caption: fallback, generatedByAi: false };
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Escreva uma legenda institucional, engajadora e inédita para o Instagram (@pcdvale — ONG Vale PCD) sobre o balanço do projeto Multei (semente criativa #${variationSeed}).

Dados reais do período (${periodTitle}${periodLabel ? ` — ${periodLabel}` : ''}):
- Total de registros: ${totalGeral} em ${cidadesCount} cidade(s)
- Denúncias de Trânsito: ${infracoesTransito}
- Mobilidade Urbana: ${mobilidadeUrbana}
${resolvidos > 0 ? `- Problemas Resolvidos: ${resolvidos}` : '- NÃO mencione problemas resolvidos (foram zero no período).'}
${topCities.length > 0 ? `- Cidades com maior participação: ${topCities.join(', ')}` : ''}

Regras obrigatórias:
1. Texto em português do Brasil, tom sério, cidadão, propositivo e humano (máximo 1.400 caracteres).
2. Destaque a importância da inteligência de dados cívicos para melhorar a acessibilidade urbana.
3. Convide gestores públicos, prefeituras e cidadãos a conhecerem mais e firmarem parceria gratuita em https://valepcd.com.br/multei/sobre (mencione também que o link está na bio).
4. Inclua de 5 a 7 hashtags relevantes ao final (#ValePCD #Multei etc.).
5. Retorne APENAS o texto puro da legenda pronta para postar, sem aspas extras e sem explicações.
6. Seja enxuto em emojis, hashtags (máximo 3), não use jargões de IA como "nao é sobre <algo> é sobre <algo>" "mais que <algo>, é <algo>"`;

    for (const model of CAPTION_MODELS) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { temperature: 0.8 }
        });
        const cleaned = sanitizeInstagramCaption(res.text);
        if (cleaned.length >= 80) {
          return { ok: true, caption: cleaned, generatedByAi: true };
        }
      } catch {
        continue;
      }
    }

    return { ok: true, caption: fallback, generatedByAi: false };
  }

  // Modo padrão: `city_daily` (Fase 1)
  const cidade = String(body.cidade || '').trim().slice(0, 80);
  const estado = String(body.estado || '').trim().toUpperCase().slice(0, 2);
  if (!cidade || !/^[A-Z]{2}$/.test(estado)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cidade e UF são obrigatórias para gerar a legenda.'
    });
  }

  const totalDia = Math.max(1, Math.floor(Number(body.totalDia || 1)));
  const resolvidosDia = Math.max(0, Math.floor(Number(body.resolvidosDia || 0)));
  const transitoDia = Math.max(0, Math.floor(Number(body.transitoDia || 0)));
  const mobilidadeDia = Math.max(0, Math.floor(Number(body.mobilidadeDia || 0)));
  const instagramPrefeitura = sanitizeInstagramHandle(body.instagramPrefeitura);
  const instagramTransito = sanitizeInstagramHandle(body.instagramTransito);
  const bairros = Array.isArray(body.bairros)
    ? body.bairros.map((b) => String(b || '').trim().slice(0, 50)).filter(Boolean).slice(0, 6)
    : [];

  const fallback = buildFallbackCityCaption({
    cidade,
    estado,
    totalDia,
    resolvidosDia,
    transitoDia,
    mobilidadeDia,
    bairros,
    instagramPrefeitura,
    instagramTransito
  });

  if (!apiKey) {
    return { ok: true, caption: fallback, generatedByAi: false };
  }

  const mentionsList = [
    instagramPrefeitura ? `@${instagramPrefeitura}` : '',
    instagramTransito ? `@${instagramTransito}` : ''
  ].filter(Boolean);

  const styleAngles = [
    'abertura direta focada no direito constitucional de ir e vir e nos dados registrados hoje',
    'abertura cidadã valorizando a colaboração da população local e pedindo resposta prática da gestão',
    'abertura analítica destacando os bairros afetados hoje e como dados ajudam a prefeitura a agir rápido',
    'abertura empática sobre o impacto cotidiano na vida de pessoas com deficiência e idosos na cidade'
  ];
  const chosenAngle = styleAngles[Math.abs(variationSeed) % styleAngles.length];

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Escreva uma legenda única, autêntica e não repetitiva para o Instagram (@pcdvale — ONG Vale PCD) apresentando registros de acessibilidade de HOJE em ${cidade} - ${estado} no mapa colaborativo Multei.

Ângulo de redação desta variação: ${chosenAngle} (semente #${variationSeed}).

Dados reais de hoje em ${cidade} - ${estado}:
- Total de registros considerados hoje: ${totalDia}
- Problemas de mobilidade urbana RESOLVIDOS hoje: ${resolvidosDia}
- Denúncias ativas de infração de trânsito (vagas PcD / área de transferência / faixa): ${transitoDia}
- Denúncias ativas de mobilidade urbana (calçadas / rampas obstruídas): ${mobilidadeDia}
${bairros.length > 0 ? `- Bairros com registros hoje: ${bairros.join(', ')}` : ''}
${mentionsList.length > 0 ? `- Perfis oficiais do poder público para mencionar com @ no texto: ${mentionsList.join(' e ')}` : '- Mencione a Prefeitura Municipal de ' + cidade + ' no texto.'}

Regras obrigatórias:
1. ${resolvidosDia > 0 ? 'Como há problema(s) resolvido(s) hoje, abra celebrando que a transformação acontece em ' + cidade + ', reconheça a melhoria e, se houver denúncias ativas também, pontue o que ainda precisa avançar.' : 'Apresente os registros de hoje em ' + cidade + ' de forma firme, respeitosa e institucional, sem ataques pessoais.'}
2. Cobre um posicionamento e fiscalização efetiva do poder público marcado (${mentionsList.join(' ') || 'Prefeitura de ' + cidade}).
3. Inclua explicitamente o convite institucional: coloque a ONG Vale PCD à disposição da Prefeitura para agendar uma reunião e firmar uma parceria gratuita de compartilhamento dos dados georreferenciados do Multei para apoiar a gestão pública.
4. Convide a população a registrar de forma 100% anônima em www.valepcd.com.br/multei.
5. Finalize com 5 a 7 hashtags pertinentes (incluindo #ValePCD #Multei e a hashtag da cidade). Máximo total: 1.500 caracteres.
6. Retorne APENAS o texto puro da legenda, sem markdown de título e sem comentários extras.`;

  for (const model of CAPTION_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.85 }
      });
      const cleaned = sanitizeInstagramCaption(res.text);
      if (cleaned.length >= 90) {
        return { ok: true, caption: cleaned, generatedByAi: true };
      }
    } catch {
      continue;
    }
  }

  return { ok: true, caption: fallback, generatedByAi: false };
});
