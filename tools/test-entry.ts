/**
 * Focused regression test: content URLs must resolve to the shipped paths.
 * Guards the Oct 2026 outage where packUrl() omitted the `packs/` segment and
 * every pack fetch 404'd, failing the whole library load. Run via `npm test`.
 */
import { manifestUrl, packUrl } from "../src/content/loader";
import manifestJson from "../public/content/manifest.json";

const BASE = "https://example.com/speak-smart/";
let failures = 0;

function assert(cond: unknown, msg: string, extra?: unknown): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL ${msg}`, extra ?? "");
  } else {
    console.log(`ok ${msg}`);
  }
}

const manifest = manifestJson as { version: string; packs: { id: string; file: string; count: number }[] };

assert(
  manifestUrl(BASE) === `${BASE}content/manifest.json`,
  "manifest URL resolves under content/",
  manifestUrl(BASE),
);

assert(manifest.packs.length > 0, "manifest lists packs");
for (const pack of manifest.packs) {
  const url = packUrl(pack.file, BASE);
  assert(url === `${BASE}content/packs/${pack.file}`, `pack URL for ${pack.id}`, url);
}

if (failures > 0) {
  console.error(`${failures} URL check(s) failed`);
  process.exit(1);
}
console.log(`URL CHECKS PASSED (${manifest.packs.length} packs)`);
