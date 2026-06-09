# FASE 3 revisada — CMS admin, ingesta PDF→contenido y publicar→rebuild

**Objetivo:** crear un back-office funcional y seguro que gestione taxonomía, productos, cotizaciones y pedidos; ingiera fichas PDF mediante LLM con revisión humana obligatoria; y publique cambios mediante rebuild estático.

```txt
[PEGAR CONTEXTO MAESTRO]

PRECONDICIÓN:
F0-F2 completadas. Existen schema.sql, capa de datos, catálogo, landings, páginas públicas, Edge Functions scaffolding y rutas admin placeholder.

OBJETIVO F3:
Admin seguro + CRUD de taxonomía/productos + ingesta PDF→borrador bilingüe + revisión humana obligatoria + publicar→rebuild. NO implementar asesor RAG, embeddings definitivos, carrito ni checkout.

REGLA RECTORA:
La IA propone; una persona valida. Nada generado por IA llega publicado sin revisión humana. Lo no presente en PDF queda vacío y marcado.

DECISIÓN REVISADA:
Crear en F3 un gateway LLM mínimo para ingesta PDF. La Fase Asesor ampliará ese gateway con presupuesto, embeddings, RAG y controles de abuso.

==================================================================
1. ADMIN SHELL + AUTENTICACIÓN
==================================================================
- Rutas /admin con meta noindex.
- SPA TypeScript vanilla, sin React.
- CSS propio mínimo, funcional, no premium.
- Supabase Auth signInWithPassword.
- Sin registro público.
- Usuario admin creado manualmente en Supabase; documentar en ADMIN_GUIDE.md.
- Manejo de sesión, expiración y logout.
- Guard de rutas: sin sesión → login.
- Router hash o history simple.

Estructura:
- src/admin/admin-app.ts
- src/admin/admin.css
- src/admin/router.ts
- src/admin/views/login.ts
- src/admin/views/dashboard.ts
- src/admin/views/productos.ts
- src/admin/views/producto-form.ts
- src/admin/views/taxonomia.ts
- src/admin/views/cotizaciones.ts
- src/admin/views/pedidos.ts
- src/admin/views/proveedores.ts
- src/admin/views/proveedor-form.ts
- src/admin/views/proveedor-productos.ts
- src/admin/views/fulfillments.ts
- src/admin/views/conocimiento.ts
- src/admin/views/ingesta-pdf.ts
- src/admin/components/table.ts
- src/admin/components/toast.ts
- src/admin/components/upload.ts
- src/admin/components/confirm.ts
- src/admin/components/campo-revisable.ts

==================================================================
2. DASHBOARD
==================================================================
Tarjetas:
- total productos.
- productos activos.
- destacados.
- nuevos.
- sin tipo asignado.
- cotizaciones sin leer.
- pedidos sin leer.
- publicaciones pendientes.
- último build/deploy.

Accesos:
- crear producto.
- ingesta PDF.
- taxonomía.
- cotizaciones.

==================================================================
3. TAXONOMÍA
==================================================================
Familias:
- CRUD: slug, nombre_es, nombre_en, descripcion_es, descripcion_en, orden, activo.

Tipos:
- CRUD por familia: slug, nombre_es, nombre_en, orden, activo.
- Unique familia_id+slug.

Reasignación:
- mover productos entre familias/tipos.
- ver conteo de productos por tipo.
- detectar productos sin tipo.

Validación:
- slug estable.
- evitar eliminar familia/tipo con productos sin confirmación explícita.
- si se desactiva familia/tipo, documentar efecto en catálogo.

==================================================================
4. PRODUCTOS CRUD COMPLETO
==================================================================
Lista:
- mini imagen.
- nombre.
- familia.
- tipo.
- activo/destacado/nuevo.
- tipo_comercial.
- stock/precio si consumible.
- acciones editar/eliminar.
- búsqueda.
- filtros familia/tipo/activo/tipo_comercial.
- paginación.

Formulario:
- slug auto desde nombre, editable.
- pestañas ES/EN.
- nombre_es/en.
- descripcion_corta_es/en.
- descripcion_larga_es/en.
- familia.
- tipo.
- especificaciones editor:
  - clave.
  - valor_es.
  - valor_en.
  - grupo.
  - origen.
- aplicaciones_es/en.
- tipo_comercial: consumible|equipo.
- fulfillment_mode: dropship|cotizacion|individualizado.
  Descripción contextual:
  - dropship: el proveedor asignado se notifica automáticamente al confirmar el pedido.
  - cotizacion: entra como solicitud sin fulfillment automático.
  - individualizado: producto de alto valor, flujo personal sin notificación automática.
- precios:
  - precio COP (campo único).
  - moneda.
  - stock.
- imagen_principal upload.
- galeria upload múltiple.
- ficha_pdf upload.
- destacado/nuevo/activo.
- orden.

Uploads:
- Supabase Storage buckets productos/fichas.
- validación tipo/tamaño.
- progreso.
- URL pública.
- borrado de assets huérfanos al eliminar si es seguro.

Validación:
- slug único.
- obligatorios mínimos.
- especificaciones JSON válido.
- precio requerido si consumible y se habilita compra.
- equipo no requiere precio.

==================================================================
5. GATEWAY LLM MÍNIMO PARA INGESTA
==================================================================
Crea en supabase/functions/_shared/llm-gateway.ts:
- interface LLMGateway.
- implementación Anthropic o OpenAI según env.
- sin claves en cliente.
- manejo de timeout.
- errores normalizados.
- logging mínimo sin contenido sensible.

Variables documentadas:
- LLM_PROVIDER=anthropic|openai
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- LLM_INGEST_MODEL

No implementes aún presupuesto mensual completo; eso llega en Fase Asesor. Sí deja puntos de extensión.

==================================================================
6. INGESTA PDF → CONTENIDO
==================================================================
Flujo:
1. Subir ficha PDF.
2. Edge Function ingesta-pdf recibe PDF o URL Storage.
3. LLM extrae JSON estructurado.
4. Admin muestra borrador junto al PDF.
5. Humano revisa campo a campo.
6. Guardar crea/actualiza producto como activo=false.
7. Publicar es paso separado.

Edge Function supabase/functions/ingesta-pdf:
- Deno.
- CORS restringible.
- requiere auth admin.
- recibe URL de PDF o archivo.
- llama gateway LLM.
- soporta PDFs de texto y, si proveedor lo permite, escaneados/visión.
- si baja confianza, marcar campos.
- nunca escribe en BD.

Prompt interno estricto:
"Extrae únicamente lo que aparece en el PDF. No inventes ni completes especificaciones, cifras, certificaciones, marcas, usos, compatibilidades, claims, garantías ni precios. Campo no presente: valor vacío, origen='ausente', requiere_revision=true. Devuelve JSON válido con nombre, familia_sugerida, tipo_sugerido, descripcion_corta, descripcion_larga, especificaciones [{clave, valor, grupo, origen, confianza}], aplicaciones[], meta_seo {title, description}. Genera EN solo como traducción borrador de campos extraídos, marcando requiere_revision=true. No traduzcas unidades ni cifras alterándolas."

Respuesta JSON:
- producto_es.
- producto_en_borrador.
- campos_confianza.
- ausentes.
- advertencias.
- raw_model_id.

UI de revisión:
- visor PDF lateral.
- campo-revisable con estados:
  - extraído del PDF.
  - ausente / requiere cliente.
  - traducción borrador.
  - baja confianza.
- editar campo a campo.
- checkbox "revisado" por campo marcado.
- guardar deshabilitado hasta resolver campos obligatorios marcados.
- guardar como borrador activo=false.

PROHIBIDO:
- autoguardar.
- autopublicar.
- rellenar campos vacíos.
- convertir baja confianza en dato final sin revisión.

==================================================================
7. PUBLICAR → REBUILD
==================================================================
- Publicar producto = activar producto y encolar publicación.
- Edge Function trigger-rebuild guarda secreto del CI/deploy hook.
- Cliente admin nunca ve secreto.
- Batching/cooldown:
  - opción recomendada: botón "Publicar cambios pendientes".
  - alternativa: ventana N minutos.
- Workflow CI con concurrency cancel-in-progress.
- Estado visible:
  - borrador.
  - pendiente de publicación.
  - publicando.
  - publicado timestamp.
  - error con detalle seguro.
- Historial:
  - qué cambió.
  - quién.
  - cuándo.
  - resultado.

Nota: embeddings todavía NO se generan en F3; eso llega en Fase Asesor. Deja hook documentado.

==================================================================
8. COTIZACIONES Y PEDIDOS
==================================================================
Cotizaciones:
- tabla cronológica inversa.
- detalle.
- marcar leída.
- exportar CSV.
- productos solicitados.
- mensaje.
- consentimiento datos si existe.

Pedidos:
- vista lista funcional aunque F4 los llenará.
- columnas: fecha, cliente, items, total, moneda, mercado, proveedor, estado, referencia, leída.
- detalle.
- cambiar estado manual permitido solo con advertencia.
- exportar CSV.

==================================================================
9. MÓDULO DROPSHIPPING — PROVEEDORES Y FULFILLMENTS
==================================================================

VISTA PROVEEDORES (/admin → Proveedores):
- CRUD: slug, nombre, contacto_email, contacto_whatsapp, canal
  (email|whatsapp|webhook|api|manual), webhook_url, api_config JSON, notas, activo.
- Lista con nombre, canal, activo y nº de productos asignados.
- Validar slug único.

VISTA ASIGNACIÓN PROVEEDOR-PRODUCTO (/admin → Proveedores → [proveedor] → Productos):
- Para cada proveedor: lista de productos asignados con precio_costo, moneda, prioridad.
- Buscar y añadir productos desde el catálogo.
- Editar precio_costo (campo marcado CONFIDENCIAL en UI, nunca expuesto en APIs públicas).
- Si un producto con fulfillment_mode='dropship' no tiene proveedor asignado, mostrar
  alerta visible en el dashboard: "X productos en modo dropship sin proveedor".

VISTA FULFILLMENTS (/admin → Fulfillments):
- Lista por pedido: pedido, proveedor, estado, tracking, fechas.
- Filtros: estado, proveedor, rango de fechas.
- Acciones: ver detalle, cambiar estado manualmente, añadir/editar tracking,
  reenviar notificación al proveedor (llama a Edge Function notificar-proveedor).
- Panel de estadísticas: pendientes, notificados, enviados, entregados, con error.

==================================================================
10. CONOCIMIENTO STUB
==================================================================
- Gestión mínima marcada BACKLOG_V2.
- No construir CMS completo de artículos.
- No inventar artículos.

==================================================================
11. SEGURIDAD
==================================================================
- RLS verificada.
- Admin noindex.
- Sin registro público.
- service_role solo en Edge Functions.
- claves LLM solo en Edge Functions.
- validar input.
- errores sin filtrar internals.
- grep en cliente/dist de service_role, SERVICE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, WOMPI_, STRIPE_SECRET debe dar 0.

==================================================================
12. DOCUMENTACIÓN
==================================================================
ADMIN_GUIDE.md:
- crear usuario admin.
- configurar Supabase.
- entrar a /admin.
- crear familia/tipo.
- crear producto.
- usar ingesta PDF.
- revisar borrador.
- subir imágenes/PDF.
- publicar.
- entender rebuild.
- gestionar cotizaciones/pedidos.
- exportar CSV.
- errores comunes.

==================================================================
PROHIBIDO EN F3
==================================================================
- Autopublicar contenido IA.
- Inventar datos ausentes.
- Implementar asesor RAG.
- Generar embeddings definitivos.
- Implementar carrito/checkout.
- Exponer claves.
- Disparar build por cada microedición.

==================================================================
ENTREGABLES F3
==================================================================
- Admin SPA.
- Login y guard.
- Dashboard.
- Taxonomía CRUD.
- Productos CRUD.
- Uploads Storage.
- ingesta-pdf Edge Function.
- gateway LLM mínimo.
- UI revisión humana.
- trigger-rebuild Edge Function.
- workflow batching/cooldown.
- cotizaciones y pedidos admin.
- export CSV.
- ADMIN_GUIDE.md.
- PENDIENTES.md actualizado.

==================================================================
CRITERIOS DE ACEPTACIÓN F3
==================================================================
- Sin sesión no se accede a admin.
- Crear/editar familias, tipos y productos funciona.
- PDF genera borrador estructurado bilingüe, con origen/confianza por campo.
- Guardar no publica; queda borrador.
- Publicar dispara rebuild documentado/verificado o NO_EJECUTADO_ENTORNO.
- Ninguna clave sensible en cliente/dist.
- Cotizaciones exportables.
- Reporte de cierre con ruta publicar→rebuild.
```
