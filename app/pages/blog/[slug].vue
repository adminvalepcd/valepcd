<template>
  <div class="post-detail-page container">
    <article v-if="post" class="post-article" aria-labelledby="post-title">
      <!-- Back to blog -->
      <NuxtLink to="/blog" class="back-link">
        &larr; Voltar para o Blog
      </NuxtLink>

      <!-- Header info -->
      <header class="post-header">
        <span class="badge">{{ post.category }}</span>
        <h1 id="post-title" class="post-title">{{ post.title }}</h1>
        
        <div class="post-meta">
          <span class="meta-item">Por: <strong>{{ post.author }}</strong></span>
          <span class="meta-separator" aria-hidden="true">&bull;</span>
          <span class="meta-item">Publicado em: <strong>{{ formatDate(post.date) }}</strong></span>
        </div>
      </header>

      <!-- Cover Image -->
      <div class="post-cover-wrapper">
        <img 
          :src="post.image || 'https://static.wixstatic.com/media/acd625_9e14ee4333ac4944b72c0ada48128725~mv2.jpg'" 
          :alt="`Imagem de capa do artigo: ${post.title}`"
          class="post-cover-image"
        />
      </div>

      <!-- Content Body -->
      <div class="post-content-body glass">
        <!-- white-space: pre-wrap handles paragraph spacing elegantly -->
        <div class="markdown-content">{{ post.content }}</div>
      </div>
    </article>

    <!-- 404 State -->
    <div v-else class="empty-state glass text-center">
      <h2>Artigo Não Encontrado</h2>
      <p class="text-muted">O artigo que você está procurando não existe ou foi movido.</p>
      <NuxtLink to="/blog" class="btn btn-primary btn-sm">
        Voltar para o Blog
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const slug = route.params.slug

// Fetch all posts and find the correct one matching the slug
const { data: posts } = await useFetch('/api/posts')

const post = computed(() => {
  if (!posts.value) return null
  return posts.value.find(p => p.slug === slug) || null
})

// Dynamic SEO Metadados
useSeoMeta({
  title: () => post.value ? `${post.value.title} | Blog Vale PCD` : 'Artigo não encontrado | Vale PCD',
  ogTitle: () => post.value ? `${post.value.title} | Blog Vale PCD` : 'Artigo não encontrado',
  description: () => post.value ? post.value.description : 'Leia nosso blog sobre acessibilidade.',
  ogDescription: () => post.value ? post.value.description : 'Leia nosso blog sobre acessibilidade.',
  ogImage: () => post.value ? post.value.image : undefined
})

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
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
  white-space: pre-wrap;
  color: var(--text);
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
