// Runtime integration, bake compatibility and screenshot checks; no production area writes.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from './area_tool_runtime.mjs';
import { decodePng } from './png.mjs';
import { validateKit, resolveKitPieces } from '../src/areaKits.js';
import { prepareSceneShot, writeShot2x } from './scene_shot.mjs';
const out = 'records/HK-ENG/test-output'; mkdirSync(out, { recursive: true });
let checks = 0;
const check = (name, test) => { assert.ok(test, name); checks++; console.log(`OK ${checks} ${name}`); };
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const run = args => { const p = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, windowsHide: true }); assert.equal(p.status, 0, p.stdout + p.stderr); return p.stdout; };
const kit = validateKit('FAKE', json('tests/fixtures/kits/FAKE/kit.json'));
const meta = { id: 'kit-fixture', name: 'Kit test', spawn: [80,240,'down'], features: {},
  kits: { FAKE: '../tests/fixtures/kits/FAKE/kit.json' }, pieces: [
    { k: 'FAKE/ground', x: 60, y: 120 }, { k: 'FAKE/base', x: 220, y: 200 },
    { k: 'FAKE/gate', x: 420, y: 240 }, { k: 'FAKE/roof', x: 300, y: 340 },
  ] };
check('pair automatically adds one roof', resolveKitPieces(meta, { FAKE: kit }).length === 5);
check('explicit roof does not duplicate its pair', resolveKitPieces({ ...meta, pieces: [...meta.pieces, { k: 'FAKE/gate_roof', x: 420, y: 240 }] }, { FAKE: kit }).length === 5);
assert.throws(() => resolveKitPieces({ ...meta, pieces: [{ k: 'FAKE/missing', x: 1, y: 2 }] }, { FAKE: kit }));
check('invalid placement rejected', true);

const source = { area: { ...meta }, bake: { width: 640, height: 480, seed: 3, regions: [{ fill: true, material: 'kit_ground' }] }, materials: `${out}/materials.json` };
// Exercise source-level fields (including top-level precedence) rather than merely passing area through.
source.kits = meta.kits; source.pieces = meta.pieces; delete source.area.kits; delete source.area.pieces;
writeFileSync(`${out}/materials.json`, JSON.stringify({ source: 'public/assets/sect/ground_bake.png', materials: { kit_ground: { type: 'texture', piece: 'FAKE/ground' } } }));
writeFileSync(`${out}/fixture.src.json`, JSON.stringify(source));
run(['tools/area_bake.mjs', `${out}/fixture.src.json`, '--out', `${out}/baked`]);
const baked = json(`${out}/baked/area.json`), tex = decodePng('tests/fixtures/kits/FAKE/ground.png'), ground = decodePng(`${out}/baked/ground.png`);
check('bake transfers kits + anchor placements exactly', JSON.stringify(baked.kits) === JSON.stringify(meta.kits) && JSON.stringify(baked.pieces) === JSON.stringify(meta.pieces));
let repeat = true;
for (let y = 0; y < ground.h; y++) for (let x = 0; x < ground.w; x++) for (let c = 0; c < 4; c++) if (ground.data[(y * ground.w + x) * 4 + c] !== tex.data[((y % tex.h) * tex.w + x % tex.w) * 4 + c]) repeat = false;
check('texture material wraps exactly (307200 pixels, no mirror/dither)', repeat);
for (const id of ['huyen-van-quan-v2', 'son-dao-v3', 'hau-son-v3']) {
  const before = sha(`public/assets/areas/${id}/ground.png`);
  run(['tools/area_bake.mjs', `tools/areas/${id}.src.json`, '--out', `${out}/${id}`]);
  check(`${id} no-kit ground SHA256 unchanged ${before}`, sha(`${out}/${id}/ground.png`) === before);
}

