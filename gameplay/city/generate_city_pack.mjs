#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "city_gen" mit mehreren Varianten.
 *
 * Im Spiel z.B.:
 *   /function city_gen_1/start … /function city_gen_5/start
 *   /function city_gen_1/clear
 *
 * Aufruf:
 *   node gameplay/city/generate_city_pack.mjs --seed 42
 *   node gameplay/city/generate_city_pack.mjs --seed 42 --variants 5
 *
 * Stadt: 80×80, 4×4 Parzellen, Abstand zwischen Häusern ≥ 8 Blöcke.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * Minecraft erlaubt max. 32768 Blöcke pro /fill.
 * Grössere Flächen teilen wir in Streifen auf.
 */
const FILL_MAX_BLOCKS = 32768;

/** Mögliche Fassadenfarben (moderne Beton-Türme). */
const FACADE_COLORS = [
  "white_concrete",
  "light_gray_concrete",
  "gray_concrete",
  "black_concrete",
  "cyan_concrete",
];

/** Feste Stadtgrösse: 80×80 → 4×4 Parzellen bei Zellgrösse 20. */
const CITY_SIZE = 80;

/** Layout: lot | Bürgersteig | Strasse | Bürgersteig → Zelle 20, Lücke 8. */
const LAYOUT = {
  lot: 12,
  sidewalk: 1,
  street: 6,
};

/** Anzahl vorgefertigter Varianten (city_gen_1 … city_gen_N). */
const DEFAULT_VARIANTS = 5;

/** Pack-Version (bei Logik-Änderung erhöhen). */
const PACK_VERSION = [1, 1, 0];

// ---------------------------------------------------------------------------
// Hilfen: Zufall, Koordinaten, Dateien schreiben
// ---------------------------------------------------------------------------

/**
 * Einfacher Zufallsgenerator mit festem Startwert (Seed).
 * Gleicher Seed → gleiche Stadt.
 */
function createRng(seed) {
  let state = seed >>> 0; // als positive 32-Bit-Zahl

  return {
    /** Zufallszahl zwischen 0 und 1 (nicht einschliesslich 1). */
    random() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    /** Ganze Zahl von min bis max (beide inklusive). */
    int(min, max) {
      return min + Math.floor(this.random() * (max - min + 1));
    },

    /** Ein zufälliges Element aus einer Liste. */
    pick(list) {
      return list[Math.floor(this.random() * list.length)];
    },
  };
}

/**
 * Relative Welt-Koordinate vom Ausführungs-Punkt (Spieler oder Origin-Marker).
 * ~x = Ost, ~y = oben, ~z = Süd.
 */
function at(x, y, z) {
  return `~${x} ~${y} ~${z}`;
}

/** Ein einzelner fill-Befehl. mode z.B. "hollow" = nur die Hülle. */
function fill(x1, y1, z1, x2, y2, z2, block, mode = "") {
  const from = at(x1, y1, z1);
  const to = at(x2, y2, z2);
  if (mode) return `fill ${from} ${to} ${block} ${mode}`;
  return `fill ${from} ${to} ${block}`;
}

/** setblock relativ zum Origin-Marker. */
function setblock(x, y, z, block) {
  return `setblock ${at(x, y, z)} ${block}`;
}

/**
 * Echte Treppenstufe (Bedrock-Blockstates).
 * facing = Richtung, in die man beim Hochlaufen schaut.
 * weirdo_direction: 0=Ost, 1=West, 2=Süd, 3=Nord.
 */
function stair(x, y, z, facing) {
  const dir = { east: 0, west: 1, south: 2, north: 3 }[facing];
  if (dir === undefined) throw new Error(`Unbekannte Treppen-Richtung: ${facing}`);
  // BDS-Parser: Leerzeichen vor [, States mit ":" (nicht "=") – sonst Parse-Error.
  return setblock(
    x,
    y,
    z,
    `stone_stairs ["weirdo_direction":${dir},"upside_down_bit":false]`,
  );
}

/**
 * Wie fill(), aber splittet grosse Quader, falls > maxBlocks.
 * Sonst schlägt der Befehl im Spiel fehl.
 * maxBlocks kleiner wählen (z.B. Clear), wenn viele Blöcke wirklich ersetzt werden.
 */
