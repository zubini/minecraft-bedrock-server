#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "city" mit mehreren Varianten.
 *
 * Im Spiel z.B.:
 *   /function city_1/start … /function city_5/start
 *   /function city/terrain | /function city/clear
 *
 * Aufruf:
 *   node gameplay/city/generate_city_pack.mjs --seed 42
 *
 * Stadt: 80×80, 4×4 Parzellen, Abstand zwischen Häusern ≥ 8 Blöcke.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAirClearCommands,
  buildClearCommandBatches,
  chunkCommands,
  createRng,
  fill,
  fillLarge,
  originMarkerLines as originMarkerLinesShared,
  pad2,
  setblock,
  tickingAreaAddCmd,
  writeMcfunction,
} from "../lib/mc_gen.mjs";

// ---------------------------------------------------------------------------
// Feste Werte
// ---------------------------------------------------------------------------

/** Diese UUIDs identifizieren das Pack auf dem Server – nicht ändern. */
const PACK_UUID = "a7c4e2b1-9f3d-4e8a-b6c1-2d5e8f0a1b3c";
const MODULE_UUID = "b8d5f3c2-0a4e-5f9b-c7d2-3e6f9a1b2c4d";

/** Ordner, in dem diese Datei liegt (= gameplay/city). */
const CITY_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Wohin das fertige Pack geschrieben wird. */
const OUT_DIR = path.join(CITY_DIR, "behavior_packs", "city_gen");

/** Mögliche Fassadenfarben (moderne Beton-Türme). */
const FACADE_COLORS = [
  "white_concrete",
  "light_gray_concrete",
  "cyan_concrete",
  "light_blue_concrete",
  "white_concrete",
];

/** Feste Stadtgrösse: 80×80 → 4×4 Parzellen bei Zellgrösse 20. */
const CITY_SIZE = 80;

/** Layout: lot | Bürgersteig | Strasse | Bürgersteig → Zelle 20 (Haus 11–13). */
const LAYOUT = {
  lot: 13,
  sidewalk: 1,
  street: 5,
};

/** Anzahl vorgefertigter Varianten (city_1 … city_N). */
const DEFAULT_VARIANTS = 5;

/** Pack-Version (bei Logik-Änderung erhöhen). */
const PACK_VERSION = [1, 7, 9];

/** Max. Befehle pro Gebäude-Tick (sonst bricht BDS lange Functions ab → nur 3–4 Häuser). */
const BUILDING_CMDS_PER_TICK = 28;

/** Origin-Marker mit City-Gruppen-Tag. */
function originMarkerLines(tag) {
  return originMarkerLinesShared(tag, "city_o");
}

/**
 * Weisse Treppenstufe (Quarz). weirdo_direction: 0=Ost, 1=West, 2=Süd, 3=Nord.
 */
function stair(x, y, z, facing) {
  const dir = { east: 0, west: 1, south: 2, north: 3 }[facing];
  if (dir === undefined) throw new Error(`Unbekannte Treppen-Richtung: ${facing}`);
  return setblock(
    x,
    y,
    z,
    `quartz_stairs ["weirdo_direction":${dir},"upside_down_bit":false]`,
  );
}

// ---------------------------------------------------------------------------
// Stadt-Layout: Parzellen (Bauplätze zwischen den Strassen)
// ---------------------------------------------------------------------------

/**
 * Raster:
 *   [Haus lot×lot][Bürgersteig][Strasse][Bürgersteig]  → wiederholt sich
 *
 * Bei lot=13, sidewalk=1, street=5 ist eine Zelle 20 Blöcke breit.
 * size=120 → 6×6 Parzellen, size=60 → 3×3.
 */
function createLots(size, lot, sidewalk, street) {
  const cell = lot + sidewalk + street + sidewalk;

  if (size % cell !== 0) {
    throw new Error(
      `size (${size}) muss durch ${cell} teilbar sein ` +
        `(lot ${lot} + Bürgersteig ${sidewalk} + Strasse ${street} + Bürgersteig ${sidewalk})`,
    );
  }

  const grid = size / cell;
  const lots = [];

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const x0 = col * cell;
      const z0 = row * cell;
      lots.push({
        // Bauplatz: inklusive Eckkoordinaten
        x0,
        z0,
        x1: x0 + lot - 1,
        z1: z0 + lot - 1,
        col,
        row,
      });
    }
  }

  return lots;
}

// ---------------------------------------------------------------------------
// Phasen: Terrain, Strassen, ein Hochhaus, Clear
// ---------------------------------------------------------------------------

/**
 * Terrain in kleine Batches (für tickweise Ausführung).
 * Boden = Gras (kein grauer Stein-Teppich); Strassen kommen danach als Steinziegel.
 */
function buildTerrainBatches(size, maxHeight) {
  const clearFillMax = 8192;
  const airCmds = fillLarge(0, 0, 0, size - 1, maxHeight, size - 1, "air", "", clearFillMax);
  const groundCmds = fillLarge(0, 0, 0, size - 1, 0, size - 1, "grass_block", "", clearFillMax);
  const all = [...airCmds, ...groundCmds];
  const batchSize = 8;
  const batches = [];
  for (let i = 0; i < all.length; i += batchSize) {
    batches.push(all.slice(i, i + batchSize));
  }
  if (batches.length > 0) {
    batches[batches.length - 1].push(
      'tellraw @a {"rawtext":[{"text":"[city] Terrain fertig – Häuser …"}]}',
    );
  }
  return batches;
}

/**
 * Nur die Fahrbahn als Steinziegel; Bürgersteige bleiben Gras.
 */
function buildRoadBatches(size, lot, sidewalk, street) {
  const cell = lot + sidewalk + street + sidewalk;
  const grid = size / cell;
  const batches = [];

  for (let i = 0; i < grid; i++) {
    const base = i * cell;
    const streetA = base + lot + sidewalk;
    const streetB = streetA + street - 1;

    batches.push(fillLarge(streetA, 0, 0, streetB, 0, size - 1, "stone_bricks"));
    batches.push(fillLarge(0, 0, streetA, size - 1, 0, streetB, "stone_bricks"));
  }

  if (batches.length > 0) {
    batches[batches.length - 1].push(
      'tellraw @a {"rawtext":[{"text":"[city] Strassen fertig – Grün …"}]}',
    );
  }
  return batches;
}

