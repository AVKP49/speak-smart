#!/usr/bin/env node
/**
 * Batch ingestion for the content pipeline (spec §5.4, steps 2–3).
 * Reconciles public/content/packs/*.json with the manifest: adds new pack
 * entries, syncs versions + scenario counts, bumps the manifest patch version
 * on any change, then runs the validator gate. Usage: node tools/expand.mjs
 *
 * Flow for every batch: drop new scenarios into pack files (or add new pack
 * files) → run this → fix any validator errors. The manifest is generated,
 * never hand-edited.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "public", "content");
const packsDir = join(contentDir, "packs");
const manifestPath = join(contentDir, "manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const byId = new Map(manifest.packs.map((p) => [p.id, p]));
let changed = false;

const files = readdirSync(packsDir).filter((f) => f.endsWith(".json")).sort();
for (const file of files) {
  const pack = JSON.parse(readFileSync(join(packsDir, file), "utf8"));
  const meta = pack.pack;
  if (!meta || !meta.id || !meta.category || !meta.subcategory || !meta.version) {
    console.error(`ERROR ${file}: pack meta must have id/category/subcategory/version`);
    process.exit(1);
  }
  const count = Array.isArray(pack.scenarios) ? pack.scenarios.length : 0;
  const existing = byId.get(meta.id);
  if (!existing) {
    byId.set(meta.id, {
      id: meta.id,
      category: meta.category,
      subcategory: meta.subcategory,
      version: meta.version,
      file,
      count,
    });
    console.log(`new pack ${meta.id} (${count} scenarios)`);
    changed = true;
  } else {
    if (existing.file !== file) {
      console.error(`ERROR ${meta.id}: listed as ${existing.file}, found ${file}`);
      process.exit(1);
    }
    if (existing.version !== meta.version || existing.count !== count) {
      console.log(
        `sync ${meta.id}: v${existing.version} (${existing.count}) → v${meta.version} (${count})`,
      );
      existing.version = meta.version;
      existing.count = count;
      changed = true;
    }
  }
}

for (const [id, entry] of byId) {
  if (!files.includes(entry.file)) {
    console.error(`ERROR ${id}: manifest lists ${entry.file}, file missing`);
    process.exit(1);
  }
}

if (changed) {
  const parts = String(manifest.version).split(".").map(Number);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  manifest.version = parts.join(".");
  manifest.packs = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`manifest → v${manifest.version}`);
} else {
  console.log("manifest already in sync — no changes");
}

console.log("--- validator ---");
execFileSync("node", [join(root, "tools", "validate.mjs")], { stdio: "inherit" });
