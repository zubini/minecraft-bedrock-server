# Tipps (Spiel / Bauen)

Gameplay-Hinweise für den Bedrock-Server — getrennt von Installation und Server-Konfiguration (siehe Root-[`README.md`](../README.md)).

Skripte und Packs liegen unter [`gameplay/city/`](city/).

## Prozedurale Stadt (`city_gen`)

Behavior Pack baut eine Hochhauslandschaft mit Strassen ab deinem Standpunkt (nach Osten und Süden).  
Mehrere Varianten: `city_gen_1` … `city_gen_5` (verschiedene Seeds).

### Voraussetzungen

- Operator-Rechte
- Pack erzeugt und auf den Server deployed

### Pack erzeugen (lokal)

```bash
# 80×80, 4×4 Hochhäuser, 5 Varianten (Default)
node gameplay/city/generate_city_pack.mjs --seed 42
node gameplay/city/generate_city_pack.mjs --seed 42 --variants 5
```

### Deploy

```bash
./gameplay/city/deploy_city_pack.sh minecraft
```

Startet den Server neu. Danach ggf. neu joinen.

### Bauen

1. Koordinaten anzeigen  
2. An die Ecke stellen, wo **X und Z am kleinsten** sein sollen (Nordwest-Ecke)  
3. Freie Fläche muss nach **Osten** (X wird grösser) und **Süden** (Z wird grösser) liegen  
4. Chat – eine Variante wählen:

```
/function city_gen_1/start
/function city_gen_2/start
/function city_gen_3/start
/function city_gen_4/start
/function city_gen_5/start
```

Kurzform (Variante 1): `/function city_gen/start`

Bau läuft **über mehrere Sekunden** (Chat: „Fertig.“ abwarten).  
**In der Nähe bleiben**, bis es fertig ist (sonst stoppen die Chunks).

### Rückgängig

```
/function city_gen_1/clear
```

(gleiche Nummer wie beim Start; Kurzform: `/function city_gen/clear`)

Clear ebenfalls über mehrere Sekunden („Clear fertig.“), in der Nähe bleiben.

### Seed / mehr Varianten

1. Clear der gebauten Variante  
2. Lokal `node gameplay/city/generate_city_pack.mjs --seed <neu> [--variants 5]`  
3. `./gameplay/city/deploy_city_pack.sh minecraft`  
4. `/function city_gen_N/start`

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
