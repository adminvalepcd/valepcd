import { defineNuxtPlugin } from '#app'
import { useRouter, useRuntimeConfig } from '#imports'
import { nextTick } from 'vue'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

const ADSENSE_CLIENT_PATTERN = /^ca-pub-\d{10,24}$/
let hasHydratedApp = false

const isAdExcludedRoute = (path: string) => {
  return String(path || '').toLowerCase().includes('/multei/painel')
}

const isMulteiMapRoute = (path: string) => {
  return /^(?:\/(?:en|es))?\/multei\/?$/i.test(String(path || '').trim())
}

const isInsideIframe = () => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top
  } catch {
    return true
  }
}

export type MulteiConsentChoice = 'all' | 'essentials'
export const MULTEI_CONSENT_COOKIE_NAME = 'multei_consent'
export const MULTEI_CONSENT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 dias (1 mês)

export const getMulteiConsent = (): MulteiConsentChoice | null => {
  if (typeof document === 'undefined') return null
  try {
    const match = document.cookie.match(/(?:^|;\s*)multei_consent=(all|essentials)(?:;|$)/)
    return match ? (match[1] as MulteiConsentChoice) : null
  } catch {
    return null
  }
}

export const setMulteiConsent = (choice: MulteiConsentChoice): void => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  if (choice !== 'all' && choice !== 'essentials') return

  const expiry = new Date(Date.now() + MULTEI_CONSENT_MAX_AGE_SECONDS * 1000)
  const isSecure =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  const secureAttr = isSecure ? '; Secure' : ''

  document.cookie = `${MULTEI_CONSENT_COOKIE_NAME}=${choice}; Max-Age=${MULTEI_CONSENT_MAX_AGE_SECONDS}; Expires=${expiry.toUTCString()}; Path=/; SameSite=Lax${secureAttr}`

  try {
    window.localStorage?.removeItem(MULTEI_CONSENT_COOKIE_NAME)
  } catch {}
}

export const hasMulteiNonEssentialConsent = () => {
  if (typeof window === 'undefined') return false
  if (isInsideIframe()) return true
  return getMulteiConsent() === 'all'
}

/**
 * Antes da hidratação do Vue (`vueApp.mount('#__nuxt')`), remove nós injetados por snapshots/proxies
 * (como o Visualizador do AdSense ou widgets externos de uma renderização anterior) dentro de `#__nuxt`,
 * evitando mismatch de hidratação e duplicação da página inteira.
 */
const sanitizeNuxtContainerBeforeHydration = () => {
  if (typeof document === 'undefined') return
  const nuxtRoot = document.getElementById('__nuxt')
  if (!nuxtRoot) return

  nuxtRoot
    .querySelectorAll('.google-auto-placed, ins.adsbygoogle:not(.manual-adsense-ins), [data-ad-preview]')
    .forEach((node) => {
      node.remove()
    })

  const vlibrasPluginWrapper = nuxtRoot.querySelector('[vw-plugin-wrapper]')
  if (vlibrasPluginWrapper && vlibrasPluginWrapper.children.length > 1) {
    const topWrapper = document.createElement('div')
    topWrapper.className = 'vw-plugin-top-wrapper'
    vlibrasPluginWrapper.replaceChildren(topWrapper)
  }
}

/**
 * Remove eventuais blocos duplicados deixados caso um proxy externo (como o preview de áreas excluídas do AdSense)
 * tenha removido comentários SSR e forçado remontagem parcial dentro de `<main id="main-content">`.
 */
const deduplicateMainContentClones = () => {
  if (typeof document === 'undefined') return
  const mainEl = document.getElementById('main-content')
  if (!mainEl) return

  const pageChildren = Array.from(mainEl.children).filter(
    (el) =>
      !el.classList.contains('google-auto-placed') &&
      !el.classList.contains('adsbygoogle') &&
      el.tagName.toLowerCase() !== 'ins'
  )

  if (pageChildren.length > 1) {
    // Quando o Vue falha em hidratar um container sem comentários SSR, ele insere o novo nó vivo antes do antigo
    // ou ao final; preservamos apenas o primeiro elemento vivo caso tenham o mesmo seletor estrutural, removendo clones órfãos.
    const seenSignatures = new Set<string>()
    for (const el of pageChildren) {
      const sig = `${el.tagName}:${el.className}`
      if (seenSignatures.has(sig)) {
        el.remove()
      } else {
        seenSignatures.add(sig)
      }
    }
  }
}

