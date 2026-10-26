import { CONFIG } from "../config";
import { sessionIds } from "../content/loader";
import { CATEGORIES } from "../types";
import { categoryTitle, packTitle, type AppCtx } from "../app";
import { h } from "../lib/utils";
import { catIcon, tabbar, appheader } from "../components/ui";
import { seenCounts } from "../store/state";

export async function renderLibrary(root: HTMLElement, ctx: AppCtx, cat?: string, sub?: string): Promise<void> {
  const seen = await seenCounts();
  let selected = cat ?? "all";
  const screen = h("div", { class: "screen" });
  screen.append(appheader(sub && cat ? packTitle(ctx.library, cat, sub) : "Find your next moment.", { onBack: () => ctx.navigate("#/") }),
    h("p", { class: "body muted" }, "Search for what happens. Practice what comes next."));
  const label = h("label", { class: "sr-only", for: "scenario-search" }, "Search situations");
  const input = h("input", { id: "scenario-search", class: "search-input", type: "search", placeholder: "Try “interrupted”, “saying no”, “date”…", autocomplete: "off" });
  screen.append(label, input);
  const filters = h("div", { class: "filter-row", role: "group", "aria-label": "Situation categories" });
  const filterButtons = new Map<string, HTMLButtonElement>();
  for (const [id, title] of [["all", "All"], ...CATEGORIES.map((c) => [c.id, c.title])]) {
    const btn = h("button", { class: "filter-chip", "aria-pressed": selected === id ? "true" : "false" }, title);
    btn.addEventListener("click", () => { selected = id!; for (const [key, b] of filterButtons) b.setAttribute("aria-pressed", String(key === selected)); render(); });
    filters.append(btn); filterButtons.set(id!, btn);
  }
  screen.append(filters);
  const status = h("p", { class: "small muted", role: "status", "aria-live": "polite" });
  const start = h("button", { class: "btn btn--primary" }, "Practice this collection →");
  const list = h("div", { class: "scenario-list" });
  screen.append(status, start, list);
  let visible = ctx.library.scenarios;
  const normalized = (s: string) => s.toLowerCase().replace(/[-–—]/g, " ");
  function render() {
    const words = normalized(input.value.trim()).split(/\s+/).filter(Boolean);
    visible = ctx.library.scenarios.filter((s) => (selected === "all" || s.category === selected) && (!sub || !cat || selected !== cat || s.subcategory === sub) && words.every((w) => normalized([s.jab, s.setting, s.goal ?? "", s.category, s.subcategory, ...s.tags].join(" ")).includes(w)));
    status.textContent = `${visible.length} ${visible.length === 1 ? "situation" : "situations"}${selected !== "all" ? ` in ${categoryTitle(ctx.library, selected)}` : ""}`;
    start.disabled = !visible.length;
    start.textContent = `Practice ${Math.min(CONFIG.SESSION_SIZE, visible.length)} ${visible.length === 1 ? "drill" : "drills"} →`;
    list.replaceChildren();
    if (!visible.length) list.append(h("div", { class: "notice" }, "No matches yet. Try a shorter phrase or another category."));
    for (const s of visible) {
      const row = h("button", { class: "scenario-card" });
      const text = h("div", { class: "stack stack--tight" }, h("span", { class: "eyebrow" }, categoryTitle(ctx.library, s.category)),
        h("strong", {}, s.goal ?? s.subcategory), h("p", { class: "small muted" }, `“${s.jab}”`),
        h("span", { class: "small faint" }, (seen[s.id] ?? 0) > 0 ? "Practiced · Try again →" : "Think · Learn · Recall →"));
      row.append(catIcon(s.category), text); row.addEventListener("click", () => ctx.startDrill(s.id, "#/library")); list.append(row);
    }
  }
  input.addEventListener("input", render);
  start.addEventListener("click", () => ctx.startSession(sessionIds(visible, seen, CONFIG.SESSION_SIZE), "#/library"));
  render(); root.append(screen, tabbar("library", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
}
