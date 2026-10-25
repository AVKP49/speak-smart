/**
 * On-device voice (spec §9.2). Web Speech API only — audio never leaves the device.
 * Degradation rule: if voice is unavailable, the app is fully usable in text.
 */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  const ctor = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
  return (ctor as RecognitionCtor | undefined) ?? null;
}

export function speechRecognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface ListenResult {
  transcript: string;
  /** ms from listen start to first partial/final result. */
  firstWordMs: number | null;
  /** ms from listen start to end of speech. */
  endMs: number;
}

/**
 * One-shot listen. Resolves with the best transcript, or null when speech
 * is unavailable or nothing was heard. Never rejects on no-speech.
 */
export function listenOnce(timeoutMs: number): Promise<ListenResult | null> {
  return new Promise((resolve) => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      resolve(null);
      return;
    }
    let rec: SpeechRecognitionLike | null = null;
    try {
      rec = new Ctor();
    } catch {
      resolve(null);
      return;
    }
    const startedAt = performance.now();
    let firstWordMs: number | null = null;
    let best = "";
    let settled = false;
    const finish = (value: ListenResult | null) => {
      if (settled) return;
      settled = true;
      try {
        rec?.abort();
      } catch {
        /* already ended */
      }
      resolve(value);
    };
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev: SpeechRecognitionEventLike) => {
      if (firstWordMs === null) firstWordMs = performance.now() - startedAt;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res && res[0]) best = res[0].transcript;
      }
    };
    rec.onerror = () => finish(best.trim() ? { transcript: best.trim(), firstWordMs, endMs: performance.now() - startedAt } : null);
    rec.onend = () => {
      const transcript = best.trim();
      finish(transcript ? { transcript, firstWordMs, endMs: performance.now() - startedAt } : null);
    };
    try {
      rec.start();
    } catch {
      finish(null);
      return;
    }
    window.setTimeout(() => {
      const transcript = best.trim();
      finish(transcript ? { transcript, firstWordMs, endMs: performance.now() - startedAt } : null);
    }, timeoutMs);
  });
}

/* ---------------- Jab playback (on-device TTS) ---------------- */

export function ttsSupported(): boolean {
  return "speechSynthesis" in window;
}

export function speak(text: string): void {
  if (!ttsSupported()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    synth.speak(utter);
  } catch {
    /* voice is an enhancement, never a gate */
  }
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* noop */
  }
}
