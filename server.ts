import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response, NextFunction } from 'express';
import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = Number.parseInt(process.env.PORT || process.env.PFLEGERUST_PORT || (IS_PROD ? '8080' : '3000'), 10);
const HOST = process.env.HOST || process.env.PFLEGERUST_HOST || '0.0.0.0';
const ALLOW_MEMORY_FALLBACK =
  process.env.ALLOW_MEMORY_FALLBACK === 'true' || (!IS_PROD && !process.env.DB_PASSWORD);

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME || 'pflege_db',
  user: process.env.DB_USER || 'pfleged',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true',
};

const MAX_LOGIN_ATTEMPTS = 5;
const SESSION_TTL_HOURS = 12;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const ALLOWED_SECTIONS = new Set([
  'einrichtung',
  'benutzer',
  'rollenConfig',
  'klienten',
  'touren',
  'ssoConfig',
  'addons',
  'tiTransaktionen',
  'auditLogs',
  'mariaDbConfig',
]);

interface ServerSession {
  tokenHash: string;
  userId: string;
  username: string;
  role: string;
  expiresAt: number;
}

interface AuthChallenge {
  id: string;
  userId: string;
  type: 'mfa' | 'password_change';
  authLabel: string;
  expiresAt: number;
}

interface AppUserRecord {
  id: string;
  benutzername: string;
  email: string;
  vorname: string;
  name: string;
  rolle: string;
  authMethode: 'lokal' | 'oidc_keycloak' | 'entra_id' | 'google_sso';
  abteilung: string;
  aktiv: boolean;
  letzterLogin: string;
  erstelltAm: string;
  passwortSalt?: string;
  passwortHash?: string;
  fehlversuche?: number;
  mussPasswortAendern?: boolean;
  zweiFaktorPflicht?: boolean;
  zweiFaktor?: {
    aktiviert: boolean;
    totpAktiviert: boolean;
    totpSecret?: string;
    totpEingerichtetAm?: string;
    backupCodeHashes?: string[];
    sicherheitsSchluessel: Array<{
      id: string;
      credentialId: string;
      bezeichnung: string;
      transport?: string;
      erstelltAm: string;
      zuletztVerwendet?: string;
      publicKeyJwk?: Record<string, unknown>;
      modus: 'webauthn' | 'ecdsa_sandbox';
    }>;
    passkeys: Array<{
      id: string;
      credentialId: string;
      bezeichnung: string;
      geraeteTyp?: string;
      erstelltAm: string;
      zuletztVerwendet?: string;
      publicKeyJwk?: Record<string, unknown>;
      modus: 'webauthn' | 'ecdsa_sandbox';
    }>;
  };
}

interface RoleDefRecord {
  rolle: string;
  bezeichnung: string;
  berechtigungen: string[];
  zweiFaktorPflicht?: boolean;
}

interface AuthedRequest extends Request {
  session?: ServerSession;
  currentUser?: AppUserRecord;
}

// ============================================================================
// Persistence Layer (MariaDB InnoDB with optional dev-only memory fallback)
// ============================================================================

let dbPool: Pool | null = null;
let storageMode: 'mariadb' | 'preview-memory' = 'preview-memory';
let dbVersion = '';
let lastDbError = '';

const memoryState = new Map<string, unknown>();
const memorySessions = new Map<string, ServerSession>();
const authChallenges = new Map<string, AuthChallenge>();
let memorySetupCompleted = false;

