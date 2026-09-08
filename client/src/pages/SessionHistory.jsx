import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function SessionHistory() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.mySessions(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <div className="main"><div className="error-banner">{error}</div></div>;
  if (!data) return <div className="main"><p>Loading…</p></div>;

  return (
    <div className="main">
      <span className="eyebrow">History</span>
      <h1>My Sessions</h1>

      <h2 style={{ marginTop: 32 }}>As speaker</h2>
      {data.spoken.length === 0 && <p>You haven't started any sessions yet.</p>}
      {data.spoken.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}

      <h2 style={{ marginTop: 32 }}>As listener</h2>
      {data.listened.length === 0 && <p>You haven't joined any sessions yet.</p>}
      {data.listened.map((s) => (
        <SessionCard key={s.id} session={s} langLabel={s.myLanguage} />
      ))}
    </div>
  );
}

function SessionCard({ session, langLabel }) {
  const target = session.status === "live"
    ? (langLabel ? `/listen/${session.id}` : `/speak/${session.id}`)
    : `/session/${session.id}`;

  return (
    <Link to={target} className="card">
      <div>
        <div className="card-title">{session.title}</div>
        <div className="card-meta">
          {new Date(session.createdAt).toLocaleString()}
          {langLabel ? ` · Listened in ${langLabel.toUpperCase()}` : ""}
        </div>
      </div>
      <span className={`badge ${session.status === "live" ? "badge-live" : "badge-ended"}`}>
        {session.status === "live" ? "Live" : "Ended"}
      </span>
    </Link>
  );
}
