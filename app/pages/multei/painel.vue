<template>
  <div class="painel-page container" :class="{ 'theme-dark': currentTheme === 'dark' }">
    <!-- Atalho de teclado para pular direto para a área de conteúdo do painel (Acessibilidade) -->
    <a href="#painel-main" class="painel-skip-link" @click="handleSkipToContent">Pular para o conteúdo</a>

    <!-- Anúncio acessível para leitores de tela -->
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ srAnnouncement }}
    </div>

    <!-- Barra de Navegação Superior -->
    <div class="top-nav-bar">
      <div class="top-nav-left">
        <NuxtLink to="/multei" class="btn-back-multei" title="Voltar para o mapa interativo do Multei">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" class="back-icon" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Mapa do Multei</span>
        </NuxtLink>

        <NuxtLink to="/multei/sobre" target="_blank" rel="noopener" class="btn-secondary-nav">
          <span aria-hidden="true">📊</span>
          <span>Estatísticas ao vivo</span>
          <span class="sr-only">(abre em nova aba)</span>
        </NuxtLink>

        <span v-if="isDevMockMode" class="dev-mock-pill">
          <span aria-hidden="true">🧪</span>
          <span>Mock BH (localhost)</span>
          <span class="sr-only">: ambiente local com dados simulados de Belo Horizonte, sem chamadas reais ao Firebase</span>
        </span>
      </div>

      <div v-if="userProfile" class="user-session-bar">
        <button
          v-if="isDevMockMode"
          type="button"
          class="btn-reset-mocks"
          title="Restaurar os arquivos de resposta mockados de Belo Horizonte ao estado inicial"
          @click="handleResetBhMocks"
        >
          <span aria-hidden="true">🔄</span>
          <span>Resetar Mocks BH</span>
        </button>
        <span class="live-monitor-badge">
          <span class="live-monitor-dot" aria-hidden="true"></span>
          <span>Ao vivo</span>
          <span class="sr-only">{{ liveMonitorDescription }}</span>
        </span>
        <span class="role-badge" :class="isAdminRole ? 'role-admin' : 'role-parceiro'">
          <span aria-hidden="true">{{ isAdminRole ? '🛡️' : '🤝' }}</span>
          <span>{{ isAdminRole ? 'Administração' : 'Parceria' }}</span>
          <span v-if="!isAdminRole && userProfile.cidade"> • {{ userProfile.cidade }}</span>
        </span>
        <span class="user-name-text">
          {{ userProfile.nomeCompleto || [userProfile.nome, userProfile.sobrenome].filter(Boolean).join(' ') || userProfile.email }}
        </span>
        <button type="button" class="btn-logout" @click="handleLogout">
          Sair
        </button>
      </div>
    </div>

    <!-- Estado de Carregamento Inicial da Autenticação -->
    <div v-if="isCheckingAuth" class="state-card">
      <div class="spinner-circle" aria-hidden="true"></div>
      <p class="state-text">Verificando sessão de acesso...</p>
    </div>

    <!-- TELA DE LOGIN (Desautenticado) -->
    <section
      v-else-if="!userProfile"
      id="painel-main"
      tabindex="-1"
      class="login-section painel-main-region"
      aria-labelledby="login-heading"
    >
      <div class="login-card">
        <div class="login-header">
          <h1 id="login-heading" class="login-title">Painel do Multei</h1>
        </div>

        <form class="login-form" novalidate @submit.prevent="handleLogin">
          <div class="form-field">
            <label for="painel-email" class="field-label">E-mail</label>
            <input
              id="painel-email"
              ref="emailInputRef"
              v-model="loginEmail"
              type="email"
              required
              autocomplete="username"
              placeholder="seu.email@orgao.gov.br"
              class="field-input"
              :aria-invalid="loginErrorField === 'email' || loginErrorField === 'both' ? 'true' : undefined"
              :aria-describedby="loginError ? 'login-error-alert' : undefined"
              :disabled="isLoggingIn"
              @input="clearLoginError"
            />
          </div>

          <div class="form-field">
            <label for="painel-password" class="field-label">Senha</label>
            <div class="password-input-wrap">
              <input
                id="painel-password"
                ref="passwordInputRef"
                v-model="loginPassword"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                placeholder="••••••••"
                class="field-input password-input"
                :aria-invalid="loginErrorField === 'password' || loginErrorField === 'both' ? 'true' : undefined"
                :aria-describedby="loginError ? 'login-error-alert' : undefined"
                :disabled="isLoggingIn"
                @input="clearLoginError"
              />
              <button
                type="button"
                class="btn-toggle-pass"
                :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                @click="showPassword = !showPassword"
              >
                <span aria-hidden="true">{{ showPassword ? '🙈' : '👁️' }}</span>
              </button>
            </div>
          </div>

          <p v-if="loginError" id="login-error-alert" class="login-error-alert" role="alert">
            {{ loginError }}
          </p>

          <button type="submit" class="btn-login-submit" :disabled="isLoggingIn">
            <span>{{ isLoggingIn ? 'Autenticando...' : 'Entrar' }}</span>
          </button>
        </form>

        <!-- Esqueci minha senha (resposta neutra: nunca revela se o e-mail está cadastrado) -->
        <div class="forgot-password-area">
          <button
            ref="forgotToggleRef"
            type="button"
            class="btn-link-forgot"
            :aria-expanded="showForgotPassword ? 'true' : 'false'"
            aria-controls="painel-forgot-panel"
            @click="toggleForgotPassword"
          >
            Esqueci minha senha
          </button>

          <div v-show="showForgotPassword" id="painel-forgot-panel" class="forgot-password-panel">
            <form class="forgot-password-form" novalidate aria-labelledby="painel-forgot-heading" @submit.prevent="handleForgotPassword">
              <h2 id="painel-forgot-heading" class="forgot-title">Redefinir senha</h2>
              <p class="forgot-help">
                Informe o e-mail de acesso. Enviaremos um link para você criar uma nova senha.
              </p>
              <div class="form-field">
                <label for="painel-forgot-email" class="field-label">E-mail de acesso</label>
                <input
                  id="painel-forgot-email"
                  ref="forgotEmailInputRef"
                  v-model="forgotEmail"
                  type="email"
                  autocomplete="username"
                  placeholder="seu.email@orgao.gov.br"
                  class="field-input"
                  :aria-invalid="forgotStatus === 'invalid' ? 'true' : undefined"
                  aria-describedby="painel-forgot-feedback"
                  :disabled="isSendingForgot"
                  @input="clearForgotFeedback"
                />
              </div>

              <p
                id="painel-forgot-feedback"
                class="forgot-feedback"
                :class="{
                  'is-error': forgotStatus === 'invalid' || forgotStatus === 'error',
                  'is-ok': forgotStatus === 'sent',
                  'is-wait': forgotStatus === 'throttled'
                }"
                role="status"
                aria-live="polite"
              >{{ forgotMessage }}</p>

              <div class="forgot-actions">
                <button type="submit" class="btn-login-submit btn-forgot-submit" :disabled="isSendingForgot">
                  <span>{{ isSendingForgot ? 'Enviando...' : 'Enviar link de redefinição' }}</span>
                </button>
                <button type="button" class="btn-forgot-cancel" @click="closeForgotPassword">
                  Voltar ao login
                </button>
              </div>
            </form>
          </div>
        </div>

        <p class="login-subtitle login-access-help">
          Não tem acesso?
          <NuxtLink to="/contato" class="login-contact-link">Fale com a Vale PCD</NuxtLink>
        </p>

        <div v-if="isDevMockMode" class="dev-mock-login-box">
          <p class="dev-mock-login-title">
            <span aria-hidden="true">🧪</span>
            Acesso rápido local (Mocks Belo Horizonte)
          </p>
          <div class="dev-mock-login-actions">
            <button
              type="button"
              class="btn-dev-mock-login"
              :disabled="isLoggingIn"
              @click="handleDevQuickLogin('admin@valepcd.com.br')"
            >
              <span aria-hidden="true">🛡️</span>
              Entrar como Admin (BH)
            </button>
            <button
              type="button"
              class="btn-dev-mock-login"
              :disabled="isLoggingIn"
              @click="handleDevQuickLogin('parceria@pbh.gov.br')"
            >
              <span aria-hidden="true">🤝</span>
              Entrar como Parceria PBH
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- PAINEL AUTENTICADO (Parceria acessa as abas Ocorrências da cidade e Resoluções; Admin tem acesso a todas) -->
    <section v-else class="admin-panel-section" aria-labelledby="painel-heading">
      <h1 id="painel-heading" class="sr-only">Painel do Multei</h1>

      <!-- Fila de notificações em tempo real (agrupadas por tipo e cidade; pausam com mouse/foco) -->
      <div
        ref="liveToastRegionRef"
        class="live-toast-region"
        role="status"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Notificações em tempo real"
        @mouseenter="isToastHovered = true"
        @mouseleave="isToastHovered = false"
        @focusin="isToastFocused = true"
        @focusout="handleToastFocusOut"
      >
        <TransitionGroup name="live-toast-fade" tag="ul" class="live-toast-list">
          <li v-for="toast in liveToasts" :key="toast.key" class="live-panel-toast">
            <div class="live-panel-toast-body">
              <span class="live-panel-toast-icon" aria-hidden="true">🔔</span>
              <div class="live-panel-toast-texts">
                <strong class="live-panel-toast-title">{{ getLiveToastTitle(toast) }}</strong>
                <span v-if="toast.latestSubtitle" class="live-panel-toast-subtitle">
                  <template v-if="toast.count > 1">Mais recente: </template>{{ toast.latestSubtitle }}
                </span>
              </div>
            </div>
            <div class="live-panel-toast-actions">
              <button
                type="button"
                class="btn-live-toast-view"
                @click="openLiveToast(toast)"
              >
                Ver<span class="sr-only">: {{ getLiveToastTitle(toast) }}</span>
              </button>
              <button
                type="button"
                class="btn-live-toast-dismiss"
                :aria-label="`Fechar notificação: ${getLiveToastTitle(toast)}`"
                @click="dismissLiveToast(toast.key, true)"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </li>
        </TransitionGroup>
      </div>

      <!-- Navegação de Abas (padrão ARIA Tabs: setas, Home/End e tabindex móvel) -->
      <div class="admin-module-tabs" role="tablist" aria-label="Módulos do painel">
        <button
          v-for="(tab, idx) in moduleTabs"
          :id="`painel-tab-${tab.id}`"
          :key="tab.id"
          :ref="(el) => setModuleTabRef(tab.id, el)"
          type="button"
          role="tab"
          class="admin-module-tab-btn"
          :class="{ 'is-active': adminMainSection === tab.id }"
          :aria-selected="adminMainSection === tab.id ? 'true' : 'false'"
          :aria-controls="`painel-tabpanel-${tab.id}`"
          :tabindex="adminMainSection === tab.id ? 0 : -1"
          @click="switchAdminMainSection(tab.id)"
          @keydown="handleModuleTabKeydown($event, idx)"
        >
          <span aria-hidden="true">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span v-if="tab.badge !== null" class="module-tab-badge">
            <span class="sr-only">(</span>{{ tab.badge }}<span class="sr-only"> {{ tab.badgeSuffix }})</span>
          </span>
        </button>
      </div>

      <!-- Área de conteúdo das abas (alvo do atalho "Pular para o conteúdo") -->
      <div id="painel-main" class="painel-main-region" tabindex="-1">
        <!-- ABA (EXCLUSIVA ADMIN): REPORTES PARA MODERAR -->
        <div
          v-if="isAdminRole"
          v-show="adminMainSection === 'ocorrencias'"
          id="painel-tabpanel-ocorrencias"
          role="tabpanel"
          aria-labelledby="painel-tab-ocorrencias"
          tabindex="0"
          class="painel-tabpanel"
        >
          <PanelReportsTab
            ref="reportsTabRef"
            :active="adminMainSection === 'ocorrencias'"
            @pending-count="reportsPendingCount = $event"
          />
        </div>

        <!-- ABA: OCORRÊNCIAS DA CIDADE (Parcerias: cidade cadastrada + Ao meu redor 5km) -->
        <div
          v-show="adminMainSection === 'denuncias'"
          id="painel-tabpanel-denuncias"
          role="tabpanel"
          aria-labelledby="painel-tab-denuncias"
          tabindex="0"
          class="painel-tabpanel"
        >
          <PanelPartnerIncidentsTab
            ref="partnerTabRef"
            :active="adminMainSection === 'denuncias'"
            @badge-count="partnerTabBadgeCount = $event"
            @resolution-submitted="handlePartnerResolutionSubmitted"
          />
        </div>

        <!-- ABA: RESOLUÇÕES DE CIDADÃOS (Admin e Parcerias • Coleção "resolvidos") -->
        <div
          v-show="adminMainSection === 'resolucoes'"
          id="painel-tabpanel-resolucoes"
          role="tabpanel"
          aria-labelledby="painel-tab-resolucoes"
          tabindex="0"
          class="painel-tabpanel"
        >
          <PanelResolutionsTab
            ref="resolutionsTabRef"
            :active="adminMainSection === 'resolucoes'"
            @pending-count="resolutionsPendingCount = $event"
            @resolution-reviewed="handleResolutionReviewed"
          />
        </div>

        <!-- ABA (EXCLUSIVA ADMIN): USUÁRIOS -->
        <div
          v-if="isAdminRole"
          v-show="adminMainSection === 'usuarios'"
          id="painel-tabpanel-usuarios"
          role="tabpanel"
          aria-labelledby="painel-tab-usuarios"
          tabindex="0"
          class="painel-tabpanel"
        >
          <PanelUsersTab
            ref="usersTabRef"
            :active="adminMainSection === 'usuarios'"
            :after-own-profile-refresh="handleOwnProfileRefreshed"
            @users-count="panelUsersCount = $event"
          />
        </div>

        <!-- ABA (EXCLUSIVA ADMIN): PUBLICAÇÕES NO INSTAGRAM (FASE 1 POR CIDADE & FASE 2 RELATÓRIO) -->
        <div
          v-if="isAdminRole"
          v-show="adminMainSection === 'instagram'"
          id="painel-tabpanel-instagram"
          role="tabpanel"
          aria-labelledby="painel-tab-instagram"
          tabindex="0"
          class="painel-tabpanel"
        >
          <div v-if="adminMainSection === 'instagram'" class="instagram-management-section">
            <InstagramPublisherTab :admin-email="userProfile?.email || ''" />
          </div>
        </div>
      </div>
    </section>

    <!-- Modal do Mapa do Multei no próprio Painel -->
    <div
      v-if="isMulteiMapModalOpen && mapModalTarget"
      ref="multeiMapModalRef"
      class="multei-map-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="multei-map-modal-title"
      @click.self="closeMulteiLocationModal"
    >
      <div class="multei-map-modal-card">
        <header class="multei-map-modal-header">
          <div class="multei-map-modal-headings">
            <span class="panel-kicker">Local da ocorrência</span>
            <h2 id="multei-map-modal-title" class="multei-map-modal-title">
              Local no mapa • {{ formatIncidentLocation(mapModalTarget) }}
            </h2>
            <p class="multei-map-modal-subtitle">
              <template v-if="isLoadingMapIncidents">
                Carregando ocorrências próximas neste endereço...
              </template>
              <template v-else-if="sameSpotOtherIncidentsCount > 0">
                <span aria-hidden="true">⚠️</span> Há <strong>{{ sameSpotOtherIncidentsCount }}</strong>
                {{ sameSpotOtherIncidentsCount === 1 ? 'outra ocorrência ativa' : 'outras ocorrências ativas' }}
                num raio de 60m deste local. Clique nos pinos do mapa para comparar fotos e datas.
              </template>
              <template v-else>
                <span aria-hidden="true">✅</span> Clique no pino do mapa para visualizar o card da ocorrência como no Multei.
              </template>
            </p>
            <p class="multei-map-legend">
              <span class="multei-map-legend-pin" aria-hidden="true"></span>
              <span>Pino destacado = ocorrência selecionada</span>
            </p>
          </div>

          <div class="multei-map-modal-actions">
            <NuxtLink
              :to="`/multei?lat=${mapModalTarget.latitude}&lng=${mapModalTarget.longitude}&zoom=18`"
              target="_blank"
              rel="noopener"
              class="btn-open-multei-tab"
            >
              Ver no mapa completo <span aria-hidden="true">↗</span>
              <span class="sr-only">(abre em nova aba)</span>
            </NuxtLink>
            <button
              type="button"
              class="btn-close-multei-map"
              aria-label="Fechar mapa do local"
              @click="closeMulteiLocationModal"
            >
              <span aria-hidden="true">✕</span> Fechar
            </button>
          </div>
        </header>

        <div class="multei-map-modal-body">
          <MulteiMapDisplay
            :incidents="panelMapIncidents"
            :initial-center="{
              latitude: mapModalTarget.latitude,
              longitude: mapModalTarget.longitude,
              zoom: 18,
              isSearchResult: true
            }"
            :initial-zoom="18"
            :show-user-location-dot="false"
            :highlight-incident-id="mapModalTarget.ocorrenciaId || mapModalTarget.id"
            height="520px"
            @marker-click="handlePanelMapMarkerClick"
          />
        </div>
      </div>
    </div>

    <!-- Modal de Detalhes de Pino Clicado dentro do Mapa de Averiguação -->
    <MulteiIncidentModal
      v-if="inspectedMapIncident"
      :incident="inspectedMapIncident"
      @close="inspectedMapIncident = null"
    />

    <!-- Modal Lightbox para Inspecionar Foto em Tamanho Grande (diálogo com foco retido, Esc e retorno do foco) -->
    <div
      v-if="isLightboxOpen && lightboxPhotoUrl"
      ref="lightboxModalRef"
      class="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="painel-lightbox-title"
      @click.self="closePanelLightbox"
    >
      <div class="lightbox-content">
        <h2 id="painel-lightbox-title" class="sr-only">Foto ampliada da ocorrência</h2>
        <button
          type="button"
          class="btn-close-lightbox"
          aria-label="Fechar foto ampliada"
          @click="closePanelLightbox"
        >
          <span aria-hidden="true">✕</span> Fechar
        </button>
        <img
          :src="lightboxPhotoUrl"
          :alt="lightboxPhotoAlt || 'Foto ampliada da ocorrência'"
          class="lightbox-img"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import InstagramPublisherTab from '~/components/multei/InstagramPublisherTab.vue';
