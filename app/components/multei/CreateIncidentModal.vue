<template>
  <div class="modal-backdrop">
    <div class="modal-card">
      <!-- Cabeçalho -->
      <div class="modal-header">
        <h2 class="modal-title">Incluir Ocorrência</h2>
        <button class="btn-close" @click="emit('close')" aria-label="Fechar" :disabled="isAnalyzing || isSaving">✕</button>
      </div>

      <!-- Etapa 1: Captura / Upload da Foto -->
      <div v-if="step === 'upload'" class="step-upload">
        <!-- Aviso de Cooldown se atingiu limite de uploads seguidos -->
        <div v-if="cooldownSecondsLeft > 0" class="cooldown-banner">
          <div class="cooldown-icon">⏳</div>
          <div class="cooldown-content">
            <strong class="cooldown-title">Limite de uploads atingido</strong>
            <p class="cooldown-desc">
              Você enviou 5 fotos em sequência. Aguarde <b>{{ cooldownSecondsLeft }} segundos</b> para poder enviar novamente.
            </p>
          </div>
        </div>

        <p class="step-desc">
          Tire uma foto ou envie uma imagem da infração.
        </p>

        <div class="upload-actions">
          <button 
            type="button" 
            class="btn-upload btn-camera" 
            :disabled="cooldownSecondsLeft > 0"
            :class="{ 'is-disabled': cooldownSecondsLeft > 0 }"
            @click="cooldownSecondsLeft > 0 ? null : (showCamera = true)"
          >
            <span class="btn-icon">📷</span>
            <span class="btn-label">{{ cooldownSecondsLeft > 0 ? `Aguarde ${cooldownSecondsLeft}s` : 'Tirar Foto Agora' }}</span>
          </button>

          <label class="btn-upload btn-gallery" :class="{ 'is-disabled': cooldownSecondsLeft > 0 }">
            <span class="btn-icon">🖼️</span>
            <span class="btn-label">{{ cooldownSecondsLeft > 0 ? `Aguarde ${cooldownSecondsLeft}s` : 'Escolher da Galeria' }}</span>
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/webp" 
              class="hidden-file-input" 
              :disabled="cooldownSecondsLeft > 0"
              @change="handleFileSelected" 
            />
          </label>
        </div>

        <p class="privacy-note">
          IMPORTANTE: Suas fotos são analisadas por IA. Placas e rostos serão desfocados antes de qualquer gravação. Nenhum dado
          seu é armazenado
        </p>
      </div>

      <!-- Câmera ao vivo em tela cheia se acionada -->
      <MulteiCameraCapture
        v-if="showCamera"
        @photo-taken="handlePhotoTaken"
        @cancel="showCamera = false"
      />

      <!-- Etapa 2: Análise da Imagem e Aplicação do Filtro de Privacidade -->
      <div v-if="step === 'analyzing'" class="step-analyzing">
        <div class="analyzing-preview-card">
          <!-- Preview da foto em análise -->
          <img 
            v-if="rawPreviewUrl" 
            :src="rawPreviewUrl" 
            alt="Foto em análise de privacidade" 
            class="analyzing-preview-img" 
          />
          <div v-else class="analyzing-preview-placeholder">
            <LoadingSpinner />
          </div>

          <!-- Overlay Animado: Escaneamento e Aplicação de Filtro de Privacidade -->
          <div class="privacy-scan-overlay">
            <!-- Grade cibernética de anonimização -->
            <div class="privacy-scan-grid"></div>

            <!-- Faixa laser de varredura que sobe e desce -->
            <div class="scanner-laser-beam"></div>

            <!-- Efeito de desfoque dinâmico em onda -->
            <div class="scanner-blur-wave"></div>

            <!-- Badge HUD de proteção ativa -->
            <div class="scan-hud-badge">
              <div class="hud-shield-pulse">🛡️</div>
              <div class="hud-badge-info">
                <span class="hud-badge-title">Filtro de Privacidade</span>
                <span class="hud-badge-status">Anonimizando placas e rostos...</span>
              </div>
            </div>

            <!-- Cantoneiras de mira de IA (Computer Vision HUD) -->
            <span class="hud-corner corner-tl"></span>
            <span class="hud-corner corner-tr"></span>
            <span class="hud-corner corner-bl"></span>
            <span class="hud-corner corner-br"></span>
          </div>
        </div>

        <div class="analyzing-details">
          <div class="analyzing-status-pill">
            <span class="pulse-radar-dot"></span>
            <p class="analyzing-text">{{ analyzingStatusText }}</p>
          </div>
          
          <div class="analyzing-progress-bar">
            <div class="analyzing-progress-fill"></div>
          </div>
          <span class="analyzing-sub">Avaliando veículos, segurança e dados sensíveis...</span>
        </div>
      </div>

      <!-- Erro de Validação ou Instabilidade de IA -->
      <div v-if="step === 'error'" class="step-error">
        <div class="error-badge">{{ isApiError ? '⚡' : '⚠️' }}</div>
        <h3 class="error-heading" :class="{ 'is-api-error': isApiError }">
          {{ isApiError ? 'Instabilidade no Serviço de IA' : 'Foto Não Aceita' }}
        </h3>
        <p class="error-explanation">{{ errorMessage }}</p>
        
        <div class="modal-actions mt-4">
          <button v-if="isApiError && lastSelectedFile" class="btn btn-primary" @click="handleRetry">
            🔄 Tentar Novamente
          </button>
          <button class="btn btn-secondary" @click="resetToUpload">
            {{ isApiError && lastSelectedFile ? 'Escolher Outra Foto' : 'Tentar Outra Foto' }}
          </button>
        </div>
      </div>

      <!-- Etapa 3: Preview Anonimizado e Ajuste de Localização -->
      <div v-if="step === 'preview'" class="step-preview">
        <div class="preview-container">
          <img :src="processedImageWebp" alt="Pré-visualização com desfoque de privacidade" class="preview-img" />
          <span class="badge-blur">Filtro privacidade aplicado</span>
        </div>

        <div class="location-box glass">
          <div class="location-header">
            <span class="loc-icon">📍</span>
            <div class="loc-text">
              <div class="loc-title-row">
                <strong>Localização da Infração:</strong>
                <span v-if="locationSource === 'exif'" class="source-badge is-exif" title="Coordenadas obtidas dos metadados da imagem">
                  📷 Da foto
                </span>
                <span v-else-if="locationSource === 'device'" class="source-badge is-gps" title="Coordenadas obtidas do GPS do navegador">
                  📡 GPS do dispositivo
                </span>
                <span v-else-if="locationSource === 'manual'" class="source-badge is-manual" title="Coordenadas ajustadas manualmente no mapa">
                  ✏️ Ajustado no mapa
                </span>
                <span v-else class="source-badge is-fallback" title="Posição aproximada/padrão">
                  ⚠️ Posição aproximada
                </span>
              </div>
              <p v-if="addressText" class="loc-address">
                <span v-if="isResolvingAddress" class="loc-loading">⏳ </span>
                {{ addressText }}
              </p>
            </div>
          </div>

          <!-- Ações secundárias caso o endereço já esteja válido -->
          <div v-if="isLocationValid" class="location-actions-bar">
            <button 
              type="button" 
              class="btn-loc-action btn-refresh-gps" 
              :disabled="isRefreshingGps"
              @click="handleRefreshGps"
              title="Obter coordenadas atuais do GPS deste aparelho"
            >
              <span v-if="isRefreshingGps">⏳ Obtendo GPS...</span>
              <span v-else>📍 Usar Meu GPS Atual</span>
            </button>

            <button 
              type="button" 
              class="btn-loc-action btn-adjust" 
              :class="{ 'is-active': isAdjustingLocation }"
              @click="toggleAdjustLocation"
            >
              {{ isAdjustingLocation ? '✓ Concluir Ajuste' : '🗺️ Ajustar no Mapa' }}
            </button>
          </div>

          <!-- Alerta Destacado: Endereço não identificado automaticamente (oculto durante o ajuste no mapa para evitar piscadas na UX) -->
          <div v-if="!isLocationValid && !isResolvingAddress && !isAdjustingLocation" class="loc-required-alert">
            <div class="loc-alert-header">
              <span class="loc-alert-badge">⚠️ Endereço Incompleto</span>
              <p class="loc-alert-msg">
                A <strong>Cidade</strong> e o <strong>Estado</strong> precisam ser identificados. Escolha uma das opções abaixo para
                definir o local:
              </p>
            </div>
            
            <div class="loc-prominent-actions">
              <button 
                type="button" 
                class="btn-prominent btn-prominent-gps" 
                :disabled="isRefreshingGps"
                @click="handleRefreshGps"
              >
                <span class="btn-prominent-icon">📍</span>
                <span class="btn-prominent-text">
                  <span class="btn-prominent-title">{{ isRefreshingGps ? 'Consultando GPS...' : 'Usar Meu GPS Atual' }}</span>
                  <span class="btn-prominent-sub">Obtém a posição exata do seu aparelho</span>
                </span>
              </button>

              <button 
                type="button" 
                class="btn-prominent btn-prominent-map" 
                :class="{ 'is-active': isAdjustingLocation }"
                @click="toggleAdjustLocation"
              >
                <span class="btn-prominent-icon">🗺️</span>
                <span class="btn-prominent-text">
                  <span class="btn-prominent-title">{{ isAdjustingLocation ? '✓ Concluir Escolha' : 'Escolher no Mapa' }}</span>
                  <span class="btn-prominent-sub">Arraste o pino para a rua da infração</span>
                </span>
              </button>
            </div>
          </div>

          <p v-if="gpsStatusMessage" class="gps-msg" :class="{ 'is-error': gpsStatusIsError }">
            {{ gpsStatusMessage }}
          </p>

          <!-- Mini mapa para ajuste fino se acionado -->
          <div v-if="isAdjustingLocation" class="mini-map-container">
            <div class="mini-map-header-row">
              <p class="mini-map-hint">Arraste o mapa para posicionar o pino vermelho exatamente no local da infração.</p>
            </div>
            <div class="mini-map-frame">
              <MulteiMapDisplay
                :initial-center="selectedLocation"
                :pin-location="selectedLocation"
                height="280px"
                @pin-location-change="handlePinChange"
              />
            </div>
          </div>
        </div>

        <div v-if="saveError" class="alert alert-error">
          {{ saveError }}
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="resetToUpload" :disabled="isSaving">
            Recomeçar
          </button>
          <button 
            class="btn btn-primary btn-save-incident" 
            @click="handleSaveIncident" 
            :disabled="isSaving || isResolvingAddress"
          >
            <span v-if="isSaving">Processando...</span>
            <span v-else-if="isResolvingAddress">Obtendo endereço...</span>
            <span v-else>Salvar denúncia</span>
          </button>
        </div>
      </div>

      <!-- Etapa 4: Sucesso -->
      <div v-if="step === 'success'" class="step-success">
        <div class="success-icon">✅</div>
        <h3 class="success-title">Ocorrência Registrada!</h3>
        <p class="success-desc">
          A infração foi salva e já está visível no mapa.
        </p>
        <button class="btn btn-primary mt-4" @click="emit('close')">
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
  import LoadingSpinner from './LoadingSpinner.vue';
