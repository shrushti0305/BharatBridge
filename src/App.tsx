/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, FormEvent } from "react";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  ArrowRightLeft, 
  Search, 
  X, 
  ChevronDown, 
  Globe, 
  Copy, 
  Check, 
  Languages,
  RotateCw,
  RefreshCw,
  Settings,
  Star,
  Trash2,
  Plus,
  Download,
  Share2,
  Users,
  CloudUpload,
  Gauge,
  QrCode,
  FileText,
  FileSpreadsheet,
  Music,
  History,
  Sparkles,
  Shield
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LANGUAGES, POPULAR_LANGUAGES } from "./languages";
import { LanguageConfig, UserProfile, TranslationPair, Session, Message as FBMessage, UserRole, SpeakerRequestStatus } from "./types";
import { auth, signInWithGoogle } from "./lib/firebase";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { uploadCaptionToAzure } from "./lib/azure-storage";
import { generateQRCodeSVG } from "./lib/qrcode";
import { translateText, synthesizeSpeech } from "./services/api";
import { downloadAudioWAV } from "./lib/audio-export";
import { observabilityService, generateEventId } from "./services/observability";

export function cleanIndianText(text: string): string {
  if (!text) return "";
  let cleaned = text.normalize("NFC");
  // Remove space immediately following Devanagari Virama (U+094D) or Gujarati Virama (U+0ACD)
  cleaned = cleaned.replace(/([\u094D\u0ACD])\s+/g, "$1");
  // Normalize redundant whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

// --- Components ---

const SummaryModal = ({ 
  isOpen, 
  onClose, 
  summary, 
  isLoading, 
  onDownload 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  summary: string; 
  isLoading: boolean; 
  onDownload: () => void; 
}) => {
  if (!isOpen) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-xl text-white tracking-tight">AI Session Summary</h3>
              <p className="text-xs text-slate-400 mt-0.5">Structured takeaways and chronological overview</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
              <RotateCw size={28} className="animate-spin text-purple-400" />
              <p className="text-xs font-mono uppercase tracking-wider">Generating AI Summary using Gemini...</p>
            </div>
          ) : (
            summary || "No summary content generated."
          )}
        </div>

        {!isLoading && summary && (
          <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end gap-3">
            <button
              onClick={onDownload}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-purple-500/20 flex items-center gap-2"
            >
              <Download size={14} />
              Download Summary (.txt)
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const AuthModal = ({ 
  isOpen, 
  onClose, 
  onUserLogin 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onUserLogin: (userObj: any) => void; 
}) => {
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setAuthErr('');
    setIsSigningIn(true);
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        const u = {
          displayName: res.user.displayName || res.user.email || "User",
          email: res.user.email,
          photoURL: res.user.photoURL,
          uid: res.user.uid
        };
        onUserLogin(u);
        onClose();
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err?.code === 'auth/unauthorized-domain') {
        setAuthErr("Domain notice: Authorized domains in Firebase Console need updating for Google OAuth, or you can use Direct Credentials below!");
      } else if (err?.code === 'auth/popup-blocked') {
        setAuthErr("Popup blocked by browser. Allow popups or use Direct Credentials below.");
      } else {
        setAuthErr(err?.message || "Google Sign-In unavailable. Use Direct Credentials below.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setAuthErr("Please enter your name");
      return;
    }
    const cleanName = nameInput.trim();
    const cleanEmail = emailInput.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@bharatbridge.io`;
    const userObj = {
      displayName: cleanName,
      email: cleanEmail,
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`,
      uid: `usr_${Date.now()}`
    };
    onUserLogin(userObj);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl text-white tracking-tight">Sign In Credentials</h3>
            <p className="text-xs text-slate-400 mt-0.5">Choose Google Auth or Direct User Profile</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {authErr && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
              {authErr}
            </div>
          )}

          {/* Option 1: Google OAuth */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Option 1: Quick Google Sign-In</label>
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              {isSigningIn ? "Connecting to Google..." : "Continue with Google Account"}
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-white/10 w-full"></div>
            <span className="bg-[#0f172a] px-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold absolute">OR</span>
          </div>

          {/* Option 2: Custom Credentials Login */}
          <form onSubmit={handleCustomSubmit} className="space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Option 2: Direct Credentials Login</label>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Your Name *</label>
              <input 
                type="text"
                placeholder="e.g. Dr. Priya Sharma"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email Address (Optional)</label>
              <input 
                type="email"
                placeholder="e.g. priya@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-orange-500/20"
            >
              Sign In with Custom Profile
            </button>
          </form>

          {/* Option 3: Guest Mode */}
          <div className="pt-2 text-center border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Continue as Guest (No Sign-In Required) →
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const ProfileModal = ({ 
  isOpen, 
  onClose, 
  profile, 
  onUpdate 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  profile: UserProfile; 
  onUpdate: (profile: UserProfile) => void; 
}) => {
  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-2xl text-white tracking-tight">User Preferences</h3>
            <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Configure your Neural Bridge defaults</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          <section>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Voice Profile</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Your Gender (for Voice Synthesis)</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => onUpdate({ ...profile, gender: 'male' })}
                    className={`px-4 py-3 rounded-xl border text-sm transition-all ${profile.gender === 'male' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    Male
                  </button>
                  <button 
                    onClick={() => onUpdate({ ...profile, gender: 'female' })}
                    className={`px-4 py-3 rounded-xl border text-sm transition-all ${profile.gender === 'female' ? 'bg-pink-500/20 border-pink-500/50 text-pink-400' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    Female
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Default Nodes</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Default Source</label>
                <select 
                  value={profile.defaultSourceCode}
                  onChange={(e) => onUpdate({ ...profile, defaultSourceCode: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-orange-500/50 outline-none"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#0f172a]">{l.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Default Target</label>
                <select 
                  value={profile.defaultTargetCode}
                  onChange={(e) => onUpdate({ ...profile, defaultTargetCode: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#0f172a]">{l.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Saved Pairs</h4>
              <span className="text-[10px] text-slate-600 font-mono">{profile.savedPairs.length} / 10</span>
            </div>
            <div className="space-y-2">
              {profile.savedPairs.length === 0 ? (
                <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center">
                  <p className="text-sm text-slate-500">No saved pairs yet.</p>
                </div>
              ) : (
                profile.savedPairs.map(pair => {
                  const s = LANGUAGES.find(l => l.code === pair.sourceCode);
                  const t = LANGUAGES.find(l => l.code === pair.targetCode);
                  return (
                    <div key={pair.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl group hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">{s?.nativeName}</span>
                        <ArrowRightLeft size={12} className="text-slate-600" />
                        <span className="text-sm font-semibold text-white">{t?.nativeName}</span>
                      </div>
                      <button 
                        onClick={() => {
                          onUpdate({
                            ...profile,
                            savedPairs: profile.savedPairs.filter(p => p.id !== pair.id)
                          });
                        }}
                        className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
};

const AdminModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      if (!currentUser) {
        // Do nothing before a user is signed in
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      try {
        const token = await currentUser.getIdToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`
        };

        const adminToken = localStorage.getItem("bharat_bridge_admin_token") || (import.meta as any).env?.VITE_ADMIN_TOKEN || "";
        if (adminToken) {
          headers["x-admin-token"] = adminToken;
        }

        const res = await fetch("/api/admin/sessions", { headers });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Admin access denied`);
        }
        const data = await res.json();
        if (isMounted) {
          setSessions(data.sessions || []);
          if (data.sessions && data.sessions.length > 0) {
            setSelectedSession(data.sessions[0]);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn("[AdminModal] Error fetching sessions:", err);
          setErrorMsg(err.message || "Failed to load admin sessions");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!selectedSession || !auth.currentUser) {
      setSessionMessages([]);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const adminToken = localStorage.getItem("bharat_bridge_admin_token") || (import.meta as any).env?.VITE_ADMIN_TOKEN || "";
        if (adminToken) {
          headers["x-admin-token"] = adminToken;
        }

        const res = await fetch(`/api/admin/sessions/${selectedSession.id}/messages`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSessionMessages(data.messages || []);
          }
        }
      } catch (err) {
        console.warn("[AdminModal] Error fetching session messages:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedSession]);

  const [activeTab, setActiveTab] = useState<"messages" | "summary">("messages");
  const [adminSummary, setAdminSummary] = useState<string>("");
  const [generatingSummary, setGeneratingSummary] = useState<boolean>(false);

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return "< 1m";
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const handleGenerateAdminSummary = async () => {
    if (!selectedSession || sessionMessages.length === 0) return;
    setGeneratingSummary(true);
    setAdminSummary("");
    setActiveTab("summary");
    try {
      const hostTok = (selectedSession?.id ? sessionStorage.getItem(`bharat_bridge_host_token_${selectedSession.id}`) : null) || localStorage.getItem("bharat_bridge_admin_token");
      const res = await fetch("/api/session-summary", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(hostTok ? { "x-host-token": hostTok, "x-session-token": hostTok } : {})
        },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          messages: sessionMessages,
          targetLanguage: selectedSession.targetLang || "hi",
          hostToken: hostTok
        })
      });
      const data = await res.json();
      if (data.summary) {
        setAdminSummary(data.summary);
      } else {
        setAdminSummary(data.error || "Failed to generate AI session summary.");
      }
    } catch (e: any) {
      setAdminSummary("Error connecting to session summary API: " + e.message);
    } finally {
      setGeneratingSummary(false);
    }
  };

  if (!isOpen) return null;

  const totalLive = sessions.filter(s => s.isLive).length;
  const totalJoinees = sessions.reduce((acc, s) => acc + (s.activeListeners || 0), 0);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={onClose}>
      <motion.div className="w-full max-w-5xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex h-[85vh]" onClick={e => e.stopPropagation()}>
        {/* Left Sessions Sidebar */}
        <div className="w-1/3 border-r border-white/5 flex flex-col">
          <div className="p-5 border-b border-white/5 space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <Shield size={16} className="text-orange-400" />
                <span>Admin Session Dashboard</span>
              </h3>
              {loading && <span className="text-[10px] text-slate-400 animate-pulse">Loading...</span>}
            </div>
            {/* Real-Time Telemetry Summary Bar */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-white/5 border border-white/5 p-2 rounded-xl text-center">
                <p className="text-[9px] text-slate-400 font-mono uppercase">Total</p>
                <p className="text-xs font-bold text-white">{sessions.length}</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-center">
                <p className="text-[9px] text-emerald-400 font-mono uppercase">Live</p>
                <p className="text-xs font-bold text-emerald-400">{totalLive}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded-xl text-center">
                <p className="text-[9px] text-blue-400 font-mono uppercase">Joinees</p>
                <p className="text-xs font-bold text-blue-400">{totalJoinees}</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {errorMsg && <p className="text-xs text-red-400 p-2 bg-red-500/10 rounded-lg">{errorMsg}</p>}
            {sessions.length === 0 && !loading && (
              <p className="text-xs text-slate-500 text-center py-6">No session records found.</p>
            )}
            {sessions.map(s => (
              <button 
                key={s.id} 
                onClick={() => { setSelectedSession(s); setActiveTab("messages"); setAdminSummary(""); }}
                className={`w-full p-3.5 rounded-2xl border text-left transition-all space-y-1.5 ${selectedSession?.id === s.id ? 'bg-orange-500/10 border-orange-500/30 shadow-lg' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">#{s.id}</span>
                  {s.isLive ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      LIVE
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">ENDED</span>
                  )}
                </div>
                <p className="text-xs font-bold text-white truncate">{s.name || `Session ${s.id}`}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <span>👥 {s.activeListeners || 0} joinees</span>
                  <span>💬 {s.messageCount || 0} msgs</span>
                  <span>⏱️ {formatDuration(s.durationSec)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Details / Live History Pane */}
        <div className="flex-1 flex flex-col bg-black/20">
          <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/40">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-white text-base">{selectedSession ? selectedSession.name : 'Select a Session'}</h3>
                {selectedSession?.isLive && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">🔴 LIVE SESSION</span>
                )}
              </div>
              {selectedSession && (
                <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                  <span>PIN: <strong className="text-white">#{selectedSession.id}</strong></span>
                  <span>Joinees: <strong className="text-blue-400">{selectedSession.activeListeners || 0}</strong></span>
                  <span>Duration: <strong className="text-orange-400">{formatDuration(selectedSession.durationSec)}</strong></span>
                  <span>Messages: <strong className="text-slate-200">{selectedSession.messageCount || sessionMessages.length}</strong></span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-slate-400 hover:text-white"><X size={16}/></button>
            </div>
          </div>

          {/* Tab Navigation */}
          {selectedSession && (
            <div className="px-6 pt-3 border-b border-white/5 flex justify-between items-center bg-slate-900/20">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab("messages")}
                  className={`pb-3 text-xs font-bold transition-all border-b-2 ${activeTab === "messages" ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                  Transcript & History ({sessionMessages.length})
                </button>
                <button
                  onClick={() => {
                    if (!adminSummary && !generatingSummary) handleGenerateAdminSummary();
                    else setActiveTab("summary");
                  }}
                  className={`pb-3 text-xs font-bold transition-all border-b-2 ${activeTab === "summary" ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                  AI Session Summary {generatingSummary && "⏳"}
                </button>
              </div>
              {selectedSession && sessionMessages.length > 0 && (
                <div className="flex gap-2 mb-2">
                  <button 
                    onClick={() => exportTranscriptTXT(sessionMessages as any, selectedSession.name, selectedSession.id)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5"
                    title="Download Transcript"
                  >
                    <Download size={13} />
                    <span>Export</span>
                  </button>
                  <button 
                    onClick={handleGenerateAdminSummary}
                    disabled={generatingSummary}
                    className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 hover:text-orange-200 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles size={13} />
                    <span>{generatingSummary ? "Generating..." : "Generate AI Summary"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!selectedSession && (
              <p className="text-xs text-slate-500 italic text-center py-20">Select a session from the sidebar to inspect telemetry, joinees, duration, and transcript messages.</p>
            )}

            {selectedSession && activeTab === "messages" && (
              <>
                {sessionMessages.length === 0 && (
                  <p className="text-xs text-slate-500 italic text-center py-10">No transcript messages recorded for this session yet.</p>
                )}
                {sessionMessages.map((m, idx) => (
                  <div key={m.id || idx} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                      <span className="font-bold text-orange-400">{m.speakerName || "Speaker"}</span>
                      <span>{new Date(m.timestamp || Date.now()).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-slate-400 italic border-l-2 border-white/10 pl-3 py-1">{m.originalText}</p>
                    <p className="text-sm text-white font-medium">{m.translatedText}</p>
                  </div>
                ))}
              </>
            )}

            {selectedSession && activeTab === "summary" && (
              <div className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Sparkles size={16} className="text-orange-400" />
                    <span>AI Session Summary Matrix</span>
                  </h4>
                  {generatingSummary && <span className="text-xs text-orange-400 animate-pulse">Generating summary with Gemini AI...</span>}
                </div>
                {generatingSummary ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400">Analyzing live transcript lines and key points...</p>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300 leading-relaxed">
                    {adminSummary || "Click 'Generate AI Summary' above to generate an executive overview and key takeaways."}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const LanguageModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  selectedCode, 
  title 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSelect: (lang: LanguageConfig) => void; 
  selectedCode: string;
  title: string;
}) => {
  const [search, setSearch] = useState("");

  const filteredLanguages = useMemo(() => {
    return LANGUAGES.filter(l => 
      l.name.toLowerCase().includes(search.toLowerCase()) || 
      l.nativeName.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const popularLanguages = useMemo(() => {
    return LANGUAGES.filter(l => POPULAR_LANGUAGES.includes(l.code));
  }, []);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-2xl text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Select from the Neural Language Grid</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-8 py-6 border-b border-white/5">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors" size={20} />
            <input 
              autoFocus
              type="text" 
              placeholder="Search by language or script..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-orange-500/50 focus:bg-white/10 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {!search && (
            <div className="mb-8">
              <p className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Priority Nodes</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-2">
                {popularLanguages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { onSelect(lang); onClose(); }}
                    className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all border ${
                      selectedCode === lang.code 
                      ? "bg-orange-500/10 border-orange-500/40 text-orange-400" 
                      : "bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/20 text-slate-400"
                    }`}
                  >
                    <span className="text-xl font-bold mb-1">{lang.nativeName}</span>
                    <span className="text-[10px] uppercase tracking-widest font-mono opacity-60">{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Extended Grid</p>
            <div className="grid grid-cols-1 gap-2 px-2">
              {filteredLanguages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { onSelect(lang); onClose(); }}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all border ${
                    selectedCode === lang.code 
                    ? "bg-blue-500/10 border-blue-500/40 text-blue-400" 
                    : "bg-white/5 hover:bg-white/10 border-white/5 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${selectedCode === lang.code ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                      {lang.nativeName[0]}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-semibold text-white">{lang.nativeName}</span>
                      <span className="text-[10px] uppercase tracking-tighter opacity-60">{lang.name} — {lang.script}</span>
                    </div>
                  </div>
                  {selectedCode === lang.code && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- Utilities ---

function pcmToBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToPcm(base64: string): Float32Array {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(buffer);
  const float32 = new Float32Array(binary.length / 2);
  for (let i = 0; i < float32.length; i++) {
    float32[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return float32;
}

const QRModal = ({ isOpen, onClose, sessionId }: { isOpen: boolean; onClose: () => void; sessionId: string }) => {
  if (!isOpen) return null;
  const host = window.location.host;
  const inviteUrl = `${window.location.protocol}//${host}${window.location.pathname}?session=${sessionId}`;
  const qrImageSrc = generateQRCodeSVG(inviteUrl, 220);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm bg-[#0f172a] border border-white/10 rounded-[32px] p-8 shadow-2xl text-center space-y-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h3 id="qr-modal-title" className="font-bold text-xl text-white">Scan to Join</h3>
          <button onClick={onClose} aria-label="Close QR Modal" className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl inline-block shadow-inner">
          <img src={qrImageSrc} alt={`QR Code for session ${sessionId}`} className="w-48 h-48 mx-auto" />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-slate-400 uppercase font-mono tracking-widest">Event Session PIN Code</p>
          <p className="text-3xl font-black text-orange-400 font-mono tracking-wider">{sessionId}</p>
        </div>

        <button 
          onClick={() => {
            navigator.clipboard.writeText(inviteUrl);
          }}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] flex items-center justify-center gap-2"
        >
          <Share2 size={16} />
          Copy Direct Link
        </button>
      </motion.div>
    </motion.div>
  );
};

const JoinModal = ({ isOpen, onClose, onJoin }: { isOpen: boolean; onClose: () => void; onJoin: (pin: string) => void }) => {
  const [pin, setPin] = useState("");
  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pin.trim()) {
      onJoin(pin.trim());
      onClose();
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={onClose} role="dialog" aria-modal="true">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-[32px] p-8 shadow-2xl space-y-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div>
            <h3 className="font-bold text-xl text-white">Join Event Session</h3>
            <p className="text-xs text-slate-500 mt-0.5">Enter 6-digit Session PIN Code</p>
          </div>
          <button onClick={onClose} aria-label="Close Join Modal" className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block text-center">Session PIN Code</label>
            <input 
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="e.g. 582941"
              maxLength={12}
              autoFocus
              className="w-full text-center text-3xl font-mono font-bold tracking-widest bg-white/5 border border-white/10 rounded-2xl py-4 text-orange-400 focus:border-orange-500 outline-none uppercase"
            />
          </div>

          <button 
            type="submit"
            disabled={!pin.trim()}
            className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <Users size={18} />
            Connect to Session
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

interface SavedSessionRecord {
  id: string;
  name: string;
  date: string;
  sourceLang: string;
  targetLang: string;
  messages: FBMessage[];
}

const HistoryModal = ({ 
  isOpen, 
  onClose, 
  savedSessions,
  onDelete
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  savedSessions: SavedSessionRecord[];
  onDelete: (id: string) => void;
}) => {
  const [selectedHistory, setSelectedHistory] = useState<SavedSessionRecord | null>(savedSessions[0] || null);

  useEffect(() => {
    if (savedSessions.length > 0 && !selectedHistory) {
      setSelectedHistory(savedSessions[0]);
    }
  }, [savedSessions]);

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={onClose} role="dialog" aria-modal="true">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="w-1/3 border-r border-white/5 flex flex-col bg-slate-900/40">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white text-lg">My Saved Sessions</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Saved locally on your device</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
            {savedSessions.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl">
                <History size={24} className="mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-500">No saved session history yet.</p>
                <p className="text-[10px] text-slate-600 mt-1">Join or host a live session to auto-save transcripts and downloadable audio.</p>
              </div>
            ) : (
              savedSessions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => setSelectedHistory(s)}
                  className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer group relative ${selectedHistory?.id === s.id ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                >
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-white truncate pr-4">{s.name}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(s.id); if (selectedHistory?.id === s.id) setSelectedHistory(null); }}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete saved session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">ID: {s.id} • {s.date}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-slate-300 uppercase font-mono">{s.sourceLang} → {s.targetLang}</span>
                    <span className="text-[10px] font-mono text-orange-400">{s.messages?.length || 0} msgs</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 flex flex-col bg-black/20">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white">{selectedHistory ? selectedHistory.name : 'Select a Session'}</h3>
              {selectedHistory && <p className="text-xs text-slate-400 font-mono">Date: {selectedHistory.date}</p>}
            </div>

            {selectedHistory && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => exportTranscriptTXT(selectedHistory.messages, selectedHistory.name, selectedHistory.id)}
                  className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 hover:bg-blue-500/20 text-xs font-bold uppercase flex items-center gap-1.5 transition-all"
                  title="Download .TXT"
                >
                  <FileText size={14} />
                  TXT
                </button>
                <button 
                  onClick={() => exportTranscriptCSV(selectedHistory.messages, selectedHistory.name, selectedHistory.id)}
                  className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold uppercase flex items-center gap-1.5 transition-all"
                  title="Download .CSV"
                >
                  <FileSpreadsheet size={14} />
                  CSV
                </button>
              </div>
            )}

            <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-slate-400 hover:text-white"><X size={16}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
            {!selectedHistory ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <FileText size={32} className="mb-2 opacity-50" />
                <p className="text-xs">Select a session from the list to view its saved transcript.</p>
              </div>
            ) : selectedHistory.messages.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No messages recorded in this session.</p>
            ) : (
              selectedHistory.messages.map((m, idx) => (
                <div key={m.id || idx} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                    <span>#{m.id ? m.id.slice(-6) : idx + 1}</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed italic border-l-2 border-slate-700 pl-3 py-0.5">
                    {m.originalText}
                  </p>
                  <p className="text-sm font-semibold text-white pt-1">
                    {m.translatedText}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const exportTranscriptTXT = (messages: FBMessage[], sessionName?: string, sessionId?: string) => {
  if (messages.length === 0) return;
  const sessionInfo = `Bharat Bridge Session: ${sessionName || 'Live Event'}\nPIN ID: ${sessionId || 'N/A'}\nDate: ${new Date().toLocaleString()}\n\n`;
  const content = messages
    .slice()
    .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))
    .map(m => {
      const time = m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString() : "Pending";
      return `[${time}] ${m.sourceLang?.toUpperCase() || 'SRC'}: ${m.originalText}\n[${time}] ${m.targetLang?.toUpperCase() || 'TRG'}: ${m.translatedText}\n`;
    })
    .join("\n---\n\n");
  
  const blob = new Blob([sessionInfo + content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transcript-${sessionId || 'session'}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportTranscriptCSV = (messages: FBMessage[], sessionName?: string, sessionId?: string) => {
  if (messages.length === 0) return;
  const headers = "Timestamp,Source Language,Original Text,Target Language,Translated Text\n";
  const rows = messages
    .slice()
    .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))
    .map(m => {
      const time = m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString() : "Pending";
      const srcLang = (m.sourceLang || "SRC").toUpperCase();
      const origText = `"${(m.originalText || "").replace(/"/g, '""')}"`;
      const trgLang = (m.targetLang || "TRG").toUpperCase();
      const transText = `"${(m.translatedText || "").replace(/"/g, '""')}"`;
      return `${time},${srcLang},${origText},${trgLang},${transText}`;
    })
    .join("\n");

  const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transcript-${sessionId || 'session'}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const SwitchConfirmModal = ({
  isOpen,
  onClose,
  onConfirm
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  if (!isOpen) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={onClose} role="dialog" aria-modal="true">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-[32px] p-8 shadow-2xl space-y-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div>
            <h3 className="font-bold text-xl text-white">Switch to Listener Mode</h3>
            <p className="text-xs text-slate-400 mt-0.5">Role transition confirmation</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-400">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Stop broadcasting microphone speech and switch to Listener mode? Your active speaker position will be released.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="w-1/2 py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl transition-all border border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="w-1/2 py-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20"
          >
            Switch to Listener
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("bharat_bridge_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("bharat_bridge_profile");
    if (saved) return JSON.parse(saved);
    return {
      defaultSourceCode: "en",
      defaultTargetCode: "hi",
      savedPairs: [],
      gender: 'male'
    };
  });

  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<FBMessage[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [sessionRole, setSessionRole] = useState<'speaker' | 'listener' | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('LISTENER');
  const [speakerSlot, setSpeakerSlot] = useState<string>('');
  const [speakerRequestStatus, setSpeakerRequestStatus] = useState<SpeakerRequestStatus>('idle');
  const [activePanelistCount, setActivePanelistCount] = useState<number>(1);
  const [pendingSpeakerRequests, setPendingSpeakerRequests] = useState<Array<{ userId: string; userName: string; requestedAt: number; targetLang?: string }>>([]);
  const [panelistRoster, setPanelistRoster] = useState<Array<{ speakerId: string; userId: string; userName: string; active: boolean; sourceLang?: string }>>([]);
  const [showSwitchConfirmModal, setShowSwitchConfirmModal] = useState<boolean>(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected' | 'connecting'>('disconnected');
  const [wsConnectFailed, setWsConnectFailed] = useState<boolean>(false);
  const wsConnectTimerRef = useRef<any>(null);
  const wsHasJoinedRef = useRef<boolean>(false);
  const [listenerCount, setListenerCount] = useState(0);
  const [copiedId, setCopiedId] = useState(false);

  const [playbackRate, setPlaybackRate] = useState<number | string>(1.0);
  const [sessionTopic, setSessionTopic] = useState<string>("");
  const [azureSyncStatus, setAzureSyncStatus] = useState<{ syncing: boolean; success?: boolean; message?: string }>({ syncing: false });
  const [hostToken, setHostToken] = useState<string>("");
  const hostTokenRef = useRef<string>("");

  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectAttemptsRef = useRef<number>(0);
  const wsPingIntervalRef = useRef<any>(null);
  const isLiveRef = useRef<boolean>(false);
  const sessionRoleRef = useRef<'speaker' | 'listener' | null>(null);
  const sessionTopicRef = useRef<string>("");
  const activeSessionIdRef = useRef<string>("");
  const sttBackoffMsRef = useRef<number>(200);

  useEffect(() => {
    sessionTopicRef.current = sessionTopic;
  }, [sessionTopic]);

  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  useEffect(() => {
    sessionRoleRef.current = sessionRole;
  }, [sessionRole]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        const userObj = {
          displayName: u.displayName || u.email || "User",
          email: u.email,
          photoURL: u.photoURL,
          uid: u.uid
        };
        setUser(userObj);
        localStorage.setItem("bharat_bridge_user", JSON.stringify(userObj));
      }
    });
    return () => unsubscribe();
  }, []);

  const [sourceLang, setSourceLang] = useState<LanguageConfig>(
    LANGUAGES.find(l => l.code === profile.defaultSourceCode) || LANGUAGES.find(l => l.code === "en")!
  );
  const [targetLang, setTargetLang] = useState<LanguageConfig>(
    LANGUAGES.find(l => l.code === profile.defaultTargetCode) || LANGUAGES.find(l => l.code === "hi")!
  );
  const [inputText, setInputText] = useState("");
  const [liveInterimText, setLiveInterimText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [modalOpen, setModalOpen] = useState<{ open: boolean; type: "source" | "target" | "profile" | "admin" | "qr" | "join" | "history" | "summary" }>({ open: false, type: "source" });
  const [autoDetect, setAutoDetect] = useState(true);
  const [copied, setCopied] = useState(false);
  const [audioUnmuted, setAudioUnmuted] = useState(false);
  const [summaryContent, setSummaryContent] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);

  const handleGenerateSummary = async (sessionToSummarize?: Session | null, messagesToSummarize?: FBMessage[]) => {
    const msgs = (messagesToSummarize && messagesToSummarize.length > 0) ? messagesToSummarize : messages;
    const sess = sessionToSummarize !== undefined ? sessionToSummarize : currentSession;
    if (msgs.length === 0) {
      alert("No session transcript messages available to summarize yet.");
      return;
    }
    setIsGeneratingSummary(true);
    setModalOpen({ open: true, type: "summary" });
    try {
      const hostTok = hostToken || hostTokenRef.current || (sess?.id ? sessionStorage.getItem(`bharat_bridge_host_token_${sess.id}`) : null);
      const res = await fetch("/api/session-summary", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(hostTok ? { "x-host-token": hostTok, "x-session-token": hostTok } : {})
        },
        body: JSON.stringify({
          sessionId: sess?.id || 'session-demo',
          messages: msgs,
          targetLanguage: targetLang.name,
          hostToken: hostTok
        })
      });
      if (res.ok) {
        const data = await res.json();
        const genSummary = data.summary || "Summary generated.";
        setSummaryContent(genSummary);

        // Store summary persistently in local storage history
        if (sess?.id || currentSession?.id) {
          const sid = sess?.id || currentSession?.id || 'demo';
          try {
            const savedSummaries = JSON.parse(localStorage.getItem("bharat_bridge_saved_summaries") || "{}");
            savedSummaries[sid] = {
              sessionId: sid,
              summary: genSummary,
              storedCloud: data.stored || false,
              timestamp: new Date().toISOString()
            };
            localStorage.setItem("bharat_bridge_saved_summaries", JSON.stringify(savedSummaries));
          } catch (storageErr) {}
        }
      } else {
        setSummaryContent("Failed to generate AI summary.");
      }
    } catch (e: any) {
      setSummaryContent("Summary generation error.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const downloadSummaryTXT = () => {
    if (!summaryContent) return;
    const blob = new Blob([summaryContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-summary-${currentSession?.id || 'event'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const audioBufferRef = useRef<Float32Array[]>([]);

  const [savedSessionsHistory, setSavedSessionsHistory] = useState<SavedSessionRecord[]>(() => {
    try {
      const saved = localStorage.getItem("bharat_bridge_saved_sessions");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const handleDeleteSavedSession = (id: string) => {
    setSavedSessionsHistory(prev => {
      const nextList = prev.filter(s => s.id !== id);
      localStorage.setItem("bharat_bridge_saved_sessions", JSON.stringify(nextList));
      return nextList;
    });
  };

  useEffect(() => {
    if (currentSession && messages.length > 0) {
      setSavedSessionsHistory(prev => {
        const idx = prev.findIndex(s => s.id === currentSession.id);
        const updatedRecord: SavedSessionRecord = {
          id: currentSession.id,
          name: currentSession.name || `Session #${currentSession.id}`,
          date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sourceLang: sourceLang.name,
          targetLang: targetLang.name,
          messages: messages
        };
        let nextList: SavedSessionRecord[];
        if (idx >= 0) {
          nextList = [...prev];
          nextList[idx] = updatedRecord;
        } else {
          nextList = [updatedRecord, ...prev];
        }
        localStorage.setItem("bharat_bridge_saved_sessions", JSON.stringify(nextList));
        return nextList;
      });
    }
  }, [messages, currentSession]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get('session') || params.get('room') || params.get('pin');
    const savedActiveSessionId = sessionStorage.getItem("bharat_bridge_active_session_id");
    const sessionId = urlSessionId || savedActiveSessionId;
    if (sessionId && !isLive) {
      joinLiveSession(sessionId);
    }
  }, []);

  useEffect(() => {
    const handleFirstUserInteraction = () => {
      unmuteAudio();
      window.removeEventListener('touchstart', handleFirstUserInteraction);
      window.removeEventListener('click', handleFirstUserInteraction);
    };
    window.addEventListener('touchstart', handleFirstUserInteraction, { passive: true });
    window.addEventListener('click', handleFirstUserInteraction, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleFirstUserInteraction);
      window.removeEventListener('click', handleFirstUserInteraction);
    };
  }, []);

  const [userRoleState, setUserRoleState] = useState<string | null>(null);
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || "admin@bharatbridge.com").split(",").map((e: string) => e.trim().toLowerCase());
  const isAdminUser = userRoleState === 'admin' || (user?.email && adminEmails.includes(user.email.toLowerCase())) || !!localStorage.getItem("bharat_bridge_admin_token") || Boolean(import.meta.env.DEV);

  useEffect(() => {
    localStorage.setItem("bharat_bridge_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (!currentSession) {
      setMessages([]);
    }
  }, [currentSession]);

  const syncToAzure = async () => {
    if (messages.length === 0) return;
    setAzureSyncStatus({ syncing: true });
    const hostTok = hostToken || hostTokenRef.current || (currentSession?.id ? sessionStorage.getItem(`bharat_bridge_host_token_${currentSession.id}`) : null);
    const result = await uploadCaptionToAzure(
      currentSession?.id || 'session-demo',
      currentSession?.name || 'Live Event',
      messages,
      hostTok || undefined
    );
    if (result.success) {
      setAzureSyncStatus({ syncing: false, success: true, message: result.blobName ? `Uploaded: ${result.blobName}` : 'Synced to Azure Storage' });
    } else {
      setAzureSyncStatus({ syncing: false, success: false, message: result.error || 'Sync failed' });
    }
    setTimeout(() => setAzureSyncStatus({ syncing: false }), 4000);
  };

  const ttsQueueRef = useRef<Array<{ base64?: string; text?: string; lang?: LanguageConfig; targetLangCode?: string; format?: string; eventId?: string; sequenceNumber?: number }>>([]);
  const isPlayingTtsRef = useRef<boolean>(false);
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);

  const nextExpectedSeqRef = useRef<number>(1);
  const holdBackMapRef = useRef<Map<number, { item: any; receivedAt: number }>>(new Map());
  const holdBackTimeoutRef = useRef<any>(null);

  const resetHoldBackBuffer = () => {
    console.log("[BHARATBRIDGE][AUDIO_ORDERING] Resetting sequence counter and hold-back buffer for new session/reconnect");
    nextExpectedSeqRef.current = 1;
    holdBackMapRef.current.clear();
    if (holdBackTimeoutRef.current) {
      clearTimeout(holdBackTimeoutRef.current);
      holdBackTimeoutRef.current = null;
    }
    ttsQueueRef.current = [];
    isPlayingTtsRef.current = false;
  };

  const drainHoldBackQueue = () => {
    while (holdBackMapRef.current.has(nextExpectedSeqRef.current)) {
      const nextObj = holdBackMapRef.current.get(nextExpectedSeqRef.current)!;
      holdBackMapRef.current.delete(nextExpectedSeqRef.current);
      console.log(`[BHARATBRIDGE][AUDIO_ORDERING] Releasing sequenceNumber #${nextExpectedSeqRef.current} from hold-back buffer`);
      ttsQueueRef.current.push(nextObj.item);
      nextExpectedSeqRef.current++;
    }
  };

  const enqueueTtsPlayback = (item: { base64?: string; text?: string; lang?: LanguageConfig; targetLangCode?: string; format?: string; eventId?: string; sequenceNumber?: number }) => {
    const activeTargetCode = item.targetLangCode || item.lang?.code || targetLang.code;
    if (item.eventId) {
      observabilityService.recordEvent({
        eventId: item.eventId,
        sessionId: currentSession?.id || '582941',
        sourceLanguage: sourceLang.code,
        targetLanguage: activeTargetCode,
        stage: 'AUDIO',
        eventType: 'AUDIO_QUEUE_ADD',
        status: 'SUCCESS'
      });
    }

    const itemToPush = { ...item, targetLangCode: activeTargetCode };

    if (item.sequenceNumber !== undefined) {
      if (item.sequenceNumber === nextExpectedSeqRef.current) {
        ttsQueueRef.current.push(itemToPush);
        nextExpectedSeqRef.current++;
        drainHoldBackQueue();
      } else if (item.sequenceNumber > nextExpectedSeqRef.current) {
        console.log(`[BHARATBRIDGE][AUDIO_ORDERING] Holding back sequenceNumber #${item.sequenceNumber} (expected #${nextExpectedSeqRef.current})`);
        holdBackMapRef.current.set(item.sequenceNumber, { item: itemToPush, receivedAt: Date.now() });

        if (!holdBackTimeoutRef.current) {
          holdBackTimeoutRef.current = setTimeout(() => {
            holdBackTimeoutRef.current = null;
            if (holdBackMapRef.current.size > 0) {
              const sortedSeqs = Array.from(holdBackMapRef.current.keys()).sort((a: number, b: number) => a - b);
              console.warn(`[BHARATBRIDGE][AUDIO_ORDERING] 4s timeout waiting for seq #${nextExpectedSeqRef.current}. Skipping to #${sortedSeqs[0]}`);
              nextExpectedSeqRef.current = sortedSeqs[0];
              drainHoldBackQueue();
              processTtsQueue();
            }
          }, 4000);
        }
      } else {
        ttsQueueRef.current.push(itemToPush);
      }
    } else {
      ttsQueueRef.current.push(itemToPush);
    }

    processTtsQueue();
  };

  const processTtsQueue = async () => {
    if (isPlayingTtsRef.current || ttsQueueRef.current.length === 0) return;
    isPlayingTtsRef.current = true;

    const item = ttsQueueRef.current.shift()!;
    try {
      if (item.base64) {
        await playSingleAudioChunk(item.base64, item.format, item.eventId, item.targetLangCode);
      } else if (item.text && item.lang) {
        await playSingleWebSpeech(item.text, item.lang, item.eventId);
      }
    } catch (e) {
      console.warn("TTS Queue playback error:", e);
    } finally {
      isPlayingTtsRef.current = false;
      if (ttsQueueRef.current.length > 0) {
        processTtsQueue();
      }
    }
  };

  const playSingleAudioChunk = (base64: string, format?: string, eventId?: string, targetLangCode?: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!base64) return resolve();
      unmuteAudio();

      const activeTargetCode = targetLangCode || targetLang.code;
      console.log("[BHARATBRIDGE][AUDIO_PLAY] Starting playSingleAudioChunk, base64 length:", base64.length, "eventId:", eventId, "targetLangCode:", activeTargetCode);
      if (activeAudioElRef.current) {
        try { activeAudioElRef.current.pause(); } catch (_) {}
        activeAudioElRef.current = null;
      }

      const audioUrl = `data:${format || "audio/mp3"};base64,${base64}`;
      const audioEl = new Audio(audioUrl);

      const queueLen = ttsQueueRef.current.length;
      const targetRate = (playbackRate as any) === "auto" 
        ? (queueLen > 1 ? 1.25 : 1.0)
        : (typeof playbackRate === "number" ? playbackRate : parseFloat(playbackRate as any) || 1.0);

      audioEl.playbackRate = targetRate;

      const hasPreservesPitch = 'preservesPitch' in audioEl;
      const hasWebkitPreservesPitch = 'webkitPreservesPitch' in audioEl;
      const hasMozPreservesPitch = 'mozPreservesPitch' in audioEl;

      if (hasPreservesPitch) (audioEl as any).preservesPitch = true;
      if (hasWebkitPreservesPitch) (audioEl as any).webkitPreservesPitch = true;
      if (hasMozPreservesPitch) (audioEl as any).mozPreservesPitch = true;

      const activePreservesPitch = (audioEl as any).preservesPitch ?? (audioEl as any).webkitPreservesPitch ?? (audioEl as any).mozPreservesPitch;

      console.log(`[BHARATBRIDGE][AUDIO_PITCH_DIAGNOSTIC] playbackRate: ${playbackRate}, preservesPitch: ${activePreservesPitch}, supportedProps: { standard: ${hasPreservesPitch}, webkit: ${hasWebkitPreservesPitch}, moz: ${hasMozPreservesPitch} }`);

      activeAudioElRef.current = audioEl;

      audioEl.onended = () => {
        console.log("[BHARATBRIDGE][AUDIO_PLAY] Audio playback ended successfully.");
        if (eventId) {
          observabilityService.recordEvent({
            eventId,
            sessionId: currentSession?.id || '582941',
            sourceLanguage: sourceLang.code,
            targetLanguage: activeTargetCode,
            stage: 'AUDIO',
            eventType: 'AUDIO_PLAY_SUCCESS',
            status: 'SUCCESS'
          });
        }
        activeAudioElRef.current = null;
        resolve();
      };
      audioEl.onerror = (e) => {
        console.error("[BHARATBRIDGE][AUDIO_PLAY] Audio element error:", e);
        if (eventId) {
          observabilityService.recordEvent({
            eventId,
            sessionId: currentSession?.id || '582941',
            sourceLanguage: sourceLang.code,
            targetLanguage: activeTargetCode,
            stage: 'AUDIO',
            eventType: 'AUDIO_PLAY_FAILURE',
            status: 'FAILURE',
            errorCode: 'AUDIO_PLAYBACK_ERROR'
          });
        }
        activeAudioElRef.current = null;
        resolve();
      };

      audioEl.play().then(() => {
        console.log("[BHARATBRIDGE][AUDIO_PLAY] Audio playback STARTED successfully.");

        setTimeout(() => {
          console.log(`[BHARATBRIDGE][AUDIO_PLAY_1S_DIAGNOSTIC] muted=${audioEl.muted}, volume=${audioEl.volume}, duration=${audioEl.duration}s, currentTime=${audioEl.currentTime}s, paused=${audioEl.paused}, ended=${audioEl.ended}`);
        }, 1000);

        if (eventId) {
          observabilityService.recordEvent({
            eventId,
            sessionId: currentSession?.id || '582941',
            sourceLanguage: sourceLang.code,
            targetLanguage: activeTargetCode,
            stage: 'AUDIO',
            eventType: 'AUDIO_PLAY_START',
            status: 'SUCCESS'
          });
        }
      }).catch((err) => {
        console.error("[BHARATBRIDGE][AUDIO_PLAY] Audio play() promise rejected:", err);
        const isAutoplay = err?.name === 'NotAllowedError' || err?.message?.includes('user gesture');
        if (eventId) {
          observabilityService.recordEvent({
            eventId,
            sessionId: currentSession?.id || '582941',
            sourceLanguage: sourceLang.code,
            targetLanguage: activeTargetCode,
            stage: 'AUDIO',
            eventType: 'AUDIO_PLAY_FAILURE',
            status: 'FAILURE',
            errorCode: isAutoplay ? 'MOBILE_BROWSER_AUDIO_AUTOPLAY' : 'AUDIO_PLAYBACK_ERROR',
            errorMessage: err?.message || 'Audio playback rejected by browser autoplay policy'
          });
        }
        activeAudioElRef.current = null;
        resolve();
      });
    });
  };

  const playSingleWebSpeech = (text: string, lang: LanguageConfig, eventId?: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!text || typeof window === "undefined" || !window.speechSynthesis) return resolve();
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        const voices = window.speechSynthesis.getVoices();
        const matchingVoices = voices.filter(v => 
          v.lang.toLowerCase() === `${lang.code}-in` || 
          v.lang.toLowerCase().startsWith(lang.code)
        );
        const naturalVoice = matchingVoices.find(v => 
          v.name.toLowerCase().includes("natural") || 
          v.name.toLowerCase().includes("google") || 
          v.name.toLowerCase().includes("neural")
        ) || matchingVoices[0];

        const utterance = new SpeechSynthesisUtterance(text);
        if (naturalVoice) utterance.voice = naturalVoice;
        utterance.lang = lang.code === "en" ? "en-IN" : `${lang.code}-IN`;
        utterance.rate = playbackRate;

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        resolve();
      }
    });
  };

  const playAudioChunk = (base64: string, format?: string) => {
    enqueueTtsPlayback({ base64, format });
  };

  const unmuteAudio = () => {
    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      // Play a tiny silent buffer to unlock HTMLAudioElement / AudioContext autoplay permanently on mobile & desktop browsers
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);

      if (window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
      setAudioUnmuted(true);
    } catch (e) {
      console.warn("Unmute audio error:", e);
    }
  };

  const initWebSocket = (sessionId: string, initialRole: 'organizer' | 'listener', isReconnect = false) => {
    if (sessionId) activeSessionIdRef.current = sessionId;
    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }

    if (!isReconnect) {
      wsHasJoinedRef.current = false;
      setWsConnectFailed(false);
    }

    if (wsConnectTimerRef.current) {
      clearTimeout(wsConnectTimerRef.current);
      wsConnectTimerRef.current = null;
    }

    wsConnectTimerRef.current = setTimeout(() => {
      if (!wsHasJoinedRef.current) {
        setWsConnectFailed(true);
      }
    }, 3000);

    setConnectionStatus(isReconnect ? 'reconnecting' : 'connecting');
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = socket;
    setWs(socket);

    socket.onopen = () => {
      console.log(`[BHARATBRIDGE][WS_RESILIENCE] Main WebSocket connected successfully (isReconnect=${isReconnect})`);
      wsReconnectAttemptsRef.current = 0;
      wsHasJoinedRef.current = true;
      setWsConnectFailed(false);
      if (wsConnectTimerRef.current) {
        clearTimeout(wsConnectTimerRef.current);
        wsConnectTimerRef.current = null;
      }
      setConnectionStatus('connected');
      unmuteAudio();

      const storedHostToken = hostTokenRef.current || (sessionId ? sessionStorage.getItem(`bharat_bridge_host_token_${sessionId}`) : "") || "";
      const currentEffectiveRole = sessionRoleRef.current || (initialRole === 'organizer' ? 'speaker' : 'listener');
      const joinRole = currentEffectiveRole === 'speaker' ? 'organizer' : 'listener';

      socket.send(JSON.stringify({ 
        type: "join", 
        sessionId, 
        role: joinRole,
        hostToken: storedHostToken || undefined,
        userId: user?.uid || `usr_${Date.now()}`,
        userName: user?.displayName || (joinRole === 'organizer' ? "Host Speaker" : "Guest Listener"),
        gender: profile.gender,
        targetLang: targetLang.code,
        topic: sessionTopicRef.current
      }));

      if (wsPingIntervalRef.current) clearInterval(wsPingIntervalRef.current);
      wsPingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        }
      }, 25000);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "pong") return;
        if (msg.type === "host_token" && msg.hostToken) {
          console.log(`[BHARATBRIDGE][HOST_TOKEN] Stored hostToken for session '${msg.sessionId || sessionId}'`);
          setHostToken(msg.hostToken);
          hostTokenRef.current = msg.hostToken;
          if (sessionId || msg.sessionId) {
            sessionStorage.setItem(`bharat_bridge_host_token_${msg.sessionId || sessionId}`, msg.hostToken);
          }
        }
        if (msg.type === "audio") playAudioChunk(msg.audio, msg.format);
        if (msg.type === "stats") setListenerCount(msg.listeners);
        if (msg.type === "speaker_request_status") {
          setSpeakerRequestStatus(msg.status || "pending");
        }
        if (msg.type === "role_changed") {
          if (msg.status === "superseded_by_new_host" || msg.role === "SUPERSEDED") {
            console.warn(`[SECURITY][SUPERSEDED] Host session was superseded by a new connection or tab.`);
            setUserRole("LISTENER");
            setSessionRole("listener");
            sessionRoleRef.current = "listener";
            setSpeakerSlot("");
            setSpeakerRequestStatus("idle");
            setIsListening(false);
          } else if (msg.status === "takeover_prevented") {
            console.warn(`[SECURITY][TAKEOVER_PREVENTED] Host takeover prevented by server: ${msg.message}`);
            setUserRole("LISTENER");
            setSessionRole("listener");
            sessionRoleRef.current = "listener";
            setSpeakerSlot("");
            setSpeakerRequestStatus("idle");
          } else if (msg.role === "PANELIST") {
            setUserRole("PANELIST");
            setSessionRole("speaker");
            sessionRoleRef.current = "speaker";
            setSpeakerSlot(msg.speakerId || "speaker-01");
            setSpeakerRequestStatus("approved");
            setSourceLang(targetLang);
            unmuteAudio();
            toggleListening(true);
          } else if (msg.role === "LISTENER") {
            setUserRole("LISTENER");
            setSessionRole("listener");
            sessionRoleRef.current = "listener";
            setSpeakerSlot("");
            if (msg.status === "rejected") setSpeakerRequestStatus("rejected");
            else if (msg.status === "limit_reached") setSpeakerRequestStatus("limit_reached");
            else setSpeakerRequestStatus("idle");
          }
        }
        if (msg.type === "join_ack") {
          console.log("[BHARATBRIDGE][WS_JOIN_ACK] Received join_ack for session:", msg.sessionId);
          if (msg.sessionToken) {
            setSessionToken(msg.sessionToken);
            sessionTokenRef.current = msg.sessionToken;
            sessionStorage.setItem(`bharat_bridge_session_token_${msg.sessionId}`, msg.sessionToken);
          }
        }
        if (msg.type === "room_state" || msg.type === "history") {
          if (msg.name || msg.topic || msg.sourceLang) {
            const sCode = msg.sourceLang || "en";
            const matchedSource = LANGUAGES.find(l => l.code === sCode);
            if (matchedSource) setSourceLang(matchedSource);

            setCurrentSession(prev => ({
              id: msg.sessionId || prev?.id || activeSessionIdRef.current,
              name: msg.name || msg.topic || prev?.name || `Live Session #${msg.sessionId || activeSessionIdRef.current}`,
              sourceLang: sCode,
              targetLang: prev?.targetLang || targetLang.code || 'hi',
              status: 'active'
            }));
          }
        }
        if (msg.type === "room_state") {
          if (typeof msg.activePanelistCount === "number") setActivePanelistCount(msg.activePanelistCount);
          if (Array.isArray(msg.pendingRequests)) setPendingSpeakerRequests(msg.pendingRequests);
          if (Array.isArray(msg.panelists)) setPanelistRoster(msg.panelists);
        }
        if (msg.type === "history" && Array.isArray(msg.messages)) {
          const uniqueHistory: FBMessage[] = [];
          const seenIds = new Set<string>();

          for (let idx = 0; idx < msg.messages.length; idx++) {
            const m = msg.messages[idx];
            const itemKey = m.eventId || m.id || `hist-${m.timestamp || idx}`;
            if (!seenIds.has(itemKey)) {
              seenIds.add(itemKey);
              uniqueHistory.push({
                id: itemKey,
                originalText: m.originalText,
                translatedText: m.translatedText,
                timestamp: { seconds: Math.floor((m.timestamp || Date.now()) / 1000) } as any,
                senderId: "system",
                sourceLang: m.sourceLang,
                targetLang: m.targetLang
              } as FBMessage);
            }
          }
          setMessages(uniqueHistory);
          if (uniqueHistory.length > 0) {
            setTranslatedText(uniqueHistory[0].translatedText);
          }
        }
        if (msg.type === "transcription") {
          const eventId = msg.eventId || generateEventId();
          observabilityService.recordEvent({
            eventId,
            sessionId: currentSession?.id || "unknown",
            sourceLanguage: msg.sourceLang || sourceLang.code,
            targetLanguage: msg.targetLang || targetLang.code,
            stage: "WEBSOCKET",
            eventType: "LISTENER_RECEIVE",
            status: "SUCCESS"
          });
          console.log("[BHARATBRIDGE][WS_RECEIVE] Client received transcription message:", msg);
          if (msg.translatedText) {
            setTranslatedText(msg.translatedText);
          }
          if (!msg.isFinal) {
            setLiveInterimText(msg.translatedText || msg.originalText || "");
          } else {
            setLiveInterimText("");
          }
          if (msg.isFinal && (msg.translatedText || msg.originalText)) {
            const finalTranslatedText = (msg.translatedText || msg.originalText || "").trim();
            observabilityService.recordEvent({
              eventId,
              sessionId: currentSession?.id || "unknown",
              sourceLanguage: msg.sourceLang || sourceLang.code,
              targetLanguage: msg.targetLang || targetLang.code,
              stage: "LISTENER",
              eventType: "LISTENER_RENDER",
              status: "SUCCESS"
            });

            const activeTargetLang = LANGUAGES.find(l => l.code === msg.targetLang) || targetLang;
            const msgEventId = msg.eventId || `live-${Date.now()}`;

            setMessages(prev => {
              const existingIdx = prev.findIndex(m => m.id === msgEventId || (m as any).eventId === msgEventId);
              const newMsgRecord: FBMessage = {
                id: msgEventId,
                originalText: msg.originalText,
                translatedText: finalTranslatedText,
                timestamp: { seconds: Math.floor(Date.now() / 1000) } as any,
                sourceLang: sourceLang.code,
                targetLang: activeTargetLang.code,
                speakerId: msg.speakerId,
                speakerName: msg.speakerName
              } as any;

              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = newMsgRecord;
                return updated;
              }
              return [newMsgRecord, ...prev];
            });

            const now = Date.now();
            const cleanText = msg.translatedText.trim();
            const isDuplicateTts = (lastListenerSpokenRef.current.text === cleanText) && (now - lastListenerSpokenRef.current.time < 4000);
            const isMyOwnSpeech = (msg.speakerId && msg.speakerId === speakerSlot) || (msg.speakerName && msg.speakerName === user?.displayName);

            if (isMyOwnSpeech) {
              console.log("[BHARATBRIDGE][TTS_REQUEST] Suppressed self-TTS playback for originating speaker to prevent audio feedback loop:", cleanText);
            } else if (isDuplicateTts) {
              console.log("[BHARATBRIDGE][TTS_REQUEST] Suppressed duplicate audio playback due to 4s window:", cleanText);
            } else {
              lastListenerSpokenRef.current = { text: cleanText, time: now };
              const msgSessionId = msg.sessionId || activeSessionIdRef.current || currentSession?.id;
              speak(msg.translatedText, activeTargetLang, eventId, msg.sequenceNumber, msgSessionId);
            }
          }
        }
      } catch (err) {
        console.warn("[BHARATBRIDGE][WS_RECEIVE] Error processing websocket message:", err);
      }
    };

    const handleDisconnect = (source: string, evt: any) => {
      console.warn(`[BHARATBRIDGE][WS_RESILIENCE] Main WebSocket ${source} fired (readyState=${socket.readyState}).`, evt);
      if (!wsHasJoinedRef.current) {
        setWsConnectFailed(true);
      }
      if (wsPingIntervalRef.current) {
        clearInterval(wsPingIntervalRef.current);
        wsPingIntervalRef.current = null;
      }

      if (!isLiveRef.current) {
        setConnectionStatus('disconnected');
        return;
      }

      setConnectionStatus('reconnecting');
      wsReconnectAttemptsRef.current += 1;
      const attempts = wsReconnectAttemptsRef.current;
      const delay = Math.min(1000 * Math.pow(1.5, attempts - 1), 10000);

      console.log(`[BHARATBRIDGE][WS_RESILIENCE] Auto-reconnecting in ${Math.round(delay)}ms (attempt #${attempts})...`);
      setTimeout(() => {
        if (isLiveRef.current) {
          initWebSocket(sessionId, initialRole, true);
        }
      }, delay);
    };

    socket.onerror = (e) => handleDisconnect("onerror", e);
    socket.onclose = (e) => handleDisconnect("onclose", e);
  };

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  const startLiveSession = async () => {
    let pinCode = "";
    let hostTok = "";
    let sessionTok = "";

    try {
      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLang: sourceLang.code,
          targetLang: targetLang.code,
          speakerGender: profile.gender,
          userId: user?.uid
        })
      });
      const data = await res.json();
      if (data.success && data.sessionId) {
        pinCode = data.sessionId;
        hostTok = data.hostToken;
        sessionTok = data.sessionToken;
        setHostToken(hostTok);
        hostTokenRef.current = hostTok;
        setSessionToken(sessionTok);
        sessionTokenRef.current = sessionTok;
        sessionStorage.setItem(`bharat_bridge_host_token_${pinCode}`, hostTok);
        sessionStorage.setItem(`bharat_bridge_session_token_${pinCode}`, sessionTok);
        sessionStorage.setItem("bharat_bridge_active_session_id", pinCode);
        sessionStorage.setItem("bharat_bridge_active_role", "organizer");
      }
    } catch (createErr) {
      console.warn("[SESSION_CREATE_FALLBACK]", createErr);
    }

    if (!pinCode) {
      alert("Failed to create live session. Please check your network connection and try again.");
      return;
    }

    const activeUserId = user?.uid || `guest-${Math.random().toString(36).substring(2, 9)}`;
    const sessionData = {
      id: pinCode,
      name: `Live Session #${pinCode} - ${sourceLang.name} to ${targetLang.name}`,
      createdAt: Date.now(),
      speakerId: activeUserId,
      speakerGender: profile.gender,
      sourceLang: sourceLang.code,
      targetLang: targetLang.code,
      status: 'active'
    };

    const sessionId = pinCode;
    resetHoldBackBuffer();
    audioBufferRef.current = [];
    setCurrentSession(sessionData as any);
    isLiveRef.current = true;
    setIsLive(true);
    setUserRole('ORGANIZER');
    setSpeakerSlot('speaker-01');
    setSessionRole('speaker');
    sessionRoleRef.current = 'speaker';
    setAutoDetect(true);
    setModalOpen({ open: true, type: "qr" });

    // Trigger microphone & audio permission synchronously on user tap (required by mobile iOS/Android gesture policies)
    unmuteAudio();
    toggleListening(true);

    // Setup WebSocket immediately with auto-reconnect resilience
    initWebSocket(sessionId, "organizer");
  };

  const handleRequestToSpeak = () => {
    const activeWs = wsRef.current || ws;
    if (activeWs && activeWs.readyState === WebSocket.OPEN && currentSession) {
      setSpeakerRequestStatus('pending');
      activeWs.send(JSON.stringify({
        type: "speaker_request",
        sessionId: currentSession.id,
        userId: user?.uid || `usr_${Date.now()}`,
        userName: user?.displayName || "Guest Listener",
        targetLang: targetLang.code
      }));
    }
  };

  const handleSpeakerApproval = (targetUserId: string, approved: boolean) => {
    const activeWs = wsRef.current || ws;
    if (activeWs && activeWs.readyState === WebSocket.OPEN && currentSession) {
      activeWs.send(JSON.stringify({
        type: "speaker_approval",
        sessionId: currentSession.id,
        targetUserId,
        approved
      }));
    }
  };

  const handleConfirmSwitchToListener = () => {
    shouldBeListeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    setIsListening(false);
    setShowSwitchConfirmModal(false);

    const activeWs = wsRef.current || ws;
    if (activeWs && activeWs.readyState === WebSocket.OPEN && currentSession) {
      activeWs.send(JSON.stringify({
        type: "switch_to_listener",
        sessionId: currentSession.id
      }));
    }
  };

  const endLiveSession = async () => {
    console.log("[BHARATBRIDGE][END_SESSION] Ending live session...", { currentSession, sessionRole, userRole });
    if (!currentSession && !isLive) return;
    shouldBeListeningRef.current = false;
    isLiveRef.current = false;

    // Immediately stop speech recognition, clear auto-restart timer, and clear sentence queue
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    if (sttRestartTimerRef.current) {
      clearTimeout(sttRestartTimerRef.current);
      sttRestartTimerRef.current = null;
    }
    sentenceQueueRef.current = [];
    isProcessingQueueRef.current = false;
    setIsListening(false);

    const activeSession = currentSession;
    const activeMessages = [...messages];
    const isHost = userRole === 'ORGANIZER' || sessionRole === 'speaker' || Boolean(hostToken || hostTokenRef.current);

    if (isHost) {
      // 1. Sync & save session captions (Azure Storage / local history)
      syncToAzure();

      // 2. Generate & display AI Session Summary if messages exist
      if (activeMessages.length > 0) {
        handleGenerateSummary(activeSession, activeMessages);
      }

      // 3. Send end_session frame over WebSocket to invalidate tokens & notify listeners
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "end_session",
          sessionId: activeSession?.id,
          token: hostToken || hostTokenRef.current
        }));
      }
    }

    try {
      // Clean shutdown
    } finally {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      if (sttRestartTimerRef.current) {
        clearTimeout(sttRestartTimerRef.current);
        sttRestartTimerRef.current = null;
      }
      sentenceQueueRef.current = [];
      isProcessingQueueRef.current = false;
      resetHoldBackBuffer();
      setIsLive(false);
      isLiveRef.current = false;
      sessionStorage.removeItem("bharat_bridge_active_session_id");
      sessionStorage.removeItem("bharat_bridge_active_role");
      setSessionRole(null);
      sessionRoleRef.current = null;
      setUserRole('LISTENER');
      setSpeakerSlot('');
      setSpeakerRequestStatus('idle');
      setConnectionStatus('disconnected');
      if (wsPingIntervalRef.current) {
        clearInterval(wsPingIntervalRef.current);
        wsPingIntervalRef.current = null;
      }
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
      setWs(null);
      if (inputAudioCtxRef.current) inputAudioCtxRef.current.close();
      if (outputAudioCtxRef.current) outputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
      outputAudioCtxRef.current = null;
      setIsListening(false);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (typeof ts === 'number') {
      const d = new Date(ts > 1e11 ? ts : ts * 1000);
      return isNaN(d.getTime()) ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (ts?.seconds !== undefined) {
      const d = new Date(ts.seconds * 1000);
      return isNaN(d.getTime()) ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (typeof ts?.toDate === 'function') {
      return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const joinLiveSession = async (rawSessionId: string) => {
    const sessionId = rawSessionId.trim();
    const storedHostToken = (sessionId ? sessionStorage.getItem(`bharat_bridge_host_token_${sessionId}`) : "") || "";
    const isHost = Boolean(storedHostToken);
    const sessionData = {
      id: sessionId,
      sourceLang: sourceLang.code,
      targetLang: targetLang.code,
      name: `Live Session #${sessionId}`
    };

    resetHoldBackBuffer();
    audioBufferRef.current = [];
    setCurrentSession(sessionData as Session);
    isLiveRef.current = true;
    setIsLive(true);
    setSessionRole(isHost ? 'speaker' : 'listener');
    sessionRoleRef.current = isHost ? 'speaker' : 'listener';
    setUserRole(isHost ? 'ORGANIZER' : 'LISTENER');
    if (isHost) {
      setSpeakerSlot('speaker-01');
      setHostToken(storedHostToken);
      hostTokenRef.current = storedHostToken;
      sessionStorage.setItem("bharat_bridge_active_session_id", sessionId);
      sessionStorage.setItem("bharat_bridge_active_role", "organizer");
    }
    setModalOpen({ open: true, type: isHost ? "qr" : "target" });

    // Synchronously unlock audio on user gesture
    unmuteAudio();
    if (isHost) toggleListening(true);

    // Setup WebSocket immediately with auto-reconnect resilience
    initWebSocket(sessionId, isHost ? "organizer" : "listener");
  };

  const pushMessageToLive = async (original: string, translated: string) => {
    if (!currentSession) return;
    const newMessage: FBMessage = {
      id: `msg-${Date.now()}`,
      originalText: original,
      translatedText: translated,
      timestamp: { seconds: Math.floor(Date.now() / 1000) } as any,
      senderId: user?.uid || "guest",
      sourceLang: sourceLang.code,
      targetLang: targetLang.code
    };

    // Instant local UI state rendering (Server is authoritative Firestore writer)
    setMessages(prev => {
      const exists = prev.some(m => m.originalText === original && m.translatedText === translated);
      if (exists) return prev;
      return [newMessage, ...prev];
    });
  };

  const saveCurrentPair = () => {
    const exists = profile.savedPairs.some(p => p.sourceCode === sourceLang.code && p.targetCode === targetLang.code);
    if (exists) return;
    
    const newPair: TranslationPair = {
      id: Math.random().toString(36).substr(2, 9),
      sourceCode: sourceLang.code,
      targetCode: targetLang.code
    };
    
    setProfile(prev => ({
      ...prev,
      savedPairs: [newPair, ...prev.savedPairs].slice(0, 10)
    }));
  };

  const loadPair = (pair: TranslationPair) => {
    const s = LANGUAGES.find(l => l.code === pair.sourceCode);
    const t = LANGUAGES.find(l => l.code === pair.targetCode);
    if (s) setSourceLang(s);
    if (t) setTargetLang(t);
  };

  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef(false);
  const sttRestartTimerRef = useRef<any>(null);
  const sentenceQueueRef = useRef<Array<{ sentence: string; eventId: string }>>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const lastProcessedSentenceRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });
  const lastListenerSpokenRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });

  const speechSeqRef = useRef<number>(1);
  const enqueueSpokenSentence = (sentenceBlock: string) => {
    const cleanBlock = sentenceBlock.trim();
    if (!cleanBlock) return;

    // Split finalized block into individual sentences on punctuation boundaries (. ! ? ।)
    const sentences = cleanBlock
      .match(/[^.?!।]+[.?!।]?/g)
      ?.map(s => s.trim())
      .filter(Boolean) || [cleanBlock];

    sentences.forEach((sentence) => {
      const clean = sentence.trim();
      if (!clean) return;

      const now = Date.now();
      if (lastProcessedSentenceRef.current.text === clean && (now - lastProcessedSentenceRef.current.time < 1000)) {
        console.log("[BHARATBRIDGE][STT] Deduplicator dropped duplicate sentence:", clean);
        return;
      }
      lastProcessedSentenceRef.current = { text: clean, time: now };

      const eventId = generateEventId();
      observabilityService.recordEvent({
        eventId,
        sessionId: currentSession?.id || '582941',
        speakerId: speakerSlot || 'speaker-01',
        sourceLanguage: sourceLang.code,
        targetLanguage: targetLang.code,
        stage: 'STT',
        eventType: 'STT_FINAL',
        status: 'SUCCESS'
      });

      console.log("[BHARATBRIDGE][STT] Enqueuing spoken sentence:", clean, "eventId:", eventId);
      sentenceQueueRef.current.push({ sentence: clean, eventId });
    });

    processSentenceQueue();
  };

  const processSentenceQueue = async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    while (sentenceQueueRef.current.length > 0) {
      const item = sentenceQueueRef.current.shift()!;
      console.log("[BHARATBRIDGE][STT] Processing sentence from queue:", item.sentence, "eventId:", item.eventId);

      const activeWs = wsRef.current || ws;
      const isLiveActive = isLiveRef.current;
      const currentSessionRole = sessionRoleRef.current;
      if (isLiveActive && currentSessionRole === 'speaker' && activeWs && activeWs.readyState === WebSocket.OPEN) {
        const seq = speechSeqRef.current++;
        const speechFrame = {
          type: "speech_event",
          eventId: item.eventId,
          sessionId: currentSession?.id || '582941',
          speakerId: speakerSlot || 'speaker-01',
          speakerName: user?.displayName || (speakerSlot === 'speaker-01' ? 'Host Speaker' : 'Listener Panelist'),
          sourceLanguage: sourceLang.code,
          sourceText: item.sentence,
          sequenceNumber: seq,
          timestamp: Date.now()
        };
        console.log("[BHARATBRIDGE][SPEECH_EVENT] Emitting speech_event over WS:", speechFrame);
        activeWs.send(JSON.stringify(speechFrame));
        observabilityService.recordEvent({
          eventId: item.eventId,
          sessionId: currentSession?.id || '582941',
          speakerId: speakerSlot || 'speaker-01',
          sourceLanguage: sourceLang.code,
          targetLanguage: targetLang.code,
          stage: 'WEBSOCKET',
          eventType: 'WS_SEND',
          status: 'SUCCESS'
        });
      } else {
        await handleTranslateText(item.sentence, true, item.eventId);
      }
    }

    isProcessingQueueRef.current = false;
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      if (SpeechGrammarList && sessionTopicRef.current) {
        try {
          const grammarList = new SpeechGrammarList();
          const terms = sessionTopicRef.current.split(/[,;\s]+/).filter(Boolean);
          if (terms.length > 0) {
            const grammar = `#JSGF V1.0; grammar terms; public <term> = ${terms.join(' | ')} ;`;
            grammarList.addFromString(grammar, 1);
            recognitionRef.current.grammars = grammarList;
            console.log("[BHARATBRIDGE][STT] Initialized PhraseListGrammar with terms:", terms);
          }
        } catch (e) {
          console.warn("[BHARATBRIDGE][STT] SpeechGrammarList notice:", e);
        }
      }

      recognitionRef.current.onresult = (event: any) => {
        let interim = "";
        let finalChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res.isFinal) {
            finalChunk += text;
          } else {
            interim += text;
          }
        }
        
        if (interim.trim()) {
          console.log("[BHARATBRIDGE][STT] Interim transcript:", interim.trim());
          setLiveInterimText(interim.trim());
        }

        if (finalChunk.trim()) {
          console.log("[BHARATBRIDGE][STT] Finalized transcript chunk:", finalChunk.trim());
          sttBackoffMsRef.current = 200; // Reset backoff on successful result
          setLiveInterimText("");
          enqueueSpokenSentence(cleanIndianText(finalChunk.trim()));
        }
      };

      const scheduleSttRestart = (reason: string) => {
        if (!shouldBeListeningRef.current) return;
        if (sttRestartTimerRef.current) {
          console.log(`[BHARATBRIDGE][STT_RESILIENCE] Restart timer already scheduled (trigger: ${reason}), skipping duplicate.`);
          return;
        }
        const delay = sttBackoffMsRef.current;
        console.log(`[BHARATBRIDGE][STT_RESILIENCE] Scheduling auto-restart in ${delay}ms (reason: ${reason})...`);
        sttRestartTimerRef.current = setTimeout(() => {
          sttRestartTimerRef.current = null;
          if (shouldBeListeningRef.current) {
            try {
              recognitionRef.current?.start();
              setIsListening(true);
              console.log("[BHARATBRIDGE][STT_RESILIENCE] STT recognition.start() successfully executed.");
            } catch (e: any) {
              console.warn("[BHARATBRIDGE][STT_RESILIENCE] Restart attempt caught error:", e?.message || e);
              if (e?.name === 'InvalidStateError' || (e?.message && e.message.includes('already started'))) {
                setIsListening(true);
              } else {
                sttBackoffMsRef.current = 1000;
                scheduleSttRestart("retry_after_start_error");
              }
            }
          }
        }, delay);
        sttBackoffMsRef.current = Math.min(sttBackoffMsRef.current * 1.5, 3000);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.warn(`[BHARATBRIDGE][STT_RESILIENCE] Speech recognition error: '${event.error}'`);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          shouldBeListeningRef.current = false;
          setIsListening(false);
          if (sttRestartTimerRef.current) {
            clearTimeout(sttRestartTimerRef.current);
            sttRestartTimerRef.current = null;
          }
          return;
        }
        scheduleSttRestart(`error '${event.error}'`);
      };

      recognitionRef.current.onend = () => {
        if (!shouldBeListeningRef.current) {
          setIsListening(false);
          return;
        }
        scheduleSttRestart("onend");
      };
    }
  }, []);

  // Update recognition language
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = sourceLang.code === "en" ? "en-IN" : `${sourceLang.code}-IN`;
    }
  }, [sourceLang]);

  const toggleListening = async (overrideLive?: boolean) => {
    const isLiveActive = overrideLive !== undefined ? overrideLive : isLiveRef.current;
    if (isListening) {
      shouldBeListeningRef.current = false;
      if (isLiveActive) {
        if (inputAudioCtxRef.current) {
          inputAudioCtxRef.current.close();
          inputAudioCtxRef.current = null;
        }
        try { recognitionRef.current?.stop(); } catch (_) {}
        setIsListening(false);
      } else {
        try { recognitionRef.current?.stop(); } catch (_) {}
        setIsListening(false);
      }
      return;
    }

    shouldBeListeningRef.current = true;
    if (isLiveActive) {
      try {
        try {
          recognitionRef.current?.start();
        } catch (e) {
          console.warn("SpeechRecognition already active or starting:", e);
        }
        setIsListening(true);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (!inputAudioCtxRef.current) {
          inputAudioCtxRef.current = new AudioContext({ sampleRate: 16000 });
        }
        const ctx = inputAudioCtxRef.current;
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(2048, 1, 1);
        
        source.connect(processor);
        processor.connect(ctx.destination);

        processor.onaudioprocess = (e) => {
          const pcm = e.inputBuffer.getChannelData(0);
          audioBufferRef.current.push(new Float32Array(pcm));
          const base64 = pcmToBase64(pcm);
          
          const activeWs = wsRef.current || ws;
          if (activeWs && activeWs.readyState === WebSocket.OPEN) {
            activeWs.send(JSON.stringify({ type: "audio", audio: base64 }));
          }
        };
      } catch (error) {
        console.error("Microphone access check:", error);
        // Continue listening even if raw PCM stream is blocked
        setIsListening(true);
      }
    } else {
      try { recognitionRef.current?.start(); } catch (_) {}
      setIsListening(true);
    }
  };

  const handleTranslateText = async (overrideText?: string, isLiveSpokenLine?: boolean, inputEventId?: string) => {
    const textToProcess = (overrideText !== undefined ? overrideText : inputText).trim();
    if (!textToProcess) return;

    const eventId = inputEventId || generateEventId();
    const isLiveActive = isLiveRef.current;
    const currentSessionRole = sessionRoleRef.current;
    console.log("[BHARATBRIDGE][TRANSLATION_REQUEST] handleTranslateText called:", { textToProcess, isLive: isLiveActive, sessionRole: currentSessionRole, userRole, eventId });
    setIsTranslating(true);
    try {
      const recentContext = messages.slice(-6).map(m => ({ originalText: m.originalText, translatedText: m.translatedText }));

      // Split into lines for line-by-line processing
      const lines = textToProcess.split('\n').filter(l => l.trim().length > 0);
      const translatedLines: string[] = [];

      for (const line of lines) {
        console.log("[BHARATBRIDGE][TRANSLATION_REQUEST] Requesting translation for line:", line.trim(), "eventId:", eventId);
        const transStart = Date.now();
        observabilityService.recordEvent({
          eventId,
          sessionId: currentSession?.id || '582941',
          speakerId: speakerSlot || 'speaker-01',
          sourceLanguage: sourceLang.code,
          targetLanguage: targetLang.code,
          stage: 'TRANSLATION',
          eventType: 'TRANSLATION_REQUEST',
          status: 'SUCCESS'
        });

        const effectiveSourceLanguage = autoDetect 
          ? 'auto' 
          : (sourceLang.name || sourceLang.code || 'en');

        const result = await translateText({
          text: line.trim(),
          sourceLanguage: effectiveSourceLanguage,
          targetLanguage: targetLang.name,
          context: recentContext,
          eventId,
          sessionId: currentSession?.id || undefined,
          token: hostToken || hostTokenRef.current || sessionToken || sessionTokenRef.current || undefined
        });
        const lineTranslation = result.translatedText || line.trim();
        const isFallback = (lineTranslation || "").trim().toLowerCase() === line.trim().toLowerCase();

        observabilityService.recordEvent({
          eventId,
          sessionId: currentSession?.id || '582941',
          speakerId: speakerSlot || 'speaker-01',
          sourceLanguage: sourceLang.code,
          targetLanguage: targetLang.code,
          stage: 'TRANSLATION',
          eventType: isFallback ? 'TRANSLATION_FALLBACK' : 'TRANSLATION_SUCCESS',
          status: isFallback ? 'FALLBACK' : 'SUCCESS',
          provider: result.provider || 'gemini',
          latencyMs: Date.now() - transStart,
          errorCode: isFallback ? 'TRANSLATION_FALLBACK' : undefined
        });

        console.log("[BHARATBRIDGE][TRANSLATION_RESPONSE] Received line translation:", lineTranslation, "eventId:", eventId);
        translatedLines.push(lineTranslation);

        console.log("[BHARATBRIDGE][WS_SEND] Checking condition to send WS text_translation. isLive =", isLiveActive, "sessionRole =", currentSessionRole);
        if (isLiveActive && currentSessionRole === 'speaker') {
          pushMessageToLive(line.trim(), lineTranslation);

          const activeWs = wsRef.current || ws;
          console.log("[BHARATBRIDGE][WS_SEND] activeWs state:", activeWs?.readyState);
          if (activeWs && activeWs.readyState === WebSocket.OPEN) {
            const frame = {
              type: "text_translation",
              eventId,
              originalText: line.trim(),
              translatedText: "", // Server will generate translation per listener target language group
              sourceLang: sourceLang.code,
              context: recentContext,
              isFinal: true
            };
            console.log("[BHARATBRIDGE][WS_SEND] Sending frame over WS:", frame);
            activeWs.send(JSON.stringify(frame));
            observabilityService.recordEvent({
              eventId,
              sessionId: currentSession?.id || '582941',
              speakerId: speakerSlot || 'speaker-01',
              sourceLanguage: sourceLang.code,
              targetLanguage: targetLang.code,
              stage: 'WEBSOCKET',
              eventType: 'WS_SEND',
              status: 'SUCCESS'
            });
          } else {
            console.warn("[BHARATBRIDGE][WS_SEND] FAILED: WebSocket is not open! readyState:", activeWs?.readyState);
          }
        } else {
          console.warn("[BHARATBRIDGE][WS_SEND] SKIPPED: isLive is false or sessionRole is not 'speaker' (current sessionRole =", currentSessionRole, ")");
        }
      }

      const fullTranslation = translatedLines.join('\n');
      if (isLiveSpokenLine) {
        setTranslatedText(prev => (prev && prev.trim() ? `${prev.trim()}\n${fullTranslation}` : fullTranslation));
      } else {
        setTranslatedText(fullTranslation);
      }
    } catch (err: any) {
      console.error(err);
      observabilityService.recordEvent({
        eventId,
        sessionId: currentSession?.id || '582941',
        sourceLanguage: sourceLang.code,
        targetLanguage: targetLang.code,
        stage: 'TRANSLATION',
        eventType: 'TRANSLATION_FAILURE',
        status: 'FAILURE',
        errorCode: 'TRANSLATION_FAILURE',
        errorMessage: err?.message || 'Translation error'
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslate = () => handleTranslateText();

  // Debounced translation for real-time and manual modes
  useEffect(() => {
    if (!inputText || isLive) return;
    
    const delay = 300;
    const timer = setTimeout(() => {
      handleTranslate();
    }, delay);
    return () => clearTimeout(timer);
  }, [inputText, targetLang, isLive]);

  const speak = async (text: string, lang: LanguageConfig, inputEventId?: string, sequenceNumber?: number, sessionOverrideId?: string) => {
    if (!text || typeof window === "undefined") return;
    const cleanedText = cleanIndianText(text);
    const eventId = inputEventId || generateEventId();
    const effectiveSessionId = sessionOverrideId || currentSession?.id || activeSessionIdRef.current;
    unmuteAudio();
    const ttsStart = Date.now();

    observabilityService.recordEvent({
      eventId,
      sessionId: effectiveSessionId || '582941',
      sourceLanguage: sourceLang.code,
      targetLanguage: lang.code,
      stage: 'TTS',
      eventType: 'TTS_REQUEST',
      status: 'SUCCESS'
    });

    try {
      const ttsRes = await synthesizeSpeech({
        text: cleanedText,
        languageCode: lang.code === "en" ? "en-IN" : `${lang.code}-IN`,
        eventId,
        sessionId: effectiveSessionId,
        token: hostToken || hostTokenRef.current || sessionToken || sessionTokenRef.current || undefined
      });
      if (ttsRes.success && ttsRes.audio) {
        observabilityService.recordEvent({
          eventId,
          sessionId: currentSession?.id || '582941',
          sourceLanguage: sourceLang.code,
          targetLanguage: lang.code,
          stage: 'TTS',
          eventType: 'TTS_SUCCESS',
          status: 'SUCCESS',
          provider: 'azure-tts',
          latencyMs: Date.now() - ttsStart
        });
        enqueueTtsPlayback({ base64: ttsRes.audio, format: ttsRes.format || "mp3", eventId, targetLangCode: lang.code, sequenceNumber });
        return;
      }
    } catch (err: any) {
      console.warn("Server TTS failed, attempting browser WebSpeech fallback:", err);
      observabilityService.recordEvent({
        eventId,
        sessionId: currentSession?.id || '582941',
        sourceLanguage: sourceLang.code,
        targetLanguage: lang.code,
        stage: 'TTS',
        eventType: 'TTS_FAILURE',
        status: 'FAILURE',
        provider: 'azure-tts',
        errorCode: 'TTS_FAILURE',
        errorMessage: err?.message || 'TTS request failed'
      });
    }

    enqueueTtsPlayback({ text: cleanedText, lang, eventId, sequenceNumber });
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(translatedText);
    setTranslatedText(inputText);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-200 font-sans selection:bg-orange-500/30 flex flex-col overflow-x-hidden">
      {/* Clean Header */}
      <header className="flex justify-between items-center py-3.5 px-6 md:px-8 border-b border-white/[0.06] bg-[#07090e]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center font-extrabold text-white text-xs shadow-md shadow-orange-500/20">
            BB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white leading-none">BharatBridge</h1>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">v4.2</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Real-time Indian Language Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!isLive ? (
            <>
              <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase pr-1">Topic:</span>
                <input
                  type="text"
                  placeholder="e.g. Medical, Tech, AI..."
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  className="bg-transparent text-white placeholder:text-slate-600 outline-none w-28 md:w-36 text-xs"
                  title="Optional Event Topic or Glossary terms for enhanced AI accuracy"
                />
              </div>

              <button 
                onClick={startLiveSession}
                className="px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold rounded-full transition-all shadow-md shadow-orange-500/20 flex items-center gap-1.5"
              >
                <Mic size={14} />
                <span>Host Event</span>
              </button>

              <button 
                onClick={() => setModalOpen({ open: true, type: "join" })}
                className="px-3.5 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5"
              >
                <Volume2 size={14} />
                <span>Join Session</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                PIN: {currentSession?.id}
              </span>
              <button 
                onClick={(sessionRole === 'speaker' || userRole === 'ORGANIZER') ? endLiveSession : () => { setIsLive(false); setCurrentSession(null); if(ws) ws.close(); }}
                className="px-3 py-1 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold rounded-full hover:bg-red-500/25 transition-all"
              >
                {(sessionRole === 'speaker' || userRole === 'ORGANIZER') ? 'End Session' : 'Leave'}
              </button>
            </div>
          )}

          {isAdminUser && (
            <button 
              onClick={() => {
                if (!user && !auth.currentUser) {
                  setModalOpen({ open: true, type: "auth" });
                  return;
                }
                setModalOpen({ open: true, type: "admin" });
              }}
              className="px-3 py-1.5 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-400 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5"
              title="Open Admin Panel"
            >
              <Shield size={14} />
              <span>Admin</span>
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-full pl-1.5 pr-2.5 py-1 text-xs">
              {user.photoURL && <img src={user.photoURL} alt={user.displayName || ''} className="w-5 h-5 rounded-full border border-white/20" referrerPolicy="no-referrer" />}
              <span className="font-medium text-white truncate max-w-[80px] sm:max-w-none">{user.displayName?.split(' ')[0]}</span>
              <button 
                onClick={async () => {
                  try { await signOut(auth); } catch (e) {}
                  localStorage.removeItem("bharat_bridge_user");
                  setUser(null);
                }} 
                className="text-[10px] text-slate-400 hover:text-red-400 transition-colors ml-0.5"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setModalOpen({ open: true, type: "auth" })}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold rounded-full transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] mx-auto w-full flex flex-col gap-4 p-5 lg:p-6 overflow-hidden">

        {/* Sleek Live Session Bar across top when live */}
        {isLive && (
          <div className="bg-[#0f1422]/90 border border-white/[0.08] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                {sessionRole === 'speaker' ? 'Broadcasting Event' : 'Listening Stream'}
              </span>

              {/* 3-Tier Role Badges */}
              {userRole === 'ORGANIZER' && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full font-bold flex items-center gap-1">
                  👑 ORGANIZER
                </span>
              )}
              {userRole === 'PANELIST' && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full font-bold flex items-center gap-1">
                  🎙 PANELIST ({speakerSlot || 'speaker-01'})
                </span>
              )}
              {userRole === 'LISTENER' && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full font-bold flex items-center gap-1">
                  🎧 LISTENER
                </span>
              )}

              {/* Active Panelist Capacity Counter */}
              <span className="text-[11px] font-mono px-2.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full">
                PANELISTS: {activePanelistCount} / 10
              </span>

              {/* Live WebSocket Connection Status Badge */}
              {connectionStatus === 'connected' && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1.5" title="Main Session WebSocket Active">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  CONNECTED
                </span>
              )}
              {connectionStatus === 'reconnecting' && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1.5 animate-pulse" title="Auto-reconnecting to session WebSocket...">
                  <RefreshCw size={11} className="animate-spin text-amber-400" />
                  RECONNECTING...
                </span>
              )}
              {connectionStatus === 'disconnected' && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded-full flex items-center gap-1.5" title="Session WebSocket Disconnected">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  DISCONNECTED
                </span>
              )}

              {(connectionStatus === 'reconnecting' || connectionStatus === 'disconnected') && wsConnectFailed && (
                <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-full px-3 py-1 text-xs text-red-300">
                  <span className="text-[11px] font-medium">
                    Can't connect to the session. Check your network or try again.
                  </span>
                  <button
                    onClick={() => {
                      const sid = activeSessionIdRef.current || currentSession?.id;
                      if (sid) {
                        initWebSocket(sid, sessionRole === 'speaker' ? 'organizer' : 'listener', true);
                      }
                    }}
                    className="px-2.5 py-0.5 bg-red-500/25 hover:bg-red-500/40 border border-red-500/50 text-red-200 text-[11px] font-bold rounded-full transition-all flex items-center gap-1 shrink-0 ml-1"
                  >
                    <RefreshCw size={10} />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              <span className="text-[11px] font-mono px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                {Math.max(0, listenerCount - 1)} listeners
              </span>

              {/* Listener Request to Speak Action */}
              {userRole === 'LISTENER' && (
                <>
                  {speakerRequestStatus === 'idle' && (
                    <button
                      onClick={handleRequestToSpeak}
                      className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                    >
                      ✋ Request to Speak
                    </button>
                  )}
                  {speakerRequestStatus === 'pending' && (
                    <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-lg animate-pulse flex items-center gap-1.5">
                      🟡 Speaker Request Pending...
                    </span>
                  )}
                  {speakerRequestStatus === 'rejected' && (
                    <button
                      onClick={handleRequestToSpeak}
                      className="px-3 py-1 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg flex items-center gap-1.5"
                    >
                      ⚠️ Request Rejected (Try Again)
                    </button>
                  )}
                  {speakerRequestStatus === 'limit_reached' && (
                    <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-lg flex items-center gap-1.5">
                      ⚠️ Panelists Full (10/10)
                    </span>
                  )}
                </>
              )}

              {/* Panelist Switch to Listener Action */}
              {userRole === 'PANELIST' && (
                <button
                  onClick={() => setShowSwitchConfirmModal(true)}
                  className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  🎧 Switch to Listener
                </button>
              )}

              {sessionRole === 'listener' && (
                <button
                  onClick={unmuteAudio}
                  className={`px-2.5 py-0.5 border rounded-md text-[10px] font-bold uppercase flex items-center gap-1 ${
                    audioUnmuted ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/15 border-blue-500/30 text-blue-400 animate-pulse'
                  }`}
                >
                  <Volume2 size={12} />
                  {audioUnmuted ? 'Audio On' : 'Unmute Audio'}
                </button>
              )}

              {/* Voice Speed Setting Selector */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-slate-300 text-[11px] font-mono">
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Speed:</span>
                <select
                  value={playbackRate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlaybackRate(val === "auto" ? "auto" : parseFloat(val));
                  }}
                  className="bg-transparent text-amber-400 font-bold outline-none cursor-pointer text-xs"
                  title="Adjust Speech Voice Speed"
                >
                  <option value="auto" className="bg-slate-900 text-amber-400 font-bold">⚡ Auto (Catch-Up)</option>
                  <option value="0.75" className="bg-slate-900 text-slate-200">0.75x</option>
                  <option value="1.0" className="bg-slate-900 text-slate-200">1.0x (Normal)</option>
                  <option value="1.25" className="bg-slate-900 text-slate-200">1.25x</option>
                  <option value="1.5" className="bg-slate-900 text-slate-200">1.5x</option>
                  <option value="2.0" className="bg-slate-900 text-slate-200">2.0x</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => exportTranscriptTXT(messages, currentSession?.name, currentSession?.id)}
                className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] font-bold text-blue-400 uppercase hover:bg-blue-500/20 transition-all flex items-center gap-1"
              >
                <FileText size={11} /> TXT
              </button>
              <button 
                onClick={() => exportTranscriptCSV(messages, currentSession?.name, currentSession?.id)}
                className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] font-bold text-emerald-400 uppercase hover:bg-emerald-500/20 transition-all flex items-center gap-1"
              >
                <FileSpreadsheet size={11} /> CSV
              </button>
              <button 
                onClick={() => {
                  if (audioBufferRef.current.length === 0) { alert("No audio captured."); return; }
                  let total = 0; for (const c of audioBufferRef.current) total += c.length;
                  const merged = new Float32Array(total); let off = 0;
                  for (const c of audioBufferRef.current) { merged.set(c, off); off += c.length; }
                  downloadAudioWAV(merged, `session-audio-${currentSession?.id}.wav`, inputAudioCtxRef.current?.sampleRate || 16000);
                }}
                className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[10px] font-bold text-purple-400 uppercase hover:bg-purple-500/20 transition-all flex items-center gap-1"
              >
                <Music size={11} /> WAV
              </button>
              {(userRole === 'ORGANIZER' || Boolean(hostToken || hostTokenRef.current)) && (
                <button 
                  onClick={handleGenerateSummary}
                  className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-400 uppercase hover:bg-amber-500/20 transition-all flex items-center gap-1"
                  title="Generate Gemini AI Session Summary"
                >
                  <Sparkles size={11} /> Summary
                </button>
              )}
              <button
                onClick={() => setModalOpen({ open: true, type: "qr" })}
                className="p-1 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-400 hover:bg-orange-500/20"
                title="QR Code"
              >
                <QrCode size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Organizer SPEAKER REQUESTS Approval Panel */}
        {isLive && userRole === 'ORGANIZER' && pendingSpeakerRequests.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <span>✋ SPEAKER REQUESTS</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                  {pendingSpeakerRequests.length} Pending
                </span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                Active Panelists: {activePanelistCount} / 10
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {pendingSpeakerRequests.map(req => (
                <div key={req.userId} className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">{req.userName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Target: {(req.targetLang || "hi").toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSpeakerApproval(req.userId, true)}
                      className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-lg transition-all"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleSpeakerApproval(req.userId, false)}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold rounded-lg transition-all"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1">
          {/* Left Column: Source Input / Original Transcript */}
          <section className={`flex flex-col gap-4 ${sessionRole === 'listener' ? 'order-2 lg:order-1' : 'order-1'}`}>
            <div className="bg-[#0f1422]/60 border border-white/[0.07] rounded-2xl p-5 flex-1 flex flex-col min-h-[420px] backdrop-blur-xl shadow-xl">
              {/* Header / Language card */}
              <div className="flex items-center justify-between mb-3">
                <button 
                  onClick={() => setModalOpen({ open: true, type: "source" })}
                  className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all"
                >
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center font-bold text-orange-400 text-xs">
                    {sourceLang.nativeName[0]}
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {autoDetect ? "Auto Detect" : sourceLang.nativeName}
                  </span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                <button 
                  onClick={swapLanguages}
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                  title="Swap languages"
                >
                  <ArrowRightLeft size={14} />
                </button>
              </div>

              {/* Input text box */}
              <div className="flex-1 bg-black/40 rounded-xl p-4 text-base leading-relaxed text-slate-200 relative group border border-white/[0.04]">
                <textarea
                  dir={sourceLang.direction}
                  value={liveInterimText ? (inputText && inputText.trim() ? `${inputText.trim()}\n${liveInterimText}` : liveInterimText) : inputText}
                  onChange={(e) => {
                    setLiveInterimText("");
                    setInputText(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleTranslateText();
                    }
                  }}
                  placeholder={`Type or speak in ${sourceLang.name}...`}
                  className="w-full h-full bg-transparent border-none outline-none resize-none placeholder:text-slate-600 leading-relaxed"
                />
                {isListening && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] font-mono text-red-400 uppercase">Listening</span>
                  </div>
                )}
              </div>

              {/* Bottom bar */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={toggleListening}
                    className={`p-2.5 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse' : 'bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25'}`}
                    title={isListening ? "Stop Microphone" : "Start Microphone"}
                  >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button 
                    onClick={() => speak(inputText, sourceLang)}
                    disabled={!inputText}
                    className="p-2.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-20"
                    title="Listen to Speech"
                  >
                    <Volume2 size={18} />
                  </button>
                </div>

                {inputText.trim() && (
                  <button 
                    onClick={() => setInputText("")}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Clear Text
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Right Column: Target Output / Live Translation Feed */}
          <section className={`flex flex-col gap-4 ${sessionRole === 'listener' ? 'order-1 lg:order-2' : 'order-2'}`}>
            <div className="bg-[#0f1422]/60 border border-white/[0.07] rounded-2xl p-5 flex-1 flex flex-col min-h-[420px] backdrop-blur-xl shadow-xl">
              {/* Header / Language card & Broadcasting status */}
              <div className="flex items-center justify-between mb-3">
                <button 
                  onClick={() => setModalOpen({ open: true, type: "target" })}
                  className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400 text-xs">
                    {targetLang.nativeName[0]}
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {targetLang.nativeName}
                  </span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {isLive && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                      {sessionRole === 'speaker' ? 'Broadcasting Live' : 'Live Stream'}
                    </span>
                  </div>
                )}
              </div>

              {/* Output / Messages feed */}
              <div 
                dir={targetLang.direction}
                className="flex-1 bg-black/40 rounded-xl p-4 text-base leading-relaxed text-slate-200 overflow-y-auto border border-white/[0.04] space-y-3"
              >
                {/* Live Interim Caption Pill */}
                {liveInterimText && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-300 text-sm font-medium flex items-center gap-2 animate-pulse">
                    <Mic size={16} className="text-amber-400 shrink-0" />
                    <span className="truncate">{liveInterimText}</span>
                  </div>
                )}

                {messages.length > 0 ? (
                  <div className="space-y-3">
                    {messages.map((msg, idx) => (
                      <div key={msg.id || idx} className="p-3 bg-white/[0.03] border border-white/[0.05] rounded-xl space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                          <span className="text-blue-400 font-semibold">
                            {msg.speakerName ? `🎙 ${msg.speakerId || 'speaker-01'} — ${msg.speakerName}` : `Message #${messages.length - idx}`}
                          </span>
                          <span>{formatTimestamp(msg.timestamp)}</span>
                        </div>
                        <p className="text-sm font-bold text-white pt-0.5">{msg.translatedText || msg.originalText}</p>
                        {msg.originalText && msg.translatedText !== msg.originalText && (
                          <p className="text-xs text-slate-400 italic border-l-2 border-slate-700 pl-2 py-0.5">{msg.originalText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    {isTranslating ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 py-2">
                        <div className="h-4 bg-white/5 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-white/5 rounded w-4/6 animate-pulse"></div>
                      </motion.div>
                    ) : !liveInterimText ? (
                      <motion.p
                        key={translatedText}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={!translatedText ? 'text-slate-600 italic text-sm' : ''}
                      >
                        {translatedText || `Live captions in ${targetLang.name} will appear here as soon as speech is detected...`}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                )}
              </div>

              {/* Bottom bar */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => speak(translatedText, targetLang)}
                    disabled={!translatedText}
                    className="p-2.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 rounded-xl transition-all disabled:opacity-20 flex items-center gap-1.5"
                    title="Listen to Speech"
                  >
                    <Volume2 size={18} />
                    <span className="text-xs font-semibold">Listen</span>
                  </button>

                  {/* Voice Speed Setting Option */}
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs font-mono">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Speed:</span>
                    <select
                      value={playbackRate}
                      onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                      className="bg-transparent text-amber-400 font-bold outline-none cursor-pointer"
                      title="Adjust Speech Voice Speed"
                    >
                      <option value="0.75" className="bg-slate-900 text-slate-200">0.75x (Slower)</option>
                      <option value="1.0" className="bg-slate-900 text-slate-200">1.0x (Normal)</option>
                      <option value="1.25" className="bg-slate-900 text-slate-200">1.25x (Faster)</option>
                      <option value="1.5" className="bg-slate-900 text-slate-200">1.5x</option>
                      <option value="2.0" className="bg-slate-900 text-slate-200">2.0x</option>
                    </select>
                  </div>

                  <button 
                    onClick={() => copyToClipboard(translatedText)}
                    disabled={!translatedText}
                    className="p-2.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-20"
                    title="Copy Text"
                  >
                    {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Minimalist Footer */}
      <footer className="py-3 border-t border-white/[0.06] bg-[#07090e] flex items-center justify-between px-6 md:px-8 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-400">BharatBridge</span>
          <span className="w-1 h-1 rounded-full bg-slate-700"></span>
          <span>22 Official Languages</span>
        </div>
        <div className="font-mono text-[10px] text-slate-600">
          © 2026 BharatBridge • Neural Matrix v4.2
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {(modalOpen.type === "source" || modalOpen.type === "target") && (
          <LanguageModal 
            isOpen={modalOpen.open} 
            title={modalOpen.type === "source" ? "Source Selection" : "Target Selection"}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
            selectedCode={modalOpen.type === "source" ? sourceLang.code : targetLang.code}
            onSelect={(lang) => {
              if (modalOpen.type === "source") setSourceLang(lang);
              else {
                setTargetLang(lang);
                const activeWs = wsRef.current || ws;
                if (isLive && activeWs && activeWs.readyState === WebSocket.OPEN && currentSession) {
                  activeWs.send(JSON.stringify({
                    type: "join",
                    sessionId: currentSession.id,
                    role: sessionRole || "listener",
                    gender: profile.gender,
                    targetLang: lang.code
                  }));
                }
              }
            }}
          />
        )}
        {modalOpen.open && modalOpen.type === "qr" && (
          <QRModal 
            isOpen={modalOpen.open}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
            sessionId={currentSession?.id || '582941'}
          />
        )}
        {modalOpen.open && modalOpen.type === "join" && (
          <JoinModal 
            isOpen={modalOpen.open}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
            onJoin={(pin) => joinLiveSession(pin)}
          />
        )}
        {modalOpen.open && modalOpen.type === "history" && (
          <HistoryModal 
            isOpen={modalOpen.open}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
            savedSessions={savedSessionsHistory}
            onDelete={handleDeleteSavedSession}
          />
        )}
        {modalOpen.open && modalOpen.type === "profile" && (
          <ProfileModal 
            isOpen={modalOpen.open}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
            profile={profile}
            onUpdate={(newProfile) => {
              setProfile(newProfile);
              if (newProfile.defaultSourceCode !== profile.defaultSourceCode) {
                const s = LANGUAGES.find(l => l.code === newProfile.defaultSourceCode);
                if (s) setSourceLang(s);
              }
              if (newProfile.defaultTargetCode !== profile.defaultTargetCode) {
                const t = LANGUAGES.find(l => l.code === newProfile.defaultTargetCode);
                if (t) setTargetLang(t);
              }
            }}
          />
        )}
        {modalOpen.open && modalOpen.type === "admin" && (user || auth.currentUser) && (
          <AdminModal 
            isOpen={modalOpen.open}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
          />
        )}
        {modalOpen.open && modalOpen.type === "summary" && (
          <SummaryModal 
            isOpen={modalOpen.open}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
            summary={summaryContent}
            isLoading={isGeneratingSummary}
            onDownload={downloadSummaryTXT}
          />
        )}
        {modalOpen.open && modalOpen.type === "auth" && (
          <AuthModal 
            isOpen={modalOpen.open}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
            onUserLogin={(userObj) => {
              setUser(userObj);
              localStorage.setItem("bharat_bridge_user", JSON.stringify(userObj));
            }}
          />
        )}
        {showSwitchConfirmModal && (
          <SwitchConfirmModal
            isOpen={showSwitchConfirmModal}
            onClose={() => setShowSwitchConfirmModal(false)}
            onConfirm={handleConfirmSwitchToListener}
          />
        )}
      </AnimatePresence>

      <style>{`
        .font-serif { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
