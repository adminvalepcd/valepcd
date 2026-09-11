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

/**
 * Converte coordenadas (latitude, longitude) no nome da rua / endereço formatado.
 * 1. Tenta usar o Geocoder oficial do Google Maps JavaScript API.
 * 2. Caso indisponível ou ocorra erro de cota/chave, usa fallback para OpenStreetMap Nominatim.
 * 3. Se ambos falharem, retorna as coordenadas formatadas.
 */
export async function getAddressFromCoords(latitude: number, longitude: number): Promise<string> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return 'Localização inválida';
  }

  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey)!;
  }

  // 1. Tentar Google Maps Geocoder se a API estiver carregada
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
        const formatted = response.formatted_address;
        addressCache.set(cacheKey, formatted);
        return formatted;
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
        const city = addr.city || addr.town || addr.municipality || addr.village || '';

        const parts = [
          street ? `${street}${number}` : '',
          suburb,
          city
        ].filter(Boolean);

        const result = parts.length > 0 ? parts.join(' - ') : (data.display_name || '');
        if (result) {
          addressCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch (osmErr) {
    console.warn('[geoService] Fallback Nominatim falhou:', osmErr);
  }

  // 3. Caso ambos não consigam resolver, exibe as coordenadas
  const fallback = `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;
  addressCache.set(cacheKey, fallback);
  return fallback;
}
