#!/usr/bin/env bash
# Checks for new Minecraft Bedrock server versions and updates when needed.
# Stop, backup, download and restart only for a new version (or --force).
set -euo pipefail

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    --help|-h)
      echo "Usage: $0 [--force]"
      echo "  --force  Force update (initial install / manual reinstall)"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

CONFIG_FILE="${CONFIG_FILE:-/etc/minecraft-bedrock/config.env}"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi

INSTALL_DIR="${INSTALL_DIR:-/opt/minecraft-bedrock}"
BACKUP_DIR="${BACKUP_DIR:-${INSTALL_DIR}/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-3}"
SERVICE_NAME="${SERVICE_NAME:-minecraft-bedrock}"
SERVICE_USER="${SERVICE_USER:-minecraft}"
DOWNLOAD_LINKS_API="${DOWNLOAD_LINKS_API:-https://net-secondary.web.minecraft-services.net/api/v1.0/download/links}"
DOWNLOAD_TYPE="${DOWNLOAD_TYPE:-serverBedrockLinux}"
UPDATE_LOG="${UPDATE_LOG:-/var/log/minecraft-bedrock/update.log}"
VERSION_FILE="${INSTALL_DIR}/VERSION"
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"
NOTIFY_FROM="${NOTIFY_FROM:-minecraft-bedrock@$(hostname -f 2>/dev/null || hostname)}"
USER_AGENT="Mozilla/5.0 (compatible; MinecraftBedrockUpdater/1.0)"

# Restart after a failed update post-stop; clean up temp dirs
SERVER_NEEDS_RESTART=0
TEMP_DIRS=()
LAST_BACKUP_ARCHIVE=""

PRESERVE_FILES=(
  server.properties
  permissions.json
  allowlist.json
  whitelist.json
  valid_known_packs.json
)

# Directories never overwritten from the ZIP when they already exist (user data)
PROTECTED_DIRS=(
  worlds
  backups
  bin
  resource_packs
  behavior_packs
)

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  if [[ -d "$(dirname "$UPDATE_LOG")" ]] || mkdir -p "$(dirname "$UPDATE_LOG")" 2>/dev/null; then
    echo "$msg" >>"$UPDATE_LOG" 2>/dev/null || true
  fi
}

die() {
  log "ERROR: $*"
  exit 1
}

# Send mail after a successful update. No-op if NOTIFY_EMAIL is empty.
notify_update() {
  local old_ver="$1"
  local new_ver="$2"
  local subject body host

  [[ -n "$NOTIFY_EMAIL" ]] || return 0

  host="$(hostname -f 2>/dev/null || hostname)"
  subject="Minecraft Bedrock: Update auf ${new_ver} (${host})"
  body="$(cat <<EOF
Der Minecraft-Bedrock-Server auf ${host} wurde aktualisiert.

Vorher:  ${old_ver:-<keine>}
Neu:     ${new_ver}
Backup:  ${LAST_BACKUP_ARCHIVE:-keines}
Zeit:    $(date '+%Y-%m-%d %H:%M:%S %Z')
EOF
)"

  if command -v mail >/dev/null 2>&1; then
    if printf '%s\n' "$body" | mail -r "$NOTIFY_FROM" -s "$subject" "$NOTIFY_EMAIL"; then
      log "Notification sent to $NOTIFY_EMAIL"
    else
      log "WARNING: mail to $NOTIFY_EMAIL failed (mail exit $?)."
    fi
    return 0
  fi

  if command -v sendmail >/dev/null 2>&1; then
    if sendmail -t <<EOF
From: ${NOTIFY_FROM}
To: ${NOTIFY_EMAIL}
Subject: ${subject}

${body}
EOF
    then
      log "Notification sent to $NOTIFY_EMAIL"
    else
      log "WARNING: sendmail to $NOTIFY_EMAIL failed."
    fi
    return 0
  fi

  log "WARNING: NOTIFY_EMAIL is set but neither mail nor sendmail is available – skipping notification."
}

on_exit() {
  local ec=$?
  local d
  for d in "${TEMP_DIRS[@]:-}"; do
    rm -rf "$d"
  done
  if [[ "$SERVER_NEEDS_RESTART" -eq 1 ]]; then
    log "Failure after server stop – restarting $SERVICE_NAME …"
    systemctl start "$SERVICE_NAME" 2>/dev/null || true
  fi
  exit "$ec"
}
trap on_exit EXIT

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    die "Please run as root (sudo)."
  fi
}

make_temp_dir() {
  local d
  d="$(mktemp -d)"
  TEMP_DIRS+=("$d")
  echo "$d"
}

fetch_latest() {
  local json url version
  json="$(curl -fsSL -A "$USER_AGENT" "$DOWNLOAD_LINKS_API")" \
    || die "Download links API unreachable: $DOWNLOAD_LINKS_API"

  # Avoid "| head" (pipefail/SIGPIPE); take first match via jq
  url="$(echo "$json" | jq -r --arg t "$DOWNLOAD_TYPE" \
    '([.result.links[]? | select(.downloadType == $t) | .downloadUrl] | first) // empty')"

  if [[ -z "$url" || "$url" == "null" ]]; then
    die "No download link found for type '$DOWNLOAD_TYPE'."
  fi

  version="$(basename "$url" | sed -n 's/^bedrock-server-\(.*\)\.zip$/\1/p')"
  if [[ -z "$version" ]]; then
    die "Could not parse version from URL: $url"
  fi

  LATEST_URL="$url"
  LATEST_VERSION="$version"
}

