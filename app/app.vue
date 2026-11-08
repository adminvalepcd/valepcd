<script setup>
import { ref, onMounted } from 'vue'

const appShellRef = ref(null)

const head = useLocaleHead({
  addDirAttribute: true,
  identifierAttribute: 'id',
  addSeoAttributes: true
})

useHead({
  htmlAttrs: {
    lang: () => head.value.htmlAttrs?.lang || 'pt-BR',
    dir: () => head.value.htmlAttrs?.dir || 'ltr'
  },
  link: () => [
    ...(head.value.link || [])
  ],
  meta: () => [
    ...(head.value.meta || [])
  ]
})

onMounted(() => {
  const liveShell = appShellRef.value
  const nuxtRoot = liveShell?.parentElement
  if (!liveShell || !nuxtRoot) return

  // Caso o visualizador/proxy do AdSense reexecute o bundle sobre um snapshot já renderizado,
  // remove qualquer cópia anterior órfã dentro de `#__nuxt`, mantendo apenas a árvore viva do Vue.
  Array.from(nuxtRoot.children).forEach((child) => {
    if (child !== liveShell) {
      child.remove()
    }
  })
})
</script>

<template>
  <div ref="appShellRef" class="vale-app-shell">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <div class="vale-route-announcer-host">
      <NuxtRouteAnnouncer />
    </div>
  </div>
</template>
