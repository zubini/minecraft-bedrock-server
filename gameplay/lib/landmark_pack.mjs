/**
 * Schreibt ein einzelnes Landmarken-Behavior-Pack (start + clear + tick).
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildClearCommandBatches,
  chunkCommands,
  originMarkerLines,
  pad2,
  tickingAreaAddCmd,
  writeMcfunction,
} from "./mc_gen.mjs";

const CMDS_PER_TICK = 28;

/**
 * @param {object} opts
 * @param {string} opts.outDir – Zielordner des Packs
 * @param {string} opts.ns – Function-Namespace (z.B. church)
 * @param {string} opts.displayName – Anzeigename im Manifest
 * @param {string} opts.description
 * @param {string} opts.packUuid
 * @param {string} opts.moduleUuid
 * @param {number[]} opts.packVersion
 * @param {number} opts.sizeX
 * @param {number} opts.sizeZ
 * @param {number} opts.maxHeight
 * @param {string[]} opts.buildCommands – alle Bau-Befehle in Reihenfolge
 * @param {string} [opts.groupTag] – Armor-Stand-Gruppen-Tag
 * @param {string} [opts.idPrefix] – kurze IDs für Scoreboard/Tags (max ~6 Zeichen)
 * @param {number} [opts.cmdsPerTick]
 */
