# ADR-0003: Habeas Data — equivalencia con `consentimiento_datos`/`consentimiento_timestamp`

- Fecha: 2026-06-14
- Estado: aceptado
- Contexto: F4.1 — Escenario A y cierre de Comercio (Wompi v1.1)

## Contexto

`IME_F4_Commerce_Pasarelas_v1.1.md` especifica en `pedidos`:

```sql
habeas_data_ok  BOOLEAN NOT NULL DEFAULT false,-- autorización registrada
habeas_data_at  TIMESTAMPTZ,
```

y exige un checkbox obligatorio en checkout y cotización que cite la Ley
1581/2012 y enlace a la política de privacidad.

## Decisión

No se renombran columnas. `pedidos.consentimiento_datos` /
`pedidos.consentimiento_timestamp` y
`solicitudes_cotizacion.consentimiento_datos` /
`solicitudes_cotizacion.consentimiento_timestamp` (`supabase/schema.sql`,
ambas `BOOLEAN NOT NULL DEFAULT false` + `TIMESTAMPTZ`) son funcionalmente
equivalentes a `habeas_data_ok`/`habeas_data_at` — mismo propósito (registrar
que el cliente autorizó el tratamiento de sus datos y cuándo), mismos tipos,
mismas garantías (`NOT NULL DEFAULT false`, nunca implícito).

Se actualizó el texto del checkbox (clave i18n `consentimiento`, usada en
`carrito`, `contacto` y `cotizacion_equipos` — `src/i18n/es.json` /
`src/i18n/en.json`) para citar explícitamente la Ley 1581 de 2012:

> ES: "Acepto el tratamiento de mis datos personales conforme a la Ley 1581 de
> 2012 (Habeas Data) y la política de privacidad."
> EN: "I accept the processing of my personal data in accordance with
> Colombian Law 1581 of 2012 (Habeas Data) and the privacy policy."

En los tres formularios (`Carrito.astro`, `CotizacionDrawer.astro`,
`contacto.astro`/`contact.astro`) este texto va seguido de un enlace a
`/legal/privacidad` (`/legal/privacy` en inglés), que ya cita la Ley 1581 de
2012 en su contenido (`src/lib/legal.ts`, marcado `BLOQUEANTE_LEGAL` pendiente
de revisión de abogado).

## Consecuencias

- No requiere migración SQL.
- El wording del checkbox es una mejora menor de copy, no un cambio legal de
  fondo — sigue bajo el mismo `BLOQUEANTE_LEGAL` que el resto del texto de
  `/legal/privacidad` (revisión final de abogado pendiente, ver
  `PENDIENTES.md`).
