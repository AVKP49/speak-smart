import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const listeners = new Map();
const stored = new Map();
const deleted = [];
const scope = 'https://example.com/speak-smart/';
const key = r => typeof r === 'string' ? r : r.url;
let online = true, fetches = 0;
const context = {
  URL, Response, Promise,
  self: { registration: { scope }, clients: { claim: async () => {} }, skipWaiting: async () => {}, addEventListener: (name, fn) => listeners.set(name, fn) },
  caches: {
    keys: async () => ['speak-smart-v1', 'speak-smart-v2', 'another-app-v1'],
    delete: async name => { deleted.push(name); return true; },
    match: async request => stored.get(key(request))?.clone(),
    open: async () => ({ addAll: async () => {}, put: async (request, response) => { stored.set(key(request), response.clone()); } }),
  },
  fetch: async () => { fetches++; if (!online) throw new Error('offline'); return new Response('fresh'); },
};
vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
let work;
listeners.get('activate')({ waitUntil: promise => { work = promise; } }); await work;
assert.deepEqual(deleted, ['speak-smart-v1']);
async function request(path, mode = 'cors') {
  let response; const pending = [];
  listeners.get('fetch')({ request: { method: 'GET', mode, url: new URL(path, scope).href }, respondWith: p => { response = p; }, waitUntil: p => pending.push(p) });
  if (!response) return undefined;
  const result = await response; await Promise.all(pending); return result;
}
stored.set(`${scope}content/manifest.json`, new Response('stale'));
assert.equal(await (await request('content/manifest.json')).text(), 'fresh');
online = false;
assert.equal(await (await request('content/manifest.json')).text(), 'fresh');
stored.set(`${scope}assets/hashed.js`, new Response('asset'));
const before = fetches; assert.equal(await (await request('assets/hashed.js')).text(), 'asset'); assert.equal(fetches, before);
online = true; await request('./', 'navigate'); online = false;
assert.equal(await (await request('some-route', 'navigate')).text(), 'fresh');
assert.equal(await request('../another-app/file.js'), undefined);
assert.equal(await request('https://other.example/file.js'), undefined);
console.log('SERVICE WORKER CHECKS PASSED: mutable updates, offline fallback, hashed assets, current shell, project isolation');
