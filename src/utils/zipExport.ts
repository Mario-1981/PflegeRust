import JSZip from 'jszip';
import { RUST_CODEBASE } from '../data/rustCodebase';

export async function downloadRustDebianZip(): Promise<void> {
  const zip = new JSZip();

  // Root folder inside the zip
  const root = zip.folder('pfleged-rust-mariadb-debian');
  if (!root) return;

  // Add all files
  for (const file of RUST_CODEBASE) {
    root.file(file.path, file.content);
  }

  // Add comprehensive README.md for MariaDB + Debian setup
  root.file(
    'README.md',
    `# PflegeRust - Pflegemanagement Daemon & SNAP-Migrationstool (MariaDB Edition)

Geschrieben in **Rust** mit nativer **MariaDB / InnoDB** Anbindung für **Debian Linux** (Debian 12 Bookworm / Debian 13 Trixie).

## Architektur-Highlights
- **MariaDB Asynchron-Engine**: \`sqlx\` Connection Pooling (5–25 Verbindungen), InnoDB Engine, volles UTF-8mb4
- **Pflegemanagement**: Tourenplanung, Klientenakte, SIS-Dokumentation, Vitalwerte, Medikationspläne nach SGB V und SGB XI
- **SNAP-Migrationstool**: Automatischer Import von SNAP.Pflege XML- und CSV-Exporten mit automatischer Überleitung von Pflegestufen (1,2,3) in moderne Pflegegrade (1-5) direkt in MariaDB Tabellen mit \`ON DUPLICATE KEY UPDATE\`
- **Debian Linux First**: debhelper Paketierung (\`dpkg-buildpackage\`), native systemd Service Unit mit Sandboxing und automatischer MariaDB Initialisierung (\`postinst\`)

## Installation & Einrichtung auf Debian Linux

### 1. MariaDB & Build-Abhängigkeiten installieren
\`\`\`bash
sudo apt update
sudo apt install -y mariadb-server mariadb-client libmariadb-dev libssl-dev cargo rustc debhelper build-essential
\`\`\`

### 2. MariaDB Datenbank & Benutzer anlegen
\`\`\`bash
sudo mariadb -u root <<EOF
CREATE DATABASE IF NOT EXISTS pflege_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'pfleged'@'localhost' IDENTIFIED BY 'geheim';
GRANT ALL PRIVILEGES ON pflege_db.* TO 'pfleged'@'localhost';
FLUSH PRIVILEGES;
EOF

# Schema einspielen
mariadb -u pfleged -pgeheim pflege_db < schema.sql
\`\`\`

### 3. Als Debian-Paket bauen & installieren
\`\`\`bash
dpkg-buildpackage -us -uc -b
sudo dpkg -i ../pfleged_1.5.0_amd64.deb
\`\`\`

### 4. Dienst verwalten mit systemd
\`\`\`bash
sudo systemctl status pfleged.service
sudo journalctl -u pfleged -f
\`\`\`

### 5. SNAP Migrationstool ausführen
\`\`\`bash
# Trockenlauf zur Prüfung
pfleged migrate-snap --source snap_export.xml --dry-run

# Echte Migration in die MariaDB-Datenbank
pfleged migrate-snap --source snap_export.xml
\`\`\`
`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pfleged-rust-mariadb-debian-v1.5.0.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
