<template>
  <div v-if="active" class="partner-denuncias-section" :class="{ 'is-mobile': isMobile }">
    <!-- ABA: OCORRÊNCIAS DA CIDADE (Parcerias: cidade cadastrada + Ao meu redor 5 km; Admin: todas) -->
    <header class="panel-header">
      <div>
        <span class="panel-kicker">
          <template v-if="isAdminRole">Visão administrativa • Todas as cidades</template>
          <template v-else-if="userProfile?.cidade">Parceria municipal • {{ partnerCityLabel }}</template>
          <template v-else>Acompanhamento municipal de acessibilidade</template>
        </span>
        <h2 id="admin-heading" class="panel-main-title">
          <template v-if="isAdminRole">Ocorrências</template>
          <template v-else>Ocorrências da cidade</template>
          <template v-if="!isAdminRole && userProfile?.cidade"> • {{ userProfile.cidade }}</template>
        </h2>
        <p class="panel-main-subtitle">
          <template v-if="partnerNearMeCenter">
            Exibindo ocorrências num raio de <strong>5 km da sua localização</strong>
            <span v-if="!isAdminRole && userProfile?.cidade"> em <strong>{{ userProfile.cidade }}</strong></span>.
          </template>
          <template v-else-if="!isAdminRole && userProfile?.cidade">
            Ocorrências registradas pela população em <strong>{{ partnerCityLabel }}</strong>. Use os pontos críticos para orientar a fiscalização e informe à população as correções de mobilidade urbana.
          </template>
          <template v-else>
            Filtre as ocorrências por estado, cidade, bairro, tipo e período, ou use "Ao meu redor" para ver as ocorrências num raio de 5 km.
          </template>
        </p>
      </div>

      <div class="users-header-actions partner-header-actions">
        <div class="scope-toggle" role="group" aria-label="Área das ocorrências">
          <button
            type="button"
            class="scope-btn"
            :class="{ 'is-active': !partnerNearMeCenter }"
            :aria-pressed="!partnerNearMeCenter"
            :disabled="isLocatingPartnerGps || isLoadingPartnerIncidents"
            @click="clearPartnerAroundMe"
          >
            <span aria-hidden="true">🏙️</span>
            <span v-if="isAdminRole">Todas</span>
            <span v-else>Cidade</span>
          </button>
          <button
            type="button"
            class="scope-btn"
            :class="{ 'is-active': Boolean(partnerNearMeCenter) }"
            :aria-pressed="Boolean(partnerNearMeCenter)"
            :disabled="isLocatingPartnerGps || isLoadingPartnerIncidents"
            @click="handlePartnerAroundMe"
          >
            <span aria-hidden="true">📍</span>
            <span v-if="isLocatingPartnerGps">Obtendo localização...</span>
            <span v-else>Ao meu redor (5 km)</span>
          </button>
        </div>

        <div class="refresh-group">
          <button
            type="button"
            class="btn-refresh-list"
            :disabled="isLoadingPartnerIncidents"
            @click="loadPartnerDenuncias"
          >
            <span aria-hidden="true">🔄</span>
            <span v-if="isLoadingPartnerIncidents">Atualizando...</span>
            <span v-else>Atualizar</span>
          </button>
          <span v-if="lastUpdatedLabel" class="last-updated">{{ lastUpdatedLabel }}</span>
        </div>
      </div>
    </header>

    <p v-if="partnerGpsError" class="login-error-alert partner-gps-alert" role="alert">
      {{ partnerGpsError }}
    </p>
    <p v-if="partnerLoadError" class="login-error-alert partner-gps-alert" role="alert">
      {{ partnerLoadError }}
    </p>

    <!-- P10: Resumo da cidade -->
    <PartnerCitySummary
      :incidents="summaryIncidents"
      :title="summaryTitle"
      :period-label="denunciaFilterPeriodo ? periodLabel : ''"
    />

    <!-- Filtros -->
    <section class="occurrences-filter-bar" aria-labelledby="partner-filters-heading">
      <h3 id="partner-filters-heading" class="sr-only">Filtros das ocorrências</h3>
      <div class="partner-filter-grid">
        <!-- Estado (UF) - Exclusivo Admin -->
        <div v-if="isAdminRole" class="form-field filter-field">
          <label for="filter-denuncia-estado" class="field-label">Estado (UF)</label>
          <select
            id="filter-denuncia-estado"
            v-model="denunciaFilterEstado"
            class="field-input filter-select"
            @change="handleDenunciaEstadoFilterChange"
          >
            <option value="">Todos os estados</option>
            <option v-for="uf in BRAZIL_STATES" :key="uf" :value="uf">
              {{ uf }}
            </option>
          </select>
        </div>

        <!-- Cidade (busca IBGE) - Exclusivo Admin -->
        <div v-if="isAdminRole" class="form-field filter-field">
          <label for="filter-denuncia-cidade" class="field-label">
            Cidade <template v-if="denunciaFilterEstado">({{ denunciaFilterEstado }})</template>
          </label>
          <MulteiCitySearchField
            v-model="denunciaFilterCidade"
            :uf="denunciaFilterEstado"
            input-id="filter-denuncia-cidade"
            :allow-clear="true"
          />
        </div>

        <!-- Bairro (sem diferenciar acentos e maiúsculas) -->
        <div class="form-field filter-field">
          <label for="filter-denuncia-bairro" class="field-label">Bairro</label>
          <div class="bairro-search-wrap">
            <input
              id="filter-denuncia-bairro"
              v-model="denunciaFilterBairro"
              type="text"
              list="denuncia-bairros-datalist"
              placeholder="Todos os bairros"
              autocomplete="off"
              class="field-input filter-input-with-clear"
            />
            <button
              v-if="denunciaFilterBairro"
              type="button"
              class="btn-inline-clear"
              aria-label="Limpar filtro de bairro"
              @click="denunciaFilterBairro = ''"
            >
              <span aria-hidden="true">✕</span>
            </button>
            <datalist id="denuncia-bairros-datalist">
              <option v-for="b in availableDenunciaBairros" :key="b" :value="b" />
            </datalist>
          </div>
        </div>

        <!-- Tipo de ocorrência -->
        <div class="form-field filter-field">
          <label for="filter-denuncia-natureza" class="field-label">Tipo de ocorrência</label>
          <select
            id="filter-denuncia-natureza"
            v-model="denunciaFilterNatureza"
            class="field-input filter-select"
          >
            <option value="">Todos os tipos</option>
            <option value="transito">Infração de trânsito</option>
            <option value="urbana">Mobilidade urbana</option>
          </select>
        </div>

        <!-- Período -->
        <div class="form-field filter-field">
          <label for="filter-denuncia-periodo" class="field-label">Período</label>
          <select
            id="filter-denuncia-periodo"
            v-model="denunciaFilterPeriodo"
            class="field-input filter-select"
          >
            <option v-for="opt in PERIOD_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Ordenação -->
        <div class="form-field filter-field">
          <label for="filter-denuncia-ordem" class="field-label">Ordenar por</label>
          <select
            id="filter-denuncia-ordem"
            v-model="denunciaSortBy"
            class="field-input filter-select"
          >
            <option value="recentes">Mais recentes</option>
            <option value="antigas">Mais antigas</option>
            <option v-if="partnerNearMeCenter" value="proximas">Mais próximas</option>
            <option v-if="hasReportCounts" value="reportadas">Mais reportadas</option>
          </select>
        </div>
      </div>

      <div class="filter-bar-footer">
        <span id="partner-filter-summary" class="filter-active-summary">
          Exibindo <strong>{{ baseFilteredPartnerIncidents.length }}</strong> de
          <strong>{{ partnerScopedIncidents.length }}</strong>
          {{ partnerScopedIncidents.length === 1 ? 'ocorrência' : 'ocorrências' }}
        </span>

        <span v-if="criticalPointFilter" class="cp-filter-chip">
          <span>
            <template v-if="criticalPointFilter.groupBy === 'rua'">Rua:</template>
            <template v-else>Bairro:</template>
            <strong>{{ criticalPointFilter.label }}</strong>
          </span>
          <button
            type="button"
            class="cp-filter-chip-remove"
            :aria-label="`Remover filtro do ponto crítico ${criticalPointFilter.label}`"
            @click="clearCriticalPointFilter"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </span>

        <div class="filter-footer-actions">
          <button
            type="button"
            class="btn-clear-all-filters"
            :disabled="baseFilteredPartnerIncidents.length === 0"
            aria-describedby="partner-filter-summary"
            @click="exportOccurrencesCsv"
          >
            <span aria-hidden="true">⬇️</span> Exportar CSV
          </button>
          <button
            v-if="hasActiveDenunciaFilters"
            type="button"
            class="btn-clear-all-filters"
            @click="clearDenunciaFilters"
          >
            <span aria-hidden="true">✕</span> Limpar filtros
          </button>
        </div>
        <span class="sr-only" role="status">{{ exportFeedback }}</span>
      </div>
    </section>

    <!-- Modo de visualização: Lista | Mapa | Pontos críticos -->
    <div class="view-toggle" role="group" aria-label="Modo de visualização">
      <button
        type="button"
        class="scope-btn"
        :class="{ 'is-active': viewMode === 'lista' }"
        :aria-pressed="viewMode === 'lista'"
        @click="setViewMode('lista')"
      >
        <span aria-hidden="true">📋</span> Lista
      </button>
      <button
        type="button"
        class="scope-btn"
        :class="{ 'is-active': viewMode === 'mapa' }"
        :aria-pressed="viewMode === 'mapa'"
        @click="setViewMode('mapa')"
      >
        <span aria-hidden="true">🗺️</span> Mapa
      </button>
      <button
        type="button"
        class="scope-btn"
        :class="{ 'is-active': viewMode === 'pontos' }"
        :aria-pressed="viewMode === 'pontos'"
        @click="setViewMode('pontos')"
      >
        <span aria-hidden="true">📊</span> Pontos críticos
      </button>
    </div>

    <!-- P2: Pontos críticos -->
    <PartnerCriticalPoints
      v-if="viewMode === 'pontos'"
      :incidents="locationFilteredIncidents"
      :initial-natureza="denunciaFilterNatureza"
      :file-label="csvCitySlug"
      @select-point="handleCriticalPointSelect"
      @exported="announceSr(`Arquivo CSV do ranking com ${$event} pontos gerado.`)"
    />

    <div
      v-else
      class="master-detail-grid"
      :class="{ 'is-map-mode': viewMode === 'mapa', 'is-mobile-detail': isMobile && mobileDetailOpen }"
    >
      <!-- COLUNA ESQUERDA: Lista / Mapa -->
      <section
        v-show="!isMobile || !mobileDetailOpen"
        class="master-column"
        aria-labelledby="partner-list-heading"
      >
        <h3 id="partner-list-heading" ref="listHeadingRef" class="sr-only" tabindex="-1">
          <template v-if="viewMode === 'mapa'">Mapa das ocorrências</template>
          <template v-else>Lista de ocorrências</template>
        </h3>

        <div class="filter-tabs" role="tablist" aria-label="Situação das ocorrências">
          <button
            id="partner-tab-pendentes"
            ref="tabPendentesRef"
            type="button"
            role="tab"
            :aria-selected="partnerFilterTab === 'pendentes'"
            aria-controls="partner-tabpanel"
            :tabindex="partnerFilterTab === 'pendentes' ? 0 : -1"
            class="filter-tab-btn"
            :class="{ 'is-active': partnerFilterTab === 'pendentes' }"
            @click="selectPartnerTab('pendentes')"
            @keydown="handleTabKeydown"
          >
            <span>Em aberto</span>
            <span class="tab-counter">{{ pendingPartnerIncidents.length }}</span>
          </button>

          <button
            id="partner-tab-resolvidas"
            ref="tabResolvidasRef"
            type="button"
            role="tab"
            :aria-selected="partnerFilterTab === 'resolvidas'"
            aria-controls="partner-tabpanel"
            :tabindex="partnerFilterTab === 'resolvidas' ? 0 : -1"
            class="filter-tab-btn"
            :class="{ 'is-active': partnerFilterTab === 'resolvidas' }"
            @click="selectPartnerTab('resolvidas')"
            @keydown="handleTabKeydown"
          >
            <span>Corrigidas</span>
            <span class="tab-counter">{{ resolvedPartnerIncidents.length }}</span>
          </button>
        </div>

        <div
          id="partner-tabpanel"
          role="tabpanel"
          :aria-labelledby="partnerFilterTab === 'pendentes' ? 'partner-tab-pendentes' : 'partner-tab-resolvidas'"
          class="partner-tabpanel"
        >
          <div v-if="isLoadingPartnerIncidents" class="list-empty-state" role="status">
            <div class="spinner-circle" aria-hidden="true"></div>
            <p>Carregando ocorrências de {{ userProfile?.cidade || 'sua região' }}...</p>
          </div>

          <div v-else-if="filteredPartnerIncidents.length === 0" class="list-empty-state">
            <span class="empty-icon" aria-hidden="true">
              {{ hasActiveDenunciaFilters ? '🔎' : partnerFilterTab === 'pendentes' ? '✨' : '✅' }}
            </span>
            <p class="empty-title">
              <template v-if="hasActiveDenunciaFilters">Nenhuma ocorrência encontrada para os filtros escolhidos</template>
              <template v-else-if="partnerNearMeCenter">Nenhuma ocorrência num raio de 5 km</template>
              <template v-else-if="partnerFilterTab === 'pendentes'">Nenhuma ocorrência em aberto</template>
              <template v-else>Nenhuma ocorrência corrigida ainda</template>
            </p>
            <p class="empty-desc">
              <template v-if="hasActiveDenunciaFilters">Altere ou limpe os filtros acima para ver outras ocorrências.</template>
              <template v-else-if="partnerNearMeCenter">Não há ocorrências nesta situação a até 5 km da sua localização atual.</template>
              <template v-else>As ocorrências registradas aparecerão aqui.</template>
            </p>
          </div>

          <!-- P10: Mapa com as ocorrências filtradas -->
          <div v-else-if="viewMode === 'mapa'" class="partner-map-wrap">
            <p class="partner-map-hint">
              O pino da ocorrência selecionada fica destacado. Toque em um pino para ver os detalhes. Para navegar pelo teclado, use o modo Lista.
            </p>
            <MulteiMapDisplay
              :incidents="filteredPartnerIncidents"
              :initial-center="mapInitialCenter"
              :initial-zoom="13"
              :show-user-location-dot="false"
              :highlight-incident-id="selectedPartnerIncident?.id || ''"
              height="520px"
              @marker-click="handleMapMarkerClick"
            />
          </div>

          <template v-else>
            <ul ref="listRef" class="report-list">
              <li
                v-for="inc in pagedPartnerIncidents"
                :key="inc.id"
                class="report-list-item"
              >
                <button
                  type="button"
                  class="report-item-btn"
                  :class="{ 'is-selected': selectedPartnerIncident?.id === inc.id }"
                  :aria-current="selectedPartnerIncident?.id === inc.id ? 'true' : undefined"
                  :data-incident-id="inc.id"
                  @click="handleListItemClick(inc)"
                >
                  <span class="report-item-top">
                    <span class="natureza-pill" :class="categoryPillClass(inc)">
                      <span aria-hidden="true">{{ categoryIcon(inc) }}</span>
                      {{ categoryLabel(inc) }}
                    </span>

                    <span v-if="inc.em_revisao_denuncia" class="status-badge status-review">
                      <span aria-hidden="true">🚩</span> Em revisão de denúncia
                    </span>

                    <span v-if="partnerNearMeCenter" class="distance-badge">
                      <span aria-hidden="true">📍</span> {{ formatDistanceFromPartner(inc) }}
                    </span>

                    <span
                      v-if="isAdminRole && inc.possivel_duplicidade"
                      class="duplicity-panel-badge"
                    >
                      <span aria-hidden="true">⚠️</span> Possível duplicidade
                    </span>
                  </span>

                  <span class="report-item-location">
                    {{ formatIncidentLocation(inc) }}
                  </span>

                  <span class="report-item-reason">
                    {{ inc.descricao || inc.description || 'Ocorrência registrada no mapa' }}
                  </span>

                  <span class="report-item-footer">
                    <span class="report-item-date">
                      {{ formatIncidentDateTime(inc.timestamp) }}
                    </span>

                    <span v-if="isResolved(inc)" class="verdict-mini-badge verdict-improcedente">
                      <template v-if="inc.data_resolucao">Corrigida em {{ formatDateOnly(inc.data_resolucao) }}</template>
                      <template v-else>Corrigida</template>
                    </span>
                    <span v-else class="verdict-mini-badge verdict-pendente">
                      {{ openForLabel(inc) }}
                    </span>
                  </span>
                </button>
              </li>
            </ul>

            <div v-if="remainingCount > 0" class="load-more-wrap">
              <button type="button" class="btn-refresh-list btn-load-more" @click="loadMore">
                Carregar mais ({{ remainingCount }} restantes)
              </button>
            </div>
            <p class="sr-only" role="status">{{ paginationStatus }}</p>
          </template>
        </div>
      </section>

      <!-- COLUNA DIREITA: Detalhes da ocorrência -->
      <section
        v-show="!isMobile || mobileDetailOpen"
        class="detail-column"
        aria-labelledby="partner-detail-heading"
      >
        <div v-if="!selectedPartnerIncident" class="detail-empty-state">
          <span class="empty-icon" aria-hidden="true">👈</span>
          <h3 id="partner-detail-heading" class="empty-title">Selecione uma ocorrência</h3>
          <p class="empty-desc">
            Escolha uma ocorrência da lista para ver a localização e as fotos e, nos casos de mobilidade urbana, informar a correção à população.
          </p>
        </div>

        <div v-else class="detail-card">
          <button
            v-if="isMobile"
            type="button"
            class="btn-back-list"
            @click="backToList"
          >
            <span aria-hidden="true">←</span> Voltar à lista
          </button>

          <h3 id="partner-detail-heading" ref="detailHeadingRef" class="detail-title" tabindex="-1">
            {{ formatIncidentLocation(selectedPartnerIncident) }}
          </h3>

          <div class="detail-header">
            <div class="detail-header-badges">
              <span class="natureza-pill" :class="categoryPillClass(selectedPartnerIncident)">
                <span aria-hidden="true">{{ categoryIcon(selectedPartnerIncident) }}</span>
                {{ categoryLabel(selectedPartnerIncident) }}
              </span>

              <span v-if="isResolved(selectedPartnerIncident)" class="verdict-mini-badge verdict-improcedente">
                <template v-if="selectedPartnerIncident.data_resolucao">Corrigida em {{ formatDateOnly(selectedPartnerIncident.data_resolucao) }}</template>
                <template v-else>Corrigida</template>
              </span>
              <span v-else class="verdict-mini-badge verdict-pendente">
                {{ openForLabel(selectedPartnerIncident) }}
              </span>

              <span v-if="selectedPartnerIncident.em_revisao_denuncia" class="status-badge status-review">
                <span aria-hidden="true">🚩</span> Em revisão de denúncia
              </span>

              <span v-if="partnerNearMeCenter" class="distance-badge">
                <span aria-hidden="true">📍</span> {{ formatDistanceFromPartner(selectedPartnerIncident) }} de você
              </span>

              <span
                v-if="isAdminRole && selectedPartnerIncident.possivel_duplicidade"
                class="duplicity-panel-badge repeat-badge-lg"
              >
                <span aria-hidden="true">⚠️</span>
                <template v-if="selectedPartnerIncident.duplicidade_de_id">Possível duplicidade de outra ocorrência próxima</template>
                <template v-else>Possível duplicidade</template>
              </span>
            </div>

            <div class="detail-id-actions">
              <button type="button" class="btn-cancel-edit" @click="copyIncidentCode(selectedPartnerIncident)">
                <span aria-hidden="true">📋</span> Copiar código da ocorrência
              </button>
              <span class="copy-feedback" role="status">{{ copyFeedback }}</span>
            </div>
          </div>

          <p v-if="partnerResolveSuccess" class="user-success-alert detail-success" role="status">
            {{ partnerResolveSuccess }}
          </p>

          <!-- CORRIGIDA: Antes e depois -->
          <div v-if="isResolved(selectedPartnerIncident)" class="partner-ba-wrapper">
            <div class="panel-ba-grid">
              <section class="panel-ba-card partner-ba-card partner-ba-before" aria-labelledby="partner-ba-before-title">
                <h4 id="partner-ba-before-title" class="partner-ba-title">
                  <span aria-hidden="true">🚧</span> Antes • problema registrado
                </h4>
                <div v-if="beforePhotoUrl" class="photo-wrapper">
                  <img
                    :src="beforePhotoUrl"
                    alt="Foto de antes: problema registrado pela população"
                    class="detail-photo-img"
                    @click="openPanelLightbox(beforePhotoUrl)"
                  />
                  <button type="button" class="btn-expand-photo" @click="openPanelLightbox(beforePhotoUrl)">
                    <span aria-hidden="true">🔍</span> Ampliar foto de antes
                  </button>
                </div>
                <p v-else class="photo-missing">Sem foto disponível</p>
                <p class="partner-ba-date">
                  <span class="meta-label">Data do registro</span>
                  <strong>{{ formatIncidentDateTime(selectedPartnerIncident.timestamp) }}</strong>
                </p>
                <p v-if="selectedPartnerIncident.descricao" class="partner-ba-desc">
                  <strong>Descrição do registro:</strong> {{ selectedPartnerIncident.descricao }}
                </p>
              </section>

              <section class="panel-ba-card partner-ba-card partner-ba-after" aria-labelledby="partner-ba-after-title">
                <h4 id="partner-ba-after-title" class="partner-ba-title">
                  <span aria-hidden="true">✅</span> Depois • correção informada
                </h4>
                <div v-if="selectedPartnerIncident.foto_resolucao" class="photo-wrapper">
                  <img
                    :src="selectedPartnerIncident.foto_resolucao"
                    alt="Foto de depois: local corrigido"
                    class="detail-photo-img"
                    @click="openPanelLightbox(selectedPartnerIncident.foto_resolucao)"
                  />
                  <button
                    type="button"
                    class="btn-expand-photo"
                    @click="openPanelLightbox(selectedPartnerIncident.foto_resolucao)"
                  >
                    <span aria-hidden="true">🔍</span> Ampliar foto de depois
                  </button>
                </div>
                <p v-else class="photo-missing">Sem foto disponível</p>
                <p class="partner-ba-date">
                  <span class="meta-label">Data da correção</span>
                  <strong>{{ formatDateTime(selectedPartnerIncident.data_resolucao) }}</strong>
                </p>
                <p v-if="selectedPartnerIncident.descricao_resolucao" class="partner-ba-desc">
                  <strong>O que foi feito:</strong> {{ selectedPartnerIncident.descricao_resolucao }}
                </p>
              </section>
            </div>
          </div>

          <!-- EM ABERTO: Foto + ação -->
          <div v-else class="detail-content-split">
            <div class="detail-photo-box">
              <div v-if="currentPartnerSelectedPhotoUrl" class="photo-wrapper">
                <img
                  :src="currentPartnerSelectedPhotoUrl"
                  :alt="`Foto ${partnerSelectedPhotoIndex + 1} da ocorrência`"
                  class="detail-photo-img"
                  @click="openPanelLightbox(currentPartnerSelectedPhotoUrl)"
                />
                <button
                  v-if="selectedPartnerIncidentPhotosList.length > 1"
                  type="button"
                  class="btn-switch-photo-corner"
                  @click.stop="togglePartnerSelectedPhoto"
                >
                  <span aria-hidden="true">📷</span>
                  <span>Próxima foto ({{ partnerSelectedPhotoIndex + 1 }} de {{ selectedPartnerIncidentPhotosList.length }})</span>
                </button>
                <button
                  type="button"
                  class="btn-expand-photo"
                  @click="openPanelLightbox(currentPartnerSelectedPhotoUrl)"
                >
                  <span aria-hidden="true">🔍</span> Ampliar foto
                </button>
              </div>
              <p v-else class="photo-missing">Sem foto disponível</p>
              <p v-if="selectedPartnerIncident.em_revisao_denuncia && currentPartnerSelectedPhotoUrl" class="staff-photo-note">
                Foto visível apenas para a equipe do painel enquanto a ocorrência está em revisão.
              </p>
            </div>

            <div class="detail-moderation-box">
              <!-- P5: em revisão de denúncia → sem formulário -->
              <section
                v-if="selectedPartnerIncident.em_revisao_denuncia"
                class="partner-info-box partner-review-box"
                aria-labelledby="partner-review-title"
              >
                <h4 id="partner-review-title" class="box-section-title">
                  <span aria-hidden="true">🚩</span> Em revisão de denúncia
                </h4>
                <p class="partner-info-text">
                  Aguardando moderação da Vale PCD; não é possível informar correção enquanto a ocorrência está em revisão.
                </p>
              </section>

              <PartnerResolveForm
                v-else-if="selectedPartnerIncident.natureza === 'urbana'"
                :key="selectedPartnerIncident.id"
                :incident="selectedPartnerIncident"
                @resolved="handlePartnerResolved"
                @under-review="handlePartnerUnderReview"
              />

              <section v-else class="partner-info-box" aria-labelledby="partner-transito-title">
                <h4 id="partner-transito-title" class="box-section-title">
                  <span aria-hidden="true">♿</span> Infração de trânsito
                </h4>
                <p class="partner-info-text">
                  Veículo parado de forma irregular (vaga para pessoa com deficiência, área zebrada, faixa de pedestres ou calçada). Use estas ocorrências e a visão <strong>Pontos críticos</strong> para orientar a fiscalização. A comprovação de correção com foto de antes e depois é usada apenas em ocorrências de <strong>Mobilidade urbana</strong>.
                </p>
              </section>
            </div>
          </div>

          <!-- Dados da ocorrência -->
          <section class="detail-metadata-box" aria-labelledby="partner-meta-title">
            <h4 id="partner-meta-title" class="box-section-title">Dados da ocorrência</h4>
            <div class="metadata-grid">
              <div class="meta-item">
                <span class="meta-label">Data do registro</span>
                <span class="meta-value">{{ formatIncidentDateTime(selectedPartnerIncident.timestamp) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Cidade / UF</span>
                <span class="meta-value">
                  {{ [selectedPartnerIncident.cidade, selectedPartnerIncident.estado].filter(Boolean).join(' / ') || 'Não informada' }}
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Rua / Bairro</span>
                <span class="meta-value">
                  {{ [selectedPartnerIncident.rua, selectedPartnerIncident.bairro].filter(Boolean).join(' - ') || 'Não informado' }}
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Localização</span>
                <span class="meta-value meta-coords-row">
                  <button
                    type="button"
                    class="btn-open-multei-map"
                    @click="openMulteiLocationModalFor(selectedPartnerIncident)"
                  >
                    <span aria-hidden="true">🗺️</span> Abrir local no mapa
                  </button>
                </span>
                <details class="coords-details">
                  <summary>Ver coordenadas</summary>
                  <p class="coords-text">
                    Latitude {{ formatCoord(selectedPartnerIncident.latitude) }}, longitude {{ formatCoord(selectedPartnerIncident.longitude) }}
                  </p>
                </details>
              </div>
              <div
                v-if="selectedPartnerIncident.natureza === 'urbana' || selectedPartnerIncident.descricao"
                class="meta-item meta-item-full"
              >
                <span class="meta-label">Descrição do registro</span>
                <span class="meta-value">
                  {{ selectedPartnerIncident.descricao || 'Não informada' }}
                </span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import type { ReportedIncident } from '~/types';
import { requestUserLocation, normalizeState } from '~/services/geoService';
import {
  BRAZIL_STATES,
  getCapitalByState,
  normalizeSearchText
} from '~/services/ibgeService';
import {
  fetchPartnerIncidentsFromFirebase,
  fetchMulteiStatsOnce,
  normalizeCityKey,
  type ResolvedIncidentPanelItem,
  type ResolutionReviewDecision
} from '~/services/firebaseService';
import {
  useMulteiPanelShared,
  getPanelDistanceMeters as getDistanceMeters,
  formatPanelDateTime as formatDateTime,
  formatPanelIncidentLocation as formatIncidentLocation
} from '~/composables/useMulteiPanelShared';
import {
  extractStreetName,
  isIncidentOpen,
  parseIncidentTime,
  type CriticalPointGroupBy,
  type CriticalPointNatureza
} from '~/utils/multeiCriticalPoints';
import { buildCsv, downloadCsv, type CsvColumn } from '~/utils/multeiCsv';
import PartnerCitySummary from '~/components/multei/panel/partner/PartnerCitySummary.vue';
import PartnerCriticalPoints from '~/components/multei/panel/partner/PartnerCriticalPoints.vue';
import PartnerResolveForm from '~/components/multei/panel/partner/PartnerResolveForm.vue';

// Aba "Ocorrências da cidade" (Admin e Parcerias). Montada enquanto houver sessão;
// `active` só controla a exibição, para preservar estado/filtros ao trocar de aba.
const props = defineProps<{ active: boolean }>();

const emit = defineEmits<{
  /** Quantidade de ocorrências EM ABERTO no escopo da aba (null = ainda desconhecida). */
  (e: 'badge-count', count: number | null): void;
  (e: 'resolution-submitted'): void;
}>();

const { userProfile, isAdminRole, announceSr, openPanelLightbox, openMulteiLocationModalFor } =
  useMulteiPanelShared();

const PAGE_SIZE = 50;
const MOBILE_QUERY = '(max-width: 960px)';
const DAY_MS = 86400000;

type PeriodValue = '' | '7' | '30' | '90' | '365';
type SortValue = 'recentes' | 'antigas' | 'proximas' | 'reportadas';
type ViewMode = 'lista' | 'mapa' | 'pontos';

const PERIOD_OPTIONS: Array<{ value: PeriodValue; label: string }> = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '365', label: 'Últimos 12 meses' },
  { value: '', label: 'Todo o período' }
];