const FLOWERS = ["poppy", "dandelion", "azure_bluet", "oxeye_daisy", "cornflower", "allium"];

/** Footprint + Insets – gleicher RNG wie beim Häuserbau. */
function pickTowerLayout(lot, rng) {
  const lotWidth = lot.x1 - lot.x0 + 1;
  const lotDepth = lot.z1 - lot.z0 + 1;
  // 11–13: genug Innenraum für Einrichtung; ggf. schmaler Grünstreifen
  const footprint = rng.pick([11, 12, 13]);
  const insetX = Math.floor((lotWidth - footprint) / 2);
  const insetZ = Math.floor((lotDepth - footprint) / 2);
  return {
    footprint,
    x0: lot.x0 + insetX,
    z0: lot.z0 + insetZ,
    x1: lot.x0 + insetX + footprint - 1,
    z1: lot.z0 + insetZ + footprint - 1,
  };
}

/** Mehr Variation: oft mittel, seltener sehr hoch bis maxH. */
function pickTowerHeight(rng, minH, maxH) {
  const span = maxH - minH;
  const r = rng.random();
  if (r < 0.3) return rng.int(minH, minH + Math.floor(span * 0.35));
  if (r < 0.7) return rng.int(minH + Math.floor(span * 0.25), minH + Math.floor(span * 0.65));
  return rng.int(minH + Math.floor(span * 0.5), maxH);
}

/**
 * Bürgersteige + Hof (Lot minus Gebäude) begrünen: nur Blumen (keine Bäume).
 */
function buildLandscapeBatches(size, lot, sidewalk, street, seed, lots) {
  const cell = lot + sidewalk + street + sidewalk;
  const grid = size / cell;
  const rng = createRng((seed ^ 0x5f3759df) >>> 0);
  const cmds = [];

  const onEastWestStreet = (z) => {
    for (let i = 0; i < grid; i++) {
      const a = i * cell + lot + sidewalk;
      if (z >= a && z < a + street) return true;
    }
    return false;
  };
  const onNorthSouthStreet = (x) => {
    for (let i = 0; i < grid; i++) {
      const a = i * cell + lot + sidewalk;
      if (x >= a && x < a + street) return true;
    }
    return false;
  };

  // Bürgersteige – keine Blumen auf Fahrbahn-Kreuzungen
  for (let i = 0; i < grid; i++) {
    const base = i * cell;
    const walkW = base + lot;
    const walkE = base + lot + sidewalk + street;
    const walkN = walkW;
    const walkS = walkE;

    for (let z = 0; z < size; z++) {
      if (onEastWestStreet(z)) continue;
      if (rng.random() < 0.32) cmds.push(setblock(walkW, 1, z, rng.pick(FLOWERS)));
      if (rng.random() < 0.32) cmds.push(setblock(walkE, 1, z, rng.pick(FLOWERS)));
    }
    for (let x = 0; x < size; x++) {
      if (onNorthSouthStreet(x)) continue;
      if (rng.random() < 0.32) cmds.push(setblock(x, 1, walkN, rng.pick(FLOWERS)));
      if (rng.random() < 0.32) cmds.push(setblock(x, 1, walkS, rng.pick(FLOWERS)));
    }
  }

  // Höfe um die Gebäude — Südseite (Eingang) ohne Blumen
  for (const oneLot of lots) {
    const lotSeed = (seed + oneLot.col * 7919 + oneLot.row * 104729) >>> 0;
    const lotRng = createRng(lotSeed);
    const layout = pickTowerLayout(oneLot, lotRng);
    const doorX0 = layout.x0 + Math.floor(layout.footprint / 2) - 1;
    const doorX1 = doorX0 + 1;

    for (let x = oneLot.x0; x <= oneLot.x1; x++) {
      for (let z = oneLot.z0; z <= oneLot.z1; z++) {
        const underBuilding =
          x >= layout.x0 && x <= layout.x1 && z >= layout.z0 && z <= layout.z1;
        if (underBuilding) continue;

        // Vor dem Eingang (Süd) und im Tür-Pfad: kein Grün
        const southOfBuilding = z > layout.z1;
        const doorApproach =
          southOfBuilding && x >= doorX0 - 1 && x <= doorX1 + 1;
        if (southOfBuilding || doorApproach) continue;

        if (lotRng.random() < 0.4) {
          cmds.push(setblock(x, 1, z, lotRng.pick(FLOWERS)));
        }
      }
    }
  }

  // Auch Bürgersteig-Blumen direkt vor Türen entfernen (Süd-Streifen der Lots)
  for (const oneLot of lots) {
    const lotSeed = (seed + oneLot.col * 7919 + oneLot.row * 104729) >>> 0;
    const lotRng = createRng(lotSeed);
    const layout = pickTowerLayout(oneLot, lotRng);
    const doorX0 = layout.x0 + Math.floor(layout.footprint / 2) - 1;
    const doorX1 = doorX0 + 1;
    const walkS = oneLot.z1 + 1; // erste Zelle südlich der Parzelle = Bürgersteig
    if (walkS >= size) continue;
    for (let x = doorX0 - 1; x <= doorX1 + 1; x++) {
      if (x < 0 || x >= size) continue;
      cmds.push(setblock(x, 1, walkS, "air"));
      // RNG nur um lotRng-State mit Gebäude-Seed synchron zu halten falls nötig
      void lotRng;
    }
  }

  const batches = chunkCommands(cmds, 24);
  if (batches.length > 0) {
    batches[batches.length - 1].push(
      'tellraw @a {"rawtext":[{"text":"[city] Grün fertig."}]}',
    );
  }
  return batches;
}

/**
 * Doppeltür Südwand. Bedrock direction = Innenseite der Tür:
 * 0 Ost, 1 Süd, 2 West, 3 Nord. Eingang von Süden → Innenseite Nord (3).
 * hinge_bit relativ zur Innenseite: false=links, true=rechts.
 * Von aussen: links (West) Anschlag aussen links, rechts Anschlag aussen rechts.
 */
