import React from 'react';
import {
  LayoutDashboard,
  Users,
  Route,
  FileHeart,
  Pill,
  CalendarCheck,
  ReceiptText,
  ArrowRightLeft,
  Terminal,
  Code2,
  Server,
  Database,
  ShieldCheck,
  LogOut,
  ArrowLeftRight,
  Plug,
  Fingerprint,
  X,
} from 'lucide-react';
import {
  ActiveSessionUser,
  BenutzerRolle,
  EinrichtungsProfil,
  RollenDefinition,
} from '../types/pflege';
import { canAccessTab, hasPermission } from '../data/rbacConfig';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  clientCount: number;
  tourCount: number;
  userCount: number;
  activeAddonCount: number;
  einrichtung: EinrichtungsProfil;
  rollenConfig: Record<BenutzerRolle, RollenDefinition>;
  onOpenMariaDbModal: () => void;
  activeUser: ActiveSessionUser;
  hasActive2fa: boolean;
  passkeyCount: number;
  onOpenMfaModal: () => void;
  onSwitchUser: () => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  clientCount,
  tourCount,
  userCount,
  activeAddonCount,
  einrichtung,
  rollenConfig,
  onOpenMariaDbModal,
  activeUser,
  hasActive2fa,
  passkeyCount,
  onOpenMfaModal,
  onSwitchUser,
  onLogout,
  isMobileOpen,
  onCloseMobile,
}) => {
  const canTab = (tabId: string) => canAccessTab(activeUser.role, tabId, rollenConfig);
  const canManageUsers = hasPermission(activeUser.role, 'users_verwalten', rollenConfig);
  const canManageAddons = hasPermission(activeUser.role, 'addons_verwalten', rollenConfig);
  const canSystem = hasPermission(activeUser.role, 'system_technik', rollenConfig);

  const pflegeNavItems = [
    { id: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
    { id: 'klienten', label: 'Klientenakte', icon: Users, count: clientCount },
    { id: 'touren', label: 'Tourenplanung', icon: Route, count: tourCount },
    { id: 'sis', label: 'SIS-Dokumentation', icon: FileHeart },
    { id: 'medikation', label: 'Medikation & HKP', icon: Pill },
    { id: 'dienstplan', label: 'Dienstplan & Personal', icon: CalendarCheck },
    { id: 'abrechnung', label: 'Abrechnung SGB XI / V', icon: ReceiptText },
    {
      id: 'addons',
      label: canManageAddons ? 'Add-ons & Telematik (TI)' : 'Telematik (TI)',
      icon: Plug,
      count: activeAddonCount,
    },
    {
      id: 'users',
      label: canManageUsers ? 'Nutzer, Rollen & SSO' : 'DSGVO Audit-Log',
      icon: ShieldCheck,
      count: canManageUsers ? userCount : undefined,
    },
  ].filter((item) => canTab(item.id));

  const techNavItems = [
    { id: 'migration', label: 'SNAP-Migrationstool', icon: ArrowRightLeft, highlight: true },
    { id: 'rust', label: 'Rust Core & MariaDB', icon: Code2 },
    { id: 'terminal', label: 'Debian Terminal (CLI)', icon: Terminal },
    { id: 'systempflege', label: 'System: Snap vs. Debian', icon: Server },
  ].filter((item) => canTab(item.id));

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    onCloseMobile();
  };

  const renderSidebarContent = (isDrawer: boolean) => (
    <div
      className={`bg-slate-900 text-slate-300 flex flex-col h-full select-none ${
        isDrawer ? 'w-[min(19rem,86vw)] safe-top safe-bottom shadow-2xl' : 'w-64 border-r border-slate-800'
      }`}
    >
      <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            {einrichtung.versorgungsform}
          </div>
          <div className="text-sm font-medium text-white truncate" title={einrichtung.name}>
            {einrichtung.name}
          </div>
          <div className="mt-1 text-xs text-teal-400 font-mono flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>Debian 12 · MariaDB 10.11</span>
          </div>
        </div>
        {isDrawer && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Menü schließen"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pflegemanagement (wie SNAP)
          </div>
          <nav className="space-y-1">
            {pflegeNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 ${
                    isDrawer ? 'min-h-[44px] py-2.5 text-sm' : 'py-2 text-xs'
                  } rounded-md font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        isActive ? 'bg-teal-800 text-teal-100' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {techNavItems.length > 0 && (
          <div>
            <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Rust &amp; Debian Engine
            </div>
            <nav className="space-y-1">
              {techNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 ${
                      isDrawer ? 'min-h-[44px] py-2.5 text-sm' : 'py-2 text-xs'
                    } rounded-md font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-teal-700 text-white font-semibold shadow-xs'
                        : item.highlight
                        ? 'text-teal-300 bg-teal-950/60 hover:bg-teal-900/60 border border-teal-700/40'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.highlight && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-teal-800/80 text-teal-200 rounded shrink-0">
                        Tool
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <div className="px-3 py-3 border-t border-slate-800 bg-slate-900/90 space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {activeUser.name}
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate">
              {activeUser.role} · {activeUser.benutzername}
            </div>
          </div>
        </div>

        {isDrawer && (
          <PWAInstallButton variant="sidebar" onAfterTrigger={onCloseMobile} />
        )}

        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenMfaModal();
          }}
          title="Authenticator-App (TOTP), FIDO2-Sicherheitsstick & Passkeys verwalten"
          className="w-full flex items-center justify-between gap-2 px-2.5 py-2.5 min-h-[40px] rounded-md text-[11px] font-semibold text-teal-200 bg-teal-950/70 hover:bg-teal-900/70 border border-teal-800/70 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Fingerprint className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>2FA &amp; Passkeys</span>
          </span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              hasActive2fa || passkeyCount > 0
                ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700/60'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {hasActive2fa
              ? passkeyCount > 0
                ? `Aktiv · ${passkeyCount} PK`
                : 'Aktiv'
              : passkeyCount > 0
              ? `${passkeyCount} Passkey`
              : 'Einrichten'}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onSwitchUser();
            }}
            title="Sitzung pausieren und Benutzer wechseln"
            className="flex items-center justify-center gap-1.5 px-2 min-h-[40px] rounded-md text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
            <span>Wechseln</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onLogout();
            }}
            title="Sitzung vollständig beenden und abmelden"
            className="flex items-center justify-center gap-1.5 px-2 min-h-[40px] rounded-md text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-rose-900/70 hover:text-white border border-slate-700 hover:border-rose-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Abmelden</span>
          </button>
        </div>
      </div>

      {canSystem && (
        <div
          onClick={() => {
            onCloseMobile();
            onOpenMariaDbModal();
          }}
          className="p-3.5 border-t border-slate-800 bg-slate-950/60 hover:bg-slate-950 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              MariaDB InnoDB
            </span>
            <span className="font-mono text-teal-400 text-[11px]">Port 3306</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Pool: 10 Conns · utf8mb4
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop & Landscape Tablet persistent Sidebar */}
      <aside className="hidden lg:flex shrink-0 min-h-full">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile & Portrait Tablet Slide-Over Drawer */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigationsmenü"
        >
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{renderSidebarContent(true)}</div>
        </div>
      )}
    </>
  );
};