// Estado principal
const partnerIncidents = ref<ReportedIncident[]>([]);
const hasLoadedPartnerIncidents = ref(false);
const panelStatsTotalGeral = ref<number | null>(null);
const panelStatsResolvidos = ref<number | null>(null);
const isLoadingPartnerIncidents = ref(false);
const isLocatingPartnerGps = ref(false);
const partnerNearMeCenter = ref<{ latitude: number; longitude: number } | null>(null);
const partnerGpsError = ref('');
const partnerLoadError = ref('');
const partnerFilterTab = ref<'pendentes' | 'resolvidas'>('pendentes');
const selectedPartnerIncident = ref<ReportedIncident | null>(null);
const partnerResolveSuccess = ref('');
const viewMode = ref<ViewMode>('lista');
const visibleCount = ref(PAGE_SIZE);
const lastUpdatedAt = ref<number | null>(null);
const nowTick = ref(Date.now());
const copyFeedback = ref('');
const exportFeedback = ref('');

// Mobile (P13)
const isMobile = ref(false);
const mobileDetailOpen = ref(false);
let lastListFocusId = '';

// Refs de DOM
const listRef = ref<HTMLElement | null>(null);
const listHeadingRef = ref<HTMLElement | null>(null);
const detailHeadingRef = ref<HTMLElement | null>(null);
const tabPendentesRef = ref<HTMLButtonElement | null>(null);
const tabResolvidasRef = ref<HTMLButtonElement | null>(null);

