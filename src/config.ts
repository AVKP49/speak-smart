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
