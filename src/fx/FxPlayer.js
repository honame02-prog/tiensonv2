// FxPlayer: phat hieu ung skill dieu khien bang cue JSON. Xem design/tienson/02-fxplayer-api.md.
import * as Phaser from 'phaser';
import { FX_PALETTE, resolveColor } from './palette.js';
import { makeFxTextures, lightTex, ringTex, columnTex } from './textures.js';
import { CUES } from './cues/index.js';

// Do sau cho SectScene (Tien Son day du): ground -100, bong -70, actor = y, suong 8600-9000, lop dem MULTIPLY 9000, den long 9001, UI la DOM (z-index 10).
// ground: tren bong (-70), duoi moi actor. light: ADD tren lop dem de phat sang ban dem. overlay: tren lop dem, duoi UI (UI la DOM nen luon tren canvas).
// dimBelow: dim chi to cac doi tuong co depth < gia tri nay (suong the gioi 8600+, lop dem, den long, overlay bi loai).
// lightDay: ban ngay anh sang cong nam ngay tren ground, duoi actor; ban dem (isNight() true) len light (tren lop dem). Doi theo tung khung hinh nen dung ca khi dang phat.
const DEFAULT_DEPTHS = { ground: -60, lightDay: -59, light: 9100, overlay: 9500, dimBelow: 8600 };
const BLEND = { add: Phaser.BlendModes.ADD, normal: Phaser.BlendModes.NORMAL };
const easeFn = e => Phaser.Tweens.Builders.GetEaseFunction(e || 'Linear');
const lerp = (a, b, t) => a + (b - a) * t;
const now = () => performance.now();

// so hoac mang keyframe deu nhau -> gia tri tai t (0..1)
function kf(v, t, fb) {
  if (v === undefined) v = fb;
  if (!Array.isArray(v)) return v;
  if (v.length === 1) return v[0];
  const f = Math.min(Math.max(t, 0), 1) * (v.length - 1), i = Math.min(Math.floor(f), v.length - 2);
  return lerp(v[i], v[i + 1], f - i);
}

export class FxPlayer {
  // GD4: atlas Aseprite (SkillFX tools/phaser-atlas.mjs) o assets/fx/<atlas>.{png,json}; cue co the ghi atlasUrl/atlasJson de doi duong dan.
  static atlasUrls(tr) { const k = tr.atlas; return { img: tr.atlasUrl || `assets/fx/${k}.png`, json: tr.atlasJson || `assets/fx/${k}.json` }; }
  static preload(scene, cueList = []) {
    for (const c of cueList) for (const tr of (c.tracks || [])) {
      if (tr.type !== 'anim' || !tr.atlas || tr.off || scene.textures.exists(tr.atlas)) continue;
      const u = FxPlayer.atlasUrls(tr);
      scene.load.aseprite(tr.atlas, u.img, u.json);
    }
  }

  constructor(scene, { palette = FX_PALETTE, maxParticles = 300, depths = {}, isNight = () => false } = {}) {
    this.isNight = isNight;
    this.D = { ...DEFAULT_DEPTHS, ...depths };
    this.scene = scene; this.palette = palette; this.maxParticles = maxParticles;
    this.cues = { ...CUES };
    this.runs = new Set(); this._free = []; this._inUse = 0; this._emitters = new Set();
    this._dims = new Set(); this._dimTargets = null; this._dimV = 255;
    this._hitUntil = 0; this._frozen = false; this._capped = false; this._alive = 0; this._warned = new Set();
    this._atlasOk = new Set(); this._atlasWait = new Map();
    makeFxTextures(scene);
    for (const c of Object.values(this.cues)) this.warm(c);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this._update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }


