# Despliegue del respaldo (lo hace Integrador)

Estado de partida en srv1715444 (`~/.hermes`), comprobado el 31-10-2026:

- `estado/modo.json` = `{"modo":"respaldo"}`
- `estado/modo-respaldo.manual` es texto legado (`manual: Shoky/iMErvis`), sin caducidad
- `estado/latido-grokbot.json` no existe

Este cambio no arranca EmilioH, no envía correo y no reescribe ese manual legado.
El cron de ejemplo va en dry-run: imprime la decisión y no toca el modo vivo.

## Qué queda instalado

| Pieza | Dónde | Efecto al desplegar |
| --- | --- | --- |
| Scripts | `~/.hermes/scripts/respaldo/` | Sustituyen a `latido.py`, `detector.py`, `respaldo.sh`, `modo.py` y `aviso.py` |
| Migración | `supabase/migrations/20261031190000_imeia_respaldo_latido_manual.sql` | Tablas y RPC. No modifica `imeia_routing` |
| Tablón | Edge `ops-respaldo` | Al merge a `main`, el workflow `Deploy Supabase Functions` la publica. Sin la migración responde `migracion_pendiente` y no cambia la ruta |

Grok (sin SSH) y Hermes escriben el mismo latido (`ok`, `fallo`, `sin_tokens`) y el mismo interruptor. El detector del servidor lee ficheros locales. `volcar.py` copia lo que haya en Supabase hacia `estado/latido-grokbot.json`.

Manual nuevo, JSON:

```json
{"quien":"Shoky","motivo":"...","desde_utc":"...","expires_at":"...","origen":"cli"}
```

`RESPALDO ON` sin horas caduca a las 4 h. El detector borra ese JSON cuando `expires_at` ya pasó y vuelve a decidir con el latido. El fichero legado no se borra solo: sigue mandando respaldo y deja una alerta `manual_sin_caducidad`.

Auditoría local: `estado/auditoria.jsonl` con `utc`, `quien`, `accion`, `origen`, `motivo`. Origen del interruptor: `grok-tablon`, `hermes`, `telegram` o `cli`. El latido también acepta `emilio` y `rutina`.

Alerta si falta latido, si está caducado (más de 15 min), si viene `fallo` o `sin_tokens`: una línea en `estado/alertas.jsonl`. No hay MTA.

## Alcance del token

`supabase/migrations/20261031230000_imeia_worker_token_alcance.sql` añade `imeia_worker_tokens.alcance`. Los tokens que ya están en la base quedan `worker` y siguen pudiendo hacerlo todo. La migración no inserta tokens y no modifica `imeia_routing`.

| alcance | Puede | No puede |
| --- | --- | --- |
| `worker` | latido, pull, ON/OFF, expirar, modo, ruta, cola y RAG | — |
| `respaldo_lectura` | pull y ESTADO | ON/OFF, latido, ruta, cola y RAG |
| `respaldo_latido` | registrar latido | pull, ON/OFF, ruta, cola y RAG |

`anon` y `authenticated` no leen la tabla ni ejecutan `imeia_token_alcance_ok`. Siguen pudiendo llamar a los RPC que ya tenían concedidos; el alcance se comprueba dentro. Un token malo o inactivo es 401 `unauthorized`. Un token vivo del alcance equivocado es 403 `forbidden`.

`volcar.py` no cambia. En el servidor, `IMEIA_WORKER_TOKEN` tiene que seguir siendo alcance `worker`: `volcar.py` llama a `imeia_respaldo_expirar` y a `imeia_respaldo_pull`, y el detector a `imeia_modo_reportar`. Un token de solo lectura deja un aviso en el expirado y no informa el modo.

### Orden

