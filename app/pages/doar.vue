<template>
  <div class="donate-page container">
    <AppSeo :title="$t('seo.donate.title')" :description="$t('seo.donate.description')" />

    <!-- Hero -->
    <section class="donate-hero" aria-labelledby="donate-title">
      <span class="badge">{{ $t('donate.badge') }}</span>
      <h1 id="donate-title" class="donate-title">
        {{ $t('donate.title1') }}<span class="gradient-text">{{ $t('donate.titleHighlight') }}</span>
      </h1>
      <p class="donate-lead">{{ $t('donate.lead') }}</p>
    </section>

    <div class="donate-grid">
      <!-- Card 1: Pra onde vai sua doação -->
      <section class="donate-card glass" aria-labelledby="donate-where-title">
        <h2 id="donate-where-title" class="donate-card-title">{{ $t('donate.whereTitle') }}</h2>
        <p>{{ $t('donate.whereLead') }}</p>
        <ul class="donate-list">
          <li>{{ $t('donate.whereAdmin') }}</li>
          <li>{{ $t('donate.whereProjects') }}</li>
        </ul>
        <p class="donate-highlight">{{ $t('donate.whereThanks') }}</p>
      </section>

      <!-- Card 2: Pix -->
      <section class="donate-card donate-card-pix glass" aria-labelledby="donate-pix-title">
        <h2 id="donate-pix-title" class="donate-card-title">{{ $t('donate.pixTitle') }}</h2>
        <p>{{ $t('donate.pixLead') }}</p>
        <p>{{ $t('donate.pixMonthly') }}</p>

        <div v-if="showQrCode" class="pix-qr-wrap">
          <img
            :src="PIX_QR_IMAGE"
            :alt="$t('donate.pixQrAlt')"
            class="pix-qr"
            width="220"
            height="220"
            loading="lazy"
            @error="showQrCode = false"
          />
          <p class="pix-qr-hint">{{ $t('donate.pixQrHint') }}</p>
        </div>

        <div class="pix-key-box">
          <label for="pix-key" class="pix-key-label">{{ $t('donate.pixKeyLabel') }}</label>
          <div class="pix-key-row">
            <input
              id="pix-key"
              ref="pixInputRef"
              class="pix-key-input"
              type="text"
              :value="PIX_KEY_DISPLAY"
              readonly
              @focus="selectPixInput"
            />
            <button type="button" class="btn btn-primary pix-copy-btn" @click="copyPixKey">
              {{ $t('donate.pixCopy') }}
            </button>
          </div>
        </div>

        <div class="pix-key-box">
          <span class="pix-key-label">{{ $t('donate.pixCodeLabel') }}</span>
          <p class="pix-code-hint">{{ $t('donate.pixCodeHint') }}</p>
          <button type="button" class="btn btn-secondary pix-copy-code-btn" @click="copyPixCode">
            {{ $t('donate.pixCodeCopy') }}
          </button>
          <!-- Fallback quando a cópia automática não é permitida pelo navegador -->
          <textarea
            v-if="showPixCodeFallback"
            ref="pixCodeRef"
            class="pix-code-fallback"
            :aria-label="$t('donate.pixCodeLabel')"
            :value="PIX_COPY_PASTE_CODE"
            rows="3"
            readonly
            @focus="selectPixCode"
          ></textarea>
        </div>

        <p class="pix-copy-status" role="status" aria-live="polite">{{ copyStatus }}</p>

        <p class="donate-highlight">{{ $t('donate.pixFooter') }}</p>
      </section>

      <!-- Card 3: Livro -->
      <section class="donate-card glass" aria-labelledby="donate-book-title">
        <h2 id="donate-book-title" class="donate-card-title">{{ $t('donate.bookTitle') }}</h2>
        <div class="book-content">
          <img
            v-if="showBookCover"
            :src="BOOK_COVER_IMAGE"
            :alt="$t('donate.bookCoverAlt')"
            class="book-cover"
            width="140"
            loading="lazy"
            @error="showBookCover = false"
          />
          <div class="book-text">
            <p>{{ $t('donate.bookLead') }}</p>
            <p class="donate-highlight">{{ $t('donate.bookProfit') }}</p>
          </div>
        </div>
        <a
          v-if="BOOK_PURCHASE_URL"
          :href="BOOK_PURCHASE_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-primary donate-card-cta"
        >
          {{ $t('donate.bookCta') }}<NewWindowIcon />
        </a>
        <p v-else class="book-soon">{{ $t('donate.bookSoon') }}</p>
      </section>
    </div>

    <!-- Outras formas -->
    <section class="donate-other glass" aria-labelledby="donate-other-title">
      <h2 id="donate-other-title" class="donate-card-title">{{ $t('donate.otherTitle') }}</h2>
      <p>{{ $t('donate.otherDesc') }}</p>
      <NuxtLink :to="localePath('/contato')" class="btn btn-secondary">
        {{ $t('donate.otherCta') }}
      </NuxtLink>
    </section>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const { t } = useI18n()
const localePath = useLocalePath()

