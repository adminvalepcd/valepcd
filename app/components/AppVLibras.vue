<template>
  <div vw class="enabled">
    <div vw-access-button class="active"></div>
    <div vw-plugin-wrapper>
      <div class="vw-plugin-top-wrapper"></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // VLibras is a Brazil-government accessibility widget for sign language (Libras) translation.
  // We load it dynamically on client-side mount to prevent SSR hydration mismatches.
  const script = document.createElement('script')
  script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js'
  script.async = true
  script.defer = true
  script.onload = () => {
    try {
      if (window.VLibras) {
        new window.VLibras.Widget('https://vlibras.gov.br/app')
      }
    } catch (err) {
      console.warn('VLibras initialization failed:', err)
    }
  }
  document.body.appendChild(script)
})
</script>

<style>
/* VLibras widget styling override container to ensure it stays accessible and doesn't overlap essential elements */
.enabled__vlibras {
  z-index: 99999 !important;
}
</style>
