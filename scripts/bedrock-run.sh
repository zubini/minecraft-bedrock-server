#!/usr/bin/env bash
# Startet bedrock_server mit Konsolen-FIFO (stdin), damit remote Befehle möglich sind.
# Wird von systemd ExecStart aufgerufen – nicht manuell nötig.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/minecraft-bedrock}"
FIFO="${INSTALL_DIR}/console.in"
BIN="${INSTALL_DIR}/bedrock_server"

cd "$INSTALL_DIR"
export LD_LIBRARY_PATH=.

if [[ ! -x "$BIN" ]]; then
  echo "ERROR: $BIN missing or not executable" >&2
  exit 1
fi

# Alte FIFO entfernen und neu anlegen (sonst hängt ein defekter Pipe-Zustand)
rm -f "$FIFO"
mkfifo "$FIFO"
chmod 660 "$FIFO"

# RDWR offen halten: Writer (bedrock-cmd) schliessen → kein EOF auf stdin → Server bleibt live
exec 3<>"$FIFO"
exec "$BIN" <&3