current_version() {
  if [[ -f "$VERSION_FILE" ]]; then
    tr -d '[:space:]' <"$VERSION_FILE"
  else
    echo ""
  fi
}

service_is_active() {
  systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null
}

stop_server() {
  if service_is_active; then
    log "Stopping service $SERVICE_NAME …"
    systemctl stop "$SERVICE_NAME"
  else
    log "Service $SERVICE_NAME is not active."
  fi
}

start_server() {
  log "Starting service $SERVICE_NAME …"
  systemctl start "$SERVICE_NAME"
}

worlds_present() {
  local worlds_dir="${INSTALL_DIR}/worlds"
  [[ -d "$worlds_dir" ]] && [[ -n "$(ls -A "$worlds_dir" 2>/dev/null || true)" ]]
}

verify_backup_archive() {
  local archive="$1"
  local size listing

  [[ -f "$archive" ]] || die "Backup file missing: $archive"
  size="$(stat -c '%s' "$archive" 2>/dev/null || stat -f '%z' "$archive")"
  if [[ -z "$size" || ! "$size" =~ ^[0-9]+$ || "$size" -lt 100 ]]; then
    die "Backup file is too small/empty: $archive ($size bytes)"
  fi

  listing="$(tar -tzf "$archive" 2>/dev/null || true)"
  if [[ -z "$listing" ]]; then
    die "Backup archive is not readable: $archive"
  fi
  if ! echo "$listing" | grep -q '^worlds/'; then
    die "Backup does not contain worlds/: $archive"
  fi
  log "Backup verified: $archive (${size} bytes)"
}

