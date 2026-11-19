<template>
  <span class="new-window-indicator"><svg
    class="ext-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  ><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg><span class="sr-only">{{ $t('common.opensInNewWindow') }}</span></span>
</template>

<script setup>
// Indicador padrão para links que abrem em outra janela:
// ícone visível (decorativo) + texto para leitores de tela.
</script>
