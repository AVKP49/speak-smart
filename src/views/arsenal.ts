/**
 * Arsenal — the user's trophy case and retention engine (spec §3.3, §6.2).
 * Saved lines grouped by register with mastery + due status; tap to rehearse
 * one line in isolation (30-second recall: jab shown, line from memory).
 */
import { REGISTER_ORDER, REGISTERS } from "../config";
import type { AppCtx } from "../app";
import { scoreDelivery } from "../lib/delivery";
import { listenOnce, speechRecognitionSupported } from "../lib/speech";
import { h } from "../lib/utils";
import { notice, regMark, tabbar, topbar } from "../components/ui";
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
  void settings;
  const screen = h("div", { class: "screen" });
  screen.append(topbar("Arsenal"));

  if (entries.length === 0) {
    screen.append(
      notice("Your Arsenal is empty. Drill, and save the lines you want as reflex — they'll wait for you here."),
    );
    const go = h("button", { class: "btn btn--primary" }, "Drill now");
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
    screen.append(h("p", { class: "micro-label" }, `Due for review (${due.length})`));
    for (const entry of due) screen.append(arsenalRow(ctx, entry, true));
  }
  for (const register of REGISTER_ORDER) {
    const group = entries.filter((e) => e.register === register && !dueKeys.has(e.key));
    if (group.length === 0) continue;
    screen.append(h("p", { class: "micro-label" }, `${REGISTERS[register].glyph} ${REGISTERS[register].name}`));
    for (const entry of group) screen.append(arsenalRow(ctx, entry, false));
  }

  root.append(screen);
  root.append(tabbar("arsenal", (tab) => ctx.navigate(tab === "today" ? "#/" : `#/${tab}`)));
}

function arsenalRow(ctx: AppCtx, entry: ArsenalEntry, isDue: boolean): HTMLElement {
  const row = h("button", { class: "row-tap" });
  const text = h("div", { class: "stack stack--tight", style: "flex: 1" });
  text.append(regMark(entry.register), h("span", { class: "body" }, `\u201c${entry.line}\u201d`));
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

/* ---------------- 30-second recall ---------------- */

export async function renderRecall(root: HTMLElement, ctx: AppCtx, key: string): Promise<void> {
  const entries = await getArsenal();
  const entry = entries.find((e) => e.key === key);
  const screen = h("div", { class: "screen" });
  screen.append(topbar("Recall", { onBack: () => ctx.navigate("#/arsenal") }));
  if (!entry) {
    screen.append(notice("That line isn't in your Arsenal anymore."));
    root.append(screen);
    return;
  }
  const settings = await getSettings();
  const voiceReady = settings.voiceOn && speechRecognitionSupported();

  const card = h("div", { class: "jab-card" });
  card.append(
    h("p", { class: "micro-label" }, entry.setting),
    h("p", { class: "jab-text" }, `\u201c${entry.jab}\u201d`),
  );
  screen.append(
    card,
    h("p", { class: "body" }, "Say your line from memory. Thirty seconds, delivery only."),
    regMark(entry.register),
  );
  const area = h("div", { class: "stack" });
  screen.append(area);

  if (voiceReady) {
    const record = h("button", { class: "record-target", "aria-label": "Say your line" }, "●");
    const status = h("div", { class: "transcript", role: "status" }, "Tap the mic, then say it.");
    area.append(status, record);
    record.addEventListener("click", async () => {
      record.setAttribute("disabled", "true");
      record.classList.add("record-target--live");
      status.replaceChildren(document.createTextNode("Listening…"));
      const startedAt = performance.now();
      const heard = await listenOnce(30000);
      record.classList.remove("record-target--live");
      record.remove();
      if (!heard) {
        status.replaceChildren(document.createTextNode("Nothing heard — no rep logged. Try again tomorrow."));
        area.append(backButton(ctx));
        return;
      }
      const pauseMs = Math.max(0, Math.round(heard.firstWordMs ?? 0));
      const speakingMs = Math.max(500, Math.round(heard.endMs - (heard.firstWordMs ?? 0)));
      void startedAt;
      const delivery = scoreDelivery(entry.register, { transcript: heard.transcript, pauseMs, speakingMs });
      await recordRecall(entry.key, delivery.perfect);
      status.replaceChildren(document.createTextNode(`Heard ${delivery.words} words.`));
      area.append(
        h("p", { class: "line-hero", style: "font-size: var(--text-24)" }, `\u201c${entry.line}\u201d`),
        delivery.perfect
          ? h("p", { class: "body" }, "Clean recall. That's the rep.")
          : h(
              "div",
              { class: "stack stack--tight" },
              ...delivery.observations.map((obs) => h("p", { class: "body" }, obs)),
            ),
      );
      area.append(backButton(ctx));
    });
  } else {
    const revealBtn = h("button", { class: "btn btn--secondary" }, "Reveal the line");
    area.append(
      notice("Voice is unavailable, so this rep runs on the honor system."),
      revealBtn,
    );
    revealBtn.addEventListener("click", () => {
      revealBtn.remove();
      area.append(h("p", { class: "line-hero", style: "font-size: var(--text-24)" }, `\u201c${entry.line}\u201d`));
      area.append(h("p", { class: "body" }, "Did you say it clean, from memory? Mark it honestly — this is your reflex."));
      const row = h("div", { class: "row" });
      const clean = h("button", { class: "btn btn--secondary" }, "Clean");
      const shaky = h("button", { class: "btn btn--quiet" }, "Shaky");
      const done = async (wasClean: boolean) => {
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
  }

  const remove = h("button", { class: "btn btn--quiet" }, "Remove from Arsenal");
  remove.addEventListener("click", async () => {
    await removeLine(entry.scenarioId, entry.register);
    ctx.navigate("#/arsenal");
  });
  screen.append(remove);
  root.append(screen);
}

function backButton(ctx: AppCtx): HTMLElement {
  const back = h("button", { class: "btn btn--primary" }, "Back to Arsenal");
  back.addEventListener("click", () => ctx.navigate("#/arsenal"));
  return back;
}
