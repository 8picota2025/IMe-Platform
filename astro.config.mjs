// @ts-check
import { writeFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import sentry from '@sentry/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const sentryDsn = process.env.PUBLIC_SENTRY_DSN;
const sentryEnabled = Boolean(sentryDsn);
const searchConsoleHtmlFile = (process.env.PUBLIC_SEARCH_CONSOLE_FILE ?? '').trim();

/** Optional GSC HTML-file verification: PUBLIC_SEARCH_CONSOLE_FILE=googleXXXX.html */
function searchConsoleHtmlFileIntegration() {
  return {
    name: 'search-console-html-file',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        if (!/^google[a-z0-9]+\.html$/i.test(searchConsoleHtmlFile)) return;
        const target = new URL(searchConsoleHtmlFile, dir);
        await writeFile(target, `google-site-verification: ${searchConsoleHtmlFile}\n`);
        logger.info(`Search Console HTML file written: ${searchConsoleHtmlFile}`);
      },
    },
  };
}

// astro dev con i18n.prefixDefaultLocale devuelve 404 en rutas raiz sin locale
// (/admin/, /comercial/). En produccion el host sirve el estatico y funcionan.
const i18nDisabled = process.env.ASTRO_NO_I18N === '1';

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
    searchConsoleHtmlFileIntegration(),
    sitemap({
      filter: page => {
        const url = new URL(page);
        return !(
          url.pathname === '/' ||
          url.pathname === '/admin/' ||
          url.pathname === '/comercial/' ||
          url.pathname === '/es/carrito/' ||
          url.pathname === '/es/checkout/' ||
          url.pathname === '/es/cuenta/' ||
          url.pathname === '/en/cart/' ||
          url.pathname === '/en/checkout/' ||
          url.pathname === '/en/account/' ||
          url.pathname === '/en/knowledge/publish/' ||
          url.pathname === '/en/order-status/' ||
          url.pathname === '/en/products/test/' ||
          url.pathname === '/es/seguimiento/' ||
          url.pathname === '/es/productos/test/' ||
          url.pathname === '/pagoswompi/' ||
          /^\/(es\/pago|en\/payment)\//.test(url.pathname)
        );
      },
    }),
  ],
  vite: {
    build: {
      chunkSizeWarningLimit: 2000,
    },
    plugins: [tailwindcss()],
  },
  ...(i18nDisabled
    ? {}
    : {
        i18n: {
          defaultLocale: 'es',
          locales: ['es', 'en'],
          routing: {
            prefixDefaultLocale: true,
          },
        },
      }),
  server: {
    port: 44334,
    host: '0.0.0.0',
  },
  devToolbar: {
    enabled: false,
  },
});