async function initDatabase(): Promise<void> {
  try {
    const pool = mysql.createPool({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      database: DB_CONFIG.database,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      ssl: DB_CONFIG.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT VERSION() AS version');
      dbVersion = String(rows[0]?.version || 'MariaDB');

      await conn.query(`
        CREATE TABLE IF NOT EXISTS pflegerust_meta (
          id TINYINT NOT NULL PRIMARY KEY,
          setup_completed TINYINT(1) NOT NULL DEFAULT 0,
          einrichtung_name VARCHAR(255) NOT NULL DEFAULT '',
          ik_nummer VARCHAR(32) NOT NULL DEFAULT '',
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await conn.query(`
        INSERT IGNORE INTO pflegerust_meta (id, setup_completed) VALUES (1, 0)
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS pflegerust_state (
          section VARCHAR(64) NOT NULL PRIMARY KEY,
          payload LONGTEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS pflegerust_sessions (
          token_hash CHAR(64) NOT NULL PRIMARY KEY,
          user_id VARCHAR(128) NOT NULL,
          username VARCHAR(128) NOT NULL,
          role VARCHAR(128) NOT NULL,
          expires_at BIGINT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_sessions_user (user_id),
          INDEX idx_sessions_exp (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Prune expired sessions on startup
      await conn.query('DELETE FROM pflegerust_sessions WHERE expires_at < ?', [Date.now()]);
    } finally {
      conn.release();
    }

    dbPool = pool;
    storageMode = 'mariadb';
    lastDbError = '';
    console.log(
      `[PflegeRust] MariaDB verbunden: ${DB_CONFIG.user}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database} (${dbVersion})`
    );
  } catch (err) {
    lastDbError = err instanceof Error ? err.message : 'Unbekannter MariaDB-Fehler';
    if (!ALLOW_MEMORY_FALLBACK) {
      console.error(`[PflegeRust] KRITISCH: MariaDB-Verbindung fehlgeschlagen: ${lastDbError}`);
      throw err;
    }
    dbPool = null;
    storageMode = 'preview-memory';
    console.warn(
      `[PflegeRust] Hinweis: MariaDB lokal nicht erreichbar (${lastDbError}) – nutze Entwicklungs-Vorschaumodus (In-Memory).`
    );
  }
}

async function isSetupCompleted(): Promise<boolean> {
  if (storageMode === 'mariadb' && dbPool) {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT setup_completed FROM pflegerust_meta WHERE id = 1'
    );
    return Boolean(rows[0]?.setup_completed);
  }
  return memorySetupCompleted;
}

async function markSetupCompleted(einrichtungName: string, ikNummer: string): Promise<void> {
  if (storageMode === 'mariadb' && dbPool) {
    await dbPool.query(
      'INSERT INTO pflegerust_meta (id, setup_completed, einrichtung_name, ik_nummer) VALUES (1, 1, ?, ?) ON DUPLICATE KEY UPDATE setup_completed = 1, einrichtung_name = VALUES(einrichtung_name), ik_nummer = VALUES(ik_nummer)',
      [einrichtungName, ikNummer]
    );
    return;
  }
  memorySetupCompleted = true;
}

async function getSection<T>(section: string): Promise<T | null> {
  if (storageMode === 'mariadb' && dbPool) {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT payload FROM pflegerust_state WHERE section = ?',
      [section]
    );
    if (!rows.length) return null;
    try {
      return JSON.parse(String(rows[0].payload)) as T;
    } catch {
      return null;
    }
  }
  return (memoryState.get(section) as T | undefined) ?? null;
}

async function setSection(section: string, data: unknown): Promise<void> {
  const serialized = JSON.stringify(data);
  if (storageMode === 'mariadb' && dbPool) {
    await dbPool.query(
      'INSERT INTO pflegerust_state (section, payload) VALUES (?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)',
      [section, serialized]
    );
    return;
  }
  memoryState.set(section, JSON.parse(serialized));
}

async function getAllState(): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  if (storageMode === 'mariadb' && dbPool) {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT section, payload FROM pflegerust_state'
    );
    for (const row of rows) {
      try {
        result[String(row.section)] = JSON.parse(String(row.payload));
      } catch {
        // Skip malformed entry
      }
    }
    return result;
  }
  for (const [k, v] of memoryState.entries()) {
    result[k] = v;
  }
  return result;
}

// ============================================================================
// Server-Side Crypto & Auth Helpers (PBKDF2-SHA256, RFC 6238 TOTP, Sessions)
// ============================================================================

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function timingSafeStringEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPbkdf2Password(
  password: string,
  salt: string | undefined,
  expectedHash: string | undefined
): boolean {
  if (!password || !salt || !expectedHash) return false;
  const derived = crypto
    .pbkdf2Sync(password, `pflegerust-v1:${salt}`, 60000, 32, 'sha256')
    .toString('hex');
  const computed = `pbkdf2_sha256$60000$${derived}`;
  return timingSafeStringEquals(computed, expectedHash);
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateTotpCodeServer(secret: string, timestampMs = Date.now()): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(timestampMs / 1000 / 30);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function verifyTotpCodeServer(secret: string | undefined, rawInput: string): boolean {
  if (!secret) return false;
  const normalized = rawInput.replace(/\D/g, '');
  if (normalized.length !== 6) return false;
  const now = Date.now();
  for (let delta = -1; delta <= 1; delta++) {
    const candidate = generateTotpCodeServer(secret, now + delta * 30_000);
    if (timingSafeStringEquals(candidate, normalized)) {
      return true;
    }
  }
  return false;
}

function hasActive2fa(user: AppUserRecord): boolean {
  const mfa = user.zweiFaktor;
  if (!mfa) return false;
  return Boolean(mfa.totpAktiviert && mfa.totpSecret) || (mfa.sicherheitsSchluessel?.length ?? 0) > 0;
}

function isLastActiveAdmin(users: AppUserRecord[], targetUserId: string): boolean {
  const activeAdmins = users.filter((u) => u.rolle === 'Admin' && u.aktiv);
  return activeAdmins.length === 1 && activeAdmins[0].id === targetUserId;
}

async function createSession(user: AppUserRecord): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000;

  if (storageMode === 'mariadb' && dbPool) {
    await dbPool.query(
      'INSERT INTO pflegerust_sessions (token_hash, user_id, username, role, expires_at) VALUES (?, ?, ?, ?, ?)',
      [tokenHash, user.id, user.benutzername, user.rolle, expiresAt]
    );
  } else {
    memorySessions.set(tokenHash, {
      tokenHash,
      userId: user.id,
      username: user.benutzername,
      role: user.rolle,
      expiresAt,
    });
  }
  return rawToken;
}

async function lookupSession(rawToken: string): Promise<ServerSession | null> {
  if (!rawToken || rawToken.length < 32) return null;
  const tokenHash = sha256Hex(rawToken);
  const now = Date.now();

  if (storageMode === 'mariadb' && dbPool) {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT token_hash, user_id, username, role, expires_at FROM pflegerust_sessions WHERE token_hash = ?',
      [tokenHash]
    );
    if (!rows.length) return null;
    const expiresAt = Number(rows[0].expires_at);
    if (expiresAt < now) {
      await dbPool.query('DELETE FROM pflegerust_sessions WHERE token_hash = ?', [tokenHash]);
      return null;
    }
    return {
      tokenHash,
      userId: String(rows[0].user_id),
      username: String(rows[0].username),
      role: String(rows[0].role),
      expiresAt,
    };
  }

  const sess = memorySessions.get(tokenHash);
  if (!sess) return null;
  if (sess.expiresAt < now) {
    memorySessions.delete(tokenHash);
    return null;
  }
  return sess;
}

