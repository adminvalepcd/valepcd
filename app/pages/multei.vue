<template>
  <div class="multei-page container">
    <!-- Cabeçalho -->
    <div class="multei-header">
      <div class="header-top">
        <span class="badge">Multei</span>
        <span v-if="isLoadingSheet" class="badge-status">Sincronizando com a planilha...</span>
        <span v-else class="badge-status is-active">{{ incidents.length }} ocorrências no mapa</span>
        
        <button 
          v-if="locationState !== 'granted'" 
          type="button" 
          class="badge-location-btn" 
          @click="requestLocation"
          title="Clique para obter sua localização exata no mapa"
        >
          <span>📍</span>
          <span>{{ locationState === 'denied' ? 'Ativar Localização' : 'Obter Localização' }}</span>
        </button>
        <span v-else class="badge-status is-gps">📍 Localização Ativa</span>
      </div>
      <h1 class="title">
        Fiscalização Cidadã <span class="gradient-text">Vale PCD</span>
      </h1>
      <p class="lead text-muted">
        Mapeamento comunitário de infrações em vagas e rampas de acessibilidade.
      </p>
    </div>

    <!-- Seção do Mapa com Botão Sobreposto -->
    <div class="map-section-wrapper">
      <!-- Botão Flutuante Sobre o Mapa -->
      <div class="map-floating-actions">
        <button 
          type="button" 
          class="btn btn-primary btn-floating-report" 
          @click="isCreateModalOpen = true"
        >
          <span class="btn-icon">📷</span>
          <span>Incluir Ocorrência</span>
        </button>
      </div>

      <!-- Componente do Mapa Google Maps -->
      <MulteiMapDisplay
        :incidents="incidents"
        :initial-center="initialCenter"
        height="600px"
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

useHead({
  title: 'Multei | Fiscalização de Acessibilidade - Vale PCD',
  meta: [
    { name: 'description', content: 'Mapeamento colaborativo de vagas e infrações contra acessibilidade com proteção de privacidade por IA.' }
  ]
});

const config = useRuntimeConfig();
// URL do Google Apps Script configurável via env ou fallback
const appsScriptUrl = ref(
  (config.public.appsScriptUrl) || 
  (process.env.VITE_APPS_SCRIPT_URL) || 
  'https://script.google.com/macros/s/AKfycbxoVMfJV8aW57SNZncgRSa-I5grXCd0U8LBW2HlCurUs7xK0B65qgkyvi5ubwKXinr4/exec'
);

const isCreateModalOpen = ref(false);
const selectedIncident = ref(null);
const isLoadingSheet = ref(false);
const locationState = ref('idle');

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

const handleIncidentReported = (incidentId) => {
  incidents.value = incidents.value.filter(inc => inc.id !== incidentId);
  selectedIncident.value = null;
};

const requestLocation = async () => {
  locationState.value = 'requesting';
  try {
    const coords = await requestUserLocation();
    initialCenter.value = coords;
    locationState.value = 'granted';
  } catch (err) {
    console.warn('[multei] Permissão de geolocalização recusada ou indisponível:', err);
    locationState.value = 'denied';
  }
};

onMounted(async () => {
  // 1. Forçar a solicitação de geolocalização do navegador logo ao carregar a página
  requestLocation();

  // 2. Carregar ocorrências da planilha Google
  if (appsScriptUrl.value) {
    isLoadingSheet.value = true;
    try {
      const sheetIncidents = await fetchIncidentsFromSheet(appsScriptUrl.value);
      if (sheetIncidents.length > 0) {
        incidents.value = sheetIncidents;
      }
    } catch (e) {
      console.warn('Não foi possível sincronizar com a planilha no momento:', e);
    } finally {
      isLoadingSheet.value = false;
    }
  }
});
</script>

<style scoped>
.multei-page {
  padding-top: 2rem;
  padding-bottom: 5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.multei-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 800px;
}

.header-top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.badge-status {
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
  background: rgba(0, 0, 0, 0.05);
  padding: 0.2rem 0.6rem;
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
  gap: 0.35rem;
  font-size: 0.8rem;
  background: rgba(134, 0, 125, 0.1);
  color: var(--primary, #86007D);
  border: 1px solid rgba(134, 0, 125, 0.25);
  padding: 0.2rem 0.65rem;
  border-radius: 9999px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.badge-location-btn:hover {
  background: var(--primary, #86007D);
  color: #fff;
}

.title {
  font-size: clamp(1.8rem, 3.5vw, 2.8rem);
  font-weight: 800;
  line-height: 1.2;
}

.lead {
  font-size: 1.1rem;
  line-height: 1.6;
}

.map-section-wrapper {
  position: relative;
  width: 100%;
  border-radius: var(--radius-lg, 20px);
  overflow: hidden;
}

.map-floating-actions {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 25;
}

.btn-floating-report {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.4rem;
  font-weight: 700;
  font-size: 0.95rem;
  border-radius: 9999px;
  box-shadow: 0 10px 25px rgba(134, 0, 125, 0.35);
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(8px);
}

.btn-floating-report:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(134, 0, 125, 0.45);
}

.btn-icon {
  font-size: 1.15rem;
}
</style>
