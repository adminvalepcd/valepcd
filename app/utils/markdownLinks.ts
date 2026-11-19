/**
 * Helpers para links que abrem em outra janela dentro de HTML gerado a partir de Markdown
 * (blog e documentos institucionais). Mesmo ícone do componente NewWindowIcon.vue.
 */
const NEW_WINDOW_ICON_SVG =
  '<svg class="ext-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Monta um <a> seguro a partir de um link Markdown.
 * - Só aceita http(s), mailto, tel, caminhos relativos e âncoras (bloqueia javascript:, data: etc.).
 * - Links externos abrem em nova janela com ícone + aviso para leitor de tela.
 * - Links internos abrem na mesma janela.
 */
export function buildMarkdownLink(label: string, rawHref: string, newWindowText: string): string {
  const href = String(rawHref || '').trim()
  const isInternal = href.startsWith('/') || href.startsWith('#')
  const isSafeExternal = /^(https?:|mailto:|tel:)/i.test(href)

  if (!isInternal && !isSafeExternal) {
    return escapeText(label)
  }

  const opensNewWindow = /^https?:/i.test(href) && !/^https?:\/\/(www\.)?valepcd\.com\.br(\/|$)/i.test(href)
  if (!opensNewWindow) {
    return `<a href="${escapeAttr(href)}">${label}</a>`
  }

  return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${label}<span class="new-window-indicator">${NEW_WINDOW_ICON_SVG}<span class="sr-only">${escapeText(newWindowText)}</span></span></a>`
}
