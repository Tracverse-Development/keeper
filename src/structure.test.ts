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

test('no Keychain calls: keys live in the private store (FIX-0003)', () => {
  assert.ok(!readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8').includes('security-framework'));
  for (const f of files(core, /\.rs$/)) assert.ok(!readFileSync(f, 'utf8').includes('passwords::get_generic_password'), relative(root, f));
});

test('parts: the core and the character list the same parts, slots, effects and ranges', async () => {
  const { PARTS } = await import('./character/parts/catalog.ts');
  const rust = readFileSync(join(core, 'keepers/kit/parts.rs'), 'utf8');
  const rows = [...rust.matchAll(/Part \{ id: "([^"]+)", name: "[^"]+", slot: "([^"]+)", species: &\[([^\]]*)\], effects: &\[([^\]]*)\] \}/g)];
  const fromRust = Object.fromEntries(rows.map((m) => [m[1], { slot: m[2], effects: Object.fromEntries([...m[4].matchAll(/(num|color)\("([^"]+)"(?:, ([\d.]+), ([\d.]+))?\)/g)].map((e) => [e[2], e[1] === 'num' ? [Number(e[3]), Number(e[4])] : 'colour'])) }]));
  assert.deepEqual(Object.keys(fromRust).sort(), PARTS.map((p: { id: string }) => p.id).sort(), 'part ids differ');
  for (const p of PARTS as unknown as readonly { id: string; slot: string; effects: Record<string, { kind: string; min?: number; max?: number }> }[]) {
    assert.equal(fromRust[p.id].slot, p.slot, `${p.id} slot`);
    const ts = Object.fromEntries(Object.entries(p.effects).map(([k, e]) => [k, e.kind === 'number' ? [e.min, e.max] : 'colour']));
    assert.deepEqual(fromRust[p.id].effects, ts, `${p.id} effects`);
  }
});

test('slots: the core and the character list the same slots (in order, with their kind) and each species offers the same ones', async () => {
  const { SLOTS } = await import('./character/parts/slots.ts');
  const { SKINS } = await import('./character/skins/catalog.ts');
  const rustSlots = [...readFileSync(join(core, 'keepers/kit/slots.rs'), 'utf8').matchAll(/Slot \{ id: "([^"]+)", name: "[^"]+", kind: "([^"]+)" \}/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(rustSlots, SLOTS.map((s: { id: string; kind: string }) => [s.id, s.kind]), 'slots differ');
  const rustSpecies = Object.fromEntries([...readFileSync(join(core, 'keepers/kit/species.rs'), 'utf8').matchAll(/Species \{ id: "([^"]+)", name: "[^"]+", slots: &\[([^\]]*)\] \}/g)].map((m) => [m[1], [...m[2].matchAll(/"([^"]+)"/g)].map((s) => s[1]).sort()]));
  assert.deepEqual(Object.keys(rustSpecies).sort(), SKINS.map((s: { id: string }) => s.id).sort(), 'species differ');
  for (const skin of SKINS as unknown as readonly { id: string; slots: Record<string, unknown> }[]) assert.deepEqual(rustSpecies[skin.id], Object.keys(skin.slots).sort(), `${skin.id} slots`);
});

test('look: the core and the character list the same paint zones per species, and the same materials', async () => {
  const { LOOK_ZONES, MATERIALS } = await import('./character/look/zones.ts');
  const rust = readFileSync(join(core, 'keepers/kit/look.rs'), 'utf8');
  const zones = Object.fromEntries([...rust.matchAll(/\("([a-z]+)", &\[((?:zone\("[^"]+", "[^"]+"\),? ?)+)\]\)/g)].map((m) => [m[1], [...m[2].matchAll(/zone\("([^"]+)"/g)].map((z) => z[1])]));
  assert.deepEqual(zones, LOOK_ZONES, 'paint zones differ (ids and order, per species)');
  const block = rust.slice(rust.indexOf('pub const MATERIALS'), rust.indexOf('];', rust.indexOf('pub const MATERIALS')));
  assert.deepEqual([...block.matchAll(/\("([a-z]+)", "[^"]+"\)/g)].map((m) => m[1]), [...MATERIALS], 'materials differ');
});

test('habits: the core and the character list the same habits, owned by the same species', async () => {
  const { HABITS } = await import('./character/habits.ts');
  const rust = readFileSync(join(core, 'keepers/kit/look.rs'), 'utf8');
  const block = rust.slice(rust.indexOf('pub const HABITS'), rust.indexOf('];', rust.indexOf('pub const HABITS')));
  const fromRust = [...block.matchAll(/\("([a-z-]+)", "[^"]+", &\[([^\]]*)\]\)/g)].map((m) => [m[1], [...m[2].matchAll(/"([^"]+)"/g)].map((s) => s[1])]);
  assert.deepEqual(fromRust, HABITS.map((h: { id: string; only: readonly string[] }) => [h.id, [...h.only]]), 'habits differ');
});

test('parts: the core and the character agree on which species each part fits', async () => {
  const { PARTS } = await import('./character/parts/catalog.ts');
  const rust = readFileSync(join(core, 'keepers/kit/parts.rs'), 'utf8');
  const fromRust = Object.fromEntries([...rust.matchAll(/Part \{ id: "([^"]+)", name: "[^"]+", slot: "[^"]+", species: &\[([^\]]*)\]/g)].map((m) => [m[1], [...m[2].matchAll(/"([^"]+)"/g)].map((s) => s[1])]));
  for (const p of PARTS as unknown as readonly { id: string; species: 'any' | readonly string[] }[]) assert.deepEqual(fromRust[p.id], p.species === 'any' ? [] : [...p.species], `${p.id} species`);
  const rarity = readFileSync(join(core, 'keepers/kit/rarity.rs'), 'utf8');
  for (const id of ['paw-nails', 'dog-collar', 'think-classic', 'think-pulse', 'think-orbit', 'think-nebula', 'think-vortex', 'cheer-confetti', 'cheer-fireworks', 'cheer-starburst']) assert.ok(rarity.includes(`("${id}", "`), `${id} has a rarity`);
});

test('styles: the core and the window list the same answer styles', async () => {
  const { STYLES } = await import('./conversation/styles.ts');
  const rust = readFileSync(join(core, 'brain/styles.rs'), 'utf8');
  const ids = [...rust.matchAll(/Style \{\s*id: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, STYLES.map((s: { id: string }) => s.id));
});

test('panels: the core and the window know the same panel kinds', async () => {
  const rust = readFileSync(join(core, 'stage/panel.rs'), 'utf8');
  const enumBody = rust.slice(rust.indexOf('pub enum Panel {'));
  const rustKinds = [...enumBody.matchAll(/^    ([A-Z][a-z]+) \{/gm)].map((m) => m[1].toLowerCase()).sort();
  const spec = readFileSync(join(web, 'kernel/panel-spec.ts'), 'utf8');
  const tsKinds = [...spec.matchAll(/kind: '([a-z]+)'; id: string/g)].map((m) => m[1]).sort();
  assert.deepEqual(tsKinds, rustKinds);
  const body = readFileSync(join(web, 'stage/panels/PanelBody.tsx'), 'utf8');
  for (const k of rustKinds) assert.ok(body.includes(`case '${k}':`), `PanelBody draws ${k}`);
});
