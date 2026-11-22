// Typed API client for PflegeRust MariaDB backend
// Session Bearer tokens are held strictly in JS memory (never stored in localStorage/sessionStorage).

import { ActiveSessionUser, AppBenutzer, EinrichtungsProfil } from '../types/pflege';
import { MariaDbConfig } from '../components/MariaDbConfigModal';

export interface ServerDbInfo {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  connected: boolean;
  storageMode: 'mariadb' | 'preview-memory';
  version: string;
  preconfigured: boolean;
}

export interface BootstrapResponse {
  setupCompleted: boolean;
  dbInfo: ServerDbInfo;
  einrichtung: EinrichtungsProfil | null;
  ssoPublic: {
    aktiviert: boolean;
    providerName: string;
    providerTyp: string;
    issuerUrl: string;
    clientId: string;
    erlaubeLokalenLogin: boolean;
  } | null;
  hasRegisteredPasskeys: boolean;
}

export interface PublicAuthUserInfo {
  id: string;
  benutzername: string;
  email: string;
  vorname: string;
  name: string;
  rolle: string;
  authMethode: 'lokal' | 'oidc_keycloak' | 'entra_id' | 'google_sso';
  abteilung: string;
  hasTotp: boolean;
  securityKeys: Array<{
    id: string;
    credentialId: string;
    bezeichnung: string;
    modus: 'webauthn' | 'ecdsa_sandbox';
    publicKeyJwk?: JsonWebKey;
  }>;
  hasBackupCodes: boolean;
}

export type LoginApiResponse =
  | {
      status: 'authenticated';
      token: string;
      activeUser: ActiveSessionUser;
      state: Record<string, unknown>;
    }
  | {
      status: 'mfa_required';
      challengeToken: string;
      user: PublicAuthUserInfo;
    }
  | {
      status: 'password_change_required';
      challengeToken: string;
      user: PublicAuthUserInfo;
    };

// Map userId -> Bearer session token (in memory only, supports multi-session workstation switching)
const sessionTokens = new Map<string, string>();
let activeToken: string | null = null;

export function setActiveSessionToken(userId: string, token: string): void {
  sessionTokens.set(userId, token);
  activeToken = token;
}

export function switchActiveSessionToken(userId: string): boolean {
  const existing = sessionTokens.get(userId);
  if (!existing) return false;
  activeToken = existing;
  return true;
}

export function clearSessionToken(userId?: string): void {
  if (userId) {
    const removed = sessionTokens.get(userId);
    sessionTokens.delete(userId);
    if (removed && removed === activeToken) {
      activeToken = null;
    }
  } else {
    activeToken = null;
  }
}

export function hasActiveToken(): boolean {
  return Boolean(activeToken);
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  tokenOverride?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const token = tokenOverride !== undefined ? tokenOverride : activeToken;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Serverfehler (${res.status})`);
  }
  return data as T;
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/bootstrap', { method: 'GET' }, null);
}

export async function testDatabaseConnection(): Promise<{
  ok: boolean;
  connected: boolean;
  storageMode: 'mariadb' | 'preview-memory';
  version: string;
  database: string;
  host: string;
  port: number;
  user: string;
  note?: string;
}> {
  return apiFetch('/api/db/test', { method: 'POST', body: JSON.stringify({}) }, null);
}

export async function completeSetupApi(payload: {
  einrichtung: EinrichtungsProfil;
  mariaDbConfig: MariaDbConfig;
  adminUser: AppBenutzer;
  ssoConfig: unknown;
  rollenConfig: unknown;
  klienten: unknown[];
  touren: unknown[];
  addons: unknown[];
  tiTransaktionen: unknown[];
}): Promise<{
  token: string;
  activeUser: ActiveSessionUser;
  state: Record<string, unknown>;
  dbInfo: ServerDbInfo;
}> {
  return apiFetch('/api/setup/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, null);
}

export async function loginApi(identifier: string, password: string): Promise<LoginApiResponse> {
  return apiFetch<LoginApiResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    },
    null
  );
}

export async function completeForcedPasswordApi(
  challengeToken: string,
  passwortSalt: string,
  passwortHash: string
): Promise<LoginApiResponse> {
  return apiFetch<LoginApiResponse>(
    '/api/auth/complete-password-change',
    {
      method: 'POST',
      body: JSON.stringify({ challengeToken, passwortSalt, passwortHash }),
    },
    null
  );
}

export async function verifyMfaApi(
  challengeToken: string,
  method: 'totp' | 'backup' | 'security_key',
  payload: { code?: string; credentialId?: string }
): Promise<Extract<LoginApiResponse, { status: 'authenticated' }>> {
  return apiFetch(
    '/api/auth/verify-mfa',
    {
      method: 'POST',
      body: JSON.stringify({ challengeToken, method, ...payload }),
    },
    null
  );
}

export async function fetchPasskeyOptionsApi(identifier: string): Promise<{
  passkeys: Array<{
    id: string;
    credentialId: string;
    bezeichnung: string;
    modus: 'webauthn' | 'ecdsa_sandbox';
    publicKeyJwk?: JsonWebKey;
  }>;
}> {
  return apiFetch(
    '/api/auth/passkey-options',
    {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    },
    null
  );
}

export async function passkeyLoginApi(
  credentialId: string
): Promise<Extract<LoginApiResponse, { status: 'authenticated' }>> {
  return apiFetch(
    '/api/auth/passkey-login',
    {
      method: 'POST',
      body: JSON.stringify({ credentialId }),
    },
    null
  );
}

export async function logoutApi(userId?: string): Promise<void> {
  const tokenToRevoke = userId ? sessionTokens.get(userId) || activeToken : activeToken;
  try {
    if (tokenToRevoke) {
      await apiFetch('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }, tokenToRevoke);
    }
  } catch {
    // Best-effort server revocation
  } finally {
    clearSessionToken(userId);
  }
}

export async function saveStateSectionApi(section: string, data: unknown): Promise<void> {
  if (!activeToken) return;
  await apiFetch(`/api/state/${encodeURIComponent(section)}`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });
}
