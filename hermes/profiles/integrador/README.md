# Perfil Hermes `integrador` (modo sombra)

Entrega del 31-10-2026. Shoky autorizó trasladar el Integrador a Hermes; las órdenes siguen saliendo de Grok por el tablón que ya existe. Esta copia observa y registra. No pasa a activo sola.

El despliegue lo hace Integrador, copiando carpetas. No usa `hermes-perfiles-aplicar.sh`. Ver `../../ops/DESPLIEGUE.md`.

## Qué hace en sombra

Con `INTEGRADOR_MODO=sombra` (el valor del `.env.example`) cada orden `para: integrador` toma el lock `~/.hermes/shared/tablon/locks/<tarea>.lock`, y si el id es nuevo escribe una línea en `~/logs/integrador/decisiones.jsonl`:

- `ts` en hora de Colombia
- `orden`
- `fuente`
- `accion` que tomaría
- `resultado_esperado`

No envía, no escribe en Supabase, Twenty, n8n ni crontab, no toca archivos de otros perfiles y no reinicia nada. El informe de vigilancia y la comparación diaria se quedan en `~/logs/integrador/`.

## Paso a activo (apagado)

Hace falta las cuatro cosas a la vez:

1. `INTEGRADOR_MODO=activo` en el `.env` del servidor (no en git).
2. `estado/modo.json` con `modo` = `respaldo`.
3. `detector.py` marca a Grok no disponible (latido en falso, dos fallos, o más de 180 minutos).
4. El archivo `ACTIVO_AUTORIZADO`, creado a mano tras un OK de Shoky.

Si Grok vuelve, el perfil regresa a sombra aunque el archivo siga ahí. Sin el archivo, activo es imposible. Aun en activo este perfil no envía correo (eso es de Emilio) ni escribe en Twenty (eso es de CRM): el aviso interno queda diferido a enlace.

## Jobs

| id | cuándo | estado |
| --- | --- | --- |
| reenvio | L-S 08:00 COT | sombra, `no_agent` |
| tablon | por evento; barrido dominical 03:00 COT | sombra, `no_agent` |
| vigilancia | L-S 08:15 COT | sombra, `no_agent` |
| comparador | diario 21:30 COT | sombra, `no_agent` |
| caducidades | lunes 08:00 COT | `enabled: false` |
| search-console | miércoles 09:00 COT | `enabled: false` |

El cron de Hermes resuelve `script` bajo `~/.hermes/scripts/`. Por eso el puente vive en `hermes/scripts/integrador/` y llama al script del perfil.

## Reglas

`skills/reglas-ime/SKILL.md`: las secciones 1 a 11 son las de `skills/ime/reglas-ime` del archivo de migración del 08-10-2026. La sección 12 es la regla suprema de envío del 31-10. Antes de copiar al servidor, Integrador compara las secciones 1 a 11 con el archivo vivo de otro perfil y, si cambió, deja el vivo y conserva la sección 12.

## Credenciales

Solo `profiles/integrador/.env`, modo 600: `SUPABASE_ACCESS_TOKEN` (lectura), `TWENTY_API_KEY` (lectura), `IMERVIS_TOKEN` (avisos internos cuando esté activo) y `OMNIROUTE_API_KEY`. El logger sustituye esos valores por `[redactado]`.

## Pruebas

```bash
python3 -m unittest discover -s hermes/tests -v
```

Cubren la orden en sombra sin efectos, el lock, el veto del modo activo, el comparador, la vigilancia de solo lectura, el rollback de ensayo y que el id del webhook no cambia al suscribir.
