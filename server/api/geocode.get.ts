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

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const searchQuery = String(query.q || '').trim();

  // Modo 1: Busca de endereços por texto (Forward Geocoding / Autocomplete)
  if (searchQuery.length >= 2) {
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
          const results = items
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

          return { results };
        }
      }
    } catch (searchErr) {
      console.warn('[server/api/geocode] Erro na busca de endereço por texto:', searchErr);
    }

    return { results: [] };
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
      estado: ''
    };
  }

  let formattedAddress = '';
  let streetFull = '';
  let suburb = '';
  let city = '';
  let state = '';

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
        const street = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || '';
        const number = addr.house_number ? `, ${addr.house_number}` : '';
        streetFull = street ? `${street}${number}` : '';
        suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
        city = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.county || addr.hamlet || addr.state_district || '';
        
        if (addr['ISO3166-2-lvl4']) {
          state = String(addr['ISO3166-2-lvl4']).replace(/^BR-/, '');
        } else {
          state = addr.state || '';
        }
        state = normalizeState(state);

        if (state === 'DF' && (!city || city.toLowerCase().includes('plano piloto') || city.toLowerCase().includes('distrito federal'))) {
          city = 'Brasília';
        }

        const parts = [
          streetFull,
          suburb,
          city,
          state
        ].filter(Boolean);

        formattedAddress = parts.length > 0 ? parts.join(' - ') : (data.display_name || '');
      }
    }
  } catch (err) {
    console.warn('[server/api/geocode] Nominatim falhou, tentando fallback:', err);
  }

  // Fallback BigDataCloud se Nominatim falhar ou não retornar cidade/estado/bairro
  if (!city || !state || !suburb) {
    try {
      const bdcUrl = `https://api-bdc.io/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&localityLanguage=pt`;
      const bdcRes = await fetch(bdcUrl);
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
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
          state = normalizeState(code || iso || stateObj?.name || bdcData.principalSubdivision || '');
        }
        if (state === 'DF' && (!city || city.toLowerCase().includes('plano piloto') || city.toLowerCase().includes('distrito federal'))) {
          city = 'Brasília';
        }
        if (!formattedAddress) {
          const parts = [streetFull, suburb || bdcData.locality, city, state].filter(Boolean);
          formattedAddress = parts.join(' - ');
        }
      }
    } catch (bdcErr) {
      console.warn('[server/api/geocode] BigDataCloud fallback falhou:', bdcErr);
    }
  }

  return {
    formattedAddress: formattedAddress || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
    rua: streetFull,
    bairro: suburb,
    cidade: city,
    estado: state
  };
});
