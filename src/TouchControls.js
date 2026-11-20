import * as Phaser from 'phaser';

// Pixel-style virtual joystick (floating, left half) + action button (bottom-right).
// Everything lives in screen space (scrollFactor 0); size is kept roughly constant in CSS px across zooms.
const CSS_BASE = 128;   // joystick base diameter in CSS px
const R_PIX = 12;       // base radius in texture pixels (texture drawn at 1 game px = 1 texture px)
const DEAD = 0.22;

function pixelCircleTexture(scene, key, r, { fill, fillA, ring, ringA, ringW = 2, inner }) {
  if (scene.textures.exists(key)) return;
  const d = r * 2;
  const c = scene.textures.createCanvas(key, d, d); const ctx = c.getContext();
  const img = ctx.createImageData(d, d);
  const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
    const dist = Math.hypot(x + 0.5 - r, y + 0.5 - r);
    let col = null, a = 0;
    if (dist <= r) {
      if (dist > r - ringW) { col = hex(ring); a = ringA; }
      else if (inner && dist > r - ringW - 1) { col = hex(inner); a = ringA * 0.8; }
      else { col = hex(fill); a = fillA; }
    }
    if (col) { const i = (y * d + x) * 4; img.data.set([...col, Math.round(a * 255)], i); }
  }
  ctx.putImageData(img, 0, 0); c.refresh();
}

export class TouchControls {
  constructor(scene, { onAction, onDialogTap, dialogRect }) {
    this.scene = scene; this.onAction = onAction; this.onDialogTap = onDialogTap; this.dialogRect = dialogRect;
    this.vec = new Phaser.Math.Vector2(0, 0);   // analog direction, length 0 or 1
    this.mag = 0;                               // deflection 0..1 (0 inside the dead zone): small = walk, large = run
    this.joyId = null; this.btnId = null; this.enabled = false;
    scene.input.addPointer(2);                  // 3 pointers total -> joystick + button + spare

    pixelCircleTexture(scene, 'joy_base', R_PIX, { fill: 0x14161c, fillA: 0.30, ring: 0xecc96b, ringA: 0.55, inner: 0x4e341e });
    pixelCircleTexture(scene, 'joy_knob', 6, { fill: 0xecf0ec, fillA: 0.55, ring: 0xecc96b, ringA: 0.8, ringW: 1 });
    pixelCircleTexture(scene, 'btn_e', 11, { fill: 0x14161c, fillA: 0.45, ring: 0xc9993a, ringA: 0.85, inner: 0x4e341e });

    const D = 9700;
    this.base = scene.add.image(0, 0, 'joy_base').setScrollFactor(0).setDepth(D);
    this.knob = scene.add.image(0, 0, 'joy_knob').setScrollFactor(0).setDepth(D + 1);
    this.btn = scene.add.image(0, 0, 'btn_e').setScrollFactor(0).setDepth(D);
    this.btnLabel = scene.add.text(0, 0, 'E', { fontFamily: 'Galmuri11, monospace', fontSize: '12px', color: '#ecc96b' })
      .setOrigin(0.5, 0.55).setScrollFactor(0).setDepth(D + 1);
    this.objs = [this.base, this.knob, this.btn, this.btnLabel];

    const inp = scene.input;
    inp.on('pointerdown', this.down, this);
    inp.on('pointermove', this.move, this);
    inp.on('pointerup', this.up, this);
    inp.on('pointerupoutside', this.up, this);
    inp.on('gameout', () => this.release());
    this.layout();
    this.setEnabled(false);
  }

  setEnabled(on) {
    this.enabled = on;
    this.objs.forEach(o => o.setVisible(on)); this.btn.setAlpha(0.8);
    if (!on) this.release();
  }

  layout() {
    const s = this.scene.scale, z = s.zoom || 1;
    // integer texture scale so the base is ~CSS_BASE css px wide
    this.k = Math.max(1, Math.round(CSS_BASE / (R_PIX * 2 * z)));
    const k = this.k, W = s.width, H = s.height;
    this.R = R_PIX * k;                              // radius in game px
    this.home = { x: Math.round(this.R + 14 * k / 2 + 8), y: Math.round(H - this.R - 14 * k / 2 - 8) };
    const kb = Math.max(1, Math.round(92 / (22 * z)));          // E button ~92 css px
    this.base.setScale(k); this.knob.setScale(k); this.btn.setScale(kb); this.btnLabel.setScale(kb);
    this.btnR = 11 * kb;
    this.btnPos = { x: Math.round(W - this.btnR - 10 * k / 2 - 10), y: Math.round(H - this.btnR - 10 * k / 2 - 14) };
    this.btn.setPosition(this.btnPos.x, this.btnPos.y); this.btnLabel.setPosition(this.btnPos.x, this.btnPos.y);
    if (this.joyId === null) this.placeIdle();
  }

  placeIdle() {
    this.base.setPosition(this.home.x, this.home.y).setAlpha(0.45);
    this.knob.setPosition(this.home.x, this.home.y).setAlpha(0.45);
  }

  hitButton(p) { return Phaser.Math.Distance.Between(p.x, p.y, this.btnPos.x, this.btnPos.y) <= this.btnR * 1.25; }

  down(p) {
    if (!this.enabled) {
      if (p.wasTouch) { this.scene.enableTouchUI?.(); } else return;
    }
    if (this.hitButton(p)) {
      this.btnId = p.id; this.btn.setTint(0xfff2c0).setAlpha(1); this.btnLabel.setY(this.btnPos.y + this.k);
      this.onAction(); return;
    }
    const r = this.dialogRect();
    if (r && r.contains(p.x, p.y)) { this.onDialogTap(); return; }
    if (this.joyId === null && p.x < this.scene.scale.width / 2) {
      this.joyId = p.id;
      const x = Phaser.Math.Clamp(p.x, this.R, this.scene.scale.width / 2), y = Phaser.Math.Clamp(p.y, this.R, this.scene.scale.height - this.R);
      this.origin = { x, y };
      this.base.setPosition(x, y).setAlpha(1); this.knob.setPosition(x, y).setAlpha(1);
      this.move(p);
    }
  }

  move(p) {
    if (p.id !== this.joyId) return;
    const dx = p.x - this.origin.x, dy = p.y - this.origin.y;
    const len = Math.hypot(dx, dy), R = this.R;
    const cl = Math.min(len, R);
    const nx = len ? dx / len : 0, ny = len ? dy / len : 0;
    this.knob.setPosition(Math.round(this.origin.x + nx * cl), Math.round(this.origin.y + ny * cl));
    if (len / R < DEAD) { this.vec.set(0, 0); this.mag = 0; } else { this.vec.set(nx, ny); this.mag = Math.min(1, len / R); }   // normalised direction + deflection
  }

  up(p) {
    if (this.enabled && p.wasTouch) this.requestFullscreen();   // touchend counts as a user gesture
    if (p.id === this.joyId) { this.joyId = null; this.vec.set(0, 0); this.mag = 0; this.placeIdle(); }
    if (p.id === this.btnId) { this.btnId = null; this.btn.clearTint().setAlpha(0.8); this.btnLabel.setY(this.btnPos.y); }
  }

  release() {
    this.joyId = null; this.btnId = null; this.vec.set(0, 0); this.mag = 0;
    this.btn?.clearTint(); if (this.home) this.placeIdle();
  }

  requestFullscreen() {
    if (this.triedFs) return; this.triedFs = true;
    const s = this.scene.scale;
    try { if (s.fullscreen?.available && !s.isFullscreen) s.startFullscreen(); } catch (e) { /* not allowed */ }
  }
}
