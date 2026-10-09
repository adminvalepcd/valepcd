<template>
  <div class="multei-fullscreen-page">
    <!-- Título H1 para SEO (atrás do mapa, indexável pelos motores de busca) -->
    <h1 class="seo-title">Multei - Denúncia anônima de uso irregular de vagas para PcD</h1>

    <!-- Barra Superior Flutuante: Botão Voltar + Busca de Endereço + Status/GPS -->
    <div
      class="top-header-bar"
      ref="searchContainerRef"
      :inert="isAnyModalOpen || undefined"
      :aria-hidden="isAnyModalOpen ? 'true' : undefined"
    >
      <div class="top-left-controls">
        <NuxtLink to="/" class="btn-back-home" title="Voltar para a página inicial do Vale PCD"
          aria-label="Voltar para a Home do Vale PCD">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" class="back-icon">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span class="back-label">Voltar</span>
        </NuxtLink>

        <!-- Filtro de Tipo de Ocorrência (filtra apenas o que é exibido em tela, sem nova busca) -->
        <div class="incident-type-filter-wrapper">
          <select
            v-model="selectedIncidentType"
            class="incident-type-select"
            aria-label="Filtrar tipo de ocorrência exibida no mapa"
            title="Filtrar ocorrências exibidas no mapa"
          >
            <option value="all">Todas ocorrências</option>
            <option value="urbana">Mobilidade urbana</option>
            <option value="transito">Infrações de trânsito</option>
          </select>
        </div>
    
        <div class="top-bar-pills glass-panel">
          <span v-if="isLoadingSheet" class="badge-status">Sincronizando...</span>
          <span v-else class="badge-status is-active"
            :title="`Exibindo ${visibleIncidentsCount} de ${filteredIncidents.length} ocorrências filtradas (${incidents.length} carregadas na região)`">
            {{ visibleIncidentsCount }} na região
          </span>

          <span
            v-if="locationState === 'granted'"
            class="badge-status is-gps"
            title="Localização GPS ativa"
          >
            📍 GPS Ativo
          </span>
          <button
            v-else
            type="button"
            class="badge-status is-clickable-gps is-gps-off"
            :disabled="locationState === 'requesting'"
            title="GPS desativado. Clique para ativar sua localização no navegador"
            @click="handleGpsActivateClick"
          >
            📍 {{ locationState === 'requesting' ? 'GPS...' : 'Ativar GPS' }}
          </button>
        </div>
      </div>

      <!-- Barra de Busca de Endereços -->
      <div class="address-search-wrapper">
        <form class="address-search-box glass-panel" @submit.prevent="handleSearchSubmit" role="search">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" class="search-icon" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
      
          <input v-model="searchQuery" type="search" class="address-search-input"
            placeholder="Buscar endereço, rua, bairro ou cidade..." aria-label="Buscar endereço no mapa" autocomplete="off"
            @input="handleSearchInput" @focus="handleSearchFocus" @keydown.down.prevent="moveHighlight(1)"
            @keydown.up.prevent="moveHighlight(-1)" @keydown.esc="closeSuggestions" />
      
          <span v-if="isSearchingAddress" class="search-spinner" aria-label="Buscando endereço"></span>
      
          <button v-if="searchQuery" type="button" class="btn-clear-search" @click="clearSearch" title="Limpar busca"
            aria-label="Limpar busca">
            ✕
          </button>
      
          <button type="submit" class="btn-submit-search" :disabled="isSearchingAddress || searchQuery.trim().length < 2"
            title="Buscar endereço">
            Buscar
          </button>
        </form>
      
        <!-- Lista de Sugestões de Endereço -->
        <Transition name="fade-slide">
          <ul v-if="showSuggestions && (searchResults.length > 0 || searchNoResults)" class="address-suggestions-list"
            role="listbox">
            <li v-if="searchNoResults && searchResults.length === 0" class="suggestion-empty">
              Nenhum endereço encontrado para "{{ searchQuery }}"
            </li>
            <li v-for="(item, index) in searchResults" :key="`${item.latitude}_${item.longitude}_${index}`"
              class="suggestion-item" :class="{ 'is-highlighted': index === highlightedIndex }" role="option"
              :aria-selected="index === highlightedIndex" @mousedown.prevent="selectSearchResult(item)"
              @mouseenter="highlightedIndex = index">
              <span class="suggestion-pin" aria-hidden="true">📍</span>
              <div class="suggestion-texts">
                <span class="suggestion-label">{{ item.label }}</span>
                <span v-if="item.sublabel" class="suggestion-sublabel">{{ item.sublabel }}</span>
              </div>
            </li>
          </ul>
        </Transition>
      </div>
      </div>

    <!-- Alerta sucinto flutuante quando o usuário move o mapa para outra região -->
    <Transition name="fade-slide">
      <button
        v-if="hasMovedRegion && !isLoadingSheet"
        type="button"
        class="btn-floating-refresh"
        :inert="isAnyModalOpen || undefined"
        :aria-hidden="isAnyModalOpen ? 'true' : undefined"
        @click="handleRegionButtonClick"
        title="Você mudou a localização do mapa. Clique para carregar ocorrências desta região."
      >
        <span>🔄</span>
        <span>Atualizar região</span>
      </button>
    </Transition>

    <!-- Botões Flutuantes: Incluir Ocorrência + Dúvidas? -->
    <div
      class="bottom-action-container"
      :inert="isAnyModalOpen || undefined"
      :aria-hidden="isAnyModalOpen ? 'true' : undefined"
    >
      <button type="button" class="btn btn-primary btn-floating-report" @click="isCreateModalOpen = true">
        <span class="btn-report-icon" aria-hidden="true">+</span>
        <span>Incluir</span>
      </button>

      <div class="help-menu-wrapper" ref="helpMenuRef">
        <Transition name="help-menu-pop">
          <div v-if="isHelpMenuOpen" class="help-upward-menu" role="menu" aria-label="Opções de ajuda">
            <NuxtLink to="/multei/sobre" class="help-menu-item" role="menuitem" @click="isHelpMenuOpen = false">
              <span class="help-menu-icon" aria-hidden="true">📊</span>
              <span>Sobre o Multei</span>
            </NuxtLink>
            <NuxtLink to="/multei/orientacoes" class="help-menu-item" role="menuitem" @click="isHelpMenuOpen = false">
              <span class="help-menu-icon" aria-hidden="true">ℹ️</span>
              <span>Orientações de Uso</span>
            </NuxtLink>
            <button type="button" class="help-menu-item" role="menuitem" @click="openWhatToReportModal">
              <span class="help-menu-icon" aria-hidden="true">📋</span>
              <span>O que denunciar?</span>
            </button>
          </div>
