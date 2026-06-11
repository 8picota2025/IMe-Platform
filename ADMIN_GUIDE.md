# ADMIN GUIDE — I-ME

## Acceso

1. Crear proyecto Supabase y aplicar `supabase/schema.sql`.
2. Configurar `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` en el entorno del sitio.
3. Crear manualmente el usuario admin en Supabase Auth. No existe registro publico.
4. Entrar a `/admin` e iniciar sesion con email y contrasena.

## Taxonomia

- Crear primero familias, luego tipos asociados a una familia.
- No eliminar familias o tipos que tengan productos sin revisar reasignacion.
- Desactivar una familia o tipo la oculta del catalogo publico por RLS.

## Productos

- `Guardar borrador` crea o actualiza el producto.
- `activo=false` mantiene el producto fuera del sitio publico.
- `activo=true` lo deja listo para el siguiente rebuild estatico.
- `precio` es el unico precio publico en COP. `precio_costo` vive solo en proveedor_producto y nunca debe exponerse al cliente.
- Para consumibles con compra futura, el precio real debe estar aprobado antes de activar checkout.

## Uploads

- Imagenes van al bucket `productos`.
- Fichas tecnicas PDF van al bucket `fichas`.
- Los buckets se crean desde `schema.sql`. Si faltan permisos, revisar Storage RLS en Supabase.

## Ingesta PDF

1. Subir o pegar la URL de la ficha PDF.
2. Pegar texto extraido del PDF cuando el documento no pueda enviarse como texto.
3. Ejecutar ingesta.
4. Revisar el JSON campo a campo: origen, confianza, ausentes y advertencias.
5. Crear o actualizar el producto manualmente como `activo=false`.
6. Activar solo despues de revision humana.

La IA no publica, no autoguarda y no debe completar datos ausentes.

## Publicar Cambios

- El boton `Publicar cambios` llama a `trigger-rebuild`.
- La Edge Function usa `CI_DEPLOY_HOOK` o `GITHUB_TOKEN` server-side.
- El secreto nunca se devuelve al cliente.
- Si no hay credenciales de CI, queda como `NO_EJECUTADO_ENTORNO`.

## Cotizaciones y Pedidos

- Cotizaciones y pedidos se listan en orden cronologico inverso.
- Se pueden marcar como leidos.
- El boton CSV descarga los datos visibles para revision comercial.

## Errores Comunes

- Pantalla de configuracion pendiente: faltan `PUBLIC_SUPABASE_URL` o `PUBLIC_SUPABASE_ANON_KEY`.
- Login falla: el usuario no existe en Supabase Auth o la contrasena es incorrecta.
- Tablas vacias con sesion valida: revisar que `schema.sql` se haya ejecutado en el proyecto correcto.
- Publicacion falla: faltan `CI_DEPLOY_HOOK` o `GITHUB_TOKEN`/`GITHUB_REPOSITORY`.
