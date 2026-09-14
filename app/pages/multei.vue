<template>
  <div class="multei-fullscreen-page">
    <!-- Título H1 para SEO (atrás do mapa, indexável pelos motores de busca) -->
    <h1 class="seo-title">Multei - Denúncia anônima de uso irregular de vagas para PcD</h1>

    <!-- Controles Flutuantes no Topo Esquerdo: Botão Voltar + Painel de Status/Filtros -->
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
  
      <div class="top-bar-pills glass-panel">
        <span class="badge-brand">Multei</span>
        <span v-if="isLoadingSheet" class="badge-status">Sincronizando...</span>
        <span v-else class="badge-status is-active">
          {{ incidents.length }} {{ filterScope === 'nearby' ? 'na região' : 'no mapa' }}
        </span>
        
        <div class="scope-toggle">
          <button 
            type="button" 
            class="scope-btn" 
            :class="{ 'is-active': filterScope === 'nearby' }" 
            @click="setFilterScope('nearby')"
            title="Ver ocorrências próximas ao seu GPS (raio de 30 km)"
          >
            📍 Região (30 km)
          </button>
          <button 
            type="button" 
            class="scope-btn" 
            :class="{ 'is-active': filterScope === 'all' }" 
            @click="setFilterScope('all')"
            title="Ver todas as ocorrências do Brasil (modo ultra-leve)"
          >
            🇧🇷 Brasil Todo
          </button>
        </div>

        <button 
          v-if="locationState !== 'granted'" 
          type="button" 
          class="badge-location-btn" 
          @click="requestLocation"
          title="Clique para obter sua localização exata no mapa"
        >
          <span>📍</span>
          <span>{{ locationState === 'denied' ? 'Ativar GPS' : 'Meu GPS' }}</span>
        </button>
        <span v-else class="badge-status is-gps">📍 GPS Ativo</span>
      </div>
    </div>

    <!-- Botão Flutuante de Incluir Ocorrência -->
    <div class="bottom-action-container">
      <button type="button" class="btn btn-primary btn-floating-report" @click="isCreateModalOpen = true">
        <span class="btn-report-icon" aria-hidden="true">+</span>
        <span>Incluir</span>
        </button>
        </div>

    <!-- Mapa em Tela Cheia -->
    <div class="fullscreen-map-container">
      <MulteiMapDisplay
        :incidents="incidents"
        :initial-center="initialCenter"
        :initial-zoom="15"
        height="100vh"
        @marker-click="handleMarkerClick"
      />
    </div>

    <!-- Modal para Inclusão de Nova Ocorrência com IA Gemini -->
    <MulteiCreateIncidentModal
      v-if="isCreateModalOpen"
      :current-location="initialCenter"
      :apps-script-url="appsScriptUrl"
      @close="isCreateModalOpen = false"
      @incident-created="handleIncidentCreated"
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
import { ref, onMounted } from 'vue';
import { fetchIncidentsFromSheet } from '~/services/sheetsService';
import { requestUserLocation } from '~/services/geoService';

      definePageMeta({
        layout: false
      });

useHead({
  title: 'Multei - Denúncia anônima de uso irregular de vagas para PcD',
  meta: [
    { name: 'description', content: 'Mapeamento colaborativo de vagas e infrações contra acessibilidade com proteção de privacidade por IA.' }
  ]
});

const config = useRuntimeConfig();
// URL do Google Apps Script configurável via env ou fallback
const appsScriptUrl = ref(
  (config.public.appsScriptUrl) || 
  (process.env.VITE_APPS_SCRIPT_URL) || 
  'https://script.google.com/macros/s/AKfycbxviY_Dn5xvGiFEicWg0T-1mrkGlEBuBCoharmgS_BHMkNC188KpXBpAxKH58_UkfGs/exec'
);

const isCreateModalOpen = ref(false);
const selectedIncident = ref(null);
const isLoadingSheet = ref(false);
const locationState = ref('idle');
const filterScope = ref('nearby'); // 'nearby' ou 'all'

const initialCenter = ref({
  latitude: -23.55052,
  longitude: -46.633308
});

const incidents = ref([]);

const handleMarkerClick = (incident) => {
  selectedIncident.value = incident;
};

const handleIncidentCreated = (newIncident) => {
  incidents.value.unshift(newIncident);
  initialCenter.value = {
    latitude: newIncident.latitude,
    longitude: newIncident.longitude
  };
};

const handleIncidentReported = (reportedData) => {
  const targetId = typeof reportedData === 'object' && reportedData?.id 
    ? String(reportedData.id) 
    : (reportedData ? String(reportedData) : (selectedIncident.value?.id ? String(selectedIncident.value.id) : ''));

  const targetObj = (typeof reportedData === 'object' && reportedData) ? reportedData : selectedIncident.value;

  incidents.value = incidents.value.filter(inc => {
    // 1. Comparação por ID
    if (targetId && inc.id && String(inc.id) === targetId) {
      return false;
    }
    // 2. Comparação por referência de objeto
    if (targetObj && inc === targetObj) {
      return false;
    }
    // 3. Comparação por coordenadas geográficas
    if (targetObj &&
        typeof inc.latitude === 'number' && typeof targetObj.latitude === 'number' &&
        typeof inc.longitude === 'number' && typeof targetObj.longitude === 'number' &&
        Math.abs(inc.latitude - targetObj.latitude) < 0.00005 &&
        Math.abs(inc.longitude - targetObj.longitude) < 0.00005) {
      return false;
    }
    return true;
  });
};

const loadIncidents = async (scope = filterScope.value) => {
  if (!appsScriptUrl.value) return;
  isLoadingSheet.value = true;
  filterScope.value = scope;

  try {
    const isNearby = scope === 'nearby' && locationState.value === 'granted';
    const options = isNearby ? {
      latitude: initialCenter.value.latitude,
      longitude: initialCenter.value.longitude,
      radiusKm: 30,
      includePhoto: true
    } : {
      includePhoto: false // Modo leve: carrega pontos sem baixar megabytes de base64
    };

    const sheetIncidents = await fetchIncidentsFromSheet(appsScriptUrl.value, options);
    incidents.value = sheetIncidents;
  } catch (e) {
    console.warn('Não foi possível sincronizar com a planilha no momento:', e);
  } finally {
    isLoadingSheet.value = false;
  }
};

const setFilterScope = (scope) => {
  if (filterScope.value === scope) return;
  loadIncidents(scope);
};

const requestLocation = async () => {
  locationState.value = 'requesting';
  try {
    const coords = await requestUserLocation();
    initialCenter.value = coords;
    locationState.value = 'granted';
    if (filterScope.value === 'nearby') {
      loadIncidents('nearby');
    }
  } catch (err) {
    console.warn('[multei] Permissão de geolocalização recusada ou indisponível:', err);
    locationState.value = 'denied';
    loadIncidents('all');
  }
};

onMounted(async () => {
  requestLocation();
  loadIncidents();
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

.top-left-controls {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  max-width: calc(100vw - 32px);
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
  color: var(--text-muted, #64748b);
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

.badge-status {
  font-size: 0.76rem;
  color: var(--text-muted, #64748b);
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

@media (max-width: 640px) {
  .top-left-controls {
    top: 12px;
    left: 12px;
    gap: 0.5rem;
  }
  .btn-back-home {
    padding: 0.45rem 0.8rem;
    font-size: 0.82rem;
  }
  .bottom-action-container {
    bottom: 20px;
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: center;
  }
  .btn-floating-report {
    width: 100%;
    max-width: 320px;
    justify-content: center;
  }
}
</style>
