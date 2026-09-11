import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type { BoundingBox, GeminiSensitiveContentResponse, IncidentAnalysisResult } from '../types';

export function initializeGeminiClient(apiKey: string): GoogleGenAI {
  if (!apiKey) {
    throw new Error("API_KEY was not provided for Gemini client initialization.");
  }

  try {
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[geminiService] Failed to initialize GoogleGenAI: ${message}`);
    throw new Error(`Gemini AI Service initialization failed: ${message}`);
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
 * 1. Verifica se há veículo (carro, caminhão, moto, van ou ônibus).
 * 2. Valida segurança e moderação de conteúdo (sem nudez, gore ou ofensas).
 * 3. Se reprovada, descreve a razão em português.
 * 4. Se aprovada, retorna as caixas delimitadoras de placas de carro e rostos humanos.
 */
export async function analyzeIncidentImage(
  client: GoogleGenAI,
  imageBase64: string
): Promise<IncidentAnalysisResult> {
  const defaultFailure: IncidentAnalysisResult = {
    hasVehicle: false,
    isAppropriate: false,
    rejectionReason: 'Não foi possível analisar a imagem enviada. Tente novamente.',
    plates: [],
    faces: []
  };

  if (!client) {
    console.error('[geminiService] Cliente Gemini não inicializado.');
    return defaultFailure;
  }

  const prompt = `
Você é um auditor de infrações de trânsito em vagas prioritárias (PCD).
Analise a imagem enviada:
1. Verifique se existe pelo menos um veículo motorizado (carro, caminhonete, van, caminhão, moto ou ônibus). (hasVehicle: boolean)
2. Verifique se o conteúdo é apropriado e seguro para um aplicativo público (sem nudez, pornografia, violência gráfica, armas ou conteúdo ofensivo). (isAppropriate: boolean)
3. Se hasVehicle for falso ou isAppropriate for falso, informe o motivo em português em rejectionReason. Se for aprovado, deixe rejectionReason vazio.
4. Identifique todas as placas de veículos e rostos humanos para anonimização com caixas delimitadoras (bounding boxes normalizados de 0.0 a 1.0 para x, y, width e height).
`;

  const { data, mimeType } = parseBase64Image(imageBase64);
  const imagePart = {
    inlineData: {
      mimeType,
      data,
    },
  };

  try {
    const response: GenerateContentResponse = await client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasVehicle: {
              type: Type.BOOLEAN,
              description: 'True se houver um veículo na foto.'
            },
            isAppropriate: {
              type: Type.BOOLEAN,
              description: 'True se a imagem for segura e apropriada.'
            },
            rejectionReason: {
              type: Type.STRING,
              description: 'Motivo da rejeição em português se inválido, ou vazio se válido.'
            },
            plates: {
              type: Type.ARRAY,
              description: 'Lista de caixas delimitadoras de placas de veículos encontradas.',
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER, description: 'Coordenada x normalizada (0 a 1).' },
                  y: { type: Type.NUMBER, description: 'Coordenada y normalizada (0 a 1).' },
                  width: { type: Type.NUMBER, description: 'Largura normalizada (0 a 1).' },
                  height: { type: Type.NUMBER, description: 'Altura normalizada (0 a 1).' }
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
                  x: { type: Type.NUMBER, description: 'Coordenada x normalizada (0 a 1).' },
                  y: { type: Type.NUMBER, description: 'Coordenada y normalizada (0 a 1).' },
                  width: { type: Type.NUMBER, description: 'Largura normalizada (0 a 1).' },
                  height: { type: Type.NUMBER, description: 'Altura normalizada (0 a 1).' }
                },
                propertyOrdering: ['x', 'y', 'width', 'height']
              }
            }
          },
          propertyOrdering: ['hasVehicle', 'isAppropriate', 'rejectionReason', 'plates', 'faces']
        }
      }
    });

    const rawText = response.text ? response.text.trim() : '';
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    if (!cleanJson) {
      return defaultFailure;
    }

    const parsed = JSON.parse(cleanJson);

    // Validação e sanitização das coordenadas normalizadas
    const sanitizeBoxes = (boxes: any[]): BoundingBox[] => {
      if (!Array.isArray(boxes)) return [];
      return boxes.filter(b => 
        typeof b.x === 'number' && b.x >= 0 && b.x <= 1 &&
        typeof b.y === 'number' && b.y >= 0 && b.y <= 1 &&
        typeof b.width === 'number' && b.width > 0 && b.width <= 1 &&
        typeof b.height === 'number' && b.height > 0 && b.height <= 1
      );
    };

    return {
      hasVehicle: Boolean(parsed.hasVehicle),
      isAppropriate: Boolean(parsed.isAppropriate),
      rejectionReason: parsed.rejectionReason || (
        !parsed.hasVehicle ? 'Nenhum veículo identificado na imagem.' : 
        (!parsed.isAppropriate ? 'A imagem enviada não atende às diretrizes de uso.' : '')
      ),
      plates: sanitizeBoxes(parsed.plates),
      faces: sanitizeBoxes(parsed.faces)
    };
  } catch (error) {
    console.error('[geminiService] Erro ao analisar imagem:', error);
    return {
      ...defaultFailure,
      rejectionReason: 'Erro de comunicação com a IA do Gemini ao processar a imagem.'
    };
  }
}

export async function isCarInImage(
  client: GoogleGenAI,
  imageBase64: string
): Promise<boolean> {
  const result = await analyzeIncidentImage(client, imageBase64);
  return result.hasVehicle && result.isAppropriate;
}

export async function getSensitiveContentBoundingBoxes(
  client: GoogleGenAI,
  imageBase64: string
): Promise<{ plates: BoundingBox[], faces: BoundingBox[] }> {
  const result = await analyzeIncidentImage(client, imageBase64);
  return {
    plates: result.plates,
    faces: result.faces
  };
}