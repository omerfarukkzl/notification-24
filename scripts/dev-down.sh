#!/usr/bin/env bash
set -euo pipefail

# dev-up ile acilan local servisleri kapatir.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.local/run"

API_PID_FILE="$RUN_DIR/api.pid"
WORKER_PID_FILE="$RUN_DIR/worker.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"

log() {
  printf '[dev-down] %s\n' "$1"
}

kill_pid_gracefully() {
  local pid="$1"

  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  kill "$pid" 2>/dev/null || true
  sleep 1

  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
}

stop_pid_file() {
  local service_name="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    log "$service_name icin PID dosyasi yok, atlandi."
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    log "$service_name PID bos, temizlendi."
    return 0
  fi

  if kill -0 "$pid" 2>/dev/null; then
    kill_pid_gracefully "$pid"
    log "$service_name durduruldu (PID: $pid)."
  else
    log "$service_name zaten calismiyor (PID: $pid)."
  fi

  rm -f "$pid_file"
}

stop_port_listeners() {
  local service_name="$1"
  local port="$2"

  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  local pids
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    kill_pid_gracefully "$pid"
  done <<<"$pids"

  local still_running
  still_running="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"
  if [[ -n "$still_running" ]]; then
    log "$service_name port :$port hala acik. Kalan PID(ler): $still_running"
  else
    log "$service_name icin port :$port listener'lari kapatildi."
  fi
}

stop_processes_by_command_match() {
  local service_name="$1"
  local command_match="$2"

  if ! command -v ps >/dev/null 2>&1; then
    return 0
  fi

  local pids
  pids="$(ps -ax -o pid= -o command= | awk -v needle="$command_match" 'index($0, needle) > 0 { print $1 }' | sort -u || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    kill_pid_gracefully "$pid"
  done <<<"$pids"

  log "$service_name icin command match cleanup calisti."
}

main() {
  cd "$ROOT_DIR"

  stop_pid_file "Frontend" "$WEB_PID_FILE"
  stop_pid_file "Worker" "$WORKER_PID_FILE"
  stop_pid_file "API" "$API_PID_FILE"

  stop_port_listeners "API" "5050"
  stop_port_listeners "Frontend" "4200"

  stop_processes_by_command_match "API" "$ROOT_DIR/src/backend/Notification24.Api/Notification24.Api.csproj"
  stop_processes_by_command_match "Worker" "$ROOT_DIR/src/backend/Notification24.Worker/Notification24.Worker.csproj"
  stop_processes_by_command_match "API" "$ROOT_DIR/src/backend/Notification24.Api/bin/Debug/net8.0/Notification24.Api"
  stop_processes_by_command_match "Worker" "$ROOT_DIR/src/backend/Notification24.Worker/bin/Debug/net8.0/Notification24.Worker"

  if command -v docker >/dev/null 2>&1; then
    log "Docker infra kapatiliyor..."
    docker compose -f infra/docker/docker-compose.local.yml down >/dev/null || true
  else
    log "docker komutu bulunamadi, infra kapatma atlandi."
  fi

  log "Local ortam kapatildi."
}

main "$@"
