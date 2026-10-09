<template>
  <div 
    class="modal-backdrop"
    @click="emit('close')"
  >
    <div 
      ref="modalCardRef"
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-modal-title"
      @click.stop
    >
      <div class="modal-card-body">
        <div class="modal-header">
          <h2 id="incident-modal-title" class="modal-title">Detalhes da Ocorrência</h2>
          <button class="btn-close" @click="emit('close')" aria-label="Fechar">✕</button>
        </div>

        <div class="modal-image-wrapper">
          <div class="photo-stage" :class="{ 'is-loading': isLoadingPhoto }">
            <div
              v-if="isLoadingPhoto"
              class="image-loading-placeholder"
              role="status"
              aria-live="polite"
            >
              <LoadingSpinner />
              <span class="image-loading-text">Carregando foto...</span>
            </div>

            <img 
              v-if="currentPhoto && !hasPhotoLoadError"
              ref="photoImgRef"
              :src="currentPhoto" 
              alt="Foto da infração com dados sensíveis ocultos" 
              class="incident-image is-clickable"
              :class="{ 'is-hidden-while-loading': isLoadingPhoto }"
              title="Clique para ver em tamanho original"
              @load="handlePhotoLoaded"
              @error="handlePhotoError"
              @click="!isLoadingPhoto && (isPhotoExpanded = true)"
            />

            <div v-else-if="!isLoadingPhoto" class="image-empty-placeholder">
              <span>📷 Foto da infração indisponível</span>
            </div>

            <div
              v-if="verificationBadge"
              class="verification-photo-badge"
              :class="`is-${verificationBadge.type}`"
              :title="verificationBadge.label"
            >
              <span class="verification-badge-icon" aria-hidden="true">{{ verificationBadge.icon }}</span>
              <span class="verification-badge-text">{{ verificationBadge.label }}</span>
            </div>

            <div
              v-if="isResolutionPending"
              class="photo-resolution-watermark"
              aria-label="Em revisão de resolução"
            >
              <span class="photo-resolution-watermark-stamp">Em revisão de resolução</span>
            </div>
          </div>
          <p class="privacy-note">
            Áreas sensíveis (placas e rostos) foram ocultadas automaticamente por IA. Se seu rosto apareceu, <button type="button" class="btn-link-report" @click="handleOpenReport">reporte a ocorrência</button>.
          </p>
        </div>

        <!-- Visualização da foto em tamanho original acima do modal -->
        <div 
          v-if="isPhotoExpanded && currentPhoto" 
          class="photo-expanded-overlay" 
          title="Clique para fechar"
          @click.stop="isPhotoExpanded = false"
        >
          <div class="photo-expanded-stage">
            <img 
              :src="currentPhoto" 
              alt="Foto da infração em tamanho original" 
              class="photo-expanded-img" 
            />
            <div
              v-if="isResolutionPending"
              class="photo-resolution-watermark"
              aria-label="Em revisão de resolução"
            >
              <span class="photo-resolution-watermark-stamp">Em revisão de resolução</span>
            </div>
          </div>
        </div>

        <div class="modal-info-list">
          <div v-if="incident.descricao" class="info-row">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="info-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <div>
              <p class="info-label">Breve descrição:</p>
              <p class="info-val">{{ incident.descricao }}</p>
            </div>
          </div>

          <div class="info-row">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="info-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <div>
              <p class="info-label">Data e Hora:</p>
              <p class="info-val">{{ formattedDate }}</p>
            </div>
          </div>
          
          <div class="info-row">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="info-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <div>
              <p class="info-label">Localização:</p>
              <p v-if="incident.cidade" class="info-city">📍 {{ incident.cidade }}{{ incident.estado ? ` - ${incident.estado}` : '' }}</p>
              <p v-if="displayAddress" class="info-address">{{ displayAddress }}</p>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="modal-footer-actions">
            <button
              type="button"
              class="btn-report"
              @click="handleOpenReport"
            >
              🚩 Reportar Ocorrência
            </button>
            <button
              v-if="incident.natureza === 'urbana' && !isResolutionPending"
              type="button"
              class="btn btn-primary btn-resolved"
              @click="handleOpenResolve"
            >
              Marcar como resolvido
            </button>
          </div>
          <button
            type="button"
            @click="emit('close')"
            class="btn btn-secondary btn-close-footer"
          >
            Fechar
          </button>
        </div>
      </div>

      <!-- Câmera ao vivo para foto de Problema Resolvido -->
      <MulteiCameraCapture
        v-if="showResolveCamera"
        @photo-taken="handleResolvePhotoTaken"
        @cancel="showResolveCamera = false"
      />

      <!-- Diálogo / Modal de Problema Resolvido (Mobilidade Urbana) -->
      <div v-if="isResolveModalOpen" class="report-overlay" @click.stop>
        <div class="report-card">
          <div class="report-header">
            <h3 class="resolve-title">Informar Problema Resolvido</h3>
            <button
              type="button"
              class="btn-close"
              @click="handleCancelResolve"
              :disabled="isSubmittingResolve || isProcessingResolvePhoto"
            >✕</button>
          </div>

          <div v-if="resolveSuccess" class="report-success-state">
            <span class="report-success-icon">✅</span>
            <h4 class="report-success-title">Registro Enviado!</h4>
            <p class="report-success-desc">
              A foto e a descrição foram registradas para análise e atualização da ocorrência.
            </p>
          </div>

          <div v-else class="report-form">
            <p class="report-hint">
              Envie uma foto atualizada do local e uma breve descrição demonstrando que o problema de mobilidade urbana foi solucionado.
            </p>

            <!-- Seleção / Preview da Foto de Resolução -->
            <div class="resolve-photo-section">
              <div v-if="isProcessingResolvePhoto" class="resolve-photo-loading">
                <LoadingSpinner />
                <span>Aplicando camada de privacidade na foto...</span>
              </div>

              <div v-else-if="resolvedPhotoWebp" class="resolve-photo-preview-wrap">
                <img :src="resolvedPhotoWebp" alt="Foto do problema resolvido" class="resolve-photo-preview" />
                <button
                  type="button"
                  class="btn-change-resolve-photo"
                  :disabled="isSubmittingResolve"
                  @click="handleClearResolvePhoto"
                >
                  Trocar foto
                </button>
              </div>

              <div v-else class="resolve-upload-buttons">
                <button
                  type="button"
                  class="btn-resolve-upload"
                  @click="showResolveCamera = true"
                >
                  <span>📷</span>
                  <span>Tirar Foto</span>
                </button>
                <button
                  type="button"
                  class="btn-resolve-upload"
                  @click="resolveGalleryInputRef?.click()"
                >
                  <span>🖼️</span>
                  <span>Escolher da Galeria</span>
                </button>
                <input
                  ref="resolveGalleryInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="hidden-file-input"
                  tabindex="-1"
                  aria-hidden="true"
                  @change="handleResolveFileSelected"
                />
              </div>
            </div>

            <!-- Breve Descrição -->
            <div class="resolve-desc-field">
              <div class="resolve-desc-header">
                <label for="resolve-desc-textarea" class="resolve-desc-label">Breve descrição:</label>
                <span class="resolve-desc-counter" :class="{ 'is-limit': resolveDescription.length >= 300 }">
                  {{ resolveDescription.trim().length }}/300
                </span>
              </div>
              <textarea
                id="resolve-desc-textarea"
                v-model="resolveDescription"
                minlength="10"
                maxlength="300"
                class="resolve-textarea"
                rows="3"
                placeholder="Ex: A prefeitura realizou o reparo da calçada e desobstruiu a passagem de pedestres..."
                :disabled="isSubmittingResolve || isProcessingResolvePhoto"
              ></textarea>
            </div>

            <p v-if="resolveError" class="report-error-msg">{{ resolveError }}</p>

            <div class="report-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="handleCancelResolve"
                :disabled="isSubmittingResolve || isProcessingResolvePhoto"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn btn-success"
                @click="handleSubmitResolve"
                :disabled="!canSubmitResolve || isSubmittingResolve || isProcessingResolvePhoto"
              >
                <span v-if="isSubmittingResolve">Enviando...</span>
                <span v-else>Confirmar Resolução</span>
              </button>
            </div>
          </div>
        </div>
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { getAddressFromCoords } from '../../services/geoService';
import {
  reportIncidentInFirebase,
  submitUrbanResolutionToFirebase,
  normalizeVerificacao,
  getCachedIncidentImageUrl
} from '../../services/firebaseService';
import { initializeGeminiClient, analyzeIncidentImage } from '../../services/geminiService';
import { prepareImageForGemini, blurSensitiveContentAndCompress } from '../../services/imageProcessor';
import { useModalAccessibility } from '../../composables/useModalAccessibility';
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

