import { categoryTitle, type AppCtx, type DrillRequest } from "../app";
import { h, shuffle, tick } from "../lib/utils";
import { brandMini, lineDual, regMark, rankbar } from "../components/ui";
import { getSettings } from "../store/state";

export async function renderDrill(root: HTMLElement, ctx: AppCtx, request: DrillRequest): Promise<(() => void) | void> {
  const found = ctx.library.byId.get(request.scenarioId);
  if (!found) { ctx.navigate(request.origin); return; }
  const scenario = found;
  const settings = await getSettings();
  let dead = false;
  let finished = false;
  let timer = 0;
  let attempt = "";
  const screen = h("div", { class: "screen practice-screen" });
  const session = ctx.session;
  screen.append(brandMini(), h("p", { class: "session-label" }, session ? `Drill ${session.index + 1} of ${session.ids.length}` : "One moment. One useful response."),
    rankbar(session ? session.index / session.ids.length : 0, "Session progress"));
  const stage = h("div", { class: "drill-stage" });
  const quit = h("button", { class: "btn btn--quiet" }, "Leave practice");
  quit.addEventListener("click", () => ctx.navigate("#/"));
  screen.append(stage, quit); root.append(screen);

  const heading = (step: string, title: string) => {
    stage.replaceChildren(h("span", { class: "eyebrow" }, step), h("h1", { class: "practice-title", tabindex: "-1" }, title));
    stage.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  };
  const jab = () => {
    const card = h("div", { class: "jab-card" });
    card.append(h("span", { class: "eyebrow" }, categoryTitle(ctx.library, scenario.category)),
      h("p", { class: "small muted" }, scenario.setting),
      lineDual(`“${scenario.jab}”`, scenario.jab_l2, settings.showL2, "jab-text"));
    return card;
  };
  function think() {
    heading("01 / Think", "You're put on the spot.");
    stage.append(jab(), h("p", { class: "body muted" }, scenario.goal ?? "Find a response that fits this moment."));
    const next = h("button", { class: "btn btn--primary" }, "Take a breath →");
    next.addEventListener("click", breathe); stage.append(next);
  }
  function breathe() {
    if (dead) return;
    heading("01 / Think", "Take a beat.");
    stage.append(jab(), h("p", { class: "body muted", role: "status" }, "You can pause before you answer."));
    const sweep = h("div", { class: "beat-sweep", "aria-hidden": "true" }, h("div", { style: `animation-duration:${settings.beatMs}ms` }));
    stage.append(sweep);
    timer = window.setTimeout(() => {
      if (dead) return;
      const label = h("label", { class: "body", for: "your-attempt" }, "What would you say?");
      const input = h("textarea", { id: "your-attempt", class: "attempt-input", rows: 3, maxlength: 500, placeholder: "Think it, say it, or write it here…" });
      input.addEventListener("input", () => { attempt = input.value; });
      const compare = h("button", { class: "btn btn--primary" }, "Explore the responses →");
      compare.addEventListener("click", learn);
      stage.append(label, input, h("p", { class: "small faint" }, "Writing is optional. Your attempt stays in this session."), compare);
    }, settings.beatMs);
  }
  function learn() {
    if (dead || finished) return;
    heading("02 / Learn", "Choose words that fit.");
    stage.append(jab(), h("p", { class: "small muted" }, "Several responses can work. Pick one you'd actually use."));
    const options = shuffle([...scenario.replies.map((r) => ({ reply: r, line: r.line, l2: r.line_l2 })),
      ...(scenario.trap ? [{ reply: null, line: scenario.trap.line, l2: scenario.trap.line_l2 }] : [])]);
    const list = h("div", { class: "stack stack--tight", role: "group", "aria-label": "Choose a response" });
    for (const option of options) {
      const card = h("button", { class: "card-selectable response-option" });
      if (option.reply) card.append(regMark(option.reply.register));
      card.append(lineDual(option.line, option.l2, settings.showL2));
      card.addEventListener("click", () => {
        if (dead || finished) return;
        finished = true; tick();
        ctx.finishDrill({ scenario, pickedReply: option.reply ?? undefined, pickedTrap: !option.reply, origin: request.origin, scored: false, attempt: attempt.trim() || undefined });
      }); list.append(card);
    }
    stage.append(list);
  }
  think();
  return () => { dead = true; window.clearTimeout(timer); };
}
