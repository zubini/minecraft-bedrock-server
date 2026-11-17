#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "park" (Stadtpark mit See).
 *
 * Im Spiel:
 *   /function park/start
 *   /function park/clear
 *
 * Aufruf:
 *   node gameplay/park/generate_park_pack.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRng, fill, inEllipse, setblock } from "../lib/mc_gen.mjs";
import { writeDeployScript, writeLandmarkPack } from "../lib/landmark_pack.mjs";

const PACK_UUID = "e9c6a1f2-5d0b-2c79-b64e-1f3b6c8d0e2a";
const MODULE_UUID = "f0d7b2a3-6e1c-3d8a-c75f-2a4c7d9e1f3b";
const PACK_VERSION = [1, 0, 0];

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(DIR, "behavior_packs", "park_gen");

const SIZE_X = 48;
const SIZE_Z = 48;
const MAX_HEIGHT = 12;

const FLOWERS = ["poppy", "dandelion", "azure_bluet", "oxeye_daisy", "cornflower", "allium"];

function placeTree(x, z) {
  return [
    setblock(x, 1, z, "oak_log"),
    setblock(x, 2, z, "oak_log"),
    setblock(x, 3, z, "oak_log"),
    fill(x - 1, 3, z - 1, x + 1, 4, z + 1, "oak_leaves"),
    setblock(x, 5, z, "oak_leaves"),
  ];
}

function buildParkCommands() {
  const cmds = [];
  const rng = createRng(42);

  cmds.push(fill(0, 0, 0, SIZE_X - 1, 0, SIZE_Z - 1, "grass_block"));
  cmds.push(fill(0, 1, 0, SIZE_X - 1, MAX_HEIGHT, SIZE_Z - 1, "air"));

  // Wege: Kreuz + Diagonale-Andeutung
  cmds.push(fill(22, 0, 0, 25, 0, SIZE_Z - 1, "gravel"));
  cmds.push(fill(0, 0, 22, SIZE_X - 1, 0, 25, "gravel"));
  // Ringweg um den See
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 0; z < SIZE_Z; z++) {
      if (inEllipse(x, z, 24, 24, 14, 11) && !inEllipse(x, z, 24, 24, 12, 9)) {
        cmds.push(setblock(x, 0, z, "stone_bricks"));
      }
    }
  }

  // See (Ellipse Mitte)
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 0; z < SIZE_Z; z++) {
      if (inEllipse(x, z, 24, 24, 10, 7)) {
        cmds.push(setblock(x, 0, z, "water"));
      }
    }
  }

  // Ufer (Sandrand)
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 0; z < SIZE_Z; z++) {
      if (inEllipse(x, z, 24, 24, 11, 8) && !inEllipse(x, z, 24, 24, 10, 7)) {
        cmds.push(setblock(x, 0, z, "sand"));
      }
    }
  }

  // Brücke Ost-West über den See
  cmds.push(fill(14, 1, 23, 34, 1, 24, "oak_planks"));
  cmds.push(fill(14, 2, 22, 34, 2, 22, "oak_fence"));
  cmds.push(fill(14, 2, 25, 34, 2, 25, "oak_fence"));

  // Bäume (nicht auf Wegen/See)
  const trees = [
    [5, 5],
    [8, 12],
    [6, 35],
    [10, 40],
    [38, 6],
    [42, 14],
    [40, 38],
    [35, 42],
    [15, 8],
    [30, 8],
    [15, 40],
    [32, 40],
    [4, 24],
    [43, 24],
  ];
  for (const [tx, tz] of trees) {
    cmds.push(...placeTree(tx, tz));
  }

  // Blumen
  for (let i = 0; i < 80; i++) {
    const x = rng.int(1, SIZE_X - 2);
    const z = rng.int(1, SIZE_Z - 2);
    if (inEllipse(x, z, 24, 24, 12, 9)) continue;
    if (x >= 22 && x <= 25) continue;
    if (z >= 22 && z <= 25) continue;
    cmds.push(setblock(x, 1, z, rng.pick(FLOWERS)));
  }

  // Bänke an Wegen
  const benches = [
    [20, 10],
    [27, 10],
    [20, 36],
    [27, 36],
    [10, 20],
    [10, 27],
    [36, 20],
    [36, 27],
  ];
  for (const [bx, bz] of benches) {
    cmds.push(setblock(bx, 1, bz, "oak_stairs"));
    cmds.push(setblock(bx + 1, 1, bz, "oak_stairs"));
  }

  // Laternen
  const lamps = [
    [22, 8],
    [25, 8],
    [22, 39],
    [25, 39],
    [8, 22],
    [8, 25],
    [39, 22],
    [39, 25],
  ];
  for (const [lx, lz] of lamps) {
    cmds.push(setblock(lx, 1, lz, "oak_fence"));
    cmds.push(setblock(lx, 2, lz, "oak_fence"));
    cmds.push(setblock(lx, 3, lz, "lantern"));
  }

  // Kleiner Pavillon Nordost
  cmds.push(fill(36, 0, 4, 44, 0, 12, "stone_bricks"));
  cmds.push(setblock(36, 1, 4, "oak_fence"));
  cmds.push(setblock(44, 1, 4, "oak_fence"));
  cmds.push(setblock(36, 1, 12, "oak_fence"));
  cmds.push(setblock(44, 1, 12, "oak_fence"));
  cmds.push(fill(36, 2, 4, 36, 3, 4, "oak_fence"));
  cmds.push(fill(44, 2, 4, 44, 3, 4, "oak_fence"));
  cmds.push(fill(36, 2, 12, 36, 3, 12, "oak_fence"));
  cmds.push(fill(44, 2, 12, 44, 3, 12, "oak_fence"));
  cmds.push(fill(36, 4, 4, 44, 4, 12, "oak_planks"));
  cmds.push(setblock(40, 1, 8, "crafting_table"));

  return cmds;
}

function main() {
  const buildCommands = buildParkCommands();
  const meta = writeLandmarkPack({
    outDir: OUT_DIR,
    ns: "park",
    displayName: "Park",
    description: `Stadtpark ${SIZE_X}×${SIZE_Z}`,
    packUuid: PACK_UUID,
    moduleUuid: MODULE_UUID,
    packVersion: PACK_VERSION,
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
    maxHeight: MAX_HEIGHT,
    buildCommands,
    groupTag: "pk_o",
    idPrefix: "pk",
  });

  writeDeployScript(path.join(DIR, "deploy_park_pack.sh"), {
    packFolder: "park_gen",
    packUuid: PACK_UUID,
    packVersion: PACK_VERSION,
    generateCmd: "node gameplay/park/generate_park_pack.mjs",
    ns: "park",
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
  });

  console.log(`Fertig: ${OUT_DIR}`);
  console.log(`  ${meta.size_x}×${meta.size_z}, Höhe ${meta.max_height}`);
  console.log(`  /function park/start  (${meta.build_steps} Schritte, ${meta.build_commands} Befehle)`);
  console.log(`  /function park/clear  (${meta.clear_steps} Schritte)`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
}