</Transition>

<button type="button" class="btn-floating-help" :class="{ 'is-open': isHelpMenuOpen }" :aria-expanded="isHelpMenuOpen"
  aria-haspopup="true" title="Ver opções de ajuda e orientações sobre o Multei" @click="toggleHelpMenu">
  <span>Dúvidas?</span>
</button>
</div>
    </div>

    <!-- Mapa em Tela Cheia -->
    <div
      class="fullscreen-map-container"
      :inert="isAnyModalOpen || undefined"
      :aria-hidden="isAnyModalOpen ? 'true' : undefined"
    >
      <MulteiMapDisplay
        :incidents="filteredIncidents"
        :initial-center="initialCenter"
        :initial-zoom="15"
        :show-user-location-dot="locationState === 'granted'"
        height="100vh"
        @marker-click="handleMarkerClick"
        @bounds-change="handleBoundsChange"
        @user-location-found="handleUserLocationFound"
      />
    </div>

    <!-- Modal Tela Cheia: O que posso denunciar? -->
    <Transition name="fade-modal">
      <div
        v-if="isWhatToReportModalOpen"
        ref="whatToReportModalRef"
        class="what-to-report-fullscreen-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="what-to-report-title"
      >
        <div class="what-to-report-content">
          <div class="what-to-report-topbar">
            <span class="what-to-report-badge">Guia de Infrações</span>
            <button type="button" class="what-to-report-close-btn" aria-label="Fechar janela"
              @click="isWhatToReportModalOpen = false">
              ✕ Fechar
            </button>
          </div>
    
          <header class="what-to-report-header">
            <h2 id="what-to-report-title" class="what-to-report-title">O que posso denunciar?</h2>
            <p class="what-to-report-intro">
              Você pode usar este aplicativo para reportar veículos que desrespeitam o espaço e bloqueiam a mobilidade de
              pessoas com deficiência. Veja o que é infração:
            </p>
          </header>
    
          <div class="what-to-report-accordion">
            <details class="report-summary-card" open>
              <summary class="report-summary-trigger">
                <span class="report-summary-number">1</span>
                <span class="report-summary-heading">1. Vaga exclusiva sem credencial</span>
                <span class="report-summary-chevron" aria-hidden="true">▾</span>
              </summary>
              <div class="report-summary-body">
                <p><strong>O que é:</strong> Veículos estacionados nas vagas reservadas sem exibir a credencial oficial no
                  painel.</p>
                <p><strong>Por que atrapalha:</strong> Tira o direito de quem realmente precisa de um espaço mais largo e
                  próximo aos acessos.</p>
                <p class="report-legal-base"><strong>Base legal:</strong> Art. 181, inciso XX do Código de Trânsito
                  Brasileiro (CTB)</p>
              </div>
            </details>
    
            <details class="report-summary-card">
              <summary class="report-summary-trigger">
                <span class="report-summary-number">2</span>
                <span class="report-summary-heading">2. Bloqueio de calçadas e faixas de pedestres</span>
                <span class="report-summary-chevron" aria-hidden="true">▾</span>
              </summary>
              <div class="report-summary-body">
                <p><strong>O que é:</strong> Carros ou motos parados sobre o passeio público ou em cima das faixas de
                  travessia.</p>
                <p><strong>Por que atrapalha:</strong> Interrompe a rota acessível e obriga pessoas que utilizam caideira de
                  rodas, pessoas cegas ou com mobilidade reduzida a desviarem pelo asfalto, correndo risco de atropelamento.
                </p>
                <p class="report-legal-base"><strong>Base legal:</strong> Art. 181, inciso VIII do CTB</p>
              </div>
            </details>
    
            <details class="report-summary-card">
              <summary class="report-summary-trigger">
                <span class="report-summary-number">3</span>
                <span class="report-summary-heading">3. Obstrução de rampas e esquinas</span>
                <span class="report-summary-chevron" aria-hidden="true">▾</span>
              </summary>
              <div class="report-summary-body">
                <p><strong>O que é:</strong> Veículos estacionados a menos de 5 metros do alinhamento da via (nas esquinas),
                  onde ficam as rampas de acessibilidade.</p>
                <p><strong>Por que atrapalha:</strong> Impede a transição segura entre a calçada e a rua.</p>
                <p class="report-legal-base"><strong>Base legal:</strong> Art. 181, inciso I do CTB</p>
              </div>
            </details>
    
            <details class="report-summary-card">
              <summary class="report-summary-trigger">
                <span class="report-summary-number">4</span>
                <span class="report-summary-heading">4. Invasão de ilhas e refúgios</span>
                <span class="report-summary-chevron" aria-hidden="true">▾</span>
              </summary>
              <div class="report-summary-body">
                <p><strong>O que é:</strong> Veículos parados nas áreas de segurança estruturadas no meio de avenidas e vias
                  largas.</p>
                <p><strong>Por que atrapalha:</strong> Elimina a área de descanso e proteção essencial para quem se locomove
                  mais devagar e precisa fazer a travessia em duas etapas.</p>
                <p class="report-legal-base"><strong>Base legal:</strong> Art. 181, inciso VIII do CTB</p>
              </div>
            </details>
