/**
 * Focused regression test: content URLs must resolve to the shipped paths.
 * Guards the Oct 2026 outage where packUrl() omitted the `packs/` segment and
 * every pack fetch 404'd, failing the whole library load. Run via `npm test`.
 */
import { manifestUrl, packUrl } from "../src/content/loader";
import manifestJson from "../public/content/manifest.json";

const BASE = "https://example.com/speak-smart/";
let failures = 0;

function assert(cond: unknown, msg: string, extra?: unknown): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL ${msg}`, extra ?? "");
  } else {
    console.log(`ok ${msg}`);
  }
}

const manifest = manifestJson as { version: string; packs: { id: string; file: string; count: number }[] };

assert(
  manifestUrl(BASE) === `${BASE}content/manifest.json`,
  "manifest URL resolves under content/",
  manifestUrl(BASE),
);

assert(manifest.packs.length > 0, "manifest lists packs");
for (const pack of manifest.packs) {
  const url = packUrl(pack.file, BASE);
  assert(url === `${BASE}content/packs/${pack.file}`, `pack URL for ${pack.id}`, url);
}

if (failures > 0) {
  console.error(`${failures} URL check(s) failed`);
  process.exit(1);
}
console.log(`URL CHECKS PASSED (${manifest.packs.length} packs)`);

// Session selection must remain inside the requested scope and prefer unseen drills.
const { indexLibrary, sessionIds } = await import("../src/content/loader");
const { readFileSync } = await import("node:fs");
const { resolve } = await import("node:path");
const packs = manifest.packs.map((p) => JSON.parse(readFileSync(resolve("public/content/packs", p.file), "utf8")));
const library = indexLibrary(manifestJson, packs);
assert(library.scenarios.length === 100, "exactly 100 live scenarios");
for (const category of new Set(library.scenarios.map((s) => s.category))) {
  const scoped = library.scenarios.filter((s) => s.category === category);
  assert(scoped.length === 10, `${category} has ten scenarios`);
  const seen = Object.fromEntries(scoped.slice(0, 7).map((s) => [s.id, 1]));
  const ids = sessionIds(scoped, seen, 3);
  assert(ids.length === 3 && new Set(ids).size === 3 && ids.every((id) => !seen[id]), `${category} session contains three unique unseen drills`);
}
assert(sessionIds([], {}, 3).length === 0, "empty collection creates no drills");
assert(sessionIds(library.scenarios.slice(0, 1), {}, 3).length === 1, "short collection never fabricates drills");
const { saveLine, recordRecall, getArsenal, getXp, resetAllData } = await import("../src/store/state");
if (!("window" in globalThis)) Object.assign(globalThis, { window: {} });
await resetAllData();
const input = { scenarioId: "test", register: "boss" as const, line: "My boundary.", jab: "The request.", setting: "A conversation." };
const saved = await saveLine(input);
const same = await saveLine(input);
assert(saved.firstSavedAt === same.firstSavedAt, "keeping an identical line preserves mastery history");
for (let i = 0; i < 4; i++) await recordRecall("test", true);
const afterClean = (await getArsenal())[0]!;
assert(afterClean.cleanRecalls === 4 && afterClean.level === "Practiced", "clean recalls advance mastery");
await recordRecall("test", false);
const afterShaky = (await getArsenal())[0]!;
assert(afterShaky.nextDueAt - Date.now() <= 86400000, "a shaky recall returns within one day even after prior clean recalls");
assert((await getXp()) === 25, "recall XP matches five completed reviews");
await saveLine({ ...input, line: "A different boundary." });
assert((await getArsenal()).length === 1 && (await getArsenal())[0]?.cleanRecalls === 0, "replacing a line keeps one entry and resets that line's mastery");
await resetAllData();
if (failures) process.exit(1);
console.log("SESSION AND MASTERY CHECKS PASSED");
