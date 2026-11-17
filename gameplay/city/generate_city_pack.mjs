#!/usr/bin/env node
/**
 * Erzeugt das Behavior Pack "city_gen".
 *
 * Idee:
 * 1) Wir berechnen ein Strassenraster und Hochhäuser (Zufall mit --seed).
 * 2) Daraus werden Minecraft-Befehle geschrieben (fill …).
 * 3) Die Befehle landen in .mcfunction-Dateien.
 * 4) Im Spiel: /function city_gen/start  (baut relativ zu deinem Standpunkt)
 *
 * Aufruf:
 *   node gameplay/city/generate_city_pack.mjs --seed 42
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
 * Relative Minecraft-Koordinate.
 * ~0 ~5 ~10  = 0 nach Osten, 5 nach oben, 10 nach Süden – vom Spieler aus.
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

/**
 * Wie fill(), aber splittet grosse Quader, falls > FILL_MAX_BLOCKS.
 * Sonst schlägt der Befehl im Spiel fehl.
 */
function fillLarge(x1, y1, z1, x2, y2, z2, block, mode = "") {
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
  const maxStripWidth = Math.max(1, Math.floor(FILL_MAX_BLOCKS / (height * depth)));

  for (let x = xMin; x <= xMax; ) {
    const xEnd = Math.min(xMax, x + maxStripWidth - 1);
    const width = xEnd - x + 1;

    // Falls immer noch zu gross: zusätzlich in Z schneiden
    if (width * height * depth > FILL_MAX_BLOCKS) {
      const maxDepth = Math.max(1, Math.floor(FILL_MAX_BLOCKS / (width * height)));
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

  commands.push('tellraw @a {"rawtext":[{"text":"[city_gen] Strassen fertig – Hochhäuser …"}]}');
  return commands;
}

/**
 * Ein Hochhaus auf einer Parzelle.
 * y=0 ist der Boden; das Haus geht von y=1 nach oben.
 *
 * Grundfläche (Grunddurchmesser): immer 10×10 oder 12×12,
 * zentriert auf der Parzelle (Parzelle muss mindestens 12×12 sein).
 */
function buildTowerCommands(lot, rng, minHeight, maxHeight) {
  const lotWidth = lot.x1 - lot.x0 + 1;
  const lotDepth = lot.z1 - lot.z0 + 1;
  if (lotWidth < 12 || lotDepth < 12) {
    throw new Error(
      `Parzelle ${lotWidth}×${lotDepth} ist zu klein – für 10/12er Häuser braucht es lot >= 12`,
    );
  }

  // Pro Turm: entweder 10×10 oder 12×12 Grundfläche
  const footprint = rng.pick([10, 12]);
  const insetX = Math.floor((lotWidth - footprint) / 2);
  const insetZ = Math.floor((lotDepth - footprint) / 2);

  const x0 = lot.x0 + insetX;
  const z0 = lot.z0 + insetZ;
  const x1 = x0 + footprint - 1;
  const z1 = z0 + footprint - 1;

  const height = rng.int(minHeight, maxHeight);
  const facade = rng.pick(FACADE_COLORS);
  const bandEvery = rng.int(3, 5); // alle N Blöcke ein Beton-Gesims
  const setbackCount = rng.int(0, 2); // 0–2 Verjüngungen nach oben
  const withAntenna = rng.random() < 0.45;

  const commands = [];

  /** Ein Turmabschnitt: Hülle + Glasfassade + horizontale Bänder. */
  function buildShaft(xa, za, xb, zb, yBottom, yTop) {
    if (xb < xa || zb < za || yTop < yBottom) return;

    // Äussere Betonkiste, innen hohl
    commands.push(fill(xa, yBottom, za, xb, yTop, zb, facade, "hollow"));

    if (xb - xa < 2 || zb - za < 2 || yTop <= yBottom) return;

    // Vier Glaswände (Ecken bleiben Beton)
    commands.push(fill(xa + 1, yBottom + 1, za, xb - 1, yTop - 1, za, "glass"));
    commands.push(fill(xa + 1, yBottom + 1, zb, xb - 1, yTop - 1, zb, "glass"));
    commands.push(fill(xa, yBottom + 1, za + 1, xa, yTop - 1, zb - 1, "glass"));
    commands.push(fill(xb, yBottom + 1, za + 1, xb, yTop - 1, zb - 1, "glass"));

    // Beton-Bänder als Stockwerks-Rhythmus
    for (let y = yBottom + bandEvery; y < yTop; y += bandEvery) {
      commands.push(fill(xa + 1, y, za, xb - 1, y, za, facade));
      commands.push(fill(xa + 1, y, zb, xb - 1, y, zb, facade));
      commands.push(fill(xa, y, za + 1, xa, y, zb - 1, facade));
      commands.push(fill(xb, y, za + 1, xb, y, zb - 1, facade));
    }
  }

  // Hauptteil des Turms
  let curX0 = x0;
  let curZ0 = z0;
  let curX1 = x1;
  let curZ1 = z1;
  let curY = height;

  buildShaft(curX0, curZ0, curX1, curZ1, 1, curY);

  // Optionale Setbacks: oben schmaler weiterbauen
  for (let i = 0; i < setbackCount; i++) {
    const extraHeight = rng.int(8, 16);
    const shrink = rng.int(1, 2);
    const nextX0 = curX0 + shrink;
    const nextZ0 = curZ0 + shrink;
    const nextX1 = curX1 - shrink;
    const nextZ1 = curZ1 - shrink;

    if (nextX1 - nextX0 < 3 || nextZ1 - nextZ0 < 3) break;

    const nextY = Math.min(maxHeight, curY + extraHeight);
    if (nextY <= curY) break;

    // Terrasse auf dem breiteren Teil darunter
    commands.push(fill(curX0, curY, curZ0, curX1, curY, curZ1, facade));

    curX0 = nextX0;
    curZ0 = nextZ0;
    curX1 = nextX1;
    curZ1 = nextZ1;
    buildShaft(curX0, curZ0, curX1, curZ1, curY + 1, nextY);
    curY = nextY;
  }

  // Flaches Dach
  commands.push(fill(curX0, curY, curZ0, curX1, curY, curZ1, facade));

  // Eingang an der Südseite (+Z), 2 Blöcke hoch
  const doorX0 = x0 + Math.max(1, Math.floor(footprint / 2) - 1);
  const doorX1 = Math.min(x1 - 1, doorX0 + 1);
  commands.push(fill(doorX0, 1, z1, doorX1, 2, z1, "air"));

  // Manchmal eine Antenne
  if (withAntenna) {
    const mx = Math.floor((curX0 + curX1) / 2);
    const mz = Math.floor((curZ0 + curZ1) / 2);
    commands.push(fill(mx, curY + 1, mz, mx, curY + 4, mz, "iron_bars"));
  }

  return commands;
}

/** Alles im Bauvolumen löschen (für /function city_gen/clear). */
function buildClearCommandBatches(size, maxHeight) {
  const all = [
    ...fillLarge(0, 0, 0, size - 1, maxHeight, size - 1, "air"),
    ...fillLarge(0, 0, 0, size - 1, 0, size - 1, "grass_block"),
  ];

  // In Häppchen teilen, damit eine Function nicht zu lang wird
  const batchSize = 80;
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

  // --- start → terrain → roads → buildings/b_00 → … → b_N ---

  writeMcfunction(path.join(functionsDir, "start.mcfunction"), [
    'tellraw @a {"rawtext":[{"text":"[city_gen] Starte Stadtbau …"}]}',
    "function city_gen/terrain",
  ]);

  const terrain = buildTerrainCommands(size, maxHeight);
  terrain.push("function city_gen/roads");
  writeMcfunction(path.join(functionsDir, "terrain.mcfunction"), terrain);

  const roads = buildRoadCommands(size, lot, sidewalk, street);
  roads.push("function city_gen/buildings/b_00");
  writeMcfunction(path.join(functionsDir, "roads.mcfunction"), roads);

  // Je 4 Häuser in einer Datei (sonst zu viele Befehle auf einmal)
  const HOUSES_PER_FILE = 4;
  const sectors = [];
  for (let i = 0; i < lots.length; i += HOUSES_PER_FILE) {
    sectors.push(lots.slice(i, i + HOUSES_PER_FILE));
  }

  const buildingsDir = path.join(functionsDir, "buildings");
  for (let s = 0; s < sectors.length; s++) {
    const commands = [];

    for (const oneLot of sectors[s]) {
      // Pro Parzelle eigener Zufallsstrom → stabile, unterschiedliche Türme
      const lotSeed = (seed + oneLot.col * 7919 + oneLot.row * 104729) >>> 0;
      const lotRng = createRng(lotSeed);
      commands.push(...buildTowerCommands(oneLot, lotRng, minHeight, maxHeight));
    }

    if (s + 1 < sectors.length) {
      commands.push(`function city_gen/buildings/b_${pad2(s + 1)}`);
    } else {
      commands.push(
        'tellraw @a {"rawtext":[{"text":"[city_gen] Fertig. Undo: /function city_gen/clear"}]}',
      );
    }

    writeMcfunction(path.join(buildingsDir, `b_${pad2(s)}.mcfunction`), commands);
  }

  // --- clear → clear_01 → … ---

  const clearBatches = buildClearCommandBatches(size, maxHeight);
  for (let i = 0; i < clearBatches.length; i++) {
    const lines = [...clearBatches[i]];
    if (i === 0) {
      lines.unshift('tellraw @a {"rawtext":[{"text":"[city_gen] Clear …"}]}');
    }
    if (i + 1 < clearBatches.length) {
      lines.push(`function city_gen/clear_${pad2(i + 1)}`);
    } else {
      lines.push('tellraw @a {"rawtext":[{"text":"[city_gen] Clear fertig."}]}');
    }
    const name = i === 0 ? "clear.mcfunction" : `clear_${pad2(i)}.mcfunction`;
    writeMcfunction(path.join(functionsDir, name), lines);
  }

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
    building_sectors: sectors.length,
    clear_steps: clearBatches.length,
  };
  fs.writeFileSync(path.join(OUT_DIR, "city_gen_meta.json"), JSON.stringify(meta, null, 2) + "\n");

  console.log(
    `Fertig: ${OUT_DIR}\n` +
      `  ${lots.length} Häuser in ${sectors.length} Dateien, seed=${seed}`,
  );
}

// ---------------------------------------------------------------------------
// Kommandozeile
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    seed: 42,
    size: 160,
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
    else if (arg === "--size") options.size = Number(value());
    else if (arg === "--min-height") options.minHeight = Number(value());
    else if (arg === "--max-height") options.maxHeight = Number(value());
    else if (arg === "--lot") options.lot = Number(value());
    else if (arg === "--sidewalk") options.sidewalk = Number(value());
    else if (arg === "--street") options.street = Number(value());
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage:
  node generate_city_pack.mjs [--seed 42] [--size 160] [--min-height 60] [--max-height 90]

Danach deployen:
  ./gameplay/city/deploy_city_pack.sh minecraft

Im Spiel (SW-Ecke):
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
