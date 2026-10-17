<template>
  <div class="painel-page container" :class="{ 'theme-dark': currentTheme === 'dark' }">
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

        <NuxtLink to="/multei/sobre" class="btn-secondary-nav">
          <span>📊 Estatísticas ao Vivo</span>
        </NuxtLink>
      </div>

      <div v-if="userProfile" class="user-session-bar">
        <span
          class="live-monitor-badge"
          :title="
            userProfile.role === 'admin'
              ? 'Monitoramento em tempo real ativo para novas ocorrências, reports e resoluções'
              : `Monitoramento em tempo real ativo para novas ocorrências em ${userProfile.cidade || 'sua cidade'}`
          "
        >
          <span class="live-monitor-dot" aria-hidden="true"></span>
          <span>Ao vivo</span>
        </span>
        <span class="role-badge" :class="userProfile.role === 'admin' ? 'role-admin' : 'role-parceiro'">
          {{ userProfile.role === 'admin' ? '🛡️ Gestão' : `🤝 Parceria${userProfile.cidade ? ` • ${userProfile.cidade}` : ''}` }}
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
    <section v-else-if="!userProfile" class="login-section" aria-labelledby="login-heading">
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
              placeholder="seuemail@valepcd.com.br"
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
                {{ showPassword ? '🙈' : '👁️' }}
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
      </div>
    </section>

    <!-- PAINEL AUTENTICADO (Parceria tem acesso SOMENTE à aba Denúncias; Admin tem acesso a todas) -->
    <section v-else class="admin-panel-section" aria-labelledby="admin-heading">
      <!-- Banner / Toast de Notificação em Tempo Real (Nova ocorrência na cidade do parceiro ou novo report) -->
      <transition name="live-toast-fade">
        <div
          v-if="livePanelNotification"
          class="live-panel-toast"
          role="status"
          aria-live="polite"
        >
          <div class="live-panel-toast-body">
            <span class="live-panel-toast-icon" aria-hidden="true">🔔</span>
            <div class="live-panel-toast-texts">
              <strong class="live-panel-toast-title">{{ livePanelNotification.title }}</strong>
              <span v-if="livePanelNotification.subtitle" class="live-panel-toast-subtitle">
                {{ livePanelNotification.subtitle }}
              </span>
            </div>
          </div>
          <div class="live-panel-toast-actions">
            <button
              type="button"
              class="btn-live-toast-view"
              @click="focusLiveNotificationIncident"
            >
              Visualizar agora
            </button>
            <button
              type="button"
              class="btn-live-toast-dismiss"
              aria-label="Fechar notificação de nova ocorrência"
              @click="dismissLivePanelNotification"
            >
              ✕
            </button>
          </div>
        </div>
      </transition>

      <!-- Navegação de Abas -->
      <div class="admin-module-tabs" role="tablist" aria-label="Módulos do painel">
        <button
          v-if="isAdminRole"
          type="button"
          role="tab"
          :aria-selected="adminMainSection === 'ocorrencias'"
          class="admin-module-tab-btn"
          :class="{ 'is-active': adminMainSection === 'ocorrencias' }"
          @click="switchAdminMainSection('ocorrencias')"
        >
          <span aria-hidden="true">🚨</span>
          <span>Ocorrências Reportadas</span>
          <span class="module-tab-badge">{{ pendingItems.length }}</span>
        </button>

        <button
          type="button"
          role="tab"
          :aria-selected="adminMainSection === 'denuncias'"
          class="admin-module-tab-btn"
          :class="{ 'is-active': adminMainSection === 'denuncias' }"
          @click="switchAdminMainSection('denuncias')"
        >
          <span aria-hidden="true">📍</span>
          <span>Denúncias</span>
          <span class="module-tab-badge">{{ partnerIncidents.length }}</span>
        </button>

        <button
          v-if="isAdminRole"
          type="button"
          role="tab"
          :aria-selected="adminMainSection === 'usuarios'"
          class="admin-module-tab-btn"
          :class="{ 'is-active': adminMainSection === 'usuarios' }"
          @click="switchAdminMainSection('usuarios')"
        >
          <span aria-hidden="true">👥</span>
          <span>Gestão de Usuários</span>
          <span v-if="panelUsers.length > 0" class="module-tab-badge">{{ panelUsers.length }}</span>
        </button>
      </div>

      <!-- ABA 1 (EXCLUSIVA ADMIN): AVERIGUAÇÃO DE OCORRÊNCIAS REPORTADAS -->
      <div v-if="isAdminRole && adminMainSection === 'ocorrencias'">
        <header class="panel-header">
          <div>
            <span class="panel-kicker">Moderação & Governança</span>
            <h1 id="admin-heading" class="panel-main-title">Averiguação de Ocorrências Reportadas</h1>
            <p class="panel-main-subtitle">
              Analise as ocorrências sinalizadas pela comunidade e defina se a denúncia é procedente (mantém inativa) ou improcedente (volta a ficar ativa no mapa).
            </p>
          </div>

          <button
            type="button"
            class="btn-refresh-list"
            :disabled="isLoadingReports"
            @click="loadReports"
          >
            <span aria-hidden="true">🔄</span>
            <span>{{ isLoadingReports ? 'Atualizando...' : 'Atualizar Lista' }}</span>
          </button>
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
                <option value="">🌎 Todos os estados</option>
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
                  placeholder="Todos os bairros (digite ou selecione)..."
                  class="field-input filter-input-with-clear"
                />
                <button
                  v-if="reportFilterBairro"
                  type="button"
                  class="btn-inline-clear"
                  aria-label="Limpar filtro de bairro"
                  @click="reportFilterBairro = ''"
                >
                  ✕
                </button>
                <datalist id="report-bairros-datalist">
                  <option v-for="b in availableReportBairros" :key="b" :value="b" />
                </datalist>
              </div>
            </div>

            <!-- Tipo de Ocorrência -->
            <div class="form-field filter-field">
              <label for="filter-report-natureza" class="field-label">Tipo de Ocorrência</label>
              <select
                id="filter-report-natureza"
                v-model="reportFilterNatureza"
                class="field-input filter-select"
              >
                <option value="">📋 Todos os tipos</option>
                <option value="transito">🚗 Infração de Trânsito</option>
                <option value="urbana">🚧 Mobilidade / Acesso Urbano</option>
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
              ✕ Limpar filtros
            </button>
          </div>
        </div>

        <!-- Layout Master-Detail: Lista à Esquerda + Detalhes e Foto à Direita -->
        <div class="master-detail-grid">
          <!-- COLUNA ESQUERDA: Lista de Ocorrências Reportadas -->
          <aside class="master-column" aria-label="Lista de ocorrências reportadas">
            <!-- Abas de Filtro: Pendentes vs Revisadas -->
            <div class="filter-tabs" role="tablist" aria-label="Filtrar por status de revisão">
              <button
                type="button"
                role="tab"
                :aria-selected="activeTab === 'pendentes'"
                class="filter-tab-btn"
                :class="{ 'is-active': activeTab === 'pendentes' }"
                @click="selectTab('pendentes')"
              >
                <span>Pendentes</span>
                <span class="tab-counter">{{ pendingItems.length }}</span>
              </button>

              <button
                type="button"
                role="tab"
                :aria-selected="activeTab === 'revisadas'"
                class="filter-tab-btn"
                :class="{ 'is-active': activeTab === 'revisadas' }"
                @click="selectTab('revisadas')"
              >
                <span>Revisadas</span>
                <span class="tab-counter">{{ reviewedItems.length }}</span>
              </button>
            </div>

            <!-- Lista -->
            <div v-if="isLoadingReports" class="list-empty-state">
              <div class="spinner-circle" aria-hidden="true"></div>
              <p>Carregando ocorrências reportadas...</p>
            </div>

            <div v-else-if="filteredItems.length === 0" class="list-empty-state">
              <span class="empty-icon" aria-hidden="true">
                {{ hasActiveReportFilters ? '🔎' : activeTab === 'pendentes' ? '🎉' : '📂' }}
              </span>
              <p class="empty-title">
                {{
                  hasActiveReportFilters
                    ? 'Nenhuma ocorrência encontrada para os filtros selecionados'
                    : activeTab === 'pendentes'
                      ? 'Nenhuma ocorrência pendente!'
                      : 'Nenhuma ocorrência revisada ainda.'
                }}
              </p>
              <p class="empty-desc">
                {{
                  hasActiveReportFilters
                    ? 'Altere ou limpe os filtros de Estado, Cidade, Bairro ou Tipo de Ocorrência acima.'
                    : activeTab === 'pendentes'
                      ? 'Todas as denúncias enviadas já foram averiguadas.'
                      : 'As ocorrências que você validar aparecerão neste histórico.'
                }}
              </p>
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
                  @click="selectIncident(item)"
                >
                  <div class="report-item-top">
                    <span
                      class="natureza-pill"
                      :class="item.natureza === 'urbana' ? 'pill-urbana' : 'pill-transito'"
                    >
                      {{ item.natureza === 'urbana' ? '🚧 Mobilidade' : '🚗 Trânsito' }}
                    </span>

                    <!-- Selo de 2ª / 3ª vez reportada -->
                    <span
                      v-if="item.total_reports > 1"
                      class="repeat-report-badge"
                      :title="`Esta ocorrência recebeu ${item.total_reports} solicitações de revisão`"
                    >
                      🔁 {{ item.total_reports }}ª vez reportada
                    </span>

                    <!-- Selo de Possível Duplicidade -->
                    <span
                      v-if="item.possivel_duplicidade"
                      class="duplicity-panel-badge"
                      title="O Gemini identificou que este veículo pode ser o mesmo de outra denúncia recente num raio de 10m"
                    >
                      ⚠️ {{ item.rotulo_duplicidade || 'Possível duplicidade' }}
                    </span>
                  </div>

                  <div class="report-item-location">
                    {{ formatShortLocation(item) }}
                  </div>

                  <p class="report-item-reason">
                    "{{ item.motivo_report || item.motivo_denuncia || 'Motivo não especificado' }}"
                  </p>

                  <div class="report-item-footer">
                    <span class="report-item-date">
                      {{ formatDateTime(item.ultima_data_report || item.data_report) }}
                    </span>

                    <span
                      v-if="item.revisada"
                      class="verdict-mini-badge"
                      :class="getVerdictMiniBadgeClass(item.resultado_revisao)"
                    >
                      {{ getVerdictMiniBadgeLabel(item.resultado_revisao) }}
                    </span>
                    <span v-else class="verdict-mini-badge verdict-pendente">
                      ⏳ Pendente
                    </span>
                  </div>
                </button>
              </li>
            </ul>
          </aside>

          <!-- COLUNA DIREITA: Detalhes da Ocorrência + Foto + Ações de Validação -->
          <main class="detail-column" aria-label="Detalhes da ocorrência selecionada">
            <div v-if="!selectedItem" class="detail-empty-state">
              <span class="empty-icon" aria-hidden="true">👈</span>
              <h2 class="empty-title">Selecione uma ocorrência ao lado</h2>
              <p class="empty-desc">
                Clique em um item na lista da esquerda para inspecionar a foto, ver os motivos de denúncia e validar.
              </p>
            </div>

            <div v-else class="detail-card">
              <!-- Cabeçalho de Status da Ocorrência Selecionada -->
              <div class="detail-header">
                <div class="detail-header-badges">
                  <span
                    class="natureza-pill"
                    :class="selectedItem.natureza === 'urbana' ? 'pill-urbana' : 'pill-transito'"
                  >
                    {{ selectedItem.natureza === 'urbana' ? '🚧 Mobilidade Urbana' : '🚗 Infração de Trânsito' }}
                  </span>

                  <span
                    v-if="selectedItem.total_reports > 1"
                    class="repeat-report-badge repeat-badge-lg"
                  >
                    🔁 {{ selectedItem.total_reports }}ª vez que é reportada
                  </span>

                  <span
                    v-if="selectedItem.possivel_duplicidade"
                    class="duplicity-panel-badge repeat-badge-lg"
                    :title="selectedItem.duplicidade_de_id ? `Duplicidade vinculada ao ID: ${selectedItem.duplicidade_de_id}` : 'Possível duplicidade detectada pelo Gemini'"
                  >
                    ⚠️ {{ selectedItem.rotulo_duplicidade || 'Possível duplicidade' }}
                  </span>

                  <span
                    class="map-visibility-badge"
                    :class="selectedItem.ativo ? 'is-map-active' : 'is-map-inactive'"
                  >
                    {{ selectedItem.ativo ? '🟢 Ativa no Mapa' : '🔴 Inativa no Mapa (Oculta)' }}
                  </span>
                </div>

                <span class="detail-id-code">ID: {{ selectedItem.ocorrenciaId }}</span>
              </div>

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
                      <span class="duplicity-compare-label">
                        1ª Denúncia (Original • ID: {{ selectedItem.duplicidade_de_id }})
                      </span>
                      <div class="photo-wrapper">
                        <img
                          :src="selectedItem.duplicidade_original_fotoUrl"
                          :alt="`Foto da 1ª ocorrência ${selectedItem.duplicidade_de_id}`"
                          class="detail-photo-img"
                          @click="openPanelLightbox(selectedItem.duplicidade_original_fotoUrl)"
                        />
                        <button
                          type="button"
                          class="btn-expand-photo"
                          @click="openPanelLightbox(selectedItem.duplicidade_original_fotoUrl)"
                        >
                          🔍 Ampliar 1ª Foto
                        </button>
                      </div>
                    </div>

                    <div class="duplicity-photo-compare-col">
                      <span class="duplicity-compare-label is-second-photo">
                        2ª Denúncia (Possível Duplicidade • ID: {{ selectedItem.ocorrenciaId }})
                      </span>
                      <div v-if="selectedItem.fotoUrl" class="photo-wrapper">
                        <img
                          :src="selectedItem.fotoUrl"
                          :alt="`Foto da 2ª ocorrência ${selectedItem.ocorrenciaId}`"
                          class="detail-photo-img"
                          @click="openPanelLightbox(selectedItem.fotoUrl)"
                        />
                        <button
                          type="button"
                          class="btn-expand-photo"
                          @click="openPanelLightbox(selectedItem.fotoUrl)"
                        >
                          🔍 Ampliar 2ª Foto
                        </button>
                      </div>
                    </div>
                  </div>

                  <div v-else-if="selectedItem.fotoUrl" class="photo-wrapper">
                    <img
                      :src="selectedItem.fotoUrl"
                      :alt="`Foto da ocorrência ${selectedItem.ocorrenciaId}`"
                      class="detail-photo-img"
                      @click="openPanelLightbox(selectedItem.fotoUrl)"
                    />
                    <button
                      type="button"
                      class="btn-expand-photo"
                      @click="openPanelLightbox(selectedItem.fotoUrl)"
                    >
                      🔍 Ampliar Foto
                    </button>
                  </div>
                  <div v-else class="photo-missing">
                    <span>🖼️ Sem foto disponível</span>
                  </div>
                </div>

                <!-- Bloco de Motivos Reportados & Decisão -->
                <div class="detail-moderation-box">
                  <!-- Histórico de Solicitações de Revisão -->
                  <div class="reports-history-box">
                    <div class="history-box-header">
                      <h2 class="box-section-title">
                        {{
                          isDuplicityReviewItem(selectedItem) && selectedItem.total_reports <= 1
                            ? 'Análise Anti-Duplicidade (Gemini)'
                            : selectedItem.total_reports > 1
                              ? `Solicitações de Revisão (${selectedItem.total_reports})`
                              : 'Motivo do Reporte'
                        }}
                      </h2>
                      <span v-if="selectedItem.outras_revisoes_solicitadas" class="multi-review-tag">
                        Outras revisões solicitadas
                      </span>
                    </div>

                    <ol class="history-timeline">
                      <li
                        v-for="(entry, idx) in selectedItem.historico_reports"
                        :key="`${idx}-${entry.data}`"
                        class="history-entry"
                      >
                        <div class="history-entry-meta">
                          <span class="history-step-num">
                            {{
                            idx === 0 && entry.motivo?.startsWith('Possível duplicidade detectada pelo sistema')
                            ? 'Detecção automática'
                            : `${idx + 1}ª solicitação`
                            }}
                          </span>
                          <span class="history-step-date">{{ formatDateTime(entry.data) }}</span>
                          <span v-if="entry.apos_revisao" class="history-after-review-tag">
                            Após validação anterior
                          </span>
                        </div>
                        <p class="history-entry-reason">"{{ entry.motivo }}"</p>
                      </li>
                    </ol>
                  </div>

                  <!-- Banner caso já tenha sido revisada -->
                  <div
                    v-if="selectedItem.revisada"
                    class="reviewed-status-banner"
                    :class="getReviewedBannerClass(selectedItem.resultado_revisao)"
                  >
                    <div class="banner-title">
                      {{ getReviewedBannerTitle(selectedItem.resultado_revisao) }}
                    </div>
                    <div v-if="selectedItem.data_revisao" class="banner-meta">
                      Validada em {{ formatDateTime(selectedItem.data_revisao) }}
                      <span v-if="selectedItem.revisado_por"> por {{ selectedItem.revisado_por }}</span>
                    </div>
                    <p v-if="selectedItem.observacao_admin" class="banner-obs">
                      Nota: {{ selectedItem.observacao_admin }}
                    </p>
                  </div>

                  <!-- Campo opcional de observação de controle -->
                  <div class="admin-note-field">
                    <label for="admin-obs-input" class="field-label">
                      Observação interna de controle (opcional)
                    </label>
                    <input
                      id="admin-obs-input"
                      v-model="adminNote"
                      type="text"
                      maxlength="200"
                      placeholder="Ex: Foto nítida mostrando veículo sobre a faixa zebrada..."
                      class="field-input"
                      :disabled="isSubmittingDecision"
                    />
                  </div>

                  <p v-if="decisionError" class="login-error-alert" role="alert">
                    {{ decisionError }}
                  </p>

                  <!-- Botões de Ação para POSSÍVEL DUPLICIDADE (Não é duplicidade | Indefinido | É duplicidade) -->
                  <div
                    v-if="isDuplicityReviewItem(selectedItem)"
                    class="decision-actions is-duplicity-decision-grid"
                  >
                    <button
                      type="button"
                      class="btn-decision btn-improcedente"
                      :disabled="isSubmittingDecision"
                      @click="handleReviewDecision('nao_duplicidade')"
                    >
                      <span class="decision-btn-title">✅ Não é duplicidade</span>
                      <span class="decision-btn-desc">Incrementa +1 na contagem de denúncias e mantém ativa</span>
                    </button>

                    <button
                      type="button"
                      class="btn-decision btn-indefinido"
                      :disabled="isSubmittingDecision"
                      @click="handleReviewDecision('indefinido')"
                    >
                      <span class="decision-btn-title">⚖️ Indefinido</span>
                      <span class="decision-btn-desc">Mantém agrupada sem incrementar na contagem</span>
                    </button>

                    <button
                      type="button"
                      class="btn-decision btn-procedente"
                      :disabled="isSubmittingDecision"
                      @click="handleReviewDecision('duplicidade')"
                    >
                      <span class="decision-btn-title">🚫 É duplicidade</span>
                      <span class="decision-btn-desc">Inativa a denúncia e remove do mapa</span>
                    </button>
                  </div>

                  <!-- Botões de Ação do Report Comum / Fluxo Principal (Improcedente | Procedente | É duplicidade) -->
                  <div v-else class="decision-actions">
                    <button
                      type="button"
                      class="btn-decision btn-improcedente"
                      :disabled="isSubmittingDecision"
                      @click="handleReviewDecision('improcedente')"
                    >
                      <span class="decision-btn-title">✅ Improcedente (Ativar Ocorrência)</span>
                    </button>

                    <button
                      type="button"
                      class="btn-decision btn-procedente"
                      :disabled="isSubmittingDecision"
                      @click="handleReviewDecision('procedente')"
                    >
                      <span class="decision-btn-title">🚫 Procedente (Manter Inativa)</span>
                    </button>
