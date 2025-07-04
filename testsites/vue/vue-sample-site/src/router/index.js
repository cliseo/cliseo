import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'
import About from '../pages/About.vue'
import Products from '../pages/Products.vue'
import ProductDetail from '../pages/ProductDetail.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/about', component: About },
  { path: '/products', component: Products },
  { path: '/products/:id', component: ProductDetail, props: true },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})