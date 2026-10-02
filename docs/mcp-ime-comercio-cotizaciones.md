# MCP `ime-comercio` — cotizaciones oficiales

Herramientas para que un asistente de IA busque, complete y envíe cotizaciones **por la misma ruta oficial
que el CMS** (`enviar-cotizacion`): numeración `IME-Q-AAAA-NNNNNN`, PDF adjunto, CTA a
`/es/cotizacion/formalizar?id=…&t=…`, asesor real y `Reply-To`.

Se arranca con `npm run mcp:comercio` (stdio). Necesita `SUPABASE_URL` (o `PUBLIC_SUPABASE_URL`) y
`SUPABASE_SERVICE_ROLE_KEY` en el entorno del MCP. Las claves nunca se devuelven en ninguna herramienta.

## Flujo

```
buscar_cotizaciones ─► obtener_cotizacion ─► actualizar_cotizacion
                                                   │
                                  preparar_envio_cotizacion  (dry-run + vista previa PDF)
                                                   │
                     owner/admin aprueba en el CMS (Dashboard → «Aprobaciones del agente»)
                                                   │
                                  confirmar_envio_cotizacion  (envío oficial)
```

`preparar_*` / `confirmar_*` usan el mismo patrón que facturas y reembolsos (`comercio_confirmaciones`): el
agente **no puede aprobarse a sí mismo**. La aprobación la hace un owner/admin con sesión; el trigger de la
tabla lo impone incluso frente a la service role. La solicitud de envío vence a las **4 h**; una aprobación
dura 24 h.

Además, al preparar se guarda una **huella** de la oferta (líneas, precios, condiciones, moneda, validez,
email e `impuestos_incluidos`). Si la cotización cambia entre la aprobación y la confirmación, el envío se
rechaza con `OFERTA_CAMBIADA`: hay que preparar y aprobar uno nuevo.

Todas las acciones quedan en `comercio_actuaciones` (actor, herramienta, antes/después, confirmación).

## Argumentos comunes

| Argumento | Descripción                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------- |
| `actor`   | Quién llama (p. ej. `claude`). Se registra en la auditoría.                                        |
| `motivo`  | Texto libre. Obligatorio en `preparar_*`; en `confirmar_envio_cotizacion` tiene valor por defecto. |

## Herramientas

### `buscar_cotizaciones`

Filtros opcionales: `q` (numero/nombre/empresa/email), `email`, `empresa`, `estado`
(`nueva|en_revision|respondida|enviada|convertida|expirada`, varios separados por espacio), `desde` / `hasta`
(`YYYY-MM-DD`, sobre `created_at`), `limite` (1-50, def. 20).

```json
{
  "name": "buscar_cotizaciones",
  "arguments": {
    "email": "cliente@clinica.co",
    "estado": "nueva en_revision",
    "limite": 5
  }
}
```

```json
{
  "ok": true,
  "total": 1,
  "cotizaciones": [
    {
      "id": "uuid",
      "numero": "IME-Q-2026-000031",
      "cliente": {
        "nombre": "Ana Gómez",
        "empresa": "Clínica X",
        "email": "cliente@clinica.co"
      },
      "total": 1821000,
      "moneda": "COP",
      "estado": "nueva",
      "validez_hasta": "2026-10-30",
      "owner": {
        "user_id": "uuid",
        "nombre": "Equipo Comercial I-ME",
        "email": "comercial1@i-me.com.co"
      },
      "updated_at": "2026-10-02T12:00:00+00:00"
    }
  ]
}
```

### `obtener_cotizacion`

`{ "cotizacion_id": "uuid" }` → detalle completo: `cliente` (incl. NIT y direcciones), `lineas`
(`slug, nombre, cantidad, precio_unitario, subtotal, moneda, precio_pendiente_validar, descripcion`),
`condiciones`, `validez_hasta`, `impuestos_incluidos`, `estado`, `editable`, `enlaces`
(`formalizar_url`, `pdf_url` firmado 1 h), `ultimo_error_envio`, `envio` (canal, `message_id`, `reply_to`) y
`notas_internas`. **Nunca** devuelve el hash del token de formalización.

### `actualizar_cotizacion`

Solo cotizaciones **no convertidas** y en estado editable (`nueva|en_revision|respondida`); una ya `enviada`
exige crear una revisión desde `/comercial` (misma regla que `COTIZACION_INMUTABLE`). Todos los campos son
opcionales, pero debe haber al menos uno.

