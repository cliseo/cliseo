<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-4">Products</h1>
    <ul>
      <li v-for="product in products" :key="product.id" class="mb-2">
        <router-link :to="'/products/' + product.id" class="text-blue-600 hover:underline">
          {{ product.name }}
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useProductStore } from '../store/productStore'
const store = useProductStore()
const products = store.products
</script>