const modalCardRef = ref(null);
const resolveGalleryInputRef = ref(null);
const photoImgRef = ref(null);
const config = useRuntimeConfig();
const geminiClient = initializeGeminiClient(config.public?.geminiApiKey);

const currentPhoto = ref(props.incident?.fotoUrl || props.incident?.maskedImageUrl || '');
const isLoadingPhoto = ref(Boolean(currentPhoto.value));
const hasPhotoLoadError = ref(false);
const isPhotoExpanded = ref(false);
const addressText = ref('');
const isResolving = ref(false);

const verificationBadge = computed(() => {
  if (props.incident?.natureza === 'urbana') {
    return {
      type: 'urbana',
      icon: '🚧',
      label: 'Mobilidade urbana'
    };
  }
  const type = normalizeVerificacao(props.incident?.verificacao ?? props.incident?.verification);
  if (type === 'exclusiva') {
    return {
      type: 'exclusiva',
      icon: '♿',
      label: 'Vaga exclusiva'
    };
  }
  if (type === 'transferencia') {
    return {
      type: 'transferencia',
      icon: '♿️↔️',
      label: 'Área de transferência'
    };
  }
  if (type === 'pedestre') {
    return {
      type: 'pedestre',
      icon: '🚷',
      label: 'Faixa de pedestres'
    };
  }
  return null;
});

