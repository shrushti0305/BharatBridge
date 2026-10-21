import React, { useState } from 'react';
import {
  Crown,
  Shield,
  Plane,
  Car,
  MapPin,
  Clock,
  Search,
  Filter,
  UserCheck,
  Phone,
  Download,
  CheckCircle2,
  AlertTriangle,
  Hotel,
  Calendar,
  X,
  Send,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
  Upload
} from 'lucide-react';
import { VIPGuest } from '../types';

interface VIPProtocolTabProps {
  vipGuests: VIPGuest[];
  onUpdateVIPMotorcadeStatus: (id: string, newStatus: VIPGuest['motorcade']['status']) => void;
  onUpdateVIPSuite: (id: string, newSuite: string) => void;
  onAddToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenImportModal?: () => void;
  onOpenMapsGrounding?: (initialPrompt?: string, contextTitle?: string) => void;
}

export const VIPProtocolTab: React.FC<VIPProtocolTabProps> = ({
  vipGuests,
  onUpdateVIPMotorcadeStatus,
  onUpdateVIPSuite,
  onAddToast,
  onOpenImportModal,
  onOpenMapsGrounding
}) => {
  const [filterTier, setFilterTier] = useState<'ALL' | 'VVIP' | 'TRANSIT' | 'ONSITE' | 'PENDING'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedVIP, setSelectedVIP] = useState<VIPGuest | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [msgSent, setMsgSent] = useState(false);

  // Metrics
  const totalCount = vipGuests.length;
  const vvipCount = vipGuests.filter((g) => g.tier === 'VVIP').length;
  const inTransitCount = vipGuests.filter((g) => g.motorcade.status === 'Convoy In Transit').length;
  const arrivedOnsiteCount = vipGuests.filter((g) => g.motorcade.status === 'Arrived Onsite').length;
  const flightsPendingCount = vipGuests.filter((g) => g.flightInfo.status === 'En Route' || g.flightInfo.status === 'Delayed').length;

  const query = search.toLowerCase();

  const filteredGuests = vipGuests.filter((g) => {
    if (filterTier === 'VVIP' && g.tier !== 'VVIP') return false;
    if (filterTier === 'TRANSIT' && g.motorcade.status !== 'Convoy In Transit') return false;
    if (filterTier === 'ONSITE' && g.motorcade.status !== 'Arrived Onsite') return false;
    if (filterTier === 'PENDING' && g.flightInfo.status !== 'En Route' && g.flightInfo.status !== 'Delayed') return false;

    if (query) {
      const match =
        g.name.toLowerCase().includes(query) ||
        g.id.toLowerCase().includes(query) ||
        g.countryOrOrg.toLowerCase().includes(query) ||
        g.officialTitle.toLowerCase().includes(query) ||
        g.motorcade.convoyId.toLowerCase().includes(query) ||
        g.flightInfo.flightNumber.toLowerCase().includes(query) ||
        g.liaisonOfficer.name.toLowerCase().includes(query);
      if (!match) return false;
    }

    return true;
  });

  const handleExportVIPManifestCSV = () => {
    const headers = [
      'VIP ID',
      'Tier',
      'Name',
      'Official Title',
      'Country / Organization',
      'Flight Number',
      'Terminal',
      'Flight Status',
      'Convoy ID',
      'Vehicle Type',
      'Driver Name',
      'Driver Mobile',
      'Convoy Status',
      'Current ETA',
      'Assigned Bilateral Suite',
      'Hotel',
      'Protocol Liaison',
      'Security Clearance',
      'Dietary Requirements'
    ];

    const rows = vipGuests.map((g) => [
      g.id,
      g.tier,
      `"${g.name.replace(/"/g, '""')}"`,
      `"${g.officialTitle.replace(/"/g, '""')}"`,
      `"${g.countryOrOrg.replace(/"/g, '""')}"`,
      g.flightInfo.flightNumber,
      `"${g.flightInfo.terminal}"`,
      g.flightInfo.status,
      g.motorcade.convoyId,
      `"${g.motorcade.vehicleType}"`,
      `"${g.motorcade.driverName}"`,
      g.motorcade.driverPhone,
      g.motorcade.status,
      `"${g.motorcade.currentEta}"`,
      `"${g.assignedSuite}"`,
      `"${g.hotel}"`,
      `"${g.liaisonOfficer.name} (${g.liaisonOfficer.phone})"`,
      `"${g.securityClearance}"`,
      `"${g.dietaryRestrictions}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `YESummit_2027_VIP_VVIP_Motorcade_Manifest_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddToast) {
      onAddToast('Manifest Exported', '50 VIP/VVIP travel and motorcade manifest downloaded.', 'success');
    }
  };

  const handleContactDriver = (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSent(true);
    setTimeout(() => {
      setMsgSent(false);
      setShowContactModal(false);
      setContactMessage('');
      if (onAddToast && selectedVIP) {
        onAddToast('Radio Dispatch Sent', `Encrypted dispatch relayed to ${selectedVIP.motorcade.driverName} (${selectedVIP.motorcade.convoyId}).`, 'info');
      }
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Executive Reassurance & Operational Context Card */}
      <div className="p-4 sm:p-5 rounded-lg bg-[var(--card)] border-2 border-[var(--primary)] shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--ink)]">
                  Unified VIP & VVIP Protocol & Motorcade Management
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                  50 Dedicated Dignitaries
                </span>
              </div>
              <p className="text-xs text-[var(--mute)] mt-1 max-w-4xl leading-relaxed">
                <strong>Why the same platform is ideal:</strong> In world-class events (G20, WEF Davos, YESummit), separating VIP travel creates operational silos between security escorts, shuttle buses, airport tarmac relays, and venue entrance gates. This unified deck integrates flight telemetry, motorcade convoy status, personal liaison officers, and bilateral room allocations directly into your central command centre.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="px-3.5 py-2 text-xs font-bold rounded-md bg-[var(--bg)] border border-[var(--primary)]/40 hover:border-[var(--primary)] text-[var(--primary)] dark:text-[var(--primary-light)] flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors hover:bg-[var(--primary)]/5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import VIP Manifest (CSV/JSON)</span>
              </button>
            )}
            <button
              onClick={handleExportVIPManifestCSV}
              className="px-3.5 py-2 text-xs font-bold rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform hover:scale-102"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export VIP Manifest (CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Protocol Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--mute)] font-medium">
            <span>Dignitaries Roster</span>
            <Crown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-[var(--ink)] mt-1">
            50 <span className="text-xs font-normal text-[var(--mute)]">Total Dignitaries</span>
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">
            <strong className="text-amber-600 font-semibold">{vvipCount} VVIPs</strong> (Heads of State & Ministers) · {totalCount - vvipCount} VIPs
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--mute)] font-medium">
            <span>Active Motorcades</span>
            <Car className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {inTransitCount} <span className="text-xs font-normal text-[var(--mute)]">convoys moving</span>
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">
            Armed escort outriders engaged · Approaching Gate 4
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--mute)] font-medium">
            <span>Arrived Onsite</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {arrivedOnsiteCount} <span className="text-xs font-normal text-[var(--mute)]">at Convention Complex</span>
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">
            Seated in Bilateral Suites 1-4 & Main Plenary
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--mute)] font-medium">
            <span>Airport Transfers / In Air</span>
            <Plane className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-[var(--primary)] mt-1">
            {flightsPendingCount} <span className="text-xs font-normal text-[var(--mute)]">flights inbound</span>
          </div>
          <div className="text-[11px] text-[var(--mute)] mt-1">
            Changi T1, T3 & Seletar VIP Jet Hub
          </div>
        </div>
      </div>

      {/* Control Bar: Filter Tabs & Live Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-lg border border-[var(--line)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'ALL', label: `All 50 Guests` },
            { key: 'VVIP', label: `VVIPs Only (${vvipCount}) ★` },
            { key: 'TRANSIT', label: `Motorcades In Transit (${inTransitCount})` },
            { key: 'ONSITE', label: `Arrived at Venue (${arrivedOnsiteCount})` },
            { key: 'PENDING', label: `Flights Inbound (${flightsPendingCount})` }
          ].map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilterTier(chip.key as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterTier === chip.key
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
          <input
            type="text"
            placeholder="Search VIP name, country, flight, convoy..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>

      {/* Main Layout: VIP Roster Table (7 cols) + Detail Drawer (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={selectedVIP ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="rounded-lg bg-[var(--card)] border border-[var(--line)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--mute)] font-semibold">
                    <th className="py-2.5 px-3">Dignitary & Title</th>
                    <th className="py-2.5 px-3">Tier</th>
                    <th className="py-2.5 px-3">Flight / Airport</th>
                    <th className="py-2.5 px-3">Motorcade Convoy</th>
                    <th className="py-2.5 px-3">Liaison Officer</th>
                    <th className="py-2.5 px-3">Suite / Hotel</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[var(--mute)]">
                        No VIP guests matching this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((guest) => {
                      const isSelected = selectedVIP?.id === guest.id;
                      return (
                        <tr
                          key={guest.id}
                          onClick={() => setSelectedVIP(guest)}
                          className={`hover:bg-[var(--bg)] transition-colors cursor-pointer ${
                            isSelected ? 'bg-teal-500/10 dark:bg-teal-900/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[var(--ink)] line-clamp-1">{guest.name}</span>
                            </div>
                            <div className="text-[11px] text-[var(--mute)] line-clamp-1">{guest.officialTitle}</div>
                            <div className="text-[10px] font-semibold text-[var(--primary)] uppercase mt-0.5">
                              {guest.countryOrOrg}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit ${
                                guest.tier === 'VVIP'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                  : 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30'
                              }`}
                            >
                              {guest.tier === 'VVIP' && <Crown className="w-3 h-3 text-amber-500" />}
                              <span>{guest.tier}</span>
                            </span>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-mono font-semibold text-[var(--ink)] flex items-center gap-1">
                              <Plane className="w-3 h-3 text-[var(--mute)]" />
                              <span>{guest.flightInfo.flightNumber}</span>
                            </div>
                            <div className="text-[11px] text-[var(--mute)]">{guest.flightInfo.terminal}</div>
                            <div className="text-[10px] font-medium text-emerald-600">{guest.flightInfo.status}</div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[var(--ink)] line-clamp-1">{guest.motorcade.convoyId}</div>
                            <div className="text-[11px] text-[var(--mute)] line-clamp-1">{guest.motorcade.vehicleType}</div>
                            <div className="text-[10px] font-semibold mt-0.5">
                              {guest.motorcade.status === 'Arrived Onsite' ? (
                                <span className="text-emerald-600">● Onsite at Venue</span>
                              ) : guest.motorcade.status === 'Convoy In Transit' ? (
                                <span className="text-blue-600">■ In Transit ({guest.motorcade.currentEta})</span>
                              ) : (
                                <span className="text-slate-500">○ {guest.motorcade.status}</span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-medium text-[var(--ink)]">{guest.liaisonOfficer.name}</div>
                            <div className="text-[11px] font-mono text-[var(--mute)]">{guest.liaisonOfficer.phone}</div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[var(--primary)] line-clamp-1">{guest.assignedSuite}</div>
                            <div className="text-[11px] text-[var(--mute)] line-clamp-1">{guest.hotel}</div>
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVIP(guest);
                              }}
                              className="text-xs text-[var(--primary)] font-semibold hover:underline"
                            >
                              Manage →
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

        {/* Selected VIP Detail Drawer */}
        {selectedVIP && (
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-sm space-y-4 text-xs">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[var(--line)] pb-3">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                      selectedVIP.tier === 'VVIP' ? 'bg-amber-500 text-white' : 'bg-purple-600 text-white'
                    }`}
                  >
                    {selectedVIP.tier === 'VVIP' ? <Crown className="w-5 h-5" /> : 'VIP'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-[var(--primary)]">{selectedVIP.id}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          selectedVIP.tier === 'VVIP' ? 'bg-amber-500/15 text-amber-700' : 'bg-purple-500/15 text-purple-700'
                        }`}
                      >
                        {selectedVIP.tier} CLASS
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-[var(--ink)] mt-0.5">{selectedVIP.name}</h3>
                    <p className="text-[11px] text-[var(--mute)]">{selectedVIP.officialTitle} ({selectedVIP.countryOrOrg})</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedVIP(null)}
                  className="p-1 rounded text-[var(--mute)] hover:text-[var(--ink)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Motorcade & Live Convoy Operations */}
              <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-[var(--mute)] flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-blue-600" />
                    <span>Motorcade Convoy Operations</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[var(--primary)]">
                    {selectedVIP.motorcade.convoyId}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--mute)] block">Vehicle Model</span>
                    <span className="font-semibold text-[var(--ink)]">{selectedVIP.motorcade.vehicleType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--mute)] block">License Plate</span>
                    <span className="font-mono font-bold text-[var(--primary)]">{selectedVIP.motorcade.plateNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--mute)] block">Driver</span>
                    <span className="font-medium text-[var(--ink)]">{selectedVIP.motorcade.driverName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--mute)] block">Driver Phone</span>
                    <span className="font-mono font-medium text-[var(--ink)]">{selectedVIP.motorcade.driverPhone}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--mute)] block">Convoy Status</span>
                    <span className="font-bold text-[var(--ink)]">{selectedVIP.motorcade.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--mute)] block">Venue ETA</span>
                    <span className="font-bold text-emerald-600">{selectedVIP.motorcade.currentEta}</span>
                  </div>
                </div>

                {/* State Mutators */}
                <div className="pt-2 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      onUpdateVIPMotorcadeStatus(selectedVIP.id, 'Arrived Onsite');
                      setSelectedVIP({
                        ...selectedVIP,
                        motorcade: { ...selectedVIP.motorcade, status: 'Arrived Onsite', currentEta: 'Onsite (Gate 4)' }
                      });
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer"
                  >
                    ✓ Mark Arrived (Gate 4)
                  </button>

                  <button
                    onClick={() => {
                      onUpdateVIPMotorcadeStatus(selectedVIP.id, 'Convoy In Transit');
                      setSelectedVIP({
                        ...selectedVIP,
                        motorcade: { ...selectedVIP.motorcade, status: 'Convoy In Transit', currentEta: '10 min to Gate 4' }
                      });
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] cursor-pointer"
                  >
                    Dispatch Convoy
                  </button>

                  <button
                    onClick={() => setShowContactModal(true)}
                    className="px-2.5 py-1 rounded bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Phone className="w-3 h-3 text-[var(--primary)]" />
                    <span>Radio Driver</span>
                  </button>
                </div>

                {onOpenMapsGrounding && (
                  <button
                    onClick={() =>
                      onOpenMapsGrounding(
                        `What is the live route and travel time from ${selectedVIP.hotel} to Marina Bay Sands (VIP Gate 4) Singapore? Also locate the arrival terminal ${selectedVIP.flightInfo.terminal} and provide official place addresses.`,
                        `${selectedVIP.name} (${selectedVIP.countryOrOrg}) - Hotel & Convoy Routing`
                      )
                    }
                    className="w-full mt-2 py-1.5 px-2.5 rounded bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-sky-500" />
                    <span>Verify Hotel & Motorcade on Google Maps (gemini-3.5-flash)</span>
                  </button>
                )}
              </div>

              {/* Flight & Travel Details */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <span className="text-[10px] font-bold text-[var(--mute)] uppercase block">Flight & Terminal</span>
                  <div className="font-mono font-bold text-[var(--ink)] mt-0.5">{selectedVIP.flightInfo.flightNumber}</div>
                  <div className="text-[11px] text-[var(--mute)]">{selectedVIP.flightInfo.airline}</div>
                  <div className="text-[10px] text-emerald-600 font-medium mt-1">{selectedVIP.flightInfo.terminal}</div>
                </div>

                <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)]">
                  <span className="text-[10px] font-bold text-[var(--mute)] uppercase block">Personal Protocol Liaison</span>
                  <div className="font-bold text-[var(--ink)] mt-0.5">{selectedVIP.liaisonOfficer.name}</div>
                  <div className="text-[11px] font-mono text-[var(--primary)]">{selectedVIP.liaisonOfficer.phone}</div>
                  <div className="text-[10px] text-[var(--mute)] mt-1">Badge: {selectedVIP.liaisonOfficer.id}</div>
                </div>
              </div>

              {/* Venue & Protocol Allocations */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded bg-[var(--bg)]">
                    <span className="text-[10px] font-bold text-[var(--mute)] uppercase block">Assigned Suite</span>
                    <span className="font-bold text-[var(--primary)]">{selectedVIP.assignedSuite}</span>
                    <span className="text-[10px] text-[var(--mute)] block mt-0.5">
                      {selectedVIP.bilateralMeetingsCount} bilateral sessions scheduled
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[var(--bg)]">
                    <span className="text-[10px] font-bold text-[var(--mute)] uppercase block">Accommodation</span>
                    <span className="font-semibold text-[var(--ink)]">{selectedVIP.hotel}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[var(--mute)] uppercase">Security Clearance</span>
                    <span className="text-[10px] font-semibold text-purple-600">{selectedVIP.securityClearance}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[var(--mute)] uppercase">Dietary Protocol</span>
                    <span className="text-xs font-medium text-[var(--ink)]">{selectedVIP.dietaryRestrictions}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Radio Driver Dialog */}
      {showContactModal && selectedVIP && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleContactDriver}
            className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
                <Phone className="w-4 h-4 text-[var(--primary)]" />
                <span>Radio Driver: {selectedVIP.motorcade.driverName} ({selectedVIP.motorcade.convoyId})</span>
              </h3>
              <button onClick={() => setShowContactModal(false)} className="text-[var(--mute)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
                <div>Principal Dignitary: <strong>{selectedVIP.name} ({selectedVIP.countryOrOrg})</strong></div>
                <div>Vehicle: <strong>{selectedVIP.motorcade.vehicleType}</strong> (Plate: {selectedVIP.motorcade.plateNumber})</div>
                <div>Cellular: <strong>{selectedVIP.motorcade.driverPhone}</strong> · Channel: <strong>VIP Motorcade Escort Ch 1</strong></div>
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">
                  Priority Radio / Terminal Dispatch Notice
                </label>
                <textarea
                  rows={3}
                  required
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="e.g. Please divert to Gate 4 VIP ramp directly. Protocol team waiting at red carpet bay..."
                  className="w-full p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              {msgSent && (
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Radio message transmitted to motorcade lead vehicle terminal.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Transmit Encrypted Dispatch</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
