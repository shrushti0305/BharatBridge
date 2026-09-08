import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function SessionDetail() {
  const { sessionId } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [summaryLang, setSummaryLang] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.sessionDetail(token, sessionId).then((res) => {
      setData(res);
      setSummary(res.session.summary);
      setSummaryLang(res.myLanguage || "en");
    }).catch((e) => setError(e.message));
  }, [token, sessionId]);

  async function handleGenerateSummary() {
    setGenerating(true);
    try {
      const res = await api.summarizeSession(token, sessionId);
      if (res.summary) setSummary(res.summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleTranslateSummary(lang) {
    setSummaryLang(lang);
    setGenerating(true);
    try {
      const res = await api.sessionDetail(token, `${sessionId}?lang=${lang}`);
      if (res.session?.summary) setSummary(res.session.summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  if (error) {
    return (
      <div className="main">
        <div className="error-banner">{error}</div>
        <Link to="/history" className="btn">Back to My Sessions</Link>
      </div>
    );
  }
  if (!data) return <div className="main"><p>Loading…</p></div>;

  const { session, role, transcript } = data;
  const isFailedSummary = !summary || summary.includes("We weren't able to generate");

  return (
    <div className="main">
      <span className="eyebrow">{role === "speaker" ? "You spoke at this session" : "You listened to this session"}</span>
      <h1 style={{ marginBottom: 6 }}>{session.title}</h1>
      <p>
        {new Date(session.createdAt).toLocaleString()}
        {session.endedAt ? ` — ended ${new Date(session.endedAt).toLocaleString()}` : ""}
      </p>

      {session.audioUrl && (
        <div className="panel" style={{ marginBottom: 24, borderLeft: "4px solid var(--amber)" }}>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 16 }}>🎙️ Original Speaker Voice Recording</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
            Re-listen to or download the actual live microphone recording spoken by the speaker in this session.
          </p>
          <audio controls src={`${api.serverUrl}${session.audioUrl}`} style={{ width: "100%" }} />
          <a
            href={`${api.serverUrl}${session.audioUrl}`}
            download={`recording-${session.id}.webm`}
            className="btn btn-primary"
            style={{ marginTop: 12, textDecoration: "none", display: "inline-block" }}
          >
            💾 Download Original Voice Recording (.webm)
          </a>
        </div>
      )}

      {summary && !isFailedSummary ? (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0 }}>Session notes</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Language:</label>
              <select
                value={summaryLang}
                onChange={(e) => handleTranslateSummary(e.target.value)}
                style={{ fontSize: 13, padding: "4px 8px" }}
              >
                <option value="en">English</option>
                <option value="hi">Hindi (हिंदी)</option>
                <option value="mr">Marathi (मराठी)</option>
                <option value="bn">Bengali (বাংলা)</option>
                <option value="ta">Tamil (தமிழ்)</option>
                <option value="te">Telugu (తెలుగు)</option>
                <option value="kn">Kannada (ಕನ್ನಡ)</option>
                <option value="gu">Gujarati (ગુજરાતી)</option>
                <option value="ml">Malayalam (മലയാളം)</option>
                <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                <option value="or">Odia (ଓଡ଼ିଆ)</option>
              </select>
              <button className="btn btn-sm" onClick={handleGenerateSummary} disabled={generating}>
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
            </div>
          </div>
          <div className="summary-body" dangerouslySetInnerHTML={{ __html: markdownToHtml(summary) }} />
        </div>
      ) : session.status === "live" ? (
        <div className="panel" style={{ marginBottom: 24 }}>
          <p style={{ margin: 0 }}>This session is still live.</p>
          <Link
            to={role === "speaker" ? `/speak/${session.id}` : `/listen/${session.id}`}
            className="btn btn-primary"
            style={{ marginTop: 12 }}
          >
            Rejoin live
          </Link>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 24 }}>
          <h2>Session notes</h2>
          <p>Generate a structured summary with key points and action items from this talk.</p>
          <button className="btn btn-primary" onClick={handleGenerateSummary} disabled={generating || transcript.length === 0}>
            {generating ? "Generating notes…" : "Generate Session Notes"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Full transcript</h2>
        {transcript.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
              onClick={() => {
                const textsToSpeak = transcript.map((t) => t.translatedText || t.text || t.sourceText).filter(Boolean);
                if (textsToSpeak.length === 0) return;
                window.speechSynthesis.cancel();
                const fullText = textsToSpeak.join(". ");
                const utterance = new SpeechSynthesisUtterance(fullText);
                utterance.rate = 0.95;
                window.speechSynthesis.speak(utterance);
              }}
            >
              🎧 Play Translated Audio
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
              onClick={() => {
                const content = [
                  `==================================================`,
                  `  ${(session?.title || "Session Transcript").toUpperCase()}`,
                  `  Date: ${new Date(session?.createdAt).toLocaleString()}`,
                  `==================================================\n`,
                  ...transcript.map((t, i) => `[Line ${i + 1}] ${t.translatedText || t.text || t.sourceText}`),
                  `\n--- Exported from BharatBridge ---`,
                ].join("\n");
                const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `transcript-${session.id}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              📄 Export Transcript (.txt)
            </button>
          </div>
        )}
      </div>
      {transcript.length === 0 && <p>No speech was recorded in this session.</p>}
      <div className="panel transcript-list">
        {transcript.map((t) => (
          <div key={t.id} className="transcript-row">
            {role === "listener" && t.translatedText ? (
              <>
                <div className="transcript-source">{t.sourceText}</div>
                <div className="transcript-translated">{t.translatedText}</div>
              </>
            ) : (
              <div className="transcript-translated">{t.sourceText}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function markdownToHtml(md) {
  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = escape(md).split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h2>${line.replace(/^##\s+/, "")}</h2>`;
    } else if (/^-\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${line.replace(/^-\s+/, "")}</li>`;
    } else if (line.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${line}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}
