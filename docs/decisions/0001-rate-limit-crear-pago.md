# ADR-0001: Rate limit dedicado para `crear-pago`

- Fecha: 2026-06-14
- Estado: aceptado
- Contexto: F4.1 — Escenario A y cierre de Comercio (Wompi v1.1)

## Contexto

`IME_F4_Commerce_Pasarelas_v1.1.md` pide un límite de 10 solicitudes por hora por
IP para `crear-pago`, en una tabla `rate_limits` dedicada. La implementación
existente (F4) ya usaba `checkRateLimit()` contra la tabla `asesor_rate_limit`
para el Asesor, y `crear-pago` reutilizaba la misma función con los mismos
umbrales (`ASESOR_RATE_LIMIT_*`: 60s / 8 por ventana / 60 por día) — demasiado
permisivo para pagos y demasiado estricto para el Asesor si se hubiesen
unificado en sentido contrario.

## Decisión

No se crea una tabla `rate_limits` nueva. Se generaliza
`supabase/functions/_shared/rate-limit.ts`:

- `checkRateLimit(supabase, identificador, accion)` recibe un tercer parámetro
  `accion: 'asesor' | 'crear-pago'` (default `'asesor'` para no romper llamadas
  existentes).
- Los umbrales (`windowSeconds`, `maxPerWindow`, `maxPerDay`) se resuelven desde
  un mapa `THRESHOLDS` indexado por `accion`, cada uno con sus propias env vars:
  - `asesor`: `ASESOR_RATE_LIMIT_VENTANA_SEGUNDOS` (60) / `ASESOR_RATE_LIMIT_MAX_VENTANA` (8)
    / `ASESOR_RATE_LIMIT_MAX_DIA` (60) — sin cambios respecto a F4.
  - `crear-pago`: `CREAR_PAGO_RATE_LIMIT_VENTANA_SEGUNDOS` (3600) /
    `CREAR_PAGO_RATE_LIMIT_MAX_VENTANA` (10) / `CREAR_PAGO_RATE_LIMIT_MAX_DIA` (30)
    — cumple el "10/hora por IP" de v1.1.
- La tabla `asesor_rate_limit` sigue siendo única para ambas acciones; el
  `identificador` (`pago:ip:<ip>` para pagos vs. el prefijo usado por el Asesor)
  ya evita que los contadores se mezclen entre acciones.
- `crear-pago/index.ts` pasa `'crear-pago'` como tercer argumento.

## Alternativas consideradas

- **Tabla `rate_limits` nueva** (como sugiere v1.1 literalmente): descartada. El
  esquema de `asesor_rate_limit` (identificador único + ventana + contador diario)
  ya es genérico por acción; crear una segunda tabla solo duplicaría lógica y
  requeriría una migración sin beneficio funcional.
- **Renombrar `asesor_rate_limit`**: descartado por ahora — el nombre es
  ligeramente impreciso pero el coste de renombrar (migración + referencias) no
  se justifica solo por nomenclatura. Si en el futuro se añaden más acciones,
  reconsiderar un nombre más genérico (ej. `rate_limits`).

## Consecuencias

- No requiere migración SQL.
- Nuevas variables de entorno opcionales (`CREAR_PAGO_RATE_LIMIT_*`) con defaults
  que ya cumplen v1.1 sin configuración adicional.
- Las llamadas existentes a `checkRateLimit(supabase, identificador)` desde el
  Asesor siguen funcionando sin cambios (default `accion='asesor'`).
