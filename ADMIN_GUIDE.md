# ADMIN GUIDE — I-ME

## Acceso

1. Crear proyecto Supabase y aplicar `supabase/schema.sql`.
2. Configurar `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` en el entorno del sitio.
3. Crear manualmente el usuario admin en Supabase Auth. No existe registro publico.
4. Entrar a `/admin` e iniciar sesion con email y contrasena.

## Taxonomia

- Crear primero familias, luego tipos asociados a una familia.
- No eliminar familias o tipos que tengan productos sin revisar reasignacion.
- Desactivar una familia o tipo la oculta del catalogo publico por RLS.
- La tabla de tipos muestra cuantos productos tiene cada uno.
- "Productos sin tipo asignado" lista cada producto sin `tipo_id` con un formulario
  para asignarle familia y tipo (o dejarlo "Sin asignar" si aun no corresponde).

## Productos

- La lista permite buscar por nombre/slug, filtrar por familia, tipo, estado
  (activo/inactivo) y tipo comercial, y se pagina de 20 en 20. Cada fila
  muestra una miniatura de `imagen_principal`.
- `Guardar borrador` crea o actualiza el producto.
- `activo=false` mantiene el producto fuera del sitio publico.
- `activo=true` lo deja listo para el siguiente rebuild estatico.
- `precio` es el unico precio publico en COP. `precio_costo` vive solo en proveedor_producto y nunca debe exponerse al cliente.
- Para consumibles con compra futura, el precio real debe estar aprobado antes de activar checkout.

## Uploads

- Imagenes van al bucket `productos`.
- Fichas tecnicas PDF van al bucket `fichas`.
- Los buckets se crean desde `schema.sql`. Si faltan permisos, revisar Storage RLS en Supabase.

## Ingesta PDF

1. Subir o pegar la URL de la ficha PDF.
2. Pegar texto extraido del PDF cuando el documento no pueda enviarse como texto.
3. Ejecutar ingesta.
4. Revisar el borrador campo a campo: cada campo muestra su origen (PDF, ausente,
   manual), su confianza y un check "Revisado" obligatorio cuando el campo esta
   marcado para revision. El formulario no se puede enviar hasta marcar todos
   los checks requeridos.
5. Especificaciones y aplicaciones se editan como filas repetibles (agregar/quitar)
   con su propio check de revision.
6. La traduccion EN es siempre borrador: requiere un check unico "Traduccion EN
   revisada" antes de poder crear el producto.
7. Asignar familia/tipo sugeridos (o dejar "Sin asignar" si no corresponde).
8. Al enviar, el producto se crea siempre con `activo=false`.
9. Activar el producto solo despues de revision humana completa, desde la vista
   Productos.

La IA no publica, no autoguarda y no debe completar datos ausentes.

## Publicar Cambios

- El boton `Publicar cambios` llama a `trigger-rebuild`.
- La Edge Function usa `CI_DEPLOY_HOOK` o `GITHUB_TOKEN` server-side.
- El secreto nunca se devuelve al cliente.
- Si no hay credenciales de CI, queda como `NO_EJECUTADO_ENTORNO`.

## Proveedores y productos asignados

- Cada proveedor muestra cuantos productos tiene asignados y un boton "Productos"
  que abre la vista de asignacion.
- En esa vista se listan los productos ya asignados (con `precio_costo`, moneda,
  prioridad y estado) y un formulario para asignar un producto nuevo del catalogo
  (solo se ofrecen productos aun no asignados a ese proveedor).
- `precio_costo` es **CONFIDENCIAL**: solo visible en este panel admin, nunca en
  el sitio publico ni en `dist/`.
- `prioridad` (1 = preferente) define el orden de preferencia entre proveedores
  para un mismo producto.
- "Quitar" elimina la asignacion proveedor-producto (no afecta al producto ni al
  proveedor).

## Fulfillments

- Un panel de estadisticas muestra el total de fulfillments pendientes,
  notificados, enviados, entregados y con error.
- La lista se puede filtrar por estado, proveedor y rango de fechas (creado
  entre "Desde" y "Hasta").
- Cada fila muestra el pedido asociado, el cliente, el proveedor (si tiene), la
  fecha de creacion y, si existe, el detalle de error.
- `Estado`, `Numero de tracking`, `URL de tracking` y `Notas` se editan inline y
  se guardan con el boton "Guardar" de cada fila.
- "Reenviar notificacion al proveedor" llama a la Edge Function
  `notificar-proveedor`. La logica real (envio por email/WhatsApp/webhook segun
  el canal del proveedor) se implementa en F4; hasta entonces la funcion
  responde con `BLOQUEANTE_BACKEND` y el admin lo muestra como aviso.

## Cotizaciones y Pedidos

