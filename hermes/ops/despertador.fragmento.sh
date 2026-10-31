# Fragmento para el despertador que ya corre. No sustituye el script ni el webhook.
# Integrador lo añade a mano, después de respaldar despertador.sh con .bak-<fecha>.
# En sombra el perfil solo registra.

if grep -qx 'integrador' "${HERMES_TABLON:-$HOME/.hermes/shared/tablon}/bots.txt"; then
  python3 "${INTEGRADOR_PERFIL:-$HOME/.hermes/profiles/integrador}/scripts/tablon.py"
fi