<details class="report-summary-card">
  <summary class="report-summary-trigger">
    <span class="report-summary-number" aria-hidden="true">5</span>
    <span class="report-summary-heading">Multa em supermercado e shopping tem validade?</span>
    <span class="report-summary-chevron" aria-hidden="true">▾</span>
  </summary>
  <div class="report-summary-body">
    <p><strong>Sim, tem total validade.</strong> Desde 2015, o Código de Trânsito Brasileiro (CTB) estabelece que
      estacionamentos de uso coletivo — como supermercados, shoppings, hospitais e faculdades — são considerados
      vias públicas para fins de fiscalização.</p>
    <p><strong>Como funciona a regra:</strong></p>
    <p class="report-legal-base"><strong>A infração principal:</strong> Estacionar nas vagas reservadas para
      pessoas com deficiência ou idosos sem a credencial (Art. 181, XX). A multa é gravíssima e o veículo pode ser
      guinchado.</p>
  </div>
</details>
          </div>
    
          <div class="what-to-report-footer">
            <button type="button" class="btn btn-primary what-to-report-cta" @click="isWhatToReportModalOpen = false">
              Entendi, voltar ao mapa
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modal para Inclusão de Nova Ocorrência com IA Gemini -->
    <MulteiCreateIncidentModal
      v-if="isCreateModalOpen"
      :current-location="currentMapCenter || initialCenter"
      :apps-script-url="appsScriptUrl"
      :is-gps-enabled="locationState === 'granted'"
      @close="isCreateModalOpen = false"
      @incident-created="handleIncidentCreated"
      @gps-enabled="handleUserLocationFound"
    />

    <!-- Modal de Detalhes da Ocorrência Clicada -->
    <MulteiIncidentModal
      v-if="selectedIncident"
      :incident="selectedIncident"
      :apps-script-url="appsScriptUrl"
      @close="selectedIncident = null"
      @incident-reported="handleIncidentReported"
    />
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { fetchIncidentsByVisibleArea } from '~/services/firebaseService';
  import { requestUserLocation, searchAddresses } from '~/services/geoService';
  import { useModalAccessibility } from '~/composables/useModalAccessibility';

definePageMeta({
  layout: false
});

useHead({
  title: 'Multei - Denúncia anônima de uso irregular de vagas para PcD',
  meta: [
    { name: 'description', content: 'Mapeamento colaborativo de vagas e infrações contra acessibilidade com proteção de privacidade por IA.' }
  ],
  // Preconnect apenas nesta página (é a única com mapa). Abre a conexão TLS
  // enquanto o bundle ainda está sendo avaliado, reduzindo o atraso até o
  // primeiro tile do mapa — que é justamente o elemento de LCP aqui.
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon-multei.svg' },
    { rel: 'shortcut icon', href: '/favicon-multei.svg' },
    { rel: 'preconnect', href: 'https://maps.googleapis.com', crossorigin: '' },
    { rel: 'preconnect', href: 'https://maps.gstatic.com', crossorigin: '' }
  ]
});

const config = useRuntimeConfig();
const appsScriptUrl = ref(config.public.appsScriptUrl || '');

