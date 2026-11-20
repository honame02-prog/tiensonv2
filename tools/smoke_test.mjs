import { chromium } from 'playwright';
const out = process.argv[2] || '/workspace/game/shots';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:8080/' + (process.argv[3] || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const pos = () => page.evaluate(() => ({ x: Math.round(__scene.player.x), y: Math.round(__scene.player.y), f: __scene.player.frame.name }));
await page.screenshot({ path: `${out}/01_start.png` });
logs.push('start ' + JSON.stringify(await pos()));
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k); };
await hold(['ArrowUp'], 1600); logs.push('after up ' + JSON.stringify(await pos()));
await hold(['ArrowRight'], 1200); logs.push('after right ' + JSON.stringify(await pos()));
await hold(['w','d'], 900); logs.push('after diag ' + JSON.stringify(await pos()));
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250);
await page.keyboard.up('ArrowRight');
// teleport next to NPC and talk
await page.evaluate(() => { const n = __scene.npc; __scene.player.setPosition(n.x - 26, n.y); __scene.facing='right'; });
await page.waitForTimeout(600);
await page.keyboard.press('e'); await page.waitForTimeout(2600);
await page.screenshot({ path: `${out}/03_dialog.png` });
logs.push('dialog ' + JSON.stringify(await page.evaluate(() => ({ open: !!__scene.dialog, text: __scene.dlgText.text }))));
// walk to bridge and try to cross
for (let i = 0; i < 12 && await page.evaluate(() => !!__scene.dialog); i++) { await page.keyboard.press('e'); await page.waitForTimeout(80); }
logs.push('dialog closed ' + await page.evaluate(() => !__scene.dialog));
await page.evaluate(() => { const b = __scene.children.list.find(o => o.frame && o.frame.name === 'bridge'); __scene.player.setPosition(b.x - 80, b.y - 36); __scene.bridgeX = b.x; });
await page.waitForTimeout(300);
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1250); await page.screenshot({ path: `${out}/02_walking_bridge.png` }); await page.waitForTimeout(1350); await page.keyboard.up('ArrowRight'); logs.push('after bridge ' + JSON.stringify(await pos()) + ' bridgeX ' + await page.evaluate(() => __scene.bridgeX));
// fps
logs.push('fps ' + await page.evaluate(() => Math.round(__game.loop.actualFps)));
console.log(logs.join('\n'));
await browser.close();
