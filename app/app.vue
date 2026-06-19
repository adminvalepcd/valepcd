<script setup>
const head = useLocaleHead({
  addDirAttribute: true,
  identifierAttribute: 'id',
  addSeoAttributes: true
})

useHead({
  htmlAttrs: {
    lang: () => head.value.htmlAttrs?.lang || 'pt-BR',
    dir: () => head.value.htmlAttrs?.dir || 'ltr'
  },
  link: () => [
    ...(head.value.link || [])
  ],
  meta: () => [
    ...(head.value.meta || [])
  ]
})
</script>

<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>

