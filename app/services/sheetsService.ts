import type { ReportedIncident } from '../types';
import { getAddressDetailsFromCoords, extractCityAndStateFromText, normalizeState } from './geoService';

export interface SheetRowPayload {
  id: string;
  data: string;
  latitude: number;
  longitude: number;
  foto: string;
  ativo?: boolean;
  motivo_denuncia?: string;
  cidade?: string;
  estado?: string;
}

export interface FetchIncidentsOptions {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  includePhoto?: boolean;
}

const ACTIVE_APPS_SCRIPT_DEPLOYMENT_ID = 'AKfycbyICoKQagn4rYq2_38n4DZNBMi4kbZCg07zkHwdSuiNwU6Tk1ZIzETNUh368g3mvOHM';
const ACTIVE_APPS_SCRIPT_URL = `https://script.google.com/macros/s/${ACTIVE_APPS_SCRIPT_DEPLOYMENT_ID}/exec`;

/**
 * Garante que toda chamada use SEMPRE a implantação ativa do Apps Script.
 * Variáveis de ambiente antigas (cache do `nuxt dev`, painel da Vercel, build antigo em cache
 * no service worker do navegador) apontando para implantações anteriores são descartadas,
 * pois implantações antigas gravam em código desatualizado ou simplesmente não respondem.
 */
export function normalizeAppsScriptUrl(url?: string): string {
  if (!url) return ACTIVE_APPS_SCRIPT_URL;

  // Qualquer URL de Apps Script que não seja a implantação ativa é substituída
  if (url.includes('script.google.com/macros/')) {
    if (!url.includes(ACTIVE_APPS_SCRIPT_DEPLOYMENT_ID)) {
      console.warn('[sheetsService] URL de implantação desatualizada detectada. Redirecionando para a implantação ativa.');
      return ACTIVE_APPS_SCRIPT_URL;
    }
    return url;
  }

  return url;
}

