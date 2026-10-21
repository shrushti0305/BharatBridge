import React, { useState } from 'react';
import {
  Bus,
  Search,
  Filter,
  Phone,
  RotateCcw,
  AlertTriangle,
  Clock,
  BatteryCharging,
  MapPin,
  CheckCircle2,
  X,
  Radio,
  ExternalLink
} from 'lucide-react';
import { Vehicle } from '../types';

interface MobilityTabProps {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  onSelectVehicle: (v: Vehicle | null) => void;
  onReassignRoute: (id: string, newRoute: string) => void;
  onReportIncidentForVehicle: (v: Vehicle) => void;
  searchQuery: string;
  onOpenMapsGrounding?: (initialPrompt?: string, contextTitle?: string) => void;
}

export const MobilityTab: React.FC<MobilityTabProps> = ({
  vehicles,
  selectedVehicle,
  onSelectVehicle,
  onReassignRoute,
  onReportIncidentForVehicle,
  searchQuery,
  onOpenMapsGrounding
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedNewRoute, setSelectedNewRoute] = useState('Airport T1 ↔ Venue');
  const [driverDispatchMsg, setDriverDispatchMsg] = useState('');
  const [msgSentNotice, setMsgSentNotice] = useState(false);

  const activeCount = vehicles.filter((v) => v.status === 'ON_TIME' || v.status === 'DELAYED').length;
  const delayedCount = vehicles.filter((v) => v.status === 'DELAYED').length;
  const breakdownCount = vehicles.filter((v) => v.status === 'BREAKDOWN').length;

  const query = (localSearch || searchQuery).toLowerCase();

  const filteredVehicles = vehicles.filter((v) => {
    if (filterStatus !== 'ALL' && v.status !== filterStatus) return false;
    if (query) {
      const match =
        v.id.toLowerCase().includes(query) ||
        v.driver.toLowerCase().includes(query) ||
        v.route.toLowerCase().includes(query) ||
        v.location.toLowerCase().includes(query);
      if (!match) return false;
    }
    return true;
  });

  const routes = [
    'Airport T1 ↔ Venue',
    'Airport T3 ↔ Venue',
    'Hotel Grand ↔ Venue',
    'Hotel Marina ↔ Venue',
    'City Center ↔ Venue',
    'VIP Circuit'
  ];

  return (
    <div className="space-y-6">
      {/* Fleet Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">Active Fleet</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--ink)] mt-1">
            42 <span className="text-xs font-normal text-[var(--mute)]">/ 48 vehicles</span>
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 font-medium">87.5% deployment rate</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">Delayed Vehicles</div>
          <div className="text-2xl font-bold tabular-nums text-amber-600 mt-1">
            {delayedCount}
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">Traffic on ECP / A2 Highway</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">Breakdown / Alert</div>
          <div className="text-2xl font-bold tabular-nums text-red-600 mt-1">
            {breakdownCount}
          </div>
          <div className="text-[11px] text-red-500 mt-1">VH-07 relief dispatched</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="text-xs text-[var(--mute)] font-medium">Trips Completed Today</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--primary)] mt-1">
            162
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">4,380 passenger-legs</div>
        </div>
      </div>

      {/* Control bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-lg border border-[var(--line)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'ALL', label: 'All Fleet (48)' },
            { key: 'ON_TIME', label: 'On Time ●' },
            { key: 'DELAYED', label: 'Delayed ■' },
            { key: 'BREAKDOWN', label: 'Breakdown ▲' },
            { key: 'STANDBY', label: 'Standby' }
          ].map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilterStatus(chip.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterStatus === chip.key
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {onOpenMapsGrounding && (
            <button
              onClick={() =>
                onOpenMapsGrounding(
                  'What are the current traffic conditions, expressway congestion, and alternative routes between Changi Airport, Seletar Airport, and Marina Bay Sands Singapore?',
                  'Fleet & Transit Live Navigation'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              title="Google Maps Grounding Intel (gemini-3.5-flash)"
            >
              <MapPin className="w-3.5 h-3.5 text-sky-500" />
              <span>Maps Transit Intel</span>
            </button>
          )}

          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
            <input
              type="text"
              placeholder="Search vehicle, driver, route..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>
      </div>

      {/* Vehicle Grid & Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Vehicles Table */}
        <div className={selectedVehicle ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="rounded-lg bg-[var(--card)] border border-[var(--line)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--mute)] font-semibold">
                    <th className="py-2.5 px-3">Vehicle ID</th>
                    <th className="py-2.5 px-3">Driver</th>
                    <th className="py-2.5 px-3">Type & Route</th>
                    <th className="py-2.5 px-3">Current Location</th>
                    <th className="py-2.5 px-3">Passengers</th>
                    <th className="py-2.5 px-3">ETA</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {filteredVehicles.map((vh) => {
                    const isSelected = selectedVehicle?.id === vh.id;
                    return (
                      <tr
                        key={vh.id}
                        onClick={() => onSelectVehicle(vh)}
                        className={`hover:bg-[var(--bg)] transition-colors cursor-pointer ${
                          isSelected ? 'bg-teal-500/10 dark:bg-teal-900/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-[var(--primary)] whitespace-nowrap">
                          {vh.id}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[var(--ink)] whitespace-nowrap">
                          {vh.driver}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[var(--ink)] line-clamp-1">{vh.route}</div>
                          <div className="text-[11px] text-[var(--mute)]">{vh.type}</div>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--mute)]">
                          <div className="flex items-center gap-1 line-clamp-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{vh.location}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-[var(--ink)] whitespace-nowrap">
                          {vh.passengers}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-[var(--ink)]">
                          {vh.eta}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {vh.status === 'ON_TIME' ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                              <span>●</span>
                              <span>On Time</span>
                            </span>
                          ) : vh.status === 'DELAYED' ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                              <span>■</span>
                              <span>Delayed</span>
                            </span>
                          ) : vh.status === 'BREAKDOWN' ? (
                            <span className="inline-flex items-center gap-1 font-bold text-red-600">
                              <span>▲</span>
                              <span>Breakdown</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                              <span>○</span>
                              <span>Standby</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectVehicle(vh);
                            }}
                            className="text-xs text-[var(--primary)] font-medium hover:underline cursor-pointer"
                          >
                            Manage →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Vehicle Detail Drawer */}
        {selectedVehicle && (
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-sm space-y-4 text-xs">
              <div className="flex items-start justify-between border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-mono font-bold">
                    {selectedVehicle.id}
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--ink)] text-sm">{selectedVehicle.driver}</h3>
                    <p className="text-[var(--mute)] text-[11px]">{selectedVehicle.type}</p>
                  </div>
                </div>
                <button
                  onClick={() => onSelectVehicle(null)}
                  className="p-1 rounded text-[var(--mute)] hover:text-[var(--ink)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Assigned Route</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedVehicle.route}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Passengers</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedVehicle.passengers}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Current ETA</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedVehicle.eta}</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg)]">
                  <span className="text-[10px] text-[var(--mute)] uppercase block">Battery / Fuel</span>
                  <span className="font-semibold text-[var(--ink)] flex items-center gap-1">
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{selectedVehicle.batteryFuel}%</span>
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                <div className="text-[10px] text-[var(--mute)] uppercase font-semibold mb-1">
                  GPS Telemetry & Location
                </div>
                <div className="font-medium text-[var(--ink)] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>{selectedVehicle.location}</span>
                </div>
                <div className="text-[10px] text-[var(--mute)] mt-1 font-mono">
                  Coordinates: {selectedVehicle.x.toFixed(1)}, {selectedVehicle.y.toFixed(1)} · Live Clamped Route
                </div>
              </div>

              {/* Action Buttons: Contact, Reassign, Report Incident */}
              <div className="pt-2 border-t border-[var(--line)] space-y-2">
                <div className="text-[11px] font-semibold text-[var(--mute)] uppercase">
                  Driver & Route Operations
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setMsgSentNotice(false);
                      setShowContactModal(true);
                    }}
                    className="p-2 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Phone className="w-4 h-4 text-[var(--primary)]" />
                    <span>Contact</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedNewRoute(selectedVehicle.route);
                      setShowReassignModal(true);
                    }}
                    className="p-2 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    <span>Reassign</span>
                  </button>

                  <button
                    onClick={() => onReportIncidentForVehicle(selectedVehicle)}
                    className="p-2 rounded bg-[var(--bg)] border border-red-500/30 hover:border-red-500 text-red-600 font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>Report Incident</span>
                  </button>
                </div>

                {onOpenMapsGrounding && (
                  <button
                    onClick={() =>
                      onOpenMapsGrounding(
                        `What is the live route and traffic condition for vehicle ${selectedVehicle.id} on route "${selectedVehicle.route}" near "${selectedVehicle.location}" in Singapore? Check for delays along expressways like ECP, PIE, or KPE, and suggest optimal bypasses to Marina Bay Sands.`,
                        `Vehicle ${selectedVehicle.id} (${selectedVehicle.route})`
                      )
                    }
                    className="w-full mt-2 py-2 px-3 rounded-md bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs shadow-2xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-sky-500" />
                    <span>Verify Route on Google Maps (gemini-3.5-flash)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contact Driver Modal */}
      {showContactModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="font-bold text-[var(--ink)] text-sm flex items-center gap-2">
                <Phone className="w-4 h-4 text-[var(--primary)]" />
                <span>Radio & Dispatch: {selectedVehicle.driver} ({selectedVehicle.id})</span>
              </h3>
              <button onClick={() => setShowContactModal(false)} className="text-[var(--mute)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded bg-[var(--bg)] border border-[var(--line)]">
                <div className="text-[10px] text-[var(--mute)] uppercase">Direct Fleet Cellular</div>
                <div className="font-mono text-sm font-bold text-[var(--ink)] mt-0.5">
                  {selectedVehicle.phone}
                </div>
                <div className="text-[10px] text-[var(--mute)] mt-1">
                  Fleet VHF Channel: <strong>Mobility Ch 4 (Encrypted)</strong>
                </div>
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">
                  Send Instant Dispatch Notification / Radio Text
                </label>
                <textarea
                  rows={3}
                  value={driverDispatchMsg}
                  onChange={(e) => setDriverDispatchMsg(e.target.value)}
                  placeholder="e.g. Please divert via coastal highway to bypass exit 14 congestion..."
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              {msgSentNotice && (
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-700 text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Dispatch message transmitted to vehicle terminal successfully.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setMsgSentNotice(true);
                  setTimeout(() => setShowContactModal(false), 1200);
                }}
                className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold"
              >
                Transmit to Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Route Modal */}
      {showReassignModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="font-bold text-[var(--ink)] text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>Reassign Route for {selectedVehicle.id}</span>
              </h3>
              <button onClick={() => setShowReassignModal(false)} className="text-[var(--mute)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[var(--mute)]">
                Driver: <strong>{selectedVehicle.driver}</strong>. Current route: <em>{selectedVehicle.route}</em>.
              </p>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Select New Route</label>
                <select
                  value={selectedNewRoute}
                  onChange={(e) => setSelectedNewRoute(e.target.value)}
                  className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-medium"
                >
                  {routes.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onReassignRoute(selectedVehicle.id, selectedNewRoute);
                  setShowReassignModal(false);
                }}
                className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold"
              >
                Confirm Route Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
