/**
 * Onboarding — ≤4 screens, skippable after screen 2 (spec §3.3).
 * Screen 4 is the first drill itself: no account, no paywall before the first reveal.
 */
import { CONFIG, REGISTER_ORDER, REGISTERS, type Register } from "../config";
import { getSettings, saveSettings } from "../store/state";
import { pickNextScenario } from "../content/loader";
import { seenCounts } from "../store/state";
import { h } from "../lib/utils";
import type { AppCtx } from "../app";
import { lineDual, regMark } from "../components/ui";

function demoScenario(ctx: AppCtx) {
  return (
    ctx.library.byId.get("work.boss-talking-down.0001") ??
    ctx.library.scenarios[0]
  );
}

export async function renderOnboarding(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const settings = await getSettings();
  let step = 0;
  let voice: Register = settings.defaultRegister;
  let goal = settings.dailyGoal;

  const screen = h("div", { class: "screen screen--center" });
  root.append(screen);

  function render() {
    screen.replaceChildren();
    if (step === 0) renderPromise();
    else if (step === 1) renderVoice();
    else renderGoal();
  }

  /** Screen 1 — the promise. The product explains itself in 10 seconds. */
  function renderPromise() {
    const demo = demoScenario(ctx);
    screen.append(
      h("p", { class: "micro-label" }, "Speak Smart"),
      h("h1", { class: "display", style: "font-size: var(--text-40)" }, "Never freeze again."),
      h(
        "p",
        { class: "body muted" },
        "A drills app that trains the exact one-line reply — in your voice — for the moments people leave you speechless.",
      ),
    );
    if (demo) {
      const jab = h("div", { class: "card" });
      jab.append(
        h("p", { class: "micro-label" }, demo.setting),
        h("p", { class: "jab-text" }, `\u201c${demo.jab}\u201d`),
      );
      screen.append(jab);
      const voices = h("div", { class: "stack stack--tight" });
      for (const register of REGISTER_ORDER) {
        const reply = demo.replies.find((r) => r.register === register);
        if (!reply) continue;
        const row = h("div", { class: "voice-row" });
        row.append(regMark(register), lineDual(reply.line, reply.line_l2, settings.showL2));
        voices.append(row);
      }
      screen.append(voices);
    }
    const next = h("button", { class: "btn btn--primary" }, "Choose your voice");
    next.addEventListener("click", () => {
      step = 1;
      render();
    });
    screen.append(next);
  }

  /** Screen 2 — choose your voice. The identity moment; take time here. */
  function renderVoice() {
    const demo = demoScenario(ctx);
    screen.append(
      h("h1", { class: "display", style: "font-size: var(--text-32)" }, "Choose your voice."),
      h("p", { class: "body muted" }, "Five ways to answer the same moment. Audition them — this is the voice you train in."),
    );
    if (demo) screen.append(h("p", { class: "jab-text" }, `\u201c${demo.jab}\u201d`));
    const list = h("div", { class: "stack stack--tight", role: "radiogroup", "aria-label": "Your voice" });
    for (const register of REGISTER_ORDER) {
      const meta = REGISTERS[register];
      const reply = demo?.replies.find((r) => r.register === register);
      const card = h(
        "button",
        {
          class: `card-selectable${register === voice ? " card-selectable--selected" : ""}`,
          role: "radio",
          "aria-checked": register === voice ? "true" : "false",
        },
      );
      card.append(
        regMark(register),
        h("p", { class: "small muted" }, meta.tagline),
        reply ? lineDual(`\u201c${reply.line}\u201d`, reply.line_l2, settings.showL2) : h("p", { class: "body" }, ""),
      );
      card.addEventListener("click", () => {
        voice = register;
        render();
      });
      list.append(card);
    }
    screen.append(list);
    const next = h("button", { class: "btn btn--primary" }, "Continue");
    next.addEventListener("click", async () => {
      await saveSettings({ defaultRegister: voice });
      step = 2;
      render();
    });
    screen.append(next);
  }

  /** Screen 3 — set the daily goal. Then the first drill, immediately. */
  function renderGoal() {
    screen.append(
      h("h1", { class: "display", style: "font-size: var(--text-32)" }, "Set the daily goal."),
      h("p", { class: "body muted" }, "One drill is sixty seconds. Small goals keep streaks alive."),
    );
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Drills per day" });
    for (const option of CONFIG.DAILY_GOAL_OPTIONS) {
      const btn = h("button", { "aria-pressed": option === goal ? "true" : "false" }, String(option));
      btn.addEventListener("click", () => {
        goal = option;
        render();
      });
      seg.append(btn);
    }
    screen.append(seg);
    const start = h("button", { class: "btn btn--primary" }, "Start my first drill");
    start.addEventListener("click", async () => {
      await saveSettings({ dailyGoal: goal, onboarded: true });
      const seen = await seenCounts();
      const first = pickNextScenario(ctx.library, seen) ?? ctx.library.scenarios[0];
      if (!first) {
        ctx.navigate("#/");
        return;
      }
      ctx.startDrill(first.id, "#/");
    });
    const skip = h("button", { class: "btn btn--quiet" }, "Skip for now");
    skip.addEventListener("click", async () => {
      await saveSettings({ dailyGoal: goal, onboarded: true });
      ctx.navigate("#/");
    });
    screen.append(start, skip);
  }

  render();
}
