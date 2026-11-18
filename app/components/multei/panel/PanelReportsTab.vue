<template>
  <section
    v-if="active"
    ref="rootRef"
    class="moderation-tab-root"
    :class="{ 'is-mobile-detail-open': isMobile && mobileDetailOpen }"
    aria-labelledby="admin-heading"
  >
    <!-- ABA 1 (EXCLUSIVA ADMIN): AVERIGUAÇÃO DE OCORRÊNCIAS REPORTADAS -->
    <header class="panel-header">
      <div>
        <span class="panel-kicker">Moderação &amp; Governança</span>
        <h2 id="admin-heading" class="panel-main-title">Ocorrências reportadas</h2>
        <p class="panel-main-subtitle">
          Ocorrências denunciadas pela comunidade continuam no mapa com a foto oculta (estado “Em revisão de denúncia”) até você decidir: manter no mapa e voltar a mostrar a foto, ou remover do mapa.
        </p>
      </div>

      <div class="header-refresh-group">
        <button
          type="button"
          class="btn-refresh-list"
          :disabled="isLoadingReports"
          @click="loadReports"
        >
          <span aria-hidden="true">🔄</span>
          <span>{{ isLoadingReports ? 'Atualizando...' : 'Atualizar lista' }}</span>
        </button>
        <span v-if="lastUpdatedLabel" class="last-updated-label">{{ lastUpdatedLabel }}</span>
      </div>
    </header>

    <!-- Barra de Filtros de Ocorrências Reportadas (Admin: Estado, Cidade IBGE com capital padrão, Bairro e Tipo) -->
    <div class="occurrences-filter-bar" role="region" aria-label="Filtros de ocorrências reportadas">
      <div class="occurrences-filter-grid is-admin-grid">
        <!-- Estado (UF) -->
        <div class="form-field filter-field">
          <label for="filter-report-estado" class="field-label">Estado (UF)</label>
          <select
            id="filter-report-estado"
            v-model="reportFilterEstado"
            class="field-input filter-select"
            @change="handleReportEstadoFilterChange"
          >
            <option value="">Todos os estados</option>
            <option v-for="uf in BRAZIL_STATES" :key="uf" :value="uf">
              {{ uf }}
            </option>
          </select>
        </div>

        <!-- Cidade (Search field via API IBGE com capital como padrão) -->
        <div class="form-field filter-field">
          <label for="filter-report-cidade" class="field-label">
            Cidade {{ reportFilterEstado ? `(${reportFilterEstado})` : '' }}
          </label>
          <MulteiCitySearchField
            v-model="reportFilterCidade"
            :uf="reportFilterEstado"
            input-id="filter-report-cidade"
            :allow-clear="true"
          />
        </div>

        <!-- Bairro -->
        <div class="form-field filter-field">
          <label for="filter-report-bairro" class="field-label">Bairro</label>
          <div class="bairro-search-wrap">
            <input
              id="filter-report-bairro"
              v-model="reportFilterBairro"
              type="text"
              list="report-bairros-datalist"
              placeholder="Todos os bairros"
              class="field-input filter-input-with-clear"
            />
            <button
              v-if="reportFilterBairro"
              type="button"
              class="btn-inline-clear"
              aria-label="Limpar filtro de bairro"
              @click="reportFilterBairro = ''"
            >
              <span aria-hidden="true">✕</span>
            </button>
            <datalist id="report-bairros-datalist">
              <option v-for="b in availableReportBairros" :key="b" :value="b" />
            </datalist>
          </div>
        </div>

        <!-- Tipo de Ocorrência -->
        <div class="form-field filter-field">
          <label for="filter-report-natureza" class="field-label">Tipo de ocorrência</label>
          <select
            id="filter-report-natureza"
            v-model="reportFilterNatureza"
            class="field-input filter-select"
          >
            <option value="">Todos os tipos</option>
            <option value="transito">Infração de trânsito</option>
            <option value="urbana">Mobilidade urbana</option>
          </select>
        </div>
      </div>

      <div v-if="hasActiveReportFilters" class="filter-bar-footer">
        <span class="filter-active-summary">
          Exibindo <strong>{{ pendingItems.length + reviewedItems.length }}</strong> de <strong>{{ allReports.length }}</strong> ocorrências reportadas
        </span>
        <button
          type="button"
          class="btn-clear-all-filters"
          @click="clearReportFilters"
        >
          <span aria-hidden="true">✕</span> Limpar filtros
        </button>
      </div>
    </div>

    <!-- Layout Master-Detail: Lista à Esquerda + Detalhes e Foto à Direita -->
    <div
      class="master-detail-grid"
      :class="{ 'is-mobile-detail-open': isMobile && mobileDetailOpen }"
    >
      <!-- COLUNA ESQUERDA: Lista de Ocorrências Reportadas -->
      <section class="master-column" aria-labelledby="reports-list-heading">
        <h3 id="reports-list-heading" class="sr-only">Lista de ocorrências reportadas</h3>

        <!-- Sub-abas: Pendentes vs Revisadas (padrão ARIA de abas, com setas/Home/End) -->
        <div class="filter-tabs" role="tablist" aria-label="Filtrar por status de revisão">
          <button
            v-for="tab in SUB_TABS"
            :id="`reports-subtab-${tab}`"
            :key="tab"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab ? 'true' : 'false'"
            aria-controls="reports-subpanel"
            :tabindex="activeTab === tab ? 0 : -1"
            class="filter-tab-btn"
            :class="{ 'is-active': activeTab === tab }"
            @click="selectTab(tab)"
            @keydown="onSubTabKeydown"
          >
            <span>{{ tab === 'pendentes' ? 'Pendentes' : 'Revisadas' }}</span>
            <span class="tab-counter">{{ tab === 'pendentes' ? pendingItems.length : reviewedItems.length }}</span>
          </button>
        </div>

        <div
          id="reports-subpanel"
          role="tabpanel"
          class="subtab-panel"
          :aria-labelledby="`reports-subtab-${activeTab}`"
          :tabindex="isLoadingReports || filteredItems.length === 0 ? 0 : undefined"
        >
          <div v-if="isLoadingReports" class="list-empty-state">
            <div class="spinner-circle" aria-hidden="true"></div>
            <p>Carregando ocorrências reportadas...</p>
          </div>

          <div v-else-if="filteredItems.length === 0" class="list-empty-state">
            <span class="empty-icon" aria-hidden="true">
              {{ hasActiveReportFilters ? '🔎' : activeTab === 'pendentes' ? '🎉' : '📂' }}
            </span>
            <template v-if="hasActiveReportFilters">
              <p class="empty-title">Nenhuma ocorrência encontrada para os filtros selecionados</p>
              <p class="empty-desc">Altere ou limpe os filtros de estado, cidade, bairro ou tipo de ocorrência acima.</p>
            </template>
            <template v-else-if="activeTab === 'pendentes'">
              <p class="empty-title">Nenhuma ocorrência pendente!</p>
              <p class="empty-desc">Todas as denúncias enviadas já foram analisadas.</p>
            </template>
            <template v-else>
              <p class="empty-title">Nenhuma ocorrência revisada ainda.</p>
              <p class="empty-desc">As ocorrências que você analisar aparecerão neste histórico.</p>
            </template>
          </div>

          <ul v-else class="report-list">
            <li
              v-for="item in filteredItems"
              :key="item.ocorrenciaId"
              class="report-list-item"
            >
              <button
                type="button"
                class="report-item-btn"
                :class="{ 'is-selected': selectedItem?.ocorrenciaId === item.ocorrenciaId }"
                :aria-current="selectedItem?.ocorrenciaId === item.ocorrenciaId ? 'true' : undefined"
                :data-item-id="item.ocorrenciaId"
                @click="selectIncident(item, { openDetail: true })"
              >
                <div class="report-item-top">
                  <span
                    class="natureza-pill"
                    :class="item.natureza === 'urbana' ? 'pill-urbana' : 'pill-transito'"
                  >
                    <span aria-hidden="true">{{ naturezaIcon(item.natureza) }}</span>
                    {{ naturezaLabel(item.natureza) }}
                  </span>

                  <!-- Selo de 2ª / 3ª vez reportada -->
                  <span v-if="item.total_reports > 1" class="repeat-report-badge">
                    <span aria-hidden="true">🔁</span> Reportada {{ item.total_reports }} vezes
                  </span>

                  <!-- Selo de Possível Duplicidade -->
                  <span v-if="item.possivel_duplicidade" class="duplicity-panel-badge">
                    <span aria-hidden="true">⚠️</span> {{ item.rotulo_duplicidade || 'Possível duplicidade' }}
                  </span>

                  <!-- Selo de ocorrência em revisão de denúncia (no mapa com foto oculta) -->
                  <span
                    v-if="item.em_revisao_denuncia && !item.revisada"
                    class="map-visibility-badge is-map-review"
                  >
                    <span aria-hidden="true">🚩</span> Em revisão de denúncia
                  </span>
                </div>

                <div class="report-item-location">
                  {{ formatShortLocation(item) }}
                </div>

                <p class="report-item-reason">
                  “{{ item.motivo_report || item.motivo_denuncia || 'Motivo não especificado' }}”
                </p>

                <div class="report-item-footer">
                  <span class="report-item-date">
                    {{ formatDateTime(item.ultima_data_report || item.data_report) }}
                  </span>

                  <span
                    v-if="item.revisada"
                    class="verdict-mini-badge"
                    :class="`verdict-${getVerdictInfo(item.resultado_revisao).tone}`"
                  >
                    <span aria-hidden="true">{{ getVerdictInfo(item.resultado_revisao).icon }}</span>
                    {{ getVerdictInfo(item.resultado_revisao).label }}
                  </span>
                  <span v-else class="verdict-mini-badge verdict-pendente">
                    <span aria-hidden="true">⏳</span> Pendente
                  </span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- COLUNA DIREITA: Detalhes da Ocorrência + Foto + Ações de Validação -->
      <section class="detail-column" aria-labelledby="reports-detail-heading">
        <button
          v-if="isMobile"
          type="button"
          class="btn-back-to-list"
          @click="backToList"
        >
          <span aria-hidden="true">←</span> Voltar à lista
        </button>

        <div v-if="!selectedItem" class="detail-empty-state">
          <span class="empty-icon" aria-hidden="true">👈</span>
          <h3 id="reports-detail-heading" ref="detailHeadingRef" tabindex="-1" class="empty-title">
            Selecione uma ocorrência na lista
          </h3>
          <p class="empty-desc">
            Escolha um item da lista para ver a foto, os motivos da denúncia e decidir.
          </p>
        </div>

        <div v-else class="detail-card">
          <!-- Cabeçalho de Status da Ocorrência Selecionada -->
          <div class="detail-header">
            <div class="detail-header-main">
              <h3 id="reports-detail-heading" ref="detailHeadingRef" tabindex="-1" class="detail-title">
                {{ formatShortLocation(selectedItem) }}
              </h3>
              <div class="detail-header-badges">
                <span
                  class="natureza-pill"
                  :class="selectedItem.natureza === 'urbana' ? 'pill-urbana' : 'pill-transito'"
                >
                  <span aria-hidden="true">{{ naturezaIcon(selectedItem.natureza) }}</span>
                  {{ naturezaLabel(selectedItem.natureza) }}
                </span>

                <span
                  v-if="selectedItem.total_reports > 1"
                  class="repeat-report-badge repeat-badge-lg"
                >
                  <span aria-hidden="true">🔁</span> Reportada {{ selectedItem.total_reports }} vezes
                </span>

                <span
                  v-if="selectedItem.possivel_duplicidade"
                  class="duplicity-panel-badge repeat-badge-lg"
                >
                  <span aria-hidden="true">⚠️</span> {{ selectedItem.rotulo_duplicidade || 'Possível duplicidade' }}
                </span>

                <span class="map-visibility-badge" :class="getMapStatus(selectedItem).cls">
                  <span aria-hidden="true">{{ getMapStatus(selectedItem).icon }}</span>
                  {{ getMapStatus(selectedItem).label }}
                </span>
              </div>
            </div>

            <div class="copy-code-wrap">
              <button
                type="button"
                class="btn-copy-code"
                @click="copyCode(selectedItem.ocorrenciaId, 'main')"
              >
                <span aria-hidden="true">📋</span>
                {{ copiedKey === 'main' ? 'Código copiado' : 'Copiar código' }}
              </button>
              <p v-if="copyFallbackCode" class="copy-fallback">
                Não foi possível copiar automaticamente. Código: <code>{{ copyFallbackCode }}</code>
              </p>
            </div>
          </div>

          <p v-if="selectedItem.possivel_duplicidade" class="duplicity-explainer">
            O sistema identificou automaticamente que esta ocorrência pode ser do mesmo veículo ou problema de outra registrada recentemente a até 10 metros. Compare as fotos antes de decidir.
          </p>

          <!-- Grid Interno: Foto + Painel de Decisão -->
          <div class="detail-content-split">
            <!-- Bloco da Foto (com comparativo da 1ª denúncia caso seja possível duplicidade) -->
            <div class="detail-photo-box">
              <div
                v-if="
                  selectedItem.duplicidade_original_fotoUrl &&
                  (isDuplicityReviewItem(selectedItem) || selectedItem.resultado_revisao === 'duplicidade')
                "
                class="duplicity-photo-compare-grid"
              >
                <div class="duplicity-photo-compare-col">
                  <div class="duplicity-compare-label-row">
                    <span class="duplicity-compare-label">1ª ocorrência (original)</span>
                    <button
                      v-if="selectedItem.duplicidade_de_id"
                      type="button"
                      class="btn-copy-code btn-copy-code-sm"
                      @click="copyCode(selectedItem.duplicidade_de_id, 'orig')"
                    >
                      {{ copiedKey === 'orig' ? 'Código copiado' : 'Copiar código da original' }}
                    </button>
                  </div>
                  <div class="photo-wrapper">
                    <img
                      :src="currentAdminOrigDuplicityPhotoUrl"
                      alt="Foto da 1ª ocorrência (original)"
                      class="detail-photo-img"
                      @click="openPanelLightbox(currentAdminOrigDuplicityPhotoUrl)"
                    />
                    <button
                      v-if="selectedItemOrigDuplicityPhotosList.length > 1"
                      type="button"
                      class="btn-switch-photo-corner"
                      :aria-label="`Trocar foto da original (mostrando ${adminOrigDuplicityPhotoIndex + 1} de ${selectedItemOrigDuplicityPhotosList.length})`"
                      @click.stop="toggleAdminOrigDuplicityPhoto"
                    >
                      <span aria-hidden="true">📷</span>
                      <span aria-hidden="true">Foto {{ adminOrigDuplicityPhotoIndex + 1 }}/{{ selectedItemOrigDuplicityPhotosList.length }}</span>
                      <span aria-hidden="true">⇄</span>
                    </button>
                    <button
                      type="button"
                      class="btn-expand-photo"
                      @click="openPanelLightbox(currentAdminOrigDuplicityPhotoUrl)"
                    >
                      <span aria-hidden="true">🔍</span> Ampliar foto da 1ª ocorrência
                    </button>
                  </div>
                </div>

                <div class="duplicity-photo-compare-col">
                  <span class="duplicity-compare-label is-second-photo">2ª ocorrência (possível duplicidade)</span>
                  <div v-if="currentAdminSelectedPhotoUrl" class="photo-wrapper">
                    <img
                      :src="currentAdminSelectedPhotoUrl"
                      alt="Foto da 2ª ocorrência (possível duplicidade)"
                      class="detail-photo-img"
                      @click="openPanelLightbox(currentAdminSelectedPhotoUrl)"
                    />
                    <button
                      v-if="selectedItemPhotosList.length > 1"
                      type="button"
                      class="btn-switch-photo-corner"
                      :aria-label="`Trocar foto (mostrando ${adminSelectedPhotoIndex + 1} de ${selectedItemPhotosList.length})`"
                      @click.stop="toggleAdminSelectedPhoto"
                    >
                      <span aria-hidden="true">📷</span>
                      <span aria-hidden="true">Foto {{ adminSelectedPhotoIndex + 1 }}/{{ selectedItemPhotosList.length }}</span>
                      <span aria-hidden="true">⇄</span>
                    </button>
                    <button
                      type="button"
                      class="btn-expand-photo"
                      @click="openPanelLightbox(currentAdminSelectedPhotoUrl)"
                    >
                      <span aria-hidden="true">🔍</span> Ampliar foto da 2ª ocorrência
                    </button>
                  </div>
                  <div v-else class="photo-missing">
                    <span><span aria-hidden="true">🖼️</span> Sem foto disponível</span>
                  </div>
                </div>
              </div>

              <div v-else-if="currentAdminSelectedPhotoUrl" class="photo-wrapper">
                <img
                  :src="currentAdminSelectedPhotoUrl"
                  alt="Foto da ocorrência reportada"
                  class="detail-photo-img"
                  @click="openPanelLightbox(currentAdminSelectedPhotoUrl)"
                />
                <button
                  v-if="selectedItemPhotosList.length > 1"
                  type="button"
                  class="btn-switch-photo-corner"
                  :aria-label="`Trocar foto (mostrando ${adminSelectedPhotoIndex + 1} de ${selectedItemPhotosList.length})`"
                  @click.stop="toggleAdminSelectedPhoto"
                >
                  <span aria-hidden="true">📷</span>
                  <span aria-hidden="true">Foto {{ adminSelectedPhotoIndex + 1 }}/{{ selectedItemPhotosList.length }}</span>
                  <span aria-hidden="true">⇄</span>
                </button>
                <button
                  type="button"
                  class="btn-expand-photo"
                  @click="openPanelLightbox(currentAdminSelectedPhotoUrl)"
                >
                  <span aria-hidden="true">🔍</span> Ampliar foto
                </button>
              </div>
              <div v-else class="photo-missing">
                <span><span aria-hidden="true">🖼️</span> Sem foto disponível</span>
              </div>
            </div>

            <!-- Bloco de Motivos Reportados & Decisão -->
            <div class="detail-moderation-box">
              <!-- Histórico de Solicitações de Revisão + decisão registrada -->
              <div class="reports-history-box">
                <div class="history-box-header">
                  <h4 class="box-section-title">{{ historyTitle }}</h4>
                  <span v-if="selectedItem.outras_revisoes_solicitadas" class="multi-review-tag">
                    Outras revisões solicitadas
                  </span>
                </div>

                <ol class="history-timeline">
                  <li
                    v-for="(entry, idx) in selectedItem.historico_reports || []"
                    :key="`${idx}-${entry.data}`"
                    class="history-entry"
                  >
                    <div class="history-entry-meta">
                      <span class="history-step-num">{{ getHistoryStepLabel(entry, idx) }}</span>
                      <span class="history-step-date">{{ formatDateTime(entry.data) }}</span>
                      <span v-if="entry.apos_revisao" class="history-after-review-tag">
                        Após decisão anterior
                      </span>
                    </div>
                    <p class="history-entry-reason">“{{ entry.motivo }}”</p>
                  </li>

                  <li
                    v-if="selectedItem.revisada"
                    class="history-entry is-decision-entry"
                    :class="`is-tone-${getVerdictInfo(selectedItem.resultado_revisao).tone}`"
                  >
                    <div class="history-entry-meta">
                      <span class="history-step-num">Decisão da moderação</span>
                      <span v-if="selectedItem.data_revisao" class="history-step-date">
                        {{ formatDateTime(selectedItem.data_revisao) }}
                      </span>
                    </div>
                    <p class="history-entry-reason">
                      <span aria-hidden="true">{{ getVerdictInfo(selectedItem.resultado_revisao).icon }}</span>
                      {{ getVerdictInfo(selectedItem.resultado_revisao).label }}
                    </p>
                    <p v-if="selectedItem.observacao_admin" class="history-entry-note">
                      <strong>Nota interna:</strong> {{ selectedItem.observacao_admin }}
                    </p>
                  </li>
                </ol>
              </div>

              <!-- Banner caso já tenha sido revisada -->
              <div
                v-if="selectedItem.revisada"
                ref="resultBannerRef"
                tabindex="-1"
                class="reviewed-status-banner"
                :class="`banner-${getVerdictInfo(selectedItem.resultado_revisao).tone}`"
              >
                <div class="banner-title">
                  <span aria-hidden="true">{{ getVerdictInfo(selectedItem.resultado_revisao).icon }}</span>
                  {{ getReviewedBannerTitle(selectedItem.resultado_revisao) }}
                </div>
                <div v-if="selectedItem.data_revisao" class="banner-meta">
                  Decidida em {{ formatDateTime(selectedItem.data_revisao) }}
                  <span v-if="selectedItem.revisado_por"> por {{ selectedItem.revisado_por }}</span>
                </div>
                <p class="banner-obs">
                  <strong>Nota interna:</strong>
                  {{ selectedItem.observacao_admin || 'nenhuma nota registrada.' }}
                </p>
              </div>

              <p v-if="decisionSuccess" class="user-success-alert">
                {{ decisionSuccess }}
              </p>

              <div v-if="selectedItem.revisada && hasNextPending" class="next-pending-row">
                <button type="button" class="btn-next-pending" @click="goToNextPending">
                  Próximo pendente <span aria-hidden="true">→</span>
                </button>
                <span class="next-pending-count">{{ nextPendingCountLabel }}</span>
              </div>
              <p
                v-else-if="selectedItem.revisada && recentlyDecidedId === selectedItem.ocorrenciaId"
                class="next-pending-count"
              >
                Não há mais ocorrências pendentes.
              </p>

              <h4 v-if="selectedItem.revisada" class="box-section-title">Alterar a decisão</h4>
              <h4 v-else class="box-section-title">Sua decisão</h4>

              <!-- Nota interna (textarea com contador) -->
              <div class="admin-note-field">
                <label for="admin-obs-input" class="field-label">
                  Nota interna (opcional)
                </label>
                <textarea
                  id="admin-obs-input"
                  v-model="adminNote"
                  :maxlength="NOTE_MAX"
                  rows="3"
                  placeholder="Ex.: foto nítida mostrando o veículo sobre a faixa de pedestres..."
                  class="field-input note-textarea"
                  aria-describedby="admin-obs-hint admin-obs-counter"
                  :disabled="isSubmittingDecision"
                ></textarea>
                <div class="note-field-footer">
                  <span id="admin-obs-hint" class="note-hint">Visível só para a equipe e registrada no histórico.</span>
                  <span id="admin-obs-counter" class="note-counter">{{ adminNote.length }}/{{ NOTE_MAX }} caracteres</span>
                </div>
              </div>

              <p v-if="decisionError" class="login-error-alert" role="alert">
                {{ decisionError }}
              </p>

              <!-- Confirmação inline para ações destrutivas -->
              <div
                v-if="pendingConfirm"
                class="confirm-inline"
                role="group"
                aria-labelledby="reports-confirm-title"
                aria-describedby="reports-confirm-summary"
                @keydown.esc.prevent="cancelConfirm"
              >
                <p id="reports-confirm-title" class="confirm-inline-title">
                  <span aria-hidden="true">⚠️</span> {{ pendingConfirm.title }}
                </p>
                <p id="reports-confirm-summary" class="confirm-inline-summary">{{ pendingConfirm.summary }}</p>
                <p v-if="adminNote.trim()" class="confirm-inline-summary">
                  <strong>Nota interna:</strong> {{ adminNote.trim() }}
                </p>
                <p class="confirm-inline-hint">
                  Se precisar, você poderá alterar esta decisão depois, na lista “Revisadas”.
                </p>
                <div class="confirm-inline-actions">
                  <button
                    ref="confirmCancelBtnRef"
                    type="button"
                    class="btn-confirm-cancel"
                    :disabled="isSubmittingDecision"
                    @click="cancelConfirm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    class="btn-confirm-destructive"
                    :disabled="isSubmittingDecision"
                    @click="confirmPendingDecision"
                  >
                    {{ isSubmittingDecision ? 'Salvando...' : 'Confirmar remoção' }}
                  </button>
                </div>
              </div>

              <!-- Botões de Ação para POSSÍVEL DUPLICIDADE (Não é duplicidade | Indefinido | É duplicidade) -->
              <div
                v-else-if="isDuplicityReviewItem(selectedItem)"
                class="decision-actions-stack"
              >
                <div class="decision-option">
                  <button
                    type="button"
                    class="btn-action btn-action-positive"
                    :disabled="isSubmittingDecision"
                    aria-describedby="reports-dup-keep-desc"
                    @click="handleReviewDecision('nao_duplicidade')"
                  >
                    Não é duplicidade — manter e contar
                  </button>
                  <p id="reports-dup-keep-desc" class="decision-option-desc">A ocorrência continua no mapa e passa a contar nas estatísticas.</p>
                </div>

                <div class="decision-option">
                  <button
                    type="button"
                    class="btn-action btn-action-neutral"
                    :disabled="isSubmittingDecision"
                    aria-describedby="reports-dup-undefined-desc"
                    @click="handleReviewDecision('indefinido')"
                  >
                    Indefinido — manter agrupada
                  </button>
                  <p id="reports-dup-undefined-desc" class="decision-option-desc">Continua no mapa agrupada com a original, sem contar nas estatísticas.</p>
                </div>

                <div class="decision-option">
                  <button
                    type="button"
                    class="btn-action btn-action-destructive"
                    :disabled="isSubmittingDecision"
                    aria-describedby="reports-dup-remove-desc"
                    @click="requestDuplicityRemoval"
                  >
                    É duplicidade — remover do mapa
                  </button>
                  <p id="reports-dup-remove-desc" class="decision-option-desc">A ocorrência sai do mapa público. Pede confirmação antes de salvar.</p>
                </div>
              </div>

              <!-- Fluxo principal: Manter no mapa | Remover do mapa (com motivo obrigatório) -->
              <div v-else class="decision-actions-stack">
                <div class="decision-option">
                  <button
                    type="button"
                    class="btn-action btn-action-positive"
                    :disabled="isSubmittingDecision"
                    aria-describedby="reports-keep-desc"
                    @click="handleReviewDecision('improcedente')"
                  >
                    Manter no mapa e mostrar a foto
                  </button>
                  <p id="reports-keep-desc" class="decision-option-desc">A denúncia não procede: a ocorrência continua no mapa e a foto volta a aparecer para o público.</p>
                </div>

                <fieldset
                  class="removal-group"
                  :disabled="isSubmittingDecision"
                  :aria-describedby="motiveError ? 'reports-removal-hint reports-motive-error' : 'reports-removal-hint'"
                >
                  <legend class="removal-legend">
                    <span aria-hidden="true">🚫</span> Remover do mapa
                  </legend>
                  <p id="reports-removal-hint" class="removal-hint">
                    A ocorrência deixa de aparecer no mapa público. Escolha o motivo (obrigatório):
                  </p>
                  <label class="removal-option">
                    <input
                      id="reports-motive-procedente"
                      v-model="removalMotive"
                      type="radio"
                      name="reports-removal-motive"
                      value="procedente"
                    />
                    <span><strong>Procedente:</strong> a ocorrência tem problema</span>
                  </label>
                  <label class="removal-option">
                    <input
                      v-model="removalMotive"
                      type="radio"
                      name="reports-removal-motive"
                      value="duplicidade"
                    />
                    <span><strong>É duplicidade</strong> de outra ocorrência já registrada</span>
                  </label>
                  <p v-if="motiveError" id="reports-motive-error" class="motive-error" role="alert">
                    {{ motiveError }}
                  </p>
                  <div class="decision-option">
                    <button
                      type="button"
                      class="btn-action btn-action-destructive btn-removal-submit"
                      aria-describedby="reports-remove-desc"
                      @click="requestRemoval"
                    >
                      Remover do mapa
                    </button>
                    <p id="reports-remove-desc" class="decision-option-desc">Pede confirmação antes de salvar.</p>
                  </div>
                </fieldset>
              </div>
            </div>
          </div>

          <!-- Dados Completos da Ocorrência -->
          <div class="detail-metadata-box">
            <h4 class="box-section-title">Dados da ocorrência</h4>
            <div class="metadata-grid">
              <div class="meta-item">
                <span class="meta-label">Data da ocorrência</span>
                <span class="meta-value">{{ formatDateTime(selectedItem.data) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Cidade / UF</span>
                <span class="meta-value">
                  {{ [selectedItem.cidade, selectedItem.estado].filter(Boolean).join(' / ') || 'Não informada' }}
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Logradouro / Bairro</span>
                <span class="meta-value">
                  {{ [selectedItem.rua, selectedItem.bairro].filter(Boolean).join(' - ') || 'Não informado' }}
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Classificação / Verificação</span>
                <span class="meta-value">
                  {{ [selectedItem.classificacao ? `Classe ${selectedItem.classificacao}` : '', selectedItem.verificacao].filter(Boolean).join(' • ') || 'Padrão' }}
                </span>
              </div>
              <div class="meta-item meta-item-full">
                <span class="meta-label">Localização</span>
                <div class="meta-value meta-coords-row">
                  <button
                    v-if="hasCoords(selectedItem)"
                    type="button"
                    class="btn-open-multei-map"
                    @click="openMulteiLocationModalFor(selectedItem)"
                  >
                    <span aria-hidden="true">🗺️</span> Abrir local no Multei
                  </button>
                  <details v-if="hasCoords(selectedItem)" class="coords-details">
                    <summary>Ver coordenadas</summary>
                    <span class="coords-value">{{ formatCoords(selectedItem) }}</span>
                  </details>
                  <span v-else>Coordenadas não informadas</span>
                </div>
              </div>
              <div
                v-if="selectedItem.natureza === 'urbana' || selectedItem.descricao"
                class="meta-item meta-item-full"
              >
                <span class="meta-label">Descrição da ocorrência</span>
                <span class="meta-value">{{ selectedItem.descricao || 'Não informada' }}</span>
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
  refreshCurrentMulteiPanelProfile,
  fetchReportedIncidentsForPanel,
  reviewReportedIncidentInFirebase,
  type ReportedIncidentPanelItem,
  type ReportReviewDecision
} from '~/services/firebaseService';
import {
  useMulteiPanelShared,
  formatPanelDateTime as formatDateTime
} from '~/composables/useMulteiPanelShared';

// Aba "Ocorrências Reportadas" (exclusiva Admin). Montada enquanto o admin estiver logado;
// `active` só controla a exibição, para preservar estado/filtros ao trocar de aba.
defineProps<{ active: boolean }>();

const emit = defineEmits<{
  (e: 'pending-count', count: number): void;
}>();

const { userProfile, announceSr, openPanelLightbox, openMulteiLocationModalFor } = useMulteiPanelShared();

type SubTab = 'pendentes' | 'revisadas';
type RemovalMotive = '' | 'procedente' | 'duplicidade';
type DecisionTone = 'positive' | 'destructive' | 'neutral';

const SUB_TABS: SubTab[] = ['pendentes', 'revisadas'];
const NOTE_MAX = 500;
const MOBILE_QUERY = '(max-width: 960px)';

const rootRef = ref<HTMLElement | null>(null);
const detailHeadingRef = ref<HTMLElement | null>(null);
const resultBannerRef = ref<HTMLElement | null>(null);
const confirmCancelBtnRef = ref<HTMLButtonElement | null>(null);

const allReports = ref<ReportedIncidentPanelItem[]>([]);
const isLoadingReports = ref(false);
const activeTab = ref<SubTab>('pendentes');
const selectedItem = ref<ReportedIncidentPanelItem | null>(null);

// Filtros da Aba 1: Ocorrências Reportadas (Admin)
const reportFilterEstado = ref('');
const reportFilterCidade = ref('');
const reportFilterBairro = ref('');
const reportFilterNatureza = ref<'' | 'transito' | 'urbana'>('');

const handleReportEstadoFilterChange = () => {
  if (reportFilterEstado.value) {
    reportFilterCidade.value = getCapitalByState(reportFilterEstado.value);
  } else {
    reportFilterCidade.value = '';
  }
  reportFilterBairro.value = '';
};

const clearReportFilters = () => {
  reportFilterEstado.value = '';
  reportFilterCidade.value = '';
  reportFilterBairro.value = '';
  reportFilterNatureza.value = '';
};

const hasActiveReportFilters = computed(() =>
  Boolean(
    reportFilterEstado.value ||
      reportFilterCidade.value.trim() ||
      reportFilterBairro.value.trim() ||
      reportFilterNatureza.value
  )
);

const availableReportBairros = computed(() => {
  const targetUf = reportFilterEstado.value.trim().toUpperCase();
  const targetCity = normalizeSearchText(reportFilterCidade.value);
  const set = new Set<string>();

  for (const item of allReports.value) {
    const itemUf = (normalizeState(item.estado || '') || item.estado || '').trim().toUpperCase();
    if (targetUf && itemUf !== targetUf) continue;
    if (targetCity && normalizeSearchText(item.cidade) !== targetCity) continue;
    const b = (item.bairro || '').trim();
    if (b) set.add(b);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
});

const adminNote = ref('');
const isSubmittingDecision = ref(false);
const decisionError = ref('');
const decisionSuccess = ref('');

// Decisão recém-tomada: o item continua selecionado (com o banner de resultado) mesmo
// saindo da lista "Pendentes". Não há avanço automático (decisão do usuário).
const recentlyDecidedId = ref<string | null>(null);

// "Remover do mapa" exige um motivo (procedente ou duplicidade)
const removalMotive = ref<RemovalMotive>('');
const motiveError = ref('');

watch(removalMotive, (val) => {
  if (val) motiveError.value = '';
});

// Confirmação inline das ações destrutivas
interface PendingConfirm {
  decision: ReportReviewDecision;
  title: string;
  summary: string;
}
const pendingConfirm = ref<PendingConfirm | null>(null);
let confirmReturnFocusEl: HTMLElement | null = null;

const adminSelectedPhotoIndex = ref(0);
const adminOrigDuplicityPhotoIndex = ref(0);

watch(
  () => selectedItem.value?.ocorrenciaId,
  () => {
    adminSelectedPhotoIndex.value = 0;
    adminOrigDuplicityPhotoIndex.value = 0;
    pendingConfirm.value = null;
    removalMotive.value = '';
    motiveError.value = '';
    copyFallbackCode.value = '';
    copiedKey.value = '';
  }
);

const selectedItemPhotosList = computed(() => {
  const item = selectedItem.value;
  if (!item) return [];
  if (Array.isArray(item.fotosUrls) && item.fotosUrls.length > 0) {
    return item.fotosUrls.filter(Boolean);
  }
  return [item.fotoUrl, item.fotoUrl2].filter(Boolean) as string[];
});

const currentAdminSelectedPhotoUrl = computed(() => {
  const list = selectedItemPhotosList.value;
  if (list.length === 0) return selectedItem.value?.fotoUrl || '';
  return list[adminSelectedPhotoIndex.value] || list[0];
});

const toggleAdminSelectedPhoto = () => {
  const list = selectedItemPhotosList.value;
  if (list.length <= 1) return;
  adminSelectedPhotoIndex.value = (adminSelectedPhotoIndex.value + 1) % list.length;
};

const selectedItemOrigDuplicityPhotosList = computed(() => {
  const item = selectedItem.value;
  if (!item) return [];
  return [
    item.duplicidade_original_fotoUrl,
    item.duplicidade_original_fotoUrl2
  ].filter(Boolean) as string[];
});

const currentAdminOrigDuplicityPhotoUrl = computed(() => {
  const list = selectedItemOrigDuplicityPhotosList.value;
  if (list.length === 0) return selectedItem.value?.duplicidade_original_fotoUrl || '';
  return list[adminOrigDuplicityPhotoIndex.value] || list[0];
});

const toggleAdminOrigDuplicityPhoto = () => {
  const list = selectedItemOrigDuplicityPhotosList.value;
  if (list.length <= 1) return;
  adminOrigDuplicityPhotoIndex.value = (adminOrigDuplicityPhotoIndex.value + 1) % list.length;
};

const baseFilteredReports = computed(() => {
  const targetUf = reportFilterEstado.value.trim().toUpperCase();
  const targetCity = normalizeSearchText(reportFilterCidade.value);
  const targetBairro = normalizeSearchText(reportFilterBairro.value);
  const targetNatureza = reportFilterNatureza.value;

  return allReports.value.filter((item) => {
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
    if (targetNatureza) {
      const itemNatureza = item.natureza === 'urbana' ? 'urbana' : 'transito';
      if (itemNatureza !== targetNatureza) return false;
    }
    return true;
  });
});

const pendingItems = computed(() =>
  baseFilteredReports.value.filter((item) => !item.revisada)
);

const reviewedItems = computed(() =>
  baseFilteredReports.value.filter((item) => item.revisada)
);

const filteredItems = computed(() =>
  activeTab.value === 'pendentes' ? pendingItems.value : reviewedItems.value
);

const isRecentlyDecided = (item?: ReportedIncidentPanelItem | null) =>
  Boolean(item && recentlyDecidedId.value && item.ocorrenciaId === recentlyDecidedId.value);

watch(filteredItems, (list) => {
  if (!selectedItem.value) {
    selectedItem.value = list[0] || null;
    adminNote.value = selectedItem.value?.observacao_admin || '';
    return;
  }
  // Mantém o item recém-decidido selecionado (mostrando o resultado), mesmo fora da lista atual
  if (isRecentlyDecided(selectedItem.value)) {
    const fresh = allReports.value.find((i) => i.ocorrenciaId === selectedItem.value?.ocorrenciaId);
    if (fresh && fresh !== selectedItem.value) selectedItem.value = fresh;
    return;
  }
  const stillExists = list.some((i) => i.ocorrenciaId === selectedItem.value?.ocorrenciaId);
  if (!stillExists) {
    selectedItem.value = list[0] || null;
    adminNote.value = selectedItem.value?.observacao_admin || '';
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

const loadReports = async (options?: { silent?: boolean } | Event) => {
  if (!userProfile.value || userProfile.value.role !== 'admin') return;
  const isSilent = Boolean(
    options && typeof options === 'object' && 'silent' in options && options.silent && allReports.value.length > 0
  );
  if (!isSilent) {
    isLoadingReports.value = true;
  }
  try {
    if (!userProfile.value.nomeCompleto) {
      const refreshedProfile = await refreshCurrentMulteiPanelProfile();
      if (refreshedProfile) {
        userProfile.value = refreshedProfile;
      }
    }
    const items = await fetchReportedIncidentsForPanel();
    allReports.value = items;
    markUpdated();

    const currentList = activeTab.value === 'pendentes' ? pendingItems.value : reviewedItems.value;
    if (selectedItem.value) {
      const updatedSelected = items.find((i) => i.ocorrenciaId === selectedItem.value?.ocorrenciaId);
      if (
        updatedSelected &&
        (Boolean(updatedSelected.revisada) === (activeTab.value === 'revisadas') ||
          isRecentlyDecided(updatedSelected))
      ) {
        selectedItem.value = updatedSelected;
        if (!isSilent) {
          adminNote.value = updatedSelected.observacao_admin || '';
        }
        return;
      }
    }
    recentlyDecidedId.value = null;
    selectedItem.value = currentList[0] || null;
    adminNote.value = selectedItem.value?.observacao_admin || '';
  } catch (err) {
    console.warn('[painel] Erro ao carregar reportadas:', err);
  } finally {
    if (!isSilent) {
      isLoadingReports.value = false;
    }
  }
};

const resetTransientDecisionState = () => {
  decisionError.value = '';
  decisionSuccess.value = '';
  recentlyDecidedId.value = null;
  pendingConfirm.value = null;
};

const selectTab = (tab: SubTab) => {
  activeTab.value = tab;
  resetTransientDecisionState();
  const list = tab === 'pendentes' ? pendingItems.value : reviewedItems.value;
  selectedItem.value = list[0] || null;
  adminNote.value = selectedItem.value?.observacao_admin || '';
};

// Navegação por teclado nas sub-abas (padrão ARIA: setas, Home e End; ativação automática)
const onSubTabKeydown = (event: KeyboardEvent) => {
  const currentIdx = SUB_TABS.indexOf(activeTab.value);
  let nextIdx = -1;
  if (event.key === 'ArrowRight') nextIdx = (currentIdx + 1) % SUB_TABS.length;
  else if (event.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + SUB_TABS.length) % SUB_TABS.length;
  else if (event.key === 'Home') nextIdx = 0;
  else if (event.key === 'End') nextIdx = SUB_TABS.length - 1;
  if (nextIdx < 0) return;
  event.preventDefault();
  const nextTab = SUB_TABS[nextIdx] as SubTab;
  if (nextTab !== activeTab.value) selectTab(nextTab);
  void nextTick(() => {
    document.getElementById(`reports-subtab-${nextTab}`)?.focus();
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
  const targetId = selectedItem.value?.ocorrenciaId || '';
  mobileDetailOpen.value = false;
  await nextTick();
  let target: HTMLElement | null = null;
  if (targetId && rootRef.value) {
    const buttons = Array.from(rootRef.value.querySelectorAll<HTMLElement>('[data-item-id]'));
    target = buttons.find((btn) => btn.dataset.itemId === targetId) || null;
  }
  (target || document.getElementById(`reports-subtab-${activeTab.value}`))?.focus();
};

const selectIncident = (item: ReportedIncidentPanelItem, opts?: { openDetail?: boolean }) => {
  if (selectedItem.value?.ocorrenciaId !== item.ocorrenciaId) {
    resetTransientDecisionState();
  }
  selectedItem.value = item;
  adminNote.value = item.observacao_admin || '';
  decisionError.value = '';
  if (opts?.openDetail) void openMobileDetail();
};

const isDuplicityReviewItem = (item?: ReportedIncidentPanelItem | null): boolean => {
  if (!item) return false;
  return Boolean(item.possivel_duplicidade || item.resultado_revisao === 'indefinido');
};

const naturezaIcon = (natureza?: string) => (natureza === 'urbana' ? '🚧' : '🚗');
const naturezaLabel = (natureza?: string) =>
  natureza === 'urbana' ? 'Mobilidade urbana' : 'Infração de trânsito';

const getMapStatus = (item: ReportedIncidentPanelItem) => {
  if (item.ativo && item.em_revisao_denuncia && !item.revisada) {
    return { cls: 'is-map-review', icon: '🚩', label: 'No mapa • Em revisão de denúncia (foto oculta ao público)' };
  }
  if (item.ativo) {
    return { cls: 'is-map-active', icon: '🟢', label: 'No mapa' };
  }
  return { cls: 'is-map-inactive', icon: '🔴', label: 'Fora do mapa' };
};

const getVerdictInfo = (
  decision?: ReportReviewDecision | ''
): { tone: DecisionTone; icon: string; label: string } => {
  if (decision === 'nao_duplicidade') return { tone: 'positive', icon: '✅', label: 'Não é duplicidade — mantida e contada' };
  if (decision === 'indefinido') return { tone: 'neutral', icon: '⚖️', label: 'Indefinido — mantida agrupada' };
  if (decision === 'duplicidade') return { tone: 'destructive', icon: '🚫', label: 'Duplicidade — removida do mapa' };
  if (decision === 'procedente') return { tone: 'destructive', icon: '🚫', label: 'Removida do mapa' };
  return { tone: 'positive', icon: '✅', label: 'Mantida no mapa' };
};

const getReviewedBannerTitle = (decision?: ReportReviewDecision | ''): string => {
  if (decision === 'nao_duplicidade') {
    return 'Não é duplicidade: mantida no mapa e contada nas estatísticas.';
  }
  if (decision === 'indefinido') {
    return 'Indefinido: mantida no mapa agrupada com a original, sem contar nas estatísticas.';
  }
  if (decision === 'duplicidade') {
    return 'Removida do mapa por ser duplicidade de outra ocorrência.';
  }
  if (decision === 'procedente') {
    return 'Removida do mapa: a denúncia procede (a ocorrência tem problema).';
  }
  return 'Mantida no mapa com a foto visível: a denúncia não procede.';
};

const historyTitle = computed(() => {
  const item = selectedItem.value;
  if (!item) return '';
  if (isDuplicityReviewItem(item) && item.total_reports <= 1) {
    return 'Possível duplicidade detectada automaticamente';
  }
  if (item.total_reports > 1) return `Solicitações de revisão (${item.total_reports})`;
  return 'Motivo do reporte';
});

const getHistoryStepLabel = (entry: { motivo?: string }, idx: number) =>
  idx === 0 && entry.motivo?.startsWith('Possível duplicidade detectada pelo sistema')
    ? 'Detecção automática'
    : `${idx + 1}ª solicitação`;

const hasNextPending = computed(() =>
  pendingItems.value.some((i) => i.ocorrenciaId !== selectedItem.value?.ocorrenciaId)
);

const nextPendingCountLabel = computed(() => {
  const count = pendingItems.value.filter((i) => i.ocorrenciaId !== selectedItem.value?.ocorrenciaId).length;
  return count === 1 ? '1 ocorrência pendente' : `${count} ocorrências pendentes`;
});

const goToNextPending = async () => {
  const next = pendingItems.value.find((i) => i.ocorrenciaId !== selectedItem.value?.ocorrenciaId);
  if (!next) return;
  resetTransientDecisionState();
  activeTab.value = 'pendentes';
  selectedItem.value = next;
  adminNote.value = next.observacao_admin || '';
  await focusDetailHeading();
};

const formatShortLocation = (item: ReportedIncidentPanelItem) => {
  const cityState = [item.cidade, item.estado].filter(Boolean).join('/');
  const streetPart = [item.rua, item.bairro].filter(Boolean).join(' - ');
  if (streetPart && cityState) return `${streetPart} (${cityState})`;
  return streetPart || cityState || 'Local sem endereço informado';
};

const hasCoords = (item: ReportedIncidentPanelItem) =>
  Boolean(Number(item.latitude) && Number(item.longitude));

const formatCoords = (item: ReportedIncidentPanelItem) =>
  `${Number(item.latitude).toFixed(6)}, ${Number(item.longitude).toFixed(6)}`;

// "Copiar código" (o ID técnico só é exposto por aqui)
const copiedKey = ref('');
const copyFallbackCode = ref('');
let copiedResetTimer: ReturnType<typeof setTimeout> | null = null;

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

const openConfirm = async (decision: ReportReviewDecision) => {
  const item = selectedItem.value;
  if (!item) return;
  confirmReturnFocusEl = (document.activeElement as HTMLElement | null) || null;
  const where = formatShortLocation(item);
  const reason =
    decision === 'duplicidade'
      ? 'é duplicidade de outra ocorrência já registrada'
      : 'a denúncia procede (a ocorrência tem problema)';
  pendingConfirm.value = {
    decision,
    title: 'Confirmar remoção do mapa?',
    summary: `A ocorrência em ${where} deixará de aparecer no mapa público. Motivo: ${reason}.`
  };
  decisionError.value = '';
  await nextTick();
  confirmCancelBtnRef.value?.focus();
};

const cancelConfirm = async () => {
  pendingConfirm.value = null;
  await nextTick();
  const el = confirmReturnFocusEl;
  confirmReturnFocusEl = null;
  if (el && el.isConnected) el.focus();
};

const requestRemoval = () => {
  if (!removalMotive.value) {
    motiveError.value = 'Escolha o motivo da remoção antes de continuar.';
    void nextTick(() => document.getElementById('reports-motive-procedente')?.focus());
    return;
  }
  void openConfirm(removalMotive.value);
};

const requestDuplicityRemoval = () => {
  void openConfirm('duplicidade');
};

const confirmPendingDecision = async () => {
  const pending = pendingConfirm.value;
  if (!pending) return;
  const ok = await handleReviewDecision(pending.decision);
  if (ok) {
    pendingConfirm.value = null;
    confirmReturnFocusEl = null;
  }
};

const handleReviewDecision = async (decision: ReportReviewDecision): Promise<boolean> => {
  if (!selectedItem.value || isSubmittingDecision.value) return false;
  isSubmittingDecision.value = true;
  decisionError.value = '';
  decisionSuccess.value = '';

  try {
    const reviewerLabel = userProfile.value?.nomeCompleto
      ? `${userProfile.value.nomeCompleto} (${userProfile.value.email})`
      : userProfile.value?.email || '';
    const updated = await reviewReportedIncidentInFirebase({
      item: selectedItem.value,
      decision,
      observacaoAdmin: adminNote.value.slice(0, NOTE_MAX),
      reviewerEmail: reviewerLabel
    });

    // Marca antes de alterar a lista, para o item continuar selecionado
    recentlyDecidedId.value = updated.ocorrenciaId;

    const idx = allReports.value.findIndex((i) => i.ocorrenciaId === updated.ocorrenciaId);
    if (idx !== -1) {
      const clearOrigPhoto = decision === 'nao_duplicidade' || decision === 'improcedente';
      allReports.value[idx] = {
        ...allReports.value[idx],
        ...updated,
        duplicidade_original_fotoUrl: clearOrigPhoto
          ? undefined
          : updated.duplicidade_original_fotoUrl || allReports.value[idx].duplicidade_original_fotoUrl
      };
    }

    const srMessages: Record<ReportReviewDecision, string> = {
      nao_duplicidade: 'Decisão salva: não é duplicidade. A ocorrência continua no mapa e passa a contar nas estatísticas.',
      indefinido: 'Decisão salva: indefinido. A ocorrência continua no mapa agrupada, sem contar nas estatísticas.',
      duplicidade: 'Decisão salva: duplicidade. A ocorrência foi removida do mapa.',
      improcedente: 'Decisão salva: a ocorrência continua no mapa e a foto voltou a aparecer.',
      procedente: 'Decisão salva: a ocorrência foi removida do mapa.'
    };
    const msg = srMessages[decision] || 'Decisão salva.';
    decisionSuccess.value = msg;
    announceSr(msg);

    // Sem avanço automático: o item decidido continua selecionado mostrando o resultado
    selectedItem.value = (idx !== -1 ? allReports.value[idx] : null) || updated;
    adminNote.value = selectedItem.value?.observacao_admin || '';
    removalMotive.value = '';
    pendingConfirm.value = null;
    await nextTick();
    resultBannerRef.value?.focus();
    return true;
  } catch {
    decisionError.value = 'Não foi possível salvar a decisão. Verifique sua conexão e tente novamente.';
    return false;
  } finally {
    isSubmittingDecision.value = false;
  }
};

watch(
  () => pendingItems.value.length,
  (count) => emit('pending-count', count),
  { immediate: true }
);

let liveReportsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleSilentRefresh = () => {
  if (!userProfile.value || userProfile.value.role !== 'admin') return;
  if (liveReportsDebounceTimer) {
    clearTimeout(liveReportsDebounceTimer);
  }
  liveReportsDebounceTimer = setTimeout(() => {
    liveReportsDebounceTimer = null;
    void loadReports({ silent: true });
  }, 350);
};

const focusIncident = async (ocorrenciaId?: string) => {
  activeTab.value = 'pendentes';
  resetTransientDecisionState();
  await loadReports({ silent: true });
  if (ocorrenciaId) {
    const match = pendingItems.value.find((i) => i.ocorrenciaId === ocorrenciaId || i.id === ocorrenciaId);
    if (match) {
      selectedItem.value = match;
      adminNote.value = match.observacao_admin || '';
      void openMobileDetail();
      return;
    }
  }
  if (pendingItems.value[0]) {
    selectedItem.value = pendingItems.value[0];
    adminNote.value = pendingItems.value[0].observacao_admin || '';
    void openMobileDetail();
  }
};

const clearSelection = () => {
  selectedItem.value = null;
  mobileDetailOpen.value = false;
  resetTransientDecisionState();
};

const resetState = () => {
  allReports.value = [];
  selectedItem.value = null;
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
  if (liveReportsDebounceTimer) {
    clearTimeout(liveReportsDebounceTimer);
    liveReportsDebounceTimer = null;
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
  refresh: loadReports,
  scheduleSilentRefresh,
  focusIncident,
  clearSelection,
  resetState
});
</script>

<style scoped src="../../../assets/css/multei-panel.css"></style>

<style scoped>
.repeat-report-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.22rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 900;
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1.5px solid var(--pp-amber-border);
}

.repeat-badge-lg {
  font-size: 0.84rem;
  padding: 0.3rem 0.85rem;
}

.map-visibility-badge {
  font-size: 0.8rem;
  font-weight: 800;
  padding: 0.28rem 0.75rem;
  border-radius: 9999px;
}

.is-map-active {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1.5px solid var(--pp-green-border);
}

.is-map-inactive {
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  border: 1.5px solid var(--pp-red-border);
}

.is-map-review {
  background: #fff7ed;
  color: #9a3412;
  border: 1.5px solid #fb923c;
}

.reports-history-box {
  background: var(--pp-surface-alt);
  border: 1.5px solid var(--pp-border);
  border-radius: 16px;
  padding: 1rem 1.15rem;
}

.history-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.multi-review-tag {
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1px solid var(--pp-amber-border);
}

.history-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.history-entry {
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  background: var(--pp-surface);
  border: 1px solid var(--pp-border);
}

.history-entry.is-decision-entry {
  border-width: 1.5px;
  border-left-width: 5px;
}

.history-entry.is-tone-positive {
  border-color: var(--pp-green-border);
}

.history-entry.is-tone-destructive {
  border-color: var(--pp-red-border);
}

.history-entry.is-tone-neutral {
  border-color: var(--pp-amber-border);
}

.history-entry-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.history-step-num {
  font-size: 0.78rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.history-step-date {
  font-size: 0.76rem;
  color: var(--pp-text-secondary);
}

.history-after-review-tag {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.12rem 0.5rem;
  border-radius: 9999px;
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1px solid var(--pp-amber-border);
}

.history-entry-reason {
  margin: 0;
  font-size: 0.94rem;
  font-weight: 600;
  color: var(--pp-text-primary);
}

.history-entry-note {
  margin: 0.35rem 0 0;
  font-size: 0.86rem;
  color: var(--pp-text-primary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.decision-actions.is-duplicity-decision-grid {
  grid-template-columns: 1fr;
  gap: 0.65rem;
}

.duplicity-photo-compare-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.duplicity-photo-compare-col {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.duplicity-compare-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.duplicity-compare-label {
  display: inline-block;
  padding: 0.3rem 0.65rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 800;
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  border: 1px solid var(--pp-border);
}

.duplicity-compare-label.is-second-photo {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}

.duplicity-explainer {
  margin: -0.5rem 0 1.25rem;
  padding: 0.75rem 0.95rem;
  border-radius: 12px;
  background: #fef3c7;
  color: #92400e;
  border: 1.5px solid #f59e0b;
  font-size: 0.9rem;
  font-weight: 700;
}

/* Cabeçalho do detalhe */
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

.btn-copy-code-sm {
  padding: 0.28rem 0.7rem;
  font-size: 0.76rem;
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
.coords-details summary:focus-visible,
.filter-tab-btn:focus-visible,
.report-item-btn:focus-visible,
.subtab-panel:focus-visible {
  outline: 3px solid var(--pp-accent);
  outline-offset: 2px;
}

/* Grupo "Remover do mapa" com motivo obrigatório */
.decision-actions.is-report-decision-grid {
  align-items: start;
}

.removal-group {
  margin: 0;
  padding: 0.85rem 1rem 1rem;
  border-radius: 16px;
  border: 2px solid var(--pp-red-border);
  background: var(--pp-surface);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.removal-group:disabled {
  opacity: 0.6;
}

.removal-legend {
  padding: 0 0.35rem;
  font-size: 0.98rem;
  font-weight: 900;
  color: var(--pp-red-text);
}

.removal-hint {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--pp-text-secondary);
}

.removal-option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--pp-text-primary);
  cursor: pointer;
}

.removal-option input {
  margin-top: 0.2rem;
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--pp-red-border);
  flex-shrink: 0;
}

.motive-error {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--pp-red-text);
}

.btn-removal-submit {
  margin-top: 0.2rem;
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

/* Banners de resultado (tom pelo efeito) */
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

/* Nota interna (textarea) */
.note-textarea {
  resize: vertical;
  min-height: 84px;
  line-height: 1.45;
}

.note-field-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
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
