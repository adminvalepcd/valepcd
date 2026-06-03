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
    default: '/images/logo-vale-pcd-seo.png' // Premium fallback default image
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
  <span style="display: none;" aria-hidden="true"></span>
</template>
