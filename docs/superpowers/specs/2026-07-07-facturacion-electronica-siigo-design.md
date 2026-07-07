# Facturación electrónica DIAN vía Siigo — integración real

## Contexto

La facturación electrónica DIAN está marcada como completada en `PENDIENTES.md`
desde 2026-06-18: el checkout captura el perfil fiscal del comprador
(`src/components/Carrito.astro`), `crear-pago` calcula IVA y retenciones
server-side (`src/lib/fiscal.ts`), `pedidos` guarda el desglose y estado de
factura, `facturas_electronicas` registra payload/respuesta, y
`post-pago.ts` invoca automáticamente `emitir-factura-dian` cuando un pedido
pasa a `pagado` y el cliente solicitó factura electrónica. Lo único que
quedaba pendiente era conectar un proveedor real: la Edge Function
`emitir-factura-dian` está escrita contra un adaptador genérico
(`DIAN_PROVIDER_API_URL`/`DIAN_PROVIDER_API_TOKEN`/`DIAN_PROVIDER_NAME`) que
hace un `POST` simple con bearer token estático — un placeholder que nunca
se conectó a un proveedor homologado real.

El usuario ya obtuvo credenciales API de **Siigo** (proveedor tecnológico/OP
homologado ante la DIAN), y confirmó que son credenciales de su **cuenta de
producción real** (no sandbox). Los productos del catálogo de I-ME **no
existen aún** como productos dentro de Siigo.

Siigo no encaja con el adaptador genérico existente:

- Autenticación en dos pasos (`POST /auth` con `{username, access_key}` →
  `access_token` válido 24h), no un token fijo.
- Header `Partner-Id` obligatorio en todas las llamadas, además del token.
- El payload de factura (`POST /v1/invoices`) referencia **IDs internos de
  la cuenta Siigo del cliente** (tipo de documento, vendedor, impuestos,
  medio de pago), no porcentajes ni texto libre.
- Cada línea de factura debe referenciar un producto que **ya exista**
  dentro del catálogo de productos de Siigo.

Por la regla inamovible del proyecto ("cero datos inventados"), los IDs de
catálogo específicos de la cuenta Siigo del cliente no se pueden adivinar ni
tomar de memoria/documentación genérica: deben obtenerse en vivo desde su
cuenta real antes de fijarlos como configuración.

## Objetivo

Reemplazar el adaptador genérico `DIAN_PROVIDER_*` por un cliente Siigo real
que autentica, resuelve/crea el cliente y los productos en Siigo, arma el
payload exacto que exige su API, y emite la factura electrónica — sin tocar
el resto del flujo ya construido (captura en checkout, cálculo fiscal,
disparo automático post-pago, persistencia en `facturas_electronicas` /
`pedidos`).

**Fuera de alcance**: firma XML/UBL propia (Siigo la hace como OP
homologado), UI de admin nueva para gestionar la config de Siigo, soporte
para más de un proveedor de facturación simultáneo.

## Paso previo: descubrimiento de configuración de cuenta Siigo

Antes de fijar la configuración final, se construye un script de un solo
uso (`scripts/siigo-discover-config.mjs` o similar) que, usando las
credenciales reales en un `.env` local no versionado, llama a los
endpoints de catálogo de Siigo (`document-types`, `taxes`, `payment-types`,
`users`, `account-groups`) y **imprime los IDs disponibles** (no son datos
sensibles, son identificadores de configuración). El usuario corre este
script localmente — las credenciales no se pegan en la conversación. Con
esos IDs reales se elige y fija la configuración del punto siguiente.

## Configuración y secretos

Nuevas variables de entorno en Supabase Edge Functions (secrets, nunca en
cliente/dist), reemplazando `DIAN_PROVIDER_*`. Valores ya confirmados el
2026-07-07 vía `scripts/siigo-discover-config.mjs` contra la cuenta real
(no inventados — catálogo real de Siigo):

- `SIIGO_USERNAME`, `SIIGO_ACCESS_KEY` — credenciales de autenticación
  (ya configuradas como secrets de producción).
- `SIIGO_PARTNER_ID=IMECOMCO` — identificador de partner registrado por el
  cliente en Siigo Nube (ya configurado).
- `SIIGO_DOCUMENT_TYPE_ID=31158` — "Factura electrónica de venta"
  (`electronic_type: ElectronicInvoice`), único tipo de documento FV con
  ese flag en la cuenta.
