import { defineNuxtPlugin } from '#app'
import { useRouter } from '#imports'
import { nextTick } from 'vue'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

const isAdExcludedRoute = (path: string) => {
  return String(path || '').toLowerCase().includes('/multei/painel')
}

export const syncAdSenseSuppressionForPath = (path: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const shouldSuppress = isAdExcludedRoute(path)
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
  }
}

export default defineNuxtPlugin(() => {
  const router = useRouter()

  if (typeof window !== 'undefined') {
    syncAdSenseSuppressionForPath(window.location.pathname)
  }

  router.beforeEach((to) => {
    syncAdSenseSuppressionForPath(to.path)
  })

  router.afterEach((to) => {
    syncAdSenseSuppressionForPath(to.path)

    // We use nextTick to ensure the DOM (specifically <title>) has been updated by Nuxt before triggering the page_view
    nextTick(() => {
      syncAdSenseSuppressionForPath(to.path)
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'page_view', {
          page_title: document.title,
          page_path: to.fullPath,
          page_location: window.location.href
        })
      }
    })
  })
})