1. `20261031190000_imeia_respaldo_latido_manual.sql` ya está aplicada en `nnfbucwiasuggyfoyydo`. No repetirla.
2. Aplicar `20261031230000_imeia_worker_token_alcance.sql` con el workflow manual **Deploy Supabase Migrations**. Hasta este paso el token que ya existe sigue igual.
3. Crear tokens de otro alcance solo si hacen falta. A la base entra el hash, no el secreto.
4. Merge de este PR después de la migración. **Deploy Supabase Functions** publica `ops-respaldo`. Si el merge va antes, un Bearer de token recibe `503 migracion_pendiente` y no cambia la ruta. El Bearer que es `IMEIA_AGENT_WEBHOOK_KEY` o la service role sigue entrando.
5. No hace falta volver a copiar `ops/respaldo/` al servidor ni quitar el dry-run. No enviar correo y no entrar por SSH para este cambio.

### Crear un token y guardar solo el hash

El hash es SHA-256 del secreto en UTF-8, sin salto de línea. `openssl dgst` y `extensions.digest(..., 'sha256')` coinciden.

```bash
TOKEN=$(openssl rand -hex 32)
HASH=$(printf '%s' "$TOKEN" | openssl dgst -sha256 -hex | awk '{print $NF}')
# TOKEN se anota una sola vez fuera de git (chmod 600). HASH es lo único que va a SQL.
printf '%s\n' "$HASH"
```

```sql
insert into public.imeia_worker_tokens (nombre, token_sha256, alcance)
values ('respaldo-lectura-grok', '<hash sha256 hex de 64 caracteres>', 'respaldo_lectura');
```

Alcances válidos: `worker`, `respaldo_lectura`, `respaldo_latido`. `nombre` es único y es lo que se usa para revocar. No pegar el secreto en la sentencia ni en el historial de psql.

Para ver que quedó bien, sin el hash:

```sql
select nombre, alcance, activo from public.imeia_worker_tokens order by nombre;
```

Latido (Bearer de alcance `respaldo_latido` o `worker`):

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/ops-respaldo" \
  -H "Authorization: Bearer $IMEIA_TOKEN_LATIDO" \
  -H "Content-Type: application/json" \
  -d '{"accion":"latido","estado":"ok","quien":"emilio","origen":"rutina"}'
