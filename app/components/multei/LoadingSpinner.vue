<template>
  <div :class="['spinner-container', customClass]">
    <div class="spinner-circle"></div>
    <span class="sr-only">Carregando...</span>
  </div>
</template>

<script setup>
defineProps({
  customClass: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
.spinner-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.spinner-circle {
  width: 2.5rem;
  height: 2.5rem;
  border: 4px solid var(--border, rgba(0, 0, 0, 0.1));
  border-top-color: var(--primary, #86007D);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
</style>
