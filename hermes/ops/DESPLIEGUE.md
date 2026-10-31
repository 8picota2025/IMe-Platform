# Despliegue — lo hace Integrador, no esta PR

Esta rama no se copia al servidor, no cambia crontab, no reinicia `hermes-gateway` y no llama a `hermes-perfiles-aplicar.sh` (deshabilitado el 31-10-2026).

Cuando Shoky dé el OK de copiar el perfil, todavía en sombra:

1. Respaldar `bots.txt`, `despertador.sh` y `crontab -l` con sufijo `.bak-<fecha>`.
2. Copiar `hermes/profiles/integrador/` a `/home/shoky/.hermes/profiles/integrador/`.
3. Copiar `hermes/scripts/integrador/` a `/home/shoky/.hermes/scripts/integrador/`.
4. Crear `.env` desde `.env.example` y dejarlo en modo 600. No commitearlo.
5. Añadir la línea `integrador` a `~/.hermes/shared/tablon/bots.txt` si no está.
6. Añadir `hermes/ops/despertador.fragmento.sh` al despertador existente. El webhook y el flujo de n8n conservan su id.
7. No crear `ACTIVO_AUTORIZADO`. `INTEGRADOR_MODO` se queda en `sombra`.

## Vuelta atrás

1. `enabled: false` en `profiles/integrador/cron/jobs.json`.
2. Quitar `integrador` de `bots.txt`.
3. Renombrar el perfil a `integrador.disabled`.

Con esos tres pasos el perfil no se despierta. Las rutinas de Grok no se borran.

`scripts/rollback_ensayo.py` hace los tres pasos solo si la raíz del árbol contiene `ENTORNO-DE-PRUEBA` y la ruta no es `/home/shoky`. En el servidor, Integrador los hace a mano.
