import React from 'react';
import {
  CloudRain,
  Wind,
  Thermometer,
  ShieldCheck,
  MapPin,
  Command,
  FileText,
  Volume2,
  VolumeX,
  Sparkles
} from 'lucide-react';

interface EnvironmentalRibbonProps {
  onOpenCommandPalette: () => void;
  onOpenShiftBriefing: () => void;
  onSimulateScan: () => void;
  isAudioMuted: boolean;
  onToggleAudioMute: () => void;
}

export const EnvironmentalRibbon: React.FC<EnvironmentalRibbonProps> = ({
  onOpenCommandPalette,
  onOpenShiftBriefing,
  onSimulateScan,
  isAudioMuted,
  onToggleAudioMute,
}) => {
  return (
    <div className="bg-[var(--card)] border-b border-[var(--line)] px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Venue & Coordinates */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
          <MapPin className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
          <span>Sands Expo (MBS) & Suntec Singapore</span>
          <span className="font-mono text-[10px] text-[var(--mute)] hidden xl:inline">
            (1.2838° N, 103.8591° E)
          </span>
        </div>

        <span className="text-[var(--line)] hidden sm:inline">|</span>

        {/* NEA Weather & Atmospheric Sensor */}
        <div className="flex items-center gap-3 text-[11px] text-[var(--mute)]">
          <div className="flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-amber-500" />
            <span className="text-[var(--ink)] font-medium">29°C</span>
            <span className="hidden sm:inline">(Feels 33°C)</span>
          </div>

          <div className="flex items-center gap-1">
            <CloudRain className="w-3 h-3 text-sky-500" />
            <span className="hidden md:inline">Scattered Afternoon Showers ·</span>
            <span>Precip 20%</span>
          </div>

          <div className="flex items-center gap-1">
            <Wind className="w-3 h-3 text-emerald-500" />
            <span>NEA PSI:</span>
            <span className="font-mono font-bold text-emerald-600 bg-emerald-500/10 px-1 py-0.2 rounded">
              36 (Good)
            </span>
          </div>
        </div>
      </div>

      {/* Production Quick Shortcuts */}
      <div className="flex items-center gap-2">
        {/* Master Mute Toggle */}
        <button
          type="button"
          onClick={onToggleAudioMute}
          className={`p-1.5 rounded border border-[var(--line)] transition-colors cursor-pointer ${
            isAudioMuted
              ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
              : 'text-[var(--ink)] hover:bg-[var(--line)]/50'
          }`}
          title={isAudioMuted ? 'Tactical Audio Muted (Click to Unmute)' : 'Tactical Audio Active (Click to Mute)'}
        >
          {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-amber-500" />}
        </button>

        {/* Quick Test Scan */}
        <button
          type="button"
          onClick={onSimulateScan}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-amber-500 text-[var(--ink)] transition-colors cursor-pointer"
          title="Simulate immediate VIP RFID/QR turnstile clearance"
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span className="hidden sm:inline">Simulate Scan</span>
        </button>

        {/* Shift Handover PDF Briefing */}
        <button
          type="button"
          onClick={onOpenShiftBriefing}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] transition-colors cursor-pointer"
          title="Open printable Commander Shift Handover Report"
        >
          <FileText className="w-3 h-3 text-[var(--primary)]" />
          <span className="hidden sm:inline">Shift Briefing</span>
        </button>

        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 border border-[var(--primary)]/30 text-[var(--primary)] transition-colors cursor-pointer"
          title="Open Command Palette (or press ⌘K / Ctrl+K)"
        >
          <Command className="w-3 h-3" />
          <span className="font-mono text-[10px]">⌘K Command Deck</span>
        </button>
      </div>
    </div>
  );
};
