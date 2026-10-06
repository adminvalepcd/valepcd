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
  rua?: string;
  bairro?: string;
  classificacao?: 'A' | 'B' | 'C' | string;
  verificacao?: 'exclusiva' | 'transferencia' | 'pedestre' | '' | string;
}

export function normalizeVerificacao(raw?: unknown): 'exclusiva' | 'transferencia' | 'pedestre' | '' {
  if (!raw) return '';
  const v = String(raw).trim().toLowerCase();
  if (!v) return '';
  if (v.includes('transfer') || v.includes('zebrad')) {
    return 'transferencia';
  }
  if (v.includes('exclusiv') || v.includes('vaga') || v.includes('acess') || v.includes('cadeira')) {
    return 'exclusiva';
  }
  if (v.includes('pedestr') || v.includes('faixa')) {
    return 'pedestre';
  }
  return '';
}

export interface FetchIncidentsOptions {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  includePhoto?: boolean;
}

/**
 * Fallback caso NUXT_PUBLIC_APPS_SCRIPT_URL não esteja definida no ambiente de produção
 */
export const ACTIVE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw-12Ex8c5J4fXzg3bcP9ZLlzFDhgzClWydxsbzFedm1CcdcrOljKFokKuuOSUSSEFv/exec';

/**
 * Usa a URL configurada no .env (NUXT_PUBLIC_APPS_SCRIPT_URL) ou o fallback padrão.
 */
