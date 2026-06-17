# ADR-0009: Disponibilidad, comparador y reglas de visibilidad/pricing

- Fecha: 2026-06-17
- Estado: propuesto
- Alcance: catálogo, landings, carrito, checkout y backoffice

## Contexto

El sistema ya trata `productos.disponible` como señal operativa central y ya
dispone de:

- filtros de disponibilidad en catálogo;
- badges y CTAs comerciales por producto;
- revalidación en carrito;
- validación server-side en `crear-pago`;
- comparador local de hasta 3 productos;
- edición de `disponible` en backoffice.

Sin embargo, el contrato de negocio todavía debe quedar explícito para que el
comportamiento sea consistente cuando se añada pricing privado y acceso por
segmento/institución.

## Estado actual

- `productos.disponible` existe y se usa como señal de venta.
- `productos.stock` y `productos.stock_estado` complementan la disponibilidad,
  pero no la sustituyen.
- El checkout rechaza productos temporalmente no disponibles.
- El catálogo ya puede filtrar por disponibilidad y modalidad de fulfillment.
- El comparador es cliente-side y usa `localStorage`.
- El pricing actual es un precio base por producto, sin segmentación.

## Decisión

### 1. Jerarquía de señales

La disponibilidad visible y operativa se resolverá con esta jerarquía:

1. `activo`
2. `disponible`
3. `stock_estado`
4. `stock`
5. reglas de proveedor / fulfillment / segmento

Interpretación:

- `activo = false` oculta el producto del catálogo público y del SEO comercial
  normal;
- `disponible = false` mantiene el producto registrable, pero lo saca de venta
  en carrito/checkout;
- `stock_estado` y `stock` refinan el mensaje y el CTA, pero no deben contradecir
  `disponible`;
- las reglas de proveedor y segmento pueden reducir todavía más la visibilidad.

### 2. Fuente de verdad

- La fuente de verdad para venta directa será el backend.
- El cliente solo presenta estado derivado.
- El checkout siempre revalida:
  - disponibilidad;
  - stock;
  - tipo comercial;
  - modalidad de fulfillment;
  - precio resoluble;
  - reglas de segmento cuando existan.

### 3. Comparador

El comparador debe:

- permanecer en cliente para velocidad;
- comparar máximo 3 productos;
- mostrar datos normalizados y comparables;
- no mezclar precio base con precios privados si el usuario no tiene acceso;
- respetar disponibilidad y tipo de comercialización.

La tabla de comparación debe priorizar:

- nombre;
- disponibilidad;
- modalidad de fulfillment;
- tipo comercial;
- stock o mensaje equivalente;
- precio visible para el segmento actual;
- familia/tipo;
- atributos comparables.

### 4. Pricing

Se distinguen tres niveles de precio:

- precio base público;
- precio por tipo de institución/segmento;
- precio privado o negociado.

Reglas:

- si no hay contexto de usuario, mostrar solo precio base o CTA comercial;
- si el usuario está autenticado y tiene segmento, resolver el precio
  correspondiente;
- si existe precio privado, nunca exponerlo a usuarios sin permiso;
- el servidor recalcula siempre el precio final al cotizar o cobrar.

### 5. Visibilidad

El catálogo público seguirá mostrando:

- productos públicos;
- productos no comprables pero visibles como comerciales;
- productos agotados con CTA alterno.

El catálogo privado mostrará:

- productos restringidos al segmento;
- precios segmentados;
- contenidos o comparativas adicionales cuando estén habilitados.

### 6. Backoffice

El admin debe poder:

- editar `disponible`;
- revisar productos fuera de stock;
- ver productos con precio pendiente o inconsistente;
- distinguir catálogo público vs privado;
- detectar productos cuya modalidad de fulfillment no cuadra con su
  disponibilidad.

## Consecuencias

- Se reduce la ambigüedad entre stock, disponibilidad y precio.
- El comparador puede crecer sin exponer datos privados.
- La lógica de front y backend se alinea con una única jerarquía de señales.
- El pricing segmentado se puede incorporar después sin romper el catálogo
  actual.

## Riesgos

- Mostrar un precio público cuando el usuario debería ver un precio privado.
- Hacer que el comparador use datos no autorizados.
- Confundir `stock_estado` con `disponible`.
- Duplicar reglas en UI y backend sin un contrato estable.

## Validacion

- revisar catálogo público y privado;
- revisar checkout con productos disponibles/no disponibles;
- revisar comparador con 3 productos y sin acceso privado;
- `npm run check`
- `npm run build`