const isCreateModalOpen = ref(false);
const selectedIncident = ref(null);
const isLoadingSheet = ref(false);
const locationState = ref('idle');
const filterScope = ref('nearby'); // 'nearby' ou 'all'

  // Menu flutuante "Dúvidas?" e modal "O que denunciar?"
  const helpMenuRef = ref(null);
  const isHelpMenuOpen = ref(false);
  const isWhatToReportModalOpen = ref(false);
  const whatToReportModalRef = ref(null);

  const isAnyModalOpen = computed(() =>
    Boolean(isCreateModalOpen.value || selectedIncident.value || isWhatToReportModalOpen.value)
  );

  useModalAccessibility({
    modalRef: whatToReportModalRef,
    isOpen: isWhatToReportModalOpen,
    onRequestClose: () => {
      isWhatToReportModalOpen.value = false;
      return 'closed';
    }
  });

  const toggleHelpMenu = () => {
    isHelpMenuOpen.value = !isHelpMenuOpen.value;
  };

  const openWhatToReportModal = () => {
    isHelpMenuOpen.value = false;
    isWhatToReportModalOpen.value = true;
  };

  // Estado da Barra de Busca de Endereços
  const searchContainerRef = ref(null);
  const searchQuery = ref('');
  const searchResults = ref([]);
  const isSearchingAddress = ref(false);
  const showSuggestions = ref(false);
  const searchNoResults = ref(false);
  const highlightedIndex = ref(-1);
  let searchDebounceTimer = null;
  let boundsFetchDebounceTimer = null;

const initialCenter = ref({
  latitude: -23.55052,
  longitude: -46.633308
});

const loadedCenter = ref({
  latitude: -23.55052,
  longitude: -46.633308
});

const currentMapCenter = ref({
  latitude: -23.55052,
  longitude: -46.633308
});

const incidents = ref([]);
const mapBounds = ref(null);
const lastQueriedBounds = ref(null);

  const runAddressSearch = async (queryText) => {
    const clean = (queryText || '').trim();
    if (clean.length < 2) {
      searchResults.value = [];
      searchNoResults.value = false;
      isSearchingAddress.value = false;
      return [];
    }

    isSearchingAddress.value = true;
    searchNoResults.value = false;
    try {
      const results = await searchAddresses(clean);
      searchResults.value = results;
      searchNoResults.value = results.length === 0;
      highlightedIndex.value = results.length > 0 ? 0 : -1;
      showSuggestions.value = true;
      return results;
    } catch (err) {
      console.warn('[multei] Erro ao buscar endereço:', err);
      searchResults.value = [];
      searchNoResults.value = true;
      return [];
    } finally {
      isSearchingAddress.value = false;
    }
  };

  const handleSearchInput = () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    const clean = searchQuery.value.trim();
    if (clean.length < 2) {
      searchResults.value = [];
      searchNoResults.value = false;
      showSuggestions.value = false;
      isSearchingAddress.value = false;
      return;
    }
    searchDebounceTimer = setTimeout(() => {
      runAddressSearch(clean);
    }, 320);
  };

  const handleSearchFocus = () => {
    if (searchResults.value.length > 0 || searchNoResults.value) {
      showSuggestions.value = true;
    }
  };

  const closeSuggestions = () => {
    showSuggestions.value = false;
    highlightedIndex.value = -1;
  };

  const clearSearch = () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchQuery.value = '';
    searchResults.value = [];
    searchNoResults.value = false;
    showSuggestions.value = false;
    highlightedIndex.value = -1;
  };

  const moveHighlight = (delta) => {
    if (!showSuggestions.value || searchResults.value.length === 0) return;
    const total = searchResults.value.length;
    highlightedIndex.value = (highlightedIndex.value + delta + total) % total;
  };

  const selectSearchResult = (item) => {
    if (!item) return;
    searchQuery.value = item.formattedAddress || item.label;
    showSuggestions.value = false;
    searchNoResults.value = false;

    const targetCoords = {
      latitude: item.latitude,
      longitude: item.longitude,
      zoom: 16,
      isSearchResult: true
    };
    initialCenter.value = targetCoords;
    currentMapCenter.value = {
      latitude: item.latitude,
      longitude: item.longitude
    };
    loadIncidents('nearby', {
      latitude: item.latitude,
      longitude: item.longitude
    });
  };

  const handleSearchSubmit = async () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (showSuggestions.value && highlightedIndex.value >= 0 && searchResults.value[highlightedIndex.value]) {
      selectSearchResult(searchResults.value[highlightedIndex.value]);
      return;
    }
    const results = await runAddressSearch(searchQuery.value);
    if (results.length > 0) {
      selectSearchResult(results[0]);
    }
  };

  const handleDocumentClick = (e) => {
    if (searchContainerRef.value && !searchContainerRef.value.contains(e.target)) {
      closeSuggestions();
    }
    if (helpMenuRef.value && !helpMenuRef.value.contains(e.target)) {
      isHelpMenuOpen.value = false;
    }
  };

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const hasMovedRegion = computed(() => {
  if (filterScope.value !== 'nearby') return false;
  if (!currentMapCenter.value || !loadedCenter.value) return false;
  const dist = getDistanceKm(
    currentMapCenter.value.latitude,
    currentMapCenter.value.longitude,
    loadedCenter.value.latitude,
    loadedCenter.value.longitude
  );
  return dist > 5;
});