  // ---- atlas anim (GD4). Sau khi nap xong, tao anim 1 lan / atlas (anim key = ten frameTag, toan cuc).
  hasAtlas(key) {
    if (this._atlasOk.has(key)) return true;
    const sc = this.scene;
    if (!sc.textures.exists(key) || !sc.cache.json.exists(key)) return false;
    for (const t of (sc.cache.json.get(key).meta?.frameTags || [])) if (!sc.anims.exists(t.name)) sc.anims.createFromAseprite(key, [t.name]);
    this._atlasOk.add(key);
    return true;
  }
  // nap atlas luc chay (FxLab chon atlas khac); tra Promise<boolean>
  ensureAtlas(key, urls) {
    if (this.hasAtlas(key)) return Promise.resolve(true);
    if (this._atlasWait.has(key)) return this._atlasWait.get(key);
    const sc = this.scene, u = urls || FxPlayer.atlasUrls({ atlas: key });
    const p = new Promise(res => {
      const done = () => { this._atlasWait.delete(key); res(this.hasAtlas(key)); };
      sc.load.aseprite(key, u.img, u.json);
      sc.load.once('complete', done);
      sc.load.start();
    });
    this._atlasWait.set(key, p);
    return p;
  }
  // do dai (ms) cua track anim: tr.dur, hoac do dai tag (theo tr.fps neu co)
  animDur(tr) {
    if (tr.dur !== undefined) return tr.dur;
    if (!this.hasAtlas(tr.atlas)) return 0;
    const a = this.scene.anims.get(tr.anim);
    if (!a) return 0;
    return tr.fps ? a.frames.length / tr.fps * 1000 : a.duration;
  }

  lightDepth() { return this.isNight() ? this.D.light : this.D.lightDay; }

  register(cue) { this.cues[cue.id] = cue; this.warm(cue); }

  // sinh san texture ring/cot cho cue (tranh giat o lan phat dau)
  warm(cue, ramp = cue.ramp) {
    for (const tr of cue.tracks) {
      if (tr.off) continue;
      if (tr.type === 'ring') {
        const [a, b] = tr.grow || [tr.rx, tr.rx];
        for (let r = this._q(Math.min(a, b)); r <= this._q(Math.max(a, b)); r += 4) ringTex(this.scene, r, tr.width || 2);
      } else if (tr.type === 'column') columnTex(this.scene, tr.ramp || ramp, tr.w, tr.h, this.palette);
      else if (tr.type === 'anim') this.hasAtlas(tr.atlas);   // tao anim tu atlas da nap (neu chua nap: bo qua)
    }
  }
  _q(r) { return Math.max(8, Math.round(r / 4) * 4); }

  play(cueOrId, opts = {}) {
    const cue = typeof cueOrId === 'string' ? this.cues[cueOrId] : cueOrId;
    if (!cue) throw new Error(`FX: khong co cue "${cueOrId}"`);
    const run = new Run(this, cue, opts);
    if (!run.dead) this.runs.add(run);
    return run.handle;
  }

  stats() {
    let particles = 0;
    for (const e of this._emitters) particles += e.getAliveParticleCount();
    return { active: this.runs.size, particles, objects: this._inUse + this._emitters.size };
  }

  // ---- pool
  _img(tex) {
    let im = this._free.pop();
    if (!im) { im = this.scene.add.image(0, 0, tex); im.__fx = true; }
    im.setTexture(tex).setVisible(true).setActive(true).setOrigin(0.5, 0.5).setScale(1).setAlpha(1).setAngle(0).clearTint().setFlip(false, false).setScrollFactor(1);
    im.setBlendMode(Phaser.BlendModes.NORMAL);
    this._inUse++;
    return im;
  }
  _put(im) {
    if (!im) return;
    this._inUse--;
    if (this._free.length >= 48) { im.destroy(); return; }
    im.setVisible(false).setActive(false);
    this._free.push(im);
  }
  _emitter(x, y, tex, cfg) {
    const e = this.scene.add.particles(x, y, tex, cfg); e.__fx = true;
    this._emitters.add(e);
    return e;
  }
  _killEmitter(e) { if (this._emitters.delete(e)) e.destroy(); }