let server, browser;
try {
  server = spawn(process.execPath, ['tools/area_tool_vite.mjs', '--port', '5198'], { stdio: 'pipe', windowsHide: true });
  let serverError = ''; server.stderr.on('data', b => { serverError += b; });
  const base = 'http://127.0.0.1:5198/'; let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(serverError);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* wait */ }
    await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(ready, 'Vite startup');
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/assets/areas/kit-fixture/area.json', r => r.fulfill({ json: baked }));
  await page.route('**/assets/areas/kit-fixture/ground.png', r => r.fulfill({ contentType: 'image/png', body: readFileSync(`${out}/baked/ground.png`) }));
  await page.goto(base + '?area=kit-fixture');
  await page.waitForFunction(() => window.__scene?.player?.active && __scene.fx, null, { timeout: 30000 });
  check('runtime loads 5 images from real manifest/PNG loader', await page.evaluate(() => __scene.kitImages.length === 5 && __scene.kitImages.every(im => im.texture.key.startsWith('kit:kit-fixture:FAKE:'))));
  check('all image origins match their individual anchors', await page.evaluate(() => __scene.kitImages.map(im => [im.x,im.y]).toString() === [[44,104],[188,136],[356,176],[356,160],[268,276]].toString()));
  const tele = async (x, y) => { await page.evaluate(([x,y]) => { __scene.player.body.reset(x,y); __scene.lastGood = null; }, [x,y]); await page.waitForTimeout(80); };
  const depth = key => page.evaluate(key => { const s = __scene, im = s.kitImages.find(im => im.getData('kitPiece') === key); return [im.depth, s.player.depth]; }, key);
  await tele(60,120); let d = await depth('FAKE/ground'); check('ground depth -99 is below overlapping player', d[0] === -99 && d[0] < d[1]);
  await tele(220,175); d = await depth('FAKE/base'); check('base is above player behind its foot', d[0] === 200 && d[0] > d[1]);
  await tele(220,220); d = await depth('FAKE/base'); check('base is below player in front of its foot', d[0] < d[1]);
  await tele(300,310); await page.waitForTimeout(250);
  check('roof above player fades through existing pixel-mask mechanism', await page.evaluate(() => { const r = __scene.roofs.find(r => r.img.getData('kitPiece') === 'FAKE/roof'); return r.img.depth > __scene.player.depth && Math.abs(r.img.alpha - 0.35) < 0.001 && r.rects.length > 1; }));
  await tele(80,240); await page.waitForTimeout(250);
  check('roof alpha restores away from player', await page.evaluate(() => __scene.roofs.every(r => r.img.alpha === 1)));
  const hold = async (x, y, key, ms) => { await tele(x,y); await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); return page.evaluate(() => [__scene.player.x,__scene.player.y]); };
  let p = await hold(220,235,'ArrowUp',1100);
  check(`collide blocks real walking at base (y=${p[1].toFixed(2)})`, p[1] >= 200 && p[1] < 210);
  p = await hold(375,280,'ArrowUp',1400);
  check(`gate side pillar blocks real walking (y=${p[1].toFixed(2)})`, p[1] >= 240 && p[1] < 250);
  p = await hold(420,280,'ArrowUp',1700);
  check(`48px open gate passage permits real walking (y=${p[1].toFixed(2)})`, p[1] < 220);
  check('gate PNG actually has transparent passage', decodePng('tests/fixtures/kits/FAKE/gate.png').data[(63 * 128 + 64) * 4 + 3] === 0);
  // Fractional tile camera coordinates, real actor frame, UI/fog disabled and exact 2x duplication.
  await prepareSceneShot(page, { view: [1.25,2.5], actors: [[3,6],[6,7],[11,8]] });
  await page.waitForTimeout(100);
  const shot = `${out}/fixture.png`; await page.locator('canvas').screenshot({ path: shot }); const double = writeShot2x(shot);
  check('scene shot exact fractional camera + 3 south-facing Dao Si', await page.evaluate(() => __scene.cameras.main.scrollX === 40 && __scene.cameras.main.scrollY === 80 && __scene.shotActors.length === 3 && __scene.shotActors.every(im => im.frame.name === 'dao_si_idle_down_00') && !__scene.fogA.visible && !__scene.fogB.visible && document.getElementById('ui').style.visibility === 'hidden'));
  const im = decodePng(shot), im2 = decodePng(double); let nearest = im.w === 480 && im.h === 270 && im2.w === 960 && im2.h === 540;
  for (let y = 0; y < im2.h; y++) for (let x = 0; x < im2.w; x++) for (let c = 0; c < 4; c++) if (im2.data[(y * im2.w + x) * 4 + c] !== im.data[(Math.floor(y / 2) * im.w + Math.floor(x / 2)) * 4 + c]) nearest = false;
  check('480x270 PNG + exact nearest-neighbour 960x540 PNG', nearest);
  // A fresh reload after scene restart must reload a kit whose cache has been cleaned.
  await page.evaluate(() => { __scene.scene.resume(); __scene.scene.restart({ area: 'huyen-van-quan-v2' }); });
  await page.waitForFunction(() => __scene?.meta.id === 'huyen-van-quan-v2' && __scene.fx && __scene.player.active);
  check('leaving kit area removes manifest + textures', await page.evaluate(() => !__scene.cache.json.exists('kit:kit-fixture:FAKE') && !__scene.textures.exists('kit:kit-fixture:FAKE:gate')));
  await page.evaluate(() => { __scene.scene.restart({ area: 'kit-fixture' }); });
  await page.waitForFunction(() => __scene?.meta.id === 'kit-fixture' && __scene.kitImages.length === 5 && __scene.player.active);
  check('re-entering kit area reloads successfully', true);
  check('0 browser errors', errors.length === 0 || (console.error(errors), false));
} finally { await browser?.close(); server?.kill(); }
console.log(`TAT CA DAT (${checks} muc kit/bake/scene_shot)`);
