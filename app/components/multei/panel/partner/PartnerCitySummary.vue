<template>
  <section class="partner-city-summary" aria-labelledby="partner-summary-heading">
    <h3 id="partner-summary-heading" class="summary-heading">
      <template v-if="title">{{ title }}</template>
      <template v-else>Resumo</template>
      <span v-if="periodLabel" class="summary-period">({{ periodLabel }})</span>
    </h3>
    <dl class="summary-grid">
      <div class="summary-card summary-card-open">
        <dt class="summary-label">Abertas</dt>
        <dd class="summary-value">{{ openCount }}</dd>
      </div>
      <div class="summary-card summary-card-fixed">
        <dt class="summary-label">Corrigidas</dt>
        <dd class="summary-value">{{ resolvedCount }}</dd>
      </div>
      <div class="summary-card">
        <dt class="summary-label">Tempo médio de correção</dt>
        <dd class="summary-value">
          <template v-if="averageResolutionDays === null">
            <span aria-hidden="true">—</span>
            <span class="sr-only">Sem correções no período</span>
          </template>
          <template v-else-if="averageResolutionDays < 1">Menos de 1 dia</template>
          <template v-else-if="Math.round(averageResolutionDays) === 1">1 dia</template>
          <template v-else>{{ Math.round(averageResolutionDays) }} dias</template>
        </dd>
      </div>
      <div class="summary-card">
        <dt class="summary-label">Bairro com mais ocorrências</dt>
        <dd class="summary-value summary-value-text">
          <template v-if="topBairro">
            {{ topBairro.label }}
            <span class="summary-sub">
              ({{ topBairro.count }} {{ topBairro.count === 1 ? 'ocorrência' : 'ocorrências' }})
            </span>
          </template>
          <template v-else>
            <span aria-hidden="true">—</span>
            <span class="sr-only">Sem bairro informado</span>
          </template>
        </dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReportedIncident } from '~/types';
import { computeCriticalPoints, isIncidentOpen, parseIncidentTime } from '~/utils/multeiCriticalPoints';

const props = defineProps<{
  incidents: ReportedIncident[];
  title?: string;
  periodLabel?: string;
}>();

const openCount = computed(() => props.incidents.filter((inc) => isIncidentOpen(inc)).length);
const resolvedCount = computed(() => props.incidents.length - openCount.value);

const averageResolutionDays = computed<number | null>(() => {
  let total = 0;
  let count = 0;
  for (const inc of props.incidents) {
    if (isIncidentOpen(inc)) continue;
    const start = parseIncidentTime(inc.timestamp);
    const end = parseIncidentTime(inc.data_resolucao);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    total += (end - start) / 86400000;
    count++;
  }
  return count > 0 ? total / count : null;
});

const topBairro = computed(() => {
  const [first] = computeCriticalPoints(props.incidents, { groupBy: 'bairro', top: 1 });
  return first || null;
});
</script>

<style scoped>
.partner-city-summary {
  margin-bottom: 1.25rem;
}

.summary-heading {
  font-size: 1rem;
  font-weight: 800;
  margin: 0 0 0.65rem;
  color: var(--pp-text-primary);
}

.summary-period {
  font-weight: 600;
  color: var(--pp-text-secondary);
  margin-left: 0.35rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
  margin: 0;
}

.summary-card {
  background: var(--pp-surface);
  border: 1.5px solid var(--pp-border);
  border-radius: 16px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column-reverse;
  gap: 0.25rem;
}

.summary-card-open {
  border-color: var(--pp-amber-border);
}

.summary-card-fixed {
  border-color: var(--pp-green-border);
}

.summary-label {
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--pp-text-secondary);
}

.summary-value {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 900;
  color: var(--pp-text-primary);
}

.summary-value-text {
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}

.summary-sub {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--pp-text-secondary);
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

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
