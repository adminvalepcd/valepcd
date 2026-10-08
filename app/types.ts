export interface Geolocation {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
}

export interface GeminiSensitiveContentResponse {
  plates?: BoundingBox[];
  faces?: BoundingBox[];
}

export interface IncidentAnalysisResult {
  hasVehicle: boolean;
  isAppropriate: boolean;
  isUrbanEnvironment?: boolean;
  hasTrafficInfractionVehicle?: boolean;
  urbanDescription?: string;
  rejectionReason: string;
  plates: BoundingBox[];
  faces: BoundingBox[];
  verification?: string;
  apiError?: boolean;
}

export interface ReportedIncident {
  id?: string;
  maskedImageUrl: string;
  fotoUrl?: string;
  timestamp: number | string | Date;
  latitude: number;
  longitude: number;
  geohash?: string;
  natureza?: string;
  descricao?: string;
  cidade?: string;
  estado?: string;
  rua?: string;
  bairro?: string;
  classificacao?: 'A' | 'B' | 'C' | string;
  verificacao?: 'exclusiva' | 'transferencia' | 'pedestre' | '' | string;
  description?: string;
  ativo?: boolean;
  motivo_denuncia?: string;
  resolvido_em_validacao?: boolean;
  status_resolucao?: string;
}