// Filtros (Bairro, Tipo, Período e Ordenação para todos; Estado e Cidade adicionais para Admin)
const denunciaFilterEstado = ref('');
const denunciaFilterCidade = ref('');
const denunciaFilterBairro = ref('');
const denunciaFilterNatureza = ref<'' | 'transito' | 'urbana'>('');
const denunciaFilterPeriodo = ref<PeriodValue>('');
const denunciaSortBy = ref<SortValue>('recentes');
const criticalPointFilter = ref<{ groupBy: CriticalPointGroupBy; key: string; label: string } | null>(null);

const partnerCityLabel = computed(() => {
  const p = userProfile.value;
  if (!p?.cidade) return '';
  return p.estado ? `${p.cidade}/${p.estado}` : p.cidade;
});

const periodLabel = computed(
  () => PERIOD_OPTIONS.find((o) => o.value === denunciaFilterPeriodo.value)?.label || 'Todo o período'
);

const summaryTitle = computed(() => {
  if (partnerNearMeCenter.value) return 'Resumo ao seu redor (5 km)';
  if (isAdminRole.value) {
    return denunciaFilterCidade.value.trim() ? `Resumo de ${denunciaFilterCidade.value.trim()}` : 'Resumo geral';
  }
  return partnerCityLabel.value ? `Resumo de ${partnerCityLabel.value}` : 'Resumo da cidade';
});