import PanelReportsTab from '~/components/multei/panel/PanelReportsTab.vue';
import PanelPartnerIncidentsTab from '~/components/multei/panel/PanelPartnerIncidentsTab.vue';
import PanelResolutionsTab from '~/components/multei/panel/PanelResolutionsTab.vue';
import PanelUsersTab from '~/components/multei/panel/PanelUsersTab.vue';
import { useModalAccessibility } from '~/composables/useModalAccessibility';
import {
  provideMulteiPanelShared,
  getPanelDistanceMeters as getDistanceMeters,
  formatPanelIncidentLocation as formatIncidentLocation
} from '~/composables/useMulteiPanelShared';
import { normalizeState } from '~/services/geoService';
import { normalizeSearchText } from '~/services/ibgeService';
import {
  signInMulteiPanel,
  signOutMulteiPanel,
  subscribeToMulteiPanelAuth,
  fetchIncidentsByVisibleArea,
  subscribeToMulteiLiveEvents,
  subscribePanelChanges,
  requestPanelPasswordReset,
  normalizeCityKey,
  isFirebaseMockEnabled,
  resetFirebaseMockStore,
  type MulteiLiveDeltaEvent,
  type PanelChangeEvent,
  type MulteiPanelUserProfile,
  type ResolvedIncidentPanelItem,
  type ResolutionReviewDecision
} from '~/services/firebaseService';

const themeCookie = useCookie('theme', { default: () => 'light' });
const currentTheme = useState('theme', () => themeCookie.value || 'light');
const isDevMockMode = ref(Boolean(import.meta.dev));

useHead({
  title: 'Painel de Averiguação | Multei • Vale PcD',
  htmlAttrs: {
    class: 'ads-suppressed'
  },
  bodyAttrs: {
    class: 'ads-suppressed'
  },
  meta: [
    {
      name: 'robots',
      content: 'noindex, nofollow'
    }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon-multei.svg' },
    { rel: 'shortcut icon', href: '/favicon-multei.svg' }
  ]
});

