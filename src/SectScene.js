// Huyền Vân Quan test zone: main hall terrace + outer courtyard + mountain gate + long stairway (fog-and-moss mood).
// Baked ground (game-art/sect/tools/sect_bake.py) + separate y-sorted sprites (roof/base layers, foliage clusters),
// ambient animation (koi, foliage sway, incense smoke, drifting mist, cloud sea) and a day/night cycle with lantern light.
import * as Phaser from 'phaser';
import { UI, RUN_AT } from './ui.js';
import { isTouchDevice } from './view.js';
import { FxPlayer } from './fx/FxPlayer.js';
import { CUES } from './fx/cues/index.js';
import { setupFxDemo } from './fx/fxdemo.js';

const A = 'assets/sect/';
const WALK_SPEED = 58, RUN_SPEED = 118;
const DIR8 = ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'];
const ANIMS = { idle: { n: 6, ms: 150, repeat: -1 }, walk: { n: 8, ms: 100, repeat: -1 }, run: { n: 8, ms: 75, repeat: -1 }, interact: { n: 8, ms: 90, repeat: 0 } };
const dir8 = (x, y) => DIR8[((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8];
const FLAT = /^(flower|ground)/;

const TEXT = {
  stele_a: [
    { who: 'Bia đá cổ', text: 'Chữ khắc đã mòn gần hết dưới lớp rêu. Chỉ còn đọc được mấy dòng: «Huyền Vân Quan, khai sơn năm thứ ba niên hiệu Thái Bình…»' },
    { who: 'Bia đá cổ', text: '«…tổ sư dẫn ba mươi sáu đệ tử lên núi, dựng điện thờ Tam Thanh giữa biển mây. Ngàn năm hương khói chưa từng tắt.»' },
  ],
  stele_b: [
    { who: 'Bia giới luật', text: '«Tĩnh tâm như nước, giữ đạo như núi. Vào sơn môn, chớ mang theo sân hận.»' },
    { who: 'Bia giới luật', text: 'Bên dưới có ai khắc thêm một dòng nhỏ, nét còn mới: «Đi chậm thôi, rêu trơn lắm.»' },
  ],
  burner: [
    { who: 'Lư hương đồng', text: 'Lư đồng đã xỉn màu rỉ xanh, tro hương phủ dày cả tấc.' },
    { who: 'Đạo sĩ', text: 'Thắp ba nén hương, kính Tam Thanh, kính tổ sư.' },
  ],
  burner_lit: [{ who: 'Lư hương đồng', text: 'Khói hương lặng lẽ bay lên rồi tan vào sương núi.' }],
  hall: [
    { who: 'Chính điện', text: 'Cánh cửa gỗ nặng khép hờ. Bên trong, tượng Tam Thanh mờ khuất sau làn khói trầm.' },
    { who: 'Chính điện', text: '(Nội điện sẽ mở ở bản sau.)' },
  ],
  gate: [
    { who: 'Sơn môn', text: 'Tấm biển gỗ trên cổng đã bạc màu, nét chữ vàng chỉ còn lờ mờ: «Huyền Vân Quan».' },
    { who: 'Sơn môn', text: 'Bước qua cổng là bậc đá dài dẫn xuống núi.' },
  ],
};
const PROMPT = { stele_a: 'Đọc bia', stele_b: 'Đọc bia', burner: 'Thắp hương', hall: 'Xem cửa điện', gate: 'Sơn môn' };
// collision footprints (w, h) at the sprite foot, per sprite key
const FOOT = { lantern_a: [12, 7], lantern_b: [12, 7], stele_a: [26, 9], stele_b: [26, 9], burner: [32, 12], pine_a: [26, 10], pine_b: [26, 10],
  rock_a: [26, 9], rock_b: [22, 8], rock_c: [16, 6] };

export class SectScene extends Phaser.Scene {
  constructor() { super('sect'); }

  preload() {
    this.load.image('ground', A + 'ground_bake.png');
    this.load.json('smeta', A + 'testmap_meta.json');
    this.load.json('sspr', A + 'sect_sprites.json');
    this.load.atlas('sect', A + 'sect_atlas.png', A + 'sect_atlas.json');
    this.load.atlas('decals', A + 'decals.png', A + 'decals.json');
    this.load.image('peaks', A + 'bg_peaks.png');
    this.load.image('cloudBack', A + 'bg_cloud_back.png');
    this.load.image('mistA', A + 'fx_mist_a.png');
    this.load.image('mistB', A + 'fx_mist_b.png');
    this.load.atlas('hero', 'assets/dao_si.png', 'assets/dao_si.json');
    FxPlayer.preload(this, Object.values(CUES));
  }

  create() {
    const meta = this.cache.json.get('smeta'), SP = this.cache.json.get('sspr');
    this.meta = meta; this.SP = SP;
    const W = this.W = meta.width, H = this.H = meta.height;
    const sp = new URLSearchParams(location.search);
    // ---------- backdrop: cloud sea far layer (screen-space parallax), distant peaks, drifting cloud sea, then the baked world
    this.cloudBack = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'cloudBack').setOrigin(0).setScrollFactor(0).setDepth(-200);
    this.peaks = this.add.tileSprite(-400, 0, W + 800, 240, 'peaks').setOrigin(0).setScrollFactor(0.6).setDepth(-190);
    this.seaDrift = this.add.tileSprite(-200, 0, W + 400, H + 200, 'mistB').setOrigin(0).setDepth(-150).setAlpha(0.55).setTileScale(2, 1);
    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-100);
    // ---------- decals
    for (const o of meta.objs) this.add.image(o.x, o.y, 'decals', o.name).setOrigin(0.5, 1).setDepth(FLAT.test(o.name) ? -80 : o.y);
    // ---------- props (separate sprites, y-sorted; roof/base layers; foliage clusters)
    this.solids = this.physics.add.staticGroup();
    const solid = (x, y, w, h) => this.solids.add(this.add.zone(x, y, w, h));
    this.interactables = []; this.foliage = []; this.lanterns = []; this.ferns = [];
    this.makeAnims();
    for (const p of meta.props) {
      const k = p.key, m = SP.sprites[k], x = Math.round(p.x), y = Math.round(p.y);
      const left = x - Math.round(m.w / 2), top = y - m.h;
      if (k === 'hall') {
        this.add.image(left, top, 'sect', 'hall_base').setOrigin(0).setDepth(y);
        this.add.image(left, top, 'sect', 'hall_roof').setOrigin(0).setDepth(y + 0.5);
        solid(x, y - 70, m.w - 24, 120);                       // body + plinth (feet stop just below the plinth)
        solid(x - 120, y - 6, 92, 12); solid(x + 120, y - 6, 92, 12);
        this.interactables.push({ key: 'hall', x, y: y + 4, range: 40 });
        this.hallPos = { x, y };
      } else if (k === 'gate') {
        const L = SP.layers.gate, P = L.passage;
        this.add.image(left, top, 'sect', 'gate_base').setOrigin(0).setDepth(y - 2);
        this.gateRoof = this.add.image(left, top, 'sect', 'gate_roof').setOrigin(0).setDepth(8000);
        // side wings + pillars block; the passage between the inner pillars is open
        const px0 = left + P.x0, px1 = left + P.x1;
        solid((left + px0) / 2, y - 22, px0 - left, 44); solid((px1 + left + m.w) / 2, y - 22, left + m.w - px1, 44);
        this.interactables.push({ key: 'gate', x, y: y - 30, range: 34 });
        this.gatePos = { x, y, px0, px1, top };
      } else if (k.startsWith('pine')) {
        this.add.image(left, top, 'sect', k + '_trunk').setOrigin(0).setDepth(y);
        SP.layers[k].clusters.forEach((c, i) => {
          const img = this.add.image(left + c.x, top + c.y, 'sect', c.name).setOrigin(0).setDepth(y + 0.5);
          // higher clusters sway more; each has its own phase and rate
          this.foliage.push({ img, x0: left + c.x, y0: top + c.y, ph: Math.random() * 6.28 + i, f: 0.9 + Math.random() * 0.5, amp: 0.6 + (1 - c.cy / m.h) * 1.1 });
        });
      } else if (k.startsWith('fern')) {
        const s = this.add.sprite(x, y + 1, 'sect', k + '_s1').setOrigin(0.5, 1).setDepth(y);
        s.anims.play({ key: k + '_sway', startFrame: Math.floor(Math.random() * 4) }); s.anims.timeScale = 0.75 + Math.random() * 0.5;
      } else {
        this.add.image(left, top, 'sect', k).setOrigin(0).setDepth(y);
        if (k.startsWith('lantern')) this.lanterns.push({ x: left + m.win[0], y: top + m.win[1], foot: y });
        if (k === 'burner') this.burnerPos = { x, y, top };
        if (k.startsWith('stele') || k === 'burner') this.interactables.push({ key: k, x, y: y + 2, range: k === 'burner' ? 36 : 30 });
      }
      if (FOOT[k]) solid(x, y - FOOT[k][1] / 2, FOOT[k][0], FOOT[k][1]);
    }
    // ---------- collision grid (void, cliff faces, wall bodies, steep mountainside) + stair balustrades + pond
    meta.col.forEach((row, cy) => row.forEach((c, cx) => { if (c) solid(cx * 32 + 16, cy * 32 + 16, 32, 32); }));
    for (const [sx, sy, sw, sh] of meta.stairs) { solid(sx + 7, sy + sh / 2 + 4, 14, sh - 8); solid(sx + sw - 7, sy + sh / 2 + 4, 14, sh - 8); }
    const pd = meta.pond;
    for (const [fy, fx] of [[-0.7, 0.62], [-0.25, 0.98], [0.25, 0.98], [0.7, 0.62]]) solid(pd.cx, pd.cy + fy * pd.ry, pd.rx * 2 * fx + 10, pd.ry * 0.5 + 8);
    // ---------- pond life: koi under the surface layer (lily pads), glints, ripples
    this.makePond(pd);
    // ---------- incense smoke from the burner
    this.makeSmoke();
    // ---------- hero
    const sx = +(sp.get('x') || meta.spawn[0]), sy = +(sp.get('y') || meta.spawn[1]);
    this.player = this.physics.add.sprite(sx, sy, 'hero', 'dao_si_idle_down_00').setOrigin(32 / 64, 61 / 64);
    this.player.body.setSize(14, 8).setOffset(25, 54);
    this.player.on('animationcomplete', (anim) => { if (anim.key.startsWith('interact_')) this.endInteract(); });
    this.facing = sp.get('face') || 'up'; this.acting = false;
    this.player.anims.play(`idle_${this.facing}`);
    const g = this.make.graphics({ x: 0, y: 0 }, false); g.fillStyle(0x0b0a09, 0.32); g.fillEllipse(9, 3, 18, 6); g.generateTexture('shadow', 18, 6); g.destroy();
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(-70);
    this.physics.add.collider(this.player, this.solids);
    this.physics.world.setBounds(0, 0, W, H);
    this.player.setCollideWorldBounds(true);
    // way down the mountain (transition placeholder) at the west end of the lower landing
    this.exitZone = new Phaser.Geom.Rectangle(7 * 32, 30 * 32, 2.2 * 32, 3 * 32);
    // ---------- mist: drifting banks over the cliff edges (world) + thin fog veils over everything (screen)
    const cb = meta.cliffBottom;
    this.mistBands = [
      this.add.tileSprite(-100, cb - 150, W + 200, 190, 'mistA').setOrigin(0).setDepth(8600).setAlpha(0.42).setTileScale(2, 1),
      this.add.tileSprite(-100, 700, 9 * 32 + 100, 220, 'mistA').setOrigin(0).setDepth(8600).setAlpha(0.38).setTileScale(2, 1),
      this.add.tileSprite(22 * 32, 700, 9 * 32 + 100, 220, 'mistA').setOrigin(0).setDepth(8600).setAlpha(0.38).setTileScale(2, 1),
    ];
    this.mistBands.forEach(m => { m.baseA = m.alpha; });
    this.fogA = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'mistA').setOrigin(0).setScrollFactor(0).setDepth(8900).setAlpha(0.13).setTileScale(2, 1.4);
    this.fogB = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'mistB').setOrigin(0).setScrollFactor(0).setDepth(8901).setAlpha(0.09).setTileScale(3, 2);
    // ---------- day / night
    this.makeNight();
    this.nightK = sp.has('night') ? 1 : 0; this.night = this.nightK > 0.5; this.cycle = sp.has('cycle');
    // ---------- camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H); cam.startFollow(this.player, true, 0.15, 0.15); cam.setRoundPixels(true);
    cam.setBackgroundColor('#7d8c92');
    // ---------- input + UI
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,SHIFT,N');
    this.input.keyboard.on('keydown-E', () => this.onInteract());
    this.input.keyboard.on('keydown-SPACE', () => this.onInteract());
    this.input.keyboard.on('keydown-N', () => this.toggleNight());
    this.ui = new UI({ onAction: () => this.onInteract(), onDialogTap: () => this.onInteract(), title: 'Huyền Vân Quan', sub: 'Sơn môn · Chính điện' });
    this.touch = this.ui;
    this.ui.help.innerHTML = '<kbd>WASD</kbd>/<kbd>↑↓←→</kbd> đi · giữ <kbd>Shift</kbd> chạy · <kbd>E</kbd> tương tác · <kbd>N</kbd> ngày/đêm';
    this.ui.addDayNight(() => this.toggleNight()); this.ui.setDayNight(this.night);
    if (isTouchDevice()) this.ui.enableTouch();
    this.scale.on('resize', this.onResize, this);
    this.applyNight();
    window.__scene = this;
    // ---------- FX: bo phat hieu ung skill (depth: ground -60, light ngay -59 / dem 9100 theo this.night, overlay 9500); che do thu chi khi ?fx=1; ?fxlab=1 ngu y fx=1
    this.fx = new FxPlayer(this, { maxParticles: 300, isNight: () => this.night });
    const lab = sp.get('fxlab') === '1';
    if (lab || sp.get('fx') === '1') this.fxDemo = setupFxDemo(this);
  }

  makeAnims() {
    for (const [a, c] of Object.entries(ANIMS)) for (const d of DIR8)
      this.anims.create({ key: `${a}_${d}`, frames: this.anims.generateFrameNames('hero', { prefix: `dao_si_${a}_${d}_`, start: 0, end: c.n - 1, zeroPad: 2 }), frameRate: 1000 / c.ms, repeat: c.repeat });
    for (const f of ['fern_a', 'fern_b', 'fern_c'])
      this.anims.create({ key: f + '_sway', frames: [1, 2, 1, 0].map(i => ({ key: 'sect', frame: `${f}_s${i}` })), frameRate: 1.6, repeat: -1 });
    for (let c = 0; c < 3; c++) this.anims.create({ key: `koi${c}`, frames: [0, 1].map(i => ({ key: 'sect', frame: `koi${c}_${i}` })), frameRate: 4, repeat: -1 });
  }

  makePond(pd) {
    const fr = this.textures.getFrame('sect', 'pond_surface'), pw = fr.width, ph = fr.height;
    const x0 = Math.round(pd.cx - pw / 2), y0 = Math.round(pd.cy - ph / 2);
    this.fish = [];
    const N = 5;
    for (let i = 0; i < N; i++) {
      const s = this.add.sprite(pd.cx, pd.cy, 'sect', `koi${i % 3}_0`).setDepth(-97).setAlpha(0.92);
      s.anims.play({ key: `koi${i % 3}`, startFrame: i % 2 });
      const a = Math.random() * 6.28;
      this.fish.push({ s, x: pd.cx + Math.cos(a) * pd.rx * 0.4, y: pd.cy + Math.sin(a) * pd.ry * 0.4, ang: Math.random() * 6.28, sp: 7 + Math.random() * 5, t: null, wait: 0 });
    }
    this.pondShadow = this.add.graphics().setDepth(-98);   // soft dark shadows under the koi
    this.add.image(x0, y0, 'sect', 'pond_surface').setOrigin(0).setDepth(-95);
    const gl = this.add.image(x0, y0, 'sect', 'pond_glint').setOrigin(0).setDepth(-94).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25);
    this.tweens.add({ targets: gl, alpha: 0.6, x: x0 + 2, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.ripples = this.add.graphics().setDepth(-94); this.ripList = [];
    this.time.addEvent({ delay: 1700, loop: true, callback: () => {
      const f = Phaser.Utils.Array.GetRandom(this.fish); if (Math.random() < 0.65) this.ripList.push({ x: f.x, y: f.y, t: 0 });
    } });
    this.pond = pd;
  }

  updatePond(dt) {
    const pd = this.pond, inside = (x, y) => ((x - pd.cx) / (pd.rx * 0.78)) ** 2 + ((y - pd.cy) / (pd.ry * 0.7)) ** 2 < 1;
    this.pondShadow.clear(); this.pondShadow.fillStyle(0x0c1416, 0.35);
    for (const f of this.fish) {
      if (!f.t || Math.hypot(f.t.x - f.x, f.t.y - f.y) < 4) {
        let tx, ty; do { tx = pd.cx + (Math.random() * 2 - 1) * pd.rx * 0.78; ty = pd.cy + (Math.random() * 2 - 1) * pd.ry * 0.7; } while (!inside(tx, ty));
        f.t = { x: tx, y: ty }; f.sp = 5 + Math.random() * 8; if (Math.random() < 0.3) f.wait = 600 + Math.random() * 1600;
      }
      if (f.wait > 0) { f.wait -= dt; f.s.anims.timeScale = 0.4; }
      else {
        const want = Math.atan2(f.t.y - f.y, f.t.x - f.x); let d = Phaser.Math.Angle.Wrap(want - f.ang);
        f.ang += Phaser.Math.Clamp(d, -2.2 * dt / 1000, 2.2 * dt / 1000);
        const v = f.sp * dt / 1000; const nx = f.x + Math.cos(f.ang) * v, ny = f.y + Math.sin(f.ang) * v;
        if (inside(nx, ny)) { f.x = nx; f.y = ny; } else f.t = null;
        f.s.anims.timeScale = 0.6 + f.sp / 10;
      }
      f.s.setPosition(Math.round(f.x), Math.round(f.y)).setRotation(f.ang);
      this.pondShadow.fillEllipse(Math.round(f.x) + 1, Math.round(f.y) + 2, 9, 4);
    }
    this.ripples.clear();
    this.ripList = this.ripList.filter(r => (r.t += dt) < 1600);
    for (const r of this.ripList) { const k = r.t / 1600; this.ripples.lineStyle(1, 0xc8d6d6, 0.45 * (1 - k)); this.ripples.strokeEllipse(r.x, r.y, 4 + k * 16, 2 + k * 7); }
  }

  makeSmoke() {
    const b = this.burnerPos; if (!b) return;
    this.smoke = this.add.particles(b.x, b.top + 8, 'sect', {
      frame: 'smoke', lifespan: { min: 3200, max: 4600 }, frequency: 520, quantity: 1,
      speedY: { min: -9, max: -6 }, speedX: { min: -1.5, max: 1.5 }, x: { min: -4, max: 4 },
      alpha: { start: 0.32, end: 0 }, scale: { start: 0.45, end: 1.5 },
    }).setDepth(b.y + 1);
    this.smokeLit = this.add.particles(b.x, b.top + 8, 'sect', {
      frame: 'smoke', lifespan: { min: 3600, max: 5200 }, frequency: 140, quantity: 1, emitting: false,
      speedY: { min: -12, max: -7 }, speedX: { min: -2, max: 2 }, x: { min: -3, max: 3 },
      alpha: { start: 0.5, end: 0 }, scale: { start: 0.5, end: 1.9 },
    }).setDepth(b.y + 1);
    this.ember = this.add.image(b.x, b.top + 9, 'sect', 'ember').setDepth(b.y + 0.8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.emberGlow = this.add.image(b.x, b.top + 9, 'sect', 'glow').setDepth(b.y + 0.8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.35);
    this.incenseLit = false;
  }

  lightIncense() {
    this.incenseLit = true;
    this.smokeLit.start();
    this.tweens.add({ targets: this.ember, alpha: 1, duration: 600 });
    this.tweens.add({ targets: this.emberGlow, alpha: 0.55, duration: 600 });
    this.time.delayedCall(90000, () => { this.incenseLit = false; this.smokeLit.stop(); this.tweens.add({ targets: [this.ember, this.emberGlow], alpha: 0, duration: 4000 }); });
  }

  // night: one world-size MULTIPLY layer (cool blue tint with warm holes at every light) + additive glows at the lamps
  makeNight() {
    const M = 400, W = this.W + 2 * M, H = this.H + 2 * M;
    const ct = this.textures.createCanvas('nightmask', W, H), c = ct.getContext();
    c.fillStyle = 'rgb(100,112,150)'; c.fillRect(0, 0, W, H);
    const hole = (x, y, rx, ry, col) => {
      c.save(); c.translate(x + M, y + M); c.scale(1, ry / rx);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, col); gr.addColorStop(0.45, col.replace('1)', '0.55)')); gr.addColorStop(1, 'rgba(100,112,150,0)');
      c.fillStyle = gr; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore();
    };
    for (const l of this.lanterns) hole(l.x, l.foot - 6, 58, 40, 'rgba(255,214,150,1)');
    if (this.hallPos) { hole(this.hallPos.x, this.hallPos.y - 20, 120, 60, 'rgba(255,196,128,1)'); }
    if (this.burnerPos) hole(this.burnerPos.x, this.burnerPos.y - 8, 40, 28, 'rgba(255,190,130,1)');
    ct.refresh();
    this.nightImg = this.add.image(-M, -M, 'nightmask').setOrigin(0).setDepth(9000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.glows = [];
    for (const l of this.lanterns) {
      const g1 = this.add.image(l.x + 0.5, l.y + 1, 'sect', 'glow').setDepth(9001).setBlendMode(Phaser.BlendModes.ADD).setScale(0.32);
      const g2 = this.add.image(l.x, l.foot - 4, 'sect', 'pool').setDepth(9001).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9, 0.8);
      this.glows.push({ g: g1, base: 0.6, ph: Math.random() * 6 }, { g: g2, base: 0.22, ph: Math.random() * 6 });
    }
    if (this.hallPos) {
      const g = this.add.image(this.hallPos.x, this.hallPos.y - 40, 'sect', 'pool').setDepth(9001).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6, 0.9);
      this.glows.push({ g, base: 0.3, ph: 0 });
    }
  }

  toggleNight() {
    this.night = !this.night; this.ui.setDayNight(this.night);
    this.tweens.add({ targets: this, nightK: this.night ? 1 : 0, duration: 2600, ease: 'Sine.inOut', onUpdate: () => this.applyNight() });
  }

  applyNight() {
    const k = this.nightK;
    this.nightImg.setAlpha(k).setVisible(k > 0.001);
    // everything in the world (incl. backdrop + mist) is darkened by the multiply layer; the mist itself thins a little at night
    for (const m of this.mistBands) m.setAlpha(m.baseA * (1 - 0.35 * k));
  }

  onResize() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setSize(W, H); this.cloudBack.setSize(W, H); this.fogA.setSize(W, H); this.fogB.setSize(W, H);
  }

  nearest() {
    let best = null, bd = 1e9;
    for (const it of this.interactables) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d < it.range && d < bd) { best = it; bd = d; }
    }
    return best;
  }

  onInteract() {
    if (this.busy) return;
    if (this.dialog) {
      if (this.typing) { this.typing = false; this.ui.setDialog(this.dialog.lines[this.dialog.i].who, this.full, true); return; }
      this.dialog.i++;
      if (this.dialog.i >= this.dialog.lines.length) { const it = this.dialog.it; this.dialog = null; this.ui.showDialog(false); this.afterDialog(it); return; }
      this.showLine(); return;
    }
    if (this.acting) return;
    const it = this.nearest();
    if (it) { const dx = it.x - this.player.x, dy = it.y - this.player.y; if (Math.hypot(dx, dy) > 4) this.facing = dir8(dx, dy); }
    this.acting = true; this.pendingIt = it || null;
    this.player.setVelocity(0, 0);
    this.player.anims.play(`interact_${this.facing}`);
  }

  endInteract() {
    this.acting = false;
    this.player.anims.play(`idle_${this.facing}`, true);
    const it = this.pendingIt; this.pendingIt = null;
    if (!it) return;
    const key = it.key === 'burner' && this.incenseLit ? 'burner_lit' : it.key;
    if (it.key === 'burner' && !this.incenseLit) this.lightIncense();
    this.dialog = { lines: TEXT[key], i: 0, it };
    this.player.setVelocity(0, 0);
    this.ui.showDialog(true); this.showLine();
  }

  afterDialog(it) { if (it.key === 'gate') this.transition('Hạ sơn', 'Khu vực dưới núi đang được xây dựng. Quay lại sân Huyền Vân Quan.', { x: this.gatePos.x, y: this.gatePos.y - 70, face: 'down' }); }

  async transition(title, text, to) {
    if (this.busy) return; this.busy = true; this.player.setVelocity(0, 0);
    await this.ui.fadeTo(1, 600);
    this.ui.toast(`${title} · ${text}`, 2200);
    if (to) { this.player.setPosition(to.x, to.y); this.facing = to.face; this.player.anims.play(`idle_${this.facing}`); this.cameras.main.centerOn(to.x, to.y); }
    await new Promise(r => setTimeout(r, 1500));
    await this.ui.fadeTo(0, 600);
    this.busy = false;
  }

  showLine() {
    const l = this.dialog.lines[this.dialog.i];
    this.full = l.text; this.shown = 0; this.typing = true; this.lastN = -1; this.ui.setDialog(l.who, '', false);
  }

  update(time, delta) {
    const k = this.keys, p = this.player, cam = this.cameras.main;
    if (this.typing) {
      this.shown += delta * 0.045;
      const n = Math.min(this.full.length, Math.floor(this.shown));
      if (n >= this.full.length) this.typing = false;
      if (n !== this.lastN) { this.lastN = n; this.ui.setDialog(this.dialog.lines[this.dialog.i].who, this.full.slice(0, n), !this.typing); }
    }
    let vx = 0, vy = 0, run = false;
    if (!this.dialog && !this.acting && !this.busy) {
      if (k.LEFT.isDown || k.A.isDown) vx -= 1; if (k.RIGHT.isDown || k.D.isDown) vx += 1;
      if (k.UP.isDown || k.W.isDown) vy -= 1; if (k.DOWN.isDown || k.S.isDown) vy += 1;
      run = k.SHIFT.isDown;
      if (!vx && !vy && this.touch.mag > 0) { vx = this.touch.vec.x; vy = this.touch.vec.y; run = this.touch.mag >= RUN_AT; }
    }
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      const s = run ? RUN_SPEED : WALK_SPEED; p.setVelocity(vx / len * s, vy / len * s);
      const nd = dir8(vx, vy); if (nd !== this.facing) { this.prevFacing = this.facing; this.facingAt = time; this.facing = nd; }
      p.anims.play(`${run ? 'run' : 'walk'}_${this.facing}`, true);
    } else {
      p.setVelocity(0, 0);
      if (this.wasMoving && this.prevFacing && time - this.facingAt < 90 && this.prevFacing.includes('_')) this.facing = this.prevFacing;
      if (!this.acting) p.anims.play(`idle_${this.facing}`, true);
    }
    this.wasMoving = len > 0;
    p.setDepth(p.y); this.shadow.setPosition(Math.round(p.x), Math.round(p.y) - 1);
    // walking under the gate roof: let the hero show through
    const G = this.gatePos, under = G && p.x > G.px0 - 6 && p.x < G.px1 + 6 && p.y > G.top + 112 && p.y < G.top + 112 + 60;
    const ra = under ? 0.72 : 1; if (this.gateRoof.alpha !== ra) this.gateRoof.alpha += Phaser.Math.Clamp(ra - this.gateRoof.alpha, -delta / 250, delta / 250);
    if (!this.busy && this.exitZone.contains(p.x, p.y)) this.transition('Đường xuống núi', 'Khu vực kế tiếp đang được xây dựng.', { x: 10.5 * 32, y: 31 * 32, face: 'right' });
    // prompt
    const it = !this.dialog && !this.busy && this.nearest();
    if (it) {
      const z = this.scale.zoom, r = this.game.canvas.getBoundingClientRect();
      const wy = it.key === 'hall' ? it.y - 70 : it.key === 'gate' ? it.y - 70 : it.y - 50;
      this.ui.setPrompt(PROMPT[it.key] || 'Xem', r.left + (it.x - cam.scrollX) * z, r.top + (wy - cam.scrollY) * z);
    } else this.ui.setPrompt(null);
    // ---- ambience
    const ts = time / 1000;
    for (const f of this.foliage) f.img.x = f.x0 + Math.round(Math.sin(ts * f.f + f.ph) * f.amp);
    this.updatePond(delta);
    this.cloudBack.tilePositionX = Math.round(cam.scrollX * 0.5 + time * 0.004); this.cloudBack.tilePositionY = Math.round(cam.scrollY * 0.5);
    this.peaks.y = Math.round(this.meta.cliffBottom - 90 - 0.4 * Math.max(0, this.H - cam.height));
    this.seaDrift.tilePositionX = time * 0.006;
    this.mistBands.forEach((m, i) => { m.tilePositionX = time * (0.009 + i * 0.003) + i * 77; });
    this.fogA.tilePositionX = cam.scrollX * 0.4 + time * 0.007; this.fogA.tilePositionY = cam.scrollY * 0.4;
    this.fogB.tilePositionX = cam.scrollX * 0.25 - time * 0.004; this.fogB.tilePositionY = cam.scrollY * 0.25 + time * 0.001;
    for (const g of this.glows) g.g.setAlpha(this.nightK * g.base * (0.86 + 0.14 * Math.sin(ts * 3.1 + g.ph) * Math.sin(ts * 1.7 + g.ph * 2)));
    if (this.cycle) { const nk = 0.5 - 0.5 * Math.cos(ts * 2 * Math.PI / 60); this.nightK = nk; this.applyNight(); const nn = nk > 0.5; if (nn !== this.night) { this.night = nn; this.ui.setDayNight(nn); } }
  }
}