function doubleDoorSouth(xLeft, y, z) {
  return [
    setblock(
      xLeft,
      y,
      z,
      'wooden_door ["direction":3,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":false]',
    ),
    setblock(
      xLeft,
      y + 1,
      z,
      'wooden_door ["direction":3,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":true]',
    ),
    setblock(
      xLeft + 1,
      y,
      z,
      'wooden_door ["direction":3,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":false]',
    ),
    setblock(
      xLeft + 1,
      y + 1,
      z,
      'wooden_door ["direction":3,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":true]',
    ),
  ];
}

/** Bett: Fuss bei (x,z), Kopf nach Norden (nur Farben, die BDS zuverlässig parst). */
function bedNorth(x, y, z, color) {
  return [
    setblock(x, y, z, `${color}_bed ["direction":2,"head_piece_bit":false]`),
    setblock(x, y, z - 1, `${color}_bed ["direction":2,"head_piece_bit":true]`),
  ];
}

/** Tisch: Zaunbein + Druckplatte. */
function tableAt(x, y, z) {
  return [setblock(x, y, z, "oak_fence"), setblock(x, y + 1, z, "oak_pressure_plate")];
}

/** Stuhl aus Eichenstufe (facing = Sitzrichtung). */
function chairAt(x, y, z, facing) {
  const dir = { east: 0, west: 1, south: 2, north: 3 }[facing];
  if (dir === undefined) throw new Error(`Unbekannte Stuhl-Richtung: ${facing}`);
  return [
    setblock(x, y, z, `oak_stairs ["weirdo_direction":${dir},"upside_down_bit":false]`),
  ];
}

/**
 * Poster/Bilder an Innenwänden = Wandbanner (Paintings sind Entities, ungeeignet).
 * facing_direction: 2=N, 3=S, 4=W, 5=E (Banner blickt in diese Richtung).
 */
function wallPoster(x, y, z, facingDir, color) {
  return setblock(x, y, z, `${color}_wall_banner ["facing_direction":${facingDir}]`);
}

/**
 * Freie Rechtecke neben dem Treppenschacht (Ost/West/Nord/Süd).
 */
function furnitureZones(x0, z0, x1, z1, sx, sz, sx1, sz1) {
  const zones = [];
  const pushIf = (ax0, az0, ax1, az1) => {
    if (ax1 - ax0 >= 1 && az1 - az0 >= 1) {
      zones.push({ x0: ax0, z0: az0, x1: ax1, z1: az1 });
    }
  };
  pushIf(sx1 + 1, z0 + 1, x1 - 1, z1 - 1);
  pushIf(x0 + 1, z0 + 1, sx - 1, z1 - 1);
  pushIf(x0 + 1, sz1 + 1, x1 - 1, z1 - 1);
  pushIf(x0 + 1, z0 + 1, x1 - 1, sz - 1);
  return zones;
}

function inStairShaft(x, z, sx, sz, sx1, sz1) {
  return x >= sx && x <= sx1 && z >= sz && z <= sz1;
}

/**
 * Einrichtung auf jedem Stock: zufällige Möbel in allen Zonen + Wandposter.
 * Kein Teppich (stört Treppen).
 */
