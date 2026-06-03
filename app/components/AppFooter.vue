<template>
  <footer class="app-footer" role="contentinfo">
    <div class="container footer-grid">
      <!-- Brand Section -->
      <div class="footer-brand">
        <div class="logo-container">
          <img 
            :src="currentTheme === 'dark' ? '/images/logo Vale PcD branca.webp' : '/images/logo Vale PcD.webp'" 
            alt="Logo Vale PCD"
            class="logo-img"
          />
        </div>
        <p class="brand-description">
          {{ $t('footer.description') }}
        </p>
      </div>

      <!-- Quick Links -->
      <div class="footer-nav" :aria-label="$t('footer.navigation')">
        <h3 class="footer-heading">{{ $t('footer.navigation') }}</h3>
        <ul class="footer-links">
          <li><NuxtLink :to="localePath('/')" class="footer-link">{{ $t('nav.home') }}</NuxtLink></li>
          <li><NuxtLink :to="localePath('/servicos')" class="footer-link">{{ $t('nav.services') }}</NuxtLink></li>
          <li><NuxtLink :to="localePath('/psicoterapia')" class="footer-link">{{ $t('nav.psychotherapy') }}</NuxtLink></li>
          <li><NuxtLink :to="localePath('/blog')" class="footer-link">{{ $t('nav.blog') }}</NuxtLink></li>
          <li class="footer-link-group">
            <span class="footer-group-title">{{ $t('nav.institutional') }}</span>
            <ul class="footer-sub-links">
              <li>
                <NuxtLink :to="localePath('/institucional')" class="footer-sub-link">
                  — {{ $t('nav.documents') }}
                </NuxtLink>
              </li>
              <li>
                <NuxtLink :to="localePath('/institucional/sobre')" class="footer-sub-link">
                  — {{ $t('nav.about') }}
                </NuxtLink>
              </li>
            </ul>
          </li>
          <li><NuxtLink :to="localePath('/contato')" class="footer-link">{{ $t('nav.contact') }}</NuxtLink></li>
        </ul>
      </div>

      <!-- Legal / Accessibility Info -->
      <div class="footer-accessibility">
        <h3 class="footer-heading">{{ $t('footer.commitment') }}</h3>
        <ul class="footer-links">
          <li>
            <span class="badge">{{ $t('footer.badge') }}</span>
          </li>
          <li class="commitment-text">
            {{ $t('footer.wcag') }}
          </li>
          <li>
            <NuxtLink :to="localePath('/privacidade')" class="footer-link">{{ $t('footer.privacy') }}</NuxtLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="container footer-bottom">
      <p class="copyright">
        {{ $t('footer.copyright', { year: currentYear }) }}
      </p>
      <div class="social-links">
        <a href="https://instagram.com/valepcd" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="social-link">
          Instagram
        </a>
        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" class="social-link">
          LinkedIn
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'

const localePath = useLocalePath()
const currentTheme = useState('theme', () => useCookie('theme').value || 'light')
const currentYear = computed(() => new Date().getFullYear())
</script>

<style scoped>
.app-footer {
  background-color: var(--surface);
  border-top: 1px solid var(--border);
  padding: 4rem 0 2rem 0;
  margin-top: auto;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

@media (max-width: 768px) {
  .footer-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.logo-img {
  height: 48px;
  width: auto;
  object-fit: contain;
}

.brand-description {
  max-width: 420px;
  font-size: 0.95rem;
  line-height: 1.6;
}

.footer-heading {
  font-family: 'Poppins', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text);
}

.footer-links {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.footer-link {
  font-size: 0.95rem;
  color: var(--text-muted);
  transition: color var(--transition-fast);
}

.footer-link:hover {
  color: var(--primary);
  padding-left: 4px;
  transition: all var(--transition-fast);
}

.footer-link-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-group-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  cursor: default;
}

.footer-sub-links {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 0.8rem;
}

.footer-sub-link {
  font-size: 0.9rem;
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.footer-sub-link:hover {
  color: var(--primary);
  padding-left: 4px;
}

.commitment-text {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.footer-bottom {
  border-top: 1px solid var(--border);
  padding-top: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

@media (max-width: 540px) {
  .footer-bottom {
    flex-direction: column-reverse;
    text-align: center;
  }
}

.copyright {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.social-links {
  display: flex;
  gap: 1.5rem;
}

.social-link {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-muted);
}

.social-link:hover {
  color: var(--primary);
}
</style>
