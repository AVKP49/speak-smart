/**
 * Retention engine + user state (spec §6). Streaks, XP, ranks, arsenal mastery.
 * Adult in tone — no guilt mechanics, no fake users, ever.
 */
import { CONFIG, RANKS, type Register } from "../config";
import { kvGet, kvSet, recordAll, recordDelete, recordGet, recordPut, clearAll } from "./db";
import { daysBetween, todayKey, weekKey } from "../lib/utils";

/* ---------------- Settings ---------------- */

export interface Settings {
  defaultRegister: Register;
  dailyGoal: number;
  beatMs: number;
  reducedMotion: boolean;
  onboarded: boolean;
  /** Show the second language wherever the library carries it. */
  showL2: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  defaultRegister: "boss",
  dailyGoal: CONFIG.DAILY_GOAL_DEFAULT,
  beatMs: CONFIG.BEAT_MS,
  reducedMotion: false,
  onboarded: false,
  showL2: true,
};

export async function getSettings(): Promise<Settings> {
  const saved = await kvGet<Partial<Settings>>("settings");
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await kvSet("settings", next);
  return next;
}

/* ---------------- Streaks (§6.1) ---------------- */

export interface Streak {
  count: number;
  lastDay: string | null;
  freezesLeft: number;
  freezeWeek: string;
}

export async function getStreak(): Promise<Streak> {
  const week = weekKey();
  const saved = await kvGet<Streak>("streak");
  if (!saved) return { count: 0, lastDay: null, freezesLeft: CONFIG.FREEZE_PER_WEEK, freezeWeek: week };
  if (saved.freezeWeek !== week) {
    const refreshed = { ...saved, freezesLeft: CONFIG.FREEZE_PER_WEEK, freezeWeek: week };
    await kvSet("streak", refreshed);
    return refreshed;
  }
  return saved;
}

/** One completed drill (or one arsenal review session) keeps the day. */
export async function recordActiveDay(): Promise<{ streak: Streak; restarted: boolean; freezeUsed: boolean }> {
  const today = todayKey();
  const streak = await getStreak();
  if (streak.lastDay === today) return { streak, restarted: false, freezeUsed: false };

  let { count, freezesLeft } = streak;
  let restarted = false;
  let freezeUsed = false;

  if (streak.lastDay === null) {
    count = 1;
  } else {
    const gap = daysBetween(streak.lastDay, today);
    if (gap <= 0) {
      count = Math.max(1, count);
    } else if (gap === 1) {
      count += 1;
    } else if (gap === 2 && freezesLeft > 0) {
      // The freeze is a shield already in place — applied automatically.
      freezesLeft -= 1;
      freezeUsed = true;
      count += 1;
    } else {
      count = 1;
      restarted = true;
    }
  }
  const next: Streak = { count, lastDay: today, freezesLeft, freezeWeek: streak.freezeWeek };
  await kvSet("streak", next);
  return { streak: next, restarted, freezeUsed };
}

/* ---------------- Daily goal + XP ---------------- */

export interface Daily {
  day: string;
  drills: number;
  reviews: number;
}

export async function getDaily(): Promise<Daily> {
  const today = todayKey();
  const saved = await kvGet<Daily>("daily");
  if (saved && saved.day === today) return saved;
  const fresh: Daily = { day: today, drills: 0, reviews: 0 };
  await kvSet("daily", fresh);
  return fresh;
}

export async function addDrillCompleted(): Promise<Daily> {
  const daily = await getDaily();
  daily.drills += 1;
  await kvSet("daily", daily);
  await addXp(CONFIG.XP_DRILL);
  await recordActiveDay();
  return daily;
}

export async function addReviewCompleted(count = 1): Promise<Daily> {
  const daily = await getDaily();
  daily.reviews += count;
  await kvSet("daily", daily);
  await addXp(CONFIG.XP_ARSENAL_REVIEW * count);
  await recordActiveDay();
  return daily;
}

export async function getXp(): Promise<number> {
  return (await kvGet<number>("xp")) ?? 0;
}

async function addXp(amount: number): Promise<number> {
  const total = (await getXp()) + amount;
  await kvSet("xp", total);
  return total;
}

export function rankForReflexCount(reflexCount: number): { current: string; next: string | null; toNext: number } {
  let current: string = RANKS[0]?.name ?? "Listener";
  for (const rank of RANKS) {
    if (reflexCount >= rank.reflexRequired) current = rank.name;
  }
  const nextRank = RANKS.find((r) => r.reflexRequired > reflexCount);
  return {
    current,
    next: nextRank?.name ?? null,
    toNext: nextRank ? nextRank.reflexRequired - reflexCount : 0,
  };
}