function furnishFloor(yFloor, storyIndex, x0, z0, x1, z1, sx, sz, sx1, sz1, rng) {
  const cmds = [];
  const y = yFloor + 1;
  const zones = furnitureZones(x0, z0, x1, z1, sx, sz, sx1, sz1);
  if (zones.length === 0) return cmds;

  const area = (z) => (z.x1 - z.x0 + 1) * (z.z1 - z.z0 + 1);
  zones.sort((a, b) => area(b) - area(a));

  const bedColors = ["red", "blue", "white"];
  const bannerColors = ["red", "blue", "white", "yellow", "lime", "orange", "pink", "light_blue"];
  const desks = ["cartography_table", "fletching_table", "smithing_table", "loom", "crafting_table", "lectern"];
  const storage = ["chest", "barrel", "barrel", "chest"];
  const clutter = ["flower_pot", "flower_pot", "lantern", "bookshelf", "crafting_table", "note_block"];

  const kind =
    storyIndex === 0 ? "lobby" : rng.pick(["office", "bedroom", "lounge", "office", "bedroom"]);

  const placeInZone = (zone, block, preferCorner = false) => {
    let x;
    let z;
    if (preferCorner) {
      x = rng.pick([zone.x0, zone.x1]);
      z = rng.pick([zone.z0, zone.z1]);
    } else {
      x = rng.int(zone.x0, zone.x1);
      z = rng.int(zone.z0, zone.z1);
    }
    if (inStairShaft(x, z, sx, sz, sx1, sz1)) return;
    cmds.push(setblock(x, y, z, block));
  };

  // Theme-Möbel in der grössten Zone
  const main = zones[0];
  const { x0: fx0, z0: fz0, x1: fx1, z1: fz1 } = main;

  if (kind === "lobby") {
    cmds.push(setblock(fx0, y, fz0, "flower_pot"));
    cmds.push(setblock(fx1, y, fz0, "flower_pot"));
    cmds.push(...tableAt(Math.floor((fx0 + fx1) / 2), y, fz0));
    if (fx0 + 1 <= fx1) cmds.push(...chairAt(fx0, y, fz0 + (fz0 < fz1 ? 1 : 0), "south"));
    cmds.push(setblock(fx1, y, fz1, rng.pick(storage)));
    if (fx1 - fx0 >= 2) cmds.push(setblock(fx0 + 1, y, fz1, rng.pick(desks)));
  } else if (kind === "office") {
    cmds.push(setblock(fx0, y, fz0, "bookshelf"));
    cmds.push(setblock(fx0, y + 1, fz0, "bookshelf"));
    if (fx0 + 1 <= fx1) {
      cmds.push(setblock(fx0 + 1, y, fz0, "bookshelf"));
      cmds.push(setblock(fx0 + 1, y + 1, fz0, "bookshelf"));
    }
    cmds.push(setblock(fx1, y, fz0, rng.pick(storage)));
    cmds.push(setblock(fx0, y, fz1, rng.pick(desks)));
    if (fx0 + 1 <= fx1) cmds.push(...chairAt(fx0 + 1, y, fz1, "north"));
    cmds.push(setblock(fx1, y, fz1, "flower_pot"));
    if (rng.random() < 0.7) cmds.push(setblock(fx1, y + 1, fz0, "lantern"));
  } else if (kind === "bedroom") {
    const bedColor = bedColors[storyIndex % bedColors.length];
    const bx = Math.min(fx0 + 1, fx1);
    const bz = fz1;
    if (bz - 1 >= fz0) cmds.push(...bedNorth(bx, y, bz, bedColor));
    cmds.push(setblock(fx0, y, fz0, rng.pick(storage)));
    cmds.push(setblock(fx1, y, fz0, "flower_pot"));
    if (fx1 - 1 > fx0) cmds.push(...tableAt(fx1, y, Math.min(fz0 + 1, fz1)));
    if (rng.random() < 0.6) cmds.push(...chairAt(fx0, y, Math.min(fz0 + 1, fz1), "east"));
  } else {
    // Lounge
    cmds.push(...tableAt(Math.floor((fx0 + fx1) / 2), y, Math.floor((fz0 + fz1) / 2)));
    cmds.push(...chairAt(fx0, y, Math.floor((fz0 + fz1) / 2), "east"));
    if (fx1 - fx0 >= 2) cmds.push(...chairAt(fx1, y, Math.floor((fz0 + fz1) / 2), "west"));
    cmds.push(setblock(fx0, y, fz0, "bookshelf"));
    cmds.push(setblock(fx1, y, fz0, rng.pick(storage)));
    cmds.push(setblock(fx0, y, fz1, "flower_pot"));
    cmds.push(setblock(fx1, y, fz1, "noteblock"));
  }

  // Weitere Zonen: zufällige Möbelstücke
  for (const zone of zones) {
    const n = rng.int(2, 5);
    for (let i = 0; i < n; i++) {
      const roll = rng.random();
      const x = rng.int(zone.x0, zone.x1);
      const z = rng.int(zone.z0, zone.z1);
      if (inStairShaft(x, z, sx, sz, sx1, sz1)) continue;
      if (roll < 0.25) cmds.push(...tableAt(x, y, z));
      else if (roll < 0.4) cmds.push(...chairAt(x, y, z, rng.pick(["north", "south", "east", "west"])));
      else if (roll < 0.55) cmds.push(setblock(x, y, z, rng.pick(storage)));
      else if (roll < 0.7) cmds.push(setblock(x, y, z, rng.pick(desks)));
      else if (roll < 0.85) cmds.push(setblock(x, y, z, rng.pick(clutter)));
      else {
        cmds.push(setblock(x, y, z, "bookshelf"));
        if (rng.random() < 0.5) cmds.push(setblock(x, y + 1, z, "bookshelf"));
      }
    }
  }

  // Wandposter (Banner) an Innenwänden, Augenhöhe – nicht im Schacht
  const posterY = yFloor + 2;
  const posters = rng.int(3, 7);
  for (let i = 0; i < posters; i++) {
    const color = rng.pick(bannerColors);
    const side = rng.int(0, 3);
    if (side === 0 && z1 - 1 > z0 + 1) {
      // Südwand innen → Banner blickt nach Norden
      const x = rng.int(x0 + 1, x1 - 1);
      if (!inStairShaft(x, z1 - 1, sx, sz, sx1, sz1)) {
        cmds.push(wallPoster(x, posterY, z1 - 1, 2, color));
      }
    } else if (side === 1 && z0 + 1 < z1 - 1) {
      const x = rng.int(x0 + 1, x1 - 1);
      if (!inStairShaft(x, z0 + 1, sx, sz, sx1, sz1)) {
        cmds.push(wallPoster(x, posterY, z0 + 1, 3, color));
      }
    } else if (side === 2 && x0 + 1 < x1 - 1) {
      const z = rng.int(z0 + 1, z1 - 1);
      if (!inStairShaft(x0 + 1, z, sx, sz, sx1, sz1)) {
        cmds.push(wallPoster(x0 + 1, posterY, z, 5, color));
      }
    } else if (x1 - 1 > x0 + 1) {
      const z = rng.int(z0 + 1, z1 - 1);
      if (!inStairShaft(x1 - 1, z, sx, sz, sx1, sz1)) {
        cmds.push(wallPoster(x1 - 1, posterY, z, 4, color));
      }
    }
  }

  // Etwas Extra-Streuzufall in der Hauptzone
  if (rng.random() < 0.8) placeInZone(main, rng.pick(clutter), true);
  if (rng.random() < 0.5) placeInZone(main, rng.pick(storage), true);

  return cmds;
}

/**
 * Immer gleiche Richtung: Süd → Nord (facing north), pro Stock herumlaufen.
 *
 * Pro vollem Stockwerk genau storyH Stufen:
 *   i=0..storyH-1 → y = yFloor+1+i, z = stairZ1-i
 * Erste Stufe liegt auf dem Boden (yFloor+1), nie in der Bodenebene.
 * Letzte Stufe liegt in der nächsten Etage (Nord, Etagenloch) — dort seitlich absteigen.
 * Nur Flüge zu einer echten Etage (yFloor+storyH < height), kein Stummel unters Dach.
 */
function placeStraightStairs(commands, stairX0, stairX1, stairZ0, stairZ1, storyH, height) {
  for (let yFloor = 0; yFloor + storyH < height; yFloor += storyH) {
    for (let i = 0; i < storyH; i++) {
      const y = yFloor + 1 + i;
      const z = stairZ1 - i;
      commands.push(stair(stairX0, y, z, "north"));
      commands.push(stair(stairX1, y, z, "north"));
    }
  }
}

/**
 * EG: Schachtboden voll (erste Stufe erst bei y=1).
 * Obergeschosse: 2 Anlauf-Blöcke Süd (stairZ1) = regulärer Boden — nicht im Parterre.
 */
function placeStairLandings(commands, stairX0, stairX1, stairZ0, stairZ1, storyH, height, egBlock, upperFloorBlock) {
  commands.push(fill(stairX0, 0, stairZ0, stairX1, 0, stairZ1, egBlock));
  for (let y = storyH; y < height; y += storyH) {
    commands.push(setblock(stairX0, y, stairZ1, upperFloorBlock));
    commands.push(setblock(stairX1, y, stairZ1, upperFloorBlock));
  }
}

/**
 * Ein Hochhaus. EG-Boden auf y=0 (Strassenniveau), Wände ab y=1.
 */
