<template>
  <div class="blog-page container">
    <section class="section" aria-labelledby="blog-title">
      <span class="badge">Nosso Espaço</span>
      <h1 id="blog-title" class="title">Blog <span class="gradient-text">Vale PCD</span></h1>
      <p class="lead text-muted">
        Explore artigos, notícias e discussões sobre acessibilidade digital, diversidade, direitos e visibilidade intersecional.
      </p>

      <!-- Search & Filters -->
      <div class="filters-bar glass" aria-label="Filtros do blog">
        <div class="search-group">
          <label for="search-input" class="sr-only">Buscar artigos</label>
          <input 
            type="text" 
            id="search-input" 
            v-model="searchQuery" 
            placeholder="Buscar por título ou conteúdo..."
            class="form-control"
          />
        </div>
        
        <div class="categories-group" role="group" aria-label="Categorias">
          <button 
            v-for="cat in ['Todos', 'Acessibilidade', 'LGBTQI+', 'Empresas', 'Comunidade']" 
            :key="cat"
            @click="selectedCategory = cat"
            class="filter-btn"
            :class="{ 'active': selectedCategory === cat }"
            :aria-pressed="(selectedCategory === cat).toString()"
          >
            {{ cat }}
          </button>
        </div>
      </div>

      <!-- Posts Grid -->
      <div v-if="filteredPosts.length > 0" class="grid-responsive posts-grid">
        <article 
          v-for="post in filteredPosts" 
          :key="post.slug" 
          class="post-card glass"
        >
          <!-- Capa -->
          <div class="card-image-wrapper">
            <img 
              :src="post.image || 'https://static.wixstatic.com/media/acd625_9e14ee4333ac4944b72c0ada48128725~mv2.jpg'" 
              alt=""
              class="post-image"
              aria-hidden="true"
            />
            <span class="post-category">{{ post.category }}</span>
          </div>

          <div class="post-body">
            <span class="post-date">{{ formatDate(post.date) }}</span>
            <h3>{{ post.title }}</h3>
            <p class="post-desc">{{ post.description }}</p>
            
            <NuxtLink :to="`/blog/${post.slug}`" class="btn btn-secondary btn-sm w-full text-center">
              Ler Artigo <span class="sr-only">completo: {{ post.title }}</span>
            </NuxtLink>
          </div>
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state glass text-center">
        <p class="empty-text">Nenhum artigo encontrado para a busca realizada.</p>
        <button @click="resetFilters" class="btn btn-primary btn-sm">
          Limpar Filtros
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Fetch posts dynamically using Nuxt data fetching
const { data: posts } = await useFetch('/api/posts', {
  default: () => []
})

const searchQuery = ref('')
const selectedCategory = ref('Todos')

const filteredPosts = computed(() => {
  if (!posts.value) return []
  return posts.value.filter((post) => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          post.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory = selectedCategory.value === 'Todos' || post.category === selectedCategory.value
    
    return matchesSearch && matchesCategory
  })
})

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = 'Todos'
}
</script>

<style scoped>
.blog-page {
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
  margin-bottom: 1.5rem;
}

/* Filter Bar */
.filters-bar {
  padding: 1.5rem;
  border-radius: var(--radius-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.search-group {
  flex: 1;
  min-width: 280px;
}

.form-control {
  width: 100%;
  padding: 0.8rem 1.2rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background-color: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 0.95rem;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary);
}

.categories-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1.2rem;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-btn:hover,
.filter-btn.active {
  background-color: var(--primary);
  border-color: var(--primary);
  color: white;
}

/* Posts Grid */
.posts-grid {
  margin-top: 1rem;
}

.post-card {
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-smooth), border-color var(--transition-fast);
}

.post-card:hover {
  transform: translateY(-6px);
  border-color: var(--primary);
}

.card-image-wrapper {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.post-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-smooth);
}

.post-card:hover .post-image {
  transform: scale(1.05);
}

.post-category {
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
  background-color: var(--primary);
  color: white;
  border-radius: var(--radius-full);
}

.post-body {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex-grow: 1;
}

.post-date {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

.post-body h3 {
  font-size: 1.35rem;
  line-height: 1.3;
}

.post-desc {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: auto;
}

.w-full {
  width: 100%;
}

.empty-state {
  padding: 4rem 2rem;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.empty-text {
  font-size: 1.15rem;
  color: var(--text-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