const isCheckingAuth = ref(true);
const userProfile = ref<MulteiPanelUserProfile | null>(null);

const isAdminRole = computed(() => userProfile.value?.role === 'admin');

const loginEmail = ref('');
const loginPassword = ref('');
const showPassword = ref(false);
const isLoggingIn = ref(false);
const loginError = ref('');
const loginErrorField = ref<'' | 'email' | 'password' | 'both'>('');
const emailInputRef = ref<HTMLInputElement | null>(null);
const passwordInputRef = ref<HTMLInputElement | null>(null);

const clearLoginError = () => {
  if (loginError.value) {
    loginError.value = '';
    loginErrorField.value = '';
  }
};

// "Esqueci minha senha": resposta sempre neutra (nunca revela se o e-mail está cadastrado)
const showForgotPassword = ref(false);
const forgotEmail = ref('');
const forgotMessage = ref('');
const forgotStatus = ref<'' | 'sent' | 'throttled' | 'invalid' | 'error'>('');
const isSendingForgot = ref(false);
const forgotEmailInputRef = ref<HTMLInputElement | null>(null);
const forgotToggleRef = ref<HTMLButtonElement | null>(null);

const clearForgotFeedback = () => {
  if (forgotStatus.value === 'invalid' || forgotStatus.value === 'error') {
    forgotStatus.value = '';
    forgotMessage.value = '';
  }
};

const resetForgotPasswordState = () => {
  showForgotPassword.value = false;
  forgotStatus.value = '';
  forgotMessage.value = '';
  isSendingForgot.value = false;
};

const toggleForgotPassword = async () => {
  showForgotPassword.value = !showForgotPassword.value;
  if (!showForgotPassword.value) return;
  if (!forgotEmail.value) {
    forgotEmail.value = loginEmail.value.trim();
  }
  forgotStatus.value = '';
  forgotMessage.value = '';
  await nextTick();
  forgotEmailInputRef.value?.focus();
};

const closeForgotPassword = async () => {
  resetForgotPasswordState();
  await nextTick();
  forgotToggleRef.value?.focus();
};

const handleForgotPassword = async () => {
  if (isSendingForgot.value) return;
  forgotStatus.value = '';
  forgotMessage.value = '';
  isSendingForgot.value = true;
  try {
    const result = await requestPanelPasswordReset(forgotEmail.value);
    if (result.invalidEmail) {
      forgotStatus.value = 'invalid';
      forgotMessage.value = 'Informe um e-mail válido (exemplo: seu.email@orgao.gov.br).';
      await nextTick();
      forgotEmailInputRef.value?.focus();
    } else if (result.throttled) {
      const secs = Math.max(1, Number(result.retryInSeconds) || 1);
      forgotStatus.value = 'throttled';
      forgotMessage.value =
        secs === 1
          ? 'Um link foi pedido há pouco. Aguarde 1 segundo para pedir outro.'
          : `Um link foi pedido há pouco. Aguarde ${secs} segundos para pedir outro.`;
    } else {
      forgotStatus.value = 'sent';
      forgotMessage.value = 'Se o e-mail estiver cadastrado, você receberá um link em instantes.';
    }
  } catch {
    forgotStatus.value = 'error';
    forgotMessage.value = 'Não foi possível enviar o pedido agora. Tente novamente em instantes.';
  } finally {
    isSendingForgot.value = false;
  }
};

type PanelSection = 'ocorrencias' | 'denuncias' | 'resolucoes' | 'usuarios' | 'instagram';

const adminMainSection = ref<PanelSection>('ocorrencias');

// Abas (componentes em components/multei/panel). Cada aba guarda o próprio estado;
// a casca só orquestra carregamentos, tempo real e contadores das abas.
const reportsTabRef = ref<InstanceType<typeof PanelReportsTab> | null>(null);
const partnerTabRef = ref<InstanceType<typeof PanelPartnerIncidentsTab> | null>(null);
const resolutionsTabRef = ref<InstanceType<typeof PanelResolutionsTab> | null>(null);
const usersTabRef = ref<InstanceType<typeof PanelUsersTab> | null>(null);

const reportsPendingCount = ref(0);
const partnerTabBadgeCount = ref<number | null>(null);
const resolutionsPendingCount = ref(0);
const panelUsersCount = ref(0);

// Abas de módulos (padrão ARIA Tabs). Os ids internos foram mantidos por compatibilidade com as abas.
interface PanelModuleTab {
  id: PanelSection;
  label: string;
  icon: string;
  badge: number | null;
  badgeSuffix: string;
}

const moduleTabs = computed<PanelModuleTab[]>(() => {
  const tabs: PanelModuleTab[] = [];
  if (isAdminRole.value) {
    tabs.push({
      id: 'ocorrencias',
      label: 'Reportes para moderar',
      icon: '🚨',
      badge: reportsPendingCount.value,
      badgeSuffix: 'pendentes'
    });
  }
  tabs.push({
    id: 'denuncias',
    label: isAdminRole.value ? 'Ocorrências' : 'Ocorrências da cidade',
    icon: '📍',
    badge: partnerTabBadgeCount.value,
    badgeSuffix: 'em aberto'
  });
  tabs.push({
    id: 'resolucoes',
    label: 'Resoluções de cidadãos',
    icon: '✅',
    badge: resolutionsPendingCount.value,
    badgeSuffix: 'pendentes'
  });
  if (isAdminRole.value) {
    tabs.push({
      id: 'usuarios',
      label: 'Usuários',
      icon: '👥',
      badge: panelUsersCount.value > 0 ? panelUsersCount.value : null,
      badgeSuffix: 'cadastrados'
    });
    tabs.push({ id: 'instagram', label: 'Instagram', icon: '📸', badge: null, badgeSuffix: '' });
  }
  return tabs;
});

const moduleTabRefs = new Map<PanelSection, HTMLElement>();

const setModuleTabRef = (id: PanelSection, el: unknown) => {
  if (el && typeof (el as HTMLElement).focus === 'function') {
    moduleTabRefs.set(id, el as HTMLElement);
  } else {
    moduleTabRefs.delete(id);
  }
};