export const ensureAdSenseScriptLoaded = (rawClient: unknown) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const client = String(rawClient || '').trim()
  if (!ADSENSE_CLIENT_PATTERN.test(client)) return

  const existing = document.querySelector(
    'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
  )
  if (existing) return

  const script = document.createElement('script')
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
  script.async = true
  script.crossOrigin = 'anonymous'
  script.setAttribute('data-overlays', 'bottom')
  document.head.appendChild(script)
}

export const syncAdSenseSuppressionForPath = (path: string, adsenseClient?: unknown) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const awaitingMulteiConsent = isMulteiMapRoute(path) && !hasMulteiNonEssentialConsent()
  const shouldSuppress = isAdExcludedRoute(path) || awaitingMulteiConsent
  const htmlEl = document.documentElement
  const bodyEl = document.body

  if (shouldSuppress) {
    if (htmlEl && !htmlEl.classList.contains('ads-suppressed')) {
      htmlEl.classList.add('ads-suppressed')
    }
    if (bodyEl && !bodyEl.classList.contains('ads-suppressed')) {
      bodyEl.classList.add('ads-suppressed')
    }

    if (bodyEl) {
      if (bodyEl.style.paddingBottom && bodyEl.style.paddingBottom !== '0px') {
        bodyEl.style.paddingBottom = '0px'
      }
      if (bodyEl.style.paddingTop && bodyEl.style.paddingTop !== '0px') {
        bodyEl.style.paddingTop = '0px'
      }
    }

    const adElements = document.querySelectorAll(
      'ins.adsbygoogle, .adsbygoogle, .adsbygoogle-noablate, .google-auto-placed, [data-anchor-status], [data-ad-status], [data-vignette-loaded], div[id^="google_ads_iframe"], iframe[id^="aswift_"], div[id^="aswift_"]'
    )
    adElements.forEach((node) => {
      const rootAdContainer =
        node.closest('ins.adsbygoogle, .adsbygoogle-noablate, .google-auto-placed, [data-anchor-status]') || node
      if (rootAdContainer instanceof HTMLElement) {
        rootAdContainer.remove()
      }
    })
  } else {
    if (htmlEl && htmlEl.classList.contains('ads-suppressed')) {
      htmlEl.classList.remove('ads-suppressed')
    }
    if (bodyEl && bodyEl.classList.contains('ads-suppressed')) {
      bodyEl.classList.remove('ads-suppressed')
    }
    if (hasHydratedApp && adsenseClient) {
      ensureAdSenseScriptLoaded(adsenseClient)
    }
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const runtimeConfig = useRuntimeConfig()
  const adsenseClient = runtimeConfig.public?.adsenseClient

  if (typeof window !== 'undefined') {
    sanitizeNuxtContainerBeforeHydration()
    syncAdSenseSuppressionForPath(window.location.pathname, adsenseClient)
  }

  nuxtApp.hook('app:mounted', () => {
    hasHydratedApp = true
    nextTick(() => {
      deduplicateMainContentClones()
      if (typeof window !== 'undefined') {
        syncAdSenseSuppressionForPath(window.location.pathname, adsenseClient)
      }
    })
  })

  router.beforeEach((to) => {
    syncAdSenseSuppressionForPath(to.path, adsenseClient)
  })

  router.afterEach((to) => {
    syncAdSenseSuppressionForPath(to.path, adsenseClient)

    // We use nextTick to ensure the DOM (specifically <title>) has been updated by Nuxt before triggering the page_view
    nextTick(() => {
      syncAdSenseSuppressionForPath(to.path, adsenseClient)
      if (
        typeof window !== 'undefined' &&
        window.gtag &&
        (!isMulteiMapRoute(to.path) || hasMulteiNonEssentialConsent())
      ) {
        window.gtag('event', 'page_view', {
          page_title: document.title,
          page_path: to.fullPath,
          page_location: window.location.href
        })
      }
    })
  })
})

