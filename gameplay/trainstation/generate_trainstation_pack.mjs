#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "trainstation" (Empfangsgebäude + Gleise/Bahnsteige).
 *
 * Im Spiel:
 *   /function trainstation/start
 *   /function trainstation/clear
 *
 * Aufruf:
 *   node gameplay/trainstation/generate_trainstation_pack.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fill, setblock } from "../lib/mc_gen.mjs";
import { writeDeployScript, writeLandmarkPack } from "../lib/landmark_pack.mjs";

const PACK_UUID = "b1a7d4e5-8c2f-5a90-ae6b-3d4f7a9c1e2f";
const MODULE_UUID = "c2b8e5f6-9d3a-6b01-bf7c-4e5a8b0d2f3a";
const PACK_VERSION = [1, 0, 0];

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(DIR, "behavior_packs", "trainstation_gen");

/** Footprint: station building west, tracks east. */
const SIZE_X = 48;
const SIZE_Z = 56;
const MAX_HEIGHT = 22;

const WALL = "stone_bricks";
const ACCENT = "quartz_block";
const ROOF = "dark_oak_planks";
const PLATFORM = "smooth_stone";
const GRAVEL = "gravel";

function buildTrainstationCommands() {
  const cmds = [];

  cmds.push(fill(0, 0, 0, SIZE_X - 1, 0, SIZE_Z - 1, "grass_block"));
  cmds.push(fill(0, 1, 0, SIZE_X - 1, MAX_HEIGHT, SIZE_Z - 1, "air"));

  // --- Station hall (west) x 2–18, z 12–42 ---
  const bx0 = 2;
  const bx1 = 18;
  const bz0 = 12;
  const bz1 = 42;
  const hallH = 10;

  cmds.push(fill(bx0, 0, bz0, bx1, 0, bz1, WALL));
  cmds.push(fill(bx0 + 1, 0, bz0 + 1, bx1 - 1, 0, bz1 - 1, ACCENT));

  cmds.push(fill(bx0, 1, bz0, bx1, hallH, bz0, WALL));
  cmds.push(fill(bx0, 1, bz1, bx1, hallH, bz1, WALL));
  cmds.push(fill(bx0, 1, bz0, bx0, hallH, bz1, WALL));
  cmds.push(fill(bx1, 1, bz0, bx1, hallH, bz1, WALL));
  cmds.push(fill(bx0 + 1, 1, bz0 + 1, bx1 - 1, hallH - 1, bz1 - 1, "air"));
  cmds.push(fill(bx0, hallH, bz0, bx1, hallH, bz1, ROOF));

  // Glass toward tracks (east)
  for (let z = bz0 + 3; z <= bz1 - 3; z += 4) {
    cmds.push(fill(bx1, 2, z, bx1, 7, z + 2, "glass_pane"));
  }
  // West facade windows
  for (let z = bz0 + 4; z <= bz1 - 4; z += 5) {
    cmds.push(fill(bx0, 3, z, bx0, 6, z + 1, "glass_pane"));
  }
  // Main entrance west
  const doorZ0 = 25;
  cmds.push(fill(bx0, 1, doorZ0 - 1, bx0, 4, doorZ0 + 2, ACCENT));
  cmds.push(fill(bx0, 1, doorZ0, bx0, 3, doorZ0 + 1, "air"));
  cmds.push(
    setblock(
      bx0,
      1,
      doorZ0,
      'wooden_door ["direction":1,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":false]',
    ),
  );
  cmds.push(
    setblock(
      bx0,
      2,
      doorZ0,
      'wooden_door ["direction":1,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":true]',
    ),
  );
  cmds.push(
    setblock(
      bx0,
      1,
      doorZ0 + 1,
      'wooden_door ["direction":1,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":false]',
    ),
  );
  cmds.push(
    setblock(
      bx0,
      2,
      doorZ0 + 1,
      'wooden_door ["direction":1,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":true]',
    ),
  );
  cmds.push(fill(0, 0, doorZ0, 1, 0, doorZ0 + 1, WALL));
  cmds.push(fill(0, 0, doorZ0 - 1, 1, 0, doorZ0 + 2, "stone_bricks"));

  // Passage hall → platforms
  cmds.push(fill(bx1, 1, 24, bx1, 4, 31, "air"));
  cmds.push(fill(bx1 - 1, 0, 24, bx1, 0, 31, ACCENT));

  // Counter / benches inside
  cmds.push(fill(5, 1, 18, 8, 1, 19, ACCENT));
  cmds.push(setblock(6, 2, 18, "flower_pot"));
  for (let z = 20; z <= 36; z += 4) {
    cmds.push(fill(14, 1, z, 16, 1, z, "oak_stairs"));
  }

  // Clock tower NW of hall
  const tx0 = 2;
  const tx1 = 7;
  const tz0 = 4;
  const tz1 = 9;
  const th = 18;
  cmds.push(fill(tx0, 0, tz0, tx1, 0, tz1, WALL));
  cmds.push(fill(tx0, 1, tz0, tx1, th, tz0, WALL));
  cmds.push(fill(tx0, 1, tz1, tx1, th, tz1, WALL));
  cmds.push(fill(tx0, 1, tz0, tx0, th, tz1, WALL));
  cmds.push(fill(tx1, 1, tz0, tx1, th, tz1, WALL));
  cmds.push(fill(tx0 + 1, 1, tz0 + 1, tx1 - 1, th - 1, tz1 - 1, "air"));
  cmds.push(fill(tx0, th, tz0, tx1, th, tz1, ACCENT));
  cmds.push(fill(tx0, 14, 5, tx0, 16, 7, "white_concrete"));
  cmds.push(setblock(tx0, 15, 6, "black_concrete"));
  cmds.push(fill(4, th + 1, 6, 5, th + 3, 7, "iron_bars"));
  cmds.push(fill(4, 1, tz1, 5, 3, bz0, "air"));
  cmds.push(fill(4, 0, tz1, 5, 0, bz0, ACCENT));

  // --- Tracks (east) ---
  const trackZ0 = 2;
  const trackZ1 = SIZE_Z - 3;

  const tracks = [25, 31, 37];
  const platforms = [
    [21, 23],
    [27, 29],
    [33, 35],
    [39, 41],
  ];

  cmds.push(fill(20, 0, trackZ0, 42, 0, trackZ1, GRAVEL));

  for (const [px0, px1] of platforms) {
    cmds.push(fill(px0, 0, trackZ0, px1, 0, trackZ1, PLATFORM));
    cmds.push(fill(px0, 1, trackZ0, px1, 1, trackZ1, PLATFORM));
  }

  for (const tx of tracks) {
    cmds.push(fill(tx, 0, trackZ0, tx, 0, trackZ1, GRAVEL));
    for (let z = trackZ0; z <= trackZ1; z++) {
      cmds.push(setblock(tx, 1, z, "rail"));
    }
  }

  // Platform canopies
  for (const [px0, px1] of platforms.slice(0, 3)) {
    const mid = Math.floor((px0 + px1) / 2);
    cmds.push(fill(mid, 2, trackZ0 + 2, mid, 4, trackZ1 - 2, "iron_bars"));
    cmds.push(fill(px0, 5, trackZ0 + 2, px1, 5, trackZ1 - 2, "glass"));
    for (let z = trackZ0 + 4; z <= trackZ1 - 4; z += 8) {
      cmds.push(setblock(mid, 4, z, "lantern"));
    }
  }

  // Cross platform from hall
  cmds.push(fill(18, 0, 24, 41, 0, 31, PLATFORM));
  cmds.push(fill(18, 1, 24, 20, 1, 31, PLATFORM));
  for (const tx of tracks) {
    cmds.push(fill(tx, 1, 24, tx, 1, 31, "rail"));
  }

  // Buffer stops N/S
  for (const tx of tracks) {
    cmds.push(fill(tx - 1, 1, trackZ0, tx + 1, 2, trackZ0, WALL));
    cmds.push(fill(tx - 1, 1, trackZ1, tx + 1, 2, trackZ1, WALL));
  }

  // Signal masts
  cmds.push(fill(23, 2, 10, 23, 6, 10, "iron_bars"));
  cmds.push(setblock(23, 6, 10, "red_concrete"));
  cmds.push(fill(23, 2, 45, 23, 6, 45, "iron_bars"));
  cmds.push(setblock(23, 6, 45, "green_concrete"));

  // Forecourt west
  cmds.push(fill(0, 0, 20, 1, 0, 35, "stone_bricks"));
  cmds.push(setblock(1, 1, 22, "oak_fence"));
  cmds.push(setblock(1, 2, 22, "lantern"));
  cmds.push(setblock(1, 1, 33, "oak_fence"));
  cmds.push(setblock(1, 2, 33, "lantern"));

  return cmds;
}

function main() {
  const buildCommands = buildTrainstationCommands();
  const meta = writeLandmarkPack({
    outDir: OUT_DIR,
    ns: "trainstation",
    displayName: "Train Station",
    description: `Train station ${SIZE_X}×${SIZE_Z}`,
    packUuid: PACK_UUID,
    moduleUuid: MODULE_UUID,
    packVersion: PACK_VERSION,
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
    maxHeight: MAX_HEIGHT,
    buildCommands,
    groupTag: "ts_o",
    idPrefix: "ts",
  });

  writeDeployScript(path.join(DIR, "deploy_trainstation_pack.sh"), {
    packFolder: "trainstation_gen",
    packUuid: PACK_UUID,
    packVersion: PACK_VERSION,
    generateCmd: "node gameplay/trainstation/generate_trainstation_pack.mjs",
    ns: "trainstation",
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
  });

  console.log(`Fertig: ${OUT_DIR}`);
  console.log(`  ${meta.size_x}×${meta.size_z}, Höhe ${meta.max_height}`);
  console.log(`  /function trainstation/start  (${meta.build_steps} Schritte, ${meta.build_commands} Befehle)`);
  console.log(`  /function trainstation/clear  (${meta.clear_steps} Schritte)`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
}
