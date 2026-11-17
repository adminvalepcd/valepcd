<template>
  <div class="multei-page-root" :class="{ 'is-modal-open': isAnyModalOpen }">
    <div
      class="multei-fullscreen-page"
      :style="fullscreenPageStyle"
    >
      <!-- Zona Superior em fluxo normal: Botão Voltar + Filtro + Status/GPS + Busca de Endereço + Avisos do mapa -->
      <header
        class="top-header-bar"
        ref="searchContainerRef"
        :inert="isAnyModalOpen || undefined"
        :aria-hidden="isAnyModalOpen ? 'true' : undefined"
      >
        <h1 class="sr-only">Multei — mapa colaborativo de ocorrências de acessibilidade</h1>

        <div class="top-left-controls">
          <NuxtLink to="/" class="btn-back-home" aria-label="Voltar para a página inicial do Vale PCD">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" class="back-icon" aria-hidden="true" focusable="false">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span class="back-label">Voltar</span>
          </NuxtLink>

          <!-- Filtro de Tipo de Ocorrência (filtra apenas o que é exibido em tela, sem nova busca).
               O <select> nativo fica transparente sobre o chip compacto: mantém o seletor nativo
               acessível (leitores de tela/teclado) ocupando pouco espaço no celular. -->
          <div
            class="incident-type-filter-wrapper"
            :class="{ 'is-filter-active': selectedIncidentType !== 'all' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"
              stroke-linecap="round" stroke-linejoin="round" class="filter-icon" aria-hidden="true" focusable="false">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span class="filter-current-label" aria-hidden="true">{{ selectedIncidentTypeShortLabel }}</span>
            <span v-if="selectedIncidentType !== 'all'" class="filter-active-dot" aria-hidden="true"></span>
            <select
              v-model="selectedIncidentType"
              class="incident-type-select"
              aria-label="Filtrar ocorrências exibidas no mapa"
            >
              <option value="all">Todas as ocorrências</option>
              <option value="transito">Infrações de trânsito</option>
              <option value="urbana">Mobilidade urbana</option>
            </select>
          </div>

          <div class="top-bar-pills glass-panel">
            <span v-if="isLoadingSheet" class="badge-status">Buscando...</span>
            <span v-else-if="hasLoadedOnce && visibleIncidentsCount > 0" class="badge-status is-active">
              {{ visibleIncidentsCount }} na região
            </span>

            <span
              v-if="locationState === 'granted'"
              class="badge-status is-gps"
            >
              <span aria-hidden="true">📍</span> GPS ativo
            </span>
            <button
              v-else
              type="button"
              class="badge-status is-clickable-gps is-gps-off"
              :disabled="locationState === 'requesting'"
              :aria-expanded="gpsPanelMode ? 'true' : 'false'"
              aria-controls="multei-gps-panel"
              @click="handleGpsActivateClick"
            >
              <span aria-hidden="true">📍</span>
              {{ locationState === 'requesting' ? 'Localizando...' : 'Ativar GPS' }}
            </button>
          </div>
        </div>

        <!-- Barra de Busca de Endereços -->
        <div class="address-search-wrapper">
          <form class="address-search-box glass-panel" @submit.prevent="handleSearchSubmit" role="search">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round" class="search-icon" aria-hidden="true" focusable="false">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
        
            <input ref="searchInputRef" v-model="searchQuery" type="search" class="address-search-input"
              placeholder="Buscar endereço, rua, bairro ou cidade..." aria-label="Buscar endereço no mapa" autocomplete="off"
              role="combobox" aria-autocomplete="list" aria-controls="multei-address-suggestions"
              :aria-expanded="showSuggestions && (searchResults.length > 0 || searchNoResults) ? 'true' : 'false'"
              :aria-activedescendant="showSuggestions && highlightedIndex >= 0 ? `multei-address-option-${highlightedIndex}` : undefined"
              @input="handleSearchInput" @focus="handleSearchFocus" @keydown.down.prevent="moveHighlight(1)"
              @keydown.up.prevent="moveHighlight(-1)" @keydown.esc="closeSuggestions" />
        
            <span v-if="isSearchingAddress" class="search-spinner" role="status" aria-label="Buscando endereço"></span>
        
            <button v-if="searchQuery" type="button" class="btn-clear-search" @click="clearSearch"
              aria-label="Limpar busca">
              <span aria-hidden="true">✕</span>
            </button>
        
            <button type="submit" class="btn-submit-search" :disabled="isSearchingAddress || searchQuery.trim().length < 2">
              Buscar
            </button>
          </form>
        
          <!-- Lista de Sugestões de Endereço -->
          <Transition name="fade-slide">
            <ul v-if="showSuggestions && (searchResults.length > 0 || searchNoResults)" id="multei-address-suggestions"
              class="address-suggestions-list" role="listbox" aria-label="Sugestões de endereço">
              <li v-if="searchNoResults && searchResults.length === 0" class="suggestion-empty" role="option" aria-disabled="true">
                Nenhum endereço encontrado para "{{ searchQuery }}"
              </li>
              <li v-for="(item, index) in searchResults" :id="`multei-address-option-${index}`"
                :key="`${item.latitude}_${item.longitude}_${index}`"
                class="suggestion-item" :class="{ 'is-highlighted': index === highlightedIndex }" role="option"
                :aria-selected="index === highlightedIndex ? 'true' : 'false'" @mousedown.prevent="selectSearchResult(item)"
                @mouseenter="highlightedIndex = index">
                <span class="suggestion-pin" aria-hidden="true">📍</span>
                <div class="suggestion-texts">
                  <span class="suggestion-label">{{ item.label }}</span>
                  <span v-if="item.sublabel" class="suggestion-sublabel">{{ item.sublabel }}</span>
                </div>
              </li>
            </ul>
          </Transition>
        </div>

        <!-- Avisos do mapa (em fluxo, logo abaixo da busca): permissão de GPS, atualizar região e estado vazio -->
        <div class="map-status-stack">
          <Transition name="fade-slide">
            <section
              v-if="gpsPanelMode && !isWaitingForInitialAd"
              id="multei-gps-panel"
              class="gps-panel-card"
              :aria-labelledby="gpsPanelMode === 'prompt' ? 'multei-gps-prompt-title' : undefined"
              :aria-label="gpsPanelMode === 'denied' ? 'Localização bloqueada' : undefined"
            >
              <button type="button" class="gps-panel-close" aria-label="Fechar aviso de localização" @click="dismissGpsPanel">
                <span aria-hidden="true">✕</span>
              </button>

              <template v-if="gpsPanelMode === 'prompt'">
                <h2 id="multei-gps-prompt-title" class="gps-panel-title">Veja as ocorrências perto de você</h2>
                <p class="gps-panel-desc">
                  Use sua localização para abrir o mapa na sua região. Ela é usada só neste aparelho para posicionar o mapa
                  e não é armazenada.
                </p>
                <p v-if="gpsErrorMessage" class="gps-panel-error" role="alert">{{ gpsErrorMessage }}</p>
                <div class="gps-panel-actions">
                  <button
                    type="button"
                    class="gps-panel-btn-primary"
                    :disabled="locationState === 'requesting'"
                    @click="requestLocation"
                  >
                    <span aria-hidden="true">📍</span>
                    {{ locationState === 'requesting' ? 'Obtendo localização...' : 'Usar minha localização' }}
                  </button>
                  <button type="button" class="gps-panel-btn-secondary" @click="focusAddressSearch">
                    Buscar um endereço
                  </button>
                </div>
              </template>

              <template v-else>
                <MulteiGpsDeniedHelp
                  :is-retrying="isRetryingGps"
                  dismissible
                  dismiss-label="Buscar um endereço"
                  @retry="retryGpsAfterDenied"
                  @dismiss="focusAddressSearch"
                />
                <p v-if="gpsErrorMessage" class="gps-panel-error" role="alert">{{ gpsErrorMessage }}</p>
              </template>
            </section>
          </Transition>

          <!-- Botão de atualização da região (também dispara sozinho após 3s com o mapa parado) -->
          <Transition name="fade-slide">
            <button
              v-if="showRefreshButton"
              type="button"
              class="btn-floating-refresh"
              @click="handleRegionButtonClick"
            >
              <span aria-hidden="true">🔄</span>
              <span>Atualizar região</span>
            </button>
          </Transition>

          <!-- Pill de estado do mapa (região sem ocorrências / zoom muito aberto) -->
          <Transition name="fade-slide">
            <p v-if="mapStatusPillText" class="map-status-pill" aria-hidden="true">
              {{ mapStatusPillText }}
            </p>
          </Transition>

          <!-- Região viva persistente para anunciar mudanças de estado do mapa a leitores de tela -->
          <p class="sr-only" role="status" aria-live="polite">{{ mapStatusPillText }}</p>
        </div>
      </header>

      <!-- Zona Central em fluxo normal: ocupa a tela durante o pré-render / "Carregando mapa..." para forçar a publicidade na área inferior -->
      <section
        v-if="isWaitingForInitialAd"
        class="multei-center-loading-zone"
        aria-live="polite"
      >
        <div class="multei-loading-card">
          <MulteiLoadingSpinner />
          <p class="multei-loading-title">Carregando mapa...</p>
          <p class="multei-loading-subtitle">
            Mapeamento colaborativo de acessibilidade e vagas PcD em tempo real
          </p>
        </div>
      </section>
      <div v-else class="multei-center-spacer" aria-hidden="true"></div>

      <!-- Zona Inferior em fluxo normal: Botões Flutuantes (Registrar + Dúvidas?) -->
      <footer
        class="bottom-action-zone"
        :class="{ 'has-consent-bar': isConsentVisible && !isWaitingForInitialAd && !isAnyModalOpen }"
        :style="bottomActionContainerStyle"
        :inert="isAnyModalOpen || undefined"
        :aria-hidden="isAnyModalOpen ? 'true' : undefined"
      >
        <div class="bottom-action-container">
          <div class="report-btn-wrap">
            <Transition name="fade-slide">
              <span
                v-if="!isCurrentLocationInBrazil"
                id="multei-report-outside-br-tip"
                class="report-outside-tooltip"
                role="tooltip"
              >
                Disponível somente no Brasil
              </span>
            </Transition>
            <button
              type="button"
              class="btn btn-primary btn-floating-report"
              :class="{ 'is-unavailable': !isCurrentLocationInBrazil }"
              :aria-disabled="!isCurrentLocationInBrazil ? 'true' : undefined"
              :aria-describedby="!isCurrentLocationInBrazil ? 'multei-report-outside-br-tip' : undefined"
              aria-label="Registrar nova ocorrência"
              @click="handleOpenCreateModal"
            >
              <span class="btn-report-icon" aria-hidden="true">+</span>
              <span>Registrar</span>
            </button>
          </div>

          <div class="help-menu-wrapper" ref="helpMenuRef" @keydown.esc="closeHelpMenu(true)">
            <Transition name="help-menu-pop">
              <nav v-if="isHelpMenuOpen" id="multei-help-menu" class="help-upward-menu" aria-label="Ajuda do Multei">
                <ul class="help-menu-list">
                  <li>
                    <NuxtLink to="/multei/sobre" class="help-menu-item" @click="isHelpMenuOpen = false">
                      <span class="help-menu-icon" aria-hidden="true">📊</span>
                      <span>Sobre o Multei</span>
                    </NuxtLink>
                  </li>
                  <li>
                    <NuxtLink to="/multei/orientacoes" class="help-menu-item" @click="isHelpMenuOpen = false">
                      <span class="help-menu-icon" aria-hidden="true">ℹ️</span>
                      <span>Orientações de uso</span>
                    </NuxtLink>
                  </li>
                  <li>
                    <button type="button" class="help-menu-item" @click="openWhatToReportModal">
                      <span class="help-menu-icon" aria-hidden="true">📋</span>
                      <span>O que posso registrar?</span>
                    </button>
                  </li>
                  <li>
                    <button type="button" class="help-menu-item" @click="openTermsModal">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="help-menu-svg-icon"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                      <span>Termos e Privacidade</span>
                    </button>
                  </li>
                </ul>
              </nav>
            </Transition>

            <button ref="helpToggleRef" type="button" class="btn-floating-help" :class="{ 'is-open': isHelpMenuOpen }"
              :aria-expanded="isHelpMenuOpen ? 'true' : 'false'" aria-controls="multei-help-menu" @click="toggleHelpMenu">
              <span>Dúvidas?</span>
            </button>
          </div>
        </div>
      </footer>

      <!-- Pop-up / Barra de Consentimento de Cookies do Multei -->
      <Transition name="multei-consent-slide">
        <div
          v-if="isConsentVisible && !isWaitingForInitialAd && !isAnyModalOpen"
          id="multei-cookie-consent-bar"
          class="multei-consent-bar"
          role="region"
          aria-label="Preferências de cookies e privacidade"
        >
          <p class="multei-consent-text">
            Utilizamos cookies essenciais para o mapa funcionar, e cookies do Google para exibir anúncios e métricas que mantêm o projeto gratuito.
            Saiba mais nos <button type="button" class="multei-consent-link" @click="openTermsModal">Termos de Uso e Política de Privacidade</button>.
          </p>
          <div class="multei-consent-actions">
            <button
              type="button"
              class="btn-multei-consent-essential"
              @click="acceptOnlyEssentials"
            >
              Apenas Essenciais
            </button>
            <button
              type="button"
              class="btn-multei-consent-all"
              @click="acceptAll"
            >
              Aceitar Todos
            </button>
          </div>
        </div>
      </Transition>

      <!-- Mapa em Tela Cheia (montado após o ciclo inicial de carregamento/anúncio) -->
      <main
        v-if="!isWaitingForInitialAd"
        id="multei-map"
        class="fullscreen-map-container"
        aria-label="Mapa de ocorrências"
        :inert="isAnyModalOpen || undefined"
        :aria-hidden="isAnyModalOpen ? 'true' : undefined"
      >
        <MulteiMapDisplay
          :incidents="filteredIncidents"
          :initial-center="initialCenter"
          :initial-zoom="initialCenter.zoom || 15"
          :show-user-location-dot="locationState === 'granted'"
          :bottom-padding="effectiveBottomOffset"
          height="100%"
          @marker-click="handleMarkerClick"
          @bounds-change="handleBoundsChange"
          @user-location-found="handleUserLocationFound"
          @user-location-error="handleMapLocationError"
        />
      </main>

      <!-- Modal Tela Cheia: O que posso registrar? -->
      <Transition name="fade-modal">
        <div
          v-show="isWhatToReportModalOpen"
          ref="whatToReportModalRef"
          class="what-to-report-fullscreen-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="what-to-report-title"
          :inert="!isWhatToReportModalOpen || undefined"
          :aria-hidden="!isWhatToReportModalOpen ? 'true' : undefined"
        >
          <div class="what-to-report-content">
            <div class="what-to-report-topbar">
              <span class="what-to-report-badge">Guia de ocorrências</span>
              <button type="button" class="what-to-report-close-btn" aria-label="Fechar guia de ocorrências"
                @click="isWhatToReportModalOpen = false">
                <span aria-hidden="true">✕</span> Fechar
              </button>
            </div>
      
            <header class="what-to-report-header">
              <h2 id="what-to-report-title" class="what-to-report-title">O que posso registrar?</h2>
              <p class="what-to-report-intro">
                No Multei você registra dois tipos de ocorrência: <strong>infrações de trânsito</strong> que desrespeitam o
                espaço de pessoas com deficiência e <strong>problemas de mobilidade urbana</strong> que bloqueiam rotas
                acessíveis. Veja exemplos de cada tipo:
              </p>
            </header>

            <section class="what-to-report-section" aria-labelledby="what-to-report-traffic-title">
              <h3 id="what-to-report-traffic-title" class="what-to-report-section-title is-traffic">
                <span class="what-to-report-section-icon" aria-hidden="true">♿</span>
                Infrações de trânsito
              </h3>
              <div class="what-to-report-accordion">
                <details class="report-summary-card" open>
                  <summary class="report-summary-trigger">
                    <span class="report-summary-number" aria-hidden="true">1</span>
                    <span class="report-summary-heading">Vaga exclusiva sem credencial</span>
                    <span class="report-summary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div class="report-summary-body">
                    <p><strong>O que é:</strong> veículos estacionados nas vagas reservadas sem exibir a credencial oficial no
                      painel.</p>
                    <p><strong>Por que atrapalha:</strong> tira o direito de quem realmente precisa de um espaço mais largo e
                      próximo aos acessos.</p>
                    <p class="report-legal-base"><strong>Base legal:</strong> Art. 181, inciso XX do Código de Trânsito
                      Brasileiro (CTB).</p>
                  </div>
                </details>
        
                <details class="report-summary-card">
                  <summary class="report-summary-trigger">
                    <span class="report-summary-number" aria-hidden="true">2</span>
                    <span class="report-summary-heading">Bloqueio de calçadas e faixas de pedestres</span>
                    <span class="report-summary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div class="report-summary-body">
                    <p><strong>O que é:</strong> carros ou motos parados sobre o passeio público ou em cima das faixas de
                      travessia.</p>
                    <p><strong>Por que atrapalha:</strong> interrompe a rota acessível e obriga pessoas que usam cadeira de
                      rodas, pessoas cegas ou com mobilidade reduzida a desviar pelo asfalto, correndo risco de atropelamento.
                    </p>
                    <p class="report-legal-base"><strong>Base legal:</strong> Art. 181, inciso VIII do CTB.</p>
                  </div>
                </details>
        
                <details class="report-summary-card">
                  <summary class="report-summary-trigger">
                    <span class="report-summary-number" aria-hidden="true">3</span>
                    <span class="report-summary-heading">Obstrução de rampas e esquinas</span>
                    <span class="report-summary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div class="report-summary-body">
                    <p><strong>O que é:</strong> veículos estacionados a menos de 5 metros do alinhamento da via (nas esquinas),
                      onde ficam as rampas de acessibilidade.</p>
                    <p><strong>Por que atrapalha:</strong> impede a transição segura entre a calçada e a rua.</p>
                    <p class="report-legal-base"><strong>Base legal:</strong> Art. 181, inciso I do CTB.</p>
                  </div>
                </details>
        
                <details class="report-summary-card">
                  <summary class="report-summary-trigger">
                    <span class="report-summary-number" aria-hidden="true">4</span>
                    <span class="report-summary-heading">Invasão de ilhas e refúgios</span>
                    <span class="report-summary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div class="report-summary-body">
                    <p><strong>O que é:</strong> veículos parados nas áreas de segurança no meio de avenidas e vias largas.</p>
                    <p><strong>Por que atrapalha:</strong> elimina a área de descanso e proteção essencial para quem se locomove
                      mais devagar e precisa fazer a travessia em duas etapas.</p>
                    <p class="report-legal-base"><strong>Base legal:</strong> Art. 181, inciso VIII do CTB.</p>
                  </div>
                </details>
              </div>
            </section>

            <section class="what-to-report-section" aria-labelledby="what-to-report-urban-title">
              <h3 id="what-to-report-urban-title" class="what-to-report-section-title is-urban">
                <span class="what-to-report-section-icon" aria-hidden="true">🚧</span>
                Mobilidade urbana
              </h3>
              <div class="what-to-report-accordion">
                <details class="report-summary-card">
                  <summary class="report-summary-trigger">
                    <span class="report-summary-number" aria-hidden="true">1</span>
                    <span class="report-summary-heading">Calçadas quebradas, buracos e desníveis</span>
                    <span class="report-summary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div class="report-summary-body">
                    <p><strong>O que é:</strong> piso solto ou afundado, buracos, raízes expostas e degraus no meio do passeio.</p>
                    <p><strong>Por que atrapalha:</strong> pode travar rodas de cadeiras e andadores e causar quedas de pessoas
                      cegas, idosas ou com mobilidade reduzida.</p>
                  </div>
                </details>

                <details class="report-summary-card">
                  <summary class="report-summary-trigger">
                    <span class="report-summary-number" aria-hidden="true">2</span>
                    <span class="report-summary-heading">Obstáculos na rota acessível</span>
                    <span class="report-summary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div class="report-summary-body">
                    <p><strong>O que é:</strong> postes, lixeiras, entulho, mesas, placas ou obras ocupando a faixa livre da
                      calçada sem rota alternativa segura.</p>
                    <p><strong>Por que atrapalha:</strong> estreita ou bloqueia a passagem e obriga o desvio pela rua.</p>
                  </div>
                </details>

                <details class="report-summary-card">
                  <summary class="report-summary-trigger">
                    <span class="report-summary-number" aria-hidden="true">3</span>
                    <span class="report-summary-heading">Rampas ausentes ou danificadas</span>
                    <span class="report-summary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div class="report-summary-body">
                    <p><strong>O que é:</strong> travessias sem rebaixamento de calçada ou com rampas quebradas, íngremes demais
                      ou bloqueadas.</p>
                    <p><strong>Por que atrapalha:</strong> impede que pessoas em cadeira de rodas subam ou desçam da calçada com
                      segurança.</p>
                  </div>
                </details>

                <details class="report-summary-card">
                  <summary class="report-summary-trigger">
                    <span class="report-summary-number" aria-hidden="true">4</span>
                    <span class="report-summary-heading">Piso tátil ausente ou danificado</span>
                    <span class="report-summary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div class="report-summary-body">
                    <p><strong>O que é:</strong> sinalização tátil no piso faltando, solta, coberta ou levando a obstáculos.</p>
                    <p><strong>Por que atrapalha:</strong> pessoas cegas ou com baixa visão perdem a referência de direção e de
                      alerta.</p>
                  </div>
                </details>
              </div>
              <p class="report-legal-base what-to-report-section-note">
                <strong>Referências:</strong> Lei Brasileira de Inclusão (Lei nº 13.146/2015) e normas de acessibilidade da
                ABNT (NBR 9050 e NBR 16537).
              </p>
            </section>

            <section class="what-to-report-section" aria-labelledby="what-to-report-faq-title">
              <h3 id="what-to-report-faq-title" class="what-to-report-section-title is-faq">
                <span class="what-to-report-section-icon" aria-hidden="true">💬</span>
                Dúvidas frequentes
              </h3>
              <div class="what-to-report-accordion">
                <details class="report-summary-card">
                  <summary class="report-summary-trigger">
                    <span class="report-summary-heading">Multa em supermercado e shopping tem validade?</span>
                    <span class="report-summary-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div class="report-summary-body">
                    <p><strong>Sim, tem total validade.</strong> Desde 2015, o Código de Trânsito Brasileiro (CTB) estabelece que
                      estacionamentos de uso coletivo — como supermercados, shoppings, hospitais e faculdades — são considerados
                      vias públicas para fins de fiscalização.</p>
                    <p class="report-legal-base"><strong>A infração principal:</strong> estacionar nas vagas reservadas para
                      pessoas com deficiência ou idosos sem a credencial (Art. 181, XX). A multa é gravíssima e o veículo pode ser
                      guinchado.</p>
                  </div>
                </details>
              </div>
            </section>
      
            <div class="what-to-report-footer">
              <button type="button" class="btn btn-primary what-to-report-cta" @click="isWhatToReportModalOpen = false">
                Entendi, voltar ao mapa
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Pop-up no Mapa: Termos de Uso e Política de Privacidade Completos -->
      <Transition name="fade-modal">
        <div
          v-if="isTermsModalOpen"
          class="terms-popup-backdrop"
          @click.self="closeTermsModal"
        >
          <div
            ref="termsModalRef"
            class="terms-popup-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="multei-terms-popup-title"
          >
            <div class="terms-popup-topbar">
              <span class="what-to-report-badge">Termos e Privacidade</span>
              <div class="terms-popup-topbar-actions">
                <NuxtLink to="/multei/termos" class="terms-popup-page-link">
                  Abrir página completa
                </NuxtLink>
                <button
                  type="button"
                  class="what-to-report-close-btn"
                  aria-label="Fechar janela de termos e privacidade"
                  @click="closeTermsModal"
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            <div class="terms-popup-scroll-body">
              <MulteiTermsContent
                heading-tag="h2"
                title-id="multei-terms-popup-title"
                @navigate-map="closeTermsModal"
              />
            </div>

            <div class="terms-popup-footer">
              <button type="button" class="btn btn-primary what-to-report-cta" @click="closeTermsModal">
                Fechar e voltar ao mapa
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Modal para Inclusão de Nova Ocorrência com IA Gemini -->
      <MulteiCreateIncidentModal
        v-if="isCreateModalOpen"
        :current-location="currentMapCenter || initialCenter"
        :apps-script-url="appsScriptUrl"
        :is-gps-enabled="locationState === 'granted'"
        @close="isCreateModalOpen = false"
        @incident-created="handleIncidentCreated"
        @gps-enabled="handleUserLocationFound"
      />

      <!-- Modal de Detalhes da Ocorrência Clicada -->
      <MulteiIncidentModal v-if="selectedIncident" :incident="selectedIncident" :apps-script-url="appsScriptUrl"
        @close="selectedIncident = null" @incident-reported="handleIncidentReported" />
    </div>

    <!-- Conteúdo semântico em fluxo normal abaixo da dobra (100vh) para garantir altura rolável (> 100vh)
         e análise de conteúdo pelo Google AdSense sem nunca sobrepor o mapa.
         Fica fora da árvore de acessibilidade (aria-hidden + inert): esta tela expõe somente o mapa. -->
    <div id="main-content" class="multei-seo-backdrop" aria-hidden="true" inert>
      <article class="multei-seo-article">
        <header>
          <h1 class="seo-main-heading">Multei - Denúncia anônima de uso irregular de vagas para PcD e Mobilidade Urbana</h1>
          <p>
            Plataforma pública e colaborativa do projeto Vale PCD para mapeamento de infrações em vagas exclusivas para
            pessoas com deficiência e barreiras de acessibilidade nas cidades brasileiras.
          </p>
        </header>

        <section>
          <h2>Mapeamento colaborativo de acessibilidade e fiscalização cidadã</h2>
          <p>
            O Multei é uma iniciativa da ONG Vale PCD dedicada ao mapeamento colaborativo de infrações de trânsito e
            barreiras de mobilidade urbana que prejudicam a autonomia e a segurança de pessoas com deficiência (PcD) e
            pessoas com mobilidade reduzida em todo o Brasil. Utilizando recursos de geolocalização e inteligência
            artificial para proteção automática de privacidade (anonimização de placas veiculares e rostos), a plataforma
            permite registrar ocorrências em tempo real.
          </p>
          <p>
            Entre as principais ocorrências mapeadas estão o estacionamento irregular em vagas reservadas para pessoas com
            deficiência sem credencial oficial (Art. 181, inciso XX do Código de Trânsito Brasileiro - CTB), o bloqueio de
            calçadas, passeios públicos e faixas de travessia de pedestres (Art. 181, inciso VIII do CTB), a obstrução de
            rampas de acessibilidade e esquinas (Art. 181, inciso I do CTB), além de calçadas quebradas, buracos, ausência de
            piso tátil e obstáculos que interrompem rotas acessíveis.
          </p>
          <p>
            Os dados consolidados pelo Multei formam um painel de inteligência urbana para apoiar órgãos de trânsito,
            prefeituras e políticas públicas de inclusão e desenho universal nas cidades brasileiras.
          </p>
        </section>

        <section>
          <h2>Direitos de mobilidade urbana, Lei Brasileira de Inclusão e Código de Trânsito</h2>
          <p>
            A Lei Brasileira de Inclusão da Pessoa com Deficiência (Lei nº 13.146/2015) assegura o direito ao transporte e à
            mobilidade da pessoa com deficiência ou com mobilidade reduzida, em igualdade de oportunidades com as demais
            pessoas, por meio da identificação e da eliminação de todos os obstáculos e barreiras ao seu acesso.
          </p>
          <p>
            Desde a vigência da Lei Brasileira de Inclusão, estacionamentos privados de uso coletivo — como supermercados,
            shopping centers, centros comerciais, hospitais e instituições de ensino — passaram a ser equiparados às vias
            públicas para fins de fiscalização de trânsito. O uso indevido das vagas reservadas sem a credencial oficial
            configura infração gravíssima sujeita a multa e remoção do veículo.
          </p>
          <p>
            A participação cidadã no registro de barreiras arquitetônicas, urbanísticas e de trânsito contribui diretamente
            para cidades mais seguras, calçadas caminháveis, travessias sinalizadas e respeito contínuo aos direitos humanos
            e à acessibilidade universal.
          </p>
        </section>
      </article>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
  import { useRoute } from 'vue-router';
  import {
    fetchIncidentsByVisibleArea,
    subscribeToMulteiLiveEvents,
    isFirebaseMockEnabled,
    MOCK_BH_DEFAULT_CENTER
  } from '~/services/firebaseService';
  import {
    requestUserLocation,
    searchAddresses,
    isCoordinateInBrazilBounds,
    checkIfCoordsInBrazil
  } from '~/services/geoService';
  import { decodeIncidentShareToken } from '~/services/imageProcessor';
  import { useModalAccessibility } from '~/composables/useModalAccessibility';
  import {
    syncAdSenseSuppressionForPath,
    ensureAdSenseScriptLoaded,
    getMulteiConsent,
    setMulteiConsent
  } from '~/plugins/analytics.client';

