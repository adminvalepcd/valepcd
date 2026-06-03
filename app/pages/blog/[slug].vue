<template>
  <div class="post-detail-page container">
    <AppSeo
      :title="post ? `${post.title} | Blog Vale PCD` : `${$t('blog.notFoundTitle')} | Vale PCD`"
      :description="post ? post.description : $t('blog.lead')"
      :image="post ? post.image : undefined"
      type="article"
    />
    <article v-if="post" class="post-article" aria-labelledby="post-title">
      <!-- Back to blog -->
      <NuxtLink :to="localePath('/blog')" class="back-link">
        &larr; {{ $t('blog.backToBlog') }}
      </NuxtLink>

      <!-- Header info -->
      <header class="post-header">
        <span class="badge">{{ getCategoryLabel(post.category) }}</span>
        <h1 id="post-title" class="post-title">{{ post.title }}</h1>
        
        <div class="post-meta">
          <span class="meta-item">{{ $t('blog.authorLabel') }}: <strong>{{ post.author }}</strong></span>
          <span class="meta-separator" aria-hidden="true">&bull;</span>
          <span class="meta-item">{{ $t('blog.publishedAt') }}: <strong>{{ formatDate(post.date) }}</strong></span>
        </div>
      </header>

      <!-- Cover Image -->
      <div class="post-cover-wrapper">
        <img 
          :src="post.image || '/images/logo-vale-pcd-seo.webp'" 
          :alt="post.title"
          class="post-cover-image"
        />
      </div>

      <!-- Content Body -->
      <div class="post-content-body glass">
        <div class="markdown-content" v-html="parsedHtmlContent"></div>
      </div>
    </article>

    <!-- 404 State -->
    <div v-else class="empty-state glass text-center">
      <h2>{{ $t('blog.notFoundTitle') }}</h2>
      <p class="text-muted">{{ $t('blog.notFoundDesc') }}</p>
      <NuxtLink :to="localePath('/blog')" class="btn btn-primary btn-sm">
        {{ $t('blog.backToBlog') }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const slug = route.params.slug

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Fetch all posts and find the correct one matching the slug
const { data: posts } = await useFetch('/api/posts')

const post = computed(() => {
  if (!posts.value) return null
  return posts.value.find(p => p.slug === slug) || null
})

// Função de parsing de Markdown para HTML nativo
const parseInlineMarkdown = (text) => {
  let html = text;
  
  // Imagens: ![alt](src) -> <img src="src" alt="alt" class="content-image" />
  html = html.replace(/!\[([^\]]*?)\]\(([^)]+?)\)/g, '<img src="$2" alt="$1" class="content-image" />');
  
  // Links de Hashtags: [#pracegover](url) -> <a href="/blog?q=%23pracegover" class="hashtag-pill">#pracegover</a>
  html = html.replace(/\[(#[a-zA-Z0-9_-]+?)\]\(([^)]+?)\)/g, (match, hashtag) => {
    return `<a href="/blog?q=${encodeURIComponent(hashtag)}" class="hashtag-pill">${hashtag}</a>`;
  });
  
  // Links normais: [text](url) -> <a href="url" target="_blank" rel="noopener">$1</a>
  html = html.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // Negrito: **text** -> <strong>text</strong>
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  
  // Itálico: *text* -> <em>text</em>
  html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  
  return html;
}