const handleDenunciaEstadoFilterChange = () => {
  if (denunciaFilterEstado.value) {
    denunciaFilterCidade.value = getCapitalByState(denunciaFilterEstado.value);
  } else {
    denunciaFilterCidade.value = '';
  }
  denunciaFilterBairro.value = '';
};

const clearDenunciaFilters = () => {
  denunciaFilterEstado.value = '';
  denunciaFilterCidade.value = '';
  denunciaFilterBairro.value = '';
  denunciaFilterNatureza.value = '';
  denunciaFilterPeriodo.value = '';
  criticalPointFilter.value = null;
};

const clearCriticalPointFilter = () => {
  const label = criticalPointFilter.value?.label;
  criticalPointFilter.value = null;
  if (label) announceSr(`Filtro do ponto crítico ${label} removido.`);
};

const hasActiveDenunciaFilters = computed(() =>
  Boolean(
    (isAdminRole.value && (denunciaFilterEstado.value || denunciaFilterCidade.value.trim())) ||
      denunciaFilterBairro.value.trim() ||
      denunciaFilterNatureza.value ||
      denunciaFilterPeriodo.value ||
      criticalPointFilter.value
  )
);

// Helpers de exibição
const isResolved = (inc: ReportedIncident) => !isIncidentOpen(inc);
const isUrbana = (inc: ReportedIncident) => inc?.natureza === 'urbana';
const categoryLabel = (inc: ReportedIncident) => (isUrbana(inc) ? 'Mobilidade urbana' : 'Infração de trânsito');
const categoryIcon = (inc: ReportedIncident) => (isUrbana(inc) ? '🚧' : '♿');
const categoryPillClass = (inc: ReportedIncident) => (isUrbana(inc) ? 'pill-urbana' : 'pill-transito');

