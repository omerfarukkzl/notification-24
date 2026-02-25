#!/usr/bin/env bash
set -euo pipefail

# Tek komutla local gelistirme ortamini kaldirir:
# 1) Docker infra (PostgreSQL + RabbitMQ)
# 2) API
# 3) Worker
# 4) Angular web

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.local/run"
LOG_DIR="$ROOT_DIR/.local/logs"

mkdir -p "$RUN_DIR" "$LOG_DIR"

API_PID_FILE="$RUN_DIR/api.pid"
WORKER_PID_FILE="$RUN_DIR/worker.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"

API_LOG="$LOG_DIR/api.log"
WORKER_LOG="$LOG_DIR/worker.log"
WEB_LOG="$LOG_DIR/web.log"

log() {
  printf '[dev-up] %s\n' "$1"
}

fail() {
  printf '[dev-up] HATA: %s\n' "$1" >&2
  printf '[dev-up] Calisan servisleri kapatmak icin: pnpm dev:down\n' >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Gerekli komut bulunamadi: $cmd"
}

ensure_port_available() {
  local port="$1"
  local service_name="$2"

  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "$service_name icin gereken :$port portu zaten kullanimda. Once ilgili prosesi kapat."
  fi
}

is_running_pid_file() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file")"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

ensure_not_running() {
  local service_name="$1"
  local pid_file="$2"
  if is_running_pid_file "$pid_file"; then
    fail "$service_name zaten calisiyor (PID: $(cat "$pid_file")). Once 'pnpm dev:down' calistir."
  fi

  # Eski/stale PID dosyasini temizle.
  rm -f "$pid_file"
}

wait_for_http() {
  local url="$1"
  local service_name="$2"
  local timeout_seconds="${3:-90}"
  local pid_to_watch="${4:-}"
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if [[ -n "$pid_to_watch" ]] && ! kill -0 "$pid_to_watch" 2>/dev/null; then
      fail "$service_name process kapanmis gorunuyor. Log: $LOG_DIR"
    fi

    if curl -sS -o /dev/null --max-time 2 "$url"; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  fail "$service_name $url adresinde hazir olmadi. Log: $LOG_DIR"
}

wait_for_process_alive() {
  local pid="$1"
  local service_name="$2"
  local timeout_seconds="${3:-20}"
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if ! kill -0 "$pid" 2>/dev/null; then
      fail "$service_name erken kapandi. Log: $LOG_DIR"
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
}

update_pid_from_port() {
  local port="$1"
  local pid_file="$2"
  local service_name="$3"

  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  local listening_pid
  listening_pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n1 || true)"
  if [[ -z "$listening_pid" ]]; then
    return 0
  fi

  echo "$listening_pid" >"$pid_file"
  log "$service_name PID guncellendi (port :$port): $listening_pid"
}

extract_conn_string_value() {
  local conn_str="$1"
  local key="$2"
  local normalized_key
  normalized_key="$(echo "$key" | tr '[:upper:]' '[:lower:]')"

  while IFS= read -r segment; do
    local raw_key="${segment%%=*}"
    local raw_value="${segment#*=}"
    local key_trimmed
    key_trimmed="$(echo "$raw_key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    local value_trimmed
    value_trimmed="$(echo "$raw_value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

    if [[ "$(echo "$key_trimmed" | tr '[:upper:]' '[:lower:]')" == "$normalized_key" ]]; then
      printf '%s' "$value_trimmed"
      return 0
    fi
  done < <(printf '%s' "$conn_str" | tr ';' '\n')

  return 1
}

wait_for_db_health() {
  local container_name="$1"
  local timeout_seconds="${2:-120}"
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    local status
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"

    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      return 0
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  fail "PostgreSQL health check timeout. Container: $container_name"
}

ensure_database_exists() {
  local container_name="$1"
  local database_name="$2"
  local database_user="$3"
  local database_password="$4"

  local db_exists
  db_exists="$(docker exec -e PGPASSWORD="$database_password" "$container_name" \
    psql -U "$database_user" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$database_name';" 2>/dev/null || true)"

  if [[ "$db_exists" == "1" ]]; then
    return 0
  fi

  docker exec -e PGPASSWORD="$database_password" "$container_name" \
    createdb -U "$database_user" "$database_name" >/dev/null
}

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  else
    COREPACK_HOME="${COREPACK_HOME:-/tmp/corepack}" corepack pnpm "$@"
  fi
}

