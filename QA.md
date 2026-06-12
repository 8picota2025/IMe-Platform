# QA F5

Estados: Pass, Fail, Bloqueado, NO_EJECUTADO_ENTORNO.

## Rutas

- `/` -> `/es/`: NO_EJECUTADO_ENTORNO, validar en navegador/build.
- `/es/` y `/en/`: NO_EJECUTADO_ENTORNO.
- Catálogo ES/EN: NO_EJECUTADO_ENTORNO.
- Servicios: NO_EJECUTADO_ENTORNO.
- Contacto: NO_EJECUTADO_ENTORNO.
- Financiación: NO_EJECUTADO_ENTORNO.
- Conocimiento stub: NO_EJECUTADO_ENTORNO.
- Landings producto: NO_EJECUTADO_ENTORNO.
- Admin: NO_EJECUTADO_ENTORNO contra Supabase real.
- Legales: Pass implementación de rutas ES/EN; revisión legal bloqueada.
- Pago resultado: NO_EJECUTADO_ENTORNO contra pedidos reales.

## Catálogo

- Jerarquía, mostrar todos, filtros, buscador, URL sync, paginación, tipos ausentes General: NO_EJECUTADO_ENTORNO en navegador.

## Landings

- Hero, galería, specs, comparador, CTA por tipo comercial, PDF, relacionados, breadcrumbs: NO_EJECUTADO_ENTORNO.

## Admin

- Login, guard, CRUD, ingesta PDF, revisión obligatoria, publicar -> embeddings -> rebuild, CSV: NO_EJECUTADO_ENTORNO por falta de Supabase/secretos.

## Asesor

- Recuperación real, producto citado existe, guardarraíl clínico, precio/financiación derivan, anti-bot, rate-limit, presupuesto agotado, keyword fallback: NO_EJECUTADO_ENTORNO por falta de funciones desplegadas y credenciales.

## Comercio

- Carrito: NO_EJECUTADO_ENTORNO en navegador.
- Wompi sandbox CO: Bloqueado por credenciales.
- Stripe test INTL: Bloqueado por credenciales.
- Webhooks: Bloqueado por endpoints/secretos reales.
- Idempotencia: NO_EJECUTADO_ENTORNO contra Supabase.
- Pedidos admin: NO_EJECUTADO_ENTORNO.
- Equipo cotización: NO_EJECUTADO_ENTORNO contra Supabase; mock local no prueba persistencia.

## i18n

- Selector mantiene ruta equivalente: NO_EJECUTADO_ENTORNO.
- `hreflang` recíproco: pendiente validar en `dist`.
- EN con pendientes marcados internamente: Pass parcial, existen `COPY_CLIENTE_REVISAR` en contenido EN.
