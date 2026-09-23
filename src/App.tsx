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
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LANGUAGES, POPULAR_LANGUAGES } from "./languages";
import { LanguageConfig, UserProfile, TranslationPair, Session, Message as FBMessage } from "./types";
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType } from "./lib/firebase";
import { uploadCaptionToAzure } from "./lib/azure-storage";
import { generateQRCodeSVG } from "./lib/qrcode";
import { translateText, synthesizeSpeech } from "./services/api";
import { downloadAudioWAV } from "./lib/audio-export";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { 
  collection, 
  addDoc, 
  setDoc,
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  where,
  getDocs,
  getDoc,
  limit
} from "firebase/firestore";

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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionMessages, setSessionMessages] = useState<FBMessage[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Session[]);
    });
    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!selectedSession) {
      setSessionMessages([]);
      return;
    }
    const q = query(collection(db, "sessions", selectedSession.id, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessionMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FBMessage[]);
    });
    return () => unsubscribe();
  }, [selectedSession]);

  if (!isOpen) return null;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={onClose}>
      <motion.div className="w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="w-1/3 border-r border-white/5 flex flex-col">
          <div className="p-6 border-b border-white/5">
            <h3 className="font-bold text-white">All Sessions</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {sessions.map(s => (
              <button 
                key={s.id} 
                onClick={() => setSelectedSession(s)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${selectedSession?.id === s.id ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
              >
                <p className="text-xs font-bold text-white truncate">{s.name}</p>
                <p className="text-[10px] text-slate-500">{s.sourceLang} → {s.targetLang}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-black/20">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-white">{selectedSession ? selectedSession.name : 'Select a Session'}</h3>
              {selectedSession && sessionMessages.length > 0 && (
                <button 
                  onClick={() => exportTranscriptTXT(sessionMessages, selectedSession.name, selectedSession.id)}
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-blue-400 transition-all flex items-center gap-2"
                  title="Download Transcript"
                >
                  <Download size={14} />
                  <span className="text-[10px] font-bold uppercase">Export</span>
                </button>
              )}
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {sessionMessages.map(m => (
              <div key={m.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                  <span>Source: {m.sourceLang}</span>
                  <span>Target: {m.targetLang}</span>
                </div>
                <p className="text-xs text-slate-400 italic border-l border-white/10 pl-3 py-1">{m.originalText}</p>
                <p className="text-sm text-white font-semibold">{m.translatedText}</p>
              </div>
            ))}
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
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [listenerCount, setListenerCount] = useState(0);
  const [copiedId, setCopiedId] = useState(false);

  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [azureSyncStatus, setAzureSyncStatus] = useState<{ syncing: boolean; success?: boolean; message?: string }>({ syncing: false });

  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const isLiveRef = useRef<boolean>(false);

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

  const handleGenerateSummary = async () => {
    if (messages.length === 0) {
      alert("No session transcript messages available to summarize yet.");
      return;
    }
    setIsGeneratingSummary(true);
    setModalOpen({ open: true, type: "summary" });
    try {
      const res = await fetch("/api/session-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession?.id,
          messages,
          targetLanguage: targetLang.name
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryContent(data.summary || "Summary generated.");
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
    const sessionId = params.get('session') || params.get('room') || params.get('pin');
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

  const isAdminUser = user?.email === 'shrushti.cyda@gmail.com';

  useEffect(() => {
    localStorage.setItem("bharat_bridge_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (!currentSession) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, "sessions", currentSession.id, "messages"),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FBMessage[];
      setMessages(newMessages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `sessions/${currentSession.id}/messages`);
    });

    return () => unsubscribe();
  }, [currentSession]);

  const syncToAzure = async () => {
    if (messages.length === 0) return;
    setAzureSyncStatus({ syncing: true });
    const result = await uploadCaptionToAzure(
      currentSession?.id || 'session-demo',
      currentSession?.name || 'Live Event',
      messages
    );
    if (result.success) {
      setAzureSyncStatus({ syncing: false, success: true, message: result.blobName ? `Uploaded: ${result.blobName}` : 'Synced to Azure Storage' });
    } else {
      setAzureSyncStatus({ syncing: false, success: false, message: result.error || 'Sync failed' });
    }
    setTimeout(() => setAzureSyncStatus({ syncing: false }), 4000);
  };

  const ttsQueueRef = useRef<Array<{ base64?: string; text?: string; lang?: LanguageConfig; format?: string }>>([]);
  const isPlayingTtsRef = useRef<boolean>(false);
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);

  const enqueueTtsPlayback = (item: { base64?: string; text?: string; lang?: LanguageConfig; format?: string }) => {
    ttsQueueRef.current.push(item);
    processTtsQueue();
  };

  const processTtsQueue = async () => {
    if (isPlayingTtsRef.current || ttsQueueRef.current.length === 0) return;
    isPlayingTtsRef.current = true;

    const item = ttsQueueRef.current.shift()!;
    try {
      if (item.base64) {
        await playSingleAudioChunk(item.base64, item.format);
      } else if (item.text && item.lang) {
        await playSingleWebSpeech(item.text, item.lang);
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

  const playSingleAudioChunk = (base64: string, format?: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!base64) return resolve();
      unmuteAudio();

      if (activeAudioElRef.current) {
        try { activeAudioElRef.current.pause(); } catch (_) {}
        activeAudioElRef.current = null;
      }

      const audioUrl = `data:${format || "audio/mp3"};base64,${base64}`;
      const audioEl = new Audio(audioUrl);
      audioEl.playbackRate = playbackRate;
      activeAudioElRef.current = audioEl;

      audioEl.onended = () => {
        activeAudioElRef.current = null;
        resolve();
      };
      audioEl.onerror = () => {
        activeAudioElRef.current = null;
        resolve();
      };

      audioEl.play().catch(() => {
        activeAudioElRef.current = null;
        resolve();
      });
    });
  };

  const playSingleWebSpeech = (text: string, lang: LanguageConfig): Promise<void> => {
    return new Promise((resolve) => {
      if (!text || typeof window === "undefined" || !window.speechSynthesis) return resolve();
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        const voices = window.speechSynthesis.getVoices();
        const exactVoice = voices.find(v => 
          v.lang.toLowerCase() === `${lang.code}-in` || 
          v.lang.toLowerCase().startsWith(lang.code)
        );
        const utterance = new SpeechSynthesisUtterance(text);
        if (exactVoice) utterance.voice = exactVoice;
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

  const startLiveSession = async () => {
    const activeUserId = user?.uid || `guest-${Math.random().toString(36).substring(2, 9)}`;
    const pinCode = Math.floor(100000 + Math.random() * 900000).toString(); // Memorable 6-digit PIN (e.g. 582941)
    const sessionData = {
      id: pinCode,
      name: `Live Session #${pinCode} - ${sourceLang.name} to ${targetLang.name}`,
      createdAt: serverTimestamp(),
      speakerId: activeUserId,
      speakerGender: profile.gender,
      sourceLang: sourceLang.code,
      targetLang: targetLang.code,
      status: 'active'
    };

    const sessionId = pinCode;
    
    // Save to Firestore asynchronously (non-blocking so room creation is instant)
    setDoc(doc(db, "sessions", pinCode), sessionData).catch((error) => {
      console.warn("Firestore save fallback to local session ID:", error);
    });

    audioBufferRef.current = [];
    setCurrentSession(sessionData as any);
    isLiveRef.current = true;
    setIsLive(true);
    setSessionRole('speaker');
    setAutoDetect(true);
    setModalOpen({ open: true, type: "qr" });

    // Trigger microphone & audio permission synchronously on user tap (required by mobile iOS/Android gesture policies)
    unmuteAudio();
    toggleListening(true);

    // Setup WebSocket immediately
    const socket = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`);
    wsRef.current = socket;
    setWs(socket);

    socket.onopen = () => {
      socket.send(JSON.stringify({ 
        type: "join", 
        sessionId, 
        role: "speaker", 
        gender: profile.gender,
        targetLang: targetLang.code
      }));
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "audio") playAudioChunk(msg.audio, msg.format);
      if (msg.type === "stats") setListenerCount(msg.listeners);
      if (msg.type === "transcription") {
        if (msg.isFinal) {
          pushMessageToLive(msg.originalText, msg.translatedText);
        }
      }
      if (msg.type === "interrupted") {
        nextStartTimeRef.current = 0;
      }
    };
  };

  const endLiveSession = async () => {
    if (!currentSession || sessionRole !== 'speaker') return;
    shouldBeListeningRef.current = false;
    isLiveRef.current = false;
    try {
      await updateDoc(doc(db, "sessions", currentSession.id), {
        status: 'finished'
      }).catch(() => {});
    } finally {
      setIsLive(false);
      setSessionRole(null);
      setCurrentSession(null);
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
    let sessionData = {
      sourceLang: sourceLang.code,
      targetLang: targetLang.code,
      name: `Live Session #${sessionId}`
    };

    let targetLangConfig: LanguageConfig | undefined = undefined;
    try {
      const docRef = doc(db, "sessions", sessionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        sessionData = { ...sessionData, ...data };
        const s = LANGUAGES.find(l => l.code === data.sourceLang);
        if (s) setSourceLang(s);
      }
    } catch (error) {
      console.warn("Firestore lookup fallback:", error);
    }

    audioBufferRef.current = [];
    setCurrentSession({ id: sessionId, ...sessionData } as Session);
    isLiveRef.current = true;
    setIsLive(true);
    setSessionRole('listener');
    setModalOpen({ open: true, type: "target" });

    // Setup WebSocket
    const socket = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`);
    wsRef.current = socket;
    setWs(socket);

    socket.onopen = () => {
      unmuteAudio();
      socket.send(JSON.stringify({ 
        type: "join", 
        sessionId, 
        role: "listener",
        targetLang: targetLang.code
      }));
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "audio") playAudioChunk(msg.audio, msg.format);
      if (msg.type === "stats") setListenerCount(msg.listeners);
      if (msg.type === "history" && Array.isArray(msg.messages)) {
        const uniqueHistory: FBMessage[] = [];
        const seenTexts = new Set<string>();

        for (let idx = 0; idx < msg.messages.length; idx++) {
          const m = msg.messages[idx];
          const key = (m.originalText || "").trim().toLowerCase();
          if (key && !seenTexts.has(key)) {
            seenTexts.add(key);
            uniqueHistory.push({
              id: `hist-${m.timestamp || idx}`,
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
        if (msg.translatedText) {
          setTranslatedText(msg.translatedText);
        }
        if (msg.isFinal && msg.translatedText && msg.translatedText.trim()) {
          const now = Date.now();
          const cleanText = msg.translatedText.trim();
          if (lastListenerSpokenRef.current.text === cleanText && (now - lastListenerSpokenRef.current.time < 4000)) {
            return;
          }
          lastListenerSpokenRef.current = { text: cleanText, time: now };

          setMessages(prev => {
            const cleanOriginal = (msg.originalText || "").trim().toLowerCase();
            const exists = prev.some(m => (m.originalText || "").trim().toLowerCase() === cleanOriginal);
            if (exists) return prev;
            return [{
              id: `live-${Date.now()}`,
              originalText: msg.originalText,
              translatedText: msg.translatedText,
              timestamp: { seconds: Math.floor(Date.now() / 1000) } as any,
              sourceLang: sourceLang.code,
              targetLang: targetLang.code
            } as FBMessage, ...prev];
          });
          speak(msg.translatedText, targetLang);
        }
      }
    };
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

    setMessages(prev => {
      const exists = prev.some(m => m.originalText === original && m.translatedText === translated);
      if (exists) return prev;
      return [newMessage, ...prev];
    });

    if (user) {
      try {
        await addDoc(collection(db, "sessions", currentSession.id, "messages"), {
          originalText: original,
          translatedText: translated,
          timestamp: serverTimestamp(),
          senderId: user.uid,
          sourceLang: sourceLang.code,
          targetLang: targetLang.code
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `sessions/${currentSession.id}/messages`);
      }
    }
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
  const sentenceQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const lastProcessedSentenceRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });
  const lastListenerSpokenRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });

  const enqueueSpokenSentence = (sentence: string) => {
    const clean = sentence.trim();
    if (!clean) return;

    // Prevent duplicate STT invocations for building or partial sentences within 4000ms
    const now = Date.now();
    const prevText = lastProcessedSentenceRef.current.text.toLowerCase();
    const cleanLower = clean.toLowerCase();

    if ((prevText === cleanLower || (prevText.length > 5 && cleanLower.includes(prevText)) || (cleanLower.length > 5 && prevText.includes(cleanLower))) && (now - lastProcessedSentenceRef.current.time < 4000)) {
      if (cleanLower.length > prevText.length) {
        lastProcessedSentenceRef.current.text = clean;
      }
      return;
    }
    lastProcessedSentenceRef.current = { text: clean, time: now };

    sentenceQueueRef.current.push(clean);
    processSentenceQueue();
  };

  const processSentenceQueue = async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    while (sentenceQueueRef.current.length > 0) {
      const sentence = sentenceQueueRef.current.shift()!;
      setInputText(prev => (prev && prev.trim() ? `${prev.trim()}\n${sentence}` : sentence));
      await handleTranslateText(sentence, true);
    }

    isProcessingQueueRef.current = false;
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

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
          setLiveInterimText(interim.trim());
        }

        if (finalChunk.trim()) {
          setLiveInterimText("");
          enqueueSpokenSentence(finalChunk.trim());
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.warn("Speech recognition event:", event.error);
        if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'network') {
          return;
        }
        if (!shouldBeListeningRef.current) {
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        if (shouldBeListeningRef.current) {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (e) {
            setTimeout(() => {
              if (shouldBeListeningRef.current) {
                try { recognitionRef.current?.start(); setIsListening(true); } catch (_) {}
              }
            }, 150);
          }
        } else {
          setIsListening(false);
        }
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
    const isLiveActive = overrideLive !== undefined ? overrideLive : (isLiveRef.current || isLive);
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
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        
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

  const handleTranslateText = async (overrideText?: string, isLiveSpokenLine?: boolean) => {
    const textToProcess = (overrideText !== undefined ? overrideText : inputText).trim();
    if (!textToProcess) return;
    
    setIsTranslating(true);
    try {
      const recentContext = messages.slice(-6).map(m => ({ originalText: m.originalText, translatedText: m.translatedText }));

      // Split into lines for line-by-line processing
      const lines = textToProcess.split('\n').filter(l => l.trim().length > 0);
      const translatedLines: string[] = [];

      for (const line of lines) {
        const result = await translateText({
          text: line.trim(),
          sourceLanguage: autoDetect ? undefined : sourceLang.name,
          targetLanguage: targetLang.name,
          context: recentContext
        });
        const lineTranslation = result.translatedText || line.trim();
        translatedLines.push(lineTranslation);

        if (isLive && sessionRole === 'speaker') {
          pushMessageToLive(line.trim(), lineTranslation);

          const activeWs = wsRef.current || ws;
          if (activeWs && activeWs.readyState === WebSocket.OPEN) {
            activeWs.send(JSON.stringify({
              type: "text_translation",
              originalText: line.trim(),
              translatedText: lineTranslation,
              sourceLang: sourceLang.code,
              targetLang: targetLang.code,
              context: recentContext,
              isFinal: true
            }));
          }
        }
      }

      const fullTranslation = translatedLines.join('\n');
      // The speaker should NOT see target translations in their output panel
      if (sessionRole !== 'speaker') {
        if (isLiveSpokenLine) {
          setTranslatedText(prev => (prev && prev.trim() ? `${prev.trim()}\n${fullTranslation}` : fullTranslation));
        } else {
          setTranslatedText(fullTranslation);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslate = () => handleTranslateText();

  // Debounced translation for real-time and manual modes
  useEffect(() => {
    if (!inputText) return;
    
    const delay = isLive ? 1000 : 1000;
    const timer = setTimeout(() => {
      handleTranslate();
    }, delay);
    return () => clearTimeout(timer);
  }, [inputText, targetLang, isLive]);

  const speak = async (text: string, lang: LanguageConfig) => {
    if (!text || typeof window === "undefined") return;
    unmuteAudio();

    try {
      const ttsRes = await synthesizeSpeech({
        text,
        languageCode: lang.code === "en" ? "en-IN" : `${lang.code}-IN`
      });
      if (ttsRes.success && ttsRes.audio) {
        enqueueTtsPlayback({ base64: ttsRes.audio, format: ttsRes.format || "mp3" });
        return;
      }
    } catch (err) {
      console.warn("Server TTS failed, attempting browser WebSpeech fallback:", err);
    }

    enqueueTtsPlayback({ text, lang });
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
                onClick={sessionRole === 'speaker' ? endLiveSession : () => { setIsLive(false); setCurrentSession(null); if(ws) ws.close(); }}
                className="px-3 py-1 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold rounded-full hover:bg-red-500/25 transition-all"
              >
                {sessionRole === 'speaker' ? 'End Session' : 'Leave'}
              </button>
            </div>
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
              <span className="text-[11px] font-mono px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                {listenerCount} listeners
              </span>
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
                  downloadAudioWAV(merged, `session-audio-${currentSession?.id}.wav`);
                }}
                className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[10px] font-bold text-purple-400 uppercase hover:bg-purple-500/20 transition-all flex items-center gap-1"
              >
                <Music size={11} /> WAV
              </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1">
          {/* Left Column: Source Input / Original Transcript */}
          <section className="flex flex-col gap-4">
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
          <section className="flex flex-col gap-4">
            <div className="bg-[#0f1422]/60 border border-white/[0.07] rounded-2xl p-5 flex-1 flex flex-col min-h-[420px] backdrop-blur-xl shadow-xl">
              {/* Header / Language card */}
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
              </div>

              {/* Output / Messages feed */}
              <div 
                dir={targetLang.direction}
                className="flex-1 bg-black/40 rounded-xl p-4 text-base leading-relaxed text-slate-200 overflow-y-auto border border-white/[0.04]"
              >
                {isLive && messages.length > 0 ? (
                  <div className="space-y-3">
                    {messages.map((msg, idx) => (
                      <div key={msg.id || idx} className="p-3 bg-white/[0.03] border border-white/[0.05] rounded-xl space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                          <span className="text-blue-400 font-semibold">Message #{messages.length - idx}</span>
                          <span>{formatTimestamp(msg.timestamp)}</span>
                        </div>
                        {sessionRole !== 'speaker' && (
                          <p className="text-sm font-semibold text-white pt-0.5">{msg.translatedText}</p>
                        )}
                        <p className="text-xs text-slate-400 italic border-l-2 border-slate-700 pl-2 py-0.5">{msg.originalText}</p>
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
                    ) : sessionRole === 'speaker' && isLive ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center p-4 text-slate-400 space-y-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                        <p className="text-xs font-semibold text-emerald-400">Broadcasting Live to Room</p>
                        <p className="text-[11px] text-slate-500">Your speech is translated contextually and streamed directly to room listeners in real-time.</p>
                      </motion.div>
                    ) : (
                      <motion.p
                        key={translatedText}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={!translatedText ? 'text-slate-600 italic text-sm' : ''}
                      >
                        {translatedText || `Translated content in ${targetLang.name} will appear here...`}
                      </motion.p>
                    )}
                  </AnimatePresence>
                )}
              </div>

              {/* Bottom bar */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => speak(translatedText, targetLang)}
                    disabled={!translatedText}
                    className="p-2.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 rounded-xl transition-all disabled:opacity-20"
                    title="Listen to Speech"
                  >
                    <Volume2 size={18} />
                  </button>
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
        {modalOpen.open && modalOpen.type === "admin" && (
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
