#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "stadium" (Allianz-Arena-Stil).
 *
 * Im Spiel:
 *   /function stadium/start
 *   /function stadium/clear
 *
 * Aufruf:
 *   node gameplay/stadium/generate_stadium_pack.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fill, fillLarge, inEllipse, inEllipseRing, setblock } from "../lib/mc_gen.mjs";
import { writeDeployScript, writeLandmarkPack } from "../lib/landmark_pack.mjs";

const PACK_UUID = "e3c0a5f6-9d4b-6c13-b08e-5f7b0c2d4e6a";
const MODULE_UUID = "f4d1b6a7-0e5c-7d24-c19f-6a8c1d3e5f7b";
const PACK_VERSION = [1, 0, 0];

const STADIUM_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(STADIUM_DIR, "behavior_packs", "stadium_gen");

const SIZE_X = 70;
const SIZE_Z = 100;
const MAX_HEIGHT = 28;

const CX = (SIZE_X - 1) / 2;
const CZ = (SIZE_Z - 1) / 2;

// Radien (Spielfeld innen → Aussenfassade)
const PITCH_RX = 18;
const PITCH_RZ = 30;
const BOWL_RX = 28;
const BOWL_RZ = 42;
const OUTER_RX = 33;
const OUTER_RZ = 48;

function buildStadiumCommands() {
  const cmds = [];

  // Terrain + Luft
  cmds.push(...fillLarge(0, 0, 0, SIZE_X - 1, 0, SIZE_Z - 1, "grass_block", "", 8192));
  cmds.push(...fillLarge(0, 1, 0, SIZE_X - 1, MAX_HEIGHT, SIZE_Z - 1, "air", "", 8192));

  // Aussenring-Boden (Kies ums Stadion)
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 0; z < SIZE_Z; z++) {
      if (inEllipse(x, z, CX, CZ, OUTER_RX + 1, OUTER_RZ + 1) && !inEllipse(x, z, CX, CZ, OUTER_RX - 1, OUTER_RZ - 1)) {
        cmds.push(setblock(x, 0, z, "light_gray_concrete"));
      }
    }
  }

  // Spielfeld
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 0; z < SIZE_Z; z++) {
      if (inEllipse(x, z, CX, CZ, PITCH_RX, PITCH_RZ)) {
        cmds.push(setblock(x, 0, z, "lime_concrete"));
      }
    }
  }

  // Mittellinie + Mittelkreis-Andeutung
  const midZ = Math.floor(CZ);
  cmds.push(fill(Math.floor(CX - PITCH_RX + 2), 0, midZ, Math.floor(CX + PITCH_RX - 2), 0, midZ, "white_concrete"));
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 0; z < SIZE_Z; z++) {
      if (inEllipseRing(x, z, CX, CZ, 5, 5, 4, 4)) {
        cmds.push(setblock(x, 0, z, "white_concrete"));
      }
    }
  }

  // Strafraum-Linien (Rechtecke N/S)
  const boxHalfX = 10;
  const boxDepth = 8;
  // Nord
  cmds.push(
    fill(
      Math.floor(CX - boxHalfX),
      0,
      Math.floor(CZ - PITCH_RZ + 1),
      Math.floor(CX + boxHalfX),
      0,
      Math.floor(CZ - PITCH_RZ + 1),
      "white_concrete",
    ),
  );
  cmds.push(
    fill(
      Math.floor(CX - boxHalfX),
      0,
      Math.floor(CZ - PITCH_RZ + 1),
      Math.floor(CX - boxHalfX),
      0,
      Math.floor(CZ - PITCH_RZ + boxDepth),
      "white_concrete",
    ),
  );
  cmds.push(
    fill(
      Math.floor(CX + boxHalfX),
      0,
      Math.floor(CZ - PITCH_RZ + 1),
      Math.floor(CX + boxHalfX),
      0,
      Math.floor(CZ - PITCH_RZ + boxDepth),
      "white_concrete",
    ),
  );
  cmds.push(
    fill(
      Math.floor(CX - boxHalfX),
      0,
      Math.floor(CZ - PITCH_RZ + boxDepth),
      Math.floor(CX + boxHalfX),
      0,
      Math.floor(CZ - PITCH_RZ + boxDepth),
      "white_concrete",
    ),
  );
  // Süd
  cmds.push(
    fill(
      Math.floor(CX - boxHalfX),
      0,
      Math.floor(CZ + PITCH_RZ - 1),
      Math.floor(CX + boxHalfX),
      0,
      Math.floor(CZ + PITCH_RZ - 1),
      "white_concrete",
    ),
  );
  cmds.push(
    fill(
      Math.floor(CX - boxHalfX),
      0,
      Math.floor(CZ + PITCH_RZ - boxDepth),
      Math.floor(CX - boxHalfX),
      0,
      Math.floor(CZ + PITCH_RZ - 1),
      "white_concrete",
    ),
  );
  cmds.push(
    fill(
      Math.floor(CX + boxHalfX),
      0,
      Math.floor(CZ + PITCH_RZ - boxDepth),
      Math.floor(CX + boxHalfX),
      0,
      Math.floor(CZ + PITCH_RZ - 1),
      "white_concrete",
    ),
  );
  cmds.push(
    fill(
      Math.floor(CX - boxHalfX),
      0,
      Math.floor(CZ + PITCH_RZ - boxDepth),
      Math.floor(CX + boxHalfX),
      0,
      Math.floor(CZ + PITCH_RZ - boxDepth),
      "white_concrete",
    ),
  );

  // Tore
  const goalW = 4;
  const goalH = 3;
  // Nordtor
  const gzN = Math.floor(CZ - PITCH_RZ + 1);
  cmds.push(fill(Math.floor(CX - goalW / 2), 1, gzN, Math.floor(CX + goalW / 2), goalH, gzN, "white_concrete"));
  cmds.push(fill(Math.floor(CX - goalW / 2) + 1, 1, gzN, Math.floor(CX + goalW / 2) - 1, goalH - 1, gzN, "air"));
  // Südtor
  const gzS = Math.floor(CZ + PITCH_RZ - 1);
  cmds.push(fill(Math.floor(CX - goalW / 2), 1, gzS, Math.floor(CX + goalW / 2), goalH, gzS, "white_concrete"));
  cmds.push(fill(Math.floor(CX - goalW / 2) + 1, 1, gzS, Math.floor(CX + goalW / 2) - 1, goalH - 1, gzS, "air"));

  // Ränge: gestufte Ringe zwischen Pitch und Bowl
  const tiers = 8;
  for (let t = 0; t < tiers; t++) {
    const t0 = t / tiers;
    const t1 = (t + 1) / tiers;
    const rxIn = PITCH_RX + 1 + t0 * (BOWL_RX - PITCH_RX - 1);
    const rzIn = PITCH_RZ + 1 + t0 * (BOWL_RZ - PITCH_RZ - 1);
    const rxOut = PITCH_RX + 1 + t1 * (BOWL_RX - PITCH_RX - 1);
    const rzOut = PITCH_RZ + 1 + t1 * (BOWL_RZ - PITCH_RZ - 1);
    const y = 1 + t;
    const seat = t % 2 === 0 ? "blue_concrete" : "red_concrete";
    for (let x = 0; x < SIZE_X; x++) {
      for (let z = 0; z < SIZE_Z; z++) {
        if (inEllipseRing(x, z, CX, CZ, rxOut, rzOut, rxIn, rzIn)) {
          cmds.push(setblock(x, y, z, seat));
          // Stufenboden darunter
          if (y > 1) cmds.push(setblock(x, y - 1, z, "stone_bricks"));
        }
      }
    }
  }

  // Weisse Glas-/Concrete-Hülle (Allianz-Look) aussen
  for (let y = 1; y <= 18; y++) {
    for (let x = 0; x < SIZE_X; x++) {
      for (let z = 0; z < SIZE_Z; z++) {
        if (inEllipseRing(x, z, CX, CZ, OUTER_RX, OUTER_RZ, BOWL_RX, BOWL_RZ)) {
          const block =
            y % 4 === 0
              ? "sea_lantern"
              : y % 2 === 0
                ? "white_stained_glass"
                : "white_concrete";
          cmds.push(setblock(x, y, z, block));
        }
      }
    }
  }

  // Dachring (offen in der Mitte)
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 0; z < SIZE_Z; z++) {
      if (inEllipseRing(x, z, CX, CZ, OUTER_RX, OUTER_RZ, BOWL_RX - 2, BOWL_RZ - 2)) {
        cmds.push(setblock(x, 19, z, "white_stained_glass"));
        if ((x + z) % 7 === 0) cmds.push(setblock(x, 18, z, "sea_lantern"));
      }
    }
  }

  // Eingänge (Ost/West Durchbrüche in der Hülle)
  for (let y = 1; y <= 4; y++) {
    for (let z = Math.floor(CZ) - 2; z <= Math.floor(CZ) + 2; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        if (inEllipseRing(x, z, CX, CZ, OUTER_RX, OUTER_RZ, BOWL_RX, BOWL_RZ)) {
          cmds.push(setblock(x, y, z, "air"));
        }
      }
    }
  }

  // Vorplatz-Wege Ost/West
  cmds.push(fill(0, 0, Math.floor(CZ) - 1, SIZE_X - 1, 0, Math.floor(CZ) + 1, "stone_bricks"));

  return cmds;
}

