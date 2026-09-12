<template>
  <div 
    class="modal-backdrop"
    @click="emit('close')"
  >
    <div 
      class="modal-card"
      @click.stop
    >
      <div class="modal-header">
        <h2 class="modal-title">Detalhes da Ocorrência</h2>
        <button class="btn-close" @click="emit('close')" aria-label="Fechar">✕</button>
      </div>

      <div class="modal-image-wrapper">
        <div v-if="isLoadingPhoto" class="image-loading-placeholder">
          <LoadingSpinner />
          <span class="image-loading-text">Carregando foto anonimizada...</span>
        </div>
        <img 
          v-else-if="currentPhoto"
          :src="currentPhoto" 
          alt="Foto da infração com dados sensíveis ocultos" 
          class="incident-image" 
        />
        <div v-else class="image-empty-placeholder">
          <span>📷 Foto da infração indisponível</span>
        </div>
        <p class="privacy-note">Áreas sensíveis (placas e rostos) foram ocultadas automaticamente por IA.</p>
      </div>

      <div class="modal-info-list">
        <div class="info-row">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="info-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <div>
            <p class="info-label">Data e Hora:</p>
            <p class="info-val">{{ new Date(incident.timestamp).toLocaleString() }}</p>
          </div>
        </div>
        
        <div class="info-row">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="info-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <div>
            <p class="info-label">Localização:</p>
            <p v-if="addressText" class="info-address">{{ addressText }}</p>
            <p class="info-coords">{{ `Lat: ${Number(incident.latitude).toFixed(5)}, Lng: ${Number(incident.longitude).toFixed(5)}` }}</p>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="btn-report"
          @click="handleOpenReport"
        >
          🚩 Reportar Ocorrência
        </button>
        <button
          type="button"
          @click="emit('close')"
          class="btn btn-primary"
        >
          Fechar
        </button>
      </div>

      <!-- Diálogo / Modal de Denúncia -->
      <div v-if="isReportModalOpen" class="report-overlay" @click.stop>
        <div class="report-card">
          <div class="report-header">
            <h3 class="report-title">Reportar Ocorrência</h3>
            <button 
              type="button" 
              class="btn-close" 
              @click="handleCancelReport" 
              :disabled="isSubmittingReport"
            >✕</button>
          </div>

          <div v-if="reportSuccess" class="report-success-state">
            <span class="report-success-icon">✅</span>
            <h4 class="report-success-title">Ocorrência Reportada!</h4>
            <p class="report-success-desc">Esta publicação foi desativada e removida do mapa. Nossa moderação avaliará a denúncia.</p>
          </div>

          <div v-else class="report-form">
            <p class="report-hint">
              Descreva o problema com esta publicação. Ao confirmar, ela será removida do mapa comunitário e enviada para moderação.
            </p>

            <textarea
              v-model="reportReason"
              class="report-textarea"
              rows="4"
              placeholder="Ex: Não há vaga PCD demarcada neste local, o carro possui credencial visível no painel, a foto não corresponde ao endereço, etc."
              :disabled="isSubmittingReport"
            ></textarea>

            <p v-if="reportError" class="report-error-msg">{{ reportError }}</p>

            <div class="report-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="handleCancelReport"
                :disabled="isSubmittingReport"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn btn-danger"
                @click="handleSubmitReport"
                :disabled="isSubmittingReport"
              >
                <span v-if="isSubmittingReport">Enviando denúncia...</span>
                <span v-else>Confirmar e Desativar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { getAddressFromCoords } from '../../services/geoService';
import { reportIncidentInSheet, fetchIncidentPhoto } from '../../services/sheetsService';
import LoadingSpinner from './LoadingSpinner.vue';

const props = defineProps({
  incident: {
    type: Object,
    required: true
  },
  appsScriptUrl: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'incidentReported']);

const currentPhoto = ref(props.incident?.maskedImageUrl || '');
const isLoadingPhoto = ref(!currentPhoto.value);
const addressText = ref('');
const isResolving = ref(false);

const isReportModalOpen = ref(false);
const reportReason = ref('');
const isSubmittingReport = ref(false);
const reportError = ref('');
const reportSuccess = ref(false);

const loadPhotoIfNeeded = async () => {
  currentPhoto.value = props.incident?.maskedImageUrl || '';
  if (!currentPhoto.value && props.appsScriptUrl && props.incident?.id) {
    isLoadingPhoto.value = true;
    try {
      const photo = await fetchIncidentPhoto(props.appsScriptUrl, props.incident.id);
      if (photo) {
        currentPhoto.value = photo;
        props.incident.maskedImageUrl = photo;
      }
    } catch (e) {
      console.warn('Erro ao carregar foto sob demanda:', e);
    } finally {
      isLoadingPhoto.value = false;
    }
  } else {
    isLoadingPhoto.value = false;
  }
};

