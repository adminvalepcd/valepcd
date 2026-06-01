// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  
  css: [
    '~/assets/css/main.css'
  ],

  modules: [
    '@nuxtjs/i18n'
  ],

  i18n: {
    locales: [
      { code: 'pt', iso: 'pt-BR', name: 'Português', file: 'pt.json' },
      { code: 'en', iso: 'en-US', name: 'English', file: 'en.json' },
      { code: 'es', iso: 'es-ES', name: 'Español', file: 'es.json' }
    ],
    defaultLocale: 'pt',
    lazy: true,
    langDir: 'locales/',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    }
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'pt-BR'
      },
      title: 'Vale PCD | Acessibilidade para Empresas e Comunidade',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Conheça o Vale PCD: O maior projeto do Brasil sobre visibilidade e acessibilidade para pessoas com deficiência da comunidade LGBTQI+.' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Vale PCD | Acessibilidade para Empresas e Comunidade' },
        { property: 'og:description', content: 'Conheça o Vale PCD: O maior projeto do Brasil sobre visibilidade e acessibilidade para pessoas com deficiência da comunidade LGBTQI+.' },
        { property: 'og:url', content: 'https://www.valepcd.com.br' },
        { property: 'og:site_name', content: 'Vale PCD' },
        { property: 'og:image', content: 'https://static.wixstatic.com/media/acd625_9e14ee4333ac4944b72c0ada48128725~mv2.jpg' },

        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Vale PCD | Acessibilidade para Empresas e Comunidade' },
        { name: 'twitter:description', content: 'Conheça o Vale PCD: O maior projeto do Brasil sobre visibilidade e acessibilidade para pessoas com deficiência da comunidade LGBTQI+.' },
        { name: 'twitter:image', content: 'https://static.wixstatic.com/media/acd625_9e14ee4333ac4944b72c0ada48128725~mv2.jpg' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: 'https://static.wixstatic.com/media/8905a1_18621b64764d42e2998a6df9bba5d91d~mv2.png' }
      ]
    }
  }
})