<button type="button" class="btn-decision btn-procedente btn-duplicidade-common" :disabled="isSubmittingDecision"
  @click="handleReviewDecision('duplicidade')">
  <span class="decision-btn-title">🚫 É duplicidade (Manter Inativa)</span>
  <span class="decision-btn-desc">Marca como ocorrência duplicada quando não detectada pelo sistema e mantém
    inativa</span>
</button>
                  </div>
                </div>
              </div>

              <!-- Dados Completos da Ocorrência -->
              <div class="detail-metadata-box">
                <h3 class="box-section-title">Dados da Ocorrência Original</h3>
                <div class="metadata-grid">
                  <div class="meta-item">
                    <span class="meta-label">Data da Ocorrência</span>
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
                  <div v-if="selectedItem.descricao" class="meta-item meta-item-full">
                    <span class="meta-label">Descrição Registrada</span>
                    <span class="meta-value">{{ selectedItem.descricao }}</span>
                  </div>
                  <div class="meta-item meta-item-full">
                    <span class="meta-label">Coordenadas GPS</span>
                    <span class="meta-value meta-coords-row">
                      <span>{{ selectedItem.latitude.toFixed(6) }}, {{ selectedItem.longitude.toFixed(6) }}</span>
                      <button
                        v-if="selectedItem.latitude && selectedItem.longitude"
                        type="button"
                        class="btn-open-multei-map"
                        @click="openMulteiLocationModalFor(selectedItem)"
                      >
                        🗺️ Abrir local no Multei
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <!-- ABA 2: DENÚNCIAS (Parcerias têm acesso exclusivo a esta aba; lista ocorrências da cidade cadastrada + Ao meu redor 5km) -->
      <div v-else-if="adminMainSection === 'denuncias'" class="partner-denuncias-section">
        <header class="panel-header">
          <div>
            <span class="panel-kicker">
              {{
                isAdminRole
                  ? 'Visão Administrativa • Todas as Cidades'
                  : userProfile.cidade
                    ? `Parceria Municipal • ${userProfile.cidade}${userProfile.estado ? `/${userProfile.estado}` : ''}`
                    : 'Acompanhamento Municipal de Acessibilidade'
              }}
            </span>
            <h1 id="admin-heading" class="panel-main-title">
              Denúncias {{ !isAdminRole && userProfile.cidade ? `• ${userProfile.cidade}` : '' }}
            </h1>
            <p class="panel-main-subtitle">
              <template v-if="partnerNearMeCenter">
                📍 Exibindo ocorrências num raio de <strong>5 km ao seu redor</strong>
                <span v-if="!isAdminRole && userProfile.cidade"> em <strong>{{ userProfile.cidade }}</strong></span>.
              </template>
              <template v-else-if="!isAdminRole && userProfile.cidade">
                Listando as ocorrências registradas na cidade de <strong>{{ userProfile.cidade }}{{ userProfile.estado ? `/${userProfile.estado}` : '' }}</strong>. Declare problemas de acesso urbano corrigidos enviando a foto do depois.
              </template>
              <template v-else>
                Filtre as ocorrências por Estado, Cidade, Bairro ou Tipo de Ocorrência, ou utilize o botão "Ao meu redor" para buscar num raio de 5 km do seu GPS.
              </template>
            </p>
          </div>

          <div class="users-header-actions">
            <button
              type="button"
              class="btn-around-me"
              :class="{ 'is-active': Boolean(partnerNearMeCenter) }"
              :disabled="isLocatingPartnerGps || isLoadingPartnerIncidents"
              @click="handlePartnerAroundMe"
            >
              <span aria-hidden="true">📍</span>
              <span>{{ isLocatingPartnerGps ? 'Obtendo GPS...' : 'Ao meu redor (5 km)' }}</span>
            </button>

            <button
              v-if="partnerNearMeCenter"
              type="button"
              class="btn-refresh-list"
              :disabled="isLoadingPartnerIncidents"
              @click="clearPartnerAroundMe"
            >
              <span aria-hidden="true">🏙️</span>
              <span>{{ isAdminRole ? 'Todas as localidades' : 'Toda a cidade' }}</span>
            </button>

            <button
              type="button"
              class="btn-refresh-list"
              :disabled="isLoadingPartnerIncidents"
              @click="loadPartnerDenuncias"
            >
              <span aria-hidden="true">🔄</span>
              <span>{{ isLoadingPartnerIncidents ? 'Atualizando...' : 'Atualizar' }}</span>
            </button>
          </div>
        </header>

        <p v-if="partnerGpsError" class="login-error-alert partner-gps-alert" role="alert">
          {{ partnerGpsError }}
        </p>

        <!-- Barra de Filtros da Aba Denúncias (Bairro e Tipo para todos; Estado e Cidade IBGE adicionais para Admin) -->
        <div class="occurrences-filter-bar" role="region" aria-label="Filtros de denúncias">
          <div class="occurrences-filter-grid" :class="isAdminRole ? 'is-admin-grid' : 'is-partner-grid'">
            <!-- Estado (UF) - Exclusivo Admin -->
            <div v-if="isAdminRole" class="form-field filter-field">
              <label for="filter-denuncia-estado" class="field-label">Estado (UF)</label>
              <select
                id="filter-denuncia-estado"
                v-model="denunciaFilterEstado"
                class="field-input filter-select"
                @change="handleDenunciaEstadoFilterChange"
              >
                <option value="">🌎 Todos os estados</option>
                <option v-for="uf in BRAZIL_STATES" :key="uf" :value="uf">
                  {{ uf }}
                </option>
              </select>
            </div>

            <!-- Cidade (Search field via API IBGE com capital padrão) - Exclusivo Admin -->
            <div v-if="isAdminRole" class="form-field filter-field">
              <label for="filter-denuncia-cidade" class="field-label">
                Cidade {{ denunciaFilterEstado ? `(${denunciaFilterEstado})` : '' }}
              </label>
              <MulteiCitySearchField
                v-model="denunciaFilterCidade"
                :uf="denunciaFilterEstado"
                input-id="filter-denuncia-cidade"
                :allow-clear="true"
              />
            </div>

            <!-- Bairro (Disponível para Parceiros e Admin) -->
            <div class="form-field filter-field">
              <label for="filter-denuncia-bairro" class="field-label">Bairro</label>
              <div class="bairro-search-wrap">
                <input
                  id="filter-denuncia-bairro"
                  v-model="denunciaFilterBairro"
                  type="text"
                  list="denuncia-bairros-datalist"
                  placeholder="Todos os bairros (digite ou selecione)..."
                  class="field-input filter-input-with-clear"
                />
                <button
                  v-if="denunciaFilterBairro"
                  type="button"
                  class="btn-inline-clear"
                  aria-label="Limpar filtro de bairro"
                  @click="denunciaFilterBairro = ''"
                >
                  ✕
                </button>
                <datalist id="denuncia-bairros-datalist">
                  <option v-for="b in availableDenunciaBairros" :key="b" :value="b" />
                </datalist>
              </div>
            </div>

            <!-- Tipo de Ocorrência (Disponível para Parceiros e Admin) -->
            <div class="form-field filter-field">
              <label for="filter-denuncia-natureza" class="field-label">Tipo de Ocorrência</label>
              <select
                id="filter-denuncia-natureza"
                v-model="denunciaFilterNatureza"
                class="field-input filter-select"
              >
                <option value="">📋 Todos os tipos</option>
                <option value="transito">🚗 Infração de Trânsito</option>
                <option value="urbana">🚧 Problema de Acesso Urbano</option>
              </select>
            </div>
          </div>

          <div v-if="hasActiveDenunciaFilters" class="filter-bar-footer">
            <span class="filter-active-summary">
              Exibindo <strong>{{ pendingPartnerIncidents.length + resolvedPartnerIncidents.length }}</strong> de <strong>{{ partnerIncidents.length }}</strong> denúncias
            </span>
            <button
              type="button"
              class="btn-clear-all-filters"
              @click="clearDenunciaFilters"
            >
              ✕ Limpar filtros
            </button>
          </div>
        </div>

        <div class="master-detail-grid">
          <!-- COLUNA ESQUERDA: Lista de Denúncias da Cidade / Ao Meu Redor -->
          <aside class="master-column" aria-label="Lista de denúncias da cidade">
            <div class="filter-tabs" role="tablist" aria-label="Filtrar denúncias">
              <button
                type="button"
                role="tab"
                :aria-selected="partnerFilterTab === 'pendentes'"
                class="filter-tab-btn"
                :class="{ 'is-active': partnerFilterTab === 'pendentes' }"
                @click="selectPartnerTab('pendentes')"
              >
                <span>Em Aberto</span>
                <span class="tab-counter">{{ pendingPartnerIncidents.length }}</span>
              </button>

              <button
                type="button"
                role="tab"
                :aria-selected="partnerFilterTab === 'resolvidas'"
                class="filter-tab-btn"
                :class="{ 'is-active': partnerFilterTab === 'resolvidas' }"
                @click="selectPartnerTab('resolvidas')"
              >
                <span>Corrigidas</span>
                <span class="tab-counter">{{ resolvedPartnerIncidents.length }}</span>
              </button>
            </div>

            <div v-if="isLoadingPartnerIncidents" class="list-empty-state">
              <div class="spinner-circle" aria-hidden="true"></div>
              <p>Carregando denúncias de {{ userProfile.cidade || 'sua região' }}...</p>
            </div>

            <div v-else-if="filteredPartnerIncidents.length === 0" class="list-empty-state">
              <span class="empty-icon" aria-hidden="true">
                {{ hasActiveDenunciaFilters ? '🔎' : partnerFilterTab === 'pendentes' ? '✨' : '✅' }}
              </span>
              <p class="empty-title">
                {{
                  hasActiveDenunciaFilters
                    ? 'Nenhuma denúncia encontrada para os filtros selecionados'
                    : partnerNearMeCenter
                      ? 'Nenhuma ocorrência num raio de 5 km'
                      : partnerFilterTab === 'pendentes'
                        ? 'Nenhuma denúncia em aberto na cidade'
                        : 'Nenhuma ocorrência corrigida ainda'
                }}
              </p>
              <p class="empty-desc">
                {{
                  hasActiveDenunciaFilters
                    ? 'Altere ou limpe os filtros acima para visualizar outras ocorrências.'
                    : partnerNearMeCenter
                      ? 'Não foram encontradas ocorrências nesta categoria dentro de 5 km da sua localização atual.'
                      : 'As ocorrências registradas aparecerão nesta lista.'
                }}
              </p>
            </div>

            <ul v-else class="report-list">
              <li
                v-for="inc in filteredPartnerIncidents"
                :key="inc.id"
                class="report-list-item"
              >
                <button
                  type="button"
                  class="report-item-btn"
                  :class="{ 'is-selected': selectedPartnerIncident?.id === inc.id }"
                  @click="selectPartnerIncident(inc)"
                >
                  <div class="report-item-top">
                    <span
                      class="natureza-pill"
                      :class="
                        inc.resolvido
                          ? 'pill-resolvido-green'
                          : inc.natureza === 'urbana'
                            ? 'pill-urbana'
                            : 'pill-transito'
                      "
                    >
                      {{
                        inc.resolvido
                          ? '✅ Acesso Urbano Corrigido'
                          : inc.natureza === 'urbana'
                            ? '🚧 Acesso Urbano'
                            : '🚗 Trânsito'
                      }}
                    </span>

                    <span
                      v-if="partnerNearMeCenter"
                      class="distance-badge"
                    >
                      📍 {{ formatDistanceFromPartner(inc) }}
                    </span>

                    <span
                      v-if="inc.possivel_duplicidade"
                      class="duplicity-panel-badge"
                      title="O Gemini identificou que este veículo pode ser o mesmo de outra denúncia recente num raio de 10m"
                    >
                      ⚠️ {{ inc.rotulo_duplicidade || 'Possível duplicidade' }}
                    </span>
                  </div>

                  <div class="report-item-location">
                    {{ formatIncidentLocation(inc) }}
                  </div>

                  <p class="report-item-reason">
                    {{ inc.descricao || inc.description || 'Ocorrência registrada no mapa' }}
                  </p>

                  <div class="report-item-footer">
                    <span class="report-item-date">
                      {{ formatDateTime(String(inc.timestamp || '')) }}
                    </span>

                    <span
                      v-if="inc.resolvido"
                      class="verdict-mini-badge verdict-improcedente"
                    >
                      ✅ Pino Verde
                    </span>
                    <span
                      v-else-if="inc.natureza === 'urbana'"
                      class="verdict-mini-badge verdict-pendente"
                    >
                      🛠️ Aguardando Correção
                    </span>
                  </div>
                </button>
              </li>
            </ul>
          </aside>

          <!-- COLUNA DIREITA: Detalhes da Denúncia + Declaração de Problema Corrigido / Antes e Depois -->
          <main class="detail-column" aria-label="Detalhes da denúncia selecionada">
            <div v-if="!selectedPartnerIncident" class="detail-empty-state">
              <span class="empty-icon" aria-hidden="true">👈</span>
              <h2 class="empty-title">Selecione uma denúncia ao lado</h2>
              <p class="empty-desc">
                Escolha uma ocorrência da lista para visualizar a localização, fotos e declarar problemas de acesso urbano corrigidos.
              </p>
            </div>

            <div v-else class="detail-card">
              <div class="detail-header">
                <div class="detail-header-badges">
                  <span
                    class="natureza-pill"
                    :class="
                      selectedPartnerIncident.resolvido
                        ? 'pill-resolvido-green'
                        : selectedPartnerIncident.natureza === 'urbana'
                          ? 'pill-urbana'
                          : 'pill-transito'
                    "
                  >
                    {{
                      selectedPartnerIncident.resolvido
                        ? '✅ Acesso Urbano Corrigido (Pino Verde com Check)'
                        : selectedPartnerIncident.natureza === 'urbana'
                          ? '🚧 Problema de Acesso Urbano'
                          : '🚗 Infração de Trânsito'
                    }}
                  </span>

                  <span v-if="partnerNearMeCenter" class="distance-badge">
                    📍 {{ formatDistanceFromPartner(selectedPartnerIncident) }} de você
                  </span>

                  <span
                    v-if="selectedPartnerIncident.possivel_duplicidade"
                    class="duplicity-panel-badge repeat-badge-lg"
                    :title="selectedPartnerIncident.duplicidade_de_id ? `Duplicidade vinculada ao ID: ${selectedPartnerIncident.duplicidade_de_id}` : 'Possível duplicidade detectada pelo Gemini'"
                  >
                    ⚠️ {{ selectedPartnerIncident.rotulo_duplicidade || 'Possível duplicidade' }}
                  </span>
                </div>

                <span class="detail-id-code">ID: {{ selectedPartnerIncident.id }}</span>
              </div>

              <!-- SE JÁ ESTIVER RESOLVIDA: Exibe Comparativo ANTES e DEPOIS destacando Datas -->
              <div v-if="selectedPartnerIncident.resolvido" class="panel-before-after-wrapper">
                <div class="panel-ba-grid">
                  <!-- Card ANTES -->
                  <div class="panel-ba-card panel-ba-before">
                    <div class="panel-ba-header panel-ba-header-before">
                      <span>🚧 ANTES • Problema Reportado</span>
                    </div>
                    <div class="panel-ba-photo-wrap">
                      <img
                        v-if="selectedPartnerIncident.fotoUrl || selectedPartnerIncident.maskedImageUrl"
                        :src="selectedPartnerIncident.fotoUrl || selectedPartnerIncident.maskedImageUrl"
                        alt="Foto de antes: problema de acesso urbano reportado"
                        class="panel-ba-img"
                        @click="openPanelLightbox(selectedPartnerIncident.fotoUrl || selectedPartnerIncident.maskedImageUrl)"
                      />
                    </div>
                    <div class="panel-ba-date-box panel-ba-date-before">
                      <span class="panel-ba-date-label">📅 Data da denúncia</span>
                      <strong class="panel-ba-date-val">
                        {{ formatDateTime(String(selectedPartnerIncident.timestamp || '')) }}
                      </strong>
                    </div>
                    <p v-if="selectedPartnerIncident.descricao" class="panel-ba-desc">
                      <strong>Descrição inicial:</strong> {{ selectedPartnerIncident.descricao }}
                    </p>
                  </div>

                  <!-- Card DEPOIS -->
                  <div class="panel-ba-card panel-ba-after">
                    <div class="panel-ba-header panel-ba-header-after">
                      <span>✅ DEPOIS • Problema Corrigido</span>
                    </div>
                    <div class="panel-ba-photo-wrap">
                      <img
                        v-if="selectedPartnerIncident.foto_resolucao"
                        :src="selectedPartnerIncident.foto_resolucao"
                        alt="Foto de depois: problema de acesso urbano corrigido"
                        class="panel-ba-img"
                        @click="openPanelLightbox(selectedPartnerIncident.foto_resolucao)"
                      />
                    </div>
                    <div class="panel-ba-date-box panel-ba-date-after">
                      <span class="panel-ba-date-label">✅ Data da resolução</span>
                      <strong class="panel-ba-date-val">
                        {{ formatDateTime(selectedPartnerIncident.data_resolucao) }}
                      </strong>
                    </div>
                    <p v-if="selectedPartnerIncident.descricao_resolucao" class="panel-ba-desc">
                      <strong>Descrição da correção:</strong> {{ selectedPartnerIncident.descricao_resolucao }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- SE AINDA NÃO ESTIVER RESOLVIDA: Foto Original + Formulário de Resolução Urbana -->
              <div v-else class="detail-content-split">
                <!-- Coluna da Foto Original -->
                <div class="detail-photo-box">
                  <div
                    v-if="selectedPartnerIncident.fotoUrl || selectedPartnerIncident.maskedImageUrl"
                    class="photo-wrapper"
                  >
                    <img
                      :src="selectedPartnerIncident.fotoUrl || selectedPartnerIncident.maskedImageUrl"
                      :alt="`Foto da ocorrência ${selectedPartnerIncident.id}`"
                      class="detail-photo-img"
                      @click="openPanelLightbox(selectedPartnerIncident.fotoUrl || selectedPartnerIncident.maskedImageUrl)"
                    />
                    <button
                      type="button"
                      class="btn-expand-photo"
                      @click="openPanelLightbox(selectedPartnerIncident.fotoUrl || selectedPartnerIncident.maskedImageUrl)"
                    >
                      🔍 Ampliar Foto
                    </button>
                  </div>
                  <div v-else class="photo-missing">
                    <span>🖼️ Sem foto disponível</span>
                  </div>
                </div>

                <!-- Coluna de Ação do Parceiro -->
                <div class="detail-moderation-box">
                  <div v-if="selectedPartnerIncident.natureza === 'urbana'" class="partner-resolve-box">
                    <h2 class="box-section-title">
                      ✅ Declarar Problema de Acesso Urbano Corrigido
                    </h2>
                    <p class="partner-resolve-hint">
                      Envie uma nova foto comprovando a correção e descreva o serviço realizado. No mapa do Multei, o pino ficará <strong>verde com ícone de check (✓)</strong> e exibirá o comparativo <strong>Antes e Depois</strong>.
                    </p>

                    <!-- Upload / Câmera da Nova Foto -->
                    <div class="partner-photo-upload-area">
                      <div v-if="isProcessingPartnerPhoto" class="partner-photo-processing">
                        <div class="spinner-circle" aria-hidden="true"></div>
                        <span>Processando imagem e proteção de privacidade...</span>
                      </div>

                      <div v-else-if="partnerResolvedPhotoWebp" class="partner-photo-preview-box">
                        <img
                          :src="partnerResolvedPhotoWebp"
                          alt="Nova foto do problema corrigido"
                          class="partner-photo-preview-img"
                        />
                        <button
                          type="button"
                          class="btn-cancel-edit"
                          :disabled="isSubmittingPartnerResolution"
                          @click="partnerResolvedPhotoWebp = ''"
                        >
                          🔄 Trocar foto
                        </button>
                      </div>

                      <div v-else class="partner-upload-buttons">
                        <button
                          type="button"
                          class="btn-partner-upload"
                          :disabled="isSubmittingPartnerResolution"
                          @click="showPartnerCamera = true"
                        >
                          <span>📷</span>
                          <span>Tirar Nova Foto</span>
                        </button>

                        <button
                          type="button"
                          class="btn-partner-upload"
                          :disabled="isSubmittingPartnerResolution"
                          @click="partnerFileInputRef?.click()"
                        >
                          <span>🖼️</span>
                          <span>Enviar Foto da Galeria</span>
                        </button>

                        <input
                          ref="partnerFileInputRef"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          class="sr-only"
                          tabindex="-1"
                          aria-hidden="true"
                          @change="handlePartnerFileSelected"
                        />
                      </div>
                    </div>

                    <!-- Descrição da Correção -->
                    <div class="form-field">
                      <div class="partner-desc-label-row">
                        <label for="partner-resolve-desc" class="field-label">
                          Descrição da correção realizada *
                        </label>
                        <span class="partner-char-counter">
                          {{ partnerResolveDescription.trim().length }}/300
                        </span>
                      </div>
                      <textarea
                        id="partner-resolve-desc"
                        v-model="partnerResolveDescription"
                        rows="3"
                        maxlength="300"
                        placeholder="Ex: Calçada reparada, rampa de acessibilidade reconstruída e desobstruída pela equipe municipal..."
                        class="field-input partner-textarea"
                        :disabled="isSubmittingPartnerResolution || isProcessingPartnerPhoto"
                      ></textarea>
                    </div>

                    <p v-if="partnerResolveError" class="login-error-alert" role="alert">
                      {{ partnerResolveError }}
                    </p>

                    <p v-if="partnerResolveSuccess" class="user-success-alert" role="status">
                      {{ partnerResolveSuccess }}
                    </p>

                    <button
                      type="button"
                      class="btn-decision btn-improcedente btn-confirm-partner-resolve"
                      :disabled="isSubmittingPartnerResolution || isProcessingPartnerPhoto"
                      @click="handlePartnerSubmitResolution"
                    >
                      <span class="decision-btn-title">
                        {{
                          isSubmittingPartnerResolution
                            ? 'Gravando resolução no Firebase...'
                            : '✅ Declarar Problema Corrigido (Ativar Pino Verde)'
                        }}
                      </span>
                    </button>
                  </div>

                  <div v-else class="partner-info-only-box">
                    <h2 class="box-section-title">🚗 Ocorrência de Infração de Trânsito</h2>
                    <p class="partner-resolve-hint">
                      Esta denúncia refere-se a um veículo estacionado irregularmente (vaga PcD, área zebrada ou faixa de pedestres). A declaração de obra/correção com fotos de <strong>Antes e Depois</strong> é exclusiva para ocorrências de <strong>🚧 Problema de Acesso Urbano</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Metadados de Localização e Data -->
              <div class="detail-metadata-box">
                <h3 class="box-section-title">Dados e Localização da Denúncia</h3>
                <div class="metadata-grid">
                  <div class="meta-item">
                    <span class="meta-label">Data da Denúncia</span>
                    <span class="meta-value">
                      {{ formatDateTime(String(selectedPartnerIncident.timestamp || '')) }}
                    </span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Cidade / UF</span>
                    <span class="meta-value">
                      {{ [selectedPartnerIncident.cidade, selectedPartnerIncident.estado].filter(Boolean).join(' / ') || 'Não informada' }}
                    </span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Logradouro / Bairro</span>
                    <span class="meta-value">
                      {{ [selectedPartnerIncident.rua, selectedPartnerIncident.bairro].filter(Boolean).join(' - ') || 'Não informado' }}
                    </span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Coordenadas GPS</span>
                    <span class="meta-value meta-coords-row">
                      <span>
                        {{ Number(selectedPartnerIncident.latitude).toFixed(6) }},
                        {{ Number(selectedPartnerIncident.longitude).toFixed(6) }}
                      </span>
                      <button
                        type="button"
                        class="btn-open-multei-map"
                        @click="openMulteiLocationModalFor(selectedPartnerIncident)"
                      >
                        🗺️ Abrir local no Multei
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <!-- ABA 3 (EXCLUSIVA ADMIN): GESTÃO DE USUÁRIOS -->
      <div v-else-if="isAdminRole && adminMainSection === 'usuarios'" class="users-management-section">
        <header class="panel-header">
          <div>
            <span class="panel-kicker">Controle de Acesso & Parcerias</span>
            <h1 id="admin-heading" class="panel-main-title">Gestão de Usuários</h1>
            <p class="panel-main-subtitle">
              Cadastre novos usuários no Firebase Authentication e gerencie permissões (<strong>admin</strong> ou <strong>parceria</strong>), ativação, edição e exclusão na coleção <code>usuarios</code>.
            </p>
          </div>

          <div class="users-header-actions">
            <button
              type="button"
              class="btn-new-user"
              @click="startCreateUser"
            >
              <span aria-hidden="true">➕</span>
              <span>Incluir Usuário</span>
            </button>

            <button
              type="button"
              class="btn-refresh-list"
              :disabled="isLoadingUsers"
              @click="loadPanelUsers"
            >
              <span aria-hidden="true">🔄</span>
              <span>{{ isLoadingUsers ? 'Atualizando...' : 'Atualizar' }}</span>
            </button>
          </div>
        </header>

        <div class="master-detail-grid users-grid">
          <!-- COLUNA ESQUERDA: Lista de Usuários Cadastrados -->
          <aside class="master-column users-list-column" aria-label="Usuários cadastrados">
            <div class="users-list-header">
              <span class="users-list-title">Usuários Cadastrados</span>
              <span class="tab-counter">{{ panelUsers.length }}</span>
            </div>

            <div v-if="isLoadingUsers" class="list-empty-state">
              <div class="spinner-circle" aria-hidden="true"></div>
              <p>Carregando lista de usuários...</p>
            </div>

            <div v-else-if="panelUsers.length === 0" class="list-empty-state">
              <span class="empty-icon" aria-hidden="true">👥</span>
              <p class="empty-title">Nenhum usuário encontrado</p>
              <p class="empty-desc">Use o formulário ao lado para incluir o primeiro usuário.</p>
            </div>

            <ul v-else class="report-list users-list">
              <li
                v-for="u in panelUsers"
                :key="u.id"
                class="report-list-item"
              >
                <div
                  class="user-item-card"
                  :class="{
                    'is-selected': editingUserId === u.id,
                    'is-inactive': !u.ativo
                  }"
                  @click="selectUserForEdit(u)"
                >
                  <div class="report-item-top">
                    <span
                      class="natureza-pill"
                      :class="u.role === 'admin' ? 'pill-role-admin' : 'pill-role-parceria'"
                    >
                      {{ u.role === 'admin' ? '🛡️ admin' : '🤝 parceria' }}
                    </span>

                    <span
                      class="user-status-pill"
                      :class="u.ativo ? 'status-pill-active' : 'status-pill-inactive'"
                    >
                      {{ u.ativo ? '🟢 Ativo' : '🔴 Inativo' }}
                    </span>
                  </div>

                  <div class="report-item-location user-card-name">
                    {{ u.nomeCompleto || `${u.nome} ${u.sobrenome}`.trim() || 'Sem nome' }}
                  </div>

                  <div class="user-card-email">
                    {{ u.email || 'E-mail não informado' }}
                  </div>

                  <div class="user-card-city">
                    📍 {{ [u.cidade, u.estado].filter(Boolean).join(' / ') || 'Cidade/UF não definida' }}
                  </div>

                  <div class="user-card-quick-actions" @click.stop>
                    <button
                      type="button"
                      class="btn-user-quick"
                      @click="selectUserForEdit(u)"
                    >
                      ✏️ Editar
                    </button>

                    <button
                      type="button"
                      class="btn-user-quick"
                      :disabled="isSavingUser"
                      @click="handleToggleUserActive(u)"
                    >
                      {{ u.ativo ? '⏸️ Desativar' : '▶️ Ativar' }}
                    </button>

                    <button
                      type="button"
                      class="btn-user-quick btn-user-quick-danger"
                      :disabled="isSavingUser"
                      @click="promptDeleteUser(u)"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              </li>
            </ul>
          </aside>

          <!-- COLUNA DIREITA: Formulário de Inclusão / Edição -->
          <main class="detail-column" aria-label="Formulário de usuário">
            <div class="detail-card user-form-card">
              <div class="user-form-header">
                <div>
                  <span class="panel-kicker">
                    {{ userFormMode === 'create' ? 'Novo Registro no Firebase Auth + Firestore' : 'Edição de Registro na Coleção usuarios' }}
                  </span>
                  <h2 class="user-form-title">
                    {{ userFormMode === 'create' ? '➕ Incluir Novo Usuário' : `✏️ Editar Usuário: ${userForm.nome} ${userForm.sobrenome}`.trim() }}
                  </h2>
                </div>

                <button
                  v-if="userFormMode === 'edit'"
                  type="button"
                  class="btn-cancel-edit"
                  @click="startCreateUser"
                >
                  ➕ Mudar para Inclusão
                </button>
              </div>

              <form class="user-crud-form" novalidate @submit.prevent="handleSaveUser">
                <div class="user-form-grid">
                  <!-- Perfil (Role: admin ou parceria) -->
                  <div class="form-field">
                    <label for="user-role" class="field-label">Perfil (Role) *</label>
                    <select
                      id="user-role"
                      v-model="userForm.role"
                      class="field-input"
                      :disabled="isSavingUser"
                    >
                      <option value="parceria">parceria (Parceria Municipal)</option>
                      <option value="admin">admin (Gestão)</option>
                    </select>
                  </div>

                  <!-- Status Ativo / Desativado -->
                  <div class="form-field">
                    <label for="user-status" class="field-label">Status da Conta *</label>
                    <select
                      id="user-status"
                      v-model="userForm.ativo"
                      class="field-input"
                      :disabled="isSavingUser"
                    >
                      <option :value="true">🟢 Ativo (Pode acessar o painel)</option>
                      <option :value="false">🔴 Desativado (Acesso bloqueado)</option>
                    </select>
                  </div>

                  <!-- Nome -->
                  <div class="form-field">
                    <label for="user-nome" class="field-label">Nome *</label>
                    <input
                      id="user-nome"
                      v-model="userForm.nome"
                      type="text"
                      required
                      placeholder="Ex: Adalberto"
                      class="field-input"
                      :disabled="isSavingUser"
                    />
                  </div>

                  <!-- Sobrenome -->
                  <div class="form-field">
                    <label for="user-sobrenome" class="field-label">Sobrenome *</label>
                    <input
                      id="user-sobrenome"
                      v-model="userForm.sobrenome"
                      type="text"
                      required
                      placeholder="Ex: Maia"
                      class="field-input"
                      :disabled="isSavingUser"
                    />
                  </div>

                  <!-- E-mail -->
                  <div class="form-field">
                    <label for="user-email" class="field-label">E-mail de Acesso *</label>
                    <input
                      id="user-email"
                      v-model="userForm.email"
                      type="email"
                      required
                      autocomplete="off"
                      placeholder="usuario@exemplo.com.br"
                      class="field-input"
                      :disabled="isSavingUser"
                    />
                  </div>

                  <!-- Senha (no modo Incluir) ou Redefinição (no modo Editar) -->
                  <div v-if="userFormMode === 'create'" class="form-field">
                    <label for="user-senha" class="field-label">
                      Senha Inicial (Firebase Auth) *
                    </label>
                    <div class="password-input-wrap">
                      <input
                        id="user-senha"
                        v-model="userForm.senha"
                        :type="showNewUserPassword ? 'text' : 'password'"
                        required
                        autocomplete="new-password"
                        placeholder="Mínimo de 6 caracteres"
                        class="field-input password-input"
                        :disabled="isSavingUser"
                      />
                      <button
                        type="button"
                        class="btn-toggle-pass"
                        :aria-label="showNewUserPassword ? 'Ocultar senha' : 'Mostrar senha'"
                        @click="showNewUserPassword = !showNewUserPassword"
                      >
                        {{ showNewUserPassword ? '🙈' : '👁️' }}
                      </button>
                    </div>
                  </div>

                  <div v-else class="form-field">
                    <label class="field-label">Senha (Firebase Authentication)</label>
                    <button
                      type="button"
                      class="btn-password-reset-mail"
                      :disabled="isSavingUser || !userForm.email"
                      @click="handleSendPasswordReset"
                    >
                      🔑 Enviar e-mail de redefinição de senha
                    </button>
                  </div>

                  <!-- Estado (UF) -->
                  <div class="form-field">
                    <label for="user-estado" class="field-label">Estado (UF) *</label>
                    <select
                      id="user-estado"
                      v-model="userForm.estado"
                      class="field-input"
                      :disabled="isSavingUser"
                      @change="handleUserFormEstadoChange"
                    >
                      <option value="" disabled>Selecione a UF</option>
                      <option v-for="uf in BRAZIL_STATES" :key="uf" :value="uf">
                        {{ uf }}
                      </option>
                    </select>
                  </div>

                  <!-- Cidade (Search field via API IBGE com a capital como padrão por estado) -->
                  <div class="form-field">
                    <label for="user-cidade" class="field-label">
                      Cidade *
                    </label>
                    <MulteiCitySearchField
                      v-model="userForm.cidade"
                      :uf="userForm.estado"
                      input-id="user-cidade"
                      placeholder="Digite para buscar a cidade..."
                      :disabled="isSavingUser"
                      required
                    />
                  </div>
                </div>

                <p v-if="userFeedbackError" class="login-error-alert" role="alert">
                  {{ userFeedbackError }}
                </p>

                <p v-if="userFeedbackSuccess" class="user-success-alert" role="status">
                  {{ userFeedbackSuccess }}
                </p>

                <!-- Confirmação inline de exclusão de usuário -->
                <div v-if="userPendingDelete" class="delete-confirm-banner" role="alertdialog" aria-labelledby="delete-user-confirm-title">
                  <p id="delete-user-confirm-title" class="delete-confirm-text">
                    ⚠️ Confirma a exclusão do usuário <strong>{{ userPendingDelete.nomeCompleto }}</strong> (<code>{{ userPendingDelete.email }}</code>) da coleção <code>usuarios</code>?
                  </p>
                  <div class="delete-confirm-actions">
                    <button
                      type="button"
                      class="btn-confirm-delete"
                      :disabled="isSavingUser"
                      @click="confirmDeleteUser"
                    >
                      {{ isSavingUser ? 'Excluindo...' : '🗑️ Sim, excluir usuário' }}
                    </button>
                    <button
                      type="button"
                      class="btn-cancel-delete"
                      :disabled="isSavingUser"
                      @click="userPendingDelete = null"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                <div class="user-form-actions">
                  <button
                    type="submit"
                    class="btn-login-submit btn-save-user"
                    :disabled="isSavingUser"
                  >
                    <span>
                      {{
                        isSavingUser
                          ? 'Salvando...'
                          : userFormMode === 'create'
                            ? '➕ Criar Usuário no Firebase'
                            : '💾 Salvar Alterações'
                      }}
                    </span>
                  </button>

                  <template v-if="userFormMode === 'edit' && selectedManagedUser">
                    <button
                      type="button"
                      class="btn-toggle-active-main"
                      :disabled="isSavingUser"
                      @click="handleToggleUserActive(selectedManagedUser)"
                    >
                      {{ selectedManagedUser.ativo ? '⏸️ Desativar Usuário' : '▶️ Ativar Usuário' }}
                    </button>

                    <button
                      type="button"
                      class="btn-delete-user-main"
                      :disabled="isSavingUser"
                      @click="promptDeleteUser(selectedManagedUser)"
                    >
                      🗑️ Excluir Usuário
                    </button>
                  </template>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </section>

    <!-- Câmera ao vivo para foto de resolução na aba Denúncias -->
    <MulteiCameraCapture
      v-if="showPartnerCamera"
      @photo-taken="handlePartnerCameraPhotoTaken"
      @cancel="showPartnerCamera = false"
    />

    <!-- Modal do Mapa do Multei no próprio Painel -->
    <div
      v-if="isMulteiMapModalOpen && mapModalTarget"
      class="multei-map-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="multei-map-modal-title"
      @click.self="closeMulteiLocationModal"
    >
      <div class="multei-map-modal-card">
        <header class="multei-map-modal-header">
          <div class="multei-map-modal-headings">
            <span class="panel-kicker">Averiguação de Local no Mapa</span>
            <h2 id="multei-map-modal-title" class="multei-map-modal-title">
              Local no Mapa do Multei • {{ formatIncidentLocation(mapModalTarget) }}
            </h2>
            <p class="multei-map-modal-subtitle">
              <template v-if="isLoadingMapIncidents">
                Carregando ocorrências próximas neste endereço...
              </template>
              <template v-else-if="sameSpotOtherIncidentsCount > 0">
                ⚠️ Há <strong>{{ sameSpotOtherIncidentsCount }}</strong>
                {{ sameSpotOtherIncidentsCount === 1 ? 'outra ocorrência ativa' : 'outras ocorrências ativas' }}
                num raio de 60m deste local. Clique nos pinos do mapa para comparar fotos e datas.
              </template>
              <template v-else>
                ✅ Clique no pino do mapa para visualizar o card da ocorrência como no Multei.
              </template>
            </p>
          </div>

          <div class="multei-map-modal-actions">
            <NuxtLink
              :to="`/multei?lat=${mapModalTarget.latitude}&lng=${mapModalTarget.longitude}&zoom=18`"
              target="_blank"
              class="btn-open-multei-tab"
              title="Abrir página completa do Multei centrada neste local"
            >
              Abrir página do Multei ↗
            </NuxtLink>
            <button
              type="button"
              class="btn-close-multei-map"
              aria-label="Fechar mapa do local"
              @click="closeMulteiLocationModal"
            >
              ✕ Fechar
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

    <!-- Modal Lightbox para Inspecionar Foto em Tamanho Grande -->
    <div
      v-if="isLightboxOpen && lightboxPhotoUrl"
      class="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Visualização ampliada da foto da ocorrência"
      @click.self="isLightboxOpen = false"
    >
      <div class="lightbox-content">
        <button
          type="button"
          class="btn-close-lightbox"
          aria-label="Fechar foto ampliada"
          @click="isLightboxOpen = false"
        >
          ✕ Fechar
        </button>
        <img
          :src="lightboxPhotoUrl"
          alt="Foto ampliada da ocorrência"
          class="lightbox-img"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import type { ReportedIncident } from '~/types';
