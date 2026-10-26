/** Interaction regressions for rehearsal, hidden recall, completion, and saved-line replacement.
 * Runs in jsdom through test.mjs; this does not verify pixels or browser layout. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexLibrary } from "../src/content/loader";
import manifest from "../public/content/manifest.json";
import { renderToday } from "../src/views/today";
import { renderLibrary } from "../src/views/library";
import { renderOnboarding } from "../src/views/onboarding";
import { renderDrill } from "../src/views/drill";
import { renderReveal } from "../src/views/reveal";
import { renderSettings } from "../src/views/settings";
import { getDaily, getXp, seenCounts, resetAllData, saveSettings, getArsenal, saveLine } from "../src/store/state";
import { kvGet } from "../src/store/db";
import type { AppCtx, DrillResult, PracticeSession } from "../src/app";

const packs = manifest.packs.map((p) => JSON.parse(readFileSync(`public/content/packs/${p.file}`, "utf8")));
const library = indexLibrary(manifest, packs);
const root = document.createElement("div"); document.body.append(root);
let started: string[] = [];
let result: DrillResult | null = null;
let nav = "";
const session: PracticeSession = { ids: library.scenarios.slice(0, 3).map((s) => s.id), index: 0, completed: 0, recalled: 0, origin: "#/" };
const ctx: AppCtx = { library, pendingDrill: null, lastResult: null, session,
  navigate: (hash) => { nav = hash; }, startDrill: (id) => { started = [id]; }, startSession: (ids) => { started = ids; },
  continueSession: () => { session.index += 1; }, finishDrill: (r) => { result = r; } };
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 15));
function button(text: string): HTMLButtonElement {
  const match = [...root.querySelectorAll("button")].find((b) => b.textContent === text);
  assert.ok(match, `button exists: ${text}`); return match;
}
await resetAllData(); await saveSettings({ beatMs: 1 });
await renderToday(root, ctx);
assert.equal(root.querySelectorAll(".category-card").length, 10);
button("Start my session →").click(); assert.equal(started.length, 3); assert.equal(new Set(started).size, 3);
root.replaceChildren(); await renderLibrary(root, ctx);
const search = root.querySelector<HTMLInputElement>("#scenario-search")!;
search.value = "body"; search.dispatchEvent(new Event("input"));
assert.ok(root.querySelectorAll(".scenario-card").length > 0);
for (const row of root.querySelectorAll(".scenario-card")) assert.ok(row.textContent?.toLowerCase().includes("body"));
search.value = "no matches for this phrase"; search.dispatchEvent(new Event("input"));
assert.equal(root.querySelectorAll(".scenario-card").length, 0); assert.equal(button("Practice 0 drills →").disabled, true);
search.value = ""; search.dispatchEvent(new Event("input")); button("Dating").click();
assert.equal(root.querySelectorAll(".scenario-card").length, 10);
button("Practice 3 drills →").click(); assert.ok(started.every((id) => id.startsWith("dating.")));
root.replaceChildren(); await renderOnboarding(root, ctx); button("Try your first session →").click(); await flush(); assert.equal(started.length, 3);

// An attempt is local text, not parsed HTML; opening the drill never counts as completion.
root.replaceChildren(); const scenario = library.byId.get("work.interrupters.0001")!;
const stopDrill = await renderDrill(root, ctx, { scenarioId: scenario.id, origin: "#/" });
button("Take a breath →").click(); await flush();
const attempt = root.querySelector<HTMLTextAreaElement>("#your-attempt")!;
attempt.value = '<img src=x onerror="alert(1)">'; attempt.dispatchEvent(new Event("input"));
button("Explore the responses →").click();
const friendly = scenario.replies.find((r) => r.register === "friendly")!;
const chosenButton = [...root.querySelectorAll(".response-option")].find((b) => b.textContent?.includes(friendly.line)) as HTMLButtonElement;
assert.ok(chosenButton); chosenButton.click(); assert.ok(result);
assert.equal((await getDaily()).drills, 0); assert.equal((await seenCounts())[scenario.id], undefined);
if (typeof stopDrill === "function") stopDrill();

// Make a different response your own; recall must hide all answer text until requested.
root.replaceChildren(); const r = result as DrillResult;
const stopReveal = await renderReveal(root, ctx, r);
assert.equal(root.querySelectorAll("img").length, 0);
const calm = scenario.replies.find((reply) => reply.register === "boss")!;
const alternative = [...root.querySelectorAll("details button")].find((b) => b.textContent?.includes(calm.line)) as HTMLButtonElement;
alternative.click(); assert.ok(root.textContent?.includes(calm.line));
button("I've rehearsed it →").click(); assert.ok(root.textContent?.includes(scenario.followUp!.jab));
button("See a follow-up response →").click(); assert.ok(root.textContent?.includes(scenario.followUp!.line));
button("Try the first line from memory →").click(); assert.ok(!root.textContent?.includes(calm.line));
assert.ok(!root.textContent?.includes(scenario.followUp!.line));
button("Check my recall →").click(); assert.ok(root.textContent?.includes(calm.line));
const yes = button("Yes, I had it"); yes.click(); yes.click(); await flush();
assert.equal((await getDaily()).drills, 1); assert.equal(await getXp(), 10); assert.equal((await seenCounts())[scenario.id], 1); assert.equal(session.completed, 1);
button("Keep this in My Lines").click(); await flush(); assert.equal((await getArsenal())[0]?.line, calm.line);
button("This response needs work").click(); await flush(); assert.equal((await kvGet<unknown[]>("line-flags"))?.length, 1);
stopReveal();

// Returning to a completed reveal cannot award XP again.
root.replaceChildren(); const stopAgain = await renderReveal(root, ctx, r); assert.equal(await getXp(), 10); stopAgain();
// A later choice replaces the old kept line; immediate recall is not spaced mastery.
await saveLine({ scenarioId: scenario.id, register: friendly.register, line: friendly.line, jab: scenario.jab, setting: scenario.setting });
assert.equal((await getArsenal()).length, 1); assert.equal((await getArsenal())[0]?.cleanRecalls, 0);
root.replaceChildren(); await renderSettings(root, ctx); assert.ok(button("Export response feedback"));
assert.ok(root.textContent?.includes("independent human review is pending"));
await resetAllData(); root.remove();
console.log("UI INTERACTION CHECKS PASSED: search, category sessions, onboarding, safe attempt text, rehearsal, follow-up, hidden recall, one-time XP, save, feedback, replacement");
