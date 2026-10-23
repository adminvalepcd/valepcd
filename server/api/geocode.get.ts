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

function extractCleanStreetNumber(rawNum: string): string {
  const s = String(rawNum || '').trim();
  if (!s) return '';
  // Se vier intervalo (ex: "120-130" ou "120 - 130"), extrai o primeiro número
  const rangeMatch = s.match(/^(\d+[A-Za-z]?)\s*[-–/]\s*\d+/);
  if (rangeMatch && rangeMatch[1]) {
    return rangeMatch[1];
  }
  const numMatch = s.match(/^(\d+[A-Za-z0-9\/-]*)$/);
  return numMatch ? numMatch[1] : '';
}

function parseArcgisAddress(addrObj: any): { street: string; number: string } {
  const rawAddress = String(addrObj?.Address || addrObj?.ShortLabel || '').trim();
  const rawAddNum = extractCleanStreetNumber(addrObj?.AddNum || '');
  const rawStName = String(addrObj?.StName || '').trim();
  const rawStType = String(addrObj?.StType || '').trim();

  let street = '';
  let number = rawAddNum;

  if (rawAddress) {
    // Formato "Rua X, 123"
    const commaMatch = rawAddress.match(/^(.*?),\s*(\d+[A-Za-z0-9\/-]*)$/);
    if (commaMatch) {
      street = commaMatch[1].trim();
      if (!number) {
        number = extractCleanStreetNumber(commaMatch[2]);
      }
    } else {
      // Formato "123 Rua X"
      const prefixMatch = rawAddress.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
      if (prefixMatch && rawAddNum && prefixMatch[1] === rawAddNum) {
        street = prefixMatch[2].trim();
      } else {
        street = rawAddress.replace(/,\s*$/, '').trim();
      }
    }
  }

  if (!street && rawStName) {
    street = [rawStType, rawStName].filter(Boolean).join(' ').trim();
  }

  return { street, number };
}

function normalizeStreetTokens(val: string): string[] {
  const stopWords = new Set([
    'rua', 'r', 'avenida', 'av', 'alameda', 'al', 'travessa', 'tv',
    'praca', 'pca', 'rodovia', 'rod', 'estrada', 'est', 'via', 'beco',
    'largo', 'viela', 'de', 'da', 'do', 'das', 'dos', 'e',
    ' doutor', 'dr', 'professor', 'prof', 'presidente', 'pres',
    'governador', 'gov', 'senador', 'sen', 'deputado', 'dep',
    'coronel', 'cel', 'general', 'gen', 'marechal', 'mal'
  ]);
  return String(val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !stopWords.has(t));
}

