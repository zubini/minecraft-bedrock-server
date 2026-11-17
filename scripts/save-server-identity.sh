#!/usr/bin/env bash
# Speichert die NetherNet-Serveridentität (keys/server_identity_key.pem),
# damit Clients nach Restarts nicht erneut „Vertrauen?“ sehen.
#
# Läuft bewusst kurz und blockiert systemd nicht lange.
# Für ExecStartPost: über bedrock-identity.service (oneshot, After=) oder
#   ExecStartPost=+/bin/systemctl --no-block start minecraft-bedrock-identity.service
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/minecraft-bedrock}"
SERVICE_NAME="${SERVICE_NAME:-minecraft-bedrock}"
FIFO="${INSTALL_DIR}/console.in"
CMD_BIN="${INSTALL_DIR}/bin/bedrock-cmd.sh"
KEY_FILE="${INSTALL_DIR}/keys/server_identity_key.pem"
LOG_TAG="save-server-identity"

log() {
  echo "[$LOG_TAG] $*"
}

# FIFO abwarten (Server-Wrapper ist hoch)
for _ in $(seq 1 60); do
  if [[ -p "$FIFO" ]] && systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    break
  fi
  sleep 1
done

if [[ ! -p "$FIFO" ]]; then
  log "FIFO fehlt – überspringe."
  exit 0
fi

# BDS braucht nach Prozessstart noch etwas, bis die Konsole bereit ist
sleep 8

send_cmd() {
  if [[ -x "$CMD_BIN" ]]; then
    "$CMD_BIN" "$@" || true
  else
    printf '%s\n' "$*" >"$FIFO" || true
  fi
}

send_cmd serveridentity save
sleep 1
send_cmd serveridentity status
sleep 1

if [[ -f "$KEY_FILE" ]]; then
  log "Identität gespeichert: $KEY_FILE"
  exit 0
fi

# Zweiter Versuch (Konsole ggf. noch nicht bereit)
sleep 5
send_cmd serveridentity save
sleep 1
if [[ -f "$KEY_FILE" ]]; then
  log "Identität gespeichert (2. Versuch): $KEY_FILE"
else
  log "WARNUNG: $KEY_FILE fehlt – manuell: ${CMD_BIN} serveridentity save"
  exit 1
fi