function fillLarge(x1, y1, z1, x2, y2, z2, block, mode = "", maxBlocks = FILL_MAX_BLOCKS) {
  const commands = [];

  const yMin = Math.min(y1, y2);
  const yMax = Math.max(y1, y2);
  const zMin = Math.min(z1, z2);
  const zMax = Math.max(z1, z2);
  const xMin = Math.min(x1, x2);
  const xMax = Math.max(x1, x2);

  const height = yMax - yMin + 1;
  const depth = zMax - zMin + 1;

  // Wie breit darf ein Streifen in X sein?
  const maxStripWidth = Math.max(1, Math.floor(maxBlocks / (height * depth)));

  for (let x = xMin; x <= xMax; ) {
    const xEnd = Math.min(xMax, x + maxStripWidth - 1);
    const width = xEnd - x + 1;

    // Falls immer noch zu gross: zusätzlich in Z schneiden
    if (width * height * depth > maxBlocks) {
      const maxDepth = Math.max(1, Math.floor(maxBlocks / (width * height)));
      for (let z = zMin; z <= zMax; ) {
        const zEnd = Math.min(zMax, z + maxDepth - 1);
        commands.push(fill(x, yMin, z, xEnd, yMax, zEnd, block, mode));
        z = zEnd + 1;
      }
    } else {
      commands.push(fill(x, yMin, zMin, xEnd, yMax, zMax, block, mode));
    }

    x = xEnd + 1;
  }

  return commands;
}

/** Schreibt eine .mcfunction-Datei (eine Zeile = ein Befehl, ohne / davor). */
function writeMcfunction(filePath, lines) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const text = lines.filter((line) => line.trim() !== "").join("\n") + "\n";
  fs.writeFileSync(filePath, text, "utf8");
}