function streetsAreCompatible(streetA: string, streetB: string): boolean {
  const tokensA = normalizeStreetTokens(streetA);
  const tokensB = normalizeStreetTokens(streetB);
  if (tokensA.length === 0 || tokensB.length === 0) return true;
  return tokensA.some(t => tokensB.includes(t));
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const searchQuery = String(query.q || '').trim();

  // Modo 1: Busca de endereços por texto (Forward Geocoding / Autocomplete)
  if (searchQuery.length >= 2) {
    const collectedResults: any[] = [];

    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=br&addressdetails=1&limit=6&email=contato@valepcd.com.br`;
      const res = await fetch(searchUrl, {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'User-Agent': 'ValePCD-App/1.0 (contato@valepcd.com.br)'
        }
      });

      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          const nominatimResults = items
            .map((item: any) => {
              const itemLat = parseFloat(String(item.lat || ''));
              const itemLng = parseFloat(String(item.lon || ''));
              if (isNaN(itemLat) || isNaN(itemLng)) return null;

              const addr = item.address || {};
              const street = addr.road || addr.street || addr.pedestrian || addr.footway || addr.suburb || addr.amenity || addr.shop || '';
              const number = addr.house_number ? `, ${addr.house_number}` : '';
              const suburb = addr.suburb || addr.neighbourhood || addr.city_district || '';
              let itemCity = addr.city || addr.town || addr.municipality || addr.village || addr.county || '';
              let itemState = '';
              if (addr['ISO3166-2-lvl4']) {
                itemState = String(addr['ISO3166-2-lvl4']).replace(/^BR-/, '');
              } else {
                itemState = addr.state || '';
              }
              itemState = normalizeState(itemState);

              if (itemState === 'DF' && (!itemCity || itemCity.toLowerCase().includes('plano piloto') || itemCity.toLowerCase().includes('distrito federal'))) {
                itemCity = 'Brasília';
              }

              const primaryParts = [
                street ? `${street}${number}` : (item.name || itemCity || item.display_name?.split(',')[0] || ''),
                suburb && suburb !== street ? suburb : ''
              ].filter(Boolean);

              const secondaryParts = [
                itemCity,
                itemState,
                addr.postcode || ''
              ].filter(Boolean);

              const label = primaryParts.join(' - ') || String(item.display_name || '').split(',')[0] || searchQuery;
              const sublabel = secondaryParts.join(' • ') || String(item.display_name || '');

              return {
                label,
                sublabel,
                formattedAddress: [label, itemCity, itemState].filter(Boolean).join(' - '),
                latitude: itemLat,
                longitude: itemLng,
                cidade: itemCity,
                estado: itemState,
                type: item.type || item.class || ''
              };
            })
            .filter(Boolean);

          collectedResults.push(...nominatimResults);
        }
      }
    } catch (searchErr) {
      console.warn('[server/api/geocode] Erro na busca de endereço por texto (Nominatim):', searchErr);
    }

    // Se a busca contém números (ex: validação de rua + número) ou o Nominatim não retornou resultados com número,
    // complementa com ArcGIS World Geocoding Service (suporta interpolação de números de rua no Brasil)
    const queryHasDigits = /\d/.test(searchQuery);
    const hasNumberedResult = collectedResults.some((r) => /,\s*\d+/.test(String(r?.label || '')) || /,\s*\d+/.test(String(r?.formattedAddress || '')));
    if (collectedResults.length === 0 || (queryHasDigits && !hasNumberedResult)) {
      try {
        const arcSearchUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(searchQuery)}&countryCode=BRA&maxLocations=5&outFields=AddNum,Address,StName,StType,Neighborhood,District,City,Subregion,Region,RegionAbbr,Postal,Addr_type`;
        const arcRes = await fetch(arcSearchUrl);
        if (arcRes.ok) {
          const arcData = await arcRes.json();
          const candidates = Array.isArray(arcData?.candidates) ? arcData.candidates : [];
          for (const cand of candidates) {
            const cLat = Number(cand?.location?.y);
            const cLng = Number(cand?.location?.x);
            if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) continue;

            const attrs = cand.attributes || {};
            const parsedArc = parseArcgisAddress(attrs);
            const streetWithNum = parsedArc.street
              ? (parsedArc.number ? `${parsedArc.street}, ${parsedArc.number}` : parsedArc.street)
              : String(cand.address || '').split(',')[0].trim();
            const suburb = String(attrs.Neighborhood || attrs.District || '').trim();
            const itemCity = String(attrs.City || attrs.Subregion || '').trim();
            const itemState = normalizeState(String(attrs.RegionAbbr || attrs.Region || '').trim());

            const label = [streetWithNum, suburb].filter(Boolean).join(' - ') || String(cand.address || searchQuery);
            const sublabel = [itemCity, itemState, String(attrs.Postal || '').trim()].filter(Boolean).join(' • ');

            collectedResults.push({
              label,
              sublabel,
              formattedAddress: [streetWithNum, suburb, itemCity, itemState].filter(Boolean).join(' - ') || String(cand.address || ''),
              latitude: cLat,
              longitude: cLng,
              cidade: itemCity,
              estado: itemState,
              type: String(attrs.Addr_type || 'address')
            });
          }
        }
      } catch (arcSearchErr) {
        console.warn('[server/api/geocode] Erro no fallback ArcGIS findAddressCandidates:', arcSearchErr);
      }
    }

    return { results: collectedResults };
  }

  // Modo 2: Geocodificação reversa por coordenadas (lat, lng)
  const lat = parseFloat(String(query.lat || ''));
  const lng = parseFloat(String(query.lng || ''));

  if (isNaN(lat) || isNaN(lng)) {
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

  const inBrazilBounds = lat >= -33.76 && lat <= 5.28 && lng >= -74.00 && lng <= -28.80;
  const validBrazilUFs = new Set(Object.values(UF_MAP));

  let formattedAddress = '';
  let streetNameOnly = '';
  let streetNumberOnly = '';
  let streetFull = '';
  let suburb = '';
  let city = '';
  let state = '';
  let countryCode = '';
  let countryName = '';
  let nominatimRawDisplayName = '';

  const normalizeCountryIso = (code: string) => {
    const clean = String(code || '').trim().toUpperCase();
    if (clean === 'BRA') return 'BR';
    return clean;
  };

  // 1. Consulta OpenStreetMap Nominatim (excelente para nome oficial da via, bairro, cidade e UF)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1&email=contato@valepcd.com.br`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'User-Agent': 'ValePCD-App/1.0 (contato@valepcd.com.br)'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        if (addr.country_code) {
          countryCode = normalizeCountryIso(addr.country_code);
        }
        if (addr.country) {
          countryName = String(addr.country).trim();
        }

        const isForeignCountry = Boolean(countryCode && countryCode !== 'BR');

        streetNameOnly = String(addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || '').trim();
        streetNumberOnly = extractCleanStreetNumber(addr.house_number || '');
        streetFull = streetNameOnly
          ? (streetNumberOnly ? `${streetNameOnly}, ${streetNumberOnly}` : streetNameOnly)
          : '';
        suburb = String(addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '').trim();
        city = String(addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.county || addr.hamlet || addr.state_district || '').trim();

        if (!isForeignCountry) {
          if (addr['ISO3166-2-lvl4']) {
            state = String(addr['ISO3166-2-lvl4']).replace(/^BR-/, '');
          } else {
            state = addr.state || '';
          }
          state = normalizeState(state);

          if (state === 'DF' && (!city || city.toLowerCase().includes('plano piloto') || city.toLowerCase().includes('distrito federal'))) {
            city = 'Brasília';
          }
        } else {
          state = String(addr.state || '').trim();
        }

        nominatimRawDisplayName = String(data.display_name || '');
      }
    }
  } catch (err) {
    console.warn('[server/api/geocode] Nominatim falhou, tentando fallback:', err);
  }

  // 2. Se o Nominatim não retornou o número do imóvel (comum no Brasil quando o pino está sobre o leito da via),
  // consulta o ArcGIS Reverse Geocode para obter a numeração interpolada/aproximada da rua naquela coordenada
  if (!streetNumberOnly || !streetNameOnly || !suburb || !city || !state || !countryCode) {
    try {
      const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${encodeURIComponent(lng)},${encodeURIComponent(lat)}&langCode=pt&featureTypes=PointAddress,StreetAddress,StreetName`;
      const arcRes = await fetch(arcUrl);
      if (arcRes.ok) {
        const arcData = await arcRes.json();
        const arcAddr = arcData?.address;
        if (arcAddr) {
          if (!countryCode && arcAddr.CountryCode) {
            countryCode = normalizeCountryIso(arcAddr.CountryCode);
          }
          if (!countryName && arcAddr.CntryName) {
            countryName = String(arcAddr.CntryName).trim();
          }

          const isForeignCountry = Boolean(countryCode && countryCode !== 'BR');
          const parsedArc = parseArcgisAddress(arcAddr);
          const arcLocLat = Number(arcData?.location?.y);
          const arcLocLng = Number(arcData?.location?.x);
          const distMeters =
            Number.isFinite(arcLocLat) && Number.isFinite(arcLocLng)
              ? getDistanceMeters(lat, lng, arcLocLat, arcLocLng)
              : 0;

          if (!streetNameOnly && parsedArc.street) {
            streetNameOnly = parsedArc.street;
          }

          if (!streetNumberOnly && parsedArc.number) {
            // Usa o número se for a mesma rua ou se o ponto de endereço estiver a até 45m do pino
            if (!streetNameOnly || !parsedArc.street || streetsAreCompatible(streetNameOnly, parsedArc.street) || distMeters <= 45) {
              streetNumberOnly = parsedArc.number;
            }
          }

          if (!suburb && (arcAddr.Neighborhood || arcAddr.District)) {
            suburb = String(arcAddr.Neighborhood || arcAddr.District).trim();
          }
          if (!city && (arcAddr.City || arcAddr.Subregion)) {
            city = String(arcAddr.City || arcAddr.Subregion).trim();
          }
          if (!state && (arcAddr.RegionAbbr || arcAddr.Region)) {
            const rawRegion = String(arcAddr.RegionAbbr || arcAddr.Region).trim();
            state = isForeignCountry ? rawRegion : normalizeState(rawRegion);
          }
        }
      }
    } catch (arcErr) {
      console.warn('[server/api/geocode] ArcGIS reverseGeocode fallback falhou:', arcErr);
    }
  }

  streetFull = streetNameOnly
    ? (streetNumberOnly ? `${streetNameOnly}, ${streetNumberOnly}` : streetNameOnly)
    : '';

  // 3. Fallback BigDataCloud se ainda faltar cidade/estado/bairro ou país
  if (!city || !state || !suburb || !countryCode) {
    try {
      const bdcUrl = `https://api-bdc.io/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&localityLanguage=pt`;
      const bdcRes = await fetch(bdcUrl);
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        if (!countryCode && bdcData?.countryCode) {
          countryCode = normalizeCountryIso(bdcData.countryCode);
        }
        if (!countryName && bdcData?.countryName) {
          countryName = String(bdcData.countryName).trim();
        }

        const isForeignCountry = Boolean(countryCode && countryCode !== 'BR');
        const adminList = Array.isArray(bdcData?.localityInfo?.administrative) ? bdcData.localityInfo.administrative : [];
        if (!city) {
          const munObj = adminList.find((a: any) => a.adminLevel === 8 && a.name);
          if (munObj && munObj.name) {
            city = String(munObj.name).trim();
          } else {
            const candidate = bdcData.locality || bdcData.city || '';
            if (candidate && !/^(regi[aã]o metropolitana|microrregi[aã]o|mesorregi[aã]o)/i.test(String(candidate).trim())) {
              city = String(candidate).trim();
            }
          }
        }
        if (!suburb && bdcData.locality && String(bdcData.locality).trim().toLowerCase() !== city.toLowerCase()) {
          suburb = String(bdcData.locality).trim();
        }
        if (!state) {
          const code = bdcData.principalSubdivisionCode ? String(bdcData.principalSubdivisionCode).replace(/^BR-/, '') : '';
          const stateObj = adminList.find((a: any) => a.adminLevel === 4 && (a.isoCode || a.name));
          const iso = stateObj?.isoCode ? String(stateObj.isoCode).replace(/^BR-/, '') : '';
          const rawSubdivision = code || iso || stateObj?.name || bdcData.principalSubdivision || '';
          state = isForeignCountry ? String(rawSubdivision).trim() : normalizeState(rawSubdivision);
        }
      }
    } catch (bdcErr) {
      console.warn('[server/api/geocode] BigDataCloud fallback falhou:', bdcErr);
    }
  }

  const hasExplicitForeignCountry =
    (countryCode !== '' && countryCode !== 'BR') ||
    (!countryCode && countryName !== '' && !/brasil|brazil/i.test(countryName));

  const isConfirmedBrazil =
    inBrazilBounds &&
    !hasExplicitForeignCountry &&
    (countryCode === 'BR' ||
      /brasil|brazil/i.test(countryName) ||
      Boolean(state && validBrazilUFs.has(state.toUpperCase())) ||
      (!countryCode && !countryName));

  if (isConfirmedBrazil && state === 'DF' && (!city || city.toLowerCase().includes('plano piloto') || city.toLowerCase().includes('distrito federal'))) {
    city = 'Brasília';
  }

  const finalParts = [streetFull, suburb, city, state].filter(Boolean);
  formattedAddress = finalParts.length > 0 ? finalParts.join(' - ') : nominatimRawDisplayName;

  return {
    formattedAddress: formattedAddress || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
    rua: streetFull,
    bairro: suburb,
    cidade: city,
    estado: state,
    pais: countryName || (isConfirmedBrazil ? 'Brasil' : ''),
    countryCode: countryCode || (isConfirmedBrazil ? 'BR' : ''),
    isBrazil: isConfirmedBrazil
  };
});
