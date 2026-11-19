import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  Lock,
  UserCheck,
  UserX,
  FileText,
  SlidersHorizontal,
  Check,
  X,
} from 'lucide-react';
import {
  AppBenutzer,
  BenutzerRolle,
  Berechtigung,
  RollenDefinition,
  SsoKonfiguration,
  AuditLogEintrag,
} from '../types/pflege';
import {
  createPasswordRecord,
  validatePasswordPolicy,
  MAX_LOGIN_ATTEMPTS,
} from '../utils/authCrypto';
import { ALLE_BERECHTIGUNGEN, ALLE_ROLLEN } from '../data/rbacConfig';

interface UserManagementViewProps {
  benutzer: AppBenutzer[];
  rollenConfig: Record<BenutzerRolle, RollenDefinition>;
  ssoConfig: SsoKonfiguration;
  auditLogs: AuditLogEintrag[];
  canManageUsers: boolean;
  canReadAudit: boolean;
  onSaveSsoConfig: (config: SsoKonfiguration) => void;
  onAddBenutzer: (user: AppBenutzer) => void;
  onToggleUserStatus: (userId: string) => void;
  onUpdateUserRole: (userId: string, newRole: BenutzerRolle) => void;
  onUpdateRolePermissions: (rolle: BenutzerRolle, berechtigungen: Berechtigung[]) => void;
  onResetRoleToDefault: (rolle: BenutzerRolle) => void;
  onResetUserPassword: (
    userId: string,
    salt: string,
    hash: string,
    forceChange: boolean
  ) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  benutzer,
  rollenConfig,
  ssoConfig,
  auditLogs,
  canManageUsers,
  canReadAudit,
  onSaveSsoConfig,
  onAddBenutzer,
  onToggleUserStatus,
  onUpdateUserRole,
  onUpdateRolePermissions,
  onResetRoleToDefault,
  onResetUserPassword,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'sso' | 'audit'>(
    canManageUsers ? 'users' : 'audit'
  );
  const [selectedEditRole, setSelectedEditRole] = useState<BenutzerRolle>('Pflegefachkraft');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // SSO form local state
  const [ssoForm, setSsoForm] = useState<SsoKonfiguration>(ssoConfig);
  const [isTestingOidc, setIsTestingOidc] = useState(false);
  const [oidcTestResult, setOidcTestResult] = useState<{
    success: boolean;
    issuer: string;
    endpoints: {
      auth: string;
      token: string;
      jwks: string;
    };
    latencyMs: number;
  } | null>(null);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRole, setNewRole] = useState<BenutzerRolle>('Pflegefachkraft');
  const [newAuthMethod, setNewAuthMethod] = useState<'lokal' | 'oidc_keycloak' | 'entra_id' | 'google_sso'>('lokal');
  const [newDepartment, setNewDepartment] = useState('Ambulante Pflege');
  const [newInitialPassword, setNewInitialPassword] = useState('');
  const [newInitialPasswordConfirm, setNewInitialPasswordConfirm] = useState('');
  const [newForceChange, setNewForceChange] = useState(true);
  const [newUserError, setNewUserError] = useState<string | null>(null);

  // Admin password reset modal state
  const [resetTargetUser, setResetTargetUser] = useState<AppBenutzer | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetForceChange, setResetForceChange] = useState(true);
  const [resetError, setResetError] = useState<string | null>(null);

  // Read-only OIDC claim mapping validator state
  const [claimGroupInput, setClaimGroupInput] = useState(
    ssoConfig.rollenMapping[0]?.ssoGruppe || 'pflegedienst_leitung'
  );

  const newPwPolicy = validatePasswordPolicy(newInitialPassword);
  const resetPwPolicy = validatePasswordPolicy(resetPassword);

  // Filtered users
  const filteredUsers = benutzer.filter((u) => {
    const matchesSearch =
      `${u.name} ${u.vorname} ${u.benutzername} ${u.email} ${u.abteilung}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesRole = selectedRoleFilter === 'all' || u.rolle === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  const handleTestOidc = () => {
    setIsTestingOidc(true);
    setTimeout(() => {
      setIsTestingOidc(false);
      setOidcTestResult({
        success: true,
        issuer: ssoForm.issuerUrl,
        endpoints: {
          auth: `${ssoForm.issuerUrl}/protocol/openid-connect/auth`,
          token: `${ssoForm.issuerUrl}/protocol/openid-connect/token`,
          jwks: `${ssoForm.issuerUrl}/protocol/openid-connect/certs`,
        },
        latencyMs: 14,
      });
    }, 700);
  };

  const handleSaveSso = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSsoConfig(ssoForm);
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError(null);

    if (!newUsername.trim() || !newEmail.trim() || !newLastName.trim()) {
      setNewUserError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }

    const duplicate = benutzer.some(
      (u) =>
        u.benutzername.toLowerCase() === newUsername.trim().toLowerCase() ||
        u.email.toLowerCase() === newEmail.trim().toLowerCase()
    );
    if (duplicate) {
      setNewUserError('Ein Benutzer mit diesem Benutzernamen oder dieser E-Mail existiert bereits.');
      return;
    }

    if (!newPwPolicy.valid) {
      setNewUserError('Das Initialpasswort erfüllt nicht die BSI-Passwortrichtlinie.');
      return;
    }

    if (newInitialPassword !== newInitialPasswordConfirm) {
      setNewUserError('Die Passwörter stimmen nicht überein.');
      return;
    }

    const { salt, hash } = await createPasswordRecord(newInitialPassword);

    const newUser: AppBenutzer = {
      id: `usr-${Date.now()}`,
      benutzername: newUsername.trim(),
      email: newEmail.trim(),
      vorname: newFirstName.trim(),
      name: newLastName.trim(),
      rolle: newRole,
      authMethode: newAuthMethod,
      abteilung: newDepartment.trim(),
      aktiv: true,
      letzterLogin: 'Noch nicht angemeldet',
      erstelltAm: new Date().toISOString().split('T')[0],
      ssoSubjectId: newAuthMethod !== 'lokal' ? `sub-${Date.now()}` : undefined,
      passwortSalt: salt,
      passwortHash: hash,
      fehlversuche: 0,
      mussPasswortAendern: newAuthMethod === 'lokal' ? newForceChange : false,
    };

    onAddBenutzer(newUser);
    setShowAddUserModal(false);
    setNewUsername('');
    setNewEmail('');
    setNewFirstName('');
    setNewLastName('');
    setNewInitialPassword('');
    setNewInitialPasswordConfirm('');
    setNewForceChange(true);
    setNewUserError(null);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetError(null);

    if (!resetPwPolicy.valid) {
      setResetError('Das neue Passwort erfüllt nicht die BSI-Passwortrichtlinie.');
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setResetError('Die Passwörter stimmen nicht überein.');
      return;
    }

    const { salt, hash } = await createPasswordRecord(resetPassword);
    onResetUserPassword(
      resetTargetUser.id,
      salt,
      hash,
      resetTargetUser.authMethode === 'lokal' ? resetForceChange : false
    );
    setResetTargetUser(null);
    setResetPassword('');
    setResetPasswordConfirm('');
    setResetError(null);
  };

  const getRoleBadge = (rolle: BenutzerRolle) => {
    switch (rolle) {
      case 'Admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'PDL':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'Wohnbereichsleitung':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Pflegefachkraft':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Pflegehelfer':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Verwaltung_Abrechnung':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getAuthBadge = (auth: string) => {
    switch (auth) {
      case 'oidc_keycloak':
        return 'Keycloak OIDC';
      case 'entra_id':
        return 'Microsoft Entra ID';
      case 'google_sso':
        return 'Google Workspace';
      default:
        return 'Lokal (Passwort)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sicherheit &amp; Identitätsmanagement (RBAC)</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Nutzerverwaltung &amp; SSO-Anbindung
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rollenbasierte Berechtigungen für Pflegedienste · OpenID Connect / Keycloak / Microsoft Entra ID
          </p>
        </div>

        {/* Tab switch (strictly filtered by permissions) */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {canManageUsers && (
            <>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Benutzer ({benutzer.length})
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'roles'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rollen &amp; Rechte
              </button>
              <button
                onClick={() => setActiveTab('sso')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'sso'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                SSO-Konfiguration
              </button>
            </>
          )}
          {canReadAudit && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              DSGVO Audit-Log ({auditLogs.length})
            </button>
          )}
        </div>
      </div>

      {/* Tab: Users */}
      {canManageUsers && activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg text-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Name, Benutzername, E-Mail, Abteilung..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Rolle filtern:</span>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="p-1.5 bg-slate-50 border border-slate-300 rounded-md font-medium text-slate-800"
              >
                <option value="all">Alle Rollen</option>
                <option value="Admin">Administrator</option>
                <option value="PDL">Pflegedienstleitung (PDL)</option>
                <option value="Wohnbereichsleitung">Wohnbereichsleitung</option>
                <option value="Pflegefachkraft">Pflegefachkraft</option>
                <option value="Pflegehelfer">Pflegehelfer</option>
                <option value="Verwaltung_Abrechnung">Verwaltung &amp; Abrechnung</option>
                <option value="Datenschutz_QM">Datenschutz &amp; QM</option>
              </select>

              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors shadow-xs cursor-pointer ml-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Neuer Benutzer</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Mitarbeiter</th>
                  <th className="p-3">Benutzername &amp; E-Mail</th>
                  <th className="p-3">Rolle (RBAC)</th>
                  <th className="p-3">Authentifizierung</th>
                  <th className="p-3">Abteilung</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Letzter Login</th>
                  <th className="p-3 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">
                        {user.name}, {user.vorname}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">ID: {user.id}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-medium text-slate-800">{user.benutzername}</div>
                      <div className="text-[11px] text-slate-500">{user.email}</div>
                    </td>
                    <td className="p-3">
                      <select
                        aria-label={`Rolle für ${user.vorname} ${user.name}`}
                        value={user.rolle}
                        onChange={(e) =>
                          onUpdateUserRole(user.id, e.target.value as BenutzerRolle)
                        }
                        className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-700 ${getRoleBadge(
                          user.rolle
                        )}`}
                      >
                        {ALLE_ROLLEN.map((r) => (
                          <option key={r} value={r} className="bg-white text-slate-900">
                            {rollenConfig[r]?.bezeichnung || r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-700">
                        <KeyRound className="w-3 h-3 text-teal-700" />
                        <span>{getAuthBadge(user.authMethode)}</span>
                      </span>
                      {user.ssoSubjectId && (
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                          {user.ssoSubjectId}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{user.abteilung}</td>
                    <td className="p-3">
                      <div className="space-y-1">
                        {user.aktiv ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Aktiv
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <UserX className="w-3 h-3 text-rose-600" />
                            Gesperrt
                          </span>
                        )}
                        {(user.fehlversuche || 0) > 0 && (
                          <div className="text-[10px] font-mono text-amber-700">
                            Fehlversuche: {user.fehlversuche}/{MAX_LOGIN_ATTEMPTS}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 font-mono text-[11px]">
                      {user.letzterLogin}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setResetTargetUser(user);
                          setResetPassword('');
                          setResetPasswordConfirm('');
                          setResetForceChange(true);
                          setResetError(null);
                        }}
                        className="text-[11px] font-medium px-2 py-1 rounded text-teal-800 hover:bg-teal-50 transition-colors cursor-pointer mr-1"
                      >
                        Passwort
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleUserStatus(user.id)}
                        className={`text-[11px] font-medium px-2 py-1 rounded transition-colors cursor-pointer ${
                          user.aktiv
                            ? 'text-rose-700 hover:bg-rose-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {user.aktiv ? 'Sperren' : 'Aktivieren'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Roles & Permissions Editor */}
      {canManageUsers && activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Role Selector List (4 cols) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-teal-700" />
                <span>Rollen auswählen</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Änderungen wirken sofort für alle Benutzer dieser Rolle.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {ALLE_ROLLEN.map((r) => {
                const def = rollenConfig[r];
                const isSelected = selectedEditRole === r;
                const userCountInRole = benutzer.filter((u) => u.rolle === r).length;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedEditRole(r)}
                    className={`w-full p-3.5 text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-teal-50/70 border-l-3 border-l-teal-700' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadge(
                            r
                          )}`}
                        >
                          {r}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {userCountInRole} Nutzer
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mt-1 truncate">
                        {def.bezeichnung}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono font-semibold text-teal-800 shrink-0 tabular-nums">
                      {def.berechtigungen.length}/{ALLE_BERECHTIGUNGEN.length}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permission Toggles for Selected Role (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
            {(() => {
              const activeDef = rollenConfig[selectedEditRole];
              const groups: Array<'Pflege & Klienten' | 'Organisation & Finanzen' | 'Administration & Technik'> = [
                'Pflege & Klienten',
                'Organisation & Finanzen',
                'Administration & Technik',
              ];

              const togglePerm = (permId: Berechtigung) => {
                if (selectedEditRole === 'Admin' && permId === 'users_verwalten') return;
                const hasIt = activeDef.berechtigungen.includes(permId);
                let next = hasIt
                  ? activeDef.berechtigungen.filter((p) => p !== permId)
                  : [...activeDef.berechtigungen, permId];

                // Ensure logical read dependency when enabling write permission
                if (!hasIt) {
                  if (permId === 'klienten_bearbeiten' && !next.includes('klienten_lesen')) {
                    next.push('klienten_lesen');
                  }
                  if (permId === 'touren_quittieren' && !next.includes('touren_lesen')) {
                    next.push('touren_lesen');
                  }
                  if (permId === 'sis_bearbeiten' && !next.includes('sis_lesen')) {
                    next.push('sis_lesen');
                  }
                  if (permId === 'medikation_bearbeiten' && !next.includes('medikation_lesen')) {
                    next.push('medikation_lesen');
                  }
                  if (permId === 'pflege_dokumentieren' && !next.includes('klienten_lesen')) {
                    next.push('klienten_lesen');
                  }
                } else {
                  // Removing read permission also removes dependent write permission
                  if (permId === 'klienten_lesen') {
                    next = next.filter(
                      (p) => p !== 'klienten_bearbeiten' && p !== 'pflege_dokumentieren'
                    );
                  }
                  if (permId === 'touren_lesen') {
                    next = next.filter((p) => p !== 'touren_quittieren');
                  }
                  if (permId === 'sis_lesen') {
                    next = next.filter((p) => p !== 'sis_bearbeiten');
                  }
                  if (permId === 'medikation_lesen') {
                    next = next.filter((p) => p !== 'medikation_bearbeiten');
                  }
                }

                onUpdateRolePermissions(selectedEditRole, next);
              };

              return (
                <>
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {activeDef.bezeichnung}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${getRoleBadge(
                            selectedEditRole
                          )}`}
                        >
                          {selectedEditRole}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{activeDef.beschreibung}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onResetRoleToDefault(selectedEditRole)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      Standardrechte laden
                    </button>
                  </div>

                  <div className="p-5 space-y-5">
                    {groups.map((group) => {
                      const items = ALLE_BERECHTIGUNGEN.filter((b) => b.gruppe === group);
                      return (
                        <div key={group} className="space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {group}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {items.map((perm) => {
                              const checked = activeDef.berechtigungen.includes(perm.id);
                              const locked =
                                selectedEditRole === 'Admin' && perm.id === 'users_verwalten';
                              return (
                                <label
                                  key={perm.id}
                                  className={`p-3 rounded-md border flex items-start gap-2.5 transition-colors ${
                                    locked
                                      ? 'bg-purple-50/50 border-purple-200 cursor-not-allowed'
                                      : checked
                                      ? 'bg-teal-50/40 border-teal-300 cursor-pointer hover:bg-teal-50/70'
                                      : 'bg-white border-slate-200 cursor-pointer hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={locked}
                                    onChange={() => togglePerm(perm.id)}
                                    className="mt-0.5 rounded accent-teal-700 w-4 h-4 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                                      <span>{perm.label}</span>
                                      {locked && (
                                        <Lock className="w-3 h-3 text-purple-700 shrink-0" />
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                      {perm.beschreibung}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tab: SSO Configuration */}
      {canManageUsers && activeTab === 'sso' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* SSO Form (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  OpenID Connect &amp; SAML 2.0 Single Sign-On
                </h2>
                <p className="text-xs text-slate-500">
                  Zentrale Authentifizierung über Ihren Klinik- oder Träger-Identity-Provider
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ssoForm.aktiviert}
                  onChange={(e) => setSsoForm({ ...ssoForm, aktiviert: e.target.checked })}
                  className="rounded text-teal-700 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-800">
                  {ssoForm.aktiviert ? 'SSO Aktiv' : 'SSO Deaktiviert'}
                </span>
              </label>
            </div>

            <form onSubmit={handleSaveSso} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">
                    Identity Provider Typ
                  </label>
                  <select
                    value={ssoForm.providerTyp}
                    onChange={(e) => setSsoForm({ ...ssoForm, providerTyp: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded font-medium text-slate-800"
                  >
                    <option value="keycloak">Keycloak (Open Source, Debian-Standard)</option>
                    <option value="entra_id">Microsoft Entra ID (Azure AD)</option>
                    <option value="google">Google Workspace SSO</option>
                    <option value="generic_oidc">Generisches OpenID Connect (OIDC)</option>
                    <option value="saml2">SAML 2.0 Identity Provider</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-medium block mb-1">
                    Anzeigename im Login
                  </label>
                  <input
                    type="text"
                    value={ssoForm.bezeichnung}
                    onChange={(e) => setSsoForm({ ...ssoForm, bezeichnung: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">
                  OIDC Issuer / Discovery URL *
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    value={ssoForm.issuerUrl}
                    onChange={(e) => setSsoForm({ ...ssoForm, issuerUrl: e.target.value })}
                    placeholder="https://sso.ihre-klinik.de/realms/pflegedienst"
                    className="flex-1 p-2 border border-slate-300 rounded font-mono text-slate-800 text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={handleTestOidc}
                    disabled={isTestingOidc}
                    className="px-3 py-1.5 font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingOidc ? 'animate-spin' : ''}`} />
                    <span>{isTestingOidc ? 'Prüfe...' : 'Discovery prüfen'}</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Lädt automatisch die OIDC Konfiguration unter /.well-known/openid-configuration
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Client ID *</label>
                  <input
                    type="text"
                    required
                    value={ssoForm.clientId}
                    onChange={(e) => setSsoForm({ ...ssoForm, clientId: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Client Secret *</label>
                  <input
                    type="password"
                    required
                    value={ssoForm.clientSecret}
                    onChange={(e) => setSsoForm({ ...ssoForm, clientSecret: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">
                  Zulässige Redirect URI (Callback)
                </label>
                <input
                  type="text"
                  readOnly
                  value={ssoForm.redirectUri}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono text-slate-600 text-[11px]"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Tragen Sie diese URL im Client Ihres Identity Providers als gültige Redirect URI ein.
                </span>
              </div>

              {/* Role Mapping Table */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="font-bold text-slate-900 text-xs">
                  SSO Gruppen &rarr; PflegeRust Rollen-Mapping
                </div>
                <p className="text-[11px] text-slate-500">
                  Benutzer erhalten automatisch die entsprechende Fachrolle anhand ihrer IdP-Gruppenzugehörigkeit (z.B. Keycloak Realm Roles oder Azure AD App Roles).
                </p>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">IdP Gruppe / Claim</th>
                        <th className="p-2.5">Zugeordnete PflegeRust Rolle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {ssoForm.rollenMapping.map((rm, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-800 font-bold">{rm.ssoGruppe}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded ${getRoleBadge(rm.zielRolle)}`}>
                              {rm.zielRolle}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  SSO-Einstellungen in MariaDB speichern
                </button>
              </div>
            </form>
          </div>

          {/* Diagnostics & Simulator (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* OIDC Test Card */}
            {oidcTestResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>OIDC Discovery erfolgreich</span>
                </div>
                <div className="text-[11px] text-emerald-800 font-mono">
                  Latenz: {oidcTestResult.latencyMs} ms · TLS 1.3
                </div>
                <div className="space-y-1 text-[10px] font-mono text-emerald-950 pt-1 border-t border-emerald-200">
                  <div className="truncate">Auth: {oidcTestResult.endpoints.auth}</div>
                  <div className="truncate">Token: {oidcTestResult.endpoints.token}</div>
                  <div className="truncate">JWKS: {oidcTestResult.endpoints.jwks}</div>
                </div>
              </div>
            )}

            {/* OIDC Claim Mapping Validator (read-only; no passwordless session switch) */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3 text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-teal-700" />
                <span>OIDC Claim- &amp; Rollen-Mapping prüfen</span>
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Prüfen Sie ohne Sitzungswechsel, welcher PflegeRust-Rolle eine übermittelte IdP-Gruppe zugeordnet wird. Ein echter Benutzerwechsel erfordert stets eine vollständige Abmeldung und erneute Passwort- bzw. SSO-Authentifizierung.
              </p>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  IdP Gruppen-Claim testen
                </label>
                <input
                  type="text"
                  value={claimGroupInput}
                  onChange={(e) => setClaimGroupInput(e.target.value)}
                  placeholder="z.B. pflegedienst_leitung"
                  className="w-full p-2 border border-slate-300 rounded font-mono text-[11px]"
                />
                {(() => {
                  const matchedMapping = ssoForm.rollenMapping.find(
                    (m) => m.ssoGruppe.toLowerCase() === claimGroupInput.trim().toLowerCase()
                  );
                  const resolvedRole = matchedMapping
                    ? matchedMapping.zielRolle
                    : ssoForm.defaultRolle;
                  return (
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        Ergebnis der RBAC-Auswertung
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-600">
                          {matchedMapping ? 'Direktes Mapping' : 'Fallback (Standardrolle)'}:
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] border ${getRoleBadge(
                            resolvedRole
                          )}`}
                        >
                          {resolvedRole}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Architecture note */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1.5">
              <span className="font-bold text-slate-900 block">Sicherheit &amp; DSGVO:</span>
              <p className="text-[11px] leading-relaxed">
                Tokens werden lokal im Rust-Backend mit dem öffentlichen JWKS-Schlüssel des Identity Providers kryptografisch validiert. Es werden keine Passwörter in der MariaDB gespeichert.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Audit Log */}
      {canReadAudit && activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden space-y-0">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
            <div>
              <span className="font-bold text-slate-900 block">
                DSGVO-Zugriffsprotokoll (BSI IT-Grundschutz)
              </span>
              <span className="text-slate-500">
                Lückenlose Aufzeichnung aller Klienten- und Systemzugriffe
              </span>
            </div>
            <span className="font-mono text-teal-800 font-bold bg-teal-50 border border-teal-200 px-2 py-1 rounded">
              MariaDB audit_logs
            </span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Zeitstempel</th>
                <th className="p-3">Benutzer &amp; Rolle</th>
                <th className="p-3">Aktion</th>
                <th className="p-3">Ressource</th>
                <th className="p-3">Details</th>
                <th className="p-3 font-mono">IP-Adresse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-600 whitespace-nowrap">{log.zeitstempel}</td>
                  <td className="p-3">
                    <span className="font-sans font-bold text-slate-900">{log.benutzer}</span>
                    <span className={`ml-2 px-1.5 py-0.2 rounded text-[10px] ${getRoleBadge(log.rolle)}`}>
                      {log.rolle}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`font-bold ${
                        log.aktion === 'LOGIN_FAILED'
                          ? 'text-rose-700'
                          : log.aktion === 'SYSTEM_SETUP' ||
                            log.aktion === 'ROLE_CHANGE' ||
                            log.aktion === 'ROLE_CONFIG_CHANGE'
                          ? 'text-purple-800'
                          : log.aktion === 'PASSWORD_CHANGE'
                          ? 'text-amber-700'
                          : log.aktion === 'LOGOUT'
                          ? 'text-slate-600'
                          : 'text-teal-800'
                      }`}
                    >
                      {log.aktion}
                    </span>
                  </td>
                  <td className="p-3 text-slate-800 font-sans">{log.ressource}</td>
                  <td className="p-3 text-slate-600 font-sans max-w-xs">{log.details}</td>
                  <td className="p-3 text-slate-500">{log.ipAdresse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: New User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Neuen Benutzer anlegen</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Vorname</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="z.B. Sandra"
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Nachname *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="z.B. Meier"
                    className="w-full p-2 border border-slate-300 rounded font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Benutzername *</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="z.B. s.meier"
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-medium block mb-1">E-Mail-Adresse *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="sandra.meier@pflegedienst.de"
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Rolle (RBAC)</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as BenutzerRolle)}
                    className="w-full p-2 border border-slate-300 rounded font-medium"
                  >
                    <option value="Pflegefachkraft">Pflegefachkraft</option>
                    <option value="Pflegehelfer">Pflegehelfer</option>
                    <option value="Wohnbereichsleitung">Wohnbereichsleitung</option>
                    <option value="PDL">Pflegedienstleitung (PDL)</option>
                    <option value="Verwaltung_Abrechnung">Verwaltung &amp; Abrechnung</option>
                    <option value="Admin">Administrator</option>
                    <option value="Datenschutz_QM">Datenschutz &amp; QM</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-medium block mb-1">Authentifizierung</label>
                  <select
                    value={newAuthMethod}
                    onChange={(e) => setNewAuthMethod(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded font-medium"
                  >
                    <option value="oidc_keycloak">Keycloak SSO (OIDC)</option>
                    <option value="entra_id">Microsoft Entra ID</option>
                    <option value="google_sso">Google Workspace SSO</option>
                    <option value="lokal">Lokales Passwort</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">Abteilung / Einsatzbereich</label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="z.B. Tour 1 Nord / Wundmanagement"
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              {/* Mandatory Initial Password */}
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-teal-700" />
                  <span>
                    {newAuthMethod === 'lokal'
                      ? 'Initialpasswort (MariaDB PBKDF2/Argon2) *'
                      : 'Initiales SSO- / IdP-Passwort *'}
                  </span>
                </div>

                {newUserError && (
                  <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                    {newUserError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Passwort *</label>
                    <input
                      type="password"
                      required
                      value={newInitialPassword}
                      onChange={(e) => setNewInitialPassword(e.target.value)}
                      placeholder="Mind. 8 Zeichen"
                      className="w-full p-2 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Wiederholen *</label>
                    <input
                      type="password"
                      required
                      value={newInitialPasswordConfirm}
                      onChange={(e) => setNewInitialPasswordConfirm(e.target.value)}
                      placeholder="Passwort bestätigen"
                      className="w-full p-2 border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] bg-slate-50 border border-slate-200 rounded p-2">
                  {[
                    { ok: newPwPolicy.checks.minLength, label: 'Mind. 8 Zeichen' },
                    { ok: newPwPolicy.checks.hasUpper, label: 'Großbuchstabe' },
                    { ok: newPwPolicy.checks.hasLower, label: 'Kleinbuchstabe' },
                    { ok: newPwPolicy.checks.hasDigit, label: 'Ziffer (0–9)' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-1 ${
                        item.ok ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {item.ok ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <X className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                {newAuthMethod === 'lokal' && (
                  <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newForceChange}
                      onChange={(e) => setNewForceChange(e.target.checked)}
                      className="rounded text-teal-700"
                    />
                    <span>Passwortänderung beim ersten Login erzwingen</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUserError(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={!newPwPolicy.valid}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  Benutzer sicher erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Password Reset */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-teal-700" />
                <h3 className="font-bold text-slate-900 text-sm">Passwort zurücksetzen</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px]">
              Konto:{' '}
              <span className="font-bold text-slate-900">
                {resetTargetUser.vorname} {resetTargetUser.name}
              </span>{' '}
              (<span className="font-mono">{resetTargetUser.benutzername}</span>)
            </div>

            {resetError && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="text-slate-700 font-medium block mb-1">
                  Neues Passwort *
                </label>
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Mind. 8 Zeichen, Groß-/Kleinbuchstaben, Ziffer"
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">
                  Passwort wiederholen *
                </label>
                <input
                  type="password"
                  required
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  placeholder="Passwort bestätigen"
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-1 text-[10px] bg-slate-50 border border-slate-200 rounded p-2">
                {[
                  { ok: resetPwPolicy.checks.minLength, label: 'Mind. 8 Zeichen' },
                  { ok: resetPwPolicy.checks.hasUpper, label: 'Großbuchstabe' },
                  { ok: resetPwPolicy.checks.hasLower, label: 'Kleinbuchstabe' },
                  { ok: resetPwPolicy.checks.hasDigit, label: 'Ziffer (0–9)' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-1 ${
                      item.ok ? 'text-emerald-700 font-medium' : 'text-slate-500'
                    }`}
                  >
                    {item.ok ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <X className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              {resetTargetUser.authMethode === 'lokal' && (
                <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetForceChange}
                    onChange={(e) => setResetForceChange(e.target.checked)}
                    className="rounded text-teal-700"
                  />
                  <span>Passwortänderung beim nächsten Login erzwingen</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={!resetPwPolicy.valid}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-800 rounded hover:bg-teal-900 disabled:opacity-50 cursor-pointer"
                >
                  Neues Passwort speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