import { requestUserLocation, normalizeState } from '~/services/geoService';
import {
  BRAZIL_STATES,
  getCapitalByState,
  normalizeSearchText
} from '~/services/ibgeService';
import { initializeGeminiClient, analyzeIncidentImage } from '~/services/geminiService';
import { prepareImageForGemini, blurSensitiveContentAndCompress } from '~/services/imageProcessor';
import {
  signInMulteiPanel,
  signOutMulteiPanel,
  subscribeToMulteiPanelAuth,
  refreshCurrentMulteiPanelProfile,
  fetchReportedIncidentsForPanel,
  reviewReportedIncidentInFirebase,
  fetchIncidentsByVisibleArea,
  fetchPanelUsersFromFirebase,
  createPanelUserInFirebase,
  updatePanelUserInFirebase,
  togglePanelUserActiveInFirebase,
  deletePanelUserFromFirebase,
  sendPanelUserPasswordReset,
  fetchPartnerIncidentsFromFirebase,
  resolveUrbanIncidentByPartnerInFirebase,
  subscribeToMulteiLiveEvents,
  type MulteiLiveDeltaEvent,
  type MulteiPanelUserProfile,
  type MulteiPanelManagedUser,
  type ReportedIncidentPanelItem,
  type ReportReviewDecision
} from '~/services/firebaseService';

