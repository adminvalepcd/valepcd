<template>
  <div ref="rootRef" class="city-search-field">
    <div class="city-search-input-wrap">
      <span class="city-search-icon" aria-hidden="true">🔍</span>
      <input
        :id="inputId"
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        role="combobox"
        autocomplete="off"
        :aria-expanded="isOpen"
        aria-autocomplete="list"
        :aria-controls="`${inputId}-listbox`"
        :placeholder="computedPlaceholder"
        :disabled="disabled || !uf"
        :required="required"
        class="field-input city-search-input"
        @focus="handleFocus"
        @input="handleInput"
        @keydown="handleKeydown"
      />

      <span v-if="isLoading" class="city-loading-indicator" title="Carregando cidades do IBGE..." aria-hidden="true">
        ⏳
      </span>

      <button
        v-if="searchQuery && !disabled && uf"
        type="button"
        class="btn-city-clear"
        :title="allowClear ? 'Limpar filtro de cidade (Todas as cidades)' : 'Limpar para pesquisar outra cidade'"
        :aria-label="allowClear ? 'Limpar filtro de cidade' : 'Limpar busca de cidade'"
        @mousedown.prevent="handleClearClick"
      >
        ✕
      </button>

      <button
        v-if="uf && !disabled"
        type="button"
        class="btn-city-toggle"
        tabindex="-1"
        aria-label="Abrir lista de cidades"
        @mousedown.prevent="toggleDropdown"
      >
        ▾
      </button>
    </div>

    <ul
      v-if="isOpen && uf && !disabled"
      :id="`${inputId}-listbox`"
      role="listbox"
      class="city-search-dropdown"
    >
      <li v-if="isLoading" class="city-dropdown-status">
        Carregando municípios de {{ uf }} (IBGE)...
      </li>

      <template v-else>
        <li
          v-if="allowClear"
          role="option"
          :aria-selected="modelValue === ''"
          class="city-dropdown-item city-dropdown-all"
          :class="{ 'is-selected': modelValue === '' }"
          @mousedown.prevent="selectCity('')"
        >
          <span>🏙️ Todas as cidades de {{ uf }}</span>
        </li>

        <li
          v-if="capitalCity && shouldShowCapitalShortcut"
          role="option"
          :aria-selected="modelValue === capitalCity"
          class="city-dropdown-item city-dropdown-capital"
          :class="{ 'is-selected': modelValue === capitalCity }"
          @mousedown.prevent="selectCity(capitalCity)"
        >
          <span>{{ capitalCity }}</span>
          <span class="capital-tag">⭐ Capital</span>
        </li>

        <li
          v-for="(city, idx) in displayedCities"
          :key="city"
          role="option"
          :aria-selected="modelValue === city"
          class="city-dropdown-item"
          :class="{
            'is-selected': modelValue === city,
            'is-highlighted': highlightedIndex === idx
          }"
          @mousedown.prevent="selectCity(city)"
          @mouseenter="highlightedIndex = idx"
        >
          <span>{{ city }}</span>
          <span v-if="city === capitalCity" class="capital-tag">⭐ Capital</span>
        </li>

        <li v-if="displayedCities.length === 0" class="city-dropdown-empty">
          Nenhuma cidade encontrada para "{{ searchQuery }}" em {{ uf }}.
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  fetchCitiesByState,
  getCapitalByState,
  normalizeSearchText
} from '~/services/ibgeService';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    uf: string;
    inputId?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    allowClear?: boolean;
  }>(),
  {
    inputId: 'city-search-input',
    placeholder: 'Digite para buscar a cidade...',
    disabled: false,
    required: false,
    allowClear: false
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const rootRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const cities = ref<string[]>([]);
const isLoading = ref(false);
const isOpen = ref(false);
const hasTypedSinceFocus = ref(false);
const searchQuery = ref(props.modelValue || '');
const highlightedIndex = ref(-1);

const capitalCity = computed(() => getCapitalByState(props.uf));

const computedPlaceholder = computed(() => {
  if (!props.uf) return 'Selecione o estado (UF) primeiro';
  return props.placeholder || `Buscar cidade em ${props.uf}...`;
});

const displayedCities = computed(() => {
  const list = cities.value;
  if (!hasTypedSinceFocus.value || !searchQuery.value.trim()) {
    return list;
  }
  const q = normalizeSearchText(searchQuery.value);
  return list.filter((city) => normalizeSearchText(city).includes(q));
});

const shouldShowCapitalShortcut = computed(() => {
  if (!capitalCity.value) return false;
  if (!hasTypedSinceFocus.value || !searchQuery.value.trim()) return false;
  const q = normalizeSearchText(searchQuery.value);
  return !normalizeSearchText(capitalCity.value).includes(q);
});

const loadStateCities = async (uf: string) => {
  if (!uf) {
    cities.value = [];
    return;
  }
  isLoading.value = true;
  try {
    cities.value = await fetchCitiesByState(uf);
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.modelValue,
  (newVal) => {
    searchQuery.value = newVal || '';
  }
);

watch(
  () => props.uf,
  async (newUf, oldUf) => {
    const normalizedNew = (newUf || '').trim().toUpperCase();
    const normalizedOld = (oldUf || '').trim().toUpperCase();

    if (!normalizedNew) {
      cities.value = [];
      searchQuery.value = '';
      if (props.modelValue !== '') {
        emit('update:modelValue', '');
      }
      return;
    }

    await loadStateCities(normalizedNew);

    if (normalizedNew !== normalizedOld) {
      const cap = getCapitalByState(normalizedNew);
      const currentVal = (props.modelValue || '').trim();
      const existsInNewState =
        currentVal &&
        cities.value.some((c) => normalizeSearchText(c) === normalizeSearchText(currentVal));

      if (!existsInNewState && cap) {
        searchQuery.value = cap;
        emit('update:modelValue', cap);
      } else if (existsInNewState) {
        searchQuery.value = currentVal;
      }
    }
  }
);

const handleFocus = () => {
  if (props.disabled || !props.uf) return;
  hasTypedSinceFocus.value = false;
  highlightedIndex.value = -1;
  isOpen.value = true;
  setTimeout(() => {
    inputRef.value?.select();
  }, 10);
};

const handleInput = () => {
  hasTypedSinceFocus.value = true;
  highlightedIndex.value = 0;
  isOpen.value = true;
  if (!searchQuery.value.trim() && props.allowClear) {
    emit('update:modelValue', '');
  }
};

const selectCity = (city: string) => {
  searchQuery.value = city;
  emit('update:modelValue', city);
  hasTypedSinceFocus.value = false;
  isOpen.value = false;
  highlightedIndex.value = -1;
};

const handleClearClick = () => {
  searchQuery.value = '';
  hasTypedSinceFocus.value = true;
  isOpen.value = true;
  highlightedIndex.value = -1;
  if (props.allowClear) {
    emit('update:modelValue', '');
  }
  inputRef.value?.focus();
};

const toggleDropdown = () => {
  if (props.disabled || !props.uf) return;
  if (isOpen.value) {
    isOpen.value = false;
  } else {
    hasTypedSinceFocus.value = false;
    isOpen.value = true;
    inputRef.value?.focus();
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value && (e.key === 'ArrowDown' || e.key === 'Enter')) {
    isOpen.value = true;
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (displayedCities.value.length > 0) {
      highlightedIndex.value = (highlightedIndex.value + 1) % displayedCities.value.length;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (displayedCities.value.length > 0) {
      highlightedIndex.value =
        highlightedIndex.value <= 0
          ? displayedCities.value.length - 1
          : highlightedIndex.value - 1;
    }
  } else if (e.key === 'Enter' && isOpen.value) {
    e.preventDefault();
    if (
      highlightedIndex.value >= 0 &&
      highlightedIndex.value < displayedCities.value.length
    ) {
      selectCity(displayedCities.value[highlightedIndex.value] || '');
    } else if (displayedCities.value.length === 1) {
      selectCity(displayedCities.value[0] || '');
    }
  } else if (e.key === 'Escape') {
    isOpen.value = false;
    searchQuery.value = props.modelValue || '';
  }
};

const handleDocumentMouseDown = (e: MouseEvent) => {
  if (!rootRef.value) return;
  if (!rootRef.value.contains(e.target as Node)) {
    if (isOpen.value) {
      isOpen.value = false;
      const trimmed = searchQuery.value.trim();
      if (!trimmed) {
        if (props.allowClear) {
          searchQuery.value = '';
          emit('update:modelValue', '');
        } else {
          const fallback = props.modelValue || capitalCity.value;
          searchQuery.value = fallback;
          if (fallback !== props.modelValue) {
            emit('update:modelValue', fallback);
          }
        }
      } else {
        const exactMatch = cities.value.find(
          (c) => normalizeSearchText(c) === normalizeSearchText(trimmed)
        );
        if (exactMatch) {
          searchQuery.value = exactMatch;
          emit('update:modelValue', exactMatch);
        } else {
          searchQuery.value = props.modelValue || capitalCity.value;
        }
      }
    }
  }
};

onMounted(async () => {
  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', handleDocumentMouseDown);
  }
  if (props.uf) {
    await loadStateCities(props.uf);
    if (!props.modelValue && !props.allowClear) {
      const cap = getCapitalByState(props.uf);
      if (cap) {
        searchQuery.value = cap;
        emit('update:modelValue', cap);
      }
    }
  }
});

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('mousedown', handleDocumentMouseDown);
  }
});
</script>

