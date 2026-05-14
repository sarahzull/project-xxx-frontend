import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'
import FloatingVue from 'floating-vue'
import 'floating-vue/dist/style.css'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(VueApexCharts)
app.use(FloatingVue, {
  themes: {
    'base-tooltip': {
      $extend: 'tooltip',
      triggers: ['hover', 'touch'],
      delay: { show: 100, hide: 100 },
    },
  },
})
app.mount('#app')