import { initializeGeminiClient, analyzeIncidentImage } from '../../services/geminiService';
import { extractGpsData, blurSensitiveContentAndCompress, prepareImageForGemini } from '../../services/imageProcessor';
import { saveIncidentToSheet } from '../../services/sheetsService';
import { getAddressDetailsFromCoords, requestUserLocation } from '../../services/geoService';

const props = defineProps({
  currentLocation: {
    type: Object,
    required: true
  },
  appsScriptUrl: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'incidentCreated']);

const step = ref('upload');
const showCamera = ref(false);
const isAnalyzing = ref(false);
const isSaving = ref(false);
const analyzingStatusText = ref('Iniciando análise...');
const errorMessage = ref('');
const isApiError = ref(false);
const lastSelectedFile = ref(null);
const rawPreviewUrl = ref('');
const saveError = ref('');
const isAdjustingLocation = ref(false);
const addressText = ref('');
const currentCidade = ref('');
const currentEstado = ref('');
const isResolvingAddress = ref(false);
let geocodeDebounceTimer = null;
let currentAddressPromise = null;

const locationSource = ref('fallback');
const isRefreshingGps = ref(false);
const gpsStatusMessage = ref('');
const gpsStatusIsError = ref(false);

const processedImageWebp = ref('');
const selectedLocation = reactive({
  latitude: props.currentLocation.latitude,
  longitude: props.currentLocation.longitude
});

// --- Trava de Segurança 1: Cidade e Estado Obrigatórios para Salvar ---
const isLocationValid = computed(() => {
  return Boolean(
    locationSource.value !== 'fallback' &&
    currentCidade.value && 
    currentCidade.value.trim().length > 0 &&
    currentEstado.value && 
    currentEstado.value.trim().length > 0
  );
});

// --- Trava de Segurança 2: Cache de Análise Gemini (1x por dia por foto via SHA-256) ---
const GEMINI_CACHE_PREFIX = 'multei_gemini_cache_';
const GEMINI_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

const computeFileSha256 = async (file) => {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('[CreateIncidentModal] Erro ao calcular SHA-256 via WebCrypto:', err);
  }
  return `${file.name}_${file.size}_${file.lastModified}`;
};