const handleBoundsChange = (bounds) => {
  mapBounds.value = bounds;
  if (bounds?.center) {
    currentMapCenter.value = bounds.center;
  }
  // A consulta ao Firebase carrega um raio de 5 km ao redor do loadedCenter.
  // Movimentações dentro desse raio usam os pinos já em memória; ao passar de 5 km,
  // o botão "Atualizar região" aparece para buscar sob demanda e economizar leituras.
};

const selectedIncidentType = ref('all'); // 'all' | 'urbana' | 'transito'

const filteredIncidents = computed(() => {
  if (selectedIncidentType.value === 'all') {
    return incidents.value;
  }
  return incidents.value.filter((inc) => {
    const isUrbana = String(inc?.natureza || '').trim().toLowerCase() === 'urbana';
    if (selectedIncidentType.value === 'urbana') return isUrbana;
    if (selectedIncidentType.value === 'transito') return !isUrbana;
    return true;
  });
});

const visibleIncidentsCount = computed(() => {
  const sourceList = filteredIncidents.value;
  if (!mapBounds.value) {
    return sourceList.length;
  }
  const { north, south, east, west } = mapBounds.value;
  return sourceList.filter((inc) => {
    const lat = Number(inc.latitude);
    const lng = Number(inc.longitude);
    if (isNaN(lat) || isNaN(lng)) return false;
    const inLat = lat >= south && lat <= north;
    const inLng = west <= east
      ? (lng >= west && lng <= east)
      : (lng >= west || lng <= east);
    return inLat && inLng;
  }).length;
});

const handleMarkerClick = (incident) => {
  selectedIncident.value = incident;
};

const handleIncidentCreated = (newIncident) => {
  incidents.value = [
    newIncident,
    ...incidents.value.filter((inc) => inc.id !== newIncident.id)
  ];
  initialCenter.value = {
    latitude: newIncident.latitude,
    longitude: newIncident.longitude
  };
};

const handleIncidentReported = (reportedData) => {
  const targetId = typeof reportedData === 'object' && reportedData?.id
    ? String(reportedData.id).trim()
    : (typeof reportedData === 'string' ? reportedData.trim() : (selectedIncident.value?.id ? String(selectedIncident.value.id).trim() : ''));

  const targetObj = (typeof reportedData === 'object' && reportedData) ? reportedData : selectedIncident.value;

  incidents.value = incidents.value.filter((inc) => {
    // 1. Se ambos possuem ID, compara exclusivamente pelo ID para manter outras ocorrências no mesmo endereço
    if (targetId && inc?.id) {
      return String(inc.id).trim() !== targetId;
    }
    // 2. Fallback por referência direta de objeto caso algum item em memória não tenha ID
    if (targetObj && inc === targetObj) {
      return false;
    }
    return true;
  });
};

let latestLoadRequestId = 0;

const loadIncidents = async (scope = filterScope.value, customCenter = null, customBounds = null) => {
  const requestId = ++latestLoadRequestId;
  isLoadingSheet.value = true;
  filterScope.value = scope;

  const targetBounds = customBounds || mapBounds.value;
  const targetCenter = customCenter || targetBounds?.center || currentMapCenter.value || initialCenter.value;

  if (targetCenter) {
    loadedCenter.value = {
      latitude: targetCenter.latitude,
      longitude: targetCenter.longitude
    };
  }

  if (targetBounds) {
    lastQueriedBounds.value = {
      north: targetBounds.north,
      south: targetBounds.south,
      east: targetBounds.east,
      west: targetBounds.west
    };
  }

  try {
    // Se customCenter foi passado explicitamente (ex: busca de endereço ou GPS inicial)
    // antes do mapa reposicionar os bounds, verifica se o targetCenter está dentro dos bounds atuais
    const centerInsideBounds =
      targetBounds &&
      targetCenter &&
      targetCenter.latitude >= targetBounds.south &&
      targetCenter.latitude <= targetBounds.north &&
      targetCenter.longitude >= targetBounds.west &&
      targetCenter.longitude <= targetBounds.east;

    const firebaseIncidents = await fetchIncidentsByVisibleArea({
      bounds: centerInsideBounds ? targetBounds : null,
      center: targetCenter,
      radiusKm: 5
    });

    if (requestId !== latestLoadRequestId) return;
    incidents.value = firebaseIncidents;
  } catch (e) {
    if (requestId !== latestLoadRequestId) return;
    console.warn('Não foi possível sincronizar com o Firebase no momento:', e);
  } finally {
    if (requestId === latestLoadRequestId) {
      isLoadingSheet.value = false;
    }
  }
};

const handleRegionButtonClick = () => {
  loadIncidents('nearby', currentMapCenter.value || initialCenter.value, mapBounds.value);
};

