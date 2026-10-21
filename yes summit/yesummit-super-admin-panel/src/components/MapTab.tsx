import React, { useState } from 'react';
import {
  Layers,
  Play,
  Pause,
  AlertTriangle,
  Bus,
  Users,
  Compass,
  MapPin,
  Shield,
  X,
  ExternalLink,
  Info
} from 'lucide-react';
import { Vehicle, Volunteer, Incident } from '../types';

interface MapTabProps {
  vehicles: Vehicle[];
  volunteers: Volunteer[];
  incidents: Incident[];
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onSelectVehicle: (v: Vehicle) => void;
  onSelectVolunteer: (vol: Volunteer) => void;
  onSelectIncident: (inc: Incident) => void;
  onOpenMapsGrounding?: (initialPrompt?: string, contextTitle?: string) => void;
}

export const MapTab: React.FC<MapTabProps> = ({
  vehicles,
  volunteers,
  incidents,
  isSimulating,
  onToggleSimulation,
  onSelectVehicle,
  onSelectVolunteer,
  onSelectIncident,
  onOpenMapsGrounding
}) => {
  // Layer toggles
  const [showVehicles, setShowVehicles] = useState(true);
  const [showVolunteers, setShowVolunteers] = useState(true);
  const [showHotels, setShowHotels] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showEmergency, setShowEmergency] = useState(true);

  // Selected marker detail card
  const [activeMarker, setActiveMarker] = useState<{
    type: 'vehicle' | 'volunteer' | 'incident' | 'room';
    data: any;
  } | null>(null);

  // Determine room states based on open incidents:
  // Critical (red): Hall B (INC-024)
  // Attention (amber): Main Hall (INC-023)
  // Normal: all other rooms
  const rooms = [
    {
      id: 'main-hall',
      name: 'Main Plenary Hall',
      capacity: '800 Pax',
      x: 420,
      y: 110,
      width: 220,
      height: 120,
      state: 'Attention' as const, // Audio hum INC-023
      note: 'Plenary Live · Audio Ch 3 Under Review'
    },
    {
      id: 'hall-a',
      name: 'Hall A (Breakout)',
      capacity: '300 Pax',
      x: 250,
      y: 110,
      width: 150,
      height: 120,
      state: 'Normal' as const,
      note: 'Robotics Session in progress'
    },
    {
      id: 'hall-b',
      name: 'Hall B (Breakout)',
      capacity: '300 Pax',
      x: 250,
      y: 250,
      width: 150,
      height: 120,
      state: 'Critical' as const, // Medical distress INC-024
      note: 'Active Medical Incident INC-024'
    },
    {
      id: 'exhibition',
      name: 'Exhibition Hall',
      capacity: '250 Pax',
      x: 420,
      y: 250,
      width: 190,
      height: 95,
      state: 'Normal' as const,
      note: 'Tech Showcase Booths 1-40'
    },
    {
      id: 'vip',
      name: 'VIP Lounge & Bilateral',
      capacity: '40 Pax',
      x: 660,
      y: 110,
      width: 160,
      height: 100,
      state: 'Normal' as const,
      note: 'Ministerial Delegation inside'
    },
    {
      id: 'helpdesk',
      name: 'Help Desk & Concierge',
      capacity: 'Open',
      x: 660,
      y: 225,
      width: 160,
      height: 60,
      state: 'Normal' as const,
      note: 'Lost badge & IT assist'
    },
    {
      id: 'foodcourt',
      name: 'Food Court & Dining',
      capacity: '400 Pax',
      x: 660,
      y: 300,
      width: 160,
      height: 110,
      state: 'Normal' as const,
      note: 'Buffet setup underway'
    },
    {
      id: 'registration',
      name: 'Registration & Turnstiles',
      capacity: 'Gates 1-6',
      x: 420,
      y: 360,
      width: 130,
      height: 65,
      state: 'Normal' as const,
      note: 'FastTrack QR Kiosks active'
    },
    {
      id: 'medical',
      name: 'Medical & First Aid Clinic',
      capacity: 'Triage',
      x: 565,
      y: 360,
      width: 85,
      height: 65,
      state: 'Attention' as const, // Dispatched paramedic team
      note: 'Team 2 dispatched to Hall B'
    },
    {
      id: 'entry-exit',
      name: 'Main Entry / Exit Gate 1',
      capacity: 'Perimeter',
      x: 370,
      y: 440,
      width: 250,
      height: 60,
      state: 'Normal' as const,
      note: 'Security bag scanners active'
    }
  ];

  // Outside Points
  const outsidePoints = [
    {
      id: 'airport',
      name: 'Airport Changi (Terminals 1 & 3)',
      x: 50,
      y: 60,
      width: 150,
      height: 70,
      type: 'Transit Hub',
      detail: 'Shuttle arrivals every 10 min'
    },
    {
      id: 'hotel',
      name: 'Hotel Grand / Marina Hub',
      x: 50,
      y: 210,
      width: 150,
      height: 70,
      type: 'Accommodation',
      detail: 'Hotel Grand shuttle bay'
    },
    {
      id: 'gate4',
      name: 'Gate 4 (VIP Motorcade)',
      x: 160,
      y: 450,
      width: 150,
      height: 65,
      type: 'Security Checkpoint',
      detail: 'Electric VIP sedans only'
    },
    {
      id: 'parking',
      name: 'Parking & Logistics Deck',
      x: 740,
      y: 450,
      width: 160,
      height: 65,
      type: 'Logistics',
      detail: 'Coach parking & loading dock'
    }
  ];

  // Emergency Points (AED, Exits, First Aid)
  const emergencyPoints = [
    { id: 'aed-1', name: 'AED Defibrillator #1', x: 440, y: 130 },
    { id: 'aed-2', name: 'AED Defibrillator #2', x: 260, y: 270 },
    { id: 'aed-3', name: 'AED Defibrillator #3', x: 440, y: 380 },
    { id: 'exit-1', name: 'Emergency Exit North-West', x: 240, y: 160 },
    { id: 'exit-2', name: 'Emergency Exit East (VIP)', x: 830, y: 160 },
    { id: 'exit-3', name: 'Emergency Exit South-West', x: 240, y: 320 }
  ];

  return (
    <div className="space-y-4">
      {/* Control bar: Layers & Simulation control */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-lg border border-[var(--line)] shadow-xs">
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[var(--ink)]">
          <span className="flex items-center gap-1.5 font-bold text-[var(--primary)] uppercase text-[11px] tracking-wider">
            <Layers className="w-3.5 h-3.5" />
            Layers:
          </span>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showVehicles}
              onChange={(e) => setShowVehicles(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block text-[9px] text-white flex items-center justify-center font-bold">V</span>
              <span>Vehicles ({vehicles.length})</span>
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showVolunteers}
              onChange={(e) => setShowVolunteers(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rotate-45 bg-emerald-500 inline-block text-[9px] text-white flex items-center justify-center font-bold">◆</span>
              <span>Volunteers ({volunteers.length})</span>
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showIncidents}
              onChange={(e) => setShowIncidents(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <span>▲</span>
              <span>Incidents ({incidents.filter(i => i.status !== 'RESOLVED').length})</span>
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showHotels}
              onChange={(e) => setShowHotels(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            <span className="flex items-center gap-1">
              <span>Outside Points</span>
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showEmergency}
              onChange={(e) => setShowEmergency(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            <span className="flex items-center gap-1 text-red-600">
              <span className="font-bold">✛</span>
              <span>Emergency / AED</span>
            </span>
          </label>
        </div>

        {/* Simulation Pause / Play and Google Maps Intel button */}
        <div className="flex items-center gap-2">
          {onOpenMapsGrounding && (
            <button
              onClick={() =>
                onOpenMapsGrounding(
                  'What are the nearest major hospital emergency trauma centres, high-speed EV charging stations, and luxury hotels relative to Marina Bay Sands and Suntec Singapore?',
                  'Singapore Venue & Surroundings Map'
                )
              }
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Google Maps Operational Grounding (gemini-3.5-flash)"
            >
              <MapPin className="w-3.5 h-3.5 text-sky-500" />
              <span>Live Google Maps Intel</span>
            </button>
          )}

          <button
            onClick={onToggleSimulation}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs ${
              isSimulating
                ? 'bg-[var(--card)] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)]'
                : 'bg-emerald-600 text-white border-emerald-700'
            }`}
          >
            {isSimulating ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-600" />
                <span>Pause Movement (1.2s)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Resume Movement</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Floor Plan Card */}
      <div className="relative rounded-lg bg-[var(--card)] border border-[var(--line)] overflow-hidden shadow-xs">
        {/* SVG Venue Map */}
        <div className="w-full overflow-x-auto bg-[#f1f5f9] dark:bg-[#080d14] p-2 sm:p-4">
          <svg
            viewBox="0 0 960 560"
            className="w-full h-auto min-w-[760px] select-none"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-800" />
              </pattern>
            </defs>
            <rect width="960" height="560" fill="url(#grid)" />

            {/* Connecting Transit Roadways / Corridors */}
            {/* Airport Road */}
            <path
              d="M 200 95 L 300 95 L 300 130"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="4"
              strokeDasharray="6,4"
              opacity="0.6"
            />
            {/* Hotel Road */}
            <path
              d="M 200 245 L 230 245 L 230 380 L 370 380"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="4"
              strokeDasharray="6,4"
              opacity="0.6"
            />
            {/* VIP Gate 4 Access */}
            <path
              d="M 310 480 L 370 480"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="4"
              strokeDasharray="6,4"
              opacity="0.6"
            />
            {/* Parking Deck Road */}
            <path
              d="M 620 480 L 740 480"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="4"
              strokeDasharray="6,4"
              opacity="0.6"
            />

            {/* Outside Points (Airport, Hotel, Gate 4, Parking) */}
            {showHotels &&
              outsidePoints.map((pt) => (
                <g
                  key={pt.id}
                  onClick={() =>
                    setActiveMarker({
                      type: 'room',
                      data: { name: pt.name, status: 'Normal', note: pt.detail, capacity: pt.type }
                    })
                  }
                  className="cursor-pointer"
                >
                  <rect
                    x={pt.x}
                    y={pt.y}
                    width={pt.width}
                    height={pt.height}
                    rx="8"
                    className="fill-slate-100 dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700 hover:stroke-[var(--primary)] transition-colors"
                    strokeWidth="1.5"
                  />
                  <text
                    x={pt.x + 10}
                    y={pt.y + 22}
                    className="fill-slate-800 dark:fill-slate-200 text-[11px] font-bold"
                  >
                    {pt.name}
                  </text>
                  <text
                    x={pt.x + 10}
                    y={pt.y + 40}
                    className="fill-slate-500 dark:fill-slate-400 text-[9px]"
                  >
                    {pt.type}
                  </text>
                  <text
                    x={pt.x + 10}
                    y={pt.y + 55}
                    className="fill-[var(--primary)] text-[9px] font-mono"
                  >
                    {pt.detail}
                  </text>
                </g>
              ))}

            {/* Venue Boundary Container */}
            <rect
              x="230"
              y="90"
              width="610"
              height="340"
              rx="12"
              fill="none"
              stroke="#0f5b52"
              strokeWidth="2"
              strokeDasharray="8,6"
              opacity="0.4"
            />
            <text x="240" y="80" className="fill-[var(--primary)] text-[10px] font-bold tracking-widest uppercase">
              YESummit Convention Complex (Indoor Perimeter)
            </text>

            {/* Venue Floor Plan Rooms (Normal, Attention, Critical) */}
            {rooms.map((room) => {
              const stateStyle = {
                Normal: {
                  fill: 'fill-teal-50 dark:fill-slate-900/90',
                  stroke: 'stroke-teal-600/40 dark:stroke-teal-500/30',
                  badge: '● Normal',
                  badgeColor: 'fill-emerald-600 dark:fill-emerald-400'
                },
                Attention: {
                  fill: 'fill-amber-500/10 dark:fill-amber-900/20',
                  stroke: 'stroke-amber-500 dark:stroke-amber-400',
                  badge: '■ Attention',
                  badgeColor: 'fill-amber-600 dark:fill-amber-400'
                },
                Critical: {
                  fill: 'fill-red-500/15 dark:fill-red-900/30',
                  stroke: 'stroke-red-500 dark:stroke-red-400',
                  badge: '▲ Critical',
                  badgeColor: 'fill-red-600 dark:fill-red-400'
                }
              }[room.state];

              return (
                <g
                  key={room.id}
                  onClick={() =>
                    setActiveMarker({
                      type: 'room',
                      data: room
                    })
                  }
                  className="cursor-pointer group"
                >
                  <rect
                    x={room.x}
                    y={room.y}
                    width={room.width}
                    height={room.height}
                    rx="6"
                    className={`${stateStyle.fill} ${stateStyle.stroke} group-hover:stroke-[var(--primary)] transition-all`}
                    strokeWidth={room.state === 'Critical' ? '2.5' : '1.5'}
                  />

                  {/* Pulsing indicator for Critical */}
                  {room.state === 'Critical' && (
                    <circle
                      cx={room.x + room.width - 15}
                      cy={room.y + 15}
                      r="6"
                      className="fill-red-500 animate-ping opacity-75"
                    />
                  )}

                  {/* Room Label */}
                  <text
                    x={room.x + 10}
                    y={room.y + 20}
                    className="fill-slate-900 dark:fill-slate-100 text-[11px] font-bold"
                  >
                    {room.name}
                  </text>
                  <text
                    x={room.x + 10}
                    y={room.y + 35}
                    className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono"
                  >
                    Cap: {room.capacity}
                  </text>
                  <text
                    x={room.x + 10}
                    y={room.y + 50}
                    className={`${stateStyle.badgeColor} text-[9px] font-semibold`}
                  >
                    {stateStyle.badge}
                  </text>
                  <text
                    x={room.x + 10}
                    y={room.y + room.height - 10}
                    className="fill-slate-400 dark:fill-slate-500 text-[8.5px] truncate"
                  >
                    {room.note}
                  </text>
                </g>
              );
            })}

            {/* Emergency / AED Points Layer */}
            {showEmergency &&
              emergencyPoints.map((ep) => (
                <g key={ep.id} className="cursor-pointer" onClick={() => setActiveMarker({ type: 'room', data: { name: ep.name, status: 'Active Emergency Hub', note: 'Checked 08:00 AM' } })}>
                  <circle cx={ep.x} cy={ep.y} r="7" className="fill-red-600 stroke-white stroke-1" />
                  <text x={ep.x} y={ep.y + 3.5} textAnchor="middle" className="fill-white text-[9px] font-bold">
                    +
                  </text>
                  <text x={ep.x + 10} y={ep.y + 3} className="fill-red-600 text-[8px] font-bold">
                    {ep.name.split(' ')[0]}
                  </text>
                </g>
              ))}

            {/* Volunteers Layer: Diamonds (clamped to their zone) */}
            {showVolunteers &&
              volunteers.map((vol) => {
                const color = {
                  AVAILABLE: '#16a34a',
                  ASSIGNED: '#0284c7',
                  BUSY: '#d97706',
                  OFFLINE: '#64748b'
                }[vol.status];

                const isOffline = vol.status === 'OFFLINE';

                return (
                  <g
                    key={vol.id}
                    onClick={() => {
                      onSelectVolunteer(vol);
                      setActiveMarker({ type: 'volunteer', data: vol });
                    }}
                    className="cursor-pointer group"
                    transform={`translate(${vol.x}, ${vol.y})`}
                  >
                    {/* Diamond Marker */}
                    <path
                      d="M 0 -8 L 8 0 L 0 8 L -8 0 Z"
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="group-hover:scale-125 transition-transform"
                    />
                    <text
                      y="16"
                      textAnchor="middle"
                      className="fill-slate-800 dark:fill-slate-200 text-[9px] font-bold font-mono pointer-events-none"
                    >
                      {vol.id}
                    </text>
                    <text
                      y="25"
                      textAnchor="middle"
                      className="fill-slate-500 dark:fill-slate-400 text-[8px] pointer-events-none"
                    >
                      {vol.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}

            {/* Vehicles Layer: Circles with vehicle symbol & ID */}
            {showVehicles &&
              vehicles.map((vh) => {
                const vColor = {
                  ON_TIME: '#16a34a',
                  DELAYED: '#d97706',
                  BREAKDOWN: '#dc2626',
                  STANDBY: '#64748b',
                  MAINTENANCE: '#475569'
                }[vh.status];

                return (
                  <g
                    key={vh.id}
                    onClick={() => {
                      onSelectVehicle(vh);
                      setActiveMarker({ type: 'vehicle', data: vh });
                    }}
                    className="cursor-pointer group"
                    transform={`translate(${vh.x}, ${vh.y})`}
                  >
                    {/* Pulsing alert if breakdown */}
                    {vh.status === 'BREAKDOWN' && (
                      <circle cx="0" cy="0" r="14" className="fill-red-500 animate-ping opacity-75" />
                    )}
                    <circle
                      cx="0"
                      cy="0"
                      r="10"
                      fill={vColor}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="group-hover:scale-125 transition-transform"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      className="fill-white text-[9px] font-bold font-mono pointer-events-none"
                    >
                      V
                    </text>
                    <text
                      x="0"
                      y="18"
                      textAnchor="middle"
                      className="fill-slate-900 dark:fill-slate-100 text-[9px] font-mono font-bold pointer-events-none"
                    >
                      {vh.id}
                    </text>
                  </g>
                );
              })}

            {/* Incidents Layer: Triangles with '!' */}
            {showIncidents &&
              incidents
                .filter((inc) => inc.status !== 'RESOLVED')
                .map((inc) => {
                  // Coordinate anchoring based on incident location
                  let incX = 320;
                  let incY = 310;
                  if (inc.location.includes('Hall B')) {
                    incX = 330;
                    incY = 310;
                  } else if (inc.location.includes('Main Hall')) {
                    incX = 530;
                    incY = 170;
                  } else if (inc.location.includes('Highway') || inc.location.includes('Exit 14')) {
                    incX = 195;
                    incY = 65;
                  }

                  return (
                    <g
                      key={inc.id}
                      onClick={() => {
                        onSelectIncident(inc);
                        setActiveMarker({ type: 'incident', data: inc });
                      }}
                      className="cursor-pointer group"
                      transform={`translate(${incX}, ${incY})`}
                    >
                      <circle cx="0" cy="0" r="14" className="fill-red-600 animate-ping opacity-75" />
                      <path
                        d="M 0 -11 L 11 9 L -11 9 Z"
                        fill="#dc2626"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="group-hover:scale-125 transition-transform"
                      />
                      <text
                        x="0"
                        y="6"
                        textAnchor="middle"
                        className="fill-white text-[10px] font-bold pointer-events-none"
                      >
                        !
                      </text>
                      <text
                        x="0"
                        y="20"
                        textAnchor="middle"
                        className="fill-red-600 font-mono font-bold text-[9px] pointer-events-none"
                      >
                        {inc.id}
                      </text>
                    </g>
                  );
                })}
          </svg>
        </div>

        {/* Selected Marker Detail Floating Card */}
        {activeMarker && (
          <div className="absolute bottom-4 right-4 max-w-sm w-full bg-[var(--card)] border border-[var(--line)] rounded-lg shadow-xl p-4 text-xs z-30 space-y-2">
            <div className="flex items-start justify-between border-b border-[var(--line)] pb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[var(--ink)]">
                  {activeMarker.type === 'vehicle'
                    ? `Vehicle: ${activeMarker.data.id}`
                    : activeMarker.type === 'volunteer'
                    ? `Volunteer: ${activeMarker.data.name}`
                    : activeMarker.type === 'incident'
                    ? `Incident: ${activeMarker.data.id}`
                    : activeMarker.data.name}
                </span>
              </div>
              <button
                onClick={() => setActiveMarker(null)}
                className="text-[var(--mute)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeMarker.type === 'vehicle' && (
              <div className="space-y-1">
                <div>Driver: <strong>{activeMarker.data.driver}</strong> ({activeMarker.data.phone})</div>
                <div>Route: <strong>{activeMarker.data.route}</strong></div>
                <div>Passengers: <strong>{activeMarker.data.passengers}</strong> · ETA: <strong>{activeMarker.data.eta}</strong></div>
                <div>Status: <span className="font-bold text-emerald-600">{activeMarker.data.status}</span></div>
              </div>
            )}

            {activeMarker.type === 'volunteer' && (
              <div className="space-y-1">
                <div>ID: <strong className="font-mono">{activeMarker.data.id}</strong> · Role: <strong>{activeMarker.data.role}</strong></div>
                <div>Zone: <strong>{activeMarker.data.zone}</strong></div>
                <div>Current Task: <em>{activeMarker.data.currentTask}</em></div>
                <div>Status: <span className="font-bold">{activeMarker.data.status}</span> · Contact: {activeMarker.data.phone}</div>
              </div>
            )}

            {activeMarker.type === 'incident' && (
              <div className="space-y-1">
                <div className="font-semibold text-red-600">{activeMarker.data.title}</div>
                <div>Location: <strong>{activeMarker.data.location}</strong></div>
                <div>Priority: <strong className="text-red-600">{activeMarker.data.priority}</strong> · Status: {activeMarker.data.status}</div>
                <div>Assigned: <strong>{activeMarker.data.assignedTeam}</strong></div>
              </div>
            )}

            {activeMarker.type === 'room' && (
              <div className="space-y-1">
                <div>Capacity / Type: <strong>{activeMarker.data.capacity}</strong></div>
                <div>Operational State: <strong>{activeMarker.data.state || activeMarker.data.status}</strong></div>
                <div>Note: <em>{activeMarker.data.note}</em></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mandatory Footnote according to spec */}
      <div className="p-3 rounded-md bg-[var(--card)] border border-[var(--line)] text-xs text-[var(--mute)] flex items-center gap-2">
        <Info className="w-4 h-4 text-[var(--primary)] shrink-0" />
        <span>
          <strong>Telemetry Notice:</strong> Markers and GPS telemetry are simulated in real-time within zone boundaries. Movements update dynamically every 1.2s and remain strictly clamped to assigned room boundaries or highway routes.
        </span>
      </div>
    </div>
  );
};
