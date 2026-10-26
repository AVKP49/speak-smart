import { CONFIG, REGISTERS } from "../config";
import { categoryTitle, type AppCtx, type DrillResult } from "../app";
import { h, tick } from "../lib/utils";
import { brandMini, lineDual, regMark, whyRow, trapCallout, rankbar } from "../components/ui";
import { addDrillCompleted, getArsenal, getSettings, recordScenarioSeen, saveLine } from "../store/state";
import { kvGet, kvSet } from "../store/db";
import type { Reply } from "../types";

export async function renderReveal(root: HTMLElement, ctx: AppCtx, result: DrillResult): Promise<() => void> {
  const settings = await getSettings();
  const { scenario } = result;
  let chosen = result.pickedReply ?? scenario.replies.find((r) => r.register === settings.defaultRegister) ?? scenario.replies[0];
  if (!chosen) { ctx.navigate(result.origin); return () => {}; }
  let dead = false;
  let marking = false;
  const session = ctx.session;
  const screen = h("div", { class: "screen practice-screen" });
  screen.append(brandMini(), h("p", { class: "session-label" }, session ? `Drill ${session.index + 1} of ${session.ids.length}` : categoryTitle(ctx.library, scenario.category)),
    rankbar(session ? session.index / session.ids.length : 0, "Session progress"));
  const stage = h("div", { class: "drill-stage" });
  const quit = h("button", { class: "btn btn--quiet" }, "Leave practice");
  quit.addEventListener("click", () => ctx.navigate("#/"));
  screen.append(stage, quit); root.append(screen);
  const heading = (step: string, title: string) => {
    stage.replaceChildren(h("span", { class: "eyebrow" }, step), h("h1", { class: "practice-title", tabindex: "-1" }, title));
    stage.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };
  const action = (label: string, fn: () => void, secondary = false) => {
    const btn = h("button", { class: secondary ? "btn btn--secondary" : "btn btn--primary" }, label);
    btn.addEventListener("click", fn); return btn;
  };
  function coach() {
    if (dead || !chosen) return;
    heading("02 / Learn", "Make this line yours.");
    if (result.pickedTrap && scenario.trap) stage.append(trapCallout(scenario.trap, settings.showL2),
      h("p", { class: "body muted" }, "Try a response that makes your actual request clear."));
    const hero = h("div", { class: "response-hero" });
    hero.append(regMark(chosen.register), lineDual(`“${chosen.line}”`, chosen.line_l2, settings.showL2, "line-hero", true));
    stage.append(hero, whyRow(chosen, settings.showL2));
    if (chosen.caution) stage.append(h("p", { class: "small caution" }, chosen.caution));
    if (result.attempt) {
      const own = h("details", { class: "disclosure" }, h("summary", {}, "Compare with your first attempt"), h("p", { class: "body" }, result.attempt),
        h("p", { class: "small muted" }, "What would you keep? What would you shorten?")); stage.append(own);
    }
    const alternatives = h("details", { class: "disclosure" }, h("summary", {}, "Try a different style"));
    for (const reply of scenario.replies) {
      if (reply === chosen) continue;
      const option = h("button", { class: "card-selectable" }, regMark(reply.register), lineDual(reply.line, reply.line_l2, settings.showL2));
      option.addEventListener("click", () => { chosen = reply; result.pickedReply = reply; coach(); }); alternatives.append(option);
    }
    stage.append(alternatives, h("p", { class: "body muted" }, "Read it slowly. Say it aloud if you can. Then try without looking."), action("I've rehearsed it →", () => scenario.followUp ? pushback() : recall()));
  }
  function pushback() {
    if (dead) return;
    const follow = scenario.followUp;
    if (!follow) { recall(); return; }
    heading("02 / Hold your ground", "And if they push back?");
    stage.append(h("div", { class: "jab-card" }, h("span", { class: "eyebrow" }, "They say"), h("p", { class: "jab-text" }, `“${follow.jab}”`)),
      h("p", { class: "body muted" }, "Take a moment. What would you say next?"));
    const show = action("See a follow-up response →", () => {
      show.remove();
      stage.append(h("div", { class: "response-hero" }, h("span", { class: "eyebrow" }, "One way to respond"), h("p", { class: "jab-text" }, `“${follow.line}”`)),
        h("p", { class: "body" }, follow.why), h("p", { class: "small muted" }, follow.delivery), action("Try the first line from memory →", recall));
    }); stage.append(show);
  }
  function recall() {
    if (dead || !chosen) return;
    heading("03 / Recall", "Your words. No hints.");
    stage.append(h("div", { class: "jab-card" }, h("p", { class: "small muted" }, scenario.setting), lineDual(`“${scenario.jab}”`, scenario.jab_l2, settings.showL2, "jab-text")),
      regMark(chosen.register), h("p", { class: "body muted" }, "Say the response from memory. The key idea matters more than every exact word."));
    const check = action("Check my recall →", () => {
      check.remove();
      stage.append(lineDual(`“${chosen!.line}”`, chosen!.line_l2, settings.showL2, "line-hero", true), h("p", { class: "body" }, "Could you recall the idea without looking?"));
      const yes = action("Yes, I had it", () => void complete(true));
      const no = action("I needed a reminder", () => void complete(false), true);
      stage.append(yes, no, h("p", { class: "small faint" }, "Your own assessment. Both answers count as practice."));
    }); stage.append(check);
  }
  async function complete(recalled: boolean) {
    if (marking || dead) return;
    marking = true;
    for (const btn of stage.querySelectorAll<HTMLButtonElement>("button")) btn.disabled = true;
    if (!result.scored) {
      result.scored = true; result.recalled = recalled;
      await addDrillCompleted();
      await recordScenarioSeen(scenario.id);
      const history = (await kvGet<Record<string, { completed: number; recalled: number }>>("practice-history")) ?? {};
      const previous = history[scenario.id] ?? { completed: 0, recalled: 0 };
      history[scenario.id] = { completed: previous.completed + 1, recalled: previous.recalled + Number(recalled) };
      await kvSet("practice-history", history);
      if (session) { session.completed += 1; session.recalled += Number(recalled); }
    }
    if (!dead) await done();
  }
  async function done() {
    if (dead || !chosen) return;
    const last = !session || session.index === session.ids.length - 1;
    heading("Practice complete", last ? "A little more ready." : "That's one in your corner.");
    const badge = h("div", { class: "completion-mark", "aria-hidden": "true" }, "✓");
    stage.append(badge, h("p", { class: "body muted", role: "status" }, result.recalled ? "You recalled the idea. Keep practicing until it feels natural." : "You practiced the moment. A reminder today can become an easier recall later."),
      h("span", { class: "xp-pop" }, `+${CONFIG.XP_DRILL} XP`));
    if (last && session) stage.append(h("div", { class: "session-summary" },
      h("div", {}, h("strong", {}, String(session.completed)), h("span", {}, "drills practiced")),
      h("div", {}, h("strong", {}, String(session.recalled)), h("span", {}, "ideas recalled"))));
    stage.append(action(last ? "Back to practice →" : "Next drill →", () => { tick(); if (last) ctx.navigate("#/"); else ctx.continueSession(); }));
    const entries = await getArsenal();
    if (dead) return;
    const existing = entries.find((e) => e.scenarioId === scenario.id);
    const same = existing?.line === chosen.line;
    const save = action(same ? "Already in My Lines ✓" : existing ? "Replace my kept line" : "Keep this in My Lines", () => void keep(save, chosen!), true);
    save.disabled = same; stage.append(save);
    const flag = action("This response needs work", () => void flagLine(flag, chosen!), true); stage.append(flag);
  }
  async function keep(btn: HTMLButtonElement, reply: Reply) {
    btn.disabled = true;
    await saveLine({ scenarioId: scenario.id, register: reply.register, line: reply.line, jab: scenario.jab, setting: scenario.setting });
    if (!dead) btn.textContent = "Kept in My Lines ✓";
  }
  async function flagLine(btn: HTMLButtonElement, reply: Reply) {
    btn.disabled = true;
    const flags = (await kvGet<{ scenarioId: string; register: string; at: number }[]>("line-flags")) ?? [];
    flags.push({ scenarioId: scenario.id, register: reply.register, at: Date.now() });
    await kvSet("line-flags", flags);
    if (!dead) btn.textContent = "Saved on this device; export in Settings";
  }
  if (result.scored) await done(); else coach();
  return () => { dead = true; };
}
