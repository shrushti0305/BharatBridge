import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Search,
  Filter,
  Plus,
  Send,
  ArrowUpRight,
  UserCheck,
  X,
  MapPin,
  Users
} from 'lucide-react';
import { Incident, Priority } from '../types';

interface IncidentsTabProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (inc: Incident | null) => void;
  onUpdateIncidentStatus: (id: string, newStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => void;
  onAssignTeam: (id: string, teamName: string) => void;
  onEscalateIncident: (id: string) => void;
  onSendAlert: (inc: Incident) => void;
  onCreateIncident: (newInc: Omit<Incident, 'id' | 'reportedAt' | 'minutesAgo' | 'timeline'>) => void;
  searchQuery: string;
}

export const IncidentsTab: React.FC<IncidentsTabProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  onUpdateIncidentStatus,
  onAssignTeam,
  onEscalateIncident,
  onSendAlert,
  onCreateIncident,
  searchQuery
}) => {
  const [filterState, setFilterState] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'HIGH'>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [teamSelection, setTeamSelection] = useState('Safety & First Aid Rapid Response Team 1');

  // Form state for creating incident
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<Incident['type']>('Technical / AV');
  const [newLocation, setNewLocation] = useState('Main Hall Stage');
  const [newPriority, setNewPriority] = useState<Priority>('HIGH');
  const [newReporter, setNewReporter] = useState('VOL-105 (Stage Runner)');
  const [newDesc, setNewDesc] = useState('');
  const [newAffected, setNewAffected] = useState(50);

  // Filter calculations
  const openCount = incidents.filter((i) => i.status !== 'RESOLVED').length;
  const highPriorityCount = incidents.filter((i) => i.priority === 'HIGH' && i.status !== 'RESOLVED').length;
  const resolvedTodayCount = incidents.filter((i) => i.status === 'RESOLVED').length + 20;

  const query = (localSearch || searchQuery).toLowerCase();

  const filteredIncidents = incidents.filter((inc) => {
    if (filterState === 'OPEN' && inc.status === 'RESOLVED') return false;
    if (filterState === 'IN_PROGRESS' && inc.status !== 'IN_PROGRESS') return false;
    if (filterState === 'RESOLVED' && inc.status !== 'RESOLVED') return false;
    if (filterState === 'HIGH' && inc.priority !== 'HIGH') return false;

    if (query) {
      const match =
        inc.id.toLowerCase().includes(query) ||
        inc.title.toLowerCase().includes(query) ||
        inc.location.toLowerCase().includes(query) ||
        inc.reporter.toLowerCase().includes(query) ||
        inc.type.toLowerCase().includes(query);
      if (!match) return false;
    }

    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onCreateIncident({
      title: newTitle.trim(),
      type: newType,
      location: newLocation,
      priority: newPriority,
      status: 'OPEN',
      reporter: newReporter,
      assignedTeam: 'Unassigned',
      affectedCount: Number(newAffected) || 0,
      description: newDesc || 'Incident logged via Operations Command Center interface.'
    });

    setNewTitle('');
    setNewDesc('');
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--mute)] font-medium">Open Incidents</div>
            <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400 mt-1">
              {openCount}
            </div>
            <div className="text-[11px] text-[var(--mute)] mt-0.5">Active triage underway</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--mute)] font-medium">High Priority Action</div>
            <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
              {highPriorityCount}
            </div>
            <div className="text-[11px] text-[var(--mute)] mt-0.5">SLA response &lt; 5 minutes</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--mute)] font-medium">Resolved Today</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
              {resolvedTodayCount}
            </div>
            <div className="text-[11px] text-[var(--mute)] mt-0.5">Mean resolution 14m</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-lg border border-[var(--line)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'ALL', label: 'All Incidents' },
              { key: 'OPEN', label: 'Open' },
              { key: 'IN_PROGRESS', label: 'In Progress' },
              { key: 'HIGH', label: 'High Priority ▲' },
              { key: 'RESOLVED', label: 'Resolved' }
            ] as const
          ).map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilterState(chip.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterState === chip.key
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
            <input
              type="text"
              placeholder="Filter by ID, zone, type..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Report Incident</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Table + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table View (7 or 8 columns if detail panel open) */}
        <div className={selectedIncident ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="rounded-lg bg-[var(--card)] border border-[var(--line)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--mute)] font-semibold">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Title & Location</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Reported</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {filteredIncidents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[var(--mute)]">
                        No incidents match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredIncidents.map((inc) => {
                      const isSelected = selectedIncident?.id === inc.id;
                      return (
                        <tr
                          key={inc.id}
                          onClick={() => onSelectIncident(inc)}
                          className={`hover:bg-[var(--bg)] transition-colors cursor-pointer ${
                            isSelected ? 'bg-teal-500/10 dark:bg-teal-900/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-semibold text-[var(--primary)] whitespace-nowrap">
                            {inc.id}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[var(--mute)]">
                            {inc.type}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[var(--ink)] line-clamp-1">
                              {inc.title}
                            </div>
                            <div className="text-[11px] text-[var(--mute)] flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>{inc.location}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {inc.priority === 'HIGH' ? (
                              <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                                <span>▲</span>
                                <span>HIGH</span>
                              </span>
                            ) : inc.priority === 'MEDIUM' ? (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                                <span>■</span>
                                <span>MED</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <span>●</span>
                                <span>LOW</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {inc.status === 'RESOLVED' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Resolved</span>
                              </span>
                            ) : inc.status === 'IN_PROGRESS' ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                                <Clock className="w-3.5 h-3.5" />
                                <span>In Progress</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Open</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums text-[var(--mute)]">
                            {inc.reportedAt}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectIncident(inc);
                              }}
                              className="text-xs text-[var(--primary)] font-medium hover:underline cursor-pointer"
                            >
                              Inspect →
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
        </div>

        {/* Incident Detail Panel */}
        {selectedIncident && (
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-sm space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[var(--line)] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[var(--primary)]">
                      {selectedIncident.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        selectedIncident.priority === 'HIGH'
                          ? 'bg-red-500 text-white'
                          : selectedIncident.priority === 'MEDIUM'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-500 text-white'
                      }`}
                    >
                      {selectedIncident.priority} PRIORITY
                    </span>
                    {selectedIncident.escalatedToLead && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white">
                        ESCALATED TO LEAD
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-[var(--ink)] mt-1.5">
                    {selectedIncident.title}
                  </h3>
                </div>
                <button
                  onClick={() => onSelectIncident(null)}
                  className="p-1 rounded text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--bg)]"
                  title="Close Detail"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Meta information */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Location</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedIncident.location}</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Reporter</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedIncident.reporter}</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Assigned Team</span>
                  <span className="font-semibold text-[var(--primary)]">{selectedIncident.assignedTeam}</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Affected</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedIncident.affectedCount} people</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <span className="text-[11px] font-semibold text-[var(--mute)] uppercase block mb-1">
                  Incident Description
                </span>
                <p className="text-xs text-[var(--ink)] p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] leading-relaxed">
                  {selectedIncident.description}
                </p>
              </div>

              {/* Timeline Audit Log */}
              <div>
                <span className="text-[11px] font-semibold text-[var(--mute)] uppercase block mb-2">
                  Action Audit Timeline
                </span>
                <div className="space-y-2 border-l-2 border-[var(--line)] pl-3 ml-1 text-xs">
                  {selectedIncident.timeline.map((step, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-[var(--primary)]" />
                      <div className="flex items-center justify-between text-[11px] text-[var(--mute)]">
                        <span className="font-mono tabular-nums font-semibold">{step.time}</span>
                        <span className="font-medium text-[var(--ink)]">{step.actor}</span>
                      </div>
                      <p className="text-xs text-[var(--ink)] mt-0.5">{step.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Action Buttons - Really Updates State! */}
              <div className="pt-2 border-t border-[var(--line)] grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="px-3 py-2 text-xs font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Assign Team</span>
                </button>

                <button
                  onClick={() => onEscalateIncident(selectedIncident.id)}
                  disabled={selectedIncident.escalatedToLead}
                  className="px-3 py-2 text-xs font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-purple-500 text-[var(--ink)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-purple-600" />
                  <span>{selectedIncident.escalatedToLead ? 'Escalated' : 'Escalate to Lead'}</span>
                </button>

                <button
                  onClick={() => onSendAlert(selectedIncident)}
                  className="px-3 py-2 text-xs font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-amber-500 text-[var(--ink)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-amber-600" />
                  <span>Send Alert</span>
                </button>

                {selectedIncident.status !== 'RESOLVED' ? (
                  <button
                    onClick={() => onUpdateIncidentStatus(selectedIncident.id, 'RESOLVED')}
                    className="px-3 py-2 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Resolved</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onUpdateIncidentStatus(selectedIncident.id, 'OPEN')}
                    className="px-3 py-2 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Reopen Incident</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assign Team Modal */}
      {showAssignModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--ink)]">
                Assign Team to {selectedIncident.id}
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-[var(--mute)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[var(--mute)]">
                Select an operational response squad to take ownership of this incident:
              </p>
              <select
                value={teamSelection}
                onChange={(e) => setTeamSelection(e.target.value)}
                className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] text-xs font-medium"
              >
                <option value="Safety & First Aid Rapid Response Team 1">Safety & First Aid Rapid Response Team 1</option>
                <option value="Mobility Fleet Relief Team">Mobility Fleet Relief Team</option>
                <option value="AV Technical Core Squad">AV Technical Core Squad</option>
                <option value="Venue Facility Maintenance Team 3">Venue Facility Maintenance Team 3</option>
                <option value="Security Perimeter Patrol Alpha">Security Perimeter Patrol Alpha</option>
                <option value="VIP Protocol Liaison Unit">VIP Protocol Liaison Unit</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-3 py-1.5 text-xs rounded border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onAssignTeam(selectedIncident.id, teamSelection);
                  setShowAssignModal(false);
                }}
                className="px-3 py-1.5 text-xs rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-[var(--card)] rounded-lg max-w-lg w-full border border-[var(--line)] p-5 space-y-4 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span>Log New Operations Incident</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
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
                  placeholder="e.g. AC cooling unit leak near Hall A entrance"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as Incident['type'])}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    <option value="Technical / AV">Technical / AV</option>
                    <option value="Medical">Medical</option>
                    <option value="Mobility">Mobility</option>
                    <option value="Crowd / Security">Crowd / Security</option>
                    <option value="Facility">Facility</option>
                    <option value="Catering">Catering</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Priority)}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    <option value="HIGH">HIGH (Immediate Action ▲)</option>
                    <option value="MEDIUM">MEDIUM (Action &lt; 30m ■)</option>
                    <option value="LOW">LOW (Monitor ●)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Location / Zone</label>
                  <input
                    type="text"
                    required
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  />
                </div>

                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Affected Headcount</label>
                  <input
                    type="number"
                    min="0"
                    value={newAffected}
                    onChange={(e) => setNewAffected(parseInt(e.target.value) || 0)}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Reporter</label>
                <input
                  type="text"
                  required
                  value={newReporter}
                  onChange={(e) => setNewReporter(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Description & Initial Findings</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detail exact observations, immediate hazards, and any preliminary actions taken..."
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold shadow-xs"
              >
                Dispatch & Log Incident
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
