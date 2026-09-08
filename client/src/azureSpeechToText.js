import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

// Runs continuous speech recognition via Azure directly from the browser (lower latency than
// routing audio through our own backend first). Tokens expire after ~10 minutes, so this
// refreshes the token proactively every 9 minutes without interrupting an in-progress session —
// Azure's SDK supports swapping `recognizer.authorizationToken` on a live recognizer for
// exactly this reason.
export function createAzureRecognizer({ getToken, lang, sessionTitle, onInterim, onFinal, onError }) {
  let recognizer = null;
  let refreshTimer = null;
  let stopped = true;

  if (typeof window !== "undefined") {
    if (!navigator.mediaDevices) navigator.mediaDevices = {};
    if (!navigator.mediaDevices.getSupportedConstraints) {
      navigator.mediaDevices.getSupportedConstraints = () => ({});
    }
    if (!navigator.mediaDevices.getUserMedia) {
      const legacyGetUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;
      if (legacyGetUserMedia) {
        navigator.mediaDevices.getUserMedia = (constraints) =>
          new Promise((resolve, reject) =>
            legacyGetUserMedia.call(navigator, constraints, resolve, reject)
          );
      } else {
        throw new Error(
          "Microphone access is blocked by your browser on HTTP IP addresses (192.168.x.x). Please open http://localhost:5173 or http://localhost:8787 on your laptop."
        );
      }
    }
  }

  async function build() {
    const { token, region } = await getToken();
    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    // Request Detailed output format for clean sentence punctuation & capitalization
    speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
    speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceResponse_PostProcessingOption,
      "True"
    );
    // Request TrueText to clean up spoken stutters ("um", "uh", repetition) before translation
    speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceResponse_RequestTrueTextOption,
      "True"
    );
    // Natural Clause Mode: 400ms silence timeout segments speech at natural clause boundaries
    speechConfig.setProperty(
      SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
      "400"
    );
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    let r;
    if (lang === "auto" || lang === "hinglish" || Array.isArray(lang)) {
      const candidateLangs = Array.isArray(lang)
        ? lang.slice(0, 4)
        : lang === "hinglish"
        ? ["en-IN", "hi-IN"]
        : ["en-IN", "hi-IN", "mr-IN", "ta-IN"];
      const autoDetectConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(candidateLangs);
      r = SpeechSDK.SpeechRecognizer.FromConfig(speechConfig, autoDetectConfig, audioConfig);
    } else {
      speechConfig.speechRecognitionLanguage = lang;
      r = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    }

    try {
      const phraseList = SpeechSDK.PhraseListGrammar.fromRecognizer(r);
      if (sessionTitle) {
        phraseList.addPhrase(sessionTitle);
        sessionTitle.split(/\s+/).forEach((w) => {
          if (w.length > 2) phraseList.addPhrase(w);
        });
      }
      phraseList.addPhrase("BharatBridge");
      phraseList.addPhrase("TryLang");
    } catch (phraseErr) {
      console.warn("PhraseListGrammar setup warning:", phraseErr);
    }

    r.recognizing = (_s, e) => {
      const text = e.result?.text;
      if (text && text.trim()) {
        onInterim?.(text);
      }
    };

    r.recognized = (_s, e) => {
      const text = e.result?.text;
      if (text && text.trim()) {
        onFinal?.(text.trim());
      }
    };
    r.canceled = (_s, e) => {
      if (e.reason === SpeechSDK.CancellationReason.Error) {
        onError?.(e.errorDetails || "Azure speech recognition was canceled unexpectedly.");
      }
    };

    return r;
  }

  async function scheduleTokenRefresh() {
    refreshTimer = setTimeout(async () => {
      if (stopped || !recognizer) return;
      try {
        const { token } = await getToken();
        recognizer.authorizationToken = token;
      } catch (err) {
        onError?.("Failed to refresh speech token: " + err.message);
      }
      scheduleTokenRefresh();
    }, 9 * 60 * 1000);
  }

  return {
    async start() {
      stopped = false;
      try {
        recognizer = await build();
        recognizer.startContinuousRecognitionAsync(
          () => scheduleTokenRefresh(),
          (err) => onError?.("Could not start microphone/recognition: " + err)
        );
      } catch (err) {
        onError?.(err.message || "Failed to start Azure speech recognition.");
      }
    },
    stop() {
      stopped = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(
          () => {
            recognizer.close();
            recognizer = null;
          },
          () => {
            recognizer?.close();
            recognizer = null;
          }
        );
      }
    },
  };
}