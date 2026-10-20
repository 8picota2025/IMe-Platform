# Presupuesto IVA/descuento — herramienta local

**No está en producción.** Worktree + puerto **44339** en localhost, publicado
solo por Tailscale. ADR: `docs/decisions/0019-presupuesto-iva-descuento-bancos.md`.
Rama: `feature/presupuesto-iva-descuento-bancos`.

## Cómo usarlo para armar un presupuesto

Desde cualquier equipo de la VPN (laptop, móvil):

- Comercial: https://server-main.tail05fdf1.ts.net:44339/comercial/
- Admin: https://server-main.tail05fdf1.ts.net:44339/admin/

En el servidor:

```bash
cd /home/shoky/cursor/ime-platform-presupuesto-iva
npm run presupuesto:status
npm run presupuesto:restart
```

Astro escucha solo `127.0.0.1:44339`. Tailscale Serve lo publica en el
tailnet (`--https 44339`). La IP pública `2.25.149.6` no lo sirve.

Persistencia: `ime-presupuesto-iva.service` (systemd --user, linger ya
activo). Tras un reboot arranca solo.

```bash
npm run presupuesto:install   # primera vez o si se mueve el unit
systemctl --user status ime-presupuesto-iva
```

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
| Persistencia + VPN | `scripts/ime-presupuesto-iva.service` |

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
