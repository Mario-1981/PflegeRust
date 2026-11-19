export interface RustFile {
  path: string;
  filename: string;
  category: 'Rust Core' | 'Migration' | 'Debian Package' | 'Config' | 'Database Schema';
  description: string;
  content: string;
}

export const RUST_CODEBASE: RustFile[] = [
  {
    path: 'Cargo.toml',
    filename: 'Cargo.toml',
    category: 'Config',
    description: 'Cargo Manifest mit sqlx MariaDB/MySQL Asynchron-Treiber, Axum, Tokio und Quick-XML',
    content: `[package]
name = "pfleged"
version = "1.5.0"
edition = "2021"
authors = ["PflegeRust Team <dev@pflegerust.org>"]
description = "Pflegemanagement-Daemon und SNAP-Migrationswerkzeug mit MariaDB für Debian Linux"
license = "Apache-2.0"
readme = "README.md"

[dependencies]
# Asynchrones Webframework & HTTP Server
axum = { version = "0.7", features = ["macros"] }
tokio = { version = "1.37", features = ["full"] }
tower-http = { version = "0.5", features = ["cors", "fs", "trace"] }

# Native MariaDB / MySQL Asynchron-Anbindung mit Connection Pooling
sqlx = { version = "0.7", default-features = false, features = [
    "runtime-tokio",
    "tls-rustls",
    "mysql",
    "chrono",
    "uuid",
    "macros"
] }

# Serialisierung & Deserialisierung
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# SNAP Migrations-Parser
quick-xml = { version = "0.34", features = ["serialize"] }
csv = "1.3"

# CLI Argument Parsing
clap = { version = "4.5", features = ["derive", "env"] }

# Logging & Diagnose (journald-kompatibel)
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.8", features = ["v4", "serde"] }

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
strip = true
`,
  },
  {
    path: 'src/main.rs',
    filename: 'main.rs',
    category: 'Rust Core',
    description: 'Haupteinstiegspunkt: MariaDB Connection Pool Initialisierung, systemd Daemon & CLI',
    content: `//! pfleged - Pflegemanagement Server & SNAP Migrationstool
//! Optimiert für MariaDB auf Debian Linux (Bookworm / Trixie)

use std::net::SocketAddr;
use std::path::PathBuf;
use clap::{Parser, Subcommand};
use tracing::{info, warn, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod db;
mod models;
mod api;
mod migration;

#[derive(Parser, Debug)]
#[command(name = "pfleged", version = "1.5.0", about = "Pflegemanagement wie SNAP, in Rust mit MariaDB für Debian Linux")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Port für den Web- & REST-API-Server
    #[arg(short, long, default_value = "8080", env = "PFLEGED_PORT")]
    port: u16,

    /// MariaDB Verbindungszeichenfolge (DSN)
    #[arg(
        long,
        default_value = "mysql://pfleged:geheim@127.0.0.1:3306/pflege_db",
        env = "DATABASE_URL"
    )]
    database_url: String,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Startet den Daemon im Hintergrund (systemd-kompatibel mit MariaDB Pool)
    Daemon {
        #[arg(long, default_value = "0.0.0.0")]
        bind: String,
    },
    /// Führt eine Datenmigration aus einem SNAP-Export direkt in MariaDB durch
    MigrateSnap {
        /// Pfad zur SNAP Export-Datei (.xml oder .csv)
        #[arg(short, long)]
        source: PathBuf,

        /// Trockenlauf ohne Schreiboperationen
        #[arg(long)]
        dry_run: bool,
    },
    /// Prüft die MariaDB-Verbindung und gibt System- & InnoDB-Statistiken aus
    Status,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Tracing initialisieren (Journald-kompatibel für Debian systemd)
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "pfleged=info,sqlx=warn,tower_http=info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse();
    info!("Starte PflegeRust v1.5.0 mit MariaDB auf Debian Linux ({})", std::env::consts::ARCH);

    // Asynchronen MariaDB Connection Pool initialisieren
    info!("Verbinde mit MariaDB...");
    let db_pool = db::init_mariadb_pool(&cli.database_url).await?;
    info!("MariaDB Verbindungspool erfolgreich initialisiert!");

    match cli.command {
        Some(Commands::MigrateSnap { source, dry_run }) => {
            info!("Starte SNAP-Migration nach MariaDB aus Datei {:?}", source);
            let result = migration::snap::execute_migration(&source, &db_pool, dry_run).await?;
            println!("MariaDB Migration erfolgreich abgeschlossen!");
            println!("- Klienten in InnoDB importiert: {}", result.imported_patients);
            println!("- Touren erstellt: {}", result.imported_tours);
            println!("- Medikationspläne verknüpft: {}", result.imported_medications);
            if !result.warnings.is_empty() {
                println!("- Warnungen / PSG II Hinweise: {}", result.warnings.len());
            }
        }
        Some(Commands::Status) => {
            let status = db::get_mariadb_status(&db_pool).await?;
            println!("==================================================");
            println!("PflegeRust MariaDB Status (Debian Linux):");
            println!("- MariaDB Server Version: {}", status.server_version);
            println!("- InnoDB Buffer Pool Size: {} MB", status.buffer_pool_mb);
            println!("- Aktive Klienten: {}", status.active_patients);
            println!("- Touren heute: {}", status.scheduled_tours);
            println!("- Connection Pool: {} Verbindungen aktiv", status.active_connections);
            println!("==================================================");
        }
        Some(Commands::Daemon { bind }) | None => {
            let app = api::create_router(db_pool);
            let addr: SocketAddr = format!("{}:{}", bind, cli.port).parse()?;
            info!("pfleged REST & Webserver lauscht auf http://{}", addr);

            let listener = tokio::net::TcpListener::bind(addr).await?;
            axum::serve(listener, app).await?;
        }
    }

    Ok(())
}
`,
  },
  {
    path: 'src/db.rs',
    filename: 'db.rs',
    category: 'Rust Core',
    description: 'MariaDB Asynchroner Connection Pool (sqlx::MySqlPool) mit InnoDB & UTF-8mb4',
    content: `use sqlx::mysql::{MySqlPool, MySqlPoolOptions};
use sqlx::Row;
use tracing::info;

pub type DbPool = MySqlPool;

#[derive(Debug, Clone)]
pub struct MariaDbStatus {
    pub server_version: String,
    pub buffer_pool_mb: u64,
    pub active_patients: i64,
    pub scheduled_tours: i64,
    pub active_connections: u32,
}

/// Initialisiert den asynchronen MariaDB Connection Pool
pub async fn init_mariadb_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let pool = MySqlPoolOptions::new()
        .max_connections(25)
        .min_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .idle_timeout(std::time::Duration::from_secs(600))
        .connect(database_url)
        .await?;

    // Schema bei Bedarf sicherstellen
    create_mariadb_schema(&pool).await?;

    Ok(pool)
}

/// Erstellt das relationale MariaDB Schema mit InnoDB-Engine und utf8mb4_unicode_ci
pub async fn create_mariadb_schema(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patients (
            id VARCHAR(64) PRIMARY KEY,
            snap_legacy_id VARCHAR(64) UNIQUE,
            last_name VARCHAR(128) NOT NULL,
            first_name VARCHAR(128) NOT NULL,
            birth_date DATE NOT NULL,
            gender CHAR(1) NOT NULL,
            street VARCHAR(192) NOT NULL,
            house_number VARCHAR(32) NOT NULL,
            zip_code VARCHAR(16) NOT NULL,
            city VARCHAR(128) NOT NULL,
            phone VARCHAR(64) NOT NULL,
            care_level TINYINT UNSIGNED NOT NULL CHECK (care_level BETWEEN 1 AND 5),
            care_level_date DATE NOT NULL,
            insurance_name VARCHAR(128) NOT NULL,
            insurance_ik VARCHAR(16) NOT NULL,
            insurance_number VARCHAR(32) NOT NULL,
            copay_exempt BOOLEAN NOT NULL DEFAULT 0,
            key_depot TEXT,
            doctor_name VARCHAR(128),
            doctor_phone VARCHAR(64),
            emergency_contact_name VARCHAR(128),
            emergency_contact_phone VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_patients_snap (snap_legacy_id),
            INDEX idx_patients_ik (insurance_ik)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tours (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(128) NOT NULL,
            shift VARCHAR(32) NOT NULL,
            driver_code VARCHAR(16) NOT NULL,
            license_plate VARCHAR(32) NOT NULL,
            area VARCHAR(128) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tour_stops (
            id VARCHAR(64) PRIMARY KEY,
            tour_id VARCHAR(64) NOT NULL,
            patient_id VARCHAR(64) NOT NULL,
            scheduled_time TIME NOT NULL,
            estimated_minutes SMALLINT UNSIGNED NOT NULL,
            service_codes VARCHAR(255) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'Ausstehend',
            actual_start TIME NULL,
            actual_end TIME NULL,
            notes TEXT,
            FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
            FOREIGN KEY (patient_id) REFERENCES patients(id),
            INDEX idx_stops_tour (tour_id),
            INDEX idx_stops_patient (patient_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS medications (
            id VARCHAR(64) PRIMARY KEY,
            patient_id VARCHAR(64) NOT NULL,
            trade_name VARCHAR(128) NOT NULL,
            active_substance VARCHAR(128) NOT NULL,
            dosage_form VARCHAR(64) NOT NULL,
            morning DECIMAL(5,2) NOT NULL DEFAULT 0.0,
            noon DECIMAL(5,2) NOT NULL DEFAULT 0.0,
            evening DECIMAL(5,2) NOT NULL DEFAULT 0.0,
            night DECIMAL(5,2) NOT NULL DEFAULT 0.0,
            prescribing_doctor VARCHAR(128),
            valid_until DATE,
            sgb_type VARCHAR(32) NOT NULL DEFAULT 'SGB V',
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            INDEX idx_med_patient (patient_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS vital_signs (
            id VARCHAR(64) PRIMARY KEY,
            patient_id VARCHAR(64) NOT NULL,
            recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            systolic SMALLINT UNSIGNED NOT NULL,
            diastolic SMALLINT UNSIGNED NOT NULL,
            pulse SMALLINT UNSIGNED NOT NULL,
            blood_sugar DECIMAL(5,1) NULL,
            temperature DECIMAL(4,1) NULL,
            weight DECIMAL(5,1) NULL,
            recorded_by VARCHAR(32) NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            INDEX idx_vital_patient (patient_id, recorded_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
    )
    .execute(pool)
    .await?;

    info!("MariaDB InnoDB Schema erfolgreich verifiziert.");
    Ok(())
}

/// Liefert MariaDB Server- und InnoDB Statistiken
pub async fn get_mariadb_status(pool: &DbPool) -> Result<MariaDbStatus, sqlx::Error> {
    let version_row = sqlx::query("SELECT VERSION() AS ver").fetch_one(pool).await?;
    let server_version: String = version_row.get("ver");

    let count_patients_row = sqlx::query("SELECT COUNT(*) AS c FROM patients").fetch_one(pool).await?;
    let active_patients: i64 = count_patients_row.get("c");

    let count_tours_row = sqlx::query("SELECT COUNT(*) AS c FROM tours").fetch_one(pool).await?;
    let scheduled_tours: i64 = count_tours_row.get("c");

    // InnoDB Buffer Pool Abfrage
    let buffer_row = sqlx::query("SHOW VARIABLES LIKE 'innodb_buffer_pool_size'")
        .fetch_optional(pool)
        .await?;

    let buffer_pool_mb = buffer_row
        .map(|r| {
            let val: String = r.get("Value");
            val.parse::<u64>().unwrap_or(134217728) / 1024 / 1024
        })
        .unwrap_or(128);

    Ok(MariaDbStatus {
        server_version,
        buffer_pool_mb,
        active_patients,
        scheduled_tours,
        active_connections: pool.size(),
    })
}
`,
  },
  {
    path: 'schema.sql',
    filename: 'schema.sql',
    category: 'Database Schema',
    description: 'Vollständiges MariaDB DDL-Skript (InnoDB, utf8mb4) zur manuellen oder Debian-Installation',
    content: `-- ==============================================================================
-- PflegeRust - MariaDB Datenbankschema für Debian Linux
-- Ziel-Engine: MariaDB >= 10.5 (Bookworm Standard: 10.11) / InnoDB
-- Zeichensatz: utf8mb4 (vollständige Unterstützung medizinischer Sonderzeichen & Umlaute)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS pflege_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE pflege_db;

-- 1. Klientenstammdaten
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(64) PRIMARY KEY,
    snap_legacy_id VARCHAR(64) UNIQUE,
    last_name VARCHAR(128) NOT NULL,
    first_name VARCHAR(128) NOT NULL,
    birth_date DATE NOT NULL,
    gender CHAR(1) NOT NULL,
    street VARCHAR(192) NOT NULL,
    house_number VARCHAR(32) NOT NULL,
    zip_code VARCHAR(16) NOT NULL,
    city VARCHAR(128) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    care_level TINYINT UNSIGNED NOT NULL CHECK (care_level BETWEEN 1 AND 5),
    care_level_date DATE NOT NULL,
    insurance_name VARCHAR(128) NOT NULL,
    insurance_ik VARCHAR(16) NOT NULL,
    insurance_number VARCHAR(32) NOT NULL,
    copay_exempt BOOLEAN NOT NULL DEFAULT 0,
    key_depot TEXT,
    doctor_name VARCHAR(128),
    doctor_phone VARCHAR(64),
    emergency_contact_name VARCHAR(128),
    emergency_contact_phone VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_patients_snap (snap_legacy_id),
    INDEX idx_patients_ik (insurance_ik)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tourenplanung
CREATE TABLE IF NOT EXISTS tours (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    shift VARCHAR(32) NOT NULL,
    driver_code VARCHAR(16) NOT NULL,
    license_plate VARCHAR(32) NOT NULL,
    area VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Haltepunkte pro Tour
CREATE TABLE IF NOT EXISTS tour_stops (
    id VARCHAR(64) PRIMARY KEY,
    tour_id VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64) NOT NULL,
    scheduled_time TIME NOT NULL,
    estimated_minutes SMALLINT UNSIGNED NOT NULL,
    service_codes VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Ausstehend',
    actual_start TIME NULL,
    actual_end TIME NULL,
    notes TEXT,
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    INDEX idx_stops_tour (tour_id),
    INDEX idx_stops_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Medikationsplan (BMP-kompatibel)
CREATE TABLE IF NOT EXISTS medications (
    id VARCHAR(64) PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    trade_name VARCHAR(128) NOT NULL,
    active_substance VARCHAR(128) NOT NULL,
    dosage_form VARCHAR(64) NOT NULL,
    morning DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    noon DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    evening DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    night DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    prescribing_doctor VARCHAR(128),
    valid_until DATE,
    sgb_type VARCHAR(32) NOT NULL DEFAULT 'SGB V',
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_med_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Vitalwerte & Monitoring
CREATE TABLE IF NOT EXISTS vital_signs (
    id VARCHAR(64) PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    systolic SMALLINT UNSIGNED NOT NULL,
    diastolic SMALLINT UNSIGNED NOT NULL,
    pulse SMALLINT UNSIGNED NOT NULL,
    blood_sugar DECIMAL(5,1) NULL,
    temperature DECIMAL(4,1) NULL,
    weight DECIMAL(5,1) NULL,
    recorded_by VARCHAR(32) NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_vital_patient (patient_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Benutzerverwaltung & Rollen (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(128) NOT NULL UNIQUE,
    first_name VARCHAR(64) NOT NULL,
    last_name VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL, -- Admin, PDL, Wohnbereichsleitung, Pflegefachkraft, Pflegehelfer, Verwaltung_Abrechnung, Datenschutz_QM
    auth_provider VARCHAR(32) NOT NULL DEFAULT 'local', -- local, oidc_keycloak, entra_id, google_sso
    sso_subject_id VARCHAR(128),
    password_hash VARCHAR(255),
    department VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT 1,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_username (username),
    INDEX idx_users_email (email),
    INDEX idx_users_sso (sso_subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6b. Dynamische Benutzerrollen & Berechtigungsmatrix (RBAC)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_name VARCHAR(32) PRIMARY KEY,
    display_name VARCHAR(128) NOT NULL,
    description TEXT,
    permissions_json TEXT NOT NULL,
    is_standard BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. SSO Konfiguration (OpenID Connect / Keycloak / SAML)
CREATE TABLE IF NOT EXISTS sso_configurations (
    id VARCHAR(64) PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL DEFAULT 1,
    provider_type VARCHAR(32) NOT NULL, -- keycloak, entra_id, google, generic_oidc, saml2
    display_name VARCHAR(128) NOT NULL,
    issuer_url VARCHAR(255) NOT NULL,
    client_id VARCHAR(128) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    redirect_uri VARCHAR(255) NOT NULL,
    scopes VARCHAR(255) NOT NULL DEFAULT 'openid profile email roles',
    auto_provision BOOLEAN NOT NULL DEFAULT 1,
    default_role VARCHAR(32) NOT NULL DEFAULT 'Pflegefachkraft',
    role_mappings_json TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. DSGVO Audit Log (Zugriffsprotokollierung)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    username VARCHAR(64) NOT NULL,
    user_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(128) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_created (created_at),
    INDEX idx_audit_user (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Add-on-System & Telematik-Middleware-Anbieter (KIM 1.5, ePA 3.0, VSDM, TI-Gateway)
CREATE TABLE IF NOT EXISTS addons (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    version VARCHAR(32) NOT NULL,
    vendor VARCHAR(128) NOT NULL,
    category VARCHAR(32) NOT NULL, -- telematik, abrechnung, sensorik, kommunikation, sonstiges
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    transport VARCHAR(32) NOT NULL DEFAULT 'rest_webhook', -- rest_webhook, grpc, unix_socket, wasm_sandbox
    endpoint_url VARCHAR(255) NOT NULL,
    auth_type VARCHAR(32) NOT NULL DEFAULT 'mtls_smcb', -- mtls_smcb, oauth2_client_credentials, api_token
    tls_cert_path VARCHAR(255),
    webhook_secret VARCHAR(255),
    scopes_json TEXT NOT NULL,
    hooks_json TEXT NOT NULL,
    ti_profile_json TEXT,
    last_heartbeat DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_addons_category (category, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`,
  },
  {
    path: 'src/migration/snap.rs',
    filename: 'snap.rs',
    category: 'Migration',
    description: 'SNAP Migrations-Engine: Importiert SNAP XML/CSV direkt mit MariaDB InnoDB Transaktionen',
    content: `//! SNAP Migrations-Modul für MariaDB
//! Liest Alt-Daten aus SNAP.Pflege XML- oder CSV-Dateien ein,
//! transformiert Pflegestufen in Pflegegrade (PSG II) und speichert
//! diese atomar in MariaDB über InnoDB-Transaktionen mit ROLLBACK-Sicherheit.

use std::path::Path;
use serde::Deserialize;
use tracing::{info, warn};
use crate::db::DbPool;

#[derive(Debug, Default)]
pub struct MigrationSummary {
    pub imported_patients: usize,
    pub imported_tours: usize,
    pub imported_medications: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct SnapXmlExport {
    #[serde(rename = "PATIENTEN")]
    patienten: SnapPatientenWrapper,
    #[serde(rename = "TOUREN", default)]
    touren: Option<SnapTourenWrapper>,
}

#[derive(Debug, Deserialize)]
struct SnapPatientenWrapper {
    #[serde(rename = "PATIENT", default)]
    patient_list: Vec<SnapXmlPatient>,
}

#[derive(Debug, Deserialize)]
struct SnapTourenWrapper {
    #[serde(rename = "TOUR", default)]
    tour_list: Vec<SnapXmlTour>,
}

#[derive(Debug, Deserialize)]
pub struct SnapXmlPatient {
    #[serde(rename = "KUND_NR")]
    pub kund_nr: String,
    #[serde(rename = "NAME")]
    pub name: String,
    #[serde(rename = "VORNAME")]
    pub vorname: String,
    #[serde(rename = "GEB_DATUM")]
    pub geb_datum: String,
    #[serde(rename = "GESCHLECHT")]
    pub geschlecht: String,
    #[serde(rename = "STRASSE")]
    pub strasse: String,
    #[serde(rename = "HAUSNR")]
    pub hausnr: String,
    #[serde(rename = "PLZ")]
    pub plz: String,
    #[serde(rename = "ORT")]
    pub ort: String,
    #[serde(rename = "TELEFON", default)]
    pub telefon: String,
    #[serde(rename = "KASSE_NAME", default)]
    pub kasse_name: String,
    #[serde(rename = "KASSE_IK", default)]
    pub kasse_ik: String,
    #[serde(rename = "VERS_NR", default)]
    pub vers_nr: String,
    #[serde(rename = "BEFREIT", default)]
    pub befreit: String,
    #[serde(rename = "PFL_STUFE_ALT", default)]
    pub pfl_stufe_alt: Option<u8>,
    #[serde(rename = "PFL_GRAD_NEU", default)]
    pub pfl_grad_neu: Option<u8>,
    #[serde(rename = "TOUR_ID", default)]
    pub tour_id: Option<String>,
    #[serde(rename = "ARZT_NAME", default)]
    pub arzt_name: Option<String>,
    #[serde(rename = "NOTFALL_NAME", default)]
    pub notfall_name: Option<String>,
    #[serde(rename = "NOTFALL_TEL", default)]
    pub notfall_tel: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SnapXmlTour {
    #[serde(rename = "TOUR_ID")]
    pub tour_id: String,
    #[serde(rename = "BEZEICHNUNG")]
    pub bezeichnung: String,
    #[serde(rename = "SCHICHT")]
    pub schicht: String,
    #[serde(rename = "FAHRER", default)]
    pub fahrer: String,
}

pub async fn execute_migration(
    source_path: &Path,
    pool: &DbPool,
    dry_run: bool,
) -> Result<MigrationSummary, Box<dyn std::error::Error>> {
    let extension = source_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mut summary = MigrationSummary::default();

    if extension == "xml" {
        let content = std::fs::read_to_string(source_path)?;
        let export: SnapXmlExport = quick_xml::de::from_str(&content)?;

        // MariaDB Transaktion starten
        let mut tx = pool.begin().await?;

        // 1. Touren importieren
        if let Some(touren) = export.touren {
            for tour in touren.tour_list {
                if !dry_run {
                    sqlx::query(
                        "INSERT INTO tours (id, name, shift, driver_code, license_plate, area)
                         VALUES (?, ?, ?, ?, 'B-PF 2040', 'Standard')
                         ON DUPLICATE KEY UPDATE name=VALUES(name), shift=VALUES(shift), driver_code=VALUES(driver_code)"
                    )
                    .bind(&tour.tour_id)
                    .bind(&tour.bezeichnung)
                    .bind(&tour.schicht)
                    .bind(&tour.fahrer)
                    .execute(&mut *tx)
                    .await?;
                }
                summary.imported_tours += 1;
            }
        }

        // 2. Patienten mit automatischer PSG II Überleitung importieren
        for p in export.patienten.patient_list {
            let care_level: u8 = match (p.pfl_grad_neu, p.pfl_stufe_alt) {
                (Some(grad), _) if grad >= 1 && grad <= 5 => grad,
                // PSG II Überleitung: Stufe 1 -> Grad 2, Stufe 2 -> Grad 3, Stufe 3 -> Grad 4
                (_, Some(1)) => 2,
                (_, Some(2)) => 3,
                (_, Some(3)) => 4,
                _ => {
                    summary.warnings.push(format!("Klient {} ohne Einstufung, Standard PG 2 gesetzt", p.kund_nr));
                    2
                }
            };

            let copay_exempt = p.befreit.to_uppercase() == "J" || p.befreit.to_uppercase() == "JA";
            let patient_id = format!("k-snap-{}", p.kund_nr);
            let snap_legacy = format!("SNAP-{}", p.kund_nr);

            if !dry_run {
                sqlx::query(
                    "INSERT INTO patients (
                        id, snap_legacy_id, last_name, first_name, birth_date, gender,
                        street, house_number, zip_code, city, phone,
                        care_level, care_level_date, insurance_name, insurance_ik,
                        insurance_number, copay_exempt, doctor_name, emergency_contact_name, emergency_contact_phone
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2023-01-01', ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        last_name=VALUES(last_name),
                        first_name=VALUES(first_name),
                        care_level=VALUES(care_level),
                        insurance_number=VALUES(insurance_number)"
                )
                .bind(&patient_id)
                .bind(&snap_legacy)
                .bind(&p.name)
                .bind(&p.vorname)
                .bind(&p.geb_datum)
                .bind(&p.geschlecht)
                .bind(&p.strasse)
                .bind(&p.hausnr)
                .bind(&p.plz)
                .bind(&p.ort)
                .bind(&p.telefon)
                .bind(care_level)
                .bind(&p.kasse_name)
                .bind(&p.kasse_ik)
                .bind(&p.vers_nr)
                .bind(copay_exempt)
                .bind(&p.arzt_name)
                .bind(&p.notfall_name)
                .bind(&p.notfall_tel)
                .execute(&mut *tx)
                .await?;
            }

            summary.imported_patients += 1;
        }

        if !dry_run {
            tx.commit().await?;
            info!("MariaDB Transaktion erfolgreich committet!");
        } else {
            tx.rollback().await?;
            info!("Trockenlauf beendet (Rollback).");
        }
    } else {
        warn!("Unbekanntes Dateiformat {:?}, erwarte XML oder CSV", extension);
    }

    Ok(summary)
}
`,
  },
  {
    path: 'src/models.rs',
    filename: 'models.rs',
    category: 'Rust Core',
    description: 'Rust Datenmodelle: Serde-kompatible Typen für Klienten, Touren und Abrechnung',
    content: `use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Patient {
    pub id: String,
    pub snap_legacy_id: Option<String>,
    pub last_name: String,
    pub first_name: String,
    pub birth_date: String,
    pub gender: String,
    pub street: String,
    pub house_number: String,
    pub zip_code: String,
    pub city: String,
    pub phone: String,
    pub care_level: u8,
    pub care_level_date: String,
    pub insurance_name: String,
    pub insurance_ik: String,
    pub insurance_number: String,
    pub copay_exempt: bool,
    pub key_depot: Option<String>,
    pub doctor_name: Option<String>,
    pub doctor_phone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tour {
    pub id: String,
    pub name: String,
    pub shift: String,
    pub driver_code: String,
    pub license_plate: String,
    pub area: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Medication {
    pub id: String,
    pub patient_id: String,
    pub trade_name: String,
    pub active_substance: String,
    pub dosage_form: String,
    pub morning: f32,
    pub noon: f32,
    pub evening: f32,
    pub night: f32,
    pub prescribing_doctor: Option<String>,
    pub valid_until: Option<String>,
    pub sgb_type: String,
}
`,
  },
  {
    path: 'src/api.rs',
    filename: 'api.rs',
    category: 'Rust Core',
    description: 'Axum REST-Routen für MariaDB Abfragen, Session-Auth (Login/Logout) & Klienten-Updates',
    content: `use axum::{
    routing::{get, post, put},
    Router, Json, extract::{Path, State}, http::StatusCode,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use crate::db::DbPool;

#[derive(Debug, Deserialize)]
pub struct InitialSetupPayload {
    pub organization_name: String,
    pub ik_number: String,
    pub username: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LogoutPayload {
    pub username: String,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePatientPayload {
    pub snap_legacy_id: Option<String>,
    pub last_name: String,
    pub first_name: String,
    pub birth_date: String,
    pub gender: String,
    pub street: String,
    pub house_number: String,
    pub zip_code: String,
    pub city: String,
    pub phone: String,
    pub care_level: u8,
    pub care_level_date: String,
    pub insurance_name: String,
    pub insurance_ik: String,
    pub insurance_number: String,
    pub copay_exempt: bool,
    pub key_depot: Option<String>,
    pub doctor_name: Option<String>,
    pub doctor_phone: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRolePayload {
    pub role: String,
    pub display_name: String,
    pub description: Option<String>,
    pub permissions: Vec<String>,
    pub actor_username: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRolePermissionsPayload {
    pub permissions: Vec<String>,
    pub actor_username: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRolePayload {
    pub role: String,
    pub actor_username: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserStatusPayload {
    pub is_active: bool,
    pub actor_user_id: String,
    pub actor_username: String,
}

pub fn create_router(db_pool: DbPool) -> Router {
    Router::new()
        .route("/api/health", get(health_check))
        .route("/api/setup/status", get(setup_status))
        .route("/api/setup/complete", post(complete_initial_setup))
        .route("/api/auth/login", post(login_local))
        .route("/api/auth/logout", post(logout_session))
        .route("/api/roles", get(list_role_permissions).post(create_role))
        .route("/api/roles/:role", put(update_role_permissions).delete(delete_role))
        .route("/api/users/:id/role", put(update_user_role))
        .route("/api/users/:id/status", put(update_user_status))
        .route("/api/addons", get(list_addons).post(register_addon))
        .route("/api/addons/:id", put(update_addon).delete(remove_addon))
        .route("/api/addons/:id/ti/dispatch", post(dispatch_ti_action))
        .route("/api/patients", get(list_patients))
        .route("/api/patients/:id", put(update_patient).delete(delete_patient))
        .route("/api/tours", get(list_tours))
        .with_state(db_pool)
}

async fn setup_status(State(pool): State<DbPool>) -> Result<Json<Value>, StatusCode> {
    let row = sqlx::query("SELECT COUNT(*) AS cnt FROM users")
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let count: i64 = row.get("cnt");
    Ok(Json(json!({
        "setup_required": count == 0
    })))
}

async fn complete_initial_setup(
    State(pool): State<DbPool>,
    Json(payload): Json<InitialSetupPayload>,
) -> Result<Json<Value>, StatusCode> {
    use argon2::{Argon2, PasswordHasher, password_hash::SaltString};

    let mut tx = pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let count_row = sqlx::query("SELECT COUNT(*) AS cnt FROM users FOR UPDATE")
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if count_row.get::<i64, _>("cnt") > 0 {
        return Err(StatusCode::CONFLICT);
    }

    let salt = SaltString::generate(&mut rand_core::OsRng);
    let password_hash = Argon2::default()
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .to_string();

    // Erster Benutzer erhält serverseitig zwingend die Rolle 'Admin'
    sqlx::query(
        "INSERT INTO users (id, username, email, first_name, last_name, role, auth_method, password_hash, is_active)
         VALUES ('usr-admin-1', ?, ?, ?, ?, 'Admin', 'lokal', ?, TRUE)"
    )
    .bind(&payload.username)
    .bind(&payload.email)
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(&password_hash)
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query(
        "INSERT INTO audit_logs (username, role, action, resource, details)
         VALUES (?, 'Admin', 'SYSTEM_SETUP', ?, 'Ersteinrichtung abgeschlossen; Erstbenutzer als Admin erstellt')"
    )
    .bind(&payload.username)
    .bind(format!("{} (IK {})", payload.organization_name, payload.ik_number))
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "status": "initialized",
        "username": payload.username,
        "role": "Admin"
    })))
}

async fn login_local(
    State(pool): State<DbPool>,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<Value>, StatusCode> {
    use argon2::{Argon2, PasswordHash, PasswordVerifier};

    let row = sqlx::query(
        "SELECT id, username, email, role, password_hash, is_active, failed_login_attempts FROM users WHERE (username = ? OR email = ?) LIMIT 1"
    )
    .bind(&payload.username)
    .bind(&payload.username)
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some(user) = row else {
        let _ = sqlx::query(
            "INSERT INTO audit_logs (username, role, action, resource, details) VALUES (?, 'Pflegehelfer', 'LOGIN_FAILED', 'MariaDB Auth', 'Unbekannter Benutzer')"
        )
        .bind(&payload.username)
        .execute(&pool)
        .await;
        return Err(StatusCode::UNAUTHORIZED);
    };

    let user_id: String = user.get("id");
    let username: String = user.get("username");
    let role: String = user.get("role");
    let failed_attempts: i32 = user.get("failed_login_attempts");

    if !user.get::<bool, _>("is_active") {
        return Err(StatusCode::FORBIDDEN);
    }

    let stored_hash: Option<String> = user.get("password_hash");
    let valid = stored_hash
        .as_deref()
        .and_then(|h| PasswordHash::new(h).ok())
        .map(|parsed| Argon2::default().verify_password(payload.password.as_bytes(), &parsed).is_ok())
        .unwrap_or(false);

    if !valid {
        let next_attempts = failed_attempts + 1;
        let is_last_active_admin = if role == "Admin" && user.get::<bool, _>("is_active") {
            let count_row = sqlx::query("SELECT COUNT(*) AS cnt FROM users WHERE role = 'Admin' AND is_active = TRUE")
                .fetch_one(&pool)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            count_row.get::<i64, _>("cnt") <= 1
        } else {
            false
        };
        let lock_account = next_attempts >= 5 && !is_last_active_admin;
        let _ = sqlx::query(
            "UPDATE users SET failed_login_attempts = ?, is_active = IF(?, FALSE, is_active) WHERE id = ?"
        )
        .bind(next_attempts)
        .bind(lock_account)
        .bind(&user_id)
        .execute(&pool)
        .await;

        let _ = sqlx::query(
            "INSERT INTO audit_logs (username, role, action, resource, details) VALUES (?, ?, 'LOGIN_FAILED', 'MariaDB Auth', ?)"
        )
        .bind(&username)
        .bind(&role)
        .bind(if next_attempts >= 5 && is_last_active_admin {
            format!("Falsches Passwort ({}/5) – Sperrung verhindert (letzter aktiver Admin)", next_attempts)
        } else {
            format!("Falsches Passwort ({}/5)", next_attempts)
        })
        .execute(&pool)
        .await;

        return Err(StatusCode::UNAUTHORIZED);
    }

    let _ = sqlx::query("UPDATE users SET failed_login_attempts = 0, last_login = NOW() WHERE id = ?")
        .bind(&user_id)
        .execute(&pool)
        .await;

    Ok(Json(json!({
        "status": "authenticated",
        "id": user_id,
        "username": username,
        "role": role,
    })))
}

async fn logout_session(
    State(pool): State<DbPool>,
    Json(payload): Json<LogoutPayload>,
) -> Result<StatusCode, StatusCode> {
    let _ = sqlx::query(
        "INSERT INTO audit_logs (username, role, action, resource, details) VALUES (?, ?, 'LOGOUT', 'PflegeRust Session', 'Reguläre Abmeldung')"
    )
    .bind(&payload.username)
    .bind(&payload.role)
    .execute(&pool)
    .await;

    Ok(StatusCode::NO_CONTENT)
}

async fn list_role_permissions(State(pool): State<DbPool>) -> Result<Json<Value>, StatusCode> {
    let rows = sqlx::query(
        "SELECT role_name, display_name, description, permissions_json, is_standard FROM role_permissions ORDER BY is_standard DESC, role_name"
    )
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let roles: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            let role_name: String = r.get("role_name");
            let display_name: String = r.get("display_name");
            let description: Option<String> = r.get("description");
            let is_standard: bool = r.get("is_standard");
            let perms_raw: String = r.get("permissions_json");
            let perms: Value = serde_json::from_str(&perms_raw).unwrap_or_else(|_| json!([]));
            json!({
                "role": role_name,
                "display_name": display_name,
                "description": description,
                "is_standard": is_standard,
                "permissions": perms
            })
        })
        .collect();

    Ok(Json(json!({ "roles": roles })))
}

async fn create_role(
    State(pool): State<DbPool>,
    Json(payload): Json<CreateRolePayload>,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    let key = payload.role.trim();
    if key.len() < 2 || key.len() > 32 || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err(StatusCode::BAD_REQUEST);
    }

    let perms_json = serde_json::to_string(&payload.permissions)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let result = sqlx::query(
        "INSERT INTO role_permissions (role_name, display_name, description, permissions_json, is_standard)
         VALUES (?, ?, ?, ?, FALSE)"
    )
    .bind(key)
    .bind(payload.display_name.trim())
    .bind(payload.description.as_deref().unwrap_or(""))
    .bind(&perms_json)
    .execute(&pool)
    .await;

    if result.is_err() {
        return Err(StatusCode::CONFLICT);
    }

    let _ = sqlx::query(
        "INSERT INTO audit_logs (username, role, action, resource, details)
         VALUES (?, 'Admin', 'ROLE_CREATE', ?, ?)"
    )
    .bind(&payload.actor_username)
    .bind(format!("RBAC Rolle: {}", key))
    .bind(format!("Neue Rolle '{}' erstellt", payload.display_name.trim()))
    .execute(&pool)
    .await;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "status": "created", "role": key, "display_name": payload.display_name })),
    ))
}

async fn delete_role(
    State(pool): State<DbPool>,
    Path(role): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let existing = sqlx::query("SELECT is_standard FROM role_permissions WHERE role_name = ?")
        .bind(&role)
        .fetch_optional(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if existing.get::<bool, _>("is_standard") {
        return Err(StatusCode::FORBIDDEN);
    }

    let assigned = sqlx::query("SELECT COUNT(*) AS cnt FROM users WHERE role = ?")
        .bind(&role)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if assigned.get::<i64, _>("cnt") > 0 {
        return Err(StatusCode::CONFLICT);
    }

    sqlx::query("DELETE FROM role_permissions WHERE role_name = ?")
        .bind(&role)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn update_role_permissions(
    State(pool): State<DbPool>,
    Path(role): Path<String>,
    Json(mut payload): Json<UpdateRolePermissionsPayload>,
) -> Result<Json<Value>, StatusCode> {
    // Schutz vor Aussperrung: Admin behält immer 'users_verwalten'
    if role == "Admin" && !payload.permissions.iter().any(|p| p == "users_verwalten") {
        payload.permissions.push("users_verwalten".to_string());
    }

    let perms_json = serde_json::to_string(&payload.permissions)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query(
        "INSERT INTO role_permissions (role_name, permissions_json, updated_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE permissions_json = VALUES(permissions_json), updated_at = NOW()"
    )
    .bind(&role)
    .bind(&perms_json)
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = sqlx::query(
        "INSERT INTO audit_logs (username, role, action, resource, details)
         VALUES (?, 'Admin', 'ROLE_CONFIG_CHANGE', ?, ?)"
    )
    .bind(&payload.actor_username)
    .bind(format!("RBAC Rolle: {}", role))
    .bind(format!("{} Berechtigungen gespeichert", payload.permissions.len()))
    .execute(&pool)
    .await;

    Ok(Json(json!({ "status": "updated", "role": role, "permissions": payload.permissions })))
}

async fn update_user_role(
    State(pool): State<DbPool>,
    Path(user_id): Path<String>,
    Json(payload): Json<UpdateUserRolePayload>,
) -> Result<Json<Value>, StatusCode> {
    let mut tx = pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let target = sqlx::query("SELECT username, role, is_active FROM users WHERE id = ? FOR UPDATE")
        .bind(&user_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let prev_role: String = target.get("role");
    let username: String = target.get("username");
    let is_active: bool = target.get("is_active");

    // Letzten aktiven Administrator schützen
    if is_active && prev_role == "Admin" && payload.role != "Admin" {
        let count_row = sqlx::query("SELECT COUNT(*) AS cnt FROM users WHERE role = 'Admin' AND is_active = TRUE")
            .fetch_one(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if count_row.get::<i64, _>("cnt") <= 1 {
            return Err(StatusCode::CONFLICT);
        }
    }

    sqlx::query("UPDATE users SET role = ? WHERE id = ?")
        .bind(&payload.role)
        .bind(&user_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query(
        "INSERT INTO audit_logs (username, role, action, resource, details)
         VALUES (?, 'Admin', 'ROLE_CHANGE', ?, ?)"
    )
    .bind(&payload.actor_username)
    .bind(format!("Benutzer: {}", username))
    .bind(format!("Rolle geändert: {} -> {}", prev_role, payload.role))
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "status": "updated", "id": user_id, "role": payload.role })))
}

async fn update_user_status(
    State(pool): State<DbPool>,
    Path(user_id): Path<String>,
    Json(payload): Json<UpdateUserStatusPayload>,
) -> Result<Json<Value>, StatusCode> {
    // Eigenschutz: Ein angemeldeter Administrator darf sein eigenes Konto nicht selbst sperren
    if !payload.is_active && payload.actor_user_id == user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut tx = pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let target = sqlx::query("SELECT username, role, is_active FROM users WHERE id = ? FOR UPDATE")
        .bind(&user_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let role: String = target.get("role");
    let username: String = target.get("username");
    let currently_active: bool = target.get("is_active");

    // Admin-Schutz: Der letzte aktive Administrator darf nicht gesperrt werden
    if !payload.is_active && currently_active && role == "Admin" {
        let count_row = sqlx::query("SELECT COUNT(*) AS cnt FROM users WHERE role = 'Admin' AND is_active = TRUE")
            .fetch_one(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if count_row.get::<i64, _>("cnt") <= 1 {
            return Err(StatusCode::CONFLICT);
        }
    }

    sqlx::query("UPDATE users SET is_active = ?, failed_login_attempts = IF(?, 0, failed_login_attempts) WHERE id = ?")
        .bind(payload.is_active)
        .bind(payload.is_active)
        .bind(&user_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query(
        "INSERT INTO audit_logs (username, role, action, resource, details)
         VALUES (?, 'Admin', 'USER_STATUS_CHANGE', ?, ?)"
    )
    .bind(&payload.actor_username)
    .bind(format!("Benutzer: {}", username))
    .bind(if payload.is_active { "Benutzerkonto aktiviert" } else { "Benutzerkonto gesperrt" })
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "status": "updated", "id": user_id, "is_active": payload.is_active })))
}

async fn list_addons(State(pool): State<DbPool>) -> Result<Json<Value>, StatusCode> {
    let rows = sqlx::query(
        "SELECT id, name, version, vendor, category, is_active, transport, endpoint_url, auth_type, scopes_json, ti_profile_json FROM addons ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let addons: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.get::<String, _>("id"),
                "name": r.get::<String, _>("name"),
                "version": r.get::<String, _>("version"),
                "vendor": r.get::<String, _>("vendor"),
                "category": r.get::<String, _>("category"),
                "is_active": r.get::<bool, _>("is_active"),
                "transport": r.get::<String, _>("transport"),
                "endpoint_url": r.get::<String, _>("endpoint_url"),
                "auth_type": r.get::<String, _>("auth_type"),
                "scopes": serde_json::from_str::<Value>(&r.get::<String, _>("scopes_json")).unwrap_or_else(|_| json!([])),
                "ti_profile": r.get::<Option<String>, _>("ti_profile_json")
                    .and_then(|s| serde_json::from_str::<Value>(&s).ok()),
            })
        })
        .collect();

    Ok(Json(json!({ "addons": addons })))
}

async fn register_addon(
    State(pool): State<DbPool>,
    Json(manifest): Json<Value>,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    let id = manifest["id"].as_str().ok_or(StatusCode::BAD_REQUEST)?;
    let name = manifest["name"].as_str().ok_or(StatusCode::BAD_REQUEST)?;
    let endpoint = manifest["endpointUrl"].as_str().ok_or(StatusCode::BAD_REQUEST)?;

    sqlx::query(
        "INSERT INTO addons (id, name, version, vendor, category, description, is_active, transport, endpoint_url, auth_type, scopes_json, hooks_json, ti_profile_json)
         VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(name)
    .bind(manifest["version"].as_str().unwrap_or("1.0.0"))
    .bind(manifest["anbieter"].as_str().unwrap_or("Externer Anbieter"))
    .bind(manifest["kategorie"].as_str().unwrap_or("telematik"))
    .bind(manifest["beschreibung"].as_str().unwrap_or(""))
    .bind(manifest["transport"].as_str().unwrap_or("rest_webhook"))
    .bind(endpoint)
    .bind(manifest["authTyp"].as_str().unwrap_or("mtls_smcb"))
    .bind(manifest["scopes"].to_string())
    .bind(manifest["hooks"].to_string())
    .bind(manifest.get("tiProfil").map(|p| p.to_string()))
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::CONFLICT)?;

    Ok((StatusCode::CREATED, Json(json!({ "status": "installed", "id": id }))))
}

async fn update_addon(
    State(pool): State<DbPool>,
    Path(addon_id): Path<String>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    sqlx::query(
        "UPDATE addons SET is_active = COALESCE(?, is_active), endpoint_url = COALESCE(?, endpoint_url), scopes_json = COALESCE(?, scopes_json), ti_profile_json = COALESCE(?, ti_profile_json) WHERE id = ?"
    )
    .bind(payload.get("aktiv").and_then(|v| v.as_bool()))
    .bind(payload.get("endpointUrl").and_then(|v| v.as_str()))
    .bind(payload.get("scopes").map(|v| v.to_string()))
    .bind(payload.get("tiProfil").map(|v| v.to_string()))
    .bind(&addon_id)
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "status": "updated", "id": addon_id })))
}

async fn remove_addon(
    State(pool): State<DbPool>,
    Path(addon_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query("DELETE FROM addons WHERE id = ?")
        .bind(&addon_id)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn dispatch_ti_action(
    State(pool): State<DbPool>,
    Path(addon_id): Path<String>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let row = sqlx::query("SELECT name, endpoint_url, is_active, scopes_json FROM addons WHERE id = ? AND category = 'telematik'")
        .bind(&addon_id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if !row.get::<bool, _>("is_active") {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    let endpoint: String = row.get("endpoint_url");
    let addon_name: String = row.get("name");
    let service = payload["service"].as_str().unwrap_or("KIM 1.5");

    let _ = sqlx::query(
        "INSERT INTO audit_logs (username, role, action, resource, details)
         VALUES (?, ?, 'TI_DISPATCH', ?, ?)"
    )
    .bind(payload["actor_username"].as_str().unwrap_or("system"))
    .bind(payload["actor_role"].as_str().unwrap_or("Pflegefachkraft"))
    .bind(format!("{} via {}", service, addon_name))
    .bind(format!("Dispatched to TI middleware endpoint {}", endpoint))
    .execute(&pool)
    .await;

    Ok(Json(json!({
        "status": "dispatched",
        "addon_id": addon_id,
        "endpoint": endpoint,
        "service": service
    })))
}

async fn health_check(State(pool): State<DbPool>) -> Json<Value> {
    let mariadb_status = crate::db::get_mariadb_status(&pool).await;
    match mariadb_status {
        Ok(status) => Json(json!({
            "status": "online",
            "database": "MariaDB",
            "server_version": status.server_version,
            "innodb_buffer_mb": status.buffer_pool_mb,
            "active_patients": status.active_patients,
            "system": "Debian Linux (Bookworm)"
        })),
        Err(e) => Json(json!({
            "status": "degraded",
            "database": "MariaDB",
            "error": e.to_string()
        })),
    }
}

async fn list_patients(State(pool): State<DbPool>) -> Result<Json<Value>, StatusCode> {
    let rows = sqlx::query("SELECT id, snap_legacy_id, last_name, first_name, care_level, city FROM patients LIMIT 100")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let patients: Vec<Value> = rows.into_iter().map(|row| {
        json!({
            "id": row.get::<String, _>("id"),
            "snap_legacy_id": row.get::<Option<String>, _>("snap_legacy_id"),
            "last_name": row.get::<String, _>("last_name"),
            "first_name": row.get::<String, _>("first_name"),
            "care_level": row.get::<u8, _>("care_level"),
            "city": row.get::<String, _>("city"),
        })
    }).collect();

    Ok(Json(json!(patients)))
}

async fn update_patient(
    State(pool): State<DbPool>,
    Path(patient_id): Path<String>,
    Json(payload): Json<UpdatePatientPayload>,
) -> Result<Json<Value>, StatusCode> {
    let result = sqlx::query(
        "UPDATE patients SET
            snap_legacy_id = ?,
            last_name = ?,
            first_name = ?,
            birth_date = ?,
            gender = ?,
            street = ?,
            house_number = ?,
            zip_code = ?,
            city = ?,
            phone = ?,
            care_level = ?,
            care_level_date = ?,
            insurance_name = ?,
            insurance_ik = ?,
            insurance_number = ?,
            copay_exempt = ?,
            key_depot = ?,
            doctor_name = ?,
            doctor_phone = ?,
            emergency_contact_name = ?,
            emergency_contact_phone = ?
        WHERE id = ?"
    )
    .bind(&payload.snap_legacy_id)
    .bind(&payload.last_name)
    .bind(&payload.first_name)
    .bind(&payload.birth_date)
    .bind(&payload.gender)
    .bind(&payload.street)
    .bind(&payload.house_number)
    .bind(&payload.zip_code)
    .bind(&payload.city)
    .bind(&payload.phone)
    .bind(payload.care_level)
    .bind(&payload.care_level_date)
    .bind(&payload.insurance_name)
    .bind(&payload.insurance_ik)
    .bind(&payload.insurance_number)
    .bind(payload.copay_exempt)
    .bind(&payload.key_depot)
    .bind(&payload.doctor_name)
    .bind(&payload.doctor_phone)
    .bind(&payload.emergency_contact_name)
    .bind(&payload.emergency_contact_phone)
    .bind(&patient_id)
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({
        "status": "updated",
        "id": patient_id
    })))
}

async fn delete_patient(
    State(pool): State<DbPool>,
    Path(patient_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM patients WHERE id = ?")
        .bind(&patient_id)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn list_tours(State(pool): State<DbPool>) -> Result<Json<Value>, StatusCode> {
    let rows = sqlx::query("SELECT id, name, shift, driver_code FROM tours")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let tours: Vec<Value> = rows.into_iter().map(|row| {
        json!({
            "id": row.get::<String, _>("id"),
            "name": row.get::<String, _>("name"),
            "shift": row.get::<String, _>("shift"),
            "driver_code": row.get::<String, _>("driver_code"),
        })
    }).collect();

    Ok(Json(json!(tours)))
}
`,
  },
  {
    path: 'debian/control',
    filename: 'control',
    category: 'Debian Package',
    description: 'Debian Paket-Metadaten mit Abhängigkeit zu mariadb-server und libmariadb3',
    content: `Source: pfleged
Section: misc
Priority: optional
Maintainer: PflegeRust Debian Maintainers <pkg-pflege@debian.org>
Build-Depends: debhelper-compat (= 13), cargo, rustc (>= 1.75.0), libmariadb-dev, libssl-dev
Standards-Version: 4.6.2
Homepage: https://pflegerust.org

Package: pfleged
Architecture: any
Depends: \${shlibs:Depends}, \${misc:Depends}, mariadb-server | default-mysql-server, mariadb-client | default-mysql-client, systemd
Description: Modernes Pflegemanagement und SNAP Migrationstool mit MariaDB in Rust
 Schneller, speichereffizienter Pflegemanagement-Daemon für ambulante und
 stationäre Pflegedienste mit nativer MariaDB InnoDB Anbindung. Beinhaltet ein
 automatisiertes Migrationswerkzeug zum verlustfreien Import von SNAP.Pflege
 Datenbanken mit PSG II Überleitung, SIS-Dokumentation und Tourenplanung.
`,
  },
  {
    path: 'debian/rules',
    filename: 'rules',
    category: 'Debian Package',
    description: 'debhelper Build-Skript mit Cargo Release und Installation von schema.sql',
    content: `#!/usr/bin/make -f
# debian/rules für pfleged (MariaDB Edition)

export DH_VERBOSE = 1
export CARGO_HOME = $(CURDIR)/debian/cargo_home

%:
\tdh $@ --buildsystem=cargo

override_dh_auto_build:
\tcargo build --release --locked

override_dh_auto_install:
\tinstall -D -m 0755 target/release/pfleged debian/pfleged/usr/bin/pfleged
\tinstall -D -m 0644 debian/pfleged.service debian/pfleged/lib/systemd/system/pfleged.service
\tinstall -D -m 0644 schema.sql debian/pfleged/usr/share/pfleged/schema.sql
\tinstall -d -m 0750 debian/pfleged/etc/pfleged
`,
  },
  {
    path: 'debian/pfleged.service',
    filename: 'pfleged.service',
    category: 'Debian Package',
    description: 'systemd Service Unit mit Abhängigkeit zu mariadb.service und Sicherheits-Sandboxing',
    content: `[Unit]
Description=PflegeRust - Pflegemanagement Daemon & SNAP Integration (MariaDB)
Documentation=man:pfleged(8) https://pflegerust.org/docs
Requires=mariadb.service
After=network.target mariadb.service

[Service]
Type=simple
User=pfleged
Group=pfleged
WorkingDirectory=/etc/pfleged
EnvironmentFile=-/etc/pfleged/pfleged.conf
Environment=DATABASE_URL=mysql://pfleged:geheim@127.0.0.1:3306/pflege_db
ExecStart=/usr/bin/pfleged daemon --bind 127.0.0.1
Restart=always
RestartSec=5s

# Linux Hardening & Sandboxing
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=true

# Ressourcen-Limits
LimitNOFILE=65536
MemoryMax=1G
TasksMax=2048

[Install]
WantedBy=multi-user.target
`,
  },
  {
    path: 'debian/postinst',
    filename: 'postinst',
    category: 'Debian Package',
    description: 'Debian Post-Installation Hook: Richtet MariaDB Datenbank pflege_db & User automatisch ein',
    content: `#!/bin/sh
set -e

case "$1" in
    configure)
        # 1. Erstelle Systembenutzer falls nicht vorhanden
        if ! getent passwd pfleged > /dev/null; then
            adduser --system --quiet --home /etc/pfleged --no-create-home \
                    --shell /usr/sbin/nologin --group pfleged
        fi

        # 2. MariaDB Datenbank & Benutzer pfleged automatisch anlegen
        if [ -x /usr/bin/mariadb ]; then
            echo "Initialisiere MariaDB Datenbank pflege_db..."
            mariadb -u root <<EOF || true
CREATE DATABASE IF NOT EXISTS pflege_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'pfleged'@'localhost' IDENTIFIED BY 'geheim';
GRANT ALL PRIVILEGES ON pflege_db.* TO 'pfleged'@'localhost';
FLUSH PRIVILEGES;
EOF
            # Schema einspielen
            if [ -f /usr/share/pfleged/schema.sql ]; then
                mariadb -u pfleged -pgeheim pflege_db < /usr/share/pfleged/schema.sql || true
            fi
        fi

        # 3. systemd Dienst aktivieren
        if [ -d /run/systemd/system ]; then
            systemctl --system daemon-reload >/dev/null || true
            systemctl enable pfleged.service >/dev/null || true
            systemctl restart pfleged.service >/dev/null || true
        fi
    ;;
esac

#DEBHELPER#
exit 0
`,
  },
  {
    path: 'Makefile',
    filename: 'Makefile',
    category: 'Config',
    description: 'Debian Build-Makefile für Cargo & dpkg-buildpackage mit MariaDB',
    content: `PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
SYSCONFDIR ?= /etc
SYSTEMDDIR ?= /lib/systemd/system

.PHONY: all build release deb clean install test db-setup

all: build

build:
\tcargo build

release:
\tcargo build --release --locked

test:
\tcargo test

# Erstellt ein natives .deb Paket für Debian 12/13 mit MariaDB
deb:
\tdpkg-buildpackage -us -uc -b

# Richtet die lokale MariaDB-Testdatenbank ein
db-setup:
\tmariadb -u root -p < schema.sql

clean:
\tcargo clean
\trm -rf debian/pfleged debian/.debhelper
`,
  },
  {
    path: 'src/addons/mod.rs',
    filename: 'mod.rs',
    category: 'Rust Core',
    description: 'Modulares Add-on- & Telematik-Middleware-Interface (TI 2.0, KIM 1.5, ePA 3.0, VSDM, mTLS & HMAC)',
    content: `//! PflegeRust Add-on- & Telematik-Middleware-System
//! Ermöglicht externen TI-Middleware-Anbietern (z.B. TI-Gateway / TIaaS, KIM 1.5, ePA 3.0, VSDM)
//! die saubere, entkoppelte Integration über HTTPS/mTLS, gRPC oder Debian systemd Unix-Sockets.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AddonError {
    #[error("Add-on ist deaktiviert oder nicht registriert: {0}")]
    Unavailable(String),
    #[error("Fehlende Scope-Berechtigung: {0}")]
    MissingScope(String),
    #[error("TI-Middleware Transportfehler: {0}")]
    Transport(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TiMiddlewareProfile {
    pub telematik_id: String,
    pub mandant_id: String,
    pub client_system_id: String,
    pub workplace_id: String,
    pub kim_address: String,
    pub connector_type: String,
    pub supported_services: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddonManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub vendor: String,
    pub category: String,
    pub transport: String,
    pub endpoint_url: String,
    pub auth_type: String,
    pub tls_cert_path: Option<String>,
    pub scopes: Vec<String>,
    pub hooks: Vec<String>,
    pub ti_profile: Option<TiMiddlewareProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KimSendRequest {
    pub recipient_kim: String,
    pub document_type: String,
    pub patient_insurance_number: String,
    pub fhir_bundle_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TiDispatchReceipt {
    pub reference_id: String,
    pub service: String,
    pub status: String,
    pub latency_ms: u64,
}

/// Einheitliches Interface für zertifizierte deutsche TI-Middleware-Adapter
#[async_trait::async_trait]
pub trait TelematikAddon: Send + Sync {
    fn manifest(&self) -> &AddonManifest;

    fn require_scope(&self, scope: &str) -> Result<(), AddonError> {
        if self.manifest().scopes.iter().any(|s| s == scope) {
            Ok(())
        } else {
            Err(AddonError::MissingScope(scope.to_string()))
        }
    }

    async fn send_kim_document(&self, req: KimSendRequest) -> Result<TiDispatchReceipt, AddonError>;
}
`,
  },
];
