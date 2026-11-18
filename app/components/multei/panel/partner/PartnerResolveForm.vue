<template>
  <section class="partner-resolve-box" aria-labelledby="partner-resolve-title">
    <h4 id="partner-resolve-title" class="box-section-title">
      <span aria-hidden="true">📢</span>
      Informar correção à população
    </h4>
    <p class="partner-resolve-hint">
      A foto e a descrição ficarão públicas no mapa como comprovação da correção.
    </p>

    <!-- ETAPA 1: preenchimento -->
    <template v-if="step === 'edit'">
      <div class="partner-photo-upload-area" role="group" aria-labelledby="partner-photo-label">
        <span id="partner-photo-label" class="field-label">Foto do local corrigido *</span>

        <div v-if="isProcessingPhoto" class="partner-photo-processing" role="status">
          <div class="spinner-circle" aria-hidden="true"></div>
          <span>Preparando a foto e protegendo a privacidade (placas e rostos)...</span>
        </div>

        <div v-else-if="photoWebp" class="partner-photo-preview-box">
          <img
            :src="photoWebp"
            alt="Foto do local corrigido que será publicada"
            class="partner-photo-preview-img"
            @click="openPanelLightbox(photoWebp)"
          />
          <div class="partner-preview-actions">
            <button type="button" class="btn-cancel-edit" @click="openPanelLightbox(photoWebp)">
              <span aria-hidden="true">🔍</span> Ampliar foto
            </button>
            <button
              ref="changePhotoBtnRef"
              type="button"
              class="btn-cancel-edit"
              :disabled="isSubmitting"
              @click="clearPhoto"
            >
              <span aria-hidden="true">🔄</span> Trocar foto
            </button>
          </div>
        </div>

        <div v-else class="partner-upload-buttons">
          <button
            ref="firstUploadBtnRef"
            type="button"
            class="btn-partner-upload"
            :disabled="isSubmitting"
            :aria-describedby="photoError ? 'partner-photo-error' : undefined"
            @click="showCamera = true"
          >
            <span aria-hidden="true">📷</span>
            <span>Tirar foto agora</span>
          </button>

          <button
            type="button"
            class="btn-partner-upload"
            :disabled="isSubmitting"
            :aria-describedby="photoError ? 'partner-photo-error' : undefined"
            @click="fileInputRef?.click()"
          >
            <span aria-hidden="true">🖼️</span>
            <span>Escolher da galeria</span>
          </button>

          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            @change="handleFileSelected"
          />
        </div>

        <p v-if="photoError" id="partner-photo-error" class="field-error" role="alert">
          {{ photoError }}
        </p>
      </div>

      <div class="form-field">
        <label for="partner-resolve-desc" class="field-label">O que foi feito *</label>
        <p id="partner-resolve-desc-hint" class="partner-field-hint">
          Informe o que foi feito, quem executou e, se houver, o número da ordem de serviço.
        </p>
        <textarea
          id="partner-resolve-desc"
          ref="descriptionRef"
          v-model="description"
          rows="4"
          :maxlength="MAX_DESCRIPTION"
          class="field-input partner-textarea"
          :aria-invalid="descriptionError ? 'true' : 'false'"
          :aria-describedby="descriptionDescribedBy"
          :disabled="isSubmitting || isProcessingPhoto"
        ></textarea>
        <p id="partner-resolve-desc-counter" class="partner-char-counter" :class="{ 'is-short': trimmedLength < MIN_DESCRIPTION }">
          {{ trimmedLength }} de {{ MAX_DESCRIPTION }} caracteres
          <template v-if="trimmedLength < MIN_DESCRIPTION">(mínimo {{ MIN_DESCRIPTION }})</template>
        </p>
        <p v-if="descriptionError" id="partner-resolve-desc-error" class="field-error">
          {{ descriptionError }}
        </p>
      </div>

      <p v-if="generalError" class="login-error-alert" role="alert">
        {{ generalError }}
      </p>

      <button
        ref="mainButtonRef"
        type="button"
        class="btn-action btn-action-positive btn-confirm-partner-resolve"
        :disabled="isSubmitting || isProcessingPhoto"
        @click="goToConfirmation"
      >
        Enviar comprovação de correção
      </button>
    </template>

    <!-- ETAPA 2: confirmação em linha (sem confirm() nativo) -->
    <div v-else class="partner-confirm-box" role="group" aria-labelledby="partner-confirm-title">
      <h5 id="partner-confirm-title" ref="confirmHeadingRef" class="partner-confirm-title" tabindex="-1">
        Confira antes de publicar
      </h5>
      <div class="partner-confirm-body">
        <img :src="photoWebp" alt="Foto do local corrigido que será publicada" class="partner-confirm-thumb" />
        <div class="partner-confirm-text">
          <p class="partner-confirm-label">Descrição que será publicada:</p>
          <p class="partner-confirm-desc">{{ description.trim() }}</p>
        </div>
      </div>
      <p class="partner-confirm-notice">
        <span aria-hidden="true">⚠️</span>
        Ao confirmar, esta foto e esta descrição ficarão públicas no mapa e a ocorrência passará a aparecer como corrigida.
      </p>

      <p v-if="generalError" class="login-error-alert" role="alert">
        {{ generalError }}
      </p>

      <div class="partner-confirm-actions">
        <button type="button" class="btn-cancel-edit btn-confirm-back" :disabled="isSubmitting" @click="backToEdit">
          Voltar e editar
        </button>
        <button
          type="button"
          class="btn-action btn-action-positive btn-confirm-publish"
          :disabled="isSubmitting"
          :aria-busy="isSubmitting ? 'true' : 'false'"
          @click="submit"
        >
          <span v-if="isSubmitting">Publicando...</span>
          <span v-else>Confirmar e publicar</span>
        </button>
      </div>
    </div>

    <MulteiCameraCapture
      v-if="showCamera"
      @photo-taken="handleCameraPhotoTaken"
      @cancel="showCamera = false"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import type { ReportedIncident } from '~/types';
