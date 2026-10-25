/**
 * The drill — the product (spec §4). SETUP → JAB → BEAT → RESPOND → REVEAL.
 * Pick-only: read the replies, tap the line. Serious surface: stark, focused.
 * This is the arena. (Voice/say-it removed Oct 2026 per founder direction.)
 *
 * Interpretation note (see README): in pick mode the trap is offered among the
 * shuffled options (unlabeled — the test is genuine) so §4.5 Read scoring can
 * observe it; it is labeled with its cost in the reveal.
 */
import { REGISTERS } from "../config";
import { categoryTitle, type AppCtx, type DrillRequest, type DrillResult } from "../app";
import { h, shuffle } from "../lib/utils";
import { regMark } from "../components/ui";
import { getSettings, recordScenarioSeen } from "../store/state";
import type { Reply, Scenario } from "../types";

export async function renderDrill(
  root: HTMLElement,
  ctx: AppCtx,
  request: DrillRequest,
): Promise<(() => void) | void> {
  const found = ctx.library.byId.get(request.scenarioId);
  if (!found) {
    ctx.navigate(request.origin);
    return;
  }
  const scenario: Scenario = found;
  const settings = await getSettings();
  await recordScenarioSeen(scenario.id);

  const timers: number[] = [];
  let dead = false;
  const later = (fn: () => void, ms: number) => {
    timers.push(window.setTimeout(() => {
      if (!dead) fn();
    }, ms));
  };
  const cleanup = () => {
    dead = true;
    timers.forEach((t) => window.clearTimeout(t));
  };

  let finished = false;

  const screen = h("div", { class: "screen" });
  const stage = h("div", { class: "drill-stage" });
  root.append(screen);
  screen.append(stage);

  const finish = (partial: Partial<DrillResult>) => {
    if (finished || dead) return;
    finished = true;
    ctx.finishDrill({ scenario, pickedTrap: false, origin: request.origin, scored: false, ...partial });
  };

  const contextLine = () =>
    h(
      "p",
      { class: "micro-label" },
      `${categoryTitle(ctx.library, scenario.category)} · ${REGISTERS[settings.defaultRegister].glyph} ${REGISTERS[settings.defaultRegister].name}`,
    );

  /* ---------- SETUP (≤1.5s, auto-advance): setting line only ---------- */
  function renderSetup() {
    stage.replaceChildren();
    stage.append(contextLine(), h("p", { class: "jab-text" }, scenario.setting));
    later(renderJab, 1200);
    const skip = h("button", { class: "btn btn--quiet" }, "Continue");
    skip.addEventListener("click", () => renderJab());
    stage.append(skip);
  }

  /* ---------- JAB + BEAT ---------- */
  function jabCard(): HTMLElement {
    const card = h("div", { class: "jab-card" });
    const ring = h("div", { class: "beat-ring", "aria-hidden": "true" });
    ring.setAttribute("style", `animation-duration: ${settings.beatMs}ms`);
    card.append(
      ring,
      h("p", { class: "micro-label" }, scenario.setting),
      h("p", { class: "jab-text" }, `\u201c${scenario.jab}\u201d`),
    );
    return card;
  }

  function renderJab() {
    stage.replaceChildren();
    if (dead || finished) return;
    stage.append(contextLine(), jabCard());
    later(renderBeat, 900);
  }

  function renderBeat() {
    if (dead || finished) return;
    const card = stage.querySelector(".jab-card");
    const ring = stage.querySelector(".beat-ring");
    const label = h("p", { class: "micro-label", role: "status" }, "Take the beat.");
    if (card && ring) {
      card.append(label);
      requestAnimationFrame(() => ring.classList.add("beat-ring--breathing"));
    } else {
      stage.append(label);
    }
    later(renderRespond, settings.beatMs);
  }

  /* ---------- RESPOND: pick the line. Reading is learning. ---------- */
  function renderRespond() {
    if (dead || finished) return;
    stage.replaceChildren();
    stage.append(contextLine(), jabCardCompact());
    const options = buildPickOptions(scenario);
    const list = h("div", { class: "stack stack--tight", role: "group", "aria-label": "Choose your reply" });
    for (const option of options) {
      const card = h("button", { class: "card-selectable" });
      const reply = option.reply;
      if (reply) card.append(regMark(reply.register));
      card.append(h("p", { class: "body" }, option.line));
      card.addEventListener("click", () => {
        if (reply) finish({ pickedReply: reply, pickedTrap: false });
        else finish({ pickedTrap: true });
      });
      list.append(card);
    }
    stage.append(list);
  }

  function jabCardCompact(): HTMLElement {
    const card = h("div", { class: "jab-card" });
    card.append(h("p", { class: "jab-text" }, `\u201c${scenario.jab}\u201d`));
    return card;
  }

  renderSetup();
  return cleanup;
}

function buildPickOptions(scenario: Scenario): { line: string; reply: Reply | null }[] {
  const options: { line: string; reply: Reply | null }[] = scenario.replies.map((reply) => ({
    line: reply.line,
    reply,
  }));
  if (scenario.trap) options.push({ line: scenario.trap.line, reply: null });
  return shuffle(options);
}
