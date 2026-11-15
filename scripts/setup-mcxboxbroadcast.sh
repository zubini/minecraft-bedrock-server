#!/usr/bin/env bash
# Optional setup for MCXboxBroadcast (Xbox Live friends session → Bedrock).
# Independent of scripts/provision.sh – install only when needed (e.g. Nintendo Switch).
# Idempotent: existing config.env / config.yml are not overwritten.
#
# Usage:
#   BROADCAST_IP=203.0.113.10 ./scripts/setup-mcxboxbroadcast.sh user@host
#   sudo BROADCAST_IP=203.0.113.10 ./scripts/setup-mcxboxbroadcast.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REMOTE_DIR="${REMOTE_DIR:-/tmp/minecraft-bedrock-server}"

JAR_NAME="MCXboxBroadcastStandalone.jar"
JAR_URL="https://github.com/MCXboxBroadcast/Broadcaster/releases/latest/download/${JAR_NAME}"
GITHUB_API="https://api.github.com/repos/MCXboxBroadcast/Broadcaster/releases/latest"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  echo "[*] $*"
}

usage() {
  cat <<EOF
Usage:
  BROADCAST_IP=<public-ip-or-host> $0 user@host   # from your PC (ssh + rsync)
  sudo BROADCAST_IP=<public-ip-or-host> $0        # on the Debian server

Optional env:
  BROADCAST_PORT=19132
  REMOTE_DIR=/path/on/server   (remote mode only)

BROADCAST_IP is required on first install (when config.yml does not exist yet).
Existing /etc/mcxboxbroadcast/config.env and INSTALL_DIR/config.yml are left unchanged.
EOF
}

require_repo_layout() {
  if [[ ! -f "${REPO_ROOT}/config/mcxboxbroadcast.env.example" ]] \
    || [[ ! -f "${REPO_ROOT}/config/mcxboxbroadcast.config.yml.example" ]] \
    || [[ ! -f "${REPO_ROOT}/systemd/mcxboxbroadcast.service" ]]; then
    die "Run setup-mcxboxbroadcast.sh from the project directory."
  fi
}

# --- Remote mode (local PC → server) -----------------------------------------

provision_remote() {
  local target="$1"
  local remote_ip remote_port

  command -v ssh >/dev/null || die "ssh not found"
  command -v rsync >/dev/null || die "rsync not found"
  require_repo_layout

  remote_ip="${BROADCAST_IP:-}"
  remote_port="${BROADCAST_PORT:-}"

  log "Target: $target"
  log "Remote dir: $REMOTE_DIR"

  log "Ensuring rsync on remote host …"
  ssh -t -o StrictHostKeyChecking=accept-new "$target" \
    "command -v rsync >/dev/null || if [ \"\$(id -u)\" -eq 0 ]; then apt-get update -y && apt-get install -y rsync; else sudo apt-get update -y && sudo apt-get install -y rsync; fi"

  log "Syncing project …"
  ssh -o StrictHostKeyChecking=accept-new "$target" \
    "mkdir -p $(printf '%q' "$REMOTE_DIR")"

  rsync -az --delete \
    --exclude '.git/' \
    --exclude '.DS_Store' \
    --exclude '*.swp' \
    -e "ssh -o StrictHostKeyChecking=accept-new" \
    "${REPO_ROOT}/" \
    "${target}:${REMOTE_DIR}/"

  log "Running MCXboxBroadcast setup on remote host …"
  # Pass through IP/port so first-time config.yml can be generated remotely.
  local env_prefix=""
  [[ -n "$remote_ip" ]] && env_prefix+="BROADCAST_IP=$(printf '%q' "$remote_ip") "
  [[ -n "$remote_port" ]] && env_prefix+="BROADCAST_PORT=$(printf '%q' "$remote_port") "

  ssh -t -o StrictHostKeyChecking=accept-new "$target" \
    "cd $(printf '%q' "$REMOTE_DIR") && \
     if [ \"\$(id -u)\" -eq 0 ]; then \
       ${env_prefix}./scripts/setup-mcxboxbroadcast.sh; \
     else \
       sudo ${env_prefix}./scripts/setup-mcxboxbroadcast.sh; \
     fi"

  log "Done."
}

# --- Local mode (on the Debian server) ---------------------------------------

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    die "Please run as root: sudo BROADCAST_IP=… $0"
  fi
}

require_debian() {
  if [[ ! -f /etc/debian_version ]]; then
    die "This script targets Debian (/etc/debian_version missing)."
  fi
}

