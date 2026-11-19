<template>
  <header class="app-header glass" role="banner">
    <div class="container header-container">
      <!-- Logo Brand -->
      <NuxtLink :to="localePath('/')" class="logo-container" :aria-label="$t('nav.logoHome')">
        <img 
          :src="currentTheme === 'dark' ? '/images/logo Vale PcD branca.webp' : '/images/logo Vale PcD.webp'" 
          alt=""
          class="logo-img"
        />
      </NuxtLink>

      <!-- Desktop Navigation -->
      <nav class="nav-menu" :aria-label="$t('nav.mainMenu')">
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
            @focusout="handleFocusOut" @keydown.esc="closeDropdown(true)">
            <button
              ref="dropdownTriggerRef"
              type="button"
              class="nav-link dropdown-trigger"
              :class="{ 'active': isInstitutionalActive }"
              :aria-expanded="dropdownOpen ? 'true' : 'false'"
              aria-controls="institutional-submenu"
              @click="dropdownOpen = !dropdownOpen"
            >
              {{ $t('nav.institutional') }} <span class="chevron-icon" aria-hidden="true">▼</span>
            </button>
            <!-- Lista simples de links (sem role="menu"): navegação por Tab, Esc fecha e devolve o foco -->
            <ul v-show="dropdownOpen" id="institutional-submenu" class="dropdown-menu glass">
              <li>
                <NuxtLink :to="localePath('/institucional')" class="dropdown-link" active-class="active" @click="closeDropdown()">
                  {{ $t('nav.documents') }}
                </NuxtLink>
              </li>
              <li>
                <NuxtLink :to="localePath('/institucional/sobre')" class="dropdown-link" active-class="active" @click="closeDropdown()">
                  {{ $t('nav.about') }}
                </NuxtLink>
              </li>
            </ul>
          </li>
          <li>
            <NuxtLink :to="localePath('/contato')" class="nav-link" active-class="active">{{ $t('nav.contact') }}</NuxtLink>
          </li>
          <li>
            <NuxtLink :to="localePath('/doar')" class="nav-donate" active-class="active">
              <span aria-hidden="true">♥</span> {{ $t('nav.donate') }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <!-- Accessibility & Theme Controls -->
      <div class="toolbar" role="group" :aria-label="$t('nav.toolbar')">
        <!-- Language Switcher (sem emojis de bandeira: leitores de tela leem o nome do idioma) -->
        <select :value="locale" @change="e => setLocale(e.target.value)" class="lang-select glass"
          :aria-label="$t('nav.selectLanguage')">
          <option value="pt" :label="$t('nav.langPt')">PT</option>
          <option value="en" :label="$t('nav.langEn')">EN</option>
          <option value="es" :label="$t('nav.langEs')">ES</option>
        </select>

        <button 
          type="button"
          @click="toggleContrast" 
          class="toolbar-btn btn-contrast" 
          :title="$t('nav.toggleContrast')"
          :aria-label="$t('nav.toggleContrast')"
          :aria-pressed="currentTheme === 'dark' ? 'true' : 'false'"
        >
          <span aria-hidden="true">🌓</span>
        </button>
        <button 
          type="button"
          @click="changeFontSize(1)" 
          class="toolbar-btn btn-font-up" 
          :title="$t('nav.fontSizeUp')" 
          :aria-label="$t('nav.fontSizeUp')"
          :disabled="fontSizeLevel === 3"
        >
          A+
        </button>
        <button 
          type="button"
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
        type="button"
        @click="mobileMenuOpen = !mobileMenuOpen" 
        class="mobile-toggle" 
        :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
        aria-controls="mobile-navigation"
        :aria-label="mobileMenuOpen ? $t('nav.closeMenu') : $t('nav.openMenu')"
      >
        <span class="hamburger-bar" :class="{ 'open': mobileMenuOpen }" aria-hidden="true"></span>
      </button>
    </div>

    <!-- Mobile Navigation Dropdown -->
    <transition name="slide">
      <nav 
        v-if="mobileMenuOpen" 
        id="mobile-navigation" 
        class="mobile-nav glass"
        :aria-label="$t('nav.mobileMenu')"
        @keydown.esc="mobileMenuOpen = false"
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
              <!-- Botão real: acessível por teclado e leitores de tela -->
              <button
                type="button"
                class="mobile-nav-group-header"
                :aria-expanded="mobileDropdownOpen ? 'true' : 'false'"
                aria-controls="mobile-institutional-submenu"
                @click="mobileDropdownOpen = !mobileDropdownOpen"
              >
                <span class="mobile-nav-link" :class="{ 'active': isInstitutionalActive }">
                  {{ $t('nav.institutional') }}
                </span>
                <span class="chevron-icon" :class="{ 'rotated': mobileDropdownOpen }" aria-hidden="true">▼</span>
              </button>
              <transition name="expand">
                <ul v-show="mobileDropdownOpen" id="mobile-institutional-submenu" class="mobile-sub-list">
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
          <li>
            <NuxtLink :to="localePath('/doar')" @click="mobileMenuOpen = false" class="mobile-nav-link mobile-nav-donate">
              <span aria-hidden="true">♥</span> {{ $t('nav.donate') }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </transition>
  </header>
</template>

<script setup>
  import { ref, onMounted, computed, watch, nextTick } from 'vue'

const mobileMenuOpen = ref(false)
  const dropdownOpen = ref(false)
  const mobileDropdownOpen = ref(false)
const fontSizeLevel = ref(0) // Limits adjustment to up to 3 clicks (-3 to 3)

  const route = useRoute()
  const isInstitutionalActive = computed(() => {
    return route.path.includes('/institucional')
  })

  const dropdownTriggerRef = ref(null)

  const handleFocusOut = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      dropdownOpen.value = false
    }
  }

  const closeDropdown = (returnFocus = false) => {
    if (!dropdownOpen.value) return
    dropdownOpen.value = false
    if (returnFocus) {
      nextTick(() => dropdownTriggerRef.value?.focus?.())
    }
  }

  // Fecha os menus ao trocar de página
  watch(() => route.fullPath, () => {
    dropdownOpen.value = false
    mobileMenuOpen.value = false
  })

  // Cookie de 1 ano para guardar a escolha de tema
  const themeCookie = useCookie('theme', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
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

// Tamanho de fonte guardado no navegador (vale para todas as páginas e visitas)
const FONT_SIZE_STORAGE_KEY = 'vale_font_size_level'

const applyFontSize = () => {
  const multiplier = 1 + (fontSizeLevel.value * 0.1)
  document.documentElement.style.fontSize = `${multiplier * 16}px`
  // Usado no CSS para trocar o menu por hambúrguer quando a fonte grande não cabe na largura
  document.documentElement.dataset.fontLevel = String(fontSizeLevel.value)
}

const changeFontSize = (direction) => {
  if (process.client) {
    if (direction === 1 && fontSizeLevel.value < 3) {
      fontSizeLevel.value++
    } else if (direction === -1 && fontSizeLevel.value > -3) {
      fontSizeLevel.value--
    }
    applyFontSize()
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSizeLevel.value))
    } catch {
      // armazenamento indisponível (modo privado): mantém só nesta página
    }
  }
}

