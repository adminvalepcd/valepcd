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
                  <span>
                    {{ post.mode === 'city_story' ? '📲 Stories' : '🖼️ Feed' }} às
                    {{ formatTimeBr(post.publishedAt) }} ({{ post.itemIds.length }} slide(s)) —
                  </span>
                  <a :href="post.permalink" target="_blank" rel="noopener noreferrer">
                    Abrir no Instagram ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div v-if="curatedSlots.length === 0" class="ig-empty-box">
            <p class="ig-empty-title">Todas as ocorrências de hoje nesta cidade já foram publicadas no Feed!</p>
            <p class="ig-empty-desc">
              Se entrarem novos registros até as 23:59, eles aparecerão aqui sem repetir fotos anteriores.
            </p>
          </div>

          <template v-else>
            <!-- 1. Prévia dos Slides (Feed 4:5 ou Stories 9:16) e Curadoria (1 a 9 fotos) -->
            <div class="ig-panel-card">
              <div class="ig-card-header-flex">
                <div>
                  <h3 class="ig-card-title">
                    1. Prévia do Post — {{ activeCityDraft.cidade }}/{{ activeCityDraft.estado }}
                    ({{ includedSlidesCount }} {{ includedSlidesCount === 1 ? 'arte' : 'slides' }})
                  </h3>
                  <p class="ig-card-helper">
                    Prioridade automática: até 3 Resolvidos → até 3 Trânsito → até 3 Mobilidade. Alterne entre <strong>Feed (4:5)</strong> e <strong>Stories (9:16)</strong> para conferir o ajuste da foto e a marcação discreta logo abaixo.
                  </p>
                </div>

                <div class="ig-header-actions">
                  <div class="ig-format-toggle" role="group" aria-label="Formato da prévia">
                    <button
                      type="button"
                      class="ig-format-btn"
                      :class="{ 'is-active': cityPreviewFormat === 'feed' }"
                      @click="switchCityPreviewFormat('feed')"
                    >
                      🖼️ Feed (4:5)
                    </button>
                    <button
                      type="button"
                      class="ig-format-btn"
                      :class="{ 'is-active': cityPreviewFormat === 'stories' }"
                      @click="switchCityPreviewFormat('stories')"
                    >
                      📲 Stories (9:16)
                    </button>
                  </div>

                  <button
                    type="button"
                    class="ig-btn-secondary"
                    :disabled="isRenderingSlides || activeCityRenderedSlides.length === 0"
                    @click="downloadAllRenderedSlides"
                  >
                    ⬇️ Baixar {{ activeCityRenderedSlides.length }}
                    {{ cityPreviewFormat === 'stories' ? 'Story(ies)' : 'arte(s)' }}
                  </button>
                </div>
              </div>

              <div class="ig-field ig-city-footer-field">
                <label for="ig-city-footer-url" class="ig-label">
                  Texto / endereço exibido no rodapé roxo da arte
                </label>
                <input
                  id="ig-city-footer-url"
                  v-model="cityFooterUrlInput"
                  type="text"
                  maxlength="90"
                  class="ig-input is-standalone"
                  placeholder="Ex: www.valepcd.com.br/multei"
                  @input="handleCityFooterChanged"
                />
              </div>

              <div v-if="isRenderingSlides" class="ig-rendering-indicator">
                Gerando prévia dos templates
                {{ cityPreviewFormat === 'stories' ? '1080×1920 (Stories 9:16)' : '1080×1350 (Feed 4:5)' }}...
              </div>

              <div class="ig-slides-grid">
                <article
                  v-for="(slot, idx) in curatedSlots"
                  :key="slot.item.id"
                  class="ig-slide-card"
                  :class="{ 'is-excluded': !slot.included, 'is-cover': getIncludedIndex(slot.item.id) === 0 }"
                >
                  <div
                    class="ig-slide-preview-wrap"
                    :class="{ 'is-story-ratio': cityPreviewFormat === 'stories' }"
                  >
                    <img
                      v-if="activeCityPreviewUrls[slot.item.id]"
                      :src="activeCityPreviewUrls[slot.item.id]"
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
                    <div class="ig-slide-meta-top">
                      <span class="ig-cat-tag" :class="{
                                                'is-green': slot.item.category === 'resolvido',
                                                'is-purple': slot.item.category === 'transito',
                                                'is-amber': slot.item.category === 'mobilidade'
                                              }">
                        {{
                        slot.item.category === 'resolvido'
                        ? '✅ Problema Resolvido'
                        : slot.item.category === 'transito'
                        ? '♿ Trânsito'
                        : '🚧 Mobilidade Urbana'
                        }}
                      </span>
<div v-if="slot.item.secondaryPhotoUrl" class="ig-photo-choice-bar" role="group"
  aria-label="Escolher entre Foto 1 e Foto 2 da ocorrência">
  <button type="button" class="ig-photo-choice-btn" :class="{ 'is-active': slot.selectedPhoto === 1 }"
    title="Usar a Foto 1 da ocorrência" @click="selectSlotPhotoIndex(idx, 1)">
    📷 Foto 1
  </button>
  <button type="button" class="ig-photo-choice-btn" :class="{ 'is-active': slot.selectedPhoto === 2 }"
    title="Usar a Foto 2 da ocorrência" @click="selectSlotPhotoIndex(idx, 2)">
    📷 Foto 2
  </button>
