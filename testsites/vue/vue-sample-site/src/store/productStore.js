import { defineStore } from 'pinia'

export const useProductStore = defineStore('product', {
  state: () => ({
    products: [
      { id: 1, name: 'Widget A', description: 'A great widget.' },
      { id: 2, name: 'Widget B', description: 'An even better widget.' },
    ]
  }),
  getters: {
    getById: (state) => (id) => state.products.find(p => p.id == id),
  }
})