definePageMeta({
  layout: false
});

useHead({
  title: 'Multei - Denúncia anônima de uso irregular de vagas para PcD',
  htmlAttrs: {
    class: 'multei-map-lock-scroll'
  },
  bodyAttrs: {
    class: 'multei-map-lock-scroll'
  },
  meta: [
    { name: 'description', content: 'Mapeamento colaborativo de ocorrências de acessibilidade e vagas PcD, com proteção de privacidade por IA.' }
  ],
  // Preconnect apenas nesta página (é a única com mapa). Abre a conexão TLS
  // enquanto o bundle ainda está sendo avaliado, reduzindo o atraso até o
  // primeiro tile do mapa — que é justamente o elemento de LCP aqui.
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon-multei.svg' },
    { rel: 'shortcut icon', href: '/favicon-multei.svg' },
    { rel: 'preconnect', href: 'https://maps.googleapis.com', crossorigin: '' },
    { rel: 'preconnect', href: 'https://maps.gstatic.com', crossorigin: '' }
  ]
});

const config = useRuntimeConfig();
const route = useRoute();
const appsScriptUrl = ref(config.public.appsScriptUrl || '');

const isCreateModalOpen = ref(false);
const selectedIncident = ref(null);
const isLoadingSheet = ref(false);
const locationState = ref('idle'); // 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'
const filterScope = ref('nearby'); // 'nearby' ou 'all'

