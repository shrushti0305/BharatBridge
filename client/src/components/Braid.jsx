import React from "react";

const STREAM_COLORS = ["#e8a33d", "#3fa796", "#c77dff", "#5fb3e8", "#e8767a", "#8fd694", "#e8c93d"];

// Visualizes one speaker feed splitting into N simultaneous listener-language streams —
// the actual mechanic of this product, made visible rather than decorative.
export default function Braid({ languages }) {
  const width = 640;
  const height = Math.max(80, languages.length * 26 + 20);
  const trunkX = 70;
  const midY = height / 2;

  return (
    <div className="braid-wrap">
      <span className="braid-label">LIVE — SPLITTING INTO {languages.length || 0} LANGUAGE STREAM{languages.length === 1 ? "" : "S"}</span>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Live translation stream diagram">
        {/* source trunk */}
        <line x1="0" y1={midY} x2={trunkX} y2={midY} stroke="#f3f1ea" strokeWidth="2" opacity="0.6" />
        <circle cx="6" cy={midY} r="5" fill="#e8a33d" />

        {languages.map((lang, i) => {
          const y = 20 + i * 26;
          const color = STREAM_COLORS[i % STREAM_COLORS.length];
          const path = `M ${trunkX} ${midY} C ${trunkX + 60} ${midY}, ${trunkX + 40} ${y}, ${trunkX + 120} ${y}`;
          return (
            <g key={lang.code}>
              <path d={path} stroke={color} strokeWidth="2" fill="none" opacity="0.85" />
              <line x1={trunkX + 120} y1={y} x2={width - 90} y2={y} stroke={color} strokeWidth="2" opacity="0.35" strokeDasharray="1 5" />
              <circle cx={width - 90} cy={y} r="3.5" fill={color} />
              <text x={width - 80} y={y + 4} fill={color} fontSize="12" fontFamily="Space Grotesk, sans-serif">
                {lang.label}
              </text>
            </g>
          );
        })}

        {languages.length === 0 && (
          <text x={trunkX + 20} y={midY - 20} fill="#5c6376" fontSize="12" fontFamily="Space Grotesk, sans-serif">
            waiting for listeners to join…
          </text>
        )}
      </svg>
    </div>
  );
}
