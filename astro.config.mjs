// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

// Support for preprod subdirectory deployment
const BASE = process.env.ASTRO_BASE || '/'
const SITE = process.env.ASTRO_SITE || 'https://i-me.com.co'

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => {
        const url = new URL(page)
        return !(
          url.pathname === '/admin/' ||
          /^\/(es\/pago|en\/payment)\//.test(url.pathname)
        )
      },
    }),
  ],
  vite: {
    build: {
      chunkSizeWarningLimit: 2000,
    },
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  server: {
    port: 44334,
    host: '0.0.0.0',
  },
  devToolbar: {
    enabled: false,
  },
})