/* ---------------- Arsenal + mastery (§6.2) ---------------- */

export type MasteryLevel = "Pocketed" | "Practiced" | "Reflex";

export interface ArsenalEntry {
  key: string;
  scenarioId: string;
  register: Register;
  line: string;
  jab: string;
  setting: string;
  cleanRecalls: number;
  totalRecalls: number;
  firstSavedAt: number;
  lastReviewAt: number | null;
  nextDueAt: number;
  level: MasteryLevel;
}

function levelFor(cleanRecalls: number, firstSavedAt: number, now: number): MasteryLevel {
  const daysHeld = (now - firstSavedAt) / 86400000;
  if (cleanRecalls >= CONFIG.MASTERY.REFLEX_RECALLS && daysHeld >= CONFIG.MASTERY.REFLEX_MIN_DAYS) return "Reflex";
  if (cleanRecalls >= CONFIG.MASTERY.PRACTICED_RECALLS) return "Practiced";
  return "Pocketed";
}

function nextDueIn(cleanRecalls: number): number {
  const steps = CONFIG.SR_INTERVALS_DAYS;
  const days = steps[Math.min(cleanRecalls, steps.length - 1)] ?? 1;
  return Date.now() + days * 86400000;
}

/** One kept line per scenario — keeping a new line replaces the old. */
export function arsenalKey(scenarioId: string): string {
  return scenarioId;
}

export async function saveLine(input: {
  scenarioId: string;
  register: Register;
  line: string;
  jab: string;
  setting: string;
}): Promise<ArsenalEntry> {
  const key = arsenalKey(input.scenarioId);
  const stale = (await recordAll<ArsenalEntry>("arsenal")).filter(
    (e) => e.scenarioId === input.scenarioId,
  );
  for (const e of stale) await recordDelete("arsenal", e.key);
  const now = Date.now();
  const entry: ArsenalEntry = {
    key,
    scenarioId: input.scenarioId,
    register: input.register,
    line: input.line,
    jab: input.jab,
    setting: input.setting,
    cleanRecalls: 0,
    totalRecalls: 0,
    firstSavedAt: now,
    lastReviewAt: null,
    nextDueAt: nextDueIn(0),
    level: "Pocketed",
  };
  await recordPut("arsenal", entry as unknown as Record<string, unknown>);
  return entry;
}

export async function getArsenal(): Promise<ArsenalEntry[]> {
  const all = await recordAll<ArsenalEntry>("arsenal");
  for (const e of all) {
    if (e.key.includes(":")) await recordDelete("arsenal", e.key);
  }
  return all.filter((e) => !e.key.includes(":")).sort((a, b) => a.nextDueAt - b.nextDueAt);
}

export async function isSaved(scenarioId: string): Promise<boolean> {
  return (await recordGet<ArsenalEntry>("arsenal", arsenalKey(scenarioId))) !== undefined;
}

export async function removeLine(scenarioId: string): Promise<void> {
  const entries = (await recordAll<ArsenalEntry>("arsenal")).filter((e) => e.scenarioId === scenarioId);
  for (const e of entries) await recordDelete("arsenal", e.key);
}

export async function dueReviews(now = Date.now()): Promise<ArsenalEntry[]> {
  return (await getArsenal()).filter((e) => e.nextDueAt <= now);
}

/** A recall rep: jab shown, user says the line from memory, marks it honestly. */
export async function recordRecall(key: string, clean: boolean): Promise<ArsenalEntry | undefined> {
  const entry = await recordGet<ArsenalEntry>("arsenal", key);
  if (!entry) return undefined;
  const now = Date.now();
  entry.totalRecalls += 1;
  if (clean) entry.cleanRecalls += 1;
  entry.lastReviewAt = now;
  entry.nextDueAt = nextDueIn(entry.cleanRecalls);
  entry.level = levelFor(entry.cleanRecalls, entry.firstSavedAt, now);
  await recordPut("arsenal", entry as unknown as Record<string, unknown>);
  await addReviewCompleted(1);
  return entry;
}

/* ---------------- Data (settings → data) ---------------- */

export async function exportArsenal(): Promise<string> {
  const entries = await getArsenal();
  return JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2);
}

export async function resetAllData(): Promise<void> {
  await clearAll();
}

/* ---------------- Drill history (weak spots, "why it's next") ---------------- */

export async function recordScenarioSeen(scenarioId: string): Promise<void> {
  const seen = (await kvGet<Record<string, number>>("seen")) ?? {};
  seen[scenarioId] = (seen[scenarioId] ?? 0) + 1;
  await kvSet("seen", seen);
}

export async function seenCounts(): Promise<Record<string, number>> {
  return (await kvGet<Record<string, number>>("seen")) ?? {};
}
