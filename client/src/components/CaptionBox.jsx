import React, { useEffect, useRef, useState } from "react";

export default function CaptionBox({ lines, interim, emptyLabel }) {
  const boxRef = useRef(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const scrollToBottom = () => {
    if (boxRef.current) {
      boxRef.current.scrollTo({
        top: boxRef.current.scrollHeight,
        behavior: "smooth",
      });
      setUserScrolled(false);
    }
  };

  useEffect(() => {
    if (boxRef.current && !userScrolled) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [lines, interim, userScrolled]);

  const handleScroll = () => {
    if (!boxRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = boxRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setUserScrolled(!isAtBottom);
  };

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        className="caption-box"
        ref={boxRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          borderRadius: "14px",
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        {lines.length === 0 && !interim && (
          <div className="caption-empty" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎙️</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{emptyLabel || "Waiting for speaker to start talking…"}</div>
            <div style={{ fontSize: 13, marginTop: 6, opacity: 0.7 }}>Live translated captions will appear here in real-time.</div>
          </div>
        )}

        {lines.map((line, i) => {
          const isLatest = i === lines.length - 1;
          const isTranslated = line.sourceText && line.sourceText.trim() !== line.text.trim();

          return (
            <div
              key={line.id || i}
              className={`caption-line-card ${isLatest ? "latest" : ""}`}
              style={{
                marginBottom: 14,
                padding: "14px 16px",
                borderRadius: "12px",
                background: isLatest ? "rgba(30, 41, 59, 0.85)" : "rgba(30, 41, 59, 0.45)",
                border: isLatest ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(255, 255, 255, 0.05)",
                boxShadow: isLatest ? "0 4px 20px rgba(0,0,0,0.25)" : "none",
                transition: "all 0.25s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: isLatest ? "var(--amber)" : "#94a3b8",
                    background: "rgba(255,255,255,0.06)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    textTransform: "uppercase",
                  }}
                >
                  Line #{i + 1}
                </span>
              </div>

              {/* Speaker Original Spoken Sentence */}
              {isTranslated && (
                <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 2 }}>
                    🎙️ Speaker (Original)
                  </div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", fontStyle: "italic", lineHeight: 1.4 }}>
                    {line.sourceText}
                  </div>
                </div>
              )}

              {/* Target Translation Sentence */}
              <div>
                {isTranslated && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--amber)", marginBottom: 2 }}>
                    🌐 Translation
                  </div>
                )}
                <div
                  style={{
                    fontSize: isLatest ? 17 : 15,
                    color: "#ffffff",
                    fontWeight: isLatest ? 600 : 500,
                    lineHeight: 1.45,
                  }}
                >
                  {line.text}
                </div>
              </div>
            </div>
          );
        })}

        {interim && (
          <div
            className="caption-line interim"
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "rgba(245, 158, 11, 0.08)",
              borderLeft: "4px solid var(--amber)",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--amber)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
              ⚡ Speaking now…
            </div>
            <div style={{ fontSize: 15, color: "#f8fafc", fontStyle: "italic" }}>{interim}</div>
          </div>
        )}
      </div>

      {userScrolled && (
        <button
          onClick={scrollToBottom}
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--amber)",
            color: "#000000",
            border: "none",
            borderRadius: "20px",
            padding: "8px 18px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
            zIndex: 10,
          }}
        >
          👇 New captions below
        </button>
      )}
    </div>
  );
}
