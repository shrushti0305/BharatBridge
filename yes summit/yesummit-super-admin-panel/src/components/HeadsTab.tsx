import React from 'react';
import {
  Shield,
  Phone,
  Mail,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  Zap,
  ArrowUpRight,
  Flame,
  UserX,
  Bus,
  Power
} from 'lucide-react';
import { AreaController } from '../types';

interface HeadsTabProps {
  controllers: AreaController[];
  onToggleControllerStatus: (id: string) => void;
  onSimulateVehicleBreakdown: () => void;
  onSimulateVolunteerShortage: () => void;
  onSimulateMedicalEmergency: () => void;
}

export const HeadsTab: React.FC<HeadsTabProps> = ({
  controllers,
  onToggleControllerStatus,
  onSimulateVehicleBreakdown,
  onSimulateVolunteerShortage,
  onSimulateMedicalEmergency
}) => {
  return (
    <div className="space-y-6">
      {/* Simulation Sandbox Hero Banner with 3 Demo Buttons */}
      <div className="p-4 sm:p-5 rounded-lg bg-[var(--card)] border-2 border-[var(--primary)]/30 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--primary)]" />
              <h2 className="text-base font-bold text-[var(--ink)]">
                Volunteer Field Issue Simulation Sandbox
              </h2>
            </div>
            <p className="text-xs text-[var(--mute)] mt-1">
              Simulate volunteer field reports in real-time. Creates real records, updates KPI counts, evaluates Area Controller online availability, and automatically escalates to Command Centre Lead if offline.
            </p>
          </div>
          <span className="text-[11px] font-mono font-semibold text-[var(--primary)] bg-[var(--primary)]/10 px-2.5 py-1 rounded">
            Interactive Test Protocol
          </span>
        </div>

        {/* The 3 Demo Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Button 1: Vehicle Breakdown */}
          <button
            onClick={onSimulateVehicleBreakdown}
            className="p-3.5 rounded-lg bg-[var(--bg)] border border-red-500/30 hover:border-red-500 hover:bg-red-500/5 text-left transition-all cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                <Bus className="w-4 h-4" />
                <span>1. Vehicle Breakdown</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-700">
                Mobility
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink)] leading-snug">
              Shuttle VH-07 coolant overheating on Highway A2. 34 passengers stranded.
            </p>
            <div className="mt-2 text-[10px] text-[var(--mute)] flex items-center justify-between">
              <span>Owner: Rajesh Verma</span>
              <span className="text-red-600 font-semibold group-hover:underline">Raise Issue →</span>
            </div>
          </button>

          {/* Button 2: Volunteer Shortage */}
          <button
            onClick={onSimulateVolunteerShortage}
            className="p-3.5 rounded-lg bg-[var(--bg)] border border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/5 text-left transition-all cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>2. Volunteer Shortage</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">
                Volunteers
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink)] leading-snug">
              Registration desk overwhelmed; 4 extra floating volunteers required urgently.
            </p>
            <div className="mt-2 text-[10px] text-[var(--mute)] flex items-center justify-between">
              <span>Owner: Sarah Jenkins</span>
              <span className="text-amber-600 font-semibold group-hover:underline">Raise Issue →</span>
            </div>
          </button>

          {/* Button 3: Medical Emergency */}
          <button
            onClick={onSimulateMedicalEmergency}
            className="p-3.5 rounded-lg bg-[var(--bg)] border border-red-500/30 hover:border-red-500 hover:bg-red-500/5 text-left transition-all cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>3. Medical Emergency</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-700">
                Safety
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink)] leading-snug">
              Delegate collapsed in Hall B corridor with dizziness & difficulty breathing.
            </p>
            <div className="mt-2 text-[10px] text-[var(--mute)] flex items-center justify-between">
              <span>Owner: Dr. Marcus Vance</span>
              <span className="text-red-600 font-semibold group-hover:underline">Raise Issue →</span>
            </div>
          </button>
        </div>
      </div>

      {/* The 7 Area Controllers Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-[var(--ink)]">
              Operational Area Controllers (7 Key Domain Leads)
            </h3>
            <p className="text-xs text-[var(--mute)]">
              Toggle controller online status to test auto-escalation to Command Centre Lead.
            </p>
          </div>
          <span className="text-xs font-medium text-[var(--mute)]">
            {controllers.filter((c) => c.isOnline).length} / 7 Controllers Online
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {controllers.map((ctrl) => (
            <div
              key={ctrl.id}
              className={`p-4 rounded-lg bg-[var(--card)] border transition-all shadow-xs space-y-3 ${
                ctrl.isOnline
                  ? 'border-[var(--line)] hover:border-[var(--primary)]'
                  : 'border-red-500/30 bg-red-500/5'
              }`}
            >
              {/* Header with online pill */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--primary)]">
                    {ctrl.area} Area Controller
                  </span>
                  <h4 className="text-sm font-bold text-[var(--ink)] mt-0.5">{ctrl.name}</h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleControllerStatus(ctrl.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      ctrl.isOnline
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
                    }`}
                    title="Click to toggle Online / Offline"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        ctrl.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      }`}
                    />
                    <span>{ctrl.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                  </button>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1 text-xs text-[var(--mute)]">
                <div className="flex items-center gap-2 font-mono">
                  <Phone className="w-3.5 h-3.5 text-[var(--mute)]" />
                  <span>{ctrl.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[var(--mute)]" />
                  <span>{ctrl.email}</span>
                </div>
              </div>

              {/* Stats & Escalation alert */}
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-[var(--mute)] block">Open Issues</span>
                  <span className={`font-bold tabular-nums ${ctrl.openIssuesCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {ctrl.openIssuesCount} active
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--mute)] block">Assigned Staff</span>
                  <span className="font-bold tabular-nums text-[var(--ink)]">
                    {ctrl.assignedStaff} people
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--mute)] block">Last Ping</span>
                  <span className="text-[var(--mute)] font-mono text-[11px]">
                    {ctrl.lastCheckIn}
                  </span>
                </div>
              </div>

              {!ctrl.isOnline && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-700 dark:text-red-400 flex items-center gap-1.5 font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  <span>Auto-Escalation Active: Issues rerouted to Command Centre Lead.</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
