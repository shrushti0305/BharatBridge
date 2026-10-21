import React, { useState, useEffect } from 'react';
import {
  Bus,
  Users,
  UserCheck,
  Presentation,
  AlertTriangle,
  CheckSquare,
  ArrowRight,
  Clock,
  MapPin,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Activity,
  QrCode,
  Crown,
  ShieldCheck,
  Play,
  Pause,
  Search,
  Sparkles,
  CheckCircle2,
  Phone,
  Car,
  Building2,
  X,
  Filter,
  ShieldAlert,
  Radio,
  Bell,
  BellRing,
  BellOff,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Check
} from 'lucide-react';
import {
  Incident,
  Task,
  Vehicle,
  Volunteer,
  Session,
  ActivityItem,
  TabKey,
  VIPGuest
} from '../types';
import { INITIAL_VIP_GUESTS } from '../data/vipData';

export interface VIPGateScanEvent {
  id: string;
  timestamp: string;
  timeAgo: string;
  guestId: string;
  name: string;
  title: string;
  countryOrOrg: string;
  tier: 'VVIP' | 'VIP';
  qrCode: string;
  gateLocation: string;
  status: 'ACCESS GRANTED' | 'ESCORT ENGAGED' | 'SECURITY CLEARED';
  liaisonName: string;
  liaisonPhone: string;
  assignedSuite: string;
  motorcadePlate: string;
  latencyMs: number;
  isNew?: boolean;
}

