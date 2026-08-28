# Integración Twenty CRM — CMS comercial

## Estado

Integración **real vía REST**, desacoplada en Edge Functions. No se invoca Twenty desde el navegador.

## Objetos usados (workspace verificado)

- `people` — contacto (email / teléfono)
- `companies` — centro médico
- `notes` + `noteTargets` — actividad del envío

No se inventan objetos custom.

## Mapeo

| Campo comercial             | Twenty                                  |
| --------------------------- | --------------------------------------- |
| Nombre destinatario         | `people.name.firstName/lastName`        |
| Email                       | `people.emails.primaryEmail`            |
| Teléfono E.164              | `people.phones`                         |
| Centro médico               | `companies.name`                        |
| Mensaje + productos + canal | `notes.title` + `notes.bodyV2.markdown` |
| Origen                      | texto en nota: `CMS comercial I-ME`     |

## Deduplicación

1. Buscar persona por email normalizado.
2. Si no hay email, buscar por teléfono.
3. Buscar/crear company por nombre exacto.
4. Actualizar persona existente o crear.
5. Crear nota y `noteTarget` hacia person (y company si aplica).

Twenty REST devuelve listas con la forma `{ data: { people: [] } }` (o
`companies`). El cliente acepta esa forma y las variantes planas de versiones
antiguas. Los filtros se codifican como query parameters: emails con `+` y
nombres con `&` no degradan la búsqueda ni generan duplicados.

Si el enlace nota→persona falla después de crear los registros, el reintento
usa `crm_person_id` + `crm_record_id` existentes para reparar solo el enlace;
no crea una segunda nota.

## Estados locales (`commercial_shares.crm_sync_status`)

| Estado    | Significado                         |
| --------- | ----------------------------------- |
| `pending` | En cola / aún no intentado          |
| `synced`  | IDs CRM guardados                   |
| `failed`  | Error recuperable; reintento manual |
| `skipped` | Sin `TWENTY_*` configurados         |

## Endpoints

- Sync automático al crear envío (`comercial-share` POST).
- Reintento: `POST .../comercial-share?action=retry&id=<uuid>`.
- Estado (sin secretos): `GET .../comercial-share?action=status`.

## Configuración operativa

Configurar secretos de Edge Function, nunca en el frontend ni en `dist/`:

```bash
supabase secrets set TWENTY_BASE_URL=https://crm.i-me.com.co
supabase secrets set TWENTY_API_KEY='token-de-Twenty'
```

`TWENTY_BASE_URL` no lleva `/rest`; cliente añade ese prefijo. Validar con el
endpoint de estado: debe devolver `configured: true` y `connectivity: ok`.
Errores de Twenty se guardan sin URL de filtro, body remoto, email ni teléfono.

## Código

`supabase/functions/_shared/twenty-crm.ts`

# Cotización web → Twenty (2026-08-01)

`registrar-cotizacion` ahora llama `syncCotizacionWithTwenty` (best-effort):

1. Upsert Company (+ accountOwner)
2. Upsert Person (email/tel)
3. Create Opportunity `NEW` + PoC + owner + amount si hay `total_estimado`
4. Create Task SLA 4h + taskTarget

## Congreso PWA → Twenty (2026-08-27)

`congreso-lead` persiste en `leads_comerciales` (`campaign=evento`, `origen=congreso`)
y sincroniza a Twenty con identificación operativa:

| Campo Twenty      | Valor                                                      |
| ----------------- | ---------------------------------------------------------- |
| `people.jobTitle` | `Lead evento · ACISE2026`                                  |
| Opportunity       | `Registro ACISE2026 {leadId} — {nombre}` stage `NEW`       |
| Task              | `Lead ACISE2026 {leadId}: {nombre}` + productos de interés |
| Task body         | Canal `congreso`, Evento, slug, ciudad, mensaje            |

`comercial-share` (email/WhatsApp post-registro) crea nota de catálogo pero **no pisa**
`jobTitle` si la persona ya existe (preserveJobTitleOnUpdate).

Redeploy:

```bash
supabase functions deploy congreso-lead
supabase functions deploy comercial-share
supabase functions deploy registrar-lead-comercial
```

Backfill one-shot (Deno, fuera de `astro check`):

