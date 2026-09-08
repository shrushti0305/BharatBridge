import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

// Speaks translated captions aloud using Azure's neural voices instead of whatever (if any)
// voice happens to be installed on the listener's device — this is what actually fixes the
// "no voice installed for this language" problem, since Azure always has a voice for every
// supported language regardless of the listener's OS.
//
// Utterances are queued so fast-arriving captions speak in order rather than overlapping.
// Tokens expire after ~10 minutes; since Azure's SpeechSynthesizer doesn't support swapping
// tokens on a live instance the way the recognizer does, this simply rebuilds the synthesizer
// with a fresh token periodically — cheap to do, and never happens mid-utterance.
let sharedAudio = null;

export function unlockAudioEngine() {
  if (typeof window === "undefined") return;
  try {
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
    // ignore
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
        SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3;
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
        (result) => {
          synthesizer.close();
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted && result.audioData) {
            const blob = new Blob([result.audioData], { type: "audio/mp3" });
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
              console.error("Audio playback error:", e);
              URL.revokeObjectURL(url);
              speaking = false;
              pump();
            };
            sharedAudio.play().catch((err) => {
              console.warn("Autoplay deferred by browser policy, using Web Speech API fallback:", err);
              URL.revokeObjectURL(url);
              if (typeof window !== "undefined" && window.speechSynthesis) {
                const u = new SpeechSynthesisUtterance(text);
                const langCode = currentVoice.split("-").slice(0, 2).join("-");
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
            });
          } else {
            console.warn("Azure speech synthesis canceled/failed, using Web Speech API fallback:", result?.errorDetails);
            cachedConfig = null;
            if (typeof window !== "undefined" && window.speechSynthesis) {
              const u = new SpeechSynthesisUtterance(text);
              const langCode = currentVoice.split("-").slice(0, 2).join("-");
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
        },
        (err) => {
          synthesizer.close();
          cachedConfig = null;
          console.error("Azure speech synthesis failed, using Web Speech API fallback:", err);
          if (typeof window !== "undefined" && window.speechSynthesis) {
            const u = new SpeechSynthesisUtterance(text);
            const langCode = currentVoice.split("-").slice(0, 2).join("-");
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
      );
    } catch (err) {
      console.error("Azure speech synthesis setup failed, using Web Speech API fallback:", err);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text);
        const langCode = currentVoice.split("-").slice(0, 2).join("-");
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
  }

  let lastSpokenText = "";

  return {
    say(text) {
      if (!text?.trim()) return;
      const clean = text.trim();
      if (clean === lastSpokenText) return;
      lastSpokenText = clean;

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