const handleModuleTabKeydown = (event: KeyboardEvent, idx: number) => {
  const tabs = moduleTabs.value;
  const total = tabs.length;
  if (total === 0) return;
  let nextIdx = -1;
  switch (event.key) {
    case 'ArrowRight':
      nextIdx = (idx + 1) % total;
      break;
    case 'ArrowLeft':
      nextIdx = (idx - 1 + total) % total;
      break;
    case 'Home':
      nextIdx = 0;
      break;
    case 'End':
      nextIdx = total - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  const nextTab = tabs[nextIdx];
  if (!nextTab) return;
  moduleTabRefs.get(nextTab.id)?.focus();
  void switchAdminMainSection(nextTab.id);
};

const liveMonitorDescription = computed(() => {
  if (!userProfile.value) return '';
  return userProfile.value.role === 'admin'
    ? ': atualização automática de novos reportes, resoluções e ocorrências'
    : `: atualização automática de novas ocorrências em ${userProfile.value.cidade || 'sua cidade'}`;
});

const isLightboxOpen = ref(false);
const lightboxPhotoUrl = ref('');
const lightboxPhotoAlt = ref('');
const isMulteiMapModalOpen = ref(false);
const mapModalTarget = ref<any | null>(null);
const isLoadingMapIncidents = ref(false);
const nearbyMapIncidents = ref<any[]>([]);
const inspectedMapIncident = ref<any | null>(null);
const srAnnouncement = ref('');

let unsubscribeAuth: (() => void) | null = null;
let unsubscribeLiveEvents: (() => void) | null = null;

const openPanelLightbox = (url?: string, alt?: string) => {
  if (!url) return;
  lightboxPhotoUrl.value = url;
  lightboxPhotoAlt.value = String(alt || '').trim();
  isLightboxOpen.value = true;
};

const closePanelLightbox = () => {
  isLightboxOpen.value = false;
  lightboxPhotoAlt.value = '';
};

const handleSkipToContent = (event: MouseEvent) => {
  if (typeof document === 'undefined') return;
  const target = document.getElementById('painel-main');
  if (!target) return;
  event.preventDefault();
  target.focus();
  target.scrollIntoView({ block: 'start' });
};

const lightboxModalRef = ref<HTMLElement | null>(null);

useModalAccessibility({
  modalRef: lightboxModalRef,
  isOpen: isLightboxOpen,
  onRequestClose: () => {
    closePanelLightbox();
    return 'closed';
  }
});

const normalizePanelMapAddressToken = (val: any) =>
  String(val || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const getPanelIncidentNaturezaBucket = (inc: any) =>
  String(inc?.natureza || '').trim().toLowerCase() === 'urbana' ? 'urbana' : 'transito';

const getNormalizedPanelIncidentAddressKey = (inc: any) => {
  const rua = normalizePanelMapAddressToken(inc?.rua);
  if (!rua) return '';
  const bairro = normalizePanelMapAddressToken(inc?.bairro);
  const cidade = normalizePanelMapAddressToken(inc?.cidade);
  const estado = normalizePanelMapAddressToken(inc?.estado);
  return `${getPanelIncidentNaturezaBucket(inc)}__${rua}|${bairro}|${cidade}|${estado}`;
};

const groupPanelMapIncidents = (rawList: any[]) => {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  const validList = rawList.filter(Boolean);
  if (validList.length === 0) return [];

  const byId = new Map<string, any>();
  for (const inc of validList) {
    if (inc?.id) {
      byId.set(String(inc.id).trim(), inc);
    }
  }

  const resolveRootKey = (inc: any) => {
    const ownId = inc?.id ? String(inc.id).trim() : '';
    if (!inc?.possivel_duplicidade) {
      return ownId || `${inc.latitude}_${inc.longitude}_${inc.timestamp}`;
    }

    let parentId = inc?.duplicidade_de_id ? String(inc.duplicidade_de_id).trim() : '';

    if (parentId) {
      const visited = new Set([ownId]);
      while (parentId && byId.has(parentId) && !visited.has(parentId)) {
        visited.add(parentId);
        const parentObj = byId.get(parentId);
        const nextParent =
          parentObj?.possivel_duplicidade && parentObj?.duplicidade_de_id
            ? String(parentObj.duplicidade_de_id).trim()
            : '';
        if (nextParent) {
          parentId = nextParent;
        } else {
          break;
        }
      }
      return parentId;
    }

    if (inc?.possivel_duplicidade && String(inc?.natureza || '').toLowerCase() !== 'urbana') {
      const incTime = new Date(inc.timestamp).getTime() || 0;
      for (const other of validList) {
        if (!other || other === inc || !other.id) continue;
        if (other.possivel_duplicidade) continue;
        if (String(other.natureza || '').toLowerCase() === 'urbana') continue;
        const otherTime = new Date(other.timestamp).getTime() || 0;
        const diffMs = Math.abs(incTime - otherTime);
        if (diffMs <= 2 * 60 * 1000) {
          const distMeters = getDistanceMeters(
            Number(inc.latitude),
            Number(inc.longitude),
            Number(other.latitude),
            Number(other.longitude)
          );
          if (distMeters <= 10) {
            return String(other.id).trim();
          }
        }
      }
    }

    return ownId || `${inc.latitude}_${inc.longitude}_${inc.timestamp}`;
  };

  const n = validList.length;
  const parentIdx = Array.from({ length: n }, (_, i) => i);
  const findRoot = (i: number): number => {
    let curr = i;
    while (parentIdx[curr] !== curr) {
      parentIdx[curr] = parentIdx[parentIdx[curr]];
      curr = parentIdx[curr];
    }
    return curr;
  };
  const union = (a: number, b: number) => {
    const rootA = findRoot(a);
    const rootB = findRoot(b);
    if (rootA !== rootB) {
      parentIdx[rootB] = rootA;
    }
  };

  const rootKeys = validList.map((inc) => resolveRootKey(inc));
  const addrKeys = validList.map((inc) => getNormalizedPanelIncidentAddressKey(inc));
  const natBuckets = validList.map((inc) => getPanelIncidentNaturezaBucket(inc));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rootKeys[i] && rootKeys[i] === rootKeys[j]) {
        union(i, j);
        continue;
      }
      if (natBuckets[i] !== natBuckets[j]) continue;

      if (addrKeys[i] && addrKeys[i] === addrKeys[j]) {
        union(i, j);
        continue;
      }

      const distMeters = getDistanceMeters(
        Number(validList[i].latitude),
        Number(validList[i].longitude),
        Number(validList[j].latitude),
        Number(validList[j].longitude)
      );
      if (Number.isFinite(distMeters) && distMeters < 15) {
        union(i, j);
      }
    }
  }

  const addressBucketsMap = new Map<number, any[]>();
  for (let i = 0; i < n; i++) {
    const r = findRoot(i);
    if (!addressBucketsMap.has(r)) {
      addressBucketsMap.set(r, []);
    }
    addressBucketsMap.get(r)!.push(validList[i]);
  }

  const finalGroups: any[][] = [];

  for (const [, bucket] of addressBucketsMap.entries()) {
    if (bucket.length > 3) {
      // Mais de 3 denúncias (4+) no mesmo endereço/ponto e mesma natureza: agrupa em 1 pin único
      finalGroups.push(bucket);
    } else {
      // Até 3 denúncias no mesmo endereço: mantém separadas, exceto possíveis duplicidades
      const dupMap = new Map<string, any[]>();
      for (const inc of bucket) {
        const k = resolveRootKey(inc);
        if (!dupMap.has(k)) {
          dupMap.set(k, []);
        }
        dupMap.get(k)!.push(inc);
      }
      for (const [, dupGroup] of dupMap.entries()) {
        finalGroups.push(dupGroup);
      }
    }
  }

  const groupedResult: any[] = [];
  const occupiedCoordsCount = new Map<string, number>();

  for (const group of finalGroups) {
    if (group.length === 1) {
      const item = group[0];
      const coordKey = `${Number(item.latitude).toFixed(5)}_${Number(item.longitude).toFixed(5)}`;
      const seenCount = occupiedCoordsCount.get(coordKey) || 0;
      occupiedCoordsCount.set(coordKey, seenCount + 1);

      const angle = (seenCount * Math.PI) / 3;
      const offsetLat = seenCount > 0 ? Math.sin(angle) * 0.000032 : 0;
      const offsetLng = seenCount > 0 ? Math.cos(angle) * 0.000032 : 0;

      groupedResult.push({
        ...item,
        latitude: Number(item.latitude) + offsetLat,
        longitude: Number(item.longitude) + offsetLng,
        groupItems: [item],
        groupCount: 1
      });
    } else {
      const sortedGroup = [...group].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return timeB - timeA;
      });

      const primary = sortedGroup[0];
      const coordKey = `${Number(primary.latitude).toFixed(5)}_${Number(primary.longitude).toFixed(5)}`;
      const seenCount = occupiedCoordsCount.get(coordKey) || 0;
      occupiedCoordsCount.set(coordKey, seenCount + 1);

      const angle = (seenCount * Math.PI) / 3;
      const offsetLat = seenCount > 0 ? Math.sin(angle) * 0.000032 : 0;
      const offsetLng = seenCount > 0 ? Math.cos(angle) * 0.000032 : 0;

      groupedResult.push({
        ...primary,
        latitude: Number(primary.latitude) + offsetLat,
        longitude: Number(primary.longitude) + offsetLng,
        groupItems: sortedGroup,
        groupCount: sortedGroup.length
      });
    }
  }

  return groupedResult;
};

const panelMapIncidents = computed(() => {
  const current = mapModalTarget.value;
  if (!current) return groupPanelMapIncidents(nearbyMapIncidents.value);

  const targetId = String(current.ocorrenciaId || current.id || '').trim();
  const isFromResolvidos = Boolean(current.ocorrenciaFotoUrl !== undefined);
  const isResolved = Boolean(
    current.resolvido ||
      current.resultado_revisao === 'procedente' ||
      current.status === 'procedente' ||
      current.status === 'resolvido'
  );
  const basePhoto = isFromResolvidos
    ? current.ocorrenciaFotoUrl || current.fotoUrl
    : current.fotoUrl || current.maskedImageUrl;
  const baseDesc = isFromResolvidos
    ? current.ocorrenciaDescricao || current.descricao
    : current.descricao;

  const currentAsIncident = {
    id: targetId,
    timestamp: current.ocorrenciaData || current.timestamp || current.data,
    data: current.ocorrenciaData || current.data || current.timestamp,
    latitude: current.latitude,
    longitude: current.longitude,
    foto: basePhoto,
    fotoUrl: basePhoto,
    fotoUrl2: current.fotoUrl2 || '',
    fotosUrls: Array.isArray(current.fotosUrls) ? current.fotosUrls : undefined,
    maskedImageUrl: basePhoto,
    natureza: current.natureza,
    descricao: baseDesc,
    rua: current.rua,
    bairro: current.bairro,
    cidade: current.cidade,
    estado: current.estado,
    classificacao: current.classificacao,
    verificacao: current.verificacao,
    ativo: current.ativo ?? true,
    possivel_duplicidade: Boolean(current.possivel_duplicidade),
    duplicidade_de_id: current.duplicidade_de_id || '',
    rotulo_duplicidade: current.rotulo_duplicidade || '',
    motivo_duplicidade: current.motivo_duplicidade || '',
    resolvido: isResolved,
    status_resolucao: isResolved ? 'resolvido' : current.status_resolucao,
    foto_resolucao: isFromResolvidos ? current.fotoUrl || '' : current.foto_resolucao || '',
    descricao_resolucao: isFromResolvidos ? current.descricao || '' : current.descricao_resolucao || '',
    data_resolucao: isFromResolvidos ? current.data || '' : current.data_resolucao || ''
  };

  const others = nearbyMapIncidents.value.filter(
    (inc) => String(inc?.id || '').trim() !== targetId
  );
  return groupPanelMapIncidents([currentAsIncident, ...others]);
});

const sameSpotOtherIncidentsCount = computed(() => {
  const current = mapModalTarget.value;
  if (!current) return 0;
  const targetId = String(current.ocorrenciaId || current.id || '').trim();
  return nearbyMapIncidents.value.filter((inc) => {
    if (String(inc?.id || '').trim() === targetId) return false;
    const d = getDistanceMeters(
      current.latitude,
      current.longitude,
      Number(inc.latitude),
      Number(inc.longitude)
    );
    return Number.isFinite(d) && d <= 60;
  }).length;
});

const openMulteiLocationModalFor = async (target: any) => {
  if (!target) return;
  mapModalTarget.value = target;
  isMulteiMapModalOpen.value = true;
  isLoadingMapIncidents.value = true;
  nearbyMapIncidents.value = [];
  try {
    const list = await fetchIncidentsByVisibleArea({
      center: {
        latitude: Number(target.latitude),
        longitude: Number(target.longitude)
      },
      radiusKm: 1,
      forceRefresh: true
    });
    nearbyMapIncidents.value = Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('[painel] Erro ao carregar ocorrências próximas no mapa:', err);
  } finally {
    isLoadingMapIncidents.value = false;
  }
};

const closeMulteiLocationModal = () => {
  isMulteiMapModalOpen.value = false;
  mapModalTarget.value = null;
  inspectedMapIncident.value = null;
};

const multeiMapModalRef = ref<HTMLElement | null>(null);

useModalAccessibility({
  modalRef: multeiMapModalRef,
  isOpen: isMulteiMapModalOpen,
  onRequestClose: () => {
    if (inspectedMapIncident.value) {
      inspectedMapIncident.value = null;
      return 'subview';
    }
    closeMulteiLocationModal();
    return 'closed';
  }
});

const handlePanelMapMarkerClick = (incident: any) => {
  inspectedMapIncident.value = incident;
};

const announceSr = (msg: string) => {
  srAnnouncement.value = '';
  setTimeout(() => {
    srAnnouncement.value = msg;
  }, 50);
};

const switchAdminMainSection = async (section: PanelSection) => {
  if (!isAdminRole.value && section !== 'denuncias' && section !== 'resolucoes') {
    adminMainSection.value = 'denuncias';
    return;
  }
  adminMainSection.value = section;
  if (section === 'usuarios') {
    await usersTabRef.value?.ensureLoaded();
  } else if (section === 'denuncias') {
    await partnerTabRef.value?.ensureLoaded();
  } else if (section === 'resolucoes') {
    await resolutionsTabRef.value?.ensureLoaded();
  }
};

