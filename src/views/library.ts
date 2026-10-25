/**
 * Library — categories → subcategories → packs (spec §3.3, §5.1).
 * The taxonomy is locked; unseeded packs are honest future drops, not dead ends.
 */
import { REGISTERS, REGISTER_ORDER } from "../config";
import { CATEGORIES } from "../types";
import { categoryTitle, packTitle, type AppCtx } from "../app";
import { h } from "../lib/utils";
import { catIcon, lineDual, notice, progressRing, regMark, tabbar, appheader } from "../components/ui";
import { t } from "../i18n";
import { getArsenal, getSettings, seenCounts } from "../store/state";

function distinctSeen(ids: string[], seen: Record<string, number>): number {
  return ids.filter((id) => (seen[id] ?? 0) > 0).length;
}

export async function renderLibrary(root: HTMLElement, ctx: AppCtx, cat?: string, sub?: string): Promise<void> {
  if (cat && sub) {
    await renderPack(root, ctx, cat, sub);
    return;
  }
  if (cat) {
    await renderSubcategories(root, ctx, cat);
    return;
  }
  await renderCategories(root, ctx);
}

async function renderCategories(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const seen = await seenCounts();
  const screen = h("div", { class: "screen" });
  screen.append(appheader(t("tab.library")));
  const list = h("div", { class: "card", style: "padding: var(--space-8) var(--space-16)" });
  for (const category of CATEGORIES) {
    const ids = ctx.library.scenarios.filter((s) => s.category === category.id).map((s) => s.id);
    const packsLive = ctx.library.packs.filter((p) => p.pack.category === category.id).length;
    const fraction = ids.length === 0 ? 0 : distinctSeen(ids, seen) / ids.length;
    const row = h("button", { class: "row-tap" });
    const text = h("div", { class: "stack stack--tight", style: "flex: 1" });
    text.append(
      h("span", { class: "body" }, category.title),
      h(
        "span",
        { class: "small faint metric" },
        `${packsLive} of ${category.subcategories.length} packs live · ${distinctSeen(ids, seen)}/${ids.length} lines seen`,
      ),
    );
    row.append(catIcon(category.id), text, progressRing(fraction, 40, `${category.title} progress`));
    row.addEventListener("click", () => ctx.navigate(`#/library/${category.id}`));
    list.append(row);
  }
  screen.append(list);
  root.append(screen);
  root.append(tabbar("library", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
}

async function renderSubcategories(root: HTMLElement, ctx: AppCtx, cat: string): Promise<void> {
  const category = CATEGORIES.find((c) => c.id === cat);
  const seen = await seenCounts();
  const screen = h("div", { class: "screen" });
  screen.append(appheader(category?.title ?? cat, { onBack: () => ctx.navigate("#/library") }));
  if (!category) {
    screen.append(notice("That shelf doesn't exist. The library has ten categories — start there."));
    root.append(screen);
    root.append(tabbar("library", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
    return;
  }
  const list = h("div", { class: "card", style: "padding: var(--space-8) var(--space-16)" });
  for (const subcat of category.subcategories) {
    const scenarios = ctx.library.bySubcategory.get(`${cat}/${subcat.slug}`) ?? [];
    const row = h("button", { class: "row-tap" });
    if (scenarios.length === 0) {
      row.setAttribute("disabled", "true");
      row.append(
        progressRing(0, 40, `${subcat.title}, coming in a future drop`),
        h("span", { class: "muted" }, `${subcat.title} — in a future drop`),
      );
    } else {
      const fraction = distinctSeen(scenarios.map((s) => s.id), seen) / scenarios.length;
      const text = h("div", { class: "stack stack--tight", style: "flex: 1" });
      text.append(
        h("span", { class: "body" }, subcat.title),
        h("span", { class: "small faint metric" }, `${scenarios.length} lines · ${distinctSeen(scenarios.map((s) => s.id), seen)} seen`),
      );
      row.append(progressRing(fraction, 40, `${subcat.title} progress`), text);
      row.addEventListener("click", () => ctx.navigate(`#/library/${cat}/${subcat.slug}`));
    }
    list.append(row);
  }
  screen.append(list);
  root.append(screen);
  root.append(tabbar("library", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
}

async function renderPack(root: HTMLElement, ctx: AppCtx, cat: string, sub: string): Promise<void> {
  const scenarios = ctx.library.bySubcategory.get(`${cat}/${sub}`) ?? [];
  const [seen, arsenal, settings] = await Promise.all([seenCounts(), getArsenal(), getSettings()]);
  const savedHere = arsenal.filter((e) => scenarios.some((s) => s.id === e.scenarioId)).length;
  const title = packTitle(ctx.library, cat, sub);
  const screen = h("div", { class: "screen" });
  screen.append(appheader(title, { onBack: () => ctx.navigate(`#/library/${cat}`) }));
  if (scenarios.length === 0) {
    screen.append(notice("This pack drops in a future week. The library grows weekly — check back."));
    root.append(screen);
    root.append(tabbar("library", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
    return;
  }
  const registers = REGISTER_ORDER.filter((r) => scenarios.some((s) => s.replies.some((x) => x.register === r)));
  const info = h("div", { class: "card" });
  info.append(
    h("p", { class: "micro-label" }, `${categoryTitle(ctx.library, cat)} · Pack`),
    h("p", { class: "small muted metric" }, `${scenarios.length} lines · your arsenal holds ${savedHere} from this pack`),
    h("div", { class: "row", style: "flex-wrap: wrap" }, ...registers.map((r) => regMark(r))),
  );
  void REGISTERS;
  screen.append(info);

  const nextUnseen = scenarios.find((s) => (seen[s.id] ?? 0) === 0) ?? scenarios[0];
  if (nextUnseen) {
    const start = h("button", { class: "btn btn--primary" }, "Start pack");
    start.addEventListener("click", () => ctx.startDrill(nextUnseen.id, `#/library/${cat}/${sub}`));
    screen.append(start);
  }
  const list = h("div", { class: "stack stack--tight" });
  list.append(h("p", { class: "micro-label" }, "Lines in this pack"));
  for (const s of scenarios) {
    const row = h("button", { class: "row-tap" });
    const done = (seen[s.id] ?? 0) > 0;
    const jab = lineDual(`\u201c${s.jab}\u201d`, s.jab_l2, settings.showL2, done ? "small faint" : "body");
    jab.setAttribute("style", "flex: 1");
    row.append(jab, h("span", { class: "small faint metric" }, `Lv ${s.difficulty}`));
    row.addEventListener("click", () => ctx.startDrill(s.id, `#/library/${cat}/${sub}`));
    list.append(row);
  }
  screen.append(list);
  root.append(screen);
  root.append(tabbar("library", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
}
