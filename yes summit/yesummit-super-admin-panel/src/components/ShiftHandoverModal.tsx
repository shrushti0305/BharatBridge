import React from 'react';
import {
  Printer,
  X,
  ShieldCheck,
  Crown,
  Car,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  Building
} from 'lucide-react';
import { Incident, Vehicle, VIPGuest, Volunteer, Session } from '../types';

interface ShiftHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  vipGuests: VIPGuest[];
  incidents: Incident[];
  vehicles: Vehicle[];
  volunteers: Volunteer[];
  sessions: Session[];
}

export const ShiftHandoverModal: React.FC<ShiftHandoverModalProps> = ({
  isOpen,
  onClose,
  vipGuests,
  incidents,
  vehicles,
  volunteers,
  sessions,
}) => {
  if (!isOpen) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const vvipTotal = vipGuests.filter((v) => v.tier === 'VVIP').length;
  const vvipArrived = vipGuests.filter(
    (v) => v.tier === 'VVIP' && v.motorcade.status === 'Arrived Onsite'
  ).length;

  const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  const onTimeVehicles = vehicles.filter((v) => v.status === 'ON_TIME').length;
  const activeVolunteers = volunteers.filter((v) => v.status !== 'OFFLINE').length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl bg-[var(--card)] border border-[var(--line)] rounded-xl shadow-2xl overflow-hidden my-8 text-[var(--ink)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Action Bar */}
        <div className="px-6 py-3.5 bg-[var(--bg)] border-b border-[var(--line)] flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-xs uppercase tracking-wider text-[var(--ink)]">
              Official Shift Handover & Telemetry Briefing (PDF/Print)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--primary)] text-white hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
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

        {/* Printable Document Body */}
        <div className="p-8 space-y-6 bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 print:p-0 print:bg-white print:text-black">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded">
                  APEX COMMAND DECK
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">DOC REF: APEX-SPO-2027-D2</span>
              </div>
              <h1 className="text-xl font-black tracking-tight mt-1 text-slate-900 dark:text-white">
                YESummit 2027 Singapore · Incident & Protocol Handover Briefing
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sands Expo & Convention Centre (Marina Bay Sands) & Suntec Singapore
              </p>
            </div>
            <div className="text-right font-mono text-xs text-slate-600 dark:text-slate-400">
              <div className="font-bold text-slate-900 dark:text-slate-200">{dateStr}</div>
              <div>{timeStr} SGT (UTC+8)</div>
              <div className="text-[11px] text-emerald-600 font-semibold">Classification: RESTRICTED / OFFICIAL</div>
            </div>
          </div>

          {/* Operational Health KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-bold">VVIP Heads of State</span>
                <Crown className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-lg font-black mt-1">
                {vvipArrived} / {vvipTotal}{' '}
                <span className="text-xs font-normal text-emerald-600">Onsite</span>
              </div>
              <p className="text-[10px] text-slate-500">100% close escorts active</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-bold">Active Incidents</span>
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div className="text-lg font-black mt-1 text-amber-600">
                {openIncidents.length}{' '}
                <span className="text-xs font-normal text-slate-500">({resolvedIncidents.length} resolved)</span>
              </div>
              <p className="text-[10px] text-slate-500">Avg resolution time: 14.2 min</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-bold">Fleet Telematics</span>
                <Car className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="text-lg font-black mt-1">
                {onTimeVehicles} / {vehicles.length}{' '}
                <span className="text-xs font-normal text-emerald-600">On Route</span>
              </div>
              <p className="text-[10px] text-slate-500">1 breakdown (relief deployed)</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-bold">On-Duty Volunteers</span>
                <Users className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-lg font-black mt-1">
                {activeVolunteers} / {volunteers.length}{' '}
                <span className="text-xs font-normal text-slate-500">Deployed</span>
              </div>
              <p className="text-[10px] text-slate-500">186 total rostered staff</p>
            </div>
          </div>

          {/* Section: Critical Incidents Logged for Next Shift Handover */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>1. Active Incidents & Handover Escalations</span>
            </h2>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 font-semibold text-slate-600 dark:text-slate-300 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">ID & Priority</th>
                    <th className="py-2 px-3">Title & Location</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Assigned Unit</th>
                    <th className="py-2 px-3">Handover Action Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {incidents.slice(0, 4).map((inc) => (
                    <tr key={inc.id}>
                      <td className="py-2 px-3 whitespace-nowrap font-mono">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            inc.priority === 'HIGH'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {inc.id} [{inc.priority}]
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{inc.title}</div>
                        <div className="text-[10px] text-slate-500">{inc.location}</div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-semibold text-[10px] uppercase">{inc.status}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{inc.assignedTeam}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-600 dark:text-slate-300">
                        {inc.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: VIP Delegations Onsite & Bilateral Suites */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-600" />
              <span>2. High-Profile VVIP Delegations & Bilateral Room Allocations</span>
            </h2>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 font-semibold text-slate-600 dark:text-slate-300 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">ID & Dignitary</th>
                    <th className="py-2 px-3">Delegation & Title</th>
                    <th className="py-2 px-3">Assigned Suite</th>
                    <th className="py-2 px-3">Motorcade & Driver</th>
                    <th className="py-2 px-3">Protocol Liaison</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {vipGuests.slice(0, 5).map((vip) => (
                    <tr key={vip.id}>
                      <td className="py-2 px-3 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span>{vip.name}</span>
                          <span className="font-mono text-[9px] px-1 bg-slate-100 dark:bg-slate-800 rounded">
                            {vip.id}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                        {vip.officialTitle} ({vip.countryOrOrg})
                      </td>
                      <td className="py-2 px-3 font-semibold text-emerald-700 dark:text-emerald-400">
                        {vip.assignedSuite}
                      </td>
                      <td className="py-2 px-3 text-[11px]">
                        <div>{vip.motorcade.convoyId}</div>
                        <div className="text-[10px] text-slate-500">
                          {vip.motorcade.driverName} ({vip.motorcade.driverPhone})
                        </div>
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

          {/* Commander Verification Sign-off Box */}
          <div className="border-2 border-slate-900 dark:border-slate-700 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Operational Handover Certification & Seal
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                SECURITY COMPLIANT · ISO 22301 INCIDENT STANDARDS
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs pt-2">
              <div className="space-y-2 border-t border-slate-300 dark:border-slate-700 pt-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Outgoing Incident Commander:
                </div>
                <div className="h-8 border-b border-dashed border-slate-400 dark:border-slate-600 flex items-end font-serif italic text-sm text-slate-700 dark:text-slate-300">
                  Commander R. Tan, SPF Ops Detachment
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Date & Time: {dateStr} · {timeStr} SGT</div>
              </div>
              <div className="space-y-2 border-t border-slate-300 dark:border-slate-700 pt-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Incoming Shift Duty Officer:
                </div>
                <div className="h-8 border-b border-dashed border-slate-400 dark:border-slate-600 flex items-end font-serif italic text-sm text-slate-700 dark:text-slate-300">
                  Insp. Marcus Goh, Protocol Control Core
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Status: Acknowledged & Received</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
