<template>
  <section
    v-if="active"
    ref="rootRef"
    class="resolutions-review-section moderation-tab-root"
    :class="{ 'is-mobile-detail-open': isMobile && mobileDetailOpen }"
    aria-labelledby="admin-heading"
  >
    <!-- ABA: RESOLUÇÕES ENVIADAS POR CIDADÃOS (Disponível para Admin e Parcerias) -->
    <header class="panel-header">
      <div>
        <span class="panel-kicker">{{ kickerLabel }}</span>
        <h2 id="admin-heading" class="panel-main-title">Resoluções enviadas por cidadãos</h2>
        <p class="panel-main-subtitle">
          Quando um cidadão informa que um problema de mobilidade urbana foi corrigido, ele envia uma foto do “depois”. Compare com a foto do “antes” e decida: <strong>confirmar a correção</strong> (a ocorrência passa a aparecer como corrigida no mapa, com as fotos de antes e depois) ou <strong>rejeitar a correção</strong> (a ocorrência continua aparecendo como não corrigida).
        </p>
      </div>

      <div class="header-refresh-group">
        <button
          type="button"
          class="btn-refresh-list"
          :disabled="isLoadingResolutions"
          @click="loadResolutions"
        >
          <span aria-hidden="true">🔄</span>
          <span>{{ isLoadingResolutions ? 'Atualizando...' : 'Atualizar lista' }}</span>
        </button>
        <span v-if="lastUpdatedLabel" class="last-updated-label">{{ lastUpdatedLabel }}</span>
      </div>
    </header>

    <!-- Barra de Filtros -->
    <div class="occurrences-filter-bar" role="region" aria-label="Filtros de resoluções">
      <div class="occurrences-filter-grid" :class="isAdminRole ? 'is-admin-grid' : 'is-partner-grid'">
        <!-- Estado (UF) - Exclusivo Admin -->
        <div v-if="isAdminRole" class="form-field filter-field">
          <label for="filter-resolution-estado" class="field-label">Estado (UF)</label>
          <select
            id="filter-resolution-estado"
            v-model="resolutionFilterEstado"
            class="field-input filter-select"
            @change="handleResolutionEstadoFilterChange"
          >
            <option value="">Todos os estados</option>
            <option v-for="uf in BRAZIL_STATES" :key="uf" :value="uf">
              {{ uf }}
            </option>
          </select>
        </div>

        <!-- Cidade (IBGE) - Exclusivo Admin -->
        <div v-if="isAdminRole" class="form-field filter-field">
          <label for="filter-resolution-cidade" class="field-label">
            Cidade {{ resolutionFilterEstado ? `(${resolutionFilterEstado})` : '' }}
          </label>
          <MulteiCitySearchField
            v-model="resolutionFilterCidade"
            :uf="resolutionFilterEstado"
            input-id="filter-resolution-cidade"
            :allow-clear="true"
          />
        </div>

        <!-- Bairro (Disponível para Parceiros e Admin) -->
        <div class="form-field filter-field">
          <label for="filter-resolution-bairro" class="field-label">Bairro</label>
          <div class="bairro-search-wrap">
            <input
              id="filter-resolution-bairro"
              v-model="resolutionFilterBairro"
              type="text"
              list="resolution-bairros-datalist"
              placeholder="Todos os bairros"
              class="field-input filter-input-with-clear"
            />
            <button
              v-if="resolutionFilterBairro"
              type="button"
              class="btn-inline-clear"
              aria-label="Limpar filtro de bairro"
              @click="resolutionFilterBairro = ''"
            >
              <span aria-hidden="true">✕</span>
            </button>
            <datalist id="resolution-bairros-datalist">
              <option v-for="b in availableResolutionBairros" :key="b" :value="b" />
            </datalist>
          </div>
        </div>
      </div>

      <div v-if="hasActiveResolutionFilters || !isAdminRole" class="filter-bar-footer">
        <span class="filter-active-summary">
          Exibindo <strong>{{ pendingResolutionItems.length + reviewedResolutionItems.length }}</strong> de <strong>{{ scopedResolutions.length }}</strong> resoluções
        </span>
        <button
          v-if="hasActiveResolutionFilters"
          type="button"
          class="btn-clear-all-filters"
          @click="clearResolutionFilters"
        >
          <span aria-hidden="true">✕</span> Limpar filtros
        </button>
      </div>
    </div>

    <div
      class="master-detail-grid"
      :class="{ 'is-mobile-detail-open': isMobile && mobileDetailOpen }"
    >
      <!-- COLUNA ESQUERDA: Lista de resoluções -->
      <section class="master-column" aria-labelledby="resolutions-list-heading">
        <h3 id="resolutions-list-heading" class="sr-only">Lista de resoluções para análise</h3>

        <!-- Sub-abas: Pendentes vs Revisadas (padrão ARIA de abas, com setas/Home/End) -->
        <div class="filter-tabs" role="tablist" aria-label="Filtrar por status de análise">
          <button
            v-for="tab in SUB_TABS"
            :id="`resolutions-subtab-${tab}`"
            :key="tab"
            type="button"
            role="tab"
            :aria-selected="resolutionActiveTab === tab ? 'true' : 'false'"
            aria-controls="resolutions-subpanel"
            :tabindex="resolutionActiveTab === tab ? 0 : -1"
            class="filter-tab-btn"
            :class="{ 'is-active': resolutionActiveTab === tab }"
            @click="selectResolutionTab(tab)"
            @keydown="onSubTabKeydown"
          >
            <span>{{ tab === 'pendentes' ? 'Pendentes' : 'Revisadas' }}</span>
            <span class="tab-counter">{{ tab === 'pendentes' ? pendingResolutionItems.length : reviewedResolutionItems.length }}</span>
          </button>
        </div>

        <div
          id="resolutions-subpanel"
          role="tabpanel"
          class="subtab-panel"
          :aria-labelledby="`resolutions-subtab-${resolutionActiveTab}`"
          :tabindex="isLoadingResolutions || filteredResolutionItems.length === 0 ? 0 : undefined"
        >
          <div v-if="isLoadingResolutions" class="list-empty-state">
            <div class="spinner-circle" aria-hidden="true"></div>
            <p>Carregando resoluções...</p>
          </div>

          <div v-else-if="filteredResolutionItems.length === 0" class="list-empty-state">
            <span class="empty-icon" aria-hidden="true">
              {{ hasActiveResolutionFilters ? '🔎' : resolutionActiveTab === 'pendentes' ? '✨' : '📋' }}
            </span>
            <template v-if="hasActiveResolutionFilters">
              <p class="empty-title">Nenhuma resolução encontrada para os filtros selecionados</p>
              <p class="empty-desc">Altere ou limpe os filtros acima para ver outras resoluções.</p>
            </template>
            <template v-else-if="resolutionActiveTab === 'pendentes'">
              <p class="empty-title">Nenhuma resolução aguardando análise</p>
              <p class="empty-desc">Todas as resoluções enviadas já foram analisadas.</p>
            </template>
            <template v-else>
              <p class="empty-title">Nenhuma resolução analisada até o momento</p>
              <p class="empty-desc">As correções confirmadas ou rejeitadas aparecerão aqui.</p>
            </template>
          </div>

          <ul v-else class="report-list">
            <li
              v-for="resItem in filteredResolutionItems"
              :key="resItem.id"
              class="report-list-item"
            >
              <button
                type="button"
                class="report-item-btn"
                :class="{ 'is-selected': selectedResolutionItem?.id === resItem.id }"
                :aria-current="selectedResolutionItem?.id === resItem.id ? 'true' : undefined"
                :data-item-id="resItem.id"
                @click="selectResolutionIncident(resItem, { openDetail: true })"
              >
                <div class="report-item-top">
                  <span
                    class="natureza-pill"
                    :class="resItem.natureza === 'transito' ? 'pill-transito' : 'pill-urbana'"
                  >
                    <span aria-hidden="true">{{ naturezaIcon(resItem.natureza) }}</span>
                    {{ naturezaLabel(resItem.natureza) }}
                  </span>
                </div>

                <div class="report-item-location">
                  {{ formatLocation(resItem) }}
                </div>

                <p class="report-item-reason">
                  “{{ resItem.descricao || 'Correção enviada para análise' }}”
                </p>

                <div class="report-item-footer">
                  <span class="report-item-date">
                    {{ formatDateTime(resItem.data) }}
                  </span>

                  <span
                    v-if="resItem.revisada"
                    class="verdict-mini-badge"
                    :class="`verdict-${getVerdictInfo(resItem.resultado_revisao).tone}`"
                  >
                    <span aria-hidden="true">{{ getVerdictInfo(resItem.resultado_revisao).icon }}</span>
                    {{ getVerdictInfo(resItem.resultado_revisao).label }}
                  </span>
                  <span v-else class="verdict-mini-badge verdict-pendente">
                    <span aria-hidden="true">⏳</span> Aguardando análise
                  </span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- COLUNA DIREITA: Comparativo Antes/Depois + Decisão -->
      <section class="detail-column" aria-labelledby="resolutions-detail-heading">
        <button
          v-if="isMobile"
          type="button"
          class="btn-back-to-list"
          @click="backToList"
        >
          <span aria-hidden="true">←</span> Voltar à lista
        </button>

        <div v-if="!selectedResolutionItem" class="detail-empty-state">
          <span class="empty-icon" aria-hidden="true">👈</span>
          <h3 id="resolutions-detail-heading" ref="detailHeadingRef" tabindex="-1" class="empty-title">
            Selecione uma resolução na lista
          </h3>
          <p class="empty-desc">
            Escolha um item da lista para comparar as fotos de antes e depois e decidir se a correção é confirmada ou rejeitada.
          </p>
        </div>

        <div v-else class="detail-card">
          <div class="detail-header">
            <div class="detail-header-main">
              <h3 id="resolutions-detail-heading" ref="detailHeadingRef" tabindex="-1" class="detail-title">
                {{ formatLocation(selectedResolutionItem) }}
              </h3>
              <div class="detail-header-badges">
                <span
                  class="natureza-pill"
                  :class="selectedResolutionItem.natureza === 'transito' ? 'pill-transito' : 'pill-urbana'"
                >
                  <span aria-hidden="true">{{ naturezaIcon(selectedResolutionItem.natureza) }}</span>
                  {{ naturezaLabel(selectedResolutionItem.natureza) }}
                </span>

                <span
                  v-if="selectedResolutionItem.revisada"
                  class="verdict-mini-badge"
                  :class="`verdict-${getVerdictInfo(selectedResolutionItem.resultado_revisao).tone}`"
                >
                  <span aria-hidden="true">{{ getVerdictInfo(selectedResolutionItem.resultado_revisao).icon }}</span>
                  {{ getVerdictInfo(selectedResolutionItem.resultado_revisao).label }}
                </span>
                <span v-else class="verdict-mini-badge verdict-pendente">
                  <span aria-hidden="true">⏳</span> Aguardando análise
                </span>
              </div>
            </div>

            <div class="copy-code-wrap">
              <button
                type="button"
                class="btn-copy-code"
                @click="copyCode(selectedResolutionItem.ocorrenciaId || selectedResolutionItem.id, 'main')"
              >
                <span aria-hidden="true">📋</span>
                {{ copiedKey === 'main' ? 'Código copiado' : 'Copiar código da ocorrência' }}
              </button>
              <p v-if="copyFallbackCode" class="copy-fallback">
                Não foi possível copiar automaticamente. Código: <code>{{ copyFallbackCode }}</code>
              </p>
            </div>
          </div>

          <!-- Comparativo ANTES e DEPOIS -->
          <div class="panel-before-after-wrapper">
            <div class="panel-ba-grid">
              <!-- Card ANTES (Ocorrência Original) -->
              <div class="panel-ba-card panel-ba-before">
                <div class="panel-ba-header panel-ba-header-before">
                  <span><span aria-hidden="true">🚧</span> Antes • ocorrência registrada</span>
                </div>
                <div class="panel-ba-photo-wrap">
                  <template v-if="selectedResolutionItem.ocorrenciaFotoUrl">
                    <img
                      :src="selectedResolutionItem.ocorrenciaFotoUrl"
                      alt="Foto de antes: problema registrado na ocorrência"
                      class="panel-ba-img"
                      @click="openPanelLightbox(selectedResolutionItem.ocorrenciaFotoUrl)"
                    />
                    <button
                      type="button"
                      class="btn-expand-photo"
                      @click="openPanelLightbox(selectedResolutionItem.ocorrenciaFotoUrl)"
                    >
                      <span aria-hidden="true">🔍</span> Ampliar foto de antes
                    </button>
                  </template>
                  <div v-else class="photo-missing">
                    <span><span aria-hidden="true">🖼️</span> Foto de antes não disponível</span>
                  </div>
                </div>
                <div v-if="selectedResolutionItem.ocorrenciaData" class="panel-ba-date-box panel-ba-date-before">
                  <span class="panel-ba-date-label">Data da ocorrência</span>
                  <strong class="panel-ba-date-val">
                    {{ formatDateTime(selectedResolutionItem.ocorrenciaData) }}
                  </strong>
                </div>
                <p class="panel-ba-desc">
                  <strong>Descrição da ocorrência:</strong> {{ selectedResolutionItem.ocorrenciaDescricao || 'Não informada' }}
                </p>
              </div>

              <!-- Card DEPOIS (Foto da correção enviada) -->
              <div class="panel-ba-card panel-ba-after">
                <div class="panel-ba-header panel-ba-header-after">
                  <span><span aria-hidden="true">📸</span> Depois • correção enviada</span>
                </div>
                <div class="panel-ba-photo-wrap">
                  <template v-if="selectedResolutionItem.fotoUrl">
                    <img
                      :src="selectedResolutionItem.fotoUrl"
                      alt="Foto de depois: comprovação da correção enviada"
                      class="panel-ba-img"
                      @click="openPanelLightbox(selectedResolutionItem.fotoUrl)"
                    />
                    <button
                      type="button"
                      class="btn-expand-photo"
                      @click="openPanelLightbox(selectedResolutionItem.fotoUrl)"
                    >
                      <span aria-hidden="true">🔍</span> Ampliar foto de depois
                    </button>
                  </template>
                  <div v-else class="photo-missing">
                    <span><span aria-hidden="true">🖼️</span> Sem foto da correção</span>
                  </div>
                </div>
                <div class="panel-ba-date-box panel-ba-date-after">
                  <span class="panel-ba-date-label">Data do envio da correção</span>
                  <strong class="panel-ba-date-val">
                    {{ formatDateTime(selectedResolutionItem.data) }}
                  </strong>
                </div>
                <p class="panel-ba-desc">
                  <strong>Descrição da correção:</strong> {{ selectedResolutionItem.descricao || 'Não informada' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Bloco de Decisão -->
          <div class="detail-moderation-box">
            <div
              v-if="selectedResolutionItem.revisada"
              ref="resultBannerRef"
              tabindex="-1"
              class="reviewed-status-banner"
              :class="`banner-${getVerdictInfo(selectedResolutionItem.resultado_revisao).tone}`"
            >
              <div class="banner-title">
                <span aria-hidden="true">{{ getVerdictInfo(selectedResolutionItem.resultado_revisao).icon }}</span>
                {{ getBannerTitle(selectedResolutionItem.resultado_revisao) }}
              </div>
              <div v-if="selectedResolutionItem.data_revisao" class="banner-meta">
                Analisada em {{ formatDateTime(selectedResolutionItem.data_revisao) }}
                <span v-if="selectedResolutionItem.revisado_por"> por {{ selectedResolutionItem.revisado_por }}</span>
              </div>
              <p class="banner-obs">
                <strong>Observação:</strong>
                {{ selectedResolutionItem.observacao_admin || 'nenhuma observação registrada.' }}
              </p>
            </div>

            <p v-if="resolutionDecisionSuccess" class="user-success-alert">
              {{ resolutionDecisionSuccess }}
            </p>

            <div v-if="selectedResolutionItem.revisada && hasNextPending" class="next-pending-row">
              <button type="button" class="btn-next-pending" @click="goToNextPending">
                Próximo pendente <span aria-hidden="true">→</span>
              </button>
              <span class="next-pending-count">{{ nextPendingCountLabel }}</span>
            </div>
            <p
              v-else-if="selectedResolutionItem.revisada && recentlyDecidedId === selectedResolutionItem.id"
              class="next-pending-count"
            >
              Não há mais resoluções aguardando análise.
            </p>

            <h4 v-if="selectedResolutionItem.revisada" class="box-section-title">Alterar a análise</h4>
            <h4 v-else class="box-section-title">Sua análise</h4>

            <div class="admin-note-field">
              <label for="resolution-obs-input" class="field-label">
                Observação da análise (opcional)
              </label>
              <textarea
                id="resolution-obs-input"
                v-model="resolutionNote"
                :maxlength="NOTE_MAX"
                rows="3"
                placeholder="Ex.: a foto mostra a rampa reparada e livre de obstáculos..."
                class="field-input note-textarea"
                aria-describedby="resolution-obs-counter"
                :disabled="isSubmittingResolutionDecision"
              ></textarea>
              <div class="note-field-footer">
                <span id="resolution-obs-counter" class="note-counter">{{ resolutionNote.length }}/{{ NOTE_MAX }} caracteres</span>
              </div>
            </div>

            <p v-if="resolutionDecisionError" class="login-error-alert" role="alert">
              {{ resolutionDecisionError }}
            </p>

            <!-- Confirmação inline para "Rejeitar correção" -->
            <div
              v-if="isConfirmingReject"
              class="confirm-inline"
              role="group"
              aria-labelledby="resolutions-confirm-title"
              aria-describedby="resolutions-confirm-summary"
              @keydown.esc.prevent="cancelConfirm"
            >
              <p id="resolutions-confirm-title" class="confirm-inline-title">
                <span aria-hidden="true">⚠️</span> Rejeitar esta correção?
              </p>
              <p id="resolutions-confirm-summary" class="confirm-inline-summary">{{ rejectSummary }}</p>
              <p v-if="resolutionNote.trim()" class="confirm-inline-summary">
                <strong>Observação:</strong> {{ resolutionNote.trim() }}
              </p>
              <p class="confirm-inline-hint">
                Se precisar, você poderá alterar esta análise depois, na lista “Revisadas”.
              </p>
              <div class="confirm-inline-actions">
                <button
                  ref="confirmCancelBtnRef"
                  type="button"
                  class="btn-confirm-cancel"
                  :disabled="isSubmittingResolutionDecision"
                  @click="cancelConfirm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn-confirm-destructive"
                  :disabled="isSubmittingResolutionDecision"
                  @click="confirmReject"
                >
                  {{ isSubmittingResolutionDecision ? 'Salvando...' : 'Confirmar rejeição' }}
                </button>
              </div>
            </div>

            <div v-else class="decision-actions-stack">
              <div class="decision-option">
                <button
                  type="button"
                  class="btn-action btn-action-positive"
                  :disabled="isSubmittingResolutionDecision"
                  aria-describedby="resolution-confirm-desc"
                  @click="handleResolutionReviewDecision('procedente')"
                >
                  Confirmar correção
                </button>
                <p id="resolution-confirm-desc" class="decision-option-desc">
                  A ocorrência passa a aparecer como corrigida no mapa, com as fotos de antes e depois.
                </p>
              </div>

              <div class="decision-option">
                <button
                  type="button"
                  class="btn-action btn-action-destructive"
                  :disabled="isSubmittingResolutionDecision"
                  aria-describedby="resolution-reject-desc"
                  @click="requestReject"
                >
                  Rejeitar correção
                </button>
                <p id="resolution-reject-desc" class="decision-option-desc">
                  A ocorrência continua aparecendo como não corrigida. Pede confirmação antes de salvar.
                </p>
              </div>
            </div>
          </div>

          <!-- Dados de Localização -->
          <div class="detail-metadata-box mt-4">
            <h4 class="box-section-title">Dados e localização</h4>
            <div class="metadata-grid">
              <div class="meta-item">
                <span class="meta-label">Data do envio da correção</span>
                <span class="meta-value">{{ formatDateTime(selectedResolutionItem.data) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Cidade / UF</span>
                <span class="meta-value">
                  {{ [selectedResolutionItem.cidade, selectedResolutionItem.estado].filter(Boolean).join(' / ') || 'Não informada' }}
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Logradouro / Bairro</span>
                <span class="meta-value">
                  {{ [selectedResolutionItem.rua, selectedResolutionItem.bairro].filter(Boolean).join(' - ') || 'Não informado' }}
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Localização</span>
                <div class="meta-value meta-coords-row">
                  <button
                    v-if="hasCoords(selectedResolutionItem)"
                    type="button"
                    class="btn-open-multei-map"
                    @click="openMulteiLocationModalFor(selectedResolutionItem)"
                  >
                    <span aria-hidden="true">🗺️</span> Abrir local no Multei
                  </button>
                  <details v-if="hasCoords(selectedResolutionItem)" class="coords-details">
                    <summary>Ver coordenadas</summary>
                    <span class="coords-value">{{ formatCoords(selectedResolutionItem) }}</span>
                  </details>
                  <span v-else>Coordenadas não informadas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { normalizeState } from '~/services/geoService';
import {
  BRAZIL_STATES,
  getCapitalByState,
  normalizeSearchText
} from '~/services/ibgeService';
import {
  fetchResolvedIncidentsForPanel,
  reviewResolvedIncidentInFirebase,
  type ResolvedIncidentPanelItem,
  type ResolutionReviewDecision
} from '~/services/firebaseService';
import {
  useMulteiPanelShared,
  formatPanelDateTime as formatDateTime
} from '~/composables/useMulteiPanelShared';

// Aba "Análise de Resolução" (Admin e Parcerias). Montada enquanto houver sessão;
// `active` só controla a exibição, para preservar estado/filtros ao trocar de aba.
defineProps<{ active: boolean }>();

const emit = defineEmits<{
  (e: 'pending-count', count: number): void;
  (
    e: 'resolution-reviewed',
    payload: {
      updated: ResolvedIncidentPanelItem;
      decision: ResolutionReviewDecision;
      reviewerLabel: string;
    }
  ): void;
}>();

const { userProfile, isAdminRole, announceSr, openPanelLightbox, openMulteiLocationModalFor } =
  useMulteiPanelShared();

type SubTab = 'pendentes' | 'revisadas';
type DecisionTone = 'positive' | 'destructive' | 'neutral';

const SUB_TABS: SubTab[] = ['pendentes', 'revisadas'];
const NOTE_MAX = 500;
const MOBILE_QUERY = '(max-width: 960px)';

const rootRef = ref<HTMLElement | null>(null);
const detailHeadingRef = ref<HTMLElement | null>(null);
const resultBannerRef = ref<HTMLElement | null>(null);
const confirmCancelBtnRef = ref<HTMLButtonElement | null>(null);

// Estado da aba (resoluções enviadas por cidadãos • Admin e Parcerias)
const allResolutions = ref<ResolvedIncidentPanelItem[]>([]);
const isLoadingResolutions = ref(false);
const resolutionActiveTab = ref<SubTab>('pendentes');
const selectedResolutionItem = ref<ResolvedIncidentPanelItem | null>(null);
const resolutionFilterEstado = ref('');
const resolutionFilterCidade = ref('');
const resolutionFilterBairro = ref('');
const resolutionNote = ref('');
const isSubmittingResolutionDecision = ref(false);
const resolutionDecisionError = ref('');
const resolutionDecisionSuccess = ref('');

// Item recém-analisado continua selecionado (sem avanço automático — decisão do usuário)
const recentlyDecidedId = ref<string | null>(null);

// Confirmação inline de "Rejeitar correção"
const isConfirmingReject = ref(false);
let confirmReturnFocusEl: HTMLElement | null = null;

// "Copiar código"
const copiedKey = ref('');
const copyFallbackCode = ref('');
let copiedResetTimer: ReturnType<typeof setTimeout> | null = null;

const kickerLabel = computed(() => {
  if (isAdminRole.value) return 'Análise • Todas as cidades';
  const cidade = userProfile.value?.cidade || '';
  const estado = userProfile.value?.estado || '';
  if (cidade) return estado ? `Parceria • ${cidade}/${estado}` : `Parceria • ${cidade}`;
  return 'Análise de correções';
});

const handleResolutionEstadoFilterChange = () => {
  if (resolutionFilterEstado.value) {
    resolutionFilterCidade.value = getCapitalByState(resolutionFilterEstado.value);
  } else {
    resolutionFilterCidade.value = '';
  }
  resolutionFilterBairro.value = '';
};

const clearResolutionFilters = () => {
  resolutionFilterEstado.value = '';
  resolutionFilterCidade.value = '';
  resolutionFilterBairro.value = '';
};

const hasActiveResolutionFilters = computed(() =>
  Boolean(
    (isAdminRole.value && (resolutionFilterEstado.value || resolutionFilterCidade.value.trim())) ||
      resolutionFilterBairro.value.trim()
  )
);

const scopedResolutions = computed(() => {
  if (isAdminRole.value) {
    return allResolutions.value;
  }
  const partnerCity = normalizeSearchText(userProfile.value?.cidade || '');
  const partnerUf = (normalizeState(userProfile.value?.estado || '') || userProfile.value?.estado || '')
    .trim()
    .toUpperCase();

  return allResolutions.value.filter((item) => {
    if (partnerCity && normalizeSearchText(item.cidade) !== partnerCity) {
      return false;
    }
    if (partnerUf) {
      const itemUf = (normalizeState(item.estado || '') || item.estado || '').trim().toUpperCase();
      if (itemUf && itemUf !== partnerUf) return false;
    }
    return true;
  });
});

const availableResolutionBairros = computed(() => {
  const targetUf = isAdminRole.value ? resolutionFilterEstado.value.trim().toUpperCase() : '';
  const targetCity = isAdminRole.value ? normalizeSearchText(resolutionFilterCidade.value) : '';
  const set = new Set<string>();

  for (const item of scopedResolutions.value) {
    const itemUf = (normalizeState(item.estado || '') || item.estado || '').trim().toUpperCase();
    if (targetUf && itemUf !== targetUf) continue;
    if (targetCity && normalizeSearchText(item.cidade) !== targetCity) continue;
    const b = (item.bairro || '').trim();
    if (b) set.add(b);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
});

const baseFilteredResolutions = computed(() => {
  const targetUf = isAdminRole.value ? resolutionFilterEstado.value.trim().toUpperCase() : '';
  const targetCity = isAdminRole.value ? normalizeSearchText(resolutionFilterCidade.value) : '';
  const targetBairro = normalizeSearchText(resolutionFilterBairro.value);

  return scopedResolutions.value.filter((item) => {
    if (targetUf) {
      const itemUf = (normalizeState(item.estado || '') || item.estado || '').trim().toUpperCase();
      if (itemUf !== targetUf) return false;
    }
    if (targetCity) {
      if (normalizeSearchText(item.cidade) !== targetCity) return false;
    }
    if (targetBairro) {
      if (!normalizeSearchText(item.bairro).includes(targetBairro)) return false;
    }
    return true;
  });
});

const pendingResolutionItems = computed(() =>
  baseFilteredResolutions.value.filter((item) => !item.revisada)
);

const reviewedResolutionItems = computed(() =>
  baseFilteredResolutions.value.filter((item) => item.revisada)
);

const filteredResolutionItems = computed(() =>
  resolutionActiveTab.value === 'pendentes'
    ? pendingResolutionItems.value
    : reviewedResolutionItems.value
);

const isRecentlyDecided = (item?: ResolvedIncidentPanelItem | null) =>
  Boolean(item && recentlyDecidedId.value && item.id === recentlyDecidedId.value);

watch(
  () => selectedResolutionItem.value?.id,
  () => {
    isConfirmingReject.value = false;
    copyFallbackCode.value = '';
    copiedKey.value = '';
  }
);

watch(filteredResolutionItems, (list) => {
  if (!selectedResolutionItem.value) {
    selectedResolutionItem.value = list[0] || null;
    resolutionNote.value = selectedResolutionItem.value?.observacao_admin || '';
    return;
  }
  // Mantém o item recém-analisado selecionado (mostrando o resultado), mesmo fora da lista atual
  if (isRecentlyDecided(selectedResolutionItem.value)) {
    const fresh = allResolutions.value.find((i) => i.id === selectedResolutionItem.value?.id);
    if (fresh && fresh !== selectedResolutionItem.value) selectedResolutionItem.value = fresh;
    return;
  }
  const stillExists = list.some((i) => i.id === selectedResolutionItem.value?.id);
  if (!stillExists) {
    selectedResolutionItem.value = list[0] || null;
    resolutionNote.value = selectedResolutionItem.value?.observacao_admin || '';
  }
});

// "Atualizado há X min" (tick a cada 30s)
const lastUpdatedAt = ref<number | null>(null);
const nowTick = ref(Date.now());
let nowTickTimer: ReturnType<typeof setInterval> | null = null;

const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value) return '';
  const minutes = Math.max(0, Math.floor((nowTick.value - lastUpdatedAt.value) / 60000));
  if (minutes < 1) return 'Atualizado agora';
  if (minutes < 60) return `Atualizado há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `Atualizado há ${hours} h`;
});

const markUpdated = () => {
  lastUpdatedAt.value = Date.now();
  nowTick.value = lastUpdatedAt.value;
};

const loadResolutions = async (options?: { silent?: boolean } | Event) => {
  if (!userProfile.value) return;
  const isSilent = Boolean(
    options &&
      typeof options === 'object' &&
      'silent' in options &&
      options.silent &&
      allResolutions.value.length > 0
  );
  if (!isSilent) {
    isLoadingResolutions.value = true;
    resolutionDecisionError.value = '';
    resolutionDecisionSuccess.value = '';
  }
  try {
    const items = await fetchResolvedIncidentsForPanel({
      cidade: isAdminRole.value ? undefined : userProfile.value.cidade,
      estado: isAdminRole.value ? undefined : userProfile.value.estado
    });
    allResolutions.value = items;
    markUpdated();

    const currentList =
      resolutionActiveTab.value === 'pendentes'
        ? pendingResolutionItems.value
        : reviewedResolutionItems.value;

    if (selectedResolutionItem.value) {
      const updatedSelected = items.find((i) => i.id === selectedResolutionItem.value?.id);
      if (
        updatedSelected &&
        (Boolean(updatedSelected.revisada) === (resolutionActiveTab.value === 'revisadas') ||
          isRecentlyDecided(updatedSelected))
      ) {
        selectedResolutionItem.value = updatedSelected;
        if (!isSilent) {
          resolutionNote.value = updatedSelected.observacao_admin || '';
        }
        return;
      }
    }
    recentlyDecidedId.value = null;
    selectedResolutionItem.value = currentList[0] || null;
    resolutionNote.value = selectedResolutionItem.value?.observacao_admin || '';
  } catch (err) {
    console.warn('[painel] Erro ao carregar resoluções:', err);
  } finally {
    if (!isSilent) {
      isLoadingResolutions.value = false;
    }
  }
};

const resetTransientDecisionState = () => {
  resolutionDecisionError.value = '';
  resolutionDecisionSuccess.value = '';
  recentlyDecidedId.value = null;
  isConfirmingReject.value = false;
};

const selectResolutionTab = (tab: SubTab) => {
  resolutionActiveTab.value = tab;
  resetTransientDecisionState();
  const list =
    tab === 'pendentes' ? pendingResolutionItems.value : reviewedResolutionItems.value;
  selectedResolutionItem.value = list[0] || null;
  resolutionNote.value = selectedResolutionItem.value?.observacao_admin || '';
};

// Navegação por teclado nas sub-abas (padrão ARIA: setas, Home e End; ativação automática)
const onSubTabKeydown = (event: KeyboardEvent) => {
  const currentIdx = SUB_TABS.indexOf(resolutionActiveTab.value);
  let nextIdx = -1;
  if (event.key === 'ArrowRight') nextIdx = (currentIdx + 1) % SUB_TABS.length;
  else if (event.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + SUB_TABS.length) % SUB_TABS.length;
  else if (event.key === 'Home') nextIdx = 0;
  else if (event.key === 'End') nextIdx = SUB_TABS.length - 1;
  if (nextIdx < 0) return;
  event.preventDefault();
  const nextTab = SUB_TABS[nextIdx] as SubTab;
  if (nextTab !== resolutionActiveTab.value) selectResolutionTab(nextTab);
  void nextTick(() => {
    document.getElementById(`resolutions-subtab-${nextTab}`)?.focus();
  });
};

// Celular (<= 960px): detalhe em tela própria com "← Voltar à lista"
const isMobile = ref(false);
const mobileDetailOpen = ref(false);
let mobileMql: MediaQueryList | null = null;

const handleMobileChange = (event: MediaQueryListEvent | MediaQueryList) => {
  isMobile.value = event.matches;
  if (!event.matches) mobileDetailOpen.value = false;
};

const focusDetailHeading = async () => {
  await nextTick();
  detailHeadingRef.value?.focus();
};

const openMobileDetail = async () => {
  if (!isMobile.value) return;
  mobileDetailOpen.value = true;
  await focusDetailHeading();
};

const backToList = async () => {
  const targetId = selectedResolutionItem.value?.id || '';
  mobileDetailOpen.value = false;
  await nextTick();
  let target: HTMLElement | null = null;
  if (targetId && rootRef.value) {
    const buttons = Array.from(rootRef.value.querySelectorAll<HTMLElement>('[data-item-id]'));
    target = buttons.find((btn) => btn.dataset.itemId === targetId) || null;
  }
  (target || document.getElementById(`resolutions-subtab-${resolutionActiveTab.value}`))?.focus();
};

const selectResolutionIncident = (item: ResolvedIncidentPanelItem, opts?: { openDetail?: boolean }) => {
  if (selectedResolutionItem.value?.id !== item.id) {
    resetTransientDecisionState();
  }
  selectedResolutionItem.value = item;
  resolutionNote.value = item.observacao_admin || '';
  resolutionDecisionError.value = '';
  if (opts?.openDetail) void openMobileDetail();
};

const naturezaIcon = (natureza?: string) => (natureza === 'transito' ? '🚗' : '🚧');
const naturezaLabel = (natureza?: string) =>
  natureza === 'transito' ? 'Infração de trânsito' : 'Mobilidade urbana';

const getVerdictInfo = (
  decision?: ResolutionReviewDecision | ''
): { tone: DecisionTone; icon: string; label: string } => {
  if (decision === 'procedente') return { tone: 'positive', icon: '✅', label: 'Correção confirmada' };
  if (decision === 'improcedente') return { tone: 'destructive', icon: '🚫', label: 'Correção rejeitada' };
  return { tone: 'neutral', icon: '⏳', label: 'Aguardando análise' };
};

const getBannerTitle = (decision?: ResolutionReviewDecision | '') =>
  decision === 'procedente'
    ? 'Correção confirmada: a ocorrência aparece como corrigida no mapa, com as fotos de antes e depois.'
    : 'Correção rejeitada: a ocorrência continua aparecendo como não corrigida.';

const formatLocation = (item: ResolvedIncidentPanelItem) => {
  const cityState = [item.cidade, item.estado].filter(Boolean).join('/');
  const streetPart = [item.rua, item.bairro].filter(Boolean).join(' - ');
  if (streetPart && cityState) return `${streetPart} (${cityState})`;
  return streetPart || cityState || 'Local sem endereço informado';
};

const hasCoords = (item: ResolvedIncidentPanelItem) =>
  Boolean(Number(item.latitude) && Number(item.longitude));

const formatCoords = (item: ResolvedIncidentPanelItem) =>
  `${Number(item.latitude).toFixed(6)}, ${Number(item.longitude).toFixed(6)}`;

const rejectSummary = computed(() => {
  const item = selectedResolutionItem.value;
  if (!item) return '';
  return `A correção enviada para ${formatLocation(item)} será rejeitada e a ocorrência continuará aparecendo como não corrigida no mapa.`;
});

const hasNextPending = computed(() =>
  pendingResolutionItems.value.some((i) => i.id !== selectedResolutionItem.value?.id)
);

const nextPendingCountLabel = computed(() => {
  const count = pendingResolutionItems.value.filter((i) => i.id !== selectedResolutionItem.value?.id).length;
  return count === 1 ? '1 resolução aguardando análise' : `${count} resoluções aguardando análise`;
});

const goToNextPending = async () => {
  const next = pendingResolutionItems.value.find((i) => i.id !== selectedResolutionItem.value?.id);
  if (!next) return;
  resetTransientDecisionState();
  resolutionActiveTab.value = 'pendentes';
  selectedResolutionItem.value = next;
  resolutionNote.value = next.observacao_admin || '';
  await focusDetailHeading();
};

const copyCode = async (code: string | undefined, key: string) => {
  const value = String(code || '').trim();
  if (!value) return;
  copyFallbackCode.value = '';
  try {
    if (!navigator?.clipboard?.writeText) throw new Error('clipboard indisponível');
    await navigator.clipboard.writeText(value);
    copiedKey.value = key;
    announceSr('Código copiado.');
    if (copiedResetTimer) clearTimeout(copiedResetTimer);
    copiedResetTimer = setTimeout(() => {
      copiedKey.value = '';
      copiedResetTimer = null;
    }, 2500);
  } catch {
    copyFallbackCode.value = value;
  }
};

const requestReject = async () => {
  confirmReturnFocusEl = (document.activeElement as HTMLElement | null) || null;
  resolutionDecisionError.value = '';
  isConfirmingReject.value = true;
  await nextTick();
  confirmCancelBtnRef.value?.focus();
};

const cancelConfirm = async () => {
  isConfirmingReject.value = false;
  await nextTick();
  const el = confirmReturnFocusEl;
  confirmReturnFocusEl = null;
  if (el && el.isConnected) el.focus();
};

const confirmReject = async () => {
  const ok = await handleResolutionReviewDecision('improcedente');
  if (ok) {
    isConfirmingReject.value = false;
    confirmReturnFocusEl = null;
  }
};

const handleResolutionReviewDecision = async (decision: ResolutionReviewDecision): Promise<boolean> => {
  if (!selectedResolutionItem.value || isSubmittingResolutionDecision.value) return false;
  isSubmittingResolutionDecision.value = true;
  resolutionDecisionError.value = '';
  resolutionDecisionSuccess.value = '';

  try {
    const reviewerLabel = userProfile.value?.nomeCompleto
      ? `${userProfile.value.nomeCompleto}${userProfile.value.cidade ? ` (${userProfile.value.cidade})` : ''}`
      : userProfile.value?.email || '';

    const updated = await reviewResolvedIncidentInFirebase({
      item: selectedResolutionItem.value,
      decision,
      observacaoAdmin: resolutionNote.value.slice(0, NOTE_MAX),
      reviewerEmail: reviewerLabel
    });

    // Marca antes de alterar a lista, para o item continuar selecionado
    recentlyDecidedId.value = updated.id;

    const idx = allResolutions.value.findIndex((i) => i.id === updated.id);
    if (idx !== -1) {
      allResolutions.value[idx] = {
        ...allResolutions.value[idx],
        ...updated
      };
    }

    emit('resolution-reviewed', { updated, decision, reviewerLabel });

    const msg =
      decision === 'procedente'
        ? 'Correção confirmada. A ocorrência agora aparece como corrigida no mapa.'
        : 'Correção rejeitada. A ocorrência continua aparecendo como não corrigida.';

    resolutionDecisionSuccess.value = msg;
    announceSr(msg);

    // Sem avanço automático: o item analisado continua selecionado mostrando o resultado
    selectedResolutionItem.value = (idx !== -1 ? allResolutions.value[idx] : null) || updated;
    resolutionNote.value = selectedResolutionItem.value?.observacao_admin || '';
    isConfirmingReject.value = false;
    await nextTick();
    resultBannerRef.value?.focus();
    return true;
  } catch (err) {
    console.warn('[painel] Erro ao salvar análise de resolução:', err);
    resolutionDecisionError.value =
      'Não foi possível salvar a análise. Verifique sua conexão e tente novamente.';
    return false;
  } finally {
    isSubmittingResolutionDecision.value = false;
  }
};

watch(
  () => pendingResolutionItems.value.length,
  (count) => emit('pending-count', count),
  { immediate: true }
);

const ensureLoaded = async () => {
  if (allResolutions.value.length === 0) {
    await loadResolutions();
  }
};

let liveResolutionsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleSilentRefresh = () => {
  if (!userProfile.value) return;
  if (liveResolutionsDebounceTimer) {
    clearTimeout(liveResolutionsDebounceTimer);
  }
  liveResolutionsDebounceTimer = setTimeout(() => {
    liveResolutionsDebounceTimer = null;
    void loadResolutions({ silent: true });
  }, 350);
};

const focusIncident = async (ocorrenciaId?: string) => {
  resolutionActiveTab.value = 'pendentes';
  resetTransientDecisionState();
  await loadResolutions({ silent: true });
  if (ocorrenciaId) {
    const match = pendingResolutionItems.value.find(
      (i) => i.ocorrenciaId === ocorrenciaId || i.id === ocorrenciaId
    );
    if (match) {
      selectResolutionIncident(match, { openDetail: true });
      return;
    }
  }
  if (pendingResolutionItems.value[0]) {
    selectResolutionIncident(pendingResolutionItems.value[0], { openDetail: true });
  }
};

const clearSelection = () => {
  selectedResolutionItem.value = null;
  mobileDetailOpen.value = false;
  resetTransientDecisionState();
};

const resetState = () => {
  allResolutions.value = [];
  selectedResolutionItem.value = null;
  mobileDetailOpen.value = false;
  lastUpdatedAt.value = null;
  resetTransientDecisionState();
};

onMounted(() => {
  nowTickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 30000);
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mobileMql = window.matchMedia(MOBILE_QUERY);
    handleMobileChange(mobileMql);
    mobileMql.addEventListener?.('change', handleMobileChange);
  }
});

onBeforeUnmount(() => {
  if (liveResolutionsDebounceTimer) {
    clearTimeout(liveResolutionsDebounceTimer);
    liveResolutionsDebounceTimer = null;
  }
  if (nowTickTimer) {
    clearInterval(nowTickTimer);
    nowTickTimer = null;
  }
  if (copiedResetTimer) {
    clearTimeout(copiedResetTimer);
    copiedResetTimer = null;
  }
  mobileMql?.removeEventListener?.('change', handleMobileChange);
  mobileMql = null;
});

defineExpose({
  refresh: loadResolutions,
  ensureLoaded,
  scheduleSilentRefresh,
  focusIncident,
  clearSelection,
  clearFilters: clearResolutionFilters,
  resetState
});
</script>

<style scoped src="../../../assets/css/multei-panel.css"></style>

<style scoped>
/* Cabeçalho */
.header-refresh-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
}

.last-updated-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
}

.detail-header-main {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.detail-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--pp-text-primary);
  overflow-wrap: anywhere;
}

.detail-title:focus,
.empty-title:focus {
  outline: none;
}

.detail-title:focus-visible,
.empty-title:focus-visible {
  outline: 3px solid var(--pp-accent);
  outline-offset: 3px;
  border-radius: 6px;
}

.copy-code-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  max-width: 100%;
}

.btn-copy-code {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.82rem;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
}

.copy-fallback {
  margin: 0;
  font-size: 0.8rem;
  color: var(--pp-text-secondary);
  overflow-wrap: anywhere;
}

.copy-fallback code {
  user-select: all;
}

/* Antes e depois */
.panel-before-after-wrapper {
  margin-bottom: 1.5rem;
}

.panel-ba-card {
  border: 1.5px solid var(--pp-border);
}

.panel-ba-after {
  border-color: var(--pp-green-border);
}

.panel-ba-header {
  margin-bottom: 0;
  font-size: 0.85rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.panel-ba-photo-wrap {
  border-radius: 14px;
  overflow: hidden;
  border: 1.5px solid var(--pp-border);
  background: #000;
}

.panel-ba-photo-wrap .photo-missing {
  background: var(--pp-surface-alt);
  border: none;
  border-radius: 0;
  height: 220px;
}

.panel-ba-img {
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  display: block;
  cursor: zoom-in;
}

.panel-ba-date-box {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.panel-ba-date-label {
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--pp-text-secondary);
}

.panel-ba-date-val {
  font-size: 0.92rem;
  color: var(--pp-text-primary);
}

.panel-ba-desc {
  margin: 0;
  font-size: 0.9rem;
  color: var(--pp-text-primary);
  overflow-wrap: anywhere;
}

/* Botões de decisão com o EFEITO da ação (substituem btn-improcedente/btn-procedente invertidos) */
.btn-positive {
  background: var(--pp-green-bg);
  border: 2px solid var(--pp-green-border);
  color: var(--pp-green-text);
}

.btn-destructive {
  background: var(--pp-red-bg);
  border: 2px solid var(--pp-red-border);
  color: var(--pp-red-text);
}

.btn-neutral {
  background: var(--pp-amber-bg);
  border: 2px solid var(--pp-amber-border);
  color: var(--pp-amber-text);
}

.btn-decision {
  font-family: inherit;
}

.btn-decision:focus-visible,
.btn-copy-code:focus-visible,
.btn-next-pending:focus-visible,
.btn-back-to-list:focus-visible,
.btn-confirm-cancel:focus-visible,
.btn-confirm-destructive:focus-visible,
.btn-expand-photo:focus-visible,
.coords-details summary:focus-visible,
.filter-tab-btn:focus-visible,
.report-item-btn:focus-visible,
.subtab-panel:focus-visible {
  outline: 3px solid var(--pp-accent);
  outline-offset: 2px;
}

/* Confirmação inline */
.confirm-inline {
  padding: 1rem 1.1rem;
  border-radius: 16px;
  border: 2px solid var(--pp-red-border);
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.confirm-inline-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 900;
}

.confirm-inline-summary {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.confirm-inline-hint {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
}

.confirm-inline-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.25rem;
}

.btn-confirm-cancel,
.btn-confirm-destructive {
  padding: 0.6rem 1.15rem;
  border-radius: 9999px;
  font-size: 0.9rem;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
}

.btn-confirm-cancel {
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
}

.btn-confirm-destructive {
  border: 2px solid var(--pp-danger-solid, #b91c1c);
  background: var(--pp-danger-solid, #b91c1c);
  color: var(--pp-danger-solid-text, #ffffff);
}

.btn-confirm-cancel:disabled,
.btn-confirm-destructive:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Banners e selos de resultado (tom pelo efeito) */
.reviewed-status-banner:focus {
  outline: none;
}

.reviewed-status-banner:focus-visible {
  outline: 3px solid var(--pp-accent);
  outline-offset: 2px;
}

.banner-positive {
  background: var(--pp-green-bg);
  border: 1.5px solid var(--pp-green-border);
  color: var(--pp-green-text);
}

.banner-destructive {
  background: var(--pp-red-bg);
  border: 1.5px solid var(--pp-red-border);
  color: var(--pp-red-text);
}

.banner-neutral {
  background: var(--pp-amber-bg);
  border: 1.5px solid var(--pp-amber-border);
  color: var(--pp-amber-text);
}

.banner-obs {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.verdict-positive {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1px solid var(--pp-green-border);
}

.verdict-destructive {
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  border: 1px solid var(--pp-red-border);
}

.verdict-neutral {
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1px solid var(--pp-amber-border);
}

/* Próximo pendente (sem avanço automático) */
.next-pending-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn-next-pending {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.15rem;
  border-radius: 9999px;
  border: none;
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  font-size: 0.9rem;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
}

.btn-next-pending:hover {
  background: var(--pp-accent-hover);
}

.next-pending-count {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
}

/* Observação (textarea) */
.note-textarea {
  resize: vertical;
  min-height: 84px;
  line-height: 1.45;
}

.note-field-footer {
  display: flex;
  justify-content: flex-end;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--pp-text-secondary);
}

/* Coordenadas sob demanda */
.coords-details {
  font-size: 0.86rem;
  font-weight: 700;
}

.coords-details summary {
  cursor: pointer;
  color: var(--pp-text-primary);
  border-radius: 6px;
}

.coords-value {
  display: inline-block;
  margin-top: 0.35rem;
  font-family: monospace;
  color: var(--pp-text-secondary);
}

/* Botão "← Voltar à lista" (só no celular) */
.btn-back-to-list {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 1rem;
  padding: 0.55rem 1rem;
  border-radius: 9999px;
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.9rem;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
}

@media (max-width: 960px) {
  .header-refresh-group {
    align-items: flex-start;
  }

  /* Lista ocupa a tela; o detalhe vira uma tela própria */
  .master-detail-grid > .master-column {
    max-height: none;
  }

  .master-detail-grid .report-list {
    max-height: 70vh;
  }

  .master-detail-grid:not(.is-mobile-detail-open) > .detail-column {
    display: none;
  }

  .master-detail-grid.is-mobile-detail-open > .master-column {
    display: none;
  }

  .moderation-tab-root.is-mobile-detail-open .occurrences-filter-bar {
    display: none;
  }

  .detail-column {
    min-height: 0;
    padding: 1rem;
  }

  .copy-code-wrap {
    align-items: flex-start;
  }
}
</style>
