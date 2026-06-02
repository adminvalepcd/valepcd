<template>
  <div class="contato-page container">
    <section class="section" aria-labelledby="contact-title">
      <span class="badge">{{ $t('contact.badge') }}</span>
      <h1 id="contact-title" class="title">
        {{ $t('contact.title1') }}<span class="gradient-text">{{ $t('contact.titleHighlight') }}</span>
      </h1>
      <p class="lead text-muted">
        {{ $t('contact.lead') }}
      </p>

      <div class="contact-layout">
        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="contact-form glass" :aria-label="$t('contact.badge')">
          <div v-if="successMessage" class="alert alert-success" role="alert">
            {{ successMessage }}
          </div>

          <div class="contact-form-grid">
            <!-- Nome -->
            <div class="form-group">
              <label for="first-name">{{ $t('contact.firstNameLabel') }}</label>
              <input 
                type="text" 
                id="first-name" 
                v-model="form.firstName" 
                required 
                aria-required="true" 
                class="form-control"
                :placeholder="$t('contact.firstNamePlaceholder')"
              />
            </div>

            <!-- Sobrenome -->
            <div class="form-group">
              <label for="last-name">{{ $t('contact.lastNameLabel') }}</label>
              <input 
                type="text" 
                id="last-name" 
                v-model="form.lastName" 
                required 
                aria-required="true" 
                class="form-control"
                :placeholder="$t('contact.lastNamePlaceholder')"
              />
            </div>

            <!-- E-mail -->
            <div class="form-group">
              <label for="email">{{ $t('contact.emailLabel') }}</label>
              <input 
                type="email" 
                id="email" 
                v-model="form.email" 
                required 
                aria-required="true" 
                class="form-control"
                :placeholder="$t('contact.emailPlaceholder')"
              />
            </div>

            <!-- Telefone -->
            <div class="form-group">
              <label for="phone">{{ $t('contact.phoneLabel') }}</label>
              <input 
                type="tel" 
                id="phone" 
                v-model="form.phone" 
                class="form-control"
                :placeholder="$t('contact.phonePlaceholder')"
              />
            </div>

            <!-- Empresa -->
            <div class="form-group">
              <label for="company">{{ $t('contact.companyLabel') }}</label>
              <input 
                type="text" 
                id="company" 
                v-model="form.company" 
                class="form-control"
                :placeholder="$t('contact.companyPlaceholder')"
              />
            </div>

            <!-- Cargo -->
            <div class="form-group">
              <label for="job-title">{{ $t('contact.jobTitleLabel') }}</label>
              <input 
                type="text" 
                id="job-title" 
                v-model="form.jobTitle" 
                class="form-control"
                :placeholder="$t('contact.jobTitlePlaceholder')"
              />
            </div>

            <!-- Selecione um assunto -->
            <div class="form-group full-width">
              <label for="subject">{{ $t('contact.subjectLabel') }}</label>
              <div class="select-wrapper">
                <select 
                  id="subject" 
                  v-model="form.subject" 
                  required 
                  aria-required="true"
                  class="form-control select-control"
                >
                  <option value="" disabled selected hidden>{{ $t('contact.subjectPlaceholder') }}</option>
                  <option value="digital">{{ $t('contact.subjectOptions.digital') }}</option>
                  <option value="events">{{ $t('contact.subjectOptions.events') }}</option>
                  <option value="guides">{{ $t('contact.subjectOptions.guides') }}</option>
                  <option value="consulting">{{ $t('contact.subjectOptions.consulting') }}</option>
                  <option value="jobs">{{ $t('contact.subjectOptions.jobs') }}</option>
                  <option value="discounts">{{ $t('contact.subjectOptions.discounts') }}</option>
                  <option value="map">{{ $t('contact.subjectOptions.map') }}</option>
                  <option value="professional">{{ $t('contact.subjectOptions.professional') }}</option>
                  <option value="health">{{ $t('contact.subjectOptions.health') }}</option>
                  <option value="privacy">{{ $t('contact.subjectOptions.privacy') }}</option>
                  <option value="other">{{ $t('contact.subjectOptions.other') }}</option>
                </select>
              </div>
            </div>

            <!-- Mensagem -->
            <div class="form-group full-width">
              <label for="message">{{ $t('contact.messageLabel') }}</label>
              <textarea 
                id="message" 
                v-model="form.message" 
                required 
                aria-required="true" 
                rows="5" 
                class="form-control"
                :placeholder="$t('contact.messagePlaceholder')"
              ></textarea>
            </div>

            <!-- Checkbox LGPD / Termos -->
            <div class="form-checkbox full-width">
              <label class="checkbox-container">
                <input 
                  type="checkbox" 
                  v-model="form.agreed" 
                  required 
                  aria-required="true"
                />
                <span class="checkbox-label-text">
                  {{ $t('contact.termsCheckbox') }} 
                  <NuxtLink :to="localePath('/privacidade')" class="link-underline">{{ $t('contact.privacyLink') }}</NuxtLink>.
                </span>
              </label>
            </div>

            <!-- Footnote & Submit -->
            <div class="form-submit-group full-width">
              <p class="footnote-text">{{ $t('contact.footnote') }}</p>
              <button type="submit" class="btn btn-primary pulse-hover w-full">
                {{ $t('contact.submitBtn') }}
              </button>
              <p class="email-fallback-text">
                {{ $t('contact.emailFallback') }} 
                <a href="mailto:contato@valepcd.com.br">contato@valepcd.com.br</a>.
              </p>
            </div>
          </div>
        </form>

        <!-- Info box -->
        <div class="contact-info glass">
          <h3>{{ $t('contact.infoTitle') }}</h3>
          <p class="text-muted">{{ $t('contact.infoSubtitle') }}</p>
          
          <div class="info-item">
            <span class="info-icon">📧</span>
            <div>
              <strong>{{ $t('contact.emailGeneral') }}</strong>
              <p>contato@valepcd.com.br</p>
            </div>
          </div>

          <div class="info-item">
            <span class="info-icon">🤝</span>
            <div>
              <strong>{{ $t('contact.emailComercial') }}</strong>
              <p>comercial@valepcd.com.br</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => `${t('contact.title1')}${t('contact.titleHighlight')} | Vale PCD`,
  description: () => t('contact.lead')
})

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  jobTitle: '',
  subject: '',
  message: '',
  agreed: false
})

