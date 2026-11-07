export interface MockSceneDefinition {
  title: string;
  subtitle: string;
  badge: string;
  location: string;
  accent: string;
  bgStart: string;
  bgEnd: string;
  icon: string;
  plateMasked?: string;
}

export const MOCK_BH_SCENES: Record<string, MockSceneDefinition> = {
  'savassi-vaga-1': {
    title: 'Vaga Exclusiva PcD • Foto 1/2 (Traseira + Placa R-6b)',
    subtitle: 'SUV prata estacionado sobre pintura azul SIA',
    badge: 'MOCK DEV • SAVASSI',
    location: 'Rua Pernambuco, 1000 - Savassi, Belo Horizonte/MG',
    accent: '#2563eb',
    bgStart: '#0f172a',
    bgEnd: '#1e3a8a',
    icon: '♿',
    plateMasked: 'Placa borrada IA'
  },
  'savassi-vaga-2': {
    title: 'Vaga Exclusiva PcD • Foto 2/2 (Frontal / Painel)',
    subtitle: 'Para-brisa frontal livre — nenhuma credencial visível no painel',
    badge: 'MOCK DEV • SAVASSI',
    location: 'Rua Pernambuco, 1000 - Savassi, Belo Horizonte/MG',
    accent: '#3b82f6',
    bgStart: '#1e293b',
    bgEnd: '#1d4ed8',
    icon: '🚘',
    plateMasked: 'Painel verificado'
  },
  'savassi-dup-1': {
    title: 'Possível Duplicidade • Foto 1/2 (Ângulo Lateral)',
    subtitle: 'Mesmo SUV prata registrado 1 min depois a 4 metros',
    badge: 'TRIAGEM DUPLICIDADE',
    location: 'Rua Pernambuco, 1000 - Savassi, Belo Horizonte/MG',
    accent: '#d97706',
    bgStart: '#1c1917',
    bgEnd: '#78350f',
    icon: '🔁',
    plateMasked: 'Placa borrada IA'
  },
  'savassi-dup-2': {
    title: 'Possível Duplicidade • Foto 2/2 (Frente Diagonal)',
    subtitle: 'Vista frontal diagonal sem credencial no painel',
    badge: 'TRIAGEM DUPLICIDADE',
    location: 'Rua Pernambuco, 1000 - Savassi, Belo Horizonte/MG',
    accent: '#f59e0b',
    bgStart: '#292524',
    bgEnd: '#92400e',
    icon: '🚘',
    plateMasked: 'Painel verificado'
  },
  'centro-transferencia-1': {
    title: 'Área de Transferência Zebrada • Foto 1/2',
    subtitle: 'Veículo bloqueando faixa zebrada lateral da vaga PcD',
    badge: 'MOCK DEV • CENTRO BH',
    location: 'Av. Afonso Pena, 1270 - Centro, Belo Horizonte/MG',
    accent: '#7c3aed',
    bgStart: '#1e1b4b',
    bgEnd: '#4c1d95',
    icon: '♿',
    plateMasked: 'Placa borrada IA'
  },
  'centro-transferencia-2': {
    title: 'Área de Transferência Zebrada • Foto 2/2 (Frontal)',
    subtitle: 'Painel dianteiro sem cartão de estacionamento PcD',
    badge: 'MOCK DEV • CENTRO BH',
    location: 'Av. Afonso Pena, 1270 - Centro, Belo Horizonte/MG',
    accent: '#8b5cf6',
    bgStart: '#2e1065',
    bgEnd: '#5b21b6',
    icon: '🚘',
    plateMasked: 'Painel verificado'
  },
  'santa-tereza-pedestre-1': {
    title: 'Faixa de Pedestres / Rampa • Foto 1/2',
    subtitle: 'Carro parado sobre a faixa obstruindo rampa acessível',
    badge: 'MOCK DEV • SANTA TEREZA',
    location: 'Rua Mármore, 280 - Santa Tereza, Belo Horizonte/MG',
    accent: '#dc2626',
    bgStart: '#1f2937',
    bgEnd: '#7f1d1d',
    icon: '🚷',
    plateMasked: 'Placa borrada IA'
  },
  'santa-tereza-pedestre-2': {
    title: 'Faixa de Pedestres / Rampa • Foto 2/2 (Frontal)',
    subtitle: 'Enquadramento frontal confirmando bloqueio da travessia',
    badge: 'MOCK DEV • SANTA TEREZA',
    location: 'Rua Mármore, 280 - Santa Tereza, Belo Horizonte/MG',
    accent: '#ef4444',
    bgStart: '#111827',
    bgEnd: '#991b1b',
    icon: '🚘',
    plateMasked: 'Placa borrada IA'
  },
  'mercado-central-vaga-1': {
    title: 'Vaga Exclusiva PcD • Foto 1/2 (Traseira)',
    subtitle: 'Utilitário estacionado em vaga demarcada próxima ao Mercado Central',
    badge: 'MOCK DEV • MERCADO CENTRAL',
    location: 'Av. Augusto de Lima, 785 - Centro, Belo Horizonte/MG',
    accent: '#2563eb',
    bgStart: '#0f172a',
    bgEnd: '#1e40af',
    icon: '♿',
    plateMasked: 'Placa borrada IA'
  },
  'mercado-central-vaga-2': {
    title: 'Vaga Exclusiva PcD • Foto 2/2 (Frontal)',
    subtitle: 'Vista frontal do para-brisa sem credencial visível',
    badge: 'MOCK DEV • MERCADO CENTRAL',
    location: 'Av. Augusto de Lima, 785 - Centro, Belo Horizonte/MG',
    accent: '#3b82f6',
    bgStart: '#172554',
    bgEnd: '#1d4ed8',
    icon: '🚘',
    plateMasked: 'Painel verificado'
  },
  'lourdes-credencial-1': {
    title: 'Revisão de Credencial • Foto 1/2 (Traseira)',
    subtitle: 'Sedã estacionado em vaga exclusiva PcD no bairro Lourdes',
    badge: 'POSSÍVEL CREDENCIAL À VISTA',
    location: 'Rua Marília de Dirceu, 226 - Lourdes, Belo Horizonte/MG',
    accent: '#0284c7',
    bgStart: '#082f49',
    bgEnd: '#0369a1',
    icon: '🪪',
    plateMasked: 'Retida para revisão'
  },
  'lourdes-credencial-2': {
    title: 'Revisão de Credencial • Foto 2/2 (Painel Frontal)',
    subtitle: 'Cartão com símbolo internacional de acesso detectado sobre o painel',
    badge: 'POSSÍVEL CREDENCIAL NO PAINEL',
    location: 'Rua Marília de Dirceu, 226 - Lourdes, Belo Horizonte/MG',
    accent: '#0ea5e9',
    bgStart: '#0c4a6e',
    bgEnd: '#0284c7',
    icon: '🪪',
    plateMasked: 'Credencial detectada IA'
  },
  'barro-preto-vaga-1': {
    title: 'Ocorrência Reportada • Foto 1/2 (Traseira)',
    subtitle: 'Veículo em vaga exclusiva PcD — aguardando moderação',
    badge: 'REPORTADA • BARRO PRETO',
    location: 'Rua Mato Grosso, 539 - Barro Preto, Belo Horizonte/MG',
    accent: '#ea580c',
    bgStart: '#27272a',
    bgEnd: '#7c2d12',
    icon: '🚩',
    plateMasked: 'Placa borrada IA'
  },
  'barro-preto-vaga-2': {
    title: 'Ocorrência Reportada • Foto 2/2 (Frontal)',
    subtitle: 'Foto frontal anexada ao registro original',
    badge: 'REPORTADA • BARRO PRETO',
    location: 'Rua Mato Grosso, 539 - Barro Preto, Belo Horizonte/MG',
    accent: '#f97316',
    bgStart: '#18181b',
    bgEnd: '#9a3412',
    icon: '🚘',
    plateMasked: 'Painel verificado'
  },
  'praca-sete-urbana': {
    title: 'Mobilidade Urbana • Travessia Sem Rampa',
    subtitle: 'Desnível acentuado na calçada impedindo passagem de cadeira de rodas',
    badge: 'MOBILIDADE URBANA • PRAÇA SETE',
    location: 'Av. Amazonas, 478 - Centro, Belo Horizonte/MG',
    accent: '#d97706',
    bgStart: '#1e293b',
    bgEnd: '#b45309',
    icon: '🚧'
  },
  'liberdade-antes': {
    title: 'ANTES • Piso Tátil Solto e Guia Danificada',
    subtitle: 'Buraco na rampa rebaixada em frente ao Circuito Liberdade',
    badge: 'ANTES • PRAÇA DA LIBERDADE',
    location: 'Praça da Liberdade, 150 - Funcionários, Belo Horizonte/MG',
    accent: '#d97706',
    bgStart: '#292524',
    bgEnd: '#92400e',
    icon: '🚧'
  },
  'liberdade-depois': {
    title: 'DEPOIS • Rampa Nivelada e Piso Tátil Novo',
    subtitle: 'Guia recomposta e sinalização tátil instalada — aguardando validação',
    badge: 'DEPOIS (EM VALIDAÇÃO) • LIBERDADE',
    location: 'Praça da Liberdade, 150 - Funcionários, Belo Horizonte/MG',
    accent: '#16a34a',
    bgStart: '#052e16',
    bgEnd: '#15803d',
    icon: '✅'
  },
  'santo-agostinho-antes': {
    title: 'ANTES • Ausência de Rebaixamento de Guia',
    subtitle: 'Meio-fio alto junto à faixa de pedestres na Av. Álvares Cabral',
    badge: 'ANTES • SANTO AGOSTINHO',
    location: 'Av. Álvares Cabral, 1600 - Santo Agostinho, Belo Horizonte/MG',
    accent: '#d97706',
    bgStart: '#1c1917',
    bgEnd: '#b45309',
    icon: '🚧'
  },
  'santo-agostinho-depois': {
    title: 'DEPOIS • Nova Rampa Acessível NBR 9050',
    subtitle: 'Rebaixamento concluído com piso tátil direcional e de alerta',
    badge: 'RESOLVIDO • SANTO AGOSTINHO',
    location: 'Av. Álvares Cabral, 1600 - Santo Agostinho, Belo Horizonte/MG',
    accent: '#16a34a',
    bgStart: '#064e3b',
    bgEnd: '#16a34a',
    icon: '✅'
  },
  'cristovao-colombo-urbana': {
    title: 'Mobilidade Urbana • Calçada Obstruída',
    subtitle: 'Faixa livre reduzida por obstáculo fixo e raízes expostas',
    badge: 'MOBILIDADE URBANA • FUNCIONÁRIOS',
    location: 'Av. Cristóvão Colombo, 450 - Funcionários, Belo Horizonte/MG',
    accent: '#d97706',
    bgStart: '#1f2937',
    bgEnd: '#92400e',
    icon: '🚧'
  },
  'contorno-vaga-1': {
    title: 'Vaga Exclusiva PcD • Foto 1/2 (Revisada Improcedente)',
    subtitle: 'Sinalização vertical e pintura SIA confirmadas pela moderação',
    badge: 'REVISADA • SAVASSI',
    location: 'Av. do Contorno, 6061 - Savassi, Belo Horizonte/MG',
    accent: '#2563eb',
    bgStart: '#0f172a',
    bgEnd: '#1d4ed8',
    icon: '♿',
    plateMasked: 'Placa borrada IA'
  },
  'contorno-vaga-2': {
    title: 'Vaga Exclusiva PcD • Foto 2/2 (Frontal)',
    subtitle: 'Painel frontal sem credencial de estacionamento',
    badge: 'REVISADA • SAVASSI',
    location: 'Av. do Contorno, 6061 - Savassi, Belo Horizonte/MG',
    accent: '#3b82f6',
    bgStart: '#1e293b',
    bgEnd: '#2563eb',
    icon: '🚘',
    plateMasked: 'Painel verificado'
  }
};

