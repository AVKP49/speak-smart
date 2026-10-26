/**
 * Arsenal — the trophy case. Saved lines grouped by register with mastery pips
 * and due status; tap to rehearse one line in isolation.
 */
import { REGISTER_ORDER, REGISTERS } from "../config";
import { t } from "../i18n";
import type { AppCtx } from "../app";
import { h } from "../lib/utils";
import { lineDual, notice, pips, regMark, tabbar, appheader } from "../components/ui";
import {
  dueReviews,
  getArsenal,
  getSettings,
  rankForReflexCount,
  recordRecall,
  removeLine,
  type ArsenalEntry,
} from "../store/state";

export async function renderArsenal(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const [entries, due, settings] = await Promise.all([getArsenal(), dueReviews(), getSettings()]);
  const screen = h("div", { class: "screen" });
  screen.append(appheader(t("tab.arsenal")));

  if (entries.length === 0) {
    screen.append(notice(t("arsenal.empty")));
    const go = h("button", { class: "btn btn--primary" }, t("arsenal.drillNow"));
    go.addEventListener("click", () => ctx.navigate("#/"));
    screen.append(go);
    root.append(screen);
    root.append(tabbar("arsenal", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
    return;
  }

  const reflexCount = entries.filter((e) => e.level === "Reflex").length;
  const rank = rankForReflexCount(reflexCount);
  const composition = REGISTER_ORDER.map((r) => {
    const n = entries.filter((e) => e.register === r).length;
    return n > 0 ? `${n} ${REGISTERS[r].glyph} ${REGISTERS[r].name}` : null;
  }).filter((x): x is string => x !== null);
  screen.append(
    h("p", { class: "body metric" }, `${entries.length} lines · ${composition.join(" · ")}`),
    h("p", { class: "small muted" }, rank.next ? `${rank.toNext} lines to ${rank.next}. You are ${rank.current}.` : `You are ${rank.current}.`),
  );

  const dueKeys = new Set(due.map((d) => d.key));
  if (due.length > 0) {
    screen.append(h("p", { class: "kicker" }, `${t("arsenal.due")} (${due.length})`));
    for (const entry of due) screen.append(arsenalRow(ctx, entry, true, settings.showL2));
  }
  for (const register of REGISTER_ORDER) {
    const group = entries.filter((e) => e.register === register && !dueKeys.has(e.key));
    if (group.length === 0) continue;
    screen.append(h("p", { class: "kicker" }, `${REGISTERS[register].glyph} ${REGISTERS[register].name}`));
    for (const entry of group) screen.append(arsenalRow(ctx, entry, false, settings.showL2));
  }

  root.append(screen);
  root.append(tabbar("arsenal", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
}

function l2For(ctx: AppCtx, entry: ArsenalEntry): string | undefined {
  const scenario = ctx.library.byId.get(entry.scenarioId);
  return scenario?.replies.find((r) => r.register === entry.register)?.line_l2;
}

function arsenalRow(ctx: AppCtx, entry: ArsenalEntry, isDue: boolean, showL2: boolean): HTMLElement {
  const row = h("button", { class: "row-tap" });
  const text = h("div", { class: "stack stack--tight", style: "flex: 1" });
  text.append(
    h("div", { class: "row row--spread" }, regMark(entry.register), pips(entry.level)),
    lineDual(`\u201c${entry.line}\u201d`, l2For(ctx, entry), showL2),
  );
  const pillClass = entry.level === "Reflex" ? "mastery-pill mastery-pill--reflex" : "mastery-pill";
  text.append(
    h(
      "div",
      { class: "row" },
      h("span", { class: isDue ? "mastery-pill mastery-pill--due" : pillClass }, isDue ? `${entry.level} · due` : entry.level),
      h("span", { class: "small faint metric" }, `${entry.cleanRecalls} clean`),
    ),
  );
  row.append(text);
  row.addEventListener("click", () => ctx.navigate(`#/arsenal/recall/${encodeURIComponent(entry.key)}`));
  return row;
}

/* ---------------- Recall: say it from memory, mark it honestly ---------------- */

export async function renderRecall(root: HTMLElement, ctx: AppCtx, key: string): Promise<void> {
  const entries = await getArsenal();
  const entry = entries.find((e) => e.key === key);
  const settings = await getSettings();
  const screen = h("div", { class: "screen" });
  screen.append(appheader("Recall", { onBack: () => ctx.navigate("#/arsenal") }));
  if (!entry) {
    screen.append(notice("That line isn't in My Lines anymore."));
    root.append(screen);
    return;
  }

  const scenario = ctx.library.byId.get(entry.scenarioId);
  const card = h("div", { class: "jab-card" });
  card.append(
    h("p", { class: "kicker" }, "They say"),
    h("p", { class: "micro-label" }, entry.setting),
    lineDual(`\u201c${entry.jab}\u201d`, scenario?.jab_l2, settings.showL2, "jab-text"),
  );
  screen.append(
    card,
    h("p", { class: "body" }, "Say your line from memory, then reveal it below."),
    regMark(entry.register),
  );
  const area = h("div", { class: "stack" });
  screen.append(area);

  const revealBtn = h("button", { class: "btn btn--secondary" }, t("arsenal.reveal"));
  area.append(revealBtn);
  revealBtn.addEventListener("click", () => {
    revealBtn.remove();
    area.append(lineDual(`\u201c${entry.line}\u201d`, l2For(ctx, entry), settings.showL2, "line-hero", true));
    area.append(h("p", { class: "body" }, "Did you say it clean, from memory? Mark it honestly — this is your reflex."));
    const row = h("div", { class: "row" });
    const clean = h("button", { class: "btn btn--secondary" }, t("arsenal.clean"));
    const shaky = h("button", { class: "btn btn--quiet" }, t("arsenal.shaky"));
    let marking = false;
    const done = async (wasClean: boolean) => {
      if (marking) return;
      marking = true;
      clean.disabled = true;
      shaky.disabled = true;
      await recordRecall(entry.key, wasClean);
      row.remove();
      area.append(
        h("p", { class: "body" }, wasClean ? "Clean recall. That's the rep." : "Logged. It'll come back sooner."),
        backButton(ctx),
      );
    };
    clean.addEventListener("click", () => void done(true));
    shaky.addEventListener("click", () => void done(false));
    row.append(clean, shaky);
    area.append(row);
  });

  const remove = h("button", { class: "btn btn--quiet" }, t("arsenal.remove"));
  remove.addEventListener("click", async () => {
    await removeLine(entry.scenarioId);
    ctx.navigate("#/arsenal");
  });
  screen.append(remove);
  root.append(screen);
}

function backButton(ctx: AppCtx): HTMLElement {
  const back = h("button", { class: "btn btn--primary" }, t("arsenal.back"));
  back.addEventListener("click", () => ctx.navigate("#/arsenal"));
  return back;
}
