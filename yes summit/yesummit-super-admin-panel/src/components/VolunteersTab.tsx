import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  MapPin,
  CheckCircle2,
  Clock,
  UserCheck,
  RotateCcw,
  UserX,
  Phone,
  X,
  CheckSquare,
  UserPlus,
  Trash2,
  Crown,
  Hotel
} from 'lucide-react';
import { Volunteer, Task, Participant } from '../types';

interface VolunteersTabProps {
  volunteers: Volunteer[];
  participants?: Participant[];
  openTasks: Task[];
  selectedVolunteer: Volunteer | null;
  onSelectVolunteer: (vol: Volunteer | null) => void;
  onAssignTaskToVolunteer: (volId: string, taskTitle: string) => void;
  onMoveVolunteerZone: (volId: string, newZone: string) => void;
  onRequestReplacement: (volId: string) => void;
  searchQuery: string;
  onAssignParticipantToVolunteer?: (volunteerId: string, participantId: string) => void;
  onRemoveParticipantFromVolunteer?: (volunteerId: string, participantId: string) => void;
}

export const VolunteersTab: React.FC<VolunteersTabProps> = ({
  volunteers,
  participants = [],
  openTasks,
  selectedVolunteer,
  onSelectVolunteer,
  onAssignTaskToVolunteer,
  onMoveVolunteerZone,
  onRequestReplacement,
  searchQuery,
  onAssignParticipantToVolunteer,
  onRemoveParticipantFromVolunteer
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'ASSIGNED' | 'BUSY' | 'OFFLINE'>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const [showMoveZoneModal, setShowMoveZoneModal] = useState(false);
  const [showAssignAttendeeModal, setShowAssignAttendeeModal] = useState(false);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState('');
  const [selectedZone, setSelectedZone] = useState('Main Hall');
  const [selectedParticipantToAssign, setSelectedParticipantToAssign] = useState('');

  const zones = [
    'Main Hall',
    'Hall A',
    'Hall B',
    'Exhibition',
    'Registration',
    'Food Court',
    'Medical',
    'Help Desk',
    'VIP',
    'Entry/Exit'
  ];

  const query = (localSearch || searchQuery).toLowerCase();

  const filteredVolunteers = volunteers.filter((vol) => {
    if (statusFilter !== 'ALL' && vol.status !== statusFilter) return false;
    if (query) {
      const match =
        vol.id.toLowerCase().includes(query) ||
        vol.name.toLowerCase().includes(query) ||
        vol.zone.toLowerCase().includes(query) ||
        vol.role.toLowerCase().includes(query) ||
        vol.currentTask.toLowerCase().includes(query) ||
        (vol.assignedCohort && vol.assignedCohort.toLowerCase().includes(query));
      if (!match) return false;
    }
    return true;
  });

  // Get participants assigned to a volunteer
  const getAssignedParticipants = (vol: Volunteer) => {
    return participants.filter(
      (p) => p.responsibleVolunteerId === vol.id || (vol.assignedParticipantIds && vol.assignedParticipantIds.includes(p.id))
    );
  };

  const handleConfirmAssignAttendee = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVolunteer && selectedParticipantToAssign && onAssignParticipantToVolunteer) {
      onAssignParticipantToVolunteer(selectedVolunteer.id, selectedParticipantToAssign);
    }
    setShowAssignAttendeeModal(false);
    setSelectedParticipantToAssign('');
  };

  return (
    <div className="space-y-6">
      {/* Workforce Metric Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">Active On-Duty</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 mt-1">
            186 <span className="text-xs font-normal text-[var(--mute)]">volunteers</span>
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">Checked in & deployed</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">Available (Floating)</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--primary)] mt-1">
            12
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">Ready for rapid dispatch</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">Not Checked In</div>
          <div className="text-2xl font-bold tabular-nums text-slate-500 mt-1">
            14
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">Shift starts 12:00 PM</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">User Responsibility Coverage</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--ink)] mt-1">
            {participants.filter((p) => !!p.responsibleVolunteerId).length} / {participants.length}
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">Attendees linked to dedicated liaisons</div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-lg border border-[var(--line)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'AVAILABLE', 'ASSIGNED', 'BUSY', 'OFFLINE'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-[var(--primary)] text-white font-bold'
                  : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              {st === 'ALL' ? 'All Volunteers' : st}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
          <input
            type="text"
            placeholder="Search volunteers, roles, zones, cohorts..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>

      {/* Main Grid: Volunteers List + Profile Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Volunteer Cards Grid */}
        <div className={selectedVolunteer ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredVolunteers.map((vol) => {
              const isSelected = selectedVolunteer?.id === vol.id;
              const assignedUsers = getAssignedParticipants(vol);
              const statusBadge = {
                AVAILABLE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                ASSIGNED: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
                BUSY: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
                OFFLINE: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20'
              }[vol.status];

              return (
                <div
                  key={vol.id}
                  onClick={() => onSelectVolunteer(vol)}
                  className={`p-3.5 rounded-lg bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-xs space-y-2.5 ${
                    isSelected ? 'ring-2 ring-[var(--primary)]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] font-bold text-xs flex items-center justify-center">
                        {vol.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[var(--ink)]">{vol.name}</h4>
                        <div className="text-[11px] font-mono text-[var(--primary)]">{vol.id} · {vol.role}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusBadge}`}>
                      {vol.status === 'AVAILABLE' ? '● AVAILABLE' : vol.status === 'BUSY' ? '■ BUSY' : vol.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-[var(--mute)]">
                    <div className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Zone: {vol.zone}</span>
                    </div>
                    <div className="text-[11px] line-clamp-1">
                      Task: <strong className="text-[var(--ink)] font-normal">{vol.currentTask}</strong>
                    </div>

                    {/* Responsible Cohort / Registered Users Pill */}
                    <div className="pt-1 flex items-center justify-between">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-semibold border border-[var(--primary)]/20">
                        <Users className="w-3 h-3" />
                        <span>
                          {assignedUsers.length > 0
                            ? `Responsible for ${assignedUsers.length} Attendee${assignedUsers.length > 1 ? 's' : ''}`
                            : 'General Support (No direct cohort)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-[11px] text-[var(--mute)]">
                    <span className="font-mono tabular-nums">In: {vol.checkInTime}</span>
                    <span className="text-[var(--primary)] font-semibold hover:underline">
                      View Profile & Cohort →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Profile Drawer */}
        {selectedVolunteer && (
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-sm space-y-4 text-xs">
              <div className="flex items-start justify-between border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white font-bold text-sm flex items-center justify-center">
                    {selectedVolunteer.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--ink)] text-sm">{selectedVolunteer.name}</h3>
                    <p className="text-[var(--primary)] font-mono text-xs">{selectedVolunteer.id} · {selectedVolunteer.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => onSelectVolunteer(null)}
                  className="p-1 rounded text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Assigned Zone</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedVolunteer.zone}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Check-in Time</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedVolunteer.checkInTime}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Status</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedVolunteer.status}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Mobile Contact</span>
                  <span className="font-semibold font-mono text-[var(--ink)]">{selectedVolunteer.phone}</span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
                <div className="text-[10px] text-[var(--mute)] uppercase font-semibold">Current Active Assignment</div>
                <div className="font-medium text-[var(--ink)]">{selectedVolunteer.currentTask}</div>
                <div className="text-[10px] text-[var(--mute)] font-mono">
                  Map coordinates: {selectedVolunteer.x.toFixed(1)}, {selectedVolunteer.y.toFixed(1)} (Clamped to {selectedVolunteer.zone})
                </div>
              </div>

              {/* Responsible Registered Users Section */}
              <div className="p-3 rounded-lg bg-[var(--card)] border border-[var(--primary)]/30 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--ink)] text-xs">
                    <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Responsible For Registered Attendees</span>
                    <span className="px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] text-[10px]">
                      {getAssignedParticipants(selectedVolunteer).length} Users
                    </span>
                  </div>

                  {onAssignParticipantToVolunteer && (
                    <button
                      onClick={() => setShowAssignAttendeeModal(true)}
                      className="px-2 py-1 rounded bg-[var(--primary)] text-white text-[10px] font-bold flex items-center gap-1 hover:bg-[var(--primary-hover)] cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ Assign Attendee</span>
                    </button>
                  )}
                </div>

                {selectedVolunteer.assignedCohort && (
                  <div className="text-[11px] text-[var(--mute)]">
                    Cohort: <strong className="text-[var(--ink)]">{selectedVolunteer.assignedCohort}</strong>
                  </div>
                )}

                {/* List of Attendees Assigned */}
                {(() => {
                  const assignedList = getAssignedParticipants(selectedVolunteer);
                  if (assignedList.length === 0) {
                    return (
                      <div className="p-3 text-center text-[11px] text-[var(--mute)] bg-[var(--bg)] rounded">
                        No registered attendees assigned yet. Click <strong>+ Assign Attendee</strong> to designate users this volunteer is responsible for.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {assignedList.map((part) => (
                        <div
                          key={part.id}
                          className="p-2 rounded bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-bold text-[var(--ink)] text-[11px] truncate">
                              <span>{part.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-purple-500/10 text-purple-700">
                                {part.category}
                              </span>
                            </div>
                            <div className="text-[10px] text-[var(--mute)] flex items-center gap-2 mt-0.5">
                              <span>ID: {part.id}</span>
                              <span>·</span>
                              <span>Hotel: {part.hotel}</span>
                              <span>·</span>
                              <span className="text-emerald-600 font-semibold">{part.eventStatus}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={`tel:${part.phone}`}
                              className="p-1 rounded text-[var(--mute)] hover:text-[var(--primary)] hover:bg-[var(--line)]/40"
                              title={`Call ${part.name}`}
                            >
                              <Phone className="w-3 h-3 text-[var(--primary)]" />
                            </a>

                            {onRemoveParticipantFromVolunteer && (
                              <button
                                onClick={() => onRemoveParticipantFromVolunteer(selectedVolunteer.id, part.id)}
                                className="p-1 rounded text-[var(--mute)] hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                                title="Remove attendee from this volunteer's responsibility"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Actions: Assign Task, Move Zone, Request Replacement */}
              <div className="pt-2 border-t border-[var(--line)] space-y-2">
                <div className="text-[11px] font-semibold text-[var(--mute)] uppercase">
                  Volunteer Operations
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setShowAssignTaskModal(true)}
                    className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                    <span>Assign Task</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedZone(selectedVolunteer.zone);
                      setShowMoveZoneModal(true);
                    }}
                    className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-blue-600" />
                    <span>Move Zone</span>
                  </button>

                  <button
                    onClick={() => onRequestReplacement(selectedVolunteer.id)}
                    className="p-2.5 rounded bg-[var(--bg)] border border-amber-500/30 hover:border-amber-500 text-amber-700 dark:text-amber-400 font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <UserX className="w-4 h-4 text-amber-600" />
                    <span>Request Sub</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assign Task Modal */}
      {showAssignTaskModal && selectedVolunteer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="font-bold text-[var(--ink)] text-sm">
                Assign Task to {selectedVolunteer.name} ({selectedVolunteer.id})
              </h3>
              <button onClick={() => setShowAssignTaskModal(false)} className="text-[var(--mute)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[var(--mute)]">
                Select from open operational tasks or specify an ad-hoc mandate:
              </p>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Open Tasks</label>
                <select
                  value={selectedTaskTitle}
                  onChange={(e) => setSelectedTaskTitle(e.target.value)}
                  className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  <option value="">-- Choose an open task --</option>
                  {openTasks.map((t) => (
                    <option key={t.id} value={`${t.title} (${t.id})`}>
                      [{t.priority}] {t.id}: {t.title} - {t.location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Or Custom Task Directive</label>
                <input
                  type="text"
                  placeholder="e.g. Assist VIP delegation escort to Plenary Stage"
                  value={selectedTaskTitle}
                  onChange={(e) => setSelectedTaskTitle(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setShowAssignTaskModal(false)}
                  className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedTaskTitle.trim()) {
                      onAssignTaskToVolunteer(selectedVolunteer.id, selectedTaskTitle.trim());
                      setShowAssignTaskModal(false);
                      setSelectedTaskTitle('');
                    }
                  }}
                  disabled={!selectedTaskTitle.trim()}
                  className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Task Assignment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Zone Modal */}
      {showMoveZoneModal && selectedVolunteer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="font-bold text-[var(--ink)] text-sm">
                Move Zone for {selectedVolunteer.name} ({selectedVolunteer.id})
              </h3>
              <button onClick={() => setShowMoveZoneModal(false)} className="text-[var(--mute)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[var(--mute)]">
                Current zone: <strong>{selectedVolunteer.zone}</strong>. Moving the volunteer updates their geo-fence bounds and floor plan marker instantly:
              </p>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Target Zone</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setShowMoveZoneModal(false)}
                  className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMoveVolunteerZone(selectedVolunteer.id, selectedZone);
                    setShowMoveZoneModal(false);
                  }}
                  className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirm Zone Relocation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Registered Attendee Modal */}
      {showAssignAttendeeModal && selectedVolunteer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="font-bold text-[var(--ink)] text-sm">
                  Assign Registered Attendee to {selectedVolunteer.name}
                </h3>
                <p className="text-[var(--mute)] text-[11px]">
                  Volunteer ID: {selectedVolunteer.id} · Zone: {selectedVolunteer.zone}
                </p>
              </div>
              <button onClick={() => setShowAssignAttendeeModal(false)} className="text-[var(--mute)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssignAttendee} className="space-y-3">
              <p className="text-[var(--mute)]">
                Select a registered attendee from the system roster. {selectedVolunteer.name} will be designated as their responsible operational liaison.
              </p>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">
                  Select Registered Attendee:
                </label>
                <select
                  value={selectedParticipantToAssign}
                  onChange={(e) => setSelectedParticipantToAssign(e.target.value)}
                  className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  <option value="">-- Choose Attendee --</option>
                  {participants.map((p) => {
                    const isAlreadyAssignedToThis = p.responsibleVolunteerId === selectedVolunteer.id;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id} · {p.category}) {isAlreadyAssignedToThis ? '— [Already Assigned]' : p.responsibleVolunteerName ? `— [Currently under ${p.responsibleVolunteerName}]` : '— [Unassigned]'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedParticipantToAssign && (
                <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
                  {(() => {
                    const found = participants.find((p) => p.id === selectedParticipantToAssign);
                    if (!found) return null;
                    return (
                      <>
                        <div className="font-bold text-[var(--ink)]">{found.name} ({found.id})</div>
                        <div className="text-[11px] text-[var(--mute)]">
                          Category: {found.category} · Hotel: {found.hotel} · Status: {found.eventStatus}
                        </div>
                        <div className="text-[11px] text-[var(--mute)]">
                          Current Liaison: <strong>{found.responsibleVolunteerName || 'None (Unassigned)'}</strong>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setShowAssignAttendeeModal(false)}
                  className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedParticipantToAssign}
                  className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Assign Responsibility</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
