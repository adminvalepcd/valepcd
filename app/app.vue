<script setup>
const head = useLocaleHead({
  addDirAttribute: true,
  identifierAttribute: 'id',
  addSeoAttributes: true
})

// Detect if visitor is a bot on the server-side to inject tags in raw HTML
const headers = useRequestHeaders(['user-agent'])
const userAgent = headers['user-agent'] || ''
const isBotServer = typeof window === 'undefined' && /googlebot|google-site-verification|bot|crawl|spider/i.test(userAgent) && !/lighthouse/i.test(userAgent);

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
  ],
  script: isBotServer ? [
    {
      src: 'https://www.googletagmanager.com/gtag/js?id=G-4QRMKWNJ8S',
      async: true
    },
    {
      innerHTML: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-4QRMKWNJ8S');
      `
    }
  ] : []
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

