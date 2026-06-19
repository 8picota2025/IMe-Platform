# ADR-0008: Identidad comercial, segmentacion, portal de cliente y catalogo privado

- Fecha: 2026-06-17
- Estado: propuesto
- Alcance: auth, pricing, acceso al catalogo y portal de cliente

## Contexto

La base actual ya modela `clientes`, `cliente_direcciones`, `pedidos` y
`solicitudes_cotizacion`, pero la experiencia sigue siendo esencialmente
anónima: el visitante entra al catalogo, consulta, añade al carrito y, solo al
final, deja sus datos.

Para evolucionar hacia un e-commerce B2B/B2C más maduro hace falta:

- registro público de clientes;
- portal de cliente con acceso a historial y documentos;
- catálogo privado para segmentos autenticados;
- precios por tipo de institución o segmento;
- reglas de visibilidad que no rompan el catálogo público existente.

## Estado actual

- `clientes` existe en Supabase, con `email`, `nombre`, `apellido`,
  `institucion` y `tipo_cliente` (`b2b`, `b2c`, `mixto`).
- `pedidos` ya referencia `cliente_id`.
- `cliente_direcciones` ya existe para facturación/envío/legal.
- El backoffice administra clientes, pero no hay portal público autenticado.
- El catálogo público no diferencia precio por segmento.
- No existe una relación explícita entre `auth.users` y `clientes`.

## Decisión

Se propone construir la capa de identidad comercial con estas reglas:

### 1. Identidad de cliente

- Cada usuario autenticado del portal de cliente debe quedar ligado a un
  registro de `clientes`.
- La relación debe ser explícita y estable:
  - `clientes.user_id` o tabla puente equivalente.
- El email sigue siendo la clave operativa principal para onboarding y
  conciliación comercial.

### 2. Segmentacion comercial

- El sistema debe diferenciar al menos:
  - `b2b`
  - `b2c`
  - `mixto`
- A nivel comercial se podrá extender a:
  - tipo de institución;
  - listas privadas;
  - niveles de precio;
  - acceso a catálogo privado.

### 3. Portal de cliente

El portal de cliente debe permitir, como mínimo:

- ver perfil y direcciones;
- ver pedidos;
- ver cotizaciones;
- ver estados y documentos asociados cuando existan;
- consultar precios y contenidos permitidos según su segmento.

### 4. Catalogo privado

- El catálogo privado no reemplaza el público.
- Debe coexistir con el catálogo público actual.
- Un producto puede:
  - ser público;
  - ser privado;
  - ser visible solo para determinados segmentos;
  - tener pricing condicionado por tipo de institución.

### 5. Pricing segmentado

- El precio base seguirá viviendo en `productos.precio` mientras exista un
  precio común.
- Cuando aplique segmentación, la UI y el backend deberán resolver:
  - precio general;
  - precio por tipo de institución;
  - precio privado por segmento o lista autorizada.
- La resolución de precio siempre será server-side al confirmar pagos o
  cotizaciones.

## Modelo propuesto

### A. Relación cliente-usuario

Opción recomendada:

- añadir `clientes.user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL`;
- indexarlo y usarlo para portal de cliente;
- mantener `email` como identificador comercial.

### B. Tabla de precios segmentados

Para no sobrecargar `productos`, crear una tabla auxiliar, por ejemplo:

- `producto_precios_segmentados`
  - `producto_id`
  - `segmento`
  - `tipo_institucion`
  - `moneda`
  - `precio`
  - `activo`
  - `prioridad`
  - `created_at`
  - `updated_at`

Esto permite:

- precios por clínica, hospital, distribuidor, universidad, etc.;
- precios privados por lista;
- fallback al precio base.

### C. Acceso al catalogo

El catálogo se resolverá con una vista/índice server-side que combine:

- visibilidad pública;
- pertenencia a segmento;
- estado de autenticación;
- reglas de acceso privado.

## Consecuencias

- El onboarding de cliente pasa de ser puramente transaccional a tener
  continuidad post-compra.
- Se pueden habilitar experiencias privadas sin romper el catálogo público.
- El pricing deja de depender de un único campo y pasa a tener resolución por
  contexto.
- Hará falta una migración de datos y un diseño de RLS específico para evitar
  filtraciones de precios privados.

## Riesgos

- Exponer precios privados por error en cliente público.
- Duplicar reglas comerciales entre front y backend.
- Crear demasiados tipos de segmento sin un diccionario de negocio estable.
- Mezclar portal de cliente con administración interna.

## Validacion

- schema migration review
- RLS review
- pruebas de acceso público vs privado
- check/build después de la implementación