const toIso = (raw: unknown): string => {
  const t = parseIncidentTime(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
};

const formatIncidentDateTime = (raw: unknown) => formatDateTime(toIso(raw));

const formatDateOnly = (raw: unknown) => {
  const t = parseIncidentTime(raw);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatCoord = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(6).replace('.', ',') : '—';
};

const openForLabel = (inc: ReportedIncident) => {
  const t = parseIncidentTime(inc.timestamp);
  if (!Number.isFinite(t)) return 'Aberta';
  const days = Math.max(0, Math.floor((nowTick.value - t) / DAY_MS));
  if (days === 0) return 'Aberta hoje';
  if (days === 1) return 'Aberta há 1 dia';
  return `Aberta há ${days} dias`;
};

const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value) return '';
  const minutes = Math.floor((nowTick.value - lastUpdatedAt.value) / 60000);
  if (minutes < 1) return 'Atualizado agora';
  if (minutes < 60) return `Atualizado há ${minutes} min`;
  const d = new Date(lastUpdatedAt.value);
  return `Atualizado às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
});

const normalizeGroupText = (raw: unknown) =>
  String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const incidentUf = (inc: ReportedIncident) =>
  (normalizeState(inc.estado || '') || inc.estado || '').trim().toUpperCase();

// Escopo: parceria só vê a própria cidade/UF
const partnerScopedIncidents = computed(() => {
  if (isAdminRole.value) {
    return partnerIncidents.value;
  }
  const partnerCity = normalizeSearchText(userProfile.value?.cidade || '');
  const partnerUf = (normalizeState(userProfile.value?.estado || '') || userProfile.value?.estado || '')
    .trim()
    .toUpperCase();

  return partnerIncidents.value.filter((inc) => {
    if (partnerCity && normalizeSearchText(inc.cidade) !== partnerCity) {
      return false;
    }
    if (partnerUf) {
      const incUf = incidentUf(inc);
      if (incUf && incUf !== partnerUf) return false;
    }
    return true;
  });
});

const availableDenunciaBairros = computed(() => {
  const targetUf = isAdminRole.value ? denunciaFilterEstado.value.trim().toUpperCase() : '';
  const targetCity = isAdminRole.value ? normalizeSearchText(denunciaFilterCidade.value) : '';
  const seen = new Map<string, string>();

  for (const inc of partnerScopedIncidents.value) {
    if (targetUf && incidentUf(inc) !== targetUf) continue;
    if (targetCity && normalizeSearchText(inc.cidade) !== targetCity) continue;
    const b = (inc.bairro || '').trim();
    const key = normalizeGroupText(b);
    if (b && !seen.has(key)) seen.set(key, b);
  }

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
});

const periodCutoff = computed(() => {
  const days = Number(denunciaFilterPeriodo.value);
  return days > 0 ? nowTick.value - days * DAY_MS : null;
});

const matchesAdminLocation = (inc: ReportedIncident, targetUf: string, targetCity: string) => {
  if (targetUf && incidentUf(inc) !== targetUf) return false;
  if (targetCity && normalizeSearchText(inc.cidade) !== targetCity) return false;
  return true;
};

const matchesPeriod = (inc: ReportedIncident) => {
  const cutoff = periodCutoff.value;
  if (cutoff === null) return true;
  const t = parseIncidentTime(inc.timestamp);
  return Number.isFinite(t) && t >= cutoff;
};

/** Escopo + Estado/Cidade (admin) + Período — base do resumo da cidade. */
const summaryIncidents = computed(() => {
  const targetUf = isAdminRole.value ? denunciaFilterEstado.value.trim().toUpperCase() : '';
  const targetCity = isAdminRole.value ? normalizeSearchText(denunciaFilterCidade.value) : '';
  return partnerScopedIncidents.value.filter(
    (inc) => matchesAdminLocation(inc, targetUf, targetCity) && matchesPeriod(inc)
  );
});

/** Resumo + Bairro — base dos pontos críticos (o tipo é escolhido dentro da própria visão). */
const locationFilteredIncidents = computed(() => {
  const targetBairro = normalizeGroupText(denunciaFilterBairro.value);
  if (!targetBairro) return summaryIncidents.value;
  return summaryIncidents.value.filter((inc) => normalizeGroupText(inc.bairro).includes(targetBairro));
});

const matchesCriticalPoint = (inc: ReportedIncident) => {
  const cp = criticalPointFilter.value;
  if (!cp) return true;
  const label = cp.groupBy === 'rua' ? extractStreetName(inc.rua) : inc.bairro;
  return normalizeGroupText(label) === cp.key;
};

const baseFilteredPartnerIncidents = computed(() => {
  const targetNatureza = denunciaFilterNatureza.value;
  return locationFilteredIncidents.value.filter((inc) => {
    if (targetNatureza) {
      const incNatureza = isUrbana(inc) ? 'urbana' : 'transito';
      if (incNatureza !== targetNatureza) return false;
    }
    return matchesCriticalPoint(inc);
  });
});

const hasReportCounts = computed(() =>
  partnerScopedIncidents.value.some((inc) => typeof (inc as any).total_reports === 'number')
);

const distanceFromCenter = (inc: ReportedIncident) => {
  const c = partnerNearMeCenter.value;
  if (!c) return Number.POSITIVE_INFINITY;
  const d = getDistanceMeters(c.latitude, c.longitude, Number(inc.latitude), Number(inc.longitude));
  return Number.isFinite(d) ? d : Number.POSITIVE_INFINITY;
};

const sortIncidents = (list: ReportedIncident[]) => {
  const sortBy = denunciaSortBy.value;
  const timeOf = (inc: ReportedIncident) => {
    const t = parseIncidentTime(inc.timestamp);
    return Number.isFinite(t) ? t : 0;
  };
  const copy = list.slice();
  if (sortBy === 'antigas') {
    copy.sort((a, b) => timeOf(a) - timeOf(b));
  } else if (sortBy === 'proximas' && partnerNearMeCenter.value) {
    copy.sort((a, b) => distanceFromCenter(a) - distanceFromCenter(b));
  } else if (sortBy === 'reportadas') {
    copy.sort(
      (a, b) =>
        Number((b as any).total_reports || 0) - Number((a as any).total_reports || 0) || timeOf(b) - timeOf(a)
    );
  } else {
    copy.sort((a, b) => timeOf(b) - timeOf(a));
  }
  return copy;
};

const pendingPartnerIncidents = computed(() =>
  sortIncidents(baseFilteredPartnerIncidents.value.filter((inc) => !isResolved(inc)))
);

const resolvedPartnerIncidents = computed(() =>
  sortIncidents(baseFilteredPartnerIncidents.value.filter((inc) => isResolved(inc)))
);

const filteredPartnerIncidents = computed(() =>
  partnerFilterTab.value === 'pendentes'
    ? pendingPartnerIncidents.value
    : resolvedPartnerIncidents.value
);

// P4: paginação no cliente
const pagedPartnerIncidents = computed(() => filteredPartnerIncidents.value.slice(0, visibleCount.value));
const remainingCount = computed(() => Math.max(0, filteredPartnerIncidents.value.length - visibleCount.value));
const paginationStatus = ref('');

const loadMore = async () => {
  const firstNewIndex = visibleCount.value;
  visibleCount.value += PAGE_SIZE;
  const shown = Math.min(visibleCount.value, filteredPartnerIncidents.value.length);
  paginationStatus.value = `Mostrando ${shown} de ${filteredPartnerIncidents.value.length} ocorrências.`;
  await nextTick();
  const buttons = listRef.value?.querySelectorAll<HTMLButtonElement>('.report-item-btn');
  buttons?.[firstNewIndex]?.focus();
};

watch(
  [
    partnerFilterTab,
    denunciaSortBy,
    denunciaFilterEstado,
    denunciaFilterCidade,
    denunciaFilterBairro,
    denunciaFilterNatureza,
    denunciaFilterPeriodo,
    criticalPointFilter,
    partnerNearMeCenter
  ],
  () => {
    visibleCount.value = PAGE_SIZE;
    paginationStatus.value = '';
  }
);

watch(partnerNearMeCenter, (center) => {
  if (!center && denunciaSortBy.value === 'proximas') denunciaSortBy.value = 'recentes';
});

watch(hasReportCounts, (has) => {
  if (!has && denunciaSortBy.value === 'reportadas') denunciaSortBy.value = 'recentes';
});

// Mapa
const mapInitialCenter = computed(() => {
  if (partnerNearMeCenter.value) {
    return { ...partnerNearMeCenter.value, isSearchResult: true };
  }
  const first = filteredPartnerIncidents.value.find(
    (inc) => Number.isFinite(Number(inc.latitude)) && Number.isFinite(Number(inc.longitude))
  );
  if (first) {
    return { latitude: Number(first.latitude), longitude: Number(first.longitude), isSearchResult: true };
  }
  return { latitude: -23.55052, longitude: -46.633308, isSearchResult: true };
});

// Badge da aba: só ocorrências EM ABERTO
const partnerTabBadgeCount = computed<number | null>(() => {
  if (hasLoadedPartnerIncidents.value || partnerIncidents.value.length > 0) {
    return partnerScopedIncidents.value.filter((inc) => !isResolved(inc)).length;
  }
  if (
    isAdminRole.value &&
    typeof panelStatsTotalGeral.value === 'number' &&
    typeof panelStatsResolvidos.value === 'number'
  ) {
    return Math.max(0, panelStatsTotalGeral.value - panelStatsResolvidos.value);
  }
  return null;
});

const loadAdminStatsSummary = async () => {
  try {
    const stats = await fetchMulteiStatsOnce((cached) => {
      if (typeof cached?.totalGeral === 'number') {
        panelStatsTotalGeral.value = cached.totalGeral;
      }
      if (typeof cached?.resolvidos === 'number') {
        panelStatsResolvidos.value = cached.resolvidos;
      }
    });
    if (typeof stats?.totalGeral === 'number') {
      panelStatsTotalGeral.value = stats.totalGeral;
    }
    if (typeof stats?.resolvidos === 'number') {
      panelStatsResolvidos.value = stats.resolvidos;
    }
  } catch {}
};

// Fotos da ocorrência selecionada
const partnerSelectedPhotoIndex = ref(0);

watch(selectedPartnerIncident, () => {
  partnerSelectedPhotoIndex.value = 0;
});

const selectedPartnerIncidentPhotosList = computed(() => {
  const inc = selectedPartnerIncident.value;
  if (!inc) return [];
  if (Array.isArray(inc.fotosUrls) && inc.fotosUrls.length > 0) {
    return inc.fotosUrls.filter(Boolean);
  }
  const p1 = inc.fotoUrl || inc.maskedImageUrl || '';
  const p2 = inc.fotoUrl2 || '';
  return [p1, p2].filter(Boolean) as string[];
});

const currentPartnerSelectedPhotoUrl = computed(() => {
  const list = selectedPartnerIncidentPhotosList.value;
  if (list.length === 0) {
    return selectedPartnerIncident.value?.fotoUrl || selectedPartnerIncident.value?.maskedImageUrl || '';
  }
  return list[partnerSelectedPhotoIndex.value] || list[0] || '';
});

const beforePhotoUrl = computed(
  () => selectedPartnerIncident.value?.fotoUrl || selectedPartnerIncident.value?.maskedImageUrl || ''
);

const togglePartnerSelectedPhoto = () => {
  const list = selectedPartnerIncidentPhotosList.value;
  if (list.length <= 1) return;
  partnerSelectedPhotoIndex.value = (partnerSelectedPhotoIndex.value + 1) % list.length;
};

const formatDistanceFromPartner = (inc: ReportedIncident): string => {
  if (!partnerNearMeCenter.value) return '';
  const meters = distanceFromCenter(inc);
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) {
    return `a ${Math.round(meters)} m`;
  }
  return `a ${(meters / 1000).toFixed(1).replace('.', ',')} km`;
};

watch(filteredPartnerIncidents, (list) => {
  if (!selectedPartnerIncident.value) {
    selectedPartnerIncident.value = list[0] || null;
    return;
  }
  const stillExists = list.some((i) => i.id === selectedPartnerIncident.value?.id);
  if (!stillExists) {
    selectedPartnerIncident.value = list[0] || null;
    if (!selectedPartnerIncident.value) mobileDetailOpen.value = false;
  }
});

const loadPartnerDenuncias = async (options?: { silent?: boolean } | Event) => {
  if (!userProfile.value) return;
  const isSilent = Boolean(
    options && typeof options === 'object' && 'silent' in options && options.silent && partnerIncidents.value.length > 0
  );
  if (!isSilent) {
    isLoadingPartnerIncidents.value = true;
    partnerGpsError.value = '';
  }
  try {
    const items = await fetchPartnerIncidentsFromFirebase({
      cidade: isAdminRole.value ? undefined : userProfile.value.cidade,
      estado: isAdminRole.value ? undefined : userProfile.value.estado,
      center: partnerNearMeCenter.value,
      radiusKm: 5,
      includeStaffPhotos: true
    });
    partnerIncidents.value = items;
    hasLoadedPartnerIncidents.value = true;
    partnerLoadError.value = '';
    lastUpdatedAt.value = Date.now();
    nowTick.value = Date.now();
    if (isAdminRole.value && !partnerNearMeCenter.value) {
      panelStatsTotalGeral.value = items.length;
    }

    const currentList = filteredPartnerIncidents.value;

    if (selectedPartnerIncident.value) {
      const updated = currentList.find((i) => i.id === selectedPartnerIncident.value?.id);
      if (updated) {
        selectedPartnerIncident.value = updated;
        return;
      }
    }
    selectedPartnerIncident.value = currentList[0] || null;
  } catch (err) {
    console.warn('[painel] Erro ao carregar ocorrências da cidade:', err);
    if (!isSilent) {
      partnerLoadError.value = 'Não foi possível carregar as ocorrências agora. Tente atualizar em instantes.';
    }
  } finally {
    if (!isSilent) {
      isLoadingPartnerIncidents.value = false;
    }
  }
};

const handlePartnerAroundMe = async () => {
  if (isLocatingPartnerGps.value) return;
  isLocatingPartnerGps.value = true;
  partnerGpsError.value = '';
  try {
    const coords = await requestUserLocation();
    partnerNearMeCenter.value = {
      latitude: coords.latitude,
      longitude: coords.longitude
    };
    announceSr('Localização obtida. Buscando ocorrências num raio de 5 km.');
    await loadPartnerDenuncias();
  } catch {
    partnerGpsError.value =
      'Não foi possível acessar a sua localização. Permita o acesso à localização no navegador para usar "Ao meu redor (5 km)".';
  } finally {
    isLocatingPartnerGps.value = false;
  }
};

const clearPartnerAroundMe = async () => {
  if (!partnerNearMeCenter.value) return;
  partnerNearMeCenter.value = null;
  partnerGpsError.value = '';
  await loadPartnerDenuncias();
};

const resetSelectionFeedback = () => {
  partnerResolveSuccess.value = '';
  copyFeedback.value = '';
};

const selectPartnerTab = (tab: 'pendentes' | 'resolvidas') => {
  if (partnerFilterTab.value === tab) return;
  partnerFilterTab.value = tab;
  const list = tab === 'pendentes' ? pendingPartnerIncidents.value : resolvedPartnerIncidents.value;
  selectedPartnerIncident.value = list[0] || null;
  resetSelectionFeedback();
};

// Padrão ARIA de abas: setas, Home e End (ativação automática)
const handleTabKeydown = async (e: KeyboardEvent) => {
  let next: 'pendentes' | 'resolvidas' | null = null;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    next = partnerFilterTab.value === 'pendentes' ? 'resolvidas' : 'pendentes';
  } else if (e.key === 'Home') {
    next = 'pendentes';
  } else if (e.key === 'End') {
    next = 'resolvidas';
  }
  if (!next) return;
  e.preventDefault();
  selectPartnerTab(next);
  await nextTick();
  (next === 'pendentes' ? tabPendentesRef.value : tabResolvidasRef.value)?.focus();
};

const selectPartnerIncident = (inc: ReportedIncident) => {
  selectedPartnerIncident.value = inc;
  resetSelectionFeedback();
};

const focusDetailHeading = async () => {
  await nextTick();
  detailHeadingRef.value?.focus();
};

const openMobileDetail = async () => {
  mobileDetailOpen.value = true;
  await focusDetailHeading();
};

const handleListItemClick = (inc: ReportedIncident) => {
  selectPartnerIncident(inc);
  lastListFocusId = String(inc.id || '');
  if (isMobile.value) {
    void openMobileDetail();
  }
};

const focusListItemById = (id: string) => {
  if (!id) return false;
  const idx = filteredPartnerIncidents.value.findIndex((i) => i.id === id);
  if (idx >= visibleCount.value) {
    visibleCount.value = Math.ceil((idx + 1) / PAGE_SIZE) * PAGE_SIZE;
  }
  const buttons = listRef.value?.querySelectorAll<HTMLButtonElement>('.report-item-btn');
  const target = buttons ? Array.from(buttons).find((b) => b.dataset.incidentId === id) : null;
  if (target) {
    target.focus();
    return true;
  }
  return false;
};

const backToList = async () => {
  mobileDetailOpen.value = false;
  await nextTick();
  await nextTick();
  const focused = viewMode.value === 'lista' && focusListItemById(lastListFocusId || String(selectedPartnerIncident.value?.id || ''));
  if (!focused) listHeadingRef.value?.focus();
};

const handleMapMarkerClick = (payload: any) => {
  const raw: ReportedIncident | undefined =
    Array.isArray(payload?.groupItems) && payload.groupItems.length > 0 ? payload.groupItems[0] : payload;
  const id = raw?.id;
  if (!id) return;
  const match = filteredPartnerIncidents.value.find((i) => i.id === id) || partnerIncidents.value.find((i) => i.id === id);
  if (!match) return;
  selectPartnerIncident(match);
  lastListFocusId = String(id);
  announceSr(`Ocorrência selecionada: ${formatIncidentLocation(match)}.`);
  if (isMobile.value) {
    void openMobileDetail();
    return;
  }
  // Na visão por mapa o detalhe fica abaixo do mapa: rola até ele sem roubar o foco do mapa
  nextTick(() => {
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    detailHeadingRef.value?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
};

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode;
  if (mode === 'pontos') mobileDetailOpen.value = false;
};

const handleCriticalPointSelect = async (sel: {
  groupBy: CriticalPointGroupBy;
  key: string;
  label: string;
  natureza: CriticalPointNatureza;
  abertas: number;
}) => {
  criticalPointFilter.value = { groupBy: sel.groupBy, key: sel.key, label: sel.label };
  denunciaFilterNatureza.value = sel.natureza;
  partnerFilterTab.value = sel.abertas > 0 ? 'pendentes' : 'resolvidas';
  viewMode.value = 'lista';
  mobileDetailOpen.value = false;
  await nextTick();
  selectedPartnerIncident.value = filteredPartnerIncidents.value[0] || null;
  const kind = sel.groupBy === 'rua' ? 'rua' : 'bairro';
  announceSr(
    `Lista filtrada pelo ${kind === 'rua' ? 'logradouro' : 'bairro'} ${sel.label}: ${baseFilteredPartnerIncidents.value.length} ocorrências.`
  );
  listHeadingRef.value?.focus();
};

// P6: copiar código da ocorrência
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

const copyIncidentCode = async (inc: ReportedIncident | null) => {
  const code = String(inc?.id || '');
  if (!code) return;
  let ok = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok && typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    textarea.remove();
    detailHeadingRef.value?.focus();
  }
  copyFeedback.value = ok
    ? 'Código copiado.'
    : 'Não foi possível copiar automaticamente. Tente novamente.';
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
  copyFeedbackTimer = setTimeout(() => {
    copyFeedback.value = '';
    copyFeedbackTimer = null;
  }, 4000);
};

// P2: exportação CSV das ocorrências filtradas
const csvCitySlug = computed(() => {
  const raw = isAdminRole.value ? denunciaFilterCidade.value : userProfile.value?.cidade || '';
  const slug = normalizeCityKey(raw).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'todas';
});

const todayStamp = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const incidentStatusLabel = (inc: ReportedIncident) => {
  if (isResolved(inc)) return 'corrigida';
  if (inc.em_revisao_denuncia) return 'em revisão';
  return 'aberta';
};

const buildMapLink = (inc: ReportedIncident) => {
  const lat = Number(inc.latitude);
  const lng = Number(inc.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || typeof window === 'undefined') return '';
  return `${window.location.origin}/multei?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;
};

