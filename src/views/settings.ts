/**
 * Settings — default register, daily goal, beat duration, voice, reduced motion,
 * data (export, reset), about. Nothing else (spec §3.3).
 */
import { CONFIG, REGISTER_ORDER, REGISTERS } from "../config";
import { t } from "../i18n";
import { contentHasL2 } from "../content/loader";
import type { AppCtx } from "../app";
import { h } from "../lib/utils";
import { regMark, appheader } from "../components/ui";
import { exportArsenal, getSettings, resetAllData, saveSettings } from "../store/state";

const APP_VERSION = "0.1.0";

export async function renderSettings(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const settings = await getSettings();
  const screen = h("div", { class: "screen" });
  screen.append(appheader("Settings", { onBack: () => ctx.navigate("#/") }));

  /* Default register */
  screen.append(h("p", { class: "kicker" }, t("settings.voice")));
  const voices = h("div", { class: "stack stack--tight", role: "radiogroup", "aria-label": "Default voice" });
  for (const register of REGISTER_ORDER) {
    const btn = h(
      "button",
      {
        class: `card-selectable${register === settings.defaultRegister ? " card-selectable--selected" : ""}`,
        role: "radio",
        "aria-checked": register === settings.defaultRegister ? "true" : "false",
      },
    );
    btn.append(regMark(register), h("p", { class: "small muted" }, REGISTERS[register].tagline));
    btn.addEventListener("click", async () => {
      await saveSettings({ defaultRegister: register });
      await renderSettingsInto(root, ctx);
    });
    voices.append(btn);
  }
  screen.append(voices);

  /* Daily goal */
  screen.append(goalRow(t("settings.goal"), [...CONFIG.DAILY_GOAL_OPTIONS], settings.dailyGoal, async (v) => {
    await saveSettings({ dailyGoal: v });
  }));

  /* Beat duration */
  const beatOptions = [800, 1200, 1600];
  const beatLabels = new Map([[800, "0.8s"], [1200, "1.2s"], [1600, "1.6s"]]);
  screen.append(settingRow(t("settings.beat"), seg(beatOptions, settings.beatMs, beatLabels, async (v) => {
    await saveSettings({ beatMs: v });
  })));

  /* Second language */
  if (contentHasL2(ctx.library)) {
    screen.append(settingRow(t("settings.language"), switchBtn(settings.showL2, async (v) => {
      await saveSettings({ showL2: v });
    }), "Every line, in two languages."));
  } else {
    screen.append(settingRow(t("settings.language"), h("span", { class: "small faint" }, "Not in this library yet.")));
  }

  /* Reduced motion */
  screen.append(settingRow(t("settings.motion"), switchBtn(settings.reducedMotion, async (v) => {
    await saveSettings({ reducedMotion: v });
    applyMotionClass(v);
  })));

  /* Data */
  screen.append(h("p", { class: "kicker" }, t("settings.data")));
  const exportBtn = h("button", { class: "btn btn--secondary" }, t("settings.export"));
  exportBtn.addEventListener("click", async () => {
    const json = await exportArsenal();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: "speak-smart-my-lines.json" });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  const reset = h("button", { class: "btn btn--quiet" }, t("settings.reset"));
  reset.addEventListener("click", async () => {
    if (window.confirm("Reset everything? Your streak, Arsenal, and settings will be cleared.")) {
      await resetAllData();
      window.location.hash = "#/onboarding";
      window.location.reload();
    }
  });
  screen.append(exportBtn, reset);

  /* About — serious surface. */
  screen.append(h("p", { class: "kicker" }, t("settings.about")));
  const about = h("div", { class: "stack stack--tight" });
  const approved = ctx.library.scenarios.length;
  about.append(
    h("p", { class: "small muted" }, `Speak Smart ${APP_VERSION} · Library v${ctx.library.manifest.version} · ${approved} approved lines.`),
    h("p", { class: "small muted" }, "Private by design: no account, no analytics on content, no audio off your device. Everything lives in this browser."),
    h("p", { class: "small muted" }, "For everyday friction only — not for abuse or emergencies. If you're in crisis, contact local emergency services or a crisis helpline."),
  );
  const guide = h("button", { class: "btn btn--quiet" }, "Design system");
  guide.addEventListener("click", () => ctx.navigate("#/styleguide"));
  about.append(guide);
  screen.append(about);

  root.append(screen);
}

async function renderSettingsInto(root: HTMLElement, ctx: AppCtx): Promise<void> {
  root.replaceChildren();
  await renderSettings(root, ctx);
}

function settingRow(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const row = h("div", { class: "setting-row" });
  const text = h("div", { class: "stack stack--tight", style: "flex: 1" });
  text.append(h("span", { class: "body" }, label));
  if (hint) text.append(h("span", { class: "small faint" }, hint));
  row.append(text, control);
  return row;
}

function goalRow(
  label: string,
  options: number[],
  current: number,
  onPick: (v: number) => Promise<void>,
): HTMLElement {
  return settingRow(label, seg(options, current, new Map(options.map((o) => [o, String(o)])), onPick));
}

function seg(
  options: number[],
  current: number,
  labels: Map<number, string>,
  onPick: (v: number) => Promise<void>,
): HTMLElement {
  const wrap = h("div", { class: "seg", role: "group" });
  for (const option of options) {
    const btn = h("button", { "aria-pressed": option === current ? "true" : "false" }, labels.get(option) ?? String(option));
    btn.addEventListener("click", () => void onPick(option).then(() => {
      for (const child of wrap.children) {
        if (child instanceof HTMLButtonElement) {
          child.setAttribute("aria-pressed", child.textContent === (labels.get(option) ?? String(option)) ? "true" : "false");
        }
      }
    }));
    wrap.append(btn);
  }
  return wrap;
}

function switchBtn(current: boolean, onToggle: (v: boolean) => Promise<void>): HTMLElement {
  const btn = h("button", {
    class: "switch",
    role: "switch",
    "aria-checked": current ? "true" : "false",
    "aria-label": "Toggle",
  });
  btn.addEventListener("click", () => {
    const next = btn.getAttribute("aria-checked") !== "true";
    btn.setAttribute("aria-checked", next ? "true" : "false");
    void onToggle(next);
  });
  return btn;
}

export function applyMotionClass(reduced: boolean): void {
  document.body.classList.toggle("reduce-motion", reduced);
}
