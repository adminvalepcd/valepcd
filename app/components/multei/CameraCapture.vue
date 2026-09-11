<template>
  <div class="camera-backdrop">
    <canvas ref="canvasRef" class="hidden-canvas" />
    
    <div class="video-card">
      <div v-if="isLoading" class="camera-state">
        <LoadingSpinner />
        <p class="camera-state-msg">Iniciando câmera...</p>
      </div>

      <div v-if="error" class="camera-state error">
        <p class="camera-error-msg">{{ error }}</p>
      </div>

      <video
        ref="videoRef"
        autoplay
        playsinline
        class="camera-video"
        :class="{ 'is-hidden': isLoading || !!error }"
      />
    </div>

    <!-- Botão de Disparo / Foto -->
    <div class="camera-shutter-bar">
      <button
        type="button"
        @click="handleCapture"
        :disabled="!stream || !!error"
        class="btn-shutter"
        aria-label="Tirar Foto"
      >
        <div class="shutter-inner">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="shutter-icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        </div>
      </button>
    </div>

    <!-- Botão Fechar -->
    <button
      type="button"
      @click="emit('cancel')"
      class="btn-camera-close"
      aria-label="Cancelar Câmera"
    >
      ✕
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const emit = defineEmits(['photoTaken', 'cancel']);

const videoRef = ref(null);
const canvasRef = ref(null);
const stream = ref(null);
const error = ref(null);
const isLoading = ref(true);

onMounted(async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('A API de Câmera não é suportada neste navegador.');
    }
    const mediaStream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    stream.value = mediaStream;
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream;
    }
  } catch (err) {
    console.error("Erro ao acessar câmera:", err);
    let message = 'Não foi possível acessar a câmera.';
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        message = 'Permissão de câmera negada. Permita o acesso à câmera nas configurações do navegador.';
      } else if (err.name === 'NotFoundError') {
        message = 'Nenhuma câmera encontrada neste dispositivo.';
      }
    }
    error.value = message;
  } finally {
    isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
  }
});

const handleCapture = () => {
  if (!videoRef.value || !canvasRef.value) return;

  const video = videoRef.value;
  const canvas = canvasRef.value;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (context) {
    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    canvas.toBlob((blob) => {
      if (blob) {
        const fileName = `infracao-${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        emit('photoTaken', file);
      }
    }, 'image/jpeg', 0.9);
  }
};
</script>

<style scoped>
.camera-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.hidden-canvas {
  display: none;
}

.video-card {
  position: relative;
  width: 100%;
  max-width: 760px;
  aspect-ratio: 4 / 3;
  background-color: #0f172a;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s;
}

.camera-video.is-hidden {
  opacity: 0;
}

.camera-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  text-align: center;
}

.camera-state-msg {
  color: #ffffff;
  margin-top: 1rem;
  font-size: 1.1rem;
}

.camera-error-msg {
  color: #f87171;
  font-size: 1.05rem;
}

.camera-shutter-bar {
  position: absolute;
  bottom: 2rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}

.btn-shutter {
  background: #ffffff;
  border: 4px solid rgba(255, 255, 255, 0.6);
  padding: 6px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.2s;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}

.btn-shutter:hover:not(:disabled) {
  transform: scale(1.08);
}

.btn-shutter:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.shutter-inner {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--primary, #86007D);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.shutter-icon {
  width: 28px;
  height: 28px;
}

.btn-camera-close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 1.25rem;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-camera-close:hover {
  background: rgba(0, 0, 0, 0.85);
}
</style>
