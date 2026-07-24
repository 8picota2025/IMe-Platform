# Testing — CMS comercial

## Unitarias (Vitest)

Archivo: `src/lib/comercial-cms.test.ts`

Cubre:

- Normalización email/teléfono E.164
- Render de plantillas y rechazo de variables desconocidas
- Filtros jerárquicos (especialidad → familia → tipo → sección → búsqueda)
- Clave de idempotencia
- Helpers de permisos comerciales

Ejecutar:

```bash
npm test
```

## Integración / E2E manual

Checklist:

1. Login comercial (`ventas`) en `/comercial/`.
2. Especialidad → familia → subfamilia → productos.
3. Filtro sección (`equipo` / `consumible`).
4. Búsqueda por nombre/SKU con debounce.
5. Abrir landing pública en nueva pestaña.
6. Selección múltiple → modal → email (requiere `MAILER_*`).
7. WhatsApp → estado `prepared` + apertura `wa.me` (no marcar `sent`).
8. Historial `#/envios`.
9. Admin: `#/integraciones` status + reintento CRM.
10. Usuario sin perfil comercial: acceso denegado.
11. PWA: banner instalar en Chrome desktop/móvil (HTTPS o localhost).

## Automatización pendiente

- E2E Playwright del flujo completo (recomendado tras deploy de función + migración).
- Tests Deno de `twenty-crm.ts` con mock fetch.
