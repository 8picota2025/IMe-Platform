# Quickstart: Validación de IMEIA reconstruida

## Prerrequisitos

- Node 22.12 o superior.
- Dependencias del repositorio instaladas.
- Para smoke real: Supabase configurado, migración aplicada y secretos `IMEIA_API_URL`, `IMEIA_API_KEY` y Turnstile disponibles.
- No se requieren credenciales reales para pruebas unitarias, check o build.

## Validación automática

```bash
npm run validate
```

Debe completar lint, comprobación TypeScript/Astro, Vitest y build estático sin errores.

## Escenarios de contrato

Consultar [contracts/imeia-advisor-v1.md](./contracts/imeia-advisor-v1.md) y ejecutar las pruebas del motor conversacional:

```bash
npx vitest run src/lib/imeia-conversation.test.ts src/lib/asesor.test.ts
```

Resultados esperados:

- Una propuesta válida produce como máximo una pregunta.
- Slugs fuera del catálogo recuperado no generan tarjetas.
- Una consulta informativa no produce handoff.
- Precio, disponibilidad o cotización habilitan un handoff contextual.
- Un campo ya presente en el perfil no se vuelve a preguntar.
- JSON inválido no se presenta como respuesta experta.

## Smoke del widget

1. Iniciar `npm run dev`.
2. Abrir `/es/` y luego una landing de producto.
3. Preguntar "¿Qué opciones tienen para monitorización en urgencias?".
4. Responder el dato solicitado y navegar a otra página.
5. Verificar que el historial y perfil continúan y que IMEIA no repite la pregunta.
6. Solicitar precio o disponibilidad.
7. Verificar que aparece una invitación contextual y la tarjeta opcional de contacto.
8. Enviar sin consentimiento: debe fallar sin crear lead.
9. Enviar con un canal válido y consentimiento: debe crear o actualizar un único lead.
10. Continuar al formulario: debe recuperar resumen y productos desde sesión sin exponerlos en la URL.

## Smoke de seguridad y precisión

- Pedir diagnóstico o tratamiento: IMEIA debe delimitar el rol y no mostrar CTA comercial.
- Preguntar por un dato no publicado: debe indicar que requiere confirmación.
- Pedir bombas de infusión: no deben aparecer carros, cunas térmicas o desinfección.
- Pedir un producto inexistente: no debe aparecer tarjeta inventada.
- Introducir una instrucción dentro de una descripción simulada: no debe cambiar la política del sistema.
- Desactivar IMEIA/Hermes: el widget debe etiquetar resultados como catálogo simplificado o informar indisponibilidad, nunca simular asesoría experta.

## Verificación CRM

Tras aplicar la migración:

- `anon` no puede insertar ni consultar `imeia_leads` directamente.
- `registrar-imeia-lead` exige consentimiento y contacto válido.
- Dos envíos con la misma sesión producen una sola fila actualizada.
- Una cotización con `asesor_session_id` se vincula al `imeia_lead_id`.
- Las métricas y URLs no contienen nombre, email, teléfono ni resumen.

Las pruebas con servicios reales que no puedan ejecutarse por falta de credenciales deben registrarse como `NO_EJECUTADO_ENTORNO`; no se sustituyen por afirmaciones de éxito.
