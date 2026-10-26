#!/usr/bin/env node
/**
 * Content factory gate (spec §5.3–§5.5). Validates every pack against the schema,
 * enforces register word limits and voice rules, dedupes jabs/lines, and reports
 * library stats. The counter only counts approved, live scenarios (§5.4).
 *
 * Usage: node tools/validate.mjs [--stats]
 * Exit code: 1 on any error, 0 on warnings only.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "public", "content");
const packsDir = join(contentDir, "packs");
const schemaBundle = buildSync({ entryPoints: [join(root, "src", "types.ts")], bundle: true, write: false, format: "esm", platform: "node" }).outputFiles[0].text;
const { CATEGORIES } = await import(`data:text/javascript;base64,${Buffer.from(schemaBundle).toString("base64")}`);
const taxonomy = new Map(CATEGORIES.map((c) => [c.id, new Set(c.subcategories.map((s) => s.slug))]));
let reviewLog;
try { reviewLog = JSON.parse(readFileSync(join(root, "reviews", "content-review.json"), "utf8")); }
catch { reviewLog = { scenarios: [] }; }
const reviews = new Map(reviewLog.scenarios.map((r) => [r.id, r]));

const REGISTERS = ["boss", "curt", "friendly", "comedic", "sharp"];
const MAX_WORDS = { boss: 14, curt: 8, friendly: 22, comedic: 22, sharp: 16 };
// Hard slur blocklist (§5.5). Human review owns the rest; automation only blocks the unambiguous.
const SLURS = ["retard", "retarded", "tranny", "faggot", "kike", "chink", "spic", "nigger", "nigga", "coon", "gook"];
const BOSS_WEAK_OPENERS = ["sorry", "just", "maybe", "i think", "i feel like", "does that make sense"];
const CURT_SOFTENERS = ["just", "sorry", "maybe", "a little", "sort of", "kind of", "i think"];

const errors = [];
const warnings = [];

function countWords(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function countSentences(text) {
  return text
    .split(/[.!?…]+/u)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function normalize(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const manifest = loadJson(join(contentDir, "manifest.json"));
const seenIds = new Set();
const jabIndex = new Map();
const lineIndex = new Map();
const stats = {
  approved: 0,
  drafts: 0,
  flagged: 0,
  byCategory: {},
  byRegister: Object.fromEntries(REGISTERS.map((r) => [r, 0])),
  withTrap: 0,
  totalReplies: 0,
  l2Replies: 0,
};

const packFiles = new Set(readdirSync(packsDir).filter((f) => f.endsWith(".json")));
const manifestFiles = new Set();

for (const entry of manifest.packs) {
  manifestFiles.add(entry.file);
  const path = join(packsDir, entry.file);
  let pack;
  try {
    pack = loadJson(path);
  } catch {
    errors.push(`${entry.file}: unreadable or invalid JSON`);
    continue;
  }
  const { pack: meta, scenarios } = pack;
  if (!meta || !Array.isArray(scenarios)) {
    errors.push(`${entry.file}: must have { pack, scenarios[] }`);
    continue;
  }
  if (meta.version !== entry.version) errors.push(`${entry.file}: pack.version ${meta.version} != manifest ${entry.version}`);
  if (meta.id !== entry.id) errors.push(`${entry.file}: pack.id ${meta.id} != manifest ${entry.id}`);
  if (meta.category !== entry.category || meta.subcategory !== entry.subcategory) errors.push(`${entry.file}: pack taxonomy != manifest taxonomy`);
  if (!taxonomy.get(meta.category)?.has(meta.subcategory)) errors.push(`${entry.file}: unknown category/subcategory`);
  if (scenarios.length !== entry.count) errors.push(`${entry.file}: ${scenarios.length} scenarios != manifest count ${entry.count}`);

  for (const s of scenarios) {
    const where = s.id || `${entry.file} (missing id)`;
    if (!s.id || !s.category || !s.subcategory || !s.setting || !s.jab) {
      errors.push(`${where}: missing required field (id/category/subcategory/setting/jab)`);
      continue;
    }
    if (seenIds.has(s.id)) errors.push(`${s.id}: duplicate scenario id`);
    seenIds.add(s.id);
    if (s.category !== meta.category || s.subcategory !== meta.subcategory) errors.push(`${s.id}: scenario taxonomy != pack taxonomy`);
    if (!taxonomy.get(s.category)?.has(s.subcategory)) errors.push(`${s.id}: unknown category/subcategory`);
    if (!s.goal?.trim()) errors.push(`${s.id}: missing learning goal`);
    if (!s.followUp || ["jab", "line", "why", "delivery"].some((key) => !s.followUp[key]?.trim())) errors.push(`${s.id}: follow-up needs jab/line/why/delivery`);
    if (s.followUp?.why && countSentences(s.followUp.why) !== 1) errors.push(`${s.id}: follow-up why must be one sentence`);
    if (!s.id.startsWith(`${s.category}.${s.subcategory}.`)) {
      errors.push(`${s.id}: id must start with category.subcategory`);
    }
    if (![1, 2, 3].includes(s.difficulty)) errors.push(`${s.id}: difficulty must be 1–3`);
    if (!Array.isArray(s.tags)) errors.push(`${s.id}: tags must be an array`);

    const replies = s.replies ?? [];
    if (replies.length < 3 || replies.length > 5) {
      errors.push(`${s.id}: replies must be 3–5, found ${replies.length}`);
    }
    const regs = replies.map((r) => r.register);
    if (new Set(regs).size !== regs.length) errors.push(`${s.id}: reply registers must be distinct`);
    for (const r of replies) {
      if (!REGISTERS.includes(r.register)) errors.push(`${s.id}: unknown register ${r.register}`);
      if (!r.line || !r.line.trim()) errors.push(`${s.id}/${r.register}: empty line`);
      if (!r.delivery?.trim()) errors.push(`${s.id}/${r.register}: missing delivery coaching`);
      if (!r.why || !r.why.trim()) errors.push(`${s.id}/${r.register}: empty why`);
      else if (countSentences(r.why) !== 1) errors.push(`${s.id}/${r.register}: why must be exactly one sentence`);
      const words = countWords(r.line || "");
      const max = MAX_WORDS[r.register] ?? 99;
      if (words > max) errors.push(`${s.id}/${r.register}: ${words} words > ${max} for ${r.register}`);
      const lower = (r.line || "").toLowerCase();
      for (const slur of SLURS) {
        if (lower.includes(slur)) errors.push(`${s.id}/${r.register}: blocked term (§5.5)`);
      }
      if (r.register === "boss") {
        for (const opener of BOSS_WEAK_OPENERS) {
          if (lower.startsWith(opener)) warnings.push(`${s.id}/boss: weak opener "${opener}" — Boss never opens soft`);
        }
      }
      if (r.register === "curt" && !["apologizing-well", "sarcasm-in-text", "street-transit"].includes(s.subcategory)) {
        // Apologizing-well is exempt: the apology is the assignment, not a softener.
        for (const soft of CURT_SOFTENERS) {
          if (lower.includes(soft)) warnings.push(`${s.id}/curt: softener "${soft}" — brevity is the whole weapon`);
        }
      }
      if (r.register === "sharp" && (s.category === "work" || s.category === "family") && !r.caution) {
        warnings.push(`${s.id}/sharp: Sharp in ${s.category} should carry a caution`);
      }
      if ((r.line || "").length > 160) {
        warnings.push(`${s.id}/${r.register}: line is long for read-aloud (${r.line.length} chars)`);
      }
      const normLine = normalize(r.line || "");
      if (normLine) {
        if (lineIndex.has(normLine)) warnings.push(`${s.id}/${r.register}: line near-duplicates ${lineIndex.get(normLine)}`);
        else lineIndex.set(normLine, `${s.id}/${r.register}`);
      }
      stats.byRegister[r.register] += 1;
      stats.totalReplies += 1;
      if (r.line_l2) stats.l2Replies += 1;
    }

    if (s.trap) {
      if (!s.trap.line || !s.trap.why) errors.push(`${s.id}: trap needs line + why`);
      stats.withTrap += 1;
    }
    const status = s.review?.status;
    if (!["approved", "draft", "flagged"].includes(status)) {
      errors.push(`${s.id}: review.status must be approved|draft|flagged`);
    } else if (status === "approved") {
      const logged = reviews.get(s.id);
      const hash = createHash("sha256").update(JSON.stringify(s)).digest("hex");
      if (!logged || logged.sha256 !== hash || !logged.notes || logged.status !== "reviewed") errors.push(`${s.id}: missing or stale editorial review record`);
      if (!["agent-editorial", "human-editorial"].includes(s.review.method) || !s.review.reviewer || !s.review.reviewedAt) errors.push(`${s.id}: missing review provenance`);
      if (s.review.independentHumanReview && logged?.independentHumanReview !== true) errors.push(`${s.id}: unsupported independent human review claim`);
      stats.approved += 1;
      stats.byCategory[s.category] = (stats.byCategory[s.category] ?? 0) + 1;
    } else if (status === "draft") stats.drafts += 1;
    else stats.flagged += 1;

    const normJab = normalize(s.jab);
    if (jabIndex.has(normJab)) errors.push(`${s.id}: jab near-duplicates ${jabIndex.get(normJab)}`);
    else jabIndex.set(normJab, s.id);
  }
}

for (const f of packFiles) {
  if (!manifestFiles.has(f)) errors.push(`${f}: pack file not listed in manifest.json`);
}

const total = stats.approved + stats.drafts + stats.flagged;
console.log(`Library: ${stats.approved} approved · ${stats.drafts} draft · ${stats.flagged} flagged (${total} total)`);
console.log(`Editorial method: ${reviewLog.method ?? "not recorded"}; independent human review: ${reviewLog.independentHumanReview ? "recorded" : "not performed"}`);
if (process.argv.includes("--stats")) {
  const l2 = stats.l2Replies ?? 0;
  console.log(`Second language: ${l2}/${stats.totalReplies} replies (${stats.totalReplies ? Math.round((l2 / stats.totalReplies) * 100) : 0}%)`);
}
console.log(`Replies: ${stats.totalReplies} (avg ${(stats.totalReplies / Math.max(1, total)).toFixed(1)}/scenario) · trap coverage ${total ? Math.round((stats.withTrap / total) * 100) : 0}%`);

if (process.argv.includes("--stats")) {
  console.log("\nBy category:");
  for (const [cat, n] of Object.entries(stats.byCategory).sort()) console.log(`  ${cat}: ${n}`);
  console.log("By register:");
  for (const r of REGISTERS) console.log(`  ${r}: ${stats.byRegister[r]}`);
}

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(errors.length === 0 ? `\nOK — ${warnings.length} warning(s).` : `\nFAIL — ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length === 0 ? 0 : 1);
