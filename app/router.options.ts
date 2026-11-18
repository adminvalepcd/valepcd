import type { RouterConfig } from '@nuxt/schema'
import { START_LOCATION, type RouteLocationNormalized } from 'vue-router'

type ScrollPosition = { left?: number; top?: number; el?: string; behavior?: ScrollBehavior } | false

/**
 * O Google Publisher Tag (anúncio premiado) altera a URL para hashes como `#goog_rewarded`
 * ao abrir o anúncio. Isso não é navegação do app: não deve disparar rolagem nem gerar
 * aviso do Vue Router por elemento inexistente.
 */
const isAdHash = (hash: string) => /^#goog_/i.test(hash || '')

// Só usa o hash como alvo se ele for um seletor válido e o elemento existir na página
const findHashElement = (hash: string): Element | null => {
  if (!hash || typeof document === 'undefined') return null
  try {
    return document.querySelector(hash)
  } catch {
    return null
  }
}

const getHashScrollMarginTop = (el: Element): number => {
  try {
    return Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0
  } catch {
    return 0
  }
}

const calculatePosition = (
  to: RouteLocationNormalized,
  savedPosition: { left: number; top: number } | null,
  behavior: ScrollBehavior
): ScrollPosition => {
  if (savedPosition) return savedPosition
  if (to.hash && !isAdHash(to.hash)) {
    const el = findHashElement(to.hash)
    if (el) return { el: to.hash, top: getHashScrollMarginTop(el), behavior }
  }
  return { left: 0, top: 0 }
}

// Mantém o comportamento padrão do Nuxt (topo da página ao trocar de rota, âncoras, posição salva
// ao voltar e espera da transição de página), adicionando a proteção contra hashes de anúncios.
export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    const behavior: ScrollBehavior = 'auto'

    if (isAdHash(to.hash) || isAdHash(from.hash)) return false

    if (to.path === from.path) {
      if (from.hash && !to.hash) return { left: 0, top: 0 }
      if (to.hash) {
        const el = findHashElement(to.hash)
        return el ? { el: to.hash, top: getHashScrollMarginTop(el), behavior } : false
      }
      return false
    }

    const scrollToTop =
      typeof to.meta.scrollToTop === 'function'
        ? (to.meta.scrollToTop as (a: RouteLocationNormalized, b: RouteLocationNormalized) => boolean)(to, from)
        : to.meta.scrollToTop
    if (scrollToTop === false) return false

    const nuxtApp = useNuxtApp()
    const hookToWait = (nuxtApp as any)._runningTransition ? 'page:transition:finish' : 'page:loading:end'

    return new Promise((resolve) => {
      if (from === START_LOCATION) {
        resolve(calculatePosition(to, savedPosition, behavior))
        return
      }
      nuxtApp.hooks.hookOnce(hookToWait as any, () => {
        requestAnimationFrame(() => resolve(calculatePosition(to, savedPosition, behavior)))
      })
    })
  }
}
