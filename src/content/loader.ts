/**
 * Content as data (spec §5.3, §9.1). Packs are versioned JSON, lazy-loaded per
 * category and mirrored into IndexedDB. The app never blocks a drill on a fetch:
 * cached packs serve instantly; updates apply in the background.
 */
import { CONFIG } from "../config";
import type { ContentManifest, ContentManifestEntry, PackFile, Scenario } from "../types";
import { kvGet, kvSet, recordGet, recordPut } from "../store/db";

interface CachedPack {
  id: string;
  version: string;
  fetchedAt: number;
  data: PackFile;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`content fetch failed: ${url} (${res.status})`);
  return (await res.json()) as T;
}

function manifestUrl(): string {
  return new URL(CONFIG.CONTENT_MANIFEST_URL, document.baseURI).toString();
}

function packUrl(file: string): string {
  return new URL(`./content/${file}`, document.baseURI).toString();
}

export async function loadManifest(): Promise<ContentManifest> {
  try {
    const manifest = await fetchJson<ContentManifest>(manifestUrl());
    await kvSet("content-manifest", manifest);
    return manifest;
  } catch {
    const cached = await kvGet<ContentManifest>("content-manifest");
    if (cached) return cached;
    throw new Error("content-unavailable");
  }
}

export async function loadPack(entry: ContentManifestEntry): Promise<PackFile> {
  const cached = await recordGet<CachedPack>("packs", entry.id);
  if (cached && cached.version === entry.version) return cached.data;
  try {
    const data = await fetchJson<PackFile>(packUrl(entry.file));
    const row: CachedPack = { id: entry.id, version: entry.version, fetchedAt: Date.now(), data };
    await recordPut("packs", row as unknown as Record<string, unknown>);
    return data;
  } catch {
    if (cached) return cached.data;
    throw new Error(`pack-unavailable: ${entry.id}`);
  }
}

export interface Library {
  manifest: ContentManifest;
  packs: PackFile[];
  scenarios: Scenario[];
  byId: Map<string, Scenario>;
  bySubcategory: Map<string, Scenario[]>;
}

/** Loads every pack in the manifest. Packs lazy-load per category in Library view. */
export async function loadLibrary(): Promise<Library> {
  const manifest = await loadManifest();
  const packs = await Promise.all(manifest.packs.map((entry) => loadPack(entry)));
  return indexLibrary(manifest, packs);
}

export function indexLibrary(manifest: ContentManifest, packs: PackFile[]): Library {
  const scenarios = packs.flatMap((p) =>
    p.scenarios.filter((s) => s.review.status === "approved"),
  );
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const bySubcategory = new Map<string, Scenario[]>();
  for (const s of scenarios) {
    const key = `${s.category}/${s.subcategory}`;
    const list = bySubcategory.get(key) ?? [];
    list.push(s);
    bySubcategory.set(key, list);
  }
  return { manifest, packs, scenarios, byId, bySubcategory };
}

/**
 * Today's drill: the least-seen scenario wins (random among ties), so the deck
 * feels fresh and every pack eventually surfaces. Pure function of library + history.
 */
export function pickNextScenario(library: Library, seen: Record<string, number>): Scenario | undefined {
  if (library.scenarios.length === 0) return undefined;
  let best: Scenario[] = [];
  let bestSeen = Number.POSITIVE_INFINITY;
  for (const s of library.scenarios) {
    const n = seen[s.id] ?? 0;
    if (n < bestSeen) {
      bestSeen = n;
      best = [s];
    } else if (n === bestSeen) {
      best.push(s);
    }
  }
  const pick = best[Math.floor(Math.random() * best.length)];
  return pick;
}
