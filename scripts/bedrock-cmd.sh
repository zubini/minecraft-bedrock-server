#!/usr/bin/env bash
# Sendet einen Befehl an die Bedrock-Server-Konsole (FIFO).
#
# Usage:
#   sudo ./scripts/bedrock-cmd.sh 'serveridentity save'
#   sudo /opt/minecraft-bedrock/bin/bedrock-cmd.sh say Hallo
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/minecraft-bedrock}"
FIFO="${INSTALL_DIR}/console.in"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <console-command…>" >&2
  exit 1
fi

if [[ ! -p "$FIFO" ]]; then
  echo "ERROR: Konsole nicht bereit ($FIFO fehlt). Läuft minecraft-bedrock?" >&2
  exit 1
fi

# Eine Zeile = ein Konsolenbefehl (ohne führendes /)
printf '%s\n' "$*" >"$FIFO"
