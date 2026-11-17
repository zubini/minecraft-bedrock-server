# Tipps (Spiel / Bauen)

Gameplay-Hinweise für den Bedrock-Server — getrennt von Installation und Server-Konfiguration (siehe Root-[`README.md`](../README.md)).

Skripte und Packs liegen unter [`gameplay/city/`](city/).

## Prozedurale Stadt (`city_gen`)

Behavior Pack baut eine Hochhauslandschaft mit Strassen **in Blickrichtung** (vorne und rechts).

### Voraussetzungen

- Operator-Rechte
- Pack erzeugt und auf den Server deployed

### Pack erzeugen (lokal)

```bash
# gross = 120×120 (Default), klein = 60×60
node gameplay/city/generate_city_pack.mjs --seed 42 --size gross
node gameplay/city/generate_city_pack.mjs --seed 42 --size klein
# optional: --min-height 60 --max-height 90
# Häuser: 10×10 oder 12×12, Eingang in der Fassade, Treppenhaus innen
```

Anderer Look: anderen `--seed` wählen und erneut erzeugen.

### Deploy

```bash
./gameplay/city/deploy_city_pack.sh minecraft
```

Startet den Server-Dienst neu. Danach ggf. neu joinen.

### Bauen (so einfach wie möglich)

1. An die **hintere linke Ecke** der gewünschten Fläche stellen  
2. **Dorthin schauen**, wo die Stadt hin soll (freie Fläche vor dir)  
3. Chat:

```
/function city_gen/start
```

Die Stadt wächst **vor dir** und nach **rechts**. Kompass/Norden brauchst du nicht.

```text
        (Blickrichtung)
              ↑ vorne
              ·········
        ●─────·  STADT
      du      → rechts
```

Der Lauf kann bei `gross` etwas dauern. Chat zeigt den Fortschritt.

### Rückgängig

```
/function city_gen/clear
```

Beim `start` wird ein unsichtbarer Marker gesetzt – Clear findet die Stadt damit auch von woanders.  
Ohne Marker: wieder an dieselbe Ecke stellen, in dieselbe Richtung schauen, dann clear.

Clear läuft über mehrere Ticks („Clear fertig.“ abwarten). Stellt vorheriges Terrain nicht wieder her.

### Seed neu ausprobieren

1. `/function city_gen/clear`
2. Lokal `node gameplay/city/generate_city_pack.mjs --seed <neu> --size gross`
3. `./gameplay/city/deploy_city_pack.sh minecraft`
4. `/function city_gen/start`

## Gebäude kopieren (Structure Block)

Im Kreativmodus kannst du Bauwerke speichern und später an anderer Stelle wieder laden — wie Kopieren & Einfügen für Gebäude. Dafür brauchst du **Operator-Rechte** (`permissions.json` oder `op <Gamertag>`).

**Structure Block holen:**

```
/give @s structure_block
```

**Speichern**

1. Gebäude (oder eine Etage) bauen
2. Structure Block an eine Ecke setzen und anklicken
3. Modus **Save**, Grösse (X/Y/Z) so einstellen, dass alles im Rahmen liegt
4. Namen vergeben (z. B. `hochhaus` oder `etage1`) → **Save**

**Platzieren**

An die gewünschte Stelle stellen (Ecke des Gebäudes) und im Chat:

```
/structure load hochhaus ~ ~ ~
```

Oder Structure Block setzen → Modus **Load** → gleicher Name → **Load**.

`~` bedeutet „relativ zu dir“ (wo du stehst). Versatz geht z. B. mit `~5 ~ ~-3`.

**Etagen stapeln:** Eine Etage als `etage1` speichern und mehrfach nach oben laden, z. B.:

```
/structure load etage1 ~ ~ ~
/structure load etage1 ~ ~5 ~
/structure load etage1 ~ ~10 ~
```

(Höhe `~5` an die echte Etagenhöhe anpassen.)
