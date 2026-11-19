import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Database,
  AlertCircle,
  CheckCircle2,
  Globe,
  ShieldAlert,
  Check,
  X,
  Users,
  LogOut,
  UserPlus,
} from 'lucide-react';
import { ActiveSessionUser, AppBenutzer, SsoKonfiguration } from '../types/pflege';
import {
  verifyPassword,
  validatePasswordPolicy,
  createPasswordRecord,
  MAX_LOGIN_ATTEMPTS,
} from '../utils/authCrypto';

interface LoginViewProps {
  benutzer: AppBenutzer[];
  activeSessions: ActiveSessionUser[];
  initialTargetSessionId?: string | null;
  einrichtungName?: string;
  ssoConfig: SsoKonfiguration;
  logoutNotice: string | null;
  credentialsReady: boolean;
  onLogin: (user: AppBenutzer, authLabel: string) => void;
  onEndSession: (userId: string) => void;
  onFailedLogin: (identifier: string, matchedUser?: AppBenutzer, viaSso?: boolean) => void;
  onCompleteForcedPasswordChange: (
    userId: string,
    salt: string,
    hash: string
  ) => AppBenutzer | null;
}

const getAuthMethodLabel = (method: AppBenutzer['authMethode']): string => {
  switch (method) {
    case 'oidc_keycloak':
      return 'Keycloak SSO';
    case 'entra_id':
      return 'Entra ID SSO';
    case 'google_sso':
      return 'Google OIDC';
    default:
      return 'Lokal (MariaDB)';
  }
};

