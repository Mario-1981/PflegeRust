# PflegeRust – Pflegemanagement-Plattform (PWA + MariaDB)

**PflegeRust** ist eine moderne, mobile Pflegemanagement-Plattform für ambulante und stationäre Pflegedienste (orientiert an deutschen Standards nach SGB XI / SGB V). Die Anwendung läuft auf **Desktop, iPhone, iPad, Android-Smartphones und Android-Tablets** (installierbare Progressive Web App) und speichert alle Daten dauerhaft in **MariaDB (InnoDB / `utf8mb4`)**.

---

## Funktionsumfang

- **Ersteinrichtungsassistent:** Geführter 4-Schritte-Start – Einrichtungsdaten angeben, vorkonfigurierte MariaDB mit einem Klick bestätigen und den ersten Systemadministrator (fest mit Rolle `Admin`) anlegen.
- **Benutzer- & Rollenverwaltung (RBAC):** Anpassbare Standardrollen, eigene benutzerdefinierte Rollen, strikte Rechteprüfung in Oberfläche und Server sowie Schutz des letzten aktiven Administrators (keine Selbstsperre, keine Herabstufung/Sperrung des letzten Admins).
- **Sicherheit & 2FA / Passkeys:** Serverseitige Anmeldung (PBKDF2-SHA256), Brute-Force-Sperre, verpflichtende oder optionale 2-Faktor-Authentifizierung per Authenticator-App (TOTP, RFC 6238), FIDO2-Sicherheitsstick, Einmal-Backup-Codes sowie passwortlose Passkeys. 2FA-Pflicht durch Admins pro Rolle oder pro Benutzer erzwingbar.
- **Tourenplanung & Pflegealltag:** Tourenplanung durch PDL und höhere Rollen; Mitarbeiter sehen ausschließlich ihre eigenen zugewiesenen Touren. Klientenakte, SIS-Strukturmodell, Medikationsplan, Dienstplan, Abrechnung (DTA) und SNAP-Datenmigration.
- **Add-on-System (z. B. Telematik / TI 2.0):** Modulares Erweiterungssystem zur Anbindung externer Dienste und TI-Middleware-Anbieter *(Hinweis: mitgelieferte TI-Anbieter-Module sind aktuell Beispiel-/Testmodule ohne produktives Gematik-Gateway)*.
- **Mobil & PWA:** Responsive Oberfläche mit mobiler Bottom-Navigation, Slide-over-Menü, Safe-Area-Unterstützung für iPhone/iPad sowie direkter „App installieren“-Funktion für iOS, iPadOS und Android.

---

## Wie ist MariaDB enthalten?

| Installationsart | MariaDB-Datenbank enthalten? | Einrichtung |
|---|---|---|
| **Docker-Image (`ghcr.io`)** | **Ja, direkt im Image integriert** (All-in-One-Container) | Startet MariaDB beim Container-Start automatisch, legt Datenbank `pflege_db`, Benutzer `pfleged` und Zufallspasswort im Volume an. |
| **Debian-`.deb`-Paket** | **Ja, automatisch via `apt`-Abhängigkeit** (`mariadb-server`) | `sudo apt install ./pflegerust_*.deb` installiert MariaDB automatisch mit und richtet Datenbank, Benutzer, Zufallspasswort (`/etc/pflegerust/db.env`) und `systemd`-Dienst vollautomatisch ein. |

Bei beiden Varianten gilt im Ersteinrichtungsassistenten: **Schritt 1 (Ihre Pflegeeinrichtung) ausfüllen → Schritt 2 (Datenbank) einfach auf „Weiter“ klicken → Schritt 3 (Admin-Benutzer) vergeben → fertig.**

---

## Installation mit Docker (All-in-One inkl. MariaDB)

Das Docker-Image (`linux/amd64` und `linux/arm64`) enthält bereits **Node.js 24, MariaDB 10.11, das Backend und die PWA**.

### Variante A: Einzelner `docker run`-Befehl

```bash
docker run -d \
  --name pflegerust \
  --restart unless-stopped \
  -p 8080:8080 \
  -v pflegerust_mysql:/var/lib/mysql \
  -v pflegerust_config:/var/lib/pflegerust \
  ghcr.io/<GITHUB-USER>/<GITHUB-REPO>:latest
```

### Variante B: Mit Docker Compose

```bash
docker compose up -d
```

Anschließend im Browser öffnen: **`http://<server-ip>:8080`**

> **Persistenz:** Die beiden Volumes `/var/lib/mysql` (MariaDB-Datenbank) und `/var/lib/pflegerust` (automatisch generierte Zugangsdaten) sorgen dafür, dass alle Daten bei Container-Neustarts und Updates vollständig erhalten bleiben.

