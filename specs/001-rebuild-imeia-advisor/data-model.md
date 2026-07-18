# Data Model: Reconstrucción del asesor IMEIA

## 1. Perfil provisional de descubrimiento

Estado de sesión en navegador. No contiene transcript persistente en servidor.

| Campo             | Tipo           | Regla                                     |
| ----------------- | -------------- | ----------------------------------------- |
| `institutionType` | texto opcional | Categoría, no nombre personal             |
| `institutionName` | texto opcional | Solo se persiste al confirmar lead        |
| `country`         | texto opcional | Máximo 80 caracteres                      |
| `city`            | texto opcional | Máximo 100 caracteres                     |
| `role`            | texto opcional | Rol profesional, máximo 100               |
| `clinicalService` | texto opcional | Servicio o entorno operativo              |
| `need`            | texto opcional | Resumen no clínico, máximo 500            |
| `volume`          | texto opcional | Cantidad o carga prevista                 |
| `timeline`        | texto opcional | Plazo orientativo                         |
| `productSlugs`    | lista          | Máximo 8 slugs validados                  |
| `declinedFields`  | lista          | Campos que no deben volver a preguntarse  |
| `ctaStatus`       | enum           | `none`, `offered`, `accepted`, `declined` |
| `updatedAt`       | fecha ISO      | Expira con la sesión                      |

El cliente puede corregir cualquier valor. Los parches del modelo solo aceptan campos allowlisted, texto limitado y slugs válidos.

## 2. `imeia_leads`

Lead consentido disponible al backoffice comercial.

| Campo                      | Tipo     | Restricciones                                                |
| -------------------------- | -------- | ------------------------------------------------------------ |
| `id`                       | UUID     | Clave primaria                                               |
| `session_id`               | texto    | Único, 1–128 caracteres                                      |
| `locale`                   | texto    | `es` o `en`                                                  |
| `nombre`                   | texto    | Obligatorio, máximo 120                                      |
| `institucion`              | texto    | Opcional, máximo 180                                         |
| `email`                    | texto    | Opcional; email válido                                       |
| `telefono`                 | texto    | Opcional; 7–24 caracteres normalizados                       |
| `canal_preferido`          | texto    | `email`, `telefono` o `whatsapp`                             |
| `perfil`                   | JSON     | Solo campos allowlisted del perfil provisional               |
| `resumen`                  | texto    | Resumen comercial revisable, máximo 1000                     |
| `productos`                | JSON     | Slug y nombre resueltos desde catálogo activo                |
| `tipo_handoff`             | texto    | `whatsapp` o `cotizacion`                                    |
| `estado`                   | texto    | `nuevo`, `contactado`, `cotizacion`, `convertido`, `cerrado` |
| `consentimiento_datos`     | booleano | Siempre `true` para una fila válida                          |
| `consentimiento_version`   | texto    | Versión seleccionada por servidor                            |
| `consentimiento_locale`    | texto    | Idioma del texto mostrado                                    |
| `consentimiento_timestamp` | fecha    | Generada por servidor                                        |
| `created_at`               | fecha    | Generada por servidor                                        |
| `updated_at`               | fecha    | Actualizada por trigger                                      |

### Invariantes

- Debe existir al menos un contacto.
- El canal preferido debe tener su contacto correspondiente.
- Una sesión crea un solo lead; reenvíos actualizan la fila.
- No contiene transcript completo ni datos clínicos de pacientes.
- Los productos se resuelven en servidor; los nombres del cliente no son canónicos.

## 3. Extensiones a `solicitudes_cotizacion`

| Campo               | Tipo           | Regla                                                    |
| ------------------- | -------------- | -------------------------------------------------------- |
| `imeia_lead_id`     | UUID opcional  | Referencia a `imeia_leads.id`, `ON DELETE SET NULL`      |
| `asesor_session_id` | texto opcional | Identificador de continuidad                             |
| `origen`            | texto          | `formulario`, `asesor` o `carrito`; default `formulario` |

La función de registro busca el lead por `asesor_session_id` y establece el vínculo. El cliente no puede elegir un UUID de lead.

## Relaciones

```text
perfil provisional (sessionStorage)
            │ consentimiento + contacto válido
            ▼
       imeia_leads 1 ───────── 0..N solicitudes_cotizacion
            │
            └── productos[] ──► productos activos (resueltos en servidor)
```

## Transiciones

### Conversación

```text
explorando → descubriendo → recomendación
                         └→ intención_comercial → handoff_ofrecido
                                               → handoff_aceptado
```

`seguridad`, `catalogo_degradado` e `indisponible` son modos temporales, no etapas comerciales.

### Lead

```text
nuevo → contactado → cotizacion → convertido
   └───────────────────────────→ cerrado
```

La UI pública no cambia el estado. Solo backoffice o procesos de cotización lo hacen.

## Acceso y retención

- Anónimo: historial y perfil viven solo en `sessionStorage`.
- `imeia_leads`: sin políticas para `anon`; lectura/escritura para roles comerciales autorizados y service role.
- Cotizaciones: escritura pública directa eliminada; las altas pasan por Edge Function.
- La política de retención definitiva requiere revisión legal; hasta entonces el backoffice debe permitir identificar leads para atender solicitudes de acceso, rectificación o supresión.
