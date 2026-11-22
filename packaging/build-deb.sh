#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Build script for native Debian .deb package: pflegerust (mit MariaDB-Backend)
# Usage: ./packaging/build-deb.sh [VERSION]
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_VERSION="${1:-1.5.0}"
VERSION="${RAW_VERSION#v}"
PKG_NAME="pflegerust"
ARCH="all"
STAGING_DIR="${ROOT_DIR}/packaging/staging/${PKG_NAME}_${VERSION}_${ARCH}"
OUTPUT_DEB="${ROOT_DIR}/${PKG_NAME}_${VERSION}_${ARCH}.deb"

echo "[1/6] Prüfe Produktions-Build (Frontend + Backend)..."
if [ ! -f "${ROOT_DIR}/dist/index.html" ] || [ ! -f "${ROOT_DIR}/dist-server/server.mjs" ]; then
  echo "  Baue Frontend und MariaDB-Backend..."
  (cd "${ROOT_DIR}" && npm run build)
fi

echo "[2/6] Erstelle Debian-Paketstruktur in ${STAGING_DIR}..."
rm -rf "${STAGING_DIR}"
mkdir -p \
  "${STAGING_DIR}/DEBIAN" \
  "${STAGING_DIR}/usr/share/${PKG_NAME}/dist" \
  "${STAGING_DIR}/lib/systemd/system" \
  "${STAGING_DIR}/etc/default" \
  "${STAGING_DIR}/etc/${PKG_NAME}"

echo "[3/6] Kopiere Frontend, Backend-Server und minimale Runtime-Abhängigkeiten..."
cp -a "${ROOT_DIR}/dist/." "${STAGING_DIR}/usr/share/${PKG_NAME}/dist/"
install -m 0755 "${ROOT_DIR}/dist-server/server.mjs" "${STAGING_DIR}/usr/share/${PKG_NAME}/server.mjs"

cat > "${STAGING_DIR}/usr/share/${PKG_NAME}/package.json" <<EOF
{
  "name": "pflegerust-server",
  "version": "${VERSION}",
  "private": true,
  "type": "module",
  "dependencies": {
    "express": "^4.21.2",
    "mysql2": "^3.11.0"
  }
}
EOF

echo "[4/6] Installiere produktive Node-Abhängigkeiten (express & mysql2) in das Paket..."
(cd "${STAGING_DIR}/usr/share/${PKG_NAME}" && npm install --omit=dev --no-audit --no-fund --no-package-lock)

cat > "${STAGING_DIR}/etc/default/${PKG_NAME}" <<'EOF'
# PflegeRust Dienst-Konfiguration
NODE_ENV=production
ALLOW_MEMORY_FALLBACK=false
HOST=0.0.0.0
PORT=8080
PFLEGERUST_WWW_DIR=/usr/share/pflegerust/dist
EOF
chmod 0644 "${STAGING_DIR}/etc/default/${PKG_NAME}"

cat > "${STAGING_DIR}/lib/systemd/system/${PKG_NAME}.service" <<'EOF'
[Unit]
Description=PflegeRust - Pflegemanagement Web-Applikation & MariaDB-Backend
Documentation=https://github.com/
After=network-online.target mariadb.service mysql.service
Wants=network-online.target mariadb.service

[Service]
Type=simple
User=pflegerust
Group=pflegerust
WorkingDirectory=/usr/share/pflegerust
EnvironmentFile=-/etc/default/pflegerust
EnvironmentFile=-/etc/pflegerust/db.env
ExecStart=/usr/bin/node /usr/share/pflegerust/server.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "${STAGING_DIR}/lib/systemd/system/${PKG_NAME}.service"

echo "[5/6] Erzeuge DEBIAN-Metadaten und automatische MariaDB-Provisionierung (postinst)..."
INSTALLED_SIZE="$(du -sk "${STAGING_DIR}/usr" "${STAGING_DIR}/etc" "${STAGING_DIR}/lib" | awk '{s+=$1} END {print s}')"

cat > "${STAGING_DIR}/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${ARCH}
Installed-Size: ${INSTALLED_SIZE}
Depends: nodejs (>= 18), mariadb-server, mariadb-client, adduser, openssl
Suggests: nginx, caddy
Maintainer: PflegeRust Maintainers <admin@pflegerust.local>
Description: PflegeRust Pflegemanagement-Plattform mit MariaDB-Backend (PWA)
 Vollständiges Pflegemanagement für ambulante und stationäre Dienste mit
 dauerhafter MariaDB-Speicherung, Tourenplanung, Klientenakte, SIS,
 Medikation, RBAC, 2FA/Passkeys und mobiler PWA-Unterstützung.
