#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "church" (Dorf-/Stadtkirche).
 *
 * Im Spiel:
 *   /function church/start
 *   /function church/clear
 *
 * Aufruf:
 *   node gameplay/church/generate_church_pack.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fill, setblock } from "../lib/mc_gen.mjs";
import { writeDeployScript, writeLandmarkPack } from "../lib/landmark_pack.mjs";

const PACK_UUID = "c1a8e3d4-7b2f-4a91-9e6c-3d5f8a0b2c4e";
const MODULE_UUID = "d2b9f4e5-8c3a-5b02-af7d-4e6a9b1c3d5f";
const PACK_VERSION = [1, 0, 0];

const CHURCH_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(CHURCH_DIR, "behavior_packs", "church_gen");

const SIZE_X = 24;
const SIZE_Z = 40;
const MAX_HEIGHT = 35;

const STONE = "stone_bricks";
const QUARTZ = "quartz_block";
const GLASS = [
  "red_stained_glass_pane",
  "blue_stained_glass_pane",
  "yellow_stained_glass_pane",
  "purple_stained_glass_pane",
];

function stair(block, x, y, z, facing) {
  const dir = { east: 0, west: 1, south: 2, north: 3 }[facing];
  return setblock(x, y, z, `${block} ["weirdo_direction":${dir},"upside_down_bit":false]`);
}