</div>
</div>

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

                    <button type="button" class="ig-mini-btn ig-crop-trigger-btn" :class="{ 'is-cropped': hasCustomCrop(slot) }"
                      title="Ajustar posição e zoom da foto dentro do quadro (recortar)" @click="openCropModal(idx)">
                      ✂️ {{ hasCustomCrop(slot) ? 'Ajustado' : 'Recortar' }}
                    </button>

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
                      v-if="activeCityFilesMap[slot.item.id]"
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
                    2. Poder Público Local (@ para menção e marcação no Feed / Stories)
                  </h3>
                  <p class="ig-card-helper">
                    Salvo na coleção <code>multei_city_socials</code>. Nos Stories, reduz um pouco a foto e posiciona o <code>@</code> discreto logo abaixo do quadro.
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
                      @input="handleCityHandlesChanged"
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
                      @input="handleCityHandlesChanged"
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
                  ✓ Validar @ no Instagram
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
                  <input
                    v-model="tagProfilesOnPhotos"
                    type="checkbox"
                    @change="handleCityHandlesChanged"
                  />
                  <span>Marcar @ nas fotos e nos Stories (<code>user_tags</code>)</span>
                </label>
              </div>

              <!-- Card de confirmação do perfil verificado no Instagram -->
              <div v-if="discoveredPrefeituraInfo" class="ig-discovery-result" :class="{ 'is-unverified': !discoveredPrefeituraInfo.verified }">
                <img
                  v-if="discoveredPrefeituraInfo.profilePictureUrl"
                  :src="discoveredPrefeituraInfo.profilePictureUrl"
                  alt="Foto de perfil encontrada no Instagram"
                  class="ig-discovery-avatar"
                />
                <div class="ig-discovery-text">
                  <strong v-if="discoveredPrefeituraInfo.username">
                    @{{ discoveredPrefeituraInfo.username }}
                    <span v-if="discoveredPrefeituraInfo.name">• {{ discoveredPrefeituraInfo.name }}</span>
                  </strong>
                  <p v-if="discoveredPrefeituraInfo.verified">
                    ✓ Perfil público ativo confirmado no Instagram
                    <span v-if="typeof discoveredPrefeituraInfo.followersCount === 'number'">
                      ({{ discoveredPrefeituraInfo.followersCount.toLocaleString('pt-BR') }} seguidores)
                    </span>
                  </p>
                  <p v-else>{{ discoveredPrefeituraInfo.reason }}</p>
                  <p v-if="discoveredPrefeituraInfo.biography" class="ig-discovery-bio">
                    {{ discoveredPrefeituraInfo.biography }}
                  </p>
                  <p v-if="discoveredPrefeituraInfo.metaTokenExpired" class="ig-token-warn">
                    ⚠️ Atenção: o <code>NUXT_IG_ACCESS_TOKEN</code> atual expirou na Meta (código 190). Renove o token antes de clicar em Publicar.
                  </p>
                </div>
              </div>
            </div>

            <!-- 3. Legenda Dinâmica (Gemini) + Botões de Publicação (Stories / Feed / Ambos) -->
            <div class="ig-panel-card">
              <div class="ig-card-header-flex">
                <div>
                  <h3 class="ig-card-title">3. Legenda do Feed (Gemini IA) e Publicação</h3>
                  <p class="ig-card-helper">
                    Obrigatória apenas para o <strong>Feed</strong>. Se for publicar somente nos <strong>Stories</strong>, não precisa gerar legenda.
                  </p>
                </div>

                <button
                  type="button"
                  class="ig-btn-secondary"
                  :disabled="isGeneratingCaption || isRenderingSlides || activeCityRenderedSlides.length === 0"
                  @click="generateCityCaption(true)"
                >
                  {{
                    isGeneratingCaption
                      ? 'Gerando...'
                      : hasGeneratedCityCaption
                        ? '✨ Regerar'
                        : '✨ Gerar'
                  }}
                </button>
              </div>

              <textarea
                v-model="cityCaptionText"
                rows="9"
                maxlength="2200"
                class="ig-caption-textarea"
                placeholder="Para publicar no Feed, clique em 'Gerar' após a prévia das imagens ficar pronta (opcional para Stories)..."
              ></textarea>
              <div class="ig-caption-footer-meta">
                <span>{{ cityCaptionText.length }} / 2200 caracteres</span>
              </div>

              <!-- Confirmação inline segura antes de disparar o post oficial -->
              <div v-if="!confirmingCityPublish" class="ig-publish-bar">
                <button
                  type="button"
                  class="ig-btn-story"
                  :disabled="isPublishing || isRenderingSlides || includedSlidesCount < 1"
                  @click="promptCityPublish('stories')"
                >
                  📲 Publicar nos Stories ({{ includedSlidesCount }})
                </button>

                <button
                  type="button"
                  class="ig-btn-primary"
                  :disabled="isPublishing || isRenderingSlides || includedSlidesCount < 1 || !cityCaptionText.trim()"
                  @click="promptCityPublish('feed')"
                >
                  🚀 Publicar no Feed
                </button>

                <button
                  type="button"
                  class="ig-btn-both"
                  :disabled="isPublishing || isRenderingSlides || includedSlidesCount < 1 || !cityCaptionText.trim()"
                  @click="promptCityPublish('both')"
                >
                  ✨ Publicar Feed + Stories
                </button>
              </div>

              <div v-else class="ig-confirm-box">
                <p>
                  Confirmar publicação imediata em <strong>@pcdvale</strong> ({{ cityPublishTargetLabel }}) com
                  <strong>{{ includedSlidesCount }} {{ includedSlidesCount === 1 ? 'arte' : 'slides' }}</strong>
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
              Escolha o período livremente. Nos <strong>Stories (9:16)</strong>, se informar algum <code>@</code>, a marcação discreta entra logo abaixo do card de Problemas Resolvidos (ou abaixo da linha Trânsito/Mobilidade quando não houver resolvidos).
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
              maxlength="64"
              class="ig-input is-standalone"
              placeholder="Cidades mais acessíveis acontecem aqui"
              @input="scheduleRenderGeneralReportCard"
            />
          </div>

          <div class="ig-field">
            <label for="ig-rep-story-tags" class="ig-label">@ para marcar nos Stories</label>
            <input
              id="ig-rep-story-tags"
              v-model="reportStoryHandlesInput"
              type="text"
              maxlength="95"
              class="ig-input is-standalone"
              placeholder="Ex: prefeiturabh, bhtransoficial"
              @input="scheduleRenderGeneralReportCard"
            />
          </div>

          <div class="ig-field">
            <label for="ig-rep-footer-msg" class="ig-label">Frase no rodapé roxo (opcional)</label>
            <input
              id="ig-rep-footer-msg"
              v-model="reportFooterMessageInput"
              type="text"
              maxlength="140"
              class="ig-input is-standalone"
              placeholder="Com seu apoio e denúncia 100% anônima..."
              @input="handleReportFooterChanged"
            />
          </div>

          <div class="ig-field">
            <label for="ig-rep-footer-url" class="ig-label">Endereço / link no rodapé roxo</label>
            <input
              id="ig-rep-footer-url"
              v-model="reportFooterUrlInput"
              type="text"
              maxlength="90"
              class="ig-input is-standalone"
              placeholder="Ex: www.valepcd.com.br/multei"
              @input="handleReportFooterChanged"
            />
          </div>
        </div>
      </div>

      <div class="ig-report-workspace-grid">
        <!-- Prévia da Arte (Feed 4:5 ou Stories 9:16) da Fase 2 -->
        <div class="ig-panel-card ig-report-preview-card">
          <div class="ig-card-header-flex">
            <div class="ig-format-toggle" role="group" aria-label="Formato da arte do relatório">
              <button
                type="button"
                class="ig-format-btn"
                :class="{ 'is-active': reportPreviewFormat === 'feed' }"
                @click="switchReportPreviewFormat('feed')"
              >
                🖼️ Feed (4:5)
              </button>
              <button
                type="button"
                class="ig-format-btn"
                :class="{ 'is-active': reportPreviewFormat === 'stories' }"
                @click="switchReportPreviewFormat('stories')"
              >
                📲 Stories (9:16)
              </button>
            </div>

            <button
              type="button"
              class="ig-btn-secondary"
              :disabled="!activeReportFile || isLoadingReport || isRenderingReportCard"
              @click="downloadReportCard"
            >
              ⬇️ Baixar {{ reportPreviewFormat === 'stories' ? 'Story' : 'Arte' }}
            </button>
          </div>

          <div v-if="isLoadingReport || isRenderingReportCard" class="ig-rendering-indicator">
            {{ isLoadingReport ? 'Calculando indicadores do período...' : 'Atualizando prévia da arte...' }}
          </div>

          <div v-if="activeReportPreviewUrl" class="ig-report-img-holder">
            <img
              :src="activeReportPreviewUrl"
              alt="Prévia do card de Relatório Geral do Multei"
              class="ig-report-preview-img"
            />
          </div>
        </div>

        <!-- Legenda e Publicação da Fase 2 -->
        <div class="ig-panel-card">
          <div class="ig-card-header-flex">
            <div>
              <h3 class="ig-card-title">Legenda do Feed (link p/ /multei/sobre) e Publicação</h3>
              <p class="ig-card-helper">
                Direciona para <code>https://valepcd.com.br/multei/sobre</code>. Para publicar apenas nos <strong>Stories</strong>, não é necessário gerar legenda.
              </p>
            </div>

            <button
              type="button"
              class="ig-btn-secondary"
              :disabled="isGeneratingReportCaption || isLoadingReport || isRenderingReportCard || !activeReportFile"
              @click="generateReportCaption"
            >
              {{
                isGeneratingReportCaption
                  ? 'Gerando...'
                  : hasGeneratedReportCaption
                    ? '✨ Regerar'
                    : '✨ Gerar'
              }}
            </button>
          </div>

          <textarea
            v-model="reportCaptionText"
            rows="11"
            maxlength="2200"
            class="ig-caption-textarea"
            placeholder="Para publicar no Feed, clique em 'Gerar' após a arte ficar pronta (opcional para Stories)..."
          ></textarea>
          <div class="ig-caption-footer-meta">
            <span>{{ reportCaptionText.length }} / 2200 caracteres</span>
          </div>

          <div v-if="!confirmingReportPublish" class="ig-publish-bar">
            <button
              type="button"
              class="ig-btn-story"
              :disabled="isPublishing || isLoadingReport || isRenderingReportCard || !activeReportFile || reportStats.totalGeral <= 0"
              @click="promptReportPublish('stories')"
            >
              📲 Publicar nos Stories
            </button>

            <button
              type="button"
              class="ig-btn-primary"
              :disabled="isPublishing || isLoadingReport || isRenderingReportCard || !activeReportFile || !reportCaptionText.trim() || reportStats.totalGeral <= 0"
              @click="promptReportPublish('feed')"
            >
              🚀 Publicar no Feed
            </button>

            <button
              type="button"
              class="ig-btn-both"
              :disabled="isPublishing || isLoadingReport || isRenderingReportCard || !activeReportFile || !reportCaptionText.trim() || reportStats.totalGeral <= 0"
              @click="promptReportPublish('both')"
            >
              ✨ Publicar Feed + Stories
            </button>
          </div>

          <div v-else class="ig-confirm-box">
            <p>
              Confirmar publicação imediata deste <strong>Relatório Geral</strong> ({{ reportPublishTargetLabel }}) em <strong>@pcdvale</strong>?
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
<!-- ===================================================================== -->
<!-- MODAL INTERATIVO DE ENQUADRAMENTO / RECORTE DA FOTO DENTRO DO QUADRO  -->
<!-- ===================================================================== -->
<div v-if="cropModalSlot" class="ig-crop-modal-backdrop" role="dialog" aria-modal="true"
  aria-labelledby="ig-crop-modal-title" @click.self="closeCropModal">
  <div class="ig-crop-modal-card">
    <div class="ig-crop-modal-header">
      <div>
        <h3 id="ig-crop-modal-title" class="ig-crop-modal-title">
          ✂️ Ajustar Foto no Quadro — Slide {{ cropModalSlotIdx + 1 }}
        </h3>
        <p class="ig-crop-modal-subtitle">
          Arraste a imagem com o mouse (ou toque) para posicionar e use o controle de zoom para recortar dentro do
          quadro.
        </p>
      </div>
      <button type="button" class="ig-crop-close-btn" aria-label="Fechar ajuste de foto" @click="closeCropModal">
        ✕
      </button>
    </div>

    <!-- Seletor de Foto 1 / Foto 2 ou Antes / Depois dentro do modal -->
    <div v-if="cropModalSlot.item.secondaryPhotoUrl || cropModalSlot.item.category === 'resolvido'"
      class="ig-crop-source-bar">
      <template v-if="cropModalSlot.item.category === 'resolvido' && cropModalSlot.item.resolvedPhotoUrl">
        <span class="ig-crop-source-label">Quadro em ajuste:</span>
        <div class="ig-photo-choice-bar">
          <button type="button" class="ig-photo-choice-btn" :class="{ 'is-active': cropModalTargetSide === 'main' }"
            @click="switchCropModalSide('main')">
            📷 Foto Antes
          </button>
          <button type="button" class="ig-photo-choice-btn" :class="{ 'is-active': cropModalTargetSide === 'resolved' }"
            @click="switchCropModalSide('resolved')">
            ✓ Foto Resolvido
          </button>
        </div>
      </template>

      <template v-else-if="cropModalSlot.item.secondaryPhotoUrl">
        <span class="ig-crop-source-label">Foto da publicação:</span>
        <div class="ig-photo-choice-bar">
          <button type="button" class="ig-photo-choice-btn" :class="{ 'is-active': cropModalPhotoIndex === 1 }"
            @click="switchCropModalPhotoIndex(1)">
            📷 Foto 1
          </button>
          <button type="button" class="ig-photo-choice-btn" :class="{ 'is-active': cropModalPhotoIndex === 2 }"
            @click="switchCropModalPhotoIndex(2)">
            📷 Foto 2
          </button>
        </div>
      </template>
    </div>

    <div class="ig-crop-stage-wrapper">
      <div class="ig-crop-canvas-shell" :class="{
              'is-dragging': isDraggingCropCanvas,
              'is-half-frame': cropModalSlot.item.category === 'resolvido'
            }">
        <canvas ref="cropCanvasRef" :width="cropCanvasDimensions.width" :height="cropCanvasDimensions.height"
          class="ig-crop-canvas" @pointerdown="onCropPointerDown" @pointermove="onCropPointerMove"
          @pointerup="onCropPointerUp" @pointercancel="onCropPointerUp" @wheel.prevent="onCropWheel"></canvas>
        <div v-if="isLoadingCropImage" class="ig-crop-loading-overlay">
          Carregando foto...
        </div>
        <span class="ig-crop-drag-hint">
          ✋ Arraste para mover • Role para dar zoom
        </span>
      </div>
    </div>

    <div class="ig-crop-sliders-grid">
      <div class="ig-crop-slider-row">
        <div class="ig-crop-slider-header">
          <label for="ig-crop-zoom-range">🔍 Zoom (Recorte)</label>
          <strong>{{ Math.round(activeWorkingCrop.zoom * 100) }}%</strong>
        </div>
        <input id="ig-crop-zoom-range" type="range" min="1" max="3" step="0.02" :value="activeWorkingCrop.zoom"
          class="ig-crop-range" @input="onCropZoomSliderInput" />
      </div>

      <div class="ig-crop-slider-row">
        <div class="ig-crop-slider-header">
          <label for="ig-crop-x-range">↔ Posição Horizontal (Esquerda / Direita)</label>
          <strong>{{ Math.round(activeWorkingCrop.offsetX * 100) }}%</strong>
        </div>
        <input id="ig-crop-x-range" type="range" min="-1" max="1" step="0.02" :value="activeWorkingCrop.offsetX"
          class="ig-crop-range" @input="onCropOffsetXSliderInput" />
      </div>

      <div class="ig-crop-slider-row">
        <div class="ig-crop-slider-header">
          <label for="ig-crop-y-range">↕ Posição Vertical (Topo / Base)</label>
          <strong>{{ Math.round(activeWorkingCrop.offsetY * 100) }}%</strong>
        </div>
        <input id="ig-crop-y-range" type="range" min="-1" max="1" step="0.02" :value="activeWorkingCrop.offsetY"
          class="ig-crop-range" @input="onCropOffsetYSliderInput" />
      </div>
    </div>

    <div class="ig-crop-modal-footer">
      <button type="button" class="ig-btn-secondary" @click="resetCropModalCurrent">
        ↺ Centralizar / Original
      </button>

      <div class="ig-crop-footer-right">
        <button type="button" class="ig-btn-secondary" @click="closeCropModal">
          Cancelar
        </button>
        <button type="button" class="ig-btn-primary" :disabled="isApplyingCrop" @click="applyCropModalChanges">
          {{ isApplyingCrop ? 'Aplicando...' : '✓ Aplicar no Slide' }}
        </button>
      </div>
    </div>
  </div>
