<template>
  <header class="app-header glass" role="banner">
    <div class="container header-container">
      <!-- Logo Brand -->
      <NuxtLink :to="localePath('/')" class="logo-container" :aria-label="$t('footer.copyright', { year: '' })">
        <img 
          :src="currentTheme === 'dark' ? '/images/logo Vale PcD branca.webp' : '/images/logo Vale PcD.webp'" 
          alt="Logo Vale PCD"
          class="logo-img"
        />
      </NuxtLink>

      <!-- Desktop Navigation -->
      <nav class="nav-menu" role="navigation" :aria-label="$t('nav.home')">
        <ul class="nav-list">
          <li>
            <NuxtLink :to="localePath('/')" class="nav-link" active-class="active">{{ $t('nav.home') }}</NuxtLink>
          </li>
          <li>
            <NuxtLink :to="localePath('/servicos')" class="nav-link" active-class="active">{{ $t('nav.services') }}</NuxtLink>
          </li>
          <li>
            <NuxtLink :to="localePath('/psicoterapia')" class="nav-link" active-class="active">{{ $t('nav.psychotherapy') }}</NuxtLink>
          </li>
          <li>
            <NuxtLink :to="localePath('/blog')" class="nav-link" active-class="active">{{ $t('nav.blog') }}</NuxtLink>
          </li>
          <li class="nav-item-dropdown" @mouseenter="dropdownOpen = true" @mouseleave="dropdownOpen = false"
            @focusin="dropdownOpen = true" @focusout="handleFocusOut">
            <button class="nav-link dropdown-trigger" :class="{ 'active': isInstitutionalActive }" aria-haspopup="true"
              :aria-expanded="dropdownOpen.toString()">
              {{ $t('nav.institutional') }} <span class="chevron-icon">▼</span>
            </button>
            <ul v-show="dropdownOpen" class="dropdown-menu glass" role="menu">
              <li role="none">
                <NuxtLink :to="localePath('/institucional')" class="dropdown-link" role="menuitem" active-class="active">
                  {{ $t('nav.documents') }}
                </NuxtLink>
              </li>
              <li role="none">
                <NuxtLink :to="localePath('/institucional/sobre')" class="dropdown-link" role="menuitem" active-class="active">
                  {{ $t('nav.about') }}
                </NuxtLink>
              </li>
            </ul>
          </li>
          <li>
            <NuxtLink :to="localePath('/contato')" class="nav-link" active-class="active">{{ $t('nav.contact') }}</NuxtLink>
          </li>
        </ul>
      </nav>

      <!-- Accessibility & Theme Controls -->
      <div class="toolbar" aria-label="Ferramentas de Acessibilidade" role="toolbar">
        <!-- Language Switcher -->
        <select :value="locale" @change="e => setLocale(e.target.value)" class="lang-select glass"
          aria-label="Selecionar idioma">
          <option value="pt">🇧🇷 PT</option>
          <option value="en">🇺🇸 EN</option>
          <option value="es">🇪🇸 ES</option>
        </select>

        <button 
          @click="toggleContrast" 
          class="toolbar-btn btn-contrast" 
          :title="$t('nav.toggleContrast')"
          :aria-label="$t('nav.toggleContrast')"
        >
          🌓
        </button>
        <button 
          @click="changeFontSize(1)" 
          class="toolbar-btn btn-font-up" 
          :title="$t('nav.fontSizeUp')" 
          :aria-label="$t('nav.fontSizeUp')"
          :disabled="fontSizeLevel === 3"
        >
          A+
        </button>
        <button 
          @click="changeFontSize(-1)" 
          class="toolbar-btn btn-font-down" 
          :title="$t('nav.fontSizeDown')" 
          :aria-label="$t('nav.fontSizeDown')"
          :disabled="fontSizeLevel === -3"
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
          <li>
            <NuxtLink :to="localePath('/')" @click="mobileMenuOpen = false" class="mobile-nav-link">{{ $t('nav.home') }}
            </NuxtLink>
          </li>
          <li>
            <NuxtLink :to="localePath('/servicos')" @click="mobileMenuOpen = false" class="mobile-nav-link">{{ $t('nav.services') }}</NuxtLink>
          </li>
          <li>
            <NuxtLink :to="localePath('/psicoterapia')" @click="mobileMenuOpen = false" class="mobile-nav-link">{{ $t('nav.psychotherapy') }}</NuxtLink>
          </li>
          <li>
            <NuxtLink :to="localePath('/blog')" @click="mobileMenuOpen = false" class="mobile-nav-link">{{ $t('nav.blog') }}</NuxtLink>
          </li>
          <li>
            <div class="mobile-nav-group">
              <div class="mobile-nav-group-header" @click="mobileDropdownOpen = !mobileDropdownOpen">
                <span class="mobile-nav-link" :class="{ 'active': isInstitutionalActive }">
                  {{ $t('nav.institutional') }}
                </span>
                <span class="chevron-icon" :class="{ 'rotated': mobileDropdownOpen }">▼</span>
              </div>
              <transition name="expand">
                <ul v-show="mobileDropdownOpen" class="mobile-sub-list">
                  <li>
                    <NuxtLink :to="localePath('/institucional')" @click="mobileMenuOpen = false" class="mobile-sub-link">
                      {{ $t('nav.documents') }}
                    </NuxtLink>
                  </li>
                  <li>
                    <NuxtLink :to="localePath('/institucional/sobre')" @click="mobileMenuOpen = false" class="mobile-sub-link">
                      {{ $t('nav.about') }}
                    </NuxtLink>
                    </li>
                    </ul>
                    </transition>
                    </div>
                    </li>
                    <li>
            <NuxtLink :to="localePath('/contato')" @click="mobileMenuOpen = false" class="mobile-nav-link">{{ $t('nav.contact') }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </transition>
  </header>
</template>

<script setup>
  import { ref, onMounted, computed } from 'vue'

const mobileMenuOpen = ref(false)
  const dropdownOpen = ref(false)
  const mobileDropdownOpen = ref(false)
const fontSizeLevel = ref(0) // Limits adjustment to up to 3 clicks (-3 to 3)

  const route = useRoute()
  const isInstitutionalActive = computed(() => {
    return route.path.includes('/institucional')
  })

  const handleFocusOut = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      dropdownOpen.value = false
    }
  }

  // Cookie with 24 hours duration to persist theme choice
  const themeCookie = useCookie('theme', {
    maxAge: 60 * 60 * 24, // 24 hours
    default: () => 'light'
  })

  // Shared state for active theme, resolved on SSR
  const currentTheme = useState('theme', () => themeCookie.value || 'light')

  // Reactive data-theme attribute on <html> element across SSR & CSR
  useHead({
    htmlAttrs: {
      'data-theme': currentTheme
    }
  })

  // Nuxt i18n setup references
  const { locale, setLocale } = useI18n()
  const localePath = useLocalePath()

  const toggleContrast = () => {
    const newTheme = currentTheme.value === 'light' ? 'dark' : 'light'
    themeCookie.value = newTheme // updates cookie immediately
    currentTheme.value = newTheme // updates shared state
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

.lang-select {
  padding: 0.3rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text);
  font-family: 'Poppins', sans-serif;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: border-color var(--transition-fast);
}

