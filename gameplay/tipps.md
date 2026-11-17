# Tipps (Spiel / Bauen)

Gameplay-Hinweise für den Bedrock-Server — getrennt von Installation und Server-Konfiguration (siehe Root-[`README.md`](../README.md)).

Skripte und Packs liegen unter [`gameplay/`](.) (Stadt + Landmarken).

## Prozedurale Stadt (`city`)

Behavior Pack baut eine Hochhauslandschaft mit Strassen ab deinem Standpunkt (nach **Osten** und **Süden**).  
Mehrere Varianten: `city_1` … `city_5` (verschiedene Seeds).

### Voraussetzungen

- Operator-Rechte
- Pack erzeugt und auf den Server deployed

### Pack erzeugen (lokal)

```bash
node gameplay/city/generate_city_pack.mjs --seed 42
node gameplay/city/generate_city_pack.mjs --seed 42 --variants 5
```

### Deploy

```bash
./gameplay/city/deploy_city_pack.sh minecraft
```

Startet den Server neu. Danach ggf. neu joinen.

### Terrain vorbereiten (optional)

An die **Nordwest-Ecke** stellen (Fuss-Höhe = Boden). Fläche nach Ost+Süd freihalten:

```
/function city/terrain
```

Macht **unter den Füssen** eine Erd-/Gras-Ebene (80×80) und räumt **darüber** alles frei.  
Chat: „Terrain fertig.“ abwarten.

### Bauen

1. An dieselbe Nordwest-Ecke stellen  
2. Freie Fläche nach **Osten** (+X) und **Süden** (+Z)  
3. Chat – eine Variante wählen:

```
/function city_1/start
/function city_2/start
/function city_3/start
/function city_4/start
/function city_5/start
```

Kurzform (Variante 1): `/function city/start`

Bau läuft **über mehrere Sekunden** (Chat: „Fertig.“ abwarten).  
**In der Nähe bleiben**, bis es fertig ist.

### Rückgängig

```
/function city/clear
```

Wieder an die **Nordwest-Ecke**. Über mehrere Sekunden („Clear fertig.“).

### Seed / mehr Varianten

1. `/function city/clear`  
2. Lokal `node gameplay/city/generate_city_pack.mjs --seed <neu> [--variants 5]`  
3. `./gameplay/city/deploy_city_pack.sh minecraft`  
4. `/function city_N/start`

## Landmarken (Kirche, Stadion, Schule, Rathaus, Park)

Eigenständige Behavior Packs — jeweils **Nordwest-Ecke**, Bau nach **Ost+Süd**, eigenes Clear mit passender Grösse.

| Pack | Grösse (X×Z) | Höhe Clear | Start | Clear |
|------|--------------|------------|-------|-------|
| Kirche | 24×40 | ~35 | `/function church/start` | `/function church/clear` |
| Stadion | 70×100 | ~28 | `/function stadium/start` | `/function stadium/clear` |
| Schule | 36×48 | ~18 | `/function school/start` | `/function school/clear` |
| Rathaus | 32×32 | ~28 | `/function townhall/start` | `/function townhall/clear` |
| Park | 48×48 | ~12 | `/function park/start` | `/function park/clear` |

### Pack erzeugen (lokal)

```bash
node gameplay/church/generate_church_pack.mjs
node gameplay/stadium/generate_stadium_pack.mjs
node gameplay/school/generate_school_pack.mjs
node gameplay/townhall/generate_townhall_pack.mjs
node gameplay/park/generate_park_pack.mjs
```

### Deploy (je Pack, startet den Server neu)

```bash
./gameplay/church/deploy_church_pack.sh minecraft
./gameplay/stadium/deploy_stadium_pack.sh minecraft
./gameplay/school/deploy_school_pack.sh minecraft
./gameplay/townhall/deploy_townhall_pack.sh minecraft
./gameplay/park/deploy_park_pack.sh minecraft
```

Danach ggf. neu joinen. **In der Nähe bleiben**, bis Chat «Fertig.» meldet (Stadion dauert länger).

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

## Schneller fliegen (Kreativmodus)

Im Kreativmodus: fliegen starten (Springen doppeltippen), dann **Sprint halten** — das ist der eingebaute Flug-Turbo. Auf dem Controller oft dieselbe Taste wie Sprint am Boden (z. B. linken Stick drücken).

Noch schneller erkunden: Zuschauermodus (`/gamemode spectator`), zurück mit `/gamemode creative`.

Optional Speed-Effekt (Operator) — erhöht vor allem die Geschwindigkeit **am Boden**; im Flug oft schwächer als Sprint:

```
/effect @s speed 99999 5 true
```

- `99999` = Dauer in Sekunden  
- `5` = Stufe (höher = schneller)  
- `true` = Partikel ausblenden  

Entfernen: `/effect @s clear`
