#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "city_gen".
 *
 * Idee:
 * 1) Wir berechnen ein Strassenraster und Hochhäuser (Zufall mit --seed).
 * 2) Daraus werden Minecraft-Befehle geschrieben (fill …).
 * 3) Die Befehle landen in .mcfunction-Dateien.
 * 4) Im Spiel: hinschauen → /function city_gen/start (vorne + rechts)
 *
 * Aufruf:
 *   node gameplay/city/generate_city_pack.mjs --seed 42 --size gross
 *   node gameplay/city/generate_city_pack.mjs --seed 42 --size klein
 *
 * Grösse: klein = 60×60, gross = 120×120 (Default: gross)
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

/** Stadtgrösse in Blöcken (muss durch Zellgrösse 20 teilbar sein). */
const SIZE_PRESETS = {
  klein: 60,
  gross: 120,
};

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
 * Lokale Koordinate relativ zur Blickrichtung (^).
 * ^x = rechts, ~y = oben (Welt), ^z = vorwärts.
 * → Stadt wächst immer vor dir und nach rechts – Himmelsrichtung egal.
 */
function at(x, y, z) {
  return `^${x} ~${y} ^${z}`;
}

/** Ein einzelner fill-Befehl. mode z.B. "hollow" = nur die Hülle. */
function fill(x1, y1, z1, x2, y2, z2, block, mode = "") {
  const from = at(x1, y1, z1);
  const to = at(x2, y2, z2);
  if (mode) return `fill ${from} ${to} ${block} ${mode}`;
  return `fill ${from} ${to} ${block}`;
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
 * size=160 → genau 8×8 Parzellen.
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

/** Boden plätten: Luft bis maxHeight, dann Steinschicht auf y=0. */
function buildTerrainCommands(size, maxHeight) {
  return [
    ...fillLarge(0, 0, 0, size - 1, maxHeight, size - 1, "air"),
    ...fillLarge(0, 0, 0, size - 1, 0, size - 1, "stone"),
    'tellraw @a {"rawtext":[{"text":"[city_gen] Terrain fertig – Strassen …"}]}',
  ];
}

/** Strassen (grau) + Bürgersteige (hellgrau) + mittlere Markierung (weiss). */
function buildRoadCommands(size, lot, sidewalk, street) {
  const cell = lot + sidewalk + street + sidewalk;
  const grid = size / cell;
  const commands = [];

  for (let i = 0; i < grid; i++) {
    const base = i * cell;

    // Entlang dieser Zelle: Bürgersteig | Strasse | Bürgersteig
    const walkA = base + lot;
    const roadStart = walkA + sidewalk;
    const roadEnd = roadStart + street - 1;
    const walkB = roadEnd + 1;

    // Vertikale Strasse (durchgängiger Streifen in Z-Richtung)
    commands.push(...fillLarge(walkA, 0, 0, walkB, 0, size - 1, "light_gray_concrete"));
    commands.push(...fillLarge(roadStart, 0, 0, roadEnd, 0, size - 1, "gray_concrete"));

    // Horizontale Strasse (durchgängiger Streifen in X-Richtung)
    commands.push(...fillLarge(0, 0, walkA, size - 1, 0, walkB, "light_gray_concrete"));
    commands.push(...fillLarge(0, 0, roadStart, size - 1, 0, roadEnd, "gray_concrete"));

    // Fahrbahnmitte markieren
    const mid = Math.floor((roadStart + roadEnd) / 2);
    commands.push(...fillLarge(mid, 0, 0, mid, 0, size - 1, "white_concrete"));
    commands.push(...fillLarge(0, 0, mid, size - 1, 0, mid, "white_concrete"));
  }

  commands.push('tellraw @a {"rawtext":[{"text":"[city_gen] Strassen fertig."}]}');
  return commands;
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
  // Vorraum innen (Gebäude bleibt aussen geschlossen)
  commands.push(fill(doorX0, 1, z1 - 2, doorX1, 3, z1 - 1, "air"));

  // --- Treppenhaus innen (linke hintere Ecke), 2×2 Schacht mit Wendeltreppe ---
  // weirdo_direction: 0=Ost, 1=West, 2=Süd, 3=Nord
  const sx = x0 + 1;
  const sz = z0 + 1;
  // Schacht durch alle Etagen frei (Böden durchbrechen)
  commands.push(fill(sx, 1, sz, sx + 1, height - 1, sz + 1, "air"));

  for (let y = 1; y < height; y++) {
    const phase = (y - 1) % 4;
    let tx = sx;
    let tz = sz;
    let dir = 0;
    if (phase === 0) {
      tx = sx;
      tz = sz;
      dir = 0; // nach Osten aufsteigen
    } else if (phase === 1) {
      tx = sx + 1;
      tz = sz;
      dir = 2; // nach Süden
    } else if (phase === 2) {
      tx = sx + 1;
      tz = sz + 1;
      dir = 1; // nach Westen
    } else {
      tx = sx;
      tz = sz + 1;
      dir = 3; // nach Norden
    }
    commands.push(
      fill(
        tx,
        y,
        tz,
        tx,
        y,
        tz,
        `stone_stairs ["weirdo_direction"=${dir},"upside_down_bit"=false]`,
      ),
    );
  }

  // Zugang vom Vorraum zum Treppenhaus (innen)
  commands.push(fill(sx + 2, 1, sz, sx + 2, 2, sz + 1, "air"));

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
  const batchSize = 6;
  const batches = [];
  for (let i = 0; i < all.length; i += batchSize) {
    batches.push(all.slice(i, i + batchSize));
  }
  return batches;
}

// ---------------------------------------------------------------------------
// Pack zusammensetzen
// ---------------------------------------------------------------------------

function buildPack(options) {
  const { seed, size, minHeight, maxHeight, lot, sidewalk, street } = options;

  if (minHeight > maxHeight) {
    throw new Error("min-height muss <= max-height sein");
  }

  // Alten Pack-Ordner ersetzen
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  const functionsDir = path.join(OUT_DIR, "functions", "city_gen");
  fs.mkdirSync(functionsDir, { recursive: true });

  // manifest.json = „Ausweis“ des Behavior Packs
  const manifest = {
    format_version: 2,
    header: {
      name: "City Gen",
      description: `Procedural city (seed=${seed}, size=${size})`,
      uuid: PACK_UUID,
      version: [1, 0, 0],
      min_engine_version: [1, 20, 0],
    },
    modules: [{ type: "data", uuid: MODULE_UUID, version: [1, 0, 0] }],
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  const lots = createLots(size, lot, sidewalk, street);

  // Reihenfolge: Terrain → Häuser (einzeln) → Strassen zuletzt
  // (Strassen zuletzt, damit sie nicht verloren gehen; 1 Haus/Datei gegen Command-Limits)

  // Marker am Origin: clear findet die Stadt auch ohne gleichen Standpunkt
  writeMcfunction(path.join(functionsDir, "start.mcfunction"), [
    'tellraw @a {"rawtext":[{"text":"[city_gen] Starte Stadtbau …"}]}',
    "scoreboard objectives add city_gen dummy",
    "scoreboard players set clear_step city_gen 0",
    "kill @e[type=armor_stand,tag=city_gen_origin]",
    "summon armor_stand ~ ~ ~",
    "tag @e[type=armor_stand,r=2,c=1] add city_gen_origin",
    // Gleiche Blickrichtung wie der Spieler (für ^-Koordinaten beim Clear)
    "tp @e[type=armor_stand,tag=city_gen_origin,c=1] ~ ~ ~ facing ^0 ^0 ^1",
    "effect @e[type=armor_stand,tag=city_gen_origin] invisibility 999999 0 true",
    "function city_gen/terrain",
  ]);

  const terrain = buildTerrainCommands(size, maxHeight);
  terrain.push(
    lots.length > 0 ? "function city_gen/buildings/b_00" : "function city_gen/roads",
  );
  writeMcfunction(path.join(functionsDir, "terrain.mcfunction"), terrain);

  const buildingsDir = path.join(functionsDir, "buildings");
  for (let i = 0; i < lots.length; i++) {
    const oneLot = lots[i];
    const lotSeed = (seed + oneLot.col * 7919 + oneLot.row * 104729) >>> 0;
    const lotRng = createRng(lotSeed);
    const commands = buildTowerCommands(oneLot, lotRng, minHeight, maxHeight);

    if (i + 1 < lots.length) {
      commands.push(`function city_gen/buildings/b_${pad2(i + 1)}`);
    } else {
      commands.push("function city_gen/roads");
    }
    writeMcfunction(path.join(buildingsDir, `b_${pad2(i)}.mcfunction`), commands);
  }

  const roads = buildRoadCommands(size, lot, sidewalk, street);
  // Strassen nochmals sicher auf y=0 (sichtbar über Steinboden)
  roads.push(
    'tellraw @a {"rawtext":[{"text":"[city_gen] Fertig. Undo: /function city_gen/clear"}]}',
  );
  writeMcfunction(path.join(functionsDir, "roads.mcfunction"), roads);

  // --- clear über mehrere Ticks (tick.json) ---
  // Ein Tick = ein Batch. Grosse fill-Ketten im selben Tick bleiben sonst wirkungslos.

  const clearBatches = buildClearCommandBatches(size, maxHeight);
  const clearBatchDir = path.join(functionsDir, "clear_batches");
  fs.mkdirSync(clearBatchDir, { recursive: true });

  for (let i = 0; i < clearBatches.length; i++) {
    writeMcfunction(
      path.join(clearBatchDir, `c_${pad2(i)}.mcfunction`),
      clearBatches[i],
    );
  }

  // clear: Marker sicherstellen, Clear-Schleife scharf schalten
  writeMcfunction(path.join(functionsDir, "clear.mcfunction"), [
    'tellraw @a {"rawtext":[{"text":"[city_gen] Clear … (läuft über mehrere Ticks)"}]}',
    "scoreboard objectives add city_gen dummy",
    "execute unless entity @e[type=armor_stand,tag=city_gen_origin] run function city_gen/clear_place_marker",
    "scoreboard players set clear_step city_gen 1",
  ]);

  writeMcfunction(path.join(functionsDir, "clear_place_marker.mcfunction"), [
    'tellraw @a {"rawtext":[{"text":"[city_gen] Kein Origin-Marker – Clear vom aktuellen Standpunkt (gleiche Blickrichtung)."}]}',
    "summon armor_stand ~ ~ ~",
    "tag @e[type=armor_stand,r=2,c=1] add city_gen_origin",
    "tp @e[type=armor_stand,tag=city_gen_origin,c=1] ~ ~ ~ facing ^0 ^0 ^1",
    "effect @e[type=armor_stand,tag=city_gen_origin] invisibility 999999 0 true",
  ]);

  // Pro Tick genau ein Batch (Score erst danach erhöhen → kein Same-Tick-Durchlauf)
  const advanceLines = [];
  for (let i = 0; i < clearBatches.length; i++) {
    advanceLines.push(
      `execute if score clear_step city_gen matches ${i + 1} run function city_gen/clear_batches/c_${pad2(i)}`,
    );
  }
  writeMcfunction(path.join(functionsDir, "clear_advance.mcfunction"), advanceLines);

  const doneStep = clearBatches.length + 1;
  writeMcfunction(path.join(functionsDir, "clear_done.mcfunction"), [
    "scoreboard players set clear_step city_gen 0",
    "kill @e[type=armor_stand,tag=city_gen_origin]",
    'tellraw @a {"rawtext":[{"text":"[city_gen] Clear fertig."}]}',
  ]);

  writeMcfunction(path.join(functionsDir, "on_tick.mcfunction"), [
    `execute if score clear_step city_gen matches 1..${clearBatches.length} as @e[type=armor_stand,tag=city_gen_origin,c=1] at @s run function city_gen/clear_advance`,
    `execute if score clear_step city_gen matches 1..${clearBatches.length} run scoreboard players add clear_step city_gen 1`,
    `execute if score clear_step city_gen matches ${doneStep} run function city_gen/clear_done`,
  ]);

  // tick.json liegt direkt unter functions/
  fs.writeFileSync(
    path.join(OUT_DIR, "functions", "tick.json"),
    JSON.stringify({ values: ["city_gen/on_tick"] }, null, 2) + "\n",
  );

  // Kleine Meta-Datei nur zur Übersicht (nicht von Minecraft gelesen)
  const meta = {
    seed,
    size,
    min_height: minHeight,
    max_height: maxHeight,
    lot,
    sidewalk,
    street,
    buildings: lots.length,
    building_files: lots.length,
    clear_steps: clearBatches.length,
  };
  fs.writeFileSync(path.join(OUT_DIR, "city_gen_meta.json"), JSON.stringify(meta, null, 2) + "\n");

  console.log(
    `Fertig: ${OUT_DIR}\n` +
      `  ${size}×${size}, ${lots.length} Häuser, seed=${seed}, clear_steps=${clearBatches.length}`,
  );
}

// ---------------------------------------------------------------------------
// Kommandozeile
// ---------------------------------------------------------------------------

function parseSize(raw) {
  const key = String(raw).toLowerCase();
  if (SIZE_PRESETS[key] !== undefined) return SIZE_PRESETS[key];
  const n = Number(raw);
  if (n === SIZE_PRESETS.klein || n === SIZE_PRESETS.gross) return n;
  throw new Error(
    `Ungültige --size "${raw}". Erlaubt: klein (${SIZE_PRESETS.klein}), gross (${SIZE_PRESETS.gross})`,
  );
}

function parseArgs(argv) {
  const options = {
    seed: 42,
    size: SIZE_PRESETS.gross,
    minHeight: 60,
    maxHeight: 90,
    lot: 13,
    sidewalk: 1,
    street: 5,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Wert fehlt nach ${arg}`);
      return v;
    };

    if (arg === "--seed") options.seed = Number(value());
    else if (arg === "--size") options.size = parseSize(value());
    else if (arg === "--min-height") options.minHeight = Number(value());
    else if (arg === "--max-height") options.maxHeight = Number(value());
    else if (arg === "--lot") options.lot = Number(value());
    else if (arg === "--sidewalk") options.sidewalk = Number(value());
    else if (arg === "--street") options.street = Number(value());
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage:
  node generate_city_pack.mjs [--seed 42] [--size klein|gross] [--min-height 60] [--max-height 90]

  --size klein  → ${SIZE_PRESETS.klein}×${SIZE_PRESETS.klein}
  --size gross  → ${SIZE_PRESETS.gross}×${SIZE_PRESETS.gross}  (Default)

Danach deployen:
  ./gameplay/city/deploy_city_pack.sh minecraft

Im Spiel: an die Ecke stellen, dorthin schauen wo die Stadt hin soll:
  /function city_gen/start
  /function city_gen/clear`);
      process.exit(0);
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
