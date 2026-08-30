# QA catálogo

## Evidencia

- Build: 715 fichas de producto ES, 21 landing de familia ES y paginación generada.
- Browser: catálogo muestra 708 equipos, 19 categorías, tipo, disponibilidad,
  modalidad, búsqueda, orden, comparación y añadir a cotización.
- Build produce rutas ES/EN de productos, familias, fabricantes y páginas paginadas.
- `audit:seo-build`: OK, 1.642 HTML y un sitemap XML.

## Riesgos

- Snapshot documentado: 476 productos activos y 90 sin embedding. Contrastar remoto.
- Build registró `getProductosBySlugs` con 0 filas y usó mock como respaldo. Esto es
  seguro para build local, pero bloquea publicación si ocurre con datos reales.
- PDFs placeholder/asignados incorrectamente y fichas incompletas constan en pendientes.

Validar en preprod: productos sin imagen/fabricante/referencia, duplicados,
familias incorrectas, PDFs 404, filtros URL, paginación final y CTA por fulfillment.
