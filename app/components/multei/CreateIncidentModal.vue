<template>
  <div class="modal-backdrop">
    <div class="modal-card">
      <!-- Cabeçalho -->
      <div class="modal-header">
        <h2 class="modal-title">Incluir Ocorrência</h2>
        <button class="btn-close" @click="emit('close')" aria-label="Fechar" :disabled="isAnalyzing || isSaving">✕</button>
      </div>

      <!-- Etapa 1: Captura / Upload da Foto -->
      <div v-if="step === 'upload'" class="step-upload">
        <p class="step-desc">
          Tire uma foto ou envie uma imagem da infração para análise automática por IA.
        </p>

        <div class="upload-actions">
          <button 
            type="button" 
            class="btn-upload btn-camera" 
            @click="showCamera = true"
          >
            <span class="btn-icon">📷</span>
            <span class="btn-label">Tirar Foto Agora</span>
          </button>

          <label class="btn-upload btn-gallery">
            <span class="btn-icon">🖼️</span>
            <span class="btn-label">Escolher da Galeria</span>
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/webp" 
              class="hidden-file-input" 
              @change="handleFileSelected" 
            />
          </label>
        </div>

        <p class="privacy-note">
          🔒 Suas fotos são analisadas por IA. Placas e rostos serão desfocados antes de qualquer gravação. Nenhum dado seu é armazenado
        </p>
      </div>

      <!-- Câmera ao vivo em tela cheia se acionada -->
      <MulteiCameraCapture
        v-if="showCamera"
        @photo-taken="handlePhotoTaken"
        @cancel="showCamera = false"
      />

      <!-- Etapa 2: Análise da Imagem (Gemini) -->
      <div v-if="step === 'analyzing'" class="step-analyzing">
        <LoadingSpinner />
        <p class="analyzing-text">{{ analyzingStatusText }}</p>
        <span class="analyzing-sub">Avaliando veículos, segurança e dados sensíveis...</span>
      </div>

      <!-- Erro de Validação ou Instabilidade de IA -->
      <div v-if="step === 'error'" class="step-error">
        <div class="error-badge">{{ isApiError ? '⚡' : '⚠️' }}</div>
        <h3 class="error-heading" :class="{ 'is-api-error': isApiError }">
          {{ isApiError ? 'Instabilidade no Serviço de IA' : 'Foto Não Aceita' }}
        </h3>
        <p class="error-explanation">{{ errorMessage }}</p>
        
        <div class="modal-actions mt-4">
          <button v-if="isApiError && lastSelectedFile" class="btn btn-primary" @click="handleRetry">
            🔄 Tentar Novamente
          </button>
          <button class="btn btn-secondary" @click="resetToUpload">
            {{ isApiError && lastSelectedFile ? 'Escolher Outra Foto' : 'Tentar Outra Foto' }}
          </button>
        </div>
      </div>

      <!-- Etapa 3: Preview Anonimizado e Ajuste de Localização -->
      <div v-if="step === 'preview'" class="step-preview">
        <div class="preview-container">
          <img :src="processedImageWebp" alt="Pré-visualização com desfoque de privacidade" class="preview-img" />
          <span class="badge-blur">Filtro privacidade aplicado</span>
        </div>

        <div class="location-box glass">
          <div class="location-header">
            <span class="loc-icon">📍</span>
            <div class="loc-text">
              <div class="loc-title-row">
                <strong>Localização da Infração:</strong>
                <span v-if="locationSource === 'exif'" class="source-badge is-exif" title="Coordenadas obtidas dos metadados da imagem">
                  📷 Da foto (EXIF)
                </span>
                <span v-else-if="locationSource === 'device'" class="source-badge is-gps" title="Coordenadas obtidas do GPS do navegador">
                  📡 GPS do dispositivo
                </span>
                <span v-else-if="locationSource === 'manual'" class="source-badge is-manual" title="Coordenadas ajustadas manualmente no mapa">
                  ✏️ Ajustado no mapa
                </span>
                <span v-else class="source-badge is-fallback" title="Posição aproximada/padrão">
                  ⚠️ Posição aproximada
                </span>
              </div>
              <p v-if="addressText" class="loc-address">
                <span v-if="isResolvingAddress" class="loc-loading">⏳ </span>
                {{ addressText }}
              </p>
              <p class="loc-coords">Lat: {{ selectedLocation.latitude.toFixed(5) }}, Lng: {{ selectedLocation.longitude.toFixed(5) }}</p>
            </div>
          </div>

          <div class="location-actions-bar">
            <button 
              type="button" 
              class="btn-loc-action btn-refresh-gps" 
              :disabled="isRefreshingGps"
              @click="handleRefreshGps"
              title="Obter coordenadas atuais do GPS deste aparelho"
            >
              <span v-if="isRefreshingGps">⏳ Obtendo GPS...</span>
              <span v-else>📍 Usar Meu GPS Atual</span>
            </button>

            <button 
              type="button" 
              class="btn-loc-action btn-adjust" 
              :class="{ 'is-active': isAdjustingLocation }"
              @click="toggleAdjustLocation"
            >
              {{ isAdjustingLocation ? '✓ Concluir Ajuste' : '🗺️ Ajustar no Mapa' }}
            </button>
          </div>

          <p v-if="gpsStatusMessage" class="gps-msg" :class="{ 'is-error': gpsStatusIsError }">
            {{ gpsStatusMessage }}
          </p>

          <!-- Mini mapa para ajuste fino se acionado -->
          <div v-if="isAdjustingLocation" class="mini-map-container">
            <p class="mini-map-hint">Arraste o mapa para posicionar o pino vermelho exatamente no local da vaga/infração.</p>
            <div class="mini-map-frame">
              <MulteiMapDisplay
                :initial-center="selectedLocation"
                :pin-location="selectedLocation"
                height="280px"
                @pin-location-change="handlePinChange"
              />
            </div>
          </div>
        </div>

        <div v-if="saveError" class="alert alert-error">
          {{ saveError }}
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="resetToUpload" :disabled="isSaving">
            Trocar Foto
          </button>
          <button class="btn btn-primary" @click="handleSaveIncident" :disabled="isSaving">
            <span v-if="isSaving">Processando</span>
            <span v-else>Salvar Ocorrência</span>
          </button>
        </div>
      </div>

      <!-- Etapa 4: Sucesso -->
      <div v-if="step === 'success'" class="step-success">
        <div class="success-icon">✅</div>
        <h3 class="success-title">Ocorrência Registrada!</h3>
        <p class="success-desc">
          A infração foi salva e já está visível no mapa.
        </p>
        <button class="btn btn-primary mt-4" @click="emit('close')">
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { initializeGeminiClient, analyzeIncidentImage } from '../../services/geminiService';
import { extractGpsData, blurSensitiveContentAndCompress, prepareImageForGemini } from '../../services/imageProcessor';
import { saveIncidentToSheet } from '../../services/sheetsService';
import { getAddressFromCoords, requestUserLocation } from '../../services/geoService';