const successMessage = ref('')

const handleSubmit = () => {
  successMessage.value = t('contact.successMsg')
  form.value = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    jobTitle: '',
    subject: '',
    message: '',
    agreed: false
  }
}
</script>

<style scoped>
.contato-page {
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
  margin-bottom: 2rem;
}

.contact-layout {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 3rem;
  align-items: start;
}

@media (max-width: 850px) {
  .contact-layout {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

.contact-form {
  padding: 2.5rem;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.contact-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  width: 100%;
}

@media (max-width: 640px) {
  .contact-form-grid {
    grid-template-columns: 1fr;
    gap: 1.2rem;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 0.95rem;
}

.form-control {
  padding: 0.8rem 1.2rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background-color: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-family: 'Poppins', sans-serif;
  font-size: 1rem;
  transition: all var(--transition-fast);
  width: 100%;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary);
  background-color: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 2px rgba(109, 40, 217, 0.2);
}

.full-width {
  grid-column: span 2;
}

@media (max-width: 640px) {
  .full-width {
    grid-column: span 1;
  }
}

.w-full {
  width: 100%;
}

/* Custom Select Dropdown styling */
.select-wrapper {
  position: relative;
  width: 100%;
}

.select-control {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255, 255, 255, 0.7)' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1.2rem center;
  background-size: 1.25rem;
  padding-right: 3rem !important;
  cursor: pointer;
}

/* Checkbox styling */
.checkbox-container {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-muted);
  user-select: none;
  line-height: 1.4;
}

.checkbox-container input {
  margin-top: 0.2rem;
  accent-color: var(--primary);
  width: 1.15rem;
  height: 1.15rem;
  cursor: pointer;
}

.link-underline {
  color: var(--primary);
  text-decoration: underline;
  font-weight: 500;
  transition: color var(--transition-fast);
}

.link-underline:hover {
  color: var(--primary-hover, #8b5cf6);
}

/* Footnote & fallback styling */
.footnote-text {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
  line-height: 1.4;
}

.email-fallback-text {
  font-size: 0.9rem;
  color: var(--text-muted);
  text-align: center;
  margin-top: 1.2rem;
}

.email-fallback-text a {
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px dashed var(--primary);
  transition: all var(--transition-fast);
}

.email-fallback-text a:hover {
  border-bottom-style: solid;
  color: var(--primary-hover, #8b5cf6);
}

.alert {
  padding: 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  margin-bottom: 1rem;
}

.alert-success {
  background-color: rgba(16, 185, 129, 0.15);
  color: hsl(142, 70%, 45%);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.contact-info {
  padding: 2.5rem;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.05), rgba(219, 39, 119, 0.05));
}

.contact-info h3 {
  font-size: 1.3rem;
  color: var(--primary);
}

.info-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.info-icon {
  font-size: 1.5rem;
}

.info-item strong {
  font-family: 'Poppins', sans-serif;
  display: block;
  font-size: 0.95rem;
  color: var(--text);
}

.info-item p {
  font-size: 0.95rem;
  margin-top: 0.2rem;
}
</style>
