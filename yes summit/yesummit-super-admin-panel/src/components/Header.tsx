import React, { useState, useEffect } from 'react';
import {
  Clock,
  Radio,
  Search,
  Bell,
  Sun,
  Moon,
  AlertOctagon,
  ShieldCheck,
  CheckCircle2,
  X,
  Cpu,
  MapPin
} from 'lucide-react';
import { TabKey, ToastNotification } from '../types';

interface HeaderProps {
  currentTab: TabKey;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  unreadCount: number;
  scanningPaused: boolean;
  onToggleScanningModal: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectTab: (tab: TabKey) => void;
  notifications: ToastNotification[];
  onOpenArchitectureModal?: () => void;
  onOpenMapsGrounding?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  unreadCount,
  scanningPaused,
  onToggleScanningModal,
  darkMode,
  onToggleDarkMode,
  notifications,
  onSelectTab,
  onOpenArchitectureModal,
  onOpenMapsGrounding,
  onOpenCommandPalette
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState<boolean>(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-SG', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) + ' SGT (UTC+8)'
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-[var(--line)] bg-[var(--card)] sticky top-0 z-40 shadow-xs transition-colors">
      {/* Scanning paused danger banner if active */}
      {scanningPaused && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-xs sm:text-sm font-semibold animate-pulse">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>CRITICAL NOTICE: All entry and meal scanning is currently PAUSED by Super Admin. Turnstiles in offline fallback mode.</span>
          </div>
          <button
            onClick={onToggleScanningModal}
            className="underline hover:text-red-100 font-bold ml-4 whitespace-nowrap"
          >
            Review & Resume
          </button>
        </div>
      )}

      {/* Main header row */}
      <div className="px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-xs">
              APEX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--ink)] whitespace-nowrap">
                  APEX YESummit Command Centre
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  LIVE OPS
                </span>
              </div>
              <p className="text-[11px] text-[var(--mute)]">
                Global Diplomatic Protocol & Venue Operations Deck
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-[var(--mute)] border-l border-[var(--line)] pl-3">
            <span className="font-medium text-[var(--ink)]">Event: YESummit 2027</span>
            <span>·</span>
            <span>Day 2 of 3</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Operational 99.4%
            </span>
            {onOpenArchitectureModal && (
              <>
                <span>·</span>
                <button
                  type="button"
                  onClick={onOpenArchitectureModal}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 border border-[var(--primary)]/30 transition-colors cursor-pointer"
                  title="Inspect Distributed Architecture & Event Bus Console"
                >
                  <Cpu className="w-3 h-3 text-[var(--primary)]" />
                  <span>Event Bus: 142 evt/s</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right tools and actions */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {/* Live Clock */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg)] border border-[var(--line)] text-xs font-mono tabular-nums text-[var(--ink)]">
            <Clock className="w-3.5 h-3.5 text-[var(--mute)]" />
            <span>{timeStr || '11:15:00 SGT (UTC+8)'}</span>
          </div>

          {/* Google Maps Grounding Assistant Button */}
          {onOpenMapsGrounding && (
            <button
              onClick={onOpenMapsGrounding}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-semibold transition-colors cursor-pointer"
              title="Google Maps Operational Grounding (gemini-3.5-flash)"
            >
              <MapPin className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden md:inline">Google Maps Intel</span>
            </button>
          )}

          {/* Quick Search Box / Command Palette Trigger */}
          <div
            onClick={onOpenCommandPalette}
            className="relative hidden sm:flex items-center w-48 md:w-60 cursor-pointer group"
          >
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)] group-hover:text-[var(--primary)] transition-colors" />
            <input
              type="text"
              readOnly
              placeholder="Search or press ⌘K..."
              value={searchQuery}
              className="w-full pl-8 pr-12 py-1.5 text-xs rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--mute)] group-hover:border-[var(--primary)] cursor-pointer focus:outline-hidden"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-mono rounded bg-[var(--line)] text-[var(--mute)] border border-[var(--line)]">
              ⌘K
            </kbd>
          </div>

          {/* Notifications Dropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
              className="relative p-2 rounded-md hover:bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] transition-colors"
              title="Recent Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification drop menu */}
            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--card)] border border-[var(--line)] rounded-lg shadow-xl py-2 z-50">
                <div className="px-3 py-2 border-b border-[var(--line)] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    System Alerts & Logs ({notifications.length})
                  </span>
                  <button
                    onClick={() => setShowNotificationsDropdown(false)}
                    className="text-[11px] text-[var(--mute)] hover:text-[var(--ink)]"
                  >
                    Close
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[var(--line)]">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--mute)]">
                      No active alerts. All systems nominal.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-3 text-xs hover:bg-[var(--bg)] transition-colors">
                        <div className="flex items-center justify-between font-semibold text-[var(--ink)]">
                          <span>{n.title}</span>
                          <span className="text-[10px] text-[var(--mute)] font-mono">{n.timestamp}</span>
                        </div>
                        <p className="text-[var(--mute)] mt-1 text-[11px]">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-[var(--line)] bg-[var(--bg)] text-center">
                  <button
                    onClick={() => {
                      setShowNotificationsDropdown(false);
                      onSelectTab('incidents');
                    }}
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    View Incident Dashboard →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme switcher */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-md hover:bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Operator Identity Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--line)]">
            <div className="w-7 h-7 rounded-full bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center">
              AS
            </div>
            <div className="hidden xl:block text-left text-xs leading-tight">
              <div className="font-semibold text-[var(--ink)]">A. Sharma</div>
              <div className="text-[10px] text-[var(--mute)]">Super Admin</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
