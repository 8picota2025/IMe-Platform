# Landings INVIMA orientadas a fabricantes

Se conservan las URLs del hub, del artículo pilar y del checklist para mantener
el enlazado existente. El contenido ES/EN amplía la información para fabricantes
nacionales y extranjeros: preparación documental, costes oficiales y de
preparación, calendario por etapas, errores que provocan reprocesos y solicitud
de acompañamiento a I-ME. La verificación para compradores sigue incluida.

La experiencia de I-ME se comunica sin inventar cifras de expedientes, clientes,
porcentajes de ahorro ni garantías de aprobación. La ruta eficiente consiste en
identificar requisitos y faltantes antes de radicar, sin saltarse controles.

## Fuentes revisadas el 6 de octubre de 2026

- [Dispositivos médicos y equipos biomédicos — INVIMA](https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/dispositivos-medicos-equipos-biomedicos).
- [Decreto 4725 de 2005 y anotaciones vigentes](https://normograma.invima.gov.co/compilacion/docs/decreto_4725_2005.htm).
- [Tarifas vigentes — INVIMA](https://www.invima.gov.co/tramites-y-servicios/tarifas).

No se fijan valores económicos ni plazos universales. Se distingue el tiempo
para preparar documentos del tiempo de evaluación y de la entrada comercial.

## Vista previa y publicación

Los dos Markdown de `src/data/conocimiento-borradores/` permiten revisar la
reescritura con `PREVIEW_DRAFTS=true`. En producción el contenido procede del
CMS; añadir estos archivos por sí solo no cambia los artículos publicados.

La migración `20261006163518_ampliar_landings_invima_fabricantes.sql` actualiza
los artículos existentes conservando sus IDs, URLs, imágenes y fechas originales
de publicación. Añade las etiquetas del fabricante y descarta el embedding
anterior cuando cambia el texto, para que el asesor no recupere un vector obsoleto.
Debe aplicarse en Supabase antes de reconstruir el sitio de producción.

Secuencia de publicación:

1. Aplicar únicamente la migración de esta entrega mediante el proceso habitual
   de migraciones del proyecto, tras revisar los cambios pendientes.
2. Regenerar embeddings con el proveedor configurado del proyecto mediante
   `npm run reindex:voyage:articles`.
3. Reconstruir con datos vivos y `PREVIEW_DRAFTS` desactivado; ejecutar las
   comprobaciones SEO y publicar mediante el flujo habitual de producción.
4. Verificar ES/EN: hub `invima-regulacion`, artículo
   `registro-sanitario-invima-equipos-biomedicos` y checklist
   `checklist-invima-compra-equipos-medicos`, enlaces de contacto y metadatos.

La migración fue aplicada al CMS de producción el 6 de octubre de 2026. La
publicación del sitio se realiza mediante el flujo habitual de GitHub Actions.

## Validación realizada

- Lint de los archivos TypeScript y Astro modificados: correcto.
- Comprobación Astro del código principal (`src` y paquete compartido): cero
  errores en 321 archivos. La comprobación global incluye la copia anidada no
  rastreada `IMe-Platform/` y falla con 497 errores; no se modificó esa copia.
- Pruebas existentes de artículos, temas, imágenes y slugs: 25 pruebas correctas.
- Build de vista previa con borradores y sin acceso al CMS: 1.475 páginas.
- Las seis páginas INVIMA ES/EN tienen un H1, idioma, canonical, descripción,
  enlace de contacto y destinos INVIMA internos válidos.
- El contenido ES/EN de la migración coincide con los Markdown de revisión.

La vista previa local está en `.ime-watch/invima-preview/`. No es un artefacto
para desplegar: contiene el indicador de borrador y usa los datos de respaldo
del resto del sitio. No se pudo revisar visualmente porque esta sesión no tiene
un navegador disponible; sí se verificó el HTML generado.
