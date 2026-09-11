import type { ReportedIncident } from '../types';

export interface SheetRowPayload {
  id: string;
  data: string;
  latitude: number;
  longitude: number;
  foto: string;
  ativo?: boolean;
  motivo_denuncia?: string;
}

export async function fetchIncidentsFromSheet(appsScriptUrl?: string): Promise<ReportedIncident[]> {
  if (!appsScriptUrl) {
    // Carrega do cache local se a URL do Apps Script ainda não estiver preenchida
    return loadIncidentsFromLocalCache();
  }

  try {
    const response = await fetch(appsScriptUrl, {
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
          maskedImageUrl: row.foto || row.image || '/images/logo-vale-pcd-seo.webp',
          description: row.description || 'Infração registrada',
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

export async function saveIncidentToSheet(
  appsScriptUrl: string,
  incident: SheetRowPayload
): Promise<boolean> {
  const fullIncident = {
    ...incident,
    ativo: incident.ativo !== undefined ? incident.ativo : true,
    motivo_denuncia: incident.motivo_denuncia || ''
  };

  // Salvar sempre em cache local preventivamente
  saveIncidentToLocalCache({
    id: fullIncident.id,
    timestamp: fullIncident.data,
    latitude: fullIncident.latitude,
    longitude: fullIncident.longitude,
    maskedImageUrl: fullIncident.foto,
    description: 'Infração registrada',
    ativo: fullIncident.ativo,
    motivo_denuncia: fullIncident.motivo_denuncia
  });

  if (!appsScriptUrl) {
    // Se a URL do script ainda não foi configurada, considera gravado no cache local do MVP
    return true;
  }

  try {
    const response = await fetch(appsScriptUrl, {
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
    return Boolean(result && (result.success || result.status === 'ok'));
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

  if (!appsScriptUrl) {
    return true;
  }

  try {
    const response = await fetch(appsScriptUrl, {
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
