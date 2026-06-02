<script setup>
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
    default: 'https://static.wixstatic.com/media/acd625_9e14ee4333ac4944b72c0ada48128725~mv2.jpg' // Premium fallback default image
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

useSeoMeta({
  title: () => props.title,
  ogTitle: () => props.title,
  description: () => props.description,
  ogDescription: () => props.description,
  ogImage: () => props.image,
  ogType: () => props.type,
  ogUrl: () => props.url || undefined,
  twitterCard: 'summary_large_image',
  twitterTitle: () => props.title,
  twitterDescription: () => props.description,
  twitterImage: () => props.image
})
</script>

<template>
  <!-- Renderless SEO meta-tag manager -->
</template>
