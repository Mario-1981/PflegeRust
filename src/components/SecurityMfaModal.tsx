import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Smartphone,
  Usb,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Trash2,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Plus,
} from 'lucide-react';
import {
  AppBenutzer,
  BenutzerZweiFaktorConfig,
  PasskeyEintrag,
  SicherheitsSchluessel,
} from '../types/pflege';
import {
  buildOtpAuthUri,
  formatBase32Secret,
  generateBackupCodes,
  generateBase32Secret,
  generateQrCodeDataUrl,
  generateTotpCode,
  getTotpRemainingSeconds,
  registerSandboxEcdsaCredential,
  registerWebAuthnNative,
  verifyTotpCode,
} from '../utils/mfaCrypto';
import { verifyPassword } from '../utils/authCrypto';

interface SecurityMfaModalProps {
  isOpen: boolean;
  currentUser: AppBenutzer | null;
  einrichtungName: string;
  forceEnrollment?: boolean;
  mfaRequiredByPolicy?: boolean;
  mfaPolicyReason?: string;
  onClose: () => void;
  onUpdateUserMfa: (
    userId: string,
    nextConfig: BenutzerZweiFaktorConfig,
    auditAction: 'MFA_SETUP' | 'PASSKEY_REGISTER' | 'PASSKEY_REMOVE',
    auditDetails: string
  ) => void;
}

const DEFAULT_MFA_CONFIG: BenutzerZweiFaktorConfig = {
  aktiviert: false,
  totpAktiviert: false,
  sicherheitsSchluessel: [],
  passkeys: [],
};