</div>
  </section>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
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
  generateInstagramStorySlideWithTags,
  generateInstagramGeneralReportStoryWithTags,
  downloadGeneratedCardFile,
  readSavedMulteiFooterPrefs,
  saveMulteiFooterPrefs,
      loadImageForCanvas,
      drawInteractiveCropFrame,
      type InstagramStoryUserTagPoint,
      type PhotoCropAdjustment
} from '~/services/imageProcessor';

const props = defineProps<{
  adminEmail: string;
}>();

type PublishTargetMode = 'feed' | 'stories' | 'both';
type PreviewFormatMode = 'feed' | 'stories';

  interface NormalizedCropState {
    zoom: number;
    offsetX: number;
    offsetY: number;
  }

interface CuratedSlideSlot {
  item: InstagramDraftCandidateItem;
  included: boolean;
      selectedPhoto: 1 | 2;
      crop: NormalizedCropState;
      resolvedCrop: NormalizedCropState;
    }

    function createDefaultCropState(): NormalizedCropState {
      return { zoom: 1, offsetX: 0, offsetY: 0 };
}

interface DiscoveredSocialPreview {
  verified: boolean;
  username: string;
  name?: string;
  biography?: string;
  followersCount?: number;
  profilePictureUrl?: string;
  reason?: string;
  metaTokenExpired?: boolean;
  verificationSource?: 'meta_graph' | 'instagram_public';
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
const cityPreviewFormat = ref<PreviewFormatMode>('feed');
const cityFooterUrlInput = ref('www.valepcd.com.br/multei');

const curatedSlots = ref<CuratedSlideSlot[]>([]);
const slotFeedFiles = ref<Record<string, File>>({});
const slotFeedPreviewUrls = ref<Record<string, string>>({});
const slotStoryFiles = ref<Record<string, File>>({});
const slotStoryPreviewUrls = ref<Record<string, string>>({});
const slotStoryUserTags = ref<Record<string, InstagramStoryUserTagPoint[]>>({});
const storySlidesDirty = ref(true);
const feedSlidesDirty = ref(true);
const isRenderingSlides = ref(false);
let slideRenderSeq = 0;
let cityStoryDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let cityFooterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Estado do Modal Interativo de Enquadramento / Recorte da Foto
  const cropModalSlotIdx = ref < number > (-1);
  const cropModalPhotoIndex = ref < 1 | 2 > (1);
  const cropModalTargetSide = ref < 'main' | 'resolved' > ('main');
  const cropModalWorkingMain = ref < NormalizedCropState > (createDefaultCropState());
  const cropModalWorkingResolved = ref < NormalizedCropState > (createDefaultCropState());
  const cropCanvasRef = ref < HTMLCanvasElement | null > (null);
  const isLoadingCropImage = ref(false);
  const isApplyingCrop = ref(false);
  const isDraggingCropCanvas = ref(false);
  let cropLoadedImg: HTMLImageElement | null = null;
  let cropMaxShiftX = 0;
  let cropMaxShiftY = 0;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let dragStartOffsetX = 0;
  let dragStartOffsetY = 0;