// Painel de localização: 'prompt' (pré-permissão com contexto) | 'denied' (instruções para liberar) | null
const gpsPanelMode = ref(null);
const gpsErrorMessage = ref('');
const isRetryingGps = ref(false);
const searchInputRef = ref(null);
const hasLoadedOnce = ref(false);

// Trava geográfica: ocorrências só podem ser incluídas no Brasil
const isUserGpsInBrazil = ref(true);
const isMapCenterInBrazil = ref(true);
let mapCenterCountryTimer = null;
let latestCenterCheckId = 0;

const isCurrentLocationInBrazil = computed(
  () => isUserGpsInBrazil.value && isMapCenterInBrazil.value
);

const verifyMapCenterInBrazil = (coords, immediate = false) => {
  if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
    return;
  }
  if (!isCoordinateInBrazilBounds(coords.latitude, coords.longitude)) {
    if (mapCenterCountryTimer) {
      clearTimeout(mapCenterCountryTimer);
      mapCenterCountryTimer = null;
    }
    isMapCenterInBrazil.value = false;
    return;
  }

  const runCheck = async () => {
    const checkId = ++latestCenterCheckId;
    const inBr = await checkIfCoordsInBrazil(coords.latitude, coords.longitude);
    if (checkId === latestCenterCheckId) {
      isMapCenterInBrazil.value = inBr;
    }
  };

  if (immediate) {
    if (mapCenterCountryTimer) {
      clearTimeout(mapCenterCountryTimer);
      mapCenterCountryTimer = null;
    }
    runCheck();
  } else {
    if (mapCenterCountryTimer) clearTimeout(mapCenterCountryTimer);
    mapCenterCountryTimer = setTimeout(runCheck, 350);
  }
};

const verifyUserGpsInBrazil = async (coords) => {
  if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
    return false;
  }
  if (!isCoordinateInBrazilBounds(coords.latitude, coords.longitude)) {
    isUserGpsInBrazil.value = false;
    isMapCenterInBrazil.value = false;
    return false;
  }
  const inBr = await checkIfCoordsInBrazil(coords.latitude, coords.longitude);
  isUserGpsInBrazil.value = inBr;
  return inBr;
};

const handleOpenCreateModal = async () => {
  // Fora do Brasil o botão fica visível (aria-disabled) com o aviso "Disponível somente no Brasil"
  if (!isCurrentLocationInBrazil.value) return;
  const center = currentMapCenter.value || initialCenter.value;
  if (center && !isCoordinateInBrazilBounds(center.latitude, center.longitude)) {
    isMapCenterInBrazil.value = false;
    return;
  }
  isCreateModalOpen.value = true;
};

  // Menu flutuante "Dúvidas?" e modais "O que denunciar?" / "Termos e Privacidade"
  const helpMenuRef = ref(null);
  const isHelpMenuOpen = ref(false);
  const isWhatToReportModalOpen = ref(false);
  const whatToReportModalRef = ref(null);
  const isTermsModalOpen = ref(false);
  const termsModalRef = ref(null);

  const isAnyModalOpen = computed(() =>
    Boolean(
      isCreateModalOpen.value ||
      selectedIncident.value ||
      isWhatToReportModalOpen.value ||
      isTermsModalOpen.value
    )
  );

  watch(
    isAnyModalOpen,
    (open) => {
      if (typeof document === 'undefined' || typeof window === 'undefined') return;
      document.documentElement.classList.toggle('multei-modal-scroll-locked', open);
      document.body?.classList.toggle('multei-modal-scroll-locked', open);
      if (open && window.scrollY > 0) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    },
    { immediate: true }
  );

  useModalAccessibility({
    modalRef: whatToReportModalRef,
    isOpen: isWhatToReportModalOpen,
    onRequestClose: () => {
      isWhatToReportModalOpen.value = false;
      return 'closed';
    }
  });

  useModalAccessibility({
    modalRef: termsModalRef,
    isOpen: isTermsModalOpen,
    onRequestClose: () => {
      isTermsModalOpen.value = false;
      return 'closed';
    }
  });

  const helpToggleRef = ref(null);

  const toggleHelpMenu = () => {
    isHelpMenuOpen.value = !isHelpMenuOpen.value;
  };

  const closeHelpMenu = (returnFocus = false) => {
    if (!isHelpMenuOpen.value) return;
    isHelpMenuOpen.value = false;
    if (returnFocus) {
      helpToggleRef.value?.focus?.();
    }
  };

  const openWhatToReportModal = () => {
    isHelpMenuOpen.value = false;
    isWhatToReportModalOpen.value = true;
  };

  const openTermsModal = () => {
    isHelpMenuOpen.value = false;
    isTermsModalOpen.value = true;
  };

  const closeTermsModal = () => {
    isTermsModalOpen.value = false;
  };

  // Consentimento de Cookies do Multei (Apenas Essenciais vs Aceitar Todos — validade de 1 mês)
  const isConsentVisible = ref(false);

  const disableNonEssentialCookies = () => {
    if (typeof window === 'undefined') return;
    if (window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied'
      });
    }
    syncAdSenseSuppressionForPath(window.location.pathname, config.public.adsenseClient);
  };

  const enableNonEssentialCookies = (triggerPageView = false) => {
    if (typeof window === 'undefined') return;

    if (window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted'
      });

      if (triggerPageView && typeof document !== 'undefined') {
        window.gtag('event', 'page_view', {
          page_title: document.title,
          page_path: route.fullPath,
          page_location: window.location.href
        });
      }
    }

    syncAdSenseSuppressionForPath(window.location.pathname, config.public.adsenseClient);
    ensureAdSenseScriptLoaded(config.public.adsenseClient);
    scheduleAdOffsetChecks();
  };

  const acceptOnlyEssentials = () => {
    setMulteiConsent('essentials');
    isConsentVisible.value = false;
    disableNonEssentialCookies();
  };

  const acceptAll = () => {
    setMulteiConsent('all');
    isConsentVisible.value = false;
    // Reserva o espaço do anúncio âncora ANTES de ele carregar, para os botões não "pularem" sob o dedo
    startAdSpaceReservation();
    enableNonEssentialCookies(true);
  };

  // Estado da Barra de Busca de Endereços
  const searchContainerRef = ref(null);
  const searchQuery = ref('');
  const searchResults = ref([]);
  const isSearchingAddress = ref(false);
  const showSuggestions = ref(false);
  const searchNoResults = ref(false);
  const highlightedIndex = ref(-1);
  let searchDebounceTimer = null;
  let boundsFetchDebounceTimer = null;

// Sem localização definida o mapa abre na visão geral do Brasil (sem consultar o Firestore).
// A busca de ocorrências só acontece quando há uma região concreta (GPS, endereço, link ou zoom manual).
const BRAZIL_OVERVIEW_CENTER = { latitude: -14.235, longitude: -51.9253, zoom: 4, isSearchResult: true };

const defaultMapCenter = isFirebaseMockEnabled()
  ? { latitude: MOCK_BH_DEFAULT_CENTER.latitude, longitude: MOCK_BH_DEFAULT_CENTER.longitude }
  : { ...BRAZIL_OVERVIEW_CENTER };

const initialCenter = ref({ ...defaultMapCenter });

const currentMapCenter = ref({ latitude: defaultMapCenter.latitude, longitude: defaultMapCenter.longitude });

