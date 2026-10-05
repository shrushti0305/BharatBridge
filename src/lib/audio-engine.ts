/**
 * BharatBridge Ultra-Low Latency Audio & Speech Engine
 * Manages PCM audio stream buffering, gapless Web Audio API playback, 
 * and instant local SpeechSynthesis fallback for 0ms audio lag.
 */

class AudioStreamPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private pcmSampleRate: number = 24000;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  public async initAudioContext(): Promise<AudioContext> {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: this.pcmSampleRate });
    }
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Play base64 PCM 24kHz/16kHz raw audio chunk with gapless queuing
   */
  public async playPCMChunk(base64Data: string, sampleRate: number = 24000): Promise<void> {
    try {
      const ctx = await this.initAudioContext();
      this.pcmSampleRate = sampleRate;

      // Decode base64 to Int16Array
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.02; // Small 20ms jitter buffer
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.isPlaying = true;
    } catch (err) {
      console.warn("[Audio Engine] PCM chunk play warning:", err);
    }
  }

  /**
   * Play base64 encoded MP3/WAV audio buffer
   */
  public async playAudioBuffer(base64Audio: string, mimeType: string = "audio/mp3"): Promise<void> {
    try {
      const ctx = await this.initAudioContext();
      const binaryStr = atob(base64Audio);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const decodedBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (err) {
      console.warn("[Audio Engine] AudioBuffer playback warning:", err);
    }
  }

  public stopAll(): void {
    if (this.audioCtx) {
      this.audioCtx.suspend();
      this.nextStartTime = 0;
    }
  }
}

export const globalAudioPlayer = new AudioStreamPlayer();

/**
 * Low-latency Local SpeechSynthesis (0ms network delay fallback)
 */
export function speakTextLocally(
  text: string, 
  langCode: string, 
  gender: 'male' | 'female' = 'female',
  onEnd?: () => void
): boolean {
  if (!('speechSynthesis' in window)) return false;

  try {
    window.speechSynthesis.cancel(); // Clear queued utterances for immediate response

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Map ISO code to BCP-47 language tag
    const bcp47LangMap: Record<string, string> = {
      hi: "hi-IN",
      bn: "bn-IN",
      mr: "mr-IN",
      te: "te-IN",
      ta: "ta-IN",
      gu: "gu-IN",
      ur: "ur-PK",
      kn: "kn-IN",
      or: "or-IN",
      ml: "ml-IN",
      pa: "pa-IN",
      as: "as-IN",
      en: "en-IN"
    };

    utterance.lang = bcp47LangMap[langCode] || `${langCode}-IN`;
    utterance.rate = 1.0;
    utterance.pitch = gender === 'female' ? 1.1 : 0.9;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => 
      v.lang.toLowerCase() === utterance.lang.toLowerCase() ||
      v.lang.toLowerCase().startsWith(langCode)
    );

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    if (onEnd) {
      utterance.onend = onEnd;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn("[Audio Engine] SpeechSynthesis warning:", err);
    return false;
  }
}
