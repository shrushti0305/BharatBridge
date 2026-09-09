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
    const formattedRate = `${Math.min(2.5, Math.max(0.5, parseFloat(rate) || 1.0))}`;
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${langCode}"><voice name="${voice}"><prosody rate="${formattedRate}" pitch="0%">${escapeXml(text)}</prosody></voice></speak>`;
  }

  function speakWebSpeechFallback(text, voice) {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      const langCode = voice.split("-").slice(0, 2).join("-");
      u.lang = langCode || "en-IN";
      u.rate = Math.min(2.5, Math.max(0.5, parseFloat(currentRate) || 1.0));
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

  async function synthesize(text) {
    try {
      const config = await getConfig();
      const synthesizer = new SpeechSDK.SpeechSynthesizer(config, null);
      const ssml = buildSsml(text, currentVoice, currentRate);
      return await new Promise((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            synthesizer.close();
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted && result.audioData) {
              resolve(result.audioData);
            } else {
              cachedConfig = null;
              reject(new Error(result?.errorDetails || "Synthesis failed"));
            }
          },
          (err) => {
            synthesizer.close();
            cachedConfig = null;
            reject(err);
          }
        );
      });
    } catch (err) {
      cachedConfig = null;
      throw err;
    }
  }

  async function playAudioBuffer(audioData, text) {
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

        // User selected rate (1.0x to 2.5x) with catch-up multiplier if queue has items
        const userRate = parseFloat(currentRate) || 1.0;
        const catchupMultiplier = queue.length > 0 ? 1.08 : 1.0;
        source.playbackRate.value = Math.min(2.5, userRate * catchupMultiplier);

        source.connect(audioCtx.destination);
        source.onended = () => {
          speaking = false;
          pump();
        };
        source.start(0);
        return;
      } catch (err) {
        console.warn("Web Audio API decode/play error, fallback to WebSpeech:", err);
      }
    }

    // Fallback if Web Audio API fails
    speakWebSpeechFallback(text, currentVoice);
  }

  async function pump() {
    if (speaking || queue.length === 0 || !enabled) return;
    const item = queue.shift();
    speaking = true;

    try {
      const audioData = await item.audioPromise;
      await playAudioBuffer(audioData, item.text);
    } catch (err) {
      console.warn("TTS synthesis error, using fallback:", err.message);
      speakWebSpeechFallback(item.text, currentVoice);
    }
  }

  return {
    say(text) {
      if (!text?.trim() || !enabled) return;
      const clean = text.trim();

      // Keep maximum 2 queued items to prevent audio backlogs when speaking fast
      if (queue.length >= 2) {
        queue = queue.slice(-1);
      }

      // Start pre-synthesizing audio IMMEDIATELY in parallel
      const audioPromise = synthesize(clean);
      queue.push({ text: clean, audioPromise });
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
      speaking = false;
    },
  };
}