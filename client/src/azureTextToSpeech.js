import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

// Web Audio API Context for zero-latency, mobile browser autoplay-compliant audio output.
let audioCtx = null;
let sharedAudio = null;

export function unlockAudioEngine() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      // Play a tiny silent buffer to warm up AudioContext on iOS Safari & Android Chrome
      const buffer = audioCtx.createBuffer(1, 1, 22050);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);
    }

    if (!sharedAudio) {
      sharedAudio = new Audio();
      sharedAudio.setAttribute("playsinline", "true");
      sharedAudio.setAttribute("webkit-playsinline", "true");
    }
    sharedAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    sharedAudio.play().catch(() => {});

    if (window.speechSynthesis) {
      const dummy = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(dummy);
    }
  } catch (e) {
    console.warn("unlockAudioEngine warning:", e);
  }
}

export function createAzureSpeaker({ getToken, voiceName, speechRate = "0.95" }) {
  let queue = [];
  let speaking = false;
  let enabled = true;
  let currentVoice = voiceName;
  let currentRate = speechRate;
  let cachedConfig = null;
  let cachedAt = 0;

  async function getConfig() {
    const isStale = Date.now() - cachedAt > 8 * 60 * 1000;
    if (!cachedConfig || isStale) {
      const { token, region } = await getToken();
      cachedConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      cachedConfig.speechSynthesisOutputFormat =
        SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
      cachedAt = Date.now();
    }
    cachedConfig.speechSynthesisVoiceName = currentVoice;
    return cachedConfig;
  }

  function buildSsml(text, voice, rate) {
    const escapeXml = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    const langCode = voice.split("-").slice(0, 2).join("-");
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${langCode}"><voice name="${voice}"><prosody rate="${rate}" pitch="0%">${escapeXml(text)}</prosody></voice></speak>`;
  }

  function speakWebSpeechFallback(text, voice) {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      const langCode = voice.split("-").slice(0, 2).join("-");
      u.lang = langCode || "en-IN";
      u.onend = () => {
        speaking = false;
        pump();
      };
      u.onerror = () => {
        speaking = false;
        pump();
      };
      window.speechSynthesis.speak(u);
    } else {
      speaking = false;
      pump();
    }
  }

  async function playAudioBuffer(audioData, text, voice) {
    // Method 1: Web Audio API (Primary: bypasses mobile browser HTML5 element autoplay restrictions)
    const AudioCtx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (AudioCtx) {
      try {
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === "suspended") {
          await audioCtx.resume().catch(() => {});
        }
        const bufferCopy = audioData.slice(0);
        const audioBuffer = await new Promise((resolve, reject) => {
          audioCtx.decodeAudioData(bufferCopy, resolve, reject);
        });

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => {
          speaking = false;
          pump();
        };
        source.start(0);
        return;
      } catch (err) {
        console.warn("Web Audio API decode/play error, attempting HTML5 audio fallback:", err);
      }
    }

    // Method 2: HTML5 Audio Element Fallback
    try {
      const blob = new Blob([audioData], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      if (!sharedAudio) {
        sharedAudio = new Audio();
        sharedAudio.setAttribute("playsinline", "true");
        sharedAudio.setAttribute("webkit-playsinline", "true");
      }
      sharedAudio.src = url;
      sharedAudio.onended = () => {
        URL.revokeObjectURL(url);
        speaking = false;
        pump();
      };
      sharedAudio.onerror = (e) => {
        console.error("HTML5 Audio playback error:", e);
        URL.revokeObjectURL(url);
        speakWebSpeechFallback(text, voice);
      };
      await sharedAudio.play();
    } catch (err) {
      console.warn("HTML5 Audio play rejected by browser policy, using Web Speech API fallback:", err);
      speakWebSpeechFallback(text, voice);
    }
  }

  async function pump() {
    if (speaking || queue.length === 0 || !enabled) return;
    const text = queue.shift();
    speaking = true;
    try {
      const config = await getConfig();
      const synthesizer = new SpeechSDK.SpeechSynthesizer(config, null);
      const ssml = buildSsml(text, currentVoice, currentRate);
      synthesizer.speakSsmlAsync(
        ssml,
        async (result) => {
          synthesizer.close();
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted && result.audioData) {
            await playAudioBuffer(result.audioData, text, currentVoice);
          } else {
            console.warn("Azure speech synthesis canceled/failed:", result?.errorDetails);
            cachedConfig = null;
            speakWebSpeechFallback(text, currentVoice);
          }
        },
        (err) => {
          synthesizer.close();
          cachedConfig = null;
          console.error("Azure speech synthesis error:", err);
          speakWebSpeechFallback(text, currentVoice);
        }
      );
    } catch (err) {
      console.error("Azure speech synthesis setup failed:", err);
      speakWebSpeechFallback(text, currentVoice);
    }
  }

  return {
    say(text) {
      if (!text?.trim()) return;
      const clean = text.trim();

      // Cap queue length to prevent backlog during rapid continuous speech
      if (queue.length > 2) queue = queue.slice(-2);
      queue.push(clean);
      pump();
    },
    setVoiceName(newVoiceName) {
      currentVoice = newVoiceName;
    },
    setRate(newRate) {
      currentRate = newRate;
    },
    setEnabled(value) {
      enabled = value;
      if (!enabled) queue = [];
    },
    stop() {
      queue = [];
    },
  };
}