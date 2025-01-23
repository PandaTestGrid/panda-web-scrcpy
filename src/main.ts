import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import vuetify from './plugins/vuetify'

// 创建应用实例
const app = createApp(App)

// 创建 pinia 实例
const pinia = createPinia()

// 按顺序使用插件
app.use(pinia)
app.use(vuetify)

// 确保所有插件都注册完成后再挂载
app.mount('#app') 