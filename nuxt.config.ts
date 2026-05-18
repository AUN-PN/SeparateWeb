export default defineNuxtConfig({
  compatibilityDate: '2026-05-18',
  modules: ["nitro-cloudflare-dev"],
  css: ['~/assets/css/main.css'],

  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css'
  },

  devtools: { enabled: false },

  runtimeConfig: {
    allowPrivateCapture: process.env.ALLOW_PRIVATE_CAPTURE === 'true',
    allowFileCapture: process.env.ALLOW_FILE_CAPTURE === undefined
      ? process.env.NODE_ENV !== 'production'
      : process.env.ALLOW_FILE_CAPTURE === 'true',
    extractServiceUrl: process.env.EXTRACT_SERVICE_URL || '',
    extractServiceToken: process.env.EXTRACT_SERVICE_TOKEN || ''
  },

  typescript: {
    strict: true
  },

  nitro: {
    preset: process.env.NITRO_PRESET || 'cloudflare_module',

    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    }
  }
})