const themeCookie = useCookie('theme', { default: () => 'light' });
const currentTheme = useState('theme', () => themeCookie.value || 'light');
const config = useRuntimeConfig();
const geminiClient = initializeGeminiClient(config.public?.geminiApiKey as string);

useHead({
  title: 'Painel de Averiguação | Multei • Vale PcD',
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

const adminMainSection = ref<'ocorrencias' | 'denuncias' | 'usuarios'>('ocorrencias');

const allReports = ref<ReportedIncidentPanelItem[]>([]);
const isLoadingReports = ref(false);
const activeTab = ref<'pendentes' | 'revisadas'>('pendentes');
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
const isLightboxOpen = ref(false);
const lightboxPhotoUrl = ref('');
const isMulteiMapModalOpen = ref(false);
const mapModalTarget = ref<any | null>(null);
const isLoadingMapIncidents = ref(false);
const nearbyMapIncidents = ref<any[]>([]);
const inspectedMapIncident = ref<any | null>(null);
const srAnnouncement = ref('');

// Estado da Aba "Denúncias" (Parcerias / Cidade + Ao meu redor 5km)
const partnerIncidents = ref<ReportedIncident[]>([]);
const isLoadingPartnerIncidents = ref(false);
const isLocatingPartnerGps = ref(false);
const partnerNearMeCenter = ref<{ latitude: number; longitude: number } | null>(null);
const partnerGpsError = ref('');
const partnerFilterTab = ref<'pendentes' | 'resolvidas'>('pendentes');
const selectedPartnerIncident = ref<ReportedIncident | null>(null);

// Filtros da Aba 2: Denúncias (Bairro e Tipo para todos; Estado e Cidade IBGE adicionais para Admin)
const denunciaFilterEstado = ref('');
const denunciaFilterCidade = ref('');
const denunciaFilterBairro = ref('');
const denunciaFilterNatureza = ref<'' | 'transito' | 'urbana'>('');

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
};

const hasActiveDenunciaFilters = computed(() =>
  Boolean(
    (isAdminRole.value && (denunciaFilterEstado.value || denunciaFilterCidade.value.trim())) ||
      denunciaFilterBairro.value.trim() ||
      denunciaFilterNatureza.value
  )
);

const availableDenunciaBairros = computed(() => {
  const targetUf = isAdminRole.value ? denunciaFilterEstado.value.trim().toUpperCase() : '';
  const targetCity = isAdminRole.value ? normalizeSearchText(denunciaFilterCidade.value) : '';
  const set = new Set<string>();

  for (const inc of partnerIncidents.value) {
    const incUf = (normalizeState(inc.estado || '') || inc.estado || '').trim().toUpperCase();
    if (targetUf && incUf !== targetUf) continue;
    if (targetCity && normalizeSearchText(inc.cidade) !== targetCity) continue;
    const b = (inc.bairro || '').trim();
    if (b) set.add(b);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
});

const showPartnerCamera = ref(false);
const partnerFileInputRef = ref<HTMLInputElement | null>(null);
const isProcessingPartnerPhoto = ref(false);
const partnerResolvedPhotoWebp = ref('');
const partnerResolveDescription = ref('');
const isSubmittingPartnerResolution = ref(false);
const partnerResolveError = ref('');
const partnerResolveSuccess = ref('');

// Estado de Gestão de Usuários
const panelUsers = ref<MulteiPanelManagedUser[]>([]);
const isLoadingUsers = ref(false);
const isSavingUser = ref(false);
const userFormMode = ref<'create' | 'edit'>('create');
const editingUserId = ref<string | null>(null);
const showNewUserPassword = ref(false);
const userFeedbackError = ref('');
const userFeedbackSuccess = ref('');
const userPendingDelete = ref<MulteiPanelManagedUser | null>(null);

const userForm = ref<{
  role: 'admin' | 'parceria';
  nome: string;
  sobrenome: string;
  email: string;
  senha: string;
  cidade: string;
  estado: string;
  ativo: boolean;
}>({
  role: 'parceria',
  nome: '',
  sobrenome: '',
  email: '',
  senha: '',
  cidade: getCapitalByState('SP'),
  estado: 'SP',
  ativo: true
});

const handleUserFormEstadoChange = () => {
  const cap = getCapitalByState(userForm.value.estado);
  if (cap) {
    userForm.value.cidade = cap;
  }
};

const selectedManagedUser = computed(() =>
  panelUsers.value.find((u) => u.id === editingUserId.value) || null
);

let unsubscribeAuth: (() => void) | null = null;
let unsubscribeLiveEvents: (() => void) | null = null;
let liveReportsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let livePartnerDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const openPanelLightbox = (url?: string) => {
  if (!url) return;
  lightboxPhotoUrl.value = url;
  isLightboxOpen.value = true;
};

const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistanceFromPartner = (inc: ReportedIncident): string => {
  if (!partnerNearMeCenter.value) return '';
  const meters = getDistanceMeters(
    partnerNearMeCenter.value.latitude,
    partnerNearMeCenter.value.longitude,
    Number(inc.latitude),
    Number(inc.longitude)
  );
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) {
    return `a ${Math.round(meters)} m`;
  }
  return `a ${(meters / 1000).toFixed(1).replace('.', ',')} km`;
};

const baseFilteredPartnerIncidents = computed(() => {
  const targetUf = isAdminRole.value ? denunciaFilterEstado.value.trim().toUpperCase() : '';
  const targetCity = isAdminRole.value ? normalizeSearchText(denunciaFilterCidade.value) : '';
  const targetBairro = normalizeSearchText(denunciaFilterBairro.value);
  const targetNatureza = denunciaFilterNatureza.value;

  return partnerIncidents.value.filter((inc) => {
    if (targetUf) {
      const incUf = (normalizeState(inc.estado || '') || inc.estado || '').trim().toUpperCase();
      if (incUf !== targetUf) return false;
    }
    if (targetCity) {
      if (normalizeSearchText(inc.cidade) !== targetCity) return false;
    }
    if (targetBairro) {
      if (!normalizeSearchText(inc.bairro).includes(targetBairro)) return false;
    }
    if (targetNatureza) {
      const incNatureza = inc.natureza === 'urbana' ? 'urbana' : 'transito';
      if (incNatureza !== targetNatureza) return false;
    }
    return true;
  });
});

const pendingPartnerIncidents = computed(() =>
  baseFilteredPartnerIncidents.value.filter((inc) => !inc.resolvido)
);

const resolvedPartnerIncidents = computed(() =>
  baseFilteredPartnerIncidents.value.filter((inc) => Boolean(inc.resolvido))
);

const filteredPartnerIncidents = computed(() =>
  partnerFilterTab.value === 'pendentes'
    ? pendingPartnerIncidents.value
    : resolvedPartnerIncidents.value
);

watch(filteredPartnerIncidents, (list) => {
  if (!selectedPartnerIncident.value) {
    selectedPartnerIncident.value = list[0] || null;
    return;
  }
  const stillExists = list.some((i) => i.id === selectedPartnerIncident.value?.id);
  if (!stillExists) {
    selectedPartnerIncident.value = list[0] || null;
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
      radiusKm: 5
    });
    partnerIncidents.value = items;

    const currentList =
      partnerFilterTab.value === 'pendentes'
        ? pendingPartnerIncidents.value
        : resolvedPartnerIncidents.value;

    if (selectedPartnerIncident.value) {
      const updated = currentList.find((i) => i.id === selectedPartnerIncident.value?.id);
      if (updated) {
        selectedPartnerIncident.value = updated;
        return;
      }
    }
    selectedPartnerIncident.value = currentList[0] || null;
  } catch (err) {
    console.warn('[painel] Erro ao carregar denúncias da cidade:', err);
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
    announceSr('Localização GPS obtida. Buscando ocorrências num raio de 5 km.');
    await loadPartnerDenuncias();
  } catch {
    partnerGpsError.value =
      'Não foi possível acessar o seu GPS. Permita o acesso à localização no navegador para usar a função "Ao meu redor (5 km)".';
  } finally {
    isLocatingPartnerGps.value = false;
  }
};

