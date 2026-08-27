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

/**
 * Routes that render `noindex` or are private/session-specific. Keep these out
 * of the sitemap: a sitemap is a canonical URL inventory, not a route map.
 */
const nonIndexablePaths = new Set([
  '/',
  '/admin/',
  '/comercial/',
  '/congreso/',
  '/mkt/',
  '/es/carrito/',
  '/es/checkout/',
  '/es/cotizacion/',
  '/es/cotizacion/formalizar/',
  '/es/cuenta/',
  '/es/conocimiento/publicar/',
  '/es/seguimiento/',
  '/en/account/',
  '/en/cart/',
  '/en/checkout/',
  '/en/knowledge/publish/',
  '/en/order-status/',
  '/en/quote/',
  '/en/quote/formalize/',
  '/pagoswompi/',
]);

function isIndexableSitemapUrl(page) {
  const { pathname } = new URL(page);
  return !(
    nonIndexablePaths.has(pathname) ||
    /^\/(?:es\/pago|en\/payment)\//.test(pathname) ||
    /^\/(?:es\/productos|en\/products)\/test\/?$/.test(pathname)
  );
}

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
      filter: isIndexableSitemapUrl,
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
