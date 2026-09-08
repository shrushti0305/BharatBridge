import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import LanguageSelect from "../components/LanguageSelect.jsx";

export default function Home() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [languages, setLanguages] = useState([]);
  const [speakerLanguages, setSpeakerLanguages] = useState([]);

  const [title, setTitle] = useState("");
  const [speakerLang, setSpeakerLang] = useState("auto");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api.languages().then(({ languages, speakerLanguages }) => {
      setLanguages(languages || []);
      setSpeakerLanguages(speakerLanguages || languages || []);
    });
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const session = await api.createSession(token, title || "Untitled session", speakerLang);
      navigate(`/speak/${session.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function onJoin(e) {
    e.preventDefault();
    setJoinError("");
    setJoining(true);
    try {
      const session = await api.lookupByCode(token, joinCode.trim());
      if (session.status !== "live") {
        setJoinError("That session has already ended — find it under My Sessions instead.");
        return;
      }
      navigate(`/listen/${session.id}`);
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="main">
      <span className="eyebrow">Live event translation</span>
      <h1>One speaker. Every language, at once.</h1>
      <p style={{ maxWidth: 560 }}>
        Start a session to speak live and have it translated into eleven languages
        simultaneously, or join a session someone shared with you and pick the language you
        want to hear and read it in.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 32 }}>
        <form onSubmit={onCreate} className="panel">
          <h2>Start speaking</h2>
          <p>Create a new live session as the speaker.</p>
          {createError && <div className="error-banner">{createError}</div>}
          <div className="field">
            <label htmlFor="title">Session title</label>
            <input
              id="title"
              placeholder="e.g. Quarterly Town Hall"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="speakerLang">You'll be speaking in</label>
            <LanguageSelect
              id="speakerLang"
              languages={speakerLanguages.length ? speakerLanguages : languages}
              value={speakerLang}
              onChange={setSpeakerLang}
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create session"}
          </button>
        </form>

        <form onSubmit={onJoin} className="panel">
          <h2>Join a session</h2>
          <p>Enter the 6-character code the speaker shared with you.</p>
          {joinError && <div className="error-banner">{joinError}</div>}
          <div className="field">
            <label htmlFor="joinCode">Join code</label>
            <input
              id="joinCode"
              placeholder="ABC123"
              value={joinCode}
              maxLength={6}
              style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
          </div>
          <button className="btn btn-block" type="submit" disabled={joining || joinCode.length < 4}>
            {joining ? "Looking up…" : "Join session"}
          </button>
        </form>
      </div>
    </div>
  );
}
