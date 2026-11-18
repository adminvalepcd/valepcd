<template>
  <section class="critical-points" aria-labelledby="critical-points-heading">
    <div class="cp-header">
      <div>
        <h3 id="critical-points-heading" ref="headingRef" class="cp-title" tabindex="-1">
          Pontos críticos
        </h3>
        <p class="cp-subtitle">
          Onde e quando há mais ocorrências, para orientar a fiscalização. Escolha um ponto para ver as ocorrências dele na lista.
        </p>
      </div>
      <button
        type="button"
        class="btn-refresh-list"
        :disabled="points.length === 0"
        @click="exportRanking"
      >
        <span aria-hidden="true">⬇️</span>
        <span>Exportar ranking (CSV)</span>
      </button>
    </div>

    <div class="cp-controls">
      <div class="cp-control" role="group" aria-labelledby="cp-groupby-label">
        <span id="cp-groupby-label" class="field-label">Agrupar por</span>
        <div class="cp-segmented">
          <button
            type="button"
            class="cp-seg-btn"
            :class="{ 'is-active': groupBy === 'rua' }"
            :aria-pressed="groupBy === 'rua'"
            @click="groupBy = 'rua'"
          >
            Rua
          </button>
          <button
            type="button"
            class="cp-seg-btn"
            :class="{ 'is-active': groupBy === 'bairro' }"
            :aria-pressed="groupBy === 'bairro'"
            @click="groupBy = 'bairro'"
          >
            Bairro
          </button>
        </div>
      </div>

      <div class="cp-control">
        <label for="cp-natureza" class="field-label">Tipo de ocorrência</label>
        <select
          id="cp-natureza"
          v-model="natureza"
          class="field-input filter-select"
          aria-describedby="cp-natureza-hint"
        >
          <option value="transito">Infração de trânsito</option>
          <option value="urbana">Mobilidade urbana</option>
          <option value="">Todos os tipos</option>
        </select>
        <span id="cp-natureza-hint" class="cp-hint">
          Para planejar a fiscalização, use Infração de trânsito.
        </span>
      </div>
    </div>

    <p v-if="points.length === 0" class="cp-empty">
      Não há ocorrências com endereço informado para os filtros escolhidos.
    </p>

    <template v-else>
      <h4 class="cp-section-title">
        <template v-if="groupBy === 'rua'">Ruas com mais ocorrências</template>
        <template v-else>Bairros com mais ocorrências</template>
      </h4>
      <!-- Rolagem a partir de 5 posições para não ocupar muito da tela -->
      <div
        class="cp-ranking-scroll"
        :class="{ 'is-scrollable': points.length > VISIBLE_ROWS }"
        :style="rankingMaxHeight ? { maxHeight: `${rankingMaxHeight}px` } : undefined"
        :tabindex="points.length > VISIBLE_ROWS ? 0 : undefined"
        :role="points.length > VISIBLE_ROWS ? 'region' : undefined"
        :aria-label="points.length > VISIBLE_ROWS ? `Ranking com ${points.length} posições (role para ver todas)` : undefined"
      >
      <ol ref="rankingListRef" class="cp-ranking">
        <li v-for="(point, index) in points" :key="point.key" class="cp-rank-item">
          <button
            type="button"
            class="cp-rank-btn"
            :aria-describedby="`cp-rank-meta-${index}`"
            @click="emit('select-point', { groupBy, key: point.key, label: point.label, natureza, abertas: point.abertas })"
          >
            <span class="cp-rank-pos" aria-hidden="true">{{ index + 1 }}</span>
            <span class="cp-rank-body">
              <span class="cp-rank-label">
                <span class="sr-only">{{ index + 1 }}º lugar: </span>{{ point.label }}
                <span v-if="groupBy === 'rua' && point.bairro" class="cp-rank-bairro">• {{ point.bairro }}</span>
              </span>
              <span class="cp-rank-bar-track" aria-hidden="true">
                <span class="cp-rank-bar" :style="{ width: `${barWidth(point.count, maxPointCount)}%` }"></span>
              </span>
              <span :id="`cp-rank-meta-${index}`" class="cp-rank-meta">
                {{ point.count }} {{ point.count === 1 ? 'ocorrência' : 'ocorrências' }}
                ({{ point.abertas }} {{ point.abertas === 1 ? 'aberta' : 'abertas' }})
                <template v-if="point.lastAt"> • última em {{ formatDate(point.lastAt) }}</template>
              </span>
            </span>
          </button>
        </li>
      </ol>
      </div>
      <p v-if="points.length > VISIBLE_ROWS" class="cp-scroll-hint">
        Mostrando 5 por vez de {{ points.length }}. Role a lista para ver as demais.
      </p>

      <div class="cp-time-grid">
        <!-- Distribuição por hora -->
        <div class="cp-chart-box">
          <h4 class="cp-section-title">Ocorrências por hora do dia</h4>
          <p v-if="peakHour !== null" class="cp-peak">
            Horário com mais ocorrências:
            <strong>{{ peakHour }}h às {{ (peakHour + 1) % 24 }}h</strong>
            ({{ distribution.byHour[peakHour] }})
          </p>
          <div class="cp-hour-chart" aria-hidden="true">
            <div v-for="(value, hour) in distribution.byHour" :key="hour" class="cp-hour-col">
              <span class="cp-col-value">{{ value }}</span>
              <span class="cp-col-track">
                <span class="cp-col-bar" :style="{ height: `${barWidth(value, maxHour)}%` }"></span>
              </span>
              <span class="cp-col-label">{{ hour }}h</span>
            </div>
          </div>
          <table class="sr-only">
            <caption>Ocorrências por hora do dia</caption>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Ocorrências</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(value, hour) in distribution.byHour" :key="hour">
                <th scope="row">{{ hour }}h às {{ (hour + 1) % 24 }}h</th>
                <td>{{ value }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Distribuição por dia da semana -->
        <div class="cp-chart-box">
          <h4 class="cp-section-title">Ocorrências por dia da semana</h4>
          <p v-if="peakWeekday !== null" class="cp-peak">
            Dia com mais ocorrências:
            <strong>{{ WEEKDAY_NAMES[peakWeekday] }}</strong>
            ({{ distribution.byWeekday[peakWeekday] }})
          </p>
          <ul class="cp-weekday-chart" aria-hidden="true">
            <li v-for="(value, day) in distribution.byWeekday" :key="day" class="cp-weekday-row">
              <span class="cp-weekday-label">{{ WEEKDAY_SHORT[day] }}</span>
              <span class="cp-rank-bar-track">
                <span class="cp-rank-bar" :style="{ width: `${barWidth(value, maxWeekday)}%` }"></span>
              </span>
              <span class="cp-weekday-value">{{ value }}</span>
            </li>
          </ul>
          <table class="sr-only">
            <caption>Ocorrências por dia da semana</caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">Ocorrências</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(value, day) in distribution.byWeekday" :key="day">
                <th scope="row">{{ WEEKDAY_NAMES[day] }}</th>
                <td>{{ value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import type { ReportedIncident } from '~/types';
import {
  computeCriticalPoints,
  computeTimeDistribution,
  type CriticalPointGroupBy,
  type CriticalPointNatureza
} from '~/utils/multeiCriticalPoints';
import { buildCsv, downloadCsv, type CsvColumn } from '~/utils/multeiCsv';
import type { CriticalPoint } from '~/utils/multeiCriticalPoints';

interface CriticalPointSelection {
  groupBy: CriticalPointGroupBy;
  key: string;
  label: string;
  natureza: CriticalPointNatureza;
  abertas: number;
}

const props = defineProps<{
  incidents: ReportedIncident[];
  initialNatureza?: CriticalPointNatureza;
  /** Usado no nome do arquivo exportado. */
  fileLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'select-point', payload: CriticalPointSelection): void;
  (e: 'exported', count: number): void;
}>();

const VISIBLE_ROWS = 5;
const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const groupBy = ref<CriticalPointGroupBy>('rua');
const natureza = ref<CriticalPointNatureza>(props.initialNatureza ?? 'transito');
const headingRef = ref<HTMLElement | null>(null);
const rankingListRef = ref<HTMLElement | null>(null);
const rankingMaxHeight = ref<number | null>(null);

watch(
  () => props.initialNatureza,
  (value) => {
    if (value !== undefined) natureza.value = value;
  }
);


const points = computed<CriticalPoint[]>(() =>
  computeCriticalPoints(props.incidents, { groupBy: groupBy.value, natureza: natureza.value, top: 0 })
);

let rankingResizeObserver: ResizeObserver | null = null;

// Altura exata de 5 posições (mede os itens renderizados; acompanha zoom de fonte e quebra de linha)
const measureRankingHeight = () => {
  const list = rankingListRef.value;
  if (!list) return;
  // A lista pode surgir depois do mount (quando antes não havia pontos): observa a partir daqui
  if (!rankingResizeObserver && typeof ResizeObserver !== 'undefined') {
    rankingResizeObserver = new ResizeObserver(() => measureRankingHeight());
    rankingResizeObserver.observe(list);
  }
  const items = list.children;
  if (items.length <= VISIBLE_ROWS) {
    rankingMaxHeight.value = null;
    return;
  }
  const last = items[VISIBLE_ROWS - 1] as HTMLElement;
  const listTop = list.getBoundingClientRect().top;
  const bottom = last.getBoundingClientRect().bottom;
  rankingMaxHeight.value = Math.ceil(bottom - listTop) + 4;
};

watch(points, () => {
  nextTick(measureRankingHeight);
});

onMounted(() => {
  nextTick(measureRankingHeight);
});
onBeforeUnmount(() => {
  rankingResizeObserver?.disconnect();
  rankingResizeObserver = null;
});

const maxPointCount = computed(() => points.value.reduce((m, p) => Math.max(m, p.count), 0));

const distribution = computed(() => computeTimeDistribution(props.incidents, { natureza: natureza.value }));

const maxHour = computed(() => Math.max(0, ...distribution.value.byHour));
const maxWeekday = computed(() => Math.max(0, ...distribution.value.byWeekday));

const indexOfMax = (list: number[]): number | null => {
  let best = -1;
  let bestValue = 0;
  list.forEach((v, i) => {
    if (v > bestValue) {
      best = i;
      bestValue = v;
    }
  });
  return best >= 0 ? best : null;
};

const peakHour = computed(() => indexOfMax(distribution.value.byHour));
const peakWeekday = computed(() => indexOfMax(distribution.value.byWeekday));

const barWidth = (value: number, max: number) => {
  if (!max || value <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const todayStamp = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const buildMapLink = (lat: number, lng: number) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || typeof window === 'undefined') return '';
  return `${window.location.origin}/multei?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;
};

const exportRanking = () => {
  if (points.value.length === 0) return;
  const naturezaLabel =
    natureza.value === 'transito' ? 'Infração de trânsito' : natureza.value === 'urbana' ? 'Mobilidade urbana' : 'Todos os tipos';
  const columns: CsvColumn<CriticalPoint>[] = [
    { header: 'posição', value: (_row, i) => i + 1 },
    { header: groupBy.value === 'rua' ? 'rua' : 'bairro', key: 'label' },
    ...(groupBy.value === 'rua' ? [{ header: 'bairro', key: 'bairro' } as CsvColumn<CriticalPoint>] : []),
    { header: 'tipo', value: () => naturezaLabel },
    { header: 'total', key: 'count' },
    { header: 'abertas', key: 'abertas' },
    { header: 'última ocorrência', value: (row) => formatDate(row.lastAt) },
    { header: 'latitude', value: (row) => (Number.isFinite(row.latitude) ? Number(row.latitude.toFixed(6)) : '') },
    { header: 'longitude', value: (row) => (Number.isFinite(row.longitude) ? Number(row.longitude.toFixed(6)) : '') },
    { header: 'link para o mapa', value: (row) => buildMapLink(row.latitude, row.longitude) }
  ];
  const csv = buildCsv(points.value, columns);
  const label = String(props.fileLabel || 'todas').trim() || 'todas';
  downloadCsv(`multei-pontos-criticos-${groupBy.value}-${label}-${todayStamp()}.csv`, csv);
  emit('exported', points.value.length);
};

const focusHeading = () => headingRef.value?.focus();

defineExpose({ focusHeading });
</script>

<style scoped src="../../../../assets/css/multei-panel.css"></style>

<style scoped>
.critical-points {
  background: var(--pp-surface);
  border: 1.5px solid var(--pp-border);
  border-radius: 22px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.cp-title {
  font-size: 1.15rem;
  font-weight: 900;
  margin: 0 0 0.25rem;
  color: var(--pp-text-primary);
}

.cp-subtitle,
.cp-hint,
.cp-empty,
.cp-peak {
  margin: 0;
  font-size: 0.88rem;
  color: var(--pp-text-secondary);
}

.cp-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  align-items: flex-start;
}

.cp-control {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 220px;
}

.cp-segmented {
  display: inline-flex;
  border: 2px solid var(--pp-border-strong);
  border-radius: 9999px;
  overflow: hidden;
  width: fit-content;
}

.cp-seg-btn {
  padding: 0.55rem 1.1rem;
  border: none;
  background: var(--pp-surface);
  color: var(--pp-text-primary);
  font-weight: 800;
  font-size: 0.88rem;
  cursor: pointer;
}

.cp-seg-btn.is-active {
  background: var(--pp-accent);
  color: var(--pp-accent-text);
}

.cp-section-title {
  font-size: 0.98rem;
  font-weight: 800;
  margin: 0;
  color: var(--pp-text-primary);
}

.cp-ranking-scroll.is-scrollable {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0.35rem;
  border-radius: 14px;
}

.cp-ranking-scroll.is-scrollable:focus-visible {
  outline: 3px solid var(--pp-accent);
  outline-offset: 3px;
}

.cp-scroll-hint {
  margin: 0.45rem 0 0;
  font-size: 0.82rem;
  color: var(--pp-text-secondary);
}

.cp-ranking {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cp-rank-btn {
  width: 100%;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  text-align: left;
  background: var(--pp-surface-alt);
  border: 2px solid var(--pp-border);
  border-radius: 14px;
  padding: 0.7rem 0.9rem;
  cursor: pointer;
  color: var(--pp-text-primary);
  font-family: inherit;
}

.cp-rank-btn:hover {
  border-color: var(--pp-selected-border);
}

.cp-rank-pos {
  flex: 0 0 auto;
  min-width: 1.9rem;
  height: 1.9rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--pp-accent);
  color: var(--pp-accent-text);
  font-weight: 900;
  font-size: 0.85rem;
}

.cp-rank-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.cp-rank-label {
  font-weight: 800;
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}

.cp-rank-bairro {
  font-weight: 600;
  color: var(--pp-text-secondary);
}

.cp-rank-meta {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--pp-text-secondary);
}

.cp-rank-bar-track {
  display: block;
  flex: 1 1 auto;
  height: 10px;
  border-radius: 9999px;
  background: var(--pp-border);
  overflow: hidden;
}

.cp-rank-bar {
  display: block;
  height: 100%;
  border-radius: 9999px;
  background: var(--pp-accent);
}

.cp-more-btn {
  align-self: flex-start;
}

.cp-time-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 1.25rem;
}

.cp-chart-box {
  border: 1px solid var(--pp-border);
  border-radius: 16px;
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}

.cp-hour-chart {
  display: grid;
  grid-template-columns: repeat(24, minmax(22px, 1fr));
  gap: 3px;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.cp-hour-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.cp-col-value,
.cp-col-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
}

.cp-col-track {
  height: 110px;
  width: 100%;
  display: flex;
  align-items: flex-end;
  background: var(--pp-surface-alt);
  border-radius: 6px;
  overflow: hidden;
}

.cp-col-bar {
  display: block;
  width: 100%;
  background: var(--pp-accent);
  border-radius: 6px 6px 0 0;
}

.cp-weekday-chart {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.cp-weekday-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.cp-weekday-label {
  width: 2.6rem;
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--pp-text-primary);
}

.cp-weekday-value {
  min-width: 2rem;
  text-align: right;
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--pp-text-primary);
}

@media (max-width: 960px) {
  .critical-points {
    padding: 1rem;
  }

  .cp-time-grid {
    grid-template-columns: 1fr;
  }
}
</style>
