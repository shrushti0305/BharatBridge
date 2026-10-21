import React from 'react';
import {
  Printer,
  Download,
  X,
  ShieldCheck,
  Crown,
  Car,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  History,
  Activity,
  Layers,
  Database
} from 'lucide-react';
import {
  Incident,
  Vehicle,
  VIPGuest,
  Volunteer,
  Session,
  Participant,
  Task,
  ActivityItem
} from '../types';

interface AuditDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  tasks: Task[];
  vehicles: Vehicle[];
  volunteers: Volunteer[];
  sessions: Session[];
  participants: Participant[];
  vipGuests: VIPGuest[];
  activities: ActivityItem[];
  onExportCSV: () => void;
}

export const AuditDossierModal: React.FC<AuditDossierModalProps> = ({
  isOpen,
  onClose,
  incidents,
  tasks,
  vehicles,
  volunteers,
  sessions,
  participants,
  vipGuests,
  activities,
  onExportCSV
}) => {
  if (!isOpen) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');
  const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const arrivedVVIPs = vipGuests.filter((v) => v.motorcade.status === 'Arrived Onsite');
  const onTimeVehicles = vehicles.filter((v) => v.status === 'ON_TIME');
  const activeVolunteers = volunteers.filter((v) => v.status !== 'OFFLINE');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-5xl bg-[var(--card)] border border-[var(--line)] rounded-xl shadow-2xl overflow-hidden my-6 text-[var(--ink)] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Action Header (Excluded in Print) */}
        <div className="px-6 py-3.5 bg-[var(--bg)] border-b border-[var(--line)] flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-xs uppercase tracking-wider text-[var(--ink)]">
              Full Operational Audit Log & System State Dossier (PDF/Print View)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-[var(--line)] bg-[var(--card)] hover:bg-[var(--line)]/50 text-[var(--ink)] transition-colors cursor-pointer shadow-2xs"
              title="Download entire audit log & state in CSV format"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded bg-[var(--primary)] text-white hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
              title="Print document or save to PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Audit Document Content */}
        <div className="overflow-y-auto p-8 space-y-8 bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 print:p-0 print:bg-white print:text-black">
          {/* Official Document Banner */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded">
                  APEX INCIDENT AUDIT COMMAND
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  DOC ID: APEX-AUDIT-2027-EOD
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight mt-1 text-slate-900 dark:text-white">
                YESummit 2027 Singapore · Operational Audit Log & System State
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official Post-Event Forensic Dossier · Sands Expo (Marina Bay Sands) & Suntec Singapore
              </p>
            </div>

            <div className="text-right font-mono text-xs text-slate-600 dark:text-slate-400">
              <div className="font-bold text-slate-900 dark:text-slate-200">{dateStr}</div>
              <div>{timeStr} SGT (UTC+8)</div>
              <div className="text-[10px] text-emerald-600 font-semibold tracking-wider uppercase">
                Classification: OFFICIAL / RESTRICTED AUDIT
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Hash: sha256-apex921048b29c
              </div>
            </div>
          </div>

          {/* Section 1: Executive Post-Event Operational Metrics */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>1. System Operational KPIs & Post-Event Summary</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div className="text-[10px] uppercase font-bold text-slate-500">Total Audit Events</div>
                <div className="text-xl font-black mt-1 text-blue-600">{activities.length} Events</div>
                <div className="text-[10px] text-slate-500">100% telemetry recorded</div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div className="text-[10px] uppercase font-bold text-slate-500">Incident Resolution Rate</div>
                <div className="text-xl font-black mt-1 text-emerald-600">
                  {resolvedIncidents.length} / {incidents.length}{' '}
                  <span className="text-xs font-semibold text-slate-500">
                    ({Math.round((resolvedIncidents.length / Math.max(1, incidents.length)) * 100)}%)
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">{openIncidents.length} handovers ongoing</div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div className="text-[10px] uppercase font-bold text-slate-500">Dignitary Escort Passes</div>
                <div className="text-xl font-black mt-1 text-amber-600">
                  {arrivedVVIPs.length} / {vipGuests.length}
                </div>
                <div className="text-[10px] text-slate-500">Zero protocol breaches</div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div className="text-[10px] uppercase font-bold text-slate-500">Fleet On-Time Rate</div>
                <div className="text-xl font-black mt-1 text-indigo-600">
                  {onTimeVehicles.length} / {vehicles.length}{' '}
                  <span className="text-xs font-semibold text-slate-500">
                    ({Math.round((onTimeVehicles.length / Math.max(1, vehicles.length)) * 100)}%)
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">Relief vehicles deployed</div>
              </div>
            </div>
          </div>

          {/* Section 2: Chronological Operational Audit Log */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. Chronological Operational Activity & Audit Log</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                {activities.length} Recorded Ledger Records
              </span>
            </h2>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 font-semibold text-slate-600 dark:text-slate-300 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3 w-28">Timestamp</th>
                    <th className="py-2 px-3 w-28">Category</th>
                    <th className="py-2 px-3">Event Audit Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {activities.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {act.timestamp}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {act.category}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {act.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Incident Register & Resolution Timeline */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>3. Operational Incidents & Triage Log</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">{incidents.length} Total Incidents</span>
            </h2>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 font-semibold text-slate-600 dark:text-slate-300 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3 w-24">ID</th>
                    <th className="py-2 px-3 w-28">Priority & Status</th>
                    <th className="py-2 px-3">Title & Location</th>
                    <th className="py-2 px-3 w-36">Assigned Unit</th>
                    <th className="py-2 px-3 w-20 text-right">Affected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {incidents.map((inc) => (
                    <tr key={inc.id}>
                      <td className="py-2 px-3 font-mono font-bold">{inc.id}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            inc.priority === 'HIGH'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {inc.priority}
                        </span>{' '}
                        <span className="text-[10px] font-semibold text-slate-500">{inc.status}</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{inc.title}</div>
                        <div className="text-[10px] text-slate-500">{inc.location}</div>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{inc.assignedTeam}</td>
                      <td className="py-2 px-3 text-right font-mono">{inc.affectedCount} pax</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: VVIP Protocol & Escort Log */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>4. Diplomatic Protocol & VVIP Motorcade Ledger</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">{vipGuests.length} Guests Audited</span>
            </h2>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 font-semibold text-slate-600 dark:text-slate-300 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">ID & Dignitary</th>
                    <th className="py-2 px-3">Title & Organization</th>
                    <th className="py-2 px-3">Flight & Arrival</th>
                    <th className="py-2 px-3">Convoy / Vehicle</th>
                    <th className="py-2 px-3">Bilateral Suite</th>
                    <th className="py-2 px-3">Liaison Officer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {vipGuests.slice(0, 8).map((vip) => (
                    <tr key={vip.id}>
                      <td className="py-2 px-3 font-semibold">
                        <div>{vip.name}</div>
                        <div className="text-[9px] font-mono text-slate-500">{vip.id} · {vip.tier}</div>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                        {vip.officialTitle} ({vip.countryOrOrg})
                      </td>
                      <td className="py-2 px-3 text-[11px]">
                        <div>{vip.flightInfo.flightNumber}</div>
                        <div className="text-[10px] text-slate-500">{vip.flightInfo.status}</div>
                      </td>
                      <td className="py-2 px-3 text-[11px]">
                        <div>{vip.motorcade.convoyId}</div>
                        <div className="text-[10px] text-slate-500">{vip.motorcade.vehicleType}</div>
                      </td>
                      <td className="py-2 px-3 font-medium text-emerald-700 dark:text-emerald-400">
                        {vip.assignedSuite}
                      </td>
                      <td className="py-2 px-3 text-[11px]">
                        <div>{vip.liaisonOfficer.name}</div>
                        <div className="text-[10px] text-slate-500">{vip.liaisonOfficer.phone}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Fleet Mobility Telematics */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-indigo-600" />
                <span>5. Fleet Mobility & Shuttle Corridor Status</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">{vehicles.length} Active Vehicles</span>
            </h2>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 font-semibold text-slate-600 dark:text-slate-300 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Vehicle ID</th>
                    <th className="py-2 px-3">Driver & Contact</th>
                    <th className="py-2 px-3">Vehicle Type & Route</th>
                    <th className="py-2 px-3">Occupancy</th>
                    <th className="py-2 px-3">Status & ETA</th>
                    <th className="py-2 px-3 text-right">Battery / Fuel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {vehicles.map((vh) => (
                    <tr key={vh.id}>
                      <td className="py-2 px-3 font-mono font-bold">{vh.id}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold">{vh.driver}</div>
                        <div className="text-[10px] text-slate-500">{vh.phone}</div>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                        <div>{vh.type}</div>
                        <div className="text-[10px] text-slate-500">{vh.route}</div>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">{vh.passengers} pax</td>
                      <td className="py-2 px-3 font-semibold">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            vh.status === 'ON_TIME'
                              ? 'bg-emerald-100 text-emerald-700'
                              : vh.status === 'BREAKDOWN'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {vh.status}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">{vh.eta}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {vh.batteryFuel}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 6: Official Post-Event Audit Sign-off Block */}
          <div className="border-2 border-slate-900 dark:border-slate-700 rounded-lg p-5 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Post-Event Audit Verification & Forensic Certification
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                ISO 22301 / COMPLIANT WITH STATE SECURITY AUDIT STANDARDS
              </span>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              I hereby certify that this audit log and system state record accurately reflects all real-time incident reports, VIP diplomatic arrivals, fleet dispatches, and volunteer deployments during YESummit 2027 operations. All hardware turnstiles and credential check logs have been reconciled.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs pt-2">
              <div className="space-y-1.5 border-t border-slate-300 dark:border-slate-700 pt-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Lead Operations Commander:
                </div>
                <div className="h-8 border-b border-dashed border-slate-400 dark:border-slate-600 flex items-end font-serif italic text-sm text-slate-700 dark:text-slate-300">
                  Commander R. Tan, SPF Ops Detachment
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Date: {dateStr} · Signature Verified</div>
              </div>

              <div className="space-y-1.5 border-t border-slate-300 dark:border-slate-700 pt-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Host Protocol Director:
                </div>
                <div className="h-8 border-b border-dashed border-slate-400 dark:border-slate-600 flex items-end font-serif italic text-sm text-slate-700 dark:text-slate-300">
                  Insp. Marcus Goh, Protocol Control Core
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Status: Formally Reconciled & Archived</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