function buildTowerCommands(lot, rng, minHeight, maxHeight) {
  const lotWidth = lot.x1 - lot.x0 + 1;
  const lotDepth = lot.z1 - lot.z0 + 1;
  if (lotWidth < 13 || lotDepth < 13) {
    throw new Error(
      `Parzelle ${lotWidth}×${lotDepth} ist zu klein – für 11–13er Häuser braucht es lot >= 13`,
    );
  }

  const layout = pickTowerLayout(lot, rng);
  const { footprint, x0, z0, x1, z1 } = layout;

  const height = pickTowerHeight(rng, minHeight, maxHeight);
  const facade = rng.pick(FACADE_COLORS);
  const storyH = rng.int(4, 5);
  const withAntenna = rng.random() < 0.45;

  const midX = Math.floor((x0 + x1) / 2);
  const stairX0 = midX - 1;
  const stairX1 = midX;
  // Schacht = genau storyH Stufen Süd→Nord (unabhängig von Gebäudebreite)
  const stairZ0 = Math.floor((z0 + z1) / 2) - Math.floor(storyH / 2);
  const stairZ1 = stairZ0 + storyH - 1;
  // Für Möbel-Aussparung: ganzer Treppenlauf inkl. Süd-Anlaufzelle
  const sx = stairX0;
  const sx1 = stairX1;
  const sz = stairZ0;
  const sz1 = stairZ1;

  const commands = [];

  // Wände ab y=1 (über dem EG-Boden auf y=0)
  commands.push(fill(x0, 1, z0, x1, height, z0, facade));
  commands.push(fill(x0, 1, z1, x1, height, z1, facade));
  commands.push(fill(x0, 1, z0, x0, height, z1, facade));
  commands.push(fill(x1, 1, z0, x1, height, z1, facade));

  // Böden: EG auf y=0 (Strassenniveau), weitere auf storyH, 2*storyH, … + Dach
  commands.push(fill(x0, 0, z0, x1, 0, z1, facade));
  commands.push(fill(x0, height, z0, x1, height, z1, facade));
  for (let y = storyH; y < height; y += storyH) {
    commands.push(fill(x0, y, z0, x1, y, z1, facade));
  }

  // Steinweg Tür → Bürgersteig (bis zur Strasse), y=0
  const doorX0 = x0 + Math.floor(footprint / 2) - 1;
  const doorX1 = doorX0 + 1;
  const frameX0 = doorX0 - 1;
  const frameX1 = doorX1 + 1;
  const pathZ0 = z1 + 1;
  const pathZ1 = lot.z1 + LAYOUT.sidewalk; // letzte Bürgersteig-Zelle vor der Fahrbahn
  if (pathZ1 >= pathZ0) {
    commands.push(fill(doorX0, 0, pathZ0, doorX1, 0, pathZ1, "stone_bricks"));
  }
  commands.push(fill(doorX0, 0, z1, doorX1, 0, z1, "stone_bricks"));

  // Fenster
  for (let yFloor = 0; yFloor < height; yFloor += storyH) {
    const yWin0 = yFloor + 1;
    const yWin1 = Math.min(height - 1, yFloor + storyH - 1);
    if (yWin1 < yWin0) continue;
    commands.push(fill(x0 + 1, yWin0, z0, x1 - 1, yWin1, z0, "glass_pane"));
    commands.push(fill(x0 + 1, yWin0, z1, x1 - 1, yWin1, z1, "glass_pane"));
    commands.push(fill(x0, yWin0, z0 + 1, x0, yWin1, z1 - 1, "glass_pane"));
    commands.push(fill(x1, yWin0, z0 + 1, x1, yWin1, z1 - 1, "glass_pane"));
  }

  // Gesims
  for (let y = storyH; y < height; y += storyH) {
    commands.push(fill(x0 + 1, y, z0, x1 - 1, y, z0, facade));
    commands.push(fill(x0 + 1, y, z1, x1 - 1, y, z1, facade));
    commands.push(fill(x0, y, z0 + 1, x0, y, z1 - 1, facade));
    commands.push(fill(x1, y, z0 + 1, x1, y, z1 - 1, facade));
  }

  // Eingang (auf y=1 über dem EG-Boden)
  commands.push(fill(frameX0, 1, z1, frameX1, 3, z1, facade));
  commands.push(fill(doorX0, 1, z1, doorX1, 2, z1, "air"));
  commands.push(...doubleDoorSouth(doorX0, 1, z1));

  // Innenraum über den Böden
  for (let yFloor = 0; yFloor < height; yFloor += storyH) {
    const yTop = Math.min(height - 1, yFloor + storyH - 1);
    if (yTop >= yFloor + 1) {
      commands.push(fill(x0 + 1, yFloor + 1, z0 + 1, x1 - 1, yTop, z1 - 1, "air"));
    }
  }

  // Etagenlöcher = exakt Treppen-Durchstoss (2×(storyH-1)), Süd-Anlauf bleibt Boden
  for (let y = storyH; y < height; y += storyH) {
    if (stairZ1 - 1 >= stairZ0) {
      commands.push(fill(stairX0, y, stairZ0, stairX1, y, stairZ1 - 1, "air"));
    }
  }
  // Luft im Treppenlauf (danach Anlauf-Boden wieder setzen)
  commands.push(fill(stairX0, 1, stairZ0, stairX1, height - 1, stairZ1, "air"));

  // Lobby-EG freiräumen, dann Treppe/Böden/Türen einmal final setzen
  commands.push(fill(x0 + 1, 1, z0 + 1, x1 - 1, Math.min(height - 1, storyH - 1), z1 - 1, "air"));
  placeStraightStairs(commands, stairX0, stairX1, stairZ0, stairZ1, storyH, height);
  placeStairLandings(commands, stairX0, stairX1, stairZ0, stairZ1, storyH, height, "quartz_block", facade);
  commands.push(fill(doorX0, 0, z1, doorX1, 0, z1, "stone_bricks"));
  commands.push(fill(frameX0, 1, z1, frameX1, 3, z1, facade));
  commands.push(fill(doorX0, 1, z1, doorX1, 2, z1, "air"));
  commands.push(...doubleDoorSouth(doorX0, 1, z1));

  let storyIndex = 0;
  for (let yFloor = 0; yFloor < height; yFloor += storyH) {
    commands.push(
      ...furnishFloor(yFloor, storyIndex, x0, z0, x1, z1, sx, sz, sx1, sz1, rng),
    );
    storyIndex += 1;
  }

  if (withAntenna) {
    const mx = Math.floor((x0 + x1) / 2);
    const mz = Math.floor((z0 + z1) / 2);
    commands.push(fill(mx, height + 1, mz, mx, height + 4, mz, "iron_bars"));
  }

  return commands;
}

