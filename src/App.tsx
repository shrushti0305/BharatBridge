/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from "react";
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
  Gauge
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LANGUAGES, POPULAR_LANGUAGES } from "./languages";
import { LanguageConfig, UserProfile, TranslationPair, Session, Message as FBMessage } from "./types";
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType } from "./lib/firebase";
import { uploadCaptionToAzure } from "./lib/azure-storage";
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
  limit
} from "firebase/firestore";

// --- Components ---

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
                  onClick={() => exportTranscript(sessionMessages, selectedSession.name, selectedSession.id)}
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

const exportTranscript = (messages: FBMessage[], sessionName?: string, sessionId?: string) => {
  if (messages.length === 0) return;
  const sessionInfo = `Session: ${sessionName || 'Unknown'}\nID: ${sessionId || 'N/A'}\nDate: ${new Date().toLocaleString()}\n\n`;
  const content = messages
    .slice()
    .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))
    .map(m => {
      const time = m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString() : "Pending";
      return `[${time}] ${m.sourceLang?.toUpperCase() || 'SRC'}: ${m.originalText}\n[${time}] ${m.targetLang?.toUpperCase() || 'TRG'}: ${m.translatedText}\n`;
    })
    .join("\n---\n\n");
  
  const blob = new Blob([sessionInfo + content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transcript-${sessionId || 'session'}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
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
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [modalOpen, setModalOpen] = useState<{ open: boolean; type: "source" | "target" | "profile" | "admin" }>({ open: false, type: "source" });
  const [autoDetect, setAutoDetect] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    if (sessionId && !isLive) {
      joinLiveSession(sessionId);
    }
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

  const playAudioChunk = (base64: string) => {
    if (!outputAudioCtxRef.current) {
      outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = outputAudioCtxRef.current;
    const pcm = base64ToPcm(base64);
    const buffer = ctx.createBuffer(1, pcm.length, 24000);
    buffer.getChannelData(0).set(pcm);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.connect(ctx.destination);
    
    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + (buffer.duration / playbackRate);
  };

  const startLiveSession = async () => {
    const activeUserId = user?.uid || `guest-${Math.random().toString(36).substring(2, 9)}`;
    const pinCode = Math.floor(100000 + Math.random() * 900000).toString(); // Memorable 6-digit PIN (e.g. 582941)
    const sessionData = {
      name: `Live Session #${pinCode} - ${sourceLang.name} to ${targetLang.name}`,
      createdAt: serverTimestamp(),
      speakerId: activeUserId,
      speakerGender: profile.gender,
      sourceLang: sourceLang.code,
      targetLang: targetLang.code,
      status: 'active'
    };

    const sessionId = pinCode;
    try {
      await setDoc(doc(db, "sessions", pinCode), sessionData);
    } catch (error) {
      console.warn("Firestore save fallback to local session ID:", error);
    }

    setCurrentSession({ id: sessionId, ...sessionData } as Session);
    setIsLive(true);
    setSessionRole('speaker');

    // Setup WebSocket
    const socket = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`);
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
      if (msg.type === "audio") playAudioChunk(msg.audio);
      if (msg.type === "stats") setListenerCount(msg.listeners);
      if (msg.type === "transcription") {
        if (msg.isFinal && currentSession && sessionRole === 'speaker') {
          pushMessageToLive(msg.originalText, msg.translatedText);
        }
      }
      if (msg.type === "interrupted") {
        nextStartTimeRef.current = 0;
      }
    };
    setWs(socket);
  };

  const endLiveSession = async () => {
    if (!currentSession || sessionRole !== 'speaker') return;
    try {
      await updateDoc(doc(db, "sessions", currentSession.id), {
        status: 'finished'
      }).catch(() => {});
    } finally {
      setIsLive(false);
      setSessionRole(null);
      setCurrentSession(null);
      if (ws) ws.close();
      setWs(null);
      if (inputAudioCtxRef.current) inputAudioCtxRef.current.close();
      if (outputAudioCtxRef.current) outputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
      outputAudioCtxRef.current = null;
    }
  };

  const joinLiveSession = async (rawSessionId: string) => {
    const sessionId = rawSessionId.trim();
    let sessionData = {
      sourceLang: sourceLang.code,
      targetLang: targetLang.code,
      name: `Live Session #${sessionId}`
    };

    try {
      const snapshot = await getDocs(query(collection(db, "sessions"), where("__name__", "==", sessionId)));
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        sessionData = { ...sessionData, ...data };
        const s = LANGUAGES.find(l => l.code === data.sourceLang);
        const t = LANGUAGES.find(l => l.code === data.targetLang);
        if (s) setSourceLang(s);
        if (t) setTargetLang(t);
      }
    } catch (error) {
      console.warn("Firestore lookup fallback:", error);
    }

    setCurrentSession({ id: sessionId, ...sessionData } as Session);
    setIsLive(true);
    setSessionRole('listener');

    // Setup WebSocket
    const socket = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`);
    socket.onopen = () => {
      socket.send(JSON.stringify({ 
        type: "join", 
        sessionId, 
        role: "listener",
        targetLang: targetLang.code
      }));
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "audio") playAudioChunk(msg.audio);
      if (msg.type === "stats") setListenerCount(msg.listeners);
      if (msg.type === "transcription") {
        if (msg.isFinal) {
          setMessages(prev => {
            const exists = prev.some(m => m.originalText === msg.originalText && m.translatedText === msg.translatedText);
            if (exists) return prev;
            return [...prev, {
              id: `live-${Date.now()}`,
              originalText: msg.originalText,
              translatedText: msg.translatedText,
              timestamp: { seconds: Math.floor(Date.now() / 1000) } as any,
              sourceLang: sourceLang.code,
              targetLang: msg.targetLang || targetLang.code
            } as FBMessage];
          });
        }
      }
    };
    setWs(socket);
  };

  const pushMessageToLive = async (original: string, translated: string) => {
    if (!currentSession || !user) return;
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

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Update recognition language
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = sourceLang.code === "en" ? "en-IN" : `${sourceLang.code}-IN`;
    }
  }, [sourceLang]);

  const toggleListening = async () => {
    if (isListening) {
      if (isLive) {
        if (inputAudioCtxRef.current) {
          inputAudioCtxRef.current.close();
          inputAudioCtxRef.current = null;
        }
        setIsListening(false);
      } else {
        recognitionRef.current?.stop();
      }
      return;
    }

    if (isLive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsListening(true);

        if (!inputAudioCtxRef.current) {
          inputAudioCtxRef.current = new AudioContext({ sampleRate: 16000 });
        }
        const ctx = inputAudioCtxRef.current;
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        
        source.connect(processor);
        processor.connect(ctx.destination);

        processor.onaudioprocess = (e) => {
          const pcm = e.inputBuffer.getChannelData(0);
          const base64 = pcmToBase64(pcm);
          
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "audio", audio: base64 }));
          }
        };
      } catch (error) {
        console.error("Microphone access denied:", error);
        alert("Microphone access is required for live translation.");
      }
    } else {
      setInputText("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    
    setIsTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          sourceLanguage: autoDetect ? undefined : sourceLang.name,
          targetLanguage: targetLang.name
        })
      });
      const data = await res.json();
      setTranslatedText(data.translatedText);
      
      if (isLive && sessionRole === 'speaker') {
        pushMessageToLive(inputText, data.translatedText);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Debounced translation for real-time and manual modes
  useEffect(() => {
    if (!inputText) return;
    
    const delay = isLive ? 3000 : 1000; // Longer delay for live to avoid too many API calls
    const timer = setTimeout(() => {
      if (isLive || !isListening) {
        handleTranslate();
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [inputText, targetLang, isLive, isListening]);

  const speak = (text: string, lang: LanguageConfig) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(lang.code)) || voices.find(v => v.lang.includes("IN"));
    if (voice) utterance.voice = voice;
    utterance.lang = lang.code === "en" ? "en-IN" : `${lang.code}-IN`;
    
    window.speechSynthesis.speak(utterance);
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
    <div className="min-h-screen bg-[#020408] text-slate-200 font-sans selection:bg-orange-500/30 flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="flex justify-between items-center py-6 px-8 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-tr from-orange-500 via-white to-green-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(255,165,0,0.3)]">
            <div className="w-6 h-6 border-2 border-slate-900 rounded-full flex items-center justify-center font-bold text-[10px]">BB</div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">BharatBridge</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Unified Indian Language Grid</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full pl-2 pr-4 py-1.5 shadow-lg">
              {user.photoURL && <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />}
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white leading-none">{user.displayName}</span>
                <button onClick={() => signOut(auth)} className="text-[10px] text-slate-500 hover:text-red-400 transition-colors text-left">Sign Out</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            >
              Get Started
            </button>
          )}
          {isAdminUser && (
            <button 
              onClick={() => setModalOpen({ open: true, type: "admin" })}
              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-full text-blue-400 transition-all shadow-lg"
              title="Admin Panel"
            >
              <Languages size={20} />
            </button>
          )}
          <button 
            onClick={() => setModalOpen({ open: true, type: "profile" })}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-slate-400 hover:text-white transition-all shadow-lg"
          >
            <Settings size={20} />
          </button>
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'}`}></div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              STT Pipeline: {isListening ? 'Streaming' : 'Active'}
            </span>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-500 uppercase">Server Node</p>
            <p className="text-xs font-mono text-orange-400">BHARAT-WEST-042</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 lg:p-8 overflow-hidden">
        
        {/* Left Column: Source Input */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1 flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Source Input</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setAutoDetect(!autoDetect)}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${autoDetect ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}
                >
                  AUTO DETECT
                </button>
              </div>
            </div>

            <button 
              onClick={() => setModalOpen({ open: true, type: "source" })}
              className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 mb-4 hover:bg-white/10 transition-colors group text-left"
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl shadow-inner">
                {sourceLang.nativeName[0]}
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400">From Language</p>
                <p className="text-lg font-semibold text-white">
                  {autoDetect ? "Auto Detect" : sourceLang.nativeName}
                  <span className="text-slate-500 font-normal ml-2 text-sm hidden sm:inline">{autoDetect ? "" : sourceLang.name}</span>
                </p>
              </div>
              <ChevronDown size={16} className="text-slate-500 group-hover:text-orange-400 transition-colors" />
            </button>

            <div className="flex-1 bg-black/40 rounded-xl p-6 font-serif text-lg leading-relaxed text-slate-300 relative group">
              <textarea
                dir={sourceLang.direction}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Speak or type in ${sourceLang.name}...`}
                className="w-full h-full bg-transparent border-none outline-none resize-none placeholder:text-slate-700 leading-relaxed"
              />
              {isListening && (
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className="w-1 h-3 bg-orange-500 rounded-full animate-pulse"></span>
                  <span className="w-1 h-3 bg-orange-500 rounded-full delay-75 animate-pulse"></span>
                  <span className="w-1 h-3 bg-orange-500 rounded-full delay-150 animate-pulse"></span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleListening}
                  className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30'}`}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button 
                  onClick={() => speak(inputText, sourceLang)}
                  disabled={!inputText}
                  className="p-3 bg-white/5 text-slate-400 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-20"
                >
                  <Volume2 size={20} />
                </button>
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-tighter">
                {inputText.length} CHARS / {inputText.split(/\s+/).filter(Boolean).length} WORDS
              </div>
            </div>
          </div>

          <div className="h-24 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 uppercase mb-1">Audio Profile</p>
              <div className="flex items-end gap-1 h-8">
                {[2, 4, 6, 3, 5, 7, 2, 4, 6, 3].map((h, i) => (
                  <motion.div 
                    key={i}
                    animate={isListening ? { height: [h*2, h*4, h*2] } : { height: h*2 }}
                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                    className="w-1 bg-orange-500/60 rounded-full"
                  />
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase">Sampling Rate</p>
              <p className="text-xs font-mono text-slate-300">48kHz / 24-bit</p>
            </div>
          </div>
        </section>

        {/* Center Column: Bridge */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-[#0A0F1A] border border-blue-500/20 rounded-2xl p-6 flex-1 flex flex-col shadow-[inset_0_0_30px_rgba(59,130,246,0.05)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[11px] font-bold text-blue-400 uppercase tracking-widest text-center flex-1">Neural Translation Bridge</h2>
              {isLive && (
                <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-[9px] font-bold text-red-400 uppercase">Live</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-6 items-center flex-1 justify-center relative">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent absolute top-1/2"></div>
              
              {!isLive ? (
                <div className="z-10 w-full space-y-8">
                  <div className="bg-slate-900/60 border border-white/10 p-10 rounded-[40px] backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-green-500/5 opacity-50"></div>
                    <div className="relative z-10 text-center space-y-8">
                      <div>
                        <h2 className="text-3xl font-black text-white tracking-tight mb-2">Bharat Bridge</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] font-bold">Bridging 1.4 Billion Voices</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <button 
                          onClick={startLiveSession}
                          className="flex flex-col items-center gap-4 p-8 bg-gradient-to-b from-orange-500/20 to-orange-500/5 border border-orange-500/30 rounded-3xl hover:border-orange-500/60 transition-all hover:scale-[1.02] group"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-lg">
                            <Mic size={32} />
                          </div>
                          <div className="text-center">
                            <span className="block text-sm font-bold text-white mb-1">Host Event</span>
                            <span className="block text-[9px] text-slate-500 uppercase tracking-widest">Speaker Mode</span>
                          </div>
                        </button>

                        <button 
                          onClick={() => {
                            const id = prompt("Enter Event/Session ID:");
                            if (id) joinLiveSession(id);
                          }}
                          className="flex flex-col items-center gap-4 p-8 bg-gradient-to-b from-blue-500/20 to-blue-500/5 border border-blue-500/30 rounded-3xl hover:border-blue-500/60 transition-all hover:scale-[1.02] group"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg">
                            <Volume2 size={32} />
                          </div>
                          <div className="text-center">
                            <span className="block text-sm font-bold text-white mb-1">Join Event</span>
                            <span className="block text-[9px] text-slate-500 uppercase tracking-widest">Listener Mode</span>
                          </div>
                        </button>
                      </div>

                      <div className="pt-4 border-t border-white/5">
                         <div className="flex items-center justify-center gap-8">
                            <div className="text-center">
                               <p className="text-[10px] text-slate-600 uppercase mb-1">Source</p>
                               <button onClick={() => setModalOpen({open: true, type: 'source'})} className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors">{sourceLang.nativeName}</button>
                            </div>
                            <ArrowRightLeft size={14} className="text-slate-800" />
                            <div className="text-center">
                               <p className="text-[10px] text-slate-600 uppercase mb-1">Your Language</p>
                               <button onClick={() => setModalOpen({open: true, type: 'target'})} className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">{targetLang.nativeName}</button>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="z-10 w-full space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{sessionRole === 'speaker' ? 'Broadcasting' : 'Listening'}</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                          <Users size={10} className="text-blue-400" />
                          <span className="text-[9px] font-bold text-blue-400">{listenerCount} listeners</span>
                        </div>
                      </div>
                      
                      {/* Prominent Session ID Display */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-400">ID: <strong className="text-orange-400 select-all font-bold">{currentSession?.id}</strong></span>
                        <button 
                          onClick={() => {
                            if (currentSession?.id) {
                              navigator.clipboard.writeText(currentSession.id);
                              setCopiedId(true);
                              setTimeout(() => setCopiedId(false), 2000);
                            }
                          }}
                          className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono text-slate-300 hover:text-white transition-colors"
                          title="Copy Session ID"
                        >
                          {copiedId ? 'COPIED!' : 'COPY ID'}
                        </button>
                        <button 
                          onClick={() => {
                            const host = window.location.host;
                            const link = `${window.location.protocol}//${host}${window.location.pathname}?session=${currentSession?.id}`;
                            navigator.clipboard.writeText(link);
                            setCopiedId(true);
                            setTimeout(() => setCopiedId(false), 2000);
                          }}
                          className="flex items-center gap-1 text-[9px] font-mono text-blue-400 hover:text-blue-300 transition-colors group ml-1"
                        >
                          <Share2 size={9} />
                          <span>COPY LINK</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Playback Speed Selector (1.0x - 2.0x) */}
                      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                        <Gauge size={12} className="text-orange-400" />
                        <select
                          value={playbackRate}
                          onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                          aria-label="Audio Playback Speed"
                          className="bg-transparent text-[10px] font-bold text-white outline-none cursor-pointer"
                        >
                          <option value="1.0" className="bg-[#0f172a]">1.0x</option>
                          <option value="1.25" className="bg-[#0f172a]">1.25x</option>
                          <option value="1.5" className="bg-[#0f172a]">1.5x</option>
                          <option value="1.75" className="bg-[#0f172a]">1.75x</option>
                          <option value="2.0" className="bg-[#0f172a]">2.0x</option>
                        </select>
                      </div>

                      {/* Azure Cloud Sync Button */}
                      <button
                        onClick={syncToAzure}
                        disabled={azureSyncStatus.syncing || messages.length === 0}
                        aria-label="Sync Captions to Azure Storage"
                        className="px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-[10px] font-bold text-sky-400 uppercase hover:bg-sky-500/20 transition-all flex items-center gap-1.5 disabled:opacity-30"
                        title="Sync captions to Azure Storage"
                      >
                        <CloudUpload size={12} className={azureSyncStatus.syncing ? 'animate-bounce' : ''} />
                        {azureSyncStatus.syncing ? 'Syncing...' : 'Azure Sync'}
                      </button>

                      <button 
                        onClick={() => exportTranscript(messages, currentSession?.name, currentSession?.id)}
                        aria-label="Export Transcript"
                        className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] font-bold text-blue-400 uppercase hover:bg-blue-500/20 transition-all flex items-center gap-2"
                      >
                        <Download size={12} />
                        Export
                      </button>
                      <button 
                        onClick={sessionRole === 'speaker' ? endLiveSession : () => { setIsLive(false); setCurrentSession(null); if(ws) ws.close(); }}
                        aria-label="End or Leave Session"
                        className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] font-bold text-red-400 uppercase hover:bg-red-500/20 transition-all"
                      >
                        {sessionRole === 'speaker' ? 'End' : 'Leave'}
                      </button>
                    </div>
                  </div>

                  {azureSyncStatus.message && (
                    <div className={`p-2 rounded-lg text-[10px] font-mono text-center border ${azureSyncStatus.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                      {azureSyncStatus.message}
                    </div>
                  )}

                  <div className="h-[350px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-40">
                        <RotateCw size={24} className="animate-spin text-blue-500 mb-2" />
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Awaiting Transmission...</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={msg.id} 
                          className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1 group hover:border-blue-500/30 transition-all"
                        >
                          <div className="flex justify-between items-start">
                             <span className="text-[10px] text-slate-600 font-mono">#{msg.id.slice(-4)}</span>
                             <span className="text-[9px] text-slate-500">{new Date(msg.timestamp?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic border-l-2 border-slate-700 pl-2">
                            {msg.originalText}
                          </p>
                          <p className="text-sm font-semibold text-white pt-1">
                            {msg.translatedText}
                          </p>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {sessionRole === 'speaker' && (
                    <button 
                      onClick={toggleListening}
                      className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all ${
                        isListening 
                        ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.3)]' 
                        : 'bg-orange-500 text-white shadow-[0_0_30px_rgba(249,115,22,0.3)]'
                      }`}
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                      {isListening ? 'Stop' : 'Broadcast'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-[11px] text-slate-500 uppercase mb-3 tracking-widest">Saved Configurations</h3>
            <div className="grid grid-cols-2 gap-2">
              {profile.savedPairs.length === 0 ? (
                <div className="col-span-2 py-4 text-center border border-dashed border-white/10 rounded-xl">
                   <p className="text-[10px] text-slate-600">No saved pairs</p>
                </div>
              ) : (
                profile.savedPairs.slice(0, 4).map(pair => {
                  const s = LANGUAGES.find(l => l.code === pair.sourceCode);
                  const t = LANGUAGES.find(l => l.code === pair.targetCode);
                  const isActive = sourceLang.code === pair.sourceCode && targetLang.code === pair.targetCode;
                  return (
                    <button 
                      key={pair.id}
                      onClick={() => loadPair(pair)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isActive ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : "bg-slate-800/30 border-white/5 hover:bg-slate-800/50"
                      }`}
                    >
                      <p className="text-[10px] text-slate-500 uppercase mb-1">{s?.name} → {t?.name}</p>
                      <p className="text-xs font-semibold text-slate-300">{s?.nativeName[0]} {t?.nativeName[0]}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Target Output */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1 flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Target Output</h2>
              <button 
                onClick={() => setModalOpen({ open: true, type: "target" })}
                className="text-[10px] text-blue-400 hover:text-blue-300 uppercase font-bold tracking-tighter transition-colors"
              >
                Change Target
              </button>
            </div>

            <button 
              onClick={() => setModalOpen({ open: true, type: "target" })}
              className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 mb-4 hover:bg-white/10 transition-colors group text-left"
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl shadow-inner">
                {targetLang.nativeName[0]}
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400">To Language</p>
                <p className="text-lg font-semibold text-white">
                  {targetLang.nativeName}
                  <span className="text-slate-500 font-normal ml-2 text-sm hidden sm:inline">{targetLang.name}</span>
                </p>
              </div>
              <ChevronDown size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
            </button>

            <div 
              dir={targetLang.direction}
              className="flex-1 bg-black/40 rounded-xl p-6 font-serif text-lg leading-relaxed text-slate-300 overflow-y-auto"
            >
              <AnimatePresence mode="wait">
                {isTranslating ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-2"
                  >
                    <div className="h-4 bg-white/5 rounded w-full animate-pulse"></div>
                    <div className="h-4 bg-white/5 rounded w-5/6 animate-pulse"></div>
                    <div className="h-4 bg-white/5 rounded w-4/6 animate-pulse"></div>
                  </motion.div>
                ) : (
                  <motion.p
                    key={translatedText}
                    initial={{ opacity: 0, x: targetLang.direction === 'rtl' ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={!translatedText ? 'text-slate-700' : ''}
                  >
                    {translatedText || `Translated content in ${targetLang.name} will appear here...`}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => speak(translatedText, targetLang)}
                  disabled={!translatedText}
                  className="p-3 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 rounded-xl transition-all disabled:opacity-10"
                >
                  <Volume2 size={20} />
                </button>
                <button 
                  onClick={() => copyToClipboard(translatedText)}
                  disabled={!translatedText}
                  className="p-3 bg-white/5 text-slate-400 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-10"
                >
                  {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                </button>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <div className={`w-1.5 h-1.5 rounded-full ${translatedText ? 'bg-green-500' : 'bg-slate-700'}`} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time Stream</span>
              </div>
            </div>
          </div>

          <div className={`bg-slate-900/80 border border-white/10 rounded-2xl p-5 ${targetLang.direction === 'rtl' ? 'rtl' : ''}`}>
            <div className="flex justify-between items-center mb-2" dir="ltr">
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Node Status</h2>
              <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">Synced</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 font-mono uppercase tracking-tighter">Availability Zone</p>
              <p className="text-xs text-white font-mono">ASIA-SOUTH-01</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="h-20 mt-auto border-t border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-8 text-[11px] text-slate-500">
        <div className="flex gap-8 items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
              <ArrowRightLeft size={16} />
            </div>
            <span className="font-bold text-slate-300">BHARAT BRIDGE GRID</span>
          </div>
          <div className="hidden md:flex gap-6">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              <span>22 Core Languages Loaded</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              <span>Quality Assurance: High</span>
            </div>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <span className="uppercase tracking-widest hidden sm:inline">Architecture: Neural Matrix v4.2.0</span>
          <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
          <span className="font-mono text-[9px]">© 2026 BHARATBRIDGE PLATFORM</span>
        </div>
      </footer>

      {/* Language Modal (Themed) */}
      <AnimatePresence>
        {modalOpen.open && modalOpen.type !== "profile" && (
          <LanguageModal 
            isOpen={modalOpen.open} 
            title={modalOpen.type === "source" ? "Source Selection" : "Target Selection"}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
            selectedCode={modalOpen.type === "source" ? sourceLang.code : targetLang.code}
            onSelect={(lang) => {
              if (modalOpen.type === "source") setSourceLang(lang);
              else setTargetLang(lang);
            }}
          />
        )}
        {modalOpen.open && modalOpen.type === "profile" && (
          <ProfileModal 
            isOpen={modalOpen.open}
            onClose={() => setModalOpen({ ...modalOpen, open: false })}
            profile={profile}
            onUpdate={(newProfile) => {
              setProfile(newProfile);
              // Update current session if defaults changed
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