const setFilterScope = (scope) => {
  if (filterScope.value === scope) return;
  loadIncidents(scope);
};

const handleUserLocationFound = (coords) => {
  initialCenter.value = coords;
  currentMapCenter.value = coords;
  locationState.value = 'granted';
  const distFromLoaded = loadedCenter.value
    ? getDistanceKm(
        coords.latitude,
        coords.longitude,
        loadedCenter.value.latitude,
        loadedCenter.value.longitude
      )
    : Infinity;
  if (incidents.value.length === 0 || distFromLoaded > 5) {
    loadIncidents('nearby', coords);
  }
};

const requestLocation = async () => {
  locationState.value = 'requesting';
  try {
    const coords = await requestUserLocation();
    initialCenter.value = coords;
    currentMapCenter.value = coords;
    locationState.value = 'granted';
    await loadIncidents('nearby', coords);
  } catch (err) {
    console.warn('[multei] Permissão de geolocalização recusada ou indisponível:', err);
    locationState.value = 'denied';
    await loadIncidents('nearby', currentMapCenter.value || initialCenter.value, mapBounds.value);
  }
};

const handleGpsActivateClick = async () => {
  if (locationState.value === 'granted' || locationState.value === 'requesting') {
    return;
  }
  await requestLocation();
};

let geoPermissionStatus = null;
const handleGeoPermissionChange = () => {
  if (!geoPermissionStatus) return;
  if (geoPermissionStatus.state === 'denied') {
    locationState.value = 'denied';
  } else if (geoPermissionStatus.state === 'prompt') {
    locationState.value = 'idle';
  } else if (geoPermissionStatus.state === 'granted') {
    requestLocation();
  }
};

onMounted(async () => {
  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', handleDocumentClick);
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('multei_gps_disabled');
    } catch {}
  }
  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      geoPermissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      geoPermissionStatus.addEventListener('change', handleGeoPermissionChange);
    } catch {}
  }
  await requestLocation();
});

  onBeforeUnmount(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (boundsFetchDebounceTimer) clearTimeout(boundsFetchDebounceTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('mousedown', handleDocumentClick);
    }
    if (geoPermissionStatus) {
      try {
        geoPermissionStatus.removeEventListener('change', handleGeoPermissionChange);
      } catch {}
      geoPermissionStatus = null;
    }
  });
</script>

<style scoped>
.seo-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
  z-index: 0;
}

.multei-fullscreen-page {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  margin: 0;
  padding: 0;
  background: #0f172a;
  z-index: 1;
}

.fullscreen-map-container {
  width: 100%;
  height: 100%;
}

.fullscreen-map-container :deep(.map-display-wrapper) {
  border-radius: 0;
  border: none;
  box-shadow: none;
  height: 100vh !important;
  min-height: 100vh !important;
}

.top-header-bar {
  position: absolute;
  top: 14px;
  left: 16px;
  right: 16px;
  z-index: 35;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  pointer-events: none;
}

.top-left-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  pointer-events: auto;
}

.address-search-wrapper {
  position: relative;
  flex: 1;
  min-width: 260px;
  max-width: 480px;
  pointer-events: auto;
}

