<template>
  <div class="leke-minimal-page" :class="{ 'is-cooldown': isCooldown }" @click="toggleFan">
    <AppSeo 
      title="Leke Virtual - Vale PCD"
      description="Faz barulho você também com nosso leque virtual!"
    />

    <!-- Gyroscope Permission Modal (Automatic on Enter) -->
    <Transition name="fade">
      <div 
        v-if="showPermissionModal" 
        class="permission-modal-backdrop" 
        @click.stop
        role="dialog" 
        aria-modal="true"
      >
        <div class="permission-modal-card">
          <div class="modal-emoji">📱🪭</div>
          <h2>Ativar Giroscópio</h2>
          <p>Autorize o sensor de movimento para abrir e fechar o leke balançando o celular.</p>
          <button @click="grantGyroscopePermission" class="btn-grant">
            Permitir e Começar 💥
          </button>
        </div>
      </div>
    </Transition>

    <!-- Fan Display (Only element on the page) -->
    <div class="fan-center-container" :class="{ 'is-open': isOpen, 'is-snapping': isSnapping }">
      <div class="fan-assembly">
        <div 
          v-for="(rib, index) in ribs" 
          :key="index" 
          class="fan-rib"
          :style="getRibStyle(index)"
        >
          <div class="rib-content" :style="{ backgroundColor: rib.color }">
            <span class="rib-pattern"></span>
          </div>
        </div>

        <!-- Center Pivot -->
        <div class="fan-pivot">
          <div class="pivot-inner">🪭</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  layout: false
})

useHead({
  title: 'Leke Virtual - Vale PCD',
  meta: [
    { name: 'description', content: 'Faz barulho você também com nosso leque virtual!' },
    { name: 'robots', content: 'index, follow' }
  ]
})

const isOpen = ref(false)
const isSnapping = ref(false)
              const isCooldown = ref(false)
const showPermissionModal = ref(false)

// Pride / ValePCD Rib Colors
const ribs = [
  { color: '#86007D' }, // Purple
  { color: '#6B92C8' }, // Blue
  { color: '#50A456' }, // Green
  { color: '#D8CC5C' }, // Yellow
  { color: '#C87844' }, // Orange
  { color: '#BF4848' }, // Red
  { color: '#F687D4' }, // Pink Pastel
  { color: '#D0E4FF' }, // Blue Pastel
  { color: '#CAF8CE' }, // Green Pastel
  { color: '#FFEC8C' }, // Yellow Pastel
  { color: '#FFD9A7' }  // Orange Pastel
]

// Audio Player for Leke Sound (leke.mp4)
let lekeAudio: HTMLAudioElement | null = null
let audioTimeout: ReturnType<typeof setTimeout> | null = null
            let lastSoundPlayTime = 0

function initAudio() {
  if (!lekeAudio && typeof window !== 'undefined') {
    lekeAudio = new Audio('/downloads/leke.mp4')
    lekeAudio.preload = 'auto'
  }
}

function playClackSound() {
  const now = Date.now()
  if (now - lastSoundPlayTime < COOLDOWN_MS) {
    return
  }
  lastSoundPlayTime = now

  if (!lekeAudio) {
    initAudio()
  }

  if (lekeAudio) {
    if (audioTimeout) {
      clearTimeout(audioTimeout)
    }

    lekeAudio.currentTime = 0
    lekeAudio.play().catch(err => {
      console.warn('Playback error:', err)
    })

    // Stop audio after 0.6 seconds
    audioTimeout = setTimeout(() => {
      if (lekeAudio) {
        lekeAudio.pause()
        lekeAudio.currentTime = 0
      }
    }, 600)
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([25, 35, 25])
  }
}

  // Cooldown throttle to prevent rapid repeat triggers (5 seconds for testing)
  let lastTriggerTime = 0
  const COOLDOWN_MS = 500

function toggleFan() {
  const now = Date.now()
  if (isCooldown.value || (now - lastTriggerTime < COOLDOWN_MS)) {
    return
  }

  isCooldown.value = true
  lastTriggerTime = now

  isOpen.value = !isOpen.value
  isSnapping.value = true

  playClackSound()

  setTimeout(() => {
    isSnapping.value = false
  }, 300)

  setTimeout(() => {
    isCooldown.value = false
  }, COOLDOWN_MS)
}

