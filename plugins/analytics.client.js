export default defineNuxtPlugin(() => {
  return {
    provide: {
      loadAnalytics() {
        if (window.__analyticsLoaded) return;
        window.__analyticsLoaded = true;

        // 1. Google Tag (gtag.js) Script src
        const gtagScript = document.createElement('script');
        gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-4QRMKWNJ8S';
        gtagScript.async = true;
        document.head.appendChild(gtagScript);

        // 2. Google Tag Config
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-4QRMKWNJ8S');

        // 3. AdSense Script
        const adScript = document.createElement('script');
        adScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6260779513509504';
        adScript.async = true;
        adScript.crossOrigin = 'anonymous';
        adScript.onerror = () => { window.__adsBlocked = true; };
        document.head.appendChild(adScript);
      }
    }
  }
})
