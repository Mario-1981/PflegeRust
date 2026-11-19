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
} from 'lucide-react';
import {
  ActiveSessionUser,
  BenutzerRolle,
  EinrichtungsProfil,
  RollenDefinition,
} from '../types/pflege';
import { canAccessTab, hasPermission } from '../data/rbacConfig';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  clientCount: number;
  tourCount: number;
  userCount: number;
  einrichtung: EinrichtungsProfil;
  rollenConfig: Record<BenutzerRolle, RollenDefinition>;
  onOpenMariaDbModal: () => void;
  activeUser: ActiveSessionUser;
  onSwitchUser: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  clientCount,
  tourCount,
  userCount,
  einrichtung,
  rollenConfig,
  onOpenMariaDbModal,
  activeUser,
  onSwitchUser,
  onLogout,
}) => {
  const canTab = (tabId: string) => canAccessTab(activeUser.role, tabId, rollenConfig);
  const canManageUsers = hasPermission(activeUser.role, 'users_verwalten', rollenConfig);
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

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-full border-r border-slate-800 select-none">
      <div className="p-4 border-b border-slate-800">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
          {einrichtung.versorgungsform}
        </div>
        <div className="text-sm font-medium text-white truncate" title={einrichtung.name}>
          {einrichtung.name}
        </div>
        <div className="mt-1 text-xs text-teal-400 font-mono flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-teal-400" />
          <span>Debian 12 · MariaDB 10.11</span>
        </div>
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
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-700 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded ${
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
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-teal-700 text-white font-semibold shadow-xs'
                        : item.highlight
                        ? 'text-teal-300 bg-teal-950/60 hover:bg-teal-900/60 border border-teal-700/40'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.highlight && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-teal-800/80 text-teal-200 rounded">
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
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onSwitchUser}
            title="Sitzung pausieren und Benutzer wechseln"
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
            <span>Wechseln</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            title="Sitzung vollständig beenden und abmelden"
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-rose-900/70 hover:text-white border border-slate-700 hover:border-rose-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Abmelden</span>
          </button>
        </div>
      </div>

      {canSystem && (
        <div
          onClick={onOpenMariaDbModal}
          className="p-3.5 border-t border-slate-800 bg-slate-950/60 hover:bg-slate-950 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              MariaDB InnoDB
            </span>
            <span className="font-mono text-teal-400 text-[11px]">Port 3306</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Pool: 10 Conns · utf8mb4
          </div>
        </div>
      )}
    </aside>
  );
};
