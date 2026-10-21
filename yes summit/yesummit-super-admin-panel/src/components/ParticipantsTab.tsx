import React, { useState } from 'react';
import {
  UserCheck,
  Search,
  Filter,
  Phone,
  CheckSquare,
  QrCode,
  Utensils,
  Bus,
  Hotel,
  X,
  Send,
  CheckCircle2,
  Upload,
  UserPlus,
  Shield,
  Users
} from 'lucide-react';
import { Participant, Task, Volunteer } from '../types';

interface ParticipantsTabProps {
  participants: Participant[];
  volunteers?: Volunteer[];
  onOpenCreateTaskForParticipant: (part: Participant) => void;
  searchQuery: string;
  onOpenImportModal?: () => void;
  onAssignVolunteerToParticipant?: (participantId: string, volunteerId: string) => void;
}

export const ParticipantsTab: React.FC<ParticipantsTabProps> = ({
  participants,
  volunteers = [],
  onOpenCreateTaskForParticipant,
  searchQuery,
  onOpenImportModal,
  onAssignVolunteerToParticipant
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [volunteerFilter, setVolunteerFilter] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [contactParticipant, setContactParticipant] = useState<Participant | null>(null);
  const [reassigningParticipant, setReassigningParticipant] = useState<Participant | null>(null);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>('');
  const [contactMsg, setContactMsg] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);

  const query = (localSearch || searchQuery).toLowerCase();

  const filteredParticipants = participants.filter((p) => {
    if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
    if (volunteerFilter === 'UNASSIGNED') {
      if (p.responsibleVolunteerId) return false;
    } else if (volunteerFilter !== 'ALL') {
      if (p.responsibleVolunteerId !== volunteerFilter) return false;
    }

    if (query) {
      const match =
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        p.qrId.toLowerCase().includes(query) ||
        p.phone.toLowerCase().includes(query) ||
        p.hotel.toLowerCase().includes(query) ||
        (p.responsibleVolunteerName && p.responsibleVolunteerName.toLowerCase().includes(query)) ||
        (p.responsibleVolunteerId && p.responsibleVolunteerId.toLowerCase().includes(query));
      if (!match) return false;
    }
    return true;
  });

  const handleSendContact = (e: React.FormEvent) => {
    e.preventDefault();
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      setContactParticipant(null);
      setContactMsg('');
    }, 1200);
  };

  const handleConfirmReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (reassigningParticipant && selectedVolunteerId && onAssignVolunteerToParticipant) {
      onAssignVolunteerToParticipant(reassigningParticipant.id, selectedVolunteerId);
    }
    setReassigningParticipant(null);
    setSelectedVolunteerId('');
  };

  const coveredCount = participants.filter((p) => !!p.responsibleVolunteerId).length;

  return (
    <div className="space-y-6">
      {/* Participant & Volunteer Responsibility Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">Checked In</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 mt-1">
            2,840
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">91.6% of 3,100 total</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--mute)] font-medium">
            <span>Volunteer Responsible Liaison</span>
            <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-[var(--primary)] mt-1">
            {coveredCount} / {participants.length}
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">
            Registered attendees under assigned volunteer care
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">VIPs & Ministers</div>
          <div className="text-2xl font-bold tabular-nums text-purple-600 mt-1">
            48
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">Dedicated protocol volunteer liaisons</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">Breakfast Scans</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--ink)] mt-1">
            2,410
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">Lunch open from 12:00 PM</div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-lg border border-[var(--line)]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-1">
            {['ALL', 'VIP', 'Delegate', 'Speaker', 'Media', 'Organizer'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-[var(--primary)] text-white font-bold'
                    : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                {cat === 'ALL' ? 'All Attendees' : cat}
              </button>
            ))}
          </div>

          {/* Volunteer Filter Selector */}
          {volunteers.length > 0 && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--line)]">
              <span className="text-[11px] text-[var(--mute)] font-semibold whitespace-nowrap">Volunteer:</span>
              <select
                value={volunteerFilter}
                onChange={(e) => setVolunteerFilter(e.target.value)}
                className="py-1 px-2 text-xs rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-medium cursor-pointer"
              >
                <option value="ALL">All Volunteers (Any Officer)</option>
                <option value="UNASSIGNED">Unassigned Only (Needs Liaison)</option>
                {volunteers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id}: {v.name} ({v.zone})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenImportModal && (
            <button
              type="button"
              onClick={onOpenImportModal}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[var(--primary)]/30 hover:border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
          )}

          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
            <input
              type="text"
              placeholder="Search attendee or volunteer..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>
      </div>

      {/* Participants Table */}
      <div className="rounded-lg bg-[var(--card)] border border-[var(--line)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--mute)] font-semibold">
                <th className="py-2.5 px-3">Participant Name</th>
                <th className="py-2.5 px-3">ID / QR</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Responsible Volunteer Liaison</th>
                <th className="py-2.5 px-3">Hotel & Transport</th>
                <th className="py-2.5 px-3">Meals Today</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredParticipants.map((part) => (
                <tr key={part.id} className="hover:bg-[var(--bg)] transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-[var(--ink)]">{part.name}</div>
                    <div className="text-[11px] text-[var(--mute)] font-mono">{part.email} · {part.phone}</div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="font-mono font-semibold text-[var(--primary)]">{part.id}</div>
                    <div className="text-[10px] text-[var(--mute)] font-mono flex items-center gap-1">
                      <QrCode className="w-3 h-3" />
                      <span>{part.qrId}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        part.category === 'VIP'
                          ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400'
                          : part.category === 'Speaker'
                          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                          : 'bg-slate-500/10 text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {part.category}
                    </span>
                  </td>

                  {/* Responsible Volunteer Column */}
                  <td className="py-2.5 px-3">
                    {part.responsibleVolunteerId ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {part.responsibleVolunteerName?.charAt(0) || 'V'}
                        </div>
                        <div>
                          <div className="font-bold text-[var(--ink)] flex items-center gap-1">
                            <span>{part.responsibleVolunteerName}</span>
                            <span className="text-[10px] font-mono text-[var(--primary)] font-normal">
                              ({part.responsibleVolunteerId})
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--mute)] font-mono">
                            {part.responsibleVolunteerPhone}
                          </div>
                        </div>
                        {onAssignVolunteerToParticipant && (
                          <button
                            onClick={() => {
                              setReassigningParticipant(part);
                              setSelectedVolunteerId(part.responsibleVolunteerId || '');
                            }}
                            className="p-1 rounded text-[var(--mute)] hover:text-[var(--primary)] hover:bg-[var(--line)]/50 cursor-pointer ml-1"
                            title="Reassign Responsible Volunteer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--mute)] italic bg-[var(--line)]/40 px-2 py-0.5 rounded">
                          Unassigned
                        </span>
                        {onAssignVolunteerToParticipant && (
                          <button
                            onClick={() => {
                              setReassigningParticipant(part);
                              setSelectedVolunteerId(volunteers[0]?.id || '');
                            }}
                            className="text-[10px] font-bold text-[var(--primary)] hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>Assign</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="text-[var(--ink)] font-medium flex items-center gap-1">
                      <Hotel className="w-3 h-3 text-[var(--mute)] shrink-0" />
                      <span className="truncate max-w-[140px]">{part.hotel}</span>
                    </div>
                    <div className="text-[11px] text-[var(--mute)] flex items-center gap-1 mt-0.5">
                      <Bus className="w-3 h-3 text-[var(--mute)] shrink-0" />
                      <span className="truncate max-w-[140px]">{part.transportAllocation}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className={part.mealsToday.breakfast ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                        B: {part.mealsToday.breakfast ? '✓' : '—'}
                      </span>
                      <span>·</span>
                      <span className={part.mealsToday.lunch ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                        L: {part.mealsToday.lunch ? '✓' : '—'}
                      </span>
                      <span>·</span>
                      <span className={part.mealsToday.dinner ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                        D: {part.mealsToday.dinner ? '✓' : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        part.eventStatus === 'Checked In' || part.eventStatus === 'In Session'
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      <span>●</span>
                      <span>{part.eventStatus}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setContactParticipant(part)}
                        className="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                        title="Direct Contact"
                      >
                        <Phone className="w-3 h-3 text-[var(--primary)]" />
                        <span>Contact</span>
                      </button>

                      <button
                        onClick={() => onOpenCreateTaskForParticipant(part)}
                        className="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                        title="Create Task"
                      >
                        <CheckSquare className="w-3 h-3 text-blue-600" />
                        <span>Create Task</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct Contact Modal */}
      {contactParticipant && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="font-bold text-[var(--ink)] text-sm">
                  Contact {contactParticipant.name}
                </h3>
                <p className="text-[var(--mute)] text-[11px]">
                  {contactParticipant.category} · {contactParticipant.id}
                </p>
              </div>
              <button
                onClick={() => setContactParticipant(null)}
                className="text-[var(--mute)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {contactParticipant.responsibleVolunteerName && (
              <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[11px]">
                <span className="text-[var(--mute)] block">Responsible Volunteer Liaison:</span>
                <span className="font-bold text-[var(--ink)]">
                  {contactParticipant.responsibleVolunteerName} ({contactParticipant.responsibleVolunteerId})
                </span>
                <span className="font-mono text-[var(--mute)] ml-1">· {contactParticipant.responsibleVolunteerPhone}</span>
              </div>
            )}

            <form onSubmit={handleSendContact} className="space-y-3">
              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">
                  Recipient Phone / Mobile
                </label>
                <input
                  type="text"
                  readOnly
                  value={contactParticipant.phone}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-mono"
                />
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">
                  Message via Operational SMS Relay
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter direct notification or liaison instruction..."
                  value={contactMsg}
                  onChange={(e) => setContactMsg(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setContactParticipant(null)}
                  className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sentSuccess}
                  className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {sentSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Sent!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Dispatch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Responsible Volunteer Modal */}
      {reassigningParticipant && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="font-bold text-[var(--ink)] text-sm">
                  Assign Responsible Volunteer
                </h3>
                <p className="text-[var(--mute)] text-[11px]">
                  Attendee: {reassigningParticipant.name} ({reassigningParticipant.id} · {reassigningParticipant.category})
                </p>
              </div>
              <button
                onClick={() => setReassigningParticipant(null)}
                className="text-[var(--mute)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReassign} className="space-y-3">
              <p className="text-[var(--mute)]">
                Select the volunteer who will be primarily responsible for this registered attendee's logistics, check-in, and stage coordination:
              </p>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">
                  Responsible Volunteer Officer:
                </label>
                <select
                  value={selectedVolunteerId}
                  onChange={(e) => setSelectedVolunteerId(e.target.value)}
                  className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  <option value="">-- Choose Volunteer --</option>
                  {volunteers.map((vol) => (
                    <option key={vol.id} value={vol.id}>
                      {vol.id}: {vol.name} — {vol.role} ({vol.zone})
                    </option>
                  ))}
                </select>
              </div>

              {selectedVolunteerId && (
                <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
                  {(() => {
                    const found = volunteers.find((v) => v.id === selectedVolunteerId);
                    if (!found) return null;
                    return (
                      <>
                        <div className="font-bold text-[var(--ink)]">{found.name} ({found.id})</div>
                        <div className="text-[11px] text-[var(--mute)]">
                          Role: {found.role} · Zone: {found.zone} · Status: {found.status}
                        </div>
                        <div className="text-[11px] text-[var(--primary)] font-mono">
                          Mobile: {found.phone}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setReassigningParticipant(null)}
                  className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedVolunteerId}
                  className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
