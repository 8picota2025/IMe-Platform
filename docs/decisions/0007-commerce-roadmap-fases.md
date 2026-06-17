# ADR-0007: Roadmap de ampliacion e-commerce por fases

- Fecha: 2026-06-17
- Estado: propuesto
- Objetivo: convertir la base actual en una plataforma e-commerce B2B/B2C
  mas completa, sin eliminar funcionalidades ya implementadas.

## Alcance

Este roadmap organiza la evolucion del producto en fases ejecutables para
cubrir:

- `productos.disponible`
- facturacion electronica DIAN
- IVA y retenciones automáticas
- logistica y calculo de envio
- devoluciones y reembolsos automatizados
- multi-proveedor con comparacion de precios
- portal publico de tracking
- blog/CMS de contenidos
- email marketing y fidelizacion
- comparador avanzado
- historial persistente del Asesor
- modo multimodal
- recomendaciones personalizadas
- streaming SSE
- registro publico de clientes
- portal de cliente
- precios por tipo de institucion
- catalogo privado

## Principios

- No eliminar ninguna funcionalidad existente.
- Mantener una fuente de verdad clara por dominio.
- Priorizar reglas de negocio antes que UI nueva.
- Hacer visible el estado real del pedido, la cotizacion y la disponibilidad.
- Conservar compatibilidad degradada mientras se migran datos o automatismos.

## Fase 0. Inventario tecnico

Objetivo: entender el estado real del sistema antes de ampliar alcance.

Entregables:

- mapa de uso actual de `productos.disponible` en schema, checkout, catalogo,
  landings y admin;
- inventario de tablas y flujos relacionados con pedidos, cotizaciones,
  fulfilment, clientes y contenido;
- lista de dependencias entre Supabase, Edge Functions, UI web y backoffice.

Exit criteria:

- no hay caminos funcionales no mapeados;
- queda claro donde se aplican las reglas de disponibilidad y visibilidad.

## Fase 1. Identidad y segmentacion comercial

Objetivo: controlar acceso, catalogo y precio segun tipo de cliente.

Capacidades:

- registro publico de clientes;
- portal de cliente;
- catalogo privado para usuarios autenticados o con rol/segmento valido;
- precios por tipo de institucion;
- reglas de visibilidad por segmento.

Dependencias:

- sistema de autenticacion/registro;
- modelo de cliente extendido con segmentacion;
- reglas de pricing en catalogo y checkout.

Exit criteria:

- un cliente puede registrarse, entrar al portal y ver precio/visor
  correspondiente a su segmento;
- el catalogo privado no rompe el publico.

## Fase 2. Disponibilidad y comparador

Objetivo: hacer de `productos.disponible` una senal operativa central.

Capacidades:

- filtros y badges de disponibilidad;
- comportamiento de carrito/checkout segun disponibilidad;
- comparador avanzado;
- comparacion de precios por proveedor cuando aplique;
- avisos comerciales y CTA alternos.

Dependencias:

- fuente de verdad de stock y fulfillment;
- multi-proveedor o al menos datos de respaldo por producto.

Exit criteria:

- el producto disponible se comporta de forma consistente en todas las capas;
- el usuario puede comparar y decidir rapido.

## Fase 3. Fiscalidad y cobro

Objetivo: automatizar la capa fiscal y contable del pedido.

Capacidades:

- facturacion electronica DIAN;
- IVA automatico;
- retenciones automaticas;
- documentos fiscales asociados al pedido;
- conciliacion de pago y estado fiscal.

Dependencias:

- reglas tributarias por pais/cliente/producto;
- pasarela de pago y pedido ya consolidados;
- documentos persistidos en storage o tablas fiscales.

Exit criteria:

- un pedido puede emitir y consultar su huella fiscal;
- las reglas tributarias se calculan sin intervencion manual para el flujo
  normal.

## Fase 4. Logistica y postventa

Objetivo: cubrir envio, tracking, devoluciones y reembolsos.

Capacidades:

- calculo de envio por zona/peso/volumen;
- reglas de transportista y tarifa;
- portal publico de tracking de pedidos;
- devoluciones automatizadas;
- reembolsos automatizados;
- trazabilidad de incidentes y estados.

Dependencias:

- pedido y fulfilment confiables;
- estados operativos consistentes;
- reglas de envio por mercado o segmento.

Exit criteria:

- el cliente puede seguir su pedido sin entrar al admin;
- el backoffice puede gestionar devolucion o reembolso con trazabilidad.

## Fase 5. Multi-proveedor

Objetivo: asignar el proveedor mas conveniente por precio, disponibilidad y
lead time.

Capacidades:

- comparacion de precios entre proveedores;
- prioridad por proveedor y por producto;
- selecciones manuales o automáticas;
- impacto en coste, margen y disponibilidad.

Dependencias:

- proveedor_producto y fulfillments consistentes;
- reglas de prioridad y fallback claras.

Exit criteria:

- el sistema puede sugerir o asignar el proveedor optimo;
- el admin puede overridear sin romper trazabilidad.

## Fase 6. CMS, marketing y fidelizacion

Objetivo: convertir el contenido en motor de captacion y retencion.

Capacidades:

- blog/CMS de contenidos;
- email marketing;
- automatizaciones y segmentos;
- fidelizacion y campañas;
- contenidos conectados a categorias, productos y conversion.

Dependencias:

- editor de contenido estable;
- segmento de cliente utilizable;
- eventos de compra y navegacion disponibles.

Exit criteria:

- se pueden publicar contenidos y activar campañas basicas;
- existe una ruta clara desde contenido a conversion.

## Fase 7. Asesor avanzado

Objetivo: llevar el Asesor a una capa persistente y personalizada.

Capacidades:

- historial persistente;
- modo multimodal;
- recomendaciones personalizadas;
- streaming SSE;
- auditoria y control de privacidad.

Dependencias:

- perfil y segmentacion de cliente;
- tracking de interacciones;
- backend capaz de persistir conversacion y eventos.

Exit criteria:

- el Asesor recuerda contexto util entre sesiones;
- el flujo SSE funciona para respuestas progresivas;
- el sistema mantiene limites de privacidad y auditoria.

## Orden recomendado

1. Fase 0: inventario tecnico.
2. Fase 1: identidad y segmentacion comercial.
3. Fase 2: disponibilidad y comparador.
4. Fase 3: fiscalidad y cobro.
5. Fase 4: logistica y postventa.
6. Fase 5: multi-proveedor.
7. Fase 6: CMS, marketing y fidelizacion.
8. Fase 7: Asesor avanzado.

## Riesgos

- mezclar automatizacion fiscal con reglas comerciales sin una fuente de verdad;
- crear un portal de cliente sin segmentacion consistente;
- exponer tracking o pricing privado sin control de acceso;
- acoplar el Asesor a datos no persistidos o no auditables.

## Validacion

- `npm run check`
- `npm run build`
- pruebas de flujo en admin, catalogo, checkout y portal de cliente