// Áreas já consultadas nesta sessão (círculos equivalentes ao raio usado em fetchIncidentsByVisibleArea).
// Evita novas leituras quando o mapa é movido só um pouco para os lados.
const LOADED_AREA_TTL_MS = 15 * 60 * 1000; // mesmo TTL do cache regional do firebaseService
const MAX_LOADED_AREAS = 12;
const MAX_FETCH_CORNER_KM = 60; // acima disso o zoom está aberto demais para buscar (raio máx. do serviço = 80 km)
const AUTO_REFRESH_IDLE_MS = 3000;
const loadedAreas = ref([]);
const locallyAddedIncidentIds = new Set();
let autoRefreshTimer = null;

const incidents = ref([]);
const mapBounds = ref(null);
const lastQueriedBounds = ref(null);

  const runAddressSearch = async (queryText) => {
    const clean = (queryText || '').trim();
    if (clean.length < 2) {
      searchResults.value = [];
      searchNoResults.value = false;
      isSearchingAddress.value = false;
      return [];
    }

    isSearchingAddress.value = true;
    searchNoResults.value = false;
    try {
      const results = await searchAddresses(clean);
      searchResults.value = results;
      searchNoResults.value = results.length === 0;
      highlightedIndex.value = results.length > 0 ? 0 : -1;
      showSuggestions.value = true;
      return results;
    } catch (err) {
      console.warn('[multei] Erro ao buscar endereço:', err);
      searchResults.value = [];
      searchNoResults.value = true;
      return [];
    } finally {
      isSearchingAddress.value = false;
    }
  };

  const handleSearchInput = () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    const clean = searchQuery.value.trim();
    if (clean.length < 2) {
      searchResults.value = [];
      searchNoResults.value = false;
      showSuggestions.value = false;
      isSearchingAddress.value = false;
      return;
    }
    searchDebounceTimer = setTimeout(() => {
      runAddressSearch(clean);
    }, 320);
  };

  const handleSearchFocus = () => {
    if (searchResults.value.length > 0 || searchNoResults.value) {
      showSuggestions.value = true;
    }
  };

  const closeSuggestions = () => {
    showSuggestions.value = false;
    highlightedIndex.value = -1;
  };

  const clearSearch = () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchQuery.value = '';
    searchResults.value = [];
    searchNoResults.value = false;
    showSuggestions.value = false;
    highlightedIndex.value = -1;
  };

  const moveHighlight = (delta) => {
    if (!showSuggestions.value || searchResults.value.length === 0) return;
    const total = searchResults.value.length;
    highlightedIndex.value = (highlightedIndex.value + delta + total) % total;
  };

  const selectSearchResult = (item) => {
    if (!item) return;
    searchQuery.value = item.formattedAddress || item.label;
    showSuggestions.value = false;
    searchNoResults.value = false;

    const targetCoords = {
      latitude: item.latitude,
      longitude: item.longitude,
      zoom: 16,
      isSearchResult: true
    };
    initialCenter.value = targetCoords;
    currentMapCenter.value = {
      latitude: item.latitude,
      longitude: item.longitude
    };
    gpsPanelMode.value = null;
    verifyMapCenterInBrazil(
      {
        latitude: item.latitude,
        longitude: item.longitude
      },
      true
    );
    loadIncidentsIfNotCovered({
      latitude: item.latitude,
      longitude: item.longitude
    });
  };

  const handleSearchSubmit = async () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (showSuggestions.value && highlightedIndex.value >= 0 && searchResults.value[highlightedIndex.value]) {
      selectSearchResult(searchResults.value[highlightedIndex.value]);
      return;
    }
    const results = await runAddressSearch(searchQuery.value);
    if (results.length > 0) {
      selectSearchResult(results[0]);
    }
  };

  const handleDocumentClick = (e) => {
    if (searchContainerRef.value && !searchContainerRef.value.contains(e.target)) {
      closeSuggestions();
    }
    if (helpMenuRef.value && !helpMenuRef.value.contains(e.target)) {
      isHelpMenuOpen.value = false;
    }
  };

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
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

const isValidBounds = (b) =>
  Boolean(b) &&
  [b.north, b.south, b.east, b.west].every((v) => Number.isFinite(Number(v)));

const getBoundsCenter = (b) =>
  b?.center && Number.isFinite(b.center.latitude) && Number.isFinite(b.center.longitude)
    ? b.center
    : { latitude: (b.north + b.south) / 2, longitude: (b.east + b.west) / 2 };

// Mesmo cálculo do firebaseService: raio = distância centro→canto + 5 km (mín. 5 km, máx. 80 km)
const getCoverageRadiusKm = (center, bounds) => {
  if (!center || !isValidBounds(bounds)) return 5;
  const cornerKm = getDistanceKm(center.latitude, center.longitude, bounds.north, bounds.east);
  return Math.min(Math.max(cornerKm + 5, 5), 80);
};

// Zoom suficientemente aproximado para buscar ocorrências (independe do tamanho da tela)
const isBoundsZoomedEnough = (bounds) => {
  if (!isValidBounds(bounds)) return false;
  const center = getBoundsCenter(bounds);
  return getDistanceKm(center.latitude, center.longitude, bounds.north, bounds.east) <= MAX_FETCH_CORNER_KM;
};

const getValidLoadedAreas = () => {
  const now = Date.now();
  return loadedAreas.value.filter((area) => now - area.fetchedAt < LOADED_AREA_TTL_MS);
};

// A tela está coberta se os 4 cantos estão dentro de uma mesma área já consultada (e ainda válida)
const isBoundsCovered = (bounds) => {
  if (!isValidBounds(bounds)) return false;
  const corners = [
    [bounds.north, bounds.east],
    [bounds.north, bounds.west],
    [bounds.south, bounds.east],
    [bounds.south, bounds.west]
  ];
  return getValidLoadedAreas().some((area) =>
    corners.every(([lat, lng]) => getDistanceKm(area.latitude, area.longitude, lat, lng) <= area.radiusKm)
  );
};

// Para pontos isolados (GPS/endereço) exige uma margem de 2 km dentro de uma área já consultada
const isPointCovered = (point, marginKm = 2) => {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
  return getValidLoadedAreas().some(
    (area) => getDistanceKm(area.latitude, area.longitude, point.latitude, point.longitude) + marginKm <= area.radiusKm
  );
};

const needsRegionRefresh = computed(() => {
  if (filterScope.value !== 'nearby') return false;
  if (isLoadingSheet.value) return false;
  const bounds = mapBounds.value;
  if (!isBoundsZoomedEnough(bounds)) return false;
  return !isBoundsCovered(bounds);
});

const showRefreshButton = computed(
  () => needsRegionRefresh.value && !isAnyModalOpen.value && !isWaitingForInitialAd.value
);

const clearAutoRefreshTimer = () => {
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = null;
  }
};

// Atualiza sozinho quando o mapa fica parado por 3s numa região ainda não consultada.
// O botão "Atualizar região" continua disponível para quem não quiser esperar.
const scheduleAutoRegionRefresh = () => {
  clearAutoRefreshTimer();
  if (!needsRegionRefresh.value) return;
  autoRefreshTimer = setTimeout(() => {
    autoRefreshTimer = null;
    if (!needsRegionRefresh.value || isAnyModalOpen.value) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    handleRegionButtonClick();
  }, AUTO_REFRESH_IDLE_MS);
};

const handleBoundsChange = (bounds) => {
  mapBounds.value = bounds;
  if (bounds?.center) {
    currentMapCenter.value = bounds.center;
    verifyMapCenterInBrazil(bounds.center, false);
  }
  // Movimentações dentro de uma área já consultada usam os pinos em memória (0 leituras).
  // Fora dela, o botão "Atualizar região" aparece e a busca dispara sozinha após 3s parado.
  scheduleAutoRegionRefresh();
};

// Não consulta com modal aberto; ao fechar, rearma a atualização automática se ainda for necessária
watch(isAnyModalOpen, (open) => {
  if (open) {
    clearAutoRefreshTimer();
  } else {
    scheduleAutoRegionRefresh();
  }
});

const selectedIncidentType = ref('all'); // 'all' | 'urbana' | 'transito'

const selectedIncidentTypeShortLabel = computed(() => {
  if (selectedIncidentType.value === 'transito') return 'Trânsito';
  if (selectedIncidentType.value === 'urbana') return 'Urbana';
  return 'Todas';
});

