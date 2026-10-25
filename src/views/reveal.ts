/**
 * Reveal (spec §4.4–§4.5). The line in your voice as centerpiece, honest marks,
 * the other voices, the trap, and three actions. Warm surface.
 */
import { REGISTERS } from "../config";
import { categoryTitle, packTitle, type AppCtx, type DrillResult } from "../app";
import { pickNextScenario } from "../content/loader";
import { h } from "../lib/utils";
import { brandMini, cautionBadge, notice, regMark, trapCallout, voiceRow, whyRow } from "../components/ui";
import {
  addDrillCompleted,
  getSettings,
  isSaved,
  saveLine,
  seenCounts,
  rankForReflexCount,
  getArsenal,
} from "../store/state";
import { kvGet, kvSet } from "../store/db";
import { CATEGORIES, type Reply } from "../types";

export async function renderReveal(root: HTMLElement, ctx: AppCtx, result: DrillResult): Promise<void> {
  const settings = await getSettings();
  const { scenario } = result;

  /* The line in your chosen voice (§4.4.1). */
  let center: Reply | undefined;
  let substituted = false;
  if (result.pickedReply) {
    center = result.pickedReply;
  } else {
    center =
      scenario.replies.find((r) => r.register === settings.defaultRegister) ??
      scenario.replies[0];
    if (center && center.register !== settings.defaultRegister) substituted = true;
  }
  if (!center) {
    ctx.navigate(result.origin);
    return;
  }
  const centerReply: Reply = center;

  /* Score once: XP only for completed drills (§4.5, Lesson 4). */
  if (!result.scored) {
    result.scored = true;
    await addDrillCompleted();
  }

  const screen = h("div", { class: "screen" });
  screen.append(
    brandMini(),
    h("p", { class: "micro-label" }, `${categoryTitle(ctx.library, scenario.category)} · ${packTitle(ctx.library, scenario.category, scenario.subcategory)}`),
  );

  /* 1 — the centerpiece. */
  const hero = h("div", { class: "centerpiece" });
  hero.append(regMark(centerReply.register));
  hero.append(h("p", { class: "line-hero" }, `\u201c${centerReply.line}\u201d`));
  if (centerReply.caution) hero.append(cautionBadge(centerReply.caution));
  screen.append(hero);
  if (substituted) {
    screen.append(
      notice(
        `No ${REGISTERS[settings.defaultRegister].name} line fits this moment — the library never forces one. Training you in ${REGISTERS[centerReply.register].name} instead.`,
      ),
    );
  }

  /* 2 — what you picked. */
  const yours = h("div", { class: "stack stack--tight" });
  yours.append(h("p", { class: "micro-label" }, "What you picked"));
  if (result.pickedTrap && scenario.trap) {
    yours.append(
      h("p", { class: "body" }, `\u201c${scenario.trap.line}\u201d`),
      h("p", { class: "body" }, "That was the trap line. Everyone picks it first."),
    );
  } else if (result.pickedReply) {
    yours.append(h("p", { class: "body" }, `\u201c${result.pickedReply.line}\u201d`));
    yours.append(h("p", { class: "body" }, readNote(result.pickedReply, scenario.category)));
  }
  screen.append(yours);

  /* 3 — why it works. One sentence. The coaching. */
  screen.append(whyRow(centerReply));

  /* 4 — the other voices. */
  const others = scenario.replies.filter((r) => r.register !== centerReply.register);
  if (others.length > 0) {
    const box = h("div", { class: "stack stack--tight" });
    box.append(h("p", { class: "micro-label" }, "The other voices"));
    for (const reply of others) box.append(voiceRow(reply));
    screen.append(box);
  }

  /* 5 — the trap. */
  if (scenario.trap) screen.append(trapCallout(scenario.trap));

  /* Goal-gradient whisper. */
  const arsenal = await getArsenal();
  const reflexCount = arsenal.filter((e) => e.level === "Reflex").length;
  const rank = rankForReflexCount(reflexCount);
  if (rank.next) {
    screen.append(h("p", { class: "small muted metric" }, `${rank.toNext} lines to ${rank.next}. Saving this one counts.`));
  }

  /* 6 — actions. */
  const saved = await isSaved(scenario.id, centerReply.register);
  const save = h("button", { class: "btn btn--primary" }, saved ? "Saved to your Arsenal." : "Save to Arsenal");
  if (saved) save.setAttribute("disabled", "true");
  save.addEventListener("click", async () => {
    await saveLine({
      scenarioId: scenario.id,
      register: centerReply.register,
      line: centerReply.line,
      jab: scenario.jab,
      setting: scenario.setting,
    });
    save.replaceChildren(document.createTextNode("Saved to your Arsenal."));
    save.setAttribute("disabled", "true");
  });
  const nextBtn = h("button", { class: "btn btn--secondary" }, "Next");
  nextBtn.addEventListener("click", async () => {
    const seen = await seenCounts();
    const following = pickNextScenario(ctx.library, seen) ?? ctx.library.scenarios[0];
    if (following) ctx.startDrill(following.id, result.origin);
    else ctx.navigate(result.origin);
  });
  const flag = h("button", { class: "btn btn--quiet", "aria-label": "Flag this line as a miss" }, "This line missed");
  flag.addEventListener("click", async () => {
    const flags = (await kvGet<{ scenarioId: string; register: string; at: number }[]>("line-flags")) ?? [];
    flags.push({ scenarioId: scenario.id, register: centerReply.register, at: Date.now() });
    await kvSet("line-flags", flags);
    flag.replaceChildren(document.createTextNode("Noted. Flags like yours prune the library."));
    flag.setAttribute("disabled", "true");
  });
  screen.append(save, nextBtn, flag);

  const done = h("button", { class: "btn btn--quiet" }, "Finish");
  done.addEventListener("click", () => ctx.navigate(result.origin));
  screen.append(done);

  root.append(screen);
}

/** One-line Read note for pick mode (§4.5). Never shames; the floor is about the rep. */
function readNote(picked: Reply, category: string): string {
  if (picked.caution) {
    const arena = CATEGORIES.find((c) => c.id === category)?.title ?? category;
    return `Risky for ${arena} — ${REGISTERS[picked.register].name} carries a caution here. The calmer cut is above.`;
  }
  if (picked.register === "sharp") return "Sharp lands — check the caution before using it here.";
  return "Strong line. That's the rep.";
}