/**
 * Terrain-Prep: Ebene unter den Füssen (y=-1) = Erde,
 * ab Fuss-Höhe (y=0) alles Luft – Platz für die Stadt.
 * Marker steht auf Spieler-Fuss-Höhe.
 */
function buildPrepBatches(size, maxHeight) {
  const clearFillMax = 4096;
  const all = [
    ...buildAirClearCommands(size, maxHeight, 0),
    ...fillLarge(0, -1, 0, size - 1, -1, size - 1, "dirt", "", clearFillMax),
    ...fillLarge(0, 0, 0, size - 1, 2, size - 1, "air", "", clearFillMax),
  ];
  return chunkCommands(all, 3);
}

/** Seed für Variante index (1-basiert) aus Basis-Seed. */
function variantSeed(baseSeed, index) {
  return (baseSeed + (index - 1) * 104729) >>> 0;
}

/**
 * Schreibt eine Variante unter functions/<ns>/ …
 * ids kurz halten (Scoreboard-Namen max. 16 Zeichen).
 */
function writeVariant(outFunctionsRoot, variant) {
  const {
    index,
    seed,
    size,
    minHeight,
    maxHeight,
    lot,
    sidewalk,
    street,
  } = variant;

  const ns = `city_${index}`;
  const tag = `cg${index}_o`;
  const objBuild = `cg${index}_b`;
  const areaName = `cg${index}_a`;
  const label = `city_${index}`;

  const functionsDir = path.join(outFunctionsRoot, ns);
  fs.mkdirSync(functionsDir, { recursive: true });

  const lots = createLots(size, lot, sidewalk, street);
  const terrainBatches = buildTerrainBatches(size, maxHeight);
  const roadBatches = buildRoadBatches(size, lot, sidewalk, street);
  const landscapeBatches = buildLandscapeBatches(size, lot, sidewalk, street, seed, lots);

  // Gebäude in kleine Tick-Batches splitten (sonst bricht BDS ab → unfertige Stadt)
  const buildingsDir = path.join(functionsDir, "buildings");
  fs.rmSync(buildingsDir, { recursive: true, force: true });
  fs.mkdirSync(buildingsDir, { recursive: true });
  const buildingBatchFiles = [];
  for (let i = 0; i < lots.length; i++) {
    const oneLot = lots[i];
    const lotSeed = (seed + oneLot.col * 7919 + oneLot.row * 104729) >>> 0;
    const lotRng = createRng(lotSeed);
    const cmds = buildTowerCommands(oneLot, lotRng, minHeight, maxHeight);
    const chunks = chunkCommands(cmds, BUILDING_CMDS_PER_TICK);
    for (let j = 0; j < chunks.length; j++) {
      const name = `b_${pad2(i)}_${pad2(j)}`;
      writeMcfunction(path.join(buildingsDir, `${name}.mcfunction`), chunks[j]);
      buildingBatchFiles.push(name);
    }
  }

  // Reihenfolge: Terrain → Häuser → Strassen → Grün
  const nTerrain = terrainBatches.length;
  const nRoads = roadBatches.length;
  const nLandscape = landscapeBatches.length;
  const nBuildingBatches = buildingBatchFiles.length;
  const stepFirstTerrain = 1;
  const stepFirstBuilding = stepFirstTerrain + nTerrain;
  const stepFirstRoad = stepFirstBuilding + nBuildingBatches;
  const stepFirstLandscape = stepFirstRoad + nRoads;
  const stepLastLandscape = stepFirstLandscape + nLandscape - 1;
  const stepBuildDone = stepLastLandscape + 1;
  const totalBuildSteps = stepLastLandscape;

  writeMcfunction(path.join(functionsDir, "start.mcfunction"), [
    `tellraw @a {"rawtext":[{"text":"[${label}] Starte (seed=${seed}) – Nordwest-Ecke, Fläche nach Ost+Süd …"}]}`,
    `scoreboard objectives add ${objBuild} dummy`,
    `tickingarea remove ${areaName}`,
    "kill @e[type=armor_stand,tag=city_o]",
    ...originMarkerLines(tag),
    tickingAreaAddCmd(size, maxHeight, areaName),
    `scoreboard players set @e[tag=${tag},c=1] ${objBuild} ${stepFirstTerrain}`,
    `execute as @e[tag=${tag},c=1] at @s run function ${ns}/terrain_batches/t_00`,
    `scoreboard players set @e[tag=${tag},c=1] ${objBuild} ${stepFirstTerrain + 1}`,
    `tellraw @a {"rawtext":[{"text":"[${label}] Bau läuft (${totalBuildSteps} Schritte, ${lots.length} Häuser) …"}]}`,
  ]);

  const terrainDir = path.join(functionsDir, "terrain_batches");
  for (let i = 0; i < terrainBatches.length; i++) {
    writeMcfunction(path.join(terrainDir, `t_${pad2(i)}.mcfunction`), terrainBatches[i]);
  }

  const roadsDir = path.join(functionsDir, "road_batches");
  for (let i = 0; i < roadBatches.length; i++) {
    writeMcfunction(path.join(roadsDir, `r_${pad2(i)}.mcfunction`), roadBatches[i]);
  }

  const landscapeDir = path.join(functionsDir, "landscape_batches");
  fs.rmSync(landscapeDir, { recursive: true, force: true });
  for (let i = 0; i < landscapeBatches.length; i++) {
    writeMcfunction(path.join(landscapeDir, `l_${pad2(i)}.mcfunction`), landscapeBatches[i]);
  }

  writeMcfunction(path.join(functionsDir, "build_done.mcfunction"), [
    `scoreboard players set @e[tag=${tag}] ${objBuild} 0`,
    `tickingarea remove ${areaName}`,
    `kill @e[tag=${tag}]`,
    `tellraw @a {"rawtext":[{"text":"[${label}] Fertig. Undo: /function city/clear"}]}`,
  ]);

  writeMcfunction(path.join(functionsDir, "clear.mcfunction"), [
    "function city/clear",
  ]);

  const onTick = [];
  for (let i = 0; i < nTerrain; i++) {
    const step = stepFirstTerrain + i;
    onTick.push(
      `execute as @e[tag=${tag},c=1] at @s if score @s ${objBuild} matches ${step} run function ${ns}/terrain_batches/t_${pad2(i)}`,
    );
  }
  for (let k = 0; k < nBuildingBatches; k++) {
    const step = stepFirstBuilding + k;
    onTick.push(
      `execute as @e[tag=${tag},c=1] at @s if score @s ${objBuild} matches ${step} run function ${ns}/buildings/${buildingBatchFiles[k]}`,
    );
  }
  for (let i = 0; i < nRoads; i++) {
    const step = stepFirstRoad + i;
    onTick.push(
      `execute as @e[tag=${tag},c=1] at @s if score @s ${objBuild} matches ${step} run function ${ns}/road_batches/r_${pad2(i)}`,
    );
  }
  for (let i = 0; i < nLandscape; i++) {
    const step = stepFirstLandscape + i;
    onTick.push(
      `execute as @e[tag=${tag},c=1] at @s if score @s ${objBuild} matches ${step} run function ${ns}/landscape_batches/l_${pad2(i)}`,
    );
  }
  onTick.push(
    `execute as @e[tag=${tag},c=1] if score @s ${objBuild} matches ${stepFirstTerrain}..${totalBuildSteps} run scoreboard players add @s ${objBuild} 1`,
  );
  onTick.push(
    `execute as @e[tag=${tag},c=1] if score @s ${objBuild} matches ${stepBuildDone} run function ${ns}/build_done`,
  );
  writeMcfunction(path.join(functionsDir, "on_tick.mcfunction"), onTick);

  return {
    ns,
    seed,
    buildings: lots.length,
    building_batches: nBuildingBatches,
    terrain_steps: nTerrain,
    road_steps: nRoads,
    build_steps: totalBuildSteps,
  };
}