const normalizeAddressToken = (val) =>
  String(val || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const getIncidentNaturezaBucket = (inc) =>
  String(inc?.natureza || '').trim().toLowerCase() === 'urbana' ? 'urbana' : 'transito';

const getNormalizedIncidentAddressKey = (inc) => {
  const rua = normalizeAddressToken(inc?.rua);
  if (!rua) return '';
  const bairro = normalizeAddressToken(inc?.bairro);
  const cidade = normalizeAddressToken(inc?.cidade);
  const estado = normalizeAddressToken(inc?.estado);
  return `${getIncidentNaturezaBucket(inc)}__${rua}|${bairro}|${cidade}|${estado}`;
};

const groupDuplicateIncidents = (rawList) => {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  const validList = rawList.filter(Boolean);
  if (validList.length === 0) return [];

  const byId = new Map();
  for (const inc of validList) {
    if (inc?.id) {
      byId.set(String(inc.id).trim(), inc);
    }
  }

  const resolveRootKey = (inc) => {
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

    // Fallback: se estiver marcado como possível duplicidade sem duplicidade_de_id explícito,
    // procura a ocorrência de trânsito anterior dentro de 10m e 2 minutos
    if (inc?.possivel_duplicidade && String(inc?.natureza || '').toLowerCase() !== 'urbana') {
      const incTime = new Date(inc.timestamp).getTime() || 0;
      for (const other of validList) {
        if (!other || other === inc || !other.id) continue;
        if (other.possivel_duplicidade) continue;
        if (String(other.natureza || '').toLowerCase() === 'urbana') continue;
        const otherTime = new Date(other.timestamp).getTime() || 0;
        const diffMs = Math.abs(incTime - otherTime);
        if (diffMs <= 2 * 60 * 1000) {
          const distMeters = getDistanceKm(inc.latitude, inc.longitude, other.latitude, other.longitude) * 1000;
          if (distMeters <= 10) {
            return String(other.id).trim();
          }
        }
      }
    }

    return ownId || `${inc.latitude}_${inc.longitude}_${inc.timestamp}`;
  };

  // Agrupa ocorrências da mesma natureza por endereço normalizado igual (Rua + Número + Bairro + Cidade)
  // ou coordenadas no mesmo ponto (< 15m) ou vínculo direto de duplicidade
  const n = validList.length;
  const parentIdx = Array.from({ length: n }, (_, i) => i);
  const findRoot = (i) => {
    let curr = i;
    while (parentIdx[curr] !== curr) {
      parentIdx[curr] = parentIdx[parentIdx[curr]];
      curr = parentIdx[curr];
    }
    return curr;
  };
  const union = (a, b) => {
    const rootA = findRoot(a);
    const rootB = findRoot(b);
    if (rootA !== rootB) {
      parentIdx[rootB] = rootA;
    }
  };

  const rootKeys = validList.map((inc) => resolveRootKey(inc));
  const addrKeys = validList.map((inc) => getNormalizedIncidentAddressKey(inc));
  const natBuckets = validList.map((inc) => getIncidentNaturezaBucket(inc));

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

      const distMeters =
        getDistanceKm(
          Number(validList[i].latitude),
          Number(validList[i].longitude),
          Number(validList[j].latitude),
          Number(validList[j].longitude)
        ) * 1000;
      if (Number.isFinite(distMeters) && distMeters < 15) {
        union(i, j);
      }
    }
  }

  const addressBucketsMap = new Map();
  for (let i = 0; i < n; i++) {
    const r = findRoot(i);
    if (!addressBucketsMap.has(r)) {
      addressBucketsMap.set(r, []);
    }
    addressBucketsMap.get(r).push(validList[i]);
  }

  const finalGroups = [];

  for (const [, bucket] of addressBucketsMap.entries()) {
    if (bucket.length > 3) {
      // Mais de 3 denúncias (4+) no mesmo endereço/ponto e mesma natureza: agrupa em 1 pin único
      finalGroups.push(bucket);
    } else {
      // Até 3 denúncias no mesmo endereço: mantém separadas, exceto possíveis duplicidades (que já agrupam com 2+)
      const dupMap = new Map();
      for (const inc of bucket) {
        const k = resolveRootKey(inc);
        if (!dupMap.has(k)) {
          dupMap.set(k, []);
        }
        dupMap.get(k).push(inc);
      }
      for (const [, dupGroup] of dupMap.entries()) {
        finalGroups.push(dupGroup);
      }
    }
  }

  const groupedResult = [];
  const occupiedCoordsCount = new Map();

  for (const group of finalGroups) {
    if (group.length === 1) {
      const item = group[0];
      const coordKey = `${Number(item.latitude).toFixed(5)}_${Number(item.longitude).toFixed(5)}`;
      const seenCount = occupiedCoordsCount.get(coordKey) || 0;
      occupiedCoordsCount.set(coordKey, seenCount + 1);

      // Se dois pins desagrupados tiverem exatamente a mesma coordenada, aplica um leve deslocamento visual (~3.5m) para exibir os pins lado a lado
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
      // Ordena em ordem decrescente de data/hora (da ocorrência mais recente para a mais antiga)
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

const filteredIncidents = computed(() => {
  const baseList =
    selectedIncidentType.value === 'all'
      ? incidents.value
      : incidents.value.filter((inc) => {
          const isUrbana = String(inc?.natureza || '').trim().toLowerCase() === 'urbana';
          if (selectedIncidentType.value === 'urbana') return isUrbana;
          if (selectedIncidentType.value === 'transito') return !isUrbana;
          return true;
        });

  return groupDuplicateIncidents(baseList);
});


const countPinValidIncidents = (inc) => {
  const items = Array.isArray(inc?.groupItems) && inc.groupItems.length > 0 ? inc.groupItems : [inc];
  const nonDupCount = items.filter((item) => !item?.possivel_duplicidade).length;
  return Math.max(1, nonDupCount);
};

const visibleIncidentsCount = computed(() => {
  const sourceList = filteredIncidents.value;
  const visiblePins = !mapBounds.value
    ? sourceList
    : sourceList.filter((inc) => {
        const { north, south, east, west } = mapBounds.value;
        const lat = Number(inc.latitude);
        const lng = Number(inc.longitude);
        if (isNaN(lat) || isNaN(lng)) return false;
        const inLat = lat >= south && lat <= north;
        const inLng = west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;
        return inLat && inLng;
      });

  return visiblePins.reduce((acc, inc) => acc + countPinValidIncidents(inc), 0);
});

const mapStatusPillText = computed(() => {
  if (isWaitingForInitialAd.value || isAnyModalOpen.value || gpsPanelMode.value) return '';
  if (isLoadingSheet.value) return '';
  const bounds = mapBounds.value;
  if (!isValidBounds(bounds)) return '';
  if (!isBoundsZoomedEnough(bounds)) {
    return 'Aproxime o mapa para ver as ocorrências';
  }
  if (!hasLoadedOnce.value || needsRegionRefresh.value) return '';
  if (visibleIncidentsCount.value === 0) {
    return selectedIncidentType.value === 'all'
      ? 'Nenhuma ocorrência na região'
      : 'Nenhuma ocorrência deste tipo na região';
  }
  return '';
});

const handleMarkerClick = (incident) => {
  selectedIncident.value = incident;
};

const handleIncidentCreated = (newIncident) => {
  if (newIncident?.id) {
    // Mantém a ocorrência recém-criada mesmo que uma consulta seguinte venha de um cache anterior a ela
    locallyAddedIncidentIds.add(String(newIncident.id).trim());
  }
  if (newIncident?.ativo !== false) {
    incidents.value = [
      newIncident,
      ...incidents.value.filter((inc) => inc.id !== newIncident.id)
    ];
  }
  initialCenter.value = {
    latitude: newIncident.latitude,
    longitude: newIncident.longitude
  };
};

// Ao reportar, a ocorrência NÃO sai do mapa: passa a ficar "Em revisão de denúncia" (foto oculta).
// Atualiza o item em memória pelo id com os campos devolvidos pelo modal.
const handleIncidentReported = (reportedData) => {
  const updated = reportedData && typeof reportedData === 'object' ? reportedData : null;
  const targetId = updated?.id
    ? String(updated.id).trim()
    : (typeof reportedData === 'string' ? reportedData.trim() : '');
  if (!targetId) return;

  incidents.value = incidents.value.map((inc) => {
    if (!inc?.id || String(inc.id).trim() !== targetId) return inc;
    const { groupItems, groupCount, initialPageIndex, ...cleanUpdate } = updated || {};
    return { ...inc, ...cleanUpdate, id: inc.id };
  });
};

// Mescla o resultado de uma área consultada com o que já está em memória:
// - itens retornados substituem os existentes (mesmo id);
// - itens que estavam DENTRO da área consultada e não voltaram são removidos (desativados/excluídos);
// - itens fora da área (de outras regiões já carregadas) são mantidos.
const mergeIncidentsForArea = (freshList, areaCenter, radiusKm) => {
  const fresh = Array.isArray(freshList) ? freshList.filter(Boolean) : [];
  const freshIds = new Set(fresh.filter((inc) => inc?.id).map((inc) => String(inc.id).trim()));
  const kept = incidents.value.filter((inc) => {
    const id = inc?.id ? String(inc.id).trim() : '';
    if (id && freshIds.has(id)) return false;
    if (id && locallyAddedIncidentIds.has(id)) return true;
    const lat = Number(inc?.latitude);
    const lng = Number(inc?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !areaCenter) return true;
    return getDistanceKm(areaCenter.latitude, areaCenter.longitude, lat, lng) > radiusKm;
  });
  incidents.value = [...fresh, ...kept];
};

const registerLoadedArea = (center, radiusKm) => {
  if (!center || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return;
  loadedAreas.value = [
    { latitude: center.latitude, longitude: center.longitude, radiusKm, fetchedAt: Date.now() },
    ...getValidLoadedAreas()
  ].slice(0, MAX_LOADED_AREAS);
};

let latestLoadRequestId = 0;

const loadIncidents = async (scope = filterScope.value, customCenter = null, customBounds = null) => {
  const targetBounds = customBounds || mapBounds.value;
  const targetCenter = customCenter || targetBounds?.center || currentMapCenter.value;
  if (!targetCenter || !Number.isFinite(targetCenter.latitude) || !Number.isFinite(targetCenter.longitude)) {
    return;
  }

  clearAutoRefreshTimer();
  const requestId = ++latestLoadRequestId;
  isLoadingSheet.value = true;
  filterScope.value = scope;

  // Se customCenter foi passado explicitamente (ex: busca de endereço ou GPS inicial)
  // antes do mapa reposicionar os bounds, verifica se o targetCenter está dentro dos bounds atuais
  const centerInsideBounds =
    isValidBounds(targetBounds) &&
    targetCenter.latitude >= targetBounds.south &&
    targetCenter.latitude <= targetBounds.north &&
    targetCenter.longitude >= targetBounds.west &&
    targetCenter.longitude <= targetBounds.east;
  const queryBounds = centerInsideBounds ? targetBounds : null;
  const coverageRadiusKm = getCoverageRadiusKm(targetCenter, queryBounds);

  if (queryBounds) {
    lastQueriedBounds.value = {
      north: queryBounds.north,
      south: queryBounds.south,
      east: queryBounds.east,
      west: queryBounds.west
    };
  }

  try {
    const firebaseIncidents = await fetchIncidentsByVisibleArea({
      bounds: queryBounds,
      center: targetCenter,
      radiusKm: 5
    });

    if (requestId !== latestLoadRequestId) return;
    mergeIncidentsForArea(firebaseIncidents, targetCenter, coverageRadiusKm);
    registerLoadedArea(targetCenter, coverageRadiusKm);
    hasLoadedOnce.value = true;
  } catch (e) {
    if (requestId !== latestLoadRequestId) return;
    console.warn('Não foi possível sincronizar com o Firebase no momento:', e?.message || e);
  } finally {
    if (requestId === latestLoadRequestId) {
      isLoadingSheet.value = false;
    }
  }
};

// Carrega apenas se o ponto ainda não estiver dentro de uma área consultada recentemente
const loadIncidentsIfNotCovered = (center) => {
  if (isPointCovered(center)) return Promise.resolve();
  return loadIncidents('nearby', center);
};

const handleRegionButtonClick = () => {
  if (!isBoundsZoomedEnough(mapBounds.value)) return;
  loadIncidents('nearby', currentMapCenter.value, mapBounds.value);
};

const setFilterScope = (scope) => {
  if (filterScope.value === scope) return;
  loadIncidents(scope);
};

const handleUserLocationFound = (coords) => {
  initialCenter.value = coords;
  currentMapCenter.value = coords;
  locationState.value = 'granted';
  gpsPanelMode.value = null;
  gpsErrorMessage.value = '';
  verifyUserGpsInBrazil(coords);
  verifyMapCenterInBrazil(coords, true);
  loadIncidentsIfNotCovered(coords);
};

const GPS_UNAVAILABLE_MSG =
  'Não foi possível obter sua localização agora. Verifique se a localização do aparelho está ligada e tente novamente, ou busque um endereço.';

const queryGeoPermissionState = async () => {
  if (geoPermissionStatus?.state) return geoPermissionStatus.state;
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status?.state || 'unknown';
  } catch {
    return 'unknown';
  }
};

// Solicita a localização SOMENTE por ação da pessoa (ou silenciosamente quando a permissão já foi concedida).
// Em caso de falha não consulta o Firestore em uma região padrão.
const requestLocation = async () => {
  if (locationState.value === 'requesting') return;
  locationState.value = 'requesting';
  gpsErrorMessage.value = '';
  try {
    const coords = await requestUserLocation();
    initialCenter.value = coords;
    currentMapCenter.value = coords;
    locationState.value = 'granted';
    gpsPanelMode.value = null;
    verifyUserGpsInBrazil(coords);
    verifyMapCenterInBrazil(coords, true);
    await loadIncidentsIfNotCovered(coords);
  } catch (err) {
    console.warn('[multei] Permissão de geolocalização recusada ou indisponível:', err?.message || err);
    const isDenied = Number(err?.code) === 1 || (await queryGeoPermissionState()) === 'denied';
    if (isDenied) {
      locationState.value = 'denied';
      gpsPanelMode.value = 'denied';
    } else {
      locationState.value = 'unavailable';
      gpsPanelMode.value = 'prompt';
      gpsErrorMessage.value = GPS_UNAVAILABLE_MSG;
    }
  }
};

const handleGpsActivateClick = async () => {
  if (locationState.value === 'granted' || locationState.value === 'requesting') {
    return;
  }
  if (locationState.value === 'denied') {
    const state = await queryGeoPermissionState();
    if (state === 'denied') {
      // O navegador não mostra o pedido de novo: exibe/oculta as instruções para liberar
      gpsPanelMode.value = gpsPanelMode.value === 'denied' ? null : 'denied';
      return;
    }
  }
  await requestLocation();
};

const retryGpsAfterDenied = async () => {
  if (isRetryingGps.value) return;
  isRetryingGps.value = true;
  gpsErrorMessage.value = '';
  try {
    const state = await queryGeoPermissionState();
    if (state === 'denied') {
      gpsErrorMessage.value = 'A localização ainda está bloqueada no navegador. Siga os passos acima e tente novamente.';
      return;
    }
    await requestLocation();
  } finally {
    isRetryingGps.value = false;
  }
};

const handleMapLocationError = ({ code } = {}) => {
  if (Number(code) === 1) {
    locationState.value = 'denied';
    gpsPanelMode.value = 'denied';
  } else {
    gpsPanelMode.value = 'prompt';
    gpsErrorMessage.value = GPS_UNAVAILABLE_MSG;
  }
};

const dismissGpsPanel = () => {
  gpsPanelMode.value = null;
  gpsErrorMessage.value = '';
};

const focusAddressSearch = () => {
  dismissGpsPanel();
  requestAnimationFrame(() => {
    searchInputRef.value?.focus?.();
  });
};

let geoPermissionStatus = null;
const handleGeoPermissionChange = () => {
  if (!geoPermissionStatus) return;
  if (geoPermissionStatus.state === 'denied') {
    locationState.value = 'denied';
  } else if (geoPermissionStatus.state === 'prompt') {
    locationState.value = 'idle';
    if (gpsPanelMode.value === 'denied') {
      gpsPanelMode.value = 'prompt';
      gpsErrorMessage.value = '';
    }
  } else if (geoPermissionStatus.state === 'granted') {
    requestLocation();
  }
};

// Ajuste dinâmico dos botões inferiores ("Incluir" e "Dúvidas?") e altura visível considerando a barra de navegação mobile (botões de retornar) e o anúncio âncora do AdSense
const bottomAdOffset = ref(0);
const viewportHeightPx = ref(0);
const isWaitingForInitialAd = ref(true);
let adMutationObserver = null;
let adCheckInterval = null;
let initialAdWaitTimer = null;
let initialAdPollInterval = null;
const adFollowUpTimers = [];

const fullscreenPageStyle = computed(() => {
  const dynamicHeight = viewportHeightPx.value > 0 ? `${viewportHeightPx.value}px` : '100dvh';
  return {
    position: 'relative',
    width: '100%',
    '--multei-app-height': dynamicHeight,
    height: dynamicHeight,
    minHeight: dynamicHeight,
    maxHeight: dynamicHeight,
    overflow: 'hidden',
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  };
});

// Reserva antecipada do espaço do anúncio âncora (anti-clique acidental):
// com consentimento total, os botões já nascem ACIMA da área onde o anúncio vai aparecer.
// Quando o anúncio é medido, passa a valer a altura real; se ele não aparecer em até 6s,
// a reserva é liberada e os botões DESCEM (sentido seguro: o toque cai no mapa, não no anúncio).
const AD_RESERVE_MOBILE_PX = 100;
const AD_RESERVE_DESKTOP_PX = 120;
const AD_RESERVE_MAX_WAIT_MS = 6000;
const adReservePx = ref(0);
let adReserveTimer = null;

const releaseAdSpaceReservation = () => {
  if (adReserveTimer) {
    clearTimeout(adReserveTimer);
    adReserveTimer = null;
  }
  adReservePx.value = 0;
};

const startAdSpaceReservation = () => {
  if (typeof window === 'undefined') return;
  try {
    if (window.self !== window.top) return;
  } catch {
    return;
  }
  if (getMulteiConsent() !== 'all') return;
  adReservePx.value = window.innerWidth < 768 ? AD_RESERVE_MOBILE_PX : AD_RESERVE_DESKTOP_PX;
  if (adReserveTimer) clearTimeout(adReserveTimer);
  adReserveTimer = setTimeout(releaseAdSpaceReservation, AD_RESERVE_MAX_WAIT_MS);
};

const effectiveBottomOffset = computed(() => Math.max(bottomAdOffset.value, adReservePx.value));

const bottomActionContainerStyle = computed(() => {
  if (effectiveBottomOffset.value <= 0) return undefined;
  return {
    paddingBottom: `calc(${effectiveBottomOffset.value + 12}px + env(safe-area-inset-bottom, 0px))`
  };
});

const syncViewportHeight = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const innerH = window.innerHeight || document.documentElement.clientHeight || 0;
  const vvH = window.visualViewport?.height ? Math.round(window.visualViewport.height) : 0;
  const nextHeight = vvH > 0 && innerH > 0 ? Math.min(innerH, vvH) : (vvH || innerH);
  if (nextHeight > 0 && viewportHeightPx.value !== nextHeight) {
    viewportHeightPx.value = nextHeight;
  }
};

const hasAdSenseContainerInDom = () => {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector(
      'ins.adsbygoogle[data-anchor-status], ins.adsbygoogle[data-ad-status], div[id^="google_ads_iframe"], iframe[id^="aswift_"]'
    )
  );
};