export async function fetchIncidentsFromSheet(
  appsScriptUrl?: string,
  options?: FetchIncidentsOptions
): Promise<ReportedIncident[]> {
  const normalizedUrl = normalizeAppsScriptUrl(appsScriptUrl);
  if (!normalizedUrl) {
    // Carrega do cache local se a URL do Apps Script ainda não estiver preenchida
    return loadIncidentsFromLocalCache();
  }

  try {
    let finalUrl = normalizedUrl;
    if (options) {
      try {
        const urlObj = new URL(normalizedUrl);
        if (options.latitude !== undefined && options.longitude !== undefined) {
          urlObj.searchParams.set('lat', String(options.latitude));
          urlObj.searchParams.set('lng', String(options.longitude));
        }
        if (options.radiusKm !== undefined) {
          urlObj.searchParams.set('radius', String(options.radiusKm));
        }
        if (options.includePhoto !== undefined) {
          urlObj.searchParams.set('include_photo', String(options.includePhoto));
        }
        finalUrl = urlObj.toString();
      } catch {}
    }

    const response = await fetch(finalUrl, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Erro na planilha (HTTP ${response.status})`);
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return loadIncidentsFromLocalCache();
    }

    const incidents: ReportedIncident[] = rows
      .map((row: any, idx: number) => {
        const lat = parseFloat(row.latitude ?? row.lat);
        const lng = parseFloat(row.longitude ?? row.lng ?? row.lon);
        if (isNaN(lat) || isNaN(lng)) return null;

        const isAtivo = row.ativo !== undefined && row.ativo !== ''
          ? (row.ativo === true || String(row.ativo).toLowerCase() === 'true')
          : true;

        if (!isAtivo) return null; // Não exibe inativos no mapa

        return {
          id: String(row.id || row.is || `row-${idx + 1}`),
          timestamp: row.data || row.timestamp || new Date().toISOString(),
          latitude: lat,
          longitude: lng,
          cidade: row.cidade || '',
          estado: row.estado || '',
          maskedImageUrl: row.foto || row.image || '',
          description: row.description || (row.cidade ? `${row.cidade}${row.estado ? ` - ${row.estado}` : ''}` : 'Infração registrada'),
          ativo: true,
          motivo_denuncia: row.motivo_denuncia || ''
        };
      })
      .filter((inc): inc is ReportedIncident => inc !== null);

    // Atualizar cache local
    if (typeof window !== 'undefined' && incidents.length > 0) {
      localStorage.setItem('multei_cached_incidents', JSON.stringify(incidents));
    }

    return incidents;
  } catch (err) {
    console.warn('[sheetsService] Erro ao buscar dados da planilha, usando cache local:', err);
    return loadIncidentsFromLocalCache();
  }
}

/**
 * Busca a foto pesada de uma ocorrência específica sob demanda (Lazy Loading)
 */
export async function fetchIncidentPhoto(
  appsScriptUrl: string,
  incidentId: string
): Promise<string> {
  const normalizedUrl = normalizeAppsScriptUrl(appsScriptUrl);
  if (!normalizedUrl || !incidentId) return '';
  try {
    const urlObj = new URL(normalizedUrl);
    urlObj.searchParams.set('id', incidentId);
    const response = await fetch(urlObj.toString());
    if (!response.ok) return '';
    const data = await response.json();
    return data.foto || '';
  } catch (err) {
    console.warn('[sheetsService] Erro ao buscar foto da ocorrência:', err);
    return '';
  }
}

export async function saveIncidentToSheet(
  appsScriptUrl: string,
  incident: SheetRowPayload
): Promise<{ success: boolean; cidade?: string; estado?: string }> {
  let resolvedCidade = (incident.cidade || '').trim();
  let resolvedEstado = normalizeState((incident.estado || '').trim());

  if ((!resolvedCidade || !resolvedEstado) && Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude)) {
    try {
      const geoDetails = await getAddressDetailsFromCoords(incident.latitude, incident.longitude);
      if (!resolvedCidade && geoDetails.cidade) resolvedCidade = geoDetails.cidade.trim();
      if (!resolvedEstado && geoDetails.estado) resolvedEstado = normalizeState(geoDetails.estado);
      if ((!resolvedCidade || !resolvedEstado) && geoDetails.formattedAddress) {
        const parsed = extractCityAndStateFromText(geoDetails.formattedAddress);
        if (!resolvedCidade && parsed.cidade) resolvedCidade = parsed.cidade.trim();
        if (!resolvedEstado && parsed.estado) resolvedEstado = normalizeState(parsed.estado);
      }
    } catch {}
  }

  // Coloca cidade e estado antes da foto base64 para garantir parsing prioritário no JSON
  const fullIncident = {
    id: incident.id,
    data: incident.data,
    latitude: incident.latitude,
    longitude: incident.longitude,
    cidade: resolvedCidade,
    estado: resolvedEstado,
    ativo: incident.ativo !== undefined ? incident.ativo : true,
    motivo_denuncia: incident.motivo_denuncia || '',
    foto: incident.foto
  };

  // Salvar sempre em cache local preventivamente
  saveIncidentToLocalCache({
    id: fullIncident.id,
    timestamp: fullIncident.data,
    latitude: fullIncident.latitude,
    longitude: fullIncident.longitude,
    cidade: fullIncident.cidade,
    estado: fullIncident.estado,
    maskedImageUrl: fullIncident.foto,
    description: 'Infração registrada',
    ativo: fullIncident.ativo,
    motivo_denuncia: fullIncident.motivo_denuncia
  });

  const normalizedUrl = normalizeAppsScriptUrl(appsScriptUrl);
  if (!normalizedUrl) {
    // Se a URL do script ainda não foi configurada, considera gravado no cache local do MVP
    return { success: true, cidade: fullIncident.cidade, estado: fullIncident.estado };
  }

  try {
    let targetUrl = normalizedUrl;
    try {
      const urlObj = new URL(normalizedUrl);
      if (resolvedCidade) urlObj.searchParams.set('cidade', resolvedCidade);
      if (resolvedEstado) urlObj.searchParams.set('estado', resolvedEstado);
      targetUrl = urlObj.toString();
    } catch {}

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // Crucial para o Google Apps Script não travar em CORS preflight
      },
      body: JSON.stringify(fullIncident)
    });

    if (!response.ok) {
      throw new Error(`Erro na gravação (HTTP ${response.status})`);
    }

    const result = await response.json();
    const finalCidade = result?.cidade || fullIncident.cidade || '';
    const finalEstado = result?.estado || fullIncident.estado || '';

    if (result && (result.success || result.status === 'ok')) {
      if (finalCidade || finalEstado) {
        saveIncidentToLocalCache({
          id: fullIncident.id,
          timestamp: fullIncident.data,
          latitude: fullIncident.latitude,
          longitude: fullIncident.longitude,
          cidade: finalCidade,
          estado: finalEstado,
          maskedImageUrl: fullIncident.foto,
          description: 'Infração registrada',
          ativo: fullIncident.ativo,
          motivo_denuncia: fullIncident.motivo_denuncia
        });
      }
      return {
        success: true,
        cidade: finalCidade,
        estado: finalEstado
      };
    }

    return { success: false };
  } catch (error) {
    console.error('[sheetsService] Erro ao gravar na planilha Google:', error);
    throw error;
  }
}

/**
 * Reporta uma ocorrência marcando-a como ativo=false e preenchendo o motivo na planilha
 */
export async function reportIncidentInSheet(
  appsScriptUrl: string,
  id: string,
  reason: string
): Promise<boolean> {
  // Remove imediatamente do cache local para sair do mapa
  if (typeof window !== 'undefined') {
    try {
      const cached = loadIncidentsFromLocalCache();
      const updated = cached.filter(inc => inc.id !== id);
      localStorage.setItem('multei_cached_incidents', JSON.stringify(updated));
    } catch (e) {
      console.warn('[sheetsService] Erro ao atualizar cache local na denúncia:', e);
    }
  }

  const normalizedUrl = normalizeAppsScriptUrl(appsScriptUrl);
  if (!normalizedUrl) {
    return true;
  }

  try {
    const response = await fetch(normalizedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'report',
        id,
        reason
      })
    });

    if (!response.ok) {
      throw new Error(`Erro ao reportar na planilha (HTTP ${response.status})`);
    }

    const result = await response.json();
    return Boolean(result && (result.success || result.status === 'ok'));
  } catch (error) {
    console.error('[sheetsService] Erro ao reportar infração na planilha Google:', error);
    throw error;
  }
}

function loadIncidentsFromLocalCache(): ReportedIncident[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('multei_cached_incidents');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  return [];
}

function saveIncidentToLocalCache(inc: ReportedIncident) {
  if (typeof window === 'undefined') return;
  try {
    const list = loadIncidentsFromLocalCache();
    list.unshift(inc);
    localStorage.setItem('multei_cached_incidents', JSON.stringify(list));
  } catch (e) {
    // ignore
  }
}
