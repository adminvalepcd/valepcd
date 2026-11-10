<template>
  <section class="ig-publisher-root" aria-labelledby="ig-publisher-heading">
    <header class="ig-header-row">
      <div>
        <span class="ig-kicker">Exclusivo Administração • @pcdvale</span>
        <h1 id="ig-publisher-heading" class="ig-main-title">
          Central de Publicações no Instagram
        </h1>
        <p class="ig-main-subtitle">
          Aprove rascunhos diários por cidade (00:00 às 23:59) ou gere relatórios institucionais por período com publicação oficial via Meta Graph API.
        </p>
      </div>

      <div class="ig-submode-switch" role="tablist" aria-label="Modos de publicação no Instagram">
        <button
          type="button"
          role="tab"
          class="ig-submode-btn"
          :class="{ 'is-active': subMode === 'city_daily' }"
          :aria-selected="subMode === 'city_daily'"
          @click="switchSubMode('city_daily')"
        >
          <span aria-hidden="true">📍</span>
          <span>Fase 1 • Cidades de Hoje</span>
          <span v-if="dailyDrafts.length > 0" class="ig-submode-badge">{{ dailyDrafts.length }}</span>
        </button>

        <button
          type="button"
          role="tab"
          class="ig-submode-btn"
          :class="{ 'is-active': subMode === 'general_report' }"
          :aria-selected="subMode === 'general_report'"
          @click="switchSubMode('general_report')"
        >
          <span aria-hidden="true">📊</span>
          <span>Fase 2 • Relatório Geral</span>
        </button>
      </div>
    </header>

    <!-- Banner de feedback de sucesso / erro -->
    <div
      v-if="feedbackBanner"
      class="ig-feedback-banner"
      :class="feedbackBanner.type === 'success' ? 'is-success' : 'is-error'"
      role="status"
    >
      <div class="ig-feedback-content">
        <strong>{{ feedbackBanner.title }}</strong>
        <p>{{ feedbackBanner.message }}</p>
        <a
          v-if="feedbackBanner.permalink"
          :href="feedbackBanner.permalink"
          target="_blank"
          rel="noopener noreferrer"
          class="ig-permalink-btn"
        >
          Abrir publicação no Instagram ↗
        </a>
      </div>
      <button
        type="button"
        class="ig-feedback-close"
        aria-label="Fechar aviso"
        @click="feedbackBanner = null"
      >
        ✕
      </button>
    </div>

    <!-- ===================================================================== -->
    <!-- FASE 1: RASCUNHOS DIÁRIOS POR CIDADE (00:00 ATÉ 23:59 DE HOJE)        -->
    <!-- ===================================================================== -->
    <div v-if="subMode === 'city_daily'" class="ig-daily-container">
      <div class="ig-window-bar">
        <div class="ig-window-info">
          <span class="ig-live-dot" aria-hidden="true"></span>
          <span>
            Janela ativa de hoje (<strong>{{ formatDateKeyBr(todayDateKey) }}</strong>): registros de
            <strong>00:00 até agora</strong> • renova automaticamente às <strong>23:59</strong>.
          </span>
        </div>
        <button
          type="button"
          class="ig-btn-secondary"
          :disabled="isLoadingDaily"
          @click="loadDailyDrafts"
        >
          <span aria-hidden="true">🔄</span>
          <span>{{ isLoadingDaily ? 'Atualizando...' : 'Atualizar Cidades de Hoje' }}</span>
        </button>
      </div>

      <div v-if="isLoadingDaily && dailyDrafts.length === 0" class="ig-empty-box">
        <p class="ig-empty-title">Carregando rascunhos de hoje...</p>
        <p class="ig-empty-desc">Agrupando ocorrências válidas e problemas solucionados desde 00:00.</p>
      </div>

      <div v-else-if="dailyDrafts.length === 0" class="ig-empty-box">
        <p class="ig-empty-title">Nenhuma ocorrência elegível registrada hoje até o momento</p>
        <p class="ig-empty-desc">
          Assim que entrarem ocorrências válidas ou resoluções aprovadas entre 00:00 e 23:59 de hoje, os rascunhos por cidade aparecerão automaticamente aqui.
        </p>
      </div>

      <div v-else class="ig-workspace-grid">
        <!-- Lista lateral de Cidades do Dia -->
        <aside class="ig-cities-sidebar" aria-label="Cidades com registros hoje">
          <h2 class="ig-sidebar-heading">Cidades hoje ({{ dailyDrafts.length }})</h2>
          <div class="ig-cities-list">
            <button
              v-for="draft in dailyDrafts"
              :key="draft.cityKey"
              type="button"
              class="ig-city-card"
              :class="{ 'is-selected': selectedCityKey === draft.cityKey }"
              @click="selectCityDraft(draft.cityKey)"
            >
              <div class="ig-city-card-top">
                <strong class="ig-city-name">{{ draft.cidade }} - {{ draft.estado }}</strong>
                <span
                  v-if="draft.publishedTodayPosts.length > 0"
                  class="ig-status-pill is-published"
                >
                  ✅ Publicada ({{ draft.publishedTodayPosts.length }})
                </span>
                <span v-else class="ig-status-pill is-pending">
                  Rascunho ({{ draft.selectedItems.length }})
                </span>
              </div>

              <div class="ig-city-counts">
                <span v-if="draft.resolvidosDia > 0" class="ig-count-chip is-green">
                  ✅ {{ draft.resolvidosDia }} resolvido(s)
                </span>
                <span v-if="draft.transitoDia > 0" class="ig-count-chip is-purple">
                  ♿ {{ draft.transitoDia }} trânsito
                </span>
                <span v-if="draft.mobilidadeDia > 0" class="ig-count-chip is-amber">
                  🚧 {{ draft.mobilidadeDia }} mobilidade
                </span>
              </div>

              <div v-if="draft.citySocial?.instagramPrefeitura" class="ig-city-saved-handle">
                @{{ draft.citySocial.instagramPrefeitura }}
              </div>
            </button>
          </div>
        </aside>

        <!-- Área principal do Rascunho da Cidade Selecionada -->
        <div v-if="activeCityDraft" class="ig-draft-editor">
          <!-- Histórico caso já tenha post publicado hoje nesta cidade -->
          <div
            v-if="activeCityDraft.publishedTodayPosts.length > 0"
            class="ig-published-today-box"
          >
            <div>
              <strong>✅ Esta cidade já teve publicação realizada hoje:</strong>
              <ul class="ig-published-links">
                <li v-for="post in activeCityDraft.publishedTodayPosts" :key="post.id">
                  <span>Às {{ formatTimeBr(post.publishedAt) }} ({{ post.itemIds.length }} slide(s)) — </span>
                  <a :href="post.permalink" target="_blank" rel="noopener noreferrer">
                    Ver post no Instagram ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div v-if="curatedSlots.length === 0" class="ig-empty-box">
            <p class="ig-empty-title">Todas as ocorrências de hoje nesta cidade já foram publicadas!</p>
            <p class="ig-empty-desc">
              Se entrarem novos registros até as 23:59, eles aparecerão aqui sem repetir fotos anteriores.
            </p>
          </div>

          <template v-else>
            <!-- 1. Prévia dos Slides (1080x1350) e Curadoria (1 a 9 fotos) -->
            <div class="ig-panel-card">
              <div class="ig-card-header-flex">
                <div>
                  <h3 class="ig-card-title">
                    1. Prévia do Post — {{ activeCityDraft.cidade }}/{{ activeCityDraft.estado }}
                    ({{ includedSlidesCount }} {{ includedSlidesCount === 1 ? 'imagem única' : 'slides no carrossel' }})
                  </h3>
                  <p class="ig-card-helper">
                    Prioridade automática: até 3 Resolvidos → até 3 Trânsito → até 3 Mobilidade. Desmarque ou defina qual vai na capa (1ª foto).
                  </p>
                </div>

                <div class="ig-header-actions">
                  <button
                    type="button"
                    class="ig-btn-secondary"
                    :disabled="isRenderingSlides || renderedSlides.length === 0"
                    @click="downloadAllRenderedSlides"
                  >
                    ⬇️ Baixar {{ renderedSlides.length }} arte(s)
                  </button>
                </div>
              </div>

              <div v-if="isRenderingSlides" class="ig-rendering-indicator">
                Gerando prévia dos templates 1080×1350...
              </div>

              <div class="ig-slides-grid">
                <article
                  v-for="(slot, idx) in curatedSlots"
                  :key="slot.item.id"
                  class="ig-slide-card"
                  :class="{ 'is-excluded': !slot.included, 'is-cover': getIncludedIndex(slot.item.id) === 0 }"
                >
                  <div class="ig-slide-preview-wrap">
                    <img
                      v-if="slotPreviewUrls[slot.item.id]"
                      :src="slotPreviewUrls[slot.item.id]"
                      :alt="`Prévia do slide ${idx + 1} em ${activeCityDraft.cidade}`"
                      class="ig-slide-img"
                    />
                    <img
                      v-else
                      :src="slot.item.photoUrl"
                      :alt="`Foto original da ocorrência em ${activeCityDraft.cidade}`"
                      class="ig-slide-img is-raw"
                    />

                    <span v-if="getIncludedIndex(slot.item.id) === 0" class="ig-cover-ribbon">
                      {{ slot.item.category === 'resolvido' ? '✨ Capa Transformação (1ª)' : '📍 Capa Cidade (1ª)' }}
                    </span>
                    <span v-else-if="slot.included" class="ig-order-ribbon">
                      Slide {{ getIncludedIndex(slot.item.id) + 1 }}/{{ includedSlidesCount }}
                    </span>
                    <span v-else class="ig-excluded-ribbon">
                      Removido do post
                    </span>
                  </div>

                  <div class="ig-slide-meta">
                    <span
                      class="ig-cat-tag"
                      :class="{
                        'is-green': slot.item.category === 'resolvido',
                        'is-purple': slot.item.category === 'transito',
                        'is-amber': slot.item.category === 'mobilidade'
                      }"
                    >
                      {{
                        slot.item.category === 'resolvido'
                          ? '✅ Problema Resolvido'
                          : slot.item.category === 'transito'
                            ? '♿ Trânsito'
                            : '🚧 Mobilidade Urbana'
                      }}
                    </span>
                    <p class="ig-slide-addr">
                      {{ [slot.item.rua, slot.item.bairro].filter(Boolean).join(' - ') || 'Endereço registrado' }}
                    </p>
                  </div>

                  <div class="ig-slide-controls">
                    <label class="ig-check-label">
                      <input
                        type="checkbox"
                        :checked="slot.included"
                        :disabled="slot.included && includedSlidesCount <= 1"
                        @change="toggleSlideIncluded(idx)"
                      />
                      <span>Incluir</span>
                    </label>

                    <button
                      v-if="slot.included && getIncludedIndex(slot.item.id) !== 0"
                      type="button"
                      class="ig-mini-btn"
                      title="Colocar como 1ª foto (capa com nome da cidade)"
                      @click="promoteSlideToCover(idx)"
                    >
                      ⭐ 1ª foto
                    </button>

                    <button
                      v-if="canSwapCategoryItem(slot.item.category)"
                      type="button"
                      class="ig-mini-btn"
                      title="Sortear outra ocorrência desta categoria registrada hoje"
                      @click="swapSlotWithAnotherFromPool(idx)"
                    >
                      🔄 Outra
                    </button>

                    <button
                      v-if="slotFiles[slot.item.id]"
                      type="button"
                      class="ig-mini-btn"
                      title="Baixar este card JPEG"
                      @click="downloadSingleSlide(slot.item.id)"
                    >
                      ⬇️
                    </button>
                  </div>
                </article>
              </div>
            </div>

            <!-- 2. Instagram Oficial da Prefeitura / Órgão de Trânsito (Coleção multei_city_socials) -->
            <div class="ig-panel-card">
              <div class="ig-card-header-flex">
                <div>
                  <h3 class="ig-card-title">
                    2. Poder Público Local (@ para menção e marcação)
                  </h3>
                  <p class="ig-card-helper">
                    Salvo na coleção <code>multei_city_socials</code> para reutilização automática nas próximas publicações de {{ activeCityDraft.cidade }}.
                  </p>
                </div>

                <span v-if="activeCityDraft.citySocial?.verificadoPorAdmin" class="ig-saved-badge">
                  ✓ Salvo na coleção
                </span>
              </div>

              <div class="ig-socials-grid">
                <div class="ig-field">
                  <label for="ig-pref-input" class="ig-label">@ da Prefeitura Municipal</label>
                  <div class="ig-input-group">
                    <span class="ig-at-prefix">@</span>
                    <input
                      id="ig-pref-input"
                      v-model="prefeituraHandleInput"
                      type="text"
                      class="ig-input"
                      placeholder="ex: prefeiturabh"
                      maxlength="30"
                    />
                  </div>
                </div>

                <div class="ig-field">
                  <label for="ig-transito-input" class="ig-label">@ Órgão de Trânsito (opcional)</label>
                  <div class="ig-input-group">
                    <span class="ig-at-prefix">@</span>
                    <input
                      id="ig-transito-input"
                      v-model="transitoHandleInput"
                      type="text"
                      class="ig-input"
                      placeholder="ex: bhtransoficial"
                      maxlength="30"
                    />
                  </div>
                </div>
              </div>

              <div class="ig-socials-actions">
                <button
                  type="button"
                  class="ig-btn-secondary"
                  :disabled="isDiscoveringSocial"
                  @click="discoverOrValidateHandles(false)"
                >
                  {{ isDiscoveringSocial ? 'Consultando...' : '🔍 Sugerir @ automaticamente' }}
                </button>

                <button
                  type="button"
                  class="ig-btn-secondary"
                  :disabled="isDiscoveringSocial || (!prefeituraHandleInput.trim() && !transitoHandleInput.trim())"
                  @click="discoverOrValidateHandles(true)"
                >
                  ✓ Validar @ na Meta
                </button>

                <button
                  type="button"
                  class="ig-btn-secondary"
                  :disabled="isSavingSocial || !prefeituraHandleInput.trim()"
                  @click="saveHandlesForCity"
                >
                  {{ isSavingSocial ? 'Salvando...' : '💾 Salvar @ na coleção' }}
                </button>

                <label class="ig-check-label ig-tag-toggle">
                  <input v-model="tagProfilesOnPhotos" type="checkbox" />
                  <span>Marcar @ também sobre as fotos (<code>user_tags</code>)</span>
                </label>
              </div>

              <!-- Card de confirmação retornado pelo Meta business_discovery -->
              <div v-if="discoveredPrefeituraInfo" class="ig-discovery-result" :class="{ 'is-unverified': !discoveredPrefeituraInfo.verified }">
                <img
                  v-if="discoveredPrefeituraInfo.profilePictureUrl"
                  :src="discoveredPrefeituraInfo.profilePictureUrl"
                  alt="Foto de perfil encontrada no Instagram"
                  class="ig-discovery-avatar"
                />
                <div class="ig-discovery-text">
                  <strong>
                    @{{ discoveredPrefeituraInfo.username }}
                    <span v-if="discoveredPrefeituraInfo.name">• {{ discoveredPrefeituraInfo.name }}</span>
                  </strong>
                  <p v-if="discoveredPrefeituraInfo.verified">
                    ✓ Conta profissional pública confirmada na Meta
                    <span v-if="typeof discoveredPrefeituraInfo.followersCount === 'number'">
                      ({{ discoveredPrefeituraInfo.followersCount.toLocaleString('pt-BR') }} seguidores)
                    </span>
                  </p>
                  <p v-else>{{ discoveredPrefeituraInfo.reason }}</p>
                  <p v-if="discoveredPrefeituraInfo.biography" class="ig-discovery-bio">
                    {{ discoveredPrefeituraInfo.biography }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 3. Legenda Dinâmica (Gemini) + Botão de Publicação -->
            <div class="ig-panel-card">
              <div class="ig-card-header-flex">
                <div>
                  <h3 class="ig-card-title">3. Legenda Personalizada (Gemini IA)</h3>
                  <p class="ig-card-helper">
                    Texto inédito cobrando posicionamento do poder público e convidando para reunião de parceria gratuita de dados.
                  </p>
                </div>

                <button
                  type="button"
                  class="ig-btn-secondary"
                  :disabled="isGeneratingCaption"
                  @click="generateCityCaption(true)"
                >
                  {{ isGeneratingCaption ? 'Gerando...' : '✨ Gerar nova variação' }}
                </button>
              </div>

              <textarea
                v-model="cityCaptionText"
                rows="9"
                maxlength="2200"
                class="ig-caption-textarea"
                placeholder="A legenda personalizada será gerada aqui..."
              ></textarea>
              <div class="ig-caption-footer-meta">
                <span>{{ cityCaptionText.length }} / 2200 caracteres</span>
              </div>

              <!-- Confirmação inline segura antes de disparar o post oficial -->
              <div v-if="!confirmingCityPublish" class="ig-publish-bar">
                <button
                  type="button"
                  class="ig-btn-primary"
                  :disabled="isPublishing || isRenderingSlides || includedSlidesCount < 1 || !cityCaptionText.trim()"
                  @click="confirmingCityPublish = true"
                >
                  🚀 Aprovar e Publicar {{ activeCityDraft.cidade }}/{{ activeCityDraft.estado }} no Instagram
                </button>
              </div>

              <div v-else class="ig-confirm-box">
                <p>
                  Confirmar publicação imediata em <strong>@pcdvale</strong> com
                  <strong>{{ includedSlidesCount }} {{ includedSlidesCount === 1 ? 'imagem' : 'imagens em carrossel' }}</strong>
                  para <strong>{{ activeCityDraft.cidade }} - {{ activeCityDraft.estado }}</strong>?
                </p>
                <div class="ig-confirm-actions">
                  <button
                    type="button"
                    class="ig-btn-secondary"
                    :disabled="isPublishing"
                    @click="confirmingCityPublish = false"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    class="ig-btn-primary"
                    :disabled="isPublishing"
                    @click="executeCityPublish"
                  >
                    {{ isPublishing ? publishStepLabel : 'Sim, publicar agora' }}
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- FASE 2: RELATÓRIO GERAL POR PERÍODO SELECIONÁVEL PELO ADMIN           -->
    <!-- ===================================================================== -->
    <div v-else class="ig-report-container">
      <div class="ig-panel-card">
        <div class="ig-card-header-flex">
          <div>
            <h2 class="ig-card-title">Configurar Período do Relatório Institucional</h2>
            <p class="ig-card-helper">
              Escolha o período livremente. O card verde de <strong>Problemas Resolvidos</strong> entra automaticamente sempre que houver pelo menos 1 solução aprovada no intervalo.
            </p>
          </div>
        </div>

        <div class="ig-preset-pills">
          <button
            v-for="preset in reportPresets"
            :key="preset.id"
            type="button"
            class="ig-preset-btn"
            :class="{ 'is-active': activeReportPreset === preset.id }"
            @click="applyReportPreset(preset.id)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div class="ig-report-filters-grid">
          <div class="ig-field">
            <label for="ig-rep-start" class="ig-label">Data Inicial</label>
            <input
              id="ig-rep-start"
              v-model="reportStartDate"
              type="date"
              class="ig-input is-standalone"
              @change="handleCustomReportDatesChange"
            />
          </div>

          <div class="ig-field">
            <label for="ig-rep-end" class="ig-label">Data Final</label>
            <input
              id="ig-rep-end"
              v-model="reportEndDate"
              type="date"
              class="ig-input is-standalone"
              @change="handleCustomReportDatesChange"
            />
          </div>

          <div class="ig-field">
            <label for="ig-rep-title" class="ig-label">Título Principal na Arte</label>
            <input
              id="ig-rep-title"
              v-model="reportTitleText"
              type="text"
              maxlength="48"
              class="ig-input is-standalone"
              placeholder="Ex: Essa semana no Multei"
              @input="scheduleRenderGeneralReportCard"
            />
          </div>
        </div>
      </div>

      <div class="ig-report-workspace-grid">
        <!-- Prévia da Arte 1080x1350 da Fase 2 -->
        <div class="ig-panel-card ig-report-preview-card">
          <div class="ig-card-header-flex">
            <h3 class="ig-card-title">Prévia da Arte (4:5 Feed)</h3>
            <button
              type="button"
              class="ig-btn-secondary"
              :disabled="!reportCardFile || isLoadingReport"
              @click="downloadReportCard"
            >
              ⬇️ Baixar Arte
            </button>
          </div>

          <div v-if="isLoadingReport" class="ig-rendering-indicator">
            Calculando indicadores do período...
          </div>

          <div v-else-if="reportPreviewUrl" class="ig-report-img-holder">
            <img
              :src="reportPreviewUrl"
              alt="Prévia do card de Relatório Geral do Multei"
              class="ig-report-preview-img"
            />
          </div>
        </div>

        <!-- Legenda e Publicação da Fase 2 -->
        <div class="ig-panel-card">
          <div class="ig-card-header-flex">
            <div>
              <h3 class="ig-card-title">Legenda do Relatório (link p/ /multei/sobre)</h3>
              <p class="ig-card-helper">
                Direciona gestores e público para <code>https://valepcd.com.br/multei/sobre</code>.
              </p>
            </div>

            <button
              type="button"
              class="ig-btn-secondary"
              :disabled="isGeneratingReportCaption || isLoadingReport"
              @click="generateReportCaption"
            >
              {{ isGeneratingReportCaption ? 'Gerando...' : '✨ Gerar nova variação' }}
            </button>
          </div>

          <textarea
            v-model="reportCaptionText"
            rows="11"
            maxlength="2200"
            class="ig-caption-textarea"
            placeholder="A legenda institucional do relatório será gerada aqui..."
          ></textarea>
          <div class="ig-caption-footer-meta">
            <span>{{ reportCaptionText.length }} / 2200 caracteres</span>
          </div>

          <div v-if="!confirmingReportPublish" class="ig-publish-bar">
            <button
              type="button"
              class="ig-btn-primary"
              :disabled="isPublishing || !reportCardFile || !reportCaptionText.trim() || reportStats.totalGeral <= 0"
              @click="confirmingReportPublish = true"
            >
              🚀 Publicar Relatório no Instagram (@pcdvale)
            </button>
          </div>

          <div v-else class="ig-confirm-box">
            <p>
              Confirmar publicação imediata deste <strong>Relatório Geral</strong> no Feed de <strong>@pcdvale</strong>?
            </p>
            <div class="ig-confirm-actions">
              <button
                type="button"
                class="ig-btn-secondary"
                :disabled="isPublishing"
                @click="confirmingReportPublish = false"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="ig-btn-primary"
                :disabled="isPublishing"
                @click="executeReportPublish"
              >
                {{ isPublishing ? publishStepLabel : 'Sim, publicar relatório' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  fetchInstagramDailyDraftsForAdmin,
  fetchInstagramGeneralReportForPeriod,
  getBrazilDateKey,
  getCurrentMulteiAdminIdToken,
  saveMulteiCitySocialProfile,
  saveMulteiInstagramPublishedPost,
  uploadTemporaryInstagramStagingSlides,
  deleteTemporaryInstagramStagingSlides,
  type InstagramDailyCityDraft,
  type InstagramDraftCandidateItem,
  type InstagramPeriodReportData
} from '~/services/firebaseService';
import {
  generateInstagramCarouselSlideFile,
  generateInstagramGeneralReportFile,
  downloadGeneratedCardFile
} from '~/services/imageProcessor';

const props = defineProps<{
  adminEmail: string;
}>();

interface CuratedSlideSlot {
  item: InstagramDraftCandidateItem;
  included: boolean;
}

interface DiscoveredSocialPreview {
  verified: boolean;
  username: string;
  name?: string;
  biography?: string;
  followersCount?: number;
  profilePictureUrl?: string;
  reason?: string;
}

const subMode = ref<'city_daily' | 'general_report'>('city_daily');

const feedbackBanner = ref<{
  type: 'success' | 'error';
  title: string;
  message: string;
  permalink?: string;
} | null>(null);

// Estado Fase 1 (Rascunhos Diários por Cidade: 00:00 até 23:59)
const todayDateKey = ref<string>(getBrazilDateKey());
const isLoadingDaily = ref(false);
const dailyDrafts = ref<InstagramDailyCityDraft[]>([]);
const selectedCityKey = ref<string>('');

const curatedSlots = ref<CuratedSlideSlot[]>([]);
const slotFiles = ref<Record<string, File>>({});
const slotPreviewUrls = ref<Record<string, string>>({});
const isRenderingSlides = ref(false);
let slideRenderSeq = 0;

const prefeituraHandleInput = ref('');
const transitoHandleInput = ref('');
const tagProfilesOnPhotos = ref(true);
const isDiscoveringSocial = ref(false);
const isSavingSocial = ref(false);
const discoveredPrefeituraInfo = ref<DiscoveredSocialPreview | null>(null);

const cityCaptionText = ref('');
const isGeneratingCaption = ref(false);
const captionCacheByCity = new Map<string, string>();
let captionVariationCounter = 1;

const confirmingCityPublish = ref(false);
const isPublishing = ref(false);
const publishStepLabel = ref('Publicando...');

// Estado Fase 2 (Relatório Geral por Período Livre)
type ReportPresetId = 'today' | 'last7' | 'last30' | 'thisMonth' | 'all' | 'custom';
const reportPresets: Array<{ id: ReportPresetId; label: string }> = [
  { id: 'last7', label: 'Últimos 7 dias' },
  { id: 'thisMonth', label: 'Este mês' },
  { id: 'last30', label: 'Últimos 30 dias' },
  { id: 'today', label: 'Hoje' },
  { id: 'all', label: 'Todo o período' }
];

const activeReportPreset = ref<ReportPresetId>('last7');
const reportStartDate = ref('');
const reportEndDate = ref('');
const reportTitleText = ref('Essa semana no Multei');
const isLoadingReport = ref(false);
const reportStats = ref<InstagramPeriodReportData>({
  totalGeral: 0,
  cidadesCount: 0,
  infracoesTransito: 0,
  mobilidadeUrbana: 0,
  resolvidos: 0,
  topCities: []
});
const reportCardFile = ref<File | null>(null);
const reportPreviewUrl = ref('');
const reportCaptionText = ref('');
const isGeneratingReportCaption = ref(false);
const confirmingReportPublish = ref(false);
let reportRenderDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let midnightRolloverTimer: ReturnType<typeof setInterval> | null = null;

const activeCityDraft = computed<InstagramDailyCityDraft | null>(() => {
  return dailyDrafts.value.find((d) => d.cityKey === selectedCityKey.value) || null;
});

const includedSlots = computed<CuratedSlideSlot[]>(() => {
  return curatedSlots.value.filter((s) => s.included);
});

const includedSlidesCount = computed<number>(() => includedSlots.value.length);

const renderedSlides = computed<File[]>(() => {
  return includedSlots.value
    .map((s) => slotFiles.value[s.item.id])
    .filter((f): f is File => Boolean(f));
});

function getIncludedIndex(itemId: string): number {
  return includedSlots.value.findIndex((s) => s.item.id === itemId);
}

function formatDateKeyBr(dateKey: string): string {
  const parts = String(dateKey || '').split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatTimeBr(iso: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function revokeAllSlidePreviewUrls(): void {
  for (const url of Object.values(slotPreviewUrls.value)) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
  slotPreviewUrls.value = {};
  slotFiles.value = {};
}

async function renderActiveCitySlides(): Promise<void> {
  const draft = activeCityDraft.value;
  if (!draft) return;

  const seq = ++slideRenderSeq;
  isRenderingSlides.value = true;

  try {
    const activeIncluded = curatedSlots.value.filter((s) => s.included);
    const total = activeIncluded.length;
    const nextFiles: Record<string, File> = {};
    const nextUrls: Record<string, string> = {};

    for (let i = 0; i < activeIncluded.length; i++) {
      if (seq !== slideRenderSeq) return;
      const item = activeIncluded[i].item;
      const file = await generateInstagramCarouselSlideFile({
        slideIndex: i,
        totalSlides: total,
        cidade: draft.cidade,
        estado: draft.estado,
        rua: item.rua,
        bairro: item.bairro,
        natureza: item.natureza,
        verificacao: item.verificacao,
        isResolved: item.category === 'resolvido',
        photoUrl: item.photoUrl,
        resolvedPhotoUrl: item.resolvedPhotoUrl
      });
      nextFiles[item.id] = file;
      nextUrls[item.id] = URL.createObjectURL(file);
    }

    if (seq !== slideRenderSeq) {
      for (const u of Object.values(nextUrls)) URL.revokeObjectURL(u);
      return;
    }

    revokeAllSlidePreviewUrls();
    slotFiles.value = nextFiles;
    slotPreviewUrls.value = nextUrls;
  } catch {
    // Mantém foto bruta no card caso alguma imagem falhe ao renderizar
  } finally {
    if (seq === slideRenderSeq) {
      isRenderingSlides.value = false;
    }
  }
}

function canSwapCategoryItem(category: 'resolvido' | 'transito' | 'mobilidade'): boolean {
  const draft = activeCityDraft.value;
  if (!draft) return false;
  const pool =
    category === 'resolvido'
      ? draft.poolResolvidos
      : category === 'transito'
        ? draft.poolTransito
        : draft.poolMobilidade;
  const currentIdsInCategory = curatedSlots.value
    .filter((s) => s.item.category === category)
    .map((s) => s.item.id);
  return pool.some((p) => !currentIdsInCategory.includes(p.id));
}

async function swapSlotWithAnotherFromPool(slotIdx: number): Promise<void> {
  const draft = activeCityDraft.value;
  const target = curatedSlots.value[slotIdx];
  if (!draft || !target) return;

  const cat = target.item.category;
  const pool =
    cat === 'resolvido'
      ? draft.poolResolvidos
      : cat === 'transito'
        ? draft.poolTransito
        : draft.poolMobilidade;

  const usedIds = new Set(curatedSlots.value.map((s) => s.item.id));
  const available = pool.filter((p) => !usedIds.has(p.id));
  if (available.length === 0) return;

  const replacement = available[0];
  // Rotaciona o pool para permitir novos cliques em "Outra"
  const idxInPool = pool.findIndex((p) => p.id === replacement.id);
  if (idxInPool >= 0) {
    pool.splice(idxInPool, 1);
    pool.push(target.item);
  }

  curatedSlots.value[slotIdx] = {
    item: replacement,
    included: target.included
  };

  await renderActiveCitySlides();
}

async function toggleSlideIncluded(slotIdx: number): Promise<void> {
  const slot = curatedSlots.value[slotIdx];
  if (!slot) return;
  if (slot.included && includedSlidesCount.value <= 1) return;
  slot.included = !slot.included;
  await renderActiveCitySlides();
}

async function promoteSlideToCover(slotIdx: number): Promise<void> {
  if (slotIdx <= 0 || slotIdx >= curatedSlots.value.length) return;
  const [picked] = curatedSlots.value.splice(slotIdx, 1);
  picked.included = true;
  curatedSlots.value.unshift(picked);
  await renderActiveCitySlides();
}

function downloadSingleSlide(itemId: string): void {
  const file = slotFiles.value[itemId];
  if (file) downloadGeneratedCardFile(file);
}

function downloadAllRenderedSlides(): void {
  renderedSlides.value.forEach((file, idx) => {
    setTimeout(() => downloadGeneratedCardFile(file), idx * 220);
  });
}

async function callAdminInstagramApi<T>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<T> {
  const idToken = await getCurrentMulteiAdminIdToken();
  return await $fetch<T>(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`
    },
    body: payload
  });
}

async function discoverOrValidateHandles(useManualInputs: boolean): Promise<void> {
  const draft = activeCityDraft.value;
  if (!draft) return;

  isDiscoveringSocial.value = true;
  discoveredPrefeituraInfo.value = null;

  try {
    const res = await callAdminInstagramApi<{
      ok: boolean;
      prefeitura: DiscoveredSocialPreview | null;
      transito: DiscoveredSocialPreview | null;
    }>('/api/multei/instagram/discover', {
      cidade: draft.cidade,
      estado: draft.estado,
      manualPrefeitura: useManualInputs ? prefeituraHandleInput.value : '',
      manualTransito: useManualInputs ? transitoHandleInput.value : ''
    });

    if (res.prefeitura) {
      discoveredPrefeituraInfo.value = res.prefeitura;
      if (res.prefeitura.username && !useManualInputs) {
        prefeituraHandleInput.value = res.prefeitura.username;
      }
    }
    if (res.transito?.username && !useManualInputs && !transitoHandleInput.value) {
      transitoHandleInput.value = res.transito.username;
    }
  } catch (err: any) {
    feedbackBanner.value = {
      type: 'error',
      title: 'Falha ao consultar perfil na Meta',
      message:
        err?.data?.statusMessage ||
        err?.message ||
        'Não foi possível validar o @ na Meta neste momento.'
    };
  } finally {
    isDiscoveringSocial.value = false;
  }
}

async function saveHandlesForCity(): Promise<void> {
  const draft = activeCityDraft.value;
  if (!draft || !prefeituraHandleInput.value.trim()) return;

  isSavingSocial.value = true;
  try {
    const saved = await saveMulteiCitySocialProfile({
      cidade: draft.cidade,
      estado: draft.estado,
      instagramPrefeitura: prefeituraHandleInput.value,
      instagramTransito: transitoHandleInput.value,
      prefeituraName: discoveredPrefeituraInfo.value?.name,
      prefeituraFollowers: discoveredPrefeituraInfo.value?.followersCount,
      prefeituraPicUrl: discoveredPrefeituraInfo.value?.profilePictureUrl,
      updatedBy: props.adminEmail
    });
    draft.citySocial = saved;
    prefeituraHandleInput.value = saved.instagramPrefeitura;
    transitoHandleInput.value = saved.instagramTransito || '';

    // Atualiza legenda caso ainda não contenha o @ salvo
    await generateCityCaption(true);
  } catch (err: any) {
    feedbackBanner.value = {
      type: 'error',
      title: 'Erro ao salvar @ da cidade',
      message: err?.message || 'Verifique as permissões da coleção multei_city_socials.'
    };
  } finally {
    isSavingSocial.value = false;
  }
}

async function generateCityCaption(forceNewVariation = false): Promise<void> {
  const draft = activeCityDraft.value;
  if (!draft) return;

  const cacheKey = `${draft.dateKey}_${draft.cityKey}`;
  if (!forceNewVariation && captionCacheByCity.has(cacheKey)) {
    cityCaptionText.value = captionCacheByCity.get(cacheKey) || '';
    return;
  }

  isGeneratingCaption.value = true;
  try {
    const res = await callAdminInstagramApi<{ ok: boolean; caption: string }>(
      '/api/multei/instagram/caption',
      {
        mode: 'city_daily',
        cidade: draft.cidade,
        estado: draft.estado,
        totalDia: draft.totalDia,
        resolvidosDia: draft.resolvidosDia,
        transitoDia: draft.transitoDia,
        mobilidadeDia: draft.mobilidadeDia,
        bairros: draft.bairrosDia,
        instagramPrefeitura: prefeituraHandleInput.value,
        instagramTransito: transitoHandleInput.value,
        variationSeed: ++captionVariationCounter
      }
    );
    cityCaptionText.value = res.caption || '';
    captionCacheByCity.set(cacheKey, cityCaptionText.value);
  } catch (err: any) {
    feedbackBanner.value = {
      type: 'error',
      title: 'Aviso na geração de legenda',
      message: err?.data?.statusMessage || 'Não foi possível gerar a legenda automática.'
    };
  } finally {
    isGeneratingCaption.value = false;
  }
}

async function selectCityDraft(cityKey: string): Promise<void> {
  selectedCityKey.value = cityKey;
  confirmingCityPublish.value = false;
  discoveredPrefeituraInfo.value = null;

  const draft = activeCityDraft.value;
  if (!draft) return;

  curatedSlots.value = draft.selectedItems.map((item) => ({
    item,
    included: true
  }));

  prefeituraHandleInput.value = draft.citySocial?.instagramPrefeitura || '';
  transitoHandleInput.value = draft.citySocial?.instagramTransito || '';

  if (draft.selectedItems.length > 0) {
    void renderActiveCitySlides();

    if (!draft.citySocial?.instagramPrefeitura) {
      await discoverOrValidateHandles(false);
    }
    await generateCityCaption(false);
  } else {
    revokeAllSlidePreviewUrls();
    cityCaptionText.value = '';
  }
}

async function loadDailyDrafts(): Promise<void> {
  isLoadingDaily.value = true;
  try {
    const result = await fetchInstagramDailyDraftsForAdmin();
    todayDateKey.value = result.todayDateKey;
    dailyDrafts.value = result.drafts;

    if (result.drafts.length > 0) {
      const stillExists = result.drafts.some((d) => d.cityKey === selectedCityKey.value);
      const nextKey = stillExists ? selectedCityKey.value : result.drafts[0].cityKey;
      await selectCityDraft(nextKey);
    } else {
      selectedCityKey.value = '';
      curatedSlots.value = [];
      revokeAllSlidePreviewUrls();
    }
  } catch (err: any) {
    feedbackBanner.value = {
      type: 'error',
      title: 'Erro ao carregar cidades de hoje',
      message: err?.message || 'Não foi possível consultar os registros de hoje.'
    };
  } finally {
    isLoadingDaily.value = false;
  }
}

async function executeCityPublish(): Promise<void> {
  const draft = activeCityDraft.value;
  if (!draft || includedSlidesCount.value < 1 || isPublishing.value) return;

  isPublishing.value = true;
  publishStepLabel.value = 'Preparando imagens...';
  feedbackBanner.value = null;
  let uploadedStagingPaths: string[] = [];

  try {
    // 1. Garante que os arquivos JPEG 1080x1350 mais recentes estejam renderizados
    await renderActiveCitySlides();
    const filesToUpload = renderedSlides.value;
    if (filesToUpload.length < 1) {
      throw new Error('Nenhuma imagem pronta para envio ao Instagram.');
    }

    // 2. Salva o @ da prefeitura na coleção para próximas publicações (se informado)
    if (prefeituraHandleInput.value.trim()) {
      try {
        const savedSocial = await saveMulteiCitySocialProfile({
          cidade: draft.cidade,
          estado: draft.estado,
          instagramPrefeitura: prefeituraHandleInput.value,
          instagramTransito: transitoHandleInput.value,
          prefeituraName: discoveredPrefeituraInfo.value?.name,
          prefeituraFollowers: discoveredPrefeituraInfo.value?.followersCount,
          prefeituraPicUrl: discoveredPrefeituraInfo.value?.profilePictureUrl,
          updatedBy: props.adminEmail
        });
        draft.citySocial = savedSocial;
      } catch {}
    }

    // 3. Sobe temporariamente os slides no Firebase Storage (`instagram_staging/...`)
    publishStepLabel.value = `Enviando ${filesToUpload.length} slide(s)...`;
    const staging = await uploadTemporaryInstagramStagingSlides(
      filesToUpload,
      `${draft.estado}_${draft.cidade}`
    );
    uploadedStagingPaths = staging.storagePaths;

    // 4. Publica via rota administrativa segura na Meta Graph API
    publishStepLabel.value = 'Publicando no Instagram...';
    const userTags: Array<{ username: string; x: number; y: number }> = [];
    if (tagProfilesOnPhotos.value) {
      if (prefeituraHandleInput.value.trim()) {
        userTags.push({ username: prefeituraHandleInput.value.trim(), x: 0.35, y: 0.88 });
      }
      if (transitoHandleInput.value.trim()) {
        userTags.push({ username: transitoHandleInput.value.trim(), x: 0.65, y: 0.88 });
      }
    }

    const pubRes = await callAdminInstagramApi<{
      ok: boolean;
      mediaId: string;
      permalink: string;
      tagsApplied: boolean;
    }>('/api/multei/instagram/publish', {
      imageUrls: staging.downloadUrls,
      caption: cityCaptionText.value,
      userTags
    });

    // 5. Registra publicação em `multei_instagram_posts`
    const publishedIds = includedSlots.value.map((s) => s.item.id);
    await saveMulteiInstagramPublishedPost({
      dateKey: draft.dateKey,
      mode: 'city_daily',
      cidade: draft.cidade,
      estado: draft.estado,
      itemIds: publishedIds,
      instagramMediaId: pubRes.mediaId,
      permalink: pubRes.permalink,
      caption: cityCaptionText.value,
      publishedBy: props.adminEmail
    });

    confirmingCityPublish.value = false;
    feedbackBanner.value = {
      type: 'success',
      title: `Publicado com sucesso: ${draft.cidade} - ${draft.estado}!`,
      message: `${filesToUpload.length} ${filesToUpload.length === 1 ? 'imagem publicada' : 'slides publicados em carrossel'} na conta oficial @pcdvale.`,
      permalink: pubRes.permalink
    };

    await loadDailyDrafts();
  } catch (err: any) {
    feedbackBanner.value = {
      type: 'error',
      title: 'Falha ao publicar no Instagram',
      message:
        err?.data?.statusMessage ||
        err?.message ||
        'Verifique as permissões do token da Meta e tente novamente.'
    };
  } finally {
    if (uploadedStagingPaths.length > 0) {
      await deleteTemporaryInstagramStagingSlides(uploadedStagingPaths);
    }
    isPublishing.value = false;
    publishStepLabel.value = 'Publicando...';
  }
}

// ============================================================================
// LÓGICA DA FASE 2: RELATÓRIO GERAL POR PERÍODO SELECIONÁVEL
// ============================================================================

function computeDateKeyDaysAgo(daysAgo: number): string {
  const ms = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  return getBrazilDateKey(ms);
}

async function applyReportPreset(preset: ReportPresetId): Promise<void> {
  activeReportPreset.value = preset;
  const today = getBrazilDateKey();

  if (preset === 'today') {
    reportStartDate.value = today;
    reportEndDate.value = today;
    reportTitleText.value = 'Hoje no Multei';
  } else if (preset === 'last7') {
    reportStartDate.value = computeDateKeyDaysAgo(6);
    reportEndDate.value = today;
    reportTitleText.value = 'Essa semana no Multei';
  } else if (preset === 'last30') {
    reportStartDate.value = computeDateKeyDaysAgo(29);
    reportEndDate.value = today;
    reportTitleText.value = 'Últimos 30 dias no Multei';
  } else if (preset === 'thisMonth') {
    reportStartDate.value = `${today.slice(0, 7)}-01`;
    reportEndDate.value = today;
    reportTitleText.value = 'Esse mês no Multei';
  } else if (preset === 'all') {
    reportStartDate.value = '';
    reportEndDate.value = '';
    reportTitleText.value = 'Impacto do Multei';
  }

  await refreshGeneralReportData();
}

async function handleCustomReportDatesChange(): Promise<void> {
  activeReportPreset.value = 'custom';
  await refreshGeneralReportData();
}

async function renderGeneralReportCardNow(): Promise<void> {
  try {
    const file = await generateInstagramGeneralReportFile({
      title: reportTitleText.value || 'Essa semana no Multei',
      totalGeral: reportStats.value.totalGeral,
      cidadesCount: reportStats.value.cidadesCount,
      infracoesTransito: reportStats.value.infracoesTransito,
      mobilidadeUrbana: reportStats.value.mobilidadeUrbana,
      resolvidos: reportStats.value.resolvidos
    });
    if (reportPreviewUrl.value && reportPreviewUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(reportPreviewUrl.value);
    }
    reportCardFile.value = file;
    reportPreviewUrl.value = URL.createObjectURL(file);
  } catch {}
}

function scheduleRenderGeneralReportCard(): void {
  if (reportRenderDebounceTimer) clearTimeout(reportRenderDebounceTimer);
  reportRenderDebounceTimer = setTimeout(() => {
    void renderGeneralReportCardNow();
  }, 250);
}

async function generateReportCaption(): Promise<void> {
  isGeneratingReportCaption.value = true;
  try {
    const periodLabel =
      reportStartDate.value && reportEndDate.value
        ? `${formatDateKeyBr(reportStartDate.value)} a ${formatDateKeyBr(reportEndDate.value)}`
        : 'Acumulado geral';

    const res = await callAdminInstagramApi<{ ok: boolean; caption: string }>(
      '/api/multei/instagram/caption',
      {
        mode: 'general_report',
        periodTitle: reportTitleText.value || 'Essa semana no Multei',
        periodLabel,
        totalGeral: reportStats.value.totalGeral,
        cidadesCount: reportStats.value.cidadesCount,
        infracoesTransito: reportStats.value.infracoesTransito,
        mobilidadeUrbana: reportStats.value.mobilidadeUrbana,
        resolvidos: reportStats.value.resolvidos,
        topCities: reportStats.value.topCities,
        variationSeed: ++captionVariationCounter
      }
    );
    reportCaptionText.value = res.caption || '';
  } catch (err: any) {
    feedbackBanner.value = {
      type: 'error',
      title: 'Aviso ao gerar legenda do relatório',
      message: err?.data?.statusMessage || 'Não foi possível gerar a legenda neste momento.'
    };
  } finally {
    isGeneratingReportCaption.value = false;
  }
}

async function refreshGeneralReportData(): Promise<void> {
  isLoadingReport.value = true;
  confirmingReportPublish.value = false;
  try {
    reportStats.value = await fetchInstagramGeneralReportForPeriod(
      reportStartDate.value,
      reportEndDate.value
    );
    await renderGeneralReportCardNow();
    await generateReportCaption();
  } catch (err: any) {
    feedbackBanner.value = {
      type: 'error',
      title: 'Erro ao calcular relatório do período',
      message: err?.message || 'Tente novamente em instantes.'
    };
  } finally {
    isLoadingReport.value = false;
  }
}

function downloadReportCard(): void {
  if (reportCardFile.value) {
    downloadGeneratedCardFile(reportCardFile.value);
  }
}

async function executeReportPublish(): Promise<void> {
  if (!reportCardFile.value || isPublishing.value) return;

  isPublishing.value = true;
  publishStepLabel.value = 'Enviando arte do relatório...';
  feedbackBanner.value = null;
  let stagingPaths: string[] = [];

  try {
    await renderGeneralReportCardNow();
    if (!reportCardFile.value) {
      throw new Error('Arte do relatório indisponível.');
    }

    const staging = await uploadTemporaryInstagramStagingSlides([reportCardFile.value], 'relatorio');
    stagingPaths = staging.storagePaths;

    publishStepLabel.value = 'Publicando no Instagram...';
    const pubRes = await callAdminInstagramApi<{
      ok: boolean;
      mediaId: string;
      permalink: string;
    }>('/api/multei/instagram/publish', {
      imageUrls: staging.downloadUrls,
      caption: reportCaptionText.value,
      userTags: []
    });

    await saveMulteiInstagramPublishedPost({
      dateKey: getBrazilDateKey(),
      mode: 'general_report',
      itemIds: [],
      instagramMediaId: pubRes.mediaId,
      permalink: pubRes.permalink,
      caption: reportCaptionText.value,
      publishedBy: props.adminEmail
    });

    confirmingReportPublish.value = false;
    feedbackBanner.value = {
      type: 'success',
      title: 'Relatório Geral publicado com sucesso!',
      message: 'A arte institucional já está disponível no Feed de @pcdvale.',
      permalink: pubRes.permalink
    };
  } catch (err: any) {
    feedbackBanner.value = {
      type: 'error',
      title: 'Falha ao publicar relatório no Instagram',
      message: err?.data?.statusMessage || err?.message || 'Tente novamente em instantes.'
    };
  } finally {
    if (stagingPaths.length > 0) {
      await deleteTemporaryInstagramStagingSlides(stagingPaths);
    }
    isPublishing.value = false;
    publishStepLabel.value = 'Publicando...';
  }
}

async function switchSubMode(nextMode: 'city_daily' | 'general_report'): Promise<void> {
  subMode.value = nextMode;
  if (nextMode === 'general_report' && !reportPreviewUrl.value) {
    await applyReportPreset('last7');
  }
}

onMounted(() => {
  void loadDailyDrafts();

  // Verifica virada das 23:59 -> 00:00 (horário de Brasília) para renovar automaticamente os rascunhos
  midnightRolloverTimer = setInterval(() => {
    const currentKey = getBrazilDateKey();
    if (currentKey !== todayDateKey.value) {
      captionCacheByCity.clear();
      void loadDailyDrafts();
    }
  }, 60_000);
});

onBeforeUnmount(() => {
  revokeAllSlidePreviewUrls();
  if (reportPreviewUrl.value && reportPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(reportPreviewUrl.value);
  }
  if (reportRenderDebounceTimer) clearTimeout(reportRenderDebounceTimer);
  if (midnightRolloverTimer) clearInterval(midnightRolloverTimer);
});
</script>

<style scoped>
.ig-publisher-root {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.ig-header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.ig-kicker {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--pp-accent);
  margin-bottom: 0.25rem;
}

.ig-main-title {
  font-size: 1.55rem;
  font-weight: 800;
  color: var(--pp-text-primary);
  margin: 0 0 0.3rem;
}

.ig-main-subtitle {
  font-size: 0.94rem;
  color: var(--pp-text-secondary);
  margin: 0;
  max-width: 680px;
}

.ig-submode-switch {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.35rem;
  background: var(--pp-surface-alt);
  border: 1px solid var(--pp-border);
  border-radius: 12px;
}

.ig-submode-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.95rem;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pp-text-secondary);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.16s ease;
}

.ig-submode-btn.is-active {
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  border-color: var(--pp-selected-border);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}

.ig-submode-badge {
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}

.ig-feedback-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 12px;
  border: 1px solid var(--pp-border);
}

.ig-feedback-banner.is-success {
  background: var(--pp-green-bg);
  border-color: var(--pp-green-border);
  color: var(--pp-green-text);
}

.ig-feedback-banner.is-error {
  background: var(--pp-red-bg);
  border-color: var(--pp-red-border);
  color: var(--pp-red-text);
}

.ig-feedback-content p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

.ig-permalink-btn {
  display: inline-block;
  margin-top: 0.5rem;
  font-weight: 700;
  color: inherit;
  text-decoration: underline;
}

.ig-feedback-close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
}

.ig-window-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1.1rem;
  background: var(--pp-surface);
  border: 1px solid var(--pp-border);
  border-radius: 12px;
  margin-bottom: 1rem;
}

.ig-window-info {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9rem;
  color: var(--pp-text-primary);
}

.ig-live-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
  flex-shrink: 0;
}

.ig-empty-box {
  padding: 2.5rem 1.5rem;
  text-align: center;
  background: var(--pp-surface);
  border: 1px dashed var(--pp-border-strong);
  border-radius: 14px;
}

.ig-empty-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--pp-text-primary);
  margin: 0 0 0.35rem;
}

.ig-empty-desc {
  font-size: 0.9rem;
  color: var(--pp-text-secondary);
  margin: 0 auto;
  max-width: 560px;
}

.ig-workspace-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1.25rem;
  align-items: start;
}

@media (max-width: 960px) {
  .ig-workspace-grid {
    grid-template-columns: 1fr;
  }
}

.ig-cities-sidebar {
  background: var(--pp-surface);
  border: 1px solid var(--pp-border);
  border-radius: 14px;
  padding: 1rem;
}

.ig-sidebar-heading {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--pp-text-primary);
  margin: 0 0 0.75rem;
}

.ig-cities-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 680px;
  overflow-y: auto;
}

.ig-city-card {
  text-align: left;
  padding: 0.8rem 0.9rem;
  border-radius: 11px;
  border: 1px solid var(--pp-border);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.ig-city-card.is-selected {
  background: var(--pp-selected-bg);
  border-color: var(--pp-selected-border);
  box-shadow: 0 0 0 1px var(--pp-selected-border);
}

.ig-city-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
}

.ig-city-name {
  font-size: 0.92rem;
  font-weight: 700;
}

.ig-status-pill {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.ig-status-pill.is-published {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1px solid var(--pp-green-border);
}

.ig-status-pill.is-pending {
  background: var(--pp-surface);
  color: var(--pp-text-secondary);
  border: 1px solid var(--pp-border);
}

.ig-city-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.ig-count-chip {
  font-size: 0.74rem;
  font-weight: 600;
  padding: 0.12rem 0.45rem;
  border-radius: 6px;
}

.ig-count-chip.is-green,
.ig-cat-tag.is-green {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
}

.ig-count-chip.is-purple,
.ig-cat-tag.is-purple {
  background: var(--pp-selected-bg);
  color: var(--pp-text-primary);
}

.ig-count-chip.is-amber,
.ig-cat-tag.is-amber {
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
}

.ig-city-saved-handle {
  margin-top: 0.4rem;
  font-size: 0.78rem;
  color: var(--pp-text-secondary);
  font-weight: 600;
}

.ig-draft-editor {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.ig-published-today-box {
  padding: 0.9rem 1.1rem;
  border-radius: 12px;
  background: var(--pp-green-bg);
  border: 1px solid var(--pp-green-border);
  color: var(--pp-green-text);
  font-size: 0.9rem;
}

.ig-published-links {
  margin: 0.35rem 0 0;
  padding-left: 1.2rem;
}

.ig-published-links a {
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
}

.ig-panel-card {
  background: var(--pp-surface);
  border: 1px solid var(--pp-border);
  border-radius: 14px;
  padding: 1.2rem;
}

.ig-card-header-flex {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.ig-card-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--pp-text-primary);
  margin: 0 0 0.25rem;
}

.ig-card-helper {
  font-size: 0.85rem;
  color: var(--pp-text-secondary);
  margin: 0;
}

.ig-rendering-indicator {
  padding: 0.65rem 0.9rem;
  margin-bottom: 0.85rem;
  border-radius: 8px;
  background: var(--pp-surface-alt);
  color: var(--pp-text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
}

.ig-slides-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.ig-slide-card {
  display: flex;
  flex-direction: column;
  background: var(--pp-surface-alt);
  border: 1px solid var(--pp-border);
  border-radius: 12px;
  overflow: hidden;
  transition: opacity 0.16s ease;
}

.ig-slide-card.is-cover {
  border-color: var(--pp-selected-border);
  box-shadow: 0 0 0 2px var(--pp-selected-border);
}

.ig-slide-card.is-excluded {
  opacity: 0.52;
}

.ig-slide-preview-wrap {
  position: relative;
  aspect-ratio: 4 / 5;
  background: #0f172a;
  overflow: hidden;
}

.ig-slide-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.ig-cover-ribbon,
.ig-order-ribbon,
.ig-excluded-ribbon {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}

.ig-cover-ribbon {
  background: #86007d;
  color: #ffffff;
}

.ig-order-ribbon {
  background: rgba(15, 23, 42, 0.82);
  color: #ffffff;
}

.ig-excluded-ribbon {
  background: #7f1d1d;
  color: #ffffff;
}

.ig-slide-meta {
  padding: 0.65rem 0.75rem 0.45rem;
  flex: 1;
}

.ig-cat-tag {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.14rem 0.45rem;
  border-radius: 6px;
}

.ig-slide-addr {
  font-size: 0.78rem;
  color: var(--pp-text-secondary);
  margin: 0.35rem 0 0;
  line-height: 1.35;
}

.ig-slide-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem 0.75rem;
  border-top: 1px solid var(--pp-border);
}

.ig-check-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--pp-text-primary);
  cursor: pointer;
}

.ig-mini-btn {
  padding: 0.22rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--pp-border);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  cursor: pointer;
}

.ig-mini-btn:hover {
  border-color: var(--pp-selected-border);
}

.ig-saved-badge {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1px solid var(--pp-green-border);
}

.ig-socials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.9rem;
  margin-bottom: 0.85rem;
}

.ig-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ig-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--pp-text-primary);
}

.ig-input-group {
  display: flex;
  align-items: center;
  border: 1px solid var(--pp-border);
  border-radius: 10px;
  background: var(--pp-surface-alt);
  overflow: hidden;
}

.ig-at-prefix {
  padding: 0.55rem 0.65rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
  border-right: 1px solid var(--pp-border);
}

.ig-input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--pp-text-primary);
  padding: 0.58rem 0.75rem;
  font-size: 0.9rem;
}

.ig-input.is-standalone {
  border: 1px solid var(--pp-border);
  border-radius: 10px;
  background: var(--pp-surface-alt);
}

.ig-socials-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.ig-tag-toggle {
  margin-left: auto;
}

.ig-discovery-result {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 0.9rem;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  background: var(--pp-green-bg);
  border: 1px solid var(--pp-green-border);
  color: var(--pp-green-text);
  font-size: 0.85rem;
}

.ig-discovery-result.is-unverified {
  background: var(--pp-amber-bg);
  border-color: var(--pp-amber-border);
  color: var(--pp-amber-text);
}

.ig-discovery-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.ig-discovery-text p {
  margin: 0.18rem 0 0;
}

.ig-discovery-bio {
  opacity: 0.88;
  font-size: 0.8rem;
}

.ig-caption-textarea {
  width: 100%;
  border: 1px solid var(--pp-border);
  border-radius: 10px;
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  padding: 0.85rem;
  font-family: inherit;
  font-size: 0.92rem;
  line-height: 1.5;
  resize: vertical;
}

.ig-caption-footer-meta {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: var(--pp-text-secondary);
}

.ig-publish-bar {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.ig-confirm-box {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--pp-selected-bg);
  border: 1px solid var(--pp-selected-border);
  color: var(--pp-text-primary);
}

.ig-confirm-box p {
  margin: 0 0 0.75rem;
  font-size: 0.92rem;
}

.ig-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
}

.ig-btn-primary {
  padding: 0.72rem 1.35rem;
  border-radius: 10px;
  border: none;
  background: #86007d;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.92rem;
  cursor: pointer;
  transition: background 0.16s ease, opacity 0.16s ease;
}

.ig-btn-primary:hover:not(:disabled) {
  background: #6e0066;
}

.ig-btn-primary:disabled,
.ig-btn-secondary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ig-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.95rem;
  border-radius: 9px;
  border: 1px solid var(--pp-border);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.ig-btn-secondary:hover:not(:disabled) {
  border-color: var(--pp-selected-border);
}

/* Fase 2 — Relatório Geral */
.ig-report-container {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.ig-preset-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.ig-preset-btn {
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--pp-border);
  background: var(--pp-surface-alt);
  color: var(--pp-text-secondary);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.ig-preset-btn.is-active {
  background: #86007d;
  border-color: #86007d;
  color: #ffffff;
}

.ig-report-filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.9rem;
}

.ig-report-workspace-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 1.25rem;
  align-items: start;
}

@media (max-width: 960px) {
  .ig-report-workspace-grid {
    grid-template-columns: 1fr;
  }
}

.ig-report-img-holder {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--pp-border);
  background: #0f172a;
}

.ig-report-preview-img {
  width: 100%;
  height: auto;
  display: block;
}
</style>
