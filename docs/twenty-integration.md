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

## Cotización web → Twenty (2026-08-01)

`registrar-cotizacion` ahora llama `syncCotizacionWithTwenty` (best-effort):

1. Upsert Company (+ accountOwner)
2. Upsert Person (email/tel)
3. Create Opportunity `NEW` + PoC + owner + amount si hay `total_estimado`
4. Create Task SLA 4h + taskTarget

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
```

Auto-CRM local: webhook dual-write vía `scripts/twenty-inbound-cotizacion.py` si `TWENTY_*` en `.env.local`.
