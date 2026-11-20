import * as Phaser from 'phaser';
import { DIALOGS } from './dialogs.js';
import { UI, RUN_AT } from './ui.js';
import { isTouchDevice } from './view.js';

const WALK_SPEED = 58;       // px / s (walk 8f x 100ms)
const RUN_SPEED = 118;       // px / s (run 8f x 75ms)
const TALK_RANGE = 34;       // px between feet
const DIRS = ['down', 'left', 'right', 'up'];   // NPC sheet order
// Đạo sĩ trẻ atlas (export/dao_si.json): frames dao_si_<anim>_<dir>_<kk>, 8 directions
const DIR8 = ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'];   // by angle, 45deg steps from +x (y down)
const ANIMS = { idle: { n: 6, ms: 150, repeat: -1 }, walk: { n: 8, ms: 100, repeat: -1 }, run: { n: 8, ms: 75, repeat: -1 }, interact: { n: 8, ms: 90, repeat: 0 } };
const HF = (dir, anim = 'idle', i = 0) => `dao_si_${anim}_${dir}_${String(i).padStart(2, '0')}`;
const dir8 = (x, y) => DIR8[((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8];

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  preload() {
    this.load.tilemapTiledJSON('map', 'assets/map.json');
    this.load.image('tiles', 'assets/tileset32.png');
    this.load.atlas('props', 'assets/props.png', 'assets/props.json');
    this.load.json('propsMeta', 'assets/props_meta.json');
    this.load.atlas('hero', 'assets/dao_si.png', 'assets/dao_si.json');
    this.load.image('mist', 'assets/mist.png');
    this.load.image('cloudsea', 'assets/cloudsea.png');
    this.load.spritesheet('npc', 'assets/npc_trasu.png', { frameWidth: 64, frameHeight: 64 });
  }

  create() {
    this.makeSmallTextures();

    // ---------- map
    const map = this.make.tilemap({ key: 'map' });
    const ts = map.addTilesetImage('tienson32', 'tiles');
    this.ground = map.createLayer('ground', ts, 0, 0).setDepth(-10);
    this.colLayer = map.createLayer('collision', ts, 0, 0).setVisible(false);
    this.colLayer.setCollisionByExclusion([-1]);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    // south edge: the map's last rows are flat 'void' tiles (read as an empty grey band). Close the cliff-face corners and lay a
    // drifting sea of clouds over the void; the camera only shows a strip of it below the cliff.
    this.cliffBottom = 0;
    this.ground.forEachTile(t => { if (t.index > 0 && this.voidIndex === undefined && t.y === map.height - 1) this.voidIndex = t.index; });
    for (let y = map.height - 1; y >= 0; y--) {
      const row = []; for (let x = 0; x < map.width; x++) row.push(this.ground.getTileAt(x, y).index);
      if (row.filter(i => i === this.voidIndex).length < map.width / 2) { this.cliffBottom = (y + 1) * 32; break; }
    }
    for (let x = 0; x < map.width; x++) {                      // corner void tiles in the last cliff row -> neighbouring cliff face
      const cy = this.cliffBottom / 32 - 1, t = this.ground.getTileAt(x, cy);
      if (t.index === this.voidIndex) { const n = this.ground.getTileAt(x === 0 ? 2 : x - 2, cy) || this.ground.getTileAt(x + 2, cy); this.ground.putTileAt(n.index, x, cy); }
    }
    const seaH = map.heightInPixels - this.cliffBottom + 40;
    this.sea = this.add.tileSprite(0, this.cliffBottom, map.widthInPixels, seaH, 'cloudsea').setOrigin(0).setDepth(-9);
    this.seaFront = this.add.tileSprite(0, this.cliffBottom + 22, map.widthInPixels, seaH, 'cloudsea').setOrigin(0).setDepth(-8).setAlpha(0.35).setTilePosition(171, 60);
    this.viewBottom = Math.min(map.heightInPixels, this.cliffBottom + 56);

    const colliders = this.physics.add.staticGroup();
    for (const o of map.getObjectLayer('colliders').objects) {
      if (o.type === 'walkable') {
        // bridge deck: remove water collision underneath
        this.colLayer.forEachTile(t => t.setCollision(false, false, false, false), this,
          Math.floor(o.x / 32), Math.floor(o.y / 32), Math.ceil(o.width / 32), Math.ceil(o.height / 32));
      } else if (o.type === 'collider') {
        colliders.add(this.add.zone(o.x + o.width / 2, o.y + o.height / 2, o.width, o.height));
      }
    }

    // ---------- props (y-sorted)
    const meta = this.cache.json.get('propsMeta');
    this.interactables = [];
    for (const o of map.getObjectLayer('props').objects) {
      const key = o.properties.find(p => p.name === 'key').value;
      const m = meta[key];
      const s = this.add.image(Math.round(o.x), Math.round(o.y), 'props', key).setOrigin(0.5, m.oy);
      s.setDepth(key === 'bridge' || key === 'koi_pond' ? -5 : o.y);   // flat things lie under every actor
      if (DIALOGS[key]) this.interactables.push({ x: o.x, y: o.y + 4, key, range: key === 'shrine' ? 60 : key === 'koi_pond' ? 72 : 30 });
      if (key === 'incense') this.addIncenseSmoke(o.x, o.y - 30);
      if (key === 'stone_lantern') this.addGlow(o.x, o.y - 31);
      if (key.startsWith('lantern_post')) this.addGlow(o.x + 4, o.y - 40);
    }

    // ---------- hero
    for (const [a, c] of Object.entries(ANIMS)) for (const d of DIR8) {
      this.anims.create({
        key: `${a}_${d}`,
        frames: this.anims.generateFrameNames('hero', { prefix: `dao_si_${a}_${d}_`, start: 0, end: c.n - 1, zeroPad: 2 }),
        frameRate: 1000 / c.ms, repeat: c.repeat,
      });
    }
    const actors = map.getObjectLayer('actors').objects;
    const spawn = actors.find(a => a.type === 'spawn');
    this.player = this.physics.add.sprite(spawn.x, spawn.y, 'hero', HF('up'));
    this.player.setOrigin(32 / 64, 61 / 64);     // atlas pivot (32,61): soles
    this.player.body.setSize(14, 8).setOffset(25, 54);
    this.player.on('animationcomplete', (anim) => { if (anim.key.startsWith('interact_')) this.endInteract(); });
    this.player.setCollideWorldBounds(true);
    this.facing = 'up'; this.acting = false;
    this.player.anims.play('idle_up');
    this.player.shadow = this.add.image(0, 0, 'shadow').setDepth(-4);

    // ---------- NPC "Trà Sư" (placeholder: palette-swapped hero idle frames)
    const npcObj = actors.find(a => a.type === 'npc');
    this.npc = this.add.sprite(npcObj.x, npcObj.y, 'npc', 1).setOrigin(0.5, 62 / 64).setDepth(npcObj.y);
    this.npc.shadow = this.add.image(npcObj.x, npcObj.y - 1, 'shadow').setDepth(-4);
    colliders.add(this.add.zone(npcObj.x, npcObj.y - 4, 16, 10));
    this.interactables.push({ x: npcObj.x, y: npcObj.y, key: 'tra_su', range: TALK_RANGE, npc: true });

    this.physics.add.collider(this.player, this.colLayer);
    this.physics.add.collider(this.player, colliders);

    // ---------- camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, this.viewBottom);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setRoundPixels(true);

    // ---------- ambience: two drifting mist layers + falling plum petals
    this.mistA = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'mist').setOrigin(0).setScrollFactor(0).setDepth(9000).setAlpha(0.22);
    this.mistB = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'mist').setOrigin(0).setScrollFactor(0).setDepth(9001).setAlpha(0.12).setTileScale(2, 2);
    this.petals = this.add.particles(0, 0, 'petal', {
      x: { min: -40, max: 1300 }, y: -8,
      lifespan: 10000, frequency: 380, quantity: 1,
      speedX: { min: -16, max: 4 }, speedY: { min: 9, max: 18 },
      rotate: { start: 0, end: 360 }, alpha: { start: 1, end: 0.3 },
      frame: ['a', 'b'],
    }).setScrollFactor(0).setDepth(8999);
    this.petals.fastForward?.(9000);


    // ---------- input
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,SHIFT');
    this.input.keyboard.on('keydown-E', () => this.onInteract());
    this.input.keyboard.on('keydown-SPACE', () => this.onInteract());
    this.ui = new UI({ onAction: () => this.onInteract(), onDialogTap: () => this.onInteract() });
    this.touch = this.ui;
    this.ui.onTouchMode = () => { this.touchMode = true; };
    if (isTouchDevice()) this.ui.enableTouch();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    window.__scene = this;
  }

  onResize() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setSize(W, H);
    this.mistA.setSize(W, H); this.mistB.setSize(W, H);
  }

  makeSmallTextures() {
    const c = this.textures.createCanvas('petal', 7, 3);
    const ctx = c.getContext();
    ctx.fillStyle = '#e58a96'; ctx.fillRect(0, 0, 3, 2); ctx.fillStyle = '#f7c3c6'; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = '#c9454f'; ctx.fillRect(4, 0, 2, 3); ctx.fillStyle = '#e58a96'; ctx.fillRect(5, 0, 1, 1);
    c.refresh(); c.add('a', 0, 0, 0, 3, 2); c.add('b', 0, 4, 0, 2, 3);
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff); g.fillRect(0, 0, 2, 2); g.generateTexture('dot', 2, 2); g.clear();
    g.fillStyle(0x0b0a09, 0.3); g.fillEllipse(9, 3, 18, 6); g.generateTexture('shadow', 18, 6); g.clear();
    for (let r = 12; r > 0; r -= 3) { g.fillStyle(0xecc96b, 0.08); g.fillCircle(12, 12, r); }
    g.generateTexture('glow', 24, 24); g.destroy();
  }

  addIncenseSmoke(x, y) {
    this.add.particles(x, y, 'dot', {
      lifespan: 2800, frequency: 240, speedY: { min: -10, max: -6 }, speedX: { min: -2, max: 3 },
      alpha: { start: 0.55, end: 0 }, scale: { start: 0.7, end: 1.6 },
    }).setDepth(y + 40);
  }

  addGlow(x, y) {
    const g = this.add.image(x, y, 'glow').setDepth(8000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: g, alpha: 0.55, duration: 1200 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
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
    if (this.dialog) {
      if (this.typing) { this.typing = false; this.ui.setDialog(this.dialog.lines[this.dialog.i].who, this.full, true); return; }
      this.dialog.i++;
      if (this.dialog.i >= this.dialog.lines.length) { this.dialog = null; this.ui.showDialog(false); return; }
      this.showLine();
      return;
    }
    if (this.acting) return;
    const it = this.nearest();
    // face the target (8-way), play the one-shot interact gesture; dialog opens when it completes (endInteract)
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
    this.dialog = { lines: DIALOGS[it.key], i: 0, it };
    if (it.npc) { // NPC turns to face the player
      const dx = this.player.x - this.npc.x, dy = this.player.y - this.npc.y;
      this.npc.setFrame(DIRS.indexOf(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')));
    }
    this.player.setVelocity(0, 0);
    this.ui.showDialog(true); this.showLine();
  }

  showLine() {
    const l = this.dialog.lines[this.dialog.i];
    this.full = l.text; this.shown = 0; this.typing = true; this.ui.setDialog(l.who, '', false);
  }

  update(time, delta) {
    const k = this.keys, p = this.player, cam = this.cameras.main;
    this.mistA.tilePositionX = cam.scrollX * 0.35 + time * 0.006; this.mistA.tilePositionY = cam.scrollY * 0.35 + time * 0.002;
    this.mistB.tilePositionX = cam.scrollX * 0.2 - time * 0.003; this.mistB.tilePositionY = cam.scrollY * 0.2;
    if (this.typing) {
      this.shown += delta * 0.045;
      const n = Math.min(this.full.length, Math.floor(this.shown));
      if (n >= this.full.length) this.typing = false;
      if (n !== this.lastN) { this.lastN = n; this.ui.setDialog(this.dialog.lines[this.dialog.i].who, this.full.slice(0, n), !this.typing); }
    }
    let vx = 0, vy = 0, run = false;
    if (!this.dialog && !this.acting) {
      if (k.LEFT.isDown || k.A.isDown) vx -= 1;
      if (k.RIGHT.isDown || k.D.isDown) vx += 1;
      if (k.UP.isDown || k.W.isDown) vy -= 1;
      if (k.DOWN.isDown || k.S.isDown) vy += 1;
      run = k.SHIFT.isDown;
      if (!vx && !vy && this.touch && this.touch.mag > 0) { vx = this.touch.vec.x; vy = this.touch.vec.y; run = this.touch.mag >= RUN_AT; }
    }
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      const sp = run ? RUN_SPEED : WALK_SPEED;
      p.setVelocity((vx / len) * sp, (vy / len) * sp);   // diagonal normalised
      const nd = dir8(vx, vy);                          // 8-way facing from the stick / key angle
      if (nd !== this.facing) { this.prevFacing = this.facing; this.facingAt = time; this.facing = nd; }
      p.anims.play(`${run ? 'run' : 'walk'}_${this.facing}`, true);
    } else {
      p.setVelocity(0, 0);
      // releasing a diagonal (two keys / thumb sliding off) passes through a cardinal for a frame or two: keep the diagonal
      if (this.wasMoving && this.prevFacing && time - this.facingAt < 90 && this.prevFacing.includes('_')) this.facing = this.prevFacing;
      if (!this.acting) p.anims.play(`idle_${this.facing}`, true);   // breathing idle keeps the last facing
    }
    this.wasMoving = len > 0;
    p.setDepth(p.y);
    p.shadow.setPosition(Math.round(p.x), Math.round(p.y) - 1);
    // petals sway
    this.petals.forEachAlive?.((pt) => { pt.velocityX += Math.sin((pt.lifeCurrent + pt.y * 13) * 0.0015) * 0.08; });
    const it = !this.dialog && this.nearest();
    if (it) {   // world -> CSS px for the DOM prompt
      const z = this.scale.zoom, r = this.game.canvas.getBoundingClientRect();
      const wx = it.x, wy = it.npc ? it.y - 60 : it.y - 30;
      this.ui.setPrompt(it.npc ? 'Nói chuyện' : 'Xem', r.left + (wx - cam.scrollX) * z, r.top + (wy - cam.scrollY) * z);
    } else this.ui.setPrompt(null);
    this.sea.tilePositionX = time * 0.004; this.seaFront.tilePositionX = 171 - time * 0.007;
  }
}