const exportOccurrencesCsv = () => {
  const rows = sortIncidents(baseFilteredPartnerIncidents.value);
  if (rows.length === 0) return;
  const columns: CsvColumn<ReportedIncident>[] = [
    { header: 'id', value: (r) => r.id || '' },
    { header: 'data', value: (r) => formatIncidentDateTime(r.timestamp) },
    { header: 'tipo', value: (r) => categoryLabel(r) },
    { header: 'status', value: (r) => incidentStatusLabel(r) },
    { header: 'rua', value: (r) => r.rua || '' },
    { header: 'bairro', value: (r) => r.bairro || '' },
    { header: 'cidade', value: (r) => r.cidade || '' },
    { header: 'UF', value: (r) => r.estado || '' },
    { header: 'latitude', value: (r) => (Number.isFinite(Number(r.latitude)) ? Number(r.latitude) : '') },
    { header: 'longitude', value: (r) => (Number.isFinite(Number(r.longitude)) ? Number(r.longitude) : '') },
    { header: 'descrição', value: (r) => r.descricao || r.description || '' },
    { header: 'data correção', value: (r) => (isResolved(r) && r.data_resolucao ? formatDateTime(toIso(r.data_resolucao)) : '') },
    { header: 'link para o mapa', value: (r) => buildMapLink(r) }
  ];
  const csv = buildCsv(rows, columns);
  downloadCsv(`multei-ocorrencias-${csvCitySlug.value}-${todayStamp()}.csv`, csv);
  exportFeedback.value = `Arquivo CSV com ${rows.length} ${rows.length === 1 ? 'ocorrência' : 'ocorrências'} gerado.`;
  setTimeout(() => {
    exportFeedback.value = '';
  }, 4000);
};