provideMulteiPanelShared({
  userProfile,
  isAdminRole,
  announceSr,
  openPanelLightbox,
  openMulteiLocationModalFor
});

// Carga inicial após login/restauração de sessão (aguarda as abas montarem).
const loadInitialPanelData = async (role: MulteiPanelUserProfile['role']) => {
  await nextTick();
  if (role === 'admin') {
    await Promise.all([
      reportsTabRef.value?.refresh(),
      partnerTabRef.value?.loadStatsSummary(),
      resolutionsTabRef.value?.refresh({ silent: true })
    ]);
  } else {
    await Promise.all([partnerTabRef.value?.refresh(), resolutionsTabRef.value?.refresh({ silent: true })]);
  }
};

const resetAllTabsState = () => {
  reportsTabRef.value?.resetState();
  resolutionsTabRef.value?.resetState();
  usersTabRef.value?.resetState();
  partnerTabRef.value?.resetState();
};

// ---------------------------------------------------------------------------
// Fila de notificações em tempo real (agrupadas por tipo + cidade)
// ---------------------------------------------------------------------------
type LiveToastKind = 'nova_ocorrencia' | 'novo_report' | 'nova_resolucao';
type LiveToastTarget = 'ocorrencias' | 'denuncias' | 'resolucoes';

interface LiveToastGroup {
  key: string;
  kind: LiveToastKind;
  targetSection: LiveToastTarget;
  cityLabel: string;
  count: number;
  ocorrenciaIds: string[];
  latestSubtitle: string;
  expiresAt: number;
}

const LIVE_TOAST_DURATION_MS = 15000;
const LIVE_TOAST_MAX_GROUPS = 4;
const LIVE_TOAST_ID_DEDUPE_MS = 10 * 60 * 1000;
const LIVE_TOAST_ADDR_DEDUPE_MS = 3 * 60 * 1000;

const liveToasts = ref<LiveToastGroup[]>([]);
const liveToastRegionRef = ref<HTMLElement | null>(null);
const isToastHovered = ref(false);
const isToastFocused = ref(false);
const isLiveToastPaused = computed(() => isToastHovered.value || isToastFocused.value);
let liveToastTicker: ReturnType<typeof setInterval> | null = null;
let liveToastPausedAt = 0;
// Chaves já notificadas (ocorrenciaId ou endereço) para não repetir o aviso quando o barramento ao vivo
// e o Firestore sinalizam o mesmo item.
const seenLiveToastKeys = new Map<string, number>();
// Evita notificar a própria parceria logo após ela enviar uma resolução
let suppressResolutionToastUntil = 0;

const getLiveToastTarget = (kind: LiveToastKind): LiveToastTarget =>
  kind === 'novo_report' ? 'ocorrencias' : kind === 'nova_resolucao' ? 'resolucoes' : 'denuncias';

const getLiveToastTitle = (toast: LiveToastGroup): string => {
  const where = toast.cityLabel ? ` em ${toast.cityLabel}` : '';
  if (toast.kind === 'novo_report') {
    return toast.count > 1
      ? `${toast.count} novos reportes para moderar${where}`
      : `Novo reporte para moderar${where}`;
  }
  if (toast.kind === 'nova_resolucao') {
    return toast.count > 1
      ? `${toast.count} novas resoluções de cidadãos${where}`
      : `Nova resolução de cidadão${where}`;
  }
  return toast.count > 1 ? `${toast.count} novas ocorrências${where}` : `Nova ocorrência${where}`;
};

const buildLiveCityLabel = (cidade?: string, estado?: string): string => {
  const isAdmin = isAdminRole.value;
  return [
    String(cidade || '').trim() || (!isAdmin ? userProfile.value?.cidade || '' : ''),
    String(estado || '').trim() || (!isAdmin ? userProfile.value?.estado || '' : '')
  ]
    .filter(Boolean)
    .join('/');
};

const getNaturezaLabel = (natureza?: string, category?: string): string =>
  String(natureza || '').trim().toLowerCase() === 'urbana' || category === 'mobilidadeUrbana'
    ? 'Mobilidade urbana'
    : 'Infração de trânsito';

const pruneSeenLiveToastKeys = (now: number) => {
  for (const [key, at] of seenLiveToastKeys) {
    const ttl = key.includes(':id:') ? LIVE_TOAST_ID_DEDUPE_MS : LIVE_TOAST_ADDR_DEDUPE_MS;
    if (now - at > ttl) seenLiveToastKeys.delete(key);
  }
};

/**
 * Deduplicação: pelo `ocorrenciaId` quando existe; pelo endereço (rua + cidade) apenas quando um dos dois
 * avisos não trouxe o id (o barramento ao vivo nem sempre envia), para não esconder ocorrências distintas.
 */
const registerLiveToastIfNew = (
  kind: LiveToastKind,
  ocorrenciaId?: string,
  rua?: string,
  cidade?: string
): boolean => {
  const now = Date.now();
  pruneSeenLiveToastKeys(now);
  const id = String(ocorrenciaId || '').trim();
  const ruaKey = normalizeCityKey(rua);
  const addr = ruaKey ? `${ruaKey}|${normalizeCityKey(cidade)}` : '';

  const idKey = id ? `${kind}:id:${id}` : '';
  const addrAnyKey = addr ? `${kind}:addr:${addr}` : '';
  const addrNoIdKey = addr ? `${kind}:addrnoid:${addr}` : '';

  const isDuplicate = id
    ? seenLiveToastKeys.has(idKey) || (addrNoIdKey !== '' && seenLiveToastKeys.has(addrNoIdKey))
    : addrAnyKey !== '' && seenLiveToastKeys.has(addrAnyKey);
  if (isDuplicate) return false;

  if (idKey) seenLiveToastKeys.set(idKey, now);
  if (addrAnyKey) seenLiveToastKeys.set(addrAnyKey, now);
  if (!id && addrNoIdKey) seenLiveToastKeys.set(addrNoIdKey, now);
  return true;
};

const stopLiveToastTicker = () => {
  if (liveToastTicker) {
    clearInterval(liveToastTicker);
    liveToastTicker = null;
  }
};

const ensureLiveToastTicker = () => {
  if (liveToastTicker || typeof window === 'undefined') return;
  liveToastTicker = setInterval(() => {
    if (isLiveToastPaused.value) return;
    const now = Date.now();
    if (liveToasts.value.some((t) => t.expiresAt <= now)) {
      liveToasts.value = liveToasts.value.filter((t) => t.expiresAt > now);
    }
    if (liveToasts.value.length === 0) {
      stopLiveToastTicker();
    }
  }, 1000);
};

// Pausa o tempo de exibição enquanto o mouse ou o foco estiverem sobre as notificações
watch(isLiveToastPaused, (paused) => {
  if (paused) {
    liveToastPausedAt = Date.now();
    return;
  }
  if (liveToastPausedAt) {
    const pausedFor = Date.now() - liveToastPausedAt;
    liveToasts.value.forEach((t) => {
      t.expiresAt += pausedFor;
    });
    liveToastPausedAt = 0;
  }
});

const enqueueLiveToast = (input: {
  kind: LiveToastKind;
  cityLabel: string;
  subtitle: string;
  ocorrenciaId?: string;
  rua?: string;
  cidade?: string;
}) => {
  if (!userProfile.value) return;
  if (input.kind === 'novo_report' && !isAdminRole.value) return;
  if (input.kind === 'nova_resolucao' && Date.now() < suppressResolutionToastUntil) return;
  if (!registerLiveToastIfNew(input.kind, input.ocorrenciaId, input.rua, input.cidade || input.cityLabel)) return;

  const now = Date.now();
  const key = `${input.kind}|${normalizeCityKey(input.cityLabel)}`;
  const id = String(input.ocorrenciaId || '').trim();
  const existing = liveToasts.value.find((t) => t.key === key);
  if (existing) {
    existing.count += 1;
    if (id) {
      existing.ocorrenciaIds.push(id);
      if (existing.ocorrenciaIds.length > 20) existing.ocorrenciaIds.shift();
    }
    existing.latestSubtitle = input.subtitle;
    existing.expiresAt = now + LIVE_TOAST_DURATION_MS;
  } else {
    liveToasts.value.unshift({
      key,
      kind: input.kind,
      targetSection: getLiveToastTarget(input.kind),
      cityLabel: input.cityLabel,
      count: 1,
      ocorrenciaIds: id ? [id] : [],
      latestSubtitle: input.subtitle,
      expiresAt: now + LIVE_TOAST_DURATION_MS
    });
    if (liveToasts.value.length > LIVE_TOAST_MAX_GROUPS) {
      liveToasts.value = liveToasts.value.slice(0, LIVE_TOAST_MAX_GROUPS);
    }
  }
  ensureLiveToastTicker();
};

const focusActiveModuleTab = () => {
  moduleTabRefs.get(adminMainSection.value)?.focus();
};

const dismissLiveToast = async (key: string, moveFocus = false) => {
  liveToasts.value = liveToasts.value.filter((t) => t.key !== key);
  if (liveToasts.value.length === 0) {
    stopLiveToastTicker();
    isToastHovered.value = false;
    isToastFocused.value = false;
  }
  if (!moveFocus) return;
  // O botão focado deixou de existir: leva o foco para a próxima notificação ou para a aba ativa
  await nextTick();
  const nextBtn = liveToastRegionRef.value?.querySelector<HTMLElement>('.btn-live-toast-view');
  if (nextBtn) {
    nextBtn.focus();
  } else {
    isToastFocused.value = false;
    focusActiveModuleTab();
  }
};

const dismissAllLiveToasts = () => {
  liveToasts.value = [];
  stopLiveToastTicker();
  isToastHovered.value = false;
  isToastFocused.value = false;
  liveToastPausedAt = 0;
};

const handleToastFocusOut = (event: FocusEvent) => {
  const next = event.relatedTarget as Node | null;
  if (!next || !liveToastRegionRef.value?.contains(next)) {
    isToastFocused.value = false;
  }
};

