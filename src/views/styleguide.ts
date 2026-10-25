/**
 * Living style page (Phase 0). Every component rendered from tokens alone —
 * if a new screen needs a pattern that isn't here, that's a design decision
 * to escalate, not a local improvisation (§1 Lesson 3).
 */
import { CONFIG, REGISTER_ORDER } from "../config";
import type { AppCtx } from "../app";
import { h } from "../lib/utils";
import { cautionBadge, notice, progressRing, regMark, topbar, trapCallout, voiceRow, whyRow } from "../components/ui";

export async function renderStyleguide(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const demo = ctx.library.byId.get("work.boss-talking-down.0001");
  const screen = h("div", { class: "screen" });
  screen.append(topbar("Design system", { onBack: () => ctx.navigate("#/settings") }));

  screen.append(h("p", { class: "micro-label" }, "Color — ink, paper, one gold"));
  const swatches = h("div", { class: "row", style: "flex-wrap: wrap" });
  const colors: [string, string][] = [
    ["--ink", "Ink"], ["--surface", "Surface"], ["--surface-2", "Surface 2"],
    ["--paper", "Paper"], ["--muted", "Muted"], ["--faint", "Faint"],
    ["--gold", "Gold"], ["--line", "Line"],
  ];
  for (const [token, label] of colors) {
    const chip = h("span", { class: "chip" });
    const dot = h("span", { class: "swatch-dot", style: `background:var(${token})` });
    chip.append(dot, document.createTextNode(`${label} ${token}`));
    swatches.append(chip);
  }
  screen.append(swatches);

  screen.append(h("p", { class: "micro-label" }, "Type — Fraunces display, Inter UI"));
  screen.append(h("p", { class: "line-hero" }, "The line is the hero."));
  screen.append(h("p", { class: "body" }, "Body copy sets in Inter at 16px with a calm 1.55 line height."));
  screen.append(h("p", { class: "small muted" }, "Small muted text for secondary detail."));
  screen.append(h("p", { class: "micro-label" }, "Micro-label — 11px, tracked"));

  screen.append(h("p", { class: "micro-label" }, "Buttons — one primary per screen"));
  const p = h("button", { class: "btn btn--primary" }, "Primary");
  p.addEventListener("click", () => p.blur());
  const s = h("button", { class: "btn btn--secondary" }, "Secondary");
  s.addEventListener("click", () => s.blur());
  screen.append(p, s, h("button", { class: "btn btn--quiet" }, "Quiet"));

  screen.append(h("p", { class: "micro-label" }, "Register marks — glyph plus name, never color alone"));
  const marks = h("div", { class: "row", style: "flex-wrap: wrap" });
  for (const r of REGISTER_ORDER) marks.append(regMark(r));
  screen.append(marks, cautionBadge("work-risk"));

  screen.append(h("p", { class: "micro-label" }, "Jab card + the Beat"));
  const jab = h("div", { class: "jab-card" });
  const ring = h("div", { class: "beat-ring", "aria-hidden": "true" });
  ring.setAttribute("style", `animation-duration: ${CONFIG.BEAT_MS}ms`);
  jab.append(ring, h("p", { class: "jab-text" }, demo ? `\u201c${demo.jab}\u201d` : ""));
  const breathe = h("button", { class: "btn btn--secondary" }, "Breathe the ring");
  breathe.addEventListener("click", () => {
    ring.classList.remove("beat-ring--breathing");
    requestAnimationFrame(() => ring.classList.add("beat-ring--breathing"));
  });
  screen.append(jab, breathe);

  if (demo) {
    screen.append(h("p", { class: "micro-label" }, "Reveal pieces"));
    const first = demo.replies[0];
    if (first) screen.append(whyRow(first));
    const second = demo.replies[1];
    if (second) screen.append(voiceRow(second));
    if (demo.trap) screen.append(trapCallout(demo.trap));
  }

  screen.append(h("p", { class: "micro-label" }, "Progress + notices"));
  const rings = h("div", { class: "row" });
  rings.append(progressRing(0.25, 40, "25 percent"), progressRing(0.5, 40, "50 percent"), progressRing(1, 40, "Complete"));
  screen.append(rings, notice("A quiet notice. Nothing shouts on a serious surface."));

  root.append(screen);
}
