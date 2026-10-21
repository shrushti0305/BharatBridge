import React, { useState } from 'react';
import {
  Presentation,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Volume2,
  Languages,
  Video,
  Users,
  Wrench,
  Search
} from 'lucide-react';
import { Session } from '../types';

interface SessionsTabProps {
  sessions: Session[];
  onResolveSessionAlert: (sessionId: string) => void;
  onRequestAVSupport: (sessionId: string, issue: string) => void;
}

export const SessionsTab: React.FC<SessionsTabProps> = ({
  sessions,
  onResolveSessionAlert,
  onRequestAVSupport
}) => {
  const [filterState, setFilterState] = useState<'ALL' | 'LIVE' | 'STARTING_SOON' | 'ACTION_REQUIRED'>('ALL');
  const [search, setSearch] = useState('');

  const liveCount = sessions.filter((s) => s.status === 'LIVE').length;
  const startingSoonCount = sessions.filter((s) => s.status === 'STARTING_SOON').length;
  const actionRequiredCount = sessions.filter(
    (s) => s.avStatus === 'ACTION REQUIRED' || s.translationStatus === 'ACTION REQUIRED'
  ).length;

  const filteredSessions = sessions.filter((s) => {
    if (filterState === 'LIVE' && s.status !== 'LIVE') return false;
    if (filterState === 'STARTING_SOON' && s.status !== 'STARTING_SOON') return false;
    if (
      filterState === 'ACTION_REQUIRED' &&
      s.avStatus !== 'ACTION REQUIRED' &&
      s.translationStatus !== 'ACTION REQUIRED'
    )
      return false;

    if (search) {
      const q = search.toLowerCase();
      const match =
        s.title.toLowerCase().includes(q) ||
        s.room.toLowerCase().includes(q) ||
        s.speaker.toLowerCase().includes(q) ||
        s.moderator.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Session Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--mute)] font-medium">Live In Session</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 mt-1">
              {liveCount} <span className="text-xs font-normal text-[var(--mute)]">plenaries & tracks</span>
            </div>
            <div className="text-[11px] text-[var(--mute)] mt-0.5">1,613 delegates seated</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--mute)] font-medium">Starting in &lt; 20m</div>
            <div className="text-2xl font-bold tabular-nums text-amber-600 mt-1">
              {startingSoonCount}
            </div>
            <div className="text-[11px] text-[var(--mute)] mt-0.5">Speaker staging checks</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--mute)] font-medium">Action Required</div>
            <div className="text-2xl font-bold tabular-nums text-red-600 mt-1">
              {actionRequiredCount}
            </div>
            <div className="text-[11px] text-red-500 mt-0.5 font-medium">AV / Audio / Translation alert</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-lg border border-[var(--line)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'ALL', label: 'All Sessions (8)' },
            { key: 'LIVE', label: 'Live Now ●' },
            { key: 'STARTING_SOON', label: 'Starting Soon ■' },
            { key: 'ACTION_REQUIRED', label: 'Action Required ▲' }
          ].map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilterState(chip.key as any)}
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

        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
          <input
            type="text"
            placeholder="Search room, speaker, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSessions.map((session) => {
          const hasIssue =
            session.avStatus === 'ACTION REQUIRED' ||
            session.translationStatus === 'ACTION REQUIRED';

          return (
            <div
              key={session.id}
              className={`p-4 rounded-lg bg-[var(--card)] border transition-all shadow-xs space-y-3 ${
                hasIssue
                  ? 'border-red-500/50 bg-red-500/5'
                  : session.status === 'LIVE'
                  ? 'border-[var(--line)] hover:border-[var(--primary)]'
                  : 'border-[var(--line)] opacity-95'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--primary)]">
                      {session.room}
                    </span>
                    <span>·</span>
                    <span className="text-xs font-mono text-[var(--mute)]">{session.time}</span>
                  </div>
                  <h3 className="text-sm font-bold text-[var(--ink)] mt-1">
                    {session.title}
                  </h3>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                    session.status === 'LIVE'
                      ? 'bg-emerald-500 text-white flex items-center gap-1'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {session.status === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                  {session.status === 'LIVE' ? 'LIVE NOW' : 'STARTING SOON'}
                </span>
              </div>

              {/* People */}
              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--mute)] bg-[var(--bg)] p-2.5 rounded">
                <div>
                  <span className="text-[10px] uppercase block font-semibold">Speaker(s)</span>
                  <span className="font-medium text-[var(--ink)] line-clamp-1">{session.speaker}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase block font-semibold">Moderator</span>
                  <span className="font-medium text-[var(--ink)] line-clamp-1">{session.moderator}</span>
                </div>
              </div>

              {/* Readiness Indicators */}
              <div className="grid grid-cols-4 gap-2 text-[11px] pt-1">
                {/* AV Audio */}
                <div
                  className={`p-2 rounded flex flex-col items-center justify-center text-center ${
                    session.avStatus === 'ACTION REQUIRED'
                      ? 'bg-red-500/10 text-red-600 font-bold border border-red-500/20'
                      : 'bg-[var(--bg)] text-[var(--ink)]'
                  }`}
                >
                  <Volume2 className="w-4 h-4 mb-0.5" />
                  <span>AV: {session.avStatus}</span>
                </div>

                {/* Translation */}
                <div
                  className={`p-2 rounded flex flex-col items-center justify-center text-center ${
                    session.translationStatus === 'ACTION REQUIRED'
                      ? 'bg-red-500/10 text-red-600 font-bold border border-red-500/20'
                      : 'bg-[var(--bg)] text-[var(--ink)]'
                  }`}
                >
                  <Languages className="w-4 h-4 mb-0.5" />
                  <span>Lang: {session.translationStatus}</span>
                </div>

                {/* Recording */}
                <div className="p-2 rounded bg-[var(--bg)] text-[var(--ink)] flex flex-col items-center justify-center text-center">
                  <Video className="w-4 h-4 mb-0.5 text-blue-600" />
                  <span>Rec: {session.recordingStatus}</span>
                </div>

                {/* Attendance */}
                <div className="p-2 rounded bg-[var(--bg)] text-[var(--ink)] flex flex-col items-center justify-center text-center">
                  <Users className="w-4 h-4 mb-0.5 text-emerald-600" />
                  <span className="truncate">{session.attendance}</span>
                </div>
              </div>

              {/* Action Required Banner & Interactive Fix Button */}
              {hasIssue && (
                <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>ACTION REQUIRED: {session.alertNote || 'AV / translation anomaly'}</span>
                  </div>
                  <button
                    onClick={() => onResolveSessionAlert(session.id)}
                    className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-xs whitespace-nowrap shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Resolve / Dismiss</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