  // ---- hitstop / dim (toan cuc, dong ho that)
  _hitstop(ms) { this._hitUntil = Math.max(this._hitUntil, now() + ms); }
  _applyFreeze() {
    const frozen = now() < this._hitUntil;
    if (frozen === this._frozen) return;
    this._frozen = frozen;
    const s = this.scene;
    if (frozen) {
      this._sv = { anim: s.anims.globalTimeScale, tw: s.tweens.timeScale, ph: !!(s.physics?.world && !s.physics.world.isPaused) };
      s.anims.globalTimeScale = 0; s.tweens.timeScale = 0;
      if (this._sv.ph) s.physics.world.pause();
    } else if (this._sv) {
      s.anims.globalTimeScale = this._sv.anim; s.tweens.timeScale = this._sv.tw;
      if (this._sv.ph) s.physics.world.resume();
      this._sv = null;
    }
  }
  _applyDim() {
    let lv = 0;
    for (const d of this._dims) lv = Math.max(lv, d.level);
    const v = lv <= 0 ? 255 : Math.max(0, Math.round(255 * (1 - lv) / 8) * 8);   // luong tu hoa: tile tint ton CPU
    if (v === this._dimV) return;
    if (!this._dimTargets) {
      // loai: FX, scrollFactor 0 (troi nen, suong man hinh), depth >= dimBelow (suong the gioi, lop dem, den long, overlay); luu 4 goc tint goc de tra lai
      const lim = this.D.dimBelow;
      this._dimTargets = this.scene.children.list
        .filter(o => !o.__fx && o.visible && o.scrollFactorX !== 0 && o.depth < lim && typeof o.setTint === 'function' && o.tintMode === Phaser.TintModes.MULTIPLY)
        .map(o => ({ o, tl: o.tintTopLeft, tr: o.tintTopRight, bl: o.tintBottomLeft, br: o.tintBottomRight }));
    }
    this._dimV = v;
    const m = c => ((((c >> 16) & 255) * v / 255 | 0) << 16) | ((((c >> 8) & 255) * v / 255 | 0) << 8) | ((c & 255) * v / 255 | 0);
    for (const t of this._dimTargets) {
      const o = t.o;
      if (!o.scene) continue;
      if (v === 255) { o.tintTopLeft = t.tl; o.tintTopRight = t.tr; o.tintBottomLeft = t.bl; o.tintBottomRight = t.br; }
      else { o.tintTopLeft = m(t.tl); o.tintTopRight = m(t.tr); o.tintBottomLeft = m(t.bl); o.tintBottomRight = m(t.br); }
    }
    if (v === 255) this._dimTargets = null;
  }

  _update(time, delta) {
    const dt = Math.min(delta, 100);
    this._applyFreeze();
    let total = 0;
    for (const e of this._emitters) { total += e.getAliveParticleCount(); e.timeScale = this._frozen ? 0 : 1; }
    this._capped = total >= this.maxParticles; this._alive = total;
    for (const r of [...this.runs]) r.step(this._frozen ? 0 : dt);
    if (this._dims.size || this._dimV !== 255) this._applyDim();
  }

  destroy() {
    for (const r of [...this.runs]) r.kill();
    for (const im of this._free) im.destroy();
    this._free.length = 0;
    this._dims.clear(); this._applyDim();
    this._hitUntil = 0; this._applyFreeze();
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this._update, this);
  }
}

