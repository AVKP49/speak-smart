/**
 * The drill — the product (spec §4). SETUP → JAB → BEAT → RESPOND → REVEAL.
 * Serious surface: stark, focused, no decoration. This is the arena.
 *
 * Interpretation note (see README): in pick mode the trap is offered among the
 * shuffled options (unlabeled — the test is genuine) so §4.5 Read scoring can
 * observe it; it is labeled with its cost in the reveal.
 */
import { CONFIG, REGISTERS } from "../config";
import { categoryTitle, type AppCtx, type DrillRequest, type DrillResult } from "../app";
import { scoreDelivery } from "../lib/delivery";
import { listenOnce, speak, speechRecognitionSupported, stopSpeaking, ttsSupported } from "../lib/speech";
import { h, shuffle } from "../lib/utils";
import { notice, regMark } from "../components/ui";
import { getSettings, recordScenarioSeen, saveSettings } from "../store/state";
import type { Reply, Scenario } from "../types";

type Mode = "pick" | "say-it";

export async function renderDrill(
  root: HTMLElement,
  ctx: AppCtx,
  request: DrillRequest,
): Promise<(() => void) | void> {
  const found = ctx.library.byId.get(request.scenarioId);
  if (!found) {
    ctx.navigate(request.origin);
    return;
  }
  const scenario: Scenario = found;
  const settings = await getSettings();
  await recordScenarioSeen(scenario.id);

  const timers: number[] = [];
  let dead = false;
  const later = (fn: () => void, ms: number) => {
    timers.push(window.setTimeout(() => {
      if (!dead) fn();
    }, ms));
  };
  const cleanup = () => {
    dead = true;
    timers.forEach((t) => window.clearTimeout(t));
    stopSpeaking();
  };

  const voiceReady = settings.voiceOn && speechRecognitionSupported();
  let mode: Mode = settings.lastMode === "say-it" && voiceReady ? "say-it" : "pick";
  let beatEndAt = 0;
  let finished = false;

  const screen = h("div", { class: "screen" });
  const stage = h("div", { class: "drill-stage" });
  root.append(screen);
  screen.append(stage);

  const finish = (partial: Partial<DrillResult>) => {
    if (finished || dead) return;
    finished = true;
    stopSpeaking();
    ctx.finishDrill({
      scenario,
      mode,
      pickedTrap: false,
      timedOut: false,
      speechUnavailable: !voiceReady,
      origin: request.origin,
      scored: false,
      ...partial,
    });
  };

  /* ---------- SETUP (≤1.5s, auto-advance): setting line only ---------- */
  function renderSetup() {
    stage.replaceChildren();
    stage.append(
      h("p", { class: "micro-label" }, `${categoryTitle(ctx.library, scenario.category)} · ${REGISTERS[settings.defaultRegister].glyph} ${REGISTERS[settings.defaultRegister].name}`),
      h("p", { class: "jab-text" }, scenario.setting),
    );
    later(renderJab, 1200);
    const skip = h("button", { class: "btn btn--quiet" }, "Continue");
    skip.addEventListener("click", () => renderJab());
    stage.append(skip);
  }

  /* ---------- JAB + BEAT ---------- */
  function jabCard(): HTMLElement {
    const card = h("div", { class: "jab-card" });
    const ring = h("div", { class: "beat-ring", "aria-hidden": "true" });
    ring.setAttribute("style", `animation-duration: ${settings.beatMs}ms`);
    card.append(
      ring,
      h("p", { class: "micro-label" }, scenario.setting),
      h("p", { class: "jab-text" }, `\u201c${scenario.jab}\u201d`),
    );
    if (settings.voiceOn && ttsSupported()) {
      const replay = h("button", { class: "btn btn--quiet", "aria-label": "Hear the line" }, "Hear it");
      replay.addEventListener("click", () => speak(scenario.jab));
      card.append(replay);
    }
    return card;
  }

  function renderJab() {
    stage.replaceChildren();
    if (dead || finished) return;
    stage.append(
      h("p", { class: "micro-label" }, `${categoryTitle(ctx.library, scenario.category)} · ${REGISTERS[settings.defaultRegister].glyph} ${REGISTERS[settings.defaultRegister].name}`),
      jabCard(),
    );
    if (mode === "say-it" && settings.voiceOn && ttsSupported()) speak(scenario.jab);
    later(renderBeat, 900);
  }

  function renderBeat() {
    if (dead || finished) return;
    const card = stage.querySelector(".jab-card");
    const ring = stage.querySelector(".beat-ring");
    const label = h("p", { class: "micro-label", role: "status" }, "Take the beat.");
    if (card && ring) {
      card.append(label);
      requestAnimationFrame(() => ring.classList.add("beat-ring--breathing"));
    } else {
      stage.append(label);
    }
    later(() => {
      beatEndAt = performance.now();
      renderRespond();
    }, settings.beatMs);
  }

  /* ---------- RESPOND ---------- */
  function renderRespond() {
    if (dead || finished) return;
    stage.replaceChildren();
    stage.append(
      h("p", { class: "micro-label" }, `${categoryTitle(ctx.library, scenario.category)} · ${REGISTERS[settings.defaultRegister].glyph} ${REGISTERS[settings.defaultRegister].name}`),
      jabCardCompact(),
    );

    if (!voiceReady) {
      const reason = !settings.voiceOn
        ? "Voice is off in Settings — pick mode works fully."
        : "Speech recognition isn't available in this browser — pick mode works fully.";
      stage.append(notice(reason));
      renderPickOptions();
      return;
    }

    const switcher = h("div", { class: "mode-switch", role: "group", "aria-label": "Response mode" });
    const pickBtn = h("button", { "aria-pressed": mode === "pick" ? "true" : "false" }, "Pick the line");
    const sayBtn = h("button", { "aria-pressed": mode === "say-it" ? "true" : "false" }, "Say it out loud");
    pickBtn.addEventListener("click", () => setMode("pick"));
    sayBtn.addEventListener("click", () => setMode("say-it"));
    switcher.append(pickBtn, sayBtn);
    stage.append(switcher);

    const area = h("div", { class: "stack" });
    area.setAttribute("id", "respond-area");
    stage.append(area);
    if (mode === "pick") renderPickOptions(area);
    else renderSayIt(area);
  }

  function setMode(next: Mode) {
    mode = next;
    void saveSettings({ lastMode: next });
    renderRespond();
  }

  function jabCardCompact(): HTMLElement {
    const card = h("div", { class: "jab-card" });
    card.append(h("p", { class: "jab-text" }, `\u201c${scenario.jab}\u201d`));
    return card;
  }

  function renderPickOptions(area?: HTMLElement) {
    const host = area ?? stage;
    const options = buildPickOptions(scenario);
    const list = h("div", { class: "stack stack--tight", role: "group", "aria-label": "Choose your reply" });
    for (const option of options) {
      const card = h("button", { class: "card-selectable" });
      if (option.reply) card.append(regMark(option.reply.register));
      card.append(h("p", { class: "body" }, option.line));
      card.addEventListener("click", () => {
        const reply = option.reply;
        if (reply) finish({ mode: "pick", pickedReply: reply, pickedTrap: false });
        else finish({ mode: "pick", pickedTrap: true });
      });
      list.append(card);
    }
    host.append(list);
  }

  function renderSayIt(area: HTMLElement) {
    const windowMs = CONFIG.RESPONSE_WINDOW_S * 1000;
    const elapsed = performance.now() - beatEndAt;
    const expired = elapsed >= windowMs;

    const bar = h("div", { class: "response-window", "aria-hidden": "true" });
    const fill = h("div");
    bar.append(fill);
    area.append(bar);
    if (!expired) {
      const remaining = Math.max(0, windowMs - elapsed);
      requestAnimationFrame(() => {
        fill.style.transition = `transform ${remaining}ms linear`;
        fill.style.transform = "scaleX(0)";
      });
    } else {
      fill.style.transform = "scaleX(0)";
    }

    const transcriptBox = h("div", { class: "transcript", role: "status" }, "Tap the mic and say your reply.");
    const record = h(
      "button",
      { class: "record-target", "aria-label": "Record your reply" },
      "●",
    );
    area.append(transcriptBox, record);
    if (expired) {
      area.append(notice("Took a while. That's the moment we're training — the mic is still open."));
    }

    record.addEventListener("click", async () => {
      record.setAttribute("disabled", "true");
      record.classList.add("record-target--live");
      transcriptBox.replaceChildren(document.createTextNode("Listening…"));
      const tapAt = performance.now();
      const heard = await listenOnce(windowMs);
      if (dead || finished) return;
      record.classList.remove("record-target--live");
      record.removeAttribute("disabled");
      if (!heard) {
        transcriptBox.replaceChildren(document.createTextNode("Nothing heard. Try again, or continue to your line."));
        const cont = h("button", { class: "btn btn--secondary" }, "Continue to your line");
        cont.addEventListener("click", () =>
          finish({ mode: "say-it", transcript: "", timedOut: performance.now() - beatEndAt >= windowMs }),
        );
        area.append(cont);
        return;
      }
      const pauseMs = tapAt - beatEndAt + (heard.firstWordMs ?? 0);
      const speakingMs = Math.max(500, heard.endMs - (heard.firstWordMs ?? 0));
      const delivery = scoreDelivery(settings.defaultRegister, {
        transcript: heard.transcript,
        pauseMs: Math.max(0, Math.round(pauseMs)),
        speakingMs: Math.round(speakingMs),
      });
      transcriptBox.replaceChildren(document.createTextNode(`\u201c${heard.transcript}\u201d`));
      later(
        () =>
          finish({
            mode: "say-it",
            transcript: heard.transcript,
            delivery,
            timedOut: tapAt - beatEndAt >= windowMs,
          }),
        900,
      );
    });
  }

  renderSetup();
  return cleanup;
}

function buildPickOptions(scenario: Scenario): { line: string; reply: Reply | null }[] {
  const options: { line: string; reply: Reply | null }[] = scenario.replies.map((reply) => ({
    line: reply.line,
    reply,
  }));
  if (scenario.trap) options.push({ line: scenario.trap.line, reply: null });
  return shuffle(options);
}
