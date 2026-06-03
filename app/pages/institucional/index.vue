<template>
  <div class="institutional-page container">
    <AppSeo :title="$t('seo.institutional.title')" :description="$t('seo.institutional.description')" />
    <section class="section" aria-labelledby="institutional-title">
      <span class="badge">{{ $t('institutional.badge') }}</span>
      <h1 id="institutional-title" class="title">
        {{ $t('institutional.title') }} <span class="gradient-text">{{ $t('institutional.titleHighlight') }}</span>
      </h1>
      <p class="lead text-muted">
        {{ $t('institutional.lead') }}
      </p>

      <!-- Documents List -->
      <div v-if="documents && documents.length > 0" class="documents-list">
        <article 
          v-for="doc in documents" 
          :key="doc.slug" 
          class="document-card glass"
          :class="{ 'expanded': activeDocumentSlug === doc.slug, 'no-expand': !doc.content }"
        >
          <div 
            class="document-header" 
            @click="doc.content ? toggleDocument(doc.slug) : null"
            :style="!doc.content ? 'cursor: default' : ''"
          >
            <div class="header-main">
              <span class="document-date">{{ $t('institutional.dateLabel') }}: <strong>{{ formatDate(doc.date) }}</strong></span>
              <h3 class="document-title">{{ doc.title }}</h3>
              <p class="document-desc text-muted">{{ doc.description }}</p>
            </div>
            
            <div class="header-actions">
              <!-- Direct PDF download button if no expandable text content -->
              <a 
                v-if="!doc.content && doc.file" 
                :href="doc.file" 
                target="_blank" 
                download 
                class="btn btn-secondary btn-sm inline-flex"
                @click.stop
              >
                📄 {{ $t('institutional.downloadPdf') }} <span class="sr-only">{{ $t('institutional.downloadPdfContext', { title: doc.title }) }}</span>
              </a>
              
              <!-- Chevron button if there is expandable content -->
              <button 
                v-else-if="doc.content"
                class="action-toggle-btn"
                :aria-expanded="(activeDocumentSlug === doc.slug).toString()"
                :aria-label="$t('institutional.readDocument') + ': ' + doc.title"
              >
                <span class="chevron-icon" :class="{ 'rotated': activeDocumentSlug === doc.slug }">▼</span>
              </button>
            </div>
          </div>

          <!-- Expanded Markdown Body (Only rendered if document has content) -->
          <div v-if="doc.content && activeDocumentSlug === doc.slug" class="document-body-wrapper">
            <div class="document-content glass">
              <div class="markdown-content" v-html="parseMarkdownToHtml(doc.content)"></div>
            </div>

            <div class="document-actions-footer" v-if="doc.file">
              <a :href="doc.file" target="_blank" download class="btn btn-secondary btn-sm">
                📄 {{ $t('institutional.downloadPdf') }} <span class="sr-only">{{ $t('institutional.downloadPdfContext', { title: doc.title }) }}</span>
              </a>
            </div>
          </div>
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state glass text-center">
        <p class="empty-text">{{ $t('institutional.noDocuments') }}</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Fetch dynamic institutional documents list
const { data: documents } = await useFetch('/api/institucional', {
  default: () => []
})

const activeDocumentSlug = ref(null)

const toggleDocument = (slug) => {
  if (activeDocumentSlug.value === slug) {
    activeDocumentSlug.value = null
  } else {
    activeDocumentSlug.value = slug
  }
}

const formatDate = (dateStr) => {
  const localeMap = {
    pt: 'pt-BR',
    en: 'en-US',
    es: 'es-ES'
  }
  return new Date(dateStr).toLocaleDateString(localeMap[locale.value] || 'pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

// Helper Markdown to HTML parsing methods
const parseInlineMarkdown = (text) => {
  let html = text
  
  // Images: ![alt](src) -> <img src="src" alt="alt" class="content-image" />
  html = html.replace(/!\[([^\]]*?)\]\(([^)]+?)\)/g, '<img src="$2" alt="$1" class="content-image" />')
  
  // Normal links: [text](url) -> <a href="$2" target="_blank" rel="noopener">$1</a>
  html = html.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  
  // Bold: **text** -> <strong>text</strong>
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  
  // Italic: *text* -> <em>text</em>
  html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>')
  
  return html
}

