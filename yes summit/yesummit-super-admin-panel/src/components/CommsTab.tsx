import React, { useState } from 'react';
import {
  Radio,
  Send,
  Users,
  MessageSquare,
  Mail,
  Smartphone,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { SentBroadcast } from '../types';

interface CommsTabProps {
  broadcasts: SentBroadcast[];
  onSendBroadcast: (broadcast: Omit<SentBroadcast, 'id' | 'sentAt' | 'status'>) => void;
}

export const CommsTab: React.FC<CommsTabProps> = ({ broadcasts, onSendBroadcast }) => {
  const [audience, setAudience] = useState('All Volunteers');
  const [channel, setChannel] = useState<'Push' | 'SMS' | 'Email'>('Push');
  const [priority, setPriority] = useState<'Normal' | 'High' | 'Emergency'>('Normal');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  const audiences = [
    { label: 'All Volunteers (186 on-duty)', value: 'All Volunteers', count: 186 },
    { label: 'Drivers (Mobility Fleet 48)', value: 'Drivers (Mobility Fleet)', count: 48 },
    { label: 'Hotel A Participants (420 guests)', value: 'Hotel A Participants', count: 420 },
    { label: 'Operations & Area Leads', value: 'Operations Team', count: 28 },
    { label: 'VIP Delegates (48 delegates)', value: 'VIP Delegates', count: 48 },
    { label: 'All Registered Delegates (2,840 pax)', value: 'All Registered Delegates', count: 2840 }
  ];

  const templates = [
    {
      title: 'Emergency Weather / Traffic Protocol',
      subject: 'URGENT: Flash Rain Protocol & Shuttle Reroute',
      channel: 'Push' as const,
      priority: 'Emergency' as const,
      body: 'Heavy rainfall in progress. All shuttles redirect to Covered South Coach Bay. Volunteers at Gate 1 distribute umbrella packs.'
    },
    {
      title: 'Lunch Service Open Notice',
      subject: 'Buffet Service Now Open in Dining Pavilion',
      channel: 'Push' as const,
      priority: 'Normal' as const,
      body: 'Lunch service is now open at Level 2 Food Court & Dining Pavilion. Vegetarian, Halal, and Jain counters clearly marked.'
    },
    {
      title: 'Driver Highway A2 Congestion Alert',
      subject: 'Expressway A2 Detour Alert for Fleet Drivers',
      channel: 'SMS' as const,
      priority: 'High' as const,
      body: 'Heavy congestion near Exit 14. All Airport shuttles switch to Coastal Highway Route East until 12:30.'
    },
    {
      title: 'Plenary Session Transition Announcement',
      subject: 'Plenary Concluding in 10 Minutes: Hall Transition',
      channel: 'Push' as const,
      priority: 'Normal' as const,
      body: 'Opening plenary concluding in 10 minutes. Ushers please open side egress doors B & C. Coffee station 1 & 2 open in foyer.'
    }
  ];

  const handleApplyTemplate = (tpl: typeof templates[0]) => {
    setSubject(tpl.subject);
    setMessage(tpl.body);
    setChannel(tpl.channel);
    setPriority(tpl.priority);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const targetAudienceObj = audiences.find((a) => a.value === audience);
    const count = targetAudienceObj ? targetAudienceObj.count : 150;

    onSendBroadcast({
      audience,
      channel,
      priority,
      subject: subject || 'Operational Alert',
      message: message.trim(),
      recipientsCount: count
    });

    setSentNotice(true);
    setSubject('');
    setMessage('');
    setTimeout(() => setSentNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-[var(--card)] p-4 rounded-lg border border-[var(--line)] shadow-xs">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Radio className="w-4 h-4 text-[var(--primary)]" />
            <span>Unified Broadcast Dispatcher & Push Gateway</span>
          </h2>
          <p className="text-xs text-[var(--mute)]">
            Send high-priority push notifications, emergency SMS broadcasts, or email digests to attendees, drivers, and workforce.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Gateway Active (0.8s Latency)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Composer Form */}
        <div className="lg:col-span-7 space-y-4">
          <form
            onSubmit={handleSubmit}
            className="p-5 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <span className="font-bold text-sm text-[var(--ink)]">Compose Dispatch Broadcast</span>
              <span className="text-[11px] text-[var(--mute)]">Immediate Delivery</span>
            </div>

            {/* Quick Templates */}
            <div>
              <span className="text-[10px] font-bold text-[var(--mute)] uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                Quick Dispatch Templates
              </span>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="px-2.5 py-1 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[11px] text-[var(--ink)] transition-colors cursor-pointer"
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience & Channel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Target Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  {audiences.map((aud) => (
                    <option key={aud.value} value={aud.value}>
                      {aud.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Delivery Channel</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Push', 'SMS', 'Email'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={`p-2 rounded font-semibold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                        channel === ch
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--bg)] text-[var(--mute)] border border-[var(--line)]'
                      }`}
                    >
                      {ch === 'Push' ? <Smartphone className="w-3 h-3" /> : ch === 'SMS' ? <MessageSquare className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                      <span>{ch}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority & Subject */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  <option value="Normal">Normal Notification</option>
                  <option value="High">High Priority Alert</option>
                  <option value="Emergency">Emergency Broadcast</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold block text-[var(--ink)] mb-1">Subject Header</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weather Alert / Shuttle Bay Notice"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-[var(--ink)]">Broadcast Message Body</label>
                <span className="text-[10px] text-[var(--mute)] font-mono">
                  {message.length} characters
                </span>
              </div>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter concise instruction or message..."
                className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
              />
            </div>

            {sentNotice && (
              <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Broadcast message queued and transmitted to push notification cluster!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="submit"
                className="px-5 py-2 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Broadcast Now</span>
              </button>
            </div>
          </form>
        </div>

        {/* Sent History Log */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[var(--ink)]">Sent Broadcast Log ({broadcasts.length})</h3>
            <span className="text-[11px] text-[var(--mute)]">Audit Trail</span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-2xs space-y-2 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[var(--primary)]">{b.id}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] font-semibold text-[var(--mute)]">
                        {b.channel}
                      </span>
                      {b.priority !== 'Normal' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-bold">
                          {b.priority}
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-[var(--ink)] mt-1">{b.subject}</h4>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--mute)]">{b.sentAt}</span>
                </div>

                <p className="text-[var(--mute)] text-[11px] leading-relaxed bg-[var(--bg)] p-2 rounded">
                  {b.message}
                </p>

                <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--mute)]">
                  <span>Audience: <strong className="text-[var(--ink)]">{b.audience}</strong></span>
                  <span className="text-emerald-600 font-semibold">{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
