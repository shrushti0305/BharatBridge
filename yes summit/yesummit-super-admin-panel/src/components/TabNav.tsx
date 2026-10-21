import React from 'react';
import {
  LayoutDashboard,
  Crown,
  AlertTriangle,
  CheckSquare,
  Bus,
  Users,
  Presentation,
  ShieldAlert,
  Map as MapIcon,
  UserCheck,
  Radio,
  Settings
} from 'lucide-react';
import { TabKey, UserRole } from '../types';

interface TabNavProps {
  currentTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  openIncidentsCount: number;
  openTasksCount: number;
  activeVehiclesIssueCount: number;
  sessionAlertsCount: number;
  userRole: UserRole;
  vipInTransitCount?: number;
}

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  badgeType?: 'danger' | 'warning' | 'info';
  allowedRoles: UserRole[];
}

export const TabNav: React.FC<TabNavProps> = ({
  currentTab,
  onSelectTab,
  openIncidentsCount,
  openTasksCount,
  activeVehiclesIssueCount,
  sessionAlertsCount,
  userRole,
  vipInTransitCount = 8
}) => {
  const tabs: TabDef[] = [
    {
      key: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      allowedRoles: ['super_admin', 'command_centre_lead', 'mobility_lead', 'volunteer_lead', 'safety_lead', 'technical_lead']
    },
    {
      key: 'vip',
      label: 'VIP & Protocol (50)',
      icon: Crown,
      badgeCount: vipInTransitCount > 0 ? vipInTransitCount : 50,
      badgeType: 'warning',
      allowedRoles: ['super_admin', 'command_centre_lead', 'mobility_lead']
    },
    {
      key: 'incidents',
      label: 'Incidents',
      icon: AlertTriangle,
      badgeCount: openIncidentsCount,
      badgeType: 'danger',
      allowedRoles: ['super_admin', 'command_centre_lead', 'safety_lead']
    },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      badgeCount: openTasksCount,
      badgeType: 'warning',
      allowedRoles: ['super_admin', 'command_centre_lead', 'mobility_lead', 'volunteer_lead', 'safety_lead', 'technical_lead']
    },
    {
      key: 'mobility',
      label: 'Mobility',
      icon: Bus,
      badgeCount: activeVehiclesIssueCount > 0 ? activeVehiclesIssueCount : undefined,
      badgeType: 'warning',
      allowedRoles: ['super_admin', 'command_centre_lead', 'mobility_lead']
    },
    {
      key: 'volunteers',
      label: 'Volunteers',
      icon: Users,
      allowedRoles: ['super_admin', 'command_centre_lead', 'volunteer_lead']
    },
    {
      key: 'sessions',
      label: 'Sessions',
      icon: Presentation,
      badgeCount: sessionAlertsCount > 0 ? sessionAlertsCount : undefined,
      badgeType: 'warning',
      allowedRoles: ['super_admin', 'command_centre_lead', 'technical_lead']
    },
    {
      key: 'heads',
      label: 'Heads',
      icon: ShieldAlert,
      allowedRoles: ['super_admin', 'command_centre_lead']
    },
    {
      key: 'map',
      label: 'Map',
      icon: MapIcon,
      allowedRoles: ['super_admin', 'command_centre_lead', 'mobility_lead', 'safety_lead', 'technical_lead']
    },
    {
      key: 'participants',
      label: 'Participants',
      icon: UserCheck,
      allowedRoles: ['super_admin', 'command_centre_lead']
    },
    {
      key: 'comms',
      label: 'Communications',
      icon: Radio,
      allowedRoles: ['super_admin', 'command_centre_lead', 'volunteer_lead']
    },
    {
      key: 'admin',
      label: 'Admin',
      icon: Settings,
      allowedRoles: ['super_admin']
    }
  ];

  // Filter tabs visible for current role
  const visibleTabs = tabs.filter((t) => t.allowedRoles.includes(userRole));

  return (
    <div className="border-b border-[var(--line)] bg-[var(--card)] px-4 lg:px-6">
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-2 -mb-px">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelectTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--bg)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              {typeof tab.badgeCount === 'number' && tab.badgeCount > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                    isActive
                      ? 'bg-white text-[var(--primary)]'
                      : tab.badgeType === 'danger'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 font-semibold'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold'
                  }`}
                >
                  {tab.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
