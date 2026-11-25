// The structure guards (FMN-V12-STRUCTURE): manifest (ARCHITECTURE.md ↔ disk), boundaries
// (kernel imports no module; OS tools only in platform/; the core only through ipc.ts) and size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const core = join(root, 'src-tauri/src');
const web = join(root, 'src');
const map = readFileSync(join(root, 'ARCHITECTURE.md'), 'utf8');
const MAX_LINES = 400;

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, ext) : ext.test(name) ? [path] : [];
  });
}
const dirs = (dir: string) => readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory());

test('manifest: every module folder on disk is in ARCHITECTURE.md', () => {
  for (const d of dirs(core)) assert.ok(map.includes(`\`${d}/\``), `src-tauri/src/${d}/ is not in ARCHITECTURE.md`);
  for (const d of dirs(web)) assert.ok(map.includes(`\`${d}/\``), `src/${d}/ is not in ARCHITECTURE.md`);
});

test('boundaries: the kernel imports no module', () => {
  for (const f of files(join(core, 'kernel'), /\.rs$/)) {
    const bad = [...readFileSync(f, 'utf8').matchAll(/crate::(\w+)/g)].map((m) => m[1]).filter((m) => m !== 'kernel');
    assert.deepEqual(bad, [], `${relative(root, f)} reaches into ${bad.join(', ')}`);
  }
  for (const f of files(join(web, 'kernel'), /\.tsx?$/)) {
    assert.ok(!/from '\.\.\/(?!\.\.)(?!kernel)/.test(readFileSync(f, 'utf8')) || f.endsWith('.test.ts'), `${relative(root, f)} imports a feature`);
  }
});

test('boundaries: only platform/ names an OS tool', () => {
  for (const f of files(core, /\.rs$/).filter((f) => !f.includes('/platform/'))) {
    const text = readFileSync(f, 'utf8');
    for (const tool of ['/usr/bin/', '/usr/sbin/', 'osascript', 'scutil', 'launchctl']) assert.ok(!text.includes(tool), `${relative(root, f)} names ${tool}`);
  }
});

test('boundaries: only kernel/ipc.ts talks to the core', () => {
  for (const f of files(web, /\.tsx?$/).filter((f) => !f.endsWith('kernel/ipc.ts') && !f.endsWith('.test.ts'))) {
    assert.ok(!readFileSync(f, 'utf8').includes('@tauri-apps/api'), `${relative(root, f)} imports @tauri-apps/api directly`);
  }
});

test('boundaries: the character is used only through its entry', () => {
  for (const f of files(web, /\.tsx?$/).filter((f) => !f.includes('/character/'))) {
    assert.ok(!/from '[^']*character\/(?!index|contract)[^']+'/.test(readFileSync(f, 'utf8')), `${relative(root, f)} reaches into character internals`);
  }
});

test(`size: no source file over ${MAX_LINES} lines`, () => {
  for (const f of [...files(core, /\.rs$/), ...files(web, /\.(ts|tsx|css)$/), ...files(join(root, 'native'), /\.swift$/)]) {
    const lines = readFileSync(f, 'utf8').split('\n').length;
    assert.ok(lines <= MAX_LINES, `${relative(root, f)} has ${lines} lines`);
  }
});

test('the bundle declares the microphone entitlement (FIX-0002)', () => {
  const conf = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  const file = conf.bundle?.macOS?.entitlements;
  assert.equal(file, 'Entitlements.plist');
  assert.match(readFileSync(join(root, 'src-tauri', file), 'utf8'), /com\.apple\.security\.device\.audio-input<\/key>\s*<true\/>/);
});

test('updates are signed: the updater has a public key and a release endpoint', () => {
  const conf = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  assert.ok(conf.plugins?.updater?.pubkey?.length > 40);
  assert.match(conf.plugins.updater.endpoints[0], /^https:\/\/github\.com\/.+\/latest\.json$/);
  assert.equal(conf.bundle.createUpdaterArtifacts, true);
});
