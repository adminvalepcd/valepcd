export const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

export const STATE_CAPITALS: Record<string, string> = {
  AC: 'Rio Branco',
  AL: 'Maceió',
  AP: 'Macapá',
  AM: 'Manaus',
  BA: 'Salvador',
  CE: 'Fortaleza',
  DF: 'Brasília',
  ES: 'Vitória',
  GO: 'Goiânia',
  MA: 'São Luís',
  MT: 'Cuiabá',
  MS: 'Campo Grande',
  MG: 'Belo Horizonte',
  PA: 'Belém',
  PB: 'João Pessoa',
  PR: 'Curitiba',
  PE: 'Recife',
  PI: 'Teresina',
  RJ: 'Rio de Janeiro',
  RN: 'Natal',
  RS: 'Porto Alegre',
  RO: 'Porto Velho',
  RR: 'Boa Vista',
  SC: 'Florianópolis',
  SP: 'São Paulo',
  SE: 'Aracaju',
  TO: 'Palmas'
};

const citiesMemoryCache = new Map<string, string[]>();
const STORAGE_PREFIX = 'multei_ibge_cities_v1_';

export function getCapitalByState(uf?: string): string {
  if (!uf) return '';
  const key = uf.trim().toUpperCase();
  return STATE_CAPITALS[key] || '';
}

export function normalizeSearchText(value?: string): string {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Busca a lista oficial de municípios de um estado (UF) usando a API de Localidades do IBGE
 * (`https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios?orderBy=nome`)
 * com fallback para a BrasilAPI e cache em memória/sessionStorage.
 */
export async function fetchCitiesByState(uf?: string): Promise<string[]> {
  const normalizedUf = (uf || '').trim().toUpperCase();
  if (!normalizedUf || !STATE_CAPITALS[normalizedUf]) {
    return [];
  }

  const cached = citiesMemoryCache.get(normalizedUf);
  if (cached && cached.length > 0) {
    return cached;
  }

  if (typeof window !== 'undefined') {
    try {
      const rawSession = sessionStorage.getItem(`${STORAGE_PREFIX}${normalizedUf}`);
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (Array.isArray(parsed) && parsed.length > 0) {
          citiesMemoryCache.set(normalizedUf, parsed);
          return parsed;
        }
      }
    } catch {}
  }

  const capital = STATE_CAPITALS[normalizedUf];
  let cities: string[] = [];

  try {
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(normalizedUf)}/municipios?orderBy=nome`,
      { headers: { Accept: 'application/json' } }
    );
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        cities = data
          .map((item: any) => String(item?.nome || '').trim())
          .filter(Boolean);
      }
    }
  } catch {}

  if (cities.length === 0) {
    try {
      const fallbackResponse = await fetch(
        `https://brasilapi.com.br/api/ibge/municipios/v1/${encodeURIComponent(normalizedUf)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (Array.isArray(fallbackData)) {
          cities = fallbackData
            .map((item: any) => String(item?.nome || '').trim())
            .filter(Boolean);
        }
      }
    } catch {}
  }

  const uniqueSet = new Set<string>(cities);
  if (capital) {
    uniqueSet.add(capital);
  }

  const sortedCities = Array.from(uniqueSet).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  );

  if (sortedCities.length > 1) {
    citiesMemoryCache.set(normalizedUf, sortedCities);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${normalizedUf}`, JSON.stringify(sortedCities));
      } catch {}
    }
  }

  return sortedCities;
}