const parseMarkdownToHtml = (md) => {
  if (!md) return '';
  
  const lines = md.split('\n');
  const htmlResult = [];
  let inList = false;
  let listType = ''; // 'ul' ou 'ol'
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Linha vazia fecha listas abertas
    if (line === '') {
      if (inList) {
        htmlResult.push(`</${listType}>`);
        inList = false;
      }
      continue;
    }
    
    // Renderiza iframes de vídeos do YouTube inline
    if (line.startsWith('<iframe') && line.endsWith('</iframe>')) {
      if (inList) {
        htmlResult.push(`</${listType}>`);
        inList = false;
      }
      htmlResult.push(line);
      continue;
    }
    
    // Cabeçalhos
    if (line.startsWith('#')) {
      if (inList) {
        htmlResult.push(`</${listType}>`);
        inList = false;
      }
      const levelMatch = line.match(/^#+/);
      const level = levelMatch ? levelMatch[0].length : 1;
      const text = line.replace(/^#+\s+/, '');
      htmlResult.push(`<h${level}>${parseInlineMarkdown(text)}</h${level}>`);
      continue;
    }
    
    // Listas não ordenadas
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) htmlResult.push(`</${listType}>`);
        htmlResult.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      htmlResult.push(`<li>${parseInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }
    
    // Listas ordenadas
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) htmlResult.push(`</${listType}>`);
        htmlResult.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      htmlResult.push(`<li>${parseInlineMarkdown(olMatch[1])}</li>`);
      continue;
    }
    
    // Parágrafo normal
    if (inList) {
      htmlResult.push(`</${listType}>`);
      inList = false;
    }
    htmlResult.push(`<p>${parseInlineMarkdown(line)}</p>`);
  }
  
  if (inList) {
    htmlResult.push(`</${listType}>`);
  }
  
  return htmlResult.join('\n');
}

const parsedHtmlContent = computed(() => {
  return post.value ? parseMarkdownToHtml(post.value.content) : '';
})

// Dynamic SEO Metadados handled by AppSeo component in template

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

const getCategoryLabel = (cat) => {
  const categoryMap = {
    'Todos': 'blog.all',
    'Acessibilidade': 'blog.accessibility',
    'LGBTQI+': 'blog.lgbt',
    'Empresas': 'blog.corporate',
    'Comunidade': 'blog.community'
  }
  const key = categoryMap[cat]
  return key ? t(key) : cat
}
</script>

<style scoped>
.post-detail-page {
  padding-top: 2rem;
  max-width: 800px;
}

.post-article {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.back-link {
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  color: var(--primary);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform var(--transition-fast);
}

.back-link:hover {
  transform: translateX(-4px);
  color: var(--primary-hover);
}

.post-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
}

.post-title {
  font-size: clamp(2rem, 4vw, 2.8rem);
  line-height: 1.2;
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.95rem;
  color: var(--text-muted);
  flex-wrap: wrap;
}

.meta-separator {
  color: var(--border);
}

.post-cover-wrapper {
  border-radius: var(--radius-lg);
  overflow: hidden;
  max-height: 400px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border);
}

.post-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-content-body {
  padding: 3rem;
  border-radius: var(--radius-lg);
  line-height: 1.8;
  font-size: 1.1rem;
}

@media (max-width: 600px) {
  .post-content-body {
    padding: 2rem 1.5rem;
  }
}

.markdown-content {
  color: var(--text);
}

.markdown-content :deep(p) {
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
  line-height: 1.8;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin-top: 2.5rem;
  margin-bottom: 1.25rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
}

.markdown-content :deep(h1) { font-size: 2rem; }
.markdown-content :deep(h2) { font-size: 1.75rem; }
.markdown-content :deep(h3) { font-size: 1.5rem; }

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-bottom: 1.5rem;
  padding-left: 1.5rem;
}

.markdown-content :deep(li) {
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  line-height: 1.8;
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

.markdown-content :deep(.hashtag-pill) {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  background-color: rgba(134, 0, 125, 0.08); /* roxo sutil e transparente */
  color: var(--primary, #86007d) !important;
  border: 1px solid rgba(134, 0, 125, 0.15);
  border-radius: 999px;
  text-decoration: none !important;
  transition: all 0.2s ease;
  margin: 0 0.2rem;
}

.markdown-content :deep(.hashtag-pill:hover) {
  background-color: var(--primary, #86007d) !important;
  color: white !important;
  border-color: var(--primary, #86007d);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(134, 0, 125, 0.2);
}

.markdown-content :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-md);
  margin: 2rem auto;
  display: block;
  box-shadow: var(--shadow-sm);
}

.empty-state {
  padding: 4rem 2rem;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}
</style>
