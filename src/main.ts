/** Boot, router, and app shell. PWA entry point. */
import "./tokens.css";
import "./app.css";
import { loadLibrary, type Library } from "./content/loader";
import { getSettings, saveSettings } from "./store/state";
import { kvGet } from "./store/db";
import { h } from "./lib/utils";
import type { AppCtx, DrillRequest, DrillResult, PracticeSession } from "./app";
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
  const splash = h("div", { class: "splash" });
  splash.append(
    h("span", { class: "splash-mark", "aria-hidden": "true" }, "◆"),
    h("p", { class: "splash-word" }, "Speak Smart"),
    h("p", { class: "small muted" }, message),
    h("div", { class: "splash-bar", "aria-hidden": "true" }, h("div")),
  );
  screen.append(splash);
  root!.append(screen);
}

function setTitle(route: string): void {
  const titles: Record<string, string> = {
    "#/": "Today",
    "#/onboarding": "Welcome",
    "#/library": "Library",
    "#/drill": "Drill",
    "#/reveal": "Your line",
    "#/arsenal": "My Lines",
    "#/settings": "Settings",
    "#/styleguide": "Design system",
  };
  const base = route.startsWith("#/library/") ? "#/library" : route.startsWith("#/arsenal/") ? "#/arsenal" : route;
  document.title = `Speak Smart — ${titles[base] ?? "Never freeze again"}`;
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

  const mutable: { pendingDrill: DrillRequest | null; lastResult: DrillResult | null; session: PracticeSession | null } = {
    pendingDrill: null,
    lastResult: null,
    session: null,
  };
  const ctx: AppCtx = {
    library,
    navigate: (hash: string) => {
      if (window.location.hash === hash) void route();
      else window.location.hash = hash;
    },
    startDrill: (scenarioId: string, origin: string) => {
      mutable.session = null;
      mutable.pendingDrill = { scenarioId, origin };
      ctx.navigate("#/drill");
    },
    startSession: (ids, origin) => {
      const valid = [...new Set(ids)].filter((id) => library.byId.has(id));
      if (!valid[0]) return;
      mutable.session = { ids: valid, index: 0, completed: 0, recalled: 0, origin };
      mutable.pendingDrill = { scenarioId: valid[0], origin };
      mutable.lastResult = null;
      ctx.navigate("#/drill");
    },
    continueSession: () => {
      const session = mutable.session;
      if (!session) { ctx.navigate("#/"); return; }
      session.index += 1;
      const id = session.ids[session.index];
      if (id) {
        mutable.pendingDrill = { scenarioId: id, origin: session.origin };
        mutable.lastResult = null;
        ctx.navigate("#/drill");
      } else ctx.navigate("#/");
    },
    get session() { return mutable.session; },
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

  let routeGeneration = 0;
  async function route(): Promise<void> {
    const generation = ++routeGeneration;
    const mount = document.createElement("div");
    cleanup?.();
    cleanup = null;
    root!.replaceChildren();
    window.scrollTo(0, 0);
    const hash = window.location.hash || "#/";
    setTitle(hash);
    const settings = await getSettings();
    // A previous async route must not paint over a newer navigation.
    if (generation !== routeGeneration || (window.location.hash || "#/") !== hash) return;
    const onboarded = settings.onboarded;

    const finish = (next: (() => void) | void) => {
      if (generation !== routeGeneration) {
        if (typeof next === "function") next();
        return;
      }
      // Keep the mount connected: Settings callbacks re-render into this node.
      mount.style.display = "contents";
      root!.replaceChildren(mount);
      root!.querySelector<HTMLElement>("h1[tabindex]")?.focus({ preventScroll: true });
      if (typeof next === "function") cleanup = next;
    };

    if (hash === "#/onboarding" || (!onboarded && hash !== "#/drill" && hash !== "#/reveal")) {
      if (!onboarded && hash !== "#/onboarding") {
        window.location.hash = "#/onboarding";
        return;
      }
      if (hash === "#/onboarding" || !onboarded) {
        finish(await renderOnboarding(mount, ctx));
        return;
      }
    }
    if (hash === "#/" || hash === "") {
      finish(await renderToday(mount, ctx));
      return;
    }
    if (hash === "#/library" || hash.startsWith("#/library/")) {
      const [, , cat, sub] = hash.split("/");
      finish(await renderLibrary(mount, ctx, cat || undefined, sub || undefined));
      return;
    }
    if (hash === "#/drill") {
      if (!mutable.pendingDrill) {
        ctx.navigate("#/");
        return;
      }
      finish(await renderDrill(mount, ctx, mutable.pendingDrill));
      return;
    }
    if (hash === "#/reveal") {
      if (!mutable.lastResult) {
        ctx.navigate("#/");
        return;
      }
      finish(await renderReveal(mount, ctx, mutable.lastResult));
      return;
    }
    if (hash === "#/arsenal") {
      finish(await renderArsenal(mount, ctx));
      return;
    }
    if (hash.startsWith("#/arsenal/recall/")) {
      const key = decodeURIComponent(hash.slice("#/arsenal/recall/".length));
      finish(await renderRecall(mount, ctx, key));
      return;
    }
    if (hash === "#/settings") {
      finish(await renderSettings(mount, ctx));
      return;
    }
    if (hash === "#/styleguide") {
      finish(await renderStyleguide(mount, ctx));
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
