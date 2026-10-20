# Presupuesto IVA/descuento — herramienta local

**No está en producción.** Se usa solo en este worktree, puerto fijo **44339**.
ADR: `docs/decisions/0019-presupuesto-iva-descuento-bancos.md`.
Rama: `feature/presupuesto-iva-descuento-bancos`.

## Cómo usarlo para armar un presupuesto

```bash
cd /home/shoky/cursor/ime-platform-presupuesto-iva
npm run presupuesto:local
```

Si ya corre y `/comercial/` responde 200, el script lo reusa. Si el puerto
está ocupado pero roto, lo reinicia. Arranca con `ASTRO_NO_I18N=1` para que
`/comercial/` y `/admin/` existan en `astro dev` (sin eso, i18n las 404).

- Comercial: http://127.0.0.1:44339/comercial/
- Admin: http://127.0.0.1:44339/admin/
- Estado: `npm run presupuesto:status`
- Reinicio: `npm run presupuesto:restart`

Entras con tu usuario comercial o admin (mismo Supabase que el resto).
Armas la cotización (bruto / % / neto, IVA unitario, banco, 50/50 en nuevas).
**Vista previa** genera el PDF con el renderer de esta rama (columnas bruto, %, neto, IVA y **Total IVA:**).

No pulses «Enviar email» desde i-me.com.co si necesitas este formato: el Edge de producción sigue con el PDF viejo. Descarga la vista previa local y envíala a mano, o envía solo desde este sandbox si aceptas que el correo dispare la función remota.

Guardar el borrador sí escribe en `solicitudes_cotizacion` (JSONB extra; el PDF de producción lo ignora).

## Recuperar el código

```bash
git fetch origin
git checkout feature/presupuesto-iva-descuento-bancos
```

Worktree: `/home/shoky/cursor/ime-platform-presupuesto-iva`.

## Qué incluye

| Pieza | Dónde |
|---|---|
| Cálculo IVA / descuento directo e inverso | `src/lib/cotizacion-iva.ts` |
| Parse/sanitizar líneas | `src/lib/cotizacion-oferta.ts` |
| Bancos y 50/50 solo en nuevas | `src/lib/cotizacion-recaudo.ts` |
| Editores | `src/comercial/quote-view.ts`, `src/admin/admin-app.ts` |
| PDF local + espejo Edge | `src/lib/render-quote-pdf.ts` |
| Arranque del sandbox | `scripts/presupuesto-local.sh` |

## Verificar

```bash
npx vitest run \
  src/lib/cotizacion-iva.test.ts \
  src/lib/cotizacion-oferta.test.ts \
  src/lib/cotizacion-recaudo.test.ts \
  src/lib/render-quote-pdf.test.ts \
  src/comercial/quote-api.test.ts \
  src/lib/quote-product-ingest.test.ts
```

## Poner en producción (solo si se decide)

1. Rebase de `origin/main` en la rama.
2. Tests de arriba.
3. PR a `main`. PDF cliente y Edge juntos.
4. `npx supabase functions deploy enviar-cotizacion`.
