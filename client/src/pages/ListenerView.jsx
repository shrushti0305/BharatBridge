import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { connectSocket } from "../socket.js";
import { createAzureSpeaker, unlockAudioEngine } from "../azureTextToSpeech.js";
import CaptionBox from "../components/CaptionBox.jsx";
import LanguageSelect from "../components/LanguageSelect.jsx";

export default function ListenerView() {
  const { sessionId } = useParams();
  const { token } = useAuth();

  const [session, setSession] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [language, setLanguage] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState([]);
  const [interim, setInterim] = useState("");
  const [ended, setEnded] = useState(false);
  const [summary, setSummary] = useState(null);
  const [audioOn, setAudioOn] = useState(true);
  const [voiceGender, setVoiceGender] = useState("female");
  const [speechPace, setSpeechPace] = useState("0.94");
  const [listenerCount, setListenerCount] = useState(null);
  const [consented, setConsented] = useState(false);
  const [liveAudioUrl, setLiveAudioUrl] = useState(null);
  const [qSubmitted, setQSubmitted] = useState(false);

  const socketRef = useRef(null);
  const speakerTtsRef = useRef(null);
  const spokenSegmentsRef = useRef(new Set());
  const rtcPeerRef = useRef(null);
  const rtcAudioRef = useRef(null);
  const [webrtcActive, setWebrtcActive] = useState(false);

  function startWebRtcAudio() {
    if (!socketRef.current || !session?.speakerSocketId) return;
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      rtcPeerRef.current = pc;

      pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          if (!rtcAudioRef.current) rtcAudioRef.current = new Audio();
          rtcAudioRef.current.srcObject = e.streams[0];
          rtcAudioRef.current.play().catch(console.warn);
          setWebrtcActive(true);
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && session?.speakerSocketId) {
          socketRef.current.emit("webrtc:signal", {
            targetSocketId: session.speakerSocketId,
            type: "candidate",
            candidate: e.candidate,
          });
        }
      };

      socketRef.current.emit("webrtc:signal", {
        targetSocketId: session.speakerSocketId,
        type: "request",
      });
    } catch (err) {
      console.warn("WebRTC connection failed", err);
    }
  }

  function exportTranscriptTxt() {
    if (!lines || lines.length === 0) return;
    const title = session?.title || "BharatBridge Session";
    const date = new Date().toLocaleString();
    const content = [
      `==================================================`,
      `  ${title.toUpperCase()}`,
      `  Date: ${date}`,
      `  Session Code: ${session?.joinCode || ""}`,
      `  Selected Language: ${language || "en"}`,
      `==================================================\n`,
      ...lines.map((l, i) => {
        if (l.sourceText && l.sourceText !== l.text) {
          return `[Line ${i + 1}]\n🎙️ Speaker (Original): ${l.sourceText}\n🌐 Translation (${language || "en"}): ${l.text}\n`;
        }
        return `[Line ${i + 1}] ${l.text}`;
      }),
      `\n--- Exported from BharatBridge ---`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${sessionId || "export"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    api.languages().then(({ languages }) => setLanguages(languages));
  }, []);

  // Establish the socket once languages are loaded (need language list to default-pick one
  // and to resolve the Azure voice name for TTS).
  useEffect(() => {
    if (languages.length === 0 || !consented) return;
    let cancelled = false;

    api
      .sessionDetail(token, sessionId)
      .then(({ session, myLanguage, transcript }) => {
        if (cancelled) return;
        setSession(session);
        setLanguage(myLanguage);
        setLines(
          transcript
            .filter((t) => t.translatedText || t.sourceText)
            .map((t) => ({ id: t.id, text: t.translatedText || t.sourceText, sourceText: t.sourceText }))
        );
      })
      .catch(() => {
        // No prior participation record yet (first time joining) — that's fine, fall back below.
        setSession((s) => s || { id: sessionId });
        setLanguage((l) => l || "en");
      });

    const socket = connectSocket(token);
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("caption:interim", ({ text }) => {
      setInterim(text);
    });

    const handleCaption = (c, isLanguageSpecific = false) => {
      setInterim("");
      const targetText = c.text || c.sourceText;

      setLines((prev) => {
        const existingIdx = prev.findIndex((l) => l.id === c.segmentId);
        if (existingIdx !== -1) {
          // If we previously received untranslated sourceText and now receive translated text, update the line!
          const existing = prev[existingIdx];
          if (c.text && existing.text !== c.text) {
            const copy = [...prev];
            copy[existingIdx] = {
              ...existing,
              text: c.text,
              sourceText: c.sourceText || existing.sourceText,
            };
            return copy;
          }
          return prev;
        }
        return [
          ...prev,
          {
            id: c.segmentId,
            text: targetText,
            sourceText: c.sourceText || targetText,
          },
        ];
      });

      if (c.segmentId && !spokenSegmentsRef.current.has(c.segmentId)) {
        if (c.text || isLanguageSpecific) {
          spokenSegmentsRef.current.add(c.segmentId);
          speakerTtsRef.current?.say(c.text || c.sourceText);
        } else {
          // Fallback: If only broadcast arrived without translated text, wait 4s for translation
          const segId = c.segmentId;
          const fallbackText = c.sourceText;
          setTimeout(() => {
            if (!spokenSegmentsRef.current.has(segId)) {
              spokenSegmentsRef.current.add(segId);
              speakerTtsRef.current?.say(fallbackText);
            }
          }, 4000);
        }
      }
    };

    socket.on("caption", (c) => handleCaption(c, true));
    socket.on("caption:broadcast", (c) => handleCaption(c, false));

    socket.on("roster:update", ({ languages: roster }) => {
      const mine = roster.find((r) => r.language === socketRef.current?.currentLanguage);
      setListenerCount(mine ? mine.listeners : null);
    });

    socket.on("session:ended", () => setEnded(true));
    socket.on("session:audio-available", ({ audioUrl }) => setLiveAudioUrl(audioUrl));
    socket.on("session:summary-ready", ({ summary, translations }) => {
      const myLang = socketRef.current?.currentLanguage;
      const translated = translations && myLang ? translations[myLang] : summary;
      setSummary(translated || summary);
    });

    // WebRTC Listener Signal Handler
    socket.on("webrtc:signal", async ({ senderSocketId, type, sdp, candidate }) => {
      try {
        const pc = rtcPeerRef.current;
        if (!pc) return;
        if (type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc:signal", {
            targetSocketId: senderSocketId,
            type: "answer",
            sdp: answer,
          });
        } else if (type === "candidate" && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.warn("WebRTC listener signaling error:", err);
      }
    });

    return () => {
      cancelled = true;
      socket.disconnect();
      speakerTtsRef.current?.stop();
      if (rtcPeerRef.current) rtcPeerRef.current.close();
      if (rtcAudioRef.current) rtcAudioRef.current.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token, languages.length, consented]);

  // Join / switch language on the server once we know which language to use.
  useEffect(() => {
    if (!consented || !language || !socketRef.current || languages.length === 0) return;
    const langObj = languages.find((l) => l.code === language);
    const azureVoice = langObj?.voices?.[voiceGender] || langObj?.azureVoice || "en-IN-NeerjaNeural";

    if (!speakerTtsRef.current) {
      speakerTtsRef.current = createAzureSpeaker({
        getToken: () => api.speechToken(token),
        voiceName: azureVoice,
        speechRate: speechPace,
      });
    } else {
      speakerTtsRef.current.setVoiceName(azureVoice);
      speakerTtsRef.current.setRate(speechPace);
    }
    speakerTtsRef.current?.setEnabled(audioOn);

    const socket = socketRef.current;
    socket.currentLanguage = language;

    const alreadyConnected = socket.connected;
    const doJoin = () => {
      socket.emit("listener:join", { sessionId, language }, (res) => {
        if (res?.error) {
          if (res.ended) setEnded(true);
          else setError(res.error);
          return;
        }
        setSession(res.session);
      });
    };

    if (alreadyConnected) doJoin();
    else socket.once("connect", doJoin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, voiceGender, speechPace, languages.length]);

  useEffect(() => {
    speakerTtsRef.current?.setEnabled(audioOn);
  }, [audioOn]);

  function onChangeLanguage(newLang) {
    setLines([]);
    spokenSegmentsRef.current.clear();
    setLanguage(newLang);
    if (socketRef.current?.connected) {
      socketRef.current.emit("listener:change-language", { language: newLang });
    }
    api
      .sessionDetail(token, sessionId)
      .then(({ transcript }) => {
        setLines(
          transcript
            .filter((t) => t.translatedText || t.sourceText)
            .map((t) => ({ id: t.id, text: t.translatedText || t.sourceText, sourceText: t.sourceText }))
        );
      })
      .catch((err) => console.warn("Failed to refetch translated transcript:", err));
  }

  if (error) {
    return (
      <div className="main">
        <div className="error-banner">{error}</div>
        <Link to="/" className="btn">Back home</Link>
      </div>
    );
  }

  if (!consented) {
    return (
      <div className="main main-narrow">
        <span className="eyebrow">Before you join</span>
        <h1>This session is recorded</h1>
        <div className="panel">
          <p>
            Everything the speaker says in this session is transcribed, translated into your
            chosen language, and saved — tied to your account — for you and the speaker to
            revisit afterward. A written summary is also generated once the session ends.
          </p>
          <p style={{ marginBottom: 0 }}>
            By joining, you're agreeing to have your session participation (language choice and
            saved translation) stored as part of this record.
          </p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 16 }}
            onClick={() => {
              unlockAudioEngine();
              setConsented(true);
            }}
          >
            I understand, join the session
          </button>
        </div>
        <Link to="/" className="btn" style={{ marginTop: 12 }}>Back home</Link>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="console-header">
        <div>
          <span className="eyebrow">Listening live</span>
          <h1 style={{ marginBottom: 4 }}>{session?.title || "Loading…"}</h1>
          <div className="status-row">
            <span className={connected && !ended ? "pulse-dot" : ""} />
            {ended ? "Session ended" : connected ? "Connected" : "Connecting…"}
            {listenerCount != null && !ended && <> · {listenerCount} listening in this language</>}
            {webrtcActive && !ended && (
              <span style={{ marginLeft: 8, padding: "2px 8px", background: "rgba(16,185,129,0.2)", color: "#10b981", borderRadius: 12, fontSize: 12, fontWeight: 600, border: "1px solid rgba(16,185,129,0.4)" }}>
                🎙️ WebRTC Direct Speaker Audio Live
              </span>
            )}
          </div>
        </div>
      </div>

      {ended && summary ? (
        <SummaryPanel summary={summary} />
      ) : ended ? (
        <div className="panel" style={{ marginTop: 24 }}>
          <h2>The speaker ended this session</h2>
          <p>A written summary is being generated and will appear here shortly, and is also saved to your session history.</p>
        </div>
      ) : (
        <div className="console" style={{ marginTop: 24 }}>
          <div className="console-main">
            <CaptionBox lines={lines} interim={interim} emptyLabel="Waiting for the speaker to start talking…" />
          </div>

          <div className="sidebar">
            <div className="sidebar-block">
              <h3>Your language</h3>
              <LanguageSelect languages={languages} value={language || "en"} onChange={onChangeLanguage} />
              
              <button
                type="button"
                className="btn btn-block"
                style={{ marginTop: 12, fontSize: 13, background: "rgba(255,255,255,0.08)" }}
                onClick={exportTranscriptTxt}
                disabled={lines.length === 0}
              >
                📄 Export Transcript (.txt)
              </button>
            </div>
            <div className="sidebar-block">
              <div className="speak-toggle-row">
                <div>
                  <h3 style={{ marginBottom: 2 }}>Spoken audio</h3>
                  <p style={{ margin: 0, fontSize: 13 }}>Hear HD translation aloud</p>
                </div>
                <div
                  className={`switch ${audioOn ? "on" : ""}`}
                  role="switch"
                  aria-checked={audioOn}
                  tabIndex={0}
                  onClick={() => setAudioOn((v) => !v)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setAudioOn((v) => !v)}
                />
              </div>

              {audioOn && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12 }}>Voice Gender & Style</label>
                    <select value={voiceGender} onChange={(e) => setVoiceGender(e.target.value)}>
                      <option value="female">♀️ Female (Expressive Neural)</option>
                      <option value="male">♂️ Male (Warm Neural)</option>
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 12 }}>Audio Cadence & Pace</label>
                    <select value={speechPace} onChange={(e) => setSpeechPace(e.target.value)}>
                      <option value="0.94">🎵 Natural Live Pace (0.94x)</option>
                      <option value="1.0">⚡ Standard Pace (1.0x)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="sidebar-block">
              <h3 style={{ marginBottom: 4 }}>📡 WebRTC Live Speaker Audio</h3>
              <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--text-muted)" }}>
                Listen to zero-latency uncompressed live microphone sound
              </p>
              <button
                type="button"
                className="btn btn-block"
                style={{
                  background: webrtcActive ? "#10b981" : "var(--amber)",
                  color: "#000",
                  fontWeight: 600,
                  fontSize: 13,
                }}
                onClick={startWebRtcAudio}
              >
                {webrtcActive ? "📡 WebRTC Live Stream Connected" : "🎙️ Connect WebRTC Live Audio"}
              </button>
            </div>

            <div className="sidebar-block">
              <h3 style={{ marginBottom: 4 }}>❓ Ask Speaker a Question</h3>
              <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--text-muted)" }}>
                Submit questions in your language — speaker receives instant translation
              </p>
              {qSubmitted && (
                <div style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: 12, marginBottom: 8, fontWeight: 600, border: "1px solid rgba(16,185,129,0.3)" }}>
                  ✅ Question sent to speaker!
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.target.elements.qInput;
                  if (!input.value.trim()) return;
                  socketRef.current?.emit("question:submit", { sessionId, question: input.value.trim() }, () => {
                    input.value = "";
                    setQSubmitted(true);
                    setTimeout(() => setQSubmitted(false), 3000);
                  });
                }}
              >
                <input
                  name="qInput"
                  type="text"
                  placeholder="Type your question..."
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                />
                <button type="submit" className="btn btn-primary btn-block" style={{ fontSize: 12 }}>
                  Submit Question
                </button>
              </form>
            </div>

            <div className="sidebar-block">
              <h3 style={{ marginBottom: 4 }}>📥 Downloads & Exports</h3>
              <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--text-muted)" }}>
                Export session text, translations, subtitles, and recorded audio
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-block"
                  style={{ fontSize: 12, background: "rgba(255,255,255,0.08)", textAlign: "left" }}
                  onClick={exportTranscriptTxt}
                  disabled={lines.length === 0}
                >
                  📄 Download Translated Text (.txt)
                </button>
                <a
                  href={`${api.serverUrl}/api/sessions/${sessionId}/export?format=srt&lang=${language || "en"}`}
                  download={`subtitles-${sessionId}.srt`}
                  className="btn btn-block"
                  style={{ fontSize: 12, textDecoration: "none", background: "rgba(255,255,255,0.08)", textAlign: "left" }}
                >
                  🎬 Download Video Subtitles (.srt)
                </a>
                <a
                  href={`${api.serverUrl}/api/sessions/${sessionId}/export?format=vtt&lang=${language || "en"}`}
                  download={`subtitles-${sessionId}.vtt`}
                  className="btn btn-block"
                  style={{ fontSize: 12, textDecoration: "none", background: "rgba(255,255,255,0.08)", textAlign: "left" }}
                >
                  🌐 Download WebVTT Subtitles (.vtt)
                </a>
                {(liveAudioUrl || session?.audioUrl) && (
                  <a
                    href={liveAudioUrl || `${api.serverUrl}${session.audioUrl}`}
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

function SummaryPanel({ summary }) {
  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <span className="eyebrow">Session ended</span>
      <h2>Notes from this session</h2>
      <div className="summary-body" dangerouslySetInnerHTML={{ __html: markdownToHtml(summary) }} />
      <Link to="/history" className="btn" style={{ marginTop: 16 }}>
        Back to My Sessions
      </Link>
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