const clearPartnerAroundMe = async () => {
  partnerNearMeCenter.value = null;
  partnerGpsError.value = '';
  await loadPartnerDenuncias();
};

const selectPartnerTab = (tab: 'pendentes' | 'resolvidas') => {
  partnerFilterTab.value = tab;
  const list = tab === 'pendentes' ? pendingPartnerIncidents.value : resolvedPartnerIncidents.value;
  selectedPartnerIncident.value = list[0] || null;
  partnerResolveError.value = '';
  partnerResolveSuccess.value = '';
};

const selectPartnerIncident = (inc: ReportedIncident) => {
  selectedPartnerIncident.value = inc;
  partnerResolvedPhotoWebp.value = '';
  partnerResolveDescription.value = '';
  partnerResolveError.value = '';
  partnerResolveSuccess.value = '';
};

const processPartnerResolutionPhoto = async (file: File) => {
  isProcessingPartnerPhoto.value = true;
  partnerResolveError.value = '';
  try {
    const optimizedBase64 = await prepareImageForGemini(file);
    let plates: any[] = [];
    let faces: any[] = [];

    if (geminiClient) {
      const analysis = await analyzeIncidentImage(geminiClient, optimizedBase64, 'urbana');
      if (!analysis.apiError) {
        if (!analysis.isAppropriate) {
          partnerResolveError.value = 'A imagem enviada contém conteúdo impróprio e não pôde ser aceita.';
          return;
        }
        plates = analysis.plates || [];
        faces = analysis.faces || [];
      }
    }

    const finalWebp = await blurSensitiveContentAndCompress(optimizedBase64, plates, faces);
    partnerResolvedPhotoWebp.value = finalWebp;
  } catch {
    partnerResolveError.value = 'Não foi possível processar a foto selecionada. Tente outra imagem.';
  } finally {
    isProcessingPartnerPhoto.value = false;
  }
};

const handlePartnerFileSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input?.files?.[0];
  if (file) {
    await processPartnerResolutionPhoto(file);
  }
  if (input) input.value = '';
};

const handlePartnerCameraPhotoTaken = async (file: File) => {
  showPartnerCamera.value = false;
  if (file) {
    await processPartnerResolutionPhoto(file);
  }
};

const handlePartnerSubmitResolution = async () => {
  const current = selectedPartnerIncident.value;
  if (!current || !current.id || isSubmittingPartnerResolution.value) return;

  partnerResolveError.value = '';
  partnerResolveSuccess.value = '';

  if (!partnerResolvedPhotoWebp.value) {
    partnerResolveError.value = 'Envie uma nova foto demonstrando que o problema de acesso urbano foi corrigido.';
    return;
  }
  if (partnerResolveDescription.value.trim().length < 10) {
    partnerResolveError.value = 'Preencha uma descrição da correção com pelo menos 10 caracteres.';
    return;
  }

  isSubmittingPartnerResolution.value = true;
  try {
    const partnerLabel = userProfile.value?.nomeCompleto
      ? `${userProfile.value.nomeCompleto}${userProfile.value.cidade ? ` (${userProfile.value.cidade})` : ''}`
      : userProfile.value?.email || '';

    const res = await resolveUrbanIncidentByPartnerInFirebase({
      ocorrenciaId: current.id,
      foto: partnerResolvedPhotoWebp.value,
      descricao: partnerResolveDescription.value.trim(),
      resolvidoPor: partnerLabel,
      incident: current
    });

    const updatedIncident: ReportedIncident = {
      ...current,
      resolvido: true,
      status_resolucao: 'resolvido',
      resolvido_em_validacao: false,
      foto_resolucao: res.fotoResolucaoUrl,
      descricao_resolucao: res.descricaoResolucao,
      data_resolucao: res.dataResolucao,
      resolvido_por: partnerLabel
    };

    const idx = partnerIncidents.value.findIndex((i) => i.id === current.id);
    if (idx !== -1) {
      partnerIncidents.value[idx] = updatedIncident;
    }

    partnerResolvedPhotoWebp.value = '';
    partnerResolveDescription.value = '';
    partnerFilterTab.value = 'resolvidas';
    selectedPartnerIncident.value = updatedIncident;
    partnerResolveSuccess.value = 'Problema declarado como corrigido! O pino no mapa agora é verde com check e exibe o Antes e Depois.';
    announceSr(partnerResolveSuccess.value);
  } catch (err: any) {
    partnerResolveError.value = err?.message || 'Não foi possível salvar a resolução no Firebase.';
  } finally {
    isSubmittingPartnerResolution.value = false;
  }
};

