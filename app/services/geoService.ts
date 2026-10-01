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
  rua: string;
  bairro: string;
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

const CITY_TO_UF: Record<string, string> = {
  'belo horizonte': 'MG', 'contagem': 'MG', 'betim': 'MG', 'uberlândia': 'MG', 'juiz de fora': 'MG',
  'são paulo': 'SP', 'campinas': 'SP', 'guarulhos': 'SP', 'santos': 'SP', 'são bernardo do campo': 'SP',
  'rio de janeiro': 'RJ', 'niterói': 'RJ', 'duque de caxias': 'RJ', 'são gonçalo': 'RJ',
  'brasília': 'DF', 'curitiba': 'PR', 'londrina': 'PR', 'maringá': 'PR',
  'porto alegre': 'RS', 'caxias do sul': 'RS', 'salvador': 'BA', 'feira de santana': 'BA',
  'fortaleza': 'CE', 'recife': 'PE', 'olinda': 'PE', 'goiânia': 'GO', 'manaus': 'AM',
  'belém': 'PA', 'florianópolis': 'SC', 'joinville': 'SC', 'vitória': 'ES', 'vila velha': 'ES',
  'natal': 'RN', 'joão pessoa': 'PB', 'maceió': 'AL', 'teresina': 'PI', 'aracaju': 'SE',
  'campo grande': 'MS', 'cuiabá': 'MT', 'porto velho': 'RO', 'macapá': 'AP', 'palmas': 'TO',
  'boa vista': 'RR', 'rio branco': 'AC'
};

export function normalizeState(stateStr: string): string {
  if (!stateStr) return '';
  const s = String(stateStr).trim();
  if (s.length === 2) return s.toUpperCase();
  const lower = s.toLowerCase();
  return UF_MAP[lower] || s;
}