function escapeXml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderMockBhSceneSvg(sceneKey: string): string {
  const def: MockSceneDefinition = MOCK_BH_SCENES[sceneKey] || {
    title: 'Registro Mock • Belo Horizonte',
    subtitle: 'Imagem simulada para ambiente local de desenvolvimento',
    badge: 'MOCK DEV • BELO HORIZONTE',
    location: 'Belo Horizonte - MG',
    accent: '#86007D',
    bgStart: '#0f172a',
    bgEnd: '#4a044e',
    icon: '📍'
  };

  const badge = escapeXml(def.badge);
  const title = escapeXml(def.title);
  const subtitle = escapeXml(def.subtitle);
  const location = escapeXml(def.location);
  const icon = escapeXml(def.icon);
  const plateTag = def.plateMasked ? escapeXml(def.plateMasked) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(def.bgStart)}"/>
      <stop offset="100%" stop-color="${escapeXml(def.bgEnd)}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <circle cx="710" cy="90" r="180" fill="${escapeXml(def.accent)}" opacity="0.18"/>
  <circle cx="90" cy="520" r="210" fill="${escapeXml(def.accent)}" opacity="0.14"/>
  <rect x="44" y="40" width="712" height="520" rx="24" fill="#0f172a" fill-opacity="0.52" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2"/>
  <rect x="72" y="68" width="310" height="38" rx="19" fill="${escapeXml(def.accent)}"/>
  <text x="227" y="93" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" letter-spacing="0.8">${badge}</text>
  <circle cx="400" cy="235" r="66" fill="#ffffff" fill-opacity="0.12" stroke="${escapeXml(def.accent)}" stroke-width="3"/>
  <text x="400" y="256" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="56">${icon}</text>
  <text x="400" y="352" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800">${title}</text>
  <text x="400" y="390" text-anchor="middle" fill="#cbd5e1" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500">${subtitle}</text>
  ${
    plateTag
      ? `<rect x="290" y="418" width="220" height="36" rx="10" fill="#e2e8f0" fill-opacity="0.92"/>
  <text x="400" y="442" text-anchor="middle" fill="#0f172a" font-family="monospace" font-size="15" font-weight="800">${plateTag}</text>`
      : ''
  }
  <rect x="72" y="486" width="656" height="46" rx="12" fill="#020617" fill-opacity="0.65"/>
  <text x="400" y="515" text-anchor="middle" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600">📍 ${location}</text>
</svg>`;
}

export function buildMockBhSceneDataUrl(sceneKey: string): string {
  const svg = renderMockBhSceneSvg(sceneKey);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
