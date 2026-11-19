// Cryptographic 2FA (RFC 6238 TOTP), Recovery Codes & WebAuthn / FIDO2 (Security Keys & Passkeys)
import QRCode from 'qrcode';
import { AppBenutzer } from '../types/pflege';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// In-memory store for ECDSA P-256 private keys used when iframe Permissions-Policy blocks USB/Platform WebAuthn
const sandboxPrivateKeys = new Map<string, CryptoKey>();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBuffer(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    Math.ceil(base64Url.length / 4) * 4,
    '='
  );
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(length);
  const bytes = new Uint8Array(buffer);
  crypto.getRandomValues(bytes);
  return bytes;
}

// ---------- RFC 4648 Base32 & RFC 6238 TOTP ----------

export function generateBase32Secret(byteLength = 20): string {
  const bytes = randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function formatBase32Secret(secret: string): string {
  return secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

function decodeBase32(secret: string): Uint8Array<ArrayBuffer> {
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
  const buffer = new ArrayBuffer(out.length);
  const bytes = new Uint8Array(buffer);
  bytes.set(out);
  return bytes;
}

export function buildOtpAuthUri(
  issuer: string,
  accountName: string,
  secret: string
): string {
  const cleanIssuer = issuer.trim() || 'PflegeRust';
  const label = `${encodeURIComponent(cleanIssuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret: secret.replace(/\s+/g, '').toUpperCase(),
    issuer: cleanIssuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export async function generateQrCodeDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri, {
    width: 210,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export async function generateTotpCode(
  secret: string,
  timestampMs = Date.now(),
  stepSeconds = 30
): Promise<string> {
  const keyBytes = decodeBase32(secret);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);

  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer)
  );

  const offset = signature[signature.length - 1] & 0x0f;
  const binaryCode =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  return (binaryCode % 1_000_000).toString().padStart(6, '0');
}

export async function verifyTotpCode(
  secret: string | undefined,
  rawInput: string,
  windowSteps = 1
): Promise<boolean> {
  if (!secret) return false;
  const normalized = rawInput.replace(/\D/g, '');
  if (normalized.length !== 6) return false;

  const now = Date.now();
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const candidate = await generateTotpCode(secret, now + delta * 30_000);
    if (constantTimeEquals(candidate, normalized)) {
      return true;
    }
  }
  return false;
}

export function getTotpRemainingSeconds(stepSeconds = 30): number {
  const elapsed = Math.floor(Date.now() / 1000) % stepSeconds;
  return stepSeconds - elapsed;
}

// ---------- Recovery / Backup Codes (SHA-256 hashed) ----------

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashBackupCode(code: string): Promise<string> {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return sha256Hex(`pflegerust-recovery-v1:${normalized}`);
}

export async function generateBackupCodes(
  count = 8
): Promise<{ plainCodes: string[]; hashes: string[] }> {
  const plainCodes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8);
    let raw = '';
    for (let j = 0; j < 8; j++) {
      raw += RECOVERY_ALPHABET[bytes[j] % RECOVERY_ALPHABET.length];
    }
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    plainCodes.push(formatted);
    hashes.push(await hashBackupCode(formatted));
  }

  return { plainCodes, hashes };
}

export async function verifyAndConsumeBackupCode(
  input: string,
  hashes: string[] | undefined
): Promise<{ valid: boolean; remainingHashes: string[] }> {
  if (!hashes || hashes.length === 0) {
    return { valid: false, remainingHashes: [] };
  }
  const candidateHash = await hashBackupCode(input);
  let matchedIndex = -1;
  for (let i = 0; i < hashes.length; i++) {
    if (constantTimeEquals(hashes[i], candidateHash)) {
      matchedIndex = i;
      break;
    }
  }
  if (matchedIndex === -1) {
    return { valid: false, remainingHashes: hashes };
  }
  return {
    valid: true,
    remainingHashes: hashes.filter((_, idx) => idx !== matchedIndex),
  };
}

// ---------- WebAuthn / FIDO2 Security Keys & Passkeys ----------

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.credentials)
  );
}

export interface FidoRegisterResult {
  ok: boolean;
  credentialId?: string;
  modus?: 'webauthn' | 'ecdsa_sandbox';
  publicKeyJwk?: JsonWebKey;
  blockedByEnvironment?: boolean;
  error?: string;
}

export async function registerWebAuthnNative(params: {
  user: AppBenutzer;
  kind: 'security_key' | 'passkey';
  attachment?: 'platform' | 'cross-platform';
  excludeCredentialIds?: string[];
}): Promise<FidoRegisterResult> {
  if (!isWebAuthnSupported()) {
    return {
      ok: false,
      blockedByEnvironment: true,
      error: 'WebAuthn (PublicKeyCredential) wird in dieser Browser-Umgebung nicht unterstützt.',
    };
  }

  try {
    const challenge = randomBytes(32);
    const userIdBytes = new TextEncoder().encode(params.user.id);
    const rpId = window.location.hostname || 'localhost';

    const authenticatorSelection: AuthenticatorSelectionCriteria =
      params.kind === 'passkey'
        ? {
            residentKey: 'required',
            requireResidentKey: true,
            userVerification: 'required',
            ...(params.attachment ? { authenticatorAttachment: params.attachment } : {}),
          }
        : {
            authenticatorAttachment: 'cross-platform',
            residentKey: 'discouraged',
            userVerification: 'preferred',
          };

    const excludeCredentials: PublicKeyCredentialDescriptor[] = (
      params.excludeCredentialIds || []
    ).map((id) => ({
      type: 'public-key',
      id: base64UrlToBuffer(id),
    }));

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'PflegeRust Pflegemanagement',
          id: rpId,
        },
        user: {
          id: userIdBytes,
          name: params.user.benutzername,
          displayName: `${params.user.vorname} ${params.user.name}`,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256 (ECDSA P-256)
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection,
        excludeCredentials,
        timeout: 45_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { ok: false, error: 'Registrierung wurde vom Gerät abgebrochen.' };
    }

    return {
      ok: true,
      credentialId: bufferToBase64Url(credential.rawId),
      modus: 'webauthn',
    };
  } catch (err) {
    const domErr = err as DOMException;
    const name = domErr?.name || 'Error';
    const msg = domErr?.message || String(err);
    const isEnvRestricted =
      name === 'SecurityError' ||
      name === 'NotSupportedError' ||
      msg.toLowerCase().includes('publickey-credentials') ||
      msg.toLowerCase().includes('feature is not enabled') ||
      msg.toLowerCase().includes('iframe') ||
      msg.toLowerCase().includes('permissions policy');

    return {
      ok: false,
      blockedByEnvironment: isEnvRestricted || name === 'NotAllowedError',
      error: isEnvRestricted
        ? 'Hardware-WebAuthn wird in dieser eingebetteten Vorschau (iframe Permissions-Policy) vom Browser blockiert.'
        : name === 'NotAllowedError'
        ? 'Vorgang abgebrochen oder kein kompatibler FIDO2-Stick / Biometrie-Sensor erkannt.'
        : `WebAuthn-Fehler: ${msg}`,
    };
  }
}

export async function registerSandboxEcdsaCredential(): Promise<FidoRegisterResult> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify']
  );
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const credentialId = bufferToBase64Url(randomBytes(24));
  sandboxPrivateKeys.set(credentialId, keyPair.privateKey);

  return {
    ok: true,
    credentialId,
    modus: 'ecdsa_sandbox',
    publicKeyJwk,
  };
}

export async function verifyWebAuthnAssertion(params: {
  credentialId: string;
  modus: 'webauthn' | 'ecdsa_sandbox';
  publicKeyJwk?: JsonWebKey;
  userVerification?: UserVerificationRequirement;
}): Promise<{ ok: boolean; error?: string }> {
  const challenge = randomBytes(32);

  if (params.modus === 'ecdsa_sandbox') {
    const privateKey = sandboxPrivateKeys.get(params.credentialId);
    if (!privateKey || !params.publicKeyJwk) {
      return {
        ok: false,
        error:
          'Der lokale ECDSA-Sitzungsschlüssel ist nach einem Seiten-Reload nicht mehr im Arbeitsspeicher. Bitte registrieren Sie den Schlüssel neu oder nutzen Sie einen anderen 2. Faktor.',
      };
    }

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      challenge
    );
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      params.publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      signature,
      challenge
    );

    return verified
      ? { ok: true }
      : { ok: false, error: 'Kryptografische ECDSA-Signaturprüfung fehlgeschlagen.' };
  }

  if (!isWebAuthnSupported()) {
    return {
      ok: false,
      error: 'WebAuthn wird von diesem Browser nicht unterstützt.',
    };
  }

  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname || 'localhost',
        allowCredentials: [
          {
            type: 'public-key',
            id: base64UrlToBuffer(params.credentialId),
          },
        ],
        userVerification: params.userVerification || 'preferred',
        timeout: 45_000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { ok: false, error: 'Bestätigung am Sicherheitsstick / Passkey abgebrochen.' };
    }
    return { ok: true };
  } catch (err) {
    const domErr = err as DOMException;
    return {
      ok: false,
      error:
        domErr?.name === 'NotAllowedError'
          ? 'Zeitüberschreitung oder Abbruch am Sicherheitsstick / Passkey.'
          : `FIDO2-Verifizierung fehlgeschlagen: ${domErr?.message || String(err)}`,
    };
  }
}

export async function verifyDiscoverablePasskeyNative(): Promise<{
  ok: boolean;
  credentialId?: string;
  error?: string;
}> {
  if (!isWebAuthnSupported()) {
    return { ok: false, error: 'WebAuthn wird in dieser Umgebung nicht unterstützt.' };
  }
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: window.location.hostname || 'localhost',
        userVerification: 'required',
        timeout: 45_000,
      },
    })) as PublicKeyCredential | null;
    if (!assertion) {
      return { ok: false, error: 'Passkey-Anmeldung wurde abgebrochen.' };
    }
    return {
      ok: true,
      credentialId: bufferToBase64Url(assertion.rawId),
    };
  } catch (err) {
    const domErr = err as DOMException;
    return {
      ok: false,
      error:
        domErr?.name === 'NotAllowedError'
          ? 'Keine passende Hardware-Passkey-Anmeldung bestätigt.'
          : domErr?.message || 'Passkey-Abfrage fehlgeschlagen.',
    };
  }
}

// ---------- User MFA Status Helpers ----------

export function hasActiveSecondFactor(user: AppBenutzer): boolean {
  if (user.authMethode !== 'lokal') return false;
  const mfa = user.zweiFaktor;
  if (!mfa || !mfa.aktiviert) return false;
  return Boolean(mfa.totpAktiviert || mfa.sicherheitsSchluessel.length > 0);
}

export function hasRegisteredPasskey(user: AppBenutzer): boolean {
  if (user.authMethode !== 'lokal') return false;
  return Boolean(user.zweiFaktor && user.zweiFaktor.passkeys.length > 0);
}