const cleanStreetAndNeighborhood = (rawAddress, city, state) => {
  if (!rawAddress || typeof rawAddress !== 'string') return '';
  let addr = rawAddress.trim();
  if (addr.startsWith('Lat:')) return '';

  // Remove ', Brasil' no final
  addr = addr.replace(/,\s*Brasil\s*$/i, '');
  // Remove CEP (ex: 30140-071)
  addr = addr.replace(/,?\s*\d{5}-?\d{3}\s*/g, '');

  // Se tiver a cidade do incident, remove a cidade e tudo o que vier após ela
  if (city) {
    const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cityRegex = new RegExp(`[,–-]\\s*${escapedCity}.*$`, 'i');
    if (cityRegex.test(addr)) {
      addr = addr.replace(cityRegex, '');
    }
  }

  // Se ainda tiver UF no final (ex: ' - MG' ou ', MG')
  addr = addr.replace(/[,–-]\s*[A-Z]{2}\s*$/i, '');

  // Limpeza final de vírgulas, hífens ou traços residuais no final
  addr = addr.replace(/[,–-\s]+$/, '').trim();

  // Se o resultado for idêntico à própria cidade, não repete
  if (city && addr.toLowerCase() === city.toLowerCase()) {
    return '';
  }

  return addr;
};