### Optional: Externe MariaDB mit Docker nutzen

Wenn du statt der eingebauten Datenbank einen externen MariaDB-Server verwenden möchtest, übergib einfach `DB_HOST` (ungleich `localhost`/`127.0.0.1`):

```bash
docker run -d \
  --name pflegerust \
  -p 8080:8080 \
  -e DB_HOST=192.168.10.50 \
  -e DB_PORT=3306 \
  -e DB_NAME=pflege_db \
  -e DB_USER=pfleged \
  -e DB_PASSWORD=dein-sicheres-passwort \
  ghcr.io/<GITHUB-USER>/<GITHUB-REPO>:latest
```

---

## Installation auf Debian 12 (Bookworm) / Debian 13 (Trixie)

1. Aktuelles `.deb`-Paket unter **GitHub → Releases** (oder **Actions → Build Debian (.deb) Package → Artifacts**) herunterladen.
2. Paket **über `apt`** installieren (damit `mariadb-server`, `mariadb-client` und `nodejs` automatisch mitinstalliert werden):

```bash
sudo apt update
sudo apt install -y ./pflegerust_1.5.0_all.deb
```

3. Dienststatus prüfen:

```bash
sudo systemctl status pflegerust
```

4. Im Browser öffnen: **`http://<server-ip>:8080`**

### Wichtige Pfade auf Debian

- **Anwendung & Backend:** `/usr/share/pflegerust/`
- **Dienst-Konfiguration (Port/Host):** `/etc/default/pflegerust`
- **Automatisch erzeugte MariaDB-Zugangsdaten:** `/etc/pflegerust/db.env` *(Dateirechte `0640`, nur für `root` und Dienstbenutzer `pflegerust` lesbar)*
- **systemd-Unit:** `/lib/systemd/system/pflegerust.service`
- **Logs ansehen:** `sudo journalctl -u pflegerust -f`

---

## HTTPS für Smartphones, Tablets (PWA) & Passkeys

Für die Installation als App auf **iPhone, iPad und Android** sowie für **Passkeys / FIDO2-Sticks (WebAuthn)** verlangen Browser über das Netzwerk zwingend **HTTPS**.

### Empfohlen: Caddy als automatischer HTTPS-Reverse-Proxy

```caddyfile
pflege.deine-domain.de {
    reverse_proxy 127.0.0.1:8080
}
```

Caddy holt und erneuert automatisch ein kostenloses Let's-Encrypt-Zertifikat und leitet Anfragen sicher an PflegeRust weiter.

---

## Datensicherung (MariaDB Backup & Restore)

### Auf Debian

```bash
# Backup erstellen
sudo mariadb-dump --single-transaction pflege_db > pflege_db_backup_$(date +%F).sql

# Backup wiederherstellen
sudo mariadb pflege_db < pflege_db_backup_2026-11-22.sql
```

### Im Docker-Container

```bash
# Backup erstellen
docker exec pflegerust mariadb-dump --single-transaction pflege_db > pflege_db_backup_$(date +%F).sql

# Backup wiederherstellen
docker exec -i pflegerust mariadb pflege_db < pflege_db_backup_2026-11-22.sql
```

---

## GitHub Actions (Automatische Builds)

Dieses Repository enthält zwei vollautomatische GitHub-Actions-Workflows:

1. **Debian-`.deb`-Paket (`.github/workflows/build-deb.yml`):**
   - Baut bei jedem Push auf `main`/`master` automatisch `pflegerust_<version>_all.deb` inkl. `SHA256SUMS` und stellt es als Workflow-Artefakt bereit.
   - Beim Pushen eines Versions-Tags (z. B. `git tag v1.5.0 && git push origin v1.5.0`) wird automatisch ein **GitHub Release** mit dem fertigen `.deb`-Paket erstellt.
2. **Docker-Image (`.github/workflows/docker-image.yml`):**
   - Baut Multi-Arch-Images (`linux/amd64`, `linux/arm64`) inkl. MariaDB und veröffentlicht diese automatisch in der **GitHub Container Registry (`ghcr.io`)**.

---

## Lokale Entwicklung

```bash
# Abhängigkeiten installieren
npm install --legacy-peer-deps

# Optional: .env aus Vorlage erstellen
cp .env.example .env

# Entwicklungsserver (Express API + Vite Frontend auf Port 3000)
npm run dev

# Produktions-Build (Frontend + Backend-Bundle)
npm run build

# Debian-Paket lokal bauen
./packaging/build-deb.sh 1.5.0
```

---

## Lizenz

Apache-2.0