const props = defineProps({
  currentLocation: {
    type: Object,
    required: true
  },
  appsScriptUrl: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'incidentCreated']);

const step = ref('upload');
const showCamera = ref(false);
const isAnalyzing = ref(false);
const isSaving = ref(false);
const analyzingStatusText = ref('Iniciando análise...');
const errorMessage = ref('');
const isApiError = ref(false);
const lastSelectedFile = ref(null);
const saveError = ref('');
const isAdjustingLocation = ref(false);
const addressText = ref('');
const isResolvingAddress = ref(false);
let geocodeDebounceTimer = null;

const locationSource = ref('fallback');
const isRefreshingGps = ref(false);
const gpsStatusMessage = ref('');
const gpsStatusIsError = ref(false);

const processedImageWebp = ref('');
const selectedLocation = reactive({
  latitude: props.currentLocation.latitude,
  longitude: props.currentLocation.longitude
});

const config = useRuntimeConfig();
const geminiApiKey = config.public.geminiApiKey;
const geminiClient = initializeGeminiClient(geminiApiKey);

const updateAddress = async (lat, lng) => {
  isResolvingAddress.value = true;
  try {
    const addr = await getAddressFromCoords(lat, lng);
    addressText.value = addr;
  } catch {
    addressText.value = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
  } finally {
    isResolvingAddress.value = false;
  }
};