export const SecurityMfaModal: React.FC<SecurityMfaModalProps> = ({
  isOpen,
  currentUser,
  einrichtungName,
  forceEnrollment = false,
  mfaRequiredByPolicy = false,
  mfaPolicyReason,
  onClose,
  onUpdateUserMfa,
}) => {
  const [tab, setTab] = useState<'totp' | 'security_key' | 'passkeys'>('totp');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // TOTP Setup state
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);
  const [pendingQrDataUrl, setPendingQrDataUrl] = useState<string | null>(null);
  const [totpVerifyInput, setTotpVerifyInput] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showPreviewTotp, setShowPreviewTotp] = useState(false);
  const [previewTotpCode, setPreviewTotpCode] = useState('');
  const [totpSecondsLeft, setTotpSecondsLeft] = useState(getTotpRemainingSeconds());
  const [freshBackupCodes, setFreshBackupCodes] = useState<string[] | null>(null);
  const [copiedBackups, setCopiedBackups] = useState(false);

  // Disable TOTP confirmation
  const [confirmDisableTotp, setConfirmDisableTotp] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  // Security Key registration state
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyTransport, setNewKeyTransport] = useState<'usb' | 'nfc' | 'ble' | 'hybrid'>('usb');
  const [isRegisteringKey, setIsRegisteringKey] = useState(false);
  const [keySandboxOffer, setKeySandboxOffer] = useState<string | null>(null);
  const [confirmDeleteKeyId, setConfirmDeleteKeyId] = useState<string | null>(null);

  // Passkey registration state
  const [newPasskeyLabel, setNewPasskeyLabel] = useState('');
  const [newPasskeyType, setNewPasskeyType] = useState<'platform' | 'roaming'>('platform');
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [passkeySandboxOffer, setPasskeySandboxOffer] = useState<string | null>(null);
  const [confirmDeletePasskeyId, setConfirmDeletePasskeyId] = useState<string | null>(null);

  const mfa: BenutzerZweiFaktorConfig = currentUser?.zweiFaktor || DEFAULT_MFA_CONFIG;

  // Live TOTP countdown & optional preview code while enrolling
  useEffect(() => {
    if (!isOpen || !pendingSecret) return;
    let active = true;
    const refresh = async () => {
      setTotpSecondsLeft(getTotpRemainingSeconds());
      if (showPreviewTotp) {
        const code = await generateTotpCode(pendingSecret);
        if (active) setPreviewTotpCode(code);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isOpen, pendingSecret, showPreviewTotp]);

  if (!isOpen || !currentUser) return null;

  const isLocal = currentUser.authMethode === 'lokal';
  const isMfaEnforced = Boolean(mfaRequiredByPolicy || currentUser.zweiFaktorPflicht);
  const hasAny2fa = Boolean(mfa.totpAktiviert || mfa.sicherheitsSchluessel.length > 0);
  const canDismiss = !forceEnrollment || hasAny2fa;

  const resetFeedback = () => {
    setErrorMsg(null);
    setStatusMsg(null);
  };

  const handleClose = () => {
    if (!canDismiss) {
      setErrorMsg(
        'Für Ihr Konto ist 2FA-Pflicht aktiviert. Bitte richten Sie mindestens eine Authenticator-App oder einen Sicherheitsstick ein.'
      );
      return;
    }
    setPendingSecret(null);
    setPendingQrDataUrl(null);
    setTotpVerifyInput('');
    setFreshBackupCodes(null);
    setConfirmDisableTotp(false);
    setDisablePassword('');
    setKeySandboxOffer(null);
    setPasskeySandboxOffer(null);
    resetFeedback();
    onClose();
  };

  // ---------- TOTP Handlers ----------

  const handleStartTotpSetup = async () => {
    resetFeedback();
    const secret = generateBase32Secret(20);
    const uri = buildOtpAuthUri(`PflegeRust (${einrichtungName})`, currentUser.benutzername, secret);
    const qr = await generateQrCodeDataUrl(uri);
    setPendingSecret(secret);
    setPendingQrDataUrl(qr);
    setTotpVerifyInput('');
    setShowPreviewTotp(false);
    setFreshBackupCodes(null);
  };

  const handleConfirmTotpSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSecret) return;
    resetFeedback();

    const ok = await verifyTotpCode(pendingSecret, totpVerifyInput, 1);
    if (!ok) {
      setErrorMsg(
        'Der 6-stellige Prüfcode stimmt nicht überein. Bitte prüfen Sie Uhrzeit und Eingabe Ihrer Authenticator-App.'
      );
      return;
    }

    const { plainCodes, hashes } = await generateBackupCodes(8);
    const nextConfig: BenutzerZweiFaktorConfig = {
      ...mfa,
      aktiviert: true,
      totpAktiviert: true,
      totpSecret: pendingSecret,
      totpEingerichtetAm: new Date().toISOString().split('T')[0],
      backupCodeHashes: hashes,
    };

    onUpdateUserMfa(
      currentUser.id,
      nextConfig,
      'MFA_SETUP',
      '2FA via Authenticator-App (TOTP RFC 6238) aktiviert und 8 Backup-Codes erzeugt'
    );
    setPendingSecret(null);
    setPendingQrDataUrl(null);
    setTotpVerifyInput('');
    setFreshBackupCodes(plainCodes);
    setStatusMsg('Authenticator-App (TOTP) erfolgreich aktiviert. Sichern Sie jetzt Ihre Einmal-Backup-Codes.');
  };

  const handleRegenerateBackupCodes = async () => {
    resetFeedback();
    const { plainCodes, hashes } = await generateBackupCodes(8);
    const nextConfig: BenutzerZweiFaktorConfig = {
      ...mfa,
      backupCodeHashes: hashes,
    };
    onUpdateUserMfa(
      currentUser.id,
      nextConfig,
      'MFA_SETUP',
      '8 neue 2FA Einmal-Backup-Codes generiert (vorherige Codes entwertet)'
    );
    setFreshBackupCodes(plainCodes);
    setStatusMsg('Neue Backup-Codes erstellt. Alle bisherigen Codes sind damit ungültig.');
  };

  const handleDisableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (isMfaEnforced && mfa.sicherheitsSchluessel.length === 0) {
      setErrorMsg(
        `2FA-Pflicht aktiv${mfaPolicyReason ? ` (${mfaPolicyReason})` : ''}: Hinterlegen Sie zuerst einen Sicherheitsstick, bevor Sie die Authenticator-App entfernen.`
      );
      return;
    }

    const pwOk = await verifyPassword(
      disablePassword,
      currentUser.passwortSalt,
      currentUser.passwortHash
    );
    if (!pwOk) {
      setErrorMsg('Passwort zur Bestätigung ist nicht korrekt.');
      return;
    }

    const stillHas2fa = mfa.sicherheitsSchluessel.length > 0;
    const nextConfig: BenutzerZweiFaktorConfig = {
      ...mfa,
      aktiviert: stillHas2fa,
      totpAktiviert: false,
      totpSecret: undefined,
      totpEingerichtetAm: undefined,
      backupCodeHashes: stillHas2fa ? mfa.backupCodeHashes : undefined,
    };

    onUpdateUserMfa(
      currentUser.id,
      nextConfig,
      'MFA_SETUP',
      '2FA via Authenticator-App (TOTP) durch Benutzer deaktiviert'
    );
    setConfirmDisableTotp(false);
    setDisablePassword('');
    setFreshBackupCodes(null);
    setStatusMsg('Authenticator-App wurde deaktiviert.');
  };

  // ---------- Security Key (FIDO2 Hardware Stick) Handlers ----------

  const saveRegisteredSecurityKey = (
    credentialId: string,
    modus: 'webauthn' | 'ecdsa_sandbox',
    publicKeyJwk?: JsonWebKey
  ) => {
    const label =
      newKeyLabel.trim() ||
      (newKeyTransport === 'nfc' ? 'FIDO2 NFC-Stick' : 'FIDO2 USB-Sicherheitsstick');

    const entry: SicherheitsSchluessel = {
      id: `sk-${Date.now()}`,
      credentialId,
      bezeichnung: label,
      transport: newKeyTransport,
      modus,
      publicKeyJwk,
      erstelltAm: new Date().toISOString().split('T')[0],
      signCount: 0,
    };

    const nextConfig: BenutzerZweiFaktorConfig = {
      ...mfa,
      aktiviert: true,
      sicherheitsSchluessel: [entry, ...mfa.sicherheitsSchluessel],
    };

    onUpdateUserMfa(
      currentUser.id,
      nextConfig,
      'MFA_SETUP',
      `FIDO2-Sicherheitsstick „${label}“ (${newKeyTransport.toUpperCase()} · ${
        modus === 'webauthn' ? 'WebAuthn' : 'ECDSA-P256 Vorschau'
      }) als 2. Faktor registriert`
    );
    setNewKeyLabel('');
    setKeySandboxOffer(null);
    setStatusMsg(`Sicherheitsstick „${label}“ erfolgreich als 2. Faktor hinterlegt.`);
  };

  const handleRegisterSecurityKey = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setKeySandboxOffer(null);
    setIsRegisteringKey(true);

    try {
      const result = await registerWebAuthnNative({
        user: currentUser,
        kind: 'security_key',
        excludeCredentialIds: [
          ...mfa.sicherheitsSchluessel.map((k) => k.credentialId),
          ...mfa.passkeys.map((p) => p.credentialId),
        ],
      });

      if (result.ok && result.credentialId && result.modus) {
        saveRegisteredSecurityKey(result.credentialId, result.modus, result.publicKeyJwk);
      } else if (result.blockedByEnvironment) {
        setKeySandboxOffer(
          result.error ||
            'Direkter Hardware-WebAuthn-Zugriff ist in dieser Browser-Vorschau eingeschränkt.'
        );
      } else {
        setErrorMsg(result.error || 'Registrierung des Sicherheitssticks fehlgeschlagen.');
      }
    } finally {
      setIsRegisteringKey(false);
    }
  };

  const handleRegisterSandboxSecurityKey = async () => {
    resetFeedback();
    setIsRegisteringKey(true);
    try {
      const res = await registerSandboxEcdsaCredential();
      if (res.ok && res.credentialId) {
        saveRegisteredSecurityKey(res.credentialId, 'ecdsa_sandbox', res.publicKeyJwk);
      }
    } finally {
      setIsRegisteringKey(false);
    }
  };

  const handleDeleteSecurityKey = (keyId: string) => {
    resetFeedback();
    const target = mfa.sicherheitsSchluessel.find((k) => k.id === keyId);
    if (!target) return;

    const remainingKeys = mfa.sicherheitsSchluessel.filter((k) => k.id !== keyId);
    if (isMfaEnforced && !mfa.totpAktiviert && remainingKeys.length === 0) {
      setErrorMsg(
        `2FA-Pflicht aktiv${mfaPolicyReason ? ` (${mfaPolicyReason})` : ''}: Mindestens eine Authenticator-App oder ein Sicherheitsstick muss aktiv bleiben.`
      );
      setConfirmDeleteKeyId(null);
      return;
    }

    const nextConfig: BenutzerZweiFaktorConfig = {
      ...mfa,
      aktiviert: Boolean(mfa.totpAktiviert || remainingKeys.length > 0),
      sicherheitsSchluessel: remainingKeys,
    };

    onUpdateUserMfa(
      currentUser.id,
      nextConfig,
      'MFA_SETUP',
      `FIDO2-Sicherheitsstick „${target.bezeichnung}“ entfernt`
    );
    setConfirmDeleteKeyId(null);
    setStatusMsg(`Sicherheitsstick „${target.bezeichnung}“ wurde entfernt.`);
  };

  // ---------- Passkey (WebAuthn Discoverable Credential) Handlers ----------

  const saveRegisteredPasskey = (
    credentialId: string,
    modus: 'webauthn' | 'ecdsa_sandbox',
    publicKeyJwk?: JsonWebKey
  ) => {
    const label =
      newPasskeyLabel.trim() ||
      (newPasskeyType === 'platform' ? 'Arbeitsplatz-Passkey (Biometrie)' : 'FIDO2 Passkey-Stick');

    const entry: PasskeyEintrag = {
      id: `pk-${Date.now()}`,
      credentialId,
      bezeichnung: label,
      geraeteTyp: newPasskeyType,
      modus,
      publicKeyJwk,
      erstelltAm: new Date().toISOString().split('T')[0],
      signCount: 0,
    };

    const nextConfig: BenutzerZweiFaktorConfig = {
      ...mfa,
      passkeys: [entry, ...mfa.passkeys],
    };

    onUpdateUserMfa(
      currentUser.id,
      nextConfig,
      'PASSKEY_REGISTER',
      `Passkey „${label}“ (${newPasskeyType === 'platform' ? 'Plattform' : 'Roaming'} · ${
        modus === 'webauthn' ? 'WebAuthn' : 'ECDSA-P256 Vorschau'
      }) registriert`
    );
    setNewPasskeyLabel('');
    setPasskeySandboxOffer(null);
    setStatusMsg(`Passkey „${label}“ erfolgreich registriert. Sie können sich nun direkt per Passkey anmelden.`);
  };

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setPasskeySandboxOffer(null);
    setIsRegisteringPasskey(true);

    try {
      const result = await registerWebAuthnNative({
        user: currentUser,
        kind: 'passkey',
        attachment: newPasskeyType === 'platform' ? 'platform' : 'cross-platform',
        excludeCredentialIds: mfa.passkeys.map((p) => p.credentialId),
      });

      if (result.ok && result.credentialId && result.modus) {
        saveRegisteredPasskey(result.credentialId, result.modus, result.publicKeyJwk);
      } else if (result.blockedByEnvironment) {
        setPasskeySandboxOffer(
          result.error ||
            'Direkter WebAuthn-Passkey-Zugriff ist in dieser eingebetteten Vorschau eingeschränkt.'
        );
      } else {
        setErrorMsg(result.error || 'Passkey-Registrierung fehlgeschlagen.');
      }
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handleRegisterSandboxPasskey = async () => {
    resetFeedback();
    setIsRegisteringPasskey(true);
    try {
      const res = await registerSandboxEcdsaCredential();
      if (res.ok && res.credentialId) {
        saveRegisteredPasskey(res.credentialId, 'ecdsa_sandbox', res.publicKeyJwk);
      }
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handleDeletePasskey = (passkeyId: string) => {
    resetFeedback();
    const target = mfa.passkeys.find((p) => p.id === passkeyId);
    if (!target) return;

    const nextConfig: BenutzerZweiFaktorConfig = {
      ...mfa,
      passkeys: mfa.passkeys.filter((p) => p.id !== passkeyId),
    };

    onUpdateUserMfa(
      currentUser.id,
      nextConfig,
      'PASSKEY_REMOVE',
      `Passkey „${target.bezeichnung}“ entfernt`
    );
    setConfirmDeletePasskeyId(null);
    setStatusMsg(`Passkey „${target.bezeichnung}“ wurde gelöscht.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                2-Faktor-Authentifizierung (2FA) &amp; Passkeys
              </h3>
              <p className="text-[11px] text-slate-500">
                {currentUser.vorname} {currentUser.name} ({currentUser.benutzername}) ·{' '}
                {isLocal ? 'Lokales MariaDB-Konto' : 'SSO-Konto'}
              </p>
            </div>
          </div>

          {canDismiss && (
            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold px-1.5 py-0.5"
              aria-label="Schließen"
            >
              ✕
            </button>
          )}
        </div>

        {/* Mandatory enrollment warning */}
        {forceEnrollment && !hasAny2fa && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>2FA-Einrichtung erforderlich{mfaPolicyReason ? ` (${mfaPolicyReason})` : ''}:</strong>{' '}
              Für Ihr lokales Benutzerkonto ist die Zwei-Faktor-Authentifizierung vorgeschrieben.
              Bitte aktivieren Sie eine Authenticator-App oder registrieren Sie einen
              FIDO2-Sicherheitsstick, um fortzufahren.
            </div>
          </div>
        )}

        {!isLocal ? (
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-teal-700" />
                <span>Authentifizierung wird zentral über Single Sign-On verwaltet</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Ihr Konto nutzt Single Sign-On (<strong>{currentUser.authMethode}</strong>).
                Zwei-Faktor-Methoden (Authenticator-App, FIDO2-Stick, Passkeys) werden direkt im
                Klinik-Identity-Provider (z.B. Keycloak oder Microsoft Entra ID) gepflegt.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-md cursor-pointer"
              >
                Verstanden
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="px-5 pt-3 border-b border-slate-200 flex items-center gap-1 bg-white">
              <button
                type="button"
                onClick={() => {
                  setTab('totp');
                  resetFeedback();
                }}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  tab === 'totp'
                    ? 'border-teal-700 text-teal-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Authenticator-App</span>
                {mfa.totpAktiviert && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Aktiv
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('security_key');
                  resetFeedback();
                }}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  tab === 'security_key'
                    ? 'border-teal-700 text-teal-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Usb className="w-3.5 h-3.5" />
                <span>Sicherheitsstick ({mfa.sicherheitsSchluessel.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('passkeys');
                  resetFeedback();
                }}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  tab === 'passkeys'
                    ? 'border-teal-700 text-teal-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>Passkeys ({mfa.passkeys.length})</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {statusMsg && (
                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{statusMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* TAB 1: TOTP Authenticator App */}
              {tab === 'totp' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>Zeitbasierte Einmalcodes (TOTP · RFC 6238)</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            mfa.totpAktiviert
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-200 text-slate-600 border-slate-300'
                          }`}
                        >
                          {mfa.totpAktiviert ? 'Aktiviert' : 'Nicht aktiv'}
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        Kompatibel mit Aegis, FreeOTP, Google Authenticator, Microsoft
                        Authenticator, Apple Passwörter und KeePassXC. Der QR-Code wird lokal im
                        Browser erzeugt (DSGVO-konform ohne externe Dienste).
                      </p>
                      {mfa.totpAktiviert && mfa.totpEingerichtetAm && (
                        <div className="text-[11px] font-mono text-slate-500 pt-0.5">
                          Eingerichtet am {mfa.totpEingerichtetAm} · Verbleibende Backup-Codes:{' '}
                          {mfa.backupCodeHashes?.length || 0}
                        </div>
                      )}
                    </div>

                    {!mfa.totpAktiviert && !pendingSecret && (
                      <button
                        type="button"
                        onClick={handleStartTotpSetup}
                        className="px-3.5 py-2 font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-md transition-colors cursor-pointer shrink-0"
                      >
                        App einrichten
                      </button>
                    )}
                  </div>

                  {/* Active TOTP Setup Flow */}
                  {pendingSecret && pendingQrDataUrl && (
                    <div className="p-4 rounded-lg border border-teal-200 bg-white space-y-4">
                      <div className="font-bold text-slate-900">
                        Schritt 1: QR-Code mit Authenticator-App scannen
                      </div>

                      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg shrink-0">
                          <img
                            src={pendingQrDataUrl}
                            alt="TOTP QR-Code für Authenticator-App"
                            className="w-44 h-44 block"
                          />
                        </div>

                        <div className="space-y-3 flex-1 min-w-0">
                          <div>
                            <div className="text-[11px] font-semibold text-slate-700 mb-1">
                              Manueller Einrichtungsschlüssel (Base32):
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded font-mono text-[11px] text-slate-900 break-all">
                                {formatBase32Secret(pendingSecret)}
                              </code>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(pendingSecret);
                                  setCopiedSecret(true);
                                  setTimeout(() => setCopiedSecret(false), 2000);
                                }}
                                className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
                                title="Schlüssel kopieren"
                              >
                                {copiedSecret ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              SHA-1 · 6 Stellen · 30 Sekunden Intervall
                            </div>
                          </div>

                          {/* Optional live preview verifier for testing without a phone */}
                          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-medium text-slate-700">
                                Test-Prüfcode (Vorschau ohne Smartphone)
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowPreviewTotp((p) => !p)}
                                className="inline-flex items-center gap-1 text-[11px] text-teal-800 hover:underline font-semibold cursor-pointer"
                              >
                                {showPreviewTotp ? (
                                  <>
                                    <EyeOff className="w-3 h-3" /> Verbergen
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3" /> Anzeigen
                                  </>
                                )}
                              </button>
                            </div>
                            {showPreviewTotp && (
                              <div className="flex items-center justify-between pt-1">
                                <span className="font-mono text-base font-bold tracking-widest text-teal-900">
                                  {previewTotpCode.slice(0, 3)} {previewTotpCode.slice(3)}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  Gültig noch {totpSecondsLeft}s
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <form
                        onSubmit={handleConfirmTotpSetup}
                        className="pt-3 border-t border-slate-200 space-y-3"
                      >
                        <div className="font-bold text-slate-900">
                          Schritt 2: 6-stelligen Code aus der App bestätigen
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={7}
                            required
                            value={totpVerifyInput}
                            onChange={(e) => setTotpVerifyInput(e.target.value)}
                            placeholder="123456"
                            className="w-40 px-3 py-2 font-mono text-sm tracking-widest border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-md cursor-pointer"
                          >
                            Verifizieren &amp; aktivieren
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingSecret(null);
                              setPendingQrDataUrl(null);
                              setTotpVerifyInput('');
                            }}
                            className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Newly generated Recovery Codes (shown once) */}
                  {freshBackupCodes && (
                    <div className="p-4 rounded-lg border border-amber-300 bg-amber-50/70 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-amber-950">
                          Einmal-Wiederherstellungscodes (bitte sicher verwahren)
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(freshBackupCodes.join('\n'));
                            setCopiedBackups(true);
                            setTimeout(() => setCopiedBackups(false), 2000);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100 cursor-pointer"
                        >
                          {copiedBackups ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" /> Kopiert
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Alle kopieren
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-900">
                        Diese Codes werden nur jetzt im Klartext angezeigt und in MariaDB
                        ausschließlich als SHA-256-Hash gespeichert. Jeder Code ist einmalig bei
                        Verlust des Smartphones nutzbar.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs font-bold text-slate-900">
                        {freshBackupCodes.map((code) => (
                          <div
                            key={code}
                            className="px-2.5 py-1.5 bg-white border border-amber-200 rounded text-center"
                          >
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manage Active TOTP */}
                  {mfa.totpAktiviert && !pendingSecret && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRegenerateBackupCodes}
                          className="px-3 py-1.5 font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                        >
                          Neue Backup-Codes erzeugen
                        </button>
                        {!confirmDisableTotp && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDisableTotp(true);
                              setDisablePassword('');
                              resetFeedback();
                            }}
                            className="px-3 py-1.5 font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded-md cursor-pointer"
                          >
                            Authenticator-App deaktivieren
                          </button>
                        )}
                      </div>

                      {confirmDisableTotp && (
                        <form
                          onSubmit={handleDisableTotp}
                          className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 space-y-2.5"
                        >
                          <div className="font-semibold text-rose-900">
                            Deaktivierung mit Ihrem Passwort bestätigen
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="password"
                              required
                              value={disablePassword}
                              onChange={(e) => setDisablePassword(e.target.value)}
                              placeholder="Aktuelles Passwort"
                              className="flex-1 min-w-[200px] px-3 py-1.5 bg-white border border-slate-300 rounded-md"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                            >
                              Endgültig deaktivieren
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDisableTotp(false)}
                              className="px-3 py-1.5 text-slate-600 bg-white border border-slate-200 rounded-md cursor-pointer"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: FIDO2 Hardware Security Keys */}
              {tab === 'security_key' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="font-bold text-slate-900">
                      FIDO2 / WebAuthn Hardware-Sicherheitssticks (2. Faktor)
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Unterstützt phishing-resistente USB- und NFC-Sticks wie YubiKey 5, Nitrokey 3
                      oder Feitian ePass als zweiten Faktor nach der Passworteingabe (BSI TR-03107).
                    </p>
                  </div>

                  {/* Register Security Key Form */}
                  <form
                    onSubmit={handleRegisterSecurityKey}
                    className="p-4 rounded-lg border border-slate-200 bg-white space-y-3"
                  >
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-teal-700" />
                      <span>Neuen Sicherheitsstick registrieren</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-medium text-slate-700 mb-1">
                          Bezeichnung des Sticks
                        </label>
                        <input
                          type="text"
                          value={newKeyLabel}
                          onChange={(e) => setNewKeyLabel(e.target.value)}
                          placeholder="z.B. YubiKey 5C NFC – Dienstschlüssel"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Schnittstelle</label>
                        <select
                          value={newKeyTransport}
                          onChange={(e) =>
                            setNewKeyTransport(e.target.value as 'usb' | 'nfc' | 'ble' | 'hybrid')
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                        >
                          <option value="usb">USB-A / USB-C</option>
                          <option value="nfc">NFC (Kontaktlos)</option>
                          <option value="ble">Bluetooth (BLE)</option>
                          <option value="hybrid">Hybrid / Smartphone</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isRegisteringKey}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-50 rounded-md cursor-pointer"
                      >
                        <Usb className="w-3.5 h-3.5" />
                        <span>
                          {isRegisteringKey
                            ? 'Warte auf Sicherheitsstick...'
                            : 'Sicherheitsstick jetzt koppeln (FIDO2)'}
                        </span>
                      </button>
                    </div>

                    {keySandboxOffer && (
                      <div className="p-3 rounded-md bg-amber-50 border border-amber-200 space-y-2">
                        <div className="text-amber-900">
                          <strong>Hinweis zur Vorschau-Umgebung:</strong> {keySandboxOffer} Auf
                          Ihrem Debian-Server über HTTPS wird direkt der echte USB-/NFC-Stick
                          angesprochen. Zum Testen in dieser Vorschau können Sie einen
                          kryptografischen WebCrypto ECDSA-P256-Stick anlegen:
                        </div>
                        <button
                          type="button"
                          onClick={handleRegisterSandboxSecurityKey}
                          disabled={isRegisteringKey}
                          className="px-3 py-1.5 font-semibold text-teal-900 bg-white border border-teal-300 hover:bg-teal-50 rounded-md cursor-pointer"
                        >
                          Mit WebCrypto ECDSA-P256-Schlüssel koppeln
                        </button>
                      </div>
                    )}
                  </form>

                  {/* Registered Security Keys List */}
                  <div className="space-y-2">
                    <div className="font-bold text-slate-800">
                      Hinterlegte Sicherheitssticks ({mfa.sicherheitsSchluessel.length})
                    </div>
                    {mfa.sicherheitsSchluessel.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
                        Noch kein Sicherheitsstick registriert.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                        {mfa.sicherheitsSchluessel.map((key) => (
                          <div
                            key={key.id}
                            className="p-3 bg-white flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                <Usb className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                <span>{key.bezeichnung}</span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                  {key.transport.toUpperCase()}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-teal-50 text-teal-800 border border-teal-200">
                                  {key.modus === 'webauthn' ? 'FIDO2 WebAuthn' : 'ECDSA-P256'}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                Erstellt: {key.erstelltAm} · Verwendungen: {key.signCount}
                                {key.zuletztVerwendet ? ` · Zuletzt: ${key.zuletztVerwendet}` : ''}
                              </div>
                            </div>

                            {confirmDeleteKeyId === key.id ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKeyId(null)}
                                  className="px-2 py-1 text-slate-600 bg-slate-100 rounded cursor-pointer"
                                >
                                  Abbrechen
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSecurityKey(key.id)}
                                  className="px-2.5 py-1 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                                >
                                  Entfernen
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKeyId(key.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer shrink-0"
                                title="Sicherheitsstick entfernen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Passkeys (Discoverable WebAuthn Credentials) */}
              {tab === 'passkeys' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                    <div className="font-bold text-slate-900">
                      Passkeys (FIDO2 / WebAuthn passwortlose Anmeldung)
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Melden Sie sich per Fingerabdruck (Touch ID / Windows Hello), Gesichtserkennung
                      (Face ID) oder FIDO2-Passkey-Stick direkt ohne Passwort und ohne separaten
                      TOTP-Code an. Der private Schlüssel verlässt niemals das Sicherheitsmodul
                      Ihres Geräts.
                    </p>
                  </div>

                  {/* Register Passkey Form */}
                  <form
                    onSubmit={handleRegisterPasskey}
                    className="p-4 rounded-lg border border-slate-200 bg-white space-y-3"
                  >
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-teal-700" />
                      <span>Neuen Passkey erstellen</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-medium text-slate-700 mb-1">
                          Geräte- / Passkey-Bezeichnung
                        </label>
                        <input
                          type="text"
                          value={newPasskeyLabel}
                          onChange={(e) => setNewPasskeyLabel(e.target.value)}
                          placeholder="z.B. Dienst-Laptop Windows Hello oder iPad Touch ID"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Gerätetyp</label>
                        <select
                          value={newPasskeyType}
                          onChange={(e) =>
                            setNewPasskeyType(e.target.value as 'platform' | 'roaming')
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                        >
                          <option value="platform">Plattform (Biometrie / PIN)</option>
                          <option value="roaming">Roaming (Hardware-Stick)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isRegisteringPasskey}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-50 rounded-md cursor-pointer"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>
                        {isRegisteringPasskey
                          ? 'Warte auf Biometrie / Passkey...'
                          : 'Passkey jetzt registrieren'}
                      </span>
                    </button>

                    {passkeySandboxOffer && (
                      <div className="p-3 rounded-md bg-amber-50 border border-amber-200 space-y-2">
                        <div className="text-amber-900">
                          <strong>Hinweis zur Vorschau-Umgebung:</strong> {passkeySandboxOffer} Auf
                          Ihrem Produktivserver über HTTPS öffnet der Browser direkt Touch ID,
                          Windows Hello oder Ihren Passkey-Tresor. Zum Testen können Sie einen
                          lokalen ECDSA-P256-Passkey registrieren:
                        </div>
                        <button
                          type="button"
                          onClick={handleRegisterSandboxPasskey}
                          disabled={isRegisteringPasskey}
                          className="px-3 py-1.5 font-semibold text-teal-900 bg-white border border-teal-300 hover:bg-teal-50 rounded-md cursor-pointer"
                        >
                          Mit WebCrypto ECDSA-P256-Passkey registrieren
                        </button>
                      </div>
                    )}
                  </form>

                  {/* Registered Passkeys List */}
                  <div className="space-y-2">
                    <div className="font-bold text-slate-800">
                      Registrierte Passkeys ({mfa.passkeys.length})
                    </div>
                    {mfa.passkeys.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
                        Noch kein Passkey für dieses Konto registriert.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                        {mfa.passkeys.map((pk) => (
                          <div
                            key={pk.id}
                            className="p-3 bg-white flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                <Fingerprint className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                <span>{pk.bezeichnung}</span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                  {pk.geraeteTyp === 'platform' ? 'Plattform' : 'Roaming'}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-teal-50 text-teal-800 border border-teal-200">
                                  {pk.modus === 'webauthn' ? 'WebAuthn Passkey' : 'ECDSA-P256'}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                Erstellt: {pk.erstelltAm} · Anmeldungen: {pk.signCount}
                                {pk.zuletztVerwendet ? ` · Zuletzt: ${pk.zuletztVerwendet}` : ''}
                              </div>
                            </div>

                            {confirmDeletePasskeyId === pk.id ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePasskeyId(null)}
                                  className="px-2 py-1 text-slate-600 bg-slate-100 rounded cursor-pointer"
                                >
                                  Abbrechen
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePasskey(pk.id)}
                                  className="px-2.5 py-1 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                                >
                                  Löschen
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePasskeyId(pk.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer shrink-0"
                                title="Passkey entfernen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Lock className="w-3.5 h-3.5 text-teal-700" />
                <span>
                  2FA-Status:{' '}
                  <strong className={hasAny2fa ? 'text-emerald-700' : 'text-slate-700'}>
                    {hasAny2fa ? 'Geschützt' : 'Nicht aktiv'}
                  </strong>{' '}
                  · Passkeys: <strong>{mfa.passkeys.length}</strong>
                </span>
              </div>
              <button
                type="button"
                disabled={!canDismiss}
                onClick={handleClose}
                className="px-4 py-1.5 font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-50 rounded-md cursor-pointer"
              >
                {forceEnrollment ? 'Einrichtung abschließen' : 'Schließen'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
