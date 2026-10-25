/**
 * The drill — the product. SETUP → JAB → BEAT → RESPOND → REVEAL.
 * Pick-only: read the replies, tap the line. The jab arrives as a ticket stub;
 * options are numbered marquee rows.
 */
import { REGISTERS } from "../config";
import { t } from "../i18n";
import { categoryTitle, type AppCtx, type DrillRequest, type DrillResult } from "../app";
import { h, shuffle } from "../lib/utils";
import { brandMini, lineDual, regMark } from "../components/ui";
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
  screen.append(brandMini(), stage);

  const finish = (partial: Partial<DrillResult>) => {
    if (finished || dead) return;
    finished = true;
    ctx.finishDrill({ scenario, pickedTrap: false, origin: request.origin, scored: false, ...partial });
  };

  const meta = REGISTERS[settings.defaultRegister];
  const contextLine = () =>
    h(
      "p",
      { class: "kicker" },
      `${categoryTitle(ctx.library, scenario.category)} · ${meta.glyph} ${meta.name}`,
    );

  /* ---------- SETUP (≤1.5s, auto-advance): setting line only ---------- */
  function renderSetup() {
    stage.replaceChildren();
    stage.append(contextLine(), h("p", { class: "jab-text" }, scenario.setting));
    later(renderJab, 1200);
    const skip = h("button", { class: "btn btn--quiet" }, t("common.continue"));
    skip.addEventListener("click", () => renderJab());
    stage.append(skip);
  }

  /* ---------- JAB: the ticket stub ---------- */
  function jabCard(): HTMLElement {
    const card = h("div", { class: "jab-card" });
    const ring = h("div", { class: "beat-ring", "aria-hidden": "true" });
    ring.setAttribute("style", `animation-duration: ${settings.beatMs}ms`);
    card.append(
      ring,
      h("p", { class: "kicker" }, "The jab"),
      h("p", { class: "micro-label" }, scenario.setting),
      lineDual(`\u201c${scenario.jab}\u201d`, scenario.jab_l2, settings.showL2, "jab-text"),
    );
    return card;
  }

  function renderJab() {
    stage.replaceChildren();
    if (dead || finished) return;
    stage.append(contextLine(), jabCard());
    later(renderBeat, 900);
  }

  /* ---------- BEAT: hold it ---------- */
  function renderBeat() {
    if (dead || finished) return;
    const card = stage.querySelector(".jab-card");
    const ring = stage.querySelector(".beat-ring");
    const label = h("p", { class: "kicker", role: "status" }, t("drill.beat"));
    const sweep = h("div", { class: "beat-sweep", "aria-hidden": "true" });
    const fill = h("div");
    fill.setAttribute("style", `animation-duration: ${settings.beatMs}ms`);
    sweep.append(fill);
    if (card && ring) {
      card.append(label, sweep);
      requestAnimationFrame(() => ring.classList.add("beat-ring--breathing"));
    } else {
      stage.append(label, sweep);
    }
    later(renderRespond, settings.beatMs);
  }

  /* ---------- RESPOND: numbered marquee rows ---------- */
  function renderRespond() {
    if (dead || finished) return;
    stage.replaceChildren();
    stage.append(contextLine(), jabCardCompact());
    stage.append(h("p", { class: "kicker" }, t("drill.pickHint")));
    const options = buildPickOptions(scenario);
    const list = h("div", { class: "stack stack--tight", role: "group", "aria-label": "Choose your reply" });
    options.forEach((option, i) => {
      const card = h("button", { class: "card-selectable opt" });
      const reply = option.reply;
      card.append(h("span", { class: "opt-index", "aria-hidden": "true" }, String(i + 1).padStart(2, "0")));
      if (reply) card.append(regMark(reply.register));
      card.append(lineDual(option.line, option.l2, settings.showL2));
      card.addEventListener("click", () => {
        if (reply) finish({ pickedReply: reply, pickedTrap: false });
        else finish({ pickedTrap: true });
      });
      list.append(card);
    });
    stage.append(list);
  }

  function jabCardCompact(): HTMLElement {
    const card = h("div", { class: "jab-card" });
    card.append(lineDual(`\u201c${scenario.jab}\u201d`, scenario.jab_l2, settings.showL2, "jab-text"));
    return card;
  }

  renderSetup();
  return cleanup;
}

function buildPickOptions(scenario: Scenario): { line: string; l2?: string; reply: Reply | null }[] {
  const options: { line: string; l2?: string; reply: Reply | null }[] = scenario.replies.map((reply) => ({
    line: reply.line,
    l2: reply.line_l2,
    reply,
  }));
  if (scenario.trap) options.push({ line: scenario.trap.line, l2: scenario.trap.line_l2, reply: null });
  return shuffle(options);
}
