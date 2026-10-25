/**
 * Single source of truth for every tunable in the product (spec §9.4).
 * No magic numbers in components — import from here.
 */

export type Register = "boss" | "curt" | "friendly" | "comedic" | "sharp";

export interface DeliveryThresholds {
  /** Minimum pause before first word, ms from Beat end (§4.3). */
  minPauseMs: number;
  /** Target pace band, words per minute. */
  paceWpm: [number, number];
  /** Max filler words (um/uh/like/you know). */
  maxFillers: number;
  /** Max reply length in words. */
  maxWords: number;
}

export const CONFIG = {
  /** §4.2 — response controls locked while the gold ring breathes once. */
  BEAT_MS: 1200,

  /** §4.1 — say-it response window from end of Beat. Never punished on timeout. */
  RESPONSE_WINDOW_S: 10,

  /** §4.3 — delivery thresholds per register. */
  DELIVERY: {
    boss: { minPauseMs: 900, paceWpm: [105, 135], maxFillers: 1, maxWords: 14 },
    curt: { minPauseMs: 700, paceWpm: [90, 120], maxFillers: 1, maxWords: 8 },
    friendly: { minPauseMs: 500, paceWpm: [130, 160], maxFillers: 2, maxWords: 22 },
    comedic: { minPauseMs: 600, paceWpm: [130, 165], maxFillers: 2, maxWords: 22 },
    sharp: { minPauseMs: 800, paceWpm: [110, 140], maxFillers: 1, maxWords: 16 },
  } satisfies Record<Register, DeliveryThresholds>,

  /** Filler words counted by the delivery scorer (§4.3). */
  FILLER_WORDS: ["um", "uh", "like", "you know"],

  /** §3.3 / §6.3 — daily goal default; user-set 1/3/5. */
  DAILY_GOAL_DEFAULT: 3,
  DAILY_GOAL_OPTIONS: [1, 3, 5] as const,

  /** §6.1 — streak freezes granted (and applied) automatically. */
  FREEZE_PER_WEEK: 1,

  /** §4.5 / §6 — XP awards. XP only for completed drills and arsenal reviews. */
  XP_DRILL: 10,
  XP_PERFECT_DELIVERY: 5,
  XP_ARSENAL_REVIEW: 5,

  /** §6.2 — mastery: Pocketed → Practiced → Reflex. */
  MASTERY: {
    PRACTICED_RECALLS: 3,
    REFLEX_RECALLS: 7,
    REFLEX_MIN_DAYS: 14,
  },

  /** §6.2 — spaced-repetition intervals (days) between due reviews. */
  SR_INTERVALS_DAYS: [1, 3, 7, 14, 30] as const,

  /** §8.3 — V2 premium price band + AI caps. Documented here; unused in V1 (no runtime AI). */
  PREMIUM_MONTHLY_USD: [5.99, 7.99] as const,
  AI_GRADES_FREE_TASTE_PER_DAY: 3,

  /** Content manifest location (relative to app base). */
  CONTENT_MANIFEST_URL: "./content/manifest.json",
} as const;

/** Register display metadata (§2.1 + §5.2). Glyph + name always paired; never color alone. */
export const REGISTERS: Record<
  Register,
  { name: string; glyph: string; tagline: string; maxWords: number }
> = {
  boss: { name: "Boss", glyph: "◆", tagline: "Quiet authority. Calm, minimal, final.", maxWords: 14 },
  curt: { name: "Curt", glyph: "▪", tagline: "The door closer. For strangers and hard boundaries.", maxWords: 8 },
  friendly: { name: "Friendly", glyph: "●", tagline: "Warm and disarming. The beginner-safe voice.", maxWords: 22 },
  comedic: { name: "Comedic", glyph: "▲", tagline: "Wit that releases pressure. Never on a trait.", maxWords: 22 },
  sharp: { name: "Sharp", glyph: "✦", tagline: "The sarcastic edge. Use with care.", maxWords: 16 },
};

export const REGISTER_ORDER: Register[] = ["boss", "curt", "friendly", "comedic", "sharp"];

/** Arsenal ranks by lines at Reflex (§6.3). Composure, never dominance. */
export const RANKS = [
  { name: "Listener", reflexRequired: 0 },
  { name: "Steady", reflexRequired: 12 },
  { name: "Composed", reflexRequired: 30 },
  { name: "Unflappable", reflexRequired: 60 },
  { name: "Quiet Authority", reflexRequired: 100 },
] as const;