const formattedDate = computed(() => {
  if (!props.incident?.timestamp) return '';
  const d = new Date(props.incident.timestamp);
  if (isNaN(d.getTime())) return String(props.incident.timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
});

const displayAddress = computed(() => {
  if (!addressText.value) return '';
  const city = props.incident?.cidade || '';
  const state = props.incident?.estado || '';
  return cleanStreetAndNeighborhood(addressText.value, city, state);
});

const isReportModalOpen = ref(false);
const reportReason = ref('');
const isSubmittingReport = ref(false);
const reportError = ref('');
const reportSuccess = ref(false);

const isResolveModalOpen = ref(false);
const showResolveCamera = ref(false);
const isProcessingResolvePhoto = ref(false);
const resolvedPhotoWebp = ref('');
const resolveDescription = ref('');
const isSubmittingResolve = ref(false);
const resolveError = ref('');
const resolveSuccess = ref(false);
const localMarkedResolved = ref(false);

const isResolutionPending = computed(() => {
  return Boolean(
    localMarkedResolved.value ||
    props.incident?.resolvido_em_validacao === true ||
    props.incident?.status_resolucao === 'em_validacao'
  );
});

const canSubmitResolve = computed(() => {
  return Boolean(resolvedPhotoWebp.value) && resolveDescription.value.trim().length >= 10;
});

const handlePhotoLoaded = () => {
  isLoadingPhoto.value = false;
  hasPhotoLoadError.value = false;
};

const handlePhotoError = () => {
  isLoadingPhoto.value = false;
  hasPhotoLoadError.value = true;
};

const loadPhotoIfNeeded = async () => {
  const nextPhoto = props.incident?.fotoUrl || props.incident?.maskedImageUrl || '';
  hasPhotoLoadError.value = false;

  if (!nextPhoto) {
    currentPhoto.value = '';
    isLoadingPhoto.value = false;
    return;
  }

  isLoadingPhoto.value = true;
  const cachedOrDirectUrl = await getCachedIncidentImageUrl(nextPhoto);
  currentPhoto.value = cachedOrDirectUrl;

  await nextTick();
  // Se a imagem já estiver em cache no navegador (ou for blob:/base64), libera imediatamente
  if (photoImgRef.value?.complete && photoImgRef.value?.naturalWidth > 0) {
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

const handleOpenResolve = () => {
  if (isResolutionPending.value) return;
  isResolveModalOpen.value = true;
  resolvedPhotoWebp.value = '';
  resolveDescription.value = '';
  resolveError.value = '';
  resolveSuccess.value = false;
};

const handleCancelResolve = () => {
  if (!isSubmittingResolve.value && !isProcessingResolvePhoto.value) {
    isResolveModalOpen.value = false;
  }
};

const handleClearResolvePhoto = () => {
  resolvedPhotoWebp.value = '';
  resolveError.value = '';
};

const processResolvePhoto = async (file) => {
  isProcessingResolvePhoto.value = true;
  resolveError.value = '';
  try {
    const optimizedBase64 = await prepareImageForGemini(file, 1200);
    let plates = [];
    let faces = [];

    if (geminiClient) {
      const analysis = await analyzeIncidentImage(geminiClient, optimizedBase64, 'urbana');
      if (!analysis.apiError) {
        if (!analysis.isAppropriate) {
          resolveError.value = 'foto inapropriada';
          return;
        }
        if (analysis.isUrbanEnvironment === false) {
          resolveError.value = analysis.rejectionReason || 'A foto enviada não parece mostrar uma calçada, via pública ou ambiente urbano.';
          return;
        }
        plates = analysis.plates || [];
        faces = analysis.faces || [];
      }
    }

    const finalWebp = await blurSensitiveContentAndCompress(optimizedBase64, plates, faces);
    resolvedPhotoWebp.value = finalWebp;
  } catch (err) {
    console.error('Erro ao processar foto de resolução:', err);
    resolveError.value = 'Não foi possível processar a foto selecionada. Tente outra imagem.';
  } finally {
    isProcessingResolvePhoto.value = false;
  }
};

const handleResolveFileSelected = async (e) => {
  const file = e.target?.files?.[0];
  if (file) {
    await processResolvePhoto(file);
  }
  if (e.target) e.target.value = '';
};

const handleResolvePhotoTaken = async (file) => {
  showResolveCamera.value = false;
  if (file) {
    await processResolvePhoto(file);
  }
};

const markIncidentAsPendingValidation = () => {
  localMarkedResolved.value = true;
  if (props.incident && typeof props.incident === 'object') {
    props.incident.resolvido_em_validacao = true;
    props.incident.status_resolucao = 'em_validacao';
  }
};

const handleSubmitResolve = async () => {
  if (isResolutionPending.value) return;
  if (!resolvedPhotoWebp.value) {
    resolveError.value = 'Por favor, adicione uma foto mostrando que o problema foi resolvido.';
    return;
  }
  if (resolveDescription.value.trim().length < 10) {
    resolveError.value = 'Por favor, preencha uma breve descrição.';
    return;
  }

  isSubmittingResolve.value = true;
  resolveError.value = '';

  try {
    await submitUrbanResolutionToFirebase({
      ocorrenciaId: props.incident.id || '',
      foto: resolvedPhotoWebp.value,
      descricao: resolveDescription.value.trim().slice(0, 300),
      incident: props.incident
    });

    markIncidentAsPendingValidation();
    resolveSuccess.value = true;
    setTimeout(() => {
      isResolveModalOpen.value = false;
    }, 1800);
  } catch (err) {
    if (err?.code === 'ALREADY_IN_VALIDATION') {
      markIncidentAsPendingValidation();
      resolveError.value = 'Esta ocorrência já foi sinalizada como resolvida e está sob validação.';
      setTimeout(() => {
        isResolveModalOpen.value = false;
      }, 1800);
      return;
    }
    console.error('Erro ao salvar resolução no Firebase:', err);
    resolveError.value = 'Não foi possível enviar o registro no momento. Tente novamente.';
  } finally {
    isSubmittingResolve.value = false;
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
    await reportIncidentInFirebase(id, reportReason.value.trim(), props.incident);

    reportSuccess.value = true;
    // Emite imediatamente para que o mapa e o array reflitam a remoção em tempo real
    emit('incidentReported', props.incident);
    setTimeout(() => {
      emit('close');
    }, 1500);
  } catch (err) {
    console.error('Erro ao reportar no Firebase:', err);
    reportError.value = 'Não foi possível registrar a denúncia no momento. Tente novamente.';
  } finally {
    isSubmittingReport.value = false;
  }
};

const { focusInitialElement } = useModalAccessibility({
  modalRef: modalCardRef,
  canClose: () => !isSubmittingReport.value && !isSubmittingResolve.value && !isProcessingResolvePhoto.value,
  onRequestClose: () => {
    if (showResolveCamera.value) {
      showResolveCamera.value = false;
      return 'subview';
    }
    if (isPhotoExpanded.value) {
      isPhotoExpanded.value = false;
      return 'subview';
    }
    if (isResolveModalOpen.value) {
      handleCancelResolve();
      return 'subview';
    }
    if (isReportModalOpen.value) {
      handleCancelReport();
      return 'subview';
    }
    emit('close');
    return 'closed';
  }
});

watch([isReportModalOpen, isResolveModalOpen, showResolveCamera, isPhotoExpanded], () => {
  nextTick(() => {
    focusInitialElement();
  });
});

onMounted(() => {
  resolveAddress();
  loadPhotoIfNeeded();
});

watch(() => props.incident, () => {
  isPhotoExpanded.value = false;
  localMarkedResolved.value = false;
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
  max-width: 520px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border, rgba(0,0,0,0.1));
}

.modal-card-body {
  padding: 1.75rem;
  overflow-y: auto;
  flex: 1 1 auto;
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
  color: var(--text-muted, #475466);
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

.photo-stage {
  position: relative;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
}

.verification-photo-badge {
  position: absolute;
  top: 0.7rem;
  left: 0.7rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #ffffff;
  background-color: var(--primary, #86007D);
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.3);
  pointer-events: none;
  z-index: 5;
}

.verification-photo-badge.is-urbana {
  background-color: #ca8a04;
}

.verification-badge-icon {
  font-size: 1rem;
  line-height: 1;
}

.verification-badge-text {
  line-height: 1.1;
  letter-spacing: 0.01em;
}

.photo-resolution-watermark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.25);
  pointer-events: none;
  z-index: 6;
}

.photo-resolution-watermark-stamp {
  display: inline-block;
  padding: 0.55rem 1.25rem;
  background: rgba(134, 0, 125, 0.82);
  color: #ffffff;
  font-size: clamp(0.92rem, 2.4vw, 1.25rem);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-align: center;
  border: 2px solid rgba(255, 255, 255, 0.88);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  transform: rotate(-12deg);
  user-select: none;
}

.photo-expanded-stage {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
}

.image-loading-placeholder {
  width: 100%;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(110deg, #f1f5f9 8%, #e2e8f0 18%, #f1f5f9 33%);
  background-size: 200% 100%;
  animation: photo-skeleton-shimmer 1.4s linear infinite;
  border-radius: var(--radius-md, 12px);
  gap: 0.75rem;
  padding: 2rem 1rem;
  z-index: 2;
}

@keyframes photo-skeleton-shimmer {
  to {
    background-position-x: -200%;
  }
}

.image-loading-text {
  font-size: 0.88rem;
  color: #334155;
  font-weight: 600;
}

.image-empty-placeholder {
  width: 100%;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border-radius: var(--radius-md, 12px);
  color: #64748b;
  font-size: 0.95rem;
}

.incident-image {
  width: 100%;
  max-height: 45vh;
  object-fit: scale-down;
  border-radius: var(--radius-md, 12px);
  background: #000;
  display: block;
  opacity: 1;
  transition: opacity 0.25s ease, transform 0.2s ease;
}

.incident-image.is-hidden-while-loading {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
}

.incident-image.is-clickable {
  cursor: zoom-in;
}

.incident-image.is-clickable:hover {
  opacity: 0.94;
}

.photo-expanded-overlay {
  position: fixed;
  inset: 0;
  z-index: 10050;
  background-color: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  cursor: zoom-out;
}

.photo-expanded-img {
  max-width: 95vw;
  max-height: 95vh;
  width: auto;
  height: auto;
  object-fit: scale-down;
  border-radius: var(--radius-md, 12px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
  cursor: zoom-out;
}

.privacy-note {
  font-size: 0.8rem;
  color: var(--text-muted, #475466);
  margin-top: 0.5rem;
  line-height: 1.4;
}

.btn-link-report {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  color: var(--primary, #86007D);
  text-decoration: underline;
  cursor: pointer;
  font-weight: 600;
  font-size: inherit;
  font-family: inherit;
}

.btn-link-report:hover {
  color: #50004b;
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
  color: var(--text-muted, #475466);
}

.info-val {
  font-size: 1rem;
  color: var(--text, #1e293b);
  margin-top: 0.1rem;
}

.info-city {
  font-weight: 700;
  color: var(--primary, #86007D);
  font-size: 0.95rem;
  margin-top: 0.1rem;
  margin-bottom: 0.15rem;
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
  color: var(--text-muted, #475466);
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.modal-footer-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn-resolved {
  background-color: var(--primary, #86007D);
  color: #ffffff;
  border: none;
  padding: 0.65rem 1.25rem;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.08));
  transition: all 0.2s;
}

.btn-resolved:hover {
  background-color: var(--primary-hover, #6e0066);
  transform: translateY(-1px);
}

.btn-close-footer {
  padding: 0.65rem 1.25rem;
  font-size: 0.9rem;
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

.btn-success {
  background: var(--primary, #86007D);
  color: #ffffff;
  border: none;
  padding: 0.55rem 1.1rem;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-success:hover {
  background: var(--primary-hover, #6e0066);
}

.btn-success:disabled {
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
  overflow-y: auto;
}

.report-card {
  background: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 440px;
  padding: 1.5rem;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.25);
  max-height: 90%;
  overflow-y: auto;
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

.resolve-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--primary, #86007D);
}

.report-hint {
  font-size: 0.88rem;
  color: var(--text-muted, #475466);
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

.resolve-photo-section {
  margin-bottom: 0.9rem;
}

.resolve-photo-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.5rem;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.resolve-spinner {
  width: 1.75rem;
  height: 1.75rem;
  border: 3px solid #e2e8f0;
  border-top-color: var(--primary, #86007D);
  border-radius: 50%;
  animation: resolveSpin 0.8s linear infinite;
}

@keyframes resolveSpin {
  to {
    transform: rotate(360deg);
  }
}

.resolve-photo-preview-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.resolve-photo-preview {
  width: 100%;
  max-height: 190px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
}

.btn-change-resolve-photo {
  background: transparent;
  border: 1px solid #cbd5e1;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-change-resolve-photo:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.resolve-upload-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.btn-resolve-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  font-family: inherit;
  gap: 0.4rem;
  padding: 0.7rem 0.75rem;
  background: #f8fafc;
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  color: #1e293b;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-resolve-upload:hover {
  border-color: var(--primary, #86007D);
  background: rgba(134, 0, 125, 0.04);
  color: var(--primary, #86007D);
}

.hidden-file-input {
  display: none;
}

.resolve-desc-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.resolve-desc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.resolve-desc-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted, #475466);
}

.resolve-desc-counter {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted, #475466);
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

.resolve-textarea:focus {
  border-color: var(--primary, #86007D);
  box-shadow: 0 0 0 2px rgba(134, 0, 125, 0.12);
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
