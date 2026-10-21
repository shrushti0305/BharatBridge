import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Crown,
  ShieldCheck,
  AlertTriangle,
  Car,
  Users,
  Calendar,
  Radio,
  Settings,
  MapPin,
  Sparkles,
  Printer,
  Moon,
  Sun,
  LayoutDashboard
} from 'lucide-react';
import { TabKey, Incident, Vehicle, VIPGuest } from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: TabKey) => void;
  vipGuests: VIPGuest[];
  incidents: Incident[];
  vehicles: Vehicle[];
  onSelectVIP?: (guest: VIPGuest) => void;
  onSelectIncident?: (incident: Incident) => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  onOpenMapsGrounding?: () => void;
  onOpenShiftBriefing?: () => void;
  onSimulateScan?: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  vipGuests,
  incidents,
  vehicles,
  onSelectVIP,
  onSelectIncident,
  onSelectVehicle,
  onOpenMapsGrounding,
  onOpenShiftBriefing,
  onSimulateScan,
  darkMode,
  onToggleDarkMode,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  // Navigation Items
  const navigationItems = [
    { label: 'Overview & Gate Monitoring', tab: 'overview' as TabKey, icon: LayoutDashboard, category: 'Navigation' },
    { label: 'VIP Protocol Hub & Convoys', tab: 'vip' as TabKey, icon: Crown, category: 'Navigation' },
    { label: 'Tactical Venue & Corridor Map', tab: 'map' as TabKey, icon: MapPin, category: 'Navigation' },
    { label: 'Fleet Mobility & Telematics', tab: 'mobility' as TabKey, icon: Car, category: 'Navigation' },
    { label: 'Incidents & Triage Queue', tab: 'incidents' as TabKey, icon: AlertTriangle, category: 'Navigation' },
    { label: 'Tasks & Volunteer Dispatch', tab: 'tasks' as TabKey, icon: ShieldCheck, category: 'Navigation' },
    { label: 'Volunteers & Zone Roster', tab: 'volunteers' as TabKey, icon: Users, category: 'Navigation' },
    { label: 'Program Sessions & AV Feeds', tab: 'sessions' as TabKey, icon: Calendar, category: 'Navigation' },
    { label: 'Communications & Tactical Radio', tab: 'comms' as TabKey, icon: Radio, category: 'Navigation' },
    { label: 'Admin, Audit & Scanning Controls', tab: 'admin' as TabKey, icon: Settings, category: 'Navigation' },
  ].filter((item) => !q || item.label.toLowerCase().includes(q));

  // Matched VIPs
  const matchedVIPs = (vipGuests || [])
    .filter(
      (v) =>
        q &&
        (v.name.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q) ||
          v.countryOrOrg.toLowerCase().includes(q) ||
          v.officialTitle.toLowerCase().includes(q))
    )
    .slice(0, 5);

  // Matched Incidents
  const matchedIncidents = (incidents || [])
    .filter(
      (inc) =>
        q &&
        (inc.id.toLowerCase().includes(q) ||
          inc.title.toLowerCase().includes(q) ||
          inc.location.toLowerCase().includes(q))
    )
    .slice(0, 4);

  // Matched Vehicles
  const matchedVehicles = (vehicles || [])
    .filter(
      (vh) =>
        q &&
        (vh.id.toLowerCase().includes(q) ||
          vh.driver.toLowerCase().includes(q) ||
          vh.route.toLowerCase().includes(q) ||
          vh.type.toLowerCase().includes(q))
    )
    .slice(0, 3);

  // Quick Command Actions
  const actionItems = [
    {
      label: 'Google Maps Grounding Intel',
      detail: 'Analyze real-time Singapore routes & hospital access',
      icon: MapPin,
      action: () => {
        onClose();
        if (onOpenMapsGrounding) onOpenMapsGrounding();
      },
    },
    {
      label: 'Generate Shift Handover Briefing',
      detail: 'View printable official commander handover PDF sheet',
      icon: Printer,
      action: () => {
        onClose();
        if (onOpenShiftBriefing) onOpenShiftBriefing();
      },
    },
    {
      label: 'Simulate VIP QR Gate Scan',
      detail: 'Trigger live turnstile arrival test scan event',
      icon: Sparkles,
      action: () => {
        onClose();
        if (onSimulateScan) onSimulateScan();
      },
    },
    {
      label: darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      detail: 'Toggle command console display contrast mode',
      icon: darkMode ? Sun : Moon,
      action: () => {
        onToggleDarkMode();
        onClose();
      },
    },
  ].filter((act) => !q || act.label.toLowerCase().includes(q) || act.detail.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[var(--card)] border border-[var(--line)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-[var(--ink)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-[var(--line)] px-4 py-3 bg-[var(--bg)]/50">
          <Search className="w-5 h-5 text-[var(--primary)] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, guest (e.g. 'Lawrence Wong', 'VIP-001'), incident ('INC-024'), or vehicle..."
            className="w-full bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--mute)] focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--line)] text-[var(--mute)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto divide-y divide-[var(--line)] p-2 space-y-3 text-xs">
          {/* Quick Actions */}
          {actionItems.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--mute)] uppercase tracking-wider">
                Operational Actions
              </div>
              {actionItems.map((act, idx) => (
                <button
                  key={idx}
                  onClick={act.action}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-[var(--line)]/50 flex items-center justify-between transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] group-hover:scale-105 transition-transform">
                      <act.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--ink)]">{act.label}</div>
                      <div className="text-[10px] text-[var(--mute)]">{act.detail}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--mute)] group-hover:text-[var(--primary)]">
                    Execute ↵
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Matched VIP Dignitaries */}
          {matchedVIPs.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--mute)] uppercase tracking-wider flex items-center justify-between">
                <span>Dignitaries & Ministers</span>
                <span className="text-[10px] font-mono text-amber-600">{matchedVIPs.length} matches</span>
              </div>
              {matchedVIPs.map((vip) => (
                <button
                  key={vip.id}
                  onClick={() => {
                    onSelectTab('vip');
                    if (onSelectVIP) onSelectVIP(vip);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-[var(--line)]/50 flex items-center justify-between transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[var(--ink)] truncate">{vip.name}</span>
                        <span className="font-mono text-[9px] px-1 rounded bg-[var(--line)] text-[var(--mute)]">
                          {vip.id}
                        </span>
                        <span className="text-[10px] font-bold text-amber-600 px-1 rounded bg-amber-500/10">
                          {vip.tier}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--mute)] truncate">
                        {vip.officialTitle} · {vip.countryOrOrg}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-emerald-600 font-semibold block">{vip.motorcade.status}</span>
                    <span className="text-[9px] font-mono text-[var(--mute)]">{vip.assignedSuite}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Matched Incidents */}
          {matchedIncidents.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--mute)] uppercase tracking-wider flex items-center justify-between">
                <span>Active Incidents & Alerts</span>
                <span className="text-[10px] font-mono text-red-600">{matchedIncidents.length} matches</span>
              </div>
              {matchedIncidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => {
                    onSelectTab('incidents');
                    if (onSelectIncident) onSelectIncident(inc);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-[var(--line)]/50 flex items-center justify-between transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-md ${
                        inc.priority === 'HIGH'
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[var(--ink)] truncate">{inc.title}</span>
                        <span className="font-mono text-[9px] px-1 rounded bg-[var(--line)] text-[var(--mute)]">
                          {inc.id}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--mute)] truncate">
                        {inc.location} · Assigned: {inc.assignedTeam}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      inc.status === 'RESOLVED'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}
                  >
                    {inc.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Matched Vehicles */}
          {matchedVehicles.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--mute)] uppercase tracking-wider">
                Fleet Mobility & Shuttles
              </div>
              {matchedVehicles.map((vh) => (
                <button
                  key={vh.id}
                  onClick={() => {
                    onSelectTab('mobility');
                    if (onSelectVehicle) onSelectVehicle(vh);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-[var(--line)]/50 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-600">
                      <Car className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-[var(--ink)]">
                        {vh.id} · {vh.driver}
                      </div>
                      <div className="text-[10px] text-[var(--mute)]">
                        {vh.type} · {vh.route}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[10px] text-[var(--ink)]">{vh.passengers} pax</span>
                    <span className="text-[10px] text-amber-600 block">{vh.eta}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Navigation Section */}
          {navigationItems.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--mute)] uppercase tracking-wider">
                Command Deck Navigation
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {navigationItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onSelectTab(item.tab);
                      onClose();
                    }}
                    className="text-left p-2 rounded-lg hover:bg-[var(--line)]/50 flex items-center gap-2.5 transition-colors cursor-pointer text-xs"
                  >
                    <item.icon className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                    <span className="font-medium text-[var(--ink)] truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {actionItems.length === 0 &&
            matchedVIPs.length === 0 &&
            matchedIncidents.length === 0 &&
            matchedVehicles.length === 0 &&
            navigationItems.length === 0 && (
              <div className="py-8 text-center text-xs text-[var(--mute)]">
                No commands, dignitaries, incidents, or routes matching &ldquo;{query}&rdquo;.
              </div>
            )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-between text-[11px] text-[var(--mute)]">
          <div className="flex items-center gap-3">
            <span>
              Use <kbd className="px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--line)] font-mono">↑</kbd>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--line)] font-mono">↓</kbd> to navigate
            </span>
            <span>·</span>
            <span>
              Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--line)] font-mono">ESC</kbd> to exit
            </span>
          </div>
          <span className="font-mono text-[10px] text-[var(--primary)]">APEX Operational Hub</span>
        </div>
      </div>
    </div>
  );
};
