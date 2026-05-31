<template>
  <header class="app-header glass" role="banner">
    <div class="container header-container">
      <!-- Logo Brand -->
      <NuxtLink to="/" class="logo-container" aria-label="Vale PCD - Ir para a página inicial">
        <img 
          src="/images/logo Vale PcD.png" 
          alt="Logo Vale PCD"
          class="logo-img"
        />
      </NuxtLink>

      <!-- Desktop Navigation -->
      <nav class="nav-menu" role="navigation" aria-label="Menu principal">
        <ul class="nav-list">
          <li><NuxtLink to="/" class="nav-link" active-class="active">Início</NuxtLink></li>
          <li><NuxtLink to="/sobre" class="nav-link" active-class="active">Sobre Nós</NuxtLink></li>
          <li><NuxtLink to="/servicos" class="nav-link" active-class="active">Serviços</NuxtLink></li>
          <li><NuxtLink to="/blog" class="nav-link" active-class="active">Blog</NuxtLink></li>
          <li><NuxtLink to="/contato" class="nav-link" active-class="active">Contato</NuxtLink></li>
        </ul>
      </nav>

      <!-- Accessibility & Theme Controls -->
      <div class="toolbar" aria-label="Ferramentas de Acessibilidade" role="toolbar">
        <button 
          @click="toggleContrast" 
          class="toolbar-btn btn-contrast" 
          title="Alternar Alto Contraste"
          aria-label="Alternar Alto Contraste"
        >
          🌓
        </button>
        <button 
          @click="changeFontSize(1)" 
          class="toolbar-btn btn-font-up" 
          title="Aumentar Fonte" 
          aria-label="Aumentar tamanho do texto"
        >
          A+
        </button>
        <button 
          @click="changeFontSize(-1)" 
          class="toolbar-btn btn-font-down" 
          title="Diminuir Fonte" 
          aria-label="Diminuir tamanho do texto"
        >
          A-
        </button>
      </div>

      <!-- Mobile Menu Toggle -->
      <button 
        @click="mobileMenuOpen = !mobileMenuOpen" 
        class="mobile-toggle" 
        :aria-expanded="mobileMenuOpen.toString()"
        aria-controls="mobile-navigation"
        aria-label="Abrir menu de navegação"
      >
        <span class="hamburger-bar" :class="{ 'open': mobileMenuOpen }"></span>
      </button>
    </div>

    <!-- Mobile Navigation Dropdown -->
    <transition name="slide">
      <nav 
        v-if="mobileMenuOpen" 
        id="mobile-navigation" 
        class="mobile-nav glass"
        role="navigation"
        aria-label="Menu principal móvel"
      >
        <ul class="mobile-nav-list">
          <li><NuxtLink to="/" @click="mobileMenuOpen = false" class="mobile-nav-link">Início</NuxtLink></li>
          <li><NuxtLink to="/sobre" @click="mobileMenuOpen = false" class="mobile-nav-link">Sobre Nós</NuxtLink></li>
          <li><NuxtLink to="/servicos" @click="mobileMenuOpen = false" class="mobile-nav-link">Serviços</NuxtLink></li>
          <li><NuxtLink to="/blog" @click="mobileMenuOpen = false" class="mobile-nav-link">Blog</NuxtLink></li>
          <li><NuxtLink to="/contato" @click="mobileMenuOpen = false" class="mobile-nav-link">Contato</NuxtLink></li>
          <li><NuxtLink to="/admin" @click="mobileMenuOpen = false" class="mobile-nav-link font-bold">Painel CMS</NuxtLink></li>
        </ul>
      </nav>
    </transition>
  </header>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const mobileMenuOpen = ref(false)
const fontSizeLevel = ref(0) // Limits adjustment to up to 3 clicks (-3 to 3)

const toggleContrast = () => {
  if (process.client) {
    const html = document.documentElement
    const currentTheme = html.getAttribute('data-theme') || 'light'
    html.setAttribute('data-theme', currentTheme === 'light' ? 'dark' : 'light')
  }
}

const changeFontSize = (direction) => {
  if (process.client) {
    if (direction === 1 && fontSizeLevel.value < 3) {
      fontSizeLevel.value++
    } else if (direction === -1 && fontSizeLevel.value > -3) {
      fontSizeLevel.value--
    }
    
    const multiplier = 1 + (fontSizeLevel.value * 0.1)
    document.documentElement.style.fontSize = `${multiplier * 16}px`
  }
}
</script>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  border-top: none;
  border-left: none;
  border-right: none;
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 80px;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.logo-img {
  height: 56px;
  width: auto;
  object-fit: contain;
}

.nav-list {
  display: flex;
  list-style: none;
  gap: 2rem;
}

.nav-link {
  font-family: 'Poppins', sans-serif;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--text-muted);
  padding: 0.5rem 0.2rem;
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  transition: width var(--transition-smooth);
}

.nav-link:hover {
  color: var(--text);
}

.nav-link:hover::after,
.nav-link.active::after {
  width: 100%;
}

.nav-link.active {
  color: var(--text);
}

/* Toolbar Acessibilidade */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.toolbar-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text);
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background-color: var(--primary-muted);
  border-color: var(--primary);
  transform: scale(1.05);
}

.btn-sm {
  padding: 0.4rem 1.2rem;
  font-size: 0.88rem;
}

/* Mobile Controls */
.mobile-toggle {
  display: none;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
}

.hamburger-bar {
  display: block;
  width: 24px;
  height: 2px;
  background-color: var(--text);
  position: relative;
  transition: background-color var(--transition-fast);
}

.hamburger-bar::before,
.hamburger-bar::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 2px;
  background-color: var(--text);
  transition: transform var(--transition-smooth);
}

.hamburger-bar::before {
  top: -8px;
}

.hamburger-bar::after {
  bottom: -8px;
}

.hamburger-bar.open {
  background-color: transparent;
}

.hamburger-bar.open::before {
  transform: translateY(8px) rotate(45deg);
}

.hamburger-bar.open::after {
  transform: translateY(-8px) rotate(-45deg);
}

/* Responsive Layout styles */
@media (max-width: 960px) {
  .nav-menu, .desktop-only {
    display: none;
  }
  .mobile-toggle {
    display: flex;
  }
}

.mobile-nav {
  position: absolute;
  top: 80px;
  left: 0;
  width: 100%;
  padding: 1.5rem;
  box-shadow: var(--shadow-md);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  border-left: none;
  border-right: none;
  border-bottom: 1px solid var(--border);
}

.mobile-nav-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  list-style: none;
}

.mobile-nav-link {
  font-family: 'Poppins', sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
  display: block;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
}

.mobile-nav-link:hover {
  color: var(--primary);
  padding-left: 8px;
  transition: all var(--transition-fast);
}

.font-bold {
  font-weight: 800;
  color: var(--secondary);
}

/* Animações */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.30s var(--transition-smooth), opacity 0.20s ease;
}

.slide-enter-from, .slide-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}
</style>