class Run {
  constructor(fx, cue, opts) {
    this.fx = fx; this.cue = cue; this.opts = opts;
    this.S = opts.scale ?? 1; this.ramp = opts.ramp || cue.ramp;
    this.x = Math.round(opts.x ?? 0); this.y = Math.round(opts.y ?? 0);
    this.t = 0; this.live = []; this.dead = false;
    this.pending = cue.tracks.filter(t => !t.off).sort((a, b) => (a.at || 0) - (b.at || 0));
    this.duration = cue.duration ?? Math.max(0, ...cue.tracks.filter(t => !t.off).map(t => (t.at || 0) + (t.type === 'anim' ? fx.animDur(t) : (t.dur || 0))));
    this.done = new Promise(r => { this._res = r; });
    this.handle = { id: cue.id, done: this.done, stop: () => this.kill() };
    fx.runs.add(this);
    this.step(0);   // khoi dong cac track at=0 ngay
  }
  color(tok) { return resolveColor(tok, this.ramp, this.fx.palette); }
  depth(layer, def, type) {
    const l = layer || def, D = this.fx.D;
    if (l === 'overlay') return D.overlay;
    if (type === 'light') return this.fx.lightDepth();   // ngay: tren ground, duoi actor; dem: tren lop dem
    if (l === 'ground') return D.ground;
    // GD5: 'behind' / 'front' theo y chan muc tieu: actor co depth = y, nen y-1 nam ngay sau than, y+1 ngay truoc than
    if (l === 'behind') return this.y - 1;
    if (l === 'front') return this.y + 1;
    return this.y + 0.5;
  }