const openLiveToast = async (toast: LiveToastGroup) => {
  const latestId = toast.ocorrenciaIds[toast.ocorrenciaIds.length - 1];
  await dismissLiveToast(toast.key);
  isToastFocused.value = false;

  let section: PanelSection = 'denuncias';
  if (toast.targetSection === 'ocorrencias' && isAdminRole.value) {
    section = 'ocorrencias';
    adminMainSection.value = section;
    await reportsTabRef.value?.focusIncident(latestId);
  } else if (toast.targetSection === 'resolucoes') {
    section = 'resolucoes';
    adminMainSection.value = section;
    await resolutionsTabRef.value?.focusIncident(latestId);
  } else {
    adminMainSection.value = section;
    await partnerTabRef.value?.focusIncident(latestId);
  }

  await nextTick();
  if (typeof document !== 'undefined') {
    document.getElementById(`painel-tabpanel-${section}`)?.focus();
  }
};

// ---------------------------------------------------------------------------
// Tempo real via Firestore (subscribePanelChanges): só sinaliza mudanças; cada aba faz o refresh silencioso
// ---------------------------------------------------------------------------
let unsubscribePanelChanges: (() => void) | null = null;
let panelRealtimeKey = '';
let panelRealtimeSinceIso = '';

const isOnOrAfterRealtimeStart = (raw: unknown): boolean => {
  if (!panelRealtimeSinceIso) return false;
  const t = new Date(String(raw || '')).getTime();
  const since = new Date(panelRealtimeSinceIso).getTime();
  return Number.isFinite(t) && Number.isFinite(since) && t >= since;
};

const handlePanelChange = (evt: PanelChangeEvent) => {
  if (!userProfile.value || !evt) return;
  const isAdmin = isAdminRole.value;

  if (evt.collection === 'ocorrencias') {
    partnerTabRef.value?.scheduleSilentRefresh();
  } else if (evt.collection === 'reportadas') {
    if (isAdmin) reportsTabRef.value?.scheduleSilentRefresh();
    partnerTabRef.value?.scheduleSilentRefresh();
  } else if (evt.collection === 'resolvidos') {
    resolutionsTabRef.value?.scheduleSilentRefresh();
    partnerTabRef.value?.scheduleSilentRefresh();
  }

  if (evt.type === 'removed') return;
  const d = evt.data || {};
  const cidade = typeof d.cidade === 'string' ? d.cidade : '';
  const estado = typeof d.estado === 'string' ? d.estado : '';
  const rua = typeof d.rua === 'string' ? d.rua : '';
  const bairro = typeof d.bairro === 'string' ? d.bairro : '';
  const addressPart = [rua, bairro].filter(Boolean).join(' - ');

  if (evt.collection === 'ocorrencias') {
    // Só ocorrências realmente novas (a consulta por data de revisão também pode trazer ocorrências antigas)
    if (evt.type !== 'added' || !isOnOrAfterRealtimeStart(d.data || d.timestamp)) return;
    enqueueLiveToast({
      kind: 'nova_ocorrencia',
      cityLabel: buildLiveCityLabel(cidade, estado),
      subtitle: [getNaturezaLabel(d.natureza), addressPart].filter(Boolean).join(' • '),
      ocorrenciaId: evt.id,
      rua,
      cidade
    });
  } else if (evt.collection === 'reportadas') {
    if (!isAdmin || d.resultado_revisao) return;
    if (!isOnOrAfterRealtimeStart(d.ultima_data_report || d.data)) return;
    enqueueLiveToast({
      kind: 'novo_report',
      cityLabel: buildLiveCityLabel(cidade, estado),
      subtitle: addressPart,
      ocorrenciaId: String(d.ocorrenciaId || evt.id),
      rua,
      cidade
    });
  } else if (evt.collection === 'resolvidos') {
    if (evt.type !== 'added' || !isOnOrAfterRealtimeStart(d.data)) return;
    enqueueLiveToast({
      kind: 'nova_resolucao',
      cityLabel: buildLiveCityLabel(cidade, estado),
      subtitle: addressPart,
      ocorrenciaId: String(d.ocorrenciaId || evt.id),
      rua,
      cidade
    });
  }
};

const stopPanelRealtime = () => {
  if (unsubscribePanelChanges) {
    try {
      unsubscribePanelChanges();
    } catch {}
  }
  unsubscribePanelChanges = null;
  panelRealtimeKey = '';
};

const startPanelRealtime = (profile: MulteiPanelUserProfile | null) => {
  if (typeof window === 'undefined') return;
  if (!profile) {
    stopPanelRealtime();
    return;
  }
  const role: 'admin' | 'parceria' = profile.role === 'admin' ? 'admin' : 'parceria';
  const cidadeKey = role === 'parceria' ? normalizeCityKey(profile.cidade) : '';
  const key = `${profile.uid}|${role}|${cidadeKey}`;
  if (unsubscribePanelChanges && key === panelRealtimeKey) return;

  stopPanelRealtime();
  panelRealtimeSinceIso = new Date().toISOString();
  panelRealtimeKey = key;
  try {
    unsubscribePanelChanges = subscribePanelChanges(
      { role, cidadeKey: cidadeKey || undefined, sinceIso: panelRealtimeSinceIso },
      handlePanelChange
    );
  } catch {
    unsubscribePanelChanges = null;
    panelRealtimeKey = '';
  }
};

const resetPanelLiveState = () => {
  stopPanelRealtime();
  dismissAllLiveToasts();
  seenLiveToastKeys.clear();
};

const handlePartnerResolutionSubmitted = () => {
  suppressResolutionToastUntil = Date.now() + 15000;
  void resolutionsTabRef.value?.refresh({ silent: true });
};

const handleResolutionReviewed = (payload: {
  updated: ResolvedIncidentPanelItem;
  decision: ResolutionReviewDecision;
  reviewerLabel: string;
}) => {
  // Sincroniza a lista de denúncias caso já tenha sido carregada nesta sessão
  partnerTabRef.value?.applyResolutionReview(payload);
};

const handleOwnProfileRefreshed = async (refreshed: MulteiPanelUserProfile) => {
  userProfile.value = refreshed;
  startPanelRealtime(refreshed);
  if (refreshed.role !== 'admin') {
    partnerTabRef.value?.clearFilters();
    resolutionsTabRef.value?.clearFilters();
    adminMainSection.value = 'denuncias';
  }
  await Promise.all([partnerTabRef.value?.refresh(), resolutionsTabRef.value?.refresh()]);
};

const handleLogin = async () => {
  loginError.value = '';
  loginErrorField.value = '';

  const trimmedEmail = loginEmail.value.trim();
  if (!trimmedEmail) {
    loginError.value = 'Por favor, preencha o seu e-mail de acesso.';
    loginErrorField.value = 'email';
    emailInputRef.value?.focus();
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmedEmail)) {
    loginError.value = 'Por favor, insira um endereço de e-mail válido (exemplo: seu.email@orgao.gov.br).';
    loginErrorField.value = 'email';
    emailInputRef.value?.focus();
    return;
  }

  if (!loginPassword.value) {
    loginError.value = 'Por favor, digite a sua senha.';
    loginErrorField.value = 'password';
    passwordInputRef.value?.focus();
    return;
  }

  isLoggingIn.value = true;
  try {
    const profile = await signInMulteiPanel(trimmedEmail, loginPassword.value);
    userProfile.value = profile;
    loginPassword.value = '';
    resetForgotPasswordState();
    announceSr('Login realizado com sucesso.');
    if (profile.role === 'admin') {
      adminMainSection.value = 'ocorrencias';
    } else {
      adminMainSection.value = 'denuncias';
    }
    startPanelRealtime(profile);
    await loadInitialPanelData(profile.role);
  } catch (err: any) {
    const rawError = `${err?.code || ''} ${err?.message || ''}`.toLowerCase();
    if (
      rawError.includes('invalid-credential') ||
      rawError.includes('invalid-login-credentials') ||
      rawError.includes('wrong-password') ||
      rawError.includes('user-not-found')
    ) {
      loginError.value = 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.';
      loginErrorField.value = 'both';
    } else if (rawError.includes('invalid-email')) {
      loginError.value = 'O formato do e-mail informado é inválido. Verifique e tente novamente.';
      loginErrorField.value = 'email';
    } else if (rawError.includes('missing-password')) {
      loginError.value = 'Por favor, digite a sua senha.';
      loginErrorField.value = 'password';
    } else if (rawError.includes('missing-email')) {
      loginError.value = 'Por favor, preencha o seu e-mail de acesso.';
      loginErrorField.value = 'email';
    } else if (rawError.includes('user-disabled')) {
      loginError.value = 'Esta conta de usuário foi desativada pelo administrador.';
      loginErrorField.value = 'both';
    } else if (rawError.includes('too-many-requests')) {
      loginError.value = 'Muitas tentativas seguidas. Por segurança, aguarde alguns instantes e tente novamente.';
      loginErrorField.value = 'both';
    } else if (rawError.includes('network-request-failed')) {
      loginError.value = 'Falha de conexão com a internet. Verifique sua rede e tente novamente.';
    } else if (
      rawError.includes('operation-not-allowed') ||
      rawError.includes('configuration-not-found')
    ) {
      loginError.value = 'O acesso ao painel está temporariamente indisponível. Tente novamente mais tarde.';
    } else {
      loginError.value = 'Não foi possível realizar o login. Verifique suas credenciais e tente novamente.';
      loginErrorField.value = 'both';
    }
  } finally {
    isLoggingIn.value = false;
  }
};

const handleLogout = async () => {
  try {
    resetPanelLiveState();
    await signOutMulteiPanel();
    userProfile.value = null;
    resetAllTabsState();
  } catch {}
};

const handleDevQuickLogin = async (email: string) => {
  if (!isFirebaseMockEnabled() || isLoggingIn.value) return;
  loginEmail.value = email;
  loginPassword.value = 'mock-bh-dev';
  await handleLogin();
};

const handleResetBhMocks = async () => {
  if (!isFirebaseMockEnabled()) return;
  const freshStats = resetFirebaseMockStore();
  partnerTabRef.value?.setStatsTotalGeral(freshStats.totalGeral);
  partnerTabRef.value?.setStatsResolvidos?.(freshStats.resolvidos);
  reportsTabRef.value?.clearSelection();
  resolutionsTabRef.value?.clearSelection();
  partnerTabRef.value?.clearSelection();
  if (userProfile.value?.role === 'admin') {
    await Promise.all([
      reportsTabRef.value?.refresh(),
      partnerTabRef.value?.refresh({ silent: true }),
      resolutionsTabRef.value?.refresh({ silent: true }),
      usersTabRef.value?.refresh()
    ]);
  } else if (userProfile.value) {
    await Promise.all([partnerTabRef.value?.refresh(), resolutionsTabRef.value?.refresh({ silent: true })]);
  }
  announceSr('Mocks de Belo Horizonte restaurados ao estado inicial.');
};

