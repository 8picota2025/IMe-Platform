// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://i-me.com.co',
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