EOF

cat > "${STAGING_DIR}/DEBIAN/conffiles" <<EOF
/etc/default/${PKG_NAME}
EOF

cat > "${STAGING_DIR}/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e

if [ "$1" = "configure" ]; then
  # 1. Dedizierten Systembenutzer anlegen
  if ! getent passwd pflegerust >/dev/null 2>&1; then
    adduser --system --group --no-create-home --home /usr/share/pflegerust pflegerust >/dev/null 2>&1 || true
  fi

  # 2. MariaDB sicherstellen & starten
  if [ -d /run/systemd/system ]; then
    systemctl enable mariadb.service >/dev/null 2>&1 || true
    systemctl start mariadb.service >/dev/null 2>&1 || true
  elif command -v service >/dev/null 2>&1; then
    service mariadb start >/dev/null 2>&1 || true
  fi

  # 3. Datenbank, Benutzer & sicheres Zufallspasswort einmalig automatisch einrichten
  mkdir -p /etc/pflegerust
  chown root:pflegerust /etc/pflegerust
  chmod 0750 /etc/pflegerust

  DB_ENV_FILE="/etc/pflegerust/db.env"
  if [ ! -f "$DB_ENV_FILE" ]; then
    DB_PASS="$(openssl rand -hex 24)"
    cat > "$DB_ENV_FILE" <<DBENV
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=pflege_db
DB_USER=pfleged
DB_PASSWORD=${DB_PASS}
DB_SSL=false
DBENV
    chown root:pflegerust "$DB_ENV_FILE"
    chmod 0640 "$DB_ENV_FILE"

    # Warte kurz bis MariaDB-Socket bereit ist
    for i in 1 2 3 4 5 6 7 8 9 10; do
      if mariadb -u root -e "SELECT 1;" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    mariadb -u root <<SQL
CREATE DATABASE IF NOT EXISTS pflege_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'pfleged'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS 'pfleged'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER 'pfleged'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER 'pfleged'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON pflege_db.* TO 'pfleged'@'127.0.0.1';
GRANT ALL PRIVILEGES ON pflege_db.* TO 'pfleged'@'localhost';
FLUSH PRIVILEGES;
SQL
  fi

  # 4. PflegeRust systemd-Dienst aktivieren und starten
  if [ -d /run/systemd/system ]; then
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl enable pflegerust.service >/dev/null 2>&1 || true
    systemctl restart pflegerust.service >/dev/null 2>&1 || true
  fi

  echo ""
  echo "=================================================================="
  echo " PflegeRust wurde erfolgreich mit MariaDB eingerichtet!"
  echo " Öffnen Sie im Browser: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):8080"
  echo " Die Datenbank pflege_db ist vorkonfiguriert – einfach im"
  echo " Ersteinrichtungsassistenten bei Schritt 2 auf 'Weiter' klicken."
  echo "=================================================================="
fi

exit 0
EOF
chmod 0755 "${STAGING_DIR}/DEBIAN/postinst"

cat > "${STAGING_DIR}/DEBIAN/prerm" <<'EOF'
#!/bin/sh
set -e

if [ "$1" = "remove" ] || [ "$1" = "deconfigure" ]; then
  if [ -d /run/systemd/system ]; then
    systemctl stop pflegerust.service >/dev/null 2>&1 || true
    systemctl disable pflegerust.service >/dev/null 2>&1 || true
  fi
fi

exit 0
EOF
chmod 0755 "${STAGING_DIR}/DEBIAN/prerm"

cat > "${STAGING_DIR}/DEBIAN/postrm" <<'EOF'
#!/bin/sh
set -e

if [ -d /run/systemd/system ]; then
  systemctl daemon-reload >/dev/null 2>&1 || true
fi

if [ "$1" = "purge" ]; then
  rm -f /etc/default/pflegerust
  rm -f /etc/pflegerust/db.env
  rmdir /etc/pflegerust 2>/dev/null || true
fi

exit 0
EOF
chmod 0755 "${STAGING_DIR}/DEBIAN/postrm"

echo "[6/6] Baue Debian-Paket ${OUTPUT_DEB}..."
dpkg-deb --build --root-owner-group "${STAGING_DIR}" "${OUTPUT_DEB}"
(cd "${ROOT_DIR}" && sha256sum "$(basename "${OUTPUT_DEB}")" > SHA256SUMS)

echo "✓ Debian-Paket erfolgreich erstellt: ${OUTPUT_DEB}"
dpkg-deb --info "${OUTPUT_DEB}"