onMounted(() => {
  try {
    const saved = parseInt(localStorage.getItem(FONT_SIZE_STORAGE_KEY) || '0', 10)
    if (Number.isFinite(saved) && saved !== 0) {
      fontSizeLevel.value = Math.max(-3, Math.min(3, saved))
      applyFontSize()
    }
  } catch {
    // ignora
  }
})
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
  gap: 1rem;
  min-height: 80px;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.logo-container {
  flex-shrink: 0;
}

.logo-img {
  height: 56px;
  width: auto;
  object-fit: contain;
}

.nav-list {
  display: flex;
  align-items: center;
  list-style: none;
  gap: clamp(0.9rem, 1.6vw, 1.6rem);
  margin: 0;
  padding: 0;
}

.nav-list > li {
  display: flex;
  align-items: center;
}

/* Botão "Doar" em destaque no menu */
.nav-donate {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 1rem;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: #ffffff;
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 0.98rem;
  line-height: 1.2;
  white-space: nowrap;
  text-decoration: none;
  transition: background-color var(--transition-fast), transform var(--transition-fast);
}

.nav-donate:hover,
.nav-donate.active {
  background: var(--primary-hover);
  color: #ffffff;
}

.nav-donate:focus-visible,
.mobile-nav-group-header:focus-visible,
.mobile-toggle:focus-visible,
.toolbar-btn:focus-visible,
.dropdown-trigger:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}

.mobile-nav-donate {
  color: var(--primary);
}

.nav-link {
  display: inline-flex;
  align-items: center;
  font-family: 'Poppins', sans-serif;
  font-size: 1.05rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
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
  flex-shrink: 0;
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

/* Fonte ampliada (A+): o menu horizontal não cabe, então usa o menu hambúrguer mais cedo */
@media (max-width: 1200px) {
  :root[data-font-level="1"] .nav-menu {
    display: none;
  }
  :root[data-font-level="1"] .mobile-toggle {
    display: flex;
  }
}

@media (max-width: 1440px) {
  :root[data-font-level="2"] .nav-menu,
  :root[data-font-level="3"] .nav-menu {
    display: none;
  }
  :root[data-font-level="2"] .mobile-toggle,
  :root[data-font-level="3"] .mobile-toggle {
    display: flex;
  }
}

.mobile-nav {
  position: absolute;
  top: 100%;
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
  align-items: center;
  display: flex;
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
  line-height: 1.2;
  white-space: nowrap;
  color: var(--text-muted);
  padding: 0.5rem 0.2rem;
  margin: 0;
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
  width: 100%;
  background: transparent;
  border: none;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
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
/* Mobile: logo e controles compactos para o menu hambúrguer não ser cortado */
.mobile-toggle {
  flex-shrink: 0;
}

@media (max-width: 960px) {
  .header-container {
    min-height: 64px;
    gap: 0.5rem;
  }

  .logo-img {
    height: 42px;
  }

  .toolbar {
    gap: 0.4rem;
    margin-left: auto;
  }

  .toolbar-btn {
    width: 34px;
    height: 34px;
    font-size: 0.85rem;
  }

  .lang-select {
    padding: 0.3rem 0.35rem;
    font-size: 0.82rem;
  }
}

@media (max-width: 420px) {
  .header-container {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    gap: 0.35rem;
  }

  .logo-img {
    height: 36px;
  }

  .toolbar {
    gap: 0.3rem;
  }

  .toolbar-btn {
    width: 32px;
    height: 32px;
  }

  .lang-select {
    max-width: 6.5rem;
  }

  .mobile-toggle {
    width: 36px;
  }
}
</style>

<style>
@media (prefers-reduced-motion: reduce) {
  .app-header *,
  .app-header *::before,
  .app-header *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