const handleRefreshGps = async () => {
  isRefreshingGps.value = true;
  gpsStatusMessage.value = 'Consultando o GPS do dispositivo...';
  gpsStatusIsError.value = false;

  try {
    const coords = await requestUserLocation();
    selectedLocation.latitude = coords.latitude;
    selectedLocation.longitude = coords.longitude;
    locationSource.value = 'device';
    gpsStatusMessage.value = 'Localização atualizada com sucesso!';
    await updateAddress(coords.latitude, coords.longitude);
  } catch (err) {
    console.error('Erro ao atualizar GPS:', err);
    gpsStatusIsError.value = true;
    gpsStatusMessage.value = 'Não foi possível obter o GPS. Verifique se a localização está autorizada no navegador.';
  } finally {
    isRefreshingGps.value = false;
    setTimeout(() => {
      if (!gpsStatusIsError.value) {
        gpsStatusMessage.value = '';
      }
    }, 4000);
  }
};

onMounted(async () => {
  const isDefaultSP = Math.abs(props.currentLocation.latitude - (-23.55052)) < 0.0001 &&
                      Math.abs(props.currentLocation.longitude - (-46.633308)) < 0.0001;
  if (!isDefaultSP) {
    locationSource.value = 'device';
  } else {
    // Tenta silenciosamente obter localização real do navegador caso ainda esteja no fallback
    try {
      const coords = await requestUserLocation();
      selectedLocation.latitude = coords.latitude;
      selectedLocation.longitude = coords.longitude;
      locationSource.value = 'device';
    } catch {
      // Permissão ainda não concedida
    }
  }
});

watch(() => props.currentLocation, (newVal) => {
  if (!newVal) return;
  const isDefaultSP = Math.abs(newVal.latitude - (-23.55052)) < 0.0001 &&
                      Math.abs(newVal.longitude - (-46.633308)) < 0.0001;
  // Se ainda estiver no fallback e a prop agora tiver uma localização real válida:
  if (locationSource.value === 'fallback' && !isDefaultSP) {
    selectedLocation.latitude = newVal.latitude;
    selectedLocation.longitude = newVal.longitude;
    locationSource.value = 'device';
    if (step.value === 'preview') {
      updateAddress(newVal.latitude, newVal.longitude);
    }
  }
}, { deep: true });

const resetToUpload = () => {
  step.value = 'upload';
  isApiError.value = false;
  errorMessage.value = '';
  saveError.value = '';
  isAdjustingLocation.value = false;
  processedImageWebp.value = '';
  addressText.value = '';
  gpsStatusMessage.value = '';
  lastSelectedFile.value = null;
};

const handleRetry = async () => {
  if (lastSelectedFile.value) {
    await processSelectedImage(lastSelectedFile.value);
  } else {
    resetToUpload();
  }
};

const handleFileSelected = async (e) => {
  const target = e.target;
  const file = target.files?.[0];
  if (file) {
    lastSelectedFile.value = file;
    await processSelectedImage(file);
  }
  target.value = '';
};

const handlePhotoTaken = async (file) => {
  showCamera.value = false;
  if (file) {
    lastSelectedFile.value = file;
    await processSelectedImage(file);
  }
};

