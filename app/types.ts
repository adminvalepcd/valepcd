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
  rejectionReason: string;
  plates: BoundingBox[];
  faces: BoundingBox[];
  apiError?: boolean;
}

export interface ReportedIncident {
  id?: string;
  maskedImageUrl: string;
  timestamp: number | string | Date;
  latitude: number;
  longitude: number;
  description?: string;
  ativo?: boolean;
  motivo_denuncia?: string;
}
