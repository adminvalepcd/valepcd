<template>
  <Transition name="fade-slide">
    <div
      v-if="isVisible"
      id="cookie-consent-banner"
      class="cookie-consent-banner"
      role="region"
      :aria-label="$t('cookieConsent.linkText')"
    >
      <div class="cookie-content">
        <p class="cookie-text">
          {{ $t('cookieConsent.message') }}
          <NuxtLink :to="localePath('/privacidade')" class="cookie-link">
            {{ $t('cookieConsent.linkText') }}
          </NuxtLink>.
        </p>
        <div class="cookie-actions">
          <button 
            id="btn-accept-cookies" 
            class="btn btn-primary btn-cookie-accept" 
            @click="acceptExplicitly"
          >
            {{ $t('cookieConsent.accept') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

const localePath = useLocalePath()
const isVisible = ref(false)
const route = useRoute()

// Check if consent cookie exists
const checkConsentCookie = () => {
  if (import.meta.server) return false
  const cookies = document.cookie.split(';')
  return cookies.some(c => c.trim().startsWith('cookie-consent-granted=true'))
}

// Set cookie and update consent
const grantConsent = (type) => {
  if (import.meta.server) return

  // 1. Set cookie for 30 days
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 30)
  document.cookie = `cookie-consent-granted=true; expires=${expiry.toUTCString()}; path=/; SameSite=Lax; Secure`

  // 2. Update Google Consent Mode v2
  if (window.gtag) {
    window.gtag('consent', 'update', {
      'ad_storage': 'granted',
      'ad_user_data': 'granted',
      'ad_personalization': 'granted',
      'analytics_storage': 'granted'
    })
  }

  // 3. Push to Data Layer for Google / GTM
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event: 'cookie_consent_granted',
    consent_type: type, // 'explicit' or 'implicit'
    timestamp: new Date().toISOString()
  })

  // 4. Hide banner
  isVisible.value = false

  // 5. Clean up event listeners
  removeEventListeners()
}

const acceptExplicitly = () => {
  grantConsent('explicit')
}

const handleScroll = () => {
  // If user scrolls down more than 200px, it counts as continuing to browse
  if (window.scrollY > 200) {
    grantConsent('implicit')
  }
}

// Watch route changes (continuing to navigate)
watch(() => route.path, () => {
  if (isVisible.value) {
    grantConsent('implicit')
  }
})

const addEventListeners = () => {
  window.addEventListener('scroll', handleScroll, { passive: true })
}

const removeEventListeners = () => {
  window.removeEventListener('scroll', handleScroll)
}

onMounted(() => {
  // Wait a tiny bit to avoid hydration mismatches, and only show if cookie not present
  setTimeout(() => {
    const consented = checkConsentCookie()
    
    // Push the initial consent state to the dataLayer on page load (dispara o data layer ao abrir as páginas)
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'consent_loaded',
      consent_granted: consented,
      timestamp: new Date().toISOString()
    })

    if (!consented) {
      isVisible.value = true
      addEventListeners()
    }
  }, 1000)
})

onBeforeUnmount(() => {
  removeEventListeners()
})
</script>

<style scoped>
.cookie-consent-banner {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 650px;
  background-color: var(--surface-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 1.25rem 1.5rem;
  z-index: 99998; /* Just below VLibras (99999) */
  transition: all var(--transition-smooth);
}

/* Hover effect to make it feel premium and alive */
.cookie-consent-banner:hover {
  border-color: var(--primary-hover);
  box-shadow: var(--shadow-glow), var(--shadow-md);
}

.cookie-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  text-align: center;
}

@media (min-width: 768px) {
  .cookie-content {
    flex-direction: row;
    text-align: left;
    justify-content: space-between;
    gap: 1.5rem;
  }
}

.cookie-text {
  font-family: 'Poppins', sans-serif;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text);
  margin: 0;
}

.cookie-link {
  color: var(--primary);
  text-decoration: underline;
  font-weight: 500;
  transition: color var(--transition-fast);
}

.cookie-link:hover {
  color: var(--primary-hover);
}

.cookie-actions {
  flex-shrink: 0;
}

/* Premium Button Styling matching main.css */
.btn-cookie-accept {
  padding: 0.6rem 1.25rem;
  font-family: 'Poppins', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

/* Animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translate(-50%, 30px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>