export const LoginView: React.FC<LoginViewProps> = ({
  benutzer,
  activeSessions,
  initialTargetSessionId,
  einrichtungName = 'Pflegedienst Berlin-Zentrum',
  ssoConfig,
  logoutNotice,
  credentialsReady,
  onLogin,
  onEndSession,
  onFailedLogin,
  onCompleteForcedPasswordChange,
}) => {
  const [authTab, setAuthTab] = useState<'lokal' | 'sso'>('lokal');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Mandatory password change flow (after admin reset)
  const [pendingPasswordChangeUser, setPendingPasswordChangeUser] = useState<{
    user: AppBenutzer;
    authLabel: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // If user clicked a specific signed-in session in Header to switch to, pre-select ONLY that active session (still requires password)
  useEffect(() => {
    if (!initialTargetSessionId) return;
    const targetSession = activeSessions.find((s) => s.id === initialTargetSessionId);
    if (!targetSession) return;
    const userRecord = benutzer.find((u) => u.id === targetSession.id);
    setSelectedSessionId(targetSession.id);
    setIdentifier(targetSession.benutzername);
    setAuthTab(userRecord?.authMethode === 'lokal' ? 'lokal' : 'sso');
    setPassword('');
    setErrorMsg(null);
  }, [initialTargetSessionId]);

  const policy = validatePasswordPolicy(newPassword);

  const handleSelectActiveSession = (session: ActiveSessionUser) => {
    const userRecord = benutzer.find((u) => u.id === session.id);
    setSelectedSessionId(session.id);
    setIdentifier(session.benutzername);
    setAuthTab(userRecord?.authMethode === 'lokal' ? 'lokal' : 'sso');
    setPassword('');
    setErrorMsg(null);
  };

  const handleClearSelectedSession = () => {
    setSelectedSessionId(null);
    setIdentifier('');
    setPassword('');
    setErrorMsg(null);
  };

  const handleAuthenticate = async (e: React.FormEvent, mode: 'lokal' | 'sso') => {
    e.preventDefault();
    setErrorMsg(null);

    if (!credentialsReady) {
      setErrorMsg('Sicherheitsmodul wird initialisiert. Bitte kurz warten.');
      return;
    }

    const trimmed = identifier.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg('Bitte geben Sie Ihren Benutzernamen oder Ihre dienstliche E-Mail-Adresse ein.');
      return;
    }
    if (!password) {
      setErrorMsg('Bitte geben Sie Ihr Passwort ein. Eine Anmeldung ohne Passwort ist nicht zulässig.');
      return;
    }

    if (mode === 'sso' && !ssoConfig.aktiviert) {
      setErrorMsg(
        'Single Sign-On ist derzeit deaktiviert. Bitte melden Sie sich lokal als Administrator an.'
      );
      return;
    }

    setIsVerifying(true);
    try {
      const found = benutzer.find(
        (u) => u.benutzername.toLowerCase() === trimmed || u.email.toLowerCase() === trimmed
      );

      if (!found) {
        onFailedLogin(trimmed, undefined, mode === 'sso');
        setErrorMsg('Ungültige Zugangsdaten. Benutzername/E-Mail oder Passwort ist fehlerhaft.');
        setPassword('');
        return;
      }

      if (!found.aktiv) {
        onFailedLogin(trimmed, found, mode === 'sso');
        const lockedByAttempts = (found.fehlversuche || 0) >= MAX_LOGIN_ATTEMPTS;
        setErrorMsg(
          lockedByAttempts
            ? `Dieses Konto wurde nach ${MAX_LOGIN_ATTEMPTS} fehlgeschlagenen Anmeldeversuchen automatisch gesperrt. Bitte wenden Sie sich an die IT-Administration.`
            : 'Dieses Benutzerkonto ist gesperrt. Bitte wenden Sie sich an die IT-Administration oder PDL.'
        );
        setPassword('');
        return;
      }

      if (mode === 'lokal' && found.authMethode !== 'lokal') {
        setErrorMsg(
          `Dieses Konto ist ausschließlich für Single Sign-On (${getAuthMethodLabel(
            found.authMethode
          )}) freigegeben. Bitte wechseln Sie zum Tab „Single Sign-On“.`
        );
        setPassword('');
        return;
      }

      if (mode === 'sso' && found.authMethode === 'lokal') {
        setErrorMsg(
          'Dieses Konto ist ein lokales MariaDB-Konto und nicht mit dem SSO Identity Provider verknüpft. Bitte nutzen Sie die lokale Anmeldung.'
        );
        setPassword('');
        return;
      }

      const isValid = await verifyPassword(password, found.passwortSalt, found.passwortHash);
      if (!isValid) {
        const nextAttempts = (found.fehlversuche || 0) + 1;
        const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - nextAttempts);
        const isLastActiveAdmin =
          found.aktiv &&
          found.rolle === 'Admin' &&
          benutzer.filter((u) => u.aktiv && u.rolle === 'Admin').length <= 1;
        onFailedLogin(trimmed, found, mode === 'sso');
        setPassword('');
        if (remaining === 0) {
          if (isLastActiveAdmin) {
            setErrorMsg(
              `Falsches Passwort (${nextAttempts} Fehlversuche). Der letzte aktive Administrator kann nicht gesperrt werden – der Vorfall wurde im DSGVO-Audit-Log protokolliert.`
            );
          } else {
            setErrorMsg(
              `Maximale Anzahl an Fehlversuchen (${MAX_LOGIN_ATTEMPTS}) erreicht. Das Konto wurde aus Sicherheitsgründen gesperrt und im DSGVO-Audit-Log vermerkt.`
            );
          }
        } else {
          setErrorMsg(
            isLastActiveAdmin
              ? `Falsches Passwort (Fehlversuch ${nextAttempts}). Der Vorfall wurde im DSGVO-Audit-Log protokolliert.`
              : `Falsches Passwort. Verbleibende Versuche vor automatischer Kontosperrung: ${remaining}.`
          );
        }
        return;
      }

      const authLabel = getAuthMethodLabel(found.authMethode);

      if (found.mussPasswortAendern && mode === 'lokal') {
        setPendingPasswordChangeUser({ user: found, authLabel });
        setPassword('');
        return;
      }

      onLogin(found, authLabel);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleForcedPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPasswordChangeUser) return;
    setErrorMsg(null);

    if (!policy.valid) {
      setErrorMsg('Das neue Passwort erfüllt noch nicht alle Anforderungen der Passwortrichtlinie.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Die beiden eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    setIsVerifying(true);
    try {
      const { salt, hash } = await createPasswordRecord(newPassword);
      const updatedUser = onCompleteForcedPasswordChange(
        pendingPasswordChangeUser.user.id,
        salt,
        hash
      );
      if (updatedUser) {
        onLogin(updatedUser, pendingPasswordChangeUser.authLabel);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId) || null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
            PR
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 leading-none">
              PflegeRust
            </span>
            <span className="text-[10px] text-teal-700 font-mono font-medium mt-0.5">
              Pflegemanagement · MariaDB &amp; SSO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-600">
            <Database className="w-3.5 h-3.5 text-teal-700" />
            <span>MariaDB 10.11 · Debian 12</span>
          </span>
        </div>
      </header>

      {/* Centered Secure Login / Active Session Switcher */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          {/* Status notice banner */}
          {logoutNotice && !pendingPasswordChangeUser && (
            <div className="bg-teal-50 border border-teal-200 text-teal-900 rounded-lg px-4 py-3 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
              <span>{logoutNotice}</span>
            </div>
          )}

          {/* Error banner */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-lg px-4 py-3 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ONLY currently signed-in sessions on this workstation (NEVER all users) */}
          {!pendingPasswordChangeUser && activeSessions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-700" />
                  <span>Angemeldete Benutzer ({activeSessions.length})</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  Passwort zum Entsperren nötig
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {activeSessions.map((session) => {
                  const isSelected = selectedSessionId === session.id;
                  const initials = session.name
                    .split(/\s+/)
                    .map((p) => p.charAt(0))
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  return (
                    <div
                      key={session.id}
                      className={`px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectActiveSession(session)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {session.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 truncate">
                            {session.role} · {session.auth}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectActiveSession(session)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-800 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-900'
                          }`}
                        >
                          {isSelected ? 'Ausgewählt' : 'Fortsetzen'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedSessionId === session.id) {
                              handleClearSelectedSession();
                            }
                            onEndSession(session.id);
                          }}
                          title={`Sitzung von ${session.name} vollständig abmelden`}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedSession && (
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">
                    Sitzung entsperren: <strong className="text-slate-900">{selectedSession.name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelectedSession}
                    className="inline-flex items-center gap-1 text-teal-800 hover:underline font-medium cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Anderes Konto</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Card: Either Mandatory Password Change OR Login */}
          {pendingPasswordChangeUser ? (
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
              <div className="p-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold uppercase tracking-wider mb-1">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Passwortänderung erforderlich</span>
                </div>
                <h1 className="text-lg font-bold text-slate-900">
                  Neues Passwort festlegen
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Für{' '}
                  <span className="font-semibold text-slate-800">
                    {pendingPasswordChangeUser.user.vorname} {pendingPasswordChangeUser.user.name}
                  </span>{' '}
                  muss vor dem Zugriff auf Klientendaten ein eigenes Passwort vergeben werden.
                </p>
              </div>

              <form onSubmit={handleForcedPasswordSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Neues Passwort
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Mindestens 8 Zeichen"
                      className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Neues Passwort wiederholen
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Passwort bestätigen"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  />
                </div>

                {/* Live BSI Password Policy Checklist */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5 text-[11px]">
                  <div className="font-semibold text-slate-700">Passwortrichtlinie (BSI):</div>
                  {[
                    { ok: policy.checks.minLength, label: 'Mindestens 8 Zeichen' },
                    { ok: policy.checks.hasUpper, label: 'Mindestens ein Großbuchstabe (A–Z)' },
                    { ok: policy.checks.hasLower, label: 'Mindestens ein Kleinbuchstabe (a–z)' },
                    { ok: policy.checks.hasDigit, label: 'Mindestens eine Ziffer (0–9)' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-1.5 ${
                        item.ok ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {item.ok ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPasswordChangeUser(null);
                      setNewPassword('');
                      setConfirmPassword('');
                      setErrorMsg(null);
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying || !policy.valid}
                    className="flex-1 py-2 px-4 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    {isVerifying ? 'Speichere...' : 'Passwort speichern & anmelden'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
              <div className="p-6 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                      {selectedSession ? 'Sitzung entsperren' : 'Geschützte Anmeldung'}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      {einrichtungName} · Authentifizierung erforderlich
                    </p>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-teal-700 shrink-0" />
                </div>

                {/* Auth Mode Tabs */}
                <div className="mt-5 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md border border-slate-200 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('lokal');
                      setErrorMsg(null);
                      setPassword('');
                    }}
                    className={`py-2 px-3 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      authTab === 'lokal'
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 text-teal-700" />
                    <span>Lokal (MariaDB)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('sso');
                      setErrorMsg(null);
                      setPassword('');
                    }}
                    className={`py-2 px-3 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      authTab === 'sso'
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5 text-teal-700" />
                    <span>Single Sign-On</span>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {authTab === 'sso' && (
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-teal-700" />
                        {ssoConfig.bezeichnung}
                      </span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                          ssoConfig.aktiviert
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}
                      >
                        {ssoConfig.aktiviert ? 'OIDC · PKCE' : 'Deaktiviert'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      {ssoConfig.issuerUrl}
                    </div>
                  </div>
                )}

                <form
                  onSubmit={(e) => handleAuthenticate(e, authTab)}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="login-identifier"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      {authTab === 'sso'
                        ? 'Dienstliche E-Mail oder SSO-Benutzername'
                        : 'Benutzername oder E-Mail'}
                    </label>
                    <input
                      id="login-identifier"
                      type="text"
                      required
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (selectedSessionId) setSelectedSessionId(null);
                      }}
                      placeholder="Benutzername oder E-Mail eingeben"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      {authTab === 'sso' ? 'SSO / Identity-Provider Passwort' : 'Passwort'}
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Passwort eingeben"
                        className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || (authTab === 'sso' && !ssoConfig.aktiviert)}
                    className="w-full py-2.5 px-4 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    {authTab === 'sso' ? (
                      <KeyRound className="w-4 h-4" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    <span>
                      {isVerifying
                        ? 'Prüfe Zugangsdaten...'
                        : selectedSession
                        ? 'Mit Passwort entsperren'
                        : authTab === 'sso'
                        ? 'Über Identity Provider anmelden'
                        : 'Sicher anmelden'}
                    </span>
                  </button>
                </form>

                <div className="pt-3 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Brute-Force-Schutz: Sperrung nach {MAX_LOGIN_ATTEMPTS} Fehlversuchen</span>
                    <span className="font-mono text-slate-400">PBKDF2 / Argon2</span>
                  </div>
                  <div>
                    Aus Datenschutzgründen werden keine nicht angemeldeten Benutzerkonten angezeigt.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 px-6 text-center text-[11px] text-slate-500 border-t border-slate-200 bg-white">
        PflegeRust Debian Server · Passwortgeschützte Sitzungen (MariaDB &amp; OIDC/PKCE)
      </footer>
    </div>
  );
};
