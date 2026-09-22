# ADR-0016: Captura de identidad opt-in en WhatsApp

- Fecha: 2026-09-22
- Estado: aceptado (schema), lógica conversacional fuera de alcance de esta ADR
- Contexto: Growth Engine, Fase 1 — Foundation (`docs/growth-engine/IMPLEMENTATION_PLAN.md`)

## Contexto

WhatsApp es el canal B2B primario en Colombia, pero hoy es puramente un canal de
**soporte**: `supabase/functions/whatsapp-webhook/index.ts` verifica firma HMAC, aplica
rate-limit, responde vía IMEIA, y sólo escribe a `eventos_sistema`. No crea contacto,
lead ni oportunidad — es la mayor fuga de atribución individual identificada en el
discovery de Fase 0 (R-2b en `IMPLEMENTATION_PLAN.md`).

`leads_comerciales` (la tabla real de leads, ya sincronizada con Twenty CRM) exige
`institucion`, `familia_slug`, `tipo_proyecto`, `horizonte`, `necesidad` — demasiados
campos estructurados para el primer mensaje casual de un chat de WhatsApp
("hola, ¿tienen monitores multiparamétricos?"). Forzar esa cantidad de información antes
de registrar cualquier cosa perdería la mayoría de los primeros contactos.

## Decisión

**Tabla puente `whatsapp_opt_ins`** (migración
`supabase/migrations/20260922230000_whatsapp_opt_ins.sql`), no una extensión de
`leads_comerciales`: registra `wa_id` + `nombre` + consentimiento, sin exigir el resto
de campos que un lead calificado necesita. `lead_comercial_id` (FK nullable) se llena
**después**, cuando la conversación acumule suficiente información — en ese punto se crea
un `leads_comerciales` normal con `campaign = 'whatsapp'`, reutilizando el 100% del
pipeline de sync a Twenty y scoring que ya existe. WhatsApp se convierte en un origen más
de lead, no un sistema paralelo — coherente con "no crear un segundo CRM" (mandato §11).

**Esta ADR NO modifica `whatsapp-webhook/index.ts` ni implementa el flujo conversacional
que realmente pide el consentimiento.** Diseñar cuándo y cómo el asesor pide "¿puedo
guardar tu nombre para darte seguimiento?" dentro de una conversación en curso —
incluyendo evitar pedirlo de forma intrusiva, manejar el rechazo, y decidir qué
disparador conversacional activa la pregunta — es un problema de diseño de producto/UX
conversacional, no un cambio de schema, y toca un webhook que sirve tráfico real de
WhatsApp hoy. Se deja como trabajo de Fase 4 ("Channel Adapters" en el mandato,
consistente con `IMPLEMENTATION_PLAN.md` backlog ítem 9: "preparación para Fase 4"). Esta
ADR entrega la base de datos que esa lógica futura necesita, verificada, para que Fase 4
empiece con el modelo de datos ya resuelto.

## Alternativas consideradas

- **Extender `leads_comerciales` con columnas nullable (`wa_id`, etc.) en vez de una
  tabla nueva**: descartado — `leads_comerciales` ya tiene un `CONSTRAINT
leads_comerciales_contact_check` que exige teléfono o email, y varios `NOT NULL`
  (institución, familia, tipo de proyecto, horizonte, necesidad). Un WhatsApp opt-in
  inicial no tiene nada de eso. Forzar esos campos a nullable para acomodar un caso
  degradaría la integridad de datos del resto del sistema de leads calificados.
- **No hacer nada de schema todavía, esperar a Fase 4 completa**: descartado — el
  discovery ya identificó esto como el mayor gap de atribución individual del sistema;
  tener el modelo de datos listo y verificado reduce el trabajo real de Fase 4 a "sólo"
  diseño conversacional + wiring, sin decisión de schema pendiente en el camino crítico.
- **Implementar también el flujo conversacional ahora**: descartado por riesgo — es un
  cambio de comportamiento en un webhook que sirve tráfico real, sin infraestructura de
  pruebas de WhatsApp Cloud API disponible en este entorno para verificarlo
  end-to-end antes de hacer merge. Coherente con cómo se trató ADR-0013 (schema ahora,
  enforcement en el flujo real como follow-up).

## Consecuencias

- Migración `20260922230000_whatsapp_opt_ins.sql`, verificada contra Postgres 16 real
  (contenedor descartable): aplica limpio, es idempotente, el trigger `updated_at`
  funciona, el FK a `leads_comerciales` es válido.
- RLS: sin acceso `anon`/público en absoluto (a diferencia de `topic_clusters`/
  `producto_claims_evidencia`, que sí exponen contenido aprobado) — esta tabla es
  identidad de persona (`wa_id` + nombre), no contenido; sólo lectura admin
  (ventas/catálogo) y escritura service_role.
- Sin impacto en el webhook actual — `whatsapp-webhook/index.ts` no se tocó, sigue
  comportándose exactamente igual hasta que Fase 4 lo conecte a esta tabla.
