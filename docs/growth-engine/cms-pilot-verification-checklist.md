# Verificación pendiente del CMS y del piloto

Preparado el 2026-10-05. Estas comprobaciones están pendientes; no constituyen un QA
realizado ni autorización para publicar contenido de prueba en producción.

## Editor CMS — requisito previo a la tanda 5

Usar una sesión de `catalogo` o `ventas`. Probar primero en un entorno de pruebas con
las migraciones actuales y contenido equivalente al publicado.

1. Abrir Admin → Landings. Confirmar las 12 campañas, 9 fabricantes, 3 ciudades y
   21 familias; registrar usuario/rol, entorno, fecha y errores de carga.
2. Abrir un contenido de cada tipo en ES y EN. Confirmar textos e imágenes y que
   rutas e identidad no se pueden editar.
3. Guardar un cambio como borrador. Recargar y confirmar que se conserva; la versión
   publicada debe permanecer intacta.
4. Probar la vista previa y la validación de campos obligatorios. Registrar el
   comportamiento y cualquier diferencia entre idiomas.
5. En el entorno de pruebas, publicar el borrador y comprobar historial, incremento
   de versión, rebuild y contenido generado.
6. Recuperar la versión anterior y verificar nuevamente historial y contenido.
7. Confirmar que un rol de lectura no puede guardar ni publicar.
8. Revisar incidencias desde el despliegue de las tandas 1–3. Registrar evidencia antes
   de retirar el respaldo TS; después comparar HTML, metadatos, hreflang y JSON-LD
   con datos reales en una build antes de fusionar.

No borrar el copy TS hasta completar estos puntos. La disponibilidad HTTP de las
landings públicas no prueba el editor ni sus permisos.

## Arranque del piloto Monitoreo/UCI

| Pendiente                          | Evidencia para cerrarlo                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Revisión del PDF por el Ing. Rojas | Aprobación identificable de la versión del PDF que se entregará                                                               |
| Posts de canal                     | Piezas aprobadas y enlaces UTM revisados del paquete existente                                                                |
| Vista Twenty                       | Vista «Lead magnet — por explorar», con filtro Job Title contiene `Lead magnet`                                               |
| Conversión completa                | Prueba controlada autorizada: registro del lead, descarga, eventos y contacto/nota CRM; sin abrir oportunidad por lead magnet |

Tras aprobar y publicar los posts, registrar la fecha de inicio y observar durante
3–4 semanas el dashboard del piloto: visitas por etapa/canal, uso de la herramienta,
leads y cotizaciones. Separar los registros de prueba de los resultados comerciales.

## Disponibilidad comprobada el 2026-10-05

- `/es/conocimiento/`: HTTP 200, 19 artículos publicados.
- `/es/dotacion-monitoreo-uci/`: HTTP 200.
- `/es/recursos/checklist-recepcion-monitor/`: HTTP 200.
- `/en/icu-monitoring-projects/`: HTTP 200.
- `/en/resources/monitor-receiving-checklist/`: HTTP 200.
- `/admin/`: HTTP 200. El editor requiere una sesión autorizada; `/es/admin/` no es
  la ruta del panel.

Sin envío de formularios ni comprobación de métricas o registros CRM reales.