  step(dt) {
    if (this.dead) return;
    this.t += dt;
    while (this.pending.length && (this.pending[0].at || 0) <= this.t) {
      const tr = this.pending.shift();
      const inst = this.start(tr);
      if (inst) { inst.t0 = tr.at || 0; this.live.push(inst); }
    }
    const over = this.t >= this.duration;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const inst = this.live[i];
      const lt = this.t - inst.t0, p = inst.dur > 0 ? Math.min(lt / inst.dur, 1) : 1;
      inst.update?.(p, lt);
      if ((lt >= inst.dur || over) && (!inst.drained || inst.drained())) { inst.release?.(); this.live.splice(i, 1); }
    }
    if (over && !this.live.length) this.finish();
    else if (this.t >= this.duration + 4000) this.kill();   // chong treo
  }

  finish() {
    if (this.dead) return;
    this.dead = true; this.fx.runs.delete(this); this._res();
  }
  kill() {
    if (this.dead) return;
    for (const inst of this.live) inst.release?.();
    this.live.length = 0; this.pending.length = 0;
    this.finish();
  }

  start(tr) {
    const fx = this.fx, S = this.S, ease = easeFn(tr.ease);
    const ax = this.x + Math.round((tr.x || 0) * S), ay = this.y + Math.round((tr.y || 0) * S);
    const blend = BLEND[tr.blend || (tr.type === 'light' ? 'add' : 'normal')];
    const mkImg = (tex, layer, def) => {
      const im = fx._img(tex).setPosition(ax, ay).setDepth(this.depth(layer, def, tr.type)).setBlendMode(blend);
      if (tr.color !== undefined && tr.type !== 'column') im.setTint(this.color(tr.color));
      return im;
    };
    switch (tr.type) {
      case 'light': {
        const ground = (tr.layer || 'ground') === 'ground';
        const rx = tr.rx * S, ry = (tr.ry ?? (ground ? tr.rx * 0.5 : tr.rx)) * S;
        const size = tr.rx > 40 ? 128 : 64, power = tr.power ?? 1;
        const im = mkImg(lightTex(fx.scene, size), tr.layer, 'ground'), ov = tr.layer === 'overlay';
        return { dur: tr.dur, release: () => fx._put(im), update: p => {
          const q = ease(p), s = kf(tr.scale, q, 1);
          if (!ov) im.setDepth(fx.lightDepth());
          im.setAlpha(Math.min(1, kf(tr.alpha, q, [0, 1, 0]) * power)).setScale(rx * 2 / size * s, ry * 2 / size * s);
        } };
      }
      case 'decal': {
        const im = mkImg('fx_decal', tr.layer, 'ground'), rx = tr.rx * S;
        return { dur: tr.dur, release: () => fx._put(im), update: p => {
          const q = ease(p), s = kf(tr.scale, q, 1);
          im.setAlpha(kf(tr.alpha, q, [0, 1, 0])).setScale(rx * 2 / 64 * s, rx / 64 * s);   // nen doc 0,5
        } };
      }
      case 'ring': {
        const im = mkImg('fx_ring', tr.layer, 'ground'), [g0, g1] = tr.grow || [tr.rx, tr.rx];
        return { dur: tr.dur, release: () => fx._put(im), update: p => {
          const q = ease(p);
          im.setTexture(ringTex(fx.scene, fx._q(lerp(g0, g1, q) * S), tr.width || 2)).setAlpha(kf(tr.alpha, q, [1, 1, 0])).setScale(1, 0.5);   // nen doc 0,5
        } };
      }
      case 'column': {
        const im = mkImg(columnTex(fx.scene, tr.ramp || this.ramp, tr.w, tr.h, fx.palette), tr.layer, 'body').setOrigin(0.5, 1);
        if (tr.rotate) im.setAngle(this.opts.angle || 0);
        return { dur: tr.dur, release: () => fx._put(im), update: (p, lt) => {
          const q = ease(p);
          im.setAlpha(kf(tr.alpha, q, 1)).setScale(S * kf(tr.scaleX, q, tr.scale ?? 1), S * kf(tr.scaleY, q, tr.scale ?? 1));
          if (tr.flicker) im.setFlipX(Math.floor(lt / tr.flicker) % 2 === 1);
        } };
      }
      case 'emitter': return this.startEmitter(tr, ax, ay);
      case 'anim': {
        if (!fx.hasAtlas(tr.atlas)) {
          if (!fx._warned.has(tr.atlas)) { fx._warned.add(tr.atlas); console.warn(`FX: thieu atlas "${tr.atlas}" (track anim)`); }
          return null;
        }
        const key = tr.anim || tr.atlas;
        if (!fx.scene.anims.exists(key)) { console.warn(`FX: atlas "${tr.atlas}" khong co anim "${key}"`); return null; }
        // goc: meta.pivot / sourceSize (diem goc hieu ung lay tu SkillFX); cue dat originX/originY thi uu tien
        const data = fx.scene.cache.json.get(tr.atlas), pv = data.meta?.pivot, sz = data.frames['0']?.sourceSize;
        // tr.anchor === 'impact' va atlas co meta.impact {x,y}: goc = diem trung (vd vu no cu dam) => diem dat cue chinh la diem trung, khong phai chan nguoi ra don
        const im = tr.anchor === 'impact' && data.meta?.impact && sz ? data.meta.impact : null;
        const ox = tr.originX ?? (im ? im.x / sz.w : pv && sz ? pv.x / sz.w : 0.5), oy = tr.originY ?? (im ? im.y / sz.h : pv && sz ? pv.y / sz.h : 1);
        const sp = fx.scene.add.sprite(ax, ay, tr.atlas).setOrigin(ox, oy).setDepth(this.depth(tr.layer, 'body')).setScale(S).setBlendMode(blend);
        sp.__fx = true; fx._inUse++;
        if (tr.color !== undefined) sp.setTint(this.color(tr.color));
        if (tr.rotate) sp.setAngle(this.opts.angle || 0);
        sp.play({ key, ...(tr.fps ? { frameRate: tr.fps } : {}), repeat: tr.loop ? -1 : 0 });
        if (!tr.loop) sp.once('animationcomplete', () => sp.setVisible(false));
        return { dur: fx.animDur(tr), update: p => sp.setAlpha(kf(tr.alpha, ease(p), 1)), release: () => { fx._inUse--; sp.destroy(); } };
      }
      case 'tint': {
        // GD5: nhuom doi tuong muc tieu (opts.target, sprite) bang mau cue trong dur (vao `in`, giu, ra `out`), nhan voi tint goc, tra lai khi het
        const o = this.opts.target;
        if (!o || !o.scene || typeof o.setTint !== 'function') return null;
        const orig = [o.tintTopLeft, o.tintTopRight, o.tintBottomLeft, o.tintBottomRight];
        const c = this.color(tr.color ?? 'core'), cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;
        const tin = tr.in ?? 80, out = tr.out ?? 120, amt = tr.amount ?? 1;
        const mix = (base, k) => { const m = (ch, t) => Math.round(ch * (255 + (t - 255) * k) / 255); return (m((base >> 16) & 255, cr) << 16) | (m((base >> 8) & 255, cg) << 8) | m(base & 255, cb); };
        const restore = () => { if (o.scene) { o.tintTopLeft = orig[0]; o.tintTopRight = orig[1]; o.tintBottomLeft = orig[2]; o.tintBottomRight = orig[3]; } };
        return { dur: tr.dur, release: restore, update: (p, lt) => {
          if (!o.scene) return;
          const k = amt * Math.min(1, lt / tin, Math.max(0, (tr.dur - lt) / out));
          o.tintTopLeft = mix(orig[0], k); o.tintTopRight = mix(orig[1], k); o.tintBottomLeft = mix(orig[2], k); o.tintBottomRight = mix(orig[3], k);
        } };
      }
      case 'shake': fx.scene.cameras.main.shake(tr.dur, tr.intensity ?? 0.004); return null;
      case 'flash': {
        const cam = fx.scene.cameras.main, a0 = tr.alpha ?? 0.6;
        const im = fx._img('fx_px1').setOrigin(0, 0).setScrollFactor(0).setDepth(fx.D.overlay).setBlendMode(blend).setPosition(0, 0)
          .setDisplaySize(cam.width, cam.height).setTint(this.color(tr.color ?? 'core'));
        return { dur: tr.dur, release: () => fx._put(im), update: p => im.setAlpha(a0 * (1 - ease(p))) };   // chop roi tat dan
      }
      case 'hitstop': fx._hitstop(tr.dur); return null;
      case 'dim': {
        const d = { level: 0 }, tin = tr.in ?? 150, hold = tr.hold ?? 600, out = tr.out ?? 300, to = tr.to ?? 0.5;
        fx._dims.add(d);
        return { dur: tin + hold + out, release: () => fx._dims.delete(d), update: (p, lt) => {
          d.level = lt < tin ? to * lt / tin : lt < tin + hold ? to : to * Math.max(0, 1 - (lt - tin - hold) / out);
        } };
      }
      case 'event': this.opts.onEvent?.(tr.name, this.handle); return null;
      default: console.warn(`FX: track type la "${tr.type}"`); return null;
    }
  }

  startEmitter(tr, ax, ay) {
    const fx = this.fx, cfg = { ...(tr.config || {}) };
    if (tr.color) { cfg.color = tr.color.map(c => this.color(c)); cfg.colorEase = tr.colorEase || 'quad.out'; }
    if (tr.max) cfg.maxAliveParticles = tr.max;
    if (tr.rotate && cfg.angle && typeof cfg.angle === 'object') {
      const a = this.opts.angle || 0; cfg.angle = { min: cfg.angle.min + a, max: cfg.angle.max + a };
    }
    const burst = cfg.frequency === -1, qty = typeof cfg.quantity === 'number' ? cfg.quantity : 10;
    cfg.emitting = burst ? false : !fx._capped;
    if (tr.blend === 'add') cfg.blendMode = 'ADD';
    const em = fx._emitter(ax, ay, tr.tex || 'fx_px1', cfg).setDepth(this.depth(tr.layer, 'body') + 0.1);
    if (burst) em.explode(Math.max(0, Math.min(qty, fx.maxParticles - fx._alive)));
    return {
      dur: tr.dur, drained: () => em.getAliveParticleCount() === 0,
      update: p => { if (!burst) em.emitting = p < 1 && !fx._capped; },
      release: () => fx._killEmitter(em),
    };
  }
}
