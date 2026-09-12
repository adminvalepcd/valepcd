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
  const lat = parseFloat(String(query.lat || ''));
  const lng = parseFloat(String(query.lng || ''));

  if (isNaN(lat) || isNaN(lng)) {
    return {
      formattedAddress: 'Localização inválida',
      cidade: '',
      estado: ''
    };
  }

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
        const suburb = addr.suburb || addr.neighbourhood || addr.city_district || '';
        let city = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.county || addr.hamlet || '';
        
        let state = '';
        if (addr['ISO3166-2-lvl4']) {
          state = String(addr['ISO3166-2-lvl4']).replace(/^BR-/, '');
        } else {
          state = addr.state || '';
        }
        state = normalizeState(state);

        // Caso especial: Distrito Federal / Brasília
        if (state === 'DF' && (!city || city.toLowerCase().includes('plano piloto') || city.toLowerCase().includes('distrito federal'))) {
          city = 'Brasília';
        }

        const parts = [
          street ? `${street}${number}` : '',
          suburb,
          city,
          state
        ].filter(Boolean);

        const formatted = parts.length > 0 ? parts.join(' - ') : (data.display_name || '');
        return {
          formattedAddress: formatted || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
          cidade: city,
          estado: state
        };
      }
    }
  } catch (err) {
    console.error('[server/api/geocode] Erro ao resolver coordenadas:', err);
  }

  return {
    formattedAddress: `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
    cidade: '',
    estado: ''
  };
});
