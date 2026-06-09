// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
// Tailwind se configura en F1 con @tailwindcss/vite (Tailwind 4 + Astro 6)

export default defineConfig({
  site: 'https://i-me.com.co',
  output: 'static',
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  server: {
    port: 43421,
    host: '0.0.0.0',
  },
})
