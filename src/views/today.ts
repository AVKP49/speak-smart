/**
 * Today (home) — a narrative, not a dashboard (spec §1 Lesson 6, §3.3).
 * Status strip, hero card with one CTA, next milestone, depth below the fold.
 */
import { REGISTERS } from "../config";
import { pickNextScenario } from "../content/loader";
import { categoryTitle, packTitle, type AppCtx } from "../app";
import { h } from "../lib/utils";
import { tabbar, appheader, statusStrip, progressRing } from "../components/ui";
import {
  dueReviews,
  getArsenal,
  getDaily,
  getSettings,
  getStreak,
  rankForReflexCount,
  seenCounts,
} from "../store/state";
import { kvGet, kvSet } from "../store/db";

export async function renderToday(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const [settings, streak, daily, arsenal, due, seen] = await Promise.all([
    getSettings(),
    getStreak(),
    getDaily(),
    getArsenal(),
    dueReviews(),
    seenCounts(),
  ]);
  const next = pickNextScenario(ctx.library, seen) ?? ctx.library.scenarios[0];
  const reflexCount = arsenal.filter((e) => e.level === "Reflex").length;
  const rank = rankForReflexCount(reflexCount);
  const lastPack = await kvGet<{ category: string; subcategory: string }>("last-pack");

  const screen = h("div", { class: "screen" });
  screen.append(
    appheader("Today", { onAvatar: () => ctx.navigate("#/settings") }),
    statusStrip({ streak, daily, goal: settings.dailyGoal, arsenalCount: arsenal.length }),
  );

  /* Hero card — today's drill. One narrative card, one CTA. */
  const goalMet = daily.drills >= settings.dailyGoal;
  if (next) {
    const hero = h("div", { class: "hero-card" });
    hero.append(
      h("p", { class: "micro-label" }, goalMet ? "Goal met — bonus drill" : "Today's drill"),
      h("h2", { class: "display", style: "font-size: var(--text-24)" }, packTitle(ctx.library, next.category, next.subcategory)),
      h(
        "p",
        { class: "small muted" },
        `${categoryTitle(ctx.library, next.category)} · Your voice: ${REGISTERS[settings.defaultRegister].glyph} ${REGISTERS[settings.defaultRegister].name} · Least-seen pack, so the lines stay fresh.`,
      ),
    );
    const start = h("button", { class: "btn btn--primary" }, goalMet ? "Drill anyway" : "Start");
    start.addEventListener("click", () => {
      void kvSet("last-pack", { category: next.category, subcategory: next.subcategory });
      ctx.startDrill(next.id, "#/");
    });
    hero.append(start);
    screen.append(hero);
  }

  /* Every number tells you what to do next (§1.2.6). */
  const milestone = h("div", { class: "next-milestone" });
  const drillsLeft = Math.max(0, settings.dailyGoal - daily.drills);
  const rankLine =
    rank.next !== null
      ? `${rank.toNext} lines to ${rank.next}. You are ${rank.current}.`
      : `You are ${rank.current}. The highest rank.`;
  milestone.append(
    h("p", { class: "body" }, rankLine),
    h("p", { class: "small muted metric" }, drillsLeft > 0 ? `${drillsLeft} drill${drillsLeft === 1 ? "" : "s"} to today's goal.` : "Today's goal is done. Arsenal reviews still count."),
  );
  screen.append(milestone);

  /* Below the fold — depth hides until wanted. */
  const more = h("div", { class: "stack stack--tight" });
  more.append(h("p", { class: "micro-label" }, "More"));
  if (lastPack) {
    const title = packTitle(ctx.library, lastPack.category, lastPack.subcategory);
    const row = h("button", { class: "row-tap" });
    row.append(progressRing(0.5, 36, `Continue ${title}`), h("span", {}, `Continue ${title}`));
    row.addEventListener("click", () => ctx.navigate(`#/library/${lastPack.category}/${lastPack.subcategory}`));
    more.append(row);
  }
  if (due.length > 0) {
    const row = h("button", { class: "row-tap" });
    row.append(
      progressRing(1, 36, `${due.length} reviews due`),
      h("span", {}, `${due.length} line${due.length === 1 ? "" : "s"} due for review`),
    );
    row.addEventListener("click", () => ctx.navigate("#/arsenal"));
    more.append(row);
  }
  const freshRow = h("button", { class: "row-tap" });
  freshRow.append(progressRing(0, 36, "Browse the library"), h("span", {}, "Fresh lines from the library"));
  freshRow.addEventListener("click", () => ctx.navigate("#/library"));
  more.append(freshRow);
  screen.append(more);

  root.append(screen);
  root.append(tabbar("today", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
}
