import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type { BoundingBox, GeminiSensitiveContentResponse, IncidentAnalysisResult } from '../types';

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

  const trafficPrompt = `
Audite a imagem (LGPD/Trânsito) e retorne o JSON:
{"hasVehicle": bool, "isAppropriate": bool, "rejectionReason": str, "plates": [{box_2d: [ymin,xmin,ymax,xmax], label: str}], "faces": [{box_2d: [ymin,xmin,ymax,xmax]}], "verification": str}

Diretrizes de Moderação e Auditoria:

1. Moderação da Imagem:
- "isAppropriate": true se a imagem for apropriada (imagem normal de trânsito/rua). false SOMENTE em caso de conteúdo impróprio (pornografia, nudismo, violência, gore).
- "hasVehicle": true se houver qualquer veículo na imagem (carros, motos, caminhões), senão false.
- "rejectionReason": motivo detalhado se "isAppropriate" ou "hasVehicle" for false. Se ambos forem true, retorne "".

2. Classificação de Infração ("verification"):
Identifique o veículo PRINCIPAL (em destaque ou cometendo a infração) e classifique "verification" estritamente como um destes valores:

- "faixa de pedestres": veículo efetivamente com as rodas ou carroceria SOBRE a marcação de faixa de pedestres. (Se o veículo estiver apenas parado ANTES da faixa, NÃO considere infração).
- "transferencia": veículo/moto ocupando ou com rodas sobre a pintura zebrada amarela/azul PCD (área de transferência de cadeirantes).
- "Vaga exclusiva": veículo parado em vaga reservada (sinalizada por pintura no chão PCD/Idoso OU por placa R-6b de Estacionamento Regulamentado com informação complementar de vaga exclusiva) SEM credencial visível no painel.
- "": se o veículo estiver estacionado em vaga comum/permitida ou se não houver infração clara identificável na imagem.

Regra de Incerteza Visual:
- Se houver placa de vaga exclusiva ou pintura no chão, mas a credencial no painel do veículo não puder ser verificada devido a insulfilm/distância/ângulo da foto, priorize a verificação do espaço físico e retorne "Vaga exclusiva" caso o veículo esteja na vaga reservada sem credencial aparente.`;

  const urbanPrompt = `
Audite a imagem (LGPD/Mobilidade e Acessibilidade Urbana) e retorne o JSON:
{"isAppropriate": bool, "isUrbanEnvironment": bool, "hasTrafficInfractionVehicle": bool, "verification": str, "urbanDescription": str, "rejectionReason": str, "plates": [{box_2d: [ymin,xmin,ymax,xmax], label: str}], "faces": [{box_2d: [ymin,xmin,ymax,xmax]}]}

Diretrizes de Moderação e Auditoria (Mobilidade Urbana):

1. Moderação e Pertinência da Imagem:
- "isAppropriate": false SOMENTE se a imagem contiver conteúdo impróprio (nudez, pornografia, violência, gore ou semelhantes). Se for imprópria, retorne "foto inapropriada" em "rejectionReason".
- "isUrbanEnvironment": true se a foto mostrar ambiente urbano, calçada, rua, rampa, faixa de travessia, piso tátil, estacionamento ou espaço público/coletivo. false se a imagem claramente não tiver relação com ambiente urbano/calçada/via pública (ex: foto interna de quarto, selfie fechada, tela de computador, objeto doméstico).
- "rejectionReason": se "isAppropriate" for false, retorne exatamente "foto inapropriada". Se "isUrbanEnvironment" for false, explique brevemente que a foto deve mostrar uma calçada ou via pública. Caso contrário, retorne "".

2. Detecção de Infração de Trânsito na Imagem ("hasTrafficInfractionVehicle" e "verification"):
- "hasTrafficInfractionVehicle": true SE constar na foto um veículo parado sobre faixa de pedestres OU em vagas de estacionamento PCD / área de transferência zebrada PCD. Caso contrário, false.
- "verification": se "hasTrafficInfractionVehicle" for true, preencha com "faixa de pedestres", "transferencia" ou "Vaga exclusiva". Senão, retorne "".

3. Descrição de Acessibilidade Urbana ("urbanDescription"):
- Descreva em português (máximo de 300 caracteres) o que há na imagem com foco na acessibilidade e mobilidade urbana (ex: "Buraco na calçada dificultando a passagem", "Rampa de acessibilidade quebrada", "Piso tátil danificado ou interrompido", "Calçada obstruída por entulho/obras", etc.).

4. Proteção de Privacidade / LGPD ("plates" e "faces") — OBRIGATÓRIO:
- "plates": IMPORTANTE: Localize com precisão as caixas delimitadoras (bounding boxes) de TODAS as placas de veículos visíveis na cena (dianteiras e traseiras de qualquer veículo estacionado, em movimento ou ao fundo), cobrindo toda a extensão da placa (incluindo moldura e caracteres), onde x e y são o canto superior esquerdo (xmin, ymin) e width e height são a largura e altura da caixa para aplicação do desfoque pesado de privacidade.
- "faces": IMPORTANTE: Localize com precisão as caixas delimitadoras de TODOS os rostos humanos visíveis na cena (pedestres, trabalhadores, motoristas ou pessoas ao fundo), onde x e y são o canto superior esquerdo (xmin, ymin) e width e height são a largura e altura da caixa para aplicação do desfoque pesado de privacidade.`;

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
      width: { type: Type.NUMBER, description: 'Largura total da caixa cobrindo toda a placa ou rosto (0 a 1000 ou 0 a 1).' },
      height: { type: Type.NUMBER, description: 'Altura total da caixa cobrindo toda a placa ou rosto (0 a 1000 ou 0 a 1).' }
    },
    propertyOrdering: ['x', 'y', 'width', 'height']
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
            description: 'Lista obrigatória de caixas delimitadoras de TODOS os rostos humanos visíveis na imagem para desfoque de privacidade.',
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
          hasVehicle: {
            type: Type.BOOLEAN,
            description: 'True se houver qualquer veículo motorizado na foto.'
          },
          isAppropriate: {
            type: Type.BOOLEAN,
            description: 'True se a imagem for segura e apropriada para o aplicativo público.'
          },
          rejectionReason: {
            type: Type.STRING,
            description: 'Motivo da rejeição em português se inválido, ou vazio se aprovado.'
          },
          plates: {
            type: Type.ARRAY,
            description: 'Lista de caixas delimitadoras de placas de veículos encontradas.',
            items: boundingBoxItemsSchema
          },
          faces: {
            type: Type.ARRAY,
            description: 'Lista de caixas delimitadoras de rostos humanos encontrados.',
            items: boundingBoxItemsSchema
          },
          verification: {
            type: Type.STRING,
            description: 'Retorne "Vaga exclusiva" se houver sinalização de vaga acessível (cadeira de rodas), "faixa de pedestres" se o veículo estiver sobre faixa de pedestres, "transferencia" se estiver sobre área de transferência de vaga PCD, ou "" se não identificado.'
          }
        },
        propertyOrdering: ['hasVehicle', 'isAppropriate', 'rejectionReason', 'plates', 'faces', 'verification']
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

      console.log(`[geminiService] Sucesso com ${model}. Placas encontradas: ${plates.length}, Rostos encontrados: ${faces.length}, Verificação: "${verification}"`);

      return {
        hasVehicle: Boolean(parsed.hasVehicle),
        isAppropriate: Boolean(parsed.isAppropriate),
        rejectionReason:
          !parsed.hasVehicle ? 'Nenhum veículo identificado na imagem.' : 
          (!parsed.isAppropriate ? 'A imagem enviada não atende às diretrizes de uso.' : ''),
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