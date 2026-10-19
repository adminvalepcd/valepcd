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
  pais?: string;
  countryCode?: string;
  isBrazil?: boolean;
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

export const VALID_BRAZIL_UFS = new Set(Object.values(UF_MAP));

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

/**
 * Verifica rapidamente se as coordenadas estão dentro do bounding box geográfico do Brasil
 * (do Chuí-RS ao Monte Caburaí-RR e da Serra do Divisor-AC a Fernando de Noronha/Arquipélagos).
 */
export function isCoordinateInBrazilBounds(latitude: number, longitude: number): boolean {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -33.76 && lat <= 5.28 && lng >= -74.00 && lng <= -28.80;
}

/**
 * Verifica se a sigla ou nome de estado corresponde a uma das 27 UFs brasileiras válidas.
 */
export function isValidBrazilUF(estado?: string | null): boolean {
  if (!estado) return false;
  const normalized = normalizeState(estado).trim().toUpperCase();
  return VALID_BRAZIL_UFS.has(normalized);
}

/**
 * Avalia de forma determinística se os dados de localização correspondem ao Brasil.
 */
export function evaluateIsBrazil(params: {
  latitude?: number;
  longitude?: number;
  countryCode?: string | null;
  pais?: string | null;
  estado?: string | null;
  isBrazil?: boolean;
}): boolean {
  const { latitude, longitude, countryCode, pais, estado, isBrazil } = params;
  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isCoordinateInBrazilBounds(latitude, longitude)
  ) {
    return false;
  }

  if (typeof isBrazil === 'boolean') {
    return isBrazil;
  }

  const cleanCode = String(countryCode || '').trim().toUpperCase();
  if (cleanCode) {
    return cleanCode === 'BR' || cleanCode === 'BRA';
  }

  const cleanPais = String(pais || '').trim().toLowerCase();
  if (cleanPais) {
    return (
      cleanPais === 'brasil' ||
      cleanPais === 'brazil' ||
      cleanPais === 'república federativa do brasil'
    );
  }

  if (estado) {
    return isValidBrazilUF(estado);
  }

  // Se todos os provedores de geocodificação falharam por rede/rate-limit (sem país/UF retornados),
  // mantém true apenas se as coordenadas estiverem dentro dos limites geográficos do Brasil
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return isCoordinateInBrazilBounds(latitude, longitude);
  }

  return false;
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

async function getGoogleGeocoder(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  const gMaps = (window as any).google?.maps;
  if (!gMaps) return null;
  if (typeof gMaps.Geocoder === 'function') {
    return new gMaps.Geocoder();
  }
  if (typeof gMaps.importLibrary === 'function') {
    try {
      const lib = await gMaps.importLibrary('geocoding');
      const GeocoderClass = lib?.Geocoder || gMaps.Geocoder;
      if (typeof GeocoderClass === 'function') {
        return new GeocoderClass();
      }
    } catch (err) {
      console.warn('[geoService] Falha ao carregar biblioteca geocoding do Google Maps:', err);
    }
  }
  return null;
}

