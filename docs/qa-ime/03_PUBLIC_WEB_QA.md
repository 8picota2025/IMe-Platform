# QA web pública

## Evidencia ejecutada

- Navegador: `https://i-me.com.co/` respondió y redirigió a `/es/`.
- Home observada con H1, CTA catálogo, CTA WhatsApp y navegación por categorías.
- Catálogo público observado: 708 equipos, 19 categorías, búsqueda, filtros,
  comparación y cotización visibles.
- Aperturas directas de varias rutas profundas desde browser no fueron estables;
  quedan como `REQUIERE VERIFICACIÓN` por crawl con navegador/E2E.
- `dist`: 1.642 HTML después de build; auditoría SEO OK.

## Pendiente seguro

Crawl completo por sitemap, status sin seguir redirects, enlaces externos, JS
runtime, responsive, teclado y formularios. No enviar formularios reales.

| Área                      | Estado                                            | Severidad |
| ------------------------- | ------------------------------------------------- | --------- |
| Redirección raíz a locale | Confirmado operativo en browser                   | LOW       |
| Crawl 1.642 URLs          | Build confirma generación; HTTP externo pendiente | MEDIUM    |
| 404/500 reales            | Requiere verificación                             | HIGH      |
| Formularios productivos   | No ejecutado                                      | HIGH      |