const processSelectedImage = async (file) => {
  step.value = 'analyzing';
  isAnalyzing.value = true;
  isApiError.value = false;
  errorMessage.value = '';
  analyzingStatusText.value = 'Identificando localização...';

  try {
    // 1. Tentar obter coordenadas GPS gravadas no EXIF da foto
    const exifLocation = await extractGpsData(file);
    if (exifLocation) {
      selectedLocation.latitude = exifLocation.latitude;
      selectedLocation.longitude = exifLocation.longitude;
      locationSource.value = 'exif';
    } else {
      // Foto sem metadados GPS (câmera HTML5 ou upload do WhatsApp/Galeria):
      // Tentar capturar o GPS do dispositivo ao vivo
      try {
        const liveGps = await requestUserLocation();
        selectedLocation.latitude = liveGps.latitude;
        selectedLocation.longitude = liveGps.longitude;
        locationSource.value = 'device';
      } catch (gpsErr) {
        console.warn('[CreateIncidentModal] GPS ao vivo indisponível, usando localização atual:', gpsErr);
        selectedLocation.latitude = props.currentLocation.latitude;
        selectedLocation.longitude = props.currentLocation.longitude;
        const isDefaultSP = Math.abs(props.currentLocation.latitude - (-23.55052)) < 0.0001 &&
                            Math.abs(props.currentLocation.longitude - (-46.633308)) < 0.0001;
        locationSource.value = isDefaultSP ? 'fallback' : 'device';
      }
    }

    // Iniciar busca pelo nome da rua imediatamente
    updateAddress(selectedLocation.latitude, selectedLocation.longitude);

    // 2. Redimensionar previamente a imagem para envio rápido e leve à IA (~250KB)
    analyzingStatusText.value = 'Otimizando e analisando veículo com IA...';
    const optimizedBase64 = await prepareImageForGemini(file, 1200);

    // 3. Chamar Gemini para análise de veículo, moderação e caixas delimitadoras
    const analysis = await analyzeIncidentImage(geminiClient, optimizedBase64);

    if (analysis.apiError) {
      isApiError.value = true;
      step.value = 'error';
      errorMessage.value = analysis.rejectionReason || 'Instabilidade temporária no serviço de IA (Google Gemini). Por favor, tente novamente.';
      return;
    }

    // Validação de presença de veículo e adequação de conteúdo:
    if (!analysis.hasVehicle || !analysis.isAppropriate) {
      isApiError.value = false;
      step.value = 'error';
      errorMessage.value = analysis.rejectionReason || 'A foto precisa conter um veículo automotor e cumprir as regras comunitárias.';
      return;
    }

    // 4. Se aprovado: queimar o blur de 12px no Canvas e comprimir em WebP de alta definição
    analyzingStatusText.value = 'Aplicando desfoque de 12px nas placas e rostos...';
    const finalWebp = await blurSensitiveContentAndCompress(
      optimizedBase64,
      analysis.plates,
      analysis.faces
    );

    processedImageWebp.value = finalWebp;
    step.value = 'preview';
  } catch (err) {
    console.error('Erro no processamento da imagem:', err);
    isApiError.value = true;
    step.value = 'error';
    errorMessage.value = err?.message || 'Falha ao processar e anonimizar a foto enviada.';
  } finally {
    isAnalyzing.value = false;
  }
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

const toggleAdjustLocation = () => {
  isAdjustingLocation.value = !isAdjustingLocation.value;
};

const handlePinChange = (newLoc) => {
  selectedLocation.latitude = newLoc.latitude;
  selectedLocation.longitude = newLoc.longitude;
  locationSource.value = 'manual';

  if (geocodeDebounceTimer) clearTimeout(geocodeDebounceTimer);
  geocodeDebounceTimer = setTimeout(() => {
    updateAddress(newLoc.latitude, newLoc.longitude);
  }, 400);
};

const handleSaveIncident = async () => {
  isSaving.value = true;
  saveError.value = '';

  const newIncident = {
    id: `inc-${Date.now()}`,
    timestamp: new Date().toISOString(),
    latitude: selectedLocation.latitude,
    longitude: selectedLocation.longitude,
    maskedImageUrl: processedImageWebp.value,
    description: addressText.value || 'Infração registrada via colaboração cidadã'
  };

  try {
    // Gravar na planilha através do serviço
    await saveIncidentToSheet(props.appsScriptUrl || '', {
      id: newIncident.id,
      data: String(newIncident.timestamp),
      latitude: newIncident.latitude,
      longitude: newIncident.longitude,
      foto: newIncident.maskedImageUrl
    });

    emit('incidentCreated', newIncident);
    step.value = 'success';
  } catch (err) {
    console.error('Erro ao salvar na planilha:', err);
    saveError.value = 'Não foi possível gravar na planilha Google. Tente novamente ou verifique a conexão.';
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 9999;
}

.modal-card {
  background: var(--surface, #ffffff);
  border-radius: var(--radius-lg, 24px);
  padding: 2rem;
  max-width: 560px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text, #0f172a);
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-muted, #64748b);
  border-radius: 8px;
  padding: 0.25rem 0.5rem;
}

.step-desc {
  font-size: 1.05rem;
  color: var(--text-muted, #475569);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.upload-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.btn-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.75rem 1rem;
  border-radius: var(--radius-md, 16px);
  border: 2px dashed var(--primary, #86007D);
  background: rgba(134, 0, 125, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text, #0f172a);
  text-align: center;
}

.btn-upload:hover {
  background: rgba(134, 0, 125, 0.08);
  border-color: var(--primary-hover, #a10096);
  transform: translateY(-2px);
}

.btn-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.btn-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.hidden-file-input {
  display: none;
}

.privacy-note {
  font-size: 0.85rem;
  color: var(--text-muted, #64748b);
  line-height: 1.5;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.step-analyzing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  gap: 1rem;
}

.analyzing-text {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text, #0f172a);
}

.analyzing-sub {
  font-size: 0.9rem;
  color: var(--text-muted, #64748b);
}

.step-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 1rem;
}

.error-badge {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.error-heading {
  font-size: 1.3rem;
  font-weight: 800;
  color: #dc2626;
  margin-bottom: 0.75rem;
}

.error-heading.is-api-error {
  color: #b45309;
}

.error-explanation {
  font-size: 1.05rem;
  color: var(--text, #334155);
  max-width: 420px;
  line-height: 1.6;
}

.preview-container {
  position: relative;
  width: 100%;
  border-radius: var(--radius-md, 16px);
  overflow: hidden;
  margin-bottom: 1.25rem;
  background: #000;
}

.preview-img {
  width: 100%;
  max-height: 280px;
  object-fit: contain;
  display: block;
}

.badge-blur {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  color: #ffffff;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.location-box {
  padding: 1.25rem;
  border-radius: 16px;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.location-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.loc-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.source-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  letter-spacing: 0.02em;
}

.source-badge.is-exif {
  background: #e0e7ff;
  color: #3730a3;
}

.source-badge.is-gps {
  background: #dcfce7;
  color: #166534;
}

.source-badge.is-manual {
  background: #fef3c7;
  color: #92400e;
}

.source-badge.is-fallback {
  background: #fee2e2;
  color: #991b1b;
}

.loc-icon {
  font-size: 1.5rem;
}

.loc-address {
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--text, #0f172a);
  margin-top: 0.2rem;
  margin-bottom: 0.2rem;
  line-height: 1.4;
}

.loc-loading {
  display: inline-block;
  font-size: 0.85rem;
}

.loc-coords {
  font-size: 0.85rem;
  color: var(--text-muted, #64748b);
}

.location-actions-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border, rgba(0,0,0,0.08));
}

.btn-loc-action {
  background: transparent;
  font-weight: 600;
  padding: 0.45rem 0.9rem;
  border-radius: 9999px;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.btn-refresh-gps {
  background: rgba(134, 0, 125, 0.08);
  color: var(--primary, #86007D);
  border: 1px solid rgba(134, 0, 125, 0.25);
}

.btn-refresh-gps:hover:not(:disabled) {
  background: rgba(134, 0, 125, 0.15);
}

.btn-refresh-gps:disabled {
  opacity: 0.6;
  cursor: wait;
}

.btn-adjust {
  background: transparent;
  color: var(--primary, #86007D);
  border: 1px solid var(--primary, #86007D);
}

.btn-adjust.is-active,
.btn-adjust:hover {
  background: var(--primary, #86007D);
  color: #fff;
}

.gps-msg {
  font-size: 0.82rem;
  font-weight: 500;
  color: #15803d;
  margin: 0;
  padding: 0.25rem 0;
}

.gps-msg.is-error {
  color: #dc2626;
}

.mini-map-container {
  margin-top: 0.5rem;
}

.mini-map-hint {
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
  margin-bottom: 0.5rem;
}

.mini-map-frame {
  height: 280px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border, rgba(0,0,0,0.1));
}

.alert-error {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.step-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem 1rem;
}

.success-icon {
  font-size: 3.5rem;
  margin-bottom: 0.75rem;
}

.success-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: #15803d;
  margin-bottom: 0.5rem;
}

.success-desc {
  font-size: 1rem;
  color: var(--text, #334155);
  max-width: 420px;
  line-height: 1.6;
}
</style>
