#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Build script for native Debian .deb package: pflegerust
# Usage: ./packaging/build-deb.sh [VERSION]
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_VERSION="${1:-1.5.0}"
# Strip leading 'v' (e.g., v1.5.0 -> 1.5.0) for Debian policy compliance
VERSION="${RAW_VERSION#v}"
PKG_NAME="pflegerust"
ARCH="all"
STAGING_DIR="${ROOT_DIR}/packaging/staging/${PKG_NAME}_${VERSION}_${ARCH}"
OUTPUT_DEB="${ROOT_DIR}/${PKG_NAME}_${VERSION}_${ARCH}.deb"

echo "[1/5] Prüfe Produktions-Build (dist/)..."
if [ ! -f "${ROOT_DIR}/dist/index.html" ]; then
  echo "  dist/index.html nicht gefunden – starte npm run build..."
  (cd "${ROOT_DIR}" && npm run build)
fi

echo "[2/5] Erstelle Debian-Paketstruktur in ${STAGING_DIR}..."
rm -rf "${STAGING_DIR}"
mkdir -p \
  "${STAGING_DIR}/DEBIAN" \
  "${STAGING_DIR}/usr/share/${PKG_NAME}/www" \
  "${STAGING_DIR}/lib/systemd/system" \
  "${STAGING_DIR}/etc/default"

echo "[3/5] Kopiere Anwendung, Server und systemd-Konfiguration..."
cp -a "${ROOT_DIR}/dist/." "${STAGING_DIR}/usr/share/${PKG_NAME}/www/"
install -m 0755 "${ROOT_DIR}/packaging/server.mjs" "${STAGING_DIR}/usr/share/${PKG_NAME}/server.mjs"

cat > "${STAGING_DIR}/etc/default/${PKG_NAME}" <<'EOF'
# PflegeRust Dienst-Konfiguration
PFLEGERUST_HOST=0.0.0.0
PFLEGERUST_PORT=8080
PFLEGERUST_WWW_DIR=/usr/share/pflegerust/www
EOF
chmod 0644 "${STAGING_DIR}/etc/default/${PKG_NAME}"

cat > "${STAGING_DIR}/lib/systemd/system/${PKG_NAME}.service" <<'EOF'
[Unit]
Description=PflegeRust - Pflegemanagement Web-Applikation (PWA)
Documentation=https://github.com/
After=network-online.target mariadb.service
Wants=network-online.target

[Service]
Type=simple
User=pflegerust
Group=pflegerust
EnvironmentFile=-/etc/default/pflegerust
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

echo "[4/5] Erzeuge DEBIAN-Metadaten und Maintainer-Skripte..."
INSTALLED_SIZE="$(du -sk "${STAGING_DIR}/usr" "${STAGING_DIR}/etc" "${STAGING_DIR}/lib" | awk '{s+=$1} END {print s}')"

cat > "${STAGING_DIR}/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${ARCH}
Installed-Size: ${INSTALLED_SIZE}
Depends: nodejs (>= 18), adduser
Suggests: mariadb-server, nginx
Maintainer: PflegeRust Maintainers <admin@pflegerust.local>
Description: PflegeRust Pflegemanagement-Plattform (PWA)
 Mobiles Pflegemanagement für ambulante und stationäre Dienste mit
 Tourenplanung, Klientenakte, SIS, Medikation, RBAC, 2FA/Passkeys
 und Telematik-Add-on-Verwaltung.
EOF

cat > "${STAGING_DIR}/DEBIAN/conffiles" <<EOF
/etc/default/${PKG_NAME}
EOF

cat > "${STAGING_DIR}/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e

if [ "$1" = "configure" ]; then
  if ! getent passwd pflegerust >/dev/null 2>&1; then
    adduser --system --group --no-create-home --home /usr/share/pflegerust pflegerust >/dev/null 2>&1 || true
  fi

  if [ -d /run/systemd/system ]; then
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl enable pflegerust.service >/dev/null 2>&1 || true
    systemctl restart pflegerust.service >/dev/null 2>&1 || true
  fi
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
fi

exit 0
EOF
chmod 0755 "${STAGING_DIR}/DEBIAN/postrm"

echo "[5/5] Baue Debian-Paket ${OUTPUT_DEB}..."
dpkg-deb --build --root-owner-group "${STAGING_DIR}" "${OUTPUT_DEB}"
(cd "${ROOT_DIR}" && sha256sum "$(basename "${OUTPUT_DEB}")" > SHA256SUMS)

echo "✓ Debian-Paket erfolgreich erstellt: ${OUTPUT_DEB}"
dpkg-deb --info "${OUTPUT_DEB}"