| Campo                          | Notas                                                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lineas`                       | **Reemplaza todas** las líneas. `[{ producto_id` _o_ `nombre` (línea libre)`, cantidad, precio_unitario > 0, descripcion?, piso? }]`. Precio ≤ 0 se rechaza (el MCP no deja líneas «pendiente de validar»); si `piso` > precio → usar `preparar_precio_bajo_piso`. |
| `cliente`                      | `{ nombre, empresa, nit, email, telefono, ciudad, direccion_envio, direccion_facturacion }`. `ciudad` se añade a `direccion_envio` (`"Cra 7 # 1-2, Bogotá"`).                                                                                                      |
| `condiciones`, `validez_hasta` | `validez_hasta` en `YYYY-MM-DD`, no pasada.                                                                                                                                                                                                                        |
| `moneda`                       | `COP` \| `USD`. Reetiqueta las líneas existentes si no se envían nuevas.                                                                                                                                                                                           |
| `impuestos_incluidos`          | `true` = «precios incluyen IVA» (necesario para que el cliente pida factura electrónica al formalizar).                                                                                                                                                            |
| `notas`                        | Se añade a `notas_internas` con fecha.                                                                                                                                                                                                                             |
| `updated_at`                   | Opcional: control de concurrencia (`CONCURRENT_UPDATE`).                                                                                                                                                                                                           |

```json
{
  "name": "actualizar_cotizacion",
  "arguments": {
    "cotizacion_id": "uuid",
    "lineas": [
      { "producto_id": "uuid", "cantidad": 2, "precio_unitario": 1190000 }
    ],
    "cliente": { "nit": "900123456-7", "ciudad": "Bogotá" },
    "condiciones": "Entrega 30 días. Pago 100 % anticipado.",
    "validez_hasta": "2026-10-30",
    "impuestos_incluidos": true
  }
}
```

Respuesta: `{ "ok": true, "actualizados": ["productos","precio_total_ofertado","nit",…], "cotizacion": { …detalle… } }`.

### `preparar_envio_cotizacion`

`{ cotizacion_id, actor_email, canal?: "email"|"whatsapp", motivo? }`

- `actor_email`: usuario comercial (rol `ventas`/`admin`/`owner` **activo** en `admin_profiles`), p. ej.
  `comercial1@i-me.com.co`. Él será el **owner** de la cotización y el asesor del email y del PDF.
- Valida lo mismo que `enviar-cotizacion` (email real, líneas con precio > 0 y sin «pendiente de validar»,
  condiciones, moneda única, plantilla de email activa, actor válido) mediante `dry_run`: **no** numera, no
  cambia estado y no envía.

```json
{
  "ok": true,
  "confirmacion_id": "uuid",
  "vence_en": "2026-10-02T16:00:00Z",
  "estado": "pendiente",
  "cotizacion_id": "uuid",
  "numero": "IME-Q-2026-000031",
  "resumen": {
    "destinatario": "cliente@clinica.co",
    "asunto": "Presupuesto IME-Q-2026-000031 …",
    "total": 2380000,
    "moneda": "COP",
    "validez_hasta": "2026-10-30",
    "lineas": [
      {
        "nombre": "Monitor M12",
        "cantidad": 2,
        "precio_unitario": 1190000,
        "subtotal": 2380000
      }
    ],
    "asesor": {
      "nombre": "Equipo Comercial I-ME",
      "email": "comercial1@i-me.com.co",
      "telefono": "+57 …"
    },
    "reply_to": "comercial1@i-me.com.co"
  },
  "pdf_preview_url": "https://…/cotizaciones-pdf/<id>/preview.pdf?token=…",
  "aprobacion": "Un owner/admin debe aprobar esta solicitud en el CMS … Vence en 4 h."
}
```

Errores típicos: `SIN_EMAIL`, `OFERTA_SIN_PRECIO`, `OFERTA_SIN_CONDICIONES`, `OFERTA_MONEDA_MIXTA`,
`PRECIO_PENDIENTE`, `ACTOR_INVALIDO`, `TEMPLATE_INACTIVE`, `COTIZACION_YA_CONVERTIDA`.

### `confirmar_envio_cotizacion`

`{ confirmacion_id, motivo? }`. Requiere la aprobación del owner/admin (si no: «Pendiente de aprobación…»).
Envía por la ruta oficial y devuelve:

```json
{
  "ok": true,
  "cotizacion_id": "uuid",
  "numero": "IME-Q-2026-000031",
  "estado": "enviada",
  "canal": "email",
  "formalizar_url": "https://i-me.com.co/es/cotizacion/formalizar?id=…&t=…",
  "message_id": "<id de Resend>",
  "reply_to": "comercial1@i-me.com.co",
  "asesor": {
    "nombre": "Equipo Comercial I-ME",
    "email": "comercial1@i-me.com.co",
    "telefono": "+57 …"
  }
}
```

Si el envío falla devuelve `{ "ok": false, "error": …, "code": "EMAIL_FALLIDO", "send_error": … }`. La
cotización **no** queda `enviada`, la aprobación sigue vigente y se puede reintentar (el envío usa una
`Idempotency-Key` por revisión de PDF, así que un reintento no duplica el correo).

## «Enviar como» (`actor_email` / `actor_user_id`)

`enviar-cotizacion` acepta `actor_email` o `actor_user_id` **solo cuando la llamada trae la service role** y
el usuario es ventas/admin/owner activo; en otro caso responde `403 ACTOR_NO_PERMITIDO` / `422 ACTOR_INVALIDO`.
Con un JWT de usuario el actor es siempre ese usuario. Un vendedor sigue sin poder operar cotizaciones de otro.
Parámetro adicional `dry_run: true` (validar + vista previa, sin efectos).

## Identidad del asesor y Reply-To

- Nombre, correo y teléfono salen de `admin_profiles` del usuario que envía. Nombre vacío → **«Equipo Comercial I-ME»**
  (nunca el email en crudo).
- Editables en `/admin` → **Usuarios** (campos _Nombre_ y _Teléfono_; activar/desactivar no los borra).
- `Reply-To` del email de cotización = email del asesor; sin perfil → variable **`COTIZACION_REPLY_TO`**
  (por defecto `comercial1@i-me.com.co`).
- Mismo criterio en los correos al cliente derivados de una cotización: «transferencia recibida»
  (`formalizar-cotizacion`), «comprobante rechazado» (`rechazar-comprobante`) y los estados de un pedido que
  viene de una cotización (`notificar-cliente`) responden al asesor dueño de esa cotización. Los pedidos de la
  tienda sin cotización no cambian.

## `/comercial`: «Precios incluyen IVA»

La edición de cotizaciones en `/comercial` expone `impuestos_incluidos`. Sin ello, `formalizar-cotizacion`
rechaza la factura electrónica (`TRATAMIENTO_TRIBUTARIO_OFERTA_REQUERIDO`). El total que se ofrece
(`Σ precio_unitario × cantidad`) es el que `formalizar-cotizacion` compara con el total fiscal
(`baseNetaDesdePrecioConIva` + IVA por producto, tolerancia ±1); hay un test que lo comprueba.

## Variables de entorno

| Variable                                     | Dónde                                | Uso                                                                |
| -------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `COTIZACION_REPLY_TO`                        | Secrets de Edge Functions (Supabase) | Reply-To de respaldo (opcional; defecto `comercial1@i-me.com.co`). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Entorno del MCP                      | Ya existentes.                                                     |

## Verificación manual (contra una cotización de prueba)

1. `buscar_cotizaciones { "email": "<tu-email-de-prueba>" }` y elegir una cotización `nueva`
   (o crearla con `crear_borrador_cotizacion` con un email **tuyo**).
2. `actualizar_cotizacion` con líneas de precio > 0, condiciones, validez e `impuestos_incluidos: true`.
3. `preparar_envio_cotizacion { actor_email: "comercial1@i-me.com.co" }` → abrir `pdf_preview_url` y revisar
   asesor, total y líneas.
4. Aprobar en `/admin` → Dashboard → «Aprobaciones del agente» (owner/admin).
5. `confirmar_envio_cotizacion { confirmacion_id }` → comprobar en tu bandeja: remitente `pedidos@`, firma del
   asesor, PDF adjunto, botón de formalizar y, al pulsar _Responder_, destinatario `comercial1@i-me.com.co`
   (cabecera `Reply-To`; también visible en el log de Resend con el `message_id`).
6. Limpiar: borrar la cotización de prueba (los datos de prueba no deben quedar en producción ni en Twenty).
