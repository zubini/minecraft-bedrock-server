#!/usr/bin/env bash
# Deploy gameplay/school/behavior_packs/school_gen to a Bedrock dedicated server.
#
# Usage:
#   ./gameplay/school/deploy_school_pack.sh minecraft
#   ./gameplay/school/deploy_school_pack.sh user@host
#   INSTALL_DIR=/opt/minecraft-bedrock ./gameplay/school/deploy_school_pack.sh minecraft
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACK_SRC="${SCRIPT_DIR}/behavior_packs/school_gen"
INSTALL_DIR="${INSTALL_DIR:-/opt/minecraft-bedrock}"
PACK_UUID="a5e2c7b8-1f6d-8e35-d20a-7b9d2e4f6a8c"
PACK_VERSION='[1,0,0]'

die() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  echo "[*] $*"
}

usage() {
  cat <<EOF
Usage:
  $0 <ssh-target>     Deploy school_gen pack to remote Bedrock server (ssh + rsync)

Example:
  $0 minecraft
  $0 user@server.example

Requires: behavior_packs/school_gen next to this script
(run: node gameplay/school/generate_school_pack.mjs first).
EOF
}

[[ $# -eq 1 ]] || { usage; exit 1; }
[[ "$1" == "-h" || "$1" == "--help" ]] && { usage; exit 0; }
TARGET="$1"

[[ -f "${PACK_SRC}/manifest.json" ]] || die "Pack missing at ${PACK_SRC} – run: node gameplay/school/generate_school_pack.mjs"
command -v ssh >/dev/null || die "ssh not found"
command -v rsync >/dev/null || die "rsync not found"

REMOTE_PACK="${INSTALL_DIR}/behavior_packs/school_gen"

log "Ensuring remote behavior_packs dir …"
ssh -o StrictHostKeyChecking=accept-new "$TARGET" \
  "sudo mkdir -p $(printf '%q' "${INSTALL_DIR}/behavior_packs") && sudo chown -R minecraft:minecraft $(printf '%q' "${INSTALL_DIR}/behavior_packs")"

log "Syncing pack to ${TARGET}:${REMOTE_PACK} …"
rsync -az --delete \
  -e "ssh -o StrictHostKeyChecking=accept-new" \
  --rsync-path="sudo -u minecraft rsync" \
  "${PACK_SRC}/" \
  "${TARGET}:${REMOTE_PACK}/"

log "Enabling pack in world_behavior_packs.json …"
# shellcheck disable=SC2029
ssh -o StrictHostKeyChecking=accept-new "$TARGET" "sudo INSTALL_DIR=$(printf '%q' "$INSTALL_DIR") PACK_UUID=$(printf '%q' "$PACK_UUID") PACK_VERSION=$(printf '%q' "$PACK_VERSION") bash -s" <<'REMOTE'
set -euo pipefail
PROPS="${INSTALL_DIR}/server.properties"
LEVEL="Bedrock level"
if [[ -f "$PROPS" ]]; then
  LEVEL="$(awk -F= '/^level-name=/{print substr($0, index($0,$2)); exit}' "$PROPS")"
  LEVEL="${LEVEL:-Bedrock level}"
fi
WORLD="${INSTALL_DIR}/worlds/${LEVEL}"
[[ -d "$WORLD" ]] || { echo "ERROR: world dir not found: $WORLD" >&2; exit 1; }
WBP="${WORLD}/world_behavior_packs.json"

python3 - "$WBP" "$PACK_UUID" "$PACK_VERSION" <<'PY'
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
uuid = sys.argv[2]
version = json.loads(sys.argv[3])
entry = {"pack_id": uuid, "version": version}

data = []
if path.exists() and path.stat().st_size > 0:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"unexpected format in {path}")

out = [e for e in data if e.get("pack_id") != uuid]
out.append(entry)
path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {path} ({len(out)} pack(s))")
PY

chown minecraft:minecraft "$WBP"
REMOTE

log "Restarting minecraft-bedrock so the pack loads …"
ssh -o StrictHostKeyChecking=accept-new "$TARGET" "sudo systemctl restart minecraft-bedrock"

log "Done."
echo
echo "Im Spiel (OP): Nordwest-Ecke, Fläche 36×48 nach Ost+Süd:"
echo "  /function school/start"
echo "Undo: /function school/clear"
echo "Details: gameplay/tipps.md — ggf. neu joinen."
