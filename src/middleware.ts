import { defineMiddleware } from 'astro:middleware';

/**
 * Con `i18n.routing.prefixDefaultLocale: true`, Astro marca como 404 las
 * rutas fuera de /es|/en (p. ej. /comercial/, /admin/) aunque existan.
 * Reescribimos el status a 200 para no ensuciar Network/console.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const path = context.url.pathname;
  const isAppShell =
    path === '/comercial' ||
    path.startsWith('/comercial/') ||
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/mkt' ||
    path.startsWith('/mkt/') ||
    path === '/comercial-diag' ||
    path.startsWith('/comercial-diag/') ||
    path === '/clear-sw' ||
    path.startsWith('/clear-sw/');

  if (!isAppShell || response.status !== 404) return response;

  return new Response(response.body, {
    status: 200,
    statusText: 'OK',
    headers: response.headers,
  });
});