const doesLiveEventMatchPartnerCity = (evt: MulteiLiveDeltaEvent): boolean => {
  if (!userProfile.value) return false;
  if (userProfile.value.role === 'admin') return true;

  const partnerCity = normalizeSearchText(userProfile.value.cidade || '');
  const partnerUf = (normalizeState(userProfile.value.estado || '') || userProfile.value.estado || '')
    .trim()
    .toUpperCase();

  const eventCity = normalizeSearchText(evt.cidade || '');
  const eventUf = (normalizeState(evt.estado || '') || evt.estado || '')
    .trim()
    .toUpperCase();

  if (partnerCity && eventCity && partnerCity !== eventCity) {
    return false;
  }
  if (partnerUf && eventUf && partnerUf !== eventUf) {
    return false;
  }
  return true;
};

let panelAdSuppressionObserver: MutationObserver | null = null;

const suppressPanelAds = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const htmlEl = document.documentElement;
  const bodyEl = document.body;

  if (htmlEl && !htmlEl.classList.contains('ads-suppressed')) {
    htmlEl.classList.add('ads-suppressed');
  }
  if (bodyEl && !bodyEl.classList.contains('ads-suppressed')) {
    bodyEl.classList.add('ads-suppressed');
  }

  if (bodyEl) {
    if (bodyEl.style.paddingBottom && bodyEl.style.paddingBottom !== '0px') {
      bodyEl.style.paddingBottom = '0px';
    }
    if (bodyEl.style.paddingTop && bodyEl.style.paddingTop !== '0px') {
      bodyEl.style.paddingTop = '0px';
    }
  }

  const adNodes = document.querySelectorAll(
    'ins.adsbygoogle, .adsbygoogle, .adsbygoogle-noablate, .google-auto-placed, [data-anchor-status], [data-ad-status], [data-vignette-loaded], div[id^="google_ads_iframe"], iframe[id^="aswift_"], div[id^="aswift_"]'
  );
  adNodes.forEach((node) => {
    const container =
      node.closest('ins.adsbygoogle, .adsbygoogle-noablate, .google-auto-placed, [data-anchor-status]') || node;
    if (container instanceof HTMLElement) {
      container.remove();
    }
  });
};

watch(adminMainSection, () => {
  suppressPanelAds();
});

onMounted(() => {
  isDevMockMode.value = isFirebaseMockEnabled();
  suppressPanelAds();

  if (typeof MutationObserver !== 'undefined' && document.body) {
    panelAdSuppressionObserver = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some((m) => m.addedNodes && m.addedNodes.length > 0);
      if (hasAddedNodes) {
        suppressPanelAds();
      }
    });
    panelAdSuppressionObserver.observe(document.body, {
      childList: true,
      subtree: false
    });
  }

  unsubscribeAuth = subscribeToMulteiPanelAuth(
    async (profile) => {
      const wasAlreadyLoggedIn = Boolean(
        userProfile.value && profile && userProfile.value.uid === profile.uid
      );
      userProfile.value = profile;
      isCheckingAuth.value = false;
      // Idempotente: (re)inicia o tempo real do Firestore na restauração de sessão ou troca de perfil
      if (profile) {
        startPanelRealtime(profile);
      }
      if (wasAlreadyLoggedIn) {
        return;
      }
      if (profile?.role === 'admin') {
        adminMainSection.value = 'ocorrencias';
        await loadInitialPanelData('admin');
      } else if (profile) {
        adminMainSection.value = 'denuncias';
        await loadInitialPanelData(profile.role);
      } else {
        resetPanelLiveState();
        resetAllTabsState();
      }
    },
    () => {
      resetPanelLiveState();
      resetAllTabsState();
      loginError.value = 'Sua sessão de 24 horas expirou. Por favor, faça login novamente.';
      announceSr(loginError.value);
    }
  );

  // Listener em tempo real (SSE + Poll + BroadcastChannel, igual ao contador ao vivo de /multei/sobre)
  // para atualizar automaticamente novos reports, denúncias e resoluções sem precisar clicar em "Atualizar",
  // e notificar o parceiro quando uma nova ocorrência acontece na sua cidade cadastrada.
  // Complementa o tempo real do Firestore (subscribePanelChanges); os avisos são deduplicados por ocorrência.
  unsubscribeLiveEvents = subscribeToMulteiLiveEvents((evt) => {
    if (!userProfile.value) return;

    const isAdmin = userProfile.value.role === 'admin';
    const matchesCity = doesLiveEventMatchPartnerCity(evt);

    if (isAdmin && (evt.category === 'reportadas' || evt.delta === -1)) {
      reportsTabRef.value?.scheduleSilentRefresh();
    }

    if (!matchesCity) {
      return;
    }

    if (evt.category === 'resolvidos' || evt.action === 'nova_resolucao') {
      resolutionsTabRef.value?.scheduleSilentRefresh();
    }

    if (isAdmin && (evt.category === 'infracoesTransito' || evt.category === 'mobilidadeUrbana')) {
      partnerTabRef.value?.applyLiveStatsDelta(evt.delta);
    }

    if (
      evt.category === 'infracoesTransito' ||
      evt.category === 'mobilidadeUrbana' ||
      evt.category === 'resolvidos' ||
      evt.category === 'denunciasPainel' ||
      evt.category === 'reportadas'
    ) {
      partnerTabRef.value?.scheduleSilentRefresh();
    }

    // Notificação visual (fila agrupada) para novas ocorrências, resoluções ou reportes
    const addressPart = [evt.rua, evt.bairro].filter(Boolean).join(' - ');
    if (
      evt.delta === 1 &&
      (evt.category === 'infracoesTransito' || evt.category === 'mobilidadeUrbana')
    ) {
      enqueueLiveToast({
        kind: 'nova_ocorrencia',
        cityLabel: buildLiveCityLabel(evt.cidade, evt.estado),
        subtitle: [getNaturezaLabel(evt.natureza, evt.category), addressPart].filter(Boolean).join(' • '),
        ocorrenciaId: evt.ocorrenciaId,
        rua: evt.rua,
        cidade: evt.cidade
      });
    } else if (evt.delta === 1 && evt.category === 'resolvidos' && evt.action === 'nova_resolucao') {
      enqueueLiveToast({
        kind: 'nova_resolucao',
        cityLabel: buildLiveCityLabel(evt.cidade, evt.estado),
        subtitle: addressPart,
        ocorrenciaId: evt.ocorrenciaId,
        rua: evt.rua,
        cidade: evt.cidade
      });
    } else if (isAdmin && evt.delta === 1 && evt.category === 'reportadas' && evt.action === 'novo_report') {
      enqueueLiveToast({
        kind: 'novo_report',
        cityLabel: [evt.cidade, evt.estado].filter(Boolean).join('/'),
        subtitle: addressPart,
        ocorrenciaId: evt.ocorrenciaId,
        rua: evt.rua,
        cidade: evt.cidade
      });
    }
  });
});

onBeforeUnmount(() => {
  if (panelAdSuppressionObserver) {
    panelAdSuppressionObserver.disconnect();
    panelAdSuppressionObserver = null;
  }
  if (typeof document !== 'undefined') {
    document.documentElement?.classList.remove('ads-suppressed');
    document.body?.classList.remove('ads-suppressed');
  }
  if (typeof unsubscribeAuth === 'function') {
    unsubscribeAuth();
  }
  if (typeof unsubscribeLiveEvents === 'function') {
    unsubscribeLiveEvents();
  }
  stopPanelRealtime();
  stopLiveToastTicker();
});
</script>

<style scoped src="../../assets/css/multei-panel.css"></style>

<style scoped>
.painel-page {
  --pp-text-primary: #0f172a;
  --pp-text-secondary: #1e293b;
  --pp-surface: #ffffff;
  --pp-surface-alt: #f8fafc;
  --pp-border: #cbd5e1;
  --pp-border-strong: #64748b;
  --pp-accent: #4a044e;
  --pp-accent-hover: #2e0231;
  --pp-accent-text: #ffffff;
  --pp-selected-bg: #fdf4ff;
  --pp-selected-border: #701a75;

  --pp-green-bg: #ecfdf5;
  --pp-green-border: #047857;
  --pp-green-text: #064e3b;

  --pp-red-bg: #fef2f2;
  --pp-red-border: #991b1b;
  --pp-red-text: #7f1d1d;

  /* Ação destrutiva sólida (texto branco: contraste ≥ 6:1 nos dois temas) */
  --pp-danger-border: #991b1b;
  --pp-danger-solid: #b91c1c;
  --pp-danger-solid-text: #ffffff;

  --pp-amber-bg: #fffbeb;
  --pp-amber-border: #92400e;
  --pp-amber-text: #78350f;

  --pp-select-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%230f172a' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5'/%3E%3C/svg%3E");

  max-width: 1240px;
  margin: 0 auto;
  padding: 1.75rem 1.25rem 4rem;
}

.painel-page.theme-dark,
:global([data-theme="dark"] .painel-page) {
  --pp-text-primary: #ffffff;
  --pp-text-secondary: #e2e8f0;
  --pp-surface: #171c26;
  --pp-surface-alt: #0f131a;
  --pp-border: #334155;
  --pp-border-strong: #94a3b8;
  --pp-accent: #f0abfc;
  --pp-accent-hover: #f5d0fe;
  --pp-accent-text: #0f172a;
  --pp-selected-bg: #2e1035;
  --pp-selected-border: #f0abfc;

  --pp-green-bg: #022c22;
  --pp-green-border: #6ee7b7;
  --pp-green-text: #ecfdf5;

  --pp-red-bg: #450a0a;
  --pp-red-border: #fca5a5;
  --pp-red-text: #fef2f2;

  --pp-danger-border: #fca5a5;
  --pp-danger-solid: #b91c1c;
  --pp-danger-solid-text: #ffffff;

  --pp-amber-bg: #451a03;
  --pp-amber-border: #fcd34d;
  --pp-amber-text: #fffbeb;

  --pp-select-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23ffffff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5'/%3E%3C/svg%3E");
}

