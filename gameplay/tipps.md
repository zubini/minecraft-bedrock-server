# Tipps (Spiel / Bauen)

Gameplay-Hinweise für den Bedrock-Server — getrennt von Installation und Server-Konfiguration (siehe Root-[`README.md`](../README.md)).

Skripte und Packs liegen unter [`gameplay/city/`](city/).

## Prozedurale Stadt (`city_gen`)

Behavior Pack baut eine ~160×160-Hochhauslandschaft mit Strassen **relativ zu deinem Standpunkt** (SW-Ecke).

### Voraussetzungen

- Operator-Rechte
- Pack erzeugt und auf den Server deployed

### Pack erzeugen (lokal)

```bash
node gameplay/city/generate_city_pack.mjs --seed 42
# optional: --size 160 --min-height 60 --max-height 90
# Häuser: pro Turm zufällig 10×10 oder 12×12 Grundfläche (Parzelle --lot, Default 13)
```

Anderer Look: anderen `--seed` wählen und erneut erzeugen.

### Deploy

```bash
./gameplay/city/deploy_city_pack.sh minecraft
```

Startet den Server-Dienst neu. Danach ggf. neu joinen.

### Bauen

1. Einstellungen → Koordinaten anzeigen
2. An die **Süd-West-Ecke** der geplanten Fläche stellen (Bodenhöhe = unterste Etage)
3. Chat:

```
/function city_gen/start
```

Der Lauf ist bei 160×160 und hohen Türmen bewusst langsam. Chat-Meldungen zeigen den Fortschritt.

### Rückgängig

Gleicher Standpunkt wie beim Bauen:

```
/function city_gen/clear
```

Entfernt das Bauvolumen (Luft + Bodenschicht Gras). Stellt vorheriges Terrain nicht wieder her.

### Seed neu ausprobieren

1. `/function city_gen/clear`
2. Lokal `node gameplay/city/generate_city_pack.mjs --seed <neu>`
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