function main() {
  const buildCommands = buildStadiumCommands();
  const meta = writeLandmarkPack({
    outDir: OUT_DIR,
    ns: "stadium",
    displayName: "Stadium",
    description: `Fussball-Stadion (Arena-Stil) ${SIZE_X}×${SIZE_Z}`,
    packUuid: PACK_UUID,
    moduleUuid: MODULE_UUID,
    packVersion: PACK_VERSION,
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
    maxHeight: MAX_HEIGHT,
    buildCommands,
    groupTag: "st_o",
    idPrefix: "st",
    cmdsPerTick: 24,
  });

  writeDeployScript(path.join(STADIUM_DIR, "deploy_stadium_pack.sh"), {
    packFolder: "stadium_gen",
    packUuid: PACK_UUID,
    packVersion: PACK_VERSION,
    generateCmd: "node gameplay/stadium/generate_stadium_pack.mjs",
    ns: "stadium",
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
  });

  console.log(`Fertig: ${OUT_DIR}`);
  console.log(`  ${meta.size_x}×${meta.size_z}, Höhe ${meta.max_height}`);
  console.log(`  /function stadium/start  (${meta.build_steps} Schritte, ${meta.build_commands} Befehle)`);
  console.log(`  /function stadium/clear  (${meta.clear_steps} Schritte)`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
}