const keepViewportAtTopWhenMapActive = () => {
  if (typeof window === 'undefined') return;
  if (!isWaitingForInitialAd.value && !isAnyModalOpen.value && window.scrollY > 0) {
    window.scrollTo(0, 0);
  }
};

const waitForAdSenseDuringLoadingScreen = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    isWaitingForInitialAd.value = false;
    return Promise.resolve();
  }

  // Se estiver dentro do iframe de preview do painel do Google AdSense, mantém o layout
  // de pré-render ("Carregando mapa...") visível em fluxo normal para inspeção de áreas.
  try {
    if (window.self !== window.top) {
      return Promise.resolve();
    }
  } catch {
    return Promise.resolve();
  }

  // Se a pessoa ainda não aceitou todos os cookies (ou escolheu apenas essenciais),
  // o AdSense não será carregado inicialmente — libera o mapa imediatamente.
  const hasFullConsent = getMulteiConsent() === 'all';
  if (!hasFullConsent) {
    isWaitingForInitialAd.value = false;
    return Promise.resolve();
  }

  // Se o anúncio âncora já existe no DOM (ex: veio da Home), libera o mapa imediatamente
  if (hasAdSenseContainerInDom()) {
    isWaitingForInitialAd.value = false;
    scheduleAdOffsetChecks();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let finished = false;
    const finishWait = () => {
      if (finished) return;
      finished = true;
      if (initialAdWaitTimer) {
        clearTimeout(initialAdWaitTimer);
        initialAdWaitTimer = null;
      }
      if (initialAdPollInterval) {
        clearInterval(initialAdPollInterval);
        initialAdPollInterval = null;
      }
      isWaitingForInitialAd.value = false;
      scheduleAdOffsetChecks();
      resolve();
    };

    initialAdPollInterval = setInterval(() => {
      if (hasAdSenseContainerInDom()) {
        finishWait();
      }
    }, 80);

    // Timeout máximo de segurança (1.2s) para nunca travar o carregamento do mapa
    // caso o usuário utilize bloqueador de anúncios ou o AdSense não preencha
    initialAdWaitTimer = setTimeout(finishWait, 1200);
  });
};

const calculateBottomAdOffset = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;

  syncViewportHeight();

  const viewportHeight =
    viewportHeightPx.value ||
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight ||
    0;
  if (!viewportHeight) return 0;

  let maxOffset = 0;

  const candidates = document.querySelectorAll(
    'ins.adsbygoogle, [data-anchor-status], [data-ad-status], div[id^="google_ads_iframe"], iframe[id^="aswift_"]'
  );

  candidates.forEach((node) => {
    const el = node.closest('ins.adsbygoogle, [data-anchor-status]') || node;
    if (!(el instanceof HTMLElement)) return;
    if (el.closest('[data-manual-ad-banner], .modal-backdrop, [role="dialog"]')) {
      return;
    }

    const anchorStatus = el.getAttribute('data-anchor-status');
    const adStatus = el.getAttribute('data-ad-status');
    if (anchorStatus === 'dismissed' || adStatus === 'unfilled') {
      return;
    }

    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity || '1') === 0
    ) {
      return;
    }

    let isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
    let fixedContainer = el;
    if (!isFixedOrSticky) {
      let parent = el.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'fixed' || parentStyle.position === 'sticky') {
          isFixedOrSticky = true;
          fixedContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }

    if (!isFixedOrSticky) return;

    if (
      fixedContainer.getAttribute('data-anchor-status') === 'dismissed' ||
      fixedContainer.getAttribute('data-ad-status') === 'unfilled'
    ) {
      return;
    }

    const rect = fixedContainer.getBoundingClientRect();

    // Ignora elementos sem dimensão de banner ou anúncios fixos no topo da tela
    if (rect.height < 40 || rect.width < 100) return;
    if (rect.top < viewportHeight * 0.35) return;

    // Mede apenas a altura do corpo do banner efetivamente visível dentro da viewport.
    // Quando o anúncio está fechado/minimizado (apenas a setinha ^ na base), o corpo desliza
    // para baixo da tela (visibleBannerHeight <= ~15px) e o offset retorna 0 (ponto zero = base da tela).
    const visibleBannerHeight = Math.min(viewportHeight, rect.bottom) - rect.top;

    if (visibleBannerHeight > 45 && rect.bottom >= viewportHeight - 30) {
      let highestTop = rect.top;

      const inspectChildRect = (child) => {
        if (!(child instanceof HTMLElement)) return;
        const cStyle = window.getComputedStyle(child);
        if (
          cStyle.display === 'none' ||
          cStyle.visibility === 'hidden' ||
          parseFloat(cStyle.opacity || '1') === 0
        ) {
          return;
        }
        const cRect = child.getBoundingClientRect();
        if (cRect.height > 8 && cRect.width > 8 && cRect.top < highestTop && cRect.top >= rect.top - 48) {
          highestTop = cRect.top;
        }
        if (child.shadowRoot) {
          child.shadowRoot.querySelectorAll('*').forEach(inspectChildRect);
        }
      };

      fixedContainer.querySelectorAll('*').forEach(inspectChildRect);

      // Se a aba de minimizar (seta superior esquerda do AdSense) estiver em iframe/shadow fechado,
      // reserva 28px adicionais acima do container do anúncio para não sobrepor a seta.
      const grippyClearance = highestTop < rect.top ? 0 : 28;
      const occupiedFromBottom = Math.round(viewportHeight - highestTop + grippyClearance);

      if (occupiedFromBottom > maxOffset) {
        maxOffset = occupiedFromBottom;
      }
    }
  });

  return maxOffset;
};

const updateBottomAdOffset = () => {
  const nextOffset = calculateBottomAdOffset();
  if (bottomAdOffset.value !== nextOffset) {
    bottomAdOffset.value = nextOffset;
  }
  // Anúncio real medido: a reserva antecipada deixa de ser necessária
  if (nextOffset > 0 && adReservePx.value > 0) {
    releaseAdSpaceReservation();
  }
};

const scheduleAdOffsetChecks = () => {
  updateBottomAdOffset();
  while (adFollowUpTimers.length) {
    clearTimeout(adFollowUpTimers.pop());
  }
  [60, 180, 350, 600].forEach((delay) => {
    adFollowUpTimers.push(setTimeout(updateBottomAdOffset, delay));
  });
};

const setupBottomAdObserver = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  syncViewportHeight();
  scheduleAdOffsetChecks();
  window.addEventListener('resize', scheduleAdOffsetChecks, { passive: true });
  window.addEventListener('orientationchange', scheduleAdOffsetChecks, { passive: true });
  window.addEventListener('scroll', keepViewportAtTopWhenMapActive, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleAdOffsetChecks, { passive: true });
    window.visualViewport.addEventListener('scroll', scheduleAdOffsetChecks, { passive: true });
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    adMutationObserver = new MutationObserver(() => {
      scheduleAdOffsetChecks();
    });
    adMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-anchor-status', 'data-ad-status', 'data-anchor-shown']
    });
  }

  adCheckInterval = setInterval(updateBottomAdOffset, 400);
};

const cleanupBottomAdObserver = () => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', scheduleAdOffsetChecks);
    window.removeEventListener('orientationchange', scheduleAdOffsetChecks);
    window.removeEventListener('scroll', keepViewportAtTopWhenMapActive);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', scheduleAdOffsetChecks);
      window.visualViewport.removeEventListener('scroll', scheduleAdOffsetChecks);
    }
  }
  if (adMutationObserver) {
    adMutationObserver.disconnect();
    adMutationObserver = null;
  }
  if (adCheckInterval) {
    clearInterval(adCheckInterval);
    adCheckInterval = null;
  }
  if (initialAdWaitTimer) {
    clearTimeout(initialAdWaitTimer);
    initialAdWaitTimer = null;
  }
  if (initialAdPollInterval) {
    clearInterval(initialAdPollInterval);
    initialAdPollInterval = null;
  }
  while (adFollowUpTimers.length) {
    clearTimeout(adFollowUpTimers.pop());
  }
  releaseAdSpaceReservation();
};