```bash
deno run --allow-env --allow-net supabase/scripts/backfill-congreso-twenty.ts
```

Secrets Edge (igual que comercial-share):

```bash
supabase secrets set TWENTY_BASE_URL=https://crm.i-me.com.co
supabase secrets set TWENTY_API_KEY='…'
# opcional:
supabase secrets set TWENTY_OWNER_ID='8c9ca697-bc48-45d1-aba4-9a51a68d19e9'
```

Redeploy:

```bash
supabase functions deploy registrar-cotizacion
supabase functions deploy registrar-lead-comercial
```

## Lead consultivo → Twenty (2026-08-09)

`registrar-lead-comercial` persiste primero en Supabase y sincroniza después:

1. Lead operativo con consentimiento, campaña, UTM, landing e idempotencia.
2. Cuenta/contacto/oportunidad en CRM interno mediante trigger transaccional.
3. Opportunity + Task en Twenty con SLA P1/P2/P3.
4. Fallo Twenty queda en `crm_sync_status = failed`; no pierde lead ni muestra falso error.
5. Cotización y pedido posteriores reutilizan misma oportunidad CRM mediante FKs explícitas.

Auto-CRM local: webhook dual-write vía `scripts/twenty-inbound-cotizacion.py` si `TWENTY_*` en `.env.local`.

## Flujo comercio → Twenty (cliente / pago / factura) — 2026-08-01

Todo cliente nuevo + importe pagado + factura DIAN sincroniza a Twenty (best-effort).

### Tipología de clientes (sin custom fields admin)

API key sin permiso `create_field_metadata`. Tipología vive en campos estándar + notas:

| Concepto               | Dónde en Twenty                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Tipo B2B / B2C / MIXTO | `people.jobTitle` = `Cliente B2B · NIT …` + nota **Perfil fiscal I-ME**                           |
| Empresa / razón social | `companies.name`                                                                                  |
| Total pagado acumulado | `companies.annualRevenue` (COP/USD)                                                               |
| Pedido pagado          | `opportunities` stage `CUSTOMER` + `amount`                                                       |
| Factura DIAN / CUFE    | Nota **Factura DIAN …** enlazada a opp/person/company                                             |
| IDs sync               | Supabase: `clientes.twenty_*`, `pedidos.twenty_opportunity_id`, `solicitudes_cotizacion.twenty_*` |

Campos custom opcionales (Settings → Data Model, admin): `tipoCliente` (SELECT), `nitDocumento`, `emailFacturacion`, `estadoFacturacion`, `ultimaFactura`, `pedidoId`, `proveedorPago`, `numeroFactura`, `cufe`. Sync intenta PATCH; si fallan, reintenta solo estándar.

### Hooks Edge

| Momento                  | Función                                               | Acción Twenty                               |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------- |
| Cotización web           | `registrar-cotizacion`                                | Lead + Opp NEW + guarda IDs                 |
| Checkout / transferencia | `crear-pago`, `formalizar-cotizacion`                 | `pushClienteToTwenty`                       |
| Pago confirmado          | `post-pago` → wompi/stripe/bold/validar-transferencia | `pushPagoToTwenty` (Opp CUSTOMER + importe) |
| Factura DIAN             | `emitir-factura-dian`                                 | `pushFacturaToTwenty` (nota + patch)        |

## Admin CRM ↔ Twenty (2026-08-28)

Edge Function `crm-twenty` (JWT ventas|admin|owner):

| Acción                          | Uso                           |
| ------------------------------- | ----------------------------- |
| `GET ?action=members`           | Lista comerciales Twenty      |
| `POST ?action=sync-opportunity` | Etapa/valor/nota CRM → Twenty |
| `POST ?action=reassign`         | Cambia owner + tasks          |
| `POST ?action=link`             | Enlaza contacto ↔ cuenta      |
| `POST ?action=repair-links`     | Repara personas sin company   |

Panel admin `#/crm`: guardar oportunidad sincroniza Twenty; botón reparar enlaces.

Migración: `20260828160000_crm_twenty_bridge.sql` (IDs Twenty en `crm_*` + `admin_profiles.twenty_member_id`).

Redeploy:

```bash
supabase db push   # o aplicar migración en dashboard
supabase functions deploy crm-twenty
supabase functions deploy registrar-lead-comercial
```
