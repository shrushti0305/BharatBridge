import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetLink("");
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setMessage(res.message);
      if (res.resetLink) setResetLink(res.resetLink);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-page">
      <div className="main main-narrow">
        <span className="eyebrow">Reset access</span>
        <h1>Forgot password</h1>
        <p>Enter your email and we'll generate a reset link.</p>
        <form onSubmit={onSubmit} className="panel">
          {error && <div className="error-banner">{error}</div>}
          {message && <div className="panel" style={{ marginBottom: 12 }}>{message}</div>}
          {resetLink && (
            <div className="panel" style={{ marginBottom: 12, wordBreak: "break-all" }}>
              <strong>Testing mode — no email sender configured yet.</strong>
              <br />
              {(() => {
                try {
                  const u = new URL(resetLink);
                  return <Link to={u.pathname + u.search}>{resetLink}</Link>;
                } catch {
                  return <a href={resetLink}>{resetLink}</a>;
                }
              })()}
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p style={{ marginTop: 16, textAlign: "center" }}>
          <Link to="/login">Back to log in</Link>
        </p>
      </div>
    </div>
  );
}