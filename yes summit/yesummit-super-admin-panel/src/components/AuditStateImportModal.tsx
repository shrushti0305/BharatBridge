import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Database,
  History,
  ShieldCheck,
  RefreshCw,
  Crown,
  Car
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

interface AuditStateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSystemState: (importedState: {
    incidents?: Incident[];
    tasks?: Task[];
    vehicles?: Vehicle[];
    volunteers?: Volunteer[];
    sessions?: Session[];
    participants?: Participant[];
    vipGuests?: VIPGuest[];
    activities?: ActivityItem[];
  }) => void;
  onAddToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onLogActivity?: (message: string, category?: any) => void;
}

interface ParsedSummary {
  auditLogsCount: number;
  incidentsCount: number;
  vipGuestsCount: number;
  vehiclesCount: number;
  tasksCount: number;
  volunteersCount: number;
  sessionsCount: number;
  participantsCount: number;
  sourceTimestamp?: string;
  payload: any;
}

export const AuditStateImportModal: React.FC<AuditStateImportModalProps> = ({
  isOpen,
  onClose,
  onRestoreSystemState,
  onAddToast,
  onLogActivity
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedContent, setPastedContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [parsedSummary, setParsedSummary] = useState<ParsedSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const parseJsonState = (jsonObj: any): ParsedSummary => {
    let auditLogs: ActivityItem[] = [];
    let incidents: Incident[] = [];
    let vipGuests: VIPGuest[] = [];
    let vehicles: Vehicle[] = [];
    let tasks: Task[] = [];
    let volunteers: Volunteer[] = [];
    let sessions: Session[] = [];
    let participants: Participant[] = [];

    // Support both direct state snapshots and wrapped summary dossier objects
    if (Array.isArray(jsonObj.activities)) auditLogs = jsonObj.activities;
    else if (Array.isArray(jsonObj.auditLogs)) auditLogs = jsonObj.auditLogs;

    if (Array.isArray(jsonObj.incidents)) incidents = jsonObj.incidents;
    else if (jsonObj.activeIncidentsTriageSnapshot?.allIncidentsRoster) {
      incidents = jsonObj.activeIncidentsTriageSnapshot.allIncidentsRoster;
    }

    if (Array.isArray(jsonObj.vipGuests)) vipGuests = jsonObj.vipGuests;
    if (Array.isArray(jsonObj.vehicles)) vehicles = jsonObj.vehicles;
    if (Array.isArray(jsonObj.tasks)) tasks = jsonObj.tasks;
    if (Array.isArray(jsonObj.volunteers)) volunteers = jsonObj.volunteers;
    if (Array.isArray(jsonObj.sessions)) sessions = jsonObj.sessions;
    if (Array.isArray(jsonObj.participants)) participants = jsonObj.participants;

    const sourceTimestamp =
      jsonObj.timestamp ||
      jsonObj.metadata?.timestamp ||
      jsonObj.generatedAt ||
      new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });

    return {
      auditLogsCount: auditLogs.length,
      incidentsCount: incidents.length,
      vipGuestsCount: vipGuests.length,
      vehiclesCount: vehicles.length,
      tasksCount: tasks.length,
      volunteersCount: volunteers.length,
      sessionsCount: sessions.length,
      participantsCount: participants.length,
      sourceTimestamp,
      payload: {
        activities: auditLogs.length > 0 ? auditLogs : undefined,
        incidents: incidents.length > 0 ? incidents : undefined,
        vipGuests: vipGuests.length > 0 ? vipGuests : undefined,
        vehicles: vehicles.length > 0 ? vehicles : undefined,
        tasks: tasks.length > 0 ? tasks : undefined,
        volunteers: volunteers.length > 0 ? volunteers : undefined,
        sessions: sessions.length > 0 ? sessions : undefined,
        participants: participants.length > 0 ? participants : undefined
      }
    };
  };

  const parseCsvState = (csvText: string): ParsedSummary => {
    // Simple multi-row CSV parser: identifies audit events or incident entries
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const auditLogs: ActivityItem[] = [];
    const incidents: Incident[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check if line looks like an audit log: [Time, Category, Message]
      if (line.includes('[AUDIT]') || line.includes('ACT-') || line.toLowerCase().includes('volunteer') || line.toLowerCase().includes('mobility')) {
        const parts = line.split(',').map((p) => p.replace(/^["']|["']$/g, '').trim());
        if (parts.length >= 2) {
          auditLogs.push({
            id: 'imp-act-' + i,
            timestamp: parts[0] || '11:00 AM',
            category: (parts[1] as any) || 'system',
            message: parts.slice(2).join(', ') || parts[1]
          });
        }
      } else if (line.startsWith('INC-')) {
        const parts = line.split(',').map((p) => p.replace(/^["']|["']$/g, '').trim());
        if (parts.length >= 4) {
          incidents.push({
            id: parts[0],
            title: parts[2] || 'Imported Incident',
            type: (parts[1] as any) || 'Facility',
            location: parts[3] || 'Venue',
            priority: (parts[4] as any) || 'MEDIUM',
            status: (parts[5] as any) || 'OPEN',
            reportedAt: parts[6] || '10:00 AM',
            minutesAgo: 10,
            reporter: parts[7] || 'Imported Reporter',
            assignedTeam: parts[8] || 'Duty Team',
            affectedCount: parseInt(parts[9] || '0', 10) || 1,
            description: parts[2] || 'Imported incident from audit log',
            timeline: [{ time: parts[6] || '10:00 AM', text: 'Imported from audit archive', actor: 'Admin' }]
          });
        }
      }
    }

    return {
      auditLogsCount: auditLogs.length,
      incidentsCount: incidents.length,
      vipGuestsCount: 0,
      vehiclesCount: 0,
      tasksCount: 0,
      volunteersCount: 0,
      sessionsCount: 0,
      participantsCount: 0,
      sourceTimestamp: 'CSV Stream Ingestion',
      payload: {
        activities: auditLogs.length > 0 ? auditLogs : undefined,
        incidents: incidents.length > 0 ? incidents : undefined
      }
    };
  };

  const handleProcessRawText = (raw: string) => {
    setErrorMsg('');
    const trimmed = raw.trim();
    if (!trimmed) {
      setParsedSummary(null);
      return;
    }

    try {
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsedJson = JSON.parse(trimmed);
        const summary = parseJsonState(parsedJson);
        setParsedSummary(summary);
      } else {
        const summary = parseCsvState(trimmed);
        if (summary.auditLogsCount === 0 && summary.incidentsCount === 0) {
          setErrorMsg('CSV text could not be parsed into recognized audit log or incident entities.');
          setParsedSummary(null);
        } else {
          setParsedSummary(summary);
        }
      }
    } catch (err: any) {
      setErrorMsg(`Failed to parse file content: ${err.message || 'Invalid format'}`);
      setParsedSummary(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessRawText(content);
    };
    reader.onerror = () => {
      setErrorMsg('Error reading file from disk.');
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!parsedSummary || !parsedSummary.payload) return;

    onRestoreSystemState(parsedSummary.payload);

    if (onAddToast) {
      onAddToast(
        'System State & Audit Log Restored',
        `Successfully restored ${parsedSummary.auditLogsCount} audit logs and active system entities for post-event analysis.`,
        'success'
      );
    }

    if (onLogActivity) {
      onLogActivity(
        `Super Admin loaded operational audit state manifest (${fileName || 'raw input'})`,
        'admin'
      );
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[var(--card)] border border-[var(--line)] rounded-xl shadow-2xl overflow-hidden my-8 text-[var(--ink)] flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[var(--bg)] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center font-bold">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--ink)]">
                Import Operational Audit Log & System State
              </h2>
              <p className="text-[11px] text-[var(--mute)]">
                Ingest historical CSV or JSON operational manifests for post-event forensic analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[var(--line)] px-6 bg-[var(--bg)]/50 text-xs">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'upload'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--mute)] hover:text-[var(--ink)]'
            }`}
          >
            Upload File (.csv / .json)
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`py-2.5 px-4 font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'paste'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--mute)] hover:text-[var(--ink)]'
            }`}
          >
            Paste Raw Content
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'upload' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--line)] hover:border-[var(--primary)] rounded-xl p-8 text-center cursor-pointer transition-colors space-y-3 bg-[var(--bg)]/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] mx-auto flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-sm text-[var(--ink)]">
                  {fileName ? fileName : 'Click or drag & drop operational manifest'}
                </div>
                <div className="text-[11px] text-[var(--mute)] mt-1">
                  Supports exported JSON system snapshots or CSV audit logs
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="font-semibold text-xs text-[var(--ink)]">
                Paste JSON State Object or CSV Rows:
              </label>
              <textarea
                rows={7}
                value={pastedContent}
                onChange={(e) => {
                  setPastedContent(e.target.value);
                  handleProcessRawText(e.target.value);
                }}
                placeholder={`{\n  "activities": [\n    { "id": "ACT-1", "timestamp": "11:04 AM", "message": "...", "category": "system" }\n  ],\n  "incidents": [...]\n}`}
                className="w-full p-3 font-mono text-[11px] rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-hidden focus:border-[var(--primary)]"
              />
            </div>
          )}

          {/* Validation & Ingestion Diff Preview */}
          {parsedSummary && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Valid Manifest Detected & Ready to Restore</span>
                </span>
                <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                  Ref: {parsedSummary.sourceTimestamp}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="p-2 rounded bg-[var(--card)] border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--mute)] uppercase">Audit Events</div>
                  <div className="font-black text-sm text-[var(--ink)]">{parsedSummary.auditLogsCount}</div>
                </div>
                <div className="p-2 rounded bg-[var(--card)] border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--mute)] uppercase">Incidents</div>
                  <div className="font-black text-sm text-[var(--ink)]">{parsedSummary.incidentsCount}</div>
                </div>
                <div className="p-2 rounded bg-[var(--card)] border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--mute)] uppercase">VIP Guests</div>
                  <div className="font-black text-sm text-[var(--ink)]">{parsedSummary.vipGuestsCount}</div>
                </div>
                <div className="p-2 rounded bg-[var(--card)] border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--mute)] uppercase">Fleet / Tasks</div>
                  <div className="font-black text-sm text-[var(--ink)]">
                    {parsedSummary.vehiclesCount + parsedSummary.tasksCount}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[var(--mute)]">
                Restoring will load this historical telemetry into the live command deck, allowing complete post-event replay, incident scrutiny, and timeline reconstruction.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[var(--bg)] border-t border-[var(--line)] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-md border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)]/50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmRestore}
            disabled={!parsedSummary}
            className={`px-5 py-2 text-xs font-bold rounded-md flex items-center gap-2 cursor-pointer transition-all shadow-xs ${
              parsedSummary
                ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Apply & Restore System State</span>
          </button>
        </div>
      </div>
    </div>
  );
};
