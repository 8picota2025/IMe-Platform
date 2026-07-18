# Contract: IMEIA Advisor v1

## Request `asesor`

```json
{
  "mensaje": "string, 1..1000",
  "historial": [
    {
      "rol": "usuario | asesor",
      "contenido": "string"
    }
  ],
  "locale": "es | en",
  "turnstileToken": "string opcional",
  "sessionId": "string",
  "navigationContext": {
    "page_type": "home | catalog | product | service | knowledge | legal | contact | other",
    "product_slug": "string | null",
    "visible_product_ids": ["slug"]
  },
  "discoveryProfile": {
    "institutionType": "string | null",
    "institutionName": "string | null",
    "country": "string | null",
    "city": "string | null",
    "role": "string | null",
    "clinicalService": "string | null",
    "need": "string | null",
    "volume": "string | null",
    "timeline": "string | null",
    "productSlugs": ["slug"],
    "declinedFields": ["field"],
    "ctaStatus": "none | offered | accepted | declined"
  }
}
```

El servidor ignora campos desconocidos y limita historial, textos y listas.

## Respuesta pública `imeia-advisor-response/1`

```json
{
  "schema_version": "imeia-advisor-response/1",
  "texto": "Respuesta directa y natural",
  "productos": [
    {
      "slug": "producto-real",
      "nombre": "Nombre canónico",
      "imagen": null,
      "url_landing": "/es/productos/producto-real",
      "score": 1
    }
  ],
  "discovery": {
    "stage": "exploring | discovering | recommendation | commercial",
    "profile_patch": {
      "clinicalService": "UCI",
      "volume": "10 camas"
    },
    "next_question": {
      "field": "timeline",
      "text": "¿Para qué plazo necesitan tomar la decisión?"
    }
  },
  "accion_handoff": {
    "tipo": "whatsapp | cotizacion",
    "resumen": "Necesidad expresada por el cliente"
  },
  "modo": "rag | keyword_degradado | sin_resultados"
}
```

### Invariantes de respuesta

- `texto` nunca contiene HTML.
- `next_question` es único o `null`.
- Cada producto existe, está activo y pertenece al allowlist recuperado para el turno.
- El servidor construye nombre, imagen y URL; no acepta esos campos del modelo.
- `accion_handoff` es `null` sin señal comercial verificable.
- `profile_patch` no contiene contacto, diagnóstico, paciente ni campos desconocidos.
- Un fallo de parseo estructurado nunca expone el texto crudo del modelo.

## Propuesta interna del modelo

```json
{
  "schema_version": "imeia-turn-proposal/1",
  "texto": "string",
  "productos_citados": ["slug"],
  "descubrimiento": {
    "etapa": "exploring | discovering | recommendation | commercial",
    "actualizaciones": {
      "institutionType": "string | null",
      "institutionName": "string | null",
      "country": "string | null",
      "city": "string | null",
      "role": "string | null",
      "clinicalService": "string | null",
      "need": "string | null",
      "volume": "string | null",
      "timeline": "string | null"
    },
    "pregunta_siguiente": {
      "field": "campo allowlisted",
      "text": "una pregunta"
    }
  },
  "accion_handoff": {
    "tipo": "whatsapp | cotizacion",
    "resumen": "string"
  }
}
```

La Edge Function intenta reparar una vez una propuesta inválida y luego degrada de forma segura.

## Request `registrar-imeia-lead`

```json
{
  "session_id": "string",
  "locale": "es | en",
  "nombre": "string",
  "institucion": "string opcional",
  "email": "string opcional",
  "telefono": "string opcional",
  "canal_preferido": "email | telefono | whatsapp",
  "perfil": {},
  "resumen": "string",
  "productos": ["slug"],
  "tipo_handoff": "whatsapp | cotizacion",
  "consentimiento_datos": true
}
```

### Response

```json
{
  "ok": true,
  "lead_id": "uuid"
}
```

### Validation

- Nombre, contacto correspondiente al canal y consentimiento son obligatorios.
- El servidor selecciona versión y texto de consentimiento; el cliente no puede inyectarlos.
- Los slugs se resuelven contra productos activos.
- El upsert por `session_id` hace el endpoint idempotente.
- La respuesta no devuelve el contacto ni el perfil.
