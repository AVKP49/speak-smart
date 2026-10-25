/** Shared app context: navigation + drill session handoff between views. */
import type { DeliveryResult } from "./lib/delivery";
import type { Library } from "./content/loader";
import type { Reply, Scenario } from "./types";

export interface DrillRequest {
  scenarioId: string;
  origin: string;
}

export interface DrillResult {
  scenario: Scenario;
  mode: "pick" | "say-it";
  pickedReply?: Reply;
  pickedTrap: boolean;
  transcript?: string;
  delivery?: DeliveryResult;
  timedOut: boolean;
  speechUnavailable: boolean;
  origin: string;
  scored: boolean;
}

export interface AppCtx {
  library: Library;
  navigate: (hash: string) => void;
  startDrill: (scenarioId: string, origin: string) => void;
  finishDrill: (result: DrillResult) => void;
  pendingDrill: DrillRequest | null;
  lastResult: DrillResult | null;
}

export function categoryTitle(library: Library, categoryId: string): string {
  void library;
  const titles: Record<string, string> = {
    work: "Work",
    money: "Money & Buying",
    dating: "Dating",
    friends: "Friends",
    family: "Family",
    neighbors: "Neighbors",
    public: "Strangers & Public",
    social: "Social & Small Talk",
    texting: "Texting & Online",
    "hard-moments": "Hard Moments",
  };
  return titles[categoryId] ?? categoryId;
}

export function packTitle(library: Library, category: string, subcategory: string): string {
  const pack = library.packs.find((p) => p.pack.category === category && p.pack.subcategory === subcategory);
  return pack?.pack.title ?? subcategory;
}
