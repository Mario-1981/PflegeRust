// Cryptographic password hashing & verification via Web Crypto API (PBKDF2-SHA256)

export const MAX_LOGIN_ATTEMPTS = 5;

export interface PasswordPolicyResult {
  valid: boolean;
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasDigit: boolean;
  };
}

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-ZÄÖÜ]/.test(password),
    hasLower: /[a-zäöü]/.test(password),
    hasDigit: /[0-9]/.test(password),
  };
  return {
    valid: checks.minLength && checks.hasUpper && checks.hasLower && checks.hasDigit,
    checks,
  };
}

export function generateSalt(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(`pflegerust-v1:${salt}`),
      iterations: 60000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return `pbkdf2_sha256$60000$${bytesToHex(derivedBits)}`;
}

export async function createPasswordRecord(
  password: string
): Promise<{ salt: string; hash: string }> {
  const salt = generateSalt(16);
  const hash = await hashPassword(password, salt);
  return { salt, hash };
}

export async function verifyPassword(
  password: string,
  salt: string | undefined,
  expectedHash: string | undefined
): Promise<boolean> {
  if (!password || !salt || !expectedHash) return false;
  const computed = await hashPassword(password, salt);
  return constantTimeEquals(computed, expectedHash);
}

// Initial test credentials map used solely to seed PBKDF2 hashes on initial load
export const INITIAL_USER_SEED_PASSWORDS: Record<string, string> = {
  'usr-1': 'PflegePDL2026!',
  'usr-2': 'AdminDebian2026!',
  'usr-3': 'TourMitte2026!',
  'usr-4': 'EntraPflege2026!',
  'usr-5': 'Spaetdienst2026!',
  'usr-6': 'Abrechnung2026!',
};
