# Configuración administrativa de IME Congreso

Configuración usa paneles administrativos existentes. No hay pantalla de configuración visible en `/congreso` para comerciales.

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

La validación se repite en Edge Function; un comercial no puede habilitar un producto enviando un payload manual.
