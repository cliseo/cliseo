<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">{{ product?.name }}</h1>
    <p class="mt-2">{{ product?.description }}</p>
    <router-link to="/products" class="text-blue-600 hover:underline mt-4 block">← Back to products</router-link>
  </div>
</template>

<script setup>
import { useProductStore } from '../store/productStore'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const store = useProductStore()
const route = useRoute()
const product = computed(() => store.getById(route.params.id))
</script>