interface OverviewTabProps {
  incidents: Incident[];
  tasks: Task[];
  vehicles: Vehicle[];
  volunteers: Volunteer[];
  sessions: Session[];
  activities: ActivityItem[];
  vipGuests?: VIPGuest[];
  onSelectTab: (tab: TabKey) => void;
  onSelectIncident: (inc: Incident) => void;
  onSelectVehicle: (v: Vehicle) => void;
  onSelectTask: (t: Task) => void;
  onAddToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onLogActivity?: (message: string, category: 'incident' | 'task' | 'mobility' | 'system' | 'volunteer') => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  incidents,
  tasks,
  vehicles,
  volunteers,
  sessions,
  activities,
  vipGuests = [],
  onSelectTab,
  onSelectIncident,
  onSelectVehicle,
  onSelectTask,
  onAddToast,
  onLogActivity
}) => {
  const allVIPs = vipGuests && vipGuests.length > 0 ? vipGuests : INITIAL_VIP_GUESTS;

  // Gate Monitoring State
  const [isGateLiveStreaming, setIsGateLiveStreaming] = useState(true);
  const [gateFilterTier, setGateFilterTier] = useState<'ALL' | 'VVIP' | 'VIP'>('ALL');
  const [gateSearchQuery, setGateSearchQuery] = useState('');
  const [selectedGateCheckpoint, setSelectedGateCheckpoint] = useState<string>('ALL');
  const [inspectingScan, setInspectingScan] = useState<VIPGateScanEvent | null>(null);

  // Real-Time Push Notification Configuration for High-Profile VVIP Arrivals
  const [vvipPushEnabled, setVvipPushEnabled] = useState(true);
  const [vvipPushScope, setVvipPushScope] = useState<'SPECIFIC_WATCHLIST' | 'ALL_VVIP'>('SPECIFIC_WATCHLIST');
  // Default high-profile watchlist (cabinet ministers & diplomatic envoys)
  const [watchedVVIPIds, setWatchedVVIPIds] = useState<string[]>(() => {
    return allVIPs.filter((v) => v.tier === 'VVIP').slice(0, 5).map((v) => v.id);
  });
  const [pushSoundEnabled, setPushSoundEnabled] = useState(true);
  const [browserPushPermission, setBrowserPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
        setBrowserPushPermission(window.Notification.permission);
      }
    } catch {
      // Cross-origin iframe security restrictions
    }
  }, []);
  const [showVVIPPushConfigModal, setShowVVIPPushConfigModal] = useState(false);
  const [watchlistSearchQuery, setWatchlistSearchQuery] = useState('');
  const [latestVVIPPushAlert, setLatestVVIPPushAlert] = useState<{
    id: string;
    guestName: string;
    title: string;
    country: string;
    gate: string;
    timestamp: string;
    liaison: string;
  } | null>(null);

  // Diplomatic Arrival Audio Synthesizer (Web Audio API)
  const playDiplomaticChime = () => {
    if (!pushSoundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Tone 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.14, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  const dispatchVVIPPushNotification = (scan: VIPGateScanEvent) => {
    playDiplomaticChime();

    if (onAddToast) {
      onAddToast(
        `👑 High-Profile VVIP Arrival: ${scan.name}`,
        `${scan.title} (${scan.countryOrOrg}) cleared ${scan.gateLocation}. Liaison: ${scan.liaisonName} (${scan.liaisonPhone}).`,
        'warning'
      );
    }

    try {
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification && window.Notification.permission === 'granted') {
        new window.Notification(`👑 VVIP Arrival: ${scan.name}`, {
          body: `${scan.title} (${scan.countryOrOrg}) cleared ${scan.gateLocation}. Liaison: ${scan.liaisonName}`,
          icon: '/favicon.ico'
        });
      }
    } catch {
      // Safe fallback - browsers block notification construction in cross-origin frames
    }

    if (onLogActivity) {
      onLogActivity(
        `[VVIP REAL-TIME PUSH] ${scan.name} (${scan.countryOrOrg}) verified at ${scan.gateLocation}`,
        'system'
      );
    }

    setLatestVVIPPushAlert({
      id: scan.id,
      guestName: scan.name,
      title: scan.title,
      country: scan.countryOrOrg,
      gate: scan.gateLocation,
      timestamp: scan.timestamp,
      liaison: `${scan.liaisonName} (${scan.liaisonPhone})`
    });
  };

  const checkAndTriggerVVIPPush = (scan: VIPGateScanEvent) => {
    if (!vvipPushEnabled) return;
    if (scan.tier !== 'VVIP') return;

    const isTargeted =
      vvipPushScope === 'ALL_VVIP' || watchedVVIPIds.includes(scan.guestId);

    if (isTargeted) {
      dispatchVVIPPushNotification(scan);
    }
  };

  const handleRequestBrowserNotification = async () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
        const permission = await window.Notification.requestPermission();
        setBrowserPushPermission(permission);
        if (permission === 'granted' && onAddToast) {
          onAddToast('Desktop Push Enabled', 'Browser notifications activated for VVIP arrivals.', 'success');
        } else if (onAddToast) {
          onAddToast('Notice', 'In-app toasts and sound notifications are active.', 'info');
        }
      } else {
        if (onAddToast) {
          onAddToast('In-App Alerts Active', 'Desktop notifications restricted in preview frame. High-priority in-app alerts are active.', 'info');
        }
      }
    } catch {
      if (onAddToast) {
        onAddToast('In-App Alerts Active', 'Desktop notifications restricted in preview frame. High-priority in-app alerts are active.', 'info');
      }
    }
  };

  const handleToggleWatchVVIP = (guestId: string) => {
    setWatchedVVIPIds((prev) => {
      const exists = prev.includes(guestId);
      const updated = exists ? prev.filter((id) => id !== guestId) : [...prev, guestId];
      if (onAddToast) {
        const guest = allVIPs.find((g) => g.id === guestId);
        onAddToast(
          exists ? 'VVIP Removed from Watchlist' : 'VVIP Added to Watchlist',
          guest
            ? `${guest.name} (${guest.countryOrOrg}) ${exists ? 'will no longer trigger' : 'will now trigger'} real-time push alerts.`
            : `Watchlist updated (${updated.length} monitored).`,
          exists ? 'info' : 'success'
        );
      }
      return updated;
    });
  };

  const handleSendTestPush = () => {
    const sample = allVIPs.find((v) => v.tier === 'VVIP' && watchedVVIPIds.includes(v.id)) || allVIPs.find((v) => v.tier === 'VVIP') || allVIPs[0];
    const testScan = createScanEventFromGuest(sample, true);
    dispatchVVIPPushNotification(testScan);
  };

  // Helper to create a scan event
  const createScanEventFromGuest = (guest: VIPGuest, isLive: boolean = false): VIPGateScanEvent => {
    const gates = [
      'VIP Gate 4 (Red Carpet Arch)',
      'Gate 4 Presidential Air-Lock',
      'Gate 1 Presidential Concourse',
      'VIP Motorcade Bay South',
      'Executive Protocol Wing'
    ];
    const now = new Date();
    const timeString =
      now.toLocaleTimeString('en-SG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + ' SGT';

    const randomGate = gates[Math.floor(Math.random() * gates.length)];
    const latency = +(Math.random() * 0.9 + 0.6).toFixed(2);

    return {
      id: `SCAN-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: timeString,
      timeAgo: isLive ? 'Just now' : `${Math.floor(Math.random() * 12 + 1)}m ago`,
      guestId: guest.id,
      name: guest.name,
      title: guest.officialTitle,
      countryOrOrg: guest.countryOrOrg,
      tier: guest.tier,
      qrCode: `QR-${guest.id}`,
      gateLocation: randomGate,
      status: guest.tier === 'VVIP' ? 'ACCESS GRANTED' : 'SECURITY CLEARED',
      liaisonName: guest.liaisonOfficer?.name || 'Protocol Officer',
      liaisonPhone: guest.liaisonOfficer?.phone || '+65 8123 0004',
      assignedSuite: guest.assignedSuite || 'Bilateral Suite 1',
      motorcadePlate: guest.motorcade?.plateNumber || 'MID-01',
      latencyMs: latency,
      isNew: isLive
    };
  };

  // Initial Scan Events State
  const [gateScanEvents, setGateScanEvents] = useState<VIPGateScanEvent[]>(() => {
    const sampleGuests = allVIPs.slice(0, 10);
    return sampleGuests.map((g, idx) => {
      const scan = createScanEventFromGuest(g, false);
      scan.timeAgo = `${(idx + 1) * 2}m ago`;
      return scan;
    });
  });

  // Periodic Live Scan Simulation Ticker
  useEffect(() => {
    if (!isGateLiveStreaming) return;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * allVIPs.length);
      const chosenVIP = allVIPs[randomIndex];
      const newScan = createScanEventFromGuest(chosenVIP, true);

      setGateScanEvents((prev) => [newScan, ...prev.slice(0, 39)]);
      checkAndTriggerVVIPPush(newScan);

      setTimeout(() => {
        setGateScanEvents((current) =>
          current.map((item) => (item.id === newScan.id ? { ...item, isNew: false } : item))
        );
      }, 2500);
    }, 6000);

    return () => clearInterval(interval);
  }, [isGateLiveStreaming, allVIPs, vvipPushEnabled, vvipPushScope, watchedVVIPIds, pushSoundEnabled]);

  // Handler for manual VIP scan simulation
  const handleSimulateScan = () => {
    const randomIndex = Math.floor(Math.random() * allVIPs.length);
    const chosenVIP = allVIPs[randomIndex];
    const newScan = createScanEventFromGuest(chosenVIP, true);

    setGateScanEvents((prev) => [newScan, ...prev.slice(0, 39)]);
    checkAndTriggerVVIPPush(newScan);

    setTimeout(() => {
      setGateScanEvents((current) =>
        current.map((item) => (item.id === newScan.id ? { ...item, isNew: false } : item))
      );
    }, 2500);
  };

  // Filtered Scan Events
  const filteredGateScans = gateScanEvents.filter((scan) => {
    if (gateFilterTier !== 'ALL' && scan.tier !== gateFilterTier) return false;
    if (selectedGateCheckpoint !== 'ALL' && !scan.gateLocation.toLowerCase().includes(selectedGateCheckpoint.toLowerCase())) {
      return false;
    }
    if (gateSearchQuery.trim()) {
      const q = gateSearchQuery.trim().toLowerCase();
      const match =
        scan.name.toLowerCase().includes(q) ||
        scan.guestId.toLowerCase().includes(q) ||
        scan.id.toLowerCase().includes(q) ||
        scan.countryOrOrg.toLowerCase().includes(q) ||
        scan.title.toLowerCase().includes(q) ||
        scan.qrCode.toLowerCase().includes(q) ||
        scan.liaisonName.toLowerCase().includes(q) ||
        scan.gateLocation.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const clearedCount = Math.min(allVIPs.length, 38 + Math.floor(gateScanEvents.length / 5));
  const vvipClearedCount = allVIPs.filter((v) => v.tier === 'VVIP').length - 2;
  // Compute live KPIs
  const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const highIncidents = incidents.filter((i) => i.status !== 'RESOLVED' && i.priority === 'HIGH');
  const resolvedToday = incidents.filter((i) => i.status === 'RESOLVED').length + 20;

  const activeVehicles = vehicles.filter((v) => v.status === 'ON_TIME' || v.status === 'DELAYED');
  const delayedVehicles = vehicles.filter((v) => v.status === 'DELAYED').length;
  const breakdownVehicles = vehicles.filter((v) => v.status === 'BREAKDOWN').length;

  const activeVolunteers = volunteers.filter((v) => v.status !== 'OFFLINE').length + 175; // 186
  const availableVolunteers = volunteers.filter((v) => v.status === 'AVAILABLE').length + 9; // 12
  const notCheckedIn = volunteers.filter((v) => v.status === 'OFFLINE').length + 13; // 14

  const liveSessions = sessions.filter((s) => s.status === 'LIVE').length;
  const startingSoonSessions = sessions.filter((s) => s.status === 'STARTING_SOON').length;

  const openTasks = tasks.filter((t) => t.status !== 'COMPLETED');
  const doneTasksCount = tasks.filter((t) => t.status === 'COMPLETED').length + 310;

  // Build dynamic Attention Queue:
  // Tier NOW (red ▲): High incidents, vehicle breakdown, medical issues
  // Tier NEXT (amber ■): Medium incidents, delayed vehicles, unassigned tasks, session action required
  // Tier MONITOR (grey ●): Standby vehicles, low tasks, offline volunteers
  interface AttentionItem {
    id: string;
    tier: 'NOW' | 'NEXT' | 'MONITOR';
    title: string;
    location: string;
    minutesAgo: number;
    affectedCount: number;
    actionLabel: string;
    onClick: () => void;
  }

  const attentionItems: AttentionItem[] = [];

  // 1. High priority open incidents -> NOW
  openIncidents.forEach((inc) => {
    if (inc.priority === 'HIGH') {
      attentionItems.push({
        id: `inc-${inc.id}`,
        tier: 'NOW',
        title: `${inc.id}: ${inc.title}`,
        location: inc.location,
        minutesAgo: inc.minutesAgo,
        affectedCount: inc.affectedCount,
        actionLabel: 'Review Incident',
        onClick: () => onSelectIncident(inc)
      });
    }
  });

  // 2. Vehicle breakdowns -> NOW
  vehicles.forEach((vh) => {
    if (vh.status === 'BREAKDOWN') {
      attentionItems.push({
        id: `vh-${vh.id}`,
        tier: 'NOW',
        title: `Vehicle ${vh.id} breakdown on route (${vh.route})`,
        location: vh.location,
        minutesAgo: 26,
        affectedCount: 34,
        actionLabel: 'Dispatch Relief',
        onClick: () => onSelectVehicle(vh)
      });
    }
  });

  // 3. Medium incidents -> NEXT
  openIncidents.forEach((inc) => {
    if (inc.priority === 'MEDIUM') {
      attentionItems.push({
        id: `inc-${inc.id}`,
        tier: 'NEXT',
        title: `${inc.id}: ${inc.title}`,
        location: inc.location,
        minutesAgo: inc.minutesAgo,
        affectedCount: inc.affectedCount,
        actionLabel: 'Assign / Resolve',
        onClick: () => onSelectIncident(inc)
      });
    }
  });

  // 4. Delayed vehicles -> NEXT
  vehicles.forEach((vh) => {
    if (vh.status === 'DELAYED') {
      attentionItems.push({
        id: `vh-${vh.id}`,
        tier: 'NEXT',
        title: `Shuttle ${vh.id} delayed: ${vh.eta}`,
        location: vh.location,
        minutesAgo: 14,
        affectedCount: 42,
        actionLabel: 'View Route',
        onClick: () => onSelectVehicle(vh)
      });
    }
  });

  // 5. Sessions needing action -> NEXT
  sessions.forEach((s) => {
    if (s.avStatus === 'ACTION REQUIRED' || s.translationStatus === 'ACTION REQUIRED') {
      attentionItems.push({
        id: `ses-${s.id}`,
        tier: 'NEXT',
        title: `${s.room}: ${s.alertNote || 'AV / Translation Action Required'}`,
        location: s.room,
        minutesAgo: 10,
        affectedCount: parseInt(s.attendance) || 120,
        actionLabel: 'Manage Session',
        onClick: () => onSelectTab('sessions')
      });
    }
  });

  // 6. Unassigned High tasks -> NEXT
  openTasks.forEach((t) => {
    if (t.priority === 'HIGH' && t.assignee === 'Unassigned') {
      attentionItems.push({
        id: `tsk-${t.id}`,
        tier: 'NEXT',
        title: `${t.id}: ${t.title}`,
        location: t.location,
        minutesAgo: 8,
        affectedCount: 25,
        actionLabel: 'Assign Task',
        onClick: () => onSelectTask(t)
      });
    }
  });

  // 7. MONITOR items
  vehicles.forEach((vh) => {
    if (vh.status === 'STANDBY') {
      attentionItems.push({
        id: `vh-${vh.id}`,
        tier: 'MONITOR',
        title: `Vehicle ${vh.id} staging on standby (${vh.type})`,
        location: vh.location,
        minutesAgo: 45,
        affectedCount: 0,
        actionLabel: 'View Fleet',
        onClick: () => onSelectVehicle(vh)
      });
    }
  });

  // Sort: NOW first, then NEXT, then MONITOR; within tier sort by affected count descending
  const tierWeight = { NOW: 3, NEXT: 2, MONITOR: 1 };
  attentionItems.sort((a, b) => {
    if (tierWeight[b.tier] !== tierWeight[a.tier]) {
      return tierWeight[b.tier] - tierWeight[a.tier];
    }
    return b.affectedCount - a.affectedCount;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards Row - Clickable to jump to tabs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Mobility KPI */}
        <div
          onClick={() => onSelectTab('mobility')}
          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-xs text-[var(--mute)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Mobility</span>
            <Bus className="w-4 h-4 text-[var(--primary)] group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--ink)]">
            42<span className="text-xs font-normal text-[var(--mute)]">/48 active</span>
          </div>
          <div className="mt-2 text-[11px] space-y-0.5 text-[var(--mute)]">
            <div className="flex justify-between">
              <span>Delayed: <strong className="text-amber-600 font-semibold">{delayedVehicles}</strong></span>
              <span>Breakdown: <strong className="text-red-600 font-semibold">{breakdownVehicles}</strong></span>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              162 trips completed today
            </div>
          </div>
        </div>

        {/* Volunteers KPI */}
        <div
          onClick={() => onSelectTab('volunteers')}
          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-xs text-[var(--mute)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Volunteers</span>
            <Users className="w-4 h-4 text-[var(--primary)] group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--ink)]">
            {activeVolunteers}<span className="text-xs font-normal text-[var(--mute)]"> active</span>
          </div>
          <div className="mt-2 text-[11px] space-y-0.5 text-[var(--mute)]">
            <div className="flex justify-between">
              <span>Available: <strong className="text-emerald-600 font-semibold">{availableVolunteers}</strong></span>
              <span>Pending: <strong className="text-slate-500 font-semibold">{notCheckedIn}</strong></span>
            </div>
            <div className="text-[10px] text-[var(--mute)]">212 rostered workforce</div>
          </div>
        </div>

        {/* Participants KPI */}
        <div
          onClick={() => onSelectTab('participants')}
          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-xs text-[var(--mute)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Participants</span>
            <UserCheck className="w-4 h-4 text-[var(--primary)] group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--ink)]">
            2,840<span className="text-xs font-normal text-[var(--mute)]">/3,100</span>
          </div>
          <div className="mt-2 text-[11px] text-[var(--mute)]">
            <div className="flex items-center justify-between text-[11px]">
              <span>Check-in rate</span>
              <span className="font-semibold text-emerald-600">91.6%</span>
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelectTab('vip');
              }}
              className="flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-400 font-semibold pt-1 hover:underline cursor-pointer"
            >
              <span>50 VIP/VVIP Guests</span>
              <span>Motorcades (8 in transit) →</span>
            </div>
            <div className="w-full bg-[var(--line)] h-1.5 rounded-full mt-1 overflow-hidden">
              <div className="bg-[var(--primary)] h-full rounded-full" style={{ width: '91.6%' }} />
            </div>
          </div>
        </div>

        {/* Sessions KPI */}
        <div
          onClick={() => onSelectTab('sessions')}
          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-xs text-[var(--mute)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Sessions</span>
            <Presentation className="w-4 h-4 text-[var(--primary)] group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--ink)]">
            {liveSessions}<span className="text-xs font-normal text-[var(--mute)]"> live</span>
          </div>
          <div className="mt-2 text-[11px] space-y-0.5 text-[var(--mute)]">
            <div className="flex justify-between">
              <span>Starting soon: <strong className="text-amber-600 font-semibold">{startingSoonSessions}</strong></span>
              <span>Total: <strong className="text-[var(--ink)] font-semibold">{sessions.length}</strong></span>
            </div>
            <div className="text-[10px] text-amber-600 font-medium">2 require AV/tech check</div>
          </div>
        </div>

        {/* Incidents KPI */}
        <div
          onClick={() => onSelectTab('incidents')}
          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-xs text-[var(--mute)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Incidents</span>
            <AlertTriangle className="w-4 h-4 text-red-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--ink)] flex items-baseline gap-1">
            <span className={openIncidents.length > 0 ? 'text-red-600 dark:text-red-400' : ''}>
              {openIncidents.length}
            </span>
            <span className="text-xs font-normal text-[var(--mute)]">open</span>
          </div>
          <div className="mt-2 text-[11px] space-y-0.5 text-[var(--mute)]">
            <div className="flex justify-between">
              <span>High priority: <strong className="text-red-600 font-semibold">{highIncidents.length}</strong></span>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {resolvedToday} resolved today
            </div>
          </div>
        </div>

        {/* Tasks KPI */}
        <div
          onClick={() => onSelectTab('tasks')}
          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-xs text-[var(--mute)] mb-1">
            <span className="font-semibold uppercase tracking-wider">Tasks</span>
            <CheckSquare className="w-4 h-4 text-[var(--primary)] group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--ink)]">
            {openTasks.length}<span className="text-xs font-normal text-[var(--mute)]"> open</span>
          </div>
          <div className="mt-2 text-[11px] space-y-0.5 text-[var(--mute)]">
            <div className="flex justify-between">
              <span>In progress: <strong className="text-[var(--ink)] font-semibold">{openTasks.filter(t => t.status === 'IN_PROGRESS').length}</strong></span>
              <span>New: <strong className="text-amber-600 font-semibold">{openTasks.filter(t => t.status === 'NEW').length}</strong></span>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {doneTasksCount} done today
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Attention Queue (2/3) + Recent Activity Feed (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attention Queue */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                <span>Attention Queue</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--line)] text-[var(--ink)] font-mono">
                  {attentionItems.length} items
                </span>
              </h2>
              <p className="text-xs text-[var(--mute)]">
                Prioritized queue generated from live operational anomalies (criticality + recency + impact).
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-red-600 font-semibold">
                ▲ NOW ({attentionItems.filter(i => i.tier === 'NOW').length})
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                ■ NEXT ({attentionItems.filter(i => i.tier === 'NEXT').length})
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 text-slate-500 font-semibold">
                ● MONITOR ({attentionItems.filter(i => i.tier === 'MONITOR').length})
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {attentionItems.length === 0 ? (
              <div className="p-8 text-center bg-[var(--card)] rounded-lg border border-[var(--line)] text-sm text-[var(--mute)]">
                All queues clear. No critical attention items detected.
              </div>
            ) : (
              attentionItems.map((item) => {
                const tierStyles = {
                  NOW: {
                    border: 'border-l-4 border-l-red-500 border-red-500/20 bg-red-500/5',
                    badge: 'bg-red-500 text-white',
                    shape: '▲',
                    text: 'NOW'
                  },
                  NEXT: {
                    border: 'border-l-4 border-l-amber-500 border-amber-500/20 bg-amber-500/5',
                    badge: 'bg-amber-500 text-white',
                    shape: '■',
                    text: 'NEXT'
                  },
                  MONITOR: {
                    border: 'border-l-4 border-l-slate-400 border-[var(--line)] bg-[var(--card)]',
                    badge: 'bg-slate-500 text-white',
                    shape: '●',
                    text: 'MONITOR'
                  }
                }[item.tier];

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-lg border transition-all ${tierStyles.border} hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${tierStyles.badge}`}>
                          <span>{tierStyles.shape}</span>
                          <span>{tierStyles.text}</span>
                        </span>
                        <h3 className="text-sm font-semibold text-[var(--ink)]">{item.title}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--mute)]">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{item.location}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{item.minutesAgo} min ago</span>
                        </span>
                        {item.affectedCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-[var(--ink)]">
                              {item.affectedCount} participants affected
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={item.onClick}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] hover:text-[var(--primary)] transition-colors whitespace-nowrap shadow-2xs shrink-0 cursor-pointer"
                    >
                      <span>{item.actionLabel}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--primary)]" />
              <span>Recent Activity</span>
            </h2>
            <span className="text-xs text-[var(--mute)]">Live stream</span>
          </div>

          <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
            <div className="flow-root">
              <ul className="-mb-4 divide-y divide-[var(--line)]">
                {activities.slice(0, 8).map((act) => (
                  <li key={act.id} className="py-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[11px] font-semibold text-[var(--primary)] tabular-nums shrink-0 pt-0.5">
                        {act.timestamp}
                      </span>
                      <p className="text-[var(--ink)] leading-snug">
                        {act.message}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Gate Monitoring: VIP & VVIP Venue Access Section */}
      <section className="p-5 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs space-y-4">
        {/* Header with Title, Live Badge, and Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <QrCode className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-[var(--ink)]">
                Gate Monitoring: VIP & VVIP Venue Access
              </h2>
              {isGateLiveStreaming ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  LIVE SCANNER FEED (6s)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Pause className="w-3 h-3" />
                  FEED PAUSED
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--mute)]">
              Real-time biometric & QR credential verification table for Cabinet Ministers, Envoys, and Diplomatic VIPs entering security checkpoints.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* VVIP Push Notification Toggle and Configuration Button */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
              <button
                onClick={() => {
                  const nextState = !vvipPushEnabled;
                  setVvipPushEnabled(nextState);
                  if (onAddToast) {
                    onAddToast(
                      nextState ? 'VVIP Push Alerts Enabled' : 'VVIP Push Alerts Disabled',
                      nextState
                        ? `Real-time push alerts enabled for ${vvipPushScope === 'ALL_VVIP' ? 'all VVIPs' : `${watchedVVIPIds.length} watched high-profile VVIPs`}.`
                        : 'Real-time push alerts for VVIP arrivals have been paused.',
                      nextState ? 'success' : 'info'
                    );
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  vvipPushEnabled
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    : 'text-[var(--mute)] hover:text-[var(--ink)]'
                }`}
                title={vvipPushEnabled ? "Click to disable real-time VVIP push notifications" : "Click to enable real-time VVIP push notifications"}
              >
                {vvipPushEnabled ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <BellRing className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>VVIP Push: ON</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-900 dark:text-amber-100 font-mono">
                      {vvipPushScope === 'ALL_VVIP' ? 'All' : `${watchedVVIPIds.length}`}
                    </span>
                  </>
                ) : (
                  <>
                    <BellOff className="w-3.5 h-3.5 text-[var(--mute)]" />
                    <span>VVIP Push: OFF</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowVVIPPushConfigModal(true)}
                className="p-1 rounded text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--line)] transition-colors cursor-pointer"
                title="Configure High-Profile VVIP Push Watchlist & Alert Channels"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleSimulateScan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--primary)] text-white hover:opacity-95 transition-opacity shadow-xs cursor-pointer"
              title="Trigger immediate simulated QR scan event"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate QR Scan</span>
            </button>

            <button
              onClick={() => setIsGateLiveStreaming((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] transition-colors cursor-pointer"
            >
              {isGateLiveStreaming ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pause Stream</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Resume Stream</span>
                </>
              )}
            </button>

            <button
              onClick={() => onSelectTab('vip')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--primary)] transition-colors cursor-pointer"
            >
              <span>VIP Protocol Hub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real-time VVIP Push Notification Banner (if recent alert dispatched) */}
        {latestVVIPPushAlert && (
          <div className="p-3.5 rounded-lg bg-amber-500/10 border-l-4 border-l-amber-500 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500 text-white shadow-xs shrink-0">
                <BellRing className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                    VVIP Arrival Push Alert Sent
                  </span>
                  <span className="font-mono text-[11px] text-[var(--mute)] tabular-nums">
                    {latestVVIPPushAlert.timestamp}
                  </span>
                </div>
                <div className="text-xs font-bold text-[var(--ink)]">
                  {latestVVIPPushAlert.guestName} · {latestVVIPPushAlert.title} ({latestVVIPPushAlert.country})
                </div>
                <div className="text-[11px] text-[var(--mute)] flex flex-wrap items-center gap-2">
                  <span>Cleared Gate: <strong className="text-[var(--ink)]">{latestVVIPPushAlert.gate}</strong></span>
                  <span>·</span>
                  <span>Protocol Liaison: <strong className="text-[var(--ink)]">{latestVVIPPushAlert.liaison}</strong></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => {
                  const matchedScan = gateScanEvents.find((s) => s.id === latestVVIPPushAlert.id);
                  if (matchedScan) setInspectingScan(matchedScan);
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--card)] border border-[var(--line)] hover:border-amber-500 text-[var(--ink)] cursor-pointer"
              >
                Inspect Pass
              </button>
              <button
                onClick={() => setLatestVVIPPushAlert(null)}
                className="p-1 text-[var(--mute)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                title="Dismiss alert banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Operational Telemetry Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between text-[var(--mute)]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Total VIP Cleared</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-lg font-bold text-[var(--ink)] tabular-nums">
              {clearedCount} <span className="text-xs font-normal text-[var(--mute)]">/ {allVIPs.length} onsite</span>
            </div>
            <div className="w-full bg-[var(--line)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((clearedCount / allVIPs.length) * 100))}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between text-[var(--mute)]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">VVIP Heads of State</span>
              <Crown className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {vvipClearedCount} <span className="text-xs font-normal text-[var(--mute)]">/ {allVIPs.filter(v => v.tier === 'VVIP').length} processed</span>
            </div>
            <p className="text-[10px] text-[var(--mute)]">Close protection detail activated</p>
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between text-[var(--mute)]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Active Gate Lanes</span>
              <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" />
            </div>
            <div className="text-lg font-bold text-[var(--ink)] tabular-nums">
              5 Checkpoints <span className="text-xs font-normal text-emerald-600">Online</span>
            </div>
            <p className="text-[10px] text-[var(--mute)]">Avg reader latency: <strong className="text-[var(--ink)] font-mono">0.74s</strong></p>
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-1">
            <div className="flex items-center justify-between text-[var(--mute)]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Protocol Escorts</span>
              <Users className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              100% Assigned
            </div>
            <p className="text-[10px] text-[var(--mute)]">Immediate liaison greeting upon scan</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--mute)] mr-1">Filter Tier:</span>
            <button
              onClick={() => setGateFilterTier('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                gateFilterTier === 'ALL'
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
              }`}
            >
              All ({gateScanEvents.length})
            </button>
            <button
              onClick={() => setGateFilterTier('VVIP')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                gateFilterTier === 'VVIP'
                  ? 'bg-amber-600 text-white'
                  : 'bg-[var(--bg)] border border-[var(--line)] text-amber-700 dark:text-amber-400 hover:border-amber-500'
              }`}
            >
              <Crown className="w-3 h-3" />
              <span>VVIP ({gateScanEvents.filter((s) => s.tier === 'VVIP').length})</span>
            </button>
            <button
              onClick={() => setGateFilterTier('VIP')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                gateFilterTier === 'VIP'
                  ? 'bg-purple-600 text-white'
                  : 'bg-[var(--bg)] border border-[var(--line)] text-purple-700 dark:text-purple-400 hover:border-purple-500'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>VIP ({gateScanEvents.filter((s) => s.tier === 'VIP').length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <select
                value={selectedGateCheckpoint}
                onChange={(e) => setSelectedGateCheckpoint(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] focus:outline-hidden focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="ALL">All Gate Checkpoints</option>
                <option value="Gate 4">VIP Gate 4 (Red Carpet Arch)</option>
                <option value="Air-Lock">Gate 4 Presidential Air-Lock</option>
                <option value="Gate 1">Gate 1 Presidential Concourse</option>
                <option value="Motorcade">VIP Motorcade Bay South</option>
                <option value="Protocol">Executive Protocol Wing</option>
              </select>
            </div>

            <div className="relative flex-1 sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
              <input
                type="text"
                value={gateSearchQuery}
                onChange={(e) => setGateSearchQuery(e.target.value)}
                placeholder="Search by guest name or ID (e.g. VIP-001)..."
                className="w-full text-xs pl-8 pr-7 py-1.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--mute)] focus:outline-hidden focus:border-[var(--primary)]"
              />
              {gateSearchQuery && (
                <button
                  type="button"
                  onClick={() => setGateSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search Filter Indicator (if query active) */}
        {gateSearchQuery && (
          <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-[var(--bg)] border border-[var(--line)]">
            <span className="text-[11px] text-[var(--mute)]">
              Showing results for guest name or ID matching <strong className="text-[var(--ink)]">"{gateSearchQuery}"</strong>: <span className="font-semibold text-[var(--primary)]">{filteredGateScans.length} events</span>
            </span>
            <button
              type="button"
              onClick={() => setGateSearchQuery('')}
              className="text-[11px] font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Reset Search</span>
            </button>
          </div>
        )}

        {/* Real-time Table of Recent QR Scan Events (Scrolling List) */}
        <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] overflow-hidden">
          <div className="max-h-[440px] overflow-y-auto overflow-x-auto divide-y divide-[var(--line)]">
            <table className="w-full text-left border-collapse min-w-[840px]">
              <thead className="sticky top-0 bg-[var(--bg)] border-b border-[var(--line)] z-10">
                <tr className="text-[10px] font-bold text-[var(--mute)] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Time & Latency</th>
                  <th className="py-2.5 px-3">VIP Dignitary</th>
                  <th className="py-2.5 px-3">Delegation</th>
                  <th className="py-2.5 px-3">Tier</th>
                  <th className="py-2.5 px-3">QR Credential</th>
                  <th className="py-2.5 px-3">Gate Checkpoint</th>
                  <th className="py-2.5 px-3">Scan Status</th>
                  <th className="py-2.5 px-3">Protocol Escort & Suite</th>
                  <th className="py-2.5 px-3 text-right">Credential</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] text-xs">
                {filteredGateScans.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-[var(--mute)]">
                      {gateSearchQuery ? (
                        <div className="space-y-2 max-w-sm mx-auto py-2">
                          <p className="font-semibold text-[var(--ink)]">
                            No scan events matching "{gateSearchQuery}"
                          </p>
                          <p className="text-[11px] text-[var(--mute)]">
                            Try searching for another guest name or ID (e.g., "Lawrence", "VIP-001", "SCAN-").
                          </p>
                          <button
                            type="button"
                            onClick={() => setGateSearchQuery('')}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--primary)] cursor-pointer transition-colors"
                          >
                            <X className="w-3 h-3" />
                            <span>Clear Search Filter</span>
                          </button>
                        </div>
                      ) : (
                        'No gate scan events found matching your filter criteria.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredGateScans.map((scan) => {
                    const isVVIP = scan.tier === 'VVIP';
                    return (
                      <tr
                        key={scan.id}
                        onClick={() => setInspectingScan(scan)}
                        className={`transition-colors cursor-pointer hover:bg-[var(--line)]/30 ${
                          scan.isNew
                            ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500'
                            : ''
                        }`}
                      >
                        {/* Timestamp & Latency */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-mono font-medium text-[var(--ink)] tabular-nums">
                            {scan.timestamp}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--mute)] mt-0.5">
                            <span className={scan.isNew ? 'text-emerald-600 font-bold' : ''}>
                              {scan.timeAgo}
                            </span>
                            <span>·</span>
                            <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-[var(--line)]">
                              {scan.latencyMs}s
                            </span>
                          </div>
                        </td>

                        {/* VIP Dignitary */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[var(--ink)] leading-snug">
                              {scan.name}
                            </span>
                            <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-[var(--line)] text-[var(--mute)] font-medium">
                              {scan.guestId}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--mute)] line-clamp-1 max-w-[200px]" title={scan.title}>
                            {scan.title}
                          </div>
                        </td>

                        {/* Delegation */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-medium text-[var(--ink)]">
                            {scan.countryOrOrg}
                          </span>
                        </td>

                        {/* Tier Badge & Watchlist Bell Indicator */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isVVIP ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                <Crown className="w-3 h-3 text-amber-600" />
                                <span>VVIP</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                                <ShieldCheck className="w-3 h-3 text-purple-600" />
                                <span>VIP</span>
                              </span>
                            )}

                            {isVVIP && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWatchVVIP(scan.guestId);
                                }}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  watchedVVIPIds.includes(scan.guestId)
                                    ? 'text-amber-600 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30'
                                    : 'text-[var(--mute)] hover:text-amber-600 hover:bg-[var(--line)]'
                                }`}
                                title={
                                  watchedVVIPIds.includes(scan.guestId)
                                    ? 'High-Profile VVIP Push Active (Click to remove from watchlist)'
                                    : 'Click to add this VVIP to high-profile arrival push watchlist'
                                }
                              >
                                <Bell className={`w-3 h-3 ${watchedVVIPIds.includes(scan.guestId) ? 'fill-amber-500' : ''}`} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* QR Credential */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]">
                            <QrCode className="w-3 h-3 text-[var(--primary)]" />
                            <span>{scan.qrCode}</span>
                          </span>
                        </td>

                        {/* Gate Checkpoint */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 font-medium text-[var(--ink)]">
                            <MapPin className="w-3 h-3 text-[var(--primary)] shrink-0" />
                            <span className="line-clamp-1">{scan.gateLocation}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{scan.status}</span>
                          </span>
                        </td>

                        {/* Protocol Escort & Suite */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="text-[11px] font-medium text-[var(--ink)]">
                            {scan.liaisonName}
                          </div>
                          <div className="text-[10px] text-[var(--mute)] flex items-center gap-2">
                            <span>{scan.assignedSuite}</span>
                            <span>·</span>
                            <span className="font-mono">{scan.motorcadePlate}</span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingScan(scan);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>Pass</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Sub-bar with Live Scroll Indicator & Fast Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--mute)] pt-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Showing {filteredGateScans.length} of {gateScanEvents.length} recorded scan events (auto-buffered latest 40 entries).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px]">Click any entry to view full diplomatic access badge credentials</span>
          </div>
        </div>
      </section>

      {/* VIP Diplomatic Pass Credential Inspection Modal */}
      {inspectingScan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div
              className={`p-4 text-white flex items-center justify-between ${
                inspectingScan.tier === 'VVIP'
                  ? 'bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800'
                  : 'bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {inspectingScan.tier === 'VVIP' ? (
                  <Crown className="w-5 h-5 text-amber-200" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-purple-200" />
                )}
                <div>
                  <h3 className="text-sm font-bold tracking-wide uppercase">
                    {inspectingScan.tier === 'VVIP' ? 'VVIP Presidential Access Pass' : 'VIP Diplomatic Access Pass'}
                  </h3>
                  <p className="text-[10px] text-white/80 font-mono">
                    YESummit 2027 · Biometric Credential Token
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingScan(null)}
                className="p-1 rounded hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Dignitary Profile Box */}
              <div className="p-3.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[var(--mute)]">ID: {inspectingScan.guestId}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                    {inspectingScan.status}
                  </span>
                </div>
                <div className="text-base font-bold text-[var(--ink)] pt-0.5">
                  {inspectingScan.name}
                </div>
                <div className="text-xs text-[var(--mute)]">
                  {inspectingScan.title}
                </div>
                <div className="text-xs font-semibold text-[var(--primary)] pt-1 flex items-center gap-1">
                  <span>Delegation:</span>
                  <span className="text-[var(--ink)]">{inspectingScan.countryOrOrg}</span>
                </div>
              </div>

              {/* High-Tech QR Code Representation */}
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-slate-950 text-white space-y-2 border border-slate-800">
                <div className="p-3 bg-white rounded-md shadow-xs">
                  <svg
                    className="w-28 h-28 text-slate-900"
                    viewBox="0 0 100 100"
                    fill="currentColor"
                  >
                    {/* Simulated High-Res QR Matrix Pattern */}
                    <rect x="0" y="0" width="28" height="28" fill="currentColor" />
                    <rect x="4" y="4" width="20" height="20" fill="white" />
                    <rect x="8" y="8" width="12" height="12" fill="currentColor" />

                    <rect x="72" y="0" width="28" height="28" fill="currentColor" />
                    <rect x="76" y="4" width="20" height="20" fill="white" />
                    <rect x="80" y="8" width="12" height="12" fill="currentColor" />

                    <rect x="0" y="72" width="28" height="28" fill="currentColor" />
                    <rect x="4" y="76" width="20" height="20" fill="white" />
                    <rect x="8" y="80" width="12" height="12" fill="currentColor" />

                    {/* Data matrix dots */}
                    <rect x="34" y="4" width="6" height="6" />
                    <rect x="46" y="4" width="6" height="6" />
                    <rect x="58" y="4" width="6" height="6" />
                    <rect x="34" y="16" width="6" height="6" />
                    <rect x="46" y="16" width="18" height="6" />
                    <rect x="4" y="34" width="6" height="6" />
                    <rect x="16" y="34" width="6" height="6" />
                    <rect x="28" y="34" width="6" height="6" />
                    <rect x="40" y="34" width="20" height="6" />
                    <rect x="66" y="34" width="6" height="6" />
                    <rect x="78" y="34" width="18" height="6" />
                    <rect x="16" y="46" width="18" height="6" />
                    <rect x="40" y="46" width="6" height="6" />
                    <rect x="52" y="46" width="12" height="6" />
                    <rect x="70" y="46" width="18" height="6" />
                    <rect x="4" y="58" width="12" height="6" />
                    <rect x="22" y="58" width="6" height="6" />
                    <rect x="34" y="58" width="18" height="6" />
                    <rect x="58" y="58" width="12" height="6" />
                    <rect x="76" y="58" width="6" height="6" />
                    <rect x="88" y="58" width="8" height="6" />
                    <rect x="34" y="72" width="6" height="18" />
                    <rect x="46" y="72" width="12" height="6" />
                    <rect x="64" y="72" width="6" height="24" />
                    <rect x="76" y="72" width="18" height="6" />
                    <rect x="46" y="84" width="12" height="12" />
                    <rect x="76" y="84" width="6" height="12" />
                  </svg>
                </div>
                <div className="font-mono text-[11px] font-semibold tracking-wider text-emerald-400">
                  {inspectingScan.qrCode}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Verified in {inspectingScan.latencyMs}s · Hardware Cryptographic Token</span>
                </div>
              </div>

              {/* Verification & Gate Telemetry */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <span className="text-[10px] text-[var(--mute)] block">Scan Timestamp</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{inspectingScan.timestamp}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <span className="text-[10px] text-[var(--mute)] block">Gate Checkpoint</span>
                  <span className="font-medium text-[var(--ink)] line-clamp-1">{inspectingScan.gateLocation}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <span className="text-[10px] text-[var(--mute)] block">Assigned Bilateral Suite</span>
                  <span className="font-semibold text-[var(--ink)]">{inspectingScan.assignedSuite}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <span className="text-[10px] text-[var(--mute)] block">Motorcade Plate</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{inspectingScan.motorcadePlate}</span>
                </div>
              </div>

              {/* Liaison Officer Contact */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                    Designated Protocol Officer
                  </span>
                  <span className="text-xs font-bold text-[var(--ink)]">
                    {inspectingScan.liaisonName}
                  </span>
                </div>
                <a
                  href={`tel:${inspectingScan.liaisonPhone}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <Phone className="w-3 h-3" />
                  <span>{inspectingScan.liaisonPhone}</span>
                </a>
              </div>

              {/* VVIP Watchlist Quick Toggle */}
              {inspectingScan.tier === 'VVIP' && (
                <button
                  type="button"
                  onClick={() => handleToggleWatchVVIP(inspectingScan.guestId)}
                  className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    watchedVVIPIds.includes(inspectingScan.guestId)
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25'
                      : 'bg-[var(--bg)] border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:border-amber-500'
                  }`}
                >
                  <BellRing className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {watchedVVIPIds.includes(inspectingScan.guestId)
                      ? 'High-Profile Arrival Push: ACTIVE for this VVIP (Click to Remove)'
                      : 'Add this VVIP to High-Profile Arrival Push Watchlist'}
                  </span>
                </button>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-[var(--bg)] border-t border-[var(--line)] flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setInspectingScan(null);
                  onSelectTab('vip');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--primary)] transition-colors cursor-pointer"
              >
                <span>Jump to VIP Protocol Tab</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setInspectingScan(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-[var(--primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VVIP Real-Time Push Notification Settings & Watchlist Modal */}
      {showVVIPPushConfigModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-2xl w-full border border-[var(--line)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white/10 backdrop-blur-xs">
                  <BellRing className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide uppercase">
                    VVIP Real-Time Arrival Push Configuration
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Biometric gate access monitoring & automated diplomatic alerts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVVIPPushConfigModal(false)}
                className="p-1.5 rounded hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body with scrolling content */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Section 1: Master Push Alert Switch */}
              <div className="p-4 rounded-lg bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--ink)]">
                      Real-Time Arrival Push Alerts
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      vvipPushEnabled
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-500/15 text-slate-500 border border-slate-500/30'
                    }`}>
                      {vvipPushEnabled ? 'ACTIVE & MONITORING' : 'PAUSED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--mute)]">
                    Broadcast high-priority push notifications and play diplomatic audio chimes when watched VVIPs scan into checkpoints.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !vvipPushEnabled;
                    setVvipPushEnabled(next);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    vvipPushEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      vvipPushEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Section 2: Alert Scope Selection */}
              <div className="space-y-2">
                <label className="font-bold text-xs text-[var(--ink)] uppercase tracking-wider block">
                  Targeting Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setVvipPushScope('SPECIFIC_WATCHLIST')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      vvipPushScope === 'SPECIFIC_WATCHLIST'
                        ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                        : 'border-[var(--line)] bg-[var(--card)] hover:border-[var(--primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[var(--ink)] flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-600" />
                        <span>Specific High-Profile Watchlist</span>
                      </span>
                      <input
                        type="radio"
                        name="pushScope"
                        checked={vvipPushScope === 'SPECIFIC_WATCHLIST'}
                        onChange={() => setVvipPushScope('SPECIFIC_WATCHLIST')}
                        className="accent-amber-600"
                      />
                    </div>
                    <p className="text-[11px] text-[var(--mute)]">
                      Only alert for designated high-profile dignitaries ({watchedVVIPIds.length} currently selected). Recommended to prevent alert fatigue.
                    </p>
                  </div>

                  <div
                    onClick={() => setVvipPushScope('ALL_VVIP')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      vvipPushScope === 'ALL_VVIP'
                        ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                        : 'border-[var(--line)] bg-[var(--card)] hover:border-[var(--primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[var(--ink)] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>All VVIP Dignitaries</span>
                      </span>
                      <input
                        type="radio"
                        name="pushScope"
                        checked={vvipPushScope === 'ALL_VVIP'}
                        onChange={() => setVvipPushScope('ALL_VVIP')}
                        className="accent-amber-600"
                      />
                    </div>
                    <p className="text-[11px] text-[var(--mute)]">
                      Broadcast push notifications for all {allVIPs.filter(v => v.tier === 'VVIP').length} registered Heads of State, Cabinet Ministers, and Envoys.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: High-Profile Watchlist Dignitary Selector */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="font-bold text-xs text-[var(--ink)] uppercase tracking-wider block">
                      Monitored High-Profile VVIPs ({watchedVVIPIds.length} selected)
                    </label>
                    <p className="text-[11px] text-[var(--mute)]">
                      Check specific dignitaries to receive arrival notifications the moment their QR code scans.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const allVVIPIds = allVIPs.filter((v) => v.tier === 'VVIP').map((v) => v.id);
                        setWatchedVVIPIds(allVVIPIds);
                      }}
                      className="px-2 py-1 text-[11px] font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setWatchedVVIPIds([])}
                      className="px-2 py-1 text-[11px] font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-red-500 text-[var(--mute)] hover:text-red-600 cursor-pointer"
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const topCabinet = allVIPs.filter((v) => v.tier === 'VVIP').slice(0, 5).map((v) => v.id);
                        setWatchedVVIPIds(topCabinet);
                      }}
                      className="px-2 py-1 text-[11px] font-semibold rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 cursor-pointer"
                    >
                      Top 5 Ministers
                    </button>
                  </div>
                </div>

                {/* Watchlist Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
                  <input
                    type="text"
                    value={watchlistSearchQuery}
                    onChange={(e) => setWatchlistSearchQuery(e.target.value)}
                    placeholder="Search VVIPs by name, delegation, title..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--mute)] focus:outline-hidden focus:border-[var(--primary)]"
                  />
                </div>

                {/* Dignitary Checklist Grid */}
                <div className="max-h-56 overflow-y-auto divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg bg-[var(--card)]">
                  {allVIPs
                    .filter((v) => v.tier === 'VVIP')
                    .filter((v) => {
                      if (!watchlistSearchQuery) return true;
                      const q = watchlistSearchQuery.toLowerCase();
                      return (
                        v.name.toLowerCase().includes(q) ||
                        v.countryOrOrg.toLowerCase().includes(q) ||
                        v.officialTitle.toLowerCase().includes(q) ||
                        v.id.toLowerCase().includes(q)
                      );
                    })
                    .map((vvip) => {
                      const isSelected = watchedVVIPIds.includes(vvip.id);
                      return (
                        <div
                          key={vvip.id}
                          onClick={() => handleToggleWatchVVIP(vvip.id)}
                          className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-500/10'
                              : 'hover:bg-[var(--line)]/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent onClick
                              className="rounded accent-amber-600 h-4 w-4 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[var(--ink)] truncate">
                                  {vvip.name}
                                </span>
                                <span className="font-mono text-[10px] text-[var(--mute)] shrink-0">
                                  ({vvip.id})
                                </span>
                              </div>
                              <div className="text-[11px] text-[var(--mute)] truncate">
                                {vvip.officialTitle} · <span className="font-medium text-[var(--ink)]">{vvip.countryOrOrg}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 text-[10px] text-[var(--mute)]">
                            <div>{vvip.assignedSuite || 'Bilateral Suite'}</div>
                            <div className="font-medium text-amber-700 dark:text-amber-400">
                              {vvip.motorcade?.plateNumber || 'MID-01'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Section 4: Alert Channels & Audio Setting */}
              <div className="space-y-2">
                <label className="font-bold text-xs text-[var(--ink)] uppercase tracking-wider block">
                  Notification Delivery Channels
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Audio Chime */}
                  <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        {pushSoundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-600" /> : <VolumeX className="w-3.5 h-3.5 text-[var(--mute)]" />}
                        <span>Diplomatic Arrival Chime</span>
                      </div>
                      <p className="text-[10px] text-[var(--mute)]">
                        Play zero-latency audio alert when a watched VVIP scans.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={playDiplomaticChime}
                        className="px-2 py-1 text-[10px] font-semibold rounded bg-[var(--card)] border border-[var(--line)] hover:border-amber-500 text-[var(--ink)] cursor-pointer"
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        onClick={() => setPushSoundEnabled(!pushSoundEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          pushSoundEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            pushSoundEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Browser Desktop Push */}
                  <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        <Bell className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Desktop Push Notifications</span>
                      </div>
                      <p className="text-[10px] text-[var(--mute)]">
                        Browser notification status: <strong className={browserPushPermission === 'granted' ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>{browserPushPermission}</strong>
                      </p>
                    </div>
                    <div>
                      {browserPushPermission === 'granted' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded">
                          <Check className="w-3 h-3" />
                          <span>Granted</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestBrowserNotification}
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-[var(--primary)] text-white hover:opacity-95 transition-opacity cursor-pointer"
                        >
                          Enable
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[var(--bg)] border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSendTestPush}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--card)] border border-[var(--line)] hover:border-amber-500 text-[var(--ink)] transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Send Test VVIP Push Alert</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--mute)]">
                  {vvipPushEnabled
                    ? `${vvipPushScope === 'ALL_VVIP' ? 'All VVIPs' : `${watchedVVIPIds.length} watched VVIPs`} active`
                    : 'Alerts paused'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowVVIPPushConfigModal(false);
                    if (onAddToast) {
                      onAddToast(
                        'Configuration Saved',
                        `VVIP arrival push alerts updated (${vvipPushEnabled ? 'Enabled' : 'Disabled'}, ${watchedVVIPIds.length} watched).`,
                        'success'
                      );
                    }
                  }}
                  className="px-4 py-1.5 text-xs font-semibold rounded bg-[var(--primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
