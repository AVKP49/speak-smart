/** Exercise the real router, session lifecycle, and connected Settings updates. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = document.createElement("div"); root.id = "app"; document.body.append(root);
Object.defineProperty(window, "matchMedia", { value: () => ({ matches: false }), configurable: true });
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const rel = url.pathname.split("/speak-smart/")[1]!;
  return new Response(readFileSync(`public/${rel}`, "utf8"), { status: 200, headers: { "Content-Type": "application/json" } });
};
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 25));
function button(text: string): HTMLButtonElement {
  const btn = [...root.querySelectorAll("button")].find((b) => b.textContent === text);
  assert.ok(btn, `router button exists: ${text}`); return btn;
}
const { saveSettings, getDaily, getXp } = await import("../src/store/state");
await saveSettings({ onboarded: true, beatMs: 1, dailyGoal: 3 });
window.location.hash = "#/";
await import("../src/main"); await flush();
assert.ok(root.textContent?.includes("Your next calm moment."));
window.location.hash = "#/settings"; await flush();
const style = [...root.querySelectorAll("button")].find((b) => b.textContent?.startsWith("◆Calm"))!;
style.click(); await flush();
assert.ok(root.querySelector('[aria-label="Preferred response style"] button[aria-pressed="true"]')?.textContent?.startsWith("◆Calm"));
window.location.hash = "#/"; await flush(); button("Start my session →").click(); await flush();
for (let i = 0; i < 3; i++) {
  assert.ok(root.textContent?.includes(`Drill ${i + 1} of 3`));
  button("Take a breath →").click(); await flush(); button("Explore the responses →").click();
  const response = root.querySelector<HTMLButtonElement>(".response-option")!; response.click(); await flush();
  button("I've rehearsed it →").click(); button("See a follow-up response →").click();
  button("Try the first line from memory →").click(); button("Check my recall →").click();
  button(i === 1 ? "I needed a reminder" : "Yes, I had it").click(); await flush();
  if (i < 2) { button("Next drill →").click(); await flush(); }
}
assert.equal(root.querySelector(".session-summary div:first-child strong")?.textContent, "3");
assert.equal(root.querySelector(".session-summary div:nth-child(2) strong")?.textContent, "2");
assert.equal((await getDaily()).drills, 3); assert.equal(await getXp(), 30);
button("Back to practice →").click(); await flush(); assert.ok(root.textContent?.includes("Today's practice: complete"));
// Rapid navigation must leave only the final screen, not stale asynchronous renders.
window.location.hash = "#/settings"; window.location.hash = "#/library"; await flush();
assert.equal(root.querySelectorAll(".screen").length, 1); assert.ok(root.querySelector("#scenario-search"));
globalThis.fetch = nativeFetch;
console.log("ROUTER CHECKS PASSED: connected Settings update, three-drill session, completion totals, rapid navigation");
