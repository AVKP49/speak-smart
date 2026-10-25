/** Shared components — every screen is built from these + tokens (§1, §2). */
import { REGISTERS, type Register } from "../config";
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

export function whyRow(reply: Reply): HTMLElement {
  const wrap = h("div", { class: "why-row" });
  wrap.append(
    h("p", { class: "micro-label" }, "Why it works"),
    h("p", { class: "body" }, reply.why),
  );
  if (reply.delivery) wrap.append(h("p", { class: "small muted" }, reply.delivery));
  return wrap;
}

export function voiceRow(reply: Reply, opts: { current?: boolean } = {}): HTMLElement {
  const row = h("div", { class: "voice-row" });
  const head = h("div", { class: "row row--spread" });
  head.append(regMark(reply.register));
  if (reply.caution) head.append(h("span", { class: "caution" }, `Use with care · ${reply.caution}`));
  else if (opts.current) head.append(h("span", { class: "chip" }, "Your voice"));
  row.append(head, h("p", { class: "body" }, reply.line));
  return row;
}

export function trapCallout(trap: Trap): HTMLElement {
  const box = h("div", { class: "trap-callout" });
  box.append(
    h("p", { class: "micro-label" }, "The trap — satisfying, but costly"),
    h("p", { class: "body" }, `\u201c${trap.line}\u201d`),
    h("p", { class: "small muted" }, trap.why),
  );
  return box;
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
    { id: "today", label: "Today", icon: Icons.today },
    { id: "library", label: "Library", icon: Icons.library },
    { id: "arsenal", label: "Arsenal", icon: Icons.arsenal },
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