// Resultado do formulário de correção
const handlePartnerResolved = async (updatedIncident: ReportedIncident) => {
  const idx = partnerIncidents.value.findIndex((i) => i.id === updatedIncident.id);
  if (idx !== -1) {
    partnerIncidents.value[idx] = updatedIncident;
  }
  partnerFilterTab.value = 'resolvidas';
  selectedPartnerIncident.value = updatedIncident;
  copyFeedback.value = '';
  partnerResolveSuccess.value =
    'Correção publicada. A ocorrência agora aparece no mapa como corrigida, com as fotos de antes e depois.';
  announceSr(partnerResolveSuccess.value);
  emit('resolution-submitted');
  await focusDetailHeading();
};

const handlePartnerUnderReview = () => {
  const current = selectedPartnerIncident.value;
  if (!current) return;
  const updated = { ...current, em_revisao_denuncia: true };
  const idx = partnerIncidents.value.findIndex((i) => i.id === current.id);
  if (idx !== -1) partnerIncidents.value[idx] = updated;
  selectedPartnerIncident.value = updated;
};

watch(partnerTabBadgeCount, (count) => emit('badge-count', count), { immediate: true });

const ensureLoaded = async () => {
  if (partnerIncidents.value.length === 0) {
    await loadPartnerDenuncias();
  }
};

let livePartnerDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleSilentRefresh = () => {
  if (!userProfile.value) return;
  if (
    isAdminRole.value &&
    !hasLoadedPartnerIncidents.value &&
    !props.active
  ) {
    void loadAdminStatsSummary();
    return;
  }
  if (livePartnerDebounceTimer) {
    clearTimeout(livePartnerDebounceTimer);
  }
  livePartnerDebounceTimer = setTimeout(() => {
    livePartnerDebounceTimer = null;
    void loadPartnerDenuncias({ silent: true });
  }, 350);
};

const applyLiveStatsDelta = (delta: number) => {
  if (!hasLoadedPartnerIncidents.value && typeof panelStatsTotalGeral.value === 'number') {
    panelStatsTotalGeral.value = Math.max(0, panelStatsTotalGeral.value + delta);
  }
};

const applyResolutionReview = ({
  updated,
  decision,
  reviewerLabel
}: {
  updated: ResolvedIncidentPanelItem;
  decision: ResolutionReviewDecision;
  reviewerLabel: string;
}) => {
  // Sincroniza a lista de ocorrências caso já tenha sido carregada nesta sessão
  if (updated.ocorrenciaId && partnerIncidents.value.length > 0) {
    const pIdx = partnerIncidents.value.findIndex((inc) => inc.id === updated.ocorrenciaId);
    if (pIdx !== -1) {
      if (decision === 'procedente') {
        partnerIncidents.value[pIdx] = {
          ...partnerIncidents.value[pIdx]!,
          resolvido: true,
          status_resolucao: 'resolvido',
          resolvido_em_validacao: false,
          foto_resolucao: updated.fotoUrl,
          descricao_resolucao: updated.descricao,
          data_resolucao: updated.data || updated.data_revisao,
          resolvido_por: reviewerLabel
        };
      } else {
        partnerIncidents.value[pIdx] = {
          ...partnerIncidents.value[pIdx]!,
          resolvido: false,
          status_resolucao: 'improcedente',
          resolvido_em_validacao: false,
          foto_resolucao: '',
          descricao_resolucao: '',
          data_resolucao: ''
        };
      }
    }
  }
};

const focusIncident = async (ocorrenciaId?: string) => {
  partnerFilterTab.value = 'pendentes';
  if (viewMode.value === 'pontos') viewMode.value = 'lista';
  await loadPartnerDenuncias({ silent: true });
  if (ocorrenciaId) {
    let match = pendingPartnerIncidents.value.find((i) => i.id === ocorrenciaId);
    if (!match && partnerScopedIncidents.value.some((i) => i.id === ocorrenciaId)) {
      // A ocorrência existe, mas está escondida pelos filtros: limpa os filtros para mostrá-la
      clearDenunciaFilters();
      await nextTick();
      match = pendingPartnerIncidents.value.find((i) => i.id === ocorrenciaId);
      if (!match) {
        const resolvedMatch = resolvedPartnerIncidents.value.find((i) => i.id === ocorrenciaId);
        if (resolvedMatch) {
          partnerFilterTab.value = 'resolvidas';
          await nextTick();
          match = resolvedMatch;
        }
      }
    }
    if (match) {
      selectPartnerIncident(match);
      lastListFocusId = String(match.id || '');
      if (isMobile.value) mobileDetailOpen.value = true;
      return;
    }
  }
  if (pendingPartnerIncidents.value[0]) {
    selectPartnerIncident(pendingPartnerIncidents.value[0]);
  }
};