  const cropModalSlot = computed < CuratedSlideSlot | null > (() => {
    const idx = cropModalSlotIdx.value;
    if (idx < 0 || idx >= curatedSlots.value.length) return null;
    return curatedSlots.value[idx] || null;
  });

  const activeWorkingCrop = computed < NormalizedCropState > (() => {
    return cropModalTargetSide.value === 'resolved'
      ? cropModalWorkingResolved.value
      : cropModalWorkingMain.value;
  });

  const cropCanvasDimensions = computed < { width: number; height: number } > (() => {
    const slot = cropModalSlot.value;
    const isStory = cityPreviewFormat.value === 'stories';
    if (slot?.item.category === 'resolvido') {
      return isStory ? { width: 460, height: 924 } : { width: 464, height: 756 };
    }
    return isStory ? { width: 932, height: 924 } : { width: 940, height: 756 };
  });

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
const pendingCityPublishTarget = ref<PublishTargetMode>('feed');
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
const reportPreviewFormat = ref<PreviewFormatMode>('feed');
const reportStartDate = ref('');
const reportEndDate = ref('');
const reportTitleText = ref('Cidades mais acessíveis acontecem aqui');
const reportStoryHandlesInput = ref('');
const reportFooterMessageInput = ref(
  'Com seu apoio e denúncia 100% anônima podemos juntos criar cidades mais acessíveis!'
);
const reportFooterUrlInput = ref('www.valepcd.com.br/multei');
const isLoadingReport = ref(false);
const reportStats = ref<InstagramPeriodReportData>({
  totalGeral: 0,
  cidadesCount: 0,
  infracoesTransito: 0,
  mobilidadeUrbana: 0,
  resolvidos: 0,
  topCities: []
});
const reportFeedFile = ref<File | null>(null);
const reportFeedPreviewUrl = ref('');
const reportStoryFile = ref<File | null>(null);
const reportStoryPreviewUrl = ref('');
const reportStoryUserTags = ref<InstagramStoryUserTagPoint[]>([]);
const isRenderingReportCard = ref(false);
const reportCaptionText = ref('');
const isGeneratingReportCaption = ref(false);
const confirmingReportPublish = ref(false);
const pendingReportPublishTarget = ref<PublishTargetMode>('feed');
let reportRenderDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let midnightRolloverTimer: ReturnType<typeof setInterval> | null = null;

const activeCityDraft = computed<InstagramDailyCityDraft | null>(() => {
  return dailyDrafts.value.find((d) => d.cityKey === selectedCityKey.value) || null;
});

const includedSlots = computed<CuratedSlideSlot[]>(() => {
  return curatedSlots.value.filter((s) => s.included);
});

const includedSlidesCount = computed<number>(() => includedSlots.value.length);

const activeCityFilesMap = computed<Record<string, File>>(() => {
  return cityPreviewFormat.value === 'stories' ? slotStoryFiles.value : slotFeedFiles.value;
});

const activeCityPreviewUrls = computed<Record<string, string>>(() => {
  return cityPreviewFormat.value === 'stories'
    ? slotStoryPreviewUrls.value
    : slotFeedPreviewUrls.value;
});

const activeCityRenderedSlides = computed<File[]>(() => {
  const map = activeCityFilesMap.value;
  return includedSlots.value.map((s) => map[s.item.id]).filter((f): f is File => Boolean(f));
});

const activeReportFile = computed<File | null>(() => {
  return reportPreviewFormat.value === 'stories' ? reportStoryFile.value : reportFeedFile.value;
});

const activeReportPreviewUrl = computed<string>(() => {
  return reportPreviewFormat.value === 'stories'
    ? reportStoryPreviewUrl.value
    : reportFeedPreviewUrl.value;
});

const hasGeneratedCityCaption = computed<boolean>(() => Boolean(cityCaptionText.value.trim()));
const hasGeneratedReportCaption = computed<boolean>(() => Boolean(reportCaptionText.value.trim()));

const cityPublishTargetLabel = computed<string>(() => {
  if (pendingCityPublishTarget.value === 'stories') return 'Stories 9:16';
  if (pendingCityPublishTarget.value === 'both') return 'Feed 4:5 + Stories 9:16';
  return 'Feed 4:5';
});

const reportPublishTargetLabel = computed<string>(() => {
  if (pendingReportPublishTarget.value === 'stories') return 'Stories 9:16';
  if (pendingReportPublishTarget.value === 'both') return 'Feed 4:5 + Stories 9:16';
  return 'Feed 4:5';
});

function getIncludedIndex(itemId: string): number {
  return includedSlots.value.findIndex((s) => s.item.id === itemId);
}

  function getEffectiveSlotPhotoUrl(slot: CuratedSlideSlot): string {
    if (slot.selectedPhoto === 2 && slot.item.secondaryPhotoUrl) {
      return slot.item.secondaryPhotoUrl;
    }
    return slot.item.photoUrl;
  }

  function hasCustomCrop(slot: CuratedSlideSlot): boolean {
    const c = slot.crop;
    const rc = slot.resolvedCrop;
    return (
      Math.abs((c?.zoom || 1) - 1) > 0.01 ||
      Math.abs(c?.offsetX || 0) > 0.01 ||
      Math.abs(c?.offsetY || 0) > 0.01 ||
      Math.abs((rc?.zoom || 1) - 1) > 0.01 ||
      Math.abs(rc?.offsetX || 0) > 0.01 ||
      Math.abs(rc?.offsetY || 0) > 0.01
    );
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

function getActiveCityStoryHandles(): string[] {
  if (!tagProfilesOnPhotos.value) return [];
  return [prefeituraHandleInput.value, transitoHandleInput.value]
    .map((h) => h.trim())
    .filter(Boolean);
}

function parseReportStoryHandles(): string[] {
  const raw = reportStoryHandlesInput.value.trim();
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function revokeUrlRecord(record: Record<string, string>): void {
  for (const url of Object.values(record)) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}

function revokeAllSlidePreviewUrls(): void {
  revokeUrlRecord(slotFeedPreviewUrls.value);
  revokeUrlRecord(slotStoryPreviewUrls.value);
  slotFeedPreviewUrls.value = {};
  slotFeedFiles.value = {};
  slotStoryPreviewUrls.value = {};
  slotStoryFiles.value = {};
  slotStoryUserTags.value = {};
  feedSlidesDirty.value = true;
  storySlidesDirty.value = true;
}

async function renderCityFormatSlides(format: PreviewFormatMode): Promise<void> {
  const draft = activeCityDraft.value;
  if (!draft) return;

  const seq = ++slideRenderSeq;
  isRenderingSlides.value = true;

  try {
    const activeIncluded = curatedSlots.value.filter((s) => s.included);
    const total = activeIncluded.length;

    if (format === 'feed') {
      const nextFiles: Record<string, File> = {};
      const nextUrls: Record<string, string> = {};

      for (let i = 0; i < activeIncluded.length; i++) {
        if (seq !== slideRenderSeq) return;
        const slot = activeIncluded[i];
        const item = slot.item;
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
          photoUrl: getEffectiveSlotPhotoUrl(slot),
          resolvedPhotoUrl: item.resolvedPhotoUrl,
          footerUrlText: cityFooterUrlInput.value,
          crop: slot.crop,
          resolvedCrop: slot.resolvedCrop
        });
        nextFiles[item.id] = file;
        nextUrls[item.id] = URL.createObjectURL(file);
      }

      if (seq !== slideRenderSeq) {
        revokeUrlRecord(nextUrls);
        return;
      }

      revokeUrlRecord(slotFeedPreviewUrls.value);
      slotFeedFiles.value = nextFiles;
      slotFeedPreviewUrls.value = nextUrls;
      feedSlidesDirty.value = false;
    } else {
      const nextFiles: Record<string, File> = {};
      const nextUrls: Record<string, string> = {};
      const nextTags: Record<string, InstagramStoryUserTagPoint[]> = {};
      const handles = getActiveCityStoryHandles();

      for (let i = 0; i < activeIncluded.length; i++) {
        if (seq !== slideRenderSeq) return;
        const slot = activeIncluded[i];
        const item = slot.item;
        const generated = await generateInstagramStorySlideWithTags({
          slideIndex: i,
          totalSlides: total,
          cidade: draft.cidade,
          estado: draft.estado,
          rua: item.rua,
          bairro: item.bairro,
          natureza: item.natureza,
          verificacao: item.verificacao,
          isResolved: item.category === 'resolvido',
          photoUrl: getEffectiveSlotPhotoUrl(slot),
          resolvedPhotoUrl: item.resolvedPhotoUrl,
          tagHandles: handles,
          footerUrlText: cityFooterUrlInput.value,
          crop: slot.crop,
          resolvedCrop: slot.resolvedCrop
        });
        nextFiles[item.id] = generated.file;
        nextUrls[item.id] = URL.createObjectURL(generated.file);
        nextTags[item.id] = generated.userTags;
      }

      if (seq !== slideRenderSeq) {
        revokeUrlRecord(nextUrls);
        return;
      }

      revokeUrlRecord(slotStoryPreviewUrls.value);
      slotStoryFiles.value = nextFiles;
      slotStoryPreviewUrls.value = nextUrls;
      slotStoryUserTags.value = nextTags;
      storySlidesDirty.value = false;
    }
  } catch {
    // Mantém foto bruta no card caso alguma imagem falhe ao renderizar
  } finally {
    if (seq === slideRenderSeq) {
      isRenderingSlides.value = false;
    }
  }
}

