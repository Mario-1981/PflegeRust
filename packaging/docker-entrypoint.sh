#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PflegeRust All-in-One Docker Entrypoint
# - Startet automatisch integrierte MariaDB 10.11 (sofern kein externer DB_HOST)
# - Richtet Datenbank 'pflege_db' + Benutzer 'pfleged' beim Erststart ein
# - Startet PflegeRust Node.js Backend + PWA auf Port 8080
# ==============================================================================

CONFIG_DIR="/var/lib/pflegerust"
DB_ENV_FILE="${CONFIG_DIR}/db.env"
MYSQL_DATA_DIR="/var/lib/mysql"
MARIADB_PID=""
NODE_PID=""

mkdir -p "${CONFIG_DIR}" /run/mysqld
chown -R mysql:mysql /run/mysqld "${MYSQL_DATA_DIR}"

cleanup() {
  echo "[PflegeRust Container] Beende Dienste sauber..."
  if [ -n "${NODE_PID}" ] && kill -0 "${NODE_PID}" 2>/dev/null; then
    kill -TERM "${NODE_PID}" 2>/dev/null || true
    wait "${NODE_PID}" 2>/dev/null || true
  fi
  if [ -n "${MARIADB_PID}" ] && kill -0 "${MARIADB_PID}" 2>/dev/null; then
    mariadb-admin shutdown 2>/dev/null || kill -TERM "${MARIADB_PID}" 2>/dev/null || true
    wait "${MARIADB_PID}" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup SIGTERM SIGINT

USE_EMBEDDED_DB="true"
if [ -n "${DB_HOST:-}" ] && [ "${DB_HOST}" != "127.0.0.1" ] && [ "${DB_HOST}" != "localhost" ]; then
  USE_EMBEDDED_DB="false"
fi

if [ "${USE_EMBEDDED_DB}" = "true" ]; then
  echo "[PflegeRust Container] Nutze integrierte MariaDB-Datenbank..."

  # 1. MariaDB-Datenverzeichnis bei leerem Volume initialisieren
  if [ ! -d "${MYSQL_DATA_DIR}/mysql" ]; then
    echo "[PflegeRust Container] Initialisiere MariaDB-Datenverzeichnis..."
    mariadb-install-db --user=mysql --datadir="${MYSQL_DATA_DIR}" --auth-root-authentication-method=normal >/dev/null
  fi

  # 2. MariaDB nur lokal (127.0.0.1) im Container starten
  mariadbd --user=mysql --datadir="${MYSQL_DATA_DIR}" --bind-address=127.0.0.1 --port=3306 &
  MARIADB_PID=$!

  echo "[PflegeRust Container] Warte auf MariaDB..."
  for i in $(seq 1 30); do
    if mariadb-admin ping --silent >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! mariadb-admin ping --silent >/dev/null 2>&1; then
    echo "[PflegeRust Container] FEHLER: MariaDB konnte nicht gestartet werden."
    exit 1
  fi

  # 3. Datenbank & Benutzer mit persistentem Zufallspasswort beim Erststart anlegen
  if [ ! -f "${DB_ENV_FILE}" ]; then
    GENERATED_PW="${DB_PASSWORD:-$(openssl rand -hex 24)}"
    DB_NAME_VAL="${DB_NAME:-pflege_db}"
    DB_USER_VAL="${DB_USER:-pfleged}"

    if [[ ! "${DB_NAME_VAL}" =~ ^[a-zA-Z0-9_]+$ ]] || [[ ! "${DB_USER_VAL}" =~ ^[a-zA-Z0-9_]+$ ]]; then
      echo "[PflegeRust Container] FEHLER: DB_NAME und DB_USER dürfen nur Buchstaben, Ziffern und Unterstriche enthalten."
      exit 1
    fi
    if [[ "${GENERATED_PW}" == *"'"* ]] || [[ "${GENERATED_PW}" == *";"* ]] || [[ "${GENERATED_PW}" == *"\\"* ]]; then
      echo "[PflegeRust Container] FEHLER: DB_PASSWORD enthält nicht erlaubte Sonderzeichen."
      exit 1
    fi

    cat > "${DB_ENV_FILE}" <<EOF
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=${DB_NAME_VAL}
DB_USER=${DB_USER_VAL}
DB_PASSWORD=${GENERATED_PW}
DB_SSL=false
EOF
    chmod 0600 "${DB_ENV_FILE}"

    echo "[PflegeRust Container] Lege MariaDB-Datenbank '${DB_NAME_VAL}' und Benutzer '${DB_USER_VAL}' an..."
    mariadb -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME_VAL}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER_VAL}'@'127.0.0.1' IDENTIFIED BY '${GENERATED_PW}';
CREATE USER IF NOT EXISTS '${DB_USER_VAL}'@'localhost' IDENTIFIED BY '${GENERATED_PW}';
ALTER USER '${DB_USER_VAL}'@'127.0.0.1' IDENTIFIED BY '${GENERATED_PW}';
ALTER USER '${DB_USER_VAL}'@'localhost' IDENTIFIED BY '${GENERATED_PW}';
GRANT ALL PRIVILEGES ON \`${DB_NAME_VAL}\`.* TO '${DB_USER_VAL}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${DB_NAME_VAL}\`.* TO '${DB_USER_VAL}'@'localhost';
FLUSH PRIVILEGES;
SQL
  fi

  # Gespeicherte DB-Umgebungsvariablen laden
  set -a
  # shellcheck disable=SC1090
  . "${DB_ENV_FILE}"
  set +a
fi

export NODE_ENV=production
export ALLOW_MEMORY_FALLBACK=false
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8080}"
export PFLEGERUST_WWW_DIR="/usr/share/pflegerust/dist"

echo "[PflegeRust Container] Starte PflegeRust auf Port ${PORT} (MariaDB: ${DB_HOST}:${DB_PORT}/${DB_NAME})..."
node /usr/share/pflegerust/server.mjs &
NODE_PID=$!

wait "${NODE_PID}"