function buildChurchCommands() {
  const cmds = [];
  // Boden: Gras + Kirchenboden
  cmds.push(fill(0, 0, 0, SIZE_X - 1, 0, SIZE_Z - 1, "grass_block"));
  cmds.push(fill(0, 1, 0, SIZE_X - 1, MAX_HEIGHT, SIZE_Z - 1, "air"));

  // Schiff: x 4–19, z 10–37 (innen), Aussenwände
  const nx0 = 4;
  const nx1 = 19;
  const nz0 = 10;
  const nz1 = 37;
  const wallH = 10;

  // Fundament
  cmds.push(fill(nx0, 0, nz0, nx1, 0, nz1, STONE));

  // Wände
  cmds.push(fill(nx0, 1, nz0, nx1, wallH, nz0, STONE));
  cmds.push(fill(nx0, 1, nz1, nx1, wallH, nz1, STONE));
  cmds.push(fill(nx0, 1, nz0, nx0, wallH, nz1, STONE));
  cmds.push(fill(nx1, 1, nz0, nx1, wallH, nz1, STONE));

  // Innenraum
  cmds.push(fill(nx0 + 1, 1, nz0 + 1, nx1 - 1, wallH - 1, nz1 - 1, "air"));
  cmds.push(fill(nx0 + 1, 0, nz0 + 1, nx1 - 1, 0, nz1 - 1, QUARTZ));

  // Buntglas-Fenster (Ost/West/Nord)
  for (let z = nz0 + 3; z <= nz1 - 3; z += 4) {
    const g = GLASS[(z / 4) % GLASS.length];
    cmds.push(fill(nx0, 3, z, nx0, 6, z + 1, g));
    cmds.push(fill(nx1, 3, z, nx1, 6, z + 1, g));
  }
  for (let x = nx0 + 3; x <= nx1 - 3; x += 3) {
    cmds.push(fill(x, 3, nz0, x + 1, 6, nz0, GLASS[x % GLASS.length]));
  }

  // Spitzdach über Schiff (Treppen Ost/West)
  for (let i = 0; i < 8; i++) {
    const y = wallH + i;
    const xL = nx0 + i;
    const xR = nx1 - i;
    if (xL > xR) break;
    cmds.push(fill(xL, y, nz0, xL, y, nz1, "dark_oak_planks"));
    cmds.push(fill(xR, y, nz0, xR, y, nz1, "dark_oak_planks"));
    if (xL + 1 <= xR - 1) {
      cmds.push(fill(xL + 1, y, nz0, xR - 1, y, nz1, "air"));
    }
  }
  // Dachfirst
  const ridgeY = wallH + 7;
  cmds.push(fill(11, ridgeY, nz0, 12, ridgeY, nz1, "dark_oak_planks"));

  // Westturm (Südseite = Eingang, Turm bei z klein? Plan: Westturm – bei uns West = -X, also x klein)
  // Eingang an Südseite (hohe z); Turm an Nordwest: x 4–11, z 2–9
  const tx0 = 6;
  const tx1 = 13;
  const tz0 = 2;
  const tz1 = 9;
  const towerH = 22;

  cmds.push(fill(tx0, 0, tz0, tx1, 0, tz1, STONE));
  cmds.push(fill(tx0, 1, tz0, tx1, towerH, tz0, STONE));
  cmds.push(fill(tx0, 1, tz1, tx1, towerH, tz1, STONE));
  cmds.push(fill(tx0, 1, tz0, tx0, towerH, tz1, STONE));
  cmds.push(fill(tx1, 1, tz0, tx1, towerH, tz1, STONE));
  cmds.push(fill(tx0 + 1, 1, tz0 + 1, tx1 - 1, towerH - 1, tz1 - 1, "air"));
  cmds.push(fill(tx0 + 1, 0, tz0 + 1, tx1 - 1, 0, tz1 - 1, STONE));

  // Verbindung Turm → Schiff
  cmds.push(fill(tx0 + 2, 1, tz1, tx1 - 2, 4, nz0, "air"));
  cmds.push(fill(tx0 + 2, 0, tz1, tx1 - 2, 0, nz0, QUARTZ));

  // Turmfenster
  cmds.push(fill(tx0, 8, 4, tx0, 11, 5, "glass_pane"));
  cmds.push(fill(tx1, 8, 4, tx1, 11, 5, "glass_pane"));
  cmds.push(fill(8, 8, tz0, 11, 11, tz0, "glass_pane"));

  // Turmspitze (Pyramide)
  for (let i = 0; i < 5; i++) {
    const y = towerH + 1 + i;
    const a = tx0 + i;
    const b = tx1 - i;
    const c = tz0 + i;
    const d = tz1 - i;
    if (a > b || c > d) break;
    cmds.push(fill(a, y, c, b, y, d, QUARTZ));
  }
  // Kreuz
  const cx = Math.floor((tx0 + tx1) / 2);
  const cz = Math.floor((tz0 + tz1) / 2);
  const cy = towerH + 6;
  cmds.push(setblock(cx, cy, cz, "iron_bars"));
  cmds.push(setblock(cx, cy + 1, cz, "iron_bars"));
  cmds.push(setblock(cx - 1, cy + 1, cz, "iron_bars"));
  cmds.push(setblock(cx + 1, cy + 1, cz, "iron_bars"));
  cmds.push(setblock(cx, cy + 2, cz, "iron_bars"));

  // Südportal
  const doorX0 = 10;
  const doorX1 = 13;
  cmds.push(fill(doorX0 - 1, 1, nz1, doorX1 + 1, 5, nz1, STONE));
  cmds.push(fill(doorX0, 1, nz1, doorX1, 3, nz1, "air"));
  cmds.push(
    setblock(
      doorX0,
      1,
      nz1,
      'wooden_door ["direction":2,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":false]',
    ),
  );
  cmds.push(
    setblock(
      doorX0,
      2,
      nz1,
      'wooden_door ["direction":2,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":true]',
    ),
  );
  cmds.push(
    setblock(
      doorX0 + 1,
      1,
      nz1,
      'wooden_door ["direction":2,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":false]',
    ),
  );
  cmds.push(
    setblock(
      doorX0 + 1,
      2,
      nz1,
      'wooden_door ["direction":2,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":true]',
    ),
  );
  // Freitreppe
  cmds.push(fill(doorX0, 0, nz1 + 1, doorX1, 0, nz1 + 2, STONE));
  cmds.push(stair("quartz_stairs", doorX0, 0, nz1 + 2, "south"));
  cmds.push(stair("quartz_stairs", doorX0 + 1, 0, nz1 + 2, "south"));
  cmds.push(stair("quartz_stairs", doorX0 + 2, 0, nz1 + 2, "south"));
  cmds.push(stair("quartz_stairs", doorX0 + 3, 0, nz1 + 2, "south"));

  // Altar (Nordende innen)
  cmds.push(fill(10, 1, 12, 13, 1, 14, QUARTZ));
  cmds.push(setblock(11, 2, 12, "candle"));
  cmds.push(setblock(12, 2, 12, "candle"));

  // Bänke (Eichenstufen)
  for (let z = 18; z <= 32; z += 3) {
    cmds.push(fill(6, 1, z, 8, 1, z, "oak_stairs"));
    cmds.push(fill(15, 1, z, 17, 1, z, "oak_stairs"));
  }

  // Weg vom Portal nach Südrand
  cmds.push(fill(doorX0, 0, nz1 + 1, doorX1, 0, SIZE_Z - 1, "stone_bricks"));

  return cmds;
}

function main() {
  const buildCommands = buildChurchCommands();
  const meta = writeLandmarkPack({
    outDir: OUT_DIR,
    ns: "church",
    displayName: "Church",
    description: `Dorfkirche ${SIZE_X}×${SIZE_Z}`,
    packUuid: PACK_UUID,
    moduleUuid: MODULE_UUID,
    packVersion: PACK_VERSION,
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
    maxHeight: MAX_HEIGHT,
    buildCommands,
    groupTag: "ch_o",
    idPrefix: "ch",
  });

  writeDeployScript(path.join(CHURCH_DIR, "deploy_church_pack.sh"), {
    packFolder: "church_gen",
    packUuid: PACK_UUID,
    packVersion: PACK_VERSION,
    generateCmd: "node gameplay/church/generate_church_pack.mjs",
    ns: "church",
    sizeX: SIZE_X,
    sizeZ: SIZE_Z,
  });

  console.log(`Fertig: ${OUT_DIR}`);
  console.log(`  ${meta.size_x}×${meta.size_z}, Höhe ${meta.max_height}`);
  console.log(`  /function church/start  (${meta.build_steps} Schritte, ${meta.build_commands} Befehle)`);
  console.log(`  /function church/clear  (${meta.clear_steps} Schritte)`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
}
