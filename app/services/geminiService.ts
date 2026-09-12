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
Você é um auditor de trânsito em vagas reservadas para pessoas com deficiência (PCD) e idosos.
Analise a imagem enviada com atenção aos seguintes critérios:
1. "hasVehicle": Defina como true se houver QUALQUER veículo automotor (carro, automóvel, caminhonete, SUV, van, caminhão, moto, micro-ônibus ou ônibus) visível na foto, mesmo que parcialmente enquadrado, em ângulo aberto ou fechado, estacionado ou em movimento. Apenas defina como false se comprovadamente não houver nenhum veículo na imagem (por exemplo, foto apenas do chão/asfalto vazio, parede, pessoa isolada, texto ou objeto não veicular).
2. "isAppropriate": Defina como true se a imagem for segura para exibição pública em um aplicativo cívico (sem pornografia, nudez, violência extrema/sangue ou armas de fogo). Fotos cotidianas de vias públicas, estacionamentos, ruas e veículos automotores DEVEM ser sempre consideradas apropriadas (true).
3. "rejectionReason": Se hasVehicle for false ou isAppropriate for false, retorne uma explicação concisa em português do motivo da rejeição. Se a foto for aprovada, retorne uma string vazia "".
4. "plates": Caixas delimitadoras de TODAS as placas de veículos visíveis para aplicação de desfoque de privacidade (coordenadas x, y, width, height normalizadas entre 0.0 e 1.0).
5. "faces": Caixas delimitadoras de TODOS os rostos humanos visíveis para aplicação de desfoque de privacidade (coordenadas x, y, width, height normalizadas entre 0.0 e 1.0).
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
        faces: sanitizeBoxes(parsed.faces),
        apiError: false
      };
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[geminiService] Modelo ${model} falhou, tentando próximo modelo na lista:`, errMsg);
    }
  }

  console.error('[geminiService] Todos os modelos Gemini falharam:', lastError);
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