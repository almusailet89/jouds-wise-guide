import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const script = await readFile(new URL('../public/clear-private-cache.js', import.meta.url), 'utf8');

test('worker upgrade deletes the private API cache and preserves public asset caches', async () => {
  const stored = new Map([
    ['supabase-api', { private: 'previous account' }],
    ['fonts', { public: 'font' }],
    ['external-apis', { public: 'weather' }],
  ]);
  let activate;
  vm.runInNewContext(script, {
    self: { addEventListener: (event, callback) => {
      assert.equal(event, 'activate');
      activate = callback;
    } },
    caches: { delete: async (name) => stored.delete(name) },
  });
  let completion;
  activate({ waitUntil: (promise) => { completion = promise; } });
  await completion;
  assert.equal(stored.has('supabase-api'), false);
  assert.deepEqual([...stored.keys()], ['fonts', 'external-apis']);
  // Fresh installs and repeated activations must also succeed.
  activate({ waitUntil: (promise) => { completion = promise; } });
  await completion;
});

test('generated worker uses network-only Supabase requests and includes the upgrade hook', async () => {
  const worker = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /clear-private-cache\.js/);
  assert.match(worker, /supabase/);
  assert.match(worker, /NetworkOnly\(/);
  assert.match(worker, /no-store/);
  assert.doesNotMatch(worker, /cacheName:["']supabase-api/);
  const deployedScript = await readFile(new URL('../dist/clear-private-cache.js', import.meta.url), 'utf8');
  assert.equal(deployedScript, script);
});
