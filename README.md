# Minecraft Bedrock Server auf Debian

Installation und Auto-Update für einen [Minecraft Bedrock Dedicated Server](https://www.minecraft.net/de-de/download/server/bedrock) auf Debian (x86_64).

- Einrichtung des Servers per Provisioning-Skript
- Täglich um **04:00** (Europe/Zurich): Versionscheck
- Update **nur bei neuer Version** (inkl. Welt-Backup)
- Optional: Nintendo Switch via eigenständiges [MCXboxBroadcast](#nintendo-switch-mcxboxbroadcast)-Setup
- Download = Annahme der [Minecraft EULA](https://minecraft.net/eula)

## Installation

Vom PC (SSH + rsync):

```bash
./scripts/provision.sh user@dein-server
```

Direkt auf dem Server:

```bash
sudo ./scripts/provision.sh
```

## Sicherheit

### Firewall auf Debian (ufw)

Lokal auf dem Server nur SSH und Minecraft freigeben.

Ab BDS **1.26** (NetherNet) reicht UDP 19132 allein nicht mehr: Signaling läuft über **TCP 19132**, Gameplay über festgelegte **UDP-Ports** (`server-udp-ports` in `server.properties`).

```bash
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH          # SSH bleibt erreichbar (Port 22)
# Falls SSH nicht auf Port 22 läuft, stattdessen z. B.:
# sudo ufw allow 2222/tcp
sudo ufw allow 19132/tcp        # NetherNet Signaling
sudo ufw allow 19132:19140/udp  # Gameplay (an server-udp-ports anpassen)
sudo ufw enable
sudo ufw status
```

In `/opt/minecraft-bedrock/server.properties` sollten u. a. stehen:

```properties
transport=nethernet
server-port=19132
server-udp-ports=19132-19140
```

**Wichtig:** Zuerst die SSH-Regel setzen, erst dann `ufw enable` — sonst droht Aussperrung.  
Das Provisioning aktiviert die Firewall bewusst **nicht** automatisch.

Der systemd-Service nutzt minimale Härtung (`NoNewPrivileges`, `PrivateTmp`, `ProtectHome`, …) ohne den Spielbetrieb einzuschränken.

Beim Hosting-Provider dieselben Ports freigeben (Security Group / Cloud-Firewall): **TCP 19132** und **UDP 19132–19140**.

### Allowlist

Zusätzlich zur Firewall: nur erlaubte Spieler lassen joinen.

1. In `/opt/minecraft-bedrock/server.properties`: `allow-list=true`
2. Spieler in `/opt/minecraft-bedrock/allowlist.json` eintragen (nur Namen reichen):

```json
[
  { "name": "Alice" },
  { "name": "Bob" }
]
```

3. `sudo systemctl restart minecraft-bedrock`

Bedrock erwartet dieses JSON-Format (keine reine Textdatei).  
`allowlist.json` und `server.properties` bleiben bei Auto-Updates erhalten.

## Betrieb

Häufige Befehle nach der Installation:

```bash
systemctl is-active minecraft-bedrock            # active = läuft
sudo systemctl status minecraft-bedrock          # detaillierter Status
journalctl -u minecraft-bedrock -f               # Live-Logs
sudo /opt/minecraft-bedrock/bin/update.sh        # Update manuell prüfen
systemctl list-timers minecraft-bedrock-update.timer  # nächste Auto-Prüfung
```

### NetherNet-Identität (Trust-Dialog)

Unter NetherNet fragt der Client beim ersten Join „Diesem Server vertrauen?“.  
Ohne gespeicherte Identität erzeugt BDS bei **jedem Neustart** einen neuen Schlüssel → der Dialog erscheint immer wieder.

Beim Start speichert der Dienst die Identität automatisch (`serveridentity save` → `keys/server_identity_key.pem`). Der Ordner `keys/` bleibt bei Updates erhalten.

Manuell:

```bash
sudo /opt/minecraft-bedrock/bin/bedrock-cmd.sh serveridentity save
sudo /opt/minecraft-bedrock/bin/bedrock-cmd.sh serveridentity status
ls -l /opt/minecraft-bedrock/keys/server_identity_key.pem
```

Nach dem **ersten** Speichern einmal neu verbinden und vertrauen — danach reichen Restarts ohne erneuten Dialog.

Beliebige Konsolenbefehle (Server muss laufen):

```bash
sudo /opt/minecraft-bedrock/bin/bedrock-cmd.sh say Hallo
sudo /opt/minecraft-bedrock/bin/bedrock-cmd.sh list
```

## Konfiguration

`/etc/minecraft-bedrock/config.env` (Vorlage: [`config/config.env.example`](config/config.env.example))

| Variable | Default | Bedeutung |
|----------|---------|-----------|
| `TIMEZONE` | `Europe/Zurich` | System-Zeitzone (Update-Timer 04:00 lokal) |
| `BACKUP_KEEP` | `3` | Anzahl behaltener Welt-Backups |
| `INSTALL_DIR` | `/opt/minecraft-bedrock` | Installationsverzeichnis |
| `BACKUP_DIR` | `/opt/minecraft-bedrock/backups` | Backup-Verzeichnis |
| `NOTIFY_EMAIL` | (leer / Beispieladresse) | Mail nach erfolgreichem Versions-Update |
| `NOTIFY_FROM` | `minecraft-bedrock@<hostname>` | Absender der Benachrichtigung |

Mail-Versand braucht ein lokales MTA (`mail`/`sendmail`), typisch `msmtp-mta` + `bsd-mailx`, plus `NOTIFY_EMAIL` in `/etc/minecraft-bedrock/config.env` (nicht im Git – nur die auskommentierte Vorlage in `config.env.example`).

Spiel-Einstellungen (`server.properties`, Allowlist, …) und `keys/` (NetherNet-Identität) unter `/opt/minecraft-bedrock/` bleiben bei Updates erhalten.

## Update & Weltschutz

Bei neuer Version: ZIP laden → Checksum prüfen → stoppen → Welt sichern (verifiziert) → installieren → starten → optional Mail (`NOTIFY_EMAIL`).  
`worlds/` wird nie überschrieben. Schlägt das Backup fehl, bricht das Update ab. Bei Fehler nach dem Stop startet der Service automatisch wieder. Keine Mail bei reinem Versionscheck ohne Update.

Der Download wird gegen die CDN-Header **Content-MD5** und **Content-Length** geprüft (Mojang liefert kein separates SHA-Manifest). Bei Abweichung wird nicht installiert.

Backups: `/opt/minecraft-bedrock/backups/worlds-*.tar.gz`

```bash
# Welt wiederherstellen
sudo systemctl stop minecraft-bedrock
sudo rm -rf /opt/minecraft-bedrock/worlds
sudo tar -xzf /opt/minecraft-bedrock/backups/worlds-….tar.gz -C /opt/minecraft-bedrock
sudo chown -R minecraft:minecraft /opt/minecraft-bedrock/worlds
sudo systemctl start minecraft-bedrock
```

## Bestehende Welt übernehmen

1. Installation wie oben  
2. `sudo systemctl stop minecraft-bedrock`  
3. `worlds/` und Configs nach `/opt/minecraft-bedrock/` kopieren  
4. `sudo chown -R minecraft:minecraft /opt/minecraft-bedrock`  
5. `sudo systemctl start minecraft-bedrock`

## Nintendo Switch (MCXboxBroadcast)

Die Switch kann **keine Server-IP eingeben** — nur Featured Servers, Freunde/Welten und Realms.  
[MCXboxBroadcast](https://github.com/MCXboxBroadcast/Broadcaster) listet deinen Bedrock-Server dauerhaft als joinbare Freundes-Welt eines Bot-Xbox-Accounts. Das ist optional und **nicht** Teil von `provision.sh`.

### Setup

```bash
# vom PC – BROADCAST_IP = Host aus user@host (wenn SSH-Host = Minecraft-Adresse)
./scripts/setup-mcxboxbroadcast.sh user@dein-server

# abweichende Spiel-Adresse:
# BROADCAST_IP=andere.example ./scripts/setup-mcxboxbroadcast.sh user@dein-server

# direkt auf dem Server (IP/Host explizit nötig):
sudo BROADCAST_IP=dein-server ./scripts/setup-mcxboxbroadcast.sh
```

Optional: `BROADCAST_PORT=19132` (Default).  
Installiert Java ≥ 17 (OpenJDK 17 oder Fallback 21/`default-jre`), die Standalone-JAR unter `/opt/mcxboxbroadcast/`, `config.yml` und den systemd-Dienst `mcxboxbroadcast`. Bestehende `config.env`/`config.yml` werden nicht überschrieben (JAR wird bei erneutem Lauf aktualisiert).

### Einmalig: Xbox-Login

1. Logs beobachten: `journalctl -u mcxboxbroadcast -f`
2. Code unter https://www.microsoft.com/link mit einem **Alt-Xbox-Account** eingeben (nicht den Hauptaccount — Upstream warnt vor ToS-/Ban-Risiko)
3. Auf der Switch den Bot-Gamertag als Freund hinzufügen → Play → Freunde/Welten → Session joinen
4. Bei aktiver Allowlist Switch-Gamertags in `/opt/minecraft-bedrock/allowlist.json` eintragen

```bash
systemctl status mcxboxbroadcast
journalctl -u mcxboxbroadcast -f
```

Konfiguration: `/etc/mcxboxbroadcast/config.env`, Ziel-IP/Port in `/opt/mcxboxbroadcast/config.yml`.  
Nach Änderungen an `config.yml`: `sudo systemctl restart mcxboxbroadcast`.

## Skripte

| Skript | Zweck |
|--------|--------|
| `scripts/provision.sh` | Einrichtung Bedrock-Server (`user@host` vom PC, sonst auf dem Server) |
| `scripts/setup-mcxboxbroadcast.sh` | Optional: MCXboxBroadcast für Switch/Konsolen (eigenständig) |
| `scripts/update.sh` | Versionscheck + Update (liegt danach unter `/opt/.../bin/`) |

## Gameplay

Bauen, Tipps und Behavior Packs: [`gameplay/tipps.md`](gameplay/tipps.md) (u. a. prozedurale Stadt unter `gameplay/city/`).