export function extractCityAndStateFromText(text?: string | null): { rua: string; bairro: string; cidade: string; estado: string } {
  if (!text || typeof text !== 'string') return { rua: '', bairro: '', cidade: '', estado: '' };
  const clean = text.trim();
  if (clean.startsWith('Lat:') || clean.startsWith('Buscando') || clean.startsWith('Localização')) {
    return { rua: '', bairro: '', cidade: '', estado: '' };
  }

  let rua = '';
  let bairro = '';
  let cidade = '';
  let estado = '';

  const allUFs = new Set(Object.values(UF_MAP));

  const ufPattern = /[\s,-]+([A-Z]{2})(?:[\s,–-]|$)/g;
  let match;
  while ((match = ufPattern.exec(clean)) !== null) {
    const candidate = match[1].toUpperCase();
    if (allUFs.has(candidate)) {
      estado = candidate;
      const beforeUf = clean.substring(0, match.index).trim();
      const beforeParts = beforeUf.split(/[,–-]/).map(s => s.trim()).filter(Boolean);
      if (beforeParts.length > 0) {
        cidade = beforeParts[beforeParts.length - 1];
      }
      break;
    }
  }

  if (!estado) {
    const lower = clean.toLowerCase();
    for (const [name, uf] of Object.entries(UF_MAP)) {
      if (lower.includes(name)) {
        estado = uf;
        break;
      }
    }
  }

  if (!cidade) {
    const s = clean.replace(/,\s*Brasil\s*$/i, '').replace(/,?\s*\d{5}-?\d{3}.*$/, '').trim();
    const parts = s.split(/[,–-]/).map(p => p.trim()).filter(Boolean);
    const nonStateParts = parts.filter(p => !allUFs.has(p.toUpperCase()) && !/^\d+$/.test(p));
    if (nonStateParts.length > 0) {
      cidade = nonStateParts[nonStateParts.length - 1];
    }
  }

  if (cidade && UF_MAP[cidade.toLowerCase()]) {
    const lower = clean.toLowerCase();
    for (const city of Object.keys(CITY_TO_UF)) {
      if (lower.includes(city)) {
        cidade = city.replace(/(^\w|\s\w)/g, m => m.toUpperCase());
        break;
      }
    }
  }

  if (cidade) {
    cidade = cidade.replace(/\d{5}-?\d{3}/g, '').replace(/,\s*$/, '').trim();
  }

  if (cidade && !estado) {
    const cityLower = cidade.toLowerCase();
    if (CITY_TO_UF[cityLower]) {
      estado = CITY_TO_UF[cityLower];
    }
  }

  // Extrair rua e bairro das partes anteriores à cidade
  const dashSegments = clean
    .replace(/,\s*Brasil\s*$/i, '')
    .replace(/,?\s*\d{5}-?\d{3}.*$/, '')
    .split(/\s+[–-]\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (dashSegments.length >= 3) {
    rua = dashSegments[0];
    bairro = dashSegments[1];
  } else if (dashSegments.length === 2 && dashSegments[0].toLowerCase() !== cidade.toLowerCase()) {
    const subParts = dashSegments[0].split(',').map(s => s.trim()).filter(Boolean);
    if (subParts.length >= 2 && !/^\d+[A-Za-z]?$/.test(subParts[subParts.length - 1])) {
      rua = subParts.slice(0, -1).join(', ');
      bairro = subParts[subParts.length - 1];
    } else {
      rua = dashSegments[0];
    }
  }

  return { rua, bairro, cidade, estado };
}

const detailsCache = new Map<string, GeoAddressDetails>();

/**
 * Converte coordenadas (latitude, longitude) em detalhes completos de localização (rua, bairro, cidade, estado).
 */
export async function getAddressDetailsFromCoords(latitude: number, longitude: number): Promise<GeoAddressDetails> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      formattedAddress: 'Localização inválida',
      rua: '',
      bairro: '',
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
  let accRua = '';
  let accBairro = '';
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
        if (data.rua) accRua = String(data.rua).trim();
        if (data.bairro) accBairro = String(data.bairro).trim();
        if (data.cidade) accCidade = String(data.cidade).trim();
        if (data.estado) accEstado = normalizeState(data.estado);

        if (accCidade && accEstado && (accRua || accBairro)) {
          const details: GeoAddressDetails = {
            formattedAddress: accFormattedAddress || [accRua, accBairro, accCidade, accEstado].filter(Boolean).join(' - '),
            rua: accRua,
            bairro: accBairro,
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

        let foundStreetName = '';
        let foundStreetNum = '';

        // Varre TODOS os resultados para encontrar rua, bairro, cidade e estado
        for (const res of results) {
          if (Array.isArray(res.address_components)) {
            for (const comp of res.address_components) {
              const types: string[] = comp.types || [];
              if (!foundStreetName && types.includes('route')) {
                foundStreetName = comp.long_name || comp.short_name || '';
              }
              if (!foundStreetNum && types.includes('street_number')) {
                foundStreetNum = comp.long_name || comp.short_name || '';
              }
              if (!accBairro && (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood'))) {
                accBairro = comp.long_name || comp.short_name || '';
              }
              if (!accEstado && types.includes('administrative_area_level_1')) {
                accEstado = normalizeState(comp.short_name || comp.long_name || '');
              }
              if (!accCidade && types.includes('administrative_area_level_2')) {
                accCidade = comp.long_name || comp.short_name || '';
              }
              if (!accCidade && types.includes('locality')) {
                accCidade = comp.long_name || comp.short_name || '';
              }
            }
          }
        }

        if (!accRua && foundStreetName) {
          accRua = foundStreetNum ? `${foundStreetName}, ${foundStreetNum}` : foundStreetName;
        }

        if (accEstado === 'DF' && (!accCidade || accCidade.toLowerCase().includes('plano piloto'))) {
          accCidade = 'Brasília';
        }

        if (accCidade && accEstado) {
          const details: GeoAddressDetails = {
            formattedAddress: accFormattedAddress || [accRua, accBairro, accCidade, accEstado].filter(Boolean).join(' - '),
            rua: accRua,
            bairro: accBairro,
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
  if (!accCidade || !accEstado || !accRua || !accBairro) {
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
          const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
          if (!accRua && street) {
            accRua = `${street}${number}`;
          }
          if (!accBairro && suburb) {
            accBairro = suburb;
          }
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
            accRua,
            accBairro,
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
  if (!accCidade || !accEstado || !accBairro) {
    try {
      const bdcUrl = `https://api-bdc.io/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=pt`;
      const bdcRes = await fetch(bdcUrl);
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        const adminList = Array.isArray(bdcData?.localityInfo?.administrative) ? bdcData.localityInfo.administrative : [];
        if (!accCidade) {
          const munObj = adminList.find((a: any) => a.adminLevel === 8 && a.name);
          if (munObj && munObj.name) {
            accCidade = String(munObj.name).trim();
          } else {
            const candidate = bdcData.locality || bdcData.city || '';
            if (candidate && !/^(regi[aã]o metropolitana|microrregi[aã]o|mesorregi[aã]o)/i.test(String(candidate).trim())) {
              accCidade = String(candidate).trim();
            }
          }
        }
        if (!accBairro && bdcData.locality && String(bdcData.locality).trim().toLowerCase() !== accCidade.toLowerCase()) {
          accBairro = String(bdcData.locality).trim();
        }
        if (!accEstado) {
          const code = bdcData.principalSubdivisionCode ? String(bdcData.principalSubdivisionCode).replace(/^BR-/, '') : '';
          const stateObj = adminList.find((a: any) => a.adminLevel === 4 && (a.isoCode || a.name));
          const iso = stateObj?.isoCode ? String(stateObj.isoCode).replace(/^BR-/, '') : '';
          accEstado = normalizeState(code || iso || stateObj?.name || bdcData.principalSubdivision || '');
        }
        if (accEstado === 'DF' && (!accCidade || accCidade.toLowerCase().includes('plano piloto'))) {
          accCidade = 'Brasília';
        }
        if (!accFormattedAddress) {
          const parts = [accRua, accBairro || bdcData.locality, accCidade, accEstado].filter(Boolean);
          accFormattedAddress = parts.join(' - ');
        }
      }
    } catch (bdcErr) {
      console.warn('[geoService] Fallback BigDataCloud falhou:', bdcErr);
    }
  }

  if ((!accCidade || !accEstado || !accRua || !accBairro) && accFormattedAddress) {
    const parsed = extractCityAndStateFromText(accFormattedAddress);
    if (!accRua && parsed.rua) accRua = parsed.rua;
    if (!accBairro && parsed.bairro) accBairro = parsed.bairro;
    if (!accCidade && parsed.cidade) accCidade = parsed.cidade;
    if (!accEstado && parsed.estado) accEstado = parsed.estado;
  }

  const finalDetails: GeoAddressDetails = {
    formattedAddress: accFormattedAddress || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
    rua: accRua,
    bairro: accBairro,
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

export interface GeoSearchResult {
  label: string;
  sublabel: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  cidade: string;
  estado: string;
}

const searchCache = new Map<string, GeoSearchResult[]>();

/**
 * Busca endereços, ruas, bairros, cidades ou CEPs a partir de um texto digitado pelo usuário.
 * Utiliza /api/geocode?q=... com fallback para Google Maps Geocoder e Nominatim.
 */
export async function searchAddresses(query: string): Promise<GeoSearchResult[]> {
  const clean = (query || '').trim();
  if (clean.length < 2) return [];

  const cacheKey = clean.toLowerCase();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  // 1. Tentar rota do servidor Nuxt (/api/geocode?q=...)
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.results) && data.results.length > 0) {
        searchCache.set(cacheKey, data.results);
        return data.results;
      }
    }
  } catch (err) {
    console.warn('[geoService] /api/geocode?q falhou, tentando fallback:', err);
  }

  // 2. Fallback: Google Maps Geocoder no navegador
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const gResults = await new Promise<any[]>((resolve, reject) => {
        geocoder.geocode(
          { address: clean, region: 'BR' },
          (res: any[], status: string) => {
            if (status === 'OK' && Array.isArray(res) && res.length > 0) {
              resolve(res);
            } else {
              reject(new Error(`Google Geocoder search status: ${status}`));
            }
          }
        );
      });

      if (gResults && gResults.length > 0) {
        const mapped: GeoSearchResult[] = gResults
          .slice(0, 5)
          .map((item: any) => {
            const lat = typeof item.geometry?.location?.lat === 'function'
              ? item.geometry.location.lat()
              : Number(item.geometry?.location?.lat);
            const lng = typeof item.geometry?.location?.lng === 'function'
              ? item.geometry.location.lng()
              : Number(item.geometry?.location?.lng);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            const parsed = extractCityAndStateFromText(item.formatted_address || '');
            const parts = String(item.formatted_address || clean).split(',');
            const label = parts[0]?.trim() || clean;
            const sublabel = parts.slice(1).join(',').trim() || [parsed.cidade, parsed.estado].filter(Boolean).join(' • ');

            return {
              label,
              sublabel,
              formattedAddress: item.formatted_address || label,
              latitude: lat,
              longitude: lng,
              cidade: parsed.cidade,
              estado: parsed.estado
            };
          })
          .filter(Boolean) as GeoSearchResult[];

        if (mapped.length > 0) {
          searchCache.set(cacheKey, mapped);
          return mapped;
        }
      }
    } catch (gErr) {
      console.warn('[geoService] Google Geocoder search falhou:', gErr);
    }
  }

  // 3. Fallback direto Nominatim client-side
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&countrycodes=br&addressdetails=1&limit=5&email=contato@valepcd.com.br`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        const mapped: GeoSearchResult[] = items
          .map((item: any) => {
            const lat = parseFloat(String(item.lat || ''));
            const lng = parseFloat(String(item.lon || ''));
            if (isNaN(lat) || isNaN(lng)) return null;
            const addr = item.address || {};
            const street = addr.road || addr.street || addr.pedestrian || addr.suburb || '';
            const number = addr.house_number ? `, ${addr.house_number}` : '';
            const city = addr.city || addr.town || addr.municipality || addr.village || '';
            const state = normalizeState(addr['ISO3166-2-lvl4'] ? String(addr['ISO3166-2-lvl4']).replace(/^BR-/, '') : (addr.state || ''));
            const label = street ? `${street}${number}` : (item.name || city || String(item.display_name || '').split(',')[0]);
            const sublabel = [addr.suburb !== street ? addr.suburb : '', city, state].filter(Boolean).join(' • ') || String(item.display_name || '');
            return {
              label,
              sublabel,
              formattedAddress: [label, city, state].filter(Boolean).join(' - '),
              latitude: lat,
              longitude: lng,
              cidade: city,
              estado: state
            };
          })
          .filter(Boolean) as GeoSearchResult[];

        if (mapped.length > 0) {
          searchCache.set(cacheKey, mapped);
          return mapped;
        }
      }
    }
  } catch (osmErr) {
    console.warn('[geoService] Nominatim search client fallback falhou:', osmErr);
  }

  return [];
}

