import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type {
  BoundingBox,
  DuplicateComparisonResult,
  GeminiSensitiveContentResponse,
  IncidentAnalysisResult
} from '../types';


const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash'
];

export function initializeGeminiClient(apiKey?: string): GoogleGenAI | null {
  if (!apiKey) {
    console.warn("[geminiService] Chave de API do Gemini não configurada.");
    return null;
  }

  try {
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[geminiService] Falha ao inicializar GoogleGenAI: ${message}`);
    return null;
  }
}

function parseBase64Image(rawBase64: string): { data: string; mimeType: string } {
  const match = rawBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2]
    };
  }
  return {
    mimeType: 'image/jpeg',
    data: rawBase64
  };
}

/**
 * Análise unificada da ocorrência:
 * 1. Verifica se há veículo automotor (carro, caminhão, moto, van ou ônibus), mesmo parcial.
 * 2. Valida segurança e moderação de conteúdo (sem nudez, gore, violência ou ofensas).
 * 3. Se reprovada, descreve a razão em português.
 * 4. Se aprovada, retorna as caixas delimitadoras de placas de carro e rostos humanos.
 * 5. Tenta modelos em cascata (fallback) caso o modelo principal sofra limitação de cota (429) ou pico de demanda (503).
 */
export async function analyzeIncidentImage(
  client: GoogleGenAI | null,
  imageBase64: string,
  natureza: 'infracao_veicular' | 'urbana' = 'infracao_veicular'
): Promise<IncidentAnalysisResult> {
  const isUrbanMode = natureza === 'urbana';

  const defaultFailure: IncidentAnalysisResult = {
    hasVehicle: false,
    isAppropriate: false,
    possibleCredential: false,
    isUrbanEnvironment: false,
    hasTrafficInfractionVehicle: false,
    urbanDescription: '',
    rejectionReason: 'Não foi possível analisar a imagem enviada. Tente novamente.',
    plates: [],
    faces: [],
    verification: '',
    apiError: false
  };

  if (!client) {
    console.error('[geminiService] Cliente Gemini não inicializado.');
    return {
      ...defaultFailure,
      rejectionReason: 'Chave do serviço de IA não configurada. Verifique as configurações de ambiente.',
      apiError: true
    };
  }

  const trafficPrompt = `Audite a imagem (LGPD/Trânsito) focando na vaga em primeiro plano (vaga auditada) e na sua área zebrada de transferência lateral para avaliação da infração, e ocultando TODAS as placas e APENAS os rostos (cabeça/face, nunca o corpo) da cena para LGPD. Retorne o JSON:

DIRETRIZES

1. Moderação e Vaga Auditada em Primeiro Plano ("isAppropriate" e "hasVehicle"):
- "isAppropriate": true (imagem adequada). false APENAS para conteúdo impróprio (pornografia, violência, gore).
- "hasVehicle": true SOMENTE se houver um veículo estacionado DENTRO/SOBRE o piso da vaga auditada em primeiro plano.
- ATENÇÃO CRÍTICA CONTRA FALSOS POSITIVOS DE SEGUNDO PLANO: Se o piso/chão da vaga em primeiro plano estiver vazio/desocupado (mesmo que existam outros carros estacionados ao fundo, atrás da vaga, do outro lado da via ou em vagas vizinhas), defina OBRIGATORIAMENTE "hasVehicle": false. NUNCA considere veículos em segundo plano/fundo como veículo da vaga auditada.

2. Credencial no Para-brisa / Painel ("possibleCredential"):
- Se "hasVehicle" for false, defina obrigatoriamente "possibleCredential": false.
- Se "hasVehicle" for true, inspecione a BASE (parte inferior) do para-brisa e o topo do painel do veículo em primeiro plano em 3 zonas: esquerda, centro e direita (acima do volante).
- true: visão dianteira com QUALQUER cartão, papel, documento, etiqueta retangular ou MANCHA CLARA/BRANCA GEOMÉTRICA (faixa, tira, trapézio ou retângulo branco/claro) na base do para-brisa ou deitada sobre o painel (mesmo pequena, achatada pela perspectiva, desfocada ou sob reflexo do vidro).
- false: visão traseira/lateral, insulfilm 100% opaco impedindo visão interna, base do para-brisa/painel totalmente escura/limpa, ou quando houver adesivo/tag SOMENTE no topo do vidro (perto do retrovisor central) com o painel vazio.

3. Infrações ("verification") da Vaga Auditada / Área de Transferência:
- "transferencia": quando a área de transferência zebrada (listras diagonais brancas ou amarelas no solo associadas à vaga em primeiro plano) estiver obstruída ou invadida parcial ou totalmente por qualquer veículo, motocicleta, roda/pneu, para-choque ou objeto (cone, carrinho de compras, placa/cavalete, lixeira, etc.), INCLUSIVE quando a vaga principal estiver vazia ("hasVehicle": false).
- "faixa de pedestres": quando "hasVehicle" for true e as rodas ou carroceria estiverem SOBRE a faixa de pedestres (parado antes/depois = "").
- "Vaga exclusiva": quando "hasVehicle" for true, o veículo estiver parado na vaga reservada (sinalização no solo PCD/idoso ou placa R-6b) E "possibleCredential" for false.
- "": vaga vazia sem obstrução na área de transferência zebrada, vaga comum, "possibleCredential" = true (sem invadir área zebrada), ou sem infração clara.

4. Motivo de Rejeição ("rejectionReason"):
- Se "isAppropriate" for true E ("hasVehicle" for true OU "verification" for "transferencia"), retorne "".
- Caso contrário, descreva brevemente o motivo (ex: "A vaga em primeiro plano está vazia.").

5. Anonimização LGPD ("plates" e "faces"):
- "plates": lista com box_2d [ymin, xmin, ymax, xmax] (0 a 1000) de TODAS as placas de veículos visíveis na imagem (independentemente de o veículo ser o principal na vaga auditada, adjacente ou ao fundo). Se não houver placas visíveis, retorne [].
- "faces": lista com box_2d [ymin, xmin, ymax, xmax] (0 a 1000) delimitando ESTRITAMENTE a região do ROSTO/CABEÇA humana (ymin no topo da testa/cabeça e ymax no queixo; xmin e xmax de orelha a orelha). PROIBIDO incluir pescoço, ombros, tronco, roupas, pernas ou o corpo inteiro da pessoa/pedestre. Se a pessoa estiver de costas ou sem rosto visível, ignore. Se não houver rostos visíveis, retorne [].`;

  const urbanPrompt = `
Audite a imagem (LGPD/Mobilidade e Acessibilidade Urbana) e retorne o JSON:
{"isAppropriate": bool, "isUrbanEnvironment": bool, "hasTrafficInfractionVehicle": bool, "verification": str, "urbanDescription": str, "rejectionReason": str, "plates": [{box_2d: [ymin,xmin,ymax,xmax]}], "faces": [{box_2d: [ymin,xmin,ymax,xmax]}]}

Diretrizes de Moderação e Auditoria (Mobilidade Urbana):

1. Moderação e Pertinência da Imagem:
- "isAppropriate": false SOMENTE se a imagem contiver conteúdo impróprio (nudez, pornografia, violência, gore ou semelhantes). Se for imprópria, retorne "foto inapropriada" em "rejectionReason".
- "isUrbanEnvironment": true se a foto mostrar ambiente urbano, calçada, rua, rampa, faixa de travessia, piso tátil, estacionamento ou espaço público/coletivo. false se a imagem claramente não tiver relação com ambiente urbano/calçada/via pública (ex: foto interna de quarto, selfie fechada, tela de computador, objeto doméstico).
- "rejectionReason": se "isAppropriate" for false, retorne exatamente "foto inapropriada". Se "isUrbanEnvironment" for false, explique brevemente que a foto deve mostrar uma calçada ou via pública. Caso contrário, retorne "".

2. Detecção de Infração de Trânsito na Imagem ("hasTrafficInfractionVehicle" e "verification"):
- "hasTrafficInfractionVehicle": true SE constar na foto um veículo parado sobre faixa de pedestres OU em vagas de estacionamento PCD / área de transferência zebrada PCD. Caso contrário, false.
- "verification": se "hasTrafficInfractionVehicle" for true, preencha com "faixa de pedestres", "transferencia" ou "Vaga exclusiva". Senão, retorne "".

3. Descrição de Acessibilidade Urbana ("urbanDescription"):
- Descreva em português (máximo de 300 caracteres) o que há na imagem com foco na acessibilidade e mobilidade urbana (ex: "Buraco na calçada dificultando a passagem", "Rampa de acessibilidade quebrada ou inexistente", "Piso tátil danificado, interrompido ou inexistente", "Calçada obstruída por entulho/obras", etc.).

4. Proteção de Privacidade / LGPD ("plates" e "faces") — OBRIGATÓRIO:
- "plates": IMPORTANTE: Localize com precisão as caixas delimitadoras (bounding boxes) de TODAS as placas de veículos visíveis na cena (dianteiras e traseiras de qualquer veículo estacionado, em movimento ou ao fundo), cobrindo toda a extensão da placa (incluindo moldura e caracteres), onde x e y são o canto superior esquerdo (xmin, ymin) e width e height são a largura e altura da caixa para aplicação do desfoque pesado de privacidade.
- "faces": IMPORTANTE: Localize com precisão as caixas delimitadoras APENAS dos rostos humanos visíveis na cena (da testa ao queixo, de orelha a orelha — NUNCA inclua tronco, roupas, pernas ou o corpo inteiro), onde x e y são o canto superior esquerdo (xmin, ymin) e width e height são a largura e altura estritas do rosto para aplicação do desfoque de privacidade.`;

  const prompt = isUrbanMode ? urbanPrompt : trafficPrompt;

  const { data, mimeType } = parseBase64Image(imageBase64);
  const imagePart = {
    inlineData: {
      mimeType,
      data,
    },
  };

  const boundingBoxItemsSchema = {
    type: Type.OBJECT,
    properties: {
      x: { type: Type.NUMBER, description: 'Coordenada horizontal do canto superior esquerdo xmin (0 a 1000 ou 0 a 1).' },
      y: { type: Type.NUMBER, description: 'Coordenada vertical do canto superior esquerdo ymin (0 a 1000 ou 0 a 1).' },
      width: { type: Type.NUMBER, description: 'Largura total da caixa cobrindo apenas a placa ou apenas o rosto (0 a 1000 ou 0 a 1).' },
      height: { type: Type.NUMBER, description: 'Altura total da caixa cobrindo apenas a placa ou apenas o rosto, da testa ao queixo, sem incluir o corpo (0 a 1000 ou 0 a 1).' }
    },
    propertyOrdering: ['x', 'y', 'width', 'height']
  };

  const plateBox2dItemSchema = {
    type: Type.OBJECT,
    properties: {
      box_2d: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: 'Coordenadas [ymin, xmin, ymax, xmax] de 0 a 1000 cobrindo a placa do veículo.'
      }
    },
    propertyOrdering: ['box_2d']
  };

  const faceBox2dItemSchema = {
    type: Type.OBJECT,
    properties: {
      box_2d: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: 'Coordenadas [ymin, xmin, ymax, xmax] de 0 a 1000 delimitando ESTRITAMENTE o rosto humano (ymin=testa, ymax=queixo, xmin/xmax=orelhas). NUNCA inclua tronco, roupas ou corpo inteiro.'
      }
    },
    propertyOrdering: ['box_2d']
  };

  const schema = isUrbanMode
    ? {
        type: Type.OBJECT,
        properties: {
          isAppropriate: {
            type: Type.BOOLEAN,
            description: 'False se a imagem contiver nudez, pornografia, violência ou conteúdo impróprio.'
          },
          isUrbanEnvironment: {
            type: Type.BOOLEAN,
            description: 'True se a imagem mostrar calçada, via pública, estacionamento ou ambiente urbano.'
          },
          hasTrafficInfractionVehicle: {
            type: Type.BOOLEAN,
            description: 'True se houver veículo parado sobre faixa de pedestres ou em vaga/área de estacionamento PCD.'
          },
          verification: {
            type: Type.STRING,
            description: 'Se hasTrafficInfractionVehicle for true: "Vaga exclusiva", "transferencia" ou "faixa de pedestres", senão "".'
          },
          urbanDescription: {
            type: Type.STRING,
            description: 'Breve descrição em até 300 caracteres focada na acessibilidade urbana observada na imagem.'
          },
          rejectionReason: {
            type: Type.STRING,
            description: '"foto inapropriada" se isAppropriate for false, motivo se não for ambiente urbano, ou "" se válida.'
          },
          plates: {
            type: Type.ARRAY,
            description: 'Lista obrigatória de caixas delimitadoras de TODAS as placas de veículos visíveis na imagem para desfoque de privacidade.',
            items: boundingBoxItemsSchema
          },
          faces: {
            type: Type.ARRAY,
            description: 'Lista obrigatória de caixas delimitadoras APENAS dos rostos humanos (da testa ao queixo, nunca o corpo inteiro) visíveis na imagem.',
            items: boundingBoxItemsSchema
          }
        },
        propertyOrdering: [
          'isAppropriate',
          'isUrbanEnvironment',
          'hasTrafficInfractionVehicle',
          'verification',
          'urbanDescription',
          'rejectionReason',
          'plates',
          'faces'
        ]
      }
    : {
        type: Type.OBJECT,
        properties: {
          isAppropriate: {
            type: Type.BOOLEAN,
            description: 'True (imagem adequada). False APENAS para conteúdo impróprio (pornografia, violência, gore).'
          },
          hasVehicle: {
            type: Type.BOOLEAN,
            description: 'True SOMENTE se houver um veículo estacionado sobre o piso da vaga auditada em primeiro plano. Se o piso da vaga em primeiro plano estiver vazio (mesmo com veículos ao fundo ou em vagas vizinhas), defina obrigatoriamente false.'
          },
          possibleCredential: {
            type: Type.BOOLEAN,
            description: 'Avalie ANTES de verification: True se hasVehicle for true em visão dianteira com QUALQUER cartão, papel, documento ou mancha clara/branca geométrica (faixa, tira, trapézio ou retângulo claro) na base do para-brisa ou sobre o painel (mesmo pequeno, desfocado ou sob reflexo).'
          },
          verification: {
            type: Type.STRING,
            description: '"transferencia" (se a área de transferência zebrada estiver obstruída/invadida por veículo, moto, roda ou objeto, inclusive quando hasVehicle for false), "faixa de pedestres", "Vaga exclusiva" (somente se hasVehicle=true E possibleCredential=false) ou "" (se possibleCredential=true ou sem infração).'
          },
          rejectionReason: {
            type: Type.STRING,
            description: 'Retorne "" se verification for "transferencia" ou se hasVehicle e isAppropriate forem true. Caso contrário, detalhe o motivo.'
          },
          plates: {
            type: Type.ARRAY,
            description: 'Lista com box_2d [ymin, xmin, ymax, xmax] (0 a 1000) de TODAS as placas de veículos visíveis na imagem (independentemente de o veículo ser o principal, adjacente ou ao fundo). Se não houver, [].',
            items: plateBox2dItemSchema
          },
          faces: {
            type: Type.ARRAY,
            description: 'Lista com box_2d [ymin, xmin, ymax, xmax] (0 a 1000) delimitando EXCLUSIVAMENTE o rosto/cabeça humana (da testa ao queixo, de orelha a orelha). PROIBIDO incluir tronco, roupas, pernas ou o corpo inteiro do pedestre. Se não houver, [].',
            items: faceBox2dItemSchema
          }
        },
        propertyOrdering: [
          'isAppropriate',
          'hasVehicle',
          'possibleCredential',
          'verification',
          'rejectionReason',
          'plates',
          'faces'
        ]
      };

  let lastError: unknown = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response: GenerateContentResponse = await client.models.generateContent({
        model,
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });

      const rawText = response.text ? response.text.trim() : '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Modelo ${model} retornou resposta vazia ou sem JSON.`);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validação, sanitização e conversão inteligente de coordenadas (aceita 0..1, 0..1000, [ymin, xmin, ymax, xmax])
      const sanitizeAndNormalizeBoxes = (boxes: any[]): BoundingBox[] => {
        if (!Array.isArray(boxes)) return [];
        const result: BoundingBox[] = [];

        for (const item of boxes) {
          if (!item) continue;
          let x = 0;
          let y = 0;
          let width = 0;
          let height = 0;

          if (typeof item === 'object' && !Array.isArray(item)) {
            if (Array.isArray(item.box_2d) && item.box_2d.length === 4) {
              const [ymin, xmin, ymax, xmax] = item.box_2d;
              x = xmin;
              y = ymin;
              width = xmax - xmin;
              height = ymax - ymin;
            } else if ('xmin' in item && 'ymin' in item && 'xmax' in item && 'ymax' in item) {
              x = item.xmin;
              y = item.ymin;
              width = item.xmax - item.xmin;
              height = item.ymax - item.ymin;
            } else if ('x' in item && 'y' in item && 'width' in item && 'height' in item) {
              x = item.x;
              y = item.y;
              width = item.width;
              height = item.height;
            } else if ('x' in item && 'y' in item && 'w' in item && 'h' in item) {
              x = item.x;
              y = item.y;
              width = item.w;
              height = item.h;
            }
          } else if (Array.isArray(item) && item.length === 4) {
            const [ymin, xmin, ymax, xmax] = item;
            x = xmin;
            y = ymin;
            width = xmax - xmin;
            height = ymax - ymin;
          }

          if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            continue;
          }

          if (width <= 0 || height <= 0) {
            continue;
          }

          // Se as coordenadas estiverem na escala 0-1000 (padrão de visão do Gemini)
          if (x > 1 || y > 1 || width > 1 || height > 1) {
            x = x / 1000;
            y = y / 1000;
            width = width / 1000;
            height = height / 1000;
          }

          x = Math.max(0, Math.min(1, x));
          y = Math.max(0, Math.min(1, y));
          width = Math.max(0.005, Math.min(1 - x, width));
          height = Math.max(0.005, Math.min(1 - y, height));

          if (width > 0.005 && height > 0.005) {
            result.push({ x, y, width, height });
          }
        }
        return result;
      };

      const plates = sanitizeAndNormalizeBoxes(parsed.plates);
      const faces = sanitizeAndNormalizeBoxes(parsed.faces);
      const verification = typeof parsed.verification === 'string' ? parsed.verification.trim() : '';
      const possibleCredential = Boolean(parsed.possibleCredential);

      if (isUrbanMode) {
        const isAppropriate = Boolean(parsed.isAppropriate);
        const isUrbanEnvironment = parsed.isUrbanEnvironment !== undefined ? Boolean(parsed.isUrbanEnvironment) : true;
        const hasTrafficInfractionVehicle = Boolean(parsed.hasTrafficInfractionVehicle);
        const urbanDescription = typeof parsed.urbanDescription === 'string'
          ? parsed.urbanDescription.trim().slice(0, 300)
          : '';

        let rejectionReason = '';
        if (!isAppropriate) {
          rejectionReason = 'foto inapropriada';
        } else if (!isUrbanEnvironment) {
          rejectionReason =
            (typeof parsed.rejectionReason === 'string' && parsed.rejectionReason.trim()) ||
            'A foto enviada não parece mostrar uma calçada, via pública ou ambiente urbano.';
        }

        console.log(
          `[geminiService] Sucesso (Urbana) com ${model}. Apropriada: ${isAppropriate}, Ambiente urbano: ${isUrbanEnvironment}, Veículo infração: ${hasTrafficInfractionVehicle}, Placas: ${plates.length}, Rostos: ${faces.length}`
        );

        return {
          hasVehicle: hasTrafficInfractionVehicle,
          isAppropriate,
          possibleCredential: false,
          isUrbanEnvironment,
          hasTrafficInfractionVehicle,
          urbanDescription,
          rejectionReason,
          plates,
          faces,
          verification,
          apiError: false
        };
      }

      console.log(
        `[geminiService] Sucesso com ${model}. Placas encontradas: ${plates.length}, Rostos encontrados: ${faces.length}, Possível credencial: ${possibleCredential}, Verificação: "${verification}"`
      );

      const parsedRejectionReason = typeof parsed.rejectionReason === 'string' ? parsed.rejectionReason.trim() : '';

      const isTransferencia = verification.toLowerCase().includes('transfer');

      return {
        hasVehicle: Boolean(parsed.hasVehicle),
        isAppropriate: Boolean(parsed.isAppropriate),
        possibleCredential,
        rejectionReason:
          !parsed.isAppropriate
            ? parsedRejectionReason || 'A imagem enviada não atende às diretrizes de uso.'
            : !parsed.hasVehicle && !isTransferencia
              ? parsedRejectionReason || 'Nenhum veículo identificado na imagem.'
              : '',
        plates,
        faces,
        verification,
        apiError: false
      };
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    ...defaultFailure,
    rejectionReason: 'Instabilidade temporária no serviço de IA (Google Gemini). Por favor, tente novamente em alguns instantes.',
    apiError: true
  };
}