function getRibStyle(index: number) {
  const total = ribs.length
  const step = 160 / (total - 1)
  const openAngle = -80 + (index * step)
  const currentAngle = isOpen.value ? openAngle : 0

  return {
    transform: `rotate(${currentAngle}deg)`,
    zIndex: total - Math.abs(index - Math.floor(total / 2))
  }
}

// Gyroscope Motion Listener (Focado no movimento da ponta do celular frente/trás)
let lastY = 0, lastZ = 0
let lastTime = 0
const SHAKE_THRESHOLD = 25

function handleMotion(event: DeviceMotionEvent) {
  const currentTime = Date.now()
  if (isCooldown.value || (currentTime - lastTriggerTime < COOLDOWN_MS)) {
    return
  }

  // 1. Tenta usar rotationRate.beta (rotação da ponta do celular para frente e para trás em graus/segundo)
  const rotation = event.rotationRate
  if (rotation && typeof rotation.beta === 'number' && Math.abs(rotation.beta) > 180) {
    toggleFan()
    return
  }

  // 2. Fallback por aceleração: isola a aceleração nos eixos Y (comprimento) e Z (profundidade), ignorando X lateral puro e subidas/descidas
  const current = event.acceleration || event.accelerationIncludingGravity
  if (!current) return

  if ((currentTime - lastTime) > 100) {
    const diffTime = currentTime - lastTime
    lastTime = currentTime

    const y = current.y || 0
    const z = current.z || 0

    const deltaY = Math.abs(y - lastY)
    const deltaZ = Math.abs(z - lastZ)
    const speed = ((deltaY + deltaZ) / diffTime) * 10000

    if (speed > SHAKE_THRESHOLD * 10) {
      toggleFan()
    }

    lastY = y
    lastZ = z
  }
}

function grantGyroscopePermission() {
  showPermissionModal.value = false
  initAudio()

  if (typeof DeviceMotionEvent !== 'undefined' && typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
    (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          window.addEventListener('devicemotion', handleMotion, true)
        }
      })
      .catch(console.error)
  } else if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
    window.addEventListener('devicemotion', handleMotion, true)
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
      showPermissionModal.value = true
    } else if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', handleMotion, true)
    }
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('devicemotion', handleMotion, true)
  }
})
</script>

<style scoped>
.leke-minimal-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: #0f0a15;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
}

.leke-minimal-page.is-cooldown,
.leke-minimal-page.is-cooldown * {
  pointer-events: none !important;
  cursor: not-allowed;
}

/* Fan Center Visual */
.fan-center-container {
  position: relative;
  width: 380px;
  height: 300px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  transition: transform 0.2s ease;
}

.fan-center-container.is-snapping {
  animation: snapBounce 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes snapBounce {
  0% { transform: scale(0.9) rotate(-6deg); }
  50% { transform: scale(1.15) rotate(6deg); }
  100% { transform: scale(1) rotate(0deg); }
}

.fan-assembly {
  position: relative;
  width: 24px;
  height: 240px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.fan-rib {
  position: absolute;
  bottom: 0;
  width: 38px;
  height: 240px;
  transform-origin: bottom center;
  transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.rib-content {
  width: 100%;
  height: 100%;
  border-radius: 20px 20px 6px 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  position: relative;
  overflow: hidden;
}

.rib-pattern {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 50px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 100%);
  border-bottom: 2px solid rgba(255, 255, 255, 0.5);
}

.fan-pivot {
  position: absolute;
  bottom: -12px;
  width: 52px;
  height: 52px;
  background: #1a1a1a;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
  z-index: 200;
  border: 2px solid #ffd700;
}

.pivot-inner {
  font-size: 1.5rem;
}

/* Modal Overlay */
.permission-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 20px;
}

.permission-modal-card {
  background: #1c1526;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  padding: 32px 24px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
}

.modal-emoji {
  font-size: 2.5rem;
}

.permission-modal-card h2 {
  font-size: 1.4rem;
  font-weight: 700;
}

.permission-modal-card p {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
}

.btn-grant {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #86007D, #BF4848);
  color: #ffffff;
  border: none;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(134, 0, 125, 0.5);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@media (max-width: 600px) {
  .fan-center-container {
    width: 300px;
    height: 250px;
  }

  .fan-rib {
    height: 200px;
    width: 32px;
  }
}
</style>
