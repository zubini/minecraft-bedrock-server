# Minecraft Bedrock Server auf Debian

Installation und Auto-Update für einen [Minecraft Bedrock Dedicated Server](https://www.minecraft.net/de-de/download/server/bedrock) auf Debian (x86_64).

- Einrichtung des Servers per Provisioning-Skript
- Täglich um **04:00** (Europe/Zurich): Versionscheck
- Update **nur bei neuer Version** (inkl. Welt-Backup)
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

Lokal auf dem Server nur SSH und Minecraft freigeben:

```bash
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH          # SSH bleibt erreichbar (Port 22)
# Falls SSH nicht auf Port 22 läuft, stattdessen z. B.:
# sudo ufw allow 2222/tcp
sudo ufw allow 19132/udp        # Minecraft Bedrock
# optional IPv6:
# sudo ufw allow 19133/udp
sudo ufw enable
sudo ufw status
```

**Wichtig:** Zuerst die SSH-Regel setzen, erst dann `ufw enable` — sonst droht Aussperrung.  
Das Provisioning aktiviert die Firewall bewusst **nicht** automatisch.

Der systemd-Service nutzt minimale Härtung (`NoNewPrivileges`, `PrivateTmp`, `ProtectHome`, …) ohne den Spielbetrieb einzuschränken.

Beim Hosting-Provider ggf. dieselben Ports zusätzlich freigeben (Security Group / Cloud-Firewall).

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

## Konfiguration

`/etc/minecraft-bedrock/config.env` (Vorlage: [`config/config.env.example`](config/config.env.example))

| Variable | Default | Bedeutung |
|----------|---------|-----------|
| `TIMEZONE` | `Europe/Zurich` | System-Zeitzone (Update-Timer 04:00 lokal) |
| `BACKUP_KEEP` | `3` | Anzahl behaltener Welt-Backups |
| `INSTALL_DIR` | `/opt/minecraft-bedrock` | Installationsverzeichnis |
| `BACKUP_DIR` | `/opt/minecraft-bedrock/backups` | Backup-Verzeichnis |

Spiel-Einstellungen (`server.properties`, Allowlist, …) unter `/opt/minecraft-bedrock/` bleiben bei Updates erhalten.

## Update & Weltschutz

Bei neuer Version: ZIP laden → Checksum prüfen → stoppen → Welt sichern (verifiziert) → installieren → starten.  
`worlds/` wird nie überschrieben. Schlägt das Backup fehl, bricht das Update ab. Bei Fehler nach dem Stop startet der Service automatisch wieder.

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

## Skripte

| Skript | Zweck |
|--------|--------|
| `scripts/provision.sh` | Einrichtung (`user@host` vom PC, sonst auf dem Server) |
| `scripts/update.sh` | Versionscheck + Update (liegt danach unter `/opt/.../bin/`) |
