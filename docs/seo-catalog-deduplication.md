# SEO — deduplicación de catálogo

Runbook para productos publicados **dos veces** bajo slugs distintos (mismo SKU o misma landing). Afecta canonical, sitemap y señales duplicadas en buscadores.

Auditoría origen: 2026-09-17 (PR #99 / commit `5d345d2`).

## Síntoma

- Dos URLs de producto renderizan la misma ficha (o una redirige a la otra con hop extra).
- Sitemap incluye ambas rutas → competencia interna de canonical.
- Agentes/crawlers ven duplicados en el índice estático (`catalogo-index.*.json`).

## Casos resueltos en código (2026-09-17)

| Duplicado | Conservar (canónico) | Retirar (redirect 301) |
| --------- | -------------------- | ---------------------- |
| Combo tirillas GMD vs G SKU | `g-ltd-b10-100`, `g-ltd-b10-200` | slugs UUID-suffixed GMD |
| Sistema radiográfico WR-3D | `sistema-radiografico-3d-wr-3d-angell-technology` | `sistema-radiografico-3d-wr-3d` |

### Cambios en repo

- **`public/.htaccess`:** 301 de slugs retirados → canónicos (ES + EN).
- **`scripts/sitemap-indexability.mjs`:** `REDIRECT_ONLY_PRODUCT_PATHS` excluye fuentes de redirect del sitemap.
- **Trust anchors:** `/about/`, `/contact/`, `/privacy/` siguen respondiendo 200 para agentes (`public/llms.txt`) pero canonicalizan a `/en/about/`, etc., y **no** entran al sitemap.

Impacto sitemap: ~1628 → ~1619 URLs (redirect sources excluidas).

## Retiro en Supabase (pendiente ops)

Los registros duplicados **siguen en BD** hasta ejecutar el script revisado:

`supabase/retirar-duplicados-catalogo.sql`

### Por qué `activo = false` y no DELETE

Siete tablas referencian `productos(id)` con `ON DELETE CASCADE` (reservas, auditoría, ítems de pedido, etc.). Borrar la fila arrastraría historial comercial.

`activo = false`:

- Excluye el producto del build (`src/lib/datos.ts` filtra por `activo`).
- Es reversible (`activo = true`).
- Las URLs legacy siguen resolviendo vía 301 en `.htaccess`.

### Procedimiento

1. Backup o snapshot Supabase.
2. Ejecutar el `SELECT` de revisión del script (paso 1).
3. Confirmar que los slugs canónicos siguen `activo = true`.
4. Ejecutar el `UPDATE` (paso 2) — debe afectar **3 filas**.
5. `npm run build` local; verificar que slugs retirados no aparecen en `dist/`.
6. Deploy estático.
7. Smoke: `curl -I` a URL retirada → 301 al canónico; sitemap sin la fuente.

### Revertir

```sql
UPDATE productos SET activo = true
WHERE slug IN (
  'combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-75e09b13-8a2a-48',
  'combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-ee958bf4-f926-4d',
  'sistema-radiografico-3d-wr-3d'
);
```

## Detectar nuevos duplicados

1. Buscar slugs con mismo `sku` o landings idénticas en admin/CMS.
2. Comparar `catalogo-index.es.json` por `nombre_es` normalizado o URLs cruzadas.
3. Revisar Search Console → Cobertura / Duplicados (cuando haya datos).
4. Añadir fuentes redirect a `REDIRECT_ONLY_PRODUCT_PATHS` **antes** del deploy que introduce el 301.

## Checklist post-fix

- [ ] 301 ES + EN en `.htaccess`
- [ ] Slug fuente en `REDIRECT_ONLY_PRODUCT_PATHS`
- [ ] Registro BD retirado (`activo = false`) o merge planificado
- [ ] `npm run validate:seo` pasa
- [ ] Sitemap rebuild sin URL fuente

## Referencias

- `docs/SEO_CRAWL_AUDIT.md` — auditoría crawl general
- `docs/SEO_VALIDACION.md` — pipeline `validate:seo`
- `scripts/sitemap-indexability.mjs` — política de indexabilidad
