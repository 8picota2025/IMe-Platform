# Cobertura de pruebas

## Ejecutado

- `npm test -- --run`: 32 archivos, 245 tests, todos pasan.
- `npm run lint`: pasa con `--max-warnings 0`.
- `npm run check`: 0 errores, 6 hints.
- `npm run build`: pasa; genera 1.642 HTML.
- `npm run audit:seo-build`: pasa.

## Gaps

Auth y pagos constan como probados por confirmación del usuario. No hay evidencia
adjunta de E2E productivo completo, cobertura RBAC, webhooks, restore, crawl,
responsive, accesibilidad axe, carga o caos.

Pirámide: unit/lógica > integración Edge/Supabase local > contract API > Playwright
smoke preprod > canary comercial limitado.