.address-search-box {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0.45rem;
  padding: 0.32rem 0.4rem 0.32rem 0.85rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  border: 1.5px solid rgba(134, 0, 125, 0.18);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.address-search-box:focus-within {
  border-color: var(--primary, #86007D);
  box-shadow: 0 6px 20px rgba(134, 0, 125, 0.26);
}

.search-icon {
  width: 17px;
  height: 17px;
  color: var(--primary, #86007D);
  flex-shrink: 0;
}

.address-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.88rem;
  color: #1e293b;
  font-weight: 500;
}

.address-search-input::placeholder {
  color: #64748b;
  font-weight: 400;
}

.address-search-input::-webkit-search-cancel-button {
  display: none;
}

.search-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(134, 0, 125, 0.2);
  border-top-color: var(--primary, #86007D);
  border-radius: 50%;
  animation: spinSearch 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spinSearch {
  to {
    transform: rotate(360deg);
  }
}

.btn-clear-search {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.btn-clear-search:hover {
  background: rgba(0, 0, 0, 0.12);
  color: #1e293b;
}

.btn-submit-search {
  background: var(--primary, #86007D);
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  padding: 0.36rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.btn-submit-search:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-submit-search:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.address-suggestions-list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(16px);
  border-radius: 16px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.24);
  border: 1px solid rgba(134, 0, 125, 0.15);
  max-height: 290px;
  overflow-y: auto;
  z-index: 50;
}

.suggestion-empty {
  padding: 0.75rem 0.9rem;
  font-size: 0.84rem;
  color: #64748b;
  text-align: center;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border-radius: 11px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.suggestion-item:hover,
.suggestion-item.is-highlighted {
  background: rgba(134, 0, 125, 0.09);
}

.suggestion-pin {
  font-size: 0.95rem;
  line-height: 1.3;
  flex-shrink: 0;
}

.suggestion-texts {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.suggestion-label {
  font-size: 0.86rem;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-sublabel {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-back-home {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: #ffffff;
  color: #1e293b;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0.55rem 1.05rem;
  border-radius: 9999px;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-back-home:hover {
  background: #f8fafc;
  color: var(--primary, #86007D);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
}

.back-icon {
  width: 17px;
  height: 17px;
  stroke: currentColor;
}

.incident-type-filter-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.incident-type-select {
  appearance: none;
  -webkit-appearance: none;
  background-color: #ffffff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%230f172a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 14px;
  color: #0f172a;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.55rem 2.1rem 0.55rem 0.95rem;
  border-radius: 9999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.incident-type-select:hover {
  background-color: #f8fafc;
  border-color: var(--primary, #86007D);
  color: var(--primary, #86007D);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
}

.incident-type-select:focus-visible {
  outline: 2px solid var(--primary, #86007D);
  outline-offset: 2px;
}

.glass-panel {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(14px);
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.7);
  flex-wrap: wrap;
}

.badge-brand {
  background: linear-gradient(135deg, var(--primary, #86007D), #bf4848);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.scope-toggle {
  display: inline-flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 9999px;
  padding: 2px;
  gap: 2px;
}

.scope-btn {
  background: transparent;
  border: none;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  color: var(--text-muted, #475466);
  cursor: pointer;
  transition: all 0.2s ease;
}

.scope-btn:hover {
  color: var(--text, #1e293b);
}

.scope-btn.is-active {
  background: #ffffff;
  color: var(--primary, #86007D);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.scope-btn.is-refresh-alert {
  background: linear-gradient(135deg, var(--primary, #86007D), #d97706);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(134, 0, 125, 0.35);
  animation: pulseRefresh 1.8s infinite ease-in-out;
}

.scope-btn.is-refresh-alert:hover {
  color: #ffffff;
  filter: brightness(1.08);
}

@keyframes pulseRefresh {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(134, 0, 125, 0.35);
  }
  50% {
    box-shadow: 0 2px 14px rgba(217, 119, 6, 0.55);
  }
}

.badge-status {
  font-size: 0.76rem;
  color: var(--text-muted, #475466);
  background: rgba(0, 0, 0, 0.05);
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  font-weight: 500;
}

.badge-status.is-active {
  color: #166534;
  background: #dcfce7;
}

.badge-status.is-gps {
  color: #0369a1;
  background: #e0f2fe;
}

.is-clickable-gps {
  border: 1px solid rgba(3, 105, 161, 0.25);
  cursor: pointer;
  transition: all 0.2s;
}

.is-clickable-gps:hover {
  background: #0369a1;
  color: #ffffff;
}

.badge-status.is-gps-off {
  color: #334155;
  background: #f1f5f9;
  border: 1px solid #94a3b8;
  font-weight: 700;
}

.badge-status.is-gps-off:hover {
  background: var(--primary, #86007D);
  color: #ffffff;
  border-color: var(--primary, #86007D);
}

.btn-floating-refresh {
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: #ffffff;
  color: var(--primary, #86007D);
  border: 1.5px solid var(--primary, #86007D);
  padding: 0.5rem 1.15rem;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.85rem;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-floating-refresh:hover {
  background: var(--primary, #86007D);
  color: #ffffff;
  transform: translateX(-50%) translateY(-1px);
  box-shadow: 0 8px 22px rgba(134, 0, 125, 0.35);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.badge-location-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.76rem;
  background: rgba(134, 0, 125, 0.1);
  color: var(--primary, #86007D);
  border: 1px solid rgba(134, 0, 125, 0.25);
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.badge-location-btn:hover {
  background: var(--primary, #86007D);
  color: #fff;
}

.bottom-action-container {
  position: absolute;
  bottom: 24px;
  left: 20px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-floating-report {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.5rem;
  font-weight: 700;
  font-size: 0.98rem;
  border-radius: 9999px;
  box-shadow: 0 10px 25px rgba(134, 0, 125, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-floating-report:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(134, 0, 125, 0.5);
}

.btn-report-icon {
  font-size: 1.15rem;
}

.help-menu-wrapper {
  position: relative;
  display: inline-flex;
}

.btn-floating-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.85rem 1.35rem;
  font-weight: 700;
  font-size: 0.95rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.95);
  color: #1e293b;
  text-decoration: none;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
  border: 1.5px solid rgba(134, 0, 125, 0.25);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-floating-help:hover,
.btn-floating-help.is-open {
  background: #ffffff;
  color: var(--primary, #86007D);
  border-color: var(--primary, #86007D);
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.28);
}

.help-upward-menu {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  min-width: 210px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(14px);
  border-radius: 16px;
  padding: 0.4rem;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.24);
  border: 1px solid rgba(134, 0, 125, 0.18);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  z-index: 45;
}

.help-menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: #1e293b;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.help-menu-item:hover {
  background: rgba(134, 0, 125, 0.09);
  color: var(--primary, #86007D);
}

.help-menu-icon {
  font-size: 1.05rem;
  line-height: 1;
}

.help-menu-pop-enter-active,
.help-menu-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom left;
}

.help-menu-pop-enter-from,
.help-menu-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}

/* Modal Tela Cheia: O que posso denunciar? */
.what-to-report-fullscreen-modal {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  z-index: 100;
  background: #f8fafc;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.what-to-report-content {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
}

.what-to-report-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.what-to-report-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.85rem;
  border-radius: 9999px;
  background: rgba(134, 0, 125, 0.1);
  color: var(--primary, #86007D);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.what-to-report-close-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  border: 1.5px solid rgba(15, 23, 42, 0.12);
  background: #ffffff;
  color: #1e293b;
  font-weight: 700;
  font-size: 0.86rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.what-to-report-close-btn:hover {
  border-color: var(--primary, #86007D);
  color: var(--primary, #86007D);
  background: rgba(134, 0, 125, 0.05);
}

.what-to-report-header {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.what-to-report-title {
  font-size: clamp(1.55rem, 4vw, 2.1rem);
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  line-height: 1.2;
}

.what-to-report-intro {
  font-size: 1rem;
  line-height: 1.6;
  color: #475569;
  margin: 0;
}

.what-to-report-accordion {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.report-summary-card {
  background: #ffffff;
  border: 1.5px solid rgba(15, 23, 42, 0.09);
  border-radius: 16px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.report-summary-card[open] {
  border-color: rgba(134, 0, 125, 0.35);
  box-shadow: 0 8px 22px rgba(134, 0, 125, 0.1);
}

.report-summary-trigger {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem 1.15rem;
  cursor: pointer;
  user-select: none;
  font-weight: 700;
  color: #0f172a;
  transition: background 0.18s ease;
}

.report-summary-trigger::-webkit-details-marker {
  display: none;
}

.report-summary-trigger:hover {
  background: rgba(134, 0, 125, 0.04);
}

.report-summary-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(134, 0, 125, 0.12);
  color: var(--primary, #86007D);
  font-size: 0.88rem;
  font-weight: 800;
  flex-shrink: 0;
}

.report-summary-card[open] .report-summary-number {
  background: var(--primary, #86007D);
  color: #ffffff;
}

.report-summary-heading {
  flex: 1;
  font-size: 1rem;
  line-height: 1.35;
}

.report-summary-chevron {
  font-size: 1.1rem;
  color: #64748b;
  transition: transform 0.2s ease;
}

.report-summary-card[open] .report-summary-chevron {
  transform: rotate(180deg);
  color: var(--primary, #86007D);
}

.report-summary-body {
  padding: 0 1.15rem 1.15rem 3.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: #334155;
  font-size: 0.94rem;
  line-height: 1.55;
}

.report-summary-body p {
  margin: 0;
}

.report-legal-base {
  display: inline-block;
  margin-top: 0.2rem !important;
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 0.85rem;
  border-left: 3px solid var(--primary, #86007D);
}

.what-to-report-footer {
  margin-top: auto;
  padding-top: 0.75rem;
  display: flex;
  justify-content: center;
}

.what-to-report-cta {
  width: 100%;
  max-width: 360px;
  padding: 0.9rem 1.5rem;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.98rem;
  text-align: center;
  justify-content: center;
  cursor: pointer;
}

.fade-modal-enter-active,
.fade-modal-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-modal-enter-from,
.fade-modal-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 640px) {
  .top-header-bar {
    top: 10px;
    left: 8px;
    right: 8px;
    gap: 0.4rem;
  }
  .top-left-controls {
    width: 100%;
    flex-wrap: nowrap;
    justify-content: space-between;
    gap: 0.25rem;
  }
  .address-search-wrapper {
    width: 100%;
    max-width: 100%;
    flex: 1 1 100%;
  }
  .btn-back-home {
    padding: 0.36rem 0.52rem;
    font-size: 0.72rem;
    gap: 0.2rem;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .back-icon {
    width: 14px;
    height: 14px;
  }
  .incident-type-filter-wrapper {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 142px;
  }
  .incident-type-select {
    width: 100%;
    padding: 0.36rem 1.25rem 0.36rem 0.5rem;
    font-size: 0.72rem;
    background-position: right 0.38rem center;
    background-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .top-bar-pills.glass-panel {
    padding: 0.2rem 0.3rem;
    gap: 0.22rem;
    flex-wrap: nowrap;
    flex-shrink: 0;
  }
  .badge-status {
    font-size: 0.68rem;
    padding: 0.2rem 0.42rem;
    white-space: nowrap;
  }
  .btn-floating-refresh {
    top: 96px;
  }
  .bottom-action-container {
    bottom: 20px;
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: center;
    gap: 0.65rem;
  }
  .btn-floating-report,
  .help-menu-wrapper {
    flex: 1;
    max-width: 140px;
  }
  .btn-floating-report,
  .btn-floating-help {
    width: 100%;
    justify-content: center;
    padding: 0.8rem 1rem;
  }
  .help-upward-menu {
    left: auto;
    right: 0;
  }
  .report-summary-body {
    padding: 0 1rem 1rem 1rem;
  }
}
</style>
