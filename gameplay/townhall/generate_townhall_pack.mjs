#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "townhall" (Rathaus).
 *
 * Im Spiel:
 *   /function townhall/start
 *   /function townhall/clear
 *
 * Aufruf:
 *   node gameplay/townhall/generate_townhall_pack.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fill, setblock } from "../lib/mc_gen.mjs";
import { writeDeployScript, writeLandmarkPack } from "../lib/landmark_pack.mjs";

const PACK_UUID = "c7a4e9d0-3b8f-0a57-f42c-9d1f4a6b8c0e";
const MODULE_UUID = "d8b5f0e1-4c9a-1b68-a53d-0e2a5b7c9d1f";
const PACK_VERSION = [1, 0, 0];

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(DIR, "behavior_packs", "townhall_gen");

const SIZE_X = 32;
const SIZE_Z = 32;
const MAX_HEIGHT = 28;

const STONE = "stone_bricks";
const QUARTZ = "quartz_block";

function stair(x, y, z, facing) {
  const dir = { east: 0, west: 1, south: 2, north: 3 }[facing];
  return setblock(x, y, z, `quartz_stairs ["weirdo_direction":${dir},"upside_down_bit":false]`);
}

function buildTownhallCommands() {
  const cmds = [];

  cmds.push(fill(0, 0, 0, SIZE_X - 1, 0, SIZE_Z - 1, "grass_block"));
  cmds.push(fill(0, 1, 0, SIZE_X - 1, MAX_HEIGHT, SIZE_Z - 1, "air"));

  // Vorplatz (Süd)
  cmds.push(fill(4, 0, 22, 27, 0, 31, "stone_bricks"));

  // Hauptgebäude symmetrisch: x 4–27, z 6–22
  const x0 = 4;
  const x1 = 27;
  const z0 = 6;
  const z1 = 22;
  const h = 12;

  cmds.push(fill(x0, 0, z0, x1, 0, z1, STONE));
  cmds.push(fill(x0, 1, z0, x1, h, z0, STONE));
  cmds.push(fill(x0, 1, z1, x1, h, z1, STONE));
  cmds.push(fill(x0, 1, z0, x0, h, z1, STONE));
  cmds.push(fill(x1, 1, z0, x1, h, z1, STONE));
  cmds.push(fill(x0 + 1, 1, z0 + 1, x1 - 1, h - 1, z1 - 1, "air"));
  cmds.push(fill(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, QUARTZ));
  cmds.push(fill(x0, h, z0, x1, h, z1, STONE));
  // 1. Stock
  cmds.push(fill(x0 + 1, 6, z0 + 1, x1 - 1, 6, z1 - 1, QUARTZ));

  // Mittelrisalit (Vorsprung Süd)
  const rx0 = 12;
  const rx1 = 19;
  cmds.push(fill(rx0, 1, z1, rx1, h + 2, z1 + 2, STONE));
  cmds.push(fill(rx0 + 1, 1, z1 + 1, rx1 - 1, h + 1, z1 + 1, "air"));
  cmds.push(fill(rx0, h + 2, z1, rx1, h + 2, z1 + 2, QUARTZ));

  // Freitreppe zum Portal
  for (let i = 0; i < 4; i++) {
    cmds.push(fill(rx0 + 1, i, z1 + 3 + i, rx1 - 1, i, z1 + 3 + i, QUARTZ));
    for (let x = rx0 + 1; x <= rx1 - 1; x++) {
      cmds.push(stair(x, i, z1 + 4 + i, "south"));
    }
  }

  // Portal
  cmds.push(fill(14, 1, z1 + 2, 17, 4, z1 + 2, "air"));
  cmds.push(
    setblock(14, 1, z1 + 2, 'wooden_door ["direction":2,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":false]'),
  );
  cmds.push(
    setblock(14, 2, z1 + 2, 'wooden_door ["direction":2,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":true]'),
  );
  cmds.push(
    setblock(15, 1, z1 + 2, 'wooden_door ["direction":2,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":false]'),
  );
  cmds.push(
    setblock(15, 2, z1 + 2, 'wooden_door ["direction":2,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":true]'),
  );

  // Fenster symmetrisch
  for (let x = x0 + 2; x <= x1 - 2; x += 3) {
    if (x >= rx0 && x <= rx1) continue;
    cmds.push(fill(x, 2, z0, x + 1, 4, z0, "glass_pane"));
    cmds.push(fill(x, 7, z0, x + 1, 9, z0, "glass_pane"));
    cmds.push(fill(x, 2, z1, x + 1, 4, z1, "glass_pane"));
    cmds.push(fill(x, 7, z1, x + 1, 9, z1, "glass_pane"));
  }
  for (let z = z0 + 2; z <= z1 - 2; z += 3) {
    cmds.push(fill(x0, 2, z, x0, 4, z + 1, "glass_pane"));
    cmds.push(fill(x0, 7, z, x0, 9, z + 1, "glass_pane"));
    cmds.push(fill(x1, 2, z, x1, 4, z + 1, "glass_pane"));
    cmds.push(fill(x1, 7, z, x1, 9, z + 1, "glass_pane"));
  }

  // Uhrenturm Mitte Nordseite
  const tx0 = 13;
  const tx1 = 18;
  const tz0 = 2;
  const tz1 = 7;
  const th = 24;

  cmds.push(fill(tx0, 0, tz0, tx1, 0, tz1, STONE));
  cmds.push(fill(tx0, 1, tz0, tx1, th, tz0, STONE));
  cmds.push(fill(tx0, 1, tz1, tx1, th, tz1, STONE));
  cmds.push(fill(tx0, 1, tz0, tx0, th, tz1, STONE));
  cmds.push(fill(tx1, 1, tz0, tx1, th, tz1, STONE));
  cmds.push(fill(tx0 + 1, 1, tz0 + 1, tx1 - 1, th - 1, tz1 - 1, "air"));
  cmds.push(fill(tx0, th, tz0, tx1, th, tz1, QUARTZ));

  // Uhrflächen
  cmds.push(fill(tx0, 18, 3, tx0, 21, 5, "white_concrete"));
  cmds.push(fill(tx1, 18, 3, tx1, 21, 5, "white_concrete"));
  cmds.push(setblock(tx0, 19, 4, "black_concrete"));
  cmds.push(setblock(tx1, 19, 4, "black_concrete"));

  // Turmspitze
  for (let i = 0; i < 4; i++) {
    cmds.push(fill(tx0 + i, th + 1 + i, tz0 + i, tx1 - i, th + 1 + i, tz1 - i, QUARTZ));
  }
  cmds.push(fill(15, th + 5, 4, 16, th + 7, 5, "iron_bars"));

  // Verbindung Turm → Gebäude
  cmds.push(fill(14, 1, tz1, 17, 4, z0, "air"));
  cmds.push(fill(14, 0, tz1, 17, 0, z0, QUARTZ));

  // Fahnenmasten Vorplatz
  cmds.push(fill(6, 1, 28, 6, 8, 28, "iron_bars"));
  cmds.push(fill(25, 1, 28, 25, 8, 28, "iron_bars"));
  cmds.push(setblock(6, 8, 27, "red_wool"));
  cmds.push(setblock(25, 8, 27, "blue_wool"));

  // Innen: Empfangstheke
  cmds.push(fill(12, 1, 12, 19, 1, 13, QUARTZ));
  cmds.push(setblock(15, 2, 12, "flower_pot"));
  cmds.push(setblock(16, 2, 12, "flower_pot"));

  return cmds;
}

function main() {
  const buildCommands = buildTownhallCommands();
  const meta = writeLandmarkPack({
    outDir: OUT_DIR,
    ns: "townhall",
    displayName: "Town Hall",
    description: `Rathaus ${SIZE_X}×${SIZE_Z}`,
    packUuid: PACK_UUID,
    moduleUuid: MODULE_UUID,
    packVersion: PACK_VERSION,
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
    maxHeight: MAX_HEIGHT,
    buildCommands,
    groupTag: "th_o",
    idPrefix: "th",
  });

  writeDeployScript(path.join(DIR, "deploy_townhall_pack.sh"), {
    packFolder: "townhall_gen",
    packUuid: PACK_UUID,
    packVersion: PACK_VERSION,
    generateCmd: "node gameplay/townhall/generate_townhall_pack.mjs",
    ns: "townhall",
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
  });

  console.log(`Fertig: ${OUT_DIR}`);
  console.log(`  ${meta.size_x}×${meta.size_z}, Höhe ${meta.max_height}`);
  console.log(`  /function townhall/start  (${meta.build_steps} Schritte, ${meta.build_commands} Befehle)`);
  console.log(`  /function townhall/clear  (${meta.clear_steps} Schritte)`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
}
