/**
 * Onboarding — live fire first. The user plays a real 30-second drill before
 * reading a single word about the app (TikTok/Calm lesson: content first),
 * then picks their fighter, then sets the habit. Skippable on screen 3.
 */
import { CONFIG, REGISTER_ORDER, REGISTERS, type Register } from "../config";
import { getSettings, saveSettings, seenCounts } from "../store/state";
import { pickNextScenario } from "../content/loader";
import { h } from "../lib/utils";
import { lineDual, regMark } from "../components/ui";
import type { AppCtx } from "../app";

function demoScenario(ctx: AppCtx) {
  return ctx.library.byId.get("work.boss-talking-down.0001") ?? ctx.library.scenarios[0];
}

function dots(step: number): HTMLElement {
  const wrap = h("div", { class: "dots", "aria-hidden": "true" });
  for (let i = 0; i < 3; i++) {
    wrap.append(h("span", { class: i === step ? "dot dot--on" : "dot" }));
  }
  return wrap;
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
    screen.append(dots(step));
    if (step === 0) renderPlay();
    else if (step === 1) renderVoice();
    else renderGoal();
  }

  /** Screen 1 — play. Someone just said this to you. What do you say back? */
  function renderPlay() {
    const demo = demoScenario(ctx);
    screen.append(
      h("p", { class: "kicker" }, "Live fire · 30 seconds"),
      h("h1", { class: "display", style: "font-size: var(--text-32)" }, "Someone just said this to you."),
    );
    if (!demo) {
      const next = h("button", { class: "btn btn--primary" }, "Set me up →");
      next.addEventListener("click", () => {
        step = 1;
        render();
      });
      screen.append(next);
      return;
    }
    const jab = h("div", { class: "jab-card" });
    jab.append(
      h("p", { class: "micro-label" }, demo.setting),
      lineDual(`\u201c${demo.jab}\u201d`, demo.jab_l2, settings.showL2, "jab-text"),
    );
    screen.append(jab, h("p", { class: "kicker" }, "What do you say back?"));

    const witty = demo.replies.filter((r) => r.register === "comedic" || r.register === "sharp");
    const rest = demo.replies.filter((r) => r.register !== "comedic" && r.register !== "sharp");
    const options = [...witty.slice(0, 2)];
    while (options.length < 2 && rest.length > 0) options.push(rest.shift()!);
    const trapLine = demo.trap?.line;
    const list = h("div", { class: "stack stack--tight" });
    const area = h("div", { class: "stack" });
    let picked = false;

    const finish = (isTrap: boolean, line: string) => {
      if (picked) return;
      picked = true;
      for (const child of list.children) {
        if (child instanceof HTMLButtonElement) child.setAttribute("disabled", "true");
      }
      area.replaceChildren();
      if (isTrap) {
        area.append(
          h("p", { class: "body" }, `\u201c${line}\u201d`),
          h("p", { class: "body" }, "Ooh — that's the trap. Satisfying, costly. We teach that too."),
        );
      } else {
        area.append(
          h("span", { class: "xp-pop" }, "Nice."),
          h("p", { class: "body" }, "That's Speak Smart. Sixty-second drills, in your voice. Never freeze again."),
        );
      }
      const next = h("button", { class: "btn btn--primary" }, "Set me up →");
      next.addEventListener("click", () => {
        step = 1;
        render();
      });
      area.append(next);
    };

    for (const reply of options) {
      const btn = h("button", { class: "card-selectable" });
      btn.append(regMark(reply.register), lineDual(reply.line, reply.line_l2, settings.showL2));
      btn.addEventListener("click", () => finish(false, reply.line));
      list.append(btn);
    }
    if (trapLine) {
      const btn = h("button", { class: "card-selectable" });
      btn.append(h("p", { class: "body" }, trapLine));
      btn.addEventListener("click", () => finish(true, trapLine));
      list.append(btn);
    }
    screen.append(list, area);
  }

  /** Screen 2 — pick your fighter. */
  function renderVoice() {
    const demo = demoScenario(ctx);
    screen.append(
      h("p", { class: "kicker" }, "Pick your fighter"),
      h("h1", { class: "display", style: "font-size: var(--text-32)" }, "Whose words are these?"),
      h("p", { class: "body muted" }, "Five voices. Same moment. Yours is the one you'd actually say out loud."),
    );
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
    const next = h("button", { class: "btn btn--primary" }, "Continue →");
    next.addEventListener("click", async () => {
      await saveSettings({ defaultRegister: voice });
      step = 2;
      render();
    });
    screen.append(next);
  }

  /** Screen 3 — the habit. Then Day 1, immediately. */
  function renderGoal() {
    screen.append(
      h("p", { class: "kicker" }, "The habit"),
      h("h1", { class: "display", style: "font-size: var(--text-32)" }, "How many rounds a day?"),
      h("p", { class: "body muted" }, "Day 1 starts now. One drill keeps it."),
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
    const start = h("button", { class: "btn btn--primary" }, "Start Day 1 →");
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