async function revokeSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = sha256Hex(rawToken);
  if (storageMode === 'mariadb' && dbPool) {
    await dbPool.query('DELETE FROM pflegerust_sessions WHERE token_hash = ?', [tokenHash]);
  } else {
    memorySessions.delete(tokenHash);
  }
}

function createChallenge(userId: string, type: AuthChallenge['type'], authLabel: string): string {
  const id = crypto.randomBytes(24).toString('hex');
  authChallenges.set(id, {
    id,
    userId,
    type,
    authLabel,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
  // Prune expired challenges
  const now = Date.now();
  for (const [k, c] of authChallenges.entries()) {
    if (c.expiresAt < now) authChallenges.delete(k);
  }
  return id;
}

function consumeChallenge(id: string, expectedType: AuthChallenge['type']): AuthChallenge | null {
  const c = authChallenges.get(id);
  if (!c) return null;
  if (c.expiresAt < Date.now() || c.type !== expectedType) {
    authChallenges.delete(id);
    return null;
  }
  authChallenges.delete(id);
  return c;
}

function getBearerToken(req: Request): string {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

function toPublicUserInfo(user: AppUserRecord) {
  return {
    id: user.id,
    benutzername: user.benutzername,
    email: user.email,
    vorname: user.vorname,
    name: user.name,
    rolle: user.rolle,
    authMethode: user.authMethode,
    abteilung: user.abteilung,
    hasTotp: Boolean(user.zweiFaktor?.totpAktiviert && user.zweiFaktor?.totpSecret),
    securityKeys: (user.zweiFaktor?.sicherheitsSchluessel || []).map((k) => ({
      id: k.id,
      credentialId: k.credentialId,
      bezeichnung: k.bezeichnung,
      modus: k.modus,
      publicKeyJwk: k.publicKeyJwk,
    })),
    hasBackupCodes: (user.zweiFaktor?.backupCodeHashes?.length || 0) > 0,
  };
}

function getPublicDbInfo() {
  return {
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    database: DB_CONFIG.database,
    user: DB_CONFIG.user,
    ssl: DB_CONFIG.ssl,
    connected: storageMode === 'mariadb',
    storageMode,
    version: dbVersion || (storageMode === 'mariadb' ? 'MariaDB 10.11' : 'Vorschau-Speicher'),
    preconfigured: storageMode === 'mariadb',
  };
}

async function appendAuditLog(
  benutzer: string,
  rolle: string,
  aktion: string,
  ressource: string,
  details: string,
  ipAdresse = '127.0.0.1'
): Promise<void> {
  const existing = (await getSection<Array<Record<string, unknown>>>('auditLogs')) || [];
  const entry = {
    id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    zeitstempel: new Date().toISOString().replace('T', ' ').slice(0, 19),
    benutzer,
    rolle,
    aktion,
    ressource,
    details,
    ipAdresse,
  };
  await setSection('auditLogs', [entry, ...existing].slice(0, 500));
}

function userHasPermission(
  roleName: string,
  permission: string,
  rollenConfig: Record<string, RoleDefRecord> | null
): boolean {
  if (roleName === 'Admin') return true;
  const def = rollenConfig?.[roleName];
  if (!def) return false;
  return def.berechtigungen.includes(permission);
}

// Auth middleware for protected routes
async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = getBearerToken(req);
    const session = await lookupSession(token);
    if (!session) {
      res.status(401).json({ error: 'Nicht angemeldet oder Sitzung abgelaufen.' });
      return;
    }
    const users = (await getSection<AppUserRecord[]>('benutzer')) || [];
    const currentUser = users.find((u) => u.id === session.userId);
    if (!currentUser || !currentUser.aktiv) {
      await revokeSession(token);
      res.status(403).json({ error: 'Benutzerkonto ist deaktiviert oder gesperrt.' });
      return;
    }
    req.session = session;
    req.currentUser = currentUser;
    next();
  } catch (err) {
    console.error('[PflegeRust] Auth-Fehler:', err);
    res.status(500).json({ error: 'Interner Authentifizierungsfehler.' });
  }
}

// ============================================================================
// Express App & API Routes
// ============================================================================

async function startServer(): Promise<void> {
  await initDatabase();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  // Basic security headers on all responses
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Public health check (Docker HEALTHCHECK & systemd probes)
  app.get('/api/health', async (_req, res) => {
    try {
      let liveConnected = storageMode === 'mariadb';
      if (storageMode === 'mariadb' && dbPool) {
        await dbPool.query('SELECT 1');
        liveConnected = true;
      }
      const setupDone = await isSetupCompleted();
      res.json({
        ok: true,
        setupCompleted: setupDone,
        databaseConnected: liveConnected,
        storageMode,
        dbInfo: getPublicDbInfo(),
      });
    } catch (err) {
      res.status(503).json({
        ok: false,
        databaseConnected: false,
        storageMode,
        error: err instanceof Error ? err.message : 'Datenbank nicht erreichbar',
      });
    }
  });

  // Public bootstrap (never leaks users, hashes, secrets, or client records!)
  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const setupDone = await isSetupCompleted();
      const einrichtung = await getSection<Record<string, unknown>>('einrichtung');
      const ssoConfig = await getSection<Record<string, unknown>>('ssoConfig');
      const users = (await getSection<AppUserRecord[]>('benutzer')) || [];
      const hasPasskeys = users.some(
        (u) => u.aktiv && (u.zweiFaktor?.passkeys?.length || 0) > 0
      );

      res.json({
        setupCompleted: setupDone && users.length > 0,
        dbInfo: getPublicDbInfo(),
        einrichtung: setupDone ? einrichtung : null,
        ssoPublic:
          setupDone && ssoConfig
            ? {
                aktiviert: Boolean(ssoConfig.aktiviert),
                providerName: String(ssoConfig.providerName || ''),
                providerTyp: String(ssoConfig.providerTyp || 'keycloak'),
                issuerUrl: String(ssoConfig.issuerUrl || ''),
                clientId: String(ssoConfig.clientId || ''),
                erlaubeLokalenLogin: ssoConfig.erlaubeLokalenLogin !== false,
              }
            : null,
        hasRegisteredPasskeys: setupDone && hasPasskeys,
      });
    } catch (err) {
      console.error('[PflegeRust] Bootstrap-Fehler:', err);
      res.status(500).json({ error: 'Systemstatus konnte nicht geladen werden.' });
    }
  });

  // Live MariaDB connection test (tests server-configured MariaDB pool)
  app.post('/api/db/test', async (_req, res) => {
    try {
      if (storageMode === 'mariadb' && dbPool) {
        const [rows] = await dbPool.query<RowDataPacket[]>(
          'SELECT VERSION() AS version, DATABASE() AS db'
        );
        dbVersion = String(rows[0]?.version || dbVersion);
        res.json({
          ok: true,
          connected: true,
          storageMode: 'mariadb',
          version: dbVersion,
          database: String(rows[0]?.db || DB_CONFIG.database),
          host: DB_CONFIG.host,
          port: DB_CONFIG.port,
          user: DB_CONFIG.user,
        });
        return;
      }

      // Attempt fresh reconnect in case MariaDB came up after server start
      await initDatabase();
      if (storageMode === 'mariadb' && dbPool) {
        res.json({
          ok: true,
          connected: true,
          storageMode: 'mariadb',
          version: dbVersion,
          database: DB_CONFIG.database,
          host: DB_CONFIG.host,
          port: DB_CONFIG.port,
          user: DB_CONFIG.user,
        });
        return;
      }

      res.json({
        ok: true,
        connected: false,
        storageMode: 'preview-memory',
        version: 'Vorschau-Modus (lokal ohne MariaDB-Daemon)',
        database: DB_CONFIG.database,
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        note: lastDbError,
      });
    } catch (err) {
      res.status(503).json({
        ok: false,
        connected: false,
        error: err instanceof Error ? err.message : 'MariaDB-Verbindungstest fehlgeschlagen.',
      });
    }
  });

  // One-time Initial Setup Wizard completion (strictly locked once setup_completed = 1)
  app.post('/api/setup/complete', async (req, res) => {
    try {
      const alreadyDone = await isSetupCompleted();
      const existingUsers = (await getSection<AppUserRecord[]>('benutzer')) || [];
      if (alreadyDone && existingUsers.length > 0) {
        res.status(409).json({
          error: 'Die Ersteinrichtung wurde bereits abgeschlossen. Bitte melden Sie sich an.',
        });
        return;
      }

      const {
        einrichtung,
        mariaDbConfig,
        adminUser,
        ssoConfig,
        rollenConfig,
        klienten,
        touren,
        addons,
        tiTransaktionen,
      } = req.body || {};

      if (
        !einrichtung ||
        typeof einrichtung.name !== 'string' ||
        !einrichtung.name.trim() ||
        !adminUser ||
        typeof adminUser.benutzername !== 'string' ||
        adminUser.benutzername.trim().length < 3 ||
        typeof adminUser.passwortHash !== 'string' ||
        !adminUser.passwortHash.startsWith('pbkdf2_sha256$') ||
        typeof adminUser.passwortSalt !== 'string'
      ) {
        res.status(400).json({ error: 'Unvollständige Angaben für Einrichtung oder Administrator.' });
        return;
      }

      // Server-side defense-in-depth: first user ALWAYS gets role 'Admin'
      const firstAdmin: AppUserRecord = {
        ...adminUser,
        id: 'usr-admin-1',
        benutzername: adminUser.benutzername.trim(),
        email: String(adminUser.email || '').trim(),
        vorname: String(adminUser.vorname || '').trim(),
        name: String(adminUser.name || '').trim(),
        rolle: 'Admin',
        authMethode: 'lokal',
        aktiv: true,
        fehlversuche: 0,
        mussPasswortAendern: false,
        zweiFaktorPflicht: false,
        zweiFaktor: {
          aktiviert: false,
          totpAktiviert: false,
          sicherheitsSchluessel: [],
          passkeys: [],
        },
      };

      const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const fullName = `${firstAdmin.vorname} ${firstAdmin.name}`.trim();
      const initialAudit = [
        {
          id: `aud-setup-login-${Date.now()}`,
          zeitstempel: nowTs,
          benutzer: firstAdmin.benutzername,
          rolle: 'Admin',
          aktion: 'LOGIN_SUCCESS',
          ressource: storageMode === 'mariadb' ? 'MariaDB Auth (PBKDF2)' : 'Auth (Vorschau)',
          details: `Erstanmeldung als Systemadministrator ${fullName} (Admin)`,
          ipAdresse: req.ip || '127.0.0.1',
        },
        {
          id: `aud-setup-${Date.now() - 1}`,
          zeitstempel: nowTs,
          benutzer: firstAdmin.benutzername,
          rolle: 'Admin',
          aktion: 'SYSTEM_SETUP',
          ressource: `Einrichtung: ${einrichtung.name} (IK ${einrichtung.ikNummer || ''})`,
          details: `Ersteinrichtung dauerhaft in ${storageMode === 'mariadb' ? `MariaDB (${DB_CONFIG.database})` : 'Vorschau-Speicher'} gespeichert; Erstbenutzer mit Rolle Admin angelegt`,
          ipAdresse: req.ip || '127.0.0.1',
        },
      ];

      await setSection('einrichtung', einrichtung);
      await setSection('mariaDbConfig', {
        ...(mariaDbConfig || {}),
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        database: DB_CONFIG.database,
        user: DB_CONFIG.user,
      });
      await setSection('benutzer', [firstAdmin]);
      await setSection('rollenConfig', rollenConfig || {});
      await setSection('klienten', Array.isArray(klienten) ? klienten : []);
      await setSection('touren', Array.isArray(touren) ? touren : []);
      await setSection('ssoConfig', ssoConfig || {});
      await setSection('addons', Array.isArray(addons) ? addons : []);
      await setSection('tiTransaktionen', Array.isArray(tiTransaktionen) ? tiTransaktionen : []);
      await setSection('auditLogs', initialAudit);
      await markSetupCompleted(String(einrichtung.name), String(einrichtung.ikNummer || ''));

      const token = await createSession(firstAdmin);
      const state = await getAllState();

      res.status(201).json({
        token,
        activeUser: {
          id: firstAdmin.id,
          benutzername: firstAdmin.benutzername,
          email: firstAdmin.email,
          name: fullName,
          role: 'Admin',
          auth: storageMode === 'mariadb' ? 'Lokal (MariaDB)' : 'Lokal',
          abteilung: firstAdmin.abteilung,
        },
        state,
        dbInfo: getPublicDbInfo(),
      });
    } catch (err) {
      console.error('[PflegeRust] Setup-Fehler:', err);
      res.status(500).json({ error: 'Ersteinrichtung konnte nicht in MariaDB gespeichert werden.' });
    }
  });

  // Server-side login (verifies PBKDF2-SHA256 hash on server, handles lockout, forced PW change & 2FA)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
        res.status(400).json({ error: 'Bitte Benutzername/E-Mail und Passwort angeben.' });
        return;
      }

      const normalized = identifier.trim().toLowerCase();
      const users = (await getSection<AppUserRecord[]>('benutzer')) || [];
      const userIdx = users.findIndex(
        (u) => u.benutzername.toLowerCase() === normalized || u.email.toLowerCase() === normalized
      );

      if (userIdx === -1) {
        await appendAuditLog(
          normalized,
          'Unbekannt',
          'LOGIN_FAILED',
          'MariaDB Auth',
          'Anmeldung mit unbekanntem Benutzernamen fehlgeschlagen',
          req.ip || '127.0.0.1'
        );
        res.status(401).json({ error: 'Ungültige Anmeldedaten oder Konto gesperrt.' });
        return;
      }

      const user = users[userIdx];
      if (!user.aktiv) {
        res.status(403).json({
          error: 'Dieses Benutzerkonto ist gesperrt. Bitte wenden Sie sich an einen Administrator.',
        });
        return;
      }

      if (user.authMethode !== 'lokal') {
        res.status(400).json({
          error: 'Dieses Konto nutzt Single Sign-On (SSO). Bitte melden Sie sich über Ihren Identitätsanbieter an.',
        });
        return;
      }

      const valid = verifyPbkdf2Password(password, user.passwortSalt, user.passwortHash);
      if (!valid) {
        const nextAttempts = (user.fehlversuche || 0) + 1;
        const protectLastAdmin = isLastActiveAdmin(users, user.id);
        const shouldLock = nextAttempts >= MAX_LOGIN_ATTEMPTS && !protectLastAdmin;

        users[userIdx] = {
          ...user,
          fehlversuche: nextAttempts,
          aktiv: shouldLock ? false : user.aktiv,
        };
        await setSection('benutzer', users);
        await appendAuditLog(
          user.benutzername,
          user.rolle,
          'LOGIN_FAILED',
          'MariaDB Auth',
          shouldLock
            ? `Konto nach ${MAX_LOGIN_ATTEMPTS} Fehlversuchen automatisch gesperrt`
            : `Fehlversuch ${nextAttempts} von ${MAX_LOGIN_ATTEMPTS}`,
          req.ip || '127.0.0.1'
        );

        res.status(401).json({
          error: shouldLock
            ? `Konto nach ${MAX_LOGIN_ATTEMPTS} Fehlversuchen automatisch gesperrt.`
            : 'Ungültige Anmeldedaten. Bitte prüfen Sie Benutzername und Passwort.',
        });
        return;
      }

      // Reset failed attempts on valid password
      const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
      users[userIdx] = {
        ...user,
        fehlversuche: 0,
        letzterLogin: nowStamp,
      };
      await setSection('benutzer', users);

      const authLabel = storageMode === 'mariadb' ? 'Lokal (MariaDB)' : 'Lokal';

      if (user.mussPasswortAendern) {
        const challengeToken = createChallenge(user.id, 'password_change', authLabel);
        res.json({
          status: 'password_change_required',
          challengeToken,
          user: toPublicUserInfo(users[userIdx]),
        });
        return;
      }

      if (hasActive2fa(users[userIdx])) {
        const challengeToken = createChallenge(user.id, 'mfa', authLabel);
        res.json({
          status: 'mfa_required',
          challengeToken,
          user: toPublicUserInfo(users[userIdx]),
        });
        return;
      }

      const token = await createSession(users[userIdx]);
      const fullName = `${user.vorname} ${user.name}`.trim();
      await appendAuditLog(
        user.benutzername,
        user.rolle,
        'LOGIN_SUCCESS',
        'MariaDB Auth (PBKDF2)',
        `Erfolgreiche Anmeldung als ${fullName} (${user.rolle})`,
        req.ip || '127.0.0.1'
      );

      const state = await getAllState();
      res.json({
        status: 'authenticated',
        token,
        activeUser: {
          id: user.id,
          benutzername: user.benutzername,
          email: user.email,
          name: fullName,
          role: user.rolle,
          auth: authLabel,
          abteilung: user.abteilung,
        },
        state,
      });
    } catch (err) {
      console.error('[PflegeRust] Login-Fehler:', err);
      res.status(500).json({ error: 'Anmeldung fehlgeschlagen.' });
    }
  });

  // Complete forced password change during login
  app.post('/api/auth/complete-password-change', async (req, res) => {
    try {
      const { challengeToken, passwortSalt, passwortHash } = req.body || {};
      if (
        typeof challengeToken !== 'string' ||
        typeof passwortSalt !== 'string' ||
        typeof passwortHash !== 'string' ||
        !passwortHash.startsWith('pbkdf2_sha256$')
      ) {
        res.status(400).json({ error: 'Ungültige Anfrage zur Passwortänderung.' });
        return;
      }

      const challenge = consumeChallenge(challengeToken, 'password_change');
      if (!challenge) {
        res.status(401).json({ error: 'Sitzungs-Challenge abgelaufen. Bitte erneut anmelden.' });
        return;
      }

      const users = (await getSection<AppUserRecord[]>('benutzer')) || [];
      const idx = users.findIndex((u) => u.id === challenge.userId);
      if (idx === -1 || !users[idx].aktiv) {
        res.status(403).json({ error: 'Benutzerkonto nicht verfügbar.' });
        return;
      }

      users[idx] = {
        ...users[idx],
        passwortSalt,
        passwortHash,
        mussPasswortAendern: false,
        fehlversuche: 0,
      };
      await setSection('benutzer', users);
      await appendAuditLog(
        users[idx].benutzername,
        users[idx].rolle,
        'PASSWORD_CHANGE',
        'MariaDB Auth',
        'Erzwungene Passwortänderung bei Anmeldung abgeschlossen',
        req.ip || '127.0.0.1'
      );

      if (hasActive2fa(users[idx])) {
        const nextChallenge = createChallenge(users[idx].id, 'mfa', challenge.authLabel);
        res.json({
          status: 'mfa_required',
          challengeToken: nextChallenge,
          user: toPublicUserInfo(users[idx]),
        });
        return;
      }

      const token = await createSession(users[idx]);
      const fullName = `${users[idx].vorname} ${users[idx].name}`.trim();
      const state = await getAllState();
      res.json({
        status: 'authenticated',
        token,
        activeUser: {
          id: users[idx].id,
          benutzername: users[idx].benutzername,
          email: users[idx].email,
          name: fullName,
          role: users[idx].rolle,
          auth: challenge.authLabel,
          abteilung: users[idx].abteilung,
        },
        state,
      });
    } catch (err) {
      console.error('[PflegeRust] Password-Change-Fehler:', err);
      res.status(500).json({ error: 'Passwortänderung fehlgeschlagen.' });
    }
  });

  // Server-side 2FA verification (TOTP, Backup Code, or Security Key)
  app.post('/api/auth/verify-mfa', async (req, res) => {
    try {
      const { challengeToken, method, code, credentialId } = req.body || {};
      if (typeof challengeToken !== 'string' || typeof method !== 'string') {
        res.status(400).json({ error: 'Ungültige 2FA-Anfrage.' });
        return;
      }

      const challenge = authChallenges.get(challengeToken);
      if (!challenge || challenge.type !== 'mfa' || challenge.expiresAt < Date.now()) {
        authChallenges.delete(challengeToken);
        res.status(401).json({ error: '2FA-Challenge abgelaufen. Bitte erneut anmelden.' });
        return;
      }

      const users = (await getSection<AppUserRecord[]>('benutzer')) || [];
      const idx = users.findIndex((u) => u.id === challenge.userId);
      if (idx === -1 || !users[idx].aktiv) {
        res.status(403).json({ error: 'Benutzerkonto nicht verfügbar.' });
        return;
      }

      const user = users[idx];
      let verified = false;
      let methodDesc = '';

      if (method === 'totp' && typeof code === 'string') {
        verified = verifyTotpCodeServer(user.zweiFaktor?.totpSecret, code);
        methodDesc = 'Authenticator-App (TOTP)';
      } else if (method === 'backup' && typeof code === 'string') {
        const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const hash = sha256Hex(`pflegerust-recovery-v1:${normalized}`);
        const hashes = user.zweiFaktor?.backupCodeHashes || [];
        const matchIdx = hashes.findIndex((h) => timingSafeStringEquals(h, hash));
        if (matchIdx !== -1 && user.zweiFaktor) {
          verified = true;
          methodDesc = 'Notfall-Wiederherstellungscode';
          const remaining = [...hashes];
          remaining.splice(matchIdx, 1);
          users[idx] = {
            ...user,
            zweiFaktor: {
              ...user.zweiFaktor,
              backupCodeHashes: remaining,
            },
          };
        }
      } else if (method === 'security_key' && typeof credentialId === 'string') {
        const key = (user.zweiFaktor?.sicherheitsSchluessel || []).find(
          (k) => k.credentialId === credentialId
        );
        if (key && user.zweiFaktor) {
          verified = true;
          methodDesc = `FIDO2-Sicherheitsstick „${key.bezeichnung}“`;
          const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
          users[idx] = {
            ...user,
            zweiFaktor: {
              ...user.zweiFaktor,
              sicherheitsSchluessel: user.zweiFaktor.sicherheitsSchluessel.map((k) =>
                k.credentialId === credentialId ? { ...k, zuletztVerwendet: nowStamp } : k
              ),
            },
          };
        }
      }

      if (!verified) {
        await appendAuditLog(
          user.benutzername,
          user.rolle,
          'MFA_FAILED',
          '2FA-Verifizierung',
          `Fehlgeschlagener 2FA-Versuch (${method})`,
          req.ip || '127.0.0.1'
        );
        res.status(401).json({ error: 'Ungültiger 2FA-Code oder Sicherheitsschlüssel.' });
        return;
      }

      authChallenges.delete(challengeToken);
      await setSection('benutzer', users);
      await appendAuditLog(
        user.benutzername,
        user.rolle,
        'MFA_VERIFIED',
        '2FA-Verifizierung',
        `Erfolgreiche 2FA-Anmeldung via ${methodDesc}`,
        req.ip || '127.0.0.1'
      );

      const token = await createSession(users[idx]);
      const fullName = `${user.vorname} ${user.name}`.trim();
      const state = await getAllState();
      res.json({
        status: 'authenticated',
        token,
        activeUser: {
          id: user.id,
          benutzername: user.benutzername,
          email: user.email,
          name: fullName,
          role: user.rolle,
          auth: `${challenge.authLabel} + 2FA`,
          abteilung: user.abteilung,
        },
        state,
      });
    } catch (err) {
      console.error('[PflegeRust] MFA-Fehler:', err);
      res.status(500).json({ error: '2FA-Prüfung fehlgeschlagen.' });
    }
  });

  // Passkey lookup (returns public credential IDs only for a specific active identifier)
  app.post('/api/auth/passkey-options', async (req, res) => {
    try {
      const { identifier } = req.body || {};
      const users = (await getSection<AppUserRecord[]>('benutzer')) || [];
      const normalized = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
      const matched = normalized
        ? users.find(
            (u) =>
              u.aktiv &&
              (u.benutzername.toLowerCase() === normalized || u.email.toLowerCase() === normalized)
          )
        : null;

      res.json({
        passkeys: (matched?.zweiFaktor?.passkeys || []).map((p) => ({
          id: p.id,
          credentialId: p.credentialId,
          bezeichnung: p.bezeichnung,
          modus: p.modus,
          publicKeyJwk: p.publicKeyJwk,
        })),
      });
    } catch {
      res.status(500).json({ error: 'Passkey-Optionen konnten nicht geladen werden.' });
    }
  });

  // Passkey login completion
  app.post('/api/auth/passkey-login', async (req, res) => {
    try {
      const { credentialId } = req.body || {};
      if (typeof credentialId !== 'string' || !credentialId) {
        res.status(400).json({ error: 'Passkey-Credential fehlt.' });
        return;
      }

      const users = (await getSection<AppUserRecord[]>('benutzer')) || [];
      const idx = users.findIndex(
        (u) =>
          u.aktiv &&
          (u.zweiFaktor?.passkeys || []).some((p) => p.credentialId === credentialId)
      );

      if (idx === -1) {
        res.status(401).json({ error: 'Kein aktives Benutzerkonto für diesen Passkey gefunden.' });
        return;
      }

      const user = users[idx];
      const pk = user.zweiFaktor!.passkeys.find((p) => p.credentialId === credentialId)!;
      const nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
      users[idx] = {
        ...user,
        fehlversuche: 0,
        letzterLogin: nowStamp,
        zweiFaktor: {
          ...user.zweiFaktor!,
          passkeys: user.zweiFaktor!.passkeys.map((p) =>
            p.credentialId === credentialId ? { ...p, zuletztVerwendet: nowStamp } : p
          ),
        },
      };
      await setSection('benutzer', users);
      await appendAuditLog(
        user.benutzername,
        user.rolle,
        'PASSKEY_LOGIN',
        'WebAuthn / FIDO2',
        `Passwortlose Passkey-Anmeldung „${pk.bezeichnung}“`,
        req.ip || '127.0.0.1'
      );

      const token = await createSession(users[idx]);
      const fullName = `${user.vorname} ${user.name}`.trim();
      const state = await getAllState();
      res.json({
        status: 'authenticated',
        token,
        activeUser: {
          id: user.id,
          benutzername: user.benutzername,
          email: user.email,
          name: fullName,
          role: user.rolle,
          auth: 'Passkey (FIDO2)',
          abteilung: user.abteilung,
        },
        state,
      });
    } catch (err) {
      console.error('[PflegeRust] Passkey-Login-Fehler:', err);
      res.status(500).json({ error: 'Passkey-Anmeldung fehlgeschlagen.' });
    }
  });

  // Logout (invalidates server session in MariaDB)
  app.post('/api/auth/logout', async (req, res) => {
    const token = getBearerToken(req);
    const sess = await lookupSession(token);
    if (sess) {
      await appendAuditLog(
        sess.username,
        sess.role,
        'LOGOUT',
        'MariaDB Session',
        'Benutzer hat Sitzung ordnungsgemäß beendet',
        req.ip || '127.0.0.1'
      );
      await revokeSession(token);
    }
    res.json({ ok: true });
  });

  // Protected: fetch full operational state
  app.get('/api/state', requireAuth, async (_req, res) => {
    try {
      const state = await getAllState();
      res.json({ state, dbInfo: getPublicDbInfo() });
    } catch (err) {
      console.error('[PflegeRust] State-Read-Fehler:', err);
      res.status(500).json({ error: 'Daten konnten nicht aus MariaDB geladen werden.' });
    }
  });

  // Protected: persist a state section into MariaDB with server-side RBAC checks
  app.put('/api/state/:section', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const section = String(req.params.section || '');
      if (!ALLOWED_SECTIONS.has(section)) {
        res.status(400).json({ error: 'Ungültiger Datenbereich.' });
        return;
      }

      const currentUser = req.currentUser!;
      const rollenConfig = await getSection<Record<string, RoleDefRecord>>('rollenConfig');
      const data = req.body?.data;

      // Server-side authorization checks per domain section
      if (section === 'rollenConfig' && currentUser.rolle !== 'Admin') {
        res.status(403).json({ error: 'Nur Administratoren dürfen Rollen ändern.' });
        return;
      }
      if (
        (section === 'ssoConfig' || section === 'einrichtung' || section === 'mariaDbConfig') &&
        !userHasPermission(currentUser.rolle, 'benutzer_verwaltung', rollenConfig) &&
        !userHasPermission(currentUser.rolle, 'system_technik', rollenConfig)
      ) {
        res.status(403).json({ error: 'Keine Berechtigung für Systemeinstellungen.' });
        return;
      }
      if (
        section === 'addons' &&
        !userHasPermission(currentUser.rolle, 'addons_verwalten', rollenConfig)
      ) {
        res.status(403).json({ error: 'Keine Berechtigung zur Add-on-Verwaltung.' });
        return;
      }

      // Guardrails when updating user records:
      // Non-admins may only update their own password/2FA fields; Admins cannot self-lock or remove last active Admin
      if (section === 'benutzer') {
        if (!Array.isArray(data)) {
          res.status(400).json({ error: 'Ungültige Benutzerliste.' });
          return;
        }
        const incomingUsers = data as AppUserRecord[];
        const existingUsers = (await getSection<AppUserRecord[]>('benutzer')) || [];
        const canManageUsers = userHasPermission(
          currentUser.rolle,
          'benutzer_verwaltung',
          rollenConfig
        );

        if (!canManageUsers) {
          // Only allow self-service updates to the caller's own password or 2FA settings
          const selfIncoming = incomingUsers.find((u) => u.id === currentUser.id);
          if (!selfIncoming) {
            res.status(403).json({ error: 'Keine Berechtigung zur Benutzerverwaltung.' });
            return;
          }
          const sanitized = existingUsers.map((u) =>
            u.id === currentUser.id
              ? {
                  ...u,
                  passwortSalt: selfIncoming.passwortSalt ?? u.passwortSalt,
                  passwortHash: selfIncoming.passwortHash ?? u.passwortHash,
                  mussPasswortAendern: selfIncoming.mussPasswortAendern ?? u.mussPasswortAendern,
                  zweiFaktor: selfIncoming.zweiFaktor ?? u.zweiFaktor,
                }
              : u
          );
          await setSection('benutzer', sanitized);
          res.json({ ok: true, storageMode });
          return;
        }

        // Enforce server-side: at least one active Admin must always remain & Admin cannot self-lock
        const activeAdmins = incomingUsers.filter((u) => u.rolle === 'Admin' && u.aktiv);
        if (activeAdmins.length === 0) {
          res.status(400).json({
            error: 'Der letzte aktive Administrator darf nicht gesperrt oder herabgestuft werden.',
          });
          return;
        }
        const selfAfter = incomingUsers.find((u) => u.id === currentUser.id);
        if (currentUser.rolle === 'Admin' && (!selfAfter || !selfAfter.aktiv)) {
          res.status(400).json({ error: 'Ein Administrator kann sich nicht selbst sperren.' });
          return;
        }
      }

      await setSection(section, data);
      res.json({ ok: true, storageMode });
    } catch (err) {
      console.error('[PflegeRust] State-Write-Fehler:', err);
      res.status(500).json({ error: 'Speichern in MariaDB fehlgeschlagen.' });
    }
  });

  // Frontend serving: Vite middleware in development, static dist/ in production
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(
      process.env.PFLEGERUST_WWW_DIR || path.join(__dirname, 'dist')
    );

    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API-Endpunkt nicht gefunden.' });
        return;
      }

      const normalized = path.normalize(req.path).replace(/^(\.\.(\/|\\|$))+/, '');
      const candidate = path.resolve(distDir, `.${normalized}`);

      // Strict path-traversal boundary check
      if (candidate !== distDir && !candidate.startsWith(distDir + path.sep)) {
        res.status(403).send('Forbidden');
        return;
      }

      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        if (
          req.path === '/index.html' ||
          req.path === '/sw.js' ||
          req.path === '/registerSW.js' ||
          req.path === '/manifest.webmanifest'
        ) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (req.path.startsWith('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        res.sendFile(candidate);
        return;
      }

      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(indexFile);
        return;
      }
      next();
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(
      `[PflegeRust] Server gestartet auf http://${HOST}:${PORT} (Modus: ${IS_PROD ? 'production' : 'development'}, Speicher: ${storageMode})`
    );
  });

  const gracefulShutdown = async () => {
    console.log('[PflegeRust] Beende Server sauber...');
    server.close(async () => {
      if (dbPool) {
        await dbPool.end().catch(() => {});
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('[PflegeRust] Startfehler:', err);
  process.exit(1);
});
