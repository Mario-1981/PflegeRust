import React from 'react';
import {
  LayoutDashboard,
  Route,
  Users,
  FileHeart,
  Pill,
  Menu,
} from 'lucide-react';
import { ActiveSessionUser, BenutzerRolle, RollenDefinition } from '../types/pflege';
import { canAccessTab } from '../data/rbacConfig';

interface MobileBottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenDrawer: () => void;
  activeUser: ActiveSessionUser;
  rollenConfig: Record<BenutzerRolle, RollenDefinition>;
  tourCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenDrawer,
  activeUser,
  rollenConfig,
  tourCount,
}) => {
  const canTab = (tabId: string) => canAccessTab(activeUser.role, tabId, rollenConfig);

  const candidateTabs = [
    { id: 'dashboard', label: 'Start', icon: LayoutDashboard },
    { id: 'touren', label: 'Touren', icon: Route, badge: tourCount },
    { id: 'klienten', label: 'Klienten', icon: Users },
    { id: 'sis', label: 'SIS', icon: FileHeart },
    { id: 'medikation', label: 'Medik.', icon: Pill },
  ].filter((t) => canTab(t.id));

  // Keep up to 4 quick destinations + 1 "Menü" drawer button (max 5 evenly spaced items)
  const primaryTabs = candidateTabs.slice(0, 4);
  const isOverflowTabActive = !primaryTabs.some((t) => t.id === currentTab);

  return (
    <nav
      aria-label="Mobile Hauptnavigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-bottom shadow-[0_-2px_10px_rgba(15,23,42,0.05)]"
    >
      <div
        className="grid items-center h-14 px-1"
        style={{ gridTemplateColumns: `repeat(${primaryTabs.length + 1}, minmax(0, 1fr))` }}
      >
        {primaryTabs.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center min-h-[48px] px-1 rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? 'text-teal-700 font-semibold'
                  : 'text-slate-500 active:bg-slate-100'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-teal-700 text-white text-[9px] font-mono font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight mt-0.5 truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenDrawer}
          className={`flex flex-col items-center justify-center min-h-[48px] px-1 rounded-lg transition-colors cursor-pointer ${
            isOverflowTabActive
              ? 'text-teal-700 font-semibold'
              : 'text-slate-500 active:bg-slate-100'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] leading-tight mt-0.5">Menü</span>
        </button>
      </div>
    </nav>
  );
};
