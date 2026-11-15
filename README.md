# Minecraft Bedrock Server auf Debian

Installation und Auto-Update für einen [Minecraft Bedrock Dedicated Server](https://www.minecraft.net/de-de/download/server/bedrock) auf Debian (x86_64).

- Einrichtung des Servers per Provisioning-Skript
- Täglich um **04:00**: Versionscheck
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

Der Bedrock-Server lauscht standardmäßig auf **UDP 19132** (optional **UDP 19133** für IPv6). Diesen Port in der Firewall bzw. beim Hosting-Provider freigeben, sonst sind keine Verbindungen von außen möglich.

Zusätzlich empfohlen: Allowlist in `/opt/minecraft-bedrock/allowlist.json` bzw. `server.properties` nutzen, statt den Server offen für alle zu lassen.

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
| `BACKUP_KEEP` | `3` | Anzahl behaltener Welt-Backups |
| `INSTALL_DIR` | `/opt/minecraft-bedrock` | Installationsverzeichnis |
| `BACKUP_DIR` | `/opt/minecraft-bedrock/backups` | Backup-Verzeichnis |

Spiel-Einstellungen (`server.properties`, Allowlist, …) unter `/opt/minecraft-bedrock/` bleiben bei Updates erhalten.

## Update & Weltschutz

Bei neuer Version: ZIP laden → stoppen → Welt sichern (verifiziert) → installieren → starten.  
`worlds/` wird nie überschrieben. Schlägt das Backup fehl, bricht das Update ab. Bei Fehler nach dem Stop startet der Service automatisch wieder.

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
