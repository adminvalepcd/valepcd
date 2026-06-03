import fs from 'fs'
import path from 'path'

// Get posts slugs to feed to sitemap
const getPostRoutes = () => {
  try {
    const postsPath = path.resolve(process.cwd(), 'server/posts-data.json')
    if (fs.existsSync(postsPath)) {
      const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
      return posts.map(post => `/blog/${post.slug}`)
    }
  } catch (e) {
    console.error('Failed to read posts for sitemap:', e)
  }
  return []
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  
  css: [
    '~/assets/css/main.css'
  ],

  modules: [
    '@nuxtjs/i18n',
    '@vercel/analytics/nuxt',
    '@vercel/speed-insights/nuxt',
    '@nuxtjs/sitemap'
  ],

  site: {
    url: 'https://www.valepcd.com.br',
    name: 'Vale PCD'
  },

  sitemap: {
    urls: getPostRoutes
  },

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
        { property: 'og:image', content: 'https://www.valepcd.com.br/images/logo-vale-pcd-seo.webp' },

        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Vale PCD | Acessibilidade para Empresas e Comunidade' },
        { name: 'twitter:description', content: 'Conheça o Vale PCD: O maior projeto do Brasil sobre visibilidade e acessibilidade para pessoas com deficiência da comunidade LGBTQI+.' },
        { name: 'twitter:image', content: 'https://www.valepcd.com.br/images/logo-vale-pcd-seo.webp' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  }
})