export function writeLandmarkPack(opts) {
  const {
    outDir,
    ns,
    displayName,
    description,
    packUuid,
    moduleUuid,
    packVersion,
    sizeX,
    sizeZ,
    maxHeight,
    buildCommands,
    groupTag = "lm_o",
    idPrefix = ns.slice(0, 4),
    cmdsPerTick = CMDS_PER_TICK,
  } = opts;

  const tag = `${idPrefix}_o`;
  const objBuild = `${idPrefix}_b`;
  const objClear = `${idPrefix}_c`;
  const buildArea = `${idPrefix}_a`;
  const clearArea = `${idPrefix}_ca`;
  const clearTag = `${idPrefix}_co`;

  fs.rmSync(outDir, { recursive: true, force: true });
  const functionsRoot = path.join(outDir, "functions");
  const nsDir = path.join(functionsRoot, ns);
  fs.mkdirSync(nsDir, { recursive: true });

  const buildBatches = chunkCommands(buildCommands, cmdsPerTick);
  const clearBatches = buildClearCommandBatches(sizeX, maxHeight, sizeZ);
  // clear batches already chunked to 3; re-chunk if needed is no-op for structure
  const clearChunks = clearBatches.length > 0 ? clearBatches : [[]];

  const buildDir = path.join(nsDir, "build_batches");
  fs.mkdirSync(buildDir, { recursive: true });
  for (let i = 0; i < buildBatches.length; i++) {
    writeMcfunction(path.join(buildDir, `b_${pad2(i)}.mcfunction`), buildBatches[i]);
  }

  const clearDir = path.join(nsDir, "clear_batches");
  fs.mkdirSync(clearDir, { recursive: true });
  for (let i = 0; i < clearChunks.length; i++) {
    writeMcfunction(path.join(clearDir, `c_${pad2(i)}.mcfunction`), clearChunks[i]);
  }

  const nBuild = Math.max(1, buildBatches.length);
  const nClear = Math.max(1, clearChunks.length);
  const stepFirstBuild = 1;
  const stepLastBuild = stepFirstBuild + nBuild - 1;
  const stepBuildDone = stepLastBuild + 1;

  // start
  const startLines = [
    `tellraw @a {"rawtext":[{"text":"[${ns}] Starte – Nordwest-Ecke, Fläche ${sizeX}×${sizeZ} nach Ost+Süd …"}]}`,
    `scoreboard objectives add ${objBuild} dummy`,
    `scoreboard objectives add ${objClear} dummy`,
    `tickingarea remove ${buildArea}`,
    `tickingarea remove ${clearArea}`,
    `kill @e[type=armor_stand,tag=${groupTag}]`,
    ...originMarkerLines(tag, groupTag),
    tickingAreaAddCmd(sizeX, maxHeight, buildArea, sizeZ),
    `scoreboard players set @e[tag=${tag},c=1] ${objBuild} ${stepFirstBuild}`,
  ];
  if (buildBatches.length > 0) {
    startLines.push(
      `execute as @e[tag=${tag},c=1] at @s run function ${ns}/build_batches/b_00`,
    );
    startLines.push(`scoreboard players set @e[tag=${tag},c=1] ${objBuild} ${stepFirstBuild + 1}`);
  }
  startLines.push(
    `tellraw @a {"rawtext":[{"text":"[${ns}] Bau läuft (${nBuild} Schritte) …"}]}`,
  );
  writeMcfunction(path.join(nsDir, "start.mcfunction"), startLines);

  writeMcfunction(path.join(nsDir, "build_done.mcfunction"), [
    `scoreboard players set @e[tag=${tag}] ${objBuild} 0`,
    `tickingarea remove ${buildArea}`,
    `kill @e[tag=${tag}]`,
    `tellraw @a {"rawtext":[{"text":"[${ns}] Fertig. Undo: /function ${ns}/clear"}]}`,
  ]);

  // clear
  writeMcfunction(path.join(nsDir, "clear.mcfunction"), [
    `tellraw @a {"rawtext":[{"text":"[${ns}] Clear – an die Nordwest-Ecke stellen (${sizeX}×${sizeZ}) …"}]}`,
    `scoreboard objectives add ${objClear} dummy`,
    `scoreboard objectives add ${objBuild} dummy`,
    `tickingarea remove ${clearArea}`,
    `tickingarea remove ${buildArea}`,
    `kill @e[type=armor_stand,tag=${groupTag}]`,
    ...originMarkerLines(clearTag, groupTag),
    tickingAreaAddCmd(sizeX, maxHeight, clearArea, sizeZ),
    `scoreboard players set @e[tag=${clearTag},c=1] ${objClear} 1`,
    `execute as @e[tag=${clearTag},c=1] at @s run function ${ns}/clear_batches/c_00`,
    `scoreboard players set @e[tag=${clearTag},c=1] ${objClear} 2`,
    `tellraw @a {"rawtext":[{"text":"[${ns}] Clear läuft (${nClear} Schritte) …"}]}`,
  ]);

  writeMcfunction(path.join(nsDir, "clear_done.mcfunction"), [
    `scoreboard players set @e[tag=${clearTag}] ${objClear} 0`,
    `tickingarea remove ${clearArea}`,
    `kill @e[tag=${clearTag}]`,
    `tellraw @a {"rawtext":[{"text":"[${ns}] Clear fertig."}]}`,
  ]);

  // on_tick
  const onTick = [];
  for (let i = 0; i < nBuild; i++) {
    const step = stepFirstBuild + i;
    const file = buildBatches.length > 0 ? `b_${pad2(i)}` : `b_00`;
    if (buildBatches.length > 0) {
      onTick.push(
        `execute as @e[tag=${tag},c=1] at @s if score @s ${objBuild} matches ${step} run function ${ns}/build_batches/${file}`,
      );
    }
  }
  if (nBuild > 0) {
    onTick.push(
      `execute as @e[tag=${tag},c=1] if score @s ${objBuild} matches ${stepFirstBuild}..${stepLastBuild} run scoreboard players add @s ${objBuild} 1`,
    );
    onTick.push(
      `execute as @e[tag=${tag},c=1] if score @s ${objBuild} matches ${stepBuildDone} run function ${ns}/build_done`,
    );
  }
  for (let i = 0; i < nClear; i++) {
    onTick.push(
      `execute as @e[tag=${clearTag},c=1] at @s if score @s ${objClear} matches ${i + 1} run function ${ns}/clear_batches/c_${pad2(i)}`,
    );
  }
  onTick.push(
    `execute as @e[tag=${clearTag},c=1] if score @s ${objClear} matches 1..${nClear} run scoreboard players add @s ${objClear} 1`,
  );
  onTick.push(
    `execute as @e[tag=${clearTag},c=1] if score @s ${objClear} matches ${nClear + 1} run function ${ns}/clear_done`,
  );
  writeMcfunction(path.join(nsDir, "on_tick.mcfunction"), onTick);

  fs.writeFileSync(
    path.join(functionsRoot, "tick.json"),
    JSON.stringify({ values: [`${ns}/on_tick`] }, null, 2) + "\n",
  );

  const manifest = {
    format_version: 2,
    header: {
      name: displayName,
      description,
      uuid: packUuid,
      version: packVersion,
      min_engine_version: [1, 20, 0],
    },
    modules: [{ type: "data", uuid: moduleUuid, version: packVersion }],
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const meta = {
    ns,
    size_x: sizeX,
    size_z: sizeZ,
    max_height: maxHeight,
    build_steps: nBuild,
    clear_steps: nClear,
    build_commands: buildCommands.length,
  };
  fs.writeFileSync(path.join(outDir, `${ns}_meta.json`), JSON.stringify(meta, null, 2) + "\n");

  return meta;
}

/** Deploy-Skript-Vorlage (Bash). */
export function writeDeployScript(filePath, opts) {
  const {
    packFolder,
    packUuid,
    packVersion,
    generateCmd,
    ns,
    sizeX,
    sizeZ,
  } = opts;
  const versionStr = JSON.stringify(packVersion);
  const content = `#!/usr/bin/env bash
# Deploy gameplay/${ns}/behavior_packs/${packFolder} to a Bedrock dedicated server.
#
# Usage:
#   ./gameplay/${ns}/deploy_${ns}_pack.sh minecraft
#   ./gameplay/${ns}/deploy_${ns}_pack.sh user@host
#   INSTALL_DIR=/opt/minecraft-bedrock ./gameplay/${ns}/deploy_${ns}_pack.sh minecraft
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PACK_SRC="\${SCRIPT_DIR}/behavior_packs/${packFolder}"
INSTALL_DIR="\${INSTALL_DIR:-/opt/minecraft-bedrock}"
PACK_UUID="${packUuid}"
PACK_VERSION='${versionStr}'

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
  $0 <ssh-target>     Deploy ${packFolder} pack to remote Bedrock server (ssh + rsync)

Example:
  $0 minecraft
  $0 user@server.example

Requires: behavior_packs/${packFolder} next to this script
(run: ${generateCmd} first).
EOF
}

[[ $# -eq 1 ]] || { usage; exit 1; }
[[ "$1" == "-h" || "$1" == "--help" ]] && { usage; exit 0; }
TARGET="$1"

[[ -f "\${PACK_SRC}/manifest.json" ]] || die "Pack missing at \${PACK_SRC} – run: ${generateCmd}"
command -v ssh >/dev/null || die "ssh not found"
command -v rsync >/dev/null || die "rsync not found"

REMOTE_PACK="\${INSTALL_DIR}/behavior_packs/${packFolder}"

log "Ensuring remote behavior_packs dir …"
ssh -o StrictHostKeyChecking=accept-new "$TARGET" \\
  "sudo mkdir -p $(printf '%q' "\${INSTALL_DIR}/behavior_packs") && sudo chown -R minecraft:minecraft $(printf '%q' "\${INSTALL_DIR}/behavior_packs")"

log "Syncing pack to \${TARGET}:\${REMOTE_PACK} …"
rsync -az --delete \\
  -e "ssh -o StrictHostKeyChecking=accept-new" \\
  --rsync-path="sudo -u minecraft rsync" \\
  "\${PACK_SRC}/" \\
  "\${TARGET}:\${REMOTE_PACK}/"

log "Enabling pack in world_behavior_packs.json …"
# shellcheck disable=SC2029
ssh -o StrictHostKeyChecking=accept-new "$TARGET" "sudo INSTALL_DIR=$(printf '%q' "$INSTALL_DIR") PACK_UUID=$(printf '%q' "$PACK_UUID") PACK_VERSION=$(printf '%q' "$PACK_VERSION") bash -s" <<'REMOTE'
set -euo pipefail
PROPS="\${INSTALL_DIR}/server.properties"
LEVEL="Bedrock level"
if [[ -f "$PROPS" ]]; then
  LEVEL="$(awk -F= '/^level-name=/{print substr($0, index($0,$2)); exit}' "$PROPS")"
  LEVEL="\${LEVEL:-Bedrock level}"
fi
WORLD="\${INSTALL_DIR}/worlds/\${LEVEL}"
[[ -d "$WORLD" ]] || { echo "ERROR: world dir not found: $WORLD" >&2; exit 1; }
WBP="\${WORLD}/world_behavior_packs.json"

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
path.write_text(json.dumps(out, indent=2) + "\\n", encoding="utf-8")
print(f"Wrote {path} ({len(out)} pack(s))")
PY

chown minecraft:minecraft "$WBP"
REMOTE

log "Restarting minecraft-bedrock so the pack loads …"
ssh -o StrictHostKeyChecking=accept-new "$TARGET" "sudo systemctl restart minecraft-bedrock"

log "Done."
echo
echo "Im Spiel (OP): Nordwest-Ecke, Fläche ${sizeX}×${sizeZ} nach Ost+Süd:"
echo "  /function ${ns}/start"
echo "Undo: /function ${ns}/clear"
echo "Details: gameplay/tipps.md — ggf. neu joinen."
`;
  fs.writeFileSync(filePath, content, "utf8");
  fs.chmodSync(filePath, 0o755);
}
