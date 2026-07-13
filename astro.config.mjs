// @ts-check
import { defineConfig } from 'astro/config'
import sentry from '@sentry/astro'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

const sentryDsn = process.env.PUBLIC_SENTRY_DSN
const sentryEnabled = Boolean(sentryDsn)

export default defineConfig({
  site: 'https://i-me.com.co',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    sentry({
      enabled: {
        client: sentryEnabled,
        server: false,
      },
      autoInstrumentation: {
        requestHandler: false,
      },
    }),
    sitemap({
      filter: (page) => {
        const url = new URL(page)
        return !(
          url.pathname === '/admin/' ||
          url.pathname === '/es/carrito/' ||
          url.pathname === '/es/checkout/' ||
          url.pathname === '/es/cuenta/' ||
          url.pathname === '/en/cart/' ||
          url.pathname === '/en/checkout/' ||
          url.pathname === '/en/account/' ||
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