- `SIIGO_SELLER_ID=304` — usuario `info@i-me.com.co` ("INTERNATIONAL
  MEDICAL ENTERPRISE. IME. S.A.S."), la misma cuenta usada para la API;
  confirmado por el cliente como vendedor genérico de pedidos web.
- `SIIGO_PAYMENT_TYPE_ID=12939` — "Transferencia", confirmado por el
  cliente (ya configurado como secret de producción).
- `SIIGO_ACCOUNT_GROUP_ID=603` — "Productos", único grupo contable
  existente en la cuenta.
- `SIIGO_TAX_MAP={"19":6331,"5":6332,"0":13962}` — IDs reales de IVA
  19%/5%/0% en la cuenta, mapeando la tarifa calculada por `fiscal.ts`.
- No se requiere `SIIGO_COST_CENTER_ID`: el documento tipo `31158` tiene
  `cost_center: false` y `cost_center_mandatory: false` en la cuenta real.

Toda la configuración necesaria ya está fijada y guardada como secrets de
producción (2026-07-07); no queda ningún ID pendiente de confirmar.

## Componentes

### 1. Cliente Siigo (`supabase/functions/_shared/siigo-client.ts`)

Módulo nuevo con:

- `autenticar()` — `POST https://api.siigo.com/auth`, devuelve
  `access_token`. Sin caché entre invocaciones: la emisión de factura es
  asíncrona post-pago y de bajo volumen, así que se re-autentica en cada
  emisión en vez de añadir infraestructura de caché de token.
- `resolverCliente(clienteFiscal)` — `GET /v1/customers?identification=X`;
  si no existe, `POST /v1/customers` creándolo con los datos ya capturados
  en checkout (tipo/número de documento, razón social, dirección).
  `address.city.state_code`/`city_code` exige códigos DIVIPOLA oficiales, y
  el checkout captura ciudad/departamento como texto libre — se resuelven
  contra un catálogo DIVIPOLA completo embebido (`divipola-municipios.ts`,
  1122 municipios, fuente oficial datos.gov.co dataset `gdxc-w37w`,
  descargado 2026-07-07) con match normalizado (sin tildes/mayúsculas) en
  `divipola.ts`. Si no hay match inequívoco, `resolverCliente` lanza error
  (nunca inventa un código) y la factura queda en `estado='error'` para
  seguimiento manual — mismo patrón no bloqueante ya usado en el resto de
  la función.
- `resolverProducto(item)` — `GET /v1/products?code=<sku>`; si no existe,
  `POST /v1/products` usando `productos.sku` (o un código derivado del
  slug si no hay sku) como `code`, más `SIIGO_ACCOUNT_GROUP_ID` y el
  impuesto correspondiente vía `SIIGO_TAX_MAP`. Creación perezosa: cada
  producto se sincroniza la primera vez que aparece en una factura: no se
  requiere un script de migración masiva del catálogo completo.
- `crearFactura(payload)` — `POST /v1/invoices` con el body ya mapeado.

### 2. Mapeo de payload

Se adapta la construcción actual de `dian_draft`
(`buildDianInvoiceDraft` en `src/lib/fiscal.ts`) a un mapeador nuevo que
produce el body exacto de Siigo (`document.id`, `date`, `customer`,
`seller`, `items[]` con `code`/`quantity`/`price`/`taxes[].id`,
`payments[]` con `id`/`value`). `fiscal.ts` sigue siendo la única fuente
de verdad del cálculo de IVA/retenciones; el mapeador solo traduce forma,
no recalcula montos.

### 3. Orquestación (`supabase/functions/emitir-factura-dian/index.ts`)

Se reescribe la función para, en orden: autenticar → resolver cliente →
resolver cada producto de las líneas → construir el payload Siigo →
emitir → persistir el resultado igual que hoy (`facturas_electronicas`,
`pedidos.facturacion_electronica_estado`), mapeando `stamp.status` de
Siigo (`Draft|Accepted|Rejected`) al estado interno existente
(`emitida|rechazada|error`). El resto del contrato de la función (auth por
service role, payload `{pedido_id}`, respuesta) no cambia.

### 4. Manejo de errores

Igual que el comportamiento actual: cualquier fallo (auth, resolución de
cliente/producto, emisión) se registra en `facturas_electronicas` con
`estado='error'` y el mensaje real de Siigo, y `pedidos` pasa a
`facturacion_electronica_estado='error'`, sin bloquear la confirmación del
pago al cliente (la emisión de factura es post-pago y no bloqueante).

## Verificación en base de datos real

Antes de desplegar, se confirma si la migración que crea
`facturas_electronicas` y las columnas `facturacion_electronica_*` en
`pedidos` ya está aplicada en la base de datos de producción real (estado
no confirmado al momento de este diseño). Si no lo está, se aplica como
parte de la ejecución de este trabajo.

## Plan de pruebas seguras en producción

Al ser credenciales reales de producción, no se hacen pruebas masivas ni
repetidas: la validación final se hace con **un pedido real controlado de
monto mínimo**, revisando el resultado en el dashboard de Siigo antes de
dar el trabajo por cerrado. Este paso se ejecuta explícitamente junto con
el usuario, no de forma autónoma.

## Testing

- Unit tests del mapeador de payload (fixture de `FiscalSummary` +
  `ClienteFiscalProfile` conocidos → forma exacta esperada del body
  Siigo), siguiendo el patrón ya existente en `src/lib/fiscal.test.ts`.
- Tests del cliente Siigo con `fetch` mockeado (auth exitosa/fallida,
  cliente/producto ya existente vs. creación, factura aceptada/rechazada).
- No se agregan tests de integración contra la API real de Siigo (son
  credenciales de producción; ver plan de pruebas seguras arriba).