const panelMapIncidents = computed(() => {
  const current = mapModalTarget.value;
  if (!current) return nearbyMapIncidents.value;

  const targetId = String(current.ocorrenciaId || current.id || '').trim();
  const isResolved = Boolean(current.resolvido);
  const currentAsIncident = {
    id: targetId,
    timestamp: current.timestamp || current.data,
    data: current.data || current.timestamp,
    latitude: current.latitude,
    longitude: current.longitude,
    foto: current.fotoUrl || current.maskedImageUrl,
    fotoUrl: current.fotoUrl || current.maskedImageUrl,
    maskedImageUrl: current.fotoUrl || current.maskedImageUrl,
    natureza: current.natureza,
    descricao: current.descricao,
    rua: current.rua,
    bairro: current.bairro,
    cidade: current.cidade,
    estado: current.estado,
    classificacao: current.classificacao,
    verificacao: current.verificacao,
    ativo: current.ativo ?? true,
    resolvido: isResolved,
    status_resolucao: isResolved ? 'resolvido' : current.status_resolucao,
    foto_resolucao: current.foto_resolucao || '',
    descricao_resolucao: current.descricao_resolucao || '',
    data_resolucao: current.data_resolucao || ''
  };

  const others = nearbyMapIncidents.value.filter(
    (inc) => String(inc?.id || '').trim() !== targetId
  );
  return [currentAsIncident, ...others];
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

const handlePanelMapMarkerClick = (incident: any) => {
  inspectedMapIncident.value = incident;
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

watch(filteredItems, (list) => {
  if (!selectedItem.value) {
    selectedItem.value = list[0] || null;
    adminNote.value = selectedItem.value?.observacao_admin || '';
    return;
  }
  const stillExists = list.some((i) => i.ocorrenciaId === selectedItem.value?.ocorrenciaId);
  if (!stillExists) {
    selectedItem.value = list[0] || null;
    adminNote.value = selectedItem.value?.observacao_admin || '';
  }
});

const announceSr = (msg: string) => {
  srAnnouncement.value = '';
  setTimeout(() => {
    srAnnouncement.value = msg;
  }, 50);
};

const switchAdminMainSection = async (section: 'ocorrencias' | 'denuncias' | 'usuarios') => {
  if (!isAdminRole.value && section !== 'denuncias') {
    adminMainSection.value = 'denuncias';
    return;
  }
  adminMainSection.value = section;
  if (section === 'usuarios' && panelUsers.value.length === 0) {
    await loadPanelUsers();
  } else if (section === 'denuncias' && partnerIncidents.value.length === 0) {
    await loadPartnerDenuncias();
  }
};

const loadPanelUsers = async () => {
  if (!userProfile.value || userProfile.value.role !== 'admin') return;
  isLoadingUsers.value = true;
  try {
    panelUsers.value = await fetchPanelUsersFromFirebase();
  } catch (err) {
    console.warn('[painel] Erro ao carregar usuários:', err);
    userFeedbackError.value = 'Não foi possível carregar a lista de usuários da coleção usuarios.';
  } finally {
    isLoadingUsers.value = false;
  }
};

const startCreateUser = () => {
  userFormMode.value = 'create';
  editingUserId.value = null;
  userPendingDelete.value = null;
  userFeedbackError.value = '';
  userFeedbackSuccess.value = '';
  showNewUserPassword.value = false;
  userForm.value = {
    role: 'parceria',
    nome: '',
    sobrenome: '',
    email: '',
    senha: '',
    cidade: getCapitalByState('SP'),
    estado: 'SP',
    ativo: true
  };
};

const selectUserForEdit = (u: MulteiPanelManagedUser) => {
  const uf = (u.estado || 'SP').trim().toUpperCase();
  userFormMode.value = 'edit';
  editingUserId.value = u.id;
  userPendingDelete.value = null;
  userFeedbackError.value = '';
  userFeedbackSuccess.value = '';
  userForm.value = {
    role: u.role === 'parceria' ? 'parceria' : 'admin',
    nome: u.nome || '',
    sobrenome: u.sobrenome || '',
    email: u.email || '',
    senha: '',
    cidade: u.cidade || getCapitalByState(uf),
    estado: uf,
    ativo: u.ativo !== false
  };
};

const translateUserCrudError = (err: any): string => {
  const raw = `${err?.code || ''} ${err?.message || ''}`.toLowerCase();
  if (raw.includes('email-already-in-use')) {
    return 'Este endereço de e-mail já está cadastrado no Firebase Authentication.';
  }
  if (raw.includes('weak-password')) {
    return 'A senha informada é muito fraca. Utilize pelo menos 6 caracteres.';
  }
  if (raw.includes('invalid-email')) {
    return 'O formato do e-mail informado é inválido.';
  }
  return err?.message || 'Não foi possível concluir a operação no Firebase.';
};

const handleSaveUser = async () => {
  if (isSavingUser.value) return;
  userFeedbackError.value = '';
  userFeedbackSuccess.value = '';
  userPendingDelete.value = null;

  isSavingUser.value = true;
  try {
    if (userFormMode.value === 'create') {
      const created = await createPanelUserInFirebase({
        role: userForm.value.role,
        nome: userForm.value.nome,
        sobrenome: userForm.value.sobrenome,
        email: userForm.value.email,
        senha: userForm.value.senha,
        cidade: userForm.value.cidade,
        estado: userForm.value.estado,
        ativo: userForm.value.ativo
      });
      await loadPanelUsers();
      selectUserForEdit(created);
      userFeedbackSuccess.value = `Usuário "${created.nomeCompleto}" criado com sucesso no Firebase Auth e salvo na coleção usuarios (sem senha armazenada no banco).`;
      announceSr(userFeedbackSuccess.value);
    } else if (editingUserId.value) {
      await updatePanelUserInFirebase(editingUserId.value, {
        role: userForm.value.role,
        nome: userForm.value.nome,
        sobrenome: userForm.value.sobrenome,
        email: userForm.value.email,
        cidade: userForm.value.cidade,
        estado: userForm.value.estado,
        ativo: userForm.value.ativo
      });
      await loadPanelUsers();
      if (userProfile.value && editingUserId.value === userProfile.value.uid) {
        const refreshed = await refreshCurrentMulteiPanelProfile();
        if (refreshed) userProfile.value = refreshed;
      }
      userFeedbackSuccess.value = 'Dados do usuário atualizados com sucesso.';
      announceSr(userFeedbackSuccess.value);
    }
  } catch (err: any) {
    userFeedbackError.value = translateUserCrudError(err);
  } finally {
    isSavingUser.value = false;
  }
};

const handleToggleUserActive = async (u: MulteiPanelManagedUser) => {
  if (isSavingUser.value) return;
  userFeedbackError.value = '';
  userFeedbackSuccess.value = '';
  isSavingUser.value = true;
  const nextActive = !u.ativo;
  try {
    await togglePanelUserActiveInFirebase(u.id, nextActive);
    await loadPanelUsers();
    if (editingUserId.value === u.id) {
      userForm.value.ativo = nextActive;
    }
    userFeedbackSuccess.value = nextActive
      ? `Usuário "${u.nomeCompleto}" ativado com sucesso.`
      : `Usuário "${u.nomeCompleto}" desativado com sucesso.`;
    announceSr(userFeedbackSuccess.value);
  } catch (err: any) {
    userFeedbackError.value = translateUserCrudError(err);
  } finally {
    isSavingUser.value = false;
  }
};

const promptDeleteUser = (u: MulteiPanelManagedUser) => {
  userFeedbackError.value = '';
  userFeedbackSuccess.value = '';
  if (editingUserId.value !== u.id) {
    selectUserForEdit(u);
  }
  userPendingDelete.value = u;
};

const confirmDeleteUser = async () => {
  const target = userPendingDelete.value;
  if (!target || isSavingUser.value) return;
  isSavingUser.value = true;
  userFeedbackError.value = '';
  userFeedbackSuccess.value = '';
  try {
    await deletePanelUserFromFirebase(target.id);
    const deletedName = target.nomeCompleto;
    userPendingDelete.value = null;
    await loadPanelUsers();
    startCreateUser();
    userFeedbackSuccess.value = `Usuário "${deletedName}" excluído da coleção usuarios com sucesso.`;
    announceSr(userFeedbackSuccess.value);
  } catch (err: any) {
    userFeedbackError.value = translateUserCrudError(err);
  } finally {
    isSavingUser.value = false;
  }
};

const handleSendPasswordReset = async () => {
  if (!userForm.value.email || isSavingUser.value) return;
  userFeedbackError.value = '';
  userFeedbackSuccess.value = '';
  isSavingUser.value = true;
  try {
    await sendPanelUserPasswordReset(userForm.value.email);
    userFeedbackSuccess.value = `E-mail de redefinição de senha enviado para ${userForm.value.email}.`;
    announceSr(userFeedbackSuccess.value);
  } catch (err: any) {
    userFeedbackError.value = translateUserCrudError(err);
  } finally {
    isSavingUser.value = false;
  }
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

    const currentList = activeTab.value === 'pendentes' ? pendingItems.value : reviewedItems.value;
    if (selectedItem.value) {
      const updatedSelected = items.find((i) => i.ocorrenciaId === selectedItem.value?.ocorrenciaId);
      if (updatedSelected && Boolean(updatedSelected.revisada) === (activeTab.value === 'revisadas')) {
        selectedItem.value = updatedSelected;
        if (!isSilent) {
          adminNote.value = updatedSelected.observacao_admin || '';
        }
        return;
      }
    }
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

const selectTab = (tab: 'pendentes' | 'revisadas') => {
  activeTab.value = tab;
  const list = tab === 'pendentes' ? pendingItems.value : reviewedItems.value;
  selectedItem.value = list[0] || null;
  adminNote.value = selectedItem.value?.observacao_admin || '';
  decisionError.value = '';
};

const selectIncident = (item: ReportedIncidentPanelItem) => {
  selectedItem.value = item;
  adminNote.value = item.observacao_admin || '';
  decisionError.value = '';
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
    loginError.value = 'Por favor, insira um endereço de e-mail válido (exemplo: seuemail@valepcd.com.br).';
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
    announceSr('Login realizado com sucesso.');
    if (profile.role === 'admin') {
      adminMainSection.value = 'ocorrencias';
      await Promise.all([loadReports(), loadPanelUsers(), loadPartnerDenuncias()]);
    } else {
      adminMainSection.value = 'denuncias';
      await loadPartnerDenuncias();
    }
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
      loginError.value = 'O login por E-mail e Senha ainda não está ativado no Firebase Authentication.';
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
    await signOutMulteiPanel();
    userProfile.value = null;
    allReports.value = [];
    panelUsers.value = [];
    partnerIncidents.value = [];
    selectedItem.value = null;
    selectedPartnerIncident.value = null;
    partnerNearMeCenter.value = null;
  } catch {}
};

const isDuplicityReviewItem = (item?: ReportedIncidentPanelItem | null): boolean => {
  if (!item) return false;
  return Boolean(item.possivel_duplicidade || item.resultado_revisao === 'indefinido');
};

const getVerdictMiniBadgeClass = (decision?: ReportReviewDecision | ''): string => {
  if (decision === 'procedente' || decision === 'duplicidade') {
    return 'verdict-procedente';
  }
  if (decision === 'indefinido') {
    return 'verdict-pendente';
  }
  return 'verdict-improcedente';
};

const getVerdictMiniBadgeLabel = (decision?: ReportReviewDecision | ''): string => {
  if (decision === 'nao_duplicidade') return '✅ Não é duplicidade';
  if (decision === 'indefinido') return '⚖️ Indefinido';
  if (decision === 'duplicidade') return '🚫 É duplicidade';
  if (decision === 'procedente') return '🚫 Procedente';
  return '✅ Improcedente';
};

const getReviewedBannerClass = (decision?: ReportReviewDecision | ''): string => {
  if (decision === 'procedente' || decision === 'duplicidade') {
    return 'banner-procedente';
  }
  if (decision === 'indefinido') {
    return 'banner-indefinido';
  }
  return 'banner-improcedente';
};

const getReviewedBannerTitle = (decision?: ReportReviewDecision | ''): string => {
  if (decision === 'nao_duplicidade') {
    return '✅ Revisada: Não é duplicidade (+1 na contagem de denúncias e ativa no mapa)';
  }
  if (decision === 'indefinido') {
    return '⚖️ Revisada: Indefinido (Mantida sem incrementar na contagem)';
  }
  if (decision === 'duplicidade') {
    return '🚫 Revisada: É duplicidade (Denúncia inativada no mapa)';
  }
  if (decision === 'procedente') {
    return '🚫 Revisada: Denúncia Procedente (Ocorrência mantida inativa)';
  }
  return '✅ Revisada: Denúncia Improcedente (Ocorrência ativa no mapa)';
};

const handleReviewDecision = async (decision: ReportReviewDecision) => {
  if (!selectedItem.value || isSubmittingDecision.value) return;
  isSubmittingDecision.value = true;
  decisionError.value = '';

  try {
    const reviewerLabel = userProfile.value?.nomeCompleto
      ? `${userProfile.value.nomeCompleto} (${userProfile.value.email})`
      : userProfile.value?.email || '';
    const updated = await reviewReportedIncidentInFirebase({
      item: selectedItem.value,
      decision,
      observacaoAdmin: adminNote.value,
      reviewerEmail: reviewerLabel
    });

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
      nao_duplicidade: 'Marcada como não é duplicidade e contabilizada nas estatísticas.',
      indefinido: 'Marcada como indefinido, sem incrementar na contagem.',
      duplicidade: 'Marcada como é duplicidade e inativada no mapa.',
      improcedente: 'Ocorrência marcada como improcedente e reativada no mapa.',
      procedente: 'Ocorrência marcada como procedente e mantida inativa.'
    };
    announceSr(srMessages[decision] || 'Revisão salva com sucesso.');

    if (activeTab.value === 'pendentes') {
      const nextPending = pendingItems.value[0] || null;
      selectedItem.value = nextPending;
      adminNote.value = nextPending?.observacao_admin || '';
    } else {
      selectedItem.value = allReports.value[idx] || updated;
    }
  } catch {
    decisionError.value = 'Não foi possível salvar a revisão no Firebase. Verifique sua conexão ou permissões.';
  } finally {
    isSubmittingDecision.value = false;
  }
};

const formatShortLocation = (item: ReportedIncidentPanelItem) => {
  const cityState = [item.cidade, item.estado].filter(Boolean).join('/');
  const streetPart = [item.rua, item.bairro].filter(Boolean).join(' - ');
  if (streetPart && cityState) return `${streetPart} (${cityState})`;
  return streetPart || cityState || `Lat ${item.latitude.toFixed(4)}, Lng ${item.longitude.toFixed(4)}`;
};

const formatIncidentLocation = (item: any) => {
  if (!item) return '';
  const cityState = [item.cidade, item.estado].filter(Boolean).join('/');
  const streetPart = [item.rua, item.bairro].filter(Boolean).join(' - ');
  if (streetPart && cityState) return `${streetPart} (${cityState})`;
  return streetPart || cityState || `Lat ${Number(item.latitude).toFixed(4)}, Lng ${Number(item.longitude).toFixed(4)}`;
};

const formatDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface LivePanelNotificationItem {
  id: number;
  title: string;
  subtitle: string;
  ocorrenciaId?: string;
  targetSection: 'ocorrencias' | 'denuncias';
}

const livePanelNotification = ref<LivePanelNotificationItem | null>(null);
let liveToastTimer: ReturnType<typeof setTimeout> | null = null;

const dismissLivePanelNotification = () => {
  livePanelNotification.value = null;
  if (liveToastTimer) {
    clearTimeout(liveToastTimer);
    liveToastTimer = null;
  }
};

const showLivePanelToast = (notification: LivePanelNotificationItem) => {
  livePanelNotification.value = notification;
  announceSr(`${notification.title} ${notification.subtitle}`.trim());
  if (liveToastTimer) {
    clearTimeout(liveToastTimer);
  }
  liveToastTimer = setTimeout(() => {
    livePanelNotification.value = null;
    liveToastTimer = null;
  }, 15000);
};

const focusLiveNotificationIncident = async () => {
  const notif = livePanelNotification.value;
  dismissLivePanelNotification();
  if (!notif) return;

  if (notif.targetSection === 'ocorrencias' && isAdminRole.value) {
    adminMainSection.value = 'ocorrencias';
    activeTab.value = 'pendentes';
    await loadReports({ silent: true });
    if (notif.ocorrenciaId) {
      const match = pendingItems.value.find((i) => i.ocorrenciaId === notif.ocorrenciaId || i.id === notif.ocorrenciaId);
      if (match) {
        selectedItem.value = match;
        adminNote.value = match.observacao_admin || '';
        return;
      }
    }
    if (pendingItems.value[0]) {
      selectedItem.value = pendingItems.value[0];
      adminNote.value = pendingItems.value[0].observacao_admin || '';
    }
    return;
  }

  adminMainSection.value = 'denuncias';
  partnerFilterTab.value = 'pendentes';
  await loadPartnerDenuncias({ silent: true });
  if (notif.ocorrenciaId) {
    const match = pendingPartnerIncidents.value.find((i) => i.id === notif.ocorrenciaId);
    if (match) {
      selectPartnerIncident(match);
      return;
    }
  }
  if (pendingPartnerIncidents.value[0]) {
    selectPartnerIncident(pendingPartnerIncidents.value[0]);
  }
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

const scheduleSilentReportsRefresh = () => {
  if (!userProfile.value || userProfile.value.role !== 'admin') return;
  if (liveReportsDebounceTimer) {
    clearTimeout(liveReportsDebounceTimer);
  }
  liveReportsDebounceTimer = setTimeout(() => {
    liveReportsDebounceTimer = null;
    void loadReports({ silent: true });
  }, 350);
};

const scheduleSilentPartnerRefresh = () => {
  if (!userProfile.value) return;
  if (livePartnerDebounceTimer) {
    clearTimeout(livePartnerDebounceTimer);
  }
  livePartnerDebounceTimer = setTimeout(() => {
    livePartnerDebounceTimer = null;
    void loadPartnerDenuncias({ silent: true });
  }, 350);
};

onMounted(() => {
  unsubscribeAuth = subscribeToMulteiPanelAuth(
    async (profile) => {
      userProfile.value = profile;
      isCheckingAuth.value = false;
      if (profile?.role === 'admin') {
        adminMainSection.value = 'ocorrencias';
        await Promise.all([loadReports(), loadPanelUsers(), loadPartnerDenuncias()]);
      } else if (profile) {
        adminMainSection.value = 'denuncias';
        await loadPartnerDenuncias();
      } else {
        dismissLivePanelNotification();
        allReports.value = [];
        panelUsers.value = [];
        partnerIncidents.value = [];
        selectedItem.value = null;
        selectedPartnerIncident.value = null;
        partnerNearMeCenter.value = null;
      }
    },
    () => {
      dismissLivePanelNotification();
      allReports.value = [];
      panelUsers.value = [];
      partnerIncidents.value = [];
      selectedItem.value = null;
      selectedPartnerIncident.value = null;
      partnerNearMeCenter.value = null;
      loginError.value = 'Sua sessão de 24 horas expirou. Por favor, faça login novamente.';
      announceSr(loginError.value);
    }
  );

  // Listener em tempo real (SSE + Poll + BroadcastChannel, igual ao contador ao vivo de /multei/sobre)
  // para atualizar automaticamente novos reports, denúncias e resoluções sem precisar clicar em "Atualizar",
  // e notificar o parceiro quando uma nova ocorrência acontece na sua cidade cadastrada.
  unsubscribeLiveEvents = subscribeToMulteiLiveEvents((evt) => {
    if (!userProfile.value) return;

    const isAdmin = userProfile.value.role === 'admin';
    const matchesCity = doesLiveEventMatchPartnerCity(evt);

    if (isAdmin && (evt.category === 'reportadas' || evt.delta === -1)) {
      scheduleSilentReportsRefresh();
    }

    if (!matchesCity) {
      return;
    }

    if (
      evt.category === 'infracoesTransito' ||
      evt.category === 'mobilidadeUrbana' ||
      evt.category === 'resolvidos' ||
      evt.category === 'denunciasPainel' ||
      evt.category === 'reportadas'
    ) {
      scheduleSilentPartnerRefresh();
    }

    // Notificação visual no painel para novas ocorrências na cidade do parceiro (ou para o Admin)
    if (
      evt.delta === 1 &&
      (evt.category === 'infracoesTransito' || evt.category === 'mobilidadeUrbana')
    ) {
      const cityLabel = [
        evt.cidade || (!isAdmin ? userProfile.value.cidade : ''),
        evt.estado || (!isAdmin ? userProfile.value.estado : '')
      ]
        .filter(Boolean)
        .join('/');
      const naturezaLabel =
        evt.natureza === 'urbana' || evt.category === 'mobilidadeUrbana'
          ? '🚧 Problema de Acesso Urbano'
          : '🚗 Infração de Trânsito';
      const addressPart = [evt.rua, evt.bairro].filter(Boolean).join(' - ');

      showLivePanelToast({
        id: evt.id,
        title: cityLabel
          ? `Nova ocorrência reportada em ${cityLabel}!`
          : 'Nova ocorrência reportada!',
        subtitle: [naturezaLabel, addressPart].filter(Boolean).join(' • '),
        ocorrenciaId: evt.ocorrenciaId,
        targetSection: 'denuncias'
      });
    } else if (isAdmin && evt.delta === 1 && evt.category === 'reportadas' && evt.action === 'novo_report') {
      const cityLabel = [evt.cidade, evt.estado].filter(Boolean).join('/');
      const addressPart = [evt.rua, evt.bairro].filter(Boolean).join(' - ');
      showLivePanelToast({
        id: evt.id,
        title: cityLabel
          ? `Nova ocorrência sinalizada para revisão em ${cityLabel}!`
          : 'Nova ocorrência sinalizada para revisão!',
        subtitle: addressPart || 'Aba Ocorrências Reportadas atualizada automaticamente.',
        ocorrenciaId: evt.ocorrenciaId,
        targetSection: 'ocorrencias'
      });
    }
  });
});

onBeforeUnmount(() => {
  if (typeof unsubscribeAuth === 'function') {
    unsubscribeAuth();
  }
  if (typeof unsubscribeLiveEvents === 'function') {
    unsubscribeLiveEvents();
  }
  if (liveReportsDebounceTimer) {
    clearTimeout(liveReportsDebounceTimer);
    liveReportsDebounceTimer = null;
  }
  if (livePartnerDebounceTimer) {
    clearTimeout(livePartnerDebounceTimer);
    livePartnerDebounceTimer = null;
  }
  if (liveToastTimer) {
    clearTimeout(liveToastTimer);
    liveToastTimer = null;
  }
});
</script>

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

  --pp-amber-bg: #fffbeb;
  --pp-amber-border: #92400e;
  --pp-amber-text: #78350f;

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

  --pp-amber-bg: #451a03;
  --pp-amber-border: #fcd34d;
  --pp-amber-text: #fffbeb;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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

.user-identity {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.user-name-text {
  font-size: 0.9rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.user-email-text {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
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

.spinner-circle {
  width: 36px;
  height: 36px;
  border: 4px solid var(--pp-border);
  border-top-color: var(--pp-accent);
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.login-tag,
.panel-kicker {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--pp-text-secondary);
  margin-bottom: 0.35rem;
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

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--pp-text-primary);
}

.field-input {
  width: 100%;
  padding: 0.78rem 0.95rem;
  border-radius: 12px;
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.96rem;
  font-family: inherit;
}

.field-input:focus {
  outline: 3px solid var(--pp-accent);
  outline-offset: 1px;
}

.field-input[aria-invalid="true"] {
  border-color: var(--pp-danger-border);
}

.password-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  padding-right: 3rem;
}

.btn-toggle-pass {
  position: absolute;
  right: 0.6rem;
  background: transparent;
  border: none;
  font-size: 1.15rem;
  cursor: pointer;
  padding: 0.3rem;
}

.login-error-alert {
  margin: 0;
  padding: 0.75rem 0.95rem;
  border-radius: 12px;
  background: var(--pp-red-bg);
  border: 1.5px solid var(--pp-red-border);
  color: var(--pp-red-text);
  font-size: 0.9rem;
  font-weight: 700;
}

.btn-login-submit {
  width: 100%;
  padding: 0.9rem 1.25rem;
  border-radius: 9999px;
  border: none;
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.btn-login-submit:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn-login-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Cabeçalho do Painel */
.panel-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.panel-main-title {
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  font-weight: 900;
  margin: 0 0 0.35rem;
  color: var(--pp-text-primary);
}

.panel-main-subtitle {
  margin: 0;
  font-size: 0.98rem;
  color: var(--pp-text-secondary);
  max-width: 720px;
}

.btn-refresh-list {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 1.15rem;
  border-radius: 9999px;
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
}

/* Layout Master-Detail */
.master-detail-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 1.5rem;
  align-items: start;
}

.master-column {
  background: var(--pp-surface);
  border: 1.5px solid var(--pp-border);
  border-radius: 22px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 78vh;
}

.filter-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1.5px solid var(--pp-border);
  background: var(--pp-surface-alt);
}

.filter-tab-btn {
  padding: 0.95rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--pp-text-secondary);
  font-weight: 800;
  font-size: 0.92rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  border-bottom: 3px solid transparent;
}

.filter-tab-btn.is-active {
  color: var(--pp-text-primary);
  background: var(--pp-surface);
  border-bottom-color: var(--pp-accent);
}

.tab-counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 22px;
  padding: 0 0.45rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 900;
  background: var(--pp-surface-alt);
  border: 1px solid var(--pp-border-strong);
}

.report-list {
  list-style: none;
  margin: 0;
  padding: 0.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.report-item-btn {
  width: 100%;
  text-align: left;
  background: var(--pp-surface-alt);
  border: 2px solid var(--pp-border);
  border-radius: 16px;
  padding: 0.95rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: all 0.15s ease;
}

.report-item-btn:hover {
  border-color: var(--pp-border-strong);
}

.report-item-btn.is-selected {
  background: var(--pp-selected-bg);
  border-color: var(--pp-selected-border);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

.report-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.natureza-pill {
  display: inline-block;
  padding: 0.22rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
}

.pill-transito {
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  border: 1.5px solid var(--pp-red-border);
}

.pill-urbana {
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1.5px solid var(--pp-amber-border);
}

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

.duplicity-panel-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.22rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 900;
  background: #fef3c7;
  color: #92400e;
  border: 1.5px solid #f59e0b;
}

.repeat-badge-lg {
  font-size: 0.84rem;
  padding: 0.3rem 0.85rem;
}

.report-item-location {
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--pp-text-primary);
}

.report-item-reason {
  margin: 0;
  font-size: 0.86rem;
  color: var(--pp-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.report-item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.2rem;
}

.report-item-date {
  font-size: 0.76rem;
  color: var(--pp-text-secondary);
  font-weight: 600;
}

.verdict-mini-badge {
  font-size: 0.74rem;
  font-weight: 800;
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
}

.verdict-pendente {
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  border: 1px solid var(--pp-border-strong);
}

.verdict-procedente {
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  border: 1px solid var(--pp-red-border);
}

.verdict-improcedente {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1px solid var(--pp-green-border);
}

/* Coluna Direita (Detalhes) */
.detail-column {
  background: var(--pp-surface);
  border: 1.5px solid var(--pp-border);
  border-radius: 22px;
  padding: 1.5rem;
  min-height: 540px;
}

.list-empty-state,
.detail-empty-state {
  text-align: center;
  padding: 3.5rem 1.5rem;
  color: var(--pp-text-secondary);
}

.empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.65rem;
}

.empty-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--pp-text-primary);
  margin: 0 0 0.35rem;
}

