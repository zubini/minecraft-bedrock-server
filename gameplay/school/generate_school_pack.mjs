#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "school" (moderner Schulbau).
 *
 * Im Spiel:
 *   /function school/start
 *   /function school/clear
 *
 * Aufruf:
 *   node gameplay/school/generate_school_pack.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fill, setblock } from "../lib/mc_gen.mjs";
import { writeDeployScript, writeLandmarkPack } from "../lib/landmark_pack.mjs";

const PACK_UUID = "a5e2c7b8-1f6d-8e35-d20a-7b9d2e4f6a8c";
const MODULE_UUID = "b6f3d8c9-2a7e-9f46-e31b-8c0e3f5a7b9d";
const PACK_VERSION = [1, 0, 0];

const SCHOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(SCHOOL_DIR, "behavior_packs", "school_gen");

const SIZE_X = 36;
const SIZE_Z = 48;
const MAX_HEIGHT = 18;

const WALL = "white_concrete";
const ACCENT = "cyan_concrete";
const FLOOR = "light_gray_concrete";
const YARD = "gray_concrete";

function buildSchoolCommands() {
  const cmds = [];

  cmds.push(fill(0, 0, 0, SIZE_X - 1, 0, SIZE_Z - 1, "grass_block"));
  cmds.push(fill(0, 1, 0, SIZE_X - 1, MAX_HEIGHT, SIZE_Z - 1, "air"));

  // L-Grundriss: Nordtrakt (Klassen) + Westtrakt (Aula/Eingang)
  // Nordtrakt: x 2–33, z 2–14
  const n0x = 2;
  const n1x = 33;
  const n0z = 2;
  const n1z = 14;
  const h = 8;

  cmds.push(fill(n0x, 0, n0z, n1x, 0, n1z, FLOOR));
  cmds.push(fill(n0x, 1, n0z, n1x, h, n0z, WALL));
  cmds.push(fill(n0x, 1, n1z, n1x, h, n1z, WALL));
  cmds.push(fill(n0x, 1, n0z, n0x, h, n1z, WALL));
  cmds.push(fill(n1x, 1, n0z, n1x, h, n1z, WALL));
  cmds.push(fill(n0x + 1, 1, n0z + 1, n1x - 1, h - 1, n1z - 1, "air"));
  cmds.push(fill(n0x, h, n0z, n1x, h, n1z, WALL));
  // 1. Stock Boden
  cmds.push(fill(n0x + 1, 4, n0z + 1, n1x - 1, 4, n1z - 1, FLOOR));

  // Fensterreihen
  for (let x = n0x + 2; x <= n1x - 2; x += 3) {
    cmds.push(fill(x, 2, n0z, x + 1, 3, n0z, "glass_pane"));
    cmds.push(fill(x, 5, n0z, x + 1, 6, n0z, "glass_pane"));
    cmds.push(fill(x, 2, n1z, x + 1, 3, n1z, "glass_pane"));
    cmds.push(fill(x, 5, n1z, x + 1, 6, n1z, "glass_pane"));
  }

  // Akzentband
  cmds.push(fill(n0x, 4, n0z, n1x, 4, n0z, ACCENT));
  cmds.push(fill(n0x, 4, n1z, n1x, 4, n1z, ACCENT));

  // Westtrakt: x 2–14, z 14–40 (inkl. Verbindung)
  const w0x = 2;
  const w1x = 14;
  const w0z = 14;
  const w1z = 40;

  cmds.push(fill(w0x, 0, w0z, w1x, 0, w1z, FLOOR));
  cmds.push(fill(w0x, 1, w0z, w1x, h, w0z, WALL));
  cmds.push(fill(w0x, 1, w1z, w1x, h, w1z, WALL));
  cmds.push(fill(w0x, 1, w0z, w0x, h, w1z, WALL));
  cmds.push(fill(w1x, 1, w0z, w1x, h, w1z, WALL));
  cmds.push(fill(w0x + 1, 1, w0z + 1, w1x - 1, h - 1, w1z - 1, "air"));
  cmds.push(fill(w0x, h, w0z, w1x, h, w1z, WALL));
  cmds.push(fill(w0x + 1, 4, w0z + 1, w1x - 1, 4, w1z - 1, FLOOR));

  for (let z = w0z + 2; z <= w1z - 2; z += 3) {
    cmds.push(fill(w0x, 2, z, w0x, 3, z + 1, "glass_pane"));
    cmds.push(fill(w0x, 5, z, w0x, 6, z + 1, "glass_pane"));
    cmds.push(fill(w1x, 2, z, w1x, 3, z + 1, "glass_pane"));
    cmds.push(fill(w1x, 5, z, w1x, 6, z + 1, "glass_pane"));
  }
  cmds.push(fill(w0x, 4, w0z, w0x, 4, w1z, ACCENT));
  cmds.push(fill(w1x, 4, w0z, w1x, 4, w1z, ACCENT));

  // Eingangshalle Süd am Westtrakt
  const dx0 = 5;
  const dx1 = 10;
  cmds.push(fill(dx0, 1, w1z, dx1, 4, w1z, ACCENT));
  cmds.push(fill(dx0 + 1, 1, w1z, dx1 - 1, 3, w1z, "air"));
  cmds.push(
    setblock(
      7,
      1,
      w1z,
      'wooden_door ["direction":2,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":false]',
    ),
  );
  cmds.push(
    setblock(
      7,
      2,
      w1z,
      'wooden_door ["direction":2,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":true]',
    ),
  );
  cmds.push(
    setblock(
      8,
      1,
      w1z,
      'wooden_door ["direction":2,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":false]',
    ),
  );
  cmds.push(
    setblock(
      8,
      2,
      w1z,
      'wooden_door ["direction":2,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":true]',
    ),
  );

  // Schulhof (Ost-Süd): Asphalt + Sportmarkierung
  const yx0 = 16;
  const yx1 = 34;
  const yz0 = 18;
  const yz1 = 44;
  cmds.push(fill(yx0, 0, yz0, yx1, 0, yz1, YARD));
  // Spielfeld-Linien
  cmds.push(fill(yx0 + 2, 0, yz0 + 2, yx1 - 2, 0, yz0 + 2, "white_concrete"));
  cmds.push(fill(yx0 + 2, 0, yz1 - 2, yx1 - 2, 0, yz1 - 2, "white_concrete"));
  cmds.push(fill(yx0 + 2, 0, yz0 + 2, yx0 + 2, 0, yz1 - 2, "white_concrete"));
  cmds.push(fill(yx1 - 2, 0, yz0 + 2, yx1 - 2, 0, yz1 - 2, "white_concrete"));
  cmds.push(fill(yx0 + 2, 0, Math.floor((yz0 + yz1) / 2), yx1 - 2, 0, Math.floor((yz0 + yz1) / 2), "white_concrete"));

  // Weg Eingang → Hof
  cmds.push(fill(7, 0, w1z + 1, 8, 0, SIZE_Z - 1, "stone_bricks"));

  // Innendetails: Tische/Regale Andeutung
  for (let x = 6; x <= 28; x += 5) {
    cmds.push(setblock(x, 1, 6, "oak_planks"));
    cmds.push(setblock(x, 1, 10, "oak_planks"));
    cmds.push(setblock(x, 5, 6, "oak_planks"));
    cmds.push(setblock(x, 5, 10, "bookshelf"));
  }

  // Fahnenmast
  cmds.push(fill(16, 1, 42, 16, 10, 42, "iron_bars"));
  cmds.push(setblock(16, 10, 41, "cyan_wool"));

  return cmds;
}

function main() {
  const buildCommands = buildSchoolCommands();
  const meta = writeLandmarkPack({
    outDir: OUT_DIR,
    ns: "school",
    displayName: "School",
    description: `Schule ${SIZE_X}×${SIZE_Z}`,
    packUuid: PACK_UUID,
    moduleUuid: MODULE_UUID,
    packVersion: PACK_VERSION,
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
    maxHeight: MAX_HEIGHT,
    buildCommands,
    groupTag: "sc_o",
    idPrefix: "sc",
  });

  writeDeployScript(path.join(SCHOOL_DIR, "deploy_school_pack.sh"), {
    packFolder: "school_gen",
    packUuid: PACK_UUID,
    packVersion: PACK_VERSION,
    generateCmd: "node gameplay/school/generate_school_pack.mjs",
    ns: "school",
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
  });

  console.log(`Fertig: ${OUT_DIR}`);
  console.log(`  ${meta.size_x}×${meta.size_z}, Höhe ${meta.max_height}`);
  console.log(`  /function school/start  (${meta.build_steps} Schritte, ${meta.build_commands} Befehle)`);
  console.log(`  /function school/clear  (${meta.clear_steps} Schritte)`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
}