// Dados de doação (cards oficiais do Vale PCD)
const PIX_KEY_DISPLAY = '49.682.457/0001-12'
const PIX_KEY_VALUE = '49682457000112'
// Pix Copia e Cola (BR Code estático, valor livre, CRC verificado): ASSOCIACAO VALE PCD - RECIFE
const PIX_COPY_PASTE_CODE = '00020126360014br.gov.bcb.pix0114496824570001125204000053039865802BR5919ASSOCIACAO VALE PCD6006RECIFE6226052246pslUSiNRJr8iwvyOgpBI63040A81'
const PIX_QR_IMAGE = '/images/doacao/pix-qrcode.webp'
const BOOK_COVER_IMAGE = '/images/doacao/livro-mulheres-na-psicologia-3.webp'
// Link de compra do livro pela fundadora. Enquanto vazio, a página mostra "Link de compra em breve".
const BOOK_PURCHASE_URL = 'https://pagamento.pagbank.com.br/pagamento?code=9d325bf4-20e6-4a8a-9544-5d6a12ea6c44&t=5372f669-b36f-48ed-9d76-d3b50e4f2ae2'

const showQrCode = ref(true)
const showBookCover = ref(true)
const copyStatus = ref('')
const pixInputRef = ref(null)
const pixCodeRef = ref(null)
const showPixCodeFallback = ref(false)
let statusTimer = null

const selectPixInput = () => {
  pixInputRef.value?.select()
}

const setStatus = (message) => {
  if (statusTimer) clearTimeout(statusTimer)
  copyStatus.value = ''
  // Pequeno atraso para leitores de tela anunciarem mesmo em cliques repetidos
  setTimeout(() => {
    copyStatus.value = message
    statusTimer = setTimeout(() => { copyStatus.value = '' }, 5000)
  }, 50)
}

const selectPixCode = () => {
  pixCodeRef.value?.select()
}

const copyPixCode = async () => {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable')
    await navigator.clipboard.writeText(PIX_COPY_PASTE_CODE)
    setStatus(t('donate.pixCodeCopied'))
  } catch {
    showPixCodeFallback.value = true
    await nextTick()
    pixCodeRef.value?.focus()
    selectPixCode()
    setStatus(t('donate.pixCodeCopyFailed'))
  }
}

const copyPixKey = async () => {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable')
    await navigator.clipboard.writeText(PIX_KEY_VALUE)
    setStatus(t('donate.pixCopied'))
  } catch {
    selectPixInput()
    setStatus(t('donate.pixCopyFailed'))
  }
}
</script>

<style scoped>
.donate-page {
  padding: 4rem 0 5rem;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.donate-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 820px;
  margin: 0 auto;
}

.donate-title {
  font-size: clamp(2rem, 5vw, 3.2rem);
  font-weight: 800;
  line-height: 1.15;
}

.donate-lead {
  font-size: clamp(1.05rem, 1.8vw, 1.25rem);
  line-height: 1.7;
  color: var(--text-muted);
}

.donate-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.75rem;
  align-items: stretch;
}

@media (max-width: 1024px) {
  .donate-grid {
    grid-template-columns: 1fr;
    max-width: 680px;
    margin: 0 auto;
    width: 100%;
  }
}

.donate-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
  border: 1px solid var(--border);
  border-top: 6px solid var(--primary);
  border-radius: var(--radius-xl);
}

.donate-card p {
  line-height: 1.65;
  color: var(--text-muted);
}


.donate-card-title {
  font-size: clamp(1.3rem, 2.2vw, 1.6rem);
  font-weight: 800;
  line-height: 1.25;
  color: var(--text);
}

.donate-list {
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.donate-highlight {
  margin-top: auto;
  font-weight: 700;
  color: var(--primary) !important;
}

[data-theme="dark"] .donate-highlight {
  color: var(--text) !important;
}

.pix-qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.pix-qr {
  width: 220px;
  height: 220px;
  padding: 0.75rem;
  background: #ffffff;
  border-radius: var(--radius-lg, 14px);
  border: 1px solid var(--border);
}

.pix-qr-hint {
  font-size: 0.9rem;
  text-align: center;
}

.pix-key-box {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.pix-key-label {
  font-weight: 700;
  color: var(--text);
}

.pix-key-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.pix-key-input {
  flex: 1 1 180px;
  min-width: 0;
  padding: 0.75rem 0.9rem;
  font-size: 1.05rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: var(--text);
  background: var(--surface);
  border: 2px solid var(--border-strong, var(--border));
  border-radius: var(--radius-md, 10px);
}

.pix-key-input:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}

.pix-copy-btn {
  flex: 0 0 auto;
}

.pix-code-hint {
  font-size: 0.92rem;
}

.pix-copy-code-btn {
  align-self: flex-start;
}

.pix-code-fallback {
  width: 100%;
  padding: 0.6rem 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  word-break: break-all;
  color: var(--text);
  background: var(--surface);
  border: 2px solid var(--border-strong, var(--border));
  border-radius: var(--radius-md, 10px);
  resize: none;
}

.pix-code-fallback:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}

.pix-copy-status {
  min-height: 1.4em;
  font-size: 0.92rem;
  font-weight: 600;
}

.book-content {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.book-cover {
  width: 110px;
  height: auto;
  border-radius: 6px;
  box-shadow: var(--shadow-md);
  flex-shrink: 0;
}

.book-text {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.donate-card-cta {
  align-self: flex-start;
}

.book-soon {
  font-weight: 700;
  font-style: italic;
}

.donate-other {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  padding: 2.5rem 2rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  max-width: 820px;
  margin: 0 auto;
  width: 100%;
}

.donate-other p {
  color: var(--text-muted);
  line-height: 1.6;
}
</style>
