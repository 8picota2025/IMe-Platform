# Configuración administrativa de IME Congreso

Configuración usa paneles administrativos existentes. No hay pantalla de configuración visible en `/congreso` para comerciales.

La captura permite seleccionar varios productos; la selección permanece al cambiar filtro o familia. La tarjeta se procesa con OCR y sus datos se cargan en campos editables antes del envío.

Documentación completa:

- Arquitectura y flujos: `docs/congreso-architecture.md`
- Setup y deploy: `docs/congreso-setup.md`
- Checklist QA: `docs/congreso-testing.md`

## Plantilla de email

En `/admin` → `Emails`, edita plantilla `comercial_catalogo`. Variables usadas por el envío:

- `{{nombre_destinatario}}`
- `{{nombre_comercial}}`
- `{{centro_medico}}`
- `{{mensaje}}`
- `{{lista_productos_html}}`
- `{{correo_comercial}}`
- `{{telefono_comercial}}`

## Productos habilitados

En `/admin` → `Productos` → `Atributos JSON`, un administrador puede ocultar producto de Congreso con:

```json
{
  "congreso_habilitado": false
}
```

Si la clave no existe o vale `true`, el producto sigue disponible cuando tiene landing enriquecida y `ficha_pdf`.

La validación se repite en Edge Function `congreso-lead`; un comercial no puede habilitar un producto enviando un payload manual.

## Eventos

Los eventos disponibles se definen en código (`src/congreso/events.ts`). Para añadir un congreso nuevo, actualizar `CONGRESO_EVENTS` y desplegar frontend. URL: `/congreso/?evento=<slug>`.

## Copy WhatsApp/email del evento

Los mensajes post-registro para ACISE2026 están embebidos en `src/congreso/congreso-app.ts`. Cambios de copy por evento requieren PR de código hasta migrar a plantillas DB.
