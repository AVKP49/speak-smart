import { CONFIG } from "../config";
import { getSettings, saveSettings, seenCounts } from "../store/state";
import { sessionIds } from "../content/loader";
import { h } from "../lib/utils";
import { brandMini } from "../components/ui";
import type { AppCtx } from "../app";

export async function renderOnboarding(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const screen = h("div", { class: "screen welcome" });
  const demo = ctx.library.byId.get("work.interrupters.0001") ?? ctx.library.scenarios[0];
  screen.append(brandMini(), h("span", { class: "eyebrow" }, "A little practice. A calmer you."),
    h("h1", { class: "welcome-title" }, "Find your", h("em", {}, "words.")),
    h("p", { class: "body muted" }, "Practice what to say when you're put on the spot. And how to say it."));
  if (demo) {
    const card = h("div", { class: "conversation-preview" });
    card.append(h("span", { class: "eyebrow" }, "Sound familiar?"), h("p", { class: "jab-text" }, `“${demo.jab}”`),
      h("div", { class: "preview-reply" }, "You don't have to freeze. You can practice."));
    screen.append(card);
  }
  screen.append(h("div", { class: "learning-path" },
    h("span", {}, "01 Think"), h("span", {}, "02 Learn"), h("span", {}, "03 Recall")));
  const start = h("button", { class: "btn btn--primary" }, "Try your first session →");
  start.addEventListener("click", async () => {
    start.disabled = true;
    const settings = await getSettings();
    await saveSettings({ onboarded: true });
    const ids = sessionIds(ctx.library.scenarios, await seenCounts(), Math.min(settings.dailyGoal, CONFIG.SESSION_SIZE));
    if (demo && !ids.includes(demo.id)) ids[0] = demo.id;
    ctx.startSession(ids, "#/");
  });
  screen.append(start, h("p", { class: "small faint centered" }, `${ctx.library.scenarios.length} situations · No account needed · Your progress stays here`));
  root.append(screen);
}