prune_old_backups() {
  local keep="${BACKUP_KEEP}"
  if [[ ! "$keep" =~ ^[0-9]+$ ]] || [[ "$keep" -le 0 ]]; then
    return 0
  fi
  mapfile -t old_backups < <(ls -1t "$BACKUP_DIR"/worlds-*.tar.gz 2>/dev/null || true)
  if [[ ${#old_backups[@]} -gt "$keep" ]]; then
    local i
    for ((i = keep; i < ${#old_backups[@]}; i++)); do
      log "Removing old backup: ${old_backups[$i]}"
      rm -f "${old_backups[$i]}"
    done
  fi
}

# Create and verify a world backup. On failure → no update.
# Live world under INSTALL_DIR/worlds is not modified.
backup_worlds() {
  local stamp old_ver archive

  mkdir -p "$BACKUP_DIR"

  if ! worlds_present; then
    log "No worlds/ directory to back up – skipping backup."
    LAST_BACKUP_ARCHIVE=""
    return 0
  fi

  stamp="$(date '+%Y%m%d-%H%M%S')"
  old_ver="$(current_version)"
  [[ -z "$old_ver" ]] && old_ver="unknown"
  archive="${BACKUP_DIR}/worlds-${stamp}-v${old_ver}.tar.gz"

  log "Creating world backup: $archive"
  tar -czf "$archive" -C "$INSTALL_DIR" worlds \
    || die "World backup failed – update aborted, live world unchanged."

  verify_backup_archive "$archive"
  LAST_BACKUP_ARCHIVE="$archive"
}

preserve_configs() {
  local preserve_root="$1"
  mkdir -p "$preserve_root"

  local f
  for f in "${PRESERVE_FILES[@]}"; do
    if [[ -e "${INSTALL_DIR}/${f}" ]]; then
      cp -a "${INSTALL_DIR}/${f}" "$preserve_root/"
    fi
  done
}

restore_configs() {
  local preserve_root="$1"
  local f
  for f in "${PRESERVE_FILES[@]}"; do
    if [[ -e "${preserve_root}/${f}" ]]; then
      cp -a "${preserve_root}/${f}" "${INSTALL_DIR}/"
    fi
  done
}

is_protected_dir() {
  local name="$1"
  local p
  for p in "${PROTECTED_DIRS[@]}"; do
    if [[ "$name" == "$p" ]]; then
      return 0
    fi
  done
  return 1
}

# Extract a response header value (case-insensitive), trimmed.
# Uses the last match (final hop after redirects).
header_value() {
  local file="$1" name="$2"
  awk -v key="$name" '
    BEGIN { IGNORECASE = 1 }
    tolower($0) ~ ("^" tolower(key) ":") {
      sub(/^[^:]*:[[:space:]]*/, "")
      sub(/\r$/, "")
      val = $0
    }
    END { if (val != "") print val }
  ' "$file"
}

# Verify ZIP against Mojang/Azure CDN headers (Content-MD5 + Content-Length).
# Mojang does not publish a separate SHA manifest; Content-MD5 is the official blob checksum.
verify_download() {
  local dest="$1"
  local hdr_file="$2"
  local expected_md5 expected_len actual_md5 actual_len

  [[ -s "$dest" ]] || die "Download is empty: $dest"

  expected_len="$(header_value "$hdr_file" "content-length")"
  actual_len="$(stat -c '%s' "$dest" 2>/dev/null || stat -f '%z' "$dest")"
  if [[ -n "$expected_len" && "$expected_len" =~ ^[0-9]+$ ]]; then
    if [[ "$actual_len" != "$expected_len" ]]; then
      die "Download size mismatch (expected ${expected_len}, got ${actual_len})"
    fi
  fi

  expected_md5="$(header_value "$hdr_file" "content-md5")"
  if [[ -z "$expected_md5" ]]; then
    die "CDN response missing Content-MD5 – refusing to install unverified download."
  fi

  command -v openssl >/dev/null || die "openssl required for download checksum verification"
  actual_md5="$(openssl dgst -md5 -binary "$dest" | base64)"
  if [[ "$actual_md5" != "$expected_md5" ]]; then
    die "Download Content-MD5 mismatch (expected ${expected_md5}, got ${actual_md5})"
  fi

  log "Download verified (Content-MD5=${expected_md5}, size=${actual_len})"
}

# Download ZIP while the server can keep running (shorter downtime).
download_zip() {
  local url="$1"
  local dest="$2"
  local hdr_file

  hdr_file="$(make_temp_dir)/download.headers"
  log "Downloading $url …"
  curl -fL -A "$USER_AGENT" -D "$hdr_file" -o "$dest" "$url" \
    || die "Download failed: $url"

  verify_download "$dest" "$hdr_file"
}

install_from_zip() {
  local zip_path="$1"
  local version="$2"
  local tmp dir preserve_root

  tmp="$(make_temp_dir)"
  dir="${tmp}/extract"
  preserve_root="${tmp}/preserve"
  mkdir -p "$dir" "$preserve_root"

  log "Extracting ZIP …"
  unzip -q -o "$zip_path" -d "$dir"

  if [[ ! -f "${dir}/bedrock_server" ]]; then
    die "ZIP does not contain bedrock_server binary."
  fi

  mkdir -p "$INSTALL_DIR"
  # IMPORTANT: worlds/ and other user data are not touched.
  preserve_configs "$preserve_root"

  shopt -s dotglob nullglob
  for item in "$dir"/*; do
    local base
    base="$(basename "$item")"

    if is_protected_dir "$base"; then
      # Keep existing user data; only create from ZIP if missing
      if [[ -e "${INSTALL_DIR}/${base}" ]]; then
        continue
      fi
    fi

    case "$base" in
      VERSION) continue ;;
      server.properties|permissions.json|allowlist.json|whitelist.json|valid_known_packs.json)
        if [[ -e "${preserve_root}/${base}" ]]; then
          continue
        fi
        ;;
    esac

    rm -rf "${INSTALL_DIR}/${base}"
    cp -a "$item" "${INSTALL_DIR}/"
  done
  shopt -u dotglob nullglob

  restore_configs "$preserve_root"

  if [[ -n "${LAST_BACKUP_ARCHIVE:-}" ]] && ! worlds_present; then
    die "World missing after install – aborting. Restore manually from: $LAST_BACKUP_ARCHIVE"
  fi

  chmod +x "${INSTALL_DIR}/bedrock_server"
  echo "$version" >"$VERSION_FILE"

  if id "$SERVICE_USER" &>/dev/null; then
    chown -R "${SERVICE_USER}:${SERVICE_USER}" "$INSTALL_DIR"
  fi

  log "Version $version installed in $INSTALL_DIR"
}

main() {
  require_root
  mkdir -p "$(dirname "$UPDATE_LOG")" "$BACKUP_DIR" "$INSTALL_DIR"

  log "Update check started (force=$FORCE)"
  fetch_latest
  local installed
  installed="$(current_version)"

  log "Installed: ${installed:-<none>} | Available: $LATEST_VERSION"

  if [[ "$FORCE" -eq 0 && -n "$installed" && "$installed" == "$LATEST_VERSION" ]]; then
    log "Already up to date – no stop, no backup, no download."
    exit 0
  fi

  if [[ "$FORCE" -eq 1 && -n "$installed" && "$installed" == "$LATEST_VERSION" ]]; then
    log "--force: reinstalling $LATEST_VERSION"
  else
    log "New version detected – performing update."
  fi

  # 1) Download first (server keeps running)
  local dl_dir zip_path
  dl_dir="$(make_temp_dir)"
  zip_path="${dl_dir}/bedrock-server.zip"
  download_zip "$LATEST_URL" "$zip_path"

  # 2) Stop → backup → install → start
  stop_server
  SERVER_NEEDS_RESTART=1

  backup_worlds
  install_from_zip "$zip_path" "$LATEST_VERSION"
  prune_old_backups

  SERVER_NEEDS_RESTART=0
  start_server
  log "Update to $LATEST_VERSION completed."
  notify_update "$installed" "$LATEST_VERSION"
}

main
