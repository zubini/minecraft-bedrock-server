#!/usr/bin/env bash
# Provisions a Minecraft Bedrock Dedicated Server on Debian.
# Idempotent: existing world and configs are not overwritten.
#
# Usage:
#   ./scripts/provision.sh user@host   # from your PC (ssh + rsync)
#   sudo ./scripts/provision.sh        # on the Debian server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REMOTE_DIR="${REMOTE_DIR:-/tmp/minecraft-bedrock-server}"

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
  $0 user@host          Provision a remote Debian host (ssh + rsync)
  sudo $0               Provision this machine (run on the server)

Optional: REMOTE_DIR=/path/on/server $0 user@host
EOF
}

require_repo_layout() {
  if [[ ! -f "${REPO_ROOT}/config/config.env.example" ]] \
    || [[ ! -f "${REPO_ROOT}/systemd/minecraft-bedrock.service" ]] \
    || [[ ! -f "${REPO_ROOT}/scripts/update.sh" ]]; then
    die "Run provision.sh from the project directory, not from /opt/.../bin/."
  fi
}

# --- Remote mode (local PC → server) -----------------------------------------

provision_remote() {
  local target="$1"

  command -v ssh >/dev/null || die "ssh not found"
  command -v rsync >/dev/null || die "rsync not found"
  require_repo_layout

  log "Target: $target"
  log "Remote dir: $REMOTE_DIR"

  # Remote rsync is required (local rsync talks to a remote rsync process)
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

  log "Running provisioning on remote host …"
  ssh -t -o StrictHostKeyChecking=accept-new "$target" \
    "cd $(printf '%q' "$REMOTE_DIR") && if [ \"\$(id -u)\" -eq 0 ]; then ./scripts/provision.sh; else sudo ./scripts/provision.sh; fi"

  log "Done."
}

# --- Local mode (on the Debian server) ---------------------------------------

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    die "Please run as root: sudo $0"
  fi
}

require_debian() {
  if [[ ! -f /etc/debian_version ]]; then
    die "This script targets Debian (/etc/debian_version missing)."
  fi
  local arch
  arch="$(uname -m)"
  if [[ "$arch" != "x86_64" ]]; then
    die "Minecraft Bedrock Dedicated Server requires x86_64 (found: $arch)."
  fi
}

install_packages() {
  log "Installing dependencies …"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    jq \
    tar \
    gzip

  # Debian 12: libcurl4 / Debian 13+: libcurl4t64 (time64 transition)
  if ! dpkg -s libcurl4 &>/dev/null && ! dpkg -s libcurl4t64 &>/dev/null; then
    apt-get install -y --no-install-recommends libcurl4 \
      || apt-get install -y --no-install-recommends libcurl4t64 \
      || log "Note: could not install libcurl – install manually if needed."
  fi
}

ensure_user() {
  local user="${SERVICE_USER:-minecraft}"
  if ! id "$user" &>/dev/null; then
    log "Creating system user '$user' …"
    useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$user"
  else
    log "User '$user' already exists."
  fi
}

ensure_dirs() {
  log "Creating directories …"
  mkdir -p \
    "$INSTALL_DIR" \
    "$BACKUP_DIR" \
    "${INSTALL_DIR}/bin" \
    /etc/minecraft-bedrock \
    /var/log/minecraft-bedrock

  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$INSTALL_DIR" /var/log/minecraft-bedrock
}

install_config() {
  local dest="/etc/minecraft-bedrock/config.env"
  local src="${REPO_ROOT}/config/config.env.example"
  mkdir -p /etc/minecraft-bedrock
  if [[ ! -f "$dest" ]]; then
    log "Copying config to $dest …"
    cp "$src" "$dest"
    chmod 644 "$dest"
  else
    log "Config $dest already exists – leaving unchanged."
  fi
}

load_config() {
  local dest="/etc/minecraft-bedrock/config.env"
  # shellcheck source=/dev/null
  source "$dest"
  INSTALL_DIR="${INSTALL_DIR:-/opt/minecraft-bedrock}"
  BACKUP_DIR="${BACKUP_DIR:-${INSTALL_DIR}/backups}"
  SERVICE_USER="${SERVICE_USER:-minecraft}"
  SERVICE_NAME="${SERVICE_NAME:-minecraft-bedrock}"
}