const parseMarkdownToHtml = (md) => {
  if (!md) return ''
  
  const lines = md.split('\n')
  const htmlResult = []
  let inList = false
  let listType = ''
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    
    // Empty line closes lists
    if (line === '') {
      if (inList) {
        htmlResult.push(`</${listType}>`)
        inList = false
      }
      continue
    }
    
    // Headings
    if (line.startsWith('#')) {
      if (inList) {
        htmlResult.push(`</${listType}>`)
        inList = false
      }
      const levelMatch = line.match(/^#+/)
      const level = levelMatch ? levelMatch[0].length : 1
      const text = line.replace(/^#+\s+/, '')
      htmlResult.push(`<h${level}>${parseInlineMarkdown(text)}</h${level}>`)
      continue
    }
    
    // Unordered lists
    const ulMatch = line.match(/^[-*]\s+(.+)/)
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) htmlResult.push(`</${listType}>`)
        htmlResult.push('<ul>')
        inList = true
        listType = 'ul'
      }
      htmlResult.push(`<li>${parseInlineMarkdown(ulMatch[1])}</li>`)
      continue
    }
    
    // Ordered lists
    const olMatch = line.match(/^\d+\.\s+(.+)/)
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) htmlResult.push(`</${listType}>`)
        htmlResult.push('<ol>')
        inList = true
        listType = 'ol'
      }
      htmlResult.push(`<li>${parseInlineMarkdown(olMatch[1])}</li>`)
      continue
    }
    
    // Normal paragraph
    if (inList) {
      htmlResult.push(`</${listType}>`)
      inList = false
    }
    htmlResult.push(`<p>${parseInlineMarkdown(line)}</p>`)
  }
  
  if (inList) {
    htmlResult.push(`</${listType}>`)
  }
  
  return htmlResult.join('\n')
}
</script>

<style scoped>
.institutional-page {
  padding-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.title {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.lead {
  font-size: 1.25rem;
  max-width: 800px;
  line-height: 1.6;
  margin-bottom: 2rem;
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.document-card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: all var(--transition-smooth);
}

.document-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}

.document-header {
  padding: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  gap: 2rem;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-grow: 1;
}

.document-date {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.document-title {
  font-size: 1.35rem;
  line-height: 1.3;
  font-weight: 700;
  color: var(--text);
}

.document-desc {
  font-size: 0.95rem;
  line-height: 1.5;
  margin-top: 0.25rem;
}

.inline-flex {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.action-toggle-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.action-toggle-btn:hover {
  background-color: var(--primary-muted);
  border-color: var(--primary);
}

.chevron-icon {
  font-size: 0.8rem;
  transition: transform var(--transition-smooth);
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

/* Expanded content section */
.document-body-wrapper {
  padding: 0 2rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  border-top: 1px dashed var(--border);
  margin-top: -0.5rem;
  padding-top: 2rem;
}

.document-content {
  padding: 2.5rem;
  border-radius: var(--radius-md);
  line-height: 1.8;
  font-size: 1.05rem;
}

.document-actions-footer {
  display: flex;
  justify-content: flex-start;
}

.empty-state {
  padding: 4rem 2rem;
  border-radius: var(--radius-lg);
}

.empty-text {
  font-size: 1.15rem;
  color: var(--text-muted);
}

/* Content rich markdown rendering rules */
.markdown-content {
  color: var(--text);
}

.markdown-content :deep(p) {
  margin-bottom: 1.2rem;
  font-size: 1.05rem;
  line-height: 1.7;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin-top: 2rem;
  margin-bottom: 1rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
}

.markdown-content :deep(h1) { font-size: 1.75rem; }
.markdown-content :deep(h2) { font-size: 1.5rem; }
.markdown-content :deep(h3) { font-size: 1.3rem; }

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-bottom: 1.2rem;
  padding-left: 1.5rem;
}

.markdown-content :deep(li) {
  margin-bottom: 0.4rem;
  font-size: 1.05rem;
  line-height: 1.7;
}

.markdown-content :deep(a) {
  color: var(--primary);
  text-decoration: underline;
  font-weight: 600;
  transition: color var(--transition-fast);
}

.markdown-content :deep(a:hover) {
  color: var(--primary-hover);
}
</style>
