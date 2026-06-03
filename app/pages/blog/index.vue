<template>
  <div class="blog-page container">
    <AppSeo :title="$t('seo.blog.title')" :description="$t('seo.blog.description')" />
    <section class="section" aria-labelledby="blog-title">
      <span class="badge">{{ $t('blog.badge') }}</span>
      <h1 id="blog-title" class="title">
        {{ $t('blog.title1') }}<span class="gradient-text">{{ $t('blog.titleHighlight') }}</span>
      </h1>
      <p class="lead text-muted">
        {{ $t('blog.lead') }}
      </p>

      <!-- Search & Filters -->
      <div class="filters-bar glass" :aria-label="$t('blog.badge')">
        <div class="search-group">
          <label for="search-input" class="sr-only">{{ $t('blog.searchPlaceholder') }}</label>
          <input 
            type="text" 
            id="search-input" 
            v-model="searchQuery" 
            :placeholder="$t('blog.searchPlaceholder')"
            class="form-control"
          />
        </div>
        
        <div class="categories-group" role="group" :aria-label="$t('blog.badge')">
          <button 
            v-for="cat in ['Todos', 'Acessibilidade', 'LGBTQI+', 'Empresas', 'Comunidade']" 
            :key="cat"
            @click="selectedCategory = cat"
            class="filter-btn"
            :class="{ 'active': selectedCategory === cat }"
            :aria-pressed="(selectedCategory === cat).toString()"
          >
            {{ getCategoryLabel(cat) }}
          </button>
        </div>
      </div>

      <!-- Posts Grid -->
      <div v-if="paginatedPosts.length > 0" class="grid-responsive posts-grid">
        <article 
          v-for="post in paginatedPosts" 
          :key="post.slug" 
          class="post-card glass"
        >
          <!-- Capa -->
          <div class="card-image-wrapper">
            <img 
              :src="post.image || '/images/logo-vale-pcd-seo.webp'" 
              alt=""
              class="post-image"
              aria-hidden="true"
            />
            <span class="post-category">{{ getCategoryLabel(post.category) }}</span>
          </div>

          <div class="post-body">
            <span class="post-date">{{ formatDate(post.date) }}</span>
            <h3>{{ post.title }}</h3>
            <p class="post-desc">{{ post.description }}</p>
            
            <NuxtLink :to="localePath('/blog/' + post.slug)" class="btn btn-secondary btn-sm w-full text-center">
              {{ $t('blog.readMore') }} <span class="sr-only">completo: {{ post.title }}</span>
            </NuxtLink>
          </div>
        </article>
      </div>

      <!-- Pagination Controls -->
      <nav v-if="totalPages > 1" class="pagination-container" aria-label="Paginação do blog">
        <button 
          class="pagination-btn glass" 
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
          :aria-label="$t('blog.prevPage')"
        >
          <span aria-hidden="true">&larr;</span> {{ $t('blog.prevPage') }}
        </button>
        
        <div class="page-numbers">
          <button 
            v-for="(page, index) in displayedPages" 
            :key="index"
            class="page-number-btn glass"
            :class="{ 'active': currentPage === page, 'dots': page === '...' }"
            :disabled="page === '...'"
            @click="goToPage(page)"
            :aria-current="currentPage === page ? 'page' : undefined"
            :aria-label="page === '...' ? undefined : 'Página ' + page"
          >
            {{ page }}
          </button>
        </div>

        <button 
          class="pagination-btn glass" 
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
          :aria-label="$t('blog.nextPage')"
        >
          {{ $t('blog.nextPage') }} <span aria-hidden="true">&rarr;</span>
        </button>
      </nav>

      <!-- Empty State -->
      <div v-else class="empty-state glass text-center">
        <p class="empty-text">{{ $t('blog.noArticles') }}</p>
        <button @click="resetFilters" class="btn btn-primary btn-sm">
          {{ $t('blog.clearFilters') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()

// Fetch posts dynamically using Nuxt data fetching
const { data: posts } = await useFetch('/api/posts', {
  default: () => []
})

const searchQuery = ref(route.query.q || '')
const selectedCategory = ref('Todos')
const currentPage = ref(1)
const postsPerPage = 6

watch(() => route.query.q, (newQuery) => {
  searchQuery.value = newQuery || ''
})

const filteredPosts = computed(() => {
  if (!posts.value) return []
  return posts.value.filter((post) => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          post.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory = selectedCategory.value === 'Todos' || post.category === selectedCategory.value
    
    return matchesSearch && matchesCategory
  })
})

// Reset current page to 1 when the search query or category filter changes
watch([searchQuery, selectedCategory], () => {
  currentPage.value = 1
})

const totalPages = computed(() => {
  return Math.ceil(filteredPosts.value.length / postsPerPage)
})

const paginatedPosts = computed(() => {
  const start = (currentPage.value - 1) * postsPerPage
  const end = start + postsPerPage
  return filteredPosts.value.slice(start, end)
})

const displayedPages = computed(() => {
  const pages = []
  const maxVisible = 5
  if (totalPages.value <= maxVisible) {
    for (let i = 1; i <= totalPages.value; i++) {
      pages.push(i)
    }
  } else {
    let start = Math.max(2, currentPage.value - 1)
    let end = Math.min(totalPages.value - 1, currentPage.value + 1)
    
    pages.push(1)
    if (start > 2) {
      pages.push('...')
    }
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (end < totalPages.value - 1) {
      pages.push('...')
    }
    pages.push(totalPages.value)
  }
  return pages
})

const goToPage = (page) => {
  if (page === '...' || page < 1 || page > totalPages.value) return
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
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

/* Pagination Controls */
.pagination-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 3rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.pagination-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-full);
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 0.9rem;
  border: 1px solid var(--border);
  background-color: rgba(255, 255, 255, 0.03);
  color: var(--text);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pagination-btn:hover:not(:disabled) {
  background-color: var(--primary);
  border-color: var(--primary);
  color: white;
  transform: translateY(-2px);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.page-numbers {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.page-number-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 0.9rem;
  border: 1px solid var(--border);
  background-color: rgba(255, 255, 255, 0.03);
  color: var(--text);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.page-number-btn:hover:not(.dots):not(.active) {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: var(--primary);
  color: var(--text);
  transform: translateY(-2px);
}

.page-number-btn.active {
  background-color: var(--primary);
  border-color: var(--primary);
  color: white;
}

.page-number-btn.dots {
  border-color: transparent;
  background-color: transparent;
  cursor: default;
}
</style>