install_packages() {
  log "Installing dependencies …"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends \
    ca-certificates \
    curl

  # Debian 12: openjdk-17; Debian 13+: often 21/25 only – need Java >= 17
  if ! command -v java >/dev/null; then
    if apt-get install -y --no-install-recommends openjdk-17-jre-headless; then
      :
    elif apt-get install -y --no-install-recommends openjdk-21-jre-headless; then
      log "Note: openjdk-17 not available – installed openjdk-21-jre-headless."
    elif apt-get install -y --no-install-recommends default-jre-headless; then
      log "Note: installed default-jre-headless (need Java >= 17)."
    else
      die "Could not install a Java runtime (need Java >= 17)."
    fi
  else
    log "Java already present: $(java -version 2>&1 | head -n1)"
  fi

  command -v java >/dev/null || die "java not found after package install."
  if ! java -version 2>&1 | head -n1 | grep -Eq 'version "(1[7-9]|[2-9][0-9])'; then
    die "Java >= 17 required (found: $(java -version 2>&1 | head -n1))."
  fi
  [[ -x /usr/bin/java ]] || die "/usr/bin/java missing (systemd unit expects it)."
}

install_config_env() {
  local dest="/etc/mcxboxbroadcast/config.env"
  local src="${REPO_ROOT}/config/mcxboxbroadcast.env.example"
  mkdir -p /etc/mcxboxbroadcast
  if [[ ! -f "$dest" ]]; then
    log "Copying config to $dest …"
    cp "$src" "$dest"
    chmod 644 "$dest"
  else
    log "Config $dest already exists – leaving unchanged."
  fi
}

# Apply CLI BROADCAST_IP/PORT into config.env before first config.yml write.
persist_broadcast_overrides() {
  local dest="/etc/mcxboxbroadcast/config.env"

  if [[ -f "${INSTALL_DIR}/config.yml" ]]; then
    return 0
  fi

  if [[ -n "${BROADCAST_IP:-}" ]]; then
    if grep -q '^BROADCAST_IP=' "$dest"; then
      sed -i "s|^BROADCAST_IP=.*|BROADCAST_IP=$(printf '%s' "$BROADCAST_IP" | sed 's/[&|\\]/\\&/g')|" "$dest"
    else
      echo "BROADCAST_IP=${BROADCAST_IP}" >>"$dest"
    fi
  fi
  if [[ -n "${BROADCAST_PORT:-}" ]]; then
    if grep -q '^BROADCAST_PORT=' "$dest"; then
      sed -i "s|^BROADCAST_PORT=.*|BROADCAST_PORT=${BROADCAST_PORT}|" "$dest"
    else
      echo "BROADCAST_PORT=${BROADCAST_PORT}" >>"$dest"
    fi
  fi
}

load_config() {
  local dest="/etc/mcxboxbroadcast/config.env"
  # CLI/env wins over file for this run (first install)
  local cli_ip="${BROADCAST_IP:-}"
  local cli_port="${BROADCAST_PORT:-}"

  # shellcheck source=/dev/null
  source "$dest"

  INSTALL_DIR="${INSTALL_DIR:-/opt/mcxboxbroadcast}"
  SERVICE_USER="${SERVICE_USER:-minecraft}"
  SERVICE_NAME="${SERVICE_NAME:-mcxboxbroadcast}"
  HOST_NAME="${HOST_NAME:-Minecraft Server}"
  WORLD_NAME="${WORLD_NAME:-Bedrock}"
  MAX_PLAYERS="${MAX_PLAYERS:-10}"

  [[ -n "$cli_ip" ]] && BROADCAST_IP="$cli_ip"
  [[ -n "$cli_port" ]] && BROADCAST_PORT="$cli_port"
  BROADCAST_PORT="${BROADCAST_PORT:-19132}"
}

ensure_user() {
  local user="$SERVICE_USER"
  if ! id "$user" &>/dev/null; then
    log "Creating system user '$user' …"
    useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$user"
  else
    log "User '$user' already exists."
  fi
}

ensure_dirs() {
  log "Creating directories …"
  mkdir -p "$INSTALL_DIR"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$INSTALL_DIR"
}

install_config_yml() {
  local dest="${INSTALL_DIR}/config.yml"
  local src="${REPO_ROOT}/config/mcxboxbroadcast.config.yml.example"
  local ip port host world maxp
  local tmp

  if [[ -f "$dest" ]]; then
    log "Config $dest already exists – leaving unchanged."
    return 0
  fi

  ip="${BROADCAST_IP:-}"
  port="${BROADCAST_PORT:-19132}"
  host="${HOST_NAME:-Minecraft Server}"
  world="${WORLD_NAME:-Bedrock}"
  maxp="${MAX_PLAYERS:-10}"

  if [[ -z "$ip" ]]; then
    die "BROADCAST_IP is required on first install. Example: sudo BROADCAST_IP=203.0.113.10 $0"
  fi

  log "Writing $dest (remote-address=$ip port=$port) …"
  tmp="$(mktemp)"
  # Escape & \ for sed replacement; use | as delimiter
  sed \
    -e "s|__BROADCAST_IP__|$(printf '%s' "$ip" | sed 's/[&|\\]/\\&/g')|g" \
    -e "s|__BROADCAST_PORT__|${port}|g" \
    -e "s|__HOST_NAME__|$(printf '%s' "$host" | sed 's/[&|\\]/\\&/g')|g" \
    -e "s|__WORLD_NAME__|$(printf '%s' "$world" | sed 's/[&|\\]/\\&/g')|g" \
    -e "s|__MAX_PLAYERS__|${maxp}|g" \
    "$src" >"$tmp"
  install -m 644 -o "$SERVICE_USER" -g "$SERVICE_USER" "$tmp" "$dest"
  rm -f "$tmp"
}

