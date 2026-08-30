# QA CMS

El código cubre administración de productos, familias, artículos, imágenes, PDF,
usuarios, leads, cotizaciones y sincronización. Tests locales pasan, pero no hubo
sesión admin ni conexión Supabase durante esta auditoría.

| Flujo                          | Estado                                  | Clasificación          |
| ------------------------------ | --------------------------------------- | ---------------------- |
| Login/Auth                     | Probado, según confirmación del usuario | CONFIRMADO POR USUARIO |
| RBAC completo                  | Pendiente de matriz por rol             | REQUIERE VERIFICACIÓN  |
| CRUD producto                  | Tests/código local                      | REQUIERE VERIFICACIÓN  |
| Ingesta PDF + revisión         | No ejecutado con proveedor              | NO_EJECUTADO_ENTORNO   |
| Publicar → embedding → rebuild | Código/workflow presentes               | REQUIERE VERIFICACIÓN  |
| Upload Storage/RLS             | No ejecutado remoto                     | NO_EJECUTADO_ENTORNO   |

Gate recomendado: fixture admin aislada, datos de prueba prefijados y rollback
transaccional; nunca usar registros reales para CRUD destructivo.
