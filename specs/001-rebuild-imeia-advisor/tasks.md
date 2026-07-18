# Tasks: Reconstrucción del asesor IMEIA

**Input**: Design documents from `specs/001-rebuild-imeia-advisor/`
**Tests**: Required by the specification success criteria and project validation gate.

## Phase 1: Setup

- [ ] T001 Confirmar el estado base y el gate de instalación en `/tmp/cursor/async-install/install-user.status`
- [ ] T002 [P] Versionar especificación, investigación, modelo, contrato y quickstart en `specs/001-rebuild-imeia-advisor/`
- [ ] T003 [P] Actualizar referencia de Spec Kit al plan activo en `CLAUDE.md`

## Phase 2: Foundational

- [ ] T004 Crear tipos, normalizadores, política de CTA y contrato canónico en `src/lib/imeia-conversation.ts`
- [ ] T005 [P] Crear pruebas de contrato, perfil, pregunta única y handoff en `src/lib/imeia-conversation.test.ts`
- [ ] T006 Integrar perfil provisional y respuesta v1 en el cliente `src/lib/asesor.ts`

## Phase 3: User Story 1 — Conversación consultiva experta (P1)

**Goal**: Una identidad única responde primero, conserva contexto y formula como máximo una pregunta material.

**Independent Test**: Conversación multivuelta con datos ya aportados, corrección y consulta directa; no repite ni interroga antes de responder.

- [ ] T007 [US1] Reemplazar prompts fragmentados por la política canónica de ingeniera biomédica senior en `supabase/functions/asesor/index.ts`
- [ ] T008 [US1] Parsear y normalizar la propuesta estructurada con un único `next_question` en `supabase/functions/asesor/index.ts`
- [ ] T009 [US1] Aplicar parches de descubrimiento y conservarlos por sesión en `src/components/Asesor.astro`
- [ ] T010 [US1] Actualizar bienvenida, estados y microcopy conversacional es/en en `src/i18n/es.json` y `src/i18n/en.json`

## Phase 4: User Story 2 — Recomendación de catálogo precisa (P1)

**Goal**: Ninguna tarjeta o recomendación de producto sale del conjunto canónico permitido para el turno.

**Independent Test**: Consultas por referencia, producto actual, bombas de infusión y atributo ausente solo producen productos activos pertinentes.

- [ ] T011 [US2] Construir allowlist por turno con producto canónico, coincidencias y comparables en `supabase/functions/asesor/index.ts`
- [ ] T012 [US2] Validar slugs estructurados y construir tarjetas exclusivamente con datos canónicos en `supabase/functions/asesor/index.ts`
- [ ] T013 [US2] Eliminar extracción por URL y fallback biomédico enlatado de las rutas productivas en `src/lib/asesor.ts`
- [ ] T014 [P] [US2] Ampliar pruebas de grounding y degradación honesta en `src/lib/asesor.test.ts`

## Phase 5: User Story 3 — Descubrimiento y siguiente paso sutil (P2)

**Goal**: El CTA aparece después de resolver y solo ante intención comercial verificable.

**Independent Test**: Consultas informativas no muestran CTA; precio, disponibilidad, financiación o compra sí muestran el paso apropiado con resumen útil.

- [ ] T015 [US3] Calcular intención y autorizar handoff por señales del usuario e historial en `src/lib/imeia-conversation.ts`
- [ ] T016 [US3] Sustituir detección por palabras del texto de IMEIA por handoff validado en `supabase/functions/asesor/index.ts`
- [ ] T017 [US3] Representar pregunta siguiente y CTA sin presión ni repetición en `src/components/Asesor.astro`

## Phase 6: User Story 4 — Captura progresiva y CRM (P2)

**Goal**: Un cliente puede confirmar contacto y consentimiento y crear un único lead trazable, enlazable a cotización.

**Independent Test**: Sin consentimiento no hay fila; con contacto válido se crea un lead; repetir actualiza; cotización enlaza la sesión.

- [ ] T018 [US4] Crear migración de `imeia_leads` y vínculos de cotización en `supabase/migrations/20260718000000_imeia_conversational_crm.sql`
- [ ] T019 [US4] Sincronizar tabla, índices, triggers y RLS en `supabase/schema.sql`
- [ ] T020 [US4] Implementar validación y upsert consentido en `supabase/functions/registrar-imeia-lead/index.ts`
- [ ] T021 [US4] Añadir tarjeta opcional de contacto y consentimiento es/en en `src/components/Asesor.astro`
- [ ] T022 [US4] Vincular `asesor_session_id` a lead y cotización en `supabase/functions/registrar-cotizacion/index.ts`
- [ ] T023 [US4] Extender payload de cotización y continuidad de sesión en `src/lib/datos.ts`
- [ ] T024 [P] [US4] Transferir resumen/productos por `sessionStorage` sin query sensible en `src/pages/es/contacto.astro` y `src/pages/en/contact.astro`

## Phase 7: User Story 5 — Continuidad segura y degradación honesta (P3)

**Goal**: La sesión conserva contexto y las fallas no simulan asesoría experta.

**Independent Test**: Navegación/recarga conserva perfil; caída del modelo muestra catálogo etiquetado o indisponibilidad sin afirmaciones prefabricadas.

- [ ] T025 [US5] Persistir perfil con historial y limpiar datos al finalizar sesión en `src/lib/asesor.ts`
- [ ] T026 [US5] Etiquetar el modo degradado y formular una sola pregunta neutral en `src/lib/asesor.ts`
- [ ] T027 [US5] Añadir acción visible para reiniciar conversación en `src/components/Asesor.astro`

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T028 [P] Revisar que analítica, URLs y logs no incluyan PII ni transcript en `src/lib/analytics.ts`, `src/lib/datos.ts` y funciones modificadas
- [ ] T029 Ejecutar pruebas focalizadas y corregir regresiones con `npx vitest run src/lib/imeia-conversation.test.ts src/lib/asesor.test.ts`
- [ ] T030 Ejecutar el gate completo `npm run validate`
- [ ] T031 Documentar bloqueos reales como `NO_EJECUTADO_ENTORNO` y actualizar estado en `PENDIENTES.md`

## Dependencies

- T001–T003 no bloquean código entre sí.
- T004 bloquea T006–T009, T015–T017 y T025–T026.
- T007–T010 completan US1.
- T011–T014 dependen del contrato base y completan US2.
- US3 depende de US1 para estado y de US2 para productos verificados.
- T018 bloquea T019–T024; T020 y T021 pueden avanzar en paralelo una vez fijado el contrato.
- US5 depende del perfil de US1, pero su degradación puede probarse en paralelo con CRM.
- T029–T031 dependen de todas las historias incluidas.

## Parallel Opportunities

- T002 y T003.
- T005 mientras se implementa T004.
- T010 mientras se integra Edge.
- T014 mientras se implementan validaciones de producto.
- T020 y T021 después de T018.
- T024 en paralelo con T022–T023.
- T028 en paralelo con documentación final.

## Implementation Strategy

1. Entregar primero US1 + US2: identidad, estado y catálogo confiable.
2. Añadir US3 sobre señales explícitas, sin dejar la conversión al modelo.
3. Incorporar US4 como frontera separada de PII y consentimiento.
4. Cerrar con continuidad, degradación y validación completa.

**MVP técnico**: US1 y US2. **MVP comercial completo solicitado**: US1–US4.
