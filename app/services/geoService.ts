import type { Geolocation } from '../types';

// Cache em memória para evitar chamadas repetidas de geocodificação
const addressCache = new Map<string, string>();

/**
 * Solicita a geolocalização do navegador de forma resiliente:
 * 1. Tenta alta precisão (GPS) com timeout curto (6s).
 * 2. Se falhar ou der timeout (comum em notebooks, Wi-Fi ou ambientes fechados),
 *    tenta imediatamente precisão padrão com cache (maximumAge: 300000).
 */
export function requestUserLocation(): Promise<Geolocation> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Geolocalização não é suportada neste navegador.'));
    }

    // Tentativa 1: Alta precisão (GPS via satélite/hardware)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (firstError) => {
        console.warn('[geoService] GPS alta precisão falhou/expirou, tentando rede/Wi-Fi...', firstError.message);
        // Tentativa 2: Precisão de rede (Wi-Fi/IP/Cell) rápida e resiliente
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (secondError) => {
            console.error('[geoService] Falha em ambas tentativas de localização:', secondError);
            reject(secondError);
          },
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000 // aceita cache de até 5 minutos
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60000 // aceita cache de até 1 minuto
      }
    );
  });
}

export interface GeoAddressDetails {
  formattedAddress: string;
  cidade: string;
  estado: string;
}

const UF_MAP: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amapa': 'AP',
  'amazonas': 'AM', 'bahia': 'BA', 'ceará': 'CE', 'ceara': 'CE',
  'distrito federal': 'DF', 'espírito santo': 'ES', 'espirito santo': 'ES',
  'goiás': 'GO', 'goias': 'GO', 'maranhão': 'MA', 'maranhao': 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  'pará': 'PA', 'para': 'PA', 'paraíba': 'PB', 'paraiba': 'PB',
  'paraná': 'PR', 'parana': 'PR', 'pernambuco': 'PE', 'piauí': 'PI',
  'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
  'rio grande do sul': 'RS', 'rondônia': 'RO', 'rondonia': 'RO',
  'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP',
  'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO'
};

function normalizeState(stateStr: string): string {
  if (!stateStr) return '';
  const s = String(stateStr).trim();
  if (s.length === 2) return s.toUpperCase();
  const lower = s.toLowerCase();
  return UF_MAP[lower] || s;
}

const detailsCache = new Map<string, GeoAddressDetails>();

/**
 * Converte coordenadas (latitude, longitude) em detalhes completos de localização (rua, cidade, estado).
 */