install_scripts() {
  log "Installing update.sh to ${INSTALL_DIR}/bin …"
  install -m 755 "${REPO_ROOT}/scripts/update.sh" "${INSTALL_DIR}/bin/update.sh"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}/bin"
}

install_systemd() {
  log "Installing systemd units …"
  install -m 644 "${REPO_ROOT}/systemd/minecraft-bedrock.service" \
    /etc/systemd/system/minecraft-bedrock.service
  install -m 644 "${REPO_ROOT}/systemd/minecraft-bedrock-update.service" \
    /etc/systemd/system/minecraft-bedrock-update.service
  install -m 644 "${REPO_ROOT}/systemd/minecraft-bedrock-update.timer" \
    /etc/systemd/system/minecraft-bedrock-update.timer

  if [[ "$SERVICE_USER" != "minecraft" ]]; then
    sed -i "s/^User=minecraft$/User=${SERVICE_USER}/" /etc/systemd/system/minecraft-bedrock.service
    sed -i "s/^Group=minecraft$/Group=${SERVICE_USER}/" /etc/systemd/system/minecraft-bedrock.service
  fi
  if [[ "$INSTALL_DIR" != "/opt/minecraft-bedrock" ]]; then
    sed -i "s|/opt/minecraft-bedrock|${INSTALL_DIR}|g" /etc/systemd/system/minecraft-bedrock.service
    sed -i "s|/opt/minecraft-bedrock|${INSTALL_DIR}|g" /etc/systemd/system/minecraft-bedrock-update.service
  fi

  systemctl daemon-reload
  systemctl enable minecraft-bedrock.service
  systemctl enable --now minecraft-bedrock-update.timer
}

first_install() {
  if [[ ! -f "${INSTALL_DIR}/VERSION" ]] || [[ ! -x "${INSTALL_DIR}/bedrock_server" ]]; then
    log "Downloading and installing current Bedrock server version …"
    CONFIG_FILE=/etc/minecraft-bedrock/config.env \
      "${INSTALL_DIR}/bin/update.sh" --force
  else
    log "Existing installation found – checking for updates …"
    CONFIG_FILE=/etc/minecraft-bedrock/config.env \
      "${INSTALL_DIR}/bin/update.sh"
  fi
}

print_status() {
  echo
  echo "=== Provisioning complete ==="
  echo "Install directory: $INSTALL_DIR"
  echo "Config:            /etc/minecraft-bedrock/config.env"
  echo "Backups:           $BACKUP_DIR"
  echo "Update timer:      daily 04:00 (Persistent=true)"
  echo
  echo "Service status:"
  systemctl --no-pager --full status "${SERVICE_NAME}.service" || true
  echo
  echo "Next update check:"
  systemctl --no-pager list-timers minecraft-bedrock-update.timer || true
  echo
  echo "Note: allow UDP port 19132 (and optionally 19133 for IPv6) in the firewall."
  echo "Download implies acceptance of the Minecraft EULA: https://minecraft.net/eula"
}

provision_local() {
  require_root
  require_debian
  require_repo_layout

  INSTALL_DIR="${INSTALL_DIR:-/opt/minecraft-bedrock}"
  BACKUP_DIR="${BACKUP_DIR:-${INSTALL_DIR}/backups}"
  SERVICE_USER="${SERVICE_USER:-minecraft}"
  SERVICE_NAME="${SERVICE_NAME:-minecraft-bedrock}"

  install_packages
  install_config
  load_config
  ensure_user
  ensure_dirs
  install_scripts
  install_systemd
  first_install
  print_status
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  # user@host → remote; otherwise provision this machine
  if [[ $# -ge 1 && "$1" == *@* ]]; then
    provision_remote "$1"
  elif [[ $# -ge 1 ]]; then
    usage
    die "Unexpected argument: $1 (use user@host for remote provisioning)"
  else
    provision_local
  fi
}

main "$@"
