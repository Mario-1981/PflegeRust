import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  LogOut,
  ChevronDown,
  ShieldCheck,
  ArrowLeftRight,
  Lock,
  UserPlus,
  Fingerprint,
  Menu,
} from 'lucide-react';
import { ActiveSessionUser, BenutzerRolle, RollenDefinition } from '../types/pflege';
import { canAccessTab, hasPermission } from '../data/rbacConfig';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  clientCount: number;
  onOpenMariaDbModal: () => void;
  activeUser: ActiveSessionUser;
  activeSessions: ActiveSessionUser[];
  rollenConfig: Record<BenutzerRolle, RollenDefinition>;
  hasActive2fa: boolean;
  passkeyCount: number;
  onSwitchUser: (targetSessionId?: string) => void;
  onLogout: () => void;
  onOpenChangePassword: () => void;
  onOpenMfaModal: () => void;
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  clientCount,
  onOpenMariaDbModal,
  activeUser,
  activeSessions,
  rollenConfig,
  hasActive2fa,
  passkeyCount,
  onSwitchUser,
  onLogout,
  onOpenChangePassword,
  onOpenMfaModal,
  onOpenMobileMenu,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const initials = activeUser.name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const otherSignedInSessions = activeSessions.filter((s) => s.id !== activeUser.id);
  const canTab = (tabId: string) => canAccessTab(activeUser.role, tabId, rollenConfig);
  const canSystem = hasPermission(activeUser.role, 'system_technik', rollenConfig);
  const canUsersTab = canTab('users');
  const canManageUsers = hasPermission(activeUser.role, 'users_verwalten', rollenConfig);

  const canManageAddons = hasPermission(activeUser.role, 'addons_verwalten', rollenConfig);

  const navLinks = [
    { id: 'dashboard', label: 'Übersicht' },
    { id: 'klienten', label: `Klienten (${clientCount})` },
    { id: 'touren', label: 'Tourenplanung' },
    { id: 'sis', label: 'SIS & Doku' },
    { id: 'addons', label: canManageAddons ? 'Add-ons & TI' : 'Telematik (TI)' },
    { id: 'users', label: canManageUsers ? 'Nutzer & Rollen' : 'Audit-Log' },
    { id: 'migration', label: 'SNAP-Migration' },
    { id: 'rust', label: 'Rust & MariaDB Code' },
  ].filter((item) => canTab(item.id));

  return (
    <header className="sticky top-0 z-30 safe-top bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center justify-between gap-2 sm:gap-6 px-3 sm:px-6 py-2 sm:py-3">
        {/* Zone 1: Mobile Menu Trigger + Brand Wordmark */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Navigationsmenü öffnen"
            className="lg:hidden min-w-[44px] min-h-[44px] -ml-1.5 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => {
              if (canTab('dashboard')) onSelectTab('dashboard');
            }}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none whitespace-nowrap shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
              PR
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none">
                PflegeRust
              </span>
              <span className="text-[10px] text-teal-700 font-mono font-medium mt-0.5 hidden xs:block sm:block">
                MariaDB &amp; SSO
              </span>
            </div>
          </div>
        </div>

      {/* Zone 2: Concise single-line navigation links (filtered strictly by role) */}
      <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600">
        {navLinks.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === item.id ? 'text-teal-700 font-semibold' : ''
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Zone 3: PWA Install, User Session Menu, Logout, MariaDB & Export */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <PWAInstallButton variant="header" />

        {/* User Account Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
            title="Benutzerkonto, Benutzerwechsel & Abmeldung"
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 min-h-[40px] sm:min-h-[36px] text-xs bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <div className="font-semibold text-slate-800 text-[11px] leading-tight">
                {activeUser.name}
              </div>
              <div className="text-[10px] text-teal-700 font-mono leading-tight">
                {activeUser.role} · {activeUser.auth}
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                isUserMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isUserMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1.5 w-[min(18rem,calc(100vw-1.5rem))] bg-white border border-slate-200 rounded-lg shadow-lg z-40 overflow-hidden text-xs"
            >
              {/* Current signed-in user */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 truncate">{activeUser.name}</span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                    Aktiv
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 truncate">
                  {activeUser.email}
                </div>
                <div className="pt-1 flex items-center justify-between text-[10px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-semibold">
                    {activeUser.role}
                  </span>
                  <span className="text-slate-500">{activeUser.auth}</span>
                </div>
              </div>

              {/* Other currently signed-in sessions ONLY (never non-signed-in users) */}
              {otherSignedInSessions.length > 0 && (
                <div className="p-1.5 border-b border-slate-100 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Weitere angemeldete Sitzungen ({otherSignedInSessions.length})
                  </div>
                  {otherSignedInSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onSwitchUser(session.id);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-left hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          {session.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          {session.role} · Passwort erforderlich
                        </div>
                      </div>
                      <ArrowLeftRight className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              <div className="p-1.5 space-y-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenChangePassword();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-left text-slate-700 hover:bg-slate-100 font-medium cursor-pointer transition-colors"
                >
                  <Lock className="w-3.5 h-3.5 text-teal-700" />
                  <span>Passwort ändern</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenMfaModal();
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded text-left text-slate-700 hover:bg-slate-100 font-medium cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Fingerprint className="w-3.5 h-3.5 text-teal-700" />
                    <span>2FA &amp; Passkeys</span>
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                      hasActive2fa || passkeyCount > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {hasActive2fa
                      ? passkeyCount > 0
                        ? `2FA · ${passkeyCount} PK`
                        : '2FA aktiv'
                      : passkeyCount > 0
                      ? `${passkeyCount} Passkey`
                      : 'Einrichten'}
                  </span>
                </button>
                {canUsersTab && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onSelectTab('users');
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-left text-slate-700 hover:bg-slate-100 font-medium cursor-pointer transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                    <span>{canManageUsers ? 'Nutzer, Rollen & SSO' : 'DSGVO Audit-Log'}</span>
                  </button>
                )}
                <PWAInstallButton
                  variant="menuItem"
                  onAfterTrigger={() => setIsUserMenuOpen(false)}
                />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onSwitchUser();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-left text-slate-700 hover:bg-slate-100 font-medium cursor-pointer transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                  <span>Benutzer wechseln (mit Login)</span>
                </button>
              </div>

              <div className="p-1.5 border-t border-slate-100">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-left text-rose-700 hover:bg-rose-50 font-semibold cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Abmelden</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Direct Logout Button (tablet/desktop; mobile uses dropdown & drawer) */}
        <button
          type="button"
          onClick={onLogout}
          title="Sitzung beenden und abmelden"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-md transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Abmelden</span>
        </button>

        {canSystem && (
          <button
            onClick={onOpenMariaDbModal}
            title="MariaDB Verbindungseinstellungen & Status prüfen"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-teal-700" />
            <span className="font-mono">MariaDB 10.11</span>
          </button>
        )}
      </div>
      </div>
    </header>
  );
};