download_jar() {
  local dest="${INSTALL_DIR}/${JAR_NAME}"
  local tmp tag=""

  log "Downloading latest ${JAR_NAME} …"
  tmp="$(mktemp)"
  if ! curl -fsSL --retry 3 --retry-delay 2 -o "$tmp" "$JAR_URL"; then
    rm -f "$tmp"
    die "Failed to download ${JAR_URL}"
  fi

  if command -v jq >/dev/null && tag="$(curl -fsSL "$GITHUB_API" 2>/dev/null | jq -r '.tag_name // empty')"; then
    :
  fi
  if [[ -n "$tag" && "$tag" != "null" ]]; then
    printf '%s\n' "$tag" >"${INSTALL_DIR}/VERSION"
  else
    date -u +%Y-%m-%dT%H:%M:%SZ >"${INSTALL_DIR}/VERSION"
  fi

  install -m 644 -o "$SERVICE_USER" -g "$SERVICE_USER" "$tmp" "$dest"
  rm -f "$tmp"
  chown "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}/VERSION"
  log "Installed ${dest} (release $(tr -d '\n' <"${INSTALL_DIR}/VERSION"))."
}

install_systemd() {
  local unit_src="${REPO_ROOT}/systemd/mcxboxbroadcast.service"
  local unit_dest="/etc/systemd/system/mcxboxbroadcast.service"

  log "Installing systemd unit …"
  install -m 644 "$unit_src" "$unit_dest"

  if [[ "$SERVICE_USER" != "minecraft" ]]; then
    sed -i "s/^User=minecraft$/User=${SERVICE_USER}/" "$unit_dest"
    sed -i "s/^Group=minecraft$/Group=${SERVICE_USER}/" "$unit_dest"
  fi
  if [[ "$INSTALL_DIR" != "/opt/mcxboxbroadcast" ]]; then
    sed -i "s|/opt/mcxboxbroadcast|${INSTALL_DIR}|g" "$unit_dest"
  fi

  systemctl daemon-reload
  systemctl enable mcxboxbroadcast.service
  systemctl restart mcxboxbroadcast.service
}

print_status() {
  echo
  echo "=== MCXboxBroadcast setup complete ==="
  echo "Install directory: $INSTALL_DIR"
  echo "Config env:        /etc/mcxboxbroadcast/config.env"
  echo "Config yml:        ${INSTALL_DIR}/config.yml"
  echo "Target:            ${BROADCAST_IP:-"(see config.yml)"}:${BROADCAST_PORT:-19132}"
  echo
  echo "Service status:"
  systemctl --no-pager --full status "${SERVICE_NAME}.service" || true
  echo
  echo "=== Next steps (one-time Xbox auth) ==="
  echo "1. Watch logs for the device code:"
  echo "     journalctl -u ${SERVICE_NAME} -f"
  echo "2. Open https://www.microsoft.com/link and sign in with an ALT Xbox account"
  echo "   (do not use your main account – see upstream ToS disclaimer)."
  echo "3. On Switch: add the bot gamertag as a friend → Play → Friends/Worlds → join."
  echo "4. If allow-list is enabled on Bedrock, add Switch gamertags to allowlist.json."
  echo
  echo "Upstream: https://github.com/MCXboxBroadcast/Broadcaster"
  echo "Switch cannot enter a server IP; this tool only automates the friends workaround."
}

provision_local() {
  require_root
  require_debian
  require_repo_layout

  install_packages
  install_config_env
  load_config
  persist_broadcast_overrides
  # Reload so persisted values are visible in print_status
  load_config
  ensure_user
  ensure_dirs
  install_config_yml
  download_jar
  install_systemd
  print_status
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  if [[ $# -ge 1 && "$1" == *@* ]]; then
    provision_remote "$1"
  elif [[ $# -ge 1 ]]; then
    usage
    die "Unexpected argument: $1 (use user@host for remote setup)"
  else
    provision_local
  fi
}

main "$@"
