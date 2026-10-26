/**
 * Single source of truth for every tunable in the product (spec §9.4).
 * No magic numbers in components — import from here.
 */

export type Register = "boss" | "curt" | "friendly" | "comedic" | "sharp";

export const CONFIG = {
  /** §4.2 — response controls locked while the gold ring breathes once. */
  BEAT_MS: 1200,

  /** §3.3 / §6.3 — daily goal default; user-set 1/3/5. */
  DAILY_GOAL_DEFAULT: 3,
  SESSION_SIZE: 3,
  DAILY_GOAL_OPTIONS: [1, 3, 5] as const,

  /** §6.1 — streak freezes granted (and applied) automatically. */
  FREEZE_PER_WEEK: 1,

  /** §4.5 / §6 — XP awards. XP only for completed drills and arsenal reviews. */
  XP_DRILL: 10,
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
  boss: { name: "Calm", glyph: "◆", tagline: "Steady, composed, and clear.", maxWords: 14 },
  curt: { name: "Direct", glyph: "▪", tagline: "Short, clear boundaries. No extra explanation.", maxWords: 8 },
  friendly: { name: "Friendly", glyph: "●", tagline: "Warm and disarming. Keeps the connection.", maxWords: 22 },
  comedic: { name: "Playful", glyph: "▲", tagline: "Light humor aimed at the situation.", maxWords: 22 },
  sharp: { name: "Bold", glyph: "✦", tagline: "An edge for low-stakes moments. Use with care.", maxWords: 16 },
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
