<template>
  <footer class="app-footer" role="contentinfo">
    <div class="container footer-grid">
      <!-- Brand Section -->
      <div class="footer-brand">
        <div class="logo-container">
          <img 
            src="/images/logo Vale PcD.png" 
            alt="Logo Vale PCD"
            class="logo-img"
          />
        </div>
        <p class="brand-description">
          O maior projeto do Brasil sobre visibilidade, orgulho e acessibilidade para pessoas com deficiência da comunidade LGBTQI+.
        </p>
      </div>

      <!-- Quick Links -->
      <div class="footer-nav" aria-label="Links úteis">
        <h3 class="footer-heading">Navegação</h3>
        <ul class="footer-links">
          <li><NuxtLink to="/" class="footer-link">Início</NuxtLink></li>
          <li><NuxtLink to="/sobre" class="footer-link">Sobre Nós</NuxtLink></li>
          <li><NuxtLink to="/servicos" class="footer-link">Serviços</NuxtLink></li>
          <li><NuxtLink to="/blog" class="footer-link">Blog</NuxtLink></li>
          <li><NuxtLink to="/contato" class="footer-link">Contato</NuxtLink></li>
        </ul>
      </div>

      <!-- Legal / Accessibility Info -->
      <div class="footer-accessibility">
        <h3 class="footer-heading">Compromisso</h3>
        <ul class="footer-links">
          <li>
            <span class="badge">Acessibilidade AAA</span>
          </li>
          <li class="commitment-text">
            Desenvolvido seguindo as diretrizes WCAG 2.2 e o Modelo de Acessibilidade em Governo Eletrônico (eMAG).
          </li>
          <li>
            <NuxtLink to="/privacidade" class="footer-link">Política de Privacidade & Cookies</NuxtLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="container footer-bottom">
      <p class="copyright">
        &copy; {{ currentYear }} Vale PCD. Todos os direitos reservados.
      </p>
      <div class="social-links">
        <a href="https://instagram.com/valepcd" target="_blank" rel="noopener noreferrer" aria-label="Seguir no Instagram" class="social-link">
          Instagram
        </a>
        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="Seguir no LinkedIn" class="social-link">
          LinkedIn
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'

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
