export default defineNuxtPlugin((nuxtApp) => {
  // Configura a gtag globalmente para que possamos usar nas rotas
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function() { window.dataLayer.push(arguments); };
  }

  const loadAnalytics = () => {
    if (window.__analyticsLoaded) return;
    window.__analyticsLoaded = true;

    // 1. Google Tag (gtag.js) Script src
    const gtagScript = document.createElement('script');
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-4QRMKWNJ8S';
    gtagScript.async = true;
    document.head.appendChild(gtagScript);

    // 2. Google Tag Config
    window.gtag('js', new Date());
    window.gtag('config', 'G-4QRMKWNJ8S');

    // 3. AdSense Script
    const adScript = document.createElement('script');
    adScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6260779513509504';
    adScript.async = true;
    adScript.crossOrigin = 'anonymous';
    adScript.onerror = () => { window.__adsBlocked = true; };
    document.head.appendChild(adScript);
  }

  // Rastreamento de rotas do Nuxt para o Google Analytics em tempo real
  nuxtApp.$router.afterEach((to) => {
    if (typeof window !== 'undefined' && window.__analyticsLoaded && window.gtag) {
      window.gtag('config', 'G-4QRMKWNJ8S', {
        page_path: to.fullPath,
        page_location: window.location.origin + to.fullPath
      });
    }
  });

  return {
    provide: {
      loadAnalytics
    }
  }
})
