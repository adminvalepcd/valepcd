import fs from 'fs'
import path from 'path'

// Get posts slugs to feed to sitemap
const getPostRoutes = () => {
  try {
    const postsPath = path.resolve(process.cwd(), 'server/posts-data.json')
    if (fs.existsSync(postsPath)) {
      const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
      const routes: string[] = []
      posts.forEach(post => {
        routes.push(`/blog/${post.slug}`)
        routes.push(`/en/blog/${post.slug}`)
        routes.push(`/es/blog/${post.slug}`)
      })
      return [
        '/blog', '/en/blog', '/es/blog',
        ...routes
      ]
    }
  } catch (e) {
  }
  return ['/blog', '/en/blog', '/es/blog']
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
    urls: getPostRoutes,
    sitemaps: {
      pages: {
        includeAppSources: true,
        exclude: [
          '/blog', '/blog/**',
          '/en/blog', '/en/blog/**',
          '/es/blog', '/es/blog/**'
        ]
      },
      blog: {
        includeAppSources: true,
        include: [
          '/blog', '/blog/**',
          '/en/blog', '/en/blog/**',
          '/es/blog', '/es/blog/**'
        ]
      }
    }
  },

  i18n: {
    baseUrl: 'https://www.valepcd.com.br',
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
      title: 'Vale PCD | Acessibilidade para Empresas e Comunidade',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Conheça o Vale PCD: O maior projeto do Brasil sobre visibilidade e acessibilidade para pessoas com deficiência da comunidade LGBTQI+.' },
        { name: 'google-adsense-account', content: 'ca-pub-6260779513509504' },
        
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
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ],
      script: [
        {
          src: 'https://www.googletagmanager.com/gtag/js?id=G-ZT2YLE88PF',
          async: true
        },
        {
          children: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            
            gtag('consent', 'default', {
              'ad_storage': 'granted',
              'ad_user_data': 'granted',
              'ad_personalization': 'granted',
              'analytics_storage': 'granted'
            });
            
            gtag('js', new Date());
            gtag('config', 'G-ZT2YLE88PF', { send_page_view: false });
          `
        }
      ]
    }
  }
})