export async function isCarInImage(
  client: GoogleGenAI | null,
  imageBase64: string
): Promise<boolean> {
  const result = await analyzeIncidentImage(client, imageBase64);
  return result.hasVehicle && result.isAppropriate;
}

export async function getSensitiveContentBoundingBoxes(
  client: GoogleGenAI | null,
  imageBase64: string
): Promise<{ plates: BoundingBox[], faces: BoundingBox[] }> {
  const result = await analyzeIncidentImage(client, imageBase64);
  return {
    plates: result.plates,
    faces: result.faces
  };
}

/**
 * Compara duas fotos de infrações de trânsito registradas num intervalo de até 2 minutos
 * e raio de até 10 metros, perguntando ao Gemini se o(s) veículo(s) podem ser o(s) mesmo(s),
 * inclusive se fotografados de outro ângulo, distância ou perspectiva.
 */
export async function compareVehicleDuplicityWithGemini(
  client: GoogleGenAI | null,
  existingImageBase64: string,
  newImageBase64: string
): Promise<DuplicateComparisonResult> {
  if (!client || !existingImageBase64 || !newImageBase64) {
    return {
      isPossibleDuplicate: false,
      confidence: 'baixa',
      reason: 'Dados insuficientes para comparação.',
      apiError: true
    };
  }

  const parsedExisting = parseBase64Image(existingImageBase64);
  const parsedNew = parseBase64Image(newImageBase64);

  const existingImagePart = {
    inlineData: {
      mimeType: parsedExisting.mimeType,
      data: parsedExisting.data
    }
  };

  const newImagePart = {
    inlineData: {
      mimeType: parsedNew.mimeType,
      data: parsedNew.data
    }
  };

  const prompt = `
Compare estas duas fotos de denúncia de infração de trânsito registradas num raio de 10 metros nos últimos 2 minutos.
A Imagem 1 é a primeira denúncia registrada e a Imagem 2 é a nova denúncia.

Analise se os veículos em destaque nas duas imagens PODEM SER OS MESMOS veículos (mesmo carro/moto/caminhonete/utilitário estacionado no mesmo local), ainda que tenham sido fotografados de OUTRO ÂNGULO, outra distância ou outra perspectiva (por exemplo: frente vs traseira, lateral esquerda vs lateral direita, mais perto vs mais longe).

Considere:
- Tipo de carroceria (hatch, sedan, SUV, picape, moto, van, etc.), cor, formato dos faróis/lanternas, rodas, vidros, adesivos ou detalhes visuais.
- O ambiente ao redor (mesma vaga, calçada, parede, pintura no solo, árvores ou fachada).
- Ignore o desfoque de privacidade nas placas e rostos humanos.
- Se houver possibilidade razoável de que seja o mesmo veículo visto de outro ângulo ou do mesmo ângulo no mesmo local, retorne "isPossibleDuplicate": true.
- Somente retorne "isPossibleDuplicate": false se os veículos forem claramente diferentes (ex: cores incompatíveis, modelos/portes totalmente distintos).

Retorne estritamente o JSON:
{"isPossibleDuplicate": bool, "confidence": "alta" | "media" | "baixa", "reason": str}
`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      isPossibleDuplicate: {
        type: Type.BOOLEAN,
        description: 'True se os veículos nas duas imagens puderem ser os mesmos, mesmo que de outro ângulo.'
      },
      confidence: {
        type: Type.STRING,
        description: 'Nível de confiança: "alta", "media" ou "baixa".'
      },
      reason: {
        type: Type.STRING,
        description: 'Breve justificativa em português explicando a comparação visual.'
      }
    },
    propertyOrdering: ['isPossibleDuplicate', 'confidence', 'reason']
  };

  for (const model of CANDIDATE_MODELS) {
    try {
      const response: GenerateContentResponse = await client.models.generateContent({
        model,
        contents: {
          parts: [
            { text: 'Imagem 1 (Denúncia anterior):' },
            existingImagePart,
            { text: 'Imagem 2 (Nova denúncia):' },
            newImagePart,
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });

      const rawText = response.text ? response.text.trim() : '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Modelo ${model} retornou resposta vazia na comparação de duplicidade.`);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const isPossibleDuplicate = Boolean(parsed.isPossibleDuplicate);
      const confidence = typeof parsed.confidence === 'string' ? parsed.confidence.trim() : 'media';
      const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';

      console.log(
        `[geminiService] Comparação anti-duplicidade (${model}): isPossibleDuplicate=${isPossibleDuplicate}, confidence=${confidence}, reason="${reason}"`
      );

      return {
        isPossibleDuplicate,
        confidence,
        reason,
        apiError: false
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[geminiService] Tentativa de comparação falhou no modelo ${model}: ${errMsg}`);
    }
  }

  return {
    isPossibleDuplicate: false,
    confidence: 'baixa',
    reason: 'Não foi possível concluir a comparação por IA no momento.',
    apiError: true
  };
}