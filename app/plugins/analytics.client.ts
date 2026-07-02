import { defineNuxtPlugin } from '#app'
import { useRouter } from '#imports'
import { nextTick } from 'vue'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  router.afterEach((to) => {
    // We use nextTick to ensure the DOM (specifically <title>) has been updated by Nuxt before triggering the page_view
    nextTick(() => {
      if (typeof window !== 'undefined') {
        if (window.gtag) {
          console.log('[Analytics] Triggering page_view for:', to.fullPath)
          window.gtag('event', 'page_view', {
            page_title: document.title,
            page_path: to.fullPath,
            page_location: window.location.href
          })
        } else {
          console.warn('[Analytics] window.gtag is not defined!')
        }
      }
    })
  })
})