  async function renderSingleCitySlot(slot: CuratedSlideSlot): Promise<void> {
    const draft = activeCityDraft.value;
    if (!draft || !slot.included) return;

    const activeIncluded = curatedSlots.value.filter((s) => s.included);
    const slideIdx = activeIncluded.findIndex((s) => s.item.id === slot.item.id);
    if (slideIdx < 0) return;

    const total = activeIncluded.length;
    const item = slot.item;

    try {
      if (cityPreviewFormat.value === 'feed') {
        storySlidesDirty.value = true;
        const file = await generateInstagramCarouselSlideFile({
          slideIndex: slideIdx,
          totalSlides: total,
          cidade: draft.cidade,
          estado: draft.estado,
          rua: item.rua,
          bairro: item.bairro,
          natureza: item.natureza,
          verificacao: item.verificacao,
          isResolved: item.category === 'resolvido',
          photoUrl: getEffectiveSlotPhotoUrl(slot),
          resolvedPhotoUrl: item.resolvedPhotoUrl,
          footerUrlText: cityFooterUrlInput.value,
          crop: slot.crop,
          resolvedCrop: slot.resolvedCrop
        });
        const oldUrl = slotFeedPreviewUrls.value[item.id];
        if (oldUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
        slotFeedFiles.value = { ...slotFeedFiles.value, [item.id]: file };
        slotFeedPreviewUrls.value = {
          ...slotFeedPreviewUrls.value,
          [item.id]: URL.createObjectURL(file)
        };
      } else {
        feedSlidesDirty.value = true;
        const generated = await generateInstagramStorySlideWithTags({
          slideIndex: slideIdx,
          totalSlides: total,
          cidade: draft.cidade,
          estado: draft.estado,
          rua: item.rua,
          bairro: item.bairro,
          natureza: item.natureza,
          verificacao: item.verificacao,
          isResolved: item.category === 'resolvido',
          photoUrl: getEffectiveSlotPhotoUrl(slot),
          resolvedPhotoUrl: item.resolvedPhotoUrl,
          tagHandles: getActiveCityStoryHandles(),
          footerUrlText: cityFooterUrlInput.value,
          crop: slot.crop,
          resolvedCrop: slot.resolvedCrop
        });
        const oldUrl = slotStoryPreviewUrls.value[item.id];
        if (oldUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
        slotStoryFiles.value = { ...slotStoryFiles.value, [item.id]: generated.file };
        slotStoryPreviewUrls.value = {
          ...slotStoryPreviewUrls.value,
          [item.id]: URL.createObjectURL(generated.file)
        };
        slotStoryUserTags.value = {
          ...slotStoryUserTags.value,
          [item.id]: generated.userTags
        };
      }
    } catch { }
  }

  async function selectSlotPhotoIndex(slotIdx: number, photoIndex: 1 | 2): Promise<void> {
    const slot = curatedSlots.value[slotIdx];
    if (!slot || slot.selectedPhoto === photoIndex) return;
    if (photoIndex === 2 && !slot.item.secondaryPhotoUrl) return;

    slot.selectedPhoto = photoIndex;
    slot.crop = createDefaultCropState();
    await renderSingleCitySlot(slot);
  }

  function redrawCropModalCanvas(): void {
    const canvas = cropCanvasRef.value;
    if (!canvas || !cropLoadedImg) return;
    const result = drawInteractiveCropFrame(canvas, cropLoadedImg, activeWorkingCrop.value, true);
    cropMaxShiftX = result.maxShiftX;
    cropMaxShiftY = result.maxShiftY;
  }

  async function loadCropModalActiveImage(): Promise<void> {
    const slot = cropModalSlot.value;
    if (!slot) return;

    let targetUrl = slot.item.photoUrl;
    if (cropModalTargetSide.value === 'resolved' && slot.item.resolvedPhotoUrl) {
      targetUrl = slot.item.resolvedPhotoUrl;
    } else if (cropModalPhotoIndex.value === 2 && slot.item.secondaryPhotoUrl) {
      targetUrl = slot.item.secondaryPhotoUrl;
    }

    isLoadingCropImage.value = true;
    try {
      cropLoadedImg = await loadImageForCanvas(targetUrl);
      await nextTick();
      redrawCropModalCanvas();
    } finally {
      isLoadingCropImage.value = false;
    }
  }

  async function openCropModal(slotIdx: number): Promise<void> {
    const slot = curatedSlots.value[slotIdx];
    if (!slot) return;

    cropModalSlotIdx.value = slotIdx;
    cropModalPhotoIndex.value = slot.selectedPhoto;
    cropModalTargetSide.value = 'main';
    cropModalWorkingMain.value = { ...slot.crop };
    cropModalWorkingResolved.value = { ...slot.resolvedCrop };

    await nextTick();
    await loadCropModalActiveImage();
  }

  function closeCropModal(): void {
    isDraggingCropCanvas.value = false;
    cropModalSlotIdx.value = -1;
    cropLoadedImg = null;
  }

  async function switchCropModalPhotoIndex(photoIndex: 1 | 2): Promise<void> {
    const slot = cropModalSlot.value;
    if (!slot || cropModalPhotoIndex.value === photoIndex) return;
    if (photoIndex === 2 && !slot.item.secondaryPhotoUrl) return;

    cropModalPhotoIndex.value = photoIndex;
    cropModalWorkingMain.value = createDefaultCropState();
    await loadCropModalActiveImage();
  }

  async function switchCropModalSide(side: 'main' | 'resolved'): Promise<void> {
    if (cropModalTargetSide.value === side) return;
    cropModalTargetSide.value = side;
    await loadCropModalActiveImage();
  }

  function resetCropModalCurrent(): void {
    if (cropModalTargetSide.value === 'resolved') {
      cropModalWorkingResolved.value = createDefaultCropState();
    } else {
      cropModalWorkingMain.value = createDefaultCropState();
    }
    redrawCropModalCanvas();
  }

  function setActiveWorkingCrop(patch: Partial<NormalizedCropState>): void {
    const current = activeWorkingCrop.value;
    const next: NormalizedCropState = {
      zoom:
        patch.zoom !== undefined
          ? Math.min(3, Math.max(1, Number(patch.zoom) || 1))
          : current.zoom,
      offsetX:
        patch.offsetX !== undefined
          ? Math.min(1, Math.max(-1, Number(patch.offsetX) || 0))
          : current.offsetX,
      offsetY:
        patch.offsetY !== undefined
          ? Math.min(1, Math.max(-1, Number(patch.offsetY) || 0))
          : current.offsetY
    };

    if (cropModalTargetSide.value === 'resolved') {
      cropModalWorkingResolved.value = next;
    } else {
      cropModalWorkingMain.value = next;
    }
    redrawCropModalCanvas();
  }

  function onCropZoomSliderInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    setActiveWorkingCrop({ zoom: val });
  }

  function onCropOffsetXSliderInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    const current = activeWorkingCrop.value;
    const nextZoom = cropMaxShiftX < 2 && Math.abs(val) > 0.02 ? Math.max(current.zoom, 1.2) : current.zoom;
    setActiveWorkingCrop({ zoom: nextZoom, offsetX: val });
  }