export function normalizeAppsScriptUrl(url?: string): string {
  const clean = (url || '').trim();
  if (clean) return clean;
  return ACTIVE_APPS_SCRIPT_URL;
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

        const ruaVal = row.rua ? String(row.rua).trim() : '';
        const bairroVal = row.bairro ? String(row.bairro).trim() : '';
        const cidadeVal = row.cidade ? String(row.cidade).trim() : '';
        const estadoVal = row.estado ? String(row.estado).trim() : '';
        const classificacaoVal = row.classificacao ? String(row.classificacao).trim().toUpperCase() : '';
        const verificacaoVal = normalizeVerificacao(row.verificacao ?? row.verification);
        const descParts = [ruaVal, bairroVal, cidadeVal, estadoVal].filter(Boolean);

        return {
          id: String(row.id || row.is || `row-${idx + 1}`),
          timestamp: row.data || row.timestamp || new Date().toISOString(),
          latitude: lat,
          longitude: lng,
          rua: ruaVal,
          bairro: bairroVal,
          cidade: cidadeVal,
          estado: estadoVal,
          classificacao: classificacaoVal,
          verificacao: verificacaoVal,
          maskedImageUrl: row.foto || row.image || '',
          description: row.description || (descParts.length > 0 ? descParts.join(' - ') : 'Infração registrada'),
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
): Promise<{ success: boolean; rua?: string; bairro?: string; cidade?: string; estado?: string; classificacao?: string; verificacao?: string }> {
  let resolvedRua = (incident.rua || '').trim();
  let resolvedBairro = (incident.bairro || '').trim();
  let resolvedCidade = (incident.cidade || '').trim();
  let resolvedEstado = normalizeState((incident.estado || '').trim());
  const resolvedClassificacao = ((incident.classificacao || 'C').trim().toUpperCase()) as 'A' | 'B' | 'C';
  const resolvedVerificacao = normalizeVerificacao(incident.verificacao);

  const hasStreetNum = (s: string) => /,\s*\d+/.test(s);

  if ((!resolvedCidade || !resolvedEstado || !resolvedRua || !resolvedBairro || !hasStreetNum(resolvedRua)) && Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude)) {
    try {
      const geoDetails = await getAddressDetailsFromCoords(incident.latitude, incident.longitude);
      if ((!resolvedRua || (!hasStreetNum(resolvedRua) && hasStreetNum(geoDetails.rua || ''))) && geoDetails.rua) {
        resolvedRua = geoDetails.rua.trim();
      }
      if (!resolvedBairro && geoDetails.bairro) resolvedBairro = geoDetails.bairro.trim();
      if (!resolvedCidade && geoDetails.cidade) resolvedCidade = geoDetails.cidade.trim();
      if (!resolvedEstado && geoDetails.estado) resolvedEstado = normalizeState(geoDetails.estado);
      if ((!resolvedCidade || !resolvedEstado || !resolvedRua || !resolvedBairro || !hasStreetNum(resolvedRua)) && geoDetails.formattedAddress) {
        const parsed = extractCityAndStateFromText(geoDetails.formattedAddress);
        if ((!resolvedRua || (!hasStreetNum(resolvedRua) && hasStreetNum(parsed.rua || ''))) && parsed.rua) {
          resolvedRua = parsed.rua.trim();
        }
        if (!resolvedBairro && parsed.bairro) resolvedBairro = parsed.bairro.trim();
        if (!resolvedCidade && parsed.cidade) resolvedCidade = parsed.cidade.trim();
        if (!resolvedEstado && parsed.estado) resolvedEstado = normalizeState(parsed.estado);
      }
    } catch {}
  }

  // Coloca rua, bairro, cidade, estado, classificacao e verificacao antes da foto base64 para garantir parsing prioritário no JSON
  const fullIncident = {
    id: incident.id,
    data: incident.data,
    latitude: incident.latitude,
    longitude: incident.longitude,
    cidade: resolvedCidade,
    estado: resolvedEstado,
    rua: resolvedRua,
    bairro: resolvedBairro,
    classificacao: resolvedClassificacao,
    verificacao: resolvedVerificacao,
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
    rua: fullIncident.rua,
    bairro: fullIncident.bairro,
    cidade: fullIncident.cidade,
    estado: fullIncident.estado,
    classificacao: fullIncident.classificacao,
    verificacao: fullIncident.verificacao,
    maskedImageUrl: fullIncident.foto,
    description: [fullIncident.rua, fullIncident.bairro, fullIncident.cidade, fullIncident.estado].filter(Boolean).join(' - ') || 'Infração registrada',
    ativo: fullIncident.ativo,
    motivo_denuncia: fullIncident.motivo_denuncia
  });

  const normalizedUrl = normalizeAppsScriptUrl(appsScriptUrl);
  if (!normalizedUrl) {
    // Se a URL do script ainda não foi configurada, considera gravado no cache local do MVP
    return {
      success: true,
      rua: fullIncident.rua,
      bairro: fullIncident.bairro,
      cidade: fullIncident.cidade,
      estado: fullIncident.estado,
      classificacao: fullIncident.classificacao,
      verificacao: fullIncident.verificacao
    };
  }

  try {
    let targetUrl = normalizedUrl;
    try {
      const urlObj = new URL(normalizedUrl);
      if (resolvedCidade) urlObj.searchParams.set('cidade', resolvedCidade);
      if (resolvedEstado) urlObj.searchParams.set('estado', resolvedEstado);
      if (resolvedRua) urlObj.searchParams.set('rua', resolvedRua);
      if (resolvedBairro) urlObj.searchParams.set('bairro', resolvedBairro);
      if (resolvedClassificacao) urlObj.searchParams.set('classificacao', resolvedClassificacao);
      if (resolvedVerificacao) urlObj.searchParams.set('verificacao', resolvedVerificacao);
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
    const finalRua = result?.rua || fullIncident.rua || '';
    const finalBairro = result?.bairro || fullIncident.bairro || '';
    const finalCidade = result?.cidade || fullIncident.cidade || '';
    const finalEstado = result?.estado || fullIncident.estado || '';
    const finalClassificacao = result?.classificacao || fullIncident.classificacao || 'C';
    const finalVerificacao = normalizeVerificacao(result?.verificacao ?? fullIncident.verificacao);

    if (result && (result.success || result.status === 'ok')) {
      if (finalCidade || finalEstado || finalRua || finalBairro) {
        saveIncidentToLocalCache({
          id: fullIncident.id,
          timestamp: fullIncident.data,
          latitude: fullIncident.latitude,
          longitude: fullIncident.longitude,
          rua: finalRua,
          bairro: finalBairro,
          cidade: finalCidade,
          estado: finalEstado,
          classificacao: finalClassificacao,
          verificacao: finalVerificacao,
          maskedImageUrl: fullIncident.foto,
          description: [finalRua, finalBairro, finalCidade, finalEstado].filter(Boolean).join(' - ') || 'Infração registrada',
          ativo: fullIncident.ativo,
          motivo_denuncia: fullIncident.motivo_denuncia
        });
      }
      return {
        success: true,
        rua: finalRua,
        bairro: finalBairro,
        cidade: finalCidade,
        estado: finalEstado,
        classificacao: finalClassificacao,
        verificacao: finalVerificacao
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
