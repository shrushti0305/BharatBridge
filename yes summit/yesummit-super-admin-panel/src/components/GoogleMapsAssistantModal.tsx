import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Search,
  ExternalLink,
  Sparkles,
  Loader2,
  X,
  Compass,
  Car,
  BatteryCharging,
  Hospital,
  Building,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  queryGoogleMapsGrounding,
  MapPlaceLink,
  MapsGroundingResponse
} from '../services/mapsGroundingService';

interface GoogleMapsAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  contextTitle?: string;
}

export const GoogleMapsAssistantModal: React.FC<GoogleMapsAssistantModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = '',
  contextTitle
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MapsGroundingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presetQueries = [
    {
      label: 'Changi VIP CIP to Venue Corridor',
      icon: Car,
      query:
        'What is the best route and current transit situation from Changi Airport VIP CIP Terminal (Terminal 1) to Marina Bay Sands Singapore? Highlight major expressway corridors and potential choke points.',
    },
    {
      label: 'Nearby EV Fast Charging Hubs',
      icon: BatteryCharging,
      query:
        'Find high-capacity DC fast EV charging stations near Marina Bay Sands and Suntec Singapore suitable for conference executive fleet vehicles.',
    },
    {
      label: 'Emergency Trauma Hospitals',
      icon: Hospital,
      query:
        'List the nearest major 24/7 emergency medical trauma hospitals and acute care medical centres around Marina Bay Singapore.',
    },
    {
      label: 'VIP Delegation Hotels & Access',
      icon: Building,
      query:
        'Where are The Fullerton Hotel, Raffles Hotel, and Marina Bay Sands located relative to Suntec City? List their official addresses and motorcade arrival drop-offs.',
    },
    {
      label: 'Seletar VIP Jet Terminal Route',
      icon: Compass,
      query:
        'Analyze the transit route from Seletar Airport Private Jet Terminal to Marina Bay Sands Singapore via CTE, including transit distance and landmarks.',
    },
  ];

  useEffect(() => {
    if (initialPrompt && isOpen) {
      setPrompt(initialPrompt);
      handleExecuteQuery(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  const handleExecuteQuery = async (queryToRun: string) => {
    const q = queryToRun || prompt;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await queryGoogleMapsGrounding(q);
      setResult(data);
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to retrieve Google Maps grounded data. Please ensure GEMINI_API_KEY is configured in Settings > Secrets.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[var(--card)] rounded-xl max-w-3xl w-full border border-[var(--line)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/15 backdrop-blur-xs flex items-center justify-center">
              <MapPin className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-wide uppercase">
                  Google Maps Operational Intelligence
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/20 text-white">
                  gemini-3.5-flash + googleMaps
                </span>
              </div>
              <p className="text-[11px] text-white/80">
                Ground-truth geographic validation, live transit routes, and place verification for YESummit 2027
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {contextTitle && (
            <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-between">
              <span className="font-semibold">Context: {contextTitle}</span>
              <span className="text-[10px] font-mono">Singapore Coordinates (1.2838° N, 103.8591° E)</span>
            </div>
          )}

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--mute)] uppercase tracking-wider">
                Tactical Maps Queries
              </span>
              <span className="text-[10px] text-[var(--mute)]">Click any preset to run query</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presetQueries.map((preset, idx) => {
                const IconComponent = preset.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPrompt(preset.query);
                      handleExecuteQuery(preset.query);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--bg)] border border-[var(--line)] hover:border-sky-500 hover:text-sky-600 transition-colors text-[11px] cursor-pointer"
                  >
                    <IconComponent className="w-3.5 h-3.5 text-sky-500" />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Input Box */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteQuery(prompt);
                }}
                placeholder="Ask Google Maps (e.g., 'Find parking lots near Marina Bay Sands' or 'Traffic to Changi T1')..."
                className="w-full text-xs pl-3 pr-24 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--mute)] focus:outline-hidden focus:border-sky-500"
              />
              <button
                type="button"
                disabled={loading || !prompt.trim()}
                onClick={() => handleExecuteQuery(prompt)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Querying...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask Maps</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-semibold">{error}</p>
                <p className="text-[10px] text-[var(--mute)] mt-1">
                  Ensure you have an active Gemini API key attached in the AI Studio Settings &gt; Secrets panel.
                </p>
              </div>
            </div>
          )}

          {/* Result Area */}
          {result && (
            <div className="space-y-4 pt-1">
              {/* Quota limit or fallback notice */}
              {result.quotaExceededNotice && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>{result.quotaExceededNotice}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-200">
                    Tactical Offline Cache
                  </span>
                </div>
              )}

              {/* Verified Google Maps Places Links (Mandatory for Maps Grounding) */}
              {result.mapPlaces && result.mapPlaces.length > 0 && (
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Verified Google Maps Places & Direct Links</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                      {result.mapPlaces.length} places grounded
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.mapPlaces.map((place, pIdx) => (
                      <a
                        key={pIdx}
                        href={place.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-md bg-[var(--card)] border border-[var(--line)] hover:border-emerald-500 flex items-center justify-between text-xs transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-[var(--ink)] truncate group-hover:text-emerald-600">
                            {place.title}
                          </span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--mute)] group-hover:text-emerald-600 shrink-0 ml-1" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Grounded Response Narrative */}
              <div className="p-4 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                  <span className="font-bold text-xs text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    <span>Grounded Operational Briefing</span>
                  </span>
                  <span className="text-[10px] text-[var(--mute)] font-mono">
                    Grounded with Google Maps tool
                  </span>
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-[var(--ink)] whitespace-pre-wrap leading-relaxed">
                  {result.text}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[var(--bg)] border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--mute)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Connected to Google Maps Grounding via Server Proxy</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