import { initializeGeminiClient, analyzeIncidentImage } from '~/services/geminiService';
import {
  prepareImageForGemini,
  blurSensitiveContentAndCompress,
  resizeImageForServer
} from '~/services/imageProcessor';
import { resolveUrbanIncidentByPartnerInFirebase } from '~/services/firebaseService';
import { useMulteiPanelShared } from '~/composables/useMulteiPanelShared';

// Formulário "Informar correção à população" (P1, P11, P12). A parceria é o órgão
// fiscalizador: a correção é publicada sem revisão, após confirmação em linha.
const props = defineProps<{ incident: ReportedIncident }>();

const emit = defineEmits<{
  (e: 'resolved', updated: ReportedIncident): void;
  (e: 'under-review'): void;
}>();

const MIN_DESCRIPTION = 20;
const MAX_DESCRIPTION = 300;
const UNDER_REVIEW_MESSAGE =
  'Aguardando moderação da Vale PCD; não é possível informar correção enquanto a ocorrência está em revisão.';

const { userProfile, announceSr, openPanelLightbox } = useMulteiPanelShared();

const config = useRuntimeConfig();
const geminiClient = initializeGeminiClient(config.public?.geminiApiKey as string);

const step = ref<'edit' | 'confirm'>('edit');
const showCamera = ref(false);
const isProcessingPhoto = ref(false);
const isSubmitting = ref(false);
const photoWebp = ref('');
const description = ref('');
const photoError = ref('');
const descriptionError = ref('');
const generalError = ref('');

const fileInputRef = ref<HTMLInputElement | null>(null);
const firstUploadBtnRef = ref<HTMLButtonElement | null>(null);
const changePhotoBtnRef = ref<HTMLButtonElement | null>(null);
const descriptionRef = ref<HTMLTextAreaElement | null>(null);
const mainButtonRef = ref<HTMLButtonElement | null>(null);
const confirmHeadingRef = ref<HTMLElement | null>(null);

const trimmedLength = computed(() => description.value.trim().length);

const descriptionDescribedBy = computed(() =>
  ['partner-resolve-desc-hint', 'partner-resolve-desc-counter', descriptionError.value ? 'partner-resolve-desc-error' : '']
    .filter(Boolean)
    .join(' ')
);

const clearPhoto = async () => {
  photoWebp.value = '';
  await nextTick();
  firstUploadBtnRef.value?.focus();
};

const processPhoto = async (file: File) => {
  isProcessingPhoto.value = true;
  photoError.value = '';
  generalError.value = '';
  try {
    const optimizedBase64 = await prepareImageForGemini(file);
    let plates: any[] = [];
    let faces: any[] = [];

    if (geminiClient) {
      const analysis = await analyzeIncidentImage(geminiClient, optimizedBase64, 'urbana');
      if (!analysis.apiError) {
        if (analysis.isAiGenerated) {
          photoError.value = 'Fotos geradas por inteligência artificial não são aceitas. Envie uma foto real tirada no local.';
          return;
        }
        if (!analysis.isAppropriate) {
          photoError.value = 'A imagem enviada contém conteúdo impróprio e não pôde ser aceita.';
          return;
        }
        plates = analysis.plates || [];
        faces = analysis.faces || [];
      }
    }

    photoWebp.value = await blurSensitiveContentAndCompress(optimizedBase64, plates, faces);
    announceSr('Foto pronta para envio.');
    await nextTick();
    changePhotoBtnRef.value?.focus();
  } catch {
    photoError.value = 'Não foi possível processar a foto selecionada. Tente outra imagem.';
  } finally {
    isProcessingPhoto.value = false;
  }
};

const handleFileSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input?.files?.[0];
  if (file) await processPhoto(file);
  if (input) input.value = '';
};

const handleCameraPhotoTaken = async (file: File) => {
  showCamera.value = false;
  if (file) await processPhoto(file);
};