/* Barra Superior */
.top-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-bottom: 1.75rem;
}

.top-nav-left {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.btn-back-multei,
.btn-secondary-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-weight: 800;
  font-size: 0.9rem;
  padding: 0.6rem 1.15rem;
  border-radius: 9999px;
  text-decoration: none;
  border: 2px solid var(--pp-border-strong);
  transition: all 0.2s ease;
}

.btn-back-multei:hover,
.btn-secondary-nav:hover {
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  border-color: var(--pp-accent);
}

.back-icon {
  width: 17px;
  height: 17px;
}

.user-session-bar {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  background: var(--pp-surface);
  border: 1.5px solid var(--pp-border);
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
}

.live-monitor-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  font-weight: 800;
  padding: 0.22rem 0.65rem;
  border-radius: 9999px;
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1.5px solid var(--pp-green-border);
}

.live-monitor-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
  animation: liveDotPulse 2s ease-in-out infinite;
}

@keyframes liveDotPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(0.88);
  }
}

.live-panel-toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  background: var(--pp-selected-bg);
  border: 2px solid var(--pp-selected-border);
  border-radius: 16px;
  padding: 0.9rem 1.15rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 10px 26px rgba(112, 26, 117, 0.14);
}

.live-panel-toast-body {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.live-panel-toast-icon {
  font-size: 1.35rem;
  line-height: 1;
  flex-shrink: 0;
}

.live-panel-toast-texts {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.live-panel-toast-title {
  font-size: 0.96rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.live-panel-toast-subtitle {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
}

.live-panel-toast-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-shrink: 0;
}

.btn-live-toast-view {
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  border: 2px solid var(--pp-accent);
  font-weight: 800;
  font-size: 0.84rem;
  padding: 0.45rem 0.95rem;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-live-toast-view:hover {
  background: var(--pp-accent-hover);
  border-color: var(--pp-accent-hover);
}

.btn-live-toast-dismiss {
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  border: 1.5px solid var(--pp-border-strong);
  font-weight: 800;
  font-size: 0.84rem;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.live-toast-fade-enter-active,
.live-toast-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.live-toast-fade-enter-from,
.live-toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Fila de notificações em tempo real */
.live-toast-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.live-toast-list:not(:empty) {
  margin-bottom: 1.25rem;
}

.live-toast-list .live-panel-toast {
  margin-bottom: 0;
}

/* Atalho "Pular para o conteúdo" (visível apenas ao receber foco) */
.painel-skip-link {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.painel-skip-link:focus {
  position: fixed;
  top: 16px;
  left: 20px;
  width: auto;
  height: auto;
  z-index: 999999;
  padding: 0.6rem 1.1rem;
  border-radius: 9999px;
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  font-weight: 900;
  text-decoration: none;
  outline: 3px solid var(--pp-text-primary);
  outline-offset: 2px;
}

.painel-main-region:focus:not(:focus-visible) {
  outline: none;
}

.painel-tabpanel:focus-visible {
  outline: 3px solid var(--pp-accent);
  outline-offset: 4px;
  border-radius: 12px;
}

.admin-module-tab-btn:focus-visible {
  outline: 3px solid var(--pp-text-primary);
  outline-offset: 2px;
}

/* Esqueci minha senha / contato */
.forgot-password-area {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.btn-link-forgot {
  background: none;
  border: none;
  padding: 0.25rem 0.4rem;
  color: var(--pp-accent);
  font-size: 0.92rem;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.forgot-password-panel {
  width: 100%;
}

.forgot-password-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 14px;
  background: var(--pp-surface-alt);
  border: 1.5px solid var(--pp-border);
}

.forgot-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.forgot-help {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--pp-text-secondary);
}

.forgot-feedback {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.45;
  color: var(--pp-text-primary);
}

.forgot-feedback:empty {
  display: none;
}

.forgot-feedback.is-error {
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  border: 1.5px solid var(--pp-red-border);
}

.forgot-feedback.is-ok {
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1.5px solid var(--pp-green-border);
}

.forgot-feedback.is-wait {
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1.5px solid var(--pp-amber-border);
}

.forgot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.btn-forgot-submit {
  flex: 1;
  min-width: 200px;
}

.btn-forgot-cancel {
  padding: 0.7rem 1rem;
  border-radius: 12px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
}

.login-access-help {
  margin-top: 1.1rem;
  text-align: center;
}

.login-contact-link {
  color: var(--pp-accent);
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Legenda do pino destacado no mapa */
.multei-map-legend {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.45rem 0 0;
  font-size: 0.84rem;
  font-weight: 800;
  color: var(--pp-text-primary);
}

.multei-map-legend-pin {
  width: 14px;
  height: 14px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  background: #e11d48;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 2px #e11d48;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .live-toast-fade-enter-active,
  .live-toast-fade-leave-active {
    transition: none;
  }

  .live-monitor-dot {
    animation: none;
  }
}

.role-badge {
  font-size: 0.78rem;
  font-weight: 800;
  padding: 0.25rem 0.7rem;
  border-radius: 9999px;
  letter-spacing: 0.03em;
}

.role-admin {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1.5px solid var(--pp-green-border);
}

.role-parceiro {
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1.5px solid var(--pp-amber-border);
}

.user-name-text {
  font-size: 0.9rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.btn-logout {
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  border: 1.5px solid var(--pp-red-border);
  font-weight: 800;
  font-size: 0.82rem;
  padding: 0.3rem 0.8rem;
  border-radius: 9999px;
  cursor: pointer;
}

/* Estados e Login */
.state-card {
  background: var(--pp-surface);
  border: 1.5px solid var(--pp-border);
  border-radius: 22px;
  padding: 3.5rem 1.5rem;
  text-align: center;
}

.state-text {
  font-weight: 700;
  color: var(--pp-text-primary);
  margin: 0.75rem 0 0;
}

.login-section {
  max-width: 460px;
  margin: 2rem auto;
}

.login-card {
  background: var(--pp-surface);
  border: 2px solid var(--pp-border);
  border-radius: 24px;
  padding: 2.25rem 2rem;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: 1.75rem;
}

.login-title {
  font-size: 1.85rem;
  font-weight: 900;
  margin: 0 0 0.5rem;
  color: var(--pp-text-primary);
}

.login-subtitle {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--pp-text-secondary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

/* Modal do Mapa do Multei no Painel */
.multei-map-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9500;
  background: rgba(15, 23, 42, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}

.multei-map-modal-card {
  width: 100%;
  max-width: 1040px;
  background: var(--pp-surface);
  border: 2px solid var(--pp-border);
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.32);
  display: flex;
  flex-direction: column;
}

.multei-map-modal-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.4rem;
  border-bottom: 1.5px solid var(--pp-border);
}

.multei-map-modal-headings {
  flex: 1;
  min-width: 240px;
}

.multei-map-modal-title {
  margin: 0 0 0.3rem;
  font-size: 1.18rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.multei-map-modal-subtitle {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--pp-text-secondary);
}

.multei-map-modal-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.btn-open-multei-tab {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.9rem;
  border-radius: 9999px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.84rem;
  font-weight: 800;
  text-decoration: none;
}

.btn-close-multei-map {
  padding: 0.45rem 0.95rem;
  border-radius: 9999px;
  border: none;
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  font-size: 0.86rem;
  font-weight: 900;
  cursor: pointer;
}

.multei-map-modal-body {
  width: 100%;
  background: var(--pp-surface-alt);
}

/* Lightbox */
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.lightbox-content {
  position: relative;
  max-width: 92vw;
  max-height: 90vh;
}

.btn-close-lightbox {
  position: absolute;
  top: -2.75rem;
  right: 0;
  background: #ffffff;
  color: #0f172a;
  border: none;
  border-radius: 9999px;
  padding: 0.45rem 1rem;
  font-weight: 900;
  cursor: pointer;
}

.lightbox-img {
  max-width: 92vw;
  max-height: 85vh;
  border-radius: 14px;
  object-fit: contain;
}

/* Abas de Módulos do Administrador (Ocorrências vs Gestão de Usuários) */
.admin-module-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.35rem;
  background: var(--pp-surface);
  border: 2px solid var(--pp-border);
  border-radius: 16px;
  margin-bottom: 1.5rem;
}

.admin-module-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.65rem 1.2rem;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--pp-text-secondary);
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
}

.admin-module-tab-btn:hover {
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
}

.admin-module-tab-btn.is-active {
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  box-shadow: 0 4px 12px rgba(74, 4, 78, 0.2);
}

.module-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.45rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 900;
  background: rgba(15, 23, 42, 0.12);
  color: inherit;
}

.admin-module-tab-btn.is-active .module-tab-badge {
  background: rgba(255, 255, 255, 0.22);
}

.dev-mock-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.36rem 0.72rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 800;
  background: var(--pp-amber-bg, rgba(245, 158, 11, 0.16));
  color: var(--pp-amber-text, #b45309);
  border: 1.5px solid rgba(245, 158, 11, 0.45);
  white-space: nowrap;
}

.btn-reset-mocks {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.42rem 0.8rem;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
  background: var(--pp-surface-alt, #f8fafc);
  color: var(--pp-text-primary, #0f172a);
  border: 1.5px solid var(--pp-border, #cbd5e1);
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
}

.btn-reset-mocks:hover {
  border-color: var(--pp-accent, #86007D);
  transform: translateY(-1px);
}

.btn-reset-mocks:active {
  transform: scale(0.98);
}

.dev-mock-login-box {
  margin-top: 1.1rem;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  background: var(--pp-surface-alt, #f8fafc);
  border: 1.5px dashed var(--pp-border-strong, #94a3b8);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.dev-mock-login-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--pp-text-secondary, #475569);
  text-align: center;
}

.dev-mock-login-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.btn-dev-mock-login {
  padding: 0.55rem 0.7rem;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
  background: var(--pp-surface, #ffffff);
  color: var(--pp-text-primary, #0f172a);
  border: 1.5px solid var(--pp-border, #cbd5e1);
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.12s ease;
}

.btn-dev-mock-login:hover:not(:disabled) {
  border-color: var(--pp-accent, #86007D);
  transform: translateY(-1px);
}

.btn-dev-mock-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .dev-mock-login-actions {
    grid-template-columns: 1fr;
  }
}
</style>
