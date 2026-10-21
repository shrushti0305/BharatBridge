import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Server,
  Cpu,
  Layers,
  Zap,
  Activity,
  Shield,
  Bell,
  Smartphone,
  Car,
  Users,
  QrCode,
  MapPin,
  Monitor,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Send,
  MessageSquare,
  Mail,
  Flame,
  Clock,
  RefreshCw,
  Eye,
  Info
} from 'lucide-react';
import { Incident, Task, Participant, Vehicle, Volunteer, VIPGuest } from '../types';

export interface EventBusMessage {
  id: string;
  timestamp: string;
  source: 'Driver App' | 'Volunteer App' | 'My YESummit' | 'QR Scanners' | 'GPS Telemetry' | 'Operator Consoles';
  topic: string;
  domain: 'Mobility' | 'Volunteers' | 'Tasks' | 'Incidents' | 'Sessions' | 'Venue' | 'Requests' | 'Resources' | 'Notification' | 'Rules';
  subscribers: string[];
  payload: Record<string, any>;
  status: 'DELIVERED' | 'DISPATCHING' | 'ESCALATED';
}

interface SystemArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  tasks: Task[];
  participants: Participant[];
  vehicles: Vehicle[];
  volunteers: Volunteer[];
  vipGuests: VIPGuest[];
  onAddToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onLogActivity?: (message: string, category?: any) => void;
}