export async function getAddressDetailsFromCoords(latitude: number, longitude: number): Promise<GeoAddressDetails> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      formattedAddress: 'Localização inválida',
      cidade: '',
      estado: ''
    };
  }

  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (detailsCache.has(cacheKey)) {
    const cached = detailsCache.get(cacheKey)!;
    if (cached.cidade && cached.estado) {
      return cached;
    }
  }

  let accFormattedAddress = '';
  let accCidade = '';
  let accEstado = '';

  // 1. Tentar endpoint interno do servidor Nuxt /api/geocode (sem problemas de CORS ou bloqueio 403)
  try {
    const res = await fetch(`/api/geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        if (data.formattedAddress && !data.formattedAddress.startsWith('Lat:')) {
          accFormattedAddress = data.formattedAddress;
        }
        if (data.cidade) accCidade = data.cidade;
        if (data.estado) accEstado = normalizeState(data.estado);

        if (accCidade && accEstado) {
          const details: GeoAddressDetails = {
            formattedAddress: accFormattedAddress || `${accCidade} - ${accEstado}`,
            cidade: accCidade,
            estado: accEstado
          };
          detailsCache.set(cacheKey, details);
          addressCache.set(cacheKey, details.formattedAddress);
          return details;
        }
      }
    }
  } catch (apiErr) {
    console.warn('[geoService] /api/geocode falhou, tentando alternativas:', apiErr);
  }

  // 2. Tentar Google Maps Geocoder se a API estiver carregada no navegador
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const results = await new Promise<any[]>((resolve, reject) => {
        geocoder.geocode(
          { location: { lat: latitude, lng: longitude } },
          (res: any[], status: string) => {
            if (status === 'OK' && res && res.length > 0) {
              resolve(res);
            } else {
              reject(new Error(`Google Geocoder status: ${status}`));
            }
          }
        );
      });

      if (results && results.length > 0) {
        if (!accFormattedAddress && results[0]?.formatted_address) {
          accFormattedAddress = results[0].formatted_address;
        }

        // Varre TODOS os resultados para encontrar cidade e estado mesmo se o primeiro for apenas a rua
        for (const res of results) {
          if (Array.isArray(res.address_components)) {
            for (const comp of res.address_components) {
              const types: string[] = comp.types || [];
              if (!accEstado && types.includes('administrative_area_level_1')) {
                accEstado = normalizeState(comp.short_name || comp.long_name || '');
              }
              if (!accCidade && types.includes('administrative_area_level_2')) {
                accCidade = comp.long_name || comp.short_name || '';
              }
              if (!accCidade && (types.includes('locality') || types.includes('sublocality_level_1'))) {
                accCidade = comp.long_name || comp.short_name || '';
              }
            }
          }
          if (accCidade && accEstado) break;
        }

        if (accEstado === 'DF' && (!accCidade || accCidade.toLowerCase().includes('plano piloto'))) {
          accCidade = 'Brasília';
        }

        if (accCidade && accEstado) {
          const details: GeoAddressDetails = {
            formattedAddress: accFormattedAddress || `${accCidade} - ${accEstado}`,
            cidade: accCidade,
            estado: accEstado
          };
          detailsCache.set(cacheKey, details);
          addressCache.set(cacheKey, details.formattedAddress);
          return details;
        }
      }
    } catch (googleErr) {
      console.warn('[geoService] Google Geocoder falhou, tentando fallback:', googleErr);
    }
  }

  // 3. Fallback: OpenStreetMap Nominatim
  if (!accCidade || !accEstado) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1&email=contato@valepcd.com.br`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const addr = data.address;
          const street = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || '';
          const number = addr.house_number ? `, ${addr.house_number}` : '';
          const suburb = addr.suburb || addr.neighbourhood || addr.city_district || '';
          if (!accCidade) {
            accCidade = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.county || addr.hamlet || addr.state_district || '';
          }
          if (!accEstado) {
            let state = '';
            if (addr['ISO3166-2-lvl4']) {
              state = String(addr['ISO3166-2-lvl4']).replace(/^BR-/, '');
            } else {
              state = addr.state || '';
            }
            accEstado = normalizeState(state);
          }

          if (accEstado === 'DF' && (!accCidade || accCidade.toLowerCase().includes('plano piloto'))) {
            accCidade = 'Brasília';
          }

          const parts = [
            street ? `${street}${number}` : '',
            suburb,
            accCidade,
            accEstado
          ].filter(Boolean);

          if (!accFormattedAddress) {
            accFormattedAddress = parts.length > 0 ? parts.join(' - ') : (data.display_name || '');
          }
        }
      }
    } catch (osmErr) {
      console.warn('[geoService] Fallback Nominatim falhou:', osmErr);
    }
  }

  // 4. Fallback final garantido: BigDataCloud Client Reverse Geocoding (sem rate-limit para cliente)
  if (!accCidade || !accEstado) {
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=pt`;
      const bdcRes = await fetch(bdcUrl);
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        if (!accCidade) {
          accCidade = bdcData.city || bdcData.locality || '';
        }
        if (!accEstado) {
          const code = bdcData.principalSubdivisionCode ? String(bdcData.principalSubdivisionCode).replace(/^BR-/, '') : '';
          accEstado = normalizeState(code || bdcData.principalSubdivision || '');
        }
        if (accEstado === 'DF' && (!accCidade || accCidade.toLowerCase().includes('plano piloto'))) {
          accCidade = 'Brasília';
        }
        if (!accFormattedAddress) {
          const parts = [bdcData.locality, accCidade, accEstado].filter(Boolean);
          accFormattedAddress = parts.join(' - ');
        }
      }
    } catch (bdcErr) {
      console.warn('[geoService] Fallback BigDataCloud falhou:', bdcErr);
    }
  }

  const finalDetails: GeoAddressDetails = {
    formattedAddress: accFormattedAddress || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
    cidade: accCidade,
    estado: accEstado
  };

  if (finalDetails.cidade && finalDetails.estado) {
    detailsCache.set(cacheKey, finalDetails);
    addressCache.set(cacheKey, finalDetails.formattedAddress);
  }

  return finalDetails;
}

/**
 * Converte coordenadas (latitude, longitude) no nome da rua / endereço formatado.
 */
export async function getAddressFromCoords(latitude: number, longitude: number): Promise<string> {
  const details = await getAddressDetailsFromCoords(latitude, longitude);
  return details.formattedAddress;
}