function extractCleanStreetNum(rawNum: string): string {
  const s = String(rawNum || '').trim();
  if (!s) return '';
  const rangeMatch = s.match(/^(\d+[A-Za-z]?)\s*[-–/]\s*\d+/);
  if (rangeMatch && rangeMatch[1]) {
    return rangeMatch[1];
  }
  const numMatch = s.match(/^(\d+[A-Za-z0-9\/-]*)$/);
  return numMatch ? numMatch[1] : '';
}

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
      estado: '',
      pais: '',
      countryCode: '',
      isBrazil: false
    };
  }

  const inBrazilBounds = isCoordinateInBrazilBounds(latitude, longitude);
  const hasStreetNumber = (s: string) => /,\s*\d+/.test(s);
  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (detailsCache.has(cacheKey)) {
    const cached = detailsCache.get(cacheKey)!;
    if (cached.isBrazil === false) {
      return cached;
    }
    if (cached.cidade && cached.estado) {
      return cached;
    }
  }

  let accFormattedAddress = '';
  let accRua = '';
  let accBairro = '';
  let accCidade = '';
  let accEstado = '';
  let accPais = '';
  let accCountryCode = '';

  const normalizeIsoCountry = (c?: string | null) => {
    const clean = String(c || '').trim().toUpperCase();
    return clean === 'BRA' ? 'BR' : clean;
  };

  // 1. Tentar endpoint interno do servidor Nuxt /api/geocode (Nominatim + ArcGIS Reverse Geocode)
  try {
    const res = await fetch(`/api/geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        if (data.formattedAddress && !data.formattedAddress.startsWith('Lat:')) {
          accFormattedAddress = data.formattedAddress;
        }
        if (data.pais) accPais = String(data.pais).trim();
        if (data.countryCode) accCountryCode = normalizeIsoCountry(data.countryCode);
        const isForeignFromApi = data.isBrazil === false || Boolean(accCountryCode && accCountryCode !== 'BR') || !inBrazilBounds;

        if (data.rua) accRua = String(data.rua).trim();
        if (data.bairro) accBairro = String(data.bairro).trim();
        if (data.cidade) accCidade = String(data.cidade).trim();
        if (data.estado) {
          accEstado = isForeignFromApi ? String(data.estado).trim() : normalizeState(data.estado);
        }

        if (isForeignFromApi && (accCountryCode || !inBrazilBounds)) {
          const composedForeign = [accRua, accBairro, accCidade, accEstado, accPais].filter(Boolean).join(' - ');
          const foreignDetails: GeoAddressDetails = {
            formattedAddress: composedForeign || accFormattedAddress || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
            rua: accRua,
            bairro: accBairro,
            cidade: accCidade,
            estado: accEstado,
            pais: accPais,
            countryCode: accCountryCode,
            isBrazil: false
          };
          detailsCache.set(cacheKey, foreignDetails);
          addressCache.set(cacheKey, foreignDetails.formattedAddress);
          return foreignDetails;
        }

        if (accCidade && accEstado && accBairro && hasStreetNumber(accRua)) {
          const composed = [accRua, accBairro, accCidade, accEstado].filter(Boolean).join(' - ');
          const isBrazilVal = evaluateIsBrazil({
            latitude,
            longitude,
            countryCode: accCountryCode,
            pais: accPais,
            estado: accEstado,
            isBrazil: typeof data.isBrazil === 'boolean' ? data.isBrazil : undefined
          });
          const details: GeoAddressDetails = {
            formattedAddress: composed || accFormattedAddress,
            rua: accRua,
            bairro: accBairro,
            cidade: accCidade,
            estado: accEstado,
            pais: accPais || (isBrazilVal ? 'Brasil' : ''),
            countryCode: accCountryCode || (isBrazilVal ? 'BR' : ''),
            isBrazil: isBrazilVal
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

  // 2. Tentar Google Maps Geocoder se a API estiver carregada no navegador (excelente para obter o número aproximado da via)
  const geocoder = await getGoogleGeocoder();
  if (geocoder) {
    try {
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
        let foundStreetName = '';
        let foundStreetNum = '';

        // Varre TODOS os resultados para encontrar rua, número aproximado, bairro, cidade, estado e país
        for (const res of results) {
          if (Array.isArray(res.address_components)) {
            let resRoute = '';
            let resNum = '';
            for (const comp of res.address_components) {
              const types: string[] = comp.types || [];
              if (types.includes('country')) {
                if (!accCountryCode && comp.short_name) {
                  accCountryCode = normalizeIsoCountry(comp.short_name);
                }
                if (!accPais && comp.long_name) {
                  accPais = String(comp.long_name).trim();
                }
              }
              if (!resRoute && types.includes('route')) {
                resRoute = comp.long_name || comp.short_name || '';
              }
              if (!resNum && types.includes('street_number')) {
                resNum = extractCleanStreetNum(comp.long_name || comp.short_name || '');
              }
              if (!accBairro && (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood'))) {
                accBairro = comp.long_name || comp.short_name || '';
              }
              if (!accEstado && types.includes('administrative_area_level_1')) {
                const rawState = comp.short_name || comp.long_name || '';
                accEstado = accCountryCode && accCountryCode !== 'BR' ? String(rawState).trim() : normalizeState(rawState);
              }
              if (!accCidade && types.includes('administrative_area_level_2')) {
                accCidade = comp.long_name || comp.short_name || '';
              }
              if (!accCidade && types.includes('locality')) {
                accCidade = comp.long_name || comp.short_name || '';
              }
            }
            if (!foundStreetName && resRoute) {
              foundStreetName = resRoute;
            }
            if (!foundStreetNum && resNum) {
              foundStreetNum = resNum;
            }
          }

          // Fallback: extrair número aproximado de formatted_address caso venha no texto (ex: "Rua X, 120 - Bairro...")
          if (!foundStreetNum && typeof res.formatted_address === 'string') {
            const firstSegment = res.formatted_address.split(/\s+[–-]\s+/)[0] || '';
            const numMatch = firstSegment.match(/,\s*(\d+[A-Za-z0-9\/-]*)/);
            if (numMatch && numMatch[1]) {
              foundStreetNum = extractCleanStreetNum(numMatch[1]);
              if (!foundStreetName) {
                foundStreetName = firstSegment.substring(0, numMatch.index).trim();
              }
            }
          }
        }

        if (foundStreetName && foundStreetNum) {
          accRua = `${foundStreetName}, ${foundStreetNum}`;
        } else if (!hasStreetNumber(accRua) && accRua && foundStreetNum) {
          accRua = `${accRua.replace(/,\s*$/, '').trim()}, ${foundStreetNum}`;
        } else if (!accRua && foundStreetName) {
          accRua = foundStreetName;
        }

        const isBrazilGoogle = evaluateIsBrazil({
          latitude,
          longitude,
          countryCode: accCountryCode,
          pais: accPais,
          estado: accEstado
        });

        if (isBrazilGoogle && accEstado === 'DF' && (!accCidade || accCidade.toLowerCase().includes('plano piloto'))) {
          accCidade = 'Brasília';
        }

        const composedFormatted = [accRua, accBairro, accCidade, accEstado].filter(Boolean).join(' - ');
        if (composedFormatted) {
          accFormattedAddress = composedFormatted;
        } else if (!accFormattedAddress && results[0]?.formatted_address) {
          accFormattedAddress = results[0].formatted_address;
        }

        if (!isBrazilGoogle && accCountryCode && accCountryCode !== 'BR') {
          const foreignDetails: GeoAddressDetails = {
            formattedAddress: accFormattedAddress || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
            rua: accRua,
            bairro: accBairro,
            cidade: accCidade,
            estado: accEstado,
            pais: accPais,
            countryCode: accCountryCode,
            isBrazil: false
          };
          detailsCache.set(cacheKey, foreignDetails);
          addressCache.set(cacheKey, foreignDetails.formattedAddress);
          return foreignDetails;
        }

        if (accCidade && accEstado && hasStreetNumber(accRua)) {
          const details: GeoAddressDetails = {
            formattedAddress: accFormattedAddress,
            rua: accRua,
            bairro: accBairro,
            cidade: accCidade,
            estado: accEstado,
            pais: accPais || (isBrazilGoogle ? 'Brasil' : ''),
            countryCode: accCountryCode || (isBrazilGoogle ? 'BR' : ''),
            isBrazil: isBrazilGoogle
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

  // 3. Fallback: OpenStreetMap Nominatim se ainda faltar rua, bairro, cidade, estado ou país
  if (!accCidade || !accEstado || !accRua || !accBairro || !accCountryCode) {
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
          if (!accCountryCode && addr.country_code) {
            accCountryCode = normalizeIsoCountry(addr.country_code);
          }
          if (!accPais && addr.country) {
            accPais = String(addr.country).trim();
          }
          const isForeignCountry = Boolean(accCountryCode && accCountryCode !== 'BR') || !inBrazilBounds;

          const street = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || '';
          const cleanHouseNum = extractCleanStreetNum(addr.house_number || '');
          const number = cleanHouseNum ? `, ${cleanHouseNum}` : '';
          const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
          if (!accRua && street) {
            accRua = `${street}${number}`;
          } else if (!hasStreetNumber(accRua) && accRua && cleanHouseNum) {
            accRua = `${accRua.replace(/,\s*$/, '').trim()}, ${cleanHouseNum}`;
          }
          if (!accBairro && suburb) {
            accBairro = suburb;
          }
          if (!accCidade) {
            accCidade = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.county || addr.hamlet || addr.state_district || '';
          }
          if (!accEstado) {
            if (!isForeignCountry) {
              let state = '';
              if (addr['ISO3166-2-lvl4']) {
                state = String(addr['ISO3166-2-lvl4']).replace(/^BR-/, '');
              } else {
                state = addr.state || '';
              }
              accEstado = normalizeState(state);
            } else {
              accEstado = String(addr.state || '').trim();
            }
          }

          if (!isForeignCountry && accEstado === 'DF' && (!accCidade || accCidade.toLowerCase().includes('plano piloto'))) {
            accCidade = 'Brasília';
          }
        }
      }
    } catch (osmErr) {
      console.warn('[geoService] Fallback Nominatim falhou:', osmErr);
    }
  }

  // 3.5. Fallback direto ArcGIS Reverse Geocode no cliente caso a rua ainda esteja sem número (apenas se não for país estrangeiro)
  if (!hasStreetNumber(accRua) && inBrazilBounds && (!accCountryCode || accCountryCode === 'BR')) {
    try {
      const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${encodeURIComponent(longitude)},${encodeURIComponent(latitude)}&langCode=pt&featureTypes=PointAddress,StreetAddress,StreetName`;
      const arcRes = await fetch(arcUrl);
      if (arcRes.ok) {
        const arcData = await arcRes.json();
        const arcAddr = arcData?.address;
        if (arcAddr) {
          if (!accCountryCode && arcAddr.CountryCode) {
            accCountryCode = normalizeIsoCountry(arcAddr.CountryCode);
          }
          if (!accPais && arcAddr.CntryName) {
            accPais = String(arcAddr.CntryName).trim();
          }
          const isForeignCountry = Boolean(accCountryCode && accCountryCode !== 'BR');

          const arcNum = extractCleanStreetNum(arcAddr.AddNum || '');
          const rawAddress = String(arcAddr.Address || arcAddr.ShortLabel || '').trim();
          let arcStreet = '';
          let parsedNum = arcNum;

          if (rawAddress) {
            const commaMatch = rawAddress.match(/^(.*?),\s*(\d+[A-Za-z0-9\/-]*)$/);
            if (commaMatch) {
              arcStreet = commaMatch[1].trim();
              if (!parsedNum) parsedNum = extractCleanStreetNum(commaMatch[2]);
            } else {
              arcStreet = rawAddress.replace(/,\s*$/, '').trim();
            }
          }

          if (accRua && parsedNum) {
            accRua = `${accRua.replace(/,\s*$/, '').trim()}, ${parsedNum}`;
          } else if (!accRua && arcStreet) {
            accRua = parsedNum ? `${arcStreet}, ${parsedNum}` : arcStreet;
          }

          if (!accBairro && (arcAddr.Neighborhood || arcAddr.District)) {
            accBairro = String(arcAddr.Neighborhood || arcAddr.District).trim();
          }
          if (!accCidade && (arcAddr.City || arcAddr.Subregion)) {
            accCidade = String(arcAddr.City || arcAddr.Subregion).trim();
          }
          if (!accEstado && (arcAddr.RegionAbbr || arcAddr.Region)) {
            const rawRegion = String(arcAddr.RegionAbbr || arcAddr.Region).trim();
            accEstado = isForeignCountry ? rawRegion : normalizeState(rawRegion);
          }
        }
      }
    } catch (arcClientErr) {
      console.warn('[geoService] Fallback ArcGIS client falhou:', arcClientErr);
    }
  }

  // 4. Fallback final garantido: BigDataCloud Client Reverse Geocoding (sem rate-limit para cliente)
  if (!accCidade || !accEstado || !accBairro || !accCountryCode) {
    try {
      const bdcUrl = `https://api-bdc.io/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=pt`;
      const bdcRes = await fetch(bdcUrl);
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        if (!accCountryCode && bdcData?.countryCode) {
          accCountryCode = normalizeIsoCountry(bdcData.countryCode);
        }
        if (!accPais && bdcData?.countryName) {
          accPais = String(bdcData.countryName).trim();
        }
        const isForeignCountry = Boolean(accCountryCode && accCountryCode !== 'BR') || !inBrazilBounds;

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
          const rawSubdivision = code || iso || stateObj?.name || bdcData.principalSubdivision || '';
          accEstado = isForeignCountry ? String(rawSubdivision).trim() : normalizeState(rawSubdivision);
        }
        if (!isForeignCountry && accEstado === 'DF' && (!accCidade || accCidade.toLowerCase().includes('plano piloto'))) {
          accCidade = 'Brasília';
        }
      }
    } catch (bdcErr) {
      console.warn('[geoService] Fallback BigDataCloud falhou:', bdcErr);
    }
  }

  const finalIsBrazil = evaluateIsBrazil({
    latitude,
    longitude,
    countryCode: accCountryCode,
    pais: accPais,
    estado: accEstado
  });

  if (finalIsBrazil && (!accCidade || !accEstado || !accRua || !accBairro) && accFormattedAddress) {
    const parsed = extractCityAndStateFromText(accFormattedAddress);
    if (!accRua && parsed.rua) accRua = parsed.rua;
    if (!accBairro && parsed.bairro) accBairro = parsed.bairro;
    if (!accCidade && parsed.cidade) accCidade = parsed.cidade;
    if (!accEstado && parsed.estado) accEstado = parsed.estado;
  }

  const composedFinal = [accRua, accBairro, accCidade, accEstado].filter(Boolean).join(' - ');
  if (composedFinal) {
    accFormattedAddress = composedFinal;
  }

  const finalDetails: GeoAddressDetails = {
    formattedAddress: accFormattedAddress || `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
    rua: accRua,
    bairro: accBairro,
    cidade: accCidade,
    estado: accEstado,
    pais: accPais || (finalIsBrazil ? 'Brasil' : ''),
    countryCode: accCountryCode || (finalIsBrazil ? 'BR' : ''),
    isBrazil: finalIsBrazil
  };

  if (!finalIsBrazil || (finalDetails.cidade && finalDetails.estado)) {
    detailsCache.set(cacheKey, finalDetails);
    addressCache.set(cacheKey, finalDetails.formattedAddress);
  }

  return finalDetails;
}

/**
 * Verifica se determinadas coordenadas pertencem ao Brasil.
 * 1. Se estiver fora do bounding box do Brasil, retorna `false` imediatamente (0ms).
 * 2. Se estiver dentro do bounding box, consulta a geocodificação reversa (com cache) para confirmar o país (`BR`).
 */
export async function checkIfCoordsInBrazil(latitude: number, longitude: number): Promise<boolean> {
  if (!isCoordinateInBrazilBounds(latitude, longitude)) {
    return false;
  }
  try {
    const details = await getAddressDetailsFromCoords(latitude, longitude);
    if (typeof details.isBrazil === 'boolean') {
      return details.isBrazil;
    }
    return evaluateIsBrazil({
      latitude,
      longitude,
      countryCode: details.countryCode,
      pais: details.pais,
      estado: details.estado
    });
  } catch {
    return isCoordinateInBrazilBounds(latitude, longitude);
  }
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
  const geocoder = await getGoogleGeocoder();
  if (geocoder) {
    try {
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

export interface AddressValidationCandidate {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  hasStreetNumber: boolean;
}

const normalizeStreetTokens = (value: string): string[] => {
  const stopWords = new Set([
    'rua', 'r', 'avenida', 'av', 'alameda', 'al', 'travessa', 'tv',
    'praca', 'pca', 'rodovia', 'rod', 'estrada', 'est', 'via', 'beco',
    'largo', 'viela', 'de', 'da', 'do', 'das', 'dos', 'e'
  ]);
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !stopWords.has(t));
};

const candidateMatchesStreet = (candidateText: string, typedStreet: string): boolean => {
  const tokens = normalizeStreetTokens(typedStreet);
  if (tokens.length === 0) return true;
  const hay = (candidateText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return tokens.every(token => hay.includes(token));
};

/**
 * Geocodifica um endereço estruturado (rua, número, bairro, cidade, estado)
 * retornando candidatos que correspondam ao logradouro informado para validação de distância.
 */
export async function geocodeAddressForValidation(params: {
  streetName: string;
  streetNumber?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  anchorCoords?: { latitude: number; longitude: number };
}): Promise<AddressValidationCandidate[]> {
  const sName = (params.streetName || '').trim();
  const sNum = (params.streetNumber || '').trim();
  const bairro = (params.bairro || '').trim();
  const cidade = (params.cidade || '').trim();
  const estado = (params.estado || '').trim();

  if (!sName) return [];

  const streetPart = sNum ? `${sName}, ${sNum}` : sName;
  const fullQuery = [streetPart, bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', ');
  const candidates: AddressValidationCandidate[] = [];

  // 1. Google Maps Geocoder no navegador (suporta interpolação de numeração da rua)
  const geocoder = await getGoogleGeocoder();
  if (geocoder) {
    try {
      const googleMaps = (window as any).google.maps;
      const request: any = {
        address: fullQuery,
        region: 'BR'
      };
      if (
        params.anchorCoords &&
        Number.isFinite(params.anchorCoords.latitude) &&
        Number.isFinite(params.anchorCoords.longitude) &&
        googleMaps.LatLngBounds
      ) {
        const d = 0.005; // ~500m de bias ao redor do GPS
        const { latitude, longitude } = params.anchorCoords;
        request.bounds = new googleMaps.LatLngBounds(
          { lat: latitude - d, lng: longitude - d },
          { lat: latitude + d, lng: longitude + d }
        );
      }

      const gResults = await new Promise<any[]>((resolve) => {
        geocoder.geocode(request, (res: any[], status: string) => {
          if (status === 'OK' && Array.isArray(res)) {
            resolve(res);
          } else {
            resolve([]);
          }
        });
      });

      const typedDigits = parseInt(sNum.replace(/\D/g, ''), 10);

      for (const item of gResults) {
        const lat = typeof item.geometry?.location?.lat === 'function'
          ? item.geometry.location.lat()
          : Number(item.geometry?.location?.lat);
        const lng = typeof item.geometry?.location?.lng === 'function'
          ? item.geometry.location.lng()
          : Number(item.geometry?.location?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        let routeName = '';
        let returnedNumStr = '';
        if (Array.isArray(item.address_components)) {
          for (const comp of item.address_components) {
            const types: string[] = comp.types || [];
            if (types.includes('route')) {
              routeName = `${comp.long_name || ''} ${comp.short_name || ''}`;
            }
            if (types.includes('street_number')) {
              returnedNumStr = String(comp.long_name || comp.short_name || '').trim();
            }
          }
        }
        const formatted = String(item.formatted_address || '');
        const matchText = `${routeName} ${formatted}`;
        if (!candidateMatchesStreet(matchText, sName)) continue;

        // Verifica se o número retornado pelo Google corresponde de fato ao número digitado
        // (evita aceitar quando o Google trava no último número existente da rua para um número muito superior inexistente)
        let hasValidStreetNumber = false;
        if (sNum && Number.isFinite(typedDigits)) {
          const returnedDigits = parseInt(returnedNumStr.replace(/\D/g, ''), 10);
          if (Number.isFinite(returnedDigits)) {
            hasValidStreetNumber = Math.abs(returnedDigits - typedDigits) <= 40;
          } else {
            hasValidStreetNumber = new RegExp(`,\\s*${typedDigits}\\b`).test(formatted);
          }
        }

        candidates.push({
          latitude: lat,
          longitude: lng,
          formattedAddress: formatted,
          hasStreetNumber: hasValidStreetNumber
        });
      }
    } catch (err) {
      console.warn('[geoService] Erro no Google Geocoder durante validação de endereço:', err);
    }
  }

  // 2. Consulta complementar via searchAddresses (/api/geocode?q=... / Nominatim)
  try {
    const searchRes = await searchAddresses(fullQuery);
    const typedDigits = parseInt(sNum.replace(/\D/g, ''), 10);
    for (const item of searchRes) {
      const matchText = `${item.label || ''} ${item.sublabel || ''} ${item.formattedAddress || ''}`;
      if (!candidateMatchesStreet(matchText, sName)) continue;
      const hasNum = Boolean(
        sNum &&
        Number.isFinite(typedDigits) &&
        new RegExp(`,\\s*${typedDigits}\\b`).test(matchText)
      );
      candidates.push({
        latitude: item.latitude,
        longitude: item.longitude,
        formattedAddress: item.formattedAddress || item.label,
        hasStreetNumber: hasNum
      });
    }
  } catch (err) {
    console.warn('[geoService] Erro no searchAddresses durante validação de endereço:', err);
  }

  // Se o usuário digitou número mas nenhuma busca com número retornou a rua, tenta buscar apenas pelo nome da rua + bairro + cidade
  if (candidates.length === 0 && sNum) {
    const streetOnlyQuery = [sName, bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', ');
    try {
      const fallbackRes = await searchAddresses(streetOnlyQuery);
      for (const item of fallbackRes) {
        const matchText = `${item.label || ''} ${item.sublabel || ''} ${item.formattedAddress || ''}`;
        if (!candidateMatchesStreet(matchText, sName)) continue;
        candidates.push({
          latitude: item.latitude,
          longitude: item.longitude,
          formattedAddress: item.formattedAddress || item.label,
          hasStreetNumber: false
        });
      }
    } catch {}
  }

  return candidates;
}


