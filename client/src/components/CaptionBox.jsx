import React, { useEffect, useRef } from "react";

export default function CaptionBox({ lines, interim, emptyLabel }) {
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines, interim]);

  return (
    <div className="caption-box" ref={boxRef}>
      {lines.length === 0 && !interim && <div className="caption-empty">{emptyLabel}</div>}
      {lines.map((line, i) => (
        <div
          key={line.id || i}
          className={`caption-line ${i === lines.length - 1 ? "latest" : ""}`}
          style={{
            marginBottom: 12,
            paddingBottom: 10,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--amber)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Line {i + 1}
            </span>
          </div>
          {line.sourceText && line.sourceText !== line.text && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4, fontStyle: "italic" }}>
              🎙️ <strong>Speaker:</strong> {line.sourceText}
            </div>
          )}
          <div style={{ fontSize: 15, color: "#ffffff", fontWeight: 500, lineHeight: 1.4 }}>
            {line.sourceText && line.sourceText !== line.text ? (
              <span>🌐 <strong>Translation:</strong> {line.text}</span>
            ) : (
              line.text
            )}
          </div>
        </div>
      ))}
      {interim && (
        <div className="caption-line interim" style={{ paddingLeft: 10, borderLeft: "3px dashed var(--amber)" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Speaking now…</div>
          <div>{interim}</div>
        </div>
      )}
    </div>
  );
}
