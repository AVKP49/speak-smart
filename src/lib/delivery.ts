/**
 * Delivery metrics for say-it mode (spec §4.3).
 * Computed on-device from transcript + timing. Thresholds come from CONFIG.
 * Feedback shows at most two observations, phrased per §2.5 (honest, specific).
 */
import { CONFIG, type Register } from "../config";
import { formatSeconds } from "./utils";

export interface DeliveryInput {
  transcript: string;
  /** ms from Beat end to first word. */
  pauseMs: number;
  /** ms from first word to end of speech. */
  speakingMs: number;
}

export interface DeliveryResult {
  words: number;
  pauseMs: number;
  wpm: number;
  fillers: number;
  passed: { pause: boolean; pace: boolean; fillers: boolean; length: boolean };
  perfect: boolean;
  /** At most two observations. Empty when delivery is perfect. */
  observations: string[];
}

const REGISTER_PAUSE_LINE: Record<Register, string> = {
  boss: "Boss lines land after a pause.",
  curt: "Curt lines hit fast, then stop.",
  friendly: "Friendly lines breathe a little first.",
  comedic: "Comedy needs the beat to land.",
  sharp: "Sharp lines cut cleanest after a pause.",
};

const REGISTER_PACE_LINE: Record<Register, string> = {
  boss: "Boss lines hold an even pace.",
  curt: "Curt lines are short and unhurried.",
  friendly: "Friendly lines move a little quicker.",
  comedic: "Comedy moves — keep it light.",
  sharp: "Sharp lines stay smooth, never rushed.",
};

export function countWords(text: string): number {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}'’\s]/gu, " ").split(/\s+/).filter(Boolean);
  return words.length;
}

/** Counts filler occurrences; multi-word fillers ("you know") matched first. */
export function countFillers(text: string): number {
  let normalized = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}'’\s]/gu, " ")} `;
  normalized = normalized.replace(/\s+/g, " ");
  let count = 0;
  const fillers = [...CONFIG.FILLER_WORDS].sort((a, b) => b.length - a.length);
  for (const filler of fillers) {
    const needle = ` ${filler} `;
    let idx = normalized.indexOf(needle);
    while (idx !== -1) {
      count += 1;
      normalized = `${normalized.slice(0, idx + 1)}${" ".repeat(filler.length)}${normalized.slice(idx + 1 + filler.length)}`;
      idx = normalized.indexOf(needle);
    }
  }
  return count;
}

export function scoreDelivery(register: Register, input: DeliveryInput): DeliveryResult {
  const t = CONFIG.DELIVERY[register];
  const words = countWords(input.transcript);
  const fillers = countFillers(input.transcript);
  const minutes = Math.max(input.speakingMs, 500) / 60000;
  const wpm = Math.round(words / minutes);

  const pause = input.pauseMs >= t.minPauseMs;
  const pace = wpm >= t.paceWpm[0] && wpm <= t.paceWpm[1];
  const fillersOk = fillers <= t.maxFillers;
  const length = words > 0 && words <= t.maxWords;
  const perfect = pause && pace && fillersOk && length && words > 0;

  const observations: string[] = [];
  if (words === 0) {
    observations.push("Nothing heard. Say the line out loud — the rep counts when it leaves your mouth.");
    return { words, pauseMs: input.pauseMs, wpm: 0, fillers, passed: { pause, pace, fillers: fillersOk, length }, perfect: false, observations };
  }
  if (!pause) {
    observations.push(
      `You started in ${formatSeconds(input.pauseMs)} — ${REGISTER_PAUSE_LINE[register]}`,
    );
  }
  if (!length && observations.length < 2) {
    observations.push(
      `That was ${words} words — ${register === "curt" ? "Curt" : register === "boss" ? "Boss" : register === "sharp" ? "Sharp" : "this voice"} lands at ${t.maxWords} or fewer. Cut the softeners.`,
    );
  }
  if (!pace && observations.length < 2) {
    const direction = wpm < t.paceWpm[0] ? "steadier" : "calmer";
    observations.push(
      `About ${wpm} words a minute — ${direction} wins here. ${REGISTER_PACE_LINE[register]}`,
    );
  }
  if (!fillersOk && observations.length < 2) {
    observations.push(
      fillers === 1
        ? "One filler. A breath beats an um."
        : `${fillers} fillers. Pause instead — silence sounds composed, um does not.`,
    );
  }
  return {
    words,
    pauseMs: input.pauseMs,
    wpm,
    fillers,
    passed: { pause, pace, fillers: fillersOk, length },
    perfect,
    observations: observations.slice(0, 2),
  };
}