load_dotenv() {
  local env_file="$ROOT_DIR/.env"
  if [[ -f "$env_file" ]]; then
    while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
      local line="${raw_line%$'\r'}"

      # Bos satir ve yorumlari atla.
      [[ -z "${line//[[:space:]]/}" ]] && continue
      [[ "$line" =~ ^[[:space:]]*# ]] && continue

      # "export KEY=VALUE" formatini da destekle.
      line="${line#"${line%%[![:space:]]*}"}"
      if [[ "$line" == export\ * ]]; then
        line="${line#export }"
      fi

      local key="${line%%=*}"
      local value="${line#*=}"

      # Key icin basic trim.
      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      [[ -z "$key" ]] && continue

      # Value'da sadece sol trim yap; sag tarafi oldugu gibi koru.
      value="${value#"${value%%[![:space:]]*}"}"

      # Cift veya tek tirnakla sariliysa, tirnaklari kaldir.
      if [[ "${value:0:1}" == "\"" && "${value: -1}" == "\"" ]]; then
        value="${value:1:${#value}-2}"
      elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
        value="${value:1:${#value}-2}"
      fi

      export "$key=$value"
    done < "$env_file"

    log ".env yuklendi: $env_file"
  else
    log ".env bulunamadi. Ornek dosyayi kopyalamak icin: cp .env.example .env"
  fi
}

check_firebase_admin_credentials() {
  local inline_json="${Firebase__ServiceAccountJson:-}"
  if [[ -n "${inline_json//[[:space:]]/}" ]]; then
    local trimmed_inline="$inline_json"
    trimmed_inline="${trimmed_inline#"${trimmed_inline%%[![:space:]]*}"}"
    trimmed_inline="${trimmed_inline%"${trimmed_inline##*[![:space:]]}"}"

    if [[ "$trimmed_inline" == \{* ]]; then
      log "Firebase admin credential: Firebase__ServiceAccountJson (inline JSON) kullanilacak."
      return 0
    fi

    local inline_path="$trimmed_inline"
    if [[ "$inline_path" != /* ]]; then
      inline_path="$ROOT_DIR/$inline_path"
    fi

    if [[ -f "$inline_path" ]]; then
      log "UYARI: Firebase__ServiceAccountJson alanina dosya yolu yazilmis gorunuyor."
      log "UYARI: Dogru key Firebase__ServiceAccountJsonPath olmali."
      log "Firebase service account bulundu: $inline_path"
      return 0
    fi

    log "UYARI: Firebase__ServiceAccountJson dolu ama JSON formatinda degil."
  fi

  local raw_path="${Firebase__ServiceAccountJsonPath:-}"
  if [[ -z "${raw_path//[[:space:]]/}" ]]; then
    log "UYARI: Firebase admin credential tanimli degil."
    log "UYARI: Kullanici olusturma/guncelleme/silme endpoint'leri Firebase hatasi verebilir."
    return 0
  fi

  local resolved_path="$raw_path"
  if [[ "$resolved_path" != /* ]]; then
    resolved_path="$ROOT_DIR/$resolved_path"
  fi

  if [[ ! -f "$resolved_path" ]]; then
    local api_relative_path="$raw_path"
    if [[ "$api_relative_path" == ./* ]]; then
      api_relative_path="${api_relative_path#./}"
    fi

    local api_project_path="$ROOT_DIR/src/backend/Notification24.Api/$api_relative_path"
    if [[ -f "$api_project_path" ]]; then
      resolved_path="$api_project_path"
    fi
  fi

  if [[ ! -f "$resolved_path" ]]; then
    log "UYARI: Firebase service account dosyasi bulunamadi: $resolved_path"
    log "UYARI: Kullanici olusturma/guncelleme/silme endpoint'leri Firebase hatasi verebilir."
  else
    log "Firebase service account bulundu: $resolved_path"
  fi
}

main() {
  cd "$ROOT_DIR"

  require_cmd docker
  require_cmd dotnet
  require_cmd curl

  load_dotenv
  check_firebase_admin_credentials

  ensure_not_running "API" "$API_PID_FILE"
  ensure_not_running "Worker" "$WORKER_PID_FILE"
  ensure_not_running "Web" "$WEB_PID_FILE"

  ensure_port_available "5050" "API"
  ensure_port_available "4200" "Frontend"

  export DOTNET_CLI_HOME="${DOTNET_CLI_HOME:-/tmp/dotnet}"
  export NUGET_PACKAGES="${NUGET_PACKAGES:-/tmp/nuget}"
  export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
  export DOTNET_ENVIRONMENT="${DOTNET_ENVIRONMENT:-Development}"
  export ASPNETCORE_URLS="${ASPNETCORE_URLS:-http://localhost:5050}"
  export Api__BaseUrl="${Api__BaseUrl:-http://localhost:5050/}"
  if [[ -z "${ConnectionStrings__Postgres:-}" && -n "${ConnectionStrings__SqlServer:-}" ]]; then
    if [[ "$ConnectionStrings__SqlServer" == *"Host="* ]]; then
      export ConnectionStrings__Postgres="$ConnectionStrings__SqlServer"
    else
      log "UYARI: ConnectionStrings__SqlServer SQL Server formatinda gorunuyor. Otomatik Postgres map atlandi."
    fi
  fi

  export ConnectionStrings__Postgres="${ConnectionStrings__Postgres:-Host=localhost;Port=5432;Database=Notification24Db;Username=postgres;Password=postgres;SSL Mode=Disable}"

  log "Infra baslatiliyor (PostgreSQL + RabbitMQ)..."
  docker compose -f infra/docker/docker-compose.local.yml up -d >/dev/null

  log "PostgreSQL health bekleniyor..."
  wait_for_db_health "notification24-postgres" 120

  local db_name="Notification24Db"
  local db_user="postgres"
  local db_password="postgres"
  local db_host="localhost"
  local db_port="5432"

  if extracted_db_name="$(extract_conn_string_value "$ConnectionStrings__Postgres" "Database")"; then
    db_name="$extracted_db_name"
  fi

  if extracted_user="$(extract_conn_string_value "$ConnectionStrings__Postgres" "Username")"; then
    db_user="$extracted_user"
  elif extracted_user="$(extract_conn_string_value "$ConnectionStrings__Postgres" "User Id")"; then
    db_user="$extracted_user"
  fi

  if extracted_password="$(extract_conn_string_value "$ConnectionStrings__Postgres" "Password")"; then
    db_password="$extracted_password"
  fi

  if extracted_host="$(extract_conn_string_value "$ConnectionStrings__Postgres" "Host")"; then
    db_host="$extracted_host"
  elif extracted_host="$(extract_conn_string_value "$ConnectionStrings__Postgres" "Server")"; then
    db_host="$extracted_host"
  fi

  if extracted_port="$(extract_conn_string_value "$ConnectionStrings__Postgres" "Port")"; then
    db_port="$extracted_port"
  fi

  if [[ "$db_host" != "localhost" && "$db_host" != "127.0.0.1" && "$db_host" != "notification24-postgres" ]]; then
    log "UYARI: ConnectionStrings__Postgres local host gostermiyor (Host=$db_host). Local DB olusturma atlandi."
  else
    log "Veritabani kontrol ediliyor ($db_name @ $db_host:$db_port, user=$db_user)..."
    ensure_database_exists "notification24-postgres" "$db_name" "$db_user" "$db_password"
    log "Veritabani hazir: $db_name"
  fi

  log "Node paketleri kontrol ediliyor..."
  run_pnpm install >/dev/null

  log "Dotnet restore calisiyor..."
  dotnet restore Notification24.slnx -v minimal >/dev/null

  if [[ "${Database__ApplyMigrationsOnStartup:-false}" == "true" ]]; then
    log "Database__ApplyMigrationsOnStartup=true: API acilisinda migration deneyecek."
  else
    log "Database__ApplyMigrationsOnStartup=false: migration otomatik degil."
  fi

  log "API baslatiliyor..."
  (
    cd "$ROOT_DIR"
    dotnet run --no-launch-profile --project src/backend/Notification24.Api/Notification24.Api.csproj
  ) >"$API_LOG" 2>&1 &
  echo "$!" >"$API_PID_FILE"
  wait_for_http "http://localhost:5050/" "API" 90 "$(cat "$API_PID_FILE")"
  update_pid_from_port "5050" "$API_PID_FILE" "API"
  log "API ayaga kalkti -> http://localhost:5050"

  log "Worker baslatiliyor..."
  (
    cd "$ROOT_DIR"
    dotnet run --no-launch-profile --project src/backend/Notification24.Worker/Notification24.Worker.csproj
  ) >"$WORKER_LOG" 2>&1 &
  echo "$!" >"$WORKER_PID_FILE"
  wait_for_process_alive "$(cat "$WORKER_PID_FILE")" "Worker" 8
  log "Worker ayaga kalkti."

  log "Frontend baslatiliyor..."
  (
    cd "$ROOT_DIR"
    run_pnpm --filter @notification24/web start
  ) >"$WEB_LOG" 2>&1 &
  echo "$!" >"$WEB_PID_FILE"
  wait_for_http "http://localhost:4200/" "Frontend" 120 "$(cat "$WEB_PID_FILE")"
  update_pid_from_port "4200" "$WEB_PID_FILE" "Frontend"
  log "Frontend ayaga kalkti -> http://localhost:4200"

  log "Tum servisler hazir."
  log "Log klasoru: $LOG_DIR"
  log "Kapatmak icin: pnpm dev:down"
}

main "$@"
