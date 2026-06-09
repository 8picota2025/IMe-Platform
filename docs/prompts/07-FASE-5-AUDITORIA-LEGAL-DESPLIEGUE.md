# FASE 5 revisada — Auditoría integral, legales, seguridad, QA y despliegue

**Objetivo:** auditar todo lo construido, generar legales como borrador, validar SEO/LLM, seguridad, pagos, asesor, accesibilidad y performance; desplegar a preproducción, auditar contenido y promover a raíz con 301 desde `/77/` y `/1old`.

```txt
[PEGAR CONTEXTO MAESTRO]

PRECONDICIÓN:
F0-F4 y Fase Asesor completadas o marcadas honestamente como no ejecutadas. Código en ./0106-ime-web-claude-design.

OBJETIVO F5:
Auditoría integral + QA + remediación + contenido legal borrador + SEO depurado + seguridad/ciberseguridad + preproducción + promoción a producción raíz + prueba pipeline completo.

REGLA RECTORA:
Un criterio no se marca cumplido sin evidencia. Lo no ejecutable en el entorno se marca NO_EJECUTADO_ENTORNO con pasos exactos para verificarlo.

==================================================================
1. AUDITORES
==================================================================
Crea .claude/agents o checklists:
- design-reviewer.md
- a11y-auditor.md
- perf-auditor.md
- sec-auditor.md
- seo-auditor.md
- payment-auditor.md
- ai-safety-auditor.md

Ejecuta revisiones y vuelca a:
- VALIDACION.md
- VALIDACION_VISUAL.md
- QA.md
- REMEDIACION.md

Formato hallazgo:
[ubicación] [severidad: Bloqueante|Mayor|Menor] [descripción] [evidencia] [fix concreto] [fase_origen]

Criterio salida:
- cero Bloqueantes.
- cero Mayores abiertos antes de producción.

==================================================================
2. QA FUNCIONAL
==================================================================
QA.md con casos Pass/Fail/Bloqueado/NO_EJECUTADO_ENTORNO:

Rutas:
- / → /es/
- /es/ y /en/
- catálogo ES/EN.
- servicios.
- contacto.
- financiación.
- conocimiento stub.
- landings producto.
- admin.
- legales.
- pago resultado.

Catálogo:
- jerarquía.
- mostrar todos.
- filtros.
- buscador.
- URL sync.
- paginación.
- tipos ausentes General.

Landings:
- hero.
- galería.
- specs.
- comparador.
- CTA por tipo_comercial.
- PDF.
- relacionados.
- breadcrumbs.

Admin:
- login.
- guard.
- CRUD.
- ingesta PDF.
- revisión obligatoria.
- publicar→embeddings→rebuild.
- CSV.

Asesor:
- recuperación real.
- producto citado existe.
- guardarraíl clínico.
- precio/financiación derivan.
- anti-bot.
- rate-limit.
- presupuesto agotado.
- keyword fallback.

Comercio:
- carrito.
- Wompi sandbox CO.
- Stripe test INTL.
- webhooks.
- idempotencia.
- pedidos admin.
- equipo cotización.

i18n:
- selector mantiene ruta equivalente.
- hreflang recíproco.
- EN con pendientes marcados internamente.

==================================================================
3. CONTENIDO LEGAL BORRADOR
==================================================================
Genera páginas legales ES/EN enlazadas desde footer:
- Política de privacidad y tratamiento de datos.
- Autorización tratamiento de datos / Habeas Data.
- Política de cookies si aplica.
- Términos y condiciones.
- Aviso de copyright.

Reglas:
- Es borrador profesional, no asesoría jurídica.
- Marcar COPY_CLIENTE_REVISAR y BLOQUEANTE_LEGAL hasta abogado.
- No inventar razón social, NIT, domicilio, responsable datos ni canales legales.
- Usar TODO_CLIENTE donde falte.

Debe cubrir:
- Ley 1581/2012 en Colombia como referencia general si aplica, sin afirmar cumplimiento definitivo.
- finalidad de formularios/cotizaciones/pedidos.
- derechos del titular.
- canal de ejercicio.
- conservación.
- consentimiento.
- compras consumibles.
- equipos por cotización.
- financiación orientativa.
- limitación de responsabilidad.

Formularios/checkout:
- checkbox obligatorio de autorización.
- enlace a política.
- guardar consentimiento y timestamp.

==================================================================
4. SEO / LLM
==================================================================
Validar:
- meta únicos.
- descriptions <160.
- canonical a URLs raíz.
- hreflang recíproco.
- sitemap completo.
- robots con Disallow /admin.
- llms.txt completo.
- Product JSON-LD sin inventar precio/SKU/rating.
- BreadcrumbList.
- FAQPage real.
- Organization real.
- no duplicado raíz/77/1old.
- view-source de landings muestra SEO server-side.

Documentar validación de datos estructurados o NO_EJECUTADO_ENTORNO.

==================================================================
5. SEGURIDAD Y CIBERSEGURIDAD
==================================================================
Grep cliente y dist:
- service_role
- SERVICE_KEY
- service_role_key
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- VOYAGE_API_KEY
- WOMPI_PRIVATE
- WOMPI_EVENTS_SECRET
- STRIPE_SECRET
- STRIPE_WEBHOOK_SECRET
- TURNSTILE_SECRET
Debe dar 0.

RLS:
- anónimo lee productos activos sí.
- anónimo lee inactivos no.
- anónimo inserta cotización sí.
- anónimo lee cotizaciones no.
- anónimo escribe productos no.
- pedidos no son públicos.

Pagos:
- crear-pago recalcula total.
- webhook Wompi valida firma.
- webhook Stripe valida firma.
- ambos verifican estado server-side.
- idempotencia.
- cero tarjeta en cliente.

Asesor:
- CORS restringido.
- anti-bot.
- rate-limit.
- presupuesto.
- no system prompt leak.
- inyección prompt testeada.

Headers:
- HTTPS.
- HSTS si producción estable.
- CSP coherente.
- X-Content-Type-Options.
- Referrer-Policy.
- Permissions-Policy.
- frame-ancestors.

Supabase:
- Storage policies.
- backups documentados.
- anon key alcance razonable.

==================================================================
6. PERFORMANCE Y ACCESIBILIDAD
==================================================================
Performance:
- npm run build.
- pesos JS/CSS gzip.
- imágenes.
- fuentes.
- LCP.
- CLS.
- TBT.
- Lighthouse Home/Catálogo/Landing.

A11y:
- WCAG 2.2 AA.
- contraste.
- teclado.
- focus.
- modales.
- formularios.
- aria-live.
- skeletons.
- reduced motion.
- un H1.

Si Lighthouse no corre: NO_EJECUTADO_ENTORNO con comando.

==================================================================
7. DESPLIEGUE PREPROD → PRODUCCIÓN RAÍZ
==================================================================
Preproducción:
- desplegar build a staging.
- noindex.
- idealmente protegido.
- auditoría de contenido humana:
  - productos.
  - specs.
  - traducciones EN.
  - legales.
  - financiación.
  - CTAs.

Producción:
- promover el mismo build aprobado a raíz https://i-me.com.co/.
- /77/ y /1old no sirven contenido indexable.
- 301 exhaustivos.

.htaccess:
- /index.html → /es/
- /77/ → /es/
- /77/index.html → /es/
- /77/catalogo.html → /es/catalogo
- /77/catalogo.html?cat=monitores → /es/catalogo?familia=monitores
- repetir mapeo para 8 familias.
- /77/servicios.html → /es/servicios
- /77/contacto.html → /es/contacto
- /1old y /1old/* → /es/ o /es/financiacion según decisión.
- preservar query strings donde aplique.
- sin bucles.
- cada destino 200.
- no SPA fallback.

CI:
- targets PREPROD y PROD.
- secrets FTP/SSH.
- repository_dispatch.
- concurrency cancel-in-progress.

==================================================================
8. PIPELINE COMPLETO
==================================================================
VALIDACION.md debe documentar:
1. npm install.
2. aplicar schema.sql.
3. crear admin Supabase.
4. configurar env.
5. ingesta PDF → borrador.
6. revisión humana.
7. publicar.
8. generar embeddings.
9. trigger rebuild.
10. deploy preprod.
11. auditoría contenido.
12. promoción raíz.
13. verificar 301.
14. compra Wompi sandbox.
15. compra Stripe test.
16. cotización equipo.
17. asesor recupera producto nuevo.

Lo no ejecutado debe decir por qué y cómo hacerlo.

==================================================================
9. DOCUMENTACIÓN FINAL
==================================================================
Actualizar:
- README.md.
- ADMIN_GUIDE.md.
- VALIDACION.md.
- VALIDACION_VISUAL.md.
- QA.md.
- REMEDIACION.md.
- CRITERIOS_ACEPTACION.md.
- PENDIENTES.md.
- BACKLOG_V2.md.
- RESUMEN_EJECUTIVO.md.

README debe incluir:
- stack.
- local :43421.
- env.
- Supabase.
- schema.
- admin.
- build.
- deploy preprod/prod.
- pagos Wompi/Stripe.
- asesor/LLM/presupuesto.
- actualización de productos.
- legal pendiente.

==================================================================
PROHIBIDO EN F5
==================================================================
- Marcar cumplido sin evidencia.
- Promover con Bloqueantes seguridad.
- Presentar legales como definitivos.
- Dejar /77/ o /1old indexables.
- Inventar datos empresa.
- Exponer secretos.

==================================================================
ENTREGABLES F5
==================================================================
- auditores/checklists.
- VALIDACION.md.
- VALIDACION_VISUAL.md.
- QA.md.
- REMEDIACION.md.
- páginas legales ES/EN.
- consentimiento en formularios/checkout.
- .htaccess 301.
- despliegue preprod→raíz documentado.
- pipeline probado o NO_EJECUTADO_ENTORNO.
- documentación final.
- resumen ejecutivo.

==================================================================
CRITERIOS DE ACEPTACIÓN F5
==================================================================
- Auditoría completa con hallazgos clasificados.
- Cero Bloqueantes al promover.
- Legales enlazados y marcados borrador.
- Consentimiento operativo.
- SEO/canonical/hreflang/JSON-LD correctos.
- sitemap/llms completos.
- secretos 0 en cliente/dist.
- RLS probada.
- webhooks seguros.
- asesor con guardarraíles.
- preprod auditada antes de raíz.
- 301 verificados.
- documentación permite a tercero mantener y desplegar.
```
