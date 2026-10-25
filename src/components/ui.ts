/** Shared components — every screen is built from these + tokens (§1, §2). */
import { REGISTERS, type Register } from "../config";
import { t } from "../i18n";
import type { Reply, Trap } from "../types";
import type { Streak, Daily } from "../store/state";
import { h } from "../lib/utils";

/* ---------- Icons (inline stroke SVGs, Lucide-style 1.5px — spec §2.6) ---------- */

function icon(paths: string, label: string): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("role", "img");
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = label;
  svg.append(title);
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.innerHTML = paths;
  svg.append(g);
  return svg as unknown as SVGElement;
}

export const Icons = {
  today: () =>
    icon(
      `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
      "Today",
    ),
  library: () =>
    icon(
      `<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>`,
      "Library",
    ),
  arsenal: () =>
    icon(
      `<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/>`,
      "Arsenal",
    ),
  user: () => icon(`<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>`, "Profile"),
  back: () => icon(`<path d="M15 18l-6-6 6-6"/>`, "Back"),
  shield: () => icon(`<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>`, "Streak freeze"),
};

/* ---------- Register mark: glyph + name, never color alone (§2.1) ---------- */

export function regMark(register: Register): HTMLElement {
  const meta = REGISTERS[register];
  const wrap = h("span", { class: `reg-mark reg-${register}` });
  const glyph = h("span", { class: "glyph", "aria-hidden": "true" }, meta.glyph);
  wrap.append(glyph, document.createTextNode(meta.name));
  return wrap;
}

/* ---------- Status strip (Today) ---------- */

export function statusStrip(input: {
  streak: Streak;
  daily: Daily;
  goal: number;
  arsenalCount: number;
}): HTMLElement {
  const { streak, daily, goal, arsenalCount } = input;
  const strip = h("div", { class: "status-strip", role: "status" });
  const streakPill = h(
    "span",
    { class: `status-pill metric${streak.count > 0 ? " status-pill--gold" : ""}` },
    `Day ${streak.count}`,
  );
  if (streak.freezesLeft > 0) {
    const shield = h("span", { class: "status-pill", title: "Streak freeze in place" }, "◈ Freeze ready");
    shield.setAttribute("aria-label", "Streak freeze shield in place");
    strip.append(streakPill, shield);
  } else {
    strip.append(streakPill);
  }
  strip.append(
    h("span", { class: "status-pill metric" }, `${Math.min(daily.drills, goal)}/${goal} drills`),
    h("span", { class: "status-pill metric" }, `${arsenalCount} lines`),
  );
  return strip;
}

/* ---------- Progress ring (goal-gradient, everywhere) ---------- */

export function progressRing(fraction: number, size = 40, label?: string): SVGSVGElement {
  const clamped = Math.max(0, Math.min(1, fraction));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("class", "ring");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label ?? `${Math.round(clamped * 100)} percent complete`);
  const r = 16;
  const c = 2 * Math.PI * r;
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("cx", "20");
  bg.setAttribute("cy", "20");
  bg.setAttribute("r", String(r));
  bg.setAttribute("fill", "none");
  bg.setAttribute("stroke", "var(--line)");
  bg.setAttribute("stroke-width", "4");
  const fg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  fg.setAttribute("cx", "20");
  fg.setAttribute("cy", "20");
  fg.setAttribute("r", String(r));
  fg.setAttribute("fill", "none");
  fg.setAttribute("stroke", "var(--gold)");
  fg.setAttribute("stroke-width", "4");
  fg.setAttribute("stroke-linecap", "round");
  fg.setAttribute("stroke-dasharray", `${(clamped * c).toFixed(1)} ${c.toFixed(1)}`);
  fg.setAttribute("transform", "rotate(-90 20 20)");
  svg.append(bg, fg);
  return svg;
}

/* ---------- Reveal pieces (§4.4) ---------- */

/** Dual-language line: English first, second language as subtitle when on + present. */
export function lineDual(en: string, l2: string | undefined, showL2: boolean, cls = "body", hero = false): HTMLElement {
  const wrap = h("div", { class: "stack stack--tight" });
  wrap.append(h("p", { class: cls }, en));
  if (showL2 && l2) wrap.append(h("p", { class: hero ? "duel duel--hero" : "duel" }, l2));
  return wrap;
}

export function whyRow(reply: Reply, showL2 = true): HTMLElement {
  const wrap = h("div", { class: "why-row" });
  wrap.append(
    h("p", { class: "micro-label" }, t("reveal.why")),
    h("p", { class: "body" }, reply.why),
  );
  if (showL2 && reply.why_l2) wrap.append(h("p", { class: "duel" }, reply.why_l2));
  if (reply.delivery) wrap.append(h("p", { class: "small muted" }, reply.delivery));
  return wrap;
}

export function voiceRow(reply: Reply, opts: { current?: boolean; showL2?: boolean } = {}): HTMLElement {
  const row = h("div", { class: "voice-row" });
  const head = h("div", { class: "row row--spread" });
  head.append(regMark(reply.register));
  if (reply.caution) head.append(h("span", { class: "caution" }, `Use with care · ${reply.caution}`));
  else if (opts.current) head.append(h("span", { class: "chip" }, "Your voice"));
  row.append(head, lineDual(reply.line, reply.line_l2, opts.showL2 ?? true));
  return row;
}

export function trapCallout(trap: Trap, showL2 = true): HTMLElement {
  const box = h("div", { class: "trap-callout" });
  box.append(
    h("p", { class: "micro-label" }, t("reveal.trap")),
    lineDual(`\u201c${trap.line}\u201d`, trap.line_l2 ? `\u201c${trap.line_l2}\u201d` : undefined, showL2),
    h("p", { class: "small muted" }, trap.why),
  );
  if (showL2 && trap.why_l2) box.append(h("p", { class: "duel" }, trap.why_l2));
  return box;
}

/** Mastery pips: Pocketed 1 · Practiced 2 · Reflex 3. */
export function pips(level: "Pocketed" | "Practiced" | "Reflex"): HTMLElement {
  const filled = level === "Reflex" ? 3 : level === "Practiced" ? 2 : 1;
  const wrap = h("span", { class: "pips", "aria-label": `${level}, ${filled} of 3` });
  for (let i = 0; i < 3; i++) {
    wrap.append(h("span", { class: i < filled ? "on" : "off", "aria-hidden": "true" }, "●"));
  }
  return wrap;
}

const CATEGORY_PATHS: Record<string, string> = {
  work: `<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
  money: `<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>`,
  dating: `<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>`,
  friends: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.7a3.5 3.5 0 0 1 0 6.6M17.5 14.7c2.2.7 4 2.3 4 5.3"/>`,
  family: `<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>`,
  neighbors: `<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>`,
  public: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>`,
  social: `<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5z"/>`,
  texting: `<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>`,
  "hard-moments": `<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>`,
};

/** Category icon in a gold disc. */
export function catIcon(category: string): HTMLElement {
  const disc = h("span", { class: "cat-disc", "aria-hidden": "true" });
  disc.append(icon(CATEGORY_PATHS[category] ?? CATEGORY_PATHS["public"] ?? "", category));
  return disc;
}

/** Goal-gradient progress bar. */
export function rankbar(fraction: number, label: string): HTMLElement {
  const bar = h("div", { class: "rankbar", role: "img", "aria-label": label });
  const clamped = Math.max(0, Math.min(1, fraction));
  const fill = h("div");
  fill.setAttribute("style", `width: ${Math.round(clamped * 100)}%`);
  bar.append(fill);
  return bar;
}

export function cautionBadge(caution: string): HTMLElement {
  return h("span", { class: "caution" }, `Use with care · ${caution}`);
}

export function notice(text: string): HTMLElement {
  return h("div", { class: "notice" }, text);
}

/* ---------- Navigation chrome ---------- */

export type TabId = "today" | "library" | "arsenal";

export function tabbar(active: TabId, onNav: (tab: TabId) => void): HTMLElement {
  const bar = h("nav", { class: "tabbar", "aria-label": "Primary" });
  const tabs: { id: TabId; label: string; icon: () => SVGElement }[] = [
    { id: "today", label: t("tab.today"), icon: Icons.today },
    { id: "library", label: t("tab.library"), icon: Icons.library },
    { id: "arsenal", label: t("tab.arsenal"), icon: Icons.arsenal },
  ];
  for (const t of tabs) {
    const btn = h(
      "button",
      {
        class: `tab${t.id === active ? " tab--active" : ""}`,
        "aria-current": t.id === active ? "page" : null,
      },
    );
    const iconWrap = h("span", { class: "tab-icon" });
    iconWrap.append(t.icon());
    btn.append(iconWrap, document.createTextNode(t.label));
    btn.addEventListener("click", () => onNav(t.id));
    bar.append(btn);
  }
  return bar;
}

/** App header: brand banner + big screen title. The app name is always visible. */
export function appheader(title: string, opts: { onBack?: () => void; onAvatar?: () => void } = {}): HTMLElement {
  const wrap = h("div", { class: "stack stack--tight" });
  const bar = h("div", { class: "brandbar" });
  const left = h("div", { class: "row" });
  if (opts.onBack) {
    const back = h("button", { class: "back-link", "aria-label": "Back" }, "‹ Back");
    back.addEventListener("click", opts.onBack);
    left.append(back);
  }
  const word = h("span", { class: "brand-word" });
  const diamond = h("span", { class: "brand-diamond", "aria-hidden": "true" }, "◆");
  word.append(diamond, document.createTextNode("Speak Smart"));
  left.append(word);
  bar.append(left);
  if (opts.onAvatar) {
    const avatar = h("button", { class: "avatar-btn", "aria-label": "Profile and settings" });
    avatar.append(Icons.user());
    avatar.addEventListener("click", opts.onAvatar);
    bar.append(avatar);
  }
  wrap.append(bar, h("h1", { class: "display screen-title" }, title));
  return wrap;
}

/** Slim centered brand mark for focused screens (drill, reveal). */
export function brandMini(): HTMLElement {
  const wrap = h("div", { class: "brandbar-mini" });
  const word = h("span", { class: "brand-word brand-word--small" });
  const diamond = h("span", { class: "brand-diamond", "aria-hidden": "true" }, "◆");
  word.append(diamond, document.createTextNode("Speak Smart"));
  wrap.append(word);
  return wrap;
}

export function topbar(title: string, opts: { onBack?: () => void; onAvatar?: () => void } = {}): HTMLElement {
  const bar = h("div", { class: "topbar" });
  const left = h("div", { class: "row" });
  if (opts.onBack) {
    const back = h("button", { class: "back-link", "aria-label": "Back" }, "‹ Back");
    back.addEventListener("click", opts.onBack);
    left.append(back);
  }
  left.append(h("h1", { class: "display", style: "font-size: var(--text-24)" }, title));
  bar.append(left);
  if (opts.onAvatar) {
    const avatar = h("button", { class: "avatar-btn", "aria-label": "Profile and settings" });
    avatar.append(Icons.user());
    avatar.addEventListener("click", opts.onAvatar);
    bar.append(avatar);
  }
  return bar;
}
