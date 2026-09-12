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
    return detailsCache.get(cacheKey)!;
  }

  // 1. Tentar endpoint interno do servidor Nuxt /api/geocode (sem problemas de CORS ou bloqueio 403)
  try {
    const res = await fetch(`/api/geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.formattedAddress && (data.cidade || data.estado)) {
        const details: GeoAddressDetails = {
          formattedAddress: data.formattedAddress,
          cidade: data.cidade || '',
          estado: data.estado || ''
        };
        detailsCache.set(cacheKey, details);
        addressCache.set(cacheKey, details.formattedAddress);
        return details;
      }
    }
  } catch (apiErr) {
    console.warn('[geoService] /api/geocode falhou, tentando alternativas:', apiErr);
  }

  // 2. Tentar Google Maps Geocoder se a API estiver carregada
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const response = await new Promise<any>((resolve, reject) => {
        geocoder.geocode(
          { location: { lat: latitude, lng: longitude } },
          (results: any[], status: string) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve(results[0]);
            } else {
              reject(new Error(`Google Geocoder status: ${status}`));
            }
          }
        );
      });

      if (response && response.formatted_address) {
        let cidade = '';
        let estado = '';

        if (Array.isArray(response.address_components)) {
          for (const comp of response.address_components) {
            const types: string[] = comp.types || [];
            if (types.includes('administrative_area_level_1')) {
              estado = comp.short_name || comp.long_name || '';
            }
            if (types.includes('administrative_area_level_2')) {
              cidade = comp.long_name || comp.short_name || '';
            }
            if (!cidade && (types.includes('locality') || types.includes('sublocality_level_1'))) {
              cidade = comp.long_name || comp.short_name || '';
            }
          }
        }

        const details: GeoAddressDetails = {
          formattedAddress: response.formatted_address,
          cidade,
          estado
        };
        detailsCache.set(cacheKey, details);
        addressCache.set(cacheKey, details.formattedAddress);
        return details;
      }
    } catch (googleErr) {
      console.warn('[geoService] Google Geocoder falhou, tentando fallback:', googleErr);
    }
  }

  // 2. Fallback: OpenStreetMap Nominatim (suporta português sem necessidade de chave)
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
        const city = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.county || '';
        let state = '';
        if (addr['ISO3166-2-lvl4']) {
          state = String(addr['ISO3166-2-lvl4']).replace(/^BR-/, '');
        } else {
          state = addr.state || '';
        }

        const parts = [
          street ? `${street}${number}` : '',
          suburb,
          city
        ].filter(Boolean);

        const formatted = parts.length > 0 ? parts.join(' - ') : (data.display_name || '');
        const details: GeoAddressDetails = {
          formattedAddress: formatted || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
          cidade: city,
          estado: state
        };

        detailsCache.set(cacheKey, details);
        addressCache.set(cacheKey, details.formattedAddress);
        return details;
      }
    }
  } catch (osmErr) {
    console.warn('[geoService] Fallback Nominatim falhou:', osmErr);
  }

  // 3. Caso ambos não consigam resolver, exibe as coordenadas
  const fallbackDetails: GeoAddressDetails = {
    formattedAddress: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
    cidade: '',
    estado: ''
  };
  detailsCache.set(cacheKey, fallbackDetails);
  addressCache.set(cacheKey, fallbackDetails.formattedAddress);
  return fallbackDetails;
}

/**
 * Converte coordenadas (latitude, longitude) no nome da rua / endereço formatado.
 */
export async function getAddressFromCoords(latitude: number, longitude: number): Promise<string> {
  const details = await getAddressDetailsFromCoords(latitude, longitude);
  return details.formattedAddress;
}
