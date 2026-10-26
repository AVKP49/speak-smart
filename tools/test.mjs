#!/usr/bin/env node
/**
 * `npm test` — bundles tools/test-entry.ts with esbuild (a devDependency) and
 * runs it in node. No test framework; the entry asserts and exits non-zero.
 */
import { JSDOM } from "jsdom";
import { unlinkSync } from "node:fs";
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
await import("./sw-test.mjs");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.com/speak-smart/", pretendToBeVisual: true });
for (const key of ["window", "document", "Node", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLTextAreaElement", "Event", "requestAnimationFrame"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.scrollTo = () => {};
const uiOut = join(tmpdir(), `speak-smart-ui-${Date.now()}.mjs`);
try {
  execFileSync(esbuild, [join(root, "tools", "ui-test-entry.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${uiOut}`, "--log-level=error"], { stdio: "inherit" });
  await import(pathToFileURL(uiOut).href);
  const routerOut = join(tmpdir(), `speak-smart-router-${Date.now()}.mjs`);
  try {
    execFileSync(esbuild, [join(root, "tools", "router-test-entry.ts"), "--bundle", "--platform=node", "--format=esm", "--loader:.css=empty", "--define:import.meta.env.PROD=false", `--outfile=${routerOut}`, "--log-level=error"], { stdio: "inherit" });
    await import(pathToFileURL(routerOut).href);
  } finally { unlinkSync(routerOut); }
} finally {
  dom.window.close(); unlinkSync(uiOut); unlinkSync(out);
}
