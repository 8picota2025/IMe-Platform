# Testing — IME Congreso

## Pre-requisitos

- Usuario `ventas` activo en `admin_profiles`.
- Al menos un producto elegible (landing enriquecida + `ficha_pdf` + `congreso_habilitado` ≠ false).
- `MAILER_*` configurado si se prueba email.
- Puente OCR operativo si se prueba escaneo de tarjeta (`./scripts/ocr-bridge-up.sh --status`).

## Checklist manual (piso de evento)

### Auth y acceso

1. `/congreso/` sin sesión → panel login Supabase.
2. Usuario sin perfil comercial → «Esta herramienta requiere una cuenta comercial activa».
3. Login ventas → carga catálogo y formulario.
4. Cerrar sesión → vuelve a login.
5. Idle 15 min → logout automático (mismo comportamiento que `/comercial/`).

### Catálogo y selección

6. Solo productos elegibles visibles (con ficha PDF y landing enriquecida).
7. Producto con `congreso_habilitado: false` no aparece.
8. Búsqueda por nombre filtra lista.
9. Filtro por familia filtra sin perder selección previa.
10. Selección multi-producto (checkbox) — contador actualizado.
11. Cambiar búsqueda/familia conserva productos ya seleccionados.
12. Botón «Registrar y enviar» deshabilitado sin productos seleccionados.

### OCR tarjeta

13. Input cámara (`capture=environment`) abre cámara en móvil.
14. Foto legible → campos nombre/apellidos/institución/email/teléfono rellenados.
15. Mensaje «Datos OCR cargados. Revísalos antes de registrar».
16. OCR fallido → error visible, formulario editable manualmente.
17. Comercial puede corregir campos OCR antes de enviar.

### Registro y envío

18. Sin consentimiento → error de validación.
19. Email canal marcado pero sin email → error.
20. WhatsApp canal marcado pero sin teléfono → error.
21. Registro OK → pantalla éxito con lead asociado.
22. Email enviado vía `comercial-share` (requiere Resend).
23. WhatsApp → enlace `wa.me` en pantalla éxito (no marca sent automático).
24. «Atender siguiente visitante» limpia formulario y selección.

### Server-side (curl / DB)

25. `congreso-lead` rechaza producto no habilitado (422).
26. Idempotency key duplicada → mismo `leadId`, `idempotent: true`.
27. Rate limit tras ráfaga de registros → 429.
28. Fila en `leads_comerciales` con `metadata.origen=congreso` y snapshots de productos.

### PWA

29. Banner instalar visible en Chrome (HTTPS/localhost).
30. PWA instalada abre en `/congreso/` standalone.
31. Tras deploy: hard refresh actualiza assets.

## Prueba OCR (curl)

```bash
# TOKEN = JWT ventas/admin
# IMG_B64 = base64 JPEG sin prefijo data:

curl -sS -X POST "$PUBLIC_SUPABASE_URL/functions/v1/congreso-ocr" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$IMG_B64\",\"mime\":\"image/jpeg\"}"
```

Expect `ok: true`, `extract` con `nombres`, `apellidos`, `institucion`, `email`, `telefono`.

## Errores esperados

| HTTP | Mensaje | Causa |
| ---- | ------- | ----- |
| 401 | unauthorized | JWT inválido o rol no comercial |
| 422 | OCR fallo | Puente caído o imagen ilegible |
| 422 | Producto no habilitado | Payload con ID no elegible |
| 422 | Datos incompletos | Falta consentimiento o campos requeridos |
| 429 | Demasiadas solicitudes | Rate limit lead u OCR |

## Automatización pendiente

- E2E Playwright del flujo completo congreso (auth → multi-select → lead).
- Test Deno de validación productos en `congreso-lead`.
