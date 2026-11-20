// World tileset test scene (phase 2 / milestone 1): layered autotile ground, cliffs into the cloud sea, retaining wall + stairs,
// parallax peaks + clouds, with the Dao si character. Open worldtest.html (keyboard: WASD/arrows, Shift = run; touch joystick).
import * as Phaser from 'phaser';
import { computeView, isTouchDevice } from './view.js';
import { UI, RUN_AT } from './ui.js';
const A = 'assets/world/';
const DIR8 = ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'];
const ANIMS = { idle: { n: 6, ms: 150 }, walk: { n: 8, ms: 100 }, run: { n: 8, ms: 75 } };
const dir8 = (x, y) => DIR8[((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8];
const FLAT = /^(flower|ground)/;

class WorldTest extends Phaser.Scene {
  constructor() { super('world'); }
  preload() {
    this.load.tilemapTiledJSON('wmap', A + 'testmap.json');
    this.load.image('wtiles', A + 'world_tiles.png');
    this.load.json('wmeta', A + 'testmap_meta.json');
    this.load.atlas('decals', A + 'world_decals.png', A + 'world_decals.json');
    this.load.image('peaks', A + 'bg_peaks.png');
    this.load.image('cloudBack', A + 'bg_cloud_back.png');
    this.load.atlas('props', 'assets/props.png', 'assets/props.json');
    this.load.json('propsMeta', 'assets/props_meta.json');
    this.load.atlas('hero', 'assets/dao_si.png', 'assets/dao_si.json');
  }
  create() {
    const meta = this.cache.json.get('wmeta'), pm = this.cache.json.get('propsMeta');
    const map = this.make.tilemap({ key: 'wmap' });
    const ts = map.addTilesetImage('world_tiles', 'wtiles');
    this.W = map.widthInPixels; this.H = map.heightInPixels; this.cliffBottom = meta.cliffBottom;
    // backdrop: cloud sea (screen-space parallax) -> distant peaks band -> world
    this.cloudBack = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'cloudBack').setOrigin(0).setScrollFactor(0).setDepth(-200);
    this.peaks = this.add.tileSprite(-400, 0, this.W + 800, 240, 'peaks').setOrigin(0).setScrollFactor(0.6).setDepth(-190);
    const order = ['base', 'stone', 'grass', 'grassdk', 'grasslt', 'moss', 'cliff', 'struct', 'skirt'];
    order.forEach((n, i) => map.createLayer(n, ts, 0, 0).setDepth(-100 + i));
    // decals: flat ones under everything, tall ones y-sorted
    for (const o of meta.objs) {
      const flat = FLAT.test(o.name);
      this.add.image(o.x, o.y, 'decals', o.name).setOrigin(0.5, 1).setDepth(flat ? -80 : o.y);
    }
    // placeholder props from phase 1 (to be replaced in milestone 2)
    const solids = this.physics.add.staticGroup();
    for (const p of meta.props) {
      const m = pm[p.key];
      this.add.image(p.x, p.y, 'props', p.key).setOrigin(0.5, m.oy).setDepth(p.y);
      const w = Math.min(m.w * 0.55, 90), h = 10;
      solids.add(this.add.zone(p.x, p.y - h / 2, w, h));
    }
    // collision from the meta grid (void, cliff faces, wall face)
    meta.col.forEach((row, y) => row.forEach((c, x) => { if (c) solids.add(this.add.zone(x * 32 + 16, y * 32 + 16, 32, 32)); }));
    // hero
    for (const [a, c] of Object.entries(ANIMS)) for (const d of DIR8)
      this.anims.create({ key: `${a}_${d}`, frames: this.anims.generateFrameNames('hero', { prefix: `dao_si_${a}_${d}_`, start: 0, end: c.n - 1, zeroPad: 2 }), frameRate: 1000 / c.ms, repeat: -1 });
    const sp = new URLSearchParams(location.search);
    const sx = +(sp.get('x') || meta.spawn[0]), sy = +(sp.get('y') || meta.spawn[1]);
    this.player = this.physics.add.sprite(sx, sy, 'hero').setOrigin(32 / 64, 61 / 64);
    this.player.body.setSize(14, 8).setOffset(25, 54);
    this.facing = sp.get('face') || 'down'; this.player.anims.play(`idle_${this.facing}`);
    const g = this.make.graphics({ x: 0, y: 0 }, false); g.fillStyle(0x0b0a09, 0.3); g.fillEllipse(9, 3, 18, 6); g.generateTexture('shadow', 18, 6); g.destroy();
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(-70);
    this.physics.add.collider(this.player, solids);
    this.physics.world.setBounds(0, 0, this.W, this.H);
    this.player.setCollideWorldBounds(true);
    // front cloud wisps drifting in front of the cliff base
    const cam = this.cameras.main;
    this.viewBottom = this.cliffBottom + 120;
    cam.setBounds(0, 0, this.W, this.viewBottom); cam.startFollow(this.player, true, 0.2, 0.2); cam.setRoundPixels(true);
    cam.setBackgroundColor('#9fb3b4');
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT');
    this.ui = new UI({ onAction: () => {}, onDialogTap: () => {} });
    if (isTouchDevice()) this.ui.enableTouch();
    this.scale.on('resize', () => { cam.setSize(this.scale.width, this.scale.height); this.cloudBack.setSize(this.scale.width, this.scale.height); });
    window.__scene = this;
  }
  update(time) {
    const k = this.keys, p = this.player, cam = this.cameras.main;
    let vx = 0, vy = 0, run = k.SHIFT.isDown;
    if (k.LEFT.isDown || k.A.isDown) vx -= 1; if (k.RIGHT.isDown || k.D.isDown) vx += 1;
    if (k.UP.isDown || k.W.isDown) vy -= 1; if (k.DOWN.isDown || k.S.isDown) vy += 1;
    if (!vx && !vy && this.ui.mag > 0) { vx = this.ui.vec.x; vy = this.ui.vec.y; run = this.ui.mag >= RUN_AT; }
    const len = Math.hypot(vx, vy);
    if (len) { const s = run ? 118 : 58; p.setVelocity(vx / len * s, vy / len * s); this.facing = dir8(vx, vy); p.anims.play(`${run ? 'run' : 'walk'}_${this.facing}`, true); }
    else { p.setVelocity(0, 0); p.anims.play(`idle_${this.facing}`, true); }
    p.setDepth(p.y); this.shadow.setPosition(Math.round(p.x), Math.round(p.y) - 1);
    // parallax: the cloud sea moves at half the camera speed and drifts slowly; the peaks band sits just below the cliffs
    this.cloudBack.tilePositionX = Math.round(cam.scrollX * 0.5 + time * 0.004); this.cloudBack.tilePositionY = Math.round(cam.scrollY * 0.5);
    const maxY = this.viewBottom - cam.height;
    this.peaks.y = Math.round(this.cliffBottom - 70 - 0.4 * Math.max(0, maxY));
  }
}
const v = computeView();
const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: v.width, height: v.height, backgroundColor: '#9fb3b4', pixelArt: true, roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, zoom: v.zoom, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 3 },
  physics: { default: 'arcade' }, scene: [WorldTest] });
window.addEventListener('resize', () => { const n = computeView(); game.scale.setZoom(n.zoom); game.scale.resize(n.width, n.height); });
window.__game = game;
