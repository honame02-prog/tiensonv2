// Focused proof: load the unchanged kit manifest through the real AreaScene.
// No production scene/area writes; all generated files stay in this task's records.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(root);
const rec = 'records/S1-STAIR3';
mkdirSync(rec, { recursive: true });
process.env.CHROME_LOG_FILE = resolve(rec, 'chromium.log');
const { chromium, packagePath } = await import('../../area_tool_runtime.mjs');
const { prepareSceneShot } = await import('../../scene_shot.mjs');
const { validateKit, resolveKitPieces } = await import('../../../src/areaKits.js');
const { createServer } = await import(pathToFileURL(packagePath('vite')).href);
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const kits = Object.fromEntries(['H-STAIR','H-TERR'].map(k => [k, validateKit(k, json(`public/assets/kits/${k}/kit.json`))]));
const placements = json(`${rec}/joined-placements.json`);
let server, browser;
try {
  server = await createServer({ configFile: false, root, base: './',
    cacheDir: `${rec}/vite-cache`,
    resolve: { alias: { phaser: join(dirname(packagePath('phaser/package.json')), 'dist/phaser.esm.js') } },
    server: { host: '127.0.0.1', port: 5203, strictPort: true,
      fs: { allow: [root, dirname(packagePath('phaser/package.json'))] } } });
  await server.listen();
  // GPU subprocesses may ignore CHROME_LOG_FILE and write debug.log to cwd.
  // Give Chromium this task's records as cwd, preserving every generated log.
  process.chdir(resolve(rec));
  try {
    browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader',
      '--enable-unsafe-swiftshader','--ignore-gpu-blocklist',`--log-file=${process.env.CHROME_LOG_FILE}`] });
  } finally { process.chdir(root); }
  const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  let meta;
  await page.route('**/assets/areas/h-stair3-proof/area.json', r => r.fulfill({ json: meta }));
  for (const [name, p] of Object.entries(placements)) {
    const suffix = name === 'stair_4' ? '_4' : '';
    const pieces = p['H-TERR'].map(o => ({ k: `H-TERR/${o.piece}`, x: o.anchor[0], y: o.anchor[1] }));
    pieces.push({ k: `H-STAIR/${name}`, x: p.stair_top_left[0], y: 156 });
    for (const [i,side] of ['L','R'].entries()) pieces.push({ k: `H-STAIR/stair_cheek${suffix}_${side}`, x: p.cheek_top_left[i][0], y: 156 });
    meta = { id: 'h-stair3-proof', name: 'H-STAIR R3', width: 480, height: 270,
      ground: '/records/S1-STAIR3/paving.png', backdrop: 'none', bg: '#262725',
      spawn: [240,220,'down'], features: {},
      kits: { 'H-STAIR': 'assets/kits/H-STAIR/kit.json', 'H-TERR': 'assets/kits/H-TERR/kit.json' }, pieces };
    assert.equal(resolveKitPieces(meta,kits).length,pieces.length);
    await page.goto('http://127.0.0.1:5203/?area=h-stair3-proof');
    await page.waitForFunction(() => window.__scene?.player?.active && __scene.fx, null, { timeout: 30000 });
    await prepareSceneShot(page,{ view: [0,0], actors: [[p.actor_foot[0]/32,p.actor_foot[1]/32]] });
    const state = await page.evaluate(() => ({
      placed: __scene.kitImages.length,
      loaded: Object.keys(__scene.cache.json.get('kit:h-stair3-proof:H-STAIR').pieces).filter(n => __scene.textures.exists(`kit:h-stair3-proof:H-STAIR:${n}`)).length,
      actors: __scene.shotActors.length,
      scale: __scene.cameras.main.zoom,
      stairs: __scene.kitImages.filter(i => i.getData('kitPiece').startsWith('H-STAIR/')).map(i => ({ piece: i.getData('kitPiece'), x: i.x, y: i.y, w: i.width, h: i.height }))
    }));
    assert.equal(state.loaded,7); assert.equal(state.placed,pieces.length);
    assert.equal(state.actors,1); assert.equal(state.scale,1);
    assert.deepEqual([state.stairs[0].x,state.stairs[0].y],p.stair_top_left);
    await page.locator('canvas').screenshot({ path: `${rec}/runtime-${name}-1x.png` });
    writeFileSync(`${rec}/runtime-${name}.json`,JSON.stringify(state,null,2)+'\n');
    console.log(`PASS runtime ${name}: H-STAIR textures=7 placed=${state.placed} DaoSi=1 zoom=1 console_errors=${errors.length}`);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS H-STAIR runtime: 2 native assemblies, actual AreaScene loader + manifest anchors, browser_errors=0');
} finally { await browser?.close(); await server?.close(); }
