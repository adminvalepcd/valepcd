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
  imageBase64: string
): Promise<IncidentAnalysisResult> {
  const defaultFailure: IncidentAnalysisResult = {
    hasVehicle: false,
    isAppropriate: false,
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

  const prompt = `
Audite a imagem (LGPD/Trânsito) e retorne o JSON:
{"hasVehicle": bool, "isAppropriate": bool, "rejectionReason": str, "plates": [{box_2d: [ymin,xmin,ymax,xmax], label: str}], "faces": [{box_2d: [ymin,xmin,ymax,xmax]}], "verification": str}
"rejectionReason": motivo se falso em 1 ou 2, senão "".
"verification" deve ser apenas um dos valores:

"transferencia": veículo ocupando ou com rodas sobre a pintura zebrada PCD acima de 25%.
"Vaga exclusiva": veículo na vaga PCD/Idoso sem credencial visível (pneus fora do zebrado ou ocupando ≤ 25%).
"faixa de pedestres": veículo sobre a faixa de pedestres.
"": se nenhum dos anteriores
Prioridade: Se o zebrado (> 25% de ocupação) ou faixa de pedestres estiver ocupado, este é o veículo PRINCIPAL.
`;

  const { data, mimeType } = parseBase64Image(imageBase64);
  const imagePart = {
    inlineData: {
      mimeType,
      data,
    },
  };

  const schema = {
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
        items: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.NUMBER, description: 'Coordenada horizontal do canto superior esquerdo xmin (0 a 1000 ou 0 a 1).' },
            y: { type: Type.NUMBER, description: 'Coordenada vertical do canto superior esquerdo ymin (0 a 1000 ou 0 a 1).' },
            width: { type: Type.NUMBER, description: 'Largura total da caixa cobrindo toda a placa (0 a 1000 ou 0 a 1).' },
            height: { type: Type.NUMBER, description: 'Altura total da caixa cobrindo toda a placa (0 a 1000 ou 0 a 1).' }
          },
          propertyOrdering: ['x', 'y', 'width', 'height']
        }
      },
      faces: {
        type: Type.ARRAY,
        description: 'Lista de caixas delimitadoras de rostos humanos encontrados.',
        items: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.NUMBER, description: 'Coordenada horizontal do canto superior esquerdo xmin (0 a 1000 ou 0 a 1).' },
            y: { type: Type.NUMBER, description: 'Coordenada vertical do canto superior esquerdo ymin (0 a 1000 ou 0 a 1).' },
            width: { type: Type.NUMBER, description: 'Largura total da caixa (0 a 1000 ou 0 a 1).' },
            height: { type: Type.NUMBER, description: 'Altura total da caixa (0 a 1000 ou 0 a 1).' }
          },
          propertyOrdering: ['x', 'y', 'width', 'height']
        }
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