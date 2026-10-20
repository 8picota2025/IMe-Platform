# Presupuesto: IVA, descuento y bancos — standby

**No está en producción.** El trabajo vive en la rama
`feature/presupuesto-iva-descuento-bancos`. ADR: `docs/decisions/0019-presupuesto-iva-descuento-bancos.md`.

## Recuperar

```bash
git fetch origin
git checkout feature/presupuesto-iva-descuento-bancos
```

Worktree local (si sigue existiendo): `/home/shoky/cursor/ime-platform-presupuesto-iva`.

## Qué incluye

| Pieza | Dónde |
|---|---|
| Cálculo IVA / descuento directo e inverso | `src/lib/cotizacion-iva.ts` |
| Parse/sanitizar líneas (no inventar IVA en viejas) | `src/lib/cotizacion-oferta.ts` |
| Bancos y condición 50/50 solo en nuevas | `src/lib/cotizacion-recaudo.ts` (`CONDICION_PAGO_DEFAULT_NUEVA`) |
| Editor `/comercial` | `src/comercial/quote-view.ts` |
| Editor `/admin` | `src/admin/admin-app.ts` |
| PDF + espejo Edge | `src/lib/render-quote-pdf.ts`, `supabase/functions/_shared/render-quote-pdf.ts` |
| Ingesta catálogo → línea | `src/lib/quote-product-ingest.ts` |

Comportamiento:

- Bruto editado → neto = bruto × (1 − %).
- Neto editado → bruto = neto ÷ (1 − %).
- IVA unitario se calcula al marcar 19/5 o al cambiar el neto. Un IVA digitado a mano se respeta.
- Sumatorio: Total bruto, Subtotal neto, **Total IVA:**, Total a pagar.
- Cotización nueva: condición 50/50. Antigua: lo guardado o Contado.

## Verificar antes de marchar

```bash
npx vitest run \
  src/lib/cotizacion-iva.test.ts \
  src/lib/cotizacion-oferta.test.ts \
  src/lib/cotizacion-recaudo.test.ts \
  src/lib/render-quote-pdf.test.ts \
  src/comercial/quote-api.test.ts \
  src/lib/quote-product-ingest.test.ts
```

Sandbox: `npx astro dev --host 0.0.0.0 --port 44335` y abrir `/comercial/` y `/admin/` (el 44334 suele estar ocupado).

## Poner en marcha (solo si se decide)

1. Rebase o merge de `origin/main` en la rama de feature.
2. Repetir los tests de arriba.
3. PR a `main`. No mergear sin revisión: el PDF Edge y el cliente deben ir juntos.
4. Tras merge, desplegar `enviar-cotizacion` si el espejo PDF cambió:
   `npx supabase functions deploy enviar-cotizacion`.
5. No hay migración SQL: los campos nuevos van en el JSONB `productos`.