const validate = (): boolean => {
  photoError.value = photoWebp.value ? '' : 'Envie uma foto que mostre o local já corrigido.';
  const missing = MIN_DESCRIPTION - trimmedLength.value;
  if (trimmedLength.value === 0) {
    descriptionError.value = `Descreva o que foi feito (mínimo de ${MIN_DESCRIPTION} caracteres).`;
  } else if (missing > 0) {
    descriptionError.value = `A descrição precisa ter pelo menos ${MIN_DESCRIPTION} caracteres. Faltam ${missing}.`;
  } else {
    descriptionError.value = '';
  }
  return !photoError.value && !descriptionError.value;
};

const goToConfirmation = async () => {
  generalError.value = '';
  if (props.incident?.em_revisao_denuncia) {
    generalError.value = UNDER_REVIEW_MESSAGE;
    return;
  }
  if (!validate()) {
    await nextTick();
    if (photoError.value) {
      firstUploadBtnRef.value?.focus();
    } else {
      descriptionRef.value?.focus();
    }
    return;
  }
  step.value = 'confirm';
  await nextTick();
  confirmHeadingRef.value?.focus();
};

const backToEdit = async () => {
  step.value = 'edit';
  generalError.value = '';
  await nextTick();
  mainButtonRef.value?.focus();
};

const submit = async () => {
  const current = props.incident;
  if (!current?.id || isSubmitting.value || isProcessingPhoto.value) return;
  if (!validate()) {
    await backToEdit();
    return;
  }

  generalError.value = '';
  isSubmitting.value = true;
  try {
    const partnerLabel = userProfile.value?.nomeCompleto
      ? `${userProfile.value.nomeCompleto}${userProfile.value.cidade ? ` (${userProfile.value.cidade})` : ''}`
      : userProfile.value?.email || '';

    const serverPhoto = await resizeImageForServer(photoWebp.value);
    const res = await resolveUrbanIncidentByPartnerInFirebase({
      ocorrenciaId: current.id,
      foto: serverPhoto,
      descricao: description.value.trim(),
      resolvidoPor: partnerLabel,
      incident: current
    });

    emit('resolved', {
      ...current,
      resolvido: true,
      status_resolucao: 'resolvido',
      resolvido_em_validacao: false,
      foto_resolucao: res.fotoResolucaoUrl,
      descricao_resolucao: res.descricaoResolucao,
      data_resolucao: res.dataResolucao,
      resolvido_por: partnerLabel
    });
  } catch (err: any) {
    if (err?.code === 'UNDER_REPORT_REVIEW') {
      generalError.value = UNDER_REVIEW_MESSAGE;
      emit('under-review');
    } else {
      generalError.value = 'Não foi possível publicar a correção agora. Verifique sua conexão e tente novamente.';
    }
    announceSr(generalError.value);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped src="../../../../assets/css/multei-panel.css"></style>

<style scoped>
.partner-resolve-box {
  background: var(--pp-surface-alt);
  border: 2px solid var(--pp-green-border);
  border-radius: 16px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.partner-resolve-hint,
.partner-field-hint {
  margin: 0;
  font-size: 0.88rem;
  color: var(--pp-text-secondary);
  line-height: 1.45;
}

.partner-photo-upload-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.partner-photo-processing {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--pp-text-primary);
}

.partner-photo-preview-box {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.partner-photo-preview-img {
  width: 100%;
  max-height: 240px;
  object-fit: contain;
  background: #000;
  border-radius: 12px;
  cursor: zoom-in;
}

.partner-preview-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.partner-upload-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.btn-partner-upload {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.72rem 0.9rem;
  border-radius: 12px;
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-partner-upload:hover:not(:disabled) {
  border-color: var(--pp-accent);
}

.partner-textarea {
  resize: vertical;
}

.partner-char-counter {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
}

.partner-char-counter.is-short {
  color: var(--pp-amber-text);
}

.field-error {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--pp-red-text);
}

.btn-confirm-partner-resolve,
.btn-confirm-publish {
  align-items: center;
  text-align: center;
}

.partner-confirm-box {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.partner-confirm-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.partner-confirm-body {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.partner-confirm-thumb {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 12px;
  border: 1.5px solid var(--pp-border);
  flex: 0 0 auto;
}

.partner-confirm-text {
  min-width: 0;
}

.partner-confirm-label {
  margin: 0 0 0.25rem;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--pp-text-secondary);
}

.partner-confirm-desc {
  margin: 0;
  font-size: 0.92rem;
  color: var(--pp-text-primary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.partner-confirm-notice {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 12px;
  background: var(--pp-amber-bg);
  border: 1.5px solid var(--pp-amber-border);
  color: var(--pp-amber-text);
  font-size: 0.88rem;
  font-weight: 700;
}

.partner-confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 0.65rem;
}

.btn-confirm-back {
  border-radius: 16px;
  padding: 0.85rem;
}

@media (max-width: 960px) {
  .partner-upload-buttons,
  .partner-confirm-actions {
    grid-template-columns: 1fr;
  }

  .partner-confirm-body {
    flex-direction: column;
  }
}
</style>
