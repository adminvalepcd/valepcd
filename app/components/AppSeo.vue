<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: false,
    default: '/images/logo-vale-pcd-seo.webp' // Premium fallback default image
  },
  type: {
    type: String,
    required: false,
    default: 'website'
  },
  url: {
    type: String,
    required: false,
    default: ''
  }
})

const route = useRoute()

// Resolve absolute URLs for crawlers (e.g. WhatsApp, Facebook, LinkedIn)
const absoluteImageUrl = computed(() => {
  const img = props.image
  if (img && img.startsWith('/')) {
    return `https://www.valepcd.com.br${img}`
  }
  return img
})

const absolutePageUrl = computed(() => {
  return props.url || `https://www.valepcd.com.br${route.path}`
})

useSeoMeta({
  title: () => props.title,
  ogTitle: () => props.title,
  description: () => props.description,
  ogDescription: () => props.description,
  ogImage: () => absoluteImageUrl.value,
  ogType: () => props.type,
  ogUrl: () => absolutePageUrl.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => props.title,
  twitterDescription: () => props.description,
  twitterImage: () => absoluteImageUrl.value
})
</script>

<template>
  <span style="display: none;" aria-hidden="true"></span>
</template>
