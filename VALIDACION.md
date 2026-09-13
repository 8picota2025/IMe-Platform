# VALIDACION.md — F4.2

- **Fecha:** 2026-09-13
- **Commit base:** `ef7022c` (main) + cambios locales en `feature/ventas-automaticas` (sin commit aún)
- **Entorno:** local `/home/shoky/cursor/ime-platform`
- **Producción referenciada:** https://i-me.com.co (no se modificó en esta sesión)

## Comandos ejecutados

```bash
git status / branch / log -20
npm run test -- src/lib/commerce-policy.test.ts \
  src/lib/comercial.test.ts \
  src/lib/stock-availability.test.ts \
  src/lib/merchant-feed.test.ts
npx eslint src/lib/commerce-policy.ts src/lib/comercial.ts \
  src/lib/stock-availability.ts src/lib/merchant-feed.ts \
  src/admin/admin-app.ts --max-warnings 0
```

## Resultados

| Check                                            | Resultado                                                 |
| ------------------------------------------------ | --------------------------------------------------------- |
| Unit tests F4.2 (27)                             | PASS                                                      |
| ESLint archivos tocados                          | PASS                                                      |
| `npm run validate` completo                      | NO ejecutado (build estático pesado); pendiente pre-merge |
| Migración aplicada en BD prod                    | NO — ops                                                  |
| Concurrencia real Postgres (2 checkouts stock=1) | NO — requiere migración + entorno                         |
| Webhook replay en staging                        | NO — no se usaron secretos                                |
| Feed live URL                                    | NO desplegado aún                                         |

## Evidencia tests

- `isPurchasable` / umbral $6M no usado / stock insuficiente / Merchant eligibility
- Simulación concurrencia `simularReservaConcurrente(1,[1,1]) → [true,false]`
- XML Merchant: escape, sin INVIMA global, sin brand I-ME inventado

## Secretos

- No se leyeron ni imprimieron `SERVICE_ROLE` / Wompi / Stripe.
- No hay secretos en docs ni en feed generator response.

## Ejemplo feed (sanitizado)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>I-ME</title>
...
<item>
<g:id>uuid-1</g:id>
<g:title>Sensor de flujo</g:title>
<g:price>119000 COP</g:price>
<g:availability>in_stock</g:availability>
<g:brand>SLE</g:brand>
</item>
</channel>
</rss>
```

## BLOCKED_HUMAN_REVIEW

1. Aplicar migración en Supabase producción
2. Deploy `generar-feed-google` + rewrite opcional `/feed-google.xml`
3. Alta / políticas Google Merchant Center + mapping categorías
4. Política INVIMA por producto (no crear columna a ciegas)
5. Bundles kits + margen
6. Activar cupón COMPRAHOY (margen/%)
7. Claims logísticos verificables
8. Consentimiento marketing canal WhatsApp (solo email gated vía `clientes.consentimiento_datos` por ahora)
9. Prueba concurrencia/RPC en BD real
10. `npm run validate` + canary checkout prod

## Criterios de aceptación (estado)

- [x] Política única comprabilidad/disponibilidad/Merchant (código + tests)
- [x] Una fuente feed (Edge), no dual Astro+Edge
- [x] Diseño reservas + idempotencia pagos existente reutilizada
- [x] Admin compra-directa + auditoría (tabla; requiere migración)
- [x] Abandono no envía sin consentimiento cliente
- [ ] Migración en prod
- [ ] Concurrencia real demostrada en BD
- [ ] Feed en URL pública + GMC
- [ ] Bundles / COMPRAHOY
- [ ] `npm run validate` verde en CI de la rama
