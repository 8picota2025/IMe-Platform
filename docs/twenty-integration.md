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

## Código

`supabase/functions/_shared/twenty-crm.ts`