- Cotizaciones y pedidos se listan en orden cronologico inverso, con un boton
  "Ver" que abre el detalle de cada registro.
- Se pueden marcar como leidos desde la lista o desde el detalle.
- El boton CSV descarga los datos visibles para revision comercial.
- Detalle de cotizacion: datos de contacto, productos solicitados (JSON),
  mensaje y estado del consentimiento de datos.
- Detalle de pedido: datos del cliente, items, totales, referencia de pago y
  consentimiento. Incluye un formulario para cambiar el `estado` manualmente
  (pendiente/pagado/procesando/enviado/entregado/cancelado/error); este cambio
  es solo administrativo y **no** sustituye la verificación server-side de la
  pasarela. Las notificaciones automáticas al proveedor se disparan desde los
  webhooks/post-pago cuando el pedido queda pagado.

### Flujo de cotizacion con oferta formal

Para equipos que requieren precio acordado antes del pago (ver `COMMERCE_GUIDE.md`):

1. **Revisar solicitud** — Abrir detalle en `/admin#cotizaciones`. Estados de
   seguimiento: `nueva`, `en_revision`, `respondida`, `cerrada`, `convertida`
   (ver `docs/decisions/0004-cotizaciones-estado-seguimiento.md`).
2. **Armar oferta** — En el formulario "Oferta":
   - Lineas de producto con precio unitario (obligatorio antes de enviar).
   - Condiciones/observaciones (obligatorio).
   - Moneda `COP` o `USD` y validez opcional.
   - Pulsar **Guardar oferta** (persiste en `solicitudes_cotizacion`).
3. **Enviar al cliente** — **Enviar oferta** invoca `enviar-cotizacion`:
   - Genera token de formalizacion (hash SHA-256 en BD).
   - Email con enlace `/es/cotizacion/formalizar?id=…&token=…` (EN: `/en/quote/formalize`).
   - Marca `oferta_enviada_at`.
4. **Formalizacion del cliente** — Dos caminos:
   - **Transferencia bancaria:** el cliente registra referencia + comprobante;
     se crea pedido `pendiente_validacion` con `proveedor_pago=transferencia`.
   - **Pago online:** desde admin, **Convertir a pedido** (`convertir-cotizacion-pedido`)
     genera checkout Wompi con precios bloqueados de la oferta.
5. **Validar transferencia** — En detalle de pedido con estado
   `pendiente_validacion`:
   - **Ver / descargar comprobante** (bucket privado `comprobantes-pago`).
   - **Validar transferencia** → `validar-transferencia` → `pagado` + post-pago
     (emails, dropship, factura DIAN si aplica, sync Twenty).
   - **Rechazar comprobante** → pedido `rechazado`, cotizacion reabierta con
     nuevo token; el cliente recibe email para reintentar.

Errores frecuentes del panel (codigos de `enviar-cotizacion`):

| Codigo                  | Accion                                              |
| ----------------------- | --------------------------------------------------- |
| `OFERTA_SIN_PRECIO`     | Completar precios y guardar oferta antes de enviar  |
| `OFERTA_SIN_CONDICIONES`| Completar condiciones y guardar oferta              |
| `SIN_EMAIL`             | La solicitud no tiene email de contacto             |
| `COTIZACION_YA_CONVERTIDA` | Ya existe pedido vinculado                       |

### Facturacion electronica en pedidos

- El checkout y la formalizacion pueden solicitar factura DIAN (`facturacion_electronica_solicitada`).
- Tras pago confirmado, `emitir-factura-dian` se dispara automaticamente (Siigo).
- Revisar en detalle de pedido: `facturacion_electronica_estado`
  (`pendiente_envio`, `emitida`, `rechazada`, `error`).
- Registro completo en tabla `facturas_electronicas` (solo visible vía admin/BD).
- Anulacion: Edge Function `anular-factura-dian` (roles `owner|admin`); aun sin
  boton en UI — ver `COMMERCE_GUIDE.md`.

## Legales y auditoría F5

- Las páginas legales viven en `/es/legal/*` y `/en/legal/*`.
- Son borradores: no operar producción hasta cerrar `BLOQUEANTE_LEGAL`.
- Revisar `VALIDACION.md`, `QA.md` y `REMEDIACION.md` antes de promover preprod a producción.

## Errores Comunes

- Pantalla de configuracion pendiente: faltan `PUBLIC_SUPABASE_URL` o `PUBLIC_SUPABASE_ANON_KEY`.
- Login falla: el usuario no existe en Supabase Auth o la contrasena es incorrecta.
- Tablas vacias con sesion valida: revisar que `schema.sql` se haya ejecutado en el proyecto correcto.
- Publicacion falla: faltan `CI_DEPLOY_HOOK` o `GITHUB_TOKEN`/`GITHUB_REPOSITORY`.