export const SystemArchitectureModal: React.FC<SystemArchitectureModalProps> = ({
  isOpen,
  onClose,
  incidents,
  tasks,
  participants,
  vehicles,
  volunteers,
  vipGuests,
  onAddToast,
  onLogActivity
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'event_bus' | 'notifications' | 'database'>('architecture');
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [simulatedEvents, setSimulatedEvents] = useState<EventBusMessage[]>([]);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventBusMessage | null>(null);

  // Initialize initial event bus stream
  useEffect(() => {
    const initialEvents: EventBusMessage[] = [
      {
        id: 'EVT-89410',
        timestamp: '11:15:32.410 SGT',
        source: 'QR Scanners',
        topic: 'turnstile.badge_tapped',
        domain: 'Venue',
        subscribers: ['Database (Fast Cache)', 'Realtime Gateway (Turnstile War-Room)', 'Attendance Service'],
        payload: {
          scannerId: 'TURNSTILE-GATE-2-D',
          badgeId: 'QR-9823',
          attendeeId: 'PART-2043',
          name: 'Fatima Al-Hassan',
          category: 'Delegate',
          latencyMs: 1.4,
          cacheHit: true
        },
        status: 'DELIVERED'
      },
      {
        id: 'EVT-89409',
        timestamp: '11:15:28.102 SGT',
        source: 'Driver App',
        topic: 'mobility.gps_telemetry',
        domain: 'Mobility',
        subscribers: ['Realtime Gateway (Live Map)', 'Fleet ETA Predictor', 'Fast Cache'],
        payload: {
          vehicleId: 'VH-02',
          driver: 'Siti Rahmah',
          coordinates: { lat: 1.2982, lng: 103.8541 },
          speedKmh: 42,
          route: 'Route B (Orchard ↔ Venue)',
          passengers: '41/45',
          batteryLevel: '84%'
        },
        status: 'DELIVERED'
      },
      {
        id: 'EVT-89408',
        timestamp: '11:15:19.890 SGT',
        source: 'Volunteer App',
        topic: 'volunteer.participant_assisted',
        domain: 'Volunteers',
        subscribers: ['Database Audit Log', 'Realtime Gateway', 'Rules Engine'],
        payload: {
          volunteerId: 'VOL-104',
          volunteerName: 'Priya Rao',
          action: 'Escort Japanese Trade Delegation',
          participantId: 'PART-2041',
          zone: 'VIP Staging Gate 4',
          status: 'Escort In Progress'
        },
        status: 'DELIVERED'
      },
      {
        id: 'EVT-89407',
        timestamp: '11:15:02.155 SGT',
        source: 'Operator Consoles',
        topic: 'incident.escalated',
        domain: 'Incidents',
        subscribers: ['Rules / Escalation Engine', 'Notification Service (WhatsApp, SMS, Push)', 'Command War-Room'],
        payload: {
          incidentId: 'INC-024',
          severity: 'HIGH',
          title: 'Guest feeling faint / dehydration in Hall B',
          escalatedTo: 'Medical Response Team Alpha',
          slaTimerSecondsRemaining: 380
        },
        status: 'ESCALATED'
      },
      {
        id: 'EVT-89406',
        timestamp: '11:14:48.331 SGT',
        source: 'My YESummit',
        topic: 'attendee.meal_voucher_redeemed',
        domain: 'Requests',
        subscribers: ['Catering Domain Service', 'Database Temporal Ledger', 'Fast Cache'],
        payload: {
          attendeeId: 'PART-2045',
          mealType: 'Lunch Buffet',
          hall: 'Dining Pavilion 2',
          dietaryPreference: 'Halal Certified',
          redemptionCode: 'VCH-8819'
        },
        status: 'DELIVERED'
      }
    ];

    setSimulatedEvents(initialEvents);
  }, []);

  // Periodic live telemetry simulation if enabled
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      const sources: EventBusMessage['source'][] = [
        'Driver App',
        'Volunteer App',
        'My YESummit',
        'QR Scanners',
        'GPS Telemetry',
        'Operator Consoles'
      ];
      const domains: EventBusMessage['domain'][] = [
        'Mobility',
        'Volunteers',
        'Tasks',
        'Incidents',
        'Sessions',
        'Venue',
        'Requests'
      ];
      const randomSource = sources[Math.floor(Math.random() * sources.length)];
      const randomDomain = domains[Math.floor(Math.random() * domains.length)];

      const now = new Date();
      const timeString =
        now.toLocaleTimeString('en-SG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) + `.${Math.floor(100 + Math.random() * 900)} SGT`;

      const newEvt: EventBusMessage = {
        id: `EVT-${Math.floor(89420 + Math.random() * 10000)}`,
        timestamp: timeString,
        source: randomSource,
        topic: `${randomDomain.toLowerCase()}.${
          randomSource === 'Driver App'
            ? 'telemetry_ping'
            : randomSource === 'QR Scanners'
            ? 'turnstile_pass'
            : 'state_changed'
        }`,
        domain: randomDomain,
        subscribers: ['Realtime Gateway (WebSockets)', 'Database + Fast Cache', 'Notification Service'],
        payload: {
          origin: randomSource,
          domain: randomDomain,
          latencyMs: +(Math.random() * 2.2 + 0.8).toFixed(2),
          status: 'NOMINAL',
          cacheHit: true
        },
        status: 'DELIVERED'
      };

      setSimulatedEvents((prev) => [newEvt, ...prev.slice(0, 39)]);
    }, 4500);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  // Trigger simulated client event
  const handleTriggerClientEvent = (source: EventBusMessage['source'], topic: string, domain: EventBusMessage['domain'], payload: Record<string, any>) => {
    const now = new Date();
    const timeString =
      now.toLocaleTimeString('en-SG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + `.${Math.floor(100 + Math.random() * 900)} SGT`;

    const evt: EventBusMessage = {
      id: `EVT-${Math.floor(90000 + Math.random() * 9999)}`,
      timestamp: timeString,
      source,
      topic,
      domain,
      subscribers: [
        'API Gateway',
        'EVENT BUS',
        'Realtime Gateway (WebSockets)',
        'Database Temporal Ledger',
        'Notification Service (Push/SMS/WhatsApp)'
      ],
      payload,
      status: 'DELIVERED'
    };

    setSimulatedEvents((prev) => [evt, ...prev.slice(0, 39)]);

    if (onAddToast) {
      onAddToast(
        `Event Published: ${topic}`,
        `Origin: ${source} → Event Bus routed to ${evt.subscribers.length} consumers (<2ms).`,
        'success'
      );
    }
    if (onLogActivity) {
      onLogActivity(`Event Bus received ${topic} from ${source}`, 'system');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-[var(--card)] rounded-xl max-w-5xl w-full border border-[var(--line)] shadow-2xl text-xs max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[var(--line)] bg-[var(--bg)]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  System Architecture & Event Bus Console
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  EVENT BUS NOMINAL · 142 EVT/S
                </span>
              </div>
              <p className="text-[11px] text-[var(--mute)]">
                End-to-end distributed event-driven topology: Edge Apps → API Gateway → Event Bus → Domain Services, Realtime WebSockets & Database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--mute)] hover:text-[var(--ink)] p-1.5 rounded-md hover:bg-[var(--line)]/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Console Navigation Bar */}
        <div className="px-5 py-2 border-b border-[var(--line)] bg-[var(--card)] flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('architecture')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'architecture'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Interactive Architecture Topology</span>
            </button>

            <button
              onClick={() => setActiveTab('event_bus')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'event_bus'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Event Stream ({simulatedEvents.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'notifications'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notification Dispatcher (Push/SMS/Email/WhatsApp)</span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'database'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Database & Fast Cache Mesh</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`px-2.5 py-1 text-[11px] rounded font-medium border flex items-center gap-1.5 cursor-pointer ${
                isLiveStreaming
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-[var(--bg)] text-[var(--mute)] border-[var(--line)]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveStreaming ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
              <span>{isLiveStreaming ? 'Live Stream Active' : 'Stream Paused'}</span>
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: INTERACTIVE ARCHITECTURE TOPOLOGY */}
          {activeTab === 'architecture' && (
            <div className="space-y-5">
              {/* ASCII Reference Architecture Banner */}
              <div className="p-3.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[var(--primary)]" />
                    Distributed Event-Driven Architecture Specification
                  </span>
                  <span className="font-mono text-[var(--mute)] text-[10px]">Zero Downtime · Sub-5ms Event Loop</span>
                </div>
                <pre className="font-mono text-[10px] leading-relaxed text-[var(--primary)] dark:text-[var(--primary-light)] overflow-x-auto p-2.5 rounded bg-[var(--card)] border border-[var(--line)]">
{`Driver app · Volunteer app · My YESummit · QR scanners · GPS · Operator consoles
                                   │
                         API gateway + Auth + Roles
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
   Domain services            EVENT BUS                Realtime gateway
 (Mobility, Volunteers,   (every change is an event)    (WebSockets)
  Tasks, Incidents,               │                          │
  Sessions, Venue,        ┌───────┼────────┐                 ▼
  Requests, Resources)    │       │        │        Dashboards, Map, Kanban,
        │           Rules/     Notification  AI &    war-room screens, apps
        ▼          Escalation   service    Analytics
    DATABASE                       │
 (records + history)         Push · SMS · Email · WhatsApp
 + fast cache (latest state)`}
                </pre>
              </div>

              {/* Visual Interactive Architecture Flow */}
              <div className="space-y-4">
                {/* Layer 1: Edge Ingestion Endpoints */}
                <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-xs flex items-center justify-center">1</span>
                      <h4 className="font-bold text-xs text-[var(--ink)]">Edge Clients & Ingestion Sources</h4>
                    </div>
                    <span className="text-[10px] text-[var(--mute)]">6 Client Channels Online</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {[
                      {
                        name: 'Driver App',
                        icon: Car,
                        meta: `${vehicles.length} Vehicles connected`,
                        actionText: 'Emit GPS Telemetry',
                        onClick: () =>
                          handleTriggerClientEvent('Driver App', 'mobility.telemetry_update', 'Mobility', {
                            vehicle: 'VH-01 (45-Seater Coach)',
                            driver: 'Ahmad Faiz',
                            speed: '48 km/h',
                            gps: { lat: 1.2988, lng: 103.854 },
                            routeStatus: 'ON_TIME'
                          })
                      },
                      {
                        name: 'Volunteer App',
                        icon: Users,
                        meta: `${volunteers.length} Active on duty`,
                        actionText: 'Check-In Attendee',
                        onClick: () =>
                          handleTriggerClientEvent('Volunteer App', 'volunteer.attendee_greeted', 'Volunteers', {
                            volunteerId: 'VOL-101',
                            volunteer: 'Marcus Goh',
                            zone: 'Registration Pavilion',
                            action: 'Assisted Delegate Badge Scan'
                          })
                      },
                      {
                        name: 'My YESummit',
                        icon: Smartphone,
                        meta: '3,100 App installs',
                        actionText: 'Redeem Meal Voucher',
                        onClick: () =>
                          handleTriggerClientEvent('My YESummit', 'participant.meal_scanned', 'Requests', {
                            attendeeId: 'PART-2041',
                            name: 'Dr. Hiroshi Tanaka',
                            meal: 'Lunch Bento',
                            status: 'VOUCHER_VERIFIED'
                          })
                      },
                      {
                        name: 'QR Scanners',
                        icon: QrCode,
                        meta: '16/16 Gateways Online',
                        actionText: 'Simulate Gate Tap',
                        onClick: () =>
                          handleTriggerClientEvent('QR Scanners', 'turnstile.badge_read', 'Venue', {
                            turnstile: 'Gate 1 Turnstile A',
                            badgeCode: 'QR-9821',
                            authLatency: '1.2ms',
                            barrier: 'UNLOCKED'
                          })
                      },
                      {
                        name: 'GPS Telemetry',
                        icon: MapPin,
                        meta: 'Fleet LoRaWAN mesh',
                        actionText: 'Sync Coordinates',
                        onClick: () =>
                          handleTriggerClientEvent('GPS Telemetry', 'fleet.mesh_sync', 'Mobility', {
                            activeTransponders: 48,
                            packetLossRate: '0.01%',
                            geofenceBreach: 'None'
                          })
                      },
                      {
                        name: 'Operator Consoles',
                        icon: Monitor,
                        meta: 'Super Admin & Leads',
                        actionText: 'Trigger Priority Task',
                        onClick: () =>
                          handleTriggerClientEvent('Operator Consoles', 'task.urgent_dispatched', 'Tasks', {
                            operator: 'A. Sharma (Super Admin)',
                            taskId: `TSK-${Math.floor(100 + Math.random() * 900)}`,
                            category: 'Logistics',
                            priority: 'HIGH'
                          })
                      }
                    ].map((item, idx) => {
                      const IconComponent = item.icon;
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] transition-all flex flex-col justify-between space-y-2 group"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                              <IconComponent className="w-3.5 h-3.5 text-[var(--primary)]" />
                              <span>{item.name}</span>
                            </div>
                            <div className="text-[10px] text-[var(--mute)] mt-0.5">{item.meta}</div>
                          </div>
                          <button
                            onClick={item.onClick}
                            className="w-full py-1 px-1.5 rounded bg-[var(--card)] hover:bg-[var(--primary)] hover:text-white text-[10px] font-semibold border border-[var(--line)] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Play className="w-2.5 h-2.5" />
                            <span>{item.actionText}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Connecting Arrow */}
                <div className="flex justify-center text-[var(--primary)] animate-pulse">
                  <div className="px-3 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[10px] font-mono flex items-center gap-1">
                    <span>HTTPS / gRPC / WSS Mesh Ingestion</span>
                    <ArrowRight className="w-3 h-3 rotate-90" />
                  </div>
                </div>

                {/* Layer 2: API Gateway + Auth + Roles */}
                <div className="p-3.5 rounded-lg bg-[var(--card)] border-2 border-[var(--primary)]/40 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-[var(--ink)] flex items-center gap-2">
                        <span>API Gateway + Auth + Role-Based Access Control (RBAC)</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          TLS 1.3 · Rate Limit: 5,000 req/s
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--mute)]">
                        Validates JWT tokens, checks officer clearance (Super Admin, Command Lead, Mobility, Volunteer, Safety, Technical), enforces rate limits and signs audit trails.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--mute)] shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Avg Latency: <strong>0.84ms</strong></span>
                  </div>
                </div>

                {/* Connecting Arrow */}
                <div className="flex justify-center text-[var(--primary)]">
                  <div className="px-3 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[10px] font-mono flex items-center gap-1">
                    <span>Dispatches to 3 Architectural Pillars</span>
                    <ArrowRight className="w-3 h-3 rotate-90" />
                  </div>
                </div>

                {/* Layer 3: The 3 Core Pillars (Domain Services, EVENT BUS, Realtime Gateway) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  {/* Pillar 1: Domain Services */}
                  <div className="lg:col-span-4 p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-blue-600" />
                          <h4 className="font-bold text-xs text-[var(--ink)]">Domain Services</h4>
                        </div>
                        <span className="text-[10px] font-mono text-blue-600">8 Modules</span>
                      </div>
                      <p className="text-[11px] text-[var(--mute)] mt-1.5 mb-2.5">
                        Stateless business logic handlers executing domain validation and CRUD state mutations:
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        {[
                          { name: 'Mobility', count: `${vehicles.length} vehicles` },
                          { name: 'Volunteers', count: `${volunteers.length} rostered` },
                          { name: 'Tasks', count: `${tasks.length} kanban` },
                          { name: 'Incidents', count: `${incidents.length} triage` },
                          { name: 'Sessions', count: '8 halls active' },
                          { name: 'Venue', count: '16 turnstiles' },
                          { name: 'Requests', count: 'VIP bilat & food' },
                          { name: 'Resources', count: 'Headsets & kits' }
                        ].map((d, i) => (
                          <div key={i} className="p-1.5 rounded bg-[var(--bg)] border border-[var(--line)] flex justify-between">
                            <span className="font-semibold text-[var(--ink)]">{d.name}</span>
                            <span className="text-[var(--mute)] font-mono text-[9px]">{d.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--line)] text-[10px] text-[var(--mute)]">
                      <div className="flex items-center gap-1.5 font-bold text-[var(--ink)] mb-0.5">
                        <Database className="w-3.5 h-3.5 text-blue-600" />
                        <span>Persistence Layer:</span>
                      </div>
                      <span><strong>DATABASE</strong> (Records + Temporal Audit Ledger) + <strong>Fast Cache Mesh</strong> (&lt;2ms lookup)</span>
                    </div>
                  </div>

                  {/* Pillar 2: EVENT BUS (Center Core) */}
                  <div className="lg:col-span-4 p-4 rounded-lg bg-[var(--primary)]/5 border-2 border-[var(--primary)] space-y-3 flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="flex items-center justify-between border-b border-[var(--primary)]/30 pb-2">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-[var(--primary)] animate-pulse" />
                          <h4 className="font-bold text-xs text-[var(--ink)]">EVENT BUS</h4>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--primary)] text-white">
                          "Every Change is an Event"
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--ink)] font-medium mt-2">
                        Central asynchronous publish-subscribe message backbone. Decouples ingestion from consumers, guarantees zero message loss with replay capability.
                      </p>

                      {/* Event Bus Subscribers */}
                      <div className="space-y-2 mt-3">
                        <div className="text-[10px] font-bold text-[var(--mute)] uppercase tracking-wide">
                          Active Event Subscribers:
                        </div>
                        <div className="p-2 rounded bg-[var(--card)] border border-[var(--line)] space-y-1">
                          <div className="flex items-center justify-between font-bold text-xs text-[var(--ink)]">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-500" />
                              Rules / Escalation Engine
                            </span>
                            <span className="text-emerald-600 text-[10px]">Active</span>
                          </div>
                          <p className="text-[10px] text-[var(--mute)]">
                            Monitors offline lead alarms, VIP motorcade delays & turnstile backup thresholds.
                          </p>
                        </div>

                        <div className="p-2 rounded bg-[var(--card)] border border-[var(--line)] space-y-1">
                          <div className="flex items-center justify-between font-bold text-xs text-[var(--ink)]">
                            <span className="flex items-center gap-1">
                              <Bell className="w-3 h-3 text-indigo-500" />
                              Notification Service
                            </span>
                            <span className="text-emerald-600 text-[10px]">Multi-Channel</span>
                          </div>
                          <p className="text-[10px] text-[var(--mute)]">
                            Dispatches instantaneous notifications via Push, SMS, Email, and WhatsApp.
                          </p>
                        </div>

                        <div className="p-2 rounded bg-[var(--card)] border border-[var(--line)] space-y-1">
                          <div className="flex items-center justify-between font-bold text-xs text-[var(--ink)]">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                              AI & Predictive Analytics
                            </span>
                            <span className="text-emerald-600 text-[10px]">Real-time</span>
                          </div>
                          <p className="text-[10px] text-[var(--mute)]">
                            Predicts crowd surges at lunch, transit delays on expressway, and session overflow.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('event_bus')}
                      className="w-full py-1.5 px-3 rounded bg-[var(--primary)] text-white font-bold text-xs hover:bg-[var(--primary-hover)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Live Event Bus Stream</span>
                    </button>
                  </div>

                  {/* Pillar 3: Realtime Gateway (WebSockets) */}
                  <div className="lg:col-span-4 p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-600" />
                          <h4 className="font-bold text-xs text-[var(--ink)]">Realtime Gateway</h4>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-600">WebSockets / SSE</span>
                      </div>
                      <p className="text-[11px] text-[var(--mute)] mt-1.5 mb-2.5">
                        Bi-directional low-latency socket pool streaming state updates directly to UI consumers:
                      </p>

                      <div className="space-y-1.5">
                        {[
                          { title: 'Command Center War-Room Screens', desc: 'Overhead master display wall (Gate turnstiles, attendance)' },
                          { title: 'Interactive Tactical Map', desc: 'Live vehicle markers, volunteer coords, active incidents' },
                          { title: 'Operational Kanban Boards', desc: 'Real-time task dispatch, progress & assignment state' },
                          { title: 'Officer Consoles & Mobile Apps', desc: 'Instant push updates without full page refresh' }
                        ].map((cons, i) => (
                          <div key={i} className="p-2 rounded bg-[var(--bg)] border border-[var(--line)]">
                            <div className="font-semibold text-xs text-[var(--ink)] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{cons.title}</span>
                            </div>
                            <div className="text-[10px] text-[var(--mute)]">{cons.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--line)] text-[10px] flex items-center justify-between text-[var(--mute)]">
                      <span>Active WebSocket Sessions:</span>
                      <strong className="text-emerald-600 font-mono">142 Connected (0 Drops)</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE EVENT BUS STREAM */}
          {activeTab === 'event_bus' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[var(--card)] border border-[var(--line)]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-[var(--ink)] mr-1">Filter by Domain:</span>
                  {['ALL', 'Mobility', 'Volunteers', 'Tasks', 'Incidents', 'Venue', 'Requests'].map((dom) => (
                    <button
                      key={dom}
                      onClick={() => setSelectedDomain(dom)}
                      className={`px-2.5 py-1 text-[11px] rounded-md font-semibold cursor-pointer transition-colors ${
                        selectedDomain === dom
                          ? 'bg-[var(--primary)] text-white shadow-2xs'
                          : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
                      }`}
                    >
                      {dom}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleTriggerClientEvent('Operator Consoles', 'system.event_bus_flushed', 'Venue', {
                        flushedBy: 'Super Admin',
                        status: 'OK'
                      });
                    }}
                    className="px-2.5 py-1 text-xs rounded border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Emit Test Ping</span>
                  </button>
                </div>
              </div>

              {/* Event Stream List */}
              <div className="space-y-2">
                {simulatedEvents
                  .filter((e) => selectedDomain === 'ALL' || e.domain === selectedDomain)
                  .map((evt) => {
                    const isSelected = selectedEvent?.id === evt.id;
                    return (
                      <div
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={`p-3 rounded-lg bg-[var(--card)] border transition-all cursor-pointer space-y-2 ${
                          isSelected
                            ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]'
                            : 'border-[var(--line)] hover:border-[var(--primary)]/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[var(--primary)]">{evt.id}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                              {evt.topic}
                            </span>
                            <span className="text-[11px] text-[var(--mute)]">from</span>
                            <span className="font-semibold text-xs text-[var(--ink)]">{evt.source}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[var(--mute)]">{evt.timestamp}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                evt.status === 'DELIVERED'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-red-500/10 text-red-600'
                              }`}
                            >
                              {evt.status}
                            </span>
                          </div>
                        </div>

                        {/* Subscribers list */}
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--mute)] flex-wrap">
                          <span className="font-semibold text-[var(--ink)]">Subscribers routed:</span>
                          {evt.subscribers.map((sub, sIdx) => (
                            <span key={sIdx} className="px-1.5 py-0.2 rounded bg-[var(--bg)] border border-[var(--line)]">
                              {sub}
                            </span>
                          ))}
                        </div>

                        {/* Payload Preview */}
                        <div className="p-2 rounded bg-[var(--bg)] border border-[var(--line)] font-mono text-[10px] text-[var(--ink)] overflow-x-auto">
                          {JSON.stringify(evt.payload, null, 2)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATION DISPATCHER */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-[var(--ink)] flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[var(--primary)]" />
                    <span>Notification Service Gateway: Push · SMS · Email · WhatsApp</span>
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-600">All 4 Providers Connected</span>
                </div>
                <p className="text-[11px] text-[var(--mute)]">
                  The Event Bus automatically triggers multi-channel emergency and operational broadcasts based on rules and priorities.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    title: 'Push Notifications',
                    icon: Smartphone,
                    provider: 'Apple APNs / Google FCM',
                    status: 'Operational',
                    metrics: '2,840 registered tokens',
                    speed: '120ms deliverability'
                  },
                  {
                    title: 'SMS Gateway',
                    icon: MessageSquare,
                    provider: 'Twilio / Singtel Telco Link',
                    status: 'Operational',
                    metrics: '99.7% delivery rate',
                    speed: '2.4s delivery'
                  },
                  {
                    title: 'Email Dispatch',
                    icon: Mail,
                    provider: 'AWS SES Dedicated Pool',
                    status: 'Operational',
                    metrics: '0.02% bounce rate',
                    speed: 'Batch queuing active'
                  },
                  {
                    title: 'WhatsApp Business API',
                    icon: Send,
                    provider: 'Meta Cloud API (Verified)',
                    status: 'Operational',
                    metrics: 'Direct attendee concierge',
                    speed: 'Instant read receipts'
                  }
                ].map((prov, pIdx) => {
                  const Icon = prov.icon;
                  return (
                    <div key={pIdx} className="p-3.5 rounded-lg bg-[var(--card)] border border-[var(--line)] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-[var(--ink)]">
                          <Icon className="w-4 h-4 text-[var(--primary)]" />
                          <span>{prov.title}</span>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          {prov.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--mute)]">
                        Provider: <strong>{prov.provider}</strong>
                      </div>
                      <div className="pt-2 border-t border-[var(--line)] text-[10px] text-[var(--mute)] space-y-0.5 font-mono">
                        <div>Capacity: {prov.metrics}</div>
                        <div>Performance: {prov.speed}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sample Dispatch Action */}
              <div className="p-4 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-2">
                <div className="font-bold text-xs text-[var(--ink)]">Quick Broadcast Dispatch via Event Bus:</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      handleTriggerClientEvent('Operator Consoles', 'notification.broadcast_sent', 'Notification', {
                        channels: ['Push', 'WhatsApp'],
                        audience: 'All Registered Delegates',
                        title: 'Plenary Stage Notice',
                        message: 'Keynote 2 starting in 15 minutes at Main Hall.'
                      })
                    }
                    className="px-3 py-1.5 rounded bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Plenary Alert (Push + WhatsApp)</span>
                  </button>

                  <button
                    onClick={() =>
                      handleTriggerClientEvent('Operator Consoles', 'notification.emergency_sms', 'Notification', {
                        channels: ['SMS', 'Push'],
                        audience: 'Volunteers and Mobility Drivers',
                        title: 'Weather Advisory',
                        message: 'Passing rain shower. Outdoor shuttles route through covered Gate 4 concourse.'
                      })
                    }
                    className="px-3 py-1.5 rounded bg-[var(--card)] hover:bg-[var(--line)] text-[var(--ink)] font-semibold text-xs border border-[var(--line)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Send Driver & Volunteer SMS Alert</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATABASE & FAST CACHE */}
          {activeTab === 'database' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Database Tier */}
                <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-[var(--ink)]">
                      <Database className="w-4 h-4 text-blue-600" />
                      <span>Persistent Database (Records + History)</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-600">PostgreSQL / Firestore</span>
                  </div>
                  <p className="text-[11px] text-[var(--mute)]">
                    Authoritative store for all summit data models, foreign key relationships, audit records, and historical change logs.
                  </p>
                  <div className="space-y-1.5 text-xs text-[var(--mute)]">
                    <div className="flex justify-between p-1.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                      <span>Total Registered Users:</span>
                      <strong className="text-[var(--ink)] font-mono">{participants.length} records</strong>
                    </div>
                    <div className="flex justify-between p-1.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                      <span>VIP & VVIP Dignitaries:</span>
                      <strong className="text-[var(--ink)] font-mono">{vipGuests.length} manifests</strong>
                    </div>
                    <div className="flex justify-between p-1.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                      <span>Active Incidents Log:</span>
                      <strong className="text-[var(--ink)] font-mono">{incidents.length} logged</strong>
                    </div>
                    <div className="flex justify-between p-1.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                      <span>Operational Tasks:</span>
                      <strong className="text-[var(--ink)] font-mono">{tasks.length} tasks</strong>
                    </div>
                  </div>
                </div>

                {/* Fast Cache Tier */}
                <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-[var(--ink)]">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>Fast Cache (Latest State Mesh)</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-500">In-Memory Redis / Mesh</span>
                  </div>
                  <p className="text-[11px] text-[var(--mute)]">
                    Sub-millisecond in-memory cache holding real-time vehicle GPS positions, active badge validity for turnstiles, and current officer online statuses.
                  </p>
                  <div className="space-y-1.5 text-xs text-[var(--mute)]">
                    <div className="flex justify-between p-1.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                      <span>Turnstile Read Latency:</span>
                      <strong className="text-emerald-600 font-mono">1.1ms (99.8% hit rate)</strong>
                    </div>
                    <div className="flex justify-between p-1.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                      <span>Vehicle Realtime GPS:</span>
                      <strong className="text-emerald-600 font-mono">48 vehicles cached</strong>
                    </div>
                    <div className="flex justify-between p-1.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                      <span>Volunteer Zone Bindings:</span>
                      <strong className="text-emerald-600 font-mono">212 cached</strong>
                    </div>
                    <div className="flex justify-between p-1.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                      <span>Offline Turnstile Burst Buffer:</span>
                      <strong className="text-emerald-600 font-mono">Zero backlog</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-[var(--mute)]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Architecture certified against YESummit 2027 high-concurrency specifications.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[var(--card)] hover:bg-[var(--line)] text-[var(--ink)] font-semibold border border-[var(--line)] cursor-pointer text-xs transition-colors"
          >
            Close Architecture Console
          </button>
        </div>
      </div>
    </div>
  );
};