<style scoped>
.city-search-field {
  position: relative;
  width: 100%;
}

.city-search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.city-search-icon {
  position: absolute;
  left: 0.78rem;
  font-size: 0.9rem;
  pointer-events: none;
  opacity: 0.8;
}

.city-search-input {
  width: 100%;
  padding: 0.72rem 4.1rem 0.72rem 2.25rem;
  border-radius: 12px;
  border: 2px solid var(--pp-border-strong, #64748b);
  background: var(--pp-surface-alt, #f8fafc);
  color: var(--pp-text-primary, #0f172a);
  font-size: 0.92rem;
  font-family: inherit;
  font-weight: 700;
}

.city-search-input:focus {
  outline: 3px solid var(--pp-accent, #4a044e);
  outline-offset: 1px;
}

.city-search-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.city-loading-indicator {
  position: absolute;
  right: 3.6rem;
  font-size: 0.85rem;
}

.btn-city-clear {
  position: absolute;
  right: 2.05rem;
  background: transparent;
  border: none;
  color: var(--pp-text-secondary, #334155);
  font-size: 0.88rem;
  font-weight: 900;
  cursor: pointer;
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
}

.btn-city-clear:hover {
  background: var(--pp-border, #cbd5e1);
  color: var(--pp-text-primary, #0f172a);
}

.btn-city-toggle {
  position: absolute;
  right: 0.5rem;
  background: transparent;
  border: none;
  color: var(--pp-text-primary, #0f172a);
  font-size: 0.95rem;
  font-weight: 900;
  cursor: pointer;
  padding: 0.25rem 0.45rem;
}

.city-search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 60;
  max-height: 250px;
  overflow-y: auto;
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  background: var(--pp-surface, #ffffff);
  border: 2px solid var(--pp-border-strong, #64748b);
  border-radius: 14px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.22);
}

.city-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-radius: 9px;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--pp-text-primary, #0f172a);
  cursor: pointer;
}

.city-dropdown-item:hover,
.city-dropdown-item.is-highlighted {
  background: var(--pp-surface-alt, #f1f5f9);
}

.city-dropdown-item.is-selected {
  background: var(--pp-selected-bg, #fdf4ff);
  border: 1px solid var(--pp-selected-border, #701a75);
  font-weight: 900;
}

.city-dropdown-all {
  border-bottom: 1px solid var(--pp-border, #cbd5e1);
  margin-bottom: 0.25rem;
  border-radius: 9px 9px 0 0;
}

.city-dropdown-capital {
  border-bottom: 1px dashed var(--pp-border, #cbd5e1);
  margin-bottom: 0.25rem;
}

.capital-tag {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.14rem 0.45rem;
  border-radius: 9999px;
  background: var(--pp-amber-bg, #fffbeb);
  color: var(--pp-amber-text, #78350f);
  border: 1px solid var(--pp-amber-border, #92400e);
  white-space: nowrap;
}

.city-dropdown-status,
.city-dropdown-empty {
  padding: 0.75rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--pp-text-secondary, #334155);
  text-align: center;
}
</style>