```

Lectura (Bearer de alcance `respaldo_lectura` o `worker`): `GET` o `{"accion":"estado"}`. ON/OFF solo con alcance `worker`.

### Revocar

```sql
update public.imeia_worker_tokens set activo = false where nombre = 'respaldo-lectura-grok';
```

La fila y el hash se quedan. Un token inactivo responde `unauthorized` (401), no `forbidden`.

### Deshacer el alcance

Ejecutar a mano el bloque entre `ROLLBACK_BEGIN` y `ROLLBACK_END` de `supabase/migrations/20261031230000_imeia_worker_token_alcance.sql`, quitando el prefijo `-- ` de esas líneas.

Eso restaura las funciones anteriores, borra `imeia_token_alcance_ok` e `imeia_exige_alcance`, y quita la columna `alcance`. No toca `imeia_routing`, ni la cola Hermes, ni las tablas del latido. Las filas de `imeia_worker_tokens` siguen; sin la columna, cualquier token activo vuelve a servir para todo.

Si `ops-respaldo` de este PR ya se publicó, hay que redesplegar la función del commit anterior: sin `imeia_token_alcance_ok` responde `migracion_pendiente`. WhatsApp, si esa función no existe, sigue comprobando `imeia_worker_token_ok`.

## Antes de tocar el servidor

1. No borrar `estado/modo.json` ni `estado/modo-respaldo.manual`.
2. Copiar el directorio actual a un respaldo con fecha:

```bash
cp -a ~/.hermes/scripts/respaldo ~/.hermes/scripts/respaldo.bak-20261031
cp -a ~/.hermes/estado/modo.json ~/.hermes/estado/modo-respaldo.manual /tmp/ 2>/dev/null || true
```

3. La migración del latido (`20261031190000`) ya está aplicada. La de alcance va aparte, antes de mergear este PR: ver «Alcance del token». No hace falta ninguna de las dos para probar los scripts en local.
4. El token de worker ya existe en `imeia_worker_tokens` y, tras la migración de alcance, queda en `worker`. No hace falta crear otro para el servidor ni commitear su valor. En el servidor, fuera de git:

```bash
# ~/.hermes/scripts/respaldo/respaldo.env  (chmod 600)
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_ANON_KEY=<anon>
IMEIA_WORKER_TOKEN=<token de worker ya provisionado>
RESPALDO_QUIEN=hermes
```

Sin ese fichero el interruptor local sigue funcionando; Grok no podrá escribir el tablón y `volcar.py` sale con `sin_credenciales`.

## Instalar scripts

```bash
install -d ~/.hermes/scripts/respaldo ~/.hermes/estado
# desde el repo, en la máquina de despliegue
cp ops/respaldo/*.py ops/respaldo/respaldo.sh ~/.hermes/scripts/respaldo/
chmod 755 ~/.hermes/scripts/respaldo/respaldo.sh ~/.hermes/scripts/respaldo/*.py
```

Probar contra un directorio vacío, no contra `~/.hermes/estado`:

```bash
cd ~/.hermes/scripts/respaldo
HERMES_ESTADO_DIR=/tmp/respaldo-ensayo python3 -m unittest tests/test_respaldo.py
# o, si las pruebas se quedan en el repo:
python3 -m unittest ops/respaldo/tests/test_respaldo.py
```

Dry-run sobre el estado vivo (no escribe, no borra el manual legado):

```bash
set -a; [ -f ~/.hermes/scripts/respaldo/respaldo.env ] && . ~/.hermes/scripts/respaldo/respaldo.env; set +a
python3 ~/.hermes/scripts/respaldo/volcar.py --dry-run
python3 ~/.hermes/scripts/respaldo/detector.py --dry-run
~/.hermes/scripts/respaldo/respaldo.sh estado
```

La salida de `detector.py --dry-run` tiene que traer `motivo` (`manual_legado` mientras exista el fichero viejo) y `alertas` con `sin_latido`. `dry_run` es true y los ficheros no cambian. Comprobar con `ls -l --full-time` antes y después.

## Cron, todavía en dry-run

Añadir, no sustituir el cron actual a ciegas. Conservar la línea vieja comentada.

```cron
# Respaldo IMEia. Dry-run hasta OK de Shoky: no escribe modo ni borra el manual.
# */5 * * * * . $HOME/.hermes/scripts/respaldo/respaldo.env 2>/dev/null; python3 $HOME/.hermes/scripts/respaldo/volcar.py --dry-run >> $HOME/.hermes/estado/detector-dry-run.log 2>&1; python3 $HOME/.hermes/scripts/respaldo/detector.py --dry-run >> $HOME/.hermes/estado/detector-dry-run.log 2>&1
```

Quitar `--dry-run` de esas dos llamadas es el paso que empieza a cambiar `modo.json` y a borrar manuales JSON caducados. No hacerlo en este despliegue.

## Cómo lo invocan Grok y Hermes

Latido (Emilio o una rutina, cuando alguien las conecte; este despliegue no las activa):

```bash
python3 ~/.hermes/scripts/respaldo/latido.py ok --quien emilio --origen emilio
python3 ~/.hermes/scripts/respaldo/latido.py fallo --quien rutina-web --origen rutina
python3 ~/.hermes/scripts/respaldo/latido.py sin_tokens --quien rutina-web --origen rutina
```

Interruptor local o Telegram, con autor:

```bash
~/.hermes/scripts/respaldo/respaldo.sh on --quien Shoky --origen hermes --motivo "ventana"
~/.hermes/scripts/respaldo/respaldo.sh on 2 --quien Shoky --origen telegram --motivo "2 h"
~/.hermes/scripts/respaldo/respaldo.sh off --quien Shoky --origen cli --motivo "fin"
python3 ~/.hermes/scripts/respaldo/comando.py --quien Shoky --origen telegram --motivo "desde telegram" "RESPALDO ON"
```

`OFF` quita el manual (también el legado) y deja `normal`. En el siguiente ciclo real, si no hay latido `ok` fresco, el detector vuelve a `respaldo`. Por eso el cron se queda en dry-run.

Tablón HTTP (Grok), tras aplicar la migración. Bearer = token de worker, `IMEIA_AGENT_WEBHOOK_KEY` o service role. No usar la anon key sola.

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/ops-respaldo" \
  -H "Authorization: Bearer $IMEIA_WORKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accion":"latido","estado":"ok","quien":"emilio","origen":"rutina"}'

curl -sS -X POST "$SUPABASE_URL/functions/v1/ops-respaldo" \
  -H "Authorization: Bearer $IMEIA_WORKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accion":"comando","texto":"RESPALDO ON","quien":"Shoky","origen":"grok-tablon","motivo":"desde el tablon"}'
```