function pad2(n) {
  return String(n).padStart(2, "0");
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
 * Zu viele fills in einem Tick → Bedrock macht oft gar nichts Sichtbares.
 */
function buildTerrainBatches(size, maxHeight) {
  const clearFillMax = 8192;
  const airCmds = fillLarge(0, 0, 0, size - 1, maxHeight, size - 1, "air", "", clearFillMax);
  const stoneCmds = fillLarge(0, 0, 0, size - 1, 0, size - 1, "stone", "", clearFillMax);
  const all = [...airCmds, ...stoneCmds];
  const batchSize = 8;
  const batches = [];
  for (let i = 0; i < all.length; i += batchSize) {
    batches.push(all.slice(i, i + batchSize));
  }
  if (batches.length > 0) {
    batches[batches.length - 1].push(
      'tellraw @a {"rawtext":[{"text":"[city_gen] Terrain fertig – Strassen …"}]}',
    );
  }
  return batches;
}

/**
 * Strassen als Tick-Batches (eine Achse / Index pro Tick).
 * Schwarz = Fahrbahn, hellgrau = Bürgersteig, gelb = Mittellinie.
 * Früher: alle fills in einer Function → oft wirkungslos auf BDS.
 */
function buildRoadBatches(size, lot, sidewalk, street) {
  const cell = lot + sidewalk + street + sidewalk;
  const grid = size / cell;
  const batches = [];

  for (let i = 0; i < grid; i++) {
    const base = i * cell;
    const walkA = base + lot;
    const roadStart = walkA + sidewalk;
    const roadEnd = roadStart + street - 1;
    const walkB = roadEnd + 1;
    const mid = Math.floor((roadStart + roadEnd) / 2);

    // Vertikaler Korridor (Nord→Süd, Streifen in X)
    const vertical = [
      ...fillLarge(walkA, 0, 0, walkB, 0, size - 1, "light_gray_concrete"),
      ...fillLarge(roadStart, 0, 0, roadEnd, 0, size - 1, "black_concrete"),
      ...fillLarge(mid, 0, 0, mid, 0, size - 1, "yellow_concrete"),
    ];
    batches.push(vertical);

    // Horizontaler Korridor (West→Ost, Streifen in Z)
    const horizontal = [
      ...fillLarge(0, 0, walkA, size - 1, 0, walkB, "light_gray_concrete"),
      ...fillLarge(0, 0, roadStart, size - 1, 0, roadEnd, "black_concrete"),
      ...fillLarge(0, 0, mid, size - 1, 0, mid, "yellow_concrete"),
    ];
    batches.push(horizontal);
  }

  if (batches.length > 0) {
    batches[batches.length - 1].push(
      'tellraw @a {"rawtext":[{"text":"[city_gen] Strassen fertig – Häuser …"}]}',
    );
  }
  return batches;
}

/**
 * Ein Hochhaus auf einer Parzelle.
 * y=0 = Boden/Strasse; Haus ab y=1.
 * Grundfläche: 10×10 oder 12×12, zentriert.
 */
function buildTowerCommands(lot, rng, minHeight, maxHeight) {
  const lotWidth = lot.x1 - lot.x0 + 1;
  const lotDepth = lot.z1 - lot.z0 + 1;
  if (lotWidth < 12 || lotDepth < 12) {
    throw new Error(
      `Parzelle ${lotWidth}×${lotDepth} ist zu klein – für 10/12er Häuser braucht es lot >= 12`,
    );
  }

  const footprint = rng.pick([10, 12]);
  const insetX = Math.floor((lotWidth - footprint) / 2);
  const insetZ = Math.floor((lotDepth - footprint) / 2);

  const x0 = lot.x0 + insetX;
  const z0 = lot.z0 + insetZ;
  const x1 = x0 + footprint - 1;
  const z1 = z0 + footprint - 1;

  const height = rng.int(minHeight, maxHeight);
  const facade = rng.pick(FACADE_COLORS);
  const bandEvery = rng.int(4, 6);
  const setbackCount = rng.int(0, 2);
  const withAntenna = rng.random() < 0.45;

  const commands = [];

  /** Alle 4 Wände vollständig (Beton), dann Glasfenster, dann Gesimse. */
  function buildShaft(xa, za, xb, zb, yBottom, yTop) {
    if (xb < xa || zb < za || yTop < yBottom) return;

    // Boden + Decke dieses Abschnitts
    commands.push(fill(xa, yBottom, za, xb, yBottom, zb, facade));
    commands.push(fill(xa, yTop, za, xb, yTop, zb, facade));

    // Vier volle Wände (Ecken doppelt = egal)
    commands.push(fill(xa, yBottom, za, xb, yTop, za, facade)); // Nord -Z
    commands.push(fill(xa, yBottom, zb, xb, yTop, zb, facade)); // Süd +Z
    commands.push(fill(xa, yBottom, za, xa, yTop, zb, facade)); // West -X
    commands.push(fill(xb, yBottom, za, xb, yTop, zb, facade)); // Ost +X

    if (xb - xa < 2 || zb - za < 2 || yTop <= yBottom + 1) return;

    // Glasfenster in allen 4 Fassaden (Ecken bleiben Beton)
    commands.push(fill(xa + 1, yBottom + 1, za, xb - 1, yTop - 1, za, "glass"));
    commands.push(fill(xa + 1, yBottom + 1, zb, xb - 1, yTop - 1, zb, "glass"));
    commands.push(fill(xa, yBottom + 1, za + 1, xa, yTop - 1, zb - 1, "glass"));
    commands.push(fill(xb, yBottom + 1, za + 1, xb, yTop - 1, zb - 1, "glass"));

    // Horizontale Beton-Bänder
    for (let y = yBottom + bandEvery; y < yTop; y += bandEvery) {
      commands.push(fill(xa + 1, y, za, xb - 1, y, za, facade));
      commands.push(fill(xa + 1, y, zb, xb - 1, y, zb, facade));
      commands.push(fill(xa, y, za + 1, xa, y, zb - 1, facade));
      commands.push(fill(xb, y, za + 1, xb, y, zb - 1, facade));
    }
  }

  let curX0 = x0;
  let curZ0 = z0;
  let curX1 = x1;
  let curZ1 = z1;
  let curY = height;

  buildShaft(curX0, curZ0, curX1, curZ1, 1, curY);

  for (let i = 0; i < setbackCount; i++) {
    const extraHeight = rng.int(8, 14);
    const shrink = rng.int(1, 2);
    const nextX0 = curX0 + shrink;
    const nextZ0 = curZ0 + shrink;
    const nextX1 = curX1 - shrink;
    const nextZ1 = curZ1 - shrink;
    if (nextX1 - nextX0 < 3 || nextZ1 - nextZ0 < 3) break;
    const nextY = Math.min(maxHeight, curY + extraHeight);
    if (nextY <= curY) break;

    commands.push(fill(curX0, curY, curZ0, curX1, curY, curZ1, facade));
    curX0 = nextX0;
    curZ0 = nextZ0;
    curX1 = nextX1;
    curZ1 = nextZ1;
    buildShaft(curX0, curZ0, curX1, curZ1, curY + 1, nextY);
    curY = nextY;
  }

  commands.push(fill(curX0, curY, curZ0, curX1, curY, curZ1, facade));

  // --- Eingang Südseite (+Z): nur in der Fassade, kein Aussenpodest ---
  const doorX0 = x0 + Math.floor(footprint / 2) - 1;
  const doorX1 = doorX0 + 2;
  commands.push(fill(doorX0, 1, z1, doorX1, 3, z1, "air"));
  commands.push(fill(doorX0, 1, z1 - 2, doorX1, 3, z1 - 1, "air"));

  // --- Wendeltreppe innen (NW): 3×3-Schacht, echte Treppenstufen rundherum ---
  const sx = x0 + 1;
  const sz = z0 + 1;
  commands.push(fill(sx, 1, sz, sx + 2, height - 1, sz + 2, "air"));
  // Mittelpfeiler
  commands.push(fill(sx + 1, 1, sz + 1, sx + 1, height - 1, sz + 1, "stone"));
  // Pro Etage eine Stufe, 90° weiter (Wendel)
  const spiral = [
    { dx: 0, dz: 0, facing: "east" },
    { dx: 2, dz: 0, facing: "south" },
    { dx: 2, dz: 2, facing: "west" },
    { dx: 0, dz: 2, facing: "north" },
  ];
  for (let y = 1; y < height; y++) {
    const step = spiral[(y - 1) % 4];
    commands.push(stair(sx + step.dx, y, sz + step.dz, step.facing));
  }
  // Zugang EG: vom Vorraum zum Treppenhaus
  commands.push(fill(sx + 2, 1, sz, doorX0 - 1, 2, sz + 2, "air"));
  commands.push(fill(doorX0, 1, sz + 2, doorX1, 2, z1 - 2, "air"));

  if (withAntenna) {
    const mx = Math.floor((curX0 + curX1) / 2);
    const mz = Math.floor((curZ0 + curZ1) / 2);
    commands.push(fill(mx, curY + 1, mz, mx, curY + 4, mz, "iron_bars"));
  }

  return commands;
}

/**
 * Clear-Befehle: kleine Y-Scheiben + konservatives Block-Limit
 * (dichte Gebäude: grosse fills im selben Tick bleiben oft wirkungslos).
 * Höhe inkl. Antenne (maxHeight + 4).
 */
function buildClearCommandBatches(size, maxHeight) {
  const clearTop = maxHeight + 4;
  const ySlice = 8;
  // Deutlich unter 32768 – Clear ersetzt echte Blöcke, nicht nur Luft
  const clearFillMax = 8192;
  const all = [];

  for (let y0 = 0; y0 <= clearTop; y0 += ySlice) {
    const y1 = Math.min(clearTop, y0 + ySlice - 1);
    all.push(...fillLarge(0, y0, 0, size - 1, y1, size - 1, "air", "", clearFillMax));
  }
  all.push(...fillLarge(0, 0, 0, size - 1, 0, size - 1, "grass_block", "", clearFillMax));

  // Wenige fills pro Tick – Rest über tick.json
  const batchSize = 4;
  const batches = [];
  for (let i = 0; i < all.length; i += batchSize) {
    batches.push(all.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Bedrock: Box über die ganze Stadt (Chunks-Limit 100).
 * name muss pro Variante eindeutig sein.
 */
function tickingAreaAddCmd(size, maxY, areaName) {
  return `tickingarea add ~0 ~-1 ~0 ~${size - 1} ~${maxY + 8} ~${size - 1} ${areaName} true`;
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

  const ns = `city_gen_${index}`;
  const tag = `cg${index}_o`;
  const objBuild = `cg${index}_b`;
  const objClear = `cg${index}_c`;
  const areaName = `cg${index}_a`;
  const label = `city_gen_${index}`;

  const functionsDir = path.join(outFunctionsRoot, ns);
  fs.mkdirSync(functionsDir, { recursive: true });

  const lots = createLots(size, lot, sidewalk, street);
  const terrainBatches = buildTerrainBatches(size, maxHeight);
  const roadBatches = buildRoadBatches(size, lot, sidewalk, street);
  const clearBatches = buildClearCommandBatches(size, maxHeight);

  const nTerrain = terrainBatches.length;
  const nRoads = roadBatches.length;
  const stepFirstTerrain = 1;
  const stepFirstRoad = stepFirstTerrain + nTerrain;
  const stepFirstBuilding = stepFirstRoad + nRoads;
  const stepLastBuilding = stepFirstBuilding + lots.length - 1;
  const stepBuildDone = stepLastBuilding + 1;
  const totalBuildSteps = stepLastBuilding;

  writeMcfunction(path.join(functionsDir, "start.mcfunction"), [
    `tellraw @a {"rawtext":[{"text":"[${label}] Starte (seed=${seed}) – in der Nähe bleiben …"}]}`,
    `scoreboard objectives add ${objBuild} dummy`,
    `scoreboard objectives add ${objClear} dummy`,
    `tickingarea remove ${areaName}`,
    `kill @e[type=armor_stand,tag=${tag}]`,
    "summon armor_stand ~ ~ ~",
    `tag @e[type=armor_stand,r=3,c=1] add ${tag}`,
    `effect @e[tag=${tag}] invisibility 999999 0 true`,
    tickingAreaAddCmd(size, maxHeight, areaName),
    `scoreboard players set @e[tag=${tag},c=1] ${objClear} 0`,
    `scoreboard players set @e[tag=${tag},c=1] ${objBuild} ${stepFirstTerrain}`,
    `execute as @e[tag=${tag},c=1] at @s run function ${ns}/terrain_batches/t_00`,
    `scoreboard players set @e[tag=${tag},c=1] ${objBuild} ${stepFirstTerrain + 1}`,
    `tellraw @a {"rawtext":[{"text":"[${label}] Bau läuft (${totalBuildSteps} Schritte) …"}]}`,
  ]);

  const terrainDir = path.join(functionsDir, "terrain_batches");
  for (let i = 0; i < terrainBatches.length; i++) {
    writeMcfunction(path.join(terrainDir, `t_${pad2(i)}.mcfunction`), terrainBatches[i]);
  }

  const roadsDir = path.join(functionsDir, "road_batches");
  for (let i = 0; i < roadBatches.length; i++) {
    writeMcfunction(path.join(roadsDir, `r_${pad2(i)}.mcfunction`), roadBatches[i]);
  }

  const buildingsDir = path.join(functionsDir, "buildings");
  for (let i = 0; i < lots.length; i++) {
    const oneLot = lots[i];
    const lotSeed = (seed + oneLot.col * 7919 + oneLot.row * 104729) >>> 0;
    const lotRng = createRng(lotSeed);
    writeMcfunction(
      path.join(buildingsDir, `b_${pad2(i)}.mcfunction`),
      buildTowerCommands(oneLot, lotRng, minHeight, maxHeight),
    );
  }

  writeMcfunction(path.join(functionsDir, "build_done.mcfunction"), [
    `scoreboard players set @e[tag=${tag}] ${objBuild} 0`,
    `tickingarea remove ${areaName}`,
    `tellraw @a {"rawtext":[{"text":"[${label}] Fertig. Undo: /function ${ns}/clear"}]}`,
  ]);

  const clearBatchDir = path.join(functionsDir, "clear_batches");
  for (let i = 0; i < clearBatches.length; i++) {
    writeMcfunction(path.join(clearBatchDir, `c_${pad2(i)}.mcfunction`), clearBatches[i]);
  }

  writeMcfunction(path.join(functionsDir, "clear.mcfunction"), [
    `tellraw @a {"rawtext":[{"text":"[${label}] Clear – Nordwest-Ecke bleiben …"}]}`,
    `scoreboard objectives add ${objBuild} dummy`,
    `scoreboard objectives add ${objClear} dummy`,
    `tickingarea remove ${areaName}`,
    `kill @e[type=armor_stand,tag=${tag}]`,
    "summon armor_stand ~ ~ ~",
    `tag @e[type=armor_stand,r=3,c=1] add ${tag}`,
    `effect @e[tag=${tag}] invisibility 999999 0 true`,
    tickingAreaAddCmd(size, maxHeight, areaName),
    `scoreboard players set @e[tag=${tag},c=1] ${objBuild} 0`,
    `scoreboard players set @e[tag=${tag},c=1] ${objClear} 1`,
    `execute as @e[tag=${tag},c=1] at @s run function ${ns}/clear_batches/c_00`,
    `scoreboard players set @e[tag=${tag},c=1] ${objClear} 2`,
    `tellraw @a {"rawtext":[{"text":"[${label}] Clear läuft (${clearBatches.length} Schritte) …"}]}`,
  ]);

  writeMcfunction(path.join(functionsDir, "clear_done.mcfunction"), [
    `scoreboard players set @e[tag=${tag}] ${objClear} 0`,
    `tickingarea remove ${areaName}`,
    `kill @e[tag=${tag}]`,
    `tellraw @a {"rawtext":[{"text":"[${label}] Clear fertig."}]}`,
  ]);

  const onTick = [];
  for (let i = 0; i < nTerrain; i++) {
    const step = stepFirstTerrain + i;
    onTick.push(
      `execute as @e[tag=${tag},c=1] at @s if score @s ${objBuild} matches ${step} run function ${ns}/terrain_batches/t_${pad2(i)}`,
    );
  }
  for (let i = 0; i < nRoads; i++) {
    const step = stepFirstRoad + i;
    onTick.push(
      `execute as @e[tag=${tag},c=1] at @s if score @s ${objBuild} matches ${step} run function ${ns}/road_batches/r_${pad2(i)}`,
    );
  }
  for (let i = 0; i < lots.length; i++) {
    const step = stepFirstBuilding + i;
    onTick.push(
      `execute as @e[tag=${tag},c=1] at @s if score @s ${objBuild} matches ${step} run function ${ns}/buildings/b_${pad2(i)}`,
    );
  }
  onTick.push(
    `execute as @e[tag=${tag},c=1] if score @s ${objBuild} matches ${stepFirstTerrain}..${totalBuildSteps} run scoreboard players add @s ${objBuild} 1`,
  );
  onTick.push(
    `execute as @e[tag=${tag},c=1] if score @s ${objBuild} matches ${stepBuildDone} run function ${ns}/build_done`,
  );
  for (let i = 0; i < clearBatches.length; i++) {
    onTick.push(
      `execute as @e[tag=${tag},c=1] at @s if score @s ${objClear} matches ${i + 1} run function ${ns}/clear_batches/c_${pad2(i)}`,
    );
  }
  onTick.push(
    `execute as @e[tag=${tag},c=1] if score @s ${objClear} matches 1..${clearBatches.length} run scoreboard players add @s ${objClear} 1`,
  );
  onTick.push(
    `execute as @e[tag=${tag},c=1] if score @s ${objClear} matches ${clearBatches.length + 1} run function ${ns}/clear_done`,
  );
  writeMcfunction(path.join(functionsDir, "on_tick.mcfunction"), onTick);

  return {
    ns,
    seed,
    buildings: lots.length,
    terrain_steps: nTerrain,
    road_steps: nRoads,
    build_steps: totalBuildSteps,
    clear_steps: clearBatches.length,
  };
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
      name: "City Gen",
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

  // Alias: city_gen → Variante 1 (Kurzform)
  const aliasDir = path.join(functionsRoot, "city_gen");
  fs.mkdirSync(aliasDir, { recursive: true });
  writeMcfunction(path.join(aliasDir, "start.mcfunction"), [
    "function city_gen_1/start",
  ]);
  writeMcfunction(path.join(aliasDir, "clear.mcfunction"), [
    "function city_gen_1/clear",
  ]);

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
  };
  fs.writeFileSync(path.join(OUT_DIR, "city_gen_meta.json"), JSON.stringify(meta, null, 2) + "\n");

  console.log(`Fertig: ${OUT_DIR}`);
  console.log(`  ${size}×${size}, ${variants} Varianten, base seed=${seed}`);
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
    minHeight: 60,
    maxHeight: 90,
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
  node generate_city_pack.mjs [--seed 42] [--variants ${DEFAULT_VARIANTS}] [--min-height 60] [--max-height 90]

  Erzeugt ${DEFAULT_VARIANTS} Varianten (anpassbar): city_gen_1 … city_gen_N
  Stadt: ${CITY_SIZE}×${CITY_SIZE}, Abstand Parzellen = ${LAYOUT.sidewalk + LAYOUT.street + LAYOUT.sidewalk}

Danach:
  ./gameplay/city/deploy_city_pack.sh minecraft

Im Spiel:
  /function city_gen_1/start
  /function city_gen_2/start
  …
  /function city_gen_1/clear`);
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
