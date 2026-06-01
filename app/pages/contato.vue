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

          <div class="form-group">
            <label for="name">{{ $t('contact.nameLabel') }}</label>
            <input 
              type="text" 
              id="name" 
              v-model="form.name" 
              required 
              aria-required="true" 
              class="form-control"
              :placeholder="$t('contact.namePlaceholder')"
            />
          </div>

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

          <div class="form-group">
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

          <button type="submit" class="btn btn-primary pulse-hover w-full">
            {{ $t('contact.submitBtn') }}
          </button>
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

useSeoMeta({
  title: () => `${t('contact.title1')}${t('contact.titleHighlight')} | Vale PCD`,
  description: () => t('contact.lead')
})

const form = ref({
  name: '',
  email: '',
  message: ''
})

const successMessage = ref('')

const handleSubmit = () => {
  successMessage.value = t('contact.successMsg')
  form.value = {
    name: '',
    email: '',
    message: ''
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
}

.form-control:focus {
  outline: none;
  border-color: var(--primary);
  background-color: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 2px rgba(109, 40, 217, 0.2);
}

.w-full {
  width: 100%;
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
