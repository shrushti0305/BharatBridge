import React, { useState } from 'react';
import {
  Zap,
  AlertTriangle,
  Radio,
  RefreshCw,
  Plus,
  X,
  Bus,
  Users,
  ShieldAlert,
  Send,
  CheckCircle2,
  AlertOctagon,
  Upload
} from 'lucide-react';
import { Incident, Priority, SentBroadcast } from '../types';

interface QuickActionsFABProps {
  onCreateIncident: (newInc: Omit<Incident, 'id' | 'reportedAt' | 'minutesAgo' | 'timeline'>) => void;
  onSendBroadcast: (broadcast: Omit<SentBroadcast, 'id' | 'sentAt' | 'status'>) => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
  scanningPaused: boolean;
  onToggleScanning: (paused: boolean) => void;
  onSimulateBreakdown: () => void;
  onSimulateMedical: () => void;
  onSimulateShortage: () => void;
  onOpenImportModal?: () => void;
}

export const QuickActionsFAB: React.FC<QuickActionsFABProps> = ({
  onCreateIncident,
  onSendBroadcast,
  onTriggerSync,
  isSyncing,
  scanningPaused,
  onToggleScanning,
  onSimulateBreakdown,
  onSimulateMedical,
  onSimulateShortage,
  onOpenImportModal
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'incident' | 'broadcast' | 'pauseScan' | null>(null);

  // Quick Incident Form State
  const [incTitle, setIncTitle] = useState('');
  const [incType, setIncType] = useState<Incident['type']>('Technical / AV');
  const [incLocation, setIncLocation] = useState('Main Plenary Hall');
  const [incPriority, setIncPriority] = useState<Priority>('HIGH');
  const [incReporter, setIncReporter] = useState('Super Admin Quick Dispatch');
  const [incAffected, setIncAffected] = useState(25);
  const [incDesc, setIncDesc] = useState('');

  // Quick Broadcast Form State
  const [bAudience, setBAudience] = useState('All Volunteers');
  const [bChannel, setBChannel] = useState<'Push' | 'SMS' | 'Email'>('Push');
  const [bPriority, setBPriority] = useState<'Normal' | 'High' | 'Emergency'>('High');
  const [bSubject, setBSubject] = useState('');
  const [bMessage, setBMessage] = useState('');

  const handleIncidentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incTitle.trim()) return;

    onCreateIncident({
      title: incTitle.trim(),
      type: incType,
      location: incLocation,
      priority: incPriority,
      status: 'OPEN',
      reporter: incReporter,
      assignedTeam: 'Rapid Response Team Alpha',
      affectedCount: Number(incAffected) || 0,
      description: incDesc || 'Quick incident logged via Global Actions overlay.'
    });

    setIncTitle('');
    setIncDesc('');
    setActiveModal(null);
  };

  const handleBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bMessage.trim()) return;

    onSendBroadcast({
      audience: bAudience,
      channel: bChannel,
      priority: bPriority,
      subject: bSubject || 'Immediate Operations Broadcast',
      message: bMessage.trim(),
      recipientsCount: bAudience.includes('Volunteers') ? 186 : 48
    });

    setBSubject('');
    setBMessage('');
    setActiveModal(null);
  };

  return (
    <>
      {/* Floating Speed-Dial Menu Anchor in Bottom Right */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {/* Open Menu Options */}
        {isOpen && (
          <div className="mb-3 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* Action 1: Log Incident */}
            <div className="flex items-center gap-2">
              <span className="bg-[var(--card)] text-[var(--ink)] text-xs font-semibold px-2.5 py-1 rounded-md shadow-md border border-[var(--line)] whitespace-nowrap">
                Log New Incident
              </span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setActiveModal('incident');
                }}
                className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                title="Log Incident"
              >
                <AlertTriangle className="w-5 h-5" />
              </button>
            </div>

            {/* Action 2: Broadcast Alert */}
            <div className="flex items-center gap-2">
              <span className="bg-[var(--card)] text-[var(--ink)] text-xs font-semibold px-2.5 py-1 rounded-md shadow-md border border-[var(--line)] whitespace-nowrap">
                Broadcast Alert (Push / SMS)
              </span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setActiveModal('broadcast');
                }}
                className="w-11 h-11 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                title="Broadcast Alert"
              >
                <Radio className="w-5 h-5" />
              </button>
            </div>

            {/* Action 3: Sync Gateway */}
            <div className="flex items-center gap-2">
              <span className="bg-[var(--card)] text-[var(--ink)] text-xs font-semibold px-2.5 py-1 rounded-md shadow-md border border-[var(--line)] whitespace-nowrap">
                {isSyncing ? 'Syncing...' : 'Sync Gateway'}
              </span>
              <button
                onClick={() => {
                  onTriggerSync();
                  setIsOpen(false);
                }}
                disabled={isSyncing}
                className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer disabled:opacity-50"
                title="Sync Gateway"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Action 4: Import Data / Manifest */}
            {onOpenImportModal && (
              <div className="flex items-center gap-2">
                <span className="bg-[var(--card)] text-[var(--ink)] text-xs font-semibold px-2.5 py-1 rounded-md shadow-md border border-[var(--line)] whitespace-nowrap">
                  Import CSV / JSON Manifest
                </span>
                <button
                  onClick={() => {
                    onOpenImportModal();
                    setIsOpen(false);
                  }}
                  className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                  title="Import Dataset"
                >
                  <Upload className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Action 5: Quick Emergency Simulation */}
            <div className="flex items-center gap-2">
              <span className="bg-[var(--card)] text-[var(--ink)] text-xs font-semibold px-2.5 py-1 rounded-md shadow-md border border-[var(--line)] whitespace-nowrap">
                Simulate Field Medical Emergency
              </span>
              <button
                onClick={() => {
                  onSimulateMedical();
                  setIsOpen(false);
                }}
                className="w-11 h-11 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                title="Simulate Medical"
              >
                <ShieldAlert className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Floating Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Quick Actions"
          className={`flex items-center gap-2 px-4 py-3 rounded-full text-white font-bold text-xs sm:text-sm shadow-xl transition-all cursor-pointer ${
            isOpen
              ? 'bg-slate-800 dark:bg-slate-700 ring-2 ring-white/20'
              : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] hover:shadow-2xl hover:scale-105'
          }`}
        >
          {isOpen ? (
            <>
              <X className="w-5 h-5" />
              <span>Close</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Quick Actions</span>
            </>
          )}
        </button>
      </div>

      {/* Global Modal: Quick Log Incident */}
      {activeModal === 'incident' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleIncidentSubmit}
            className="bg-[var(--card)] rounded-lg max-w-lg w-full border border-[var(--line)] p-5 space-y-4 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Quick Log Incident (Without Leaving Current View)</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-[var(--mute)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Incident Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Turnstile power drop at Gate 3"
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Type</label>
                  <select
                    value={incType}
                    onChange={(e) => setIncType(e.target.value as Incident['type'])}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    <option value="Technical / AV">Technical / AV</option>
                    <option value="Medical">Medical</option>
                    <option value="Mobility">Mobility</option>
                    <option value="Crowd / Security">Crowd / Security</option>
                    <option value="Facility">Facility</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Priority</label>
                  <select
                    value={incPriority}
                    onChange={(e) => setIncPriority(e.target.value as Priority)}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    <option value="HIGH">HIGH (Immediate ▲)</option>
                    <option value="MEDIUM">MEDIUM (Watch ■)</option>
                    <option value="LOW">LOW (Monitor ●)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Location</label>
                  <input
                    type="text"
                    required
                    value={incLocation}
                    onChange={(e) => setIncLocation(e.target.value)}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Affected Headcount</label>
                  <input
                    type="number"
                    min="0"
                    value={incAffected}
                    onChange={(e) => setIncAffected(parseInt(e.target.value) || 0)}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={incDesc}
                  onChange={(e) => setIncDesc(e.target.value)}
                  placeholder="Detail immediate hazards or initial response actions..."
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold shadow-xs"
              >
                Log & Dispatch Incident
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Modal: Quick Broadcast Alert */}
      {activeModal === 'broadcast' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleBroadcastSubmit}
            className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <Radio className="w-4 h-4 text-[var(--primary)]" />
                <span>Instant Broadcast Dispatcher</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-[var(--mute)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Target Audience</label>
                <select
                  value={bAudience}
                  onChange={(e) => setBAudience(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  <option value="All Volunteers">All Volunteers (186 on-duty)</option>
                  <option value="Drivers (Mobility Fleet)">Drivers (Mobility Fleet 48)</option>
                  <option value="Hotel A Participants">Hotel A Participants</option>
                  <option value="Operations Team">Operations & Area Leads</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Channel</label>
                  <select
                    value={bChannel}
                    onChange={(e) => setBChannel(e.target.value as any)}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    <option value="Push">Push Notification</option>
                    <option value="SMS">Direct SMS</option>
                    <option value="Email">Email Blast</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Priority</label>
                  <select
                    value={bPriority}
                    onChange={(e) => setBPriority(e.target.value as any)}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    <option value="High">High Priority</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Normal">Normal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Subject Header</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Immediate Weather Egress Instructions"
                  value={bSubject}
                  onChange={(e) => setBSubject(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Message Content</label>
                <textarea
                  rows={3}
                  required
                  value={bMessage}
                  onChange={(e) => setBMessage(e.target.value)}
                  placeholder="Enter broadcast message body..."
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Transmit Broadcast</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
