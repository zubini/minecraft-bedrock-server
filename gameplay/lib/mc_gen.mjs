/**
 * Gemeinsame Hilfen für Behavior-Pack-Generatoren (City + Landmarken).
 */

import fs from "node:fs";
import path from "node:path";

/** Minecraft erlaubt max. 32768 Blöcke pro /fill. */
export const FILL_MAX_BLOCKS = 32768;

/**
 * Einfacher Zufallsgenerator mit festem Startwert (Seed).
 * Gleicher Seed → gleiche Ausgabe.
 */
export function createRng(seed) {
  let state = seed >>> 0;

  return {
    random() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    int(min, max) {
      return min + Math.floor(this.random() * (max - min + 1));
    },

    pick(list) {
      return list[Math.floor(this.random() * list.length)];
    },
  };
}

/**
 * Relativ zum Origin-Marker (Spieler-Standpunkt).
 * +x = Ost, +y = oben, +z = Süd.
 */
export function at(x, y, z) {
  return `~${x} ~${y} ~${z}`;
}

export function fill(x1, y1, z1, x2, y2, z2, block, mode = "") {
  const from = at(x1, y1, z1);
  const to = at(x2, y2, z2);
  if (mode) return `fill ${from} ${to} ${block} ${mode}`;
  return `fill ${from} ${to} ${block}`;
}

export function setblock(x, y, z, block) {
  return `setblock ${at(x, y, z)} ${block}`;
}

/**
 * Wie fill(), aber splittet grosse Quader, falls > maxBlocks.
 */
export function fillLarge(
  x1,
  y1,
  z1,
  x2,
  y2,
  z2,
  block,
  mode = "",
  maxBlocks = FILL_MAX_BLOCKS,
) {
  const commands = [];

  const yMin = Math.min(y1, y2);
  const yMax = Math.max(y1, y2);
  const zMin = Math.min(z1, z2);
  const zMax = Math.max(z1, z2);
  const xMin = Math.min(x1, x2);
  const xMax = Math.max(x1, x2);

  const height = yMax - yMin + 1;
  const depth = zMax - zMin + 1;
  const maxStripWidth = Math.max(1, Math.floor(maxBlocks / (height * depth)));

  for (let x = xMin; x <= xMax; ) {
    const xEnd = Math.min(xMax, x + maxStripWidth - 1);
    const width = xEnd - x + 1;

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

export function writeMcfunction(filePath, lines) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const text = lines.filter((line) => line.trim() !== "").join("\n") + "\n";
  fs.writeFileSync(filePath, text, "utf8");
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function chunkCommands(all, batchSize) {
  const batches = [];
  for (let i = 0; i < all.length; i += batchSize) {
    batches.push(all.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Luft-Scheiben von yFrom bis clearTop (für Clear und Terrain-Prep).
 * sizeX / sizeZ = Footprint in Blöcken.
 */
export function buildAirClearCommands(sizeX, maxHeight, yFrom = 0, sizeZ = sizeX) {
  const clearTop = maxHeight + 4;
  const clearFillMax = 4096;
  const all = [];
  const x1 = sizeX - 1;
  const z1 = sizeZ - 1;

  const lowEnd = Math.min(15, clearTop);
  for (let y0 = yFrom; y0 <= lowEnd; y0 += 2) {
    const y1 = Math.min(lowEnd, y0 + 1);
    all.push(...fillLarge(0, y0, 0, x1, y1, z1, "air", "", clearFillMax));
  }
  for (let y0 = Math.max(yFrom, 16); y0 <= clearTop; y0 += 4) {
    const y1 = Math.min(clearTop, y0 + 3);
    all.push(...fillLarge(0, y0, 0, x1, y1, z1, "air", "", clearFillMax));
  }
  all.push(
    ...fillLarge(0, yFrom, 0, x1, Math.min(yFrom + 3, clearTop), z1, "air", "", clearFillMax),
  );
  return all;
}

export function buildClearCommandBatches(sizeX, maxHeight, sizeZ = sizeX) {
  return chunkCommands(buildAirClearCommands(sizeX, maxHeight, 0, sizeZ), 3);
}

/** Tickingarea über die Fläche (+X/+Z vom Origin). */
export function tickingAreaAddCmd(sizeX, maxY, areaName, sizeZ = sizeX) {
  return `tickingarea add ~0 ~-1 ~0 ~${sizeX - 1} ~${maxY + 8} ~${sizeZ - 1} ${areaName} true`;
}

/**
 * Origin-Marker am Spieler.
 * @param {string} tag – spezifischer Tag
 * @param {string} groupTag – gemeinsamer Gruppen-Tag (z.B. city_o, lm_o)
 */
export function originMarkerLines(tag, groupTag = "lm_o") {
  return [
    "summon armor_stand ~ ~ ~",
    `tag @e[type=armor_stand,r=3,c=1] add ${tag}`,
    `tag @e[tag=${tag},c=1] add ${groupTag}`,
    `effect @e[tag=${tag}] invisibility 999999 0 true`,
  ];
}

/**
 * Ellipse: true wenn Punkt (x,z) innerhalb der Ellipse um (cx,cz) mit Radien rx, rz.
 */
export function inEllipse(x, z, cx, cz, rx, rz) {
  const dx = (x - cx) / rx;
  const dz = (z - cz) / rz;
  return dx * dx + dz * dz <= 1;
}

/**
 * Ellipse-Ring: innerhalb aussen, ausserhalb innen.
 */
export function inEllipseRing(x, z, cx, cz, rxOuter, rzOuter, rxInner, rzInner) {
  return (
    inEllipse(x, z, cx, cz, rxOuter, rzOuter) &&
    !inEllipse(x, z, cx, cz, rxInner, rzInner)
  );
}