onMounted(async () => {
  setupBottomAdObserver();

  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.removeItem('multei_consent');
    } catch {}

    const savedConsent = getMulteiConsent();
    if (!savedConsent) {
      isConsentVisible.value = true;
    } else if (savedConsent === 'all') {
      startAdSpaceReservation();
      enableNonEssentialCookies(false);
    } else if (savedConsent === 'essentials') {
      disableNonEssentialCookies();
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', handleDocumentClick);
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('multei_gps_disabled');
    } catch {}
  }

  // Mantém a tela "Carregando mapa..." ocupando a viewport inicial enquanto o AdSense
  // inicializa o anúncio âncora no canto inferior antes de montar o canvas do Google Maps
  await waitForAdSenseDuringLoadingScreen();

  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      geoPermissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      geoPermissionStatus.addEventListener('change', handleGeoPermissionChange);
    } catch {}
  }

  if (isFirebaseMockEnabled()) {
    unsubscribeMockLiveSync = subscribeToMulteiLiveEvents(() => {
      void loadIncidents(
        filterScope.value,
        currentMapCenter.value || initialCenter.value,
        mapBounds.value
      );
    });
  }

  const rawShareToken = typeof route.query?.p === 'string' ? route.query.p : '';
  const decodedShare = rawShareToken ? decodeIncidentShareToken(rawShareToken) : null;

  const qLat = decodedShare ? decodedShare.latitude : Number(route.query?.lat);
  const qLng = decodedShare ? decodedShare.longitude : Number(route.query?.lng);
  const qZoom = decodedShare ? 18 : Number(route.query?.zoom) || 18;
  if (Number.isFinite(qLat) && Number.isFinite(qLng) && (qLat !== 0 || qLng !== 0)) {
    const targetCoords = {
      latitude: qLat,
      longitude: qLng,
      zoom: qZoom,
      isSearchResult: true
    };
    initialCenter.value = targetCoords;
    currentMapCenter.value = {
      latitude: qLat,
      longitude: qLng
    };
    verifyMapCenterInBrazil(
      {
        latitude: qLat,
        longitude: qLng
      },
      true
    );
    await loadIncidents('nearby', {
      latitude: qLat,
      longitude: qLng
    });

    if (decodedShare && Array.isArray(filteredIncidents.value) && filteredIncidents.value.length > 0) {
      let bestPin = null;
      let bestPageIndex = 0;
      let bestScore = Infinity;

      for (const pin of filteredIncidents.value) {
        const items = Array.isArray(pin.groupItems) && pin.groupItems.length > 0 ? pin.groupItems : [pin];
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const itemLat = Number(item?.latitude ?? pin.latitude);
          const itemLng = Number(item?.longitude ?? pin.longitude);
          if (!Number.isFinite(itemLat) || !Number.isFinite(itemLng)) continue;

          const distMeters = getDistanceKm(qLat, qLng, itemLat, itemLng) * 1000;
          if (distMeters > 120) continue;

          let timeDiffMin = 0;
          if (decodedShare.timestampMin && item?.timestamp) {
            const itemMin = Math.floor(new Date(item.timestamp).getTime() / 60000);
            if (Number.isFinite(itemMin)) {
              timeDiffMin = Math.abs(itemMin - decodedShare.timestampMin);
            }
          }

          const score = distMeters + timeDiffMin * 0.5;
          if (score < bestScore) {
            bestScore = score;
            bestPin = pin;
            bestPageIndex = idx;
          }
        }
      }

      if (bestPin) {
        selectedIncident.value = {
          ...bestPin,
          initialPageIndex: bestPageIndex
        };
      }
    }
    return;
  }

  // Pré-permissão: o pedido nativo de localização NÃO é disparado ao abrir a página.
  // - permissão já concedida: localiza silenciosamente (sem pop-up do navegador);
  // - bloqueada: mostra instruções para liberar;
  // - ainda não decidida: mostra um card explicando o motivo, com "Usar minha localização" ou "Buscar um endereço".
  if (isFirebaseMockEnabled()) {
    await requestLocation();
    return;
  }
  const permissionState = await queryGeoPermissionState();
  if (permissionState === 'granted') {
    await requestLocation();
  } else if (permissionState === 'denied') {
    locationState.value = 'denied';
    gpsPanelMode.value = 'denied';
  } else {
    gpsPanelMode.value = 'prompt';
  }
});

  let unsubscribeMockLiveSync = null;

  onBeforeUnmount(() => {
    cleanupBottomAdObserver();
    if (unsubscribeMockLiveSync) {
      unsubscribeMockLiveSync();
      unsubscribeMockLiveSync = null;
    }
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (boundsFetchDebounceTimer) clearTimeout(boundsFetchDebounceTimer);
    clearAutoRefreshTimer();
    if (mapCenterCountryTimer) clearTimeout(mapCenterCountryTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.documentElement.classList.remove('multei-modal-scroll-locked');
      document.body?.classList.remove('multei-modal-scroll-locked');
    }
    if (geoPermissionStatus) {
      try {
        geoPermissionStatus.removeEventListener('change', handleGeoPermissionChange);
      } catch {}
      geoPermissionStatus = null;
    }
  });
</script>

<style scoped>
:global(html.multei-map-lock-scroll),
:global(body.multei-map-lock-scroll) {
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior: none;
}

:global(html.multei-map-lock-scroll::-webkit-scrollbar),
:global(body.multei-map-lock-scroll::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}

:global(html.multei-modal-scroll-locked),
:global(body.multei-modal-scroll-locked) {
  overflow: hidden !important;
  overscroll-behavior: none !important;
}

.multei-page-root {
  position: relative;
  width: 100%;
  min-height: 180vh;
  background: #0f172a;
}

.multei-page-root.is-modal-open {
  min-height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
}

.multei-seo-backdrop {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 960px;
  pointer-events: none;
  margin: 0 auto;
  padding: 3rem 1.5rem 6rem;
  color: #cbd5e1;
  background: #0f172a;
}

.multei-seo-article {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.seo-main-heading {
  font-size: 1.75rem;
  line-height: 1.3;
  margin-bottom: 0.75rem;
}

.multei-fullscreen-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  height: var(--multei-app-height, 100dvh);
  min-height: 100dvh;
  min-height: var(--multei-app-height, 100dvh);
  max-height: 100dvh;
  max-height: var(--multei-app-height, 100dvh);
  overflow: hidden;
  margin: 0;
  padding: 0;
  background: #0f172a;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.fullscreen-map-container {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.fullscreen-map-container :deep(.map-display-wrapper) {
  border-radius: 0;
  border: none;
  box-shadow: none;
  height: 100% !important;
  min-height: 100% !important;
}

.top-header-bar {
  position: relative;
  z-index: 35;
  width: 100%;
  padding: 14px 16px 8px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  pointer-events: none;
}

.multei-center-loading-zone {
  position: relative;
  z-index: 20;
  flex: 1 1 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  box-sizing: border-box;
  background: #f8fafc;
  text-align: center;
}

.multei-loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 420px;
}

.multei-loading-title {
  margin-top: 1rem;
  margin-bottom: 0.35rem;
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
}

.multei-loading-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
  line-height: 1.45;
}

.multei-center-spacer {
  flex: 1 1 auto;
  width: 100%;
  pointer-events: none;
}

.bottom-action-zone {
  position: relative;
  z-index: 30;
  width: 100%;
  padding: 8px 20px 24px;
  box-sizing: border-box;
  pointer-events: none;
  transition: padding-bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.top-left-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  pointer-events: auto;
}

.address-search-wrapper {
  position: relative;
  flex: 1;
  min-width: 260px;
  max-width: 480px;
  pointer-events: auto;
}