  function onCropOffsetYSliderInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    const current = activeWorkingCrop.value;
    const nextZoom = cropMaxShiftY < 2 && Math.abs(val) > 0.02 ? Math.max(current.zoom, 1.2) : current.zoom;
    setActiveWorkingCrop({ zoom: nextZoom, offsetY: val });
  }

  function onCropPointerDown(event: PointerEvent): void {
    const canvas = cropCanvasRef.value;
    if (!canvas || !cropLoadedImg) return;
    isDraggingCropCanvas.value = true;
    dragStartClientX = event.clientX;
    dragStartClientY = event.clientY;
    dragStartOffsetX = activeWorkingCrop.value.offsetX;
    dragStartOffsetY = activeWorkingCrop.value.offsetY;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch { }
  }

  function onCropPointerMove(event: PointerEvent): void {
    if (!isDraggingCropCanvas.value) return;
    const canvas = cropCanvasRef.value;
    if (!canvas || !cropLoadedImg) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dxScreen = event.clientX - dragStartClientX;
    const dyScreen = event.clientY - dragStartClientY;

    let currentZoom = activeWorkingCrop.value.zoom;
    if (
      (cropMaxShiftX < 2 && Math.abs(dxScreen) > 8) ||
      (cropMaxShiftY < 2 && Math.abs(dyScreen) > 8)
    ) {
      currentZoom = Math.max(currentZoom, 1.2);
      setActiveWorkingCrop({ zoom: currentZoom });
    }

    const scaleToScreenX = rect.width / (canvas.width || 1);
    const scaleToScreenY = rect.height / (canvas.height || 1);
    const maxShiftScreenX = cropMaxShiftX * scaleToScreenX;
    const maxShiftScreenY = cropMaxShiftY * scaleToScreenY;

    const nextOffsetX =
      maxShiftScreenX > 1 ? dragStartOffsetX + dxScreen / maxShiftScreenX : dragStartOffsetX;
    const nextOffsetY =
      maxShiftScreenY > 1 ? dragStartOffsetY + dyScreen / maxShiftScreenY : dragStartOffsetY;

    setActiveWorkingCrop({
      zoom: currentZoom,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY
    });
  }

  function onCropPointerUp(event: PointerEvent): void {
    if (!isDraggingCropCanvas.value) return;
    isDraggingCropCanvas.value = false;
    const canvas = cropCanvasRef.value;
    if (canvas) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch { }
    }
  }

  function onCropWheel(event: WheelEvent): void {
    if (!cropLoadedImg) return;
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    setActiveWorkingCrop({ zoom: activeWorkingCrop.value.zoom + delta });
  }

  async function applyCropModalChanges(): Promise<void> {
    const slot = cropModalSlot.value;
    if (!slot || isApplyingCrop.value) return;

    isApplyingCrop.value = true;
    try {
      slot.selectedPhoto = cropModalPhotoIndex.value;
      slot.crop = { ...cropModalWorkingMain.value };
      slot.resolvedCrop = { ...cropModalWorkingResolved.value };
      await renderSingleCitySlot(slot);
      closeCropModal();
    } finally {
      isApplyingCrop.value = false;
    }
  }

async function renderActiveCitySlides(): Promise<void> {
  feedSlidesDirty.value = true;
  storySlidesDirty.value = true;
  await renderCityFormatSlides(cityPreviewFormat.value);
}

async function switchCityPreviewFormat(nextFormat: PreviewFormatMode): Promise<void> {
  if (cityPreviewFormat.value === nextFormat) return;
  cityPreviewFormat.value = nextFormat;
  if (nextFormat === 'stories' && storySlidesDirty.value) {
    await renderCityFormatSlides('stories');
  } else if (nextFormat === 'feed' && feedSlidesDirty.value) {
    await renderCityFormatSlides('feed');
  }
}

function handleCityHandlesChanged(): void {
  storySlidesDirty.value = true;
  if (cityPreviewFormat.value === 'stories') {
    if (cityStoryDebounceTimer) clearTimeout(cityStoryDebounceTimer);
    cityStoryDebounceTimer = setTimeout(() => {
      void renderCityFormatSlides('stories');
    }, 280);
  }
}

