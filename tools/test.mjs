#!/usr/bin/env node
/**
 * `npm test` — bundles tools/test-entry.ts with esbuild (a devDependency) and
 * runs it in node. No test framework; the entry asserts and exits non-zero.
 */
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const esbuild = join(root, "node_modules", ".bin", "esbuild");
const out = join(tmpdir(), `speak-smart-test-${Date.now()}.mjs`);

execFileSync(
  esbuild,
  [
    join(root, "tools", "test-entry.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${out}`,
    "--log-level=error",
  ],
  { stdio: "inherit" },
);
await import(pathToFileURL(out).href);
