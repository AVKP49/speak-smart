/** Boot, router, and app shell. PWA entry point. */
import "./tokens.css";
import "./app.css";
import { loadLibrary, type Library } from "./content/loader";
import { getSettings, saveSettings } from "./store/state";
import { kvGet } from "./store/db";
import { h } from "./lib/utils";
import type { AppCtx, DrillRequest, DrillResult } from "./app";
import { renderOnboarding } from "./views/onboarding";
import { renderToday } from "./views/today";
import { renderLibrary } from "./views/library";
import { renderDrill } from "./views/drill";
import { renderReveal } from "./views/reveal";
import { renderArsenal, renderRecall } from "./views/arsenal";
import { applyMotionClass, renderSettings } from "./views/settings";
import { renderStyleguide } from "./views/styleguide";

const root = document.getElementById("app");
if (!root) throw new Error("missing #app");

let cleanup: (() => void) | null = null;

function showLoading(message: string): void {
  cleanup?.();
  cleanup = null;
  root!.replaceChildren();
  const screen = h("div", { class: "screen screen--center" });
  screen.append(h("p", { class: "micro-label" }, "Speak Smart"), h("p", { class: "body muted" }, message));
  root!.append(screen);
}

async function boot(): Promise<void> {
  showLoading("Loading the library…");

  /* Honor the OS reduced-motion setting on first run (§2.4). */
  const hadSettings = await kvGet("settings");
  if (!hadSettings && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    await saveSettings({ reducedMotion: true });
  }
  applyMotionClass((await getSettings()).reducedMotion);

  let library: Library;
  try {
    library = await loadLibrary();
  } catch (err) {
    showLoading("");
    const screen = root!.querySelector(".screen");
    const reason = err instanceof Error ? err.message : String(err);
    screen?.replaceChildren(
      h("p", { class: "micro-label" }, "Speak Smart"),
      h("h1", { class: "display", style: "font-size: var(--text-32)" }, "The library didn't load."),
      h("p", { class: "body muted" }, "Connect once to fetch the packs — after that, everything works offline."),
      h("p", { class: "small faint" }, `Details: ${reason}`),
    );
    const retry = h("button", { class: "btn btn--primary" }, "Try again");
    retry.addEventListener("click", () => void boot());
    screen?.append(retry);
    return;
  }

  const mutable: { pendingDrill: DrillRequest | null; lastResult: DrillResult | null } = {
    pendingDrill: null,
    lastResult: null,
  };
  const ctx: AppCtx = {
    library,
    navigate: (hash: string) => {
      if (window.location.hash === hash) void route();
      else window.location.hash = hash;
    },
    startDrill: (scenarioId: string, origin: string) => {
      mutable.pendingDrill = { scenarioId, origin };
      ctx.navigate("#/drill");
    },
    finishDrill: (result: DrillResult) => {
      mutable.lastResult = result;
      ctx.navigate("#/reveal");
    },
    get pendingDrill() {
      return mutable.pendingDrill;
    },
    get lastResult() {
      return mutable.lastResult;
    },
  };

  async function route(): Promise<void> {
    cleanup?.();
    cleanup = null;
    root!.replaceChildren();
    window.scrollTo(0, 0);
    const hash = window.location.hash || "#/";
    const settings = await getSettings();
    const onboarded = settings.onboarded;

    const finish = (next: (() => void) | void) => {
      if (typeof next === "function") cleanup = next;
    };

    if (hash === "#/onboarding" || (!onboarded && hash !== "#/drill" && hash !== "#/reveal")) {
      if (!onboarded && hash !== "#/onboarding") {
        window.location.hash = "#/onboarding";
        return;
      }
      if (hash === "#/onboarding" || !onboarded) {
        finish(await renderOnboarding(root!, ctx));
        return;
      }
    }
    if (hash === "#/" || hash === "") {
      finish(await renderToday(root!, ctx));
      return;
    }
    if (hash === "#/library" || hash.startsWith("#/library/")) {
      const [, , cat, sub] = hash.split("/");
      finish(await renderLibrary(root!, ctx, cat || undefined, sub || undefined));
      return;
    }
    if (hash === "#/drill") {
      if (!mutable.pendingDrill) {
        ctx.navigate("#/");
        return;
      }
      finish(await renderDrill(root!, ctx, mutable.pendingDrill));
      return;
    }
    if (hash === "#/reveal") {
      if (!mutable.lastResult) {
        ctx.navigate("#/");
        return;
      }
      finish(await renderReveal(root!, ctx, mutable.lastResult));
      return;
    }
    if (hash === "#/arsenal") {
      finish(await renderArsenal(root!, ctx));
      return;
    }
    if (hash.startsWith("#/arsenal/recall/")) {
      const key = decodeURIComponent(hash.slice("#/arsenal/recall/".length));
      finish(await renderRecall(root!, ctx, key));
      return;
    }
    if (hash === "#/settings") {
      finish(await renderSettings(root!, ctx));
      return;
    }
    if (hash === "#/styleguide") {
      finish(await renderStyleguide(root!, ctx));
      return;
    }
    ctx.navigate("#/");
  }

  window.addEventListener("hashchange", () => void route());
  await route();
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline still works from cache on repeat visits; registration is best-effort */
    });
  });
}

void boot();
