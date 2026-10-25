/**
 * UI strings + language framework. The library's second language arrives as
 * *_l2 fields on content (see types.ts); chrome strings live here so the whole
 * app flips with one table. English ships first; add the second table and the
 * app follows.
 */

export type Lang = "en";

let current: Lang = "en";

export function setLang(lang: Lang): void {
  current = lang;
}

export function lang(): Lang {
  return current;
}

const EN: Record<string, string> = {
  "brand.tagline": "Never freeze again.",
  "tab.today": "Today",
  "tab.library": "Library",
  "tab.arsenal": "Arsenal",
  "today.kicker": "Tonight's card",
  "today.start": "Start the drill",
  "today.bonus": "Drill anyway",
  "today.more": "More",
  "today.goal.done": "Today's goal is done. Arsenal reviews still count.",
  "drill.beat": "Hold it.",
  "drill.pickHint": "Pick your line",
  "reveal.kicker": "Your line",
  "reveal.yours": "What you picked",
  "reveal.why": "Why it works",
  "reveal.others": "The other voices",
  "reveal.trap": "The trap — satisfying, but costly",
  "reveal.save": "Save to Arsenal",
  "reveal.saved": "Saved to your Arsenal.",
  "reveal.next": "Next",
  "reveal.flag": "This line missed",
  "reveal.flagged": "Noted. Flags like yours prune the library.",
  "reveal.finish": "Finish",
  "arsenal.empty": "Your Arsenal is empty. Drill, and save the lines you want as reflex — they'll wait for you here.",
  "arsenal.drillNow": "Drill now",
  "arsenal.due": "Due for review",
  "arsenal.reveal": "Reveal the line",
  "arsenal.clean": "Clean",
  "arsenal.shaky": "Shaky",
  "arsenal.back": "Back to Arsenal",
  "arsenal.remove": "Remove from Arsenal",
  "settings.voice": "Your voice",
  "settings.goal": "Daily goal",
  "settings.beat": "Beat duration",
  "settings.motion": "Reduce motion",
  "settings.data": "Data",
  "settings.export": "Export Arsenal",
  "settings.reset": "Reset everything",
  "settings.about": "About",
  "settings.language": "Second language",
  "common.back": "‹ Back",
  "common.continue": "Continue",
};

const TABLES: Record<Lang, Record<string, string>> = { en: EN };

export function t(key: keyof typeof EN | string): string {
  return TABLES[current]?.[key] ?? TABLES.en[key] ?? String(key);
}