const clearSelection = () => {
  selectedPartnerIncident.value = null;
  mobileDetailOpen.value = false;
};

const setStatsTotalGeral = (total: number | null) => {
  panelStatsTotalGeral.value = total;
};

const resetState = () => {
  partnerIncidents.value = [];
  hasLoadedPartnerIncidents.value = false;
  panelStatsTotalGeral.value = null;
  panelStatsResolvidos.value = null;
  selectedPartnerIncident.value = null;
  partnerNearMeCenter.value = null;
  partnerLoadError.value = '';
  partnerResolveSuccess.value = '';
  lastUpdatedAt.value = null;
  mobileDetailOpen.value = false;
  viewMode.value = 'lista';
  visibleCount.value = PAGE_SIZE;
};

// Ciclo de vida: media query (P13) e relógio de "Atualizado há X min"
let mediaQueryList: MediaQueryList | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;

const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
  isMobile.value = e.matches;
  if (!e.matches) mobileDetailOpen.value = false;
};

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQueryList = window.matchMedia(MOBILE_QUERY);
    handleMediaChange(mediaQueryList);
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleMediaChange);
    } else if (typeof (mediaQueryList as any).addListener === 'function') {
      (mediaQueryList as any).addListener(handleMediaChange);
    }
  }
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 30000);
});

onBeforeUnmount(() => {
  if (livePartnerDebounceTimer) {
    clearTimeout(livePartnerDebounceTimer);
    livePartnerDebounceTimer = null;
  }
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  if (mediaQueryList) {
    if (typeof mediaQueryList.removeEventListener === 'function') {
      mediaQueryList.removeEventListener('change', handleMediaChange);
    } else if (typeof (mediaQueryList as any).removeListener === 'function') {
      (mediaQueryList as any).removeListener(handleMediaChange);
    }
    mediaQueryList = null;
  }
});

defineExpose({
  refresh: loadPartnerDenuncias,
  loadStatsSummary: loadAdminStatsSummary,
  ensureLoaded,
  scheduleSilentRefresh,
  applyLiveStatsDelta,
  applyResolutionReview,
  focusIncident,
  clearSelection,
  clearFilters: clearDenunciaFilters,
  setStatsTotalGeral,
  resetState,
  /** Novo: informa a quantidade de corrigidas das estatísticas (para o badge de abertas antes do 1º carregamento). */
  setStatsResolvidos: (total: number | null) => {
    panelStatsResolvidos.value = total;
  },
  /** Novo: momento (ms) da última carga bem-sucedida. */
  getLastUpdatedAt: () => lastUpdatedAt.value
});
</script>

<style scoped src="../../../assets/css/multei-panel.css"></style>

<style scoped>
/* Cabeçalho: área (Cidade | Ao meu redor) e atualização */
.partner-header-actions {
  align-items: flex-end;
}

.scope-toggle,
.view-toggle {
  display: inline-flex;
  flex-wrap: wrap;
  border: 2px solid var(--pp-border-strong);
  border-radius: 9999px;
  overflow: hidden;
  background: var(--pp-surface);
}

.view-toggle {
  margin-bottom: 1rem;
}

.scope-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.05rem;
  border: none;
  background: transparent;
  color: var(--pp-text-primary);
  font-weight: 800;
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
}

.scope-btn + .scope-btn {
  border-left: 1.5px solid var(--pp-border);
}

.scope-btn.is-active {
  background: var(--pp-accent);
  color: var(--pp-accent-text);
}

.scope-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.scope-btn:focus-visible,
.btn-back-list:focus-visible,
.cp-filter-chip-remove:focus-visible {
  outline: 3px solid var(--pp-accent);
  outline-offset: 2px;
}

.refresh-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.last-updated {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
}

.partner-gps-alert {
  margin-bottom: 1rem;
}

/* Filtros */
.partner-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.9rem;
  align-items: end;
}

.filter-footer-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-left: auto;
}

.btn-clear-all-filters:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cp-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.35rem 0.25rem 0.75rem;
  border-radius: 9999px;
  background: var(--pp-selected-bg);
  border: 1.5px solid var(--pp-selected-border);
  color: var(--pp-text-primary);
  font-size: 0.84rem;
}

.cp-filter-chip-remove {
  border: none;
  background: transparent;
  color: var(--pp-text-primary);
  font-weight: 900;
  cursor: pointer;
  padding: 0.2rem 0.45rem;
  border-radius: 9999px;
}

.cp-filter-chip-remove:hover {
  background: var(--pp-border);
}

/* Lista */
.report-item-btn > span {
  display: block;
}

.report-item-btn > .report-item-top,
.report-item-btn > .report-item-footer {
  display: flex;
}

.report-item-btn > .report-item-reason {
  display: -webkit-box;
}

.report-item-btn:focus-visible {
  outline: 3px solid var(--pp-accent);
  outline-offset: 2px;
}

.partner-tabpanel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

.partner-tabpanel .report-list {
  overflow-y: visible;
}

.load-more-wrap {
  padding: 0 0.75rem 0.9rem;
  display: flex;
  justify-content: center;
}

.btn-load-more {
  width: 100%;
  justify-content: center;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 900;
}

.status-review {
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1.5px solid var(--pp-amber-border);
}

.distance-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 900;
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  border: 1.5px solid var(--pp-border-strong);
}

/* Mapa (P10) */
.master-detail-grid.is-map-mode {
  /* Mapa em largura total; o detalhe da ocorrência selecionada aparece logo abaixo */
  grid-template-columns: 1fr;
}

.partner-map-wrap {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.partner-map-hint {
  margin: 0;
  font-size: 0.84rem;
  color: var(--pp-text-secondary);
}

.master-detail-grid.is-map-mode .master-column {
  max-height: none;
}

/* Detalhe */
.detail-title {
  margin: 0 0 0.85rem;
  font-size: 1.2rem;
  font-weight: 900;
  color: var(--pp-text-primary);
  overflow-wrap: anywhere;
}

.detail-title:focus {
  outline: 3px solid var(--pp-accent);
  outline-offset: 3px;
  border-radius: 6px;
}

.detail-id-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.copy-feedback {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--pp-green-text);
}

.detail-success {
  margin-bottom: 1rem;
}

.btn-back-list {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
  padding: 0.55rem 1rem;
  border-radius: 9999px;
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-weight: 800;
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
}

.photo-missing {
  margin: 0;
}

.staff-photo-note {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--pp-amber-text);
}

.partner-info-box {
  background: var(--pp-surface-alt);
  border: 2px solid var(--pp-border);
  border-radius: 16px;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.partner-review-box {
  border-color: var(--pp-amber-border);
  background: var(--pp-amber-bg);
}

.partner-review-box .box-section-title,
.partner-review-box .partner-info-text {
  color: var(--pp-amber-text);
}

.partner-info-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--pp-text-secondary);
}

/* Antes e depois */
.partner-ba-wrapper {
  margin-bottom: 1.5rem;
}

.partner-ba-card {
  border: 2px solid var(--pp-border);
}

.partner-ba-before {
  border-color: var(--pp-amber-border);
}

.partner-ba-after {
  border-color: var(--pp-green-border);
}

.partner-ba-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.partner-ba-date {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  color: var(--pp-text-primary);
}

.partner-ba-desc {
  margin: 0;
  font-size: 0.88rem;
  color: var(--pp-text-secondary);
  overflow-wrap: anywhere;
}

/* Coordenadas (P6) */
.coords-details {
  margin-top: 0.45rem;
  font-size: 0.86rem;
}

.coords-details summary {
  cursor: pointer;
  font-weight: 800;
  color: var(--pp-text-primary);
}

.coords-text {
  margin: 0.35rem 0 0;
  font-family: monospace;
  color: var(--pp-text-secondary);
}

/* Mobile (P13): lista e detalhe como telas separadas */
@media (max-width: 960px) {
  .partner-denuncias-section.is-mobile .master-column {
    max-height: none;
  }

  .partner-denuncias-section.is-mobile .report-list {
    max-height: none;
    overflow-y: visible;
  }

  .master-detail-grid.is-map-mode {
    grid-template-columns: 1fr;
  }

  .partner-header-actions {
    width: 100%;
  }

  .scope-toggle,
  .view-toggle {
    width: 100%;
  }

  .scope-toggle .scope-btn,
  .view-toggle .scope-btn {
    flex: 1 1 auto;
    justify-content: center;
  }

  .filter-footer-actions {
    margin-left: 0;
  }
}
</style>