.address-search-box {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0.45rem;
  padding: 0.32rem 0.4rem 0.32rem 0.85rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  border: 1.5px solid rgba(134, 0, 125, 0.18);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.address-search-box:focus-within {
  border-color: var(--primary, #86007D);
  box-shadow: 0 6px 20px rgba(134, 0, 125, 0.26);
}

.search-icon {
  width: 17px;
  height: 17px;
  color: var(--primary, #86007D);
  flex-shrink: 0;
}

.address-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.88rem;
  color: #1e293b;
  font-weight: 500;
}

.address-search-input::placeholder {
  color: #64748b;
  font-weight: 400;
}

.address-search-input::-webkit-search-cancel-button {
  display: none;
}

.search-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(134, 0, 125, 0.2);
  border-top-color: var(--primary, #86007D);
  border-radius: 50%;
  animation: spinSearch 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spinSearch {
  to {
    transform: rotate(360deg);
  }
}

.btn-clear-search {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.btn-clear-search:hover {
  background: rgba(0, 0, 0, 0.12);
  color: #1e293b;
}

.btn-submit-search {
  background: var(--primary, #86007D);
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  padding: 0.36rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.btn-submit-search:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-submit-search:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.address-suggestions-list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(16px);
  border-radius: 16px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.24);
  border: 1px solid rgba(134, 0, 125, 0.15);
  max-height: 290px;
  overflow-y: auto;
  z-index: 50;
}

.suggestion-empty {
  padding: 0.75rem 0.9rem;
  font-size: 0.84rem;
  color: #64748b;
  text-align: center;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border-radius: 11px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.suggestion-item:hover,
.suggestion-item.is-highlighted {
  background: rgba(134, 0, 125, 0.09);
}

.suggestion-pin {
  font-size: 0.95rem;
  line-height: 1.3;
  flex-shrink: 0;
}

.suggestion-texts {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.suggestion-label {
  font-size: 0.86rem;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-sublabel {
  font-size: 0.8125rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-back-home {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: #ffffff;
  color: #1e293b;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0.55rem 1.05rem;
  border-radius: 9999px;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-back-home:hover {
  background: #f8fafc;
  color: var(--primary, #86007D);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
}

.back-icon {
  width: 17px;
  height: 17px;
  stroke: currentColor;
}

.incident-type-filter-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 40px;
  padding: 0.45rem 0.9rem;
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
  font-size: 0.85rem;
  border-radius: 9999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.incident-type-filter-wrapper:hover {
  border-color: var(--primary, #86007D);
  color: var(--primary, #86007D);
}

.incident-type-filter-wrapper:focus-within {
  outline: 3px solid var(--primary, #86007D);
  outline-offset: 2px;
}

.incident-type-filter-wrapper.is-filter-active {
  border-color: var(--primary, #86007D);
  color: var(--primary, #86007D);
}

.filter-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.filter-current-label {
  white-space: nowrap;
}

.filter-active-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #dc2626;
  border: 2px solid #ffffff;
}

/* <select> nativo transparente por cima do chip: abre o seletor do sistema e mantém o nome acessível */
.incident-type-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  font-size: 16px; /* evita zoom automático no iOS ao focar */
  border: none;
  appearance: none;
  -webkit-appearance: none;
}

.glass-panel {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(14px);
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.7);
  flex-wrap: wrap;
}

.badge-brand {
  background: linear-gradient(135deg, var(--primary, #86007D), #bf4848);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.scope-toggle {
  display: inline-flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 9999px;
  padding: 2px;
  gap: 2px;
}

.scope-btn {
  background: transparent;
  border: none;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  color: var(--text-muted, #475466);
  cursor: pointer;
  transition: all 0.2s ease;
}

.scope-btn:hover {
  color: var(--text, #1e293b);
}

.scope-btn.is-active {
  background: #ffffff;
  color: var(--primary, #86007D);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.scope-btn.is-refresh-alert {
  background: linear-gradient(135deg, var(--primary, #86007D), #d97706);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(134, 0, 125, 0.35);
  animation: pulseRefresh 1.8s infinite ease-in-out;
}

.scope-btn.is-refresh-alert:hover {
  color: #ffffff;
  filter: brightness(1.08);
}

@keyframes pulseRefresh {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(134, 0, 125, 0.35);
  }
  50% {
    box-shadow: 0 2px 14px rgba(217, 119, 6, 0.55);
  }
}

.badge-status {
  font-size: 0.8125rem;
  color: var(--text-muted, #475466);
  background: rgba(0, 0, 0, 0.05);
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  font-weight: 500;
}

.badge-status.is-active {
  color: #166534;
  background: #dcfce7;
}

.badge-status.is-gps {
  color: #0369a1;
  background: #e0f2fe;
}

.is-clickable-gps {
  border: 1px solid rgba(3, 105, 161, 0.25);
  cursor: pointer;
  transition: all 0.2s;
}

.is-clickable-gps:hover {
  background: #0369a1;
  color: #ffffff;
}

.badge-status.is-gps-off {
  color: #334155;
  background: #f1f5f9;
  border: 1px solid #94a3b8;
  font-weight: 700;
}

.badge-status.is-gps-off:hover {
  background: var(--primary, #86007D);
  color: #ffffff;
  border-color: var(--primary, #86007D);
}

.btn-floating-refresh {
  position: relative;
  z-index: 30;
  pointer-events: auto;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: #ffffff;
  color: var(--primary, #86007D);
  border: 1.5px solid var(--primary, #86007D);
  padding: 0.5rem 1.15rem;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.85rem;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-floating-refresh:hover {
  background: var(--primary, #86007D);
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(134, 0, 125, 0.35);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.badge-location-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.76rem;
  background: rgba(134, 0, 125, 0.1);
  color: var(--primary, #86007D);
  border: 1px solid rgba(134, 0, 125, 0.25);
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.badge-location-btn:hover {
  background: var(--primary, #86007D);
  color: #fff;
}

.bottom-action-container {
  position: relative;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  pointer-events: auto;
}

.btn-floating-report {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.5rem;
  font-weight: 700;
  font-size: 0.98rem;
  border-radius: 9999px;
  box-shadow: 0 10px 25px rgba(134, 0, 125, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-floating-report:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(134, 0, 125, 0.5);
}

.btn-report-icon {
  font-size: 1.15rem;
}

.help-menu-wrapper {
  position: relative;
  display: inline-flex;
}

.btn-floating-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.85rem 1.35rem;
  font-weight: 700;
  font-size: 0.95rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.95);
  color: #1e293b;
  text-decoration: none;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
  border: 1.5px solid rgba(134, 0, 125, 0.25);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-floating-help:hover,
.btn-floating-help.is-open {
  background: #ffffff;
  color: var(--primary, #86007D);
  border-color: var(--primary, #86007D);
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.28);
}

.help-upward-menu {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  min-width: 210px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(14px);
  border-radius: 16px;
  padding: 0.4rem;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.24);
  border: 1px solid rgba(134, 0, 125, 0.18);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  z-index: 45;
}

.help-menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: #1e293b;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.help-menu-item:hover {
  background: rgba(134, 0, 125, 0.09);
  color: var(--primary, #86007D);
}

.help-menu-icon {
  font-size: 1.05rem;
  line-height: 1;
}

.help-menu-pop-enter-active,
.help-menu-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom left;
}

.help-menu-pop-enter-from,
.help-menu-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}

/* Modal Tela Cheia: O que posso denunciar? */
.what-to-report-fullscreen-modal {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  z-index: 100;
  background: #f8fafc;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.what-to-report-content {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
}

.what-to-report-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.what-to-report-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.85rem;
  border-radius: 9999px;
  background: rgba(134, 0, 125, 0.1);
  color: var(--primary, #86007D);
  font-size: 0.8125rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.what-to-report-close-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  border: 1.5px solid rgba(15, 23, 42, 0.12);
  background: #ffffff;
  color: #1e293b;
  font-weight: 700;
  font-size: 0.86rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.what-to-report-close-btn:hover {
  border-color: var(--primary, #86007D);
  color: var(--primary, #86007D);
  background: rgba(134, 0, 125, 0.05);
}

.what-to-report-header {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 0.65rem;
}

.what-to-report-title {
  font-size: clamp(1.55rem, 4vw, 2.1rem);
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  line-height: 1.2;
}

.what-to-report-intro {
  font-size: 1rem;
  line-height: 1.6;
  color: #475569;
  margin: 0;
}

.what-to-report-accordion {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.report-summary-card {
  background: #ffffff;
  border: 1.5px solid rgba(15, 23, 42, 0.09);
  border-radius: 16px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.report-summary-card[open] {
  border-color: rgba(134, 0, 125, 0.35);
  box-shadow: 0 8px 22px rgba(134, 0, 125, 0.1);
}

.report-summary-trigger {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem 1.15rem;
  cursor: pointer;
  user-select: none;
  font-weight: 700;
  color: #0f172a;
  transition: background 0.18s ease;
}

.report-summary-trigger::-webkit-details-marker {
  display: none;
}

.report-summary-trigger:hover {
  background: rgba(134, 0, 125, 0.04);
}

.report-summary-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(134, 0, 125, 0.12);
  color: var(--primary, #86007D);
  font-size: 0.88rem;
  font-weight: 800;
  flex-shrink: 0;
}

.report-summary-card[open] .report-summary-number {
  background: var(--primary, #86007D);
  color: #ffffff;
}

.report-summary-heading {
  flex: 1;
  font-size: 1rem;
  line-height: 1.35;
}

.report-summary-chevron {
  font-size: 1.1rem;
  color: #64748b;
  transition: transform 0.2s ease;
}

.report-summary-card[open] .report-summary-chevron {
  transform: rotate(180deg);
  color: var(--primary, #86007D);
}

.report-summary-body {
  padding: 0 1.15rem 1.15rem 3.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: #334155;
  font-size: 0.94rem;
  line-height: 1.55;
}

.report-summary-body p {
  margin: 0;
}

.report-legal-base {
  display: inline-block;
  margin-top: 0.2rem !important;
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 0.85rem;
  border-left: 3px solid var(--primary, #86007D);
}

.what-to-report-footer {
  margin-top: auto;
  padding-top: 0.75rem;
  display: flex;
  justify-content: center;
}

.what-to-report-cta {
  width: 100%;
  max-width: 360px;
  padding: 0.9rem 1.5rem;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.98rem;
  text-align: center;
  justify-content: center;
  cursor: pointer;
}

.help-menu-svg-icon {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  color: currentColor;
}

/* Pop-up no Mapa: Termos de Uso e Política de Privacidade */
.terms-popup-backdrop {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  z-index: 105;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.terms-popup-card {
  width: 100%;
  max-width: 840px;
  max-height: min(88dvh, 860px);
  background: #f8fafc;
  border-radius: 22px;
  border: 1.5px solid rgba(15, 23, 42, 0.14);
  box-shadow: 0 24px 55px rgba(15, 23, 42, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terms-popup-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 1rem 1.35rem;
  background: #ffffff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  flex-shrink: 0;
}

.terms-popup-topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.terms-popup-page-link {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--primary, #86007D);
  text-decoration: underline;
  text-underline-offset: 3px;
  padding: 0.35rem 0.55rem;
}

.terms-popup-scroll-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 1.45rem;
  -webkit-overflow-scrolling: touch;
}

.terms-popup-footer {
  padding: 0.95rem 1.35rem;
  background: #ffffff;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .terms-popup-backdrop {
    padding: 0.5rem;
  }

  .terms-popup-card {
    max-height: 92dvh;
    border-radius: 18px;
  }

  .terms-popup-topbar {
    padding: 0.85rem 1rem;
  }

  .terms-popup-scroll-body {
    padding: 1.15rem 1rem;
  }

  .terms-popup-footer {
    padding: 0.85rem 1rem;
  }
}

.fade-modal-enter-active,
.fade-modal-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-modal-enter-from,
.fade-modal-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 768px) {
  .bottom-action-zone {
    padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0px));
  }
}

@media (max-width: 640px) {
  .top-header-bar {
    padding: 10px 8px 6px;
    gap: 0.4rem;
  }
  .top-left-controls {
    width: 100%;
    flex-wrap: nowrap;
    justify-content: space-between;
    gap: 0.25rem;
  }
  .address-search-wrapper {
    width: 100%;
    max-width: 100%;
    flex: 1 1 100%;
  }
  /* Topo compacto no celular: Voltar e Filtro viram botões de ícone (44px) com nome acessível */
  .btn-back-home {
    width: 44px;
    height: 44px;
    padding: 0;
    justify-content: center;
    flex-shrink: 0;
  }
  .back-label {
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
  .back-icon {
    width: 18px;
    height: 18px;
  }
  .incident-type-filter-wrapper {
    width: 44px;
    height: 44px;
    padding: 0;
    justify-content: center;
    flex-shrink: 0;
  }
  .filter-current-label {
    display: none;
  }
  .filter-icon {
    width: 18px;
    height: 18px;
  }
  .top-bar-pills.glass-panel {
    margin-left: auto;
  }
  .top-bar-pills.glass-panel {
    padding: 0.2rem 0.3rem;
    gap: 0.22rem;
    flex-wrap: nowrap;
    flex-shrink: 0;
  }
  .badge-status {
    font-size: 0.8125rem;
    padding: 0.2rem 0.42rem;
    white-space: nowrap;
  }
  .bottom-action-zone {
    padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0px));
  }
  .bottom-action-zone.has-consent-bar {
    padding-bottom: 10px;
  }
  .bottom-action-container {
    width: 100%;
    display: flex;
    justify-content: center;
    gap: 0.65rem;
  }
  .report-btn-wrap,
  .help-menu-wrapper {
    flex: 1;
    max-width: 160px;
  }
  .btn-floating-report,
  .btn-floating-help {
    width: 100%;
    justify-content: center;
    padding: 0.8rem 1rem;
  }
  .help-upward-menu {
    left: auto;
    right: 0;
  }
  .report-summary-body {
    padding: 0 1rem 1rem 1rem;
  }
}

/* Avisos do mapa em fluxo logo abaixo da busca */
.map-status-stack {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  pointer-events: none;
}

.map-status-pill {
  margin: 0;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.88);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  text-align: center;
}

.gps-panel-card {
  position: relative;
  pointer-events: auto;
  width: 100%;
  max-width: 440px;
  box-sizing: border-box;
  background: #ffffff;
  color: #0f172a;
  border-radius: 18px;
  padding: 1rem 1.1rem;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.28);
  border: 1px solid rgba(134, 0, 125, 0.18);
}

.gps-panel-card :deep(.gps-denied-help) {
  padding-right: 2.25rem;
}

.gps-panel-close {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #334155;
  font-size: 1rem;
  cursor: pointer;
}

.gps-panel-close:hover {
  background: rgba(15, 23, 42, 0.06);
}

.gps-panel-title {
  margin: 0 2.25rem 0.35rem 0;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.3;
}

.gps-panel-desc {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  line-height: 1.45;
  color: #334155;
}

.gps-panel-error {
  margin: 0.5rem 0 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 0.875rem;
  line-height: 1.4;
}

.gps-panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.gps-panel-btn-primary,
.gps-panel-btn-secondary {
  flex: 1 1 auto;
  min-height: 44px;
  padding: 0.6rem 1rem;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}

.gps-panel-btn-primary {
  background: var(--primary, #86007D);
  color: #ffffff;
  border: none;
}

.gps-panel-btn-primary:disabled {
  opacity: 0.7;
  cursor: wait;
}

.gps-panel-btn-secondary {
  background: #ffffff;
  color: var(--primary, #86007D);
  border: 1.5px solid var(--primary, #86007D);
}

.gps-panel-close:focus-visible,
.gps-panel-btn-primary:focus-visible,
.gps-panel-btn-secondary:focus-visible,
.btn-floating-refresh:focus-visible,
.btn-floating-report:focus-visible,
.btn-floating-help:focus-visible,
.help-menu-item:focus-visible,
.btn-back-home:focus-visible {
  outline: 3px solid #1d4ed8;
  outline-offset: 2px;
}

/* Botão Registrar + aviso "Disponível somente no Brasil" */
.report-btn-wrap {
  position: relative;
  display: inline-flex;
}

.report-btn-wrap .btn-floating-report {
  width: 100%;
  justify-content: center;
}

.btn-floating-report.is-unavailable {
  filter: grayscale(0.85);
  opacity: 0.7;
  cursor: not-allowed;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
}

.btn-floating-report.is-unavailable:hover {
  transform: none;
}

.report-outside-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  white-space: nowrap;
  background: #0f172a;
  color: #ffffff;
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.report-outside-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #0f172a;
}

.help-menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* Guia "O que posso registrar?" dividido por categoria */
.what-to-report-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.what-to-report-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: #0f172a;
}

.what-to-report-section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  font-size: 1.05rem;
  background: rgba(134, 0, 125, 0.1);
}

.what-to-report-section-title.is-urban .what-to-report-section-icon {
  background: rgba(217, 119, 6, 0.15);
}

.what-to-report-section-title.is-faq .what-to-report-section-icon {
  background: rgba(3, 105, 161, 0.12);
}

.what-to-report-section-note {
  margin: 0;
}

/* Barra inferior de consentimento de cookies do Multei (Essenciais vs Aceitar Todos) */
.bottom-action-zone.has-consent-bar {
  padding-bottom: 12px;
}

.multei-consent-bar {
  position: relative;
  z-index: 50;
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
  background: #111827;
  color: #ffffff;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.35);
  padding: 1rem 1.25rem calc(1rem + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  pointer-events: auto;
}

@media (min-width: 768px) {
  .multei-consent-bar {
    flex-direction: row;
    padding: 1rem 1.5rem calc(1rem + env(safe-area-inset-bottom, 0px));
    gap: 1.25rem;
  }
}

.multei-consent-text {
  margin: 0;
  font-family: 'Poppins', sans-serif;
  font-size: 0.86rem;
  line-height: 1.5;
  color: #e5e7eb;
  text-align: center;
}

@media (min-width: 768px) {
  .multei-consent-text {
    text-align: left;
  }
}

.multei-consent-link {
  display: inline;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: #60a5fa;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.18s ease;
}

.multei-consent-link:hover {
  color: #93c5fd;
}

.multei-consent-link:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
  border-radius: 3px;
}

.multei-consent-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.btn-multei-consent-essential {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  color: #d1d5db;
  padding: 0.5rem 1rem;
  font-family: 'Poppins', sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

.btn-multei-consent-essential:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.35);
}

.btn-multei-consent-all {
  background: #2563eb;
  border: 1px solid #2563eb;
  border-radius: 8px;
  color: #ffffff;
  padding: 0.5rem 1.25rem;
  font-family: 'Poppins', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.btn-multei-consent-all:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.btn-multei-consent-essential:focus-visible,
.btn-multei-consent-all:focus-visible,
.multei-consent-link:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

.multei-consent-slide-enter-active,
.multei-consent-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.multei-consent-slide-enter-from,
.multei-consent-slide-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

@media (max-width: 640px) {
  .multei-consent-bar {
    padding: 0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px));
    gap: 0.7rem;
  }
  .multei-consent-text {
    font-size: 0.8125rem;
    line-height: 1.45;
  }
  .multei-consent-actions {
    width: 100%;
    gap: 0.55rem;
  }
  .btn-multei-consent-essential,
  .btn-multei-consent-all {
    flex: 1;
    text-align: center;
    padding: 0.52rem 0.75rem;
    font-size: 0.8rem;
  }
}
</style>