/**
 * Gemeinsam unter city/: terrain + clear (gleiche Stadtgrösse für alle Varianten).
 */
function writeSharedCityGen(outFunctionsRoot, size, maxHeight, variantCount) {
  const ns = "city";
  const functionsDir = path.join(outFunctionsRoot, ns);
  fs.mkdirSync(functionsDir, { recursive: true });

  // --- terrain ---
  const prepTag = "cg_t_o";
  const objPrep = "cg_t";
  const prepArea = "cg_t_a";
  const prepBatches = buildPrepBatches(size, maxHeight);
  const prepDir = path.join(functionsDir, "prep_batches");
  for (let i = 0; i < prepBatches.length; i++) {
    writeMcfunction(path.join(prepDir, `p_${pad2(i)}.mcfunction`), prepBatches[i]);
  }

  writeMcfunction(path.join(functionsDir, "terrain.mcfunction"), [
    'tellraw @a {"rawtext":[{"text":"[city] Terrain – Nordwest-Ecke, Ebene unter den Füssen, Luft darüber …"}]}',
    `scoreboard objectives add ${objPrep} dummy`,
    "scoreboard objectives add cg_c dummy",
    `tickingarea remove ${prepArea}`,
    "tickingarea remove cg_c_a",
    "kill @e[type=armor_stand,tag=city_o]",
    ...originMarkerLines(prepTag),
    tickingAreaAddCmd(size, maxHeight, prepArea),
    `scoreboard players set @e[tag=${prepTag},c=1] ${objPrep} 1`,
    `execute as @e[tag=${prepTag},c=1] at @s run function ${ns}/prep_batches/p_00`,
    `scoreboard players set @e[tag=${prepTag},c=1] ${objPrep} 2`,
    `tellraw @a {"rawtext":[{"text":"[city] Terrain läuft (${prepBatches.length} Schritte) …"}]}`,
  ]);

  writeMcfunction(path.join(functionsDir, "terrain_done.mcfunction"), [
    `scoreboard players set @e[tag=${prepTag}] ${objPrep} 0`,
    `tickingarea remove ${prepArea}`,
    `kill @e[tag=${prepTag}]`,
    'tellraw @a {"rawtext":[{"text":"[city] Terrain fertig. Danach z.B. /function city_1/start"}]}',
  ]);

  // --- clear (gemeinsam, gleiche Grösse) ---
  const clearTag = "cg_c_o";
  const objClear = "cg_c";
  const clearArea = "cg_c_a";
  const clearBatches = buildClearCommandBatches(size, maxHeight);
  const clearDir = path.join(functionsDir, "clear_batches");
  for (let i = 0; i < clearBatches.length; i++) {
    writeMcfunction(path.join(clearDir, `c_${pad2(i)}.mcfunction`), clearBatches[i]);
  }

  writeMcfunction(path.join(functionsDir, "clear.mcfunction"), [
    'tellraw @a {"rawtext":[{"text":"[city] Clear – an die Nordwest-Ecke stellen …"}]}',
    `scoreboard objectives add ${objClear} dummy`,
    `scoreboard objectives add ${objPrep} dummy`,
    `tickingarea remove ${clearArea}`,
    `tickingarea remove ${prepArea}`,
    ...Array.from({ length: variantCount }, (_, i) => `tickingarea remove cg${i + 1}_a`),
    "kill @e[type=armor_stand,tag=city_o]",
    ...originMarkerLines(clearTag),
    tickingAreaAddCmd(size, maxHeight, clearArea),
    `scoreboard players set @e[tag=${clearTag},c=1] ${objClear} 1`,
    `execute as @e[tag=${clearTag},c=1] at @s run function ${ns}/clear_batches/c_00`,
    `scoreboard players set @e[tag=${clearTag},c=1] ${objClear} 2`,
    `tellraw @a {"rawtext":[{"text":"[city] Clear läuft (${clearBatches.length} Schritte) …"}]}`,
  ]);

  writeMcfunction(path.join(functionsDir, "clear_done.mcfunction"), [
    `scoreboard players set @e[tag=${clearTag}] ${objClear} 0`,
    `tickingarea remove ${clearArea}`,
    `kill @e[tag=${clearTag}]`,
    'tellraw @a {"rawtext":[{"text":"[city] Clear fertig."}]}',
  ]);

  const onTick = [];
  for (let i = 0; i < prepBatches.length; i++) {
    onTick.push(
      `execute as @e[tag=${prepTag},c=1] at @s if score @s ${objPrep} matches ${i + 1} run function ${ns}/prep_batches/p_${pad2(i)}`,
    );
  }
  onTick.push(
    `execute as @e[tag=${prepTag},c=1] if score @s ${objPrep} matches 1..${prepBatches.length} run scoreboard players add @s ${objPrep} 1`,
  );
  onTick.push(
    `execute as @e[tag=${prepTag},c=1] if score @s ${objPrep} matches ${prepBatches.length + 1} run function ${ns}/terrain_done`,
  );
  for (let i = 0; i < clearBatches.length; i++) {
    onTick.push(
      `execute as @e[tag=${clearTag},c=1] at @s if score @s ${objClear} matches ${i + 1} run function ${ns}/clear_batches/c_${pad2(i)}`,
    );
  }
  onTick.push(
    `execute as @e[tag=${clearTag},c=1] if score @s ${objClear} matches 1..${clearBatches.length} run scoreboard players add @s ${objClear} 1`,
  );
  onTick.push(
    `execute as @e[tag=${clearTag},c=1] if score @s ${objClear} matches ${clearBatches.length + 1} run function ${ns}/clear_done`,
  );
  writeMcfunction(path.join(functionsDir, "on_tick.mcfunction"), onTick);

  return { prep_steps: prepBatches.length, clear_steps: clearBatches.length };
}