Equivalente directo a PostgREST, sin la Edge Function:

```bash
curl -sS -X POST "$SUPABASE_URL/rest/v1/rpc/imeia_respaldo_set" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_token":"'"$IMEIA_WORKER_TOKEN"'","p_accion":"on","p_quien":"Shoky","p_motivo":"tablon","p_origen":"grok-tablon","p_horas":4}'
```

`volcar.py` (sin `--dry-run`) trae ese latido y ese manual al disco. Hasta que el cron deje el dry-run, el modo vivo no se entera.

Al mergear a `main`, GitHub despliega `ops-respaldo` porque `Deploy Supabase Functions` observa `supabase/functions/**`. La migración no se aplica sola: el workflow de migraciones es `workflow_dispatch`. Orden seguro: migración primero, merge después. Si el merge va antes, la función responde `migracion_pendiente` y no cambia la ruta.

## Qué no hacer en este pase

- No activar EmilioH ni enganchar sus rutinas.
- No configurar correo ni llamar al `aviso.py` antiguo si enviaba mensajes.
- No quitar el manual legado ni pasar el cron a modo real sin OK de Shoky.
- No ejecutar `respaldo.sh off` en el estado vivo: borraría el manual legado.

## Cómo deshacerlo

1. Quitar las líneas de cron añadidas y dejar la que hubiera antes.
2. Restaurar los scripts:

```bash
rm -rf ~/.hermes/scripts/respaldo
mv ~/.hermes/scripts/respaldo.bak-20261031 ~/.hermes/scripts/respaldo
```

3. Si un dry-run se ejecutó por error sin la bandera y cambió `modo.json`, reponer la copia de `/tmp` hecha al empezar. No inventar un modo nuevo.
4. Si el manual legado sigue en su sitio, no hace falta tocarlo. Si un `off` real lo borró, reponerlo desde la copia:

```bash
cp /tmp/modo-respaldo.manual ~/.hermes/estado/modo-respaldo.manual
cp /tmp/modo.json ~/.hermes/estado/modo.json
```

5. Quitar la función si ya se publicó:

```bash
supabase functions delete ops-respaldo --project-ref nnfbucwiasuggyfoyydo
```

6. Si se aplicó la migración de alcance, deshacerla primero con su bloque `ROLLBACK_BEGIN` (ver arriba). No borra el latido ni `imeia_routing`.
7. Deshacer el resto de la base con el bloque rollback del final de `supabase/migrations/20261031190000_imeia_respaldo_latido_manual.sql`. Solo borra `imeia_latido`, `imeia_respaldo_manual`, `imeia_modo_reportado`, `imeia_respaldo_auditoria` y sus funciones. No toca `imeia_routing` ni la cola Hermes. Ejecutarlo a mano en la base; no hay una migración posterior que lo haga sola.

Los ficheros `auditoria.jsonl` y `alertas.jsonl` se pueden dejar o borrar. No contienen el token.
