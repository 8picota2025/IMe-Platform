# PDF de cotización: tabla multipágina

Ejemplo sintético de 20 líneas, 7 con precio pendiente, con tres líneas de resumen
por producto y fuentes Poppins del sitio. No es una oferta comercial ni contiene
datos de clientes. Fecha fija: 05/10/2026.

- [Antes](before.pdf): cuatro filas en tabla; el resto en lista después de los totales.
- [Después](after.pdf): 20 filas en tres páginas de tabla (6 + 9 + 5), totales y
  validez después de la fila 20, seguidos por las consideraciones.
- [Lista anterior](before-overflow.png) y [última página de tabla corregida](after-final-table.png).

Subtotal 26.000 COP, IVA 4.940 COP, total 30.940 COP; las siete líneas pendientes
no se suman. Las cantidades/precios son datos sintéticos exclusivamente de prueba.

## Verificación automatizada

`npx vitest run src/lib/render-quote-pdf.test.ts` extrae el texto y las posiciones
reales del PDF: 0, 1, 9, 15, 20 y 60 líneas, español e inglés, con y sin resumen;
comprueba filas completas, pendientes en ambas columnas, totales únicamente al
final y separados del footer. También renderiza con las fuentes Poppins.

Para generar el PDF corregido:

```sh
QUOTE_PDF_EXAMPLE_DIR=/tmp/ime-quote-review npx vitest run src/lib/render-quote-pdf.test.ts
```

## Asesor

La vista previa nueva de `comercial-cotizacion?action=pdf` omitía el asesor en el
snapshot. Ahora resuelve el perfil de `created_by` con `asesorDeUsuario`, y utiliza
«Equipo Comercial I-ME» cuando no hay nombre válido, evitando emails como nombre.
El envío ya resolvía el asesor y se conserva su comportamiento. Los PDFs almacenados
se siguen devolviendo sin regeneración, salvo petición explícita `fresh=1`.

## Checklist en entorno de prueba tras desplegar las Edge Functions

- [ ] Crear una cotización de prueba con al menos 15 líneas, mezclando precios
      validados y pendientes; incluir resúmenes de especificaciones.
- [ ] Abrir su PDF nuevo desde `/comercial`, o solicitar autenticadamente
      `comercial-cotizacion?action=pdf&id=<id-prueba>&fresh=1`.
- [ ] Confirmar todas las líneas en tablas con CANT/REF/DESCRIPCION/PRECIO UNIT/TOTAL.
- [ ] Confirmar cabecera y rejilla en cada página, pendientes en ambas columnas,
      totales y validez al final, asesor visible y consideraciones después.

Esta comprobación de integración queda pendiente del despliegue. No se regeneraron
cotizaciones históricas ni se modificaron datos de producción.