const resolveAddress = async () => {
  if (!props.incident) return;
  if (props.incident.description && 
      props.incident.description !== 'Infração registrada' && 
      !props.incident.description.startsWith('Veículo') &&
      !props.incident.description.startsWith('Infração')) {
    addressText.value = props.incident.description;
  }
  isResolving.value = true;
  try {
    addressText.value = await getAddressFromCoords(props.incident.latitude, props.incident.longitude);
  } catch {
    if (!addressText.value) {
      addressText.value = `Lat: ${Number(props.incident.latitude).toFixed(5)}, Lng: ${Number(props.incident.longitude).toFixed(5)}`;
    }
  } finally {
    isResolving.value = false;
  }
};

const handleOpenReport = () => {
  isReportModalOpen.value = true;
  reportReason.value = '';
  reportError.value = '';
  reportSuccess.value = false;
};

const handleCancelReport = () => {
  if (!isSubmittingReport.value) {
    isReportModalOpen.value = false;
  }
};

const handleSubmitReport = async () => {
  if (!reportReason.value.trim()) {
    reportError.value = 'Por favor, descreva o problema observado nesta ocorrência.';
    return;
  }

  isSubmittingReport.value = true;
  reportError.value = '';

  try {
    const id = props.incident.id || '';
    await reportIncidentInSheet(props.appsScriptUrl || '', id, reportReason.value.trim());

    reportSuccess.value = true;
    // Emite imediatamente para que o mapa e o array reflitam a remoção em tempo real
    emit('incidentReported', props.incident);
    setTimeout(() => {
      emit('close');
    }, 1500);
  } catch (err) {
    console.error('Erro ao reportar:', err);
    reportError.value = 'Não foi possível registrar a denúncia na planilha. Tente novamente.';
  } finally {
    isSubmittingReport.value = false;
  }
};

onMounted(() => {
  resolveAddress();
  loadPhotoIfNeeded();
});

watch(() => props.incident, () => {
  resolveAddress();
  loadPhotoIfNeeded();
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 9999;
}

.modal-card {
  position: relative;
  background-color: var(--surface, #ffffff);
  color: var(--text, #1e293b);
  border-radius: var(--radius-lg, 20px);
  padding: 1.75rem;
  max-width: 520px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border, rgba(0,0,0,0.1));
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.modal-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text, #0f172a);
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-muted, #64748b);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.05);
}

.modal-image-wrapper {
  margin-bottom: 1.5rem;
  text-align: center;
}

.image-loading-placeholder {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: var(--radius-md, 12px);
  gap: 0.75rem;
  padding: 2rem 1rem;
}

.image-loading-text {
  font-size: 0.88rem;
  color: #64748b;
  font-weight: 500;
}

.image-empty-placeholder {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border-radius: var(--radius-md, 12px);
  color: #94a3b8;
  font-size: 0.95rem;
}

.incident-image {
  width: 100%;
  max-height: 45vh;
  object-fit: cover;
  border-radius: var(--radius-md, 12px);
  background: #000;
}

.privacy-note {
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
  margin-top: 0.5rem;
}

.modal-info-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.info-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--primary, #86007D);
  flex-shrink: 0;
  margin-top: 0.2rem;
}

.info-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted, #64748b);
}

.info-val {
  font-size: 1rem;
  color: var(--text, #1e293b);
  margin-top: 0.1rem;
}

.info-address {
  font-weight: 600;
  color: var(--text, #0f172a);
  font-size: 0.98rem;
  margin-top: 0.1rem;
  margin-bottom: 0.15rem;
  line-height: 1.4;
}

.info-coords {
  font-size: 0.82rem;
  color: var(--text-muted, #64748b);
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.btn-report {
  background: transparent;
  color: #dc2626;
  border: 1px solid rgba(220, 38, 38, 0.35);
  padding: 0.5rem 0.9rem;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-report:hover {
  background: #fee2e2;
  border-color: #dc2626;
}

.btn-danger {
  background: #dc2626;
  color: #ffffff;
  border: none;
  padding: 0.55rem 1.1rem;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.report-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(4px);
  border-radius: var(--radius-lg, 20px);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.report-card {
  background: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 440px;
  padding: 1.5rem;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.25);
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.report-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #dc2626;
}

.report-hint {
  font-size: 0.88rem;
  color: var(--text-muted, #64748b);
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

.report-textarea {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.75rem;
  font-family: inherit;
  font-size: 0.9rem;
  color: #1e293b;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.report-textarea:focus {
  border-color: #dc2626;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.15);
}

.report-error-msg {
  color: #dc2626;
  font-size: 0.8rem;
  margin-top: 0.4rem;
}

.report-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.report-success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem 0;
}

.report-success-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.report-success-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #15803d;
  margin-bottom: 0.35rem;
}

.report-success-desc {
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.4;
}
</style>
