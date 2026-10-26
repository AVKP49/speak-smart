import { CONFIG } from "../config";
import { sessionIds } from "../content/loader";
import type { AppCtx } from "../app";
import { h } from "../lib/utils";
import { tabbar, appheader, catIcon, rankbar } from "../components/ui";
import { CATEGORIES } from "../types";
import { dueReviews, getDaily, getSettings, getStreak, seenCounts } from "../store/state";

export async function renderToday(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const [settings, streak, daily, due, seen] = await Promise.all([getSettings(), getStreak(), getDaily(), dueReviews(), seenCounts()]);
  const ids = sessionIds(ctx.library.scenarios, seen, settings.dailyGoal);
  const screen = h("div", { class: "screen home-screen" });
  screen.append(appheader("Your next calm moment.", { onAvatar: () => ctx.navigate("#/settings") }));
  const hero = h("div", { class: "daily-hero" });
  hero.append(h("div", { class: "row row--spread" }, h("span", { class: "eyebrow" }, "The daily practice"), h("span", { class: "hero-label" }, `${ids.length} drills`)),
    h("h2", { class: "hero-title" }, "Less overthinking.", h("em", {}, "More ready.")),
    h("p", { class: "body" }, "A tricky moment. A useful response. A chance to make it stick."));
  const skills = h("div", { class: "hero-skills" });
  for (const id of ids.slice(0, CONFIG.SESSION_SIZE)) {
    const s = ctx.library.byId.get(id)!; skills.append(h("span", {}, s.goal ?? s.subcategory));
  }
  const start = h("button", { class: "btn btn--hero" }, daily.drills >= settings.dailyGoal ? "Try another session →" : "Start my session →");
  start.addEventListener("click", () => ctx.startSession(ids, "#/"));
  start.disabled = !ids.length;
  hero.append(skills, start); screen.append(hero);
  const progress = h("div", { class: "practice-progress" });
  const practiced = ctx.library.scenarios.filter((s) => (seen[s.id] ?? 0) > 0).length;
  progress.append(h("div", { class: "row row--spread" }, h("span", { class: "body" }, daily.drills >= settings.dailyGoal ? "Today's practice: complete ✓" : `${daily.drills} of ${settings.dailyGoal} drills today`),
    h("span", { class: "small muted" }, streak.count ? `${streak.count} day streak` : "Your first day starts here")),
    rankbar(daily.drills / settings.dailyGoal, "Daily practice progress"), h("p", { class: "small muted" }, `${practiced} of ${ctx.library.scenarios.length} situations practiced`));
  screen.append(progress);
  if (due[0]) {
    const row = h("button", { class: "review-card" }, h("span", { class: "eyebrow" }, "Bring it back"), h("strong", {}, `${due.length} kept ${due.length === 1 ? "line is" : "lines are"} ready for recall`), h("span", {}, "Revisit My Lines →"));
    row.addEventListener("click", () => ctx.navigate("#/arsenal")); screen.append(row);
  }
  screen.append(h("div", { class: "section-heading" }, h("h2", {}, "What trips you up?"), h("p", { class: "small muted" }, "Practice a situation that matters to you.")));
  const grid = h("div", { class: "category-grid" });
  for (const category of CATEGORIES) {
    const count = ctx.library.scenarios.filter((s) => s.category === category.id).length;
    if (!count) continue;
    const card = h("button", { class: `category-card category-${category.id}` }, catIcon(category.id), h("strong", {}, category.title), h("span", { class: "small" }, `${count} situations →`));
    card.addEventListener("click", () => ctx.navigate(`#/library/${category.id}`)); grid.append(card);
  }
  screen.append(grid, h("p", { class: "small faint centered" }, "Practice the idea. Keep the words that feel like you."));
  root.append(screen, tabbar("today", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
}