.lang-select:hover, .lang-select:focus {
  border-color: var(--primary);
}

.lang-select option {
  background-color: var(--surface);
  color: var(--text);
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

.toolbar-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
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
  background-color: var(--surface); /* Solid opaque background */
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

/* Dropdown Menu & Nested Navigation */
.nav-item-dropdown {
  position: relative;
}

.dropdown-trigger {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-family: 'Poppins', sans-serif;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--text-muted);
  padding: 0;
}

.dropdown-trigger:hover,
.dropdown-trigger.active {
  color: var(--text);
}

.dropdown-trigger::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  transition: width var(--transition-smooth);
}

.dropdown-trigger:hover::after,
.dropdown-trigger.active::after {
  width: 100%;
}

.chevron-icon {
  font-size: 0.65rem;
  transition: transform var(--transition-smooth);
  pointer-events: none;
}

.nav-item-dropdown:hover .chevron-icon,
.mobile-nav-group-header .chevron-icon {
  transform: rotate(0deg);
}

.nav-item-dropdown:hover .chevron-icon {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.5rem 0;
  min-width: 180px;
  list-style: none;
  box-shadow: var(--shadow-md);
  z-index: 1100;
  display: flex;
  flex-direction: column;
}

.dropdown-menu::before {
  content: '';
  position: absolute;
  top: -15px;
  left: 0;
  width: 100%;
  height: 15px;
  background: transparent;
}

.dropdown-link {
  font-family: 'Poppins', sans-serif;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-muted);
  padding: 0.6rem 1.2rem;
  display: block;
  width: 100%;
  transition: all var(--transition-fast);
}

.dropdown-link:hover,
.dropdown-link.active {
  color: var(--primary);
  background-color: var(--primary-muted);
}

.mobile-nav-group {
  display: flex;
  flex-direction: column;
}

.mobile-nav-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.mobile-nav-group-header .mobile-nav-link {
  border-bottom: none;
  flex-grow: 1;
}

.mobile-nav-group-header .chevron-icon {
  font-size: 0.8rem;
  margin-right: 0.5rem;
  color: var(--text-muted);
  transition: transform var(--transition-smooth);
}

.mobile-nav-group-header .chevron-icon.rotated {
  transform: rotate(180deg);
}

.mobile-sub-list {
  list-style: none;
  padding-left: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-top: 0.5rem;
  border-left: 2px solid var(--border);
}

.mobile-sub-link {
  font-family: 'Poppins', sans-serif;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--text-muted);
  display: block;
  padding: 0.4rem 0;
}

.mobile-sub-link:hover,
.mobile-sub-link.active {
  color: var(--primary);
}

/* Expand transition for mobile sub-menu */
.expand-enter-active, .expand-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: 200px;
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