// ---------------------------------------------------------------------------
// Pack zusammensetzen
// ---------------------------------------------------------------------------

function buildPack(options) {
  const { seed, variants, size, minHeight, maxHeight, lot, sidewalk, street } = options;

  if (minHeight > maxHeight) {
    throw new Error("min-height muss <= max-height sein");
  }
  if (variants < 1 || variants > 20) {
    throw new Error("--variants muss zwischen 1 und 20 liegen");
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  const functionsRoot = path.join(OUT_DIR, "functions");
  fs.mkdirSync(functionsRoot, { recursive: true });

  const manifest = {
    format_version: 2,
    header: {
      name: "City",
      description: `Procedural city ×${variants} (base seed=${seed}, size=${size})`,
      uuid: PACK_UUID,
      version: PACK_VERSION,
      min_engine_version: [1, 20, 0],
    },
    modules: [{ type: "data", uuid: MODULE_UUID, version: PACK_VERSION }],
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  const tickValues = [];
  const variantMeta = [];

  const shared = writeSharedCityGen(functionsRoot, size, maxHeight, variants);
  tickValues.push("city/on_tick");

  // Alias: city/start → Variante 1 (clear/terrain liegen schon unter city/)
  writeMcfunction(path.join(functionsRoot, "city", "start.mcfunction"), [
    "function city_1/start",
  ]);

  for (let index = 1; index <= variants; index++) {
    const info = writeVariant(functionsRoot, {
      index,
      seed: variantSeed(seed, index),
      size,
      minHeight,
      maxHeight,
      lot,
      sidewalk,
      street,
    });
    tickValues.push(`${info.ns}/on_tick`);
    variantMeta.push(info);
  }

  fs.writeFileSync(
    path.join(functionsRoot, "tick.json"),
    JSON.stringify({ values: tickValues }, null, 2) + "\n",
  );

  const meta = {
    base_seed: seed,
    variants: variantMeta,
    size,
    min_height: minHeight,
    max_height: maxHeight,
    lot,
    sidewalk,
    street,
    prep_steps: shared.prep_steps,
    clear_steps: shared.clear_steps,
  };
  fs.writeFileSync(path.join(OUT_DIR, "city_meta.json"), JSON.stringify(meta, null, 2) + "\n");

  console.log(`Fertig: ${OUT_DIR}`);
  console.log(`  ${size}×${size}, ${variants} Varianten, base seed=${seed}`);
  console.log(`  /function city/terrain  (${shared.prep_steps} Schritte)`);
  console.log(`  /function city/clear    (${shared.clear_steps} Schritte)`);
  for (const v of variantMeta) {
    console.log(
      `  /function ${v.ns}/start  (seed=${v.seed}, ${v.buildings} Häuser, ${v.build_steps} Bau-Ticks)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Kommandozeile
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    seed: 42,
    variants: DEFAULT_VARIANTS,
    size: CITY_SIZE,
    minHeight: 20,
    maxHeight: 100,
    lot: LAYOUT.lot,
    sidewalk: LAYOUT.sidewalk,
    street: LAYOUT.street,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Wert fehlt nach ${arg}`);
      return v;
    };

    if (arg === "--seed") options.seed = Number(value());
    else if (arg === "--variants") options.variants = Number(value());
    else if (arg === "--min-height") options.minHeight = Number(value());
    else if (arg === "--max-height") options.maxHeight = Number(value());
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage:
  node generate_city_pack.mjs [--seed 42] [--variants ${DEFAULT_VARIANTS}] [--min-height 20] [--max-height 100]

  Erzeugt ${DEFAULT_VARIANTS} Varianten (anpassbar): city_1 … city_N
  Stadt: ${CITY_SIZE}×${CITY_SIZE}, Abstand Parzellen = ${LAYOUT.sidewalk + LAYOUT.street + LAYOUT.sidewalk}

Danach:
  ./gameplay/city/deploy_city_pack.sh minecraft

Im Spiel:
  /function city/terrain
  /function city_1/start …
  /function city/clear`);
      process.exit(0);
    } else if (arg === "--size" || arg === "--lot" || arg === "--sidewalk" || arg === "--street") {
      throw new Error(
        `${arg} entfällt – Layout ist fest (${CITY_SIZE}×${CITY_SIZE}, Abstand ≥ 8).`,
      );
    } else {
      throw new Error(`Unbekanntes Argument: ${arg}`);
    }
  }

  return options;
}

try {
  buildPack(parseArgs(process.argv.slice(2)));
} catch (err) {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
}
