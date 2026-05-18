export default defineNuxtConfig({
  compatibilityDate: '2026-05-18',
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css'
  },
  devtools: { enabled: false },
  runtimeConfig: {
    allowPrivateCapture: process.env.ALLOW_PRIVATE_CAPTURE === 'true',
    allowFileCapture: process.env.ALLOW_FILE_CAPTURE === undefined
      ? process.env.NODE_ENV !== 'production'
      : process.env.ALLOW_FILE_CAPTURE === 'true'
  },
  typescript: {
    strict: true
  }
})
