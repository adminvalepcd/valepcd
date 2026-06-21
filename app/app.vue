<script setup>
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

const { $loadAnalytics } = useNuxtApp()

onMounted(() => {
  // Defer third-party analytics/ads scripts to avoid blocking the main thread during load
  const loadWithDelayOrInteraction = () => {
    if (window.__analyticsDeferredStarted) return;
    window.__analyticsDeferredStarted = true;

    cleanupListeners();
    $loadAnalytics();
  };

  const listeners = ['touchstart', 'pointerdown', 'scroll', 'keydown'];
  const cleanupListeners = () => {
    listeners.forEach(event => {
      window.removeEventListener(event, loadWithDelayOrInteraction, { passive: true });
    });
    if (timeoutId) clearTimeout(timeoutId);
  };

  listeners.forEach(event => {
    window.addEventListener(event, loadWithDelayOrInteraction, { passive: true });
  });

  // Fallback timeout to load tracking if no interaction occurs (e.g. 4 seconds)
  const timeoutId = setTimeout(loadWithDelayOrInteraction, 4000);
})
</script>

<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>

