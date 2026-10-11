# cms_api.py — IME CMS comercial (Supabase, JWT de usuario ventas)

Copia de trabajo del cliente que corre fuera del repo (caja del agente). Mismo contrato que
`supabase/functions/comercial-cotizacion`. Auth y cabeceras no cambian.

Auth: POST {URL}/auth/v1/token?grant_type=password headers apikey=<anon> body {"email","password"} (password de $IME_CMS_COMERCIAL1_PASSWORD)
Todas las llamadas: headers apikey=<anon>, Authorization: Bearer <access_token>

- Listar/buscar: GET /functions/v1/comercial-cotizacion?equipo=1&q=jelt[&tab=enviadas]
  Archivadas ocultas por defecto. Opt-in: `&incluir_archivadas=1` o `&solo_archivadas=1`.
  Cerradas (perdida, declinada, expirada): `&tab=cerradas`. Todas: `&tab=todas`.
- Detalle: GET /functions/v1/comercial-cotizacion?id=<uuid>
- Guardar: POST /functions/v1/comercial-cotizacion body = jelt_save.json (con "id" => update; sin id => insert estado nueva)
  **`estado` en el body se ignora.** No marca enviada ni avisa al cliente.
- Vista previa: GET /functions/v1/comercial-cotizacion?action=pdf&id=<uuid>&fresh=1 -> {pdf_base64, numero, stored:false}
- Estado (no envía): POST /functions/v1/comercial-cotizacion?action=cambiar-estado&id=<uuid>
  body {"estado":"perdida","motivo":"El cliente eligió otro proveedor"}
  Estados: nueva, en_revision, respondida, enviada, convertida, expirada, perdida, declinada.
  Respuesta incluye `envio_cliente: false` y `auditoria` (quién, cuándo, motivo, estado anterior→nuevo).
  Marcar `enviada` aquí NO escribe `oferta_enviada_at` y NO llama a `enviar-cotizacion`.
- Archivar: POST /functions/v1/comercial-cotizacion?action=archivar&id=<uuid>
  body {"motivo":"Duplicada de IME-Q-2026-000010"}
  Escribe archived_at, archived_by (user id del JWT) y archived_reason. No borra la fila ni el PDF.
- Desarchivar: POST /functions/v1/comercial-cotizacion?action=desarchivar&id=<uuid>
  body {"motivo":"El cliente retomó la negociación"}
- ENVIAR (no ejecutado salvo aprobación): POST /functions/v1/enviar-cotizacion body {"cotizacion_id":"<uuid>","canal":"email"}
  CLI: python3 cms_api.py send <uuid> --yes-really-send

Nota: PostgREST directo sobre solicitudes_cotizacion devuelve 0 filas para rol ventas (RLS); usar la Edge Function.
DELETE /comercial-cotizacion?id= ya no borra: archiva (solo admin/owner) con motivo fijo. Preferir `action=archivar`.

## CLI

```bash
python3 cms_api.py status <uuid> perdida --motivo "El cliente eligió otro proveedor"
python3 cms_api.py archive <uuid> --motivo "Duplicada de IME-Q-2026-000010"
python3 cms_api.py unarchive <uuid> --motivo "El cliente retomó la negociación"
python3 cms_api.py find clinica --tab cerradas
python3 cms_api.py find clinica --archivadas
python3 cms_api.py find clinica --solo-archivadas
```

Probar solo contra una cotización creada para la prueba. No cambiar cotizaciones reales.