.empty-desc {
  margin: 0;
  font-size: 0.92rem;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
  border-bottom: 1.5px solid var(--pp-border);
}

.detail-header-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
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

.detail-id-code {
  font-family: monospace;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
}

.detail-content-split {
  display: grid;
  grid-template-columns: minmax(260px, 360px) 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.photo-wrapper {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  border: 1.5px solid var(--pp-border);
  background: #000;
}

.detail-photo-img {
  width: 100%;
  max-height: 400px;
  object-fit: contain;
  display: block;
  cursor: zoom-in;
}

.btn-expand-photo {
  width: 100%;
  padding: 0.65rem;
  border: none;
  border-top: 1px solid var(--pp-border);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-weight: 800;
  font-size: 0.86rem;
  cursor: pointer;
}

.photo-missing {
  height: 260px;
  border-radius: 16px;
  border: 1.5px dashed var(--pp-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pp-text-secondary);
  font-weight: 700;
}

.detail-moderation-box {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
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

.box-section-title {
  font-size: 1rem;
  font-weight: 800;
  margin: 0;
  color: var(--pp-text-primary);
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

.reviewed-status-banner {
  padding: 0.9rem 1.1rem;
  border-radius: 14px;
}

.banner-procedente {
  background: var(--pp-red-bg);
  border: 1.5px solid var(--pp-red-border);
  color: var(--pp-red-text);
}

.banner-improcedente {
  background: var(--pp-green-bg);
  border: 1.5px solid var(--pp-green-border);
  color: var(--pp-green-text);
}

.banner-indefinido {
  background: var(--pp-amber-bg);
  border: 1.5px solid var(--pp-amber-border);
  color: var(--pp-amber-text);
}

.banner-title {
  font-weight: 900;
  font-size: 0.95rem;
}

.banner-meta {
  font-size: 0.8rem;
  margin-top: 0.2rem;
}

.banner-obs {
  margin: 0.4rem 0 0;
  font-size: 0.86rem;
  font-weight: 700;
}

.admin-note-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.decision-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

.decision-actions.is-duplicity-decision-grid {
  grid-template-columns: 1fr;
  gap: 0.65rem;
}

.btn-duplicidade-common {
  grid-column: 1 / -1;
}

.btn-decision {
  padding: 1rem;
  border-radius: 16px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.btn-decision:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-decision:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-improcedente {
  background: var(--pp-green-bg);
  border: 2px solid var(--pp-green-border);
  color: var(--pp-green-text);
}

.btn-indefinido {
  background: var(--pp-amber-bg);
  border: 2px solid var(--pp-amber-border);
  color: var(--pp-amber-text);
}

.btn-procedente {
  background: var(--pp-red-bg);
  border: 2px solid var(--pp-red-border);
  color: var(--pp-red-text);
}

.decision-btn-title {
  font-size: 0.98rem;
  font-weight: 900;
}

.decision-btn-desc {
  font-size: 0.82rem;
  line-height: 1.4;
  font-weight: 600;
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

/* Metadados */
.detail-metadata-box {
  border-top: 1.5px solid var(--pp-border);
  padding-top: 1.25rem;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.85rem;
  margin-top: 0.75rem;
}

.meta-item {
  background: var(--pp-surface-alt);
  border: 1px solid var(--pp-border);
  border-radius: 12px;
  padding: 0.75rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.meta-item-full {
  grid-column: 1 / -1;
}

.meta-label {
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--pp-text-secondary);
}

.meta-value {
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--pp-text-primary);
}

.meta-coords-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.btn-open-multei-map {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  border: none;
  border-radius: 9999px;
  padding: 0.45rem 0.95rem;
  font-size: 0.86rem;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-open-multei-map:hover {
  background: var(--pp-accent-hover);
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

/* Área do Parceiro */
.partner-placeholder-card {
  background: var(--pp-surface);
  border: 2px solid var(--pp-border);
  border-radius: 24px;
  padding: 3rem 2rem;
  text-align: center;
  max-width: 680px;
  margin: 2rem auto;
}

.partner-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.75rem;
}

.partner-card-title {
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--pp-text-primary);
  margin: 0 0 0.5rem;
}

.partner-card-text {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--pp-text-secondary);
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

/* Gestão de Usuários */
.users-header-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.btn-new-user {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 1.15rem;
  border-radius: 9999px;
  border: none;
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  font-size: 0.9rem;
  font-weight: 900;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-new-user:hover {
  background: var(--pp-accent-hover);
}

.users-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.95rem 1.1rem;
  border-bottom: 1.5px solid var(--pp-border);
  background: var(--pp-surface-alt);
}

.users-list-title {
  font-size: 0.92rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.user-item-card {
  width: 100%;
  text-align: left;
  background: var(--pp-surface);
  border: 2px solid var(--pp-border);
  border-radius: 14px;
  padding: 0.9rem 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.user-item-card:hover {
  border-color: var(--pp-border-strong);
}

.user-item-card.is-selected {
  background: var(--pp-selected-bg);
  border-color: var(--pp-selected-border);
}

.user-item-card.is-inactive {
  opacity: 0.78;
}

.pill-role-admin {
  background: var(--pp-selected-bg);
  color: var(--pp-accent);
  border: 1.5px solid var(--pp-selected-border);
}

.pill-role-parceria {
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1.5px solid var(--pp-amber-border);
}

.user-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 900;
}

.status-pill-active {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1px solid var(--pp-green-border);
}

.status-pill-inactive {
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  border: 1px solid var(--pp-red-border);
}

.user-card-name {
  margin-bottom: 0.15rem;
}

.user-card-email {
  font-size: 0.82rem;
  color: var(--pp-text-secondary);
  word-break: break-all;
  margin-bottom: 0.25rem;
}

.user-card-city {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--pp-text-primary);
  margin-bottom: 0.65rem;
}

.user-card-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding-top: 0.55rem;
  border-top: 1px dashed var(--pp-border);
}

.btn-user-quick {
  padding: 0.3rem 0.65rem;
  border-radius: 8px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-user-quick:hover:not(:disabled) {
  background: var(--pp-border);
}

.btn-user-quick-danger {
  border-color: var(--pp-red-border);
  color: var(--pp-red-text);
  background: var(--pp-red-bg);
}

.user-form-card {
  padding: 1.5rem;
}

.user-form-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding-bottom: 1.15rem;
  margin-bottom: 1.25rem;
  border-bottom: 1.5px solid var(--pp-border);
}

.user-form-title {
  margin: 0.2rem 0 0;
  font-size: 1.35rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.btn-cancel-edit {
  padding: 0.45rem 0.9rem;
  border-radius: 9999px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.user-crud-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.user-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.btn-password-reset-mail {
  width: 100%;
  padding: 0.72rem 1rem;
  border-radius: 12px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  text-align: center;
}

.btn-password-reset-mail:hover:not(:disabled) {
  border-color: var(--pp-accent);
}

.security-hint-box {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: var(--pp-surface-alt);
  border: 1.5px solid var(--pp-border);
  font-size: 0.86rem;
  line-height: 1.45;
  color: var(--pp-text-secondary);
}

.user-success-alert {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: var(--pp-green-bg);
  border: 2px solid var(--pp-green-border);
  color: var(--pp-green-text);
  font-size: 0.9rem;
  font-weight: 800;
}

.delete-confirm-banner {
  padding: 1rem 1.15rem;
  border-radius: 14px;
  background: var(--pp-red-bg);
  border: 2px solid var(--pp-red-border);
  color: var(--pp-red-text);
}

.delete-confirm-text {
  margin: 0 0 0.75rem;
  font-size: 0.92rem;
  line-height: 1.45;
}

.delete-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.btn-confirm-delete {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1.5px solid var(--pp-red-border);
  background: #dc2626;
  color: #ffffff;
  font-size: 0.86rem;
  font-weight: 900;
  cursor: pointer;
}

.btn-cancel-delete {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
}

.user-form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.35rem;
}

.btn-save-user {
  flex: 1;
  min-width: 220px;
}

.btn-toggle-active-main {
  padding: 0.82rem 1.15rem;
  border-radius: 14px;
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-delete-user-main {
  padding: 0.82rem 1.15rem;
  border-radius: 14px;
  border: 2px solid var(--pp-red-border);
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

/* Aba Denúncias (Parcerias / Cidade / Ao meu redor) */
.header-action-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.btn-around-me {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 1.15rem;
  border-radius: 9999px;
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-around-me:hover:not(:disabled) {
  border-color: var(--pp-accent);
}

.btn-around-me.is-active {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border-color: var(--pp-green-border);
}

.pill-resolvido-green {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.22rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 900;
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1.5px solid var(--pp-green-border);
}

.distance-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 900;
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  border: 1.5px solid var(--pp-border-strong);
}

.distance-badge-lg {
  font-size: 0.82rem;
  padding: 0.28rem 0.75rem;
}

/* Galeria Antes e Depois no Painel */
.panel-before-after-section {
  background: var(--pp-surface-alt);
  border: 2px solid var(--pp-green-border);
  border-radius: 18px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.panel-ba-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.panel-ba-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.panel-ba-card {
  border-radius: 16px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  background: var(--pp-surface);
}

.ba-before {
  border: 2px solid var(--pp-amber-border);
}

.ba-after {
  border: 2px solid var(--pp-green-border);
}

.panel-ba-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 0.24rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.74rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ba-before .panel-ba-badge {
  background: var(--pp-amber-bg);
  color: var(--pp-amber-text);
  border: 1px solid var(--pp-amber-border);
}

.ba-after .panel-ba-badge {
  background: var(--pp-green-bg);
  color: var(--pp-green-text);
  border: 1px solid var(--pp-green-border);
}

.panel-ba-date-highlight {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  background: var(--pp-surface-alt);
  border: 1px solid var(--pp-border);
}

.ba-date-label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--pp-text-secondary);
}

.ba-date-val {
  font-size: 0.9rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.panel-ba-desc-box {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: var(--pp-surface);
  border: 1.5px solid var(--pp-green-border);
}

.panel-ba-desc-text {
  margin: 0.35rem 0 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--pp-text-primary);
  line-height: 1.5;
}

/* Formulário de Resolução Urbana (Parceiros) */
.partner-resolve-box {
  background: var(--pp-surface-alt);
  border: 2px solid var(--pp-green-border);
  border-radius: 16px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.partner-resolve-subtitle {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--pp-text-secondary);
}

.partner-upload-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.btn-partner-upload {
  padding: 0.72rem 0.9rem;
  border-radius: 12px;
  border: 2px solid var(--pp-border-strong);
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-partner-upload:hover:not(:disabled) {
  border-color: var(--pp-accent);
}

.partner-processing-status {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  background: var(--pp-surface);
  border: 1.5px solid var(--pp-border);
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--pp-text-primary);
}

.spinner-sm {
  width: 20px;
  height: 20px;
  border-width: 3px;
  margin: 0;
}

.partner-photo-preview-card {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid var(--pp-green-border);
  background: #000;
}

.partner-preview-img {
  width: 100%;
  max-height: 230px;
  object-fit: contain;
  display: block;
}

.btn-clear-partner-photo {
  width: 100%;
  padding: 0.55rem;
  border: none;
  border-top: 1px solid var(--pp-border);
  background: var(--pp-red-bg);
  color: var(--pp-red-text);
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-submit-partner-resolution {
  width: 100%;
  padding: 0.9rem 1.15rem;
  border-radius: 14px;
  border: 2px solid #047857;
  background: #16a34a;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.btn-submit-partner-resolution:hover:not(:disabled) {
  background: #15803d;
  transform: translateY(-1px);
}

.btn-submit-partner-resolution:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.partner-transito-info-box {
  background: var(--pp-surface-alt);
  border: 1.5px solid var(--pp-border);
  border-radius: 16px;
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Barra de Filtros de Ocorrências (Estado, Cidade IBGE, Bairro e Tipo) */
.occurrences-filter-bar {
  background: var(--pp-surface);
  border: 1.5px solid var(--pp-border);
  border-radius: 20px;
  padding: 1.1rem 1.25rem;
  margin-bottom: 1.25rem;
}

.occurrences-filter-grid {
  display: grid;
  gap: 0.9rem;
  align-items: end;
}

.occurrences-filter-grid.is-admin-grid {
  grid-template-columns: minmax(175px, 0.9fr) minmax(220px, 1.3fr) minmax(210px, 1.2fr) minmax(195px, 1fr);
}

.occurrences-filter-grid.is-partner-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.filter-select,
.filter-input-with-clear {
  padding-top: 0.68rem;
  padding-bottom: 0.68rem;
  font-size: 0.92rem;
  font-weight: 700;
}

.bairro-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-input-with-clear {
  padding-right: 2.3rem;
}

.btn-inline-clear {
  position: absolute;
  right: 0.55rem;
  background: transparent;
  border: none;
  color: var(--pp-text-secondary);
  font-size: 0.88rem;
  font-weight: 900;
  cursor: pointer;
  padding: 0.25rem 0.45rem;
  border-radius: 6px;
}

.btn-inline-clear:hover {
  background: var(--pp-border);
  color: var(--pp-text-primary);
}

.filter-bar-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--pp-border);
}

.filter-active-summary {
  font-size: 0.86rem;
  color: var(--pp-text-secondary);
}

.btn-clear-all-filters {
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  border: 1.5px solid var(--pp-border-strong);
  background: var(--pp-surface-alt);
  color: var(--pp-text-primary);
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-clear-all-filters:hover {
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  border-color: var(--pp-accent);
}

@media (max-width: 960px) {
  .master-detail-grid {
    grid-template-columns: 1fr;
  }

  .master-column {
    max-height: 270px;
  }

  .report-list {
    max-height: 215px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .occurrences-filter-grid.is-admin-grid,
  .occurrences-filter-grid.is-partner-grid,
  .detail-content-split,
  .user-form-grid,
  .panel-ba-grid,
  .partner-upload-buttons {
    grid-template-columns: 1fr;
  }

  .decision-actions,
  .metadata-grid {
    grid-template-columns: 1fr;
  }
}
</style>