const getCachedGeminiAnalysis = (hash) => {
  if (typeof window === 'undefined' || !hash) return null;
  try {
    const raw = localStorage.getItem(`${GEMINI_CACHE_PREFIX}${hash}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > GEMINI_CACHE_TTL_MS) {
      localStorage.removeItem(`${GEMINI_CACHE_PREFIX}${hash}`);
      return null;
    }
    return cached.data;
  } catch (e) {
    console.warn('[CreateIncidentModal] Erro ao ler cache Gemini:', e);
    return null;
  }
};

const saveGeminiAnalysisCache = (hash, data) => {
  if (typeof window === 'undefined' || !hash || !data) return;
  try {
    localStorage.setItem(`${GEMINI_CACHE_PREFIX}${hash}`, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (e) {
    console.warn('[CreateIncidentModal] Erro ao salvar cache Gemini:', e);
  }
};

// --- Trava de Segurança 3: Rate Limiting & Cooldown contra Spam (5 fotos seguidas -> 1 minuto) ---
const COOLDOWN_UNTIL_KEY = 'multei_upload_cooldown_until';
const RECENT_UPLOADS_KEY = 'multei_recent_upload_timestamps';
const MAX_UPLOADS_BEFORE_COOLDOWN = 5;
const COOLDOWN_SECONDS = 60;
const UPLOAD_WINDOW_MS = 5 * 60 * 1000; // Janela de 5 minutos

const cooldownSecondsLeft = ref(0);
let cooldownTimer = null;

const startCooldownCountdown = (seconds) => {
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownSecondsLeft.value = Math.max(0, Math.ceil(seconds));

  if (cooldownSecondsLeft.value <= 0) return;

  cooldownTimer = setInterval(() => {
    if (typeof window === 'undefined') return;
    const until = Number(localStorage.getItem(COOLDOWN_UNTIL_KEY) || 0);
    const remaining = Math.ceil((until - Date.now()) / 1000);

    if (remaining <= 0) {
      cooldownSecondsLeft.value = 0;
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      localStorage.removeItem(COOLDOWN_UNTIL_KEY);
    } else {
      cooldownSecondsLeft.value = remaining;
    }
  }, 1000);
};

const checkExistingCooldown = () => {
  if (typeof window === 'undefined') return;
  const until = Number(localStorage.getItem(COOLDOWN_UNTIL_KEY) || 0);
  const now = Date.now();
  if (until > now) {
    const remaining = Math.ceil((until - now) / 1000);
    startCooldownCountdown(remaining);
  } else if (until > 0) {
    localStorage.removeItem(COOLDOWN_UNTIL_KEY);
  }
};

const registerUploadAttempt = () => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  let timestamps = [];
  try {
    const raw = localStorage.getItem(RECENT_UPLOADS_KEY);
    if (raw) timestamps = JSON.parse(raw);
    if (!Array.isArray(timestamps)) timestamps = [];
  } catch {
    timestamps = [];
  }

  // Filtrar apenas uploads realizados dentro da janela de 5 minutos
  timestamps = timestamps.filter(t => now - t < UPLOAD_WINDOW_MS);
  timestamps.push(now);

  if (timestamps.length >= MAX_UPLOADS_BEFORE_COOLDOWN) {
    // Atingiu 5 uploads seguidos: bloqueia por 1 minuto mesmo se recarregar a página
    const until = now + (COOLDOWN_SECONDS * 1000);
    localStorage.setItem(COOLDOWN_UNTIL_KEY, String(until));
    localStorage.removeItem(RECENT_UPLOADS_KEY);
    startCooldownCountdown(COOLDOWN_SECONDS);
  } else {
    localStorage.setItem(RECENT_UPLOADS_KEY, JSON.stringify(timestamps));
  }
};

const UF_MAP = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amapa': 'AP',
  'amazonas': 'AM', 'bahia': 'BA', 'ceará': 'CE', 'ceara': 'CE',
  'distrito federal': 'DF', 'espírito santo': 'ES', 'espirito santo': 'ES',
  'goiás': 'GO', 'goias': 'GO', 'maranhão': 'MA', 'maranhao': 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  'pará': 'PA', 'para': 'PA', 'paraíba': 'PB', 'paraiba': 'PB',
  'paraná': 'PR', 'parana': 'PR', 'pernambuco': 'PE', 'piauí': 'PI',
  'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
  'rio grande do sul': 'RS', 'rondônia': 'RO', 'rondonia': 'RO',
  'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP',
  'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO'
};

const CITY_TO_UF = {
  'belo horizonte': 'MG', 'contagem': 'MG', 'betim': 'MG', 'uberlândia': 'MG', 'juiz de fora': 'MG',
  'são paulo': 'SP', 'campinas': 'SP', 'guarulhos': 'SP', 'santos': 'SP', 'são bernardo do campo': 'SP',
  'rio de janeiro': 'RJ', 'niterói': 'RJ', 'duque de caxias': 'RJ', 'são gonçalo': 'RJ',
  'brasília': 'DF', 'curitiba': 'PR', 'londrina': 'PR', 'maringá': 'PR',
  'porto alegre': 'RS', 'caxias do sul': 'RS', 'salvador': 'BA', 'feira de santana': 'BA',
  'fortaleza': 'CE', 'recife': 'PE', 'olinda': 'PE', 'goiânia': 'GO', 'manaus': 'AM',
  'belém': 'PA', 'florianópolis': 'SC', 'joinville': 'SC', 'vitória': 'ES', 'vila velha': 'ES',
  'natal': 'RN', 'joão pessoa': 'PB', 'maceió': 'AL', 'teresina': 'PI', 'aracaju': 'SE',
  'campo grande': 'MS', 'cuiabá': 'MT', 'porto velho': 'RO', 'macapá': 'AP', 'palmas': 'TO',
  'boa vista': 'RR', 'rio branco': 'AC'
};

const extractCityAndStateFromText = (text) => {
  if (!text || typeof text !== 'string') return { cidade: '', estado: '' };
  const clean = text.trim();
  if (clean.startsWith('Lat:') || clean.startsWith('Buscando')) return { cidade: '', estado: '' };

  let cidade = '';
  let estado = '';

  const allUFs = new Set(Object.values(UF_MAP));

  // 1. Procura ' - UF' ou ', UF' onde UF é uma das 27 siglas válidas do Brasil
  // Ex: 'Belo Horizonte - MG', 'São Paulo - SP', 'Floramar, Belo Horizonte - MG, 31742-190'
  const ufPattern = /[\s,-]+([A-Z]{2})(?:[\s,–-]|$)/g;
  let match;
  while ((match = ufPattern.exec(clean)) !== null) {
    const candidate = match[1].toUpperCase();
    if (allUFs.has(candidate)) {
      estado = candidate;
      const beforeUf = clean.substring(0, match.index).trim();
      const beforeParts = beforeUf.split(/[,–-]/).map(s => s.trim()).filter(Boolean);
      if (beforeParts.length > 0) {
        cidade = beforeParts[beforeParts.length - 1];
      }
      break;
    }
  }

  // 2. Se não achou estado em sigla, procura por extenso
  if (!estado) {
    const lower = clean.toLowerCase();
    for (const [name, uf] of Object.entries(UF_MAP)) {
      if (lower.includes(name)) {
        estado = uf;
        break;
      }
    }
  }

  // 3. Se ainda não tem cidade, pega o penúltimo ou último termo antes do CEP/país
  if (!cidade) {
    let s = clean.replace(/,\s*Brasil\s*$/i, '').replace(/,?\s*\d{5}-?\d{3}.*$/, '').trim();
    const parts = s.split(/[,–-]/).map(p => p.trim()).filter(Boolean);
    const nonStateParts = parts.filter(p => !allUFs.has(p.toUpperCase()) && !/^\d+$/.test(p));
    if (nonStateParts.length > 0) {
      cidade = nonStateParts[nonStateParts.length - 1];
    }
  }

  // Se a cidade capturada for na verdade o nome de um estado por extenso (ex: 'Belo Horizonte - Minas Gerais')
  if (cidade && UF_MAP[cidade.toLowerCase()]) {
    const lower = clean.toLowerCase();
    for (const city of Object.keys(CITY_TO_UF)) {
      if (lower.includes(city)) {
        cidade = city.replace(/(^\w|\s\w)/g, m => m.toUpperCase());
        break;
      }
    }
  }

  // Limpeza de cidade
  if (cidade) {
    cidade = cidade.replace(/\d{5}-?\d{3}/g, '').replace(/,\s*$/, '').trim();
  }

  if (cidade && !estado) {
    const cityLower = cidade.toLowerCase();
    if (CITY_TO_UF[cityLower]) {
      estado = CITY_TO_UF[cityLower];
    }
  }

  return { cidade, estado };
};

const config = useRuntimeConfig();
const geminiApiKey = config.public.geminiApiKey;
const geminiClient = initializeGeminiClient(geminiApiKey);

const updateAddress = async (lat, lng) => {
  isResolvingAddress.value = true;
  try {
    const details = await getAddressDetailsFromCoords(lat, lng);
    if (details.formattedAddress && (!addressText.value || addressText.value.startsWith('Lat:') || !details.formattedAddress.startsWith('Lat:'))) {
      addressText.value = details.formattedAddress;
    }
    if (details.cidade) currentCidade.value = details.cidade;
    if (details.estado) currentEstado.value = details.estado;

    // Se o serviço não tiver separado cidade/estado mas o texto os contém, puxa direto do texto
    if (!currentCidade.value || !currentEstado.value) {
      const textToParse = details.formattedAddress || addressText.value;
      if (textToParse) {
        const fromText = extractCityAndStateFromText(textToParse);
        if (fromText.cidade && !currentCidade.value) currentCidade.value = fromText.cidade;
        if (fromText.estado && !currentEstado.value) currentEstado.value = fromText.estado;
      }
    }

    return details;
  } catch {
    if (!addressText.value) {
      addressText.value = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
    }
    return null;
  } finally {
    isResolvingAddress.value = false;
  }
};

watch(addressText, (newText) => {
  if (newText && (!currentCidade.value || !currentEstado.value)) {
    const fromText = extractCityAndStateFromText(newText);
    if (fromText.cidade && !currentCidade.value) currentCidade.value = fromText.cidade;
    if (fromText.estado && !currentEstado.value) currentEstado.value = fromText.estado;
  }
});

const handleRefreshGps = async () => {
  isRefreshingGps.value = true;
  gpsStatusMessage.value = 'Consultando o GPS do dispositivo...';
  gpsStatusIsError.value = false;

  try {
    const coords = await requestUserLocation();
    selectedLocation.latitude = coords.latitude;
    selectedLocation.longitude = coords.longitude;
    locationSource.value = 'device';
    gpsStatusMessage.value = 'Localização atualizada com sucesso!';
    await updateAddress(coords.latitude, coords.longitude);
  } catch (err) {
    console.error('Erro ao atualizar GPS:', err);
    gpsStatusIsError.value = true;
    gpsStatusMessage.value = 'Não foi possível obter o GPS. Verifique se a localização está autorizada no navegador.';
  } finally {
    isRefreshingGps.value = false;
    setTimeout(() => {
      if (!gpsStatusIsError.value) {
        gpsStatusMessage.value = '';
      }
    }, 4000);
  }
};

onMounted(async () => {
  // Verifica se há cooldown ativo persistido no localStorage (inclusive após F5 / recarregar a página)
  checkExistingCooldown();

  const isDefaultSP = Math.abs(props.currentLocation.latitude - (-23.55052)) < 0.0001 &&
                      Math.abs(props.currentLocation.longitude - (-46.633308)) < 0.0001;
  if (!isDefaultSP) {
    locationSource.value = 'device';
    updateAddress(selectedLocation.latitude, selectedLocation.longitude);
  } else {
    // Tenta silenciosamente obter localização real do navegador caso ainda esteja no fallback
    try {
      const coords = await requestUserLocation();
      selectedLocation.latitude = coords.latitude;
      selectedLocation.longitude = coords.longitude;
      locationSource.value = 'device';
      updateAddress(coords.latitude, coords.longitude);
    } catch {
      // Permissão ainda não concedida: mantém cidade e estado vazios para solicitar GPS antes de salvar
      locationSource.value = 'fallback';
      currentCidade.value = '';
      currentEstado.value = '';
      addressText.value = 'Localização pendente (autorize o GPS ou escolha no mapa)';
    }
  }
});

onBeforeUnmount(() => {
  if (rawPreviewUrl.value) {
    URL.revokeObjectURL(rawPreviewUrl.value);
    rawPreviewUrl.value = '';
  }
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }
  if (geocodeDebounceTimer) {
    clearTimeout(geocodeDebounceTimer);
    geocodeDebounceTimer = null;
  }
});

watch(() => props.currentLocation, (newVal) => {
  if (!newVal) return;
  const isDefaultSP = Math.abs(newVal.latitude - (-23.55052)) < 0.0001 &&
                      Math.abs(newVal.longitude - (-46.633308)) < 0.0001;
  // Se ainda estiver no fallback e a prop agora tiver uma localização real válida:
  if (locationSource.value === 'fallback' && !isDefaultSP) {
    selectedLocation.latitude = newVal.latitude;
    selectedLocation.longitude = newVal.longitude;
    locationSource.value = 'device';
    updateAddress(newVal.latitude, newVal.longitude);
  }
}, { deep: true });

const resetToUpload = () => {
  if (rawPreviewUrl.value) {
    URL.revokeObjectURL(rawPreviewUrl.value);
    rawPreviewUrl.value = '';
  }
  step.value = 'upload';
  isApiError.value = false;
  errorMessage.value = '';
  saveError.value = '';
  isAdjustingLocation.value = false;
  processedImageWebp.value = '';
  addressText.value = '';
  gpsStatusMessage.value = '';
  lastSelectedFile.value = null;
};

const handleRetry = async () => {
  if (lastSelectedFile.value) {
    if (!rawPreviewUrl.value) {
      rawPreviewUrl.value = URL.createObjectURL(lastSelectedFile.value);
    }
    await processSelectedImage(lastSelectedFile.value);
  } else {
    resetToUpload();
  }
};

const handleFileSelected = async (e) => {
  const target = e.target;
  const file = target.files?.[0];
  if (file) {
    if (rawPreviewUrl.value) {
      URL.revokeObjectURL(rawPreviewUrl.value);
    }
    rawPreviewUrl.value = URL.createObjectURL(file);
    lastSelectedFile.value = file;
    await processSelectedImage(file);
  }
  target.value = '';
};

const handlePhotoTaken = async (file) => {
  showCamera.value = false;
  if (file) {
    if (rawPreviewUrl.value) {
      URL.revokeObjectURL(rawPreviewUrl.value);
    }
    rawPreviewUrl.value = URL.createObjectURL(file);
    lastSelectedFile.value = file;
    await processSelectedImage(file);
  }
};

const processSelectedImage = async (file) => {
  // Trava de Segurança: se o cooldown estiver ativo, bloqueia o envio
  if (cooldownSecondsLeft.value > 0) {
    errorMessage.value = `Limite atingido. Aguarde ${cooldownSecondsLeft.value} segundos antes de enviar novas fotos.`;
    step.value = 'upload';
    return;
  }

  // Registra o upload e dispara cooldown de 1 min se atingir 5 fotos seguidas
  registerUploadAttempt();

  step.value = 'analyzing';
  isAnalyzing.value = true;
  isApiError.value = false;
  errorMessage.value = '';
  analyzingStatusText.value = 'Identificando localização...';

  try {
    // 1. Tentar obter coordenadas GPS gravadas no EXIF da foto
    const exifLocation = await extractGpsData(file);
    if (exifLocation) {
      selectedLocation.latitude = exifLocation.latitude;
      selectedLocation.longitude = exifLocation.longitude;
      locationSource.value = 'exif';
    } else {
      // Foto sem metadados GPS (câmera HTML5 ou upload do WhatsApp/Galeria):
      // Tentar capturar o GPS do dispositivo ao vivo
      try {
        const liveGps = await requestUserLocation();
        selectedLocation.latitude = liveGps.latitude;
        selectedLocation.longitude = liveGps.longitude;
        locationSource.value = 'device';
      } catch (gpsErr) {
        console.warn('[CreateIncidentModal] GPS ao vivo indisponível, usando localização atual:', gpsErr);
        selectedLocation.latitude = props.currentLocation.latitude;
        selectedLocation.longitude = props.currentLocation.longitude;
        const isDefaultSP = Math.abs(props.currentLocation.latitude - (-23.55052)) < 0.0001 &&
                            Math.abs(props.currentLocation.longitude - (-46.633308)) < 0.0001;
        locationSource.value = isDefaultSP ? 'fallback' : 'device';
      }
    }

    // Iniciar busca pelo nome da rua apenas se não for fallback sem localização real
    if (locationSource.value === 'fallback') {
      currentCidade.value = '';
      currentEstado.value = '';
      addressText.value = 'Localização pendente (autorize o GPS ou ajuste no mapa)';
      currentAddressPromise = Promise.resolve(null);
    } else {
      currentAddressPromise = updateAddress(selectedLocation.latitude, selectedLocation.longitude);
    }

    // 2. Redimensionar previamente a imagem para envio rápido e leve à IA (~250KB)
    analyzingStatusText.value = 'Otimizando imagem...';
    const optimizedBase64 = await prepareImageForGemini(file, 1200);

    // 3. Cache diário (1x por dia por foto) para poupar cotas do Gemini
    let imageHash = null;
    let analysis = null;
    try {
      imageHash = await computeFileSha256(file);
      analysis = getCachedGeminiAnalysis(imageHash);
      if (analysis) {
        analyzingStatusText.value = 'Foto já analisada hoje. Reutilizando análise do cache...';
      }
    } catch (hashErr) {
      console.warn('[CreateIncidentModal] Erro ao consultar cache da imagem:', hashErr);
    }

    // Se não estiver em cache, chama a IA do Google Gemini
    if (!analysis) {
      analyzingStatusText.value = 'Analisando veículo e segurança com IA...';
      analysis = await analyzeIncidentImage(geminiClient, optimizedBase64);

      // Salva no cache local de 24h caso a chamada tenha sido bem-sucedida
      if (imageHash && analysis && !analysis.apiError) {
        saveGeminiAnalysisCache(imageHash, analysis);
      }
    }

    if (analysis.apiError) {
      isApiError.value = true;
      step.value = 'error';
      errorMessage.value = analysis.rejectionReason || 'Instabilidade temporária no serviço de IA (Google Gemini). Por favor, tente novamente.';
      return;
    }

    // Validação de presença de veículo e adequação de conteúdo:
    if (!analysis.hasVehicle || !analysis.isAppropriate) {
      isApiError.value = false;
      step.value = 'error';
      errorMessage.value = analysis.rejectionReason || 'A foto precisa conter um veículo automotor e cumprir as regras comunitárias.';
      return;
    }

    // 4. Se aprovado: queimar o blur de 12px no Canvas e comprimir em WebP de alta definição
    analyzingStatusText.value = 'Aplicando desfoque de 12px nas placas e rostos...';
    const finalWebp = await blurSensitiveContentAndCompress(
      optimizedBase64,
      analysis.plates,
      analysis.faces
    );

    processedImageWebp.value = finalWebp;
    step.value = 'preview';
  } catch (err) {
    console.error('Erro no processamento da imagem:', err);
    isApiError.value = true;
    step.value = 'error';
    errorMessage.value = err?.message || 'Falha ao processar e anonimizar a foto enviada.';
  } finally {
    isAnalyzing.value = false;
  }
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

const toggleAdjustLocation = () => {
  isAdjustingLocation.value = !isAdjustingLocation.value;
  if (locationSource.value === 'fallback') {
    locationSource.value = 'manual';
  }
  if (!currentCidade.value || !currentEstado.value) {
    if (geocodeDebounceTimer) {
      clearTimeout(geocodeDebounceTimer);
      geocodeDebounceTimer = null;
    }
    currentAddressPromise = updateAddress(selectedLocation.latitude, selectedLocation.longitude);
  }
};

const handlePinChange = (newLoc) => {
  const latDiff = Math.abs(newLoc.latitude - selectedLocation.latitude);
  const lngDiff = Math.abs(newLoc.longitude - selectedLocation.longitude);
  const hasMovedSignificantly = latDiff > 0.00005 || lngDiff > 0.00005;

  selectedLocation.latitude = newLoc.latitude;
  selectedLocation.longitude = newLoc.longitude;
  locationSource.value = 'manual';

  // Só limpa cidade/estado se o pino realmente se moveu significativamente ou se ainda não tinham sido preenchidos
  if (hasMovedSignificantly || !currentCidade.value || !currentEstado.value) {
    if (hasMovedSignificantly) {
      currentCidade.value = '';
      currentEstado.value = '';
      addressText.value = 'Buscando endereço...';
    }

    if (geocodeDebounceTimer) clearTimeout(geocodeDebounceTimer);
    geocodeDebounceTimer = setTimeout(() => {
      currentAddressPromise = updateAddress(newLoc.latitude, newLoc.longitude);
    }, 250);
  }
};

const handleSaveIncident = async () => {
  isSaving.value = true;
  saveError.value = '';

  const screenCidade = (currentCidade.value || '').trim();
  const screenEstado = (currentEstado.value || '').trim();
  const screenAddress = (addressText.value || '').trim();

  // 1. Se ainda houver debounce ativo do pino, cancela e roda imediatamente
  if (geocodeDebounceTimer) {
    clearTimeout(geocodeDebounceTimer);
    geocodeDebounceTimer = null;
    currentAddressPromise = updateAddress(selectedLocation.latitude, selectedLocation.longitude);
  }

  // 2. Se a busca de endereço estiver em andamento, aguarda finalizar
  if (currentAddressPromise) {
    try {
      await currentAddressPromise;
    } catch {}
  }

  // 3. Se ainda estiver no fallback (usuário não mexeu no mapa e foto sem EXIF) e ainda sem Cidade/Estado na tela, tenta pegar o GPS ao vivo
  if (locationSource.value === 'fallback' && (!currentCidade.value?.trim() || !currentEstado.value?.trim()) && (!screenCidade || !screenEstado)) {
    gpsStatusIsError.value = false;
    gpsStatusMessage.value = 'Solicitando autorização do GPS para confirmar localização...';
    try {
      const gpsCoords = await requestUserLocation();
      selectedLocation.latitude = gpsCoords.latitude;
      selectedLocation.longitude = gpsCoords.longitude;
      locationSource.value = 'device';
      gpsStatusMessage.value = 'GPS autorizado! Identificando Cidade e Estado...';
      await updateAddress(gpsCoords.latitude, gpsCoords.longitude);
    } catch (gpsErr) {
      console.warn('[CreateIncidentModal] GPS indisponível no fallback, resolvendo endereço da coordenada selecionada:', gpsErr);
    }
  }

  // 4. Garantia de resolução: se Cidade ou Estado ainda estiverem vazios para a coordenada selecionada, busca diretamente
  if (!currentCidade.value?.trim() || !currentEstado.value?.trim()) {
    try {
      const details = await getAddressDetailsFromCoords(selectedLocation.latitude, selectedLocation.longitude);
      if (details.cidade && !currentCidade.value) currentCidade.value = details.cidade;
      if (details.estado && !currentEstado.value) currentEstado.value = details.estado;
      if (details.formattedAddress && (!addressText.value || addressText.value.startsWith('Lat:'))) {
        addressText.value = details.formattedAddress;
      }
    } catch {}
  }

  // 5. Extração complementar do texto do endereço caso necessário
  if ((!currentCidade.value?.trim() || !currentEstado.value?.trim()) && (addressText.value || screenAddress)) {
    const fromText = extractCityAndStateFromText(addressText.value || screenAddress);
    if (fromText.cidade && !currentCidade.value) currentCidade.value = fromText.cidade;
    if (fromText.estado && !currentEstado.value) currentEstado.value = fromText.estado;
  }

  let finalCidade = (
    currentCidade.value ||
    screenCidade ||
    (addressText.value ? extractCityAndStateFromText(addressText.value).cidade : '') ||
    (screenAddress ? extractCityAndStateFromText(screenAddress).cidade : '') ||
    ''
  ).trim();
  let finalEstado = (
    currentEstado.value ||
    screenEstado ||
    (addressText.value ? extractCityAndStateFromText(addressText.value).estado : '') ||
    (screenAddress ? extractCityAndStateFromText(screenAddress).estado : '') ||
    ''
  ).trim();

  if (finalCidade) currentCidade.value = finalCidade;
  if (finalEstado) currentEstado.value = finalEstado;

  // Só bloqueia se realmente não houver coordenadas válidas nem cidade/estado após todas as tentativas
  if (!finalCidade || !finalEstado) {
    if (locationSource.value === 'fallback') {
      isSaving.value = false;
      gpsStatusIsError.value = true;
      gpsStatusMessage.value = 'Autorização do GPS ou ajuste no mapa necessário.';
      saveError.value = 'Não foi possível identificar a Cidade e o Estado. Autorize o uso do GPS ou escolha o local no mapa para prosseguir.';
      return;
    }
  }

  const newIncident = {
    id: `inc-${Date.now()}`,
    timestamp: new Date().toISOString(),
    latitude: selectedLocation.latitude,
    longitude: selectedLocation.longitude,
    cidade: finalCidade,
    estado: finalEstado,
    maskedImageUrl: processedImageWebp.value,
    description: addressText.value || (finalCidade ? `${finalCidade}${finalEstado ? ` - ${finalEstado}` : ''}` : 'Infração registrada via colaboração cidadã')
  };

  try {
    // Gravar na planilha através do serviço (respeitando ordem das colunas: id, data, latitude, longitude, foto, ativo, motivo_denuncia, cidade, estado)
    const saveResult = await saveIncidentToSheet(props.appsScriptUrl || '', {
      id: newIncident.id,
      data: String(newIncident.timestamp),
      latitude: newIncident.latitude,
      longitude: newIncident.longitude,
      foto: newIncident.maskedImageUrl,
      ativo: true,
      motivo_denuncia: '',
      cidade: newIncident.cidade,
      estado: newIncident.estado
    });

    if (saveResult && saveResult.cidade) {
      newIncident.cidade = saveResult.cidade;
      currentCidade.value = saveResult.cidade;
    }
    if (saveResult && saveResult.estado) {
      newIncident.estado = saveResult.estado;
      currentEstado.value = saveResult.estado;
    }
    if ((!addressText.value || addressText.value.startsWith('Lat:')) && newIncident.cidade) {
      newIncident.description = `${newIncident.cidade}${newIncident.estado ? ` - ${newIncident.estado}` : ''}`;
    }

    emit('incidentCreated', newIncident);
    step.value = 'success';
  } catch (err) {
    console.error('Erro ao salvar na planilha:', err);
    saveError.value = 'Não foi possível gravar na planilha Google. Tente novamente ou verifique a conexão.';
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 9999;
}

.modal-card {
  background: var(--surface, #ffffff);
  border-radius: var(--radius-lg, 24px);
  padding: 2rem;
  max-width: 560px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text, #0f172a);
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-muted, #475466);
  border-radius: 8px;
  padding: 0.25rem 0.5rem;
}

.step-desc {
  font-size: 1.05rem;
  color: var(--text-muted, #475569);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.upload-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.btn-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.75rem 1rem;
  border-radius: var(--radius-md, 16px);
  border: 2px dashed var(--primary, #86007D);
  background: rgba(134, 0, 125, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text, #0f172a);
  text-align: center;
}

.btn-upload:hover {
  background: rgba(134, 0, 125, 0.08);
  border-color: var(--primary-hover, #a10096);
  transform: translateY(-2px);
}

.btn-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.btn-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.hidden-file-input {
  display: none;
}

.privacy-note {
  font-size: 0.85rem;
  color: var(--text-muted, #475466);
  line-height: 1.5;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

/* --- Etapa 2: Análise da Imagem e Filtro de Privacidade Animado --- */
.step-analyzing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0 1rem 0;
  gap: 1.25rem;
  width: 100%;
}

.analyzing-preview-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  height: 260px;
  border-radius: 18px;
  overflow: hidden;
  background: #0b0f19;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.analyzing-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: blur(15px) brightness(0.92) contrast(1.05);
  transform: scale(1.08);
  transition: filter 0.3s ease;
}

.analyzing-preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* Overlay de Escaneamento e Anonimização */
.privacy-scan-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

/* Grade de escaneamento cibernético */
.privacy-scan-grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(168, 85, 247, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(168, 85, 247, 0.08) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* Feixe laser de varredura que sobe e desce */
.scanner-laser-beam {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(168, 85, 247, 0.5) 15%, 
    #c084fc 35%, 
    #ffffff 50%, 
    #f472b6 65%, 
    rgba(244, 114, 182, 0.5) 85%, 
    transparent 100%
  );
  box-shadow: 
    0 0 12px 2px rgba(192, 132, 252, 0.8),
    0 0 24px 4px rgba(244, 114, 182, 0.5);
  animation: scanMove 2.6s ease-in-out infinite;
  z-index: 5;
}

.scanner-laser-beam::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(180deg, transparent, rgba(168, 85, 247, 0.22));
}

.scanner-laser-beam::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(0deg, transparent, rgba(236, 72, 153, 0.22));
}

/* Onda de desfoque sutil simulando filtro ativo */
.scanner-blur-wave {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  opacity: 0.65;
  animation: blurPulse 2.6s ease-in-out infinite;
  z-index: 4;
}

/* Badge HUD de status de privacidade */
.scan-hud-badge {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(192, 132, 252, 0.4);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45), 0 0 12px rgba(134, 0, 125, 0.3);
  padding: 0.45rem 0.95rem;
  border-radius: 9999px;
  z-index: 10;
  white-space: nowrap;
}

.hud-shield-pulse {
  font-size: 1.15rem;
  animation: shieldPulse 1.8s ease-in-out infinite;
}

.hud-badge-info {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.hud-badge-title {
  font-size: 0.78rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.3px;
}

.hud-badge-status {
  font-size: 0.68rem;
  color: #cbd5e1;
  font-weight: 500;
}

/* Cantoneiras de visor de IA */
.hud-corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border-color: #c084fc;
  border-style: solid;
  z-index: 8;
  opacity: 0.85;
}

.corner-tl { top: 12px; left: 12px; border-width: 2.5px 0 0 2.5px; border-top-left-radius: 4px; }
.corner-tr { top: 12px; right: 12px; border-width: 2.5px 2.5px 0 0; border-top-right-radius: 4px; }
.corner-bl { bottom: 12px; left: 12px; border-width: 0 0 2.5px 2.5px; border-bottom-left-radius: 4px; }
.corner-br { bottom: 12px; right: 12px; border-width: 0 2.5px 2.5px 0; border-bottom-right-radius: 4px; }

/* Detalhes de status e progresso abaixo da foto */
.analyzing-details {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 440px;
  text-align: center;
}

.analyzing-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}

.pulse-radar-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primary, #86007D);
  box-shadow: 0 0 0 0 rgba(134, 0, 125, 0.7);
  animation: pulseDot 1.6s infinite;
  flex-shrink: 0;
}

.analyzing-text {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text, #0f172a);
  margin: 0;
}

.analyzing-progress-bar {
  width: 100%;
  height: 4px;
  background: #e2e8f0;
  border-radius: 9999px;
  overflow: hidden;
  position: relative;
  margin: 0.25rem 0;
}

.analyzing-progress-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(90deg, #86007D, #c084fc, #ec4899);
  border-radius: 9999px;
  animation: indeterminateBar 1.8s infinite ease-in-out;
}

.analyzing-sub {
  font-size: 0.84rem;
  color: var(--text-muted, #475466);
}

/* Keyframes de Animação */
@keyframes scanMove {
  0% {
    top: 0%;
  }
  50% {
    top: calc(100% - 3px);
  }
  100% {
    top: 0%;
  }
}

@keyframes blurPulse {
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.85;
  }
}

@keyframes shieldPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.22);
  }
}

@keyframes pulseDot {
  0% {
    box-shadow: 0 0 0 0 rgba(134, 0, 125, 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(134, 0, 125, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(134, 0, 125, 0);
  }
}

@keyframes indeterminateBar {
  0% {
    left: -40%;
  }
  50% {
    left: 40%;
  }
  100% {
    left: 100%;
  }
}

.step-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 1rem;
}

.error-badge {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.error-heading {
  font-size: 1.3rem;
  font-weight: 800;
  color: #dc2626;
  margin-bottom: 0.75rem;
}

.error-heading.is-api-error {
  color: #b45309;
}

.error-explanation {
  font-size: 1.05rem;
  color: var(--text, #334155);
  max-width: 420px;
  line-height: 1.6;
}

.preview-container {
  position: relative;
  width: 100%;
  border-radius: var(--radius-md, 16px);
  overflow: hidden;
  margin-bottom: 1.25rem;
  background: #000;
}

.preview-img {
  width: 100%;
  max-height: 280px;
  object-fit: contain;
  display: block;
}

.badge-blur {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  color: #ffffff;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.location-box {
  padding: 1.25rem;
  border-radius: 16px;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.location-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.loc-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.source-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  letter-spacing: 0.02em;
}

.source-badge.is-exif {
  background: #e0e7ff;
  color: #3730a3;
}

.source-badge.is-gps {
  background: #dcfce7;
  color: #166534;
}

.source-badge.is-manual {
  background: #fef3c7;
  color: #92400e;
}

.source-badge.is-fallback {
  background: #fee2e2;
  color: #991b1b;
}

.loc-icon {
  font-size: 1.5rem;
}

.loc-address {
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--text, #0f172a);
  margin-top: 0.2rem;
  margin-bottom: 0.2rem;
  line-height: 1.4;
}

.loc-loading {
  display: inline-block;
  font-size: 0.85rem;
}

.loc-coords {
  font-size: 0.85rem;
  color: var(--text-muted, #475466);
}

.location-actions-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border, rgba(0,0,0,0.08));
}

.btn-loc-action {
  background: transparent;
  font-weight: 600;
  padding: 0.45rem 0.9rem;
  border-radius: 9999px;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.btn-refresh-gps {
  background: rgba(134, 0, 125, 0.08);
  color: var(--primary, #86007D);
  border: 1px solid rgba(134, 0, 125, 0.25);
}

.btn-refresh-gps:hover:not(:disabled) {
  background: rgba(134, 0, 125, 0.15);
}

.btn-refresh-gps:disabled {
  opacity: 0.6;
  cursor: wait;
}

.btn-adjust {
  background: transparent;
  color: var(--primary, #86007D);
  border: 1px solid var(--primary, #86007D);
}

.btn-adjust.is-active,
.btn-adjust:hover {
  background: var(--primary, #86007D);
  color: #fff;
}

.gps-msg {
  font-size: 0.82rem;
  font-weight: 500;
  color: #15803d;
  margin: 0;
  padding: 0.25rem 0;
}

.gps-msg.is-error {
  color: #dc2626;
}

.mini-map-container {
  margin-top: 0.5rem;
}

.mini-map-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.mini-map-hint {
  font-size: 0.8rem;
  color: var(--text-muted, #475466);
  margin: 0;
  flex: 1;
}

.btn-finish-adjust {
  background: var(--primary, #86007D);
  color: #ffffff;
  border: none;
  font-weight: 700;
  font-size: 0.82rem;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-finish-adjust:hover {
  background: var(--primary-hover, #a10096);
  transform: translateY(-1px);
}

.mini-map-frame {
  height: 280px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border, rgba(0,0,0,0.1));
}

.alert-error {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.step-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem 1rem;
}

.success-icon {
  font-size: 3.5rem;
  margin-bottom: 0.75rem;
}

.success-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: #15803d;
  margin-bottom: 0.5rem;
}

.success-desc {
  font-size: 1rem;
  color: var(--text, #334155);
  max-width: 420px;
  line-height: 1.6;
}

.loc-city-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f1f5f9;
  color: #334155;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  margin-top: 6px;
  border: 1px solid #cbd5e1;
  width: fit-content;
}

/* --- Cooldown Banner & Disabled Upload Buttons --- */
.cooldown-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  background: #fff7ed;
  border: 1.5px solid #fb923c;
  border-radius: 14px;
  padding: 1rem 1.15rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 4px 12px rgba(251, 146, 60, 0.12);
  animation: fadeIn 0.25s ease-out;
}

.cooldown-icon {
  font-size: 1.75rem;
  line-height: 1;
  flex-shrink: 0;
}

.cooldown-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cooldown-title {
  font-size: 0.98rem;
  font-weight: 800;
  color: #9a3412;
}

.cooldown-desc {
  font-size: 0.88rem;
  color: #c2410c;
  line-height: 1.45;
  margin: 0;
}

.btn-upload.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
  border-color: #cbd5e1;
  background: #f1f5f9;
  color: #94a3b8;
}

/* --- Alerta Destacado: Localização Obrigatória para Salvar --- */
.loc-required-alert {
  background: #fffbeb;
  border: 2px solid #f59e0b;
  border-radius: 14px;
  padding: 1rem 1.15rem;
  margin-top: 0.75rem;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  animation: fadeIn 0.3s ease-out;
}

.loc-alert-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.loc-alert-badge {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #fef3c7;
  color: #92400e;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  width: fit-content;
}

.loc-alert-msg {
  font-size: 0.92rem;
  color: #78350f;
  line-height: 1.45;
  margin: 0;
}

.loc-prominent-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.btn-prominent {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: #ffffff;
}

.btn-prominent:hover {
  transform: translateY(-2px);
}

.btn-prominent-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.btn-prominent-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.btn-prominent-title {
  font-size: 0.9rem;
  font-weight: 800;
  line-height: 1.2;
}

.btn-prominent-sub {
  font-size: 0.72rem;
  line-height: 1.3;
}

.btn-prominent-gps {
  border-color: rgba(134, 0, 125, 0.3);
  background: #fdf4fd;
  color: var(--primary, #86007D);
  box-shadow: 0 2px 8px rgba(134, 0, 125, 0.08);
}

.btn-prominent-gps:hover:not(:disabled) {
  background: #fae8fa;
  border-color: var(--primary, #86007D);
  box-shadow: 0 4px 12px rgba(134, 0, 125, 0.18);
}

.btn-prominent-gps:disabled {
  opacity: 0.65;
  cursor: wait;
}

.btn-prominent-gps .btn-prominent-title {
  color: var(--primary, #86007D);
}

.btn-prominent-gps .btn-prominent-sub {
  color: #701a75;
}

.btn-prominent-map {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #1e293b;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.btn-prominent-map:hover {
  background: #f1f5f9;
  border-color: #475466;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.btn-prominent-map.is-active {
  background: #1e293b;
  color: #ffffff;
  border-color: #0f172a;
}

.btn-prominent-map.is-active .btn-prominent-title {
  color: #ffffff;
}

.btn-prominent-map.is-active .btn-prominent-sub {
  color: #cbd5e1;
}

.btn-prominent-map .btn-prominent-sub {
  color: #475466;
}

.btn-save-incident.is-disabled-lock {
  background: #94a3b8 !important;
  border-color: #94a3b8 !important;
  cursor: not-allowed !important;
  opacity: 0.75;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 540px) {
  .loc-prominent-actions {
    grid-template-columns: 1fr;
  }
}
</style>
