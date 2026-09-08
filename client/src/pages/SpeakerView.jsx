import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { connectSocket } from "../socket.js";
import { createAzureRecognizer } from "../azureSpeechToText.js";
import CaptionBox from "../components/CaptionBox.jsx";
import Braid from "../components/Braid.jsx";

const LANG_LABELS = {}; // filled from /api/sessions/languages at runtime

export default function SpeakerView() {
  const { sessionId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micStarting, setMicStarting] = useState(false);
  const [lines, setLines] = useState([]);
  const [interim, setInterim] = useState("");
  const [roster, setRoster] = useState([]);
  const [ending, setEnding] = useState(false);
  const [summary, setSummary] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeToast, setActiveToast] = useState(null);

  const socketRef = useRef(null);
  const recognizerRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});

  useEffect(() => {
    api.languages().then(({ languages }) => setLanguages(languages));
  }, []);

  useEffect(() => {
    let cancelled = false;

    api
      .sessionDetail(token, sessionId)
      .then(({ session, transcript }) => {
        if (cancelled) return;
        if (session.speakerId && session.speakerId !== undefined) setSession(session);
        setLines(
          transcript.map((t) => ({ id: t.id, text: t.sourceText }))
        );
      })
      .catch((err) => setError(err.message));

    const socket = connectSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.emit("speaker:join", { sessionId }, (res) => {
      if (cancelled) return;
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSession((s) => ({ ...(s || {}), ...res.session }));
      setRoster(res.roster || []);
    });

    socket.on("roster:update", ({ languages }) => setRoster(languages));

    socket.on("session:summary-ready", ({ summary }) => setSummary(summary));

    // WebRTC PeerConnection Manager for zero-latency direct speaker audio stream
    socket.on("webrtc:signal", async ({ senderSocketId, type, sdp, candidate }) => {
      try {
        if (type === "request") {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          peerConnectionsRef.current[senderSocketId] = pc;

          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
          }

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              socket.emit("webrtc:signal", {
                targetSocketId: senderSocketId,
                type: "candidate",
                candidate: e.candidate,
              });
            }
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc:signal", {
            targetSocketId: senderSocketId,
            type: "offer",
            sdp: offer,
          });
        } else if (type === "answer") {
          const pc = peerConnectionsRef.current[senderSocketId];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } else if (type === "candidate") {
          const pc = peerConnectionsRef.current[senderSocketId];
          if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.warn("WebRTC speaker signaling error:", err);
      }
    });

    socket.emit("question:list", { sessionId }, (res) => {
      if (res?.questions) setQuestions(res.questions);
    });

    socket.on("question:new", (q) => {
      setQuestions((prev) => [q, ...prev.filter((item) => item.id !== q.id)]);
      setActiveToast(q);
      setTimeout(() => {
        setActiveToast((curr) => (curr?.id === q.id ? null : curr));
      }, 8000);
    });

    socket.on("question:updated", (q) => {
      setQuestions((prev) =>
        prev
          .map((item) => (item.id === q.id ? { ...item, ...q } : item))
          .sort((a, b) => b.upvotes - a.upvotes)
      );
    });

    return () => {
      cancelled = true;
      recognizerRef.current?.stop();
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [audioUrl, setAudioUrl] = useState(null);

  async function startAudioRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          // Periodically upload recorded microphone audio every ~5 seconds while speaking
          if (audioChunksRef.current.length > 0 && audioChunksRef.current.length % 5 === 0) {
            const liveBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            try {
              const res = await api.uploadSessionAudio(token, sessionId, liveBlob);
              if (res.audioUrl) {
                const fullUrl = `${api.serverUrl}${res.audioUrl}`;
                setAudioUrl(fullUrl);
                socketRef.current?.emit("speaker:audio-upload", { sessionId, audioUrl: fullUrl });
              }
            } catch (err) {
              console.warn("Live audio chunk sync pending...", err);
            }
          }
        }
      };
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          try {
            const res = await api.uploadSessionAudio(token, sessionId, blob);
            if (res.audioUrl) {
              const fullUrl = `${api.serverUrl}${res.audioUrl}`;
              setAudioUrl(fullUrl);
              socketRef.current?.emit("speaker:audio-upload", { sessionId, audioUrl: fullUrl });
            }
          } catch (err) {
            console.error("Failed to upload final session audio", err);
          }
        }
      };
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.warn("MediaRecorder start failed", err);
    }
  }

  function stopAudioRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
  }

  const queueRef = useRef([]);
  const processingRef = useRef(false);

  function processQueue() {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    const text = queueRef.current.shift();

    setInterim("");
    setLines((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].text === text) return prev;
      return [...prev, { id: `${Date.now()}-${Math.random()}`, text }];
    });

    socketRef.current?.emit("speaker:segment", { sessionId, text, isFinal: true });

    setTimeout(() => {
      processingRef.current = false;
      processQueue();
    }, 150);
  }

  function sendFinal(text) {
    if (!text?.trim()) return;
    const clean = text.trim();
    queueRef.current.push(clean);
    processQueue();
  }

  function toggleMic() {
    if (!session) return;
    if (micOn) {
      recognizerRef.current?.stop();
      stopAudioRecording();
      setMicOn(false);
      setInterim("");
      return;
    }
    const speakerLang = session.speakerLanguage || session.speaker_language || "auto";
    const langConfig =
      speakerLang === "auto" || speakerLang === "hinglish"
        ? speakerLang
        : languages.find((l) => l.code === speakerLang)?.bcp47 || "en-IN";
    setMicStarting(true);
    const recognizer = createAzureRecognizer({
      getToken: () => api.speechToken(token),
      lang: langConfig,
      onInterim: (text) => {
        setInterim(text);
        socketRef.current?.emit("speaker:interim", { sessionId, text });
      },
      onFinal: (text) => sendFinal(text),
      onError: (err) => {
        setError(`Microphone error: ${err}`);
        setMicOn(false);
        setMicStarting(false);
        stopAudioRecording();
      },
    });
    recognizerRef.current = recognizer;
    recognizer.start().then(() => {
      setMicStarting(false);
      setMicOn(true);
      startAudioRecording();
    });
  }

  async function endSession() {
    if (!confirm("End this session for everyone? Listeners will be disconnected and a summary will be generated.")) return;
    setEnding(true);
    recognizerRef.current?.stop();
    stopAudioRecording();
    setMicOn(false);
    socketRef.current?.emit("speaker:end", { sessionId }, (res) => {
      if (res?.error) {
        setError(res.error);
        setEnding(false);
      }
      // summary arrives asynchronously via session:summary-ready
    });
  }

  const totalListeners = roster.reduce((sum, r) => sum + r.listeners, 0);
  const rosterLangs = roster.map((r) => ({
    code: r.language,
    label: languages.find((l) => l.code === r.language)?.label || r.language,
  }));

  if (error) {
    return (
      <div className="main">
        <div className="error-banner">{error}</div>
        <Link to="/" className="btn">Back home</Link>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="console-header">
        <div>
          <span className="eyebrow">Speaker console</span>
          <h1 style={{ marginBottom: 4 }}>{session?.title || "Loading…"}</h1>
          <div className="status-row">
            <span className={connected ? "pulse-dot" : ""} />
            {connected ? "Connected" : "Connecting…"} · Join code{" "}
            <strong style={{ color: "var(--amber)" }}>{session?.joinCode}</strong> ·{" "}
            {totalListeners} listener{totalListeners === 1 ? "" : "s"}
            {micOn && (
              <>
                <span style={{ marginLeft: 8, padding: "2px 8px", background: "rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: 12, fontSize: 12, fontWeight: 600, border: "1px solid rgba(239,68,68,0.4)" }}>
                  🔴 REC Voice Recording
                </span>
                <span style={{ marginLeft: 8, padding: "2px 8px", background: "rgba(16,185,129,0.2)", color: "#10b981", borderRadius: 12, fontSize: 12, fontWeight: 600, border: "1px solid rgba(16,185,129,0.4)" }}>
                  🎙️ WebRTC Audio Live Stream
                </span>
              </>
            )}
          </div>
        </div>
        {session?.status === "live" && !summary && (
          <button className="btn btn-danger" onClick={endSession} disabled={ending}>
            {ending ? "Ending…" : "End session"}
          </button>
        )}
      </div>

      {activeToast && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 18px",
            background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(239,68,68,0.25))",
            border: "2px solid var(--amber)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(245,158,11,0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 800, color: "var(--amber)", letterSpacing: 1 }}>
              🔔 NEW LIVE AUDIENCE QUESTION FROM {activeToast.user_name || activeToast.userName || "AUDIENCE"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 2 }}>
              "{activeToast.translated_question || activeToast.translatedQuestion || activeToast.question}"
            </div>
            {activeToast.question && (activeToast.translated_question || activeToast.translatedQuestion) !== activeToast.question && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontStyle: "italic", marginTop: 2 }}>
                Original: "{activeToast.question}"
              </div>
            )}
          </div>
          <button
            onClick={() => setActiveToast(null)}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Dismiss ✕
          </button>
        </div>
      )}

      {summary ? (
        <SummaryPanel sessionId={sessionId} summary={summary} token={token} />
      ) : (
        <div className="console" style={{ marginTop: 24 }}>
          <div className="console-main">
            <button className={`mic-toggle ${micOn ? "on" : ""}`} onClick={toggleMic} disabled={micStarting || !session}>
              <span className="dot" />
              {micStarting ? "Starting…" : micOn ? "Listening — tap to pause" : "Tap to start speaking"}
            </button>

            <CaptionBox lines={lines} interim={interim} emptyLabel="Your speech will appear here as you talk." />
          </div>

          <div className="sidebar">
            <div className="sidebar-block">
              <h3>Share this session</h3>
              <div className="join-code">{session?.joinCode || "······"}</div>
              <p style={{ marginTop: 6, marginBottom: 12, fontSize: 13, color: "var(--text-muted)" }}>
                Listeners enter code <strong style={{ color: "var(--amber)" }}>{session?.joinCode}</strong> or scan QR code on mobile.
              </p>
              {session?.id && (
                <div style={{ textAlign: "center", background: "#ffffff", padding: "12px 8px", borderRadius: 10 }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      `${window.location.protocol}//${window.location.hostname}:5173/listen/${session.id}`
                    )}`}
                    alt="Scan to join session"
                    style={{ width: 150, height: 150, display: "block", margin: "0 auto" }}
                  />
                  <span style={{ fontSize: 11, color: "#222", fontWeight: 600, marginTop: 6, display: "block" }}>
                    Scan with phone camera to listen
                  </span>
                </div>
              )}
            </div>
            <div className="sidebar-block">
              <h3>Live language streams</h3>
              <Braid languages={rosterLangs} />
            </div>

            <div className="sidebar-block">
              <h3>❓ Audience Questions (Translated)</h3>
              <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--text-muted)" }}>
                Questions from listeners translated into your language ({session?.speakerLanguage})
              </p>
              {questions.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                  No audience questions submitted yet.
                </div>
              ) : (
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {questions.map((q) => (
                    <div
                      key={q.id}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        padding: "8px 10px",
                        borderRadius: 6,
                        marginBottom: 8,
                        borderLeft: "3px solid var(--amber)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                          By {q.user_name || q.userName || "Audience"}
                        </span>
                        <span style={{ fontSize: 11, background: "rgba(245,158,11,0.2)", color: "var(--amber)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                          👍 {q.upvotes}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>
                        {q.translated_question || q.translatedQuestion || q.question}
                      </div>
                      {q.question && (q.translated_question || q.translatedQuestion) !== q.question && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>
                          Original: "{q.question}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sidebar-block">
              <h3>📥 Speaker Downloads & Exports</h3>
              <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--text-muted)" }}>
                Export master spoken transcript, subtitles, and recorded audio
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <a
                  href={`${api.serverUrl}/api/sessions/${sessionId}/export?format=txt`}
                  download={`transcript-${sessionId}.txt`}
                  className="btn btn-block"
                  style={{ fontSize: 12, textDecoration: "none", background: "rgba(255,255,255,0.08)", textAlign: "left" }}
                >
                  📄 Download Master Spoken Transcript (.txt)
                </a>
                <a
                  href={`${api.serverUrl}/api/sessions/${sessionId}/export?format=srt`}
                  download={`subtitles-${sessionId}.srt`}
                  className="btn btn-block"
                  style={{ fontSize: 12, textDecoration: "none", background: "rgba(255,255,255,0.08)", textAlign: "left" }}
                >
                  🎬 Download Video Subtitles (.srt)
                </a>
                {(audioUrl || session?.audioUrl) && (
                  <a
                    href={audioUrl || `${api.serverUrl}${session.audioUrl}`}
                    download={`recording-${sessionId}.webm`}
                    className="btn btn-block"
                    style={{ fontSize: 12, textDecoration: "none", background: "rgba(255,255,255,0.08)", textAlign: "left" }}
                  >
                    🎙️ Download Speaker Voice Audio (.webm)
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryPanel({ sessionId, summary: initialSummary, token }) {
  const [summary, setSummary] = useState(initialSummary);
  const [generating, setGenerating] = useState(false);

  async function handleRegenerate() {
    setGenerating(true);
    try {
      const res = await api.summarizeSession(token, sessionId);
      if (res.summary) setSummary(res.summary);
    } catch {
      /* ignore */
    } finally {
      setGenerating(false);
    }
  }

  const isFailed = !summary || summary.includes("We weren't able to generate");

  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <span className="eyebrow">Session ended</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Notes from this session</h2>
        <button className="btn btn-sm" onClick={handleRegenerate} disabled={generating}>
          {generating ? "Generating notes…" : isFailed ? "Generate Notes" : "Regenerate notes"}
        </button>
      </div>
      <div className="summary-body" dangerouslySetInnerHTML={{ __html: markdownToHtml(summary) }} />
      <Link to="/history" className="btn" style={{ marginTop: 16 }}>
        Back to My Sessions
      </Link>
    </div>
  );
}

// Minimal, safe-enough markdown renderer for the handful of constructs our summaries use
// (##, ###, bullet lists, paragraphs). No arbitrary HTML from the model is ever injected raw.
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