import React from "react";
import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Home from "./pages/Home.jsx";
import SpeakerView from "./pages/SpeakerView.jsx";
import ListenerView from "./pages/ListenerView.jsx";
import SessionHistory from "./pages/SessionHistory.jsx";
import SessionDetail from "./pages/SessionDetail.jsx";

function RequireAuth({ children }) {
  const { token, ready } = useAuth();
  if (!ready) return null;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brand-mark" />
        BharatBridge
      </Link>
      {user ? (
        <nav className="topbar-nav">
          <Link to="/">New / Join</Link>
          <Link to="/history">My Sessions</Link>
          <span className="topbar-user">{user.name}</span>
          <button
            className="btn btn-sm"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Log out
          </button>
        </nav>
      ) : (
        <nav className="topbar-nav">
          <Link to="/login">Log in</Link>
          <Link to="/register">Sign up</Link>
        </nav>
      )}
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/speak/:sessionId"
          element={
            <RequireAuth>
              <SpeakerView />
            </RequireAuth>
          }
        />
        <Route
          path="/listen/:sessionId"
          element={
            <RequireAuth>
              <ListenerView />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <SessionHistory />
            </RequireAuth>
          }
        />
        <Route
          path="/session/:sessionId"
          element={
            <RequireAuth>
              <SessionDetail />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