function handleCityFooterChanged(): void {
  saveMulteiFooterPrefs({ cityFooterUrl: cityFooterUrlInput.value });
  feedSlidesDirty.value = true;
  storySlidesDirty.value = true;
  if (cityFooterDebounceTimer) clearTimeout(cityFooterDebounceTimer);
  cityFooterDebounceTimer = setTimeout(() => {
    void renderCityFormatSlides(cityPreviewFormat.value);
  }, 300);
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
  const idxInPool = pool.findIndex((p) => p.id === replacement.id);
  if (idxInPool >= 0) {
    pool.splice(idxInPool, 1);
    pool.push(target.item);
  }

  curatedSlots.value[slotIdx] = {
    item: replacement,
    included: target.included,
    selectedPhoto: 1,
    crop: createDefaultCropState(),
    resolvedCrop: createDefaultCropState()
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
  const file = activeCityFilesMap.value[itemId];
  if (file) downloadGeneratedCardFile(file);
}

function downloadAllRenderedSlides(): void {
  activeCityRenderedSlides.value.forEach((file, idx) => {
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

    let changed = false;
    if (res.prefeitura) {
      discoveredPrefeituraInfo.value = res.prefeitura;
      if (res.prefeitura.username && !useManualInputs) {
        prefeituraHandleInput.value = res.prefeitura.username;
        changed = true;
      }
    }
    if (res.transito?.username && !useManualInputs && !transitoHandleInput.value) {
      transitoHandleInput.value = res.transito.username;
      changed = true;
    }
    if (changed) {
      handleCityHandlesChanged();
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
    handleCityHandlesChanged();
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
  if (!draft || isRenderingSlides.value || activeCityRenderedSlides.value.length === 0) return;

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
        ctaUrl: cityFooterUrlInput.value,
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
  closeCropModal();

  const draft = activeCityDraft.value;
  if (!draft) return;

  curatedSlots.value = draft.selectedItems.map((item) => ({
    item,
    included: true,
    selectedPhoto: 1,
    crop: createDefaultCropState(),
    resolvedCrop: createDefaultCropState()
  }));

  prefeituraHandleInput.value = draft.citySocial?.instagramPrefeitura || '';
  transitoHandleInput.value = draft.citySocial?.instagramTransito || '';

  const cacheKey = `${draft.dateKey}_${draft.cityKey}`;
  cityCaptionText.value = captionCacheByCity.get(cacheKey) || '';

  if (draft.selectedItems.length > 0) {
    revokeAllSlidePreviewUrls();
    void renderCityFormatSlides(cityPreviewFormat.value);
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

function promptCityPublish(target: PublishTargetMode): void {
  pendingCityPublishTarget.value = target;
  confirmingCityPublish.value = true;
}

async function executeCityPublish(): Promise<void> {
  const draft = activeCityDraft.value;
  const target = pendingCityPublishTarget.value;
  if (!draft || includedSlidesCount.value < 1 || isPublishing.value) return;
  if ((target === 'feed' || target === 'both') && !cityCaptionText.value.trim()) return;

  isPublishing.value = true;
  publishStepLabel.value = 'Preparando imagens...';
  feedbackBanner.value = null;
  const uploadedStagingPaths: string[] = [];

  try {
    // 1. Salva o @ da prefeitura na coleção para próximas publicações (se informado)
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

    const publishedIds = includedSlots.value.map((s) => s.item.id);
    let lastPermalink = 'https://www.instagram.com/pcdvale/';

    // 2. Publicação no FEED (4:5 — 1080x1350)
    if (target === 'feed' || target === 'both') {
      if (feedSlidesDirty.value) {
        await renderCityFormatSlides('feed');
      }
      const feedFiles = includedSlots.value
        .map((s) => slotFeedFiles.value[s.item.id])
        .filter((f): f is File => Boolean(f));
      if (feedFiles.length < 1) {
        throw new Error('Nenhuma arte 4:5 pronta para publicação no Feed.');
      }

      publishStepLabel.value = `Enviando ${feedFiles.length} slide(s) do Feed...`;
      const feedStaging = await uploadTemporaryInstagramStagingSlides(
        feedFiles,
        `feed_${draft.estado}_${draft.cidade}`
      );
      uploadedStagingPaths.push(...feedStaging.storagePaths);

      publishStepLabel.value = 'Publicando no Feed (@pcdvale)...';
      const feedUserTags: Array<{ username: string; x: number; y: number }> = [];
      if (tagProfilesOnPhotos.value) {
        if (prefeituraHandleInput.value.trim()) {
          feedUserTags.push({ username: prefeituraHandleInput.value.trim(), x: 0.35, y: 0.88 });
        }
        if (transitoHandleInput.value.trim()) {
          feedUserTags.push({ username: transitoHandleInput.value.trim(), x: 0.65, y: 0.88 });
        }
      }

      const feedRes = await callAdminInstagramApi<{
        ok: boolean;
        mediaId: string;
        permalink: string;
        tagsApplied: boolean;
      }>('/api/multei/instagram/publish', {
        placement: 'feed',
        imageUrls: feedStaging.downloadUrls,
        caption: cityCaptionText.value,
        userTags: feedUserTags
      });

      lastPermalink = feedRes.permalink || lastPermalink;

      await saveMulteiInstagramPublishedPost({
        dateKey: draft.dateKey,
        mode: 'city_daily',
        cidade: draft.cidade,
        estado: draft.estado,
        itemIds: publishedIds,
        instagramMediaId: feedRes.mediaId,
        permalink: feedRes.permalink,
        caption: cityCaptionText.value,
        publishedBy: props.adminEmail
      });
    }

    // 3. Publicação nos STORIES (9:16 — 1080x1920)
    if (target === 'stories' || target === 'both') {
      if (storySlidesDirty.value) {
        await renderCityFormatSlides('stories');
      }
      const storyFiles = includedSlots.value
        .map((s) => slotStoryFiles.value[s.item.id])
        .filter((f): f is File => Boolean(f));
      if (storyFiles.length < 1) {
        throw new Error('Nenhuma arte 9:16 pronta para publicação nos Stories.');
      }

      const perSlideUserTags = includedSlots.value.map(
        (s) => slotStoryUserTags.value[s.item.id] || []
      );

      publishStepLabel.value = `Enviando ${storyFiles.length} Story(ies)...`;
      const storyStaging = await uploadTemporaryInstagramStagingSlides(
        storyFiles,
        `story_${draft.estado}_${draft.cidade}`
      );
      uploadedStagingPaths.push(...storyStaging.storagePaths);

      publishStepLabel.value = 'Publicando nos Stories (@pcdvale)...';
      const storyRes = await callAdminInstagramApi<{
        ok: boolean;
        mediaId: string;
        mediaIds?: string[];
        permalink: string;
        tagsApplied: boolean;
      }>('/api/multei/instagram/publish', {
        placement: 'stories',
        imageUrls: storyStaging.downloadUrls,
        caption: '',
        perSlideUserTags
      });

      if (target === 'stories' && storyRes.permalink) {
        lastPermalink = storyRes.permalink;
      }

      await saveMulteiInstagramPublishedPost({
        dateKey: draft.dateKey,
        mode: 'city_story',
        cidade: draft.cidade,
        estado: draft.estado,
        itemIds: publishedIds,
        instagramMediaId: storyRes.mediaId,
        permalink: storyRes.permalink,
        caption: '',
        publishedBy: props.adminEmail
      });
    }

    confirmingCityPublish.value = false;
    feedbackBanner.value = {
      type: 'success',
      title: `Publicado com sucesso: ${draft.cidade} - ${draft.estado}!`,
      message:
        target === 'both'
          ? `Publicado no Feed e nos Stories (${publishedIds.length} slide(s)) na conta oficial @pcdvale.`
          : target === 'stories'
            ? `${publishedIds.length} Story(ies) publicado(s) na conta oficial @pcdvale.`
            : `${publishedIds.length} ${publishedIds.length === 1 ? 'imagem publicada' : 'slides publicados em carrossel'} no Feed de @pcdvale.`,
      permalink: lastPermalink
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
  } else if (preset === 'last7') {
    reportStartDate.value = computeDateKeyDaysAgo(6);
    reportEndDate.value = today;
  } else if (preset === 'last30') {
    reportStartDate.value = computeDateKeyDaysAgo(29);
    reportEndDate.value = today;
  } else if (preset === 'thisMonth') {
    reportStartDate.value = `${today.slice(0, 7)}-01`;
    reportEndDate.value = today;
  } else if (preset === 'all') {
    reportStartDate.value = '';
    reportEndDate.value = '';
  }

  if (!reportTitleText.value.trim()) {
    reportTitleText.value = 'Cidades mais acessíveis acontecem aqui';
  }

  await refreshGeneralReportData();
}

async function handleCustomReportDatesChange(): Promise<void> {
  activeReportPreset.value = 'custom';
  await refreshGeneralReportData();
}

async function renderGeneralReportCardNow(): Promise<void> {
  isRenderingReportCard.value = true;
  try {
    const baseOpts = {
      title: reportTitleText.value || 'Cidades mais acessíveis acontecem aqui',
      totalGeral: reportStats.value.totalGeral,
      cidadesCount: reportStats.value.cidadesCount,
      infracoesTransito: reportStats.value.infracoesTransito,
      mobilidadeUrbana: reportStats.value.mobilidadeUrbana,
      resolvidos: reportStats.value.resolvidos,
      footerMessageText: reportFooterMessageInput.value,
      footerUrlText: reportFooterUrlInput.value
    };

    const [feedFile, storyBuilt] = await Promise.all([
      generateInstagramGeneralReportFile(baseOpts),
      generateInstagramGeneralReportStoryWithTags({
        ...baseOpts,
        tagHandles: parseReportStoryHandles()
      })
    ]);

    if (reportFeedPreviewUrl.value && reportFeedPreviewUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(reportFeedPreviewUrl.value);
    }
    if (reportStoryPreviewUrl.value && reportStoryPreviewUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(reportStoryPreviewUrl.value);
    }

    reportFeedFile.value = feedFile;
    reportFeedPreviewUrl.value = URL.createObjectURL(feedFile);

    reportStoryFile.value = storyBuilt.file;
    reportStoryPreviewUrl.value = URL.createObjectURL(storyBuilt.file);
    reportStoryUserTags.value = storyBuilt.userTags;
  } catch {
    reportFeedFile.value = null;
    reportStoryFile.value = null;
  } finally {
    isRenderingReportCard.value = false;
  }
}

function scheduleRenderGeneralReportCard(): void {
  isRenderingReportCard.value = true;
  if (reportRenderDebounceTimer) clearTimeout(reportRenderDebounceTimer);
  reportRenderDebounceTimer = setTimeout(() => {
    void renderGeneralReportCardNow();
  }, 250);
}

function handleReportFooterChanged(): void {
  saveMulteiFooterPrefs({
    reportFooterMessage: reportFooterMessageInput.value,
    reportFooterUrl: reportFooterUrlInput.value
  });
  scheduleRenderGeneralReportCard();
}

function switchReportPreviewFormat(nextFormat: PreviewFormatMode): void {
  reportPreviewFormat.value = nextFormat;
}

async function generateReportCaption(): Promise<void> {
  if (!activeReportFile.value || isRenderingReportCard.value || isLoadingReport.value) return;
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
        periodTitle: reportTitleText.value || 'Cidades mais acessíveis acontecem aqui',
        periodLabel,
        totalGeral: reportStats.value.totalGeral,
        cidadesCount: reportStats.value.cidadesCount,
        infracoesTransito: reportStats.value.infracoesTransito,
        mobilidadeUrbana: reportStats.value.mobilidadeUrbana,
        resolvidos: reportStats.value.resolvidos,
        topCities: reportStats.value.topCities,
        ctaUrl: reportFooterUrlInput.value,
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
  reportFeedFile.value = null;
  reportStoryFile.value = null;
  reportCaptionText.value = '';
  try {
    reportStats.value = await fetchInstagramGeneralReportForPeriod(
      reportStartDate.value,
      reportEndDate.value
    );
    await renderGeneralReportCardNow();
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
  if (activeReportFile.value) {
    downloadGeneratedCardFile(activeReportFile.value);
  }
}

function promptReportPublish(target: PublishTargetMode): void {
  pendingReportPublishTarget.value = target;
  confirmingReportPublish.value = true;
}

async function executeReportPublish(): Promise<void> {
  const target = pendingReportPublishTarget.value;
  if (isPublishing.value) return;
  if ((target === 'feed' || target === 'both') && !reportCaptionText.value.trim()) return;

  isPublishing.value = true;
  publishStepLabel.value = 'Preparando arte do relatório...';
  feedbackBanner.value = null;
  const stagingPaths: string[] = [];

  try {
    await renderGeneralReportCardNow();
    let lastPermalink = 'https://www.instagram.com/pcdvale/';

    if (target === 'feed' || target === 'both') {
      if (!reportFeedFile.value) {
        throw new Error('Arte 4:5 do relatório indisponível.');
      }

      publishStepLabel.value = 'Enviando arte do Feed...';
      const feedStaging = await uploadTemporaryInstagramStagingSlides(
        [reportFeedFile.value],
        'relatorio_feed'
      );
      stagingPaths.push(...feedStaging.storagePaths);

      publishStepLabel.value = 'Publicando relatório no Feed...';
      const feedRes = await callAdminInstagramApi<{
        ok: boolean;
        mediaId: string;
        permalink: string;
      }>('/api/multei/instagram/publish', {
        placement: 'feed',
        imageUrls: feedStaging.downloadUrls,
        caption: reportCaptionText.value,
        userTags: []
      });

      lastPermalink = feedRes.permalink || lastPermalink;

      await saveMulteiInstagramPublishedPost({
        dateKey: getBrazilDateKey(),
        mode: 'general_report',
        itemIds: [],
        instagramMediaId: feedRes.mediaId,
        permalink: feedRes.permalink,
        caption: reportCaptionText.value,
        publishedBy: props.adminEmail
      });
    }

    if (target === 'stories' || target === 'both') {
      if (!reportStoryFile.value) {
        throw new Error('Arte 9:16 do Story do relatório indisponível.');
      }

      publishStepLabel.value = 'Enviando Story do relatório...';
      const storyStaging = await uploadTemporaryInstagramStagingSlides(
        [reportStoryFile.value],
        'relatorio_story'
      );
      stagingPaths.push(...storyStaging.storagePaths);

      publishStepLabel.value = 'Publicando relatório nos Stories...';
      const storyRes = await callAdminInstagramApi<{
        ok: boolean;
        mediaId: string;
        permalink: string;
      }>('/api/multei/instagram/publish', {
        placement: 'stories',
        imageUrls: storyStaging.downloadUrls,
        caption: '',
        userTags: reportStoryUserTags.value
      });

      if (target === 'stories' && storyRes.permalink) {
        lastPermalink = storyRes.permalink;
      }

      await saveMulteiInstagramPublishedPost({
        dateKey: getBrazilDateKey(),
        mode: 'general_report_story',
        itemIds: [],
        instagramMediaId: storyRes.mediaId,
        permalink: storyRes.permalink,
        caption: '',
        publishedBy: props.adminEmail
      });
    }

    confirmingReportPublish.value = false;
    feedbackBanner.value = {
      type: 'success',
      title: 'Relatório Geral publicado com sucesso!',
      message:
        target === 'both'
          ? 'A arte institucional já está disponível no Feed e nos Stories de @pcdvale.'
          : target === 'stories'
            ? 'O Story institucional já está disponível em @pcdvale.'
            : 'A arte institucional já está disponível no Feed de @pcdvale.',
      permalink: lastPermalink
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
  if (nextMode === 'general_report' && !reportFeedPreviewUrl.value) {
    await applyReportPreset('last7');
  }
}

onMounted(() => {
  const savedFooterPrefs = readSavedMulteiFooterPrefs();
  cityFooterUrlInput.value = savedFooterPrefs.cityFooterUrl;
  reportFooterMessageInput.value = savedFooterPrefs.reportFooterMessage;
  reportFooterUrlInput.value = savedFooterPrefs.reportFooterUrl;

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
  if (reportFeedPreviewUrl.value && reportFeedPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(reportFeedPreviewUrl.value);
  }
  if (reportStoryPreviewUrl.value && reportStoryPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(reportStoryPreviewUrl.value);
  }
  if (cityStoryDebounceTimer) clearTimeout(cityStoryDebounceTimer);
  if (cityFooterDebounceTimer) clearTimeout(cityFooterDebounceTimer);
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

.ig-city-footer-field {
  max-width: 440px;
  margin-bottom: 1rem;
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

.ig-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.ig-format-toggle {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.22rem;
  background: var(--pp-surface-alt);
  border: 1px solid var(--pp-border);
  border-radius: 10px;
}

.ig-format-btn {
  padding: 0.42rem 0.72rem;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pp-text-secondary);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ig-format-btn.is-active {
  background: #86007d;
  color: #ffffff;
  border-color: #86007d;
}

.ig-slide-preview-wrap {
  position: relative;
  aspect-ratio: 4 / 5;
  background: #0f172a;
  overflow: hidden;
  transition: aspect-ratio 0.18s ease;
}

.ig-slide-preview-wrap.is-story-ratio {
  aspect-ratio: 9 / 16;
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
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.65rem;
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

.ig-btn-primary,
.ig-btn-story,
.ig-btn-both {
  padding: 0.72rem 1.25rem;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.16s ease;
}

.ig-btn-primary {
  border: none;
  background: #86007d;
  color: #ffffff;
}

.ig-btn-primary:hover:not(:disabled) {
  background: #6e0066;
}

.ig-btn-story {
  border: 1.5px solid #86007d;
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
}

.ig-btn-story:hover:not(:disabled) {
  background: rgba(134, 0, 125, 0.1);
}

.ig-btn-both {
  border: none;
  background: linear-gradient(135deg, #86007d 0%, #4c1d95 100%);
  color: #ffffff;
}

.ig-btn-both:hover:not(:disabled) {
  filter: brightness(1.08);
}

.ig-btn-primary:disabled,
.ig-btn-story:disabled,
.ig-btn-both:disabled,
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

.ig-slide-meta-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.ig-photo-choice-bar {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.16rem;
  border-radius: 8px;
  background: var(--pp-surface-alt);
  border: 1px solid var(--pp-border);
}

.ig-photo-choice-btn {
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--pp-text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.14s ease;
}

.ig-photo-choice-btn.is-active {
  background: #86007d;
  color: #ffffff;
}

.ig-crop-trigger-btn.is-cropped {
  border-color: #86007d;
  color: #86007d;
  background: rgba(134, 0, 125, 0.08);
}

/* Modal Interativo de Enquadramento / Recorte */
.ig-crop-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2200;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.ig-crop-modal-card {
  width: 100%;
  max-width: 560px;
  max-height: 92vh;
  overflow-y: auto;
  background: var(--pp-surface);
  border: 1px solid var(--pp-border);
  border-radius: 16px;
  padding: 1.15rem 1.25rem;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.ig-crop-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.ig-crop-modal-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--pp-text-primary);
}

.ig-crop-modal-subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
  color: var(--pp-text-secondary);
  line-height: 1.38;
}

.ig-crop-close-btn {
  background: var(--pp-surface-alt);
  border: 1px solid var(--pp-border);
  color: var(--pp-text-primary);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.ig-crop-source-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  background: var(--pp-surface-alt);
  border: 1px solid var(--pp-border);
}

.ig-crop-source-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--pp-text-primary);
}

.ig-crop-stage-wrapper {
  display: flex;
  justify-content: center;
  background: #0b0f19;
  border-radius: 12px;
  padding: 0.75rem;
  border: 1px solid var(--pp-border);
}

.ig-crop-canvas-shell {
  position: relative;
  width: 100%;
  max-width: 400px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #86007d;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.ig-crop-canvas-shell.is-half-frame {
  max-width: 250px;
}

.ig-crop-canvas-shell.is-dragging {
  cursor: grabbing;
}

.ig-crop-canvas {
  width: 100%;
  height: auto;
  display: block;
}

.ig-crop-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.76);
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 600;
}

.ig-crop-drag-hint {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.82);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  pointer-events: none;
  white-space: nowrap;
}

.ig-crop-sliders-grid {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.ig-crop-slider-row {
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
}

.ig-crop-slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--pp-text-primary);
}

.ig-crop-range {
  width: 100%;
  accent-color: #86007d;
  cursor: pointer;
}

.ig-crop-modal-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--pp-border);
}

.ig-crop-footer-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
