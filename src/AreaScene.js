// AreaScene: canh dung chung cho moi khu vuc (Huyen Van Quan, Son Dao, ...). Du lieu khu = public/assets/areas/<id>/area.json (xem NOTES-AREA.md).
// Nen ve san (ground png, do tools/area_bake.mjs hoac anh goc) + sprite y-sorted (mai/de, tan la), anim moi truong (ca, la lay, khoi huong, suong, bien may),
// chu ky ngay dem voi anh sang den long, cong chuyen khu (fade 250 ms -> scene.restart).
import * as Phaser from 'phaser';
import { UI, RUN_AT } from './ui.js';
import { isTouchDevice } from './view.js';
import { FxPlayer } from './fx/FxPlayer.js';
import { CUES } from './fx/cues/index.js';
import { setupFxDemo } from './fx/fxdemo.js';
import { tierAt, depthOf, tierStepOk, roofTargetAlpha, isRoofFrame, alphaMaskRects, ROOF_FADE_MS } from './areaLayers.js';
import { kitCacheKey, kitTextureKey, kitPieceUrl, validateKit, resolveKitPieces } from './areaKits.js';

const A = 'assets/sect/';              // tai nguyen dung chung (atlas sprite, decal, hinh nen troi, suong)
const DEFAULT_AREA = 'huyen-van-quan';
const FADE_MS = 250;
const WALK_SPEED = 58, RUN_SPEED = 118;
const DIR8 = ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'];
const ANIMS = { idle: { n: 6, ms: 150, repeat: -1 }, walk: { n: 8, ms: 100, repeat: -1 }, run: { n: 8, ms: 75, repeat: -1 }, interact: { n: 8, ms: 90, repeat: 0 } };
const SKILL_ANIM = /^(ketan|kiemchi)_/;   // dong tac ra chieu (atlas hero_skill)
const dir8 = (x, y) => DIR8[((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8];
const FLAT = /^(flower|ground)/;
// collision footprints (w, h) at the sprite foot, per sprite key
const FOOT = { lantern_a: [12, 7], lantern_b: [12, 7], stele_a: [26, 9], stele_b: [26, 9], burner: [32, 12], pine_a: [26, 10], pine_b: [26, 10],
  rock_a: [26, 9], rock_b: [22, 8], rock_c: [16, 6] };

export class AreaScene extends Phaser.Scene {
  constructor() { super('sect'); }

  init(data) {
    const sp = new URLSearchParams(location.search);
    this.areaId = data?.area || sp.get('area') || DEFAULT_AREA;
    this.spawnName = data?.spawn || null; this.fromPortal = !!data?.fromPortal;
    // Phaser tai dung instance scene khi restart -> dat lai toan bo trang thai
    this.busy = false; this.dialog = null; this.typing = false; this.acting = false; this.pendingIt = null; this.wasMoving = false;
    this.fxDemo = null; this.fxLab = null; this.pond = null; this.smoke = null; this.gateRoof = null; this.gatePos = null; this.hallPos = null; this.burnerPos = null;
    this.cloudBack = null; this.peaks = null; this.seaDrift = null; this.portalArmed = false;
    this.tier = 0; this.lastGood = null; this.roofs = [];   // tang dai hien tai (so thuc, noi suy tren bac) + tan/mai mo khi che (K-A4)
    // [editor, chi dev] data.edit = {pieces, kits, at?, play?}: restart tu Area Editor voi du lieu dang sua trong bo nho (khong doc pieces/kits tu area.json). Khong co ?edit=1 -> editData = null, hanh vi nhu cu.
    this.editData = import.meta.env.DEV ? data?.edit || null : null;
    this.editFree = import.meta.env.DEV && sp.get('edit') === '1' && !this.editData?.play;   // che do Sua: dung theo doi + khoa nhan vat
  }

  preload() {
    const id = this.areaId, key = 'area:' + id;
    // area.json truoc, roi moi biet ground nao can nap
    this.load.json(key, `assets/areas/${id}/area.json`);
    this.load.once('filecomplete-json-' + key, () => {
      const ar = this.cache.json.get(key);
      if (this.editData) { ar.pieces = this.editData.pieces.map(p => ({ ...p })); ar.kits = { ...this.editData.kits }; }   // [editor] kit moi (chua co trong khu) cung duoc nap o vong for ben duoi
      this.load.image('ground:' + id, ar.ground);
      for (const [kit, url] of Object.entries(ar.kits || {})) {
        const kk = kitCacheKey(id, kit);
        this.load.once('filecomplete-json-' + kk, () => {
          const data = validateKit(kit, this.cache.json.get(kk));
          for (const [name, p] of Object.entries(data.pieces)) this.load.image(kitTextureKey(id, kit, name), kitPieceUrl(url, p.file));
        });
        this.load.json(kk, url);
      }
      for (const a of ar.atlases || []) {   // goi tai nguyen kem theo khu (vd cliff, forest): atlas + bang kich thuoc/foot
        this.load.atlas(a, `assets/${a}/${a}_atlas.png`, `assets/${a}/${a}_atlas.json`);
        this.load.json('spr:' + a, `assets/${a}/${a}_sprites.json`);
      }
      if (ar.backdrop === 'sect') { this.load.image('peaks', A + 'bg_peaks.png'); this.load.image('cloudBack', A + 'bg_cloud_back.png'); }
    });
    this.load.json('sspr', A + 'sect_sprites.json');
    this.load.atlas('sect', A + 'sect_atlas.png', A + 'sect_atlas.json');
    this.load.atlas('decals', A + 'decals.png', A + 'decals.json');
    this.load.image('mistA', A + 'fx_mist_a.png');
    this.load.image('mistB', A + 'fx_mist_b.png');
    this.load.atlas('hero', 'assets/dao_si.png', 'assets/dao_si.json');
    this.load.atlas('hero_skill', 'assets/dao_si_ketan_kiemchi.png', 'assets/dao_si_ketan_kiemchi.json');   // dong tac ra chieu: ketan_<huong>, kiemchi_<huong>
    this.load.json('hero_skill_json', 'assets/dao_si_ketan_kiemchi.json');
    FxPlayer.preload(this, Object.values(CUES).filter(c => c.id !== 'demo-anim-strike'));   // demo-anim-strike khong con dung trong demo -> khong tai atlas
  }

  create() {
    const id = this.areaId, meta = this.cache.json.get('area:' + id), SP = this.cache.json.get('sspr');
    this.meta = meta; this.SP = SP; this.TEXT = meta.texts || {};
    const feat = meta.features || {};
    const W = this.W = meta.width, H = this.H = meta.height;
    const sp = new URLSearchParams(location.search);
    this.events.once('shutdown', this.onShutdown, this);
    // ---------- backdrop: cloud sea far layer (screen-space parallax), distant peaks, drifting cloud sea, then the baked world
    if (meta.backdrop === 'sect') {
      this.cloudBack = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'cloudBack').setOrigin(0).setScrollFactor(0).setDepth(-200);
      this.peaks = this.add.tileSprite(-400, 0, W + 800, 240, 'peaks').setOrigin(0).setScrollFactor(0.6).setDepth(-190);
      this.seaDrift = this.add.tileSprite(-200, 0, W + 400, H + 200, 'mistB').setOrigin(0).setDepth(-150).setAlpha(0.55).setTileScale(2, 1);
    }
    this.add.image(0, 0, 'ground:' + id).setOrigin(0).setDepth(-100);
    // ---------- decals
    for (const o of meta.objs || []) this.add.image(o.x, o.y, 'decals', o.name).setOrigin(0.5, 1).setDepth(FLAT.test(o.name) ? -80 : o.y);
    // ---------- props (separate sprites, y-sorted; roof/base layers; foliage clusters)
    this.solids = this.physics.add.staticGroup();
    const solid = (x, y, w, h) => this.solids.add(this.add.zone(x, y, w, h));
    this.interactables = []; this.foliage = []; this.lanterns = []; this.ferns = [];
    this.makeAnims();
    this.kitImages = [];
    for (const { o, i } of this.kitEntries()) {
      const p = o.piece, im = this.makeKitImage(o, i);
      if (p.layer === 'roof') this.addRoof(im);
      for (const [x, y, w, h] of p.collide) solid(o.x + x + w / 2, o.y + y + h / 2, w, h);
    }
    for (const p of meta.props || []) {
      const k = p.key, x = Math.round(p.x), y = Math.round(p.y), ci = k.indexOf(':');
      if (ci > 0) {   // khoa dang "atlas:frame" (vd cliff:cliff_n_0, forest:canopy_2): kich thuoc/foot tu <atlas>_sprites.json, pivot giua mep duoi
        const at = k.slice(0, ci), fr = k.slice(ci + 1), sm = this.cache.json.get('spr:' + at)?.sprites?.[fr];
        if (!sm) throw new Error('khong co sprite ' + k);
        const im = this.add.image(x - Math.round(sm.w / 2), y - sm.h, at, fr).setOrigin(0).setDepth(sm.role === 'ground-decoration' ? y - sm.h - 10 : depthOf(y, tierAt(meta, x, y)));
        if (isRoofFrame(fr)) this.addRoof(im);
        if (sm.foot && sm.foot[0] > 0 && sm.foot[1] > 0) solid(x, y - sm.foot[1] / 2, sm.foot[0], sm.foot[1]);
        continue;
      }
      const m = SP.sprites[k];
      const left = x - Math.round(m.w / 2), top = y - m.h;
      if (k === 'hall') {
        this.add.image(left, top, 'sect', 'hall_base').setOrigin(0).setDepth(y);
        this.addRoof(this.add.image(left, top, 'sect', 'hall_roof').setOrigin(0).setDepth(y + 0.5));
        solid(x, y - 70, m.w - 24, 120);                       // body + plinth (feet stop just below the plinth)
        solid(x - 120, y - 6, 92, 12); solid(x + 120, y - 6, 92, 12);
        this.interactables.push({ key: 'hall', x, y: y + 4, range: 40 });
        this.hallPos = { x, y };
      } else if (k === 'gate') {
        const L = SP.layers.gate, P = L.passage;
        this.add.image(left, top, 'sect', 'gate_base').setOrigin(0).setDepth(y - 2);
        this.gateRoof = this.add.image(left, top, 'sect', 'gate_roof').setOrigin(0).setDepth(8000); this.addRoof(this.gateRoof);
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
    // ---------- collision grid (void, cliff faces, wall bodies, steep mountainside) + stair balustrades
    (meta.col || []).forEach((row, cy) => row.forEach((c, cx) => { if (c) solid(cx * 32 + 16, cy * 32 + 16, 32, 32); }));
    for (const [sx, sy, sw, sh] of meta.stairs || []) { solid(sx + 7, sy + sh / 2 + 4, 14, sh - 8); solid(sx + sw - 7, sy + sh / 2 + 4, 14, sh - 8); }
    // ---------- pond (chi khi co features.pond): collision ring + koi under the surface layer (lily pads), glints, ripples
    const pd = feat.pond;
    if (pd) {
      for (const [fy, fx] of [[-0.7, 0.62], [-0.25, 0.98], [0.25, 0.98], [0.7, 0.62]]) solid(pd.cx, pd.cy + fy * pd.ry, pd.rx * 2 * fx + 10, pd.ry * 0.5 + 8);
      this.makePond(pd, feat.koi ?? 5);
    }
    // ---------- incense smoke from the burner (chi khi co features.smoke va co lu huong)
    if (feat.smoke) this.makeSmoke();
    // ---------- hero
    const spn = this.spawnName && meta.spawns?.[this.spawnName] ? meta.spawns[this.spawnName] : (meta.spawns?.default || meta.spawn);
    const urlPos = !this.fromPortal && (sp.has('x') || sp.has('y'));
    let sx = urlPos ? +(sp.get('x') || spn[0]) : spn[0], sy = urlPos ? +(sp.get('y') || spn[1]) : spn[1];
    if (this.editData?.at) { sx = this.editData.at.x; sy = this.editData.at.y; }   // [editor] Choi thu: nhan vat xuat hien o tam camera
    this.player = this.physics.add.sprite(sx, sy, 'hero', 'dao_si_idle_down_00').setOrigin(32 / 64, 61 / 64);
    this.player.body.setSize(14, 8).setOffset(25, 54);
    this.player.on('animationcomplete', (anim) => { if (anim.key.startsWith('interact_')) this.endInteract(); else if (SKILL_ANIM.test(anim.key)) this.endSkill(); });
    this.facing = (urlPos && sp.get('face')) || spn[2] || 'up'; this.acting = false;
    this.player.anims.play(`idle_${this.facing}`);
    if (!this.textures.exists('shadow')) { const g = this.make.graphics({ x: 0, y: 0 }, false); g.fillStyle(0x0b0a09, 0.32); g.fillEllipse(9, 3, 18, 6); g.generateTexture('shadow', 18, 6); g.destroy(); }
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(-70);
    this.physics.add.collider(this.player, this.solids);
    this.physics.world.setBounds(0, 0, W, H);
    this.player.setCollideWorldBounds(true);
    // ---------- exits: vung "cho" (toast + dich chuyen trong khu); portals: chuyen khu that
    this.exits = (meta.exits || []).map(e => ({ ...e, r: new Phaser.Geom.Rectangle(...e.rect) }));
    this.portals = (meta.portals || []).map(p => ({ ...p, r: new Phaser.Geom.Rectangle(...p.rect) }));
    // ---------- mist: drifting banks over the cliff edges (world) + thin fog veils over everything (screen)
    this.mistBands = (feat.mist || []).map(([mx, my, mw, mh, a]) => this.add.tileSprite(mx, my, mw, mh, 'mistA').setOrigin(0).setDepth(8600).setAlpha(a).setTileScale(2, 1));
    this.mistBands.forEach(m => { m.baseA = m.alpha; });
    this.fogA = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'mistA').setOrigin(0).setScrollFactor(0).setDepth(8900).setAlpha(0.13).setTileScale(2, 1.4);
    this.fogB = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'mistB').setOrigin(0).setScrollFactor(0).setDepth(8901).setAlpha(0.09).setTileScale(3, 2);
    // ---------- day / night (giu qua cac khu)
    this.makeNight();
    this.nightK = sp.has('night') || this.game.registry.get('night') ? 1 : 0; this.night = this.nightK > 0.5; this.cycle = sp.has('cycle');
    // ---------- camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H); if (!this.editFree) cam.startFollow(this.player, true, 0.15, 0.15); cam.setRoundPixels(true);   // che do Sua: camera tu do (editor dieu khien)
    cam.setBackgroundColor(meta.bg || '#7d8c92'); cam.centerOn(sx, sy);
    // ---------- input + UI (UI la DOM, tao 1 lan cho ca game; callback tro toi scene hien tai)
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,SHIFT,N');
    this.input.keyboard.on('keydown-E', () => this.onInteract());
    this.input.keyboard.on('keydown-SPACE', () => this.onInteract());
    this.input.keyboard.on('keydown-N', () => this.toggleNight());
    let ui = this.game.registry.get('ui');
    if (!ui) {
      ui = new UI({ onAction: () => ui.scene.onInteract(), onDialogTap: () => ui.scene.onInteract(), title: meta.name, sub: meta.sub || '' });
      ui.addDayNight(() => ui.scene.toggleNight());
      if (isTouchDevice()) ui.enableTouch();
      this.game.registry.set('ui', ui);
    } else { ui.setTitle(meta.name, meta.sub || ''); ui.showDialog(false); ui.setPrompt(null); }
    ui.scene = this; this.ui = ui; this.touch = ui;
    ui.help.innerHTML = '<kbd>WASD</kbd>/<kbd>↑↓←→</kbd> đi · giữ <kbd>Shift</kbd> chạy · <kbd>E</kbd> tương tác · <kbd>N</kbd> ngày/đêm';
    ui.setDayNight(this.night);
    this.scale.on('resize', this.onResize, this);
    this.applyNight();
    window.__scene = this;
    if (this.fromPortal) ui.fadeTo(0, FADE_MS);
    // ---------- FX: bo phat hieu ung skill (depth: ground -60, light ngay -59 / dem 9100 theo this.night, overlay 9500); che do thu chi khi ?fx=1; ?fxlab=1 ngu y fx=1
    this.fx = new FxPlayer(this, { maxParticles: 300, isNight: () => this.night });
    const lab = sp.get('fxlab') === '1';
    if (lab || sp.get('fx') === '1') this.fxDemo = setupFxDemo(this);
    if (import.meta.env.DEV && lab) import('./fxlab/index.js').then(m => { if (this.scene.isActive()) this.fxLab = m.setupFxLab(this, this.fxDemo); });
    // [editor] Area Editor: chi dev + ?edit=1 (hoac restart tu editor); khong vao ban build
    if (import.meta.env.DEV && (sp.get('edit') === '1' || this.editData)) import('./editor/index.js').then(m => { if (this.scene.isActive()) m.attach(this); });
  }

  // kit piece: moi anh gan chi so placement (meta.pieces[i]); anh mai tu sinh (resolveKitPieces) mang chi so cua placement cha -> editor chon/keo ca nhom
  kitEntries() {
    const meta = this.meta, id = this.areaId, given = meta.pieces || [];
    const kits = Object.fromEntries(Object.keys(meta.kits || {}).map(k => [k, this.cache.json.get(kitCacheKey(id, k))]));
    let pi = -1;
    return resolveKitPieces(meta, kits).map(o => { const g = given[pi + 1]; if (g && g.k === o.k && g.x === o.x && g.y === o.y) pi++; return { o, i: pi }; });   // anh tu sinh khong trung placement nao -> giu pi cua cha
  }

  makeKitImage(o, i) {
    const p = o.piece, depth = p.layer === 'ground' ? -99 : p.layer === 'roof' ? this.H + 1 : depthOf(o.y, tierAt(this.meta, o.x, o.y));
    const im = this.add.image(o.x - p.anchor[0], o.y - p.anchor[1], kitTextureKey(this.areaId, o.kit, o.name)).setOrigin(0).setDepth(depth);
    im.setData('kitPiece', o.k); im.setData('placement', i); this.kitImages.push(im);
    return im;
  }

  // [editor] dung lai toan bo anh kit tu meta.pieces hien tai (them/xoa/hoan tac); khong dung collider/mai/den (chi xem truoc, xem DESIGN 5b.5)
  rebuildKitImages() {
    for (const im of this.kitImages) im.destroy();
    this.kitImages = []; this.roofs = this.roofs.filter(r => r.img.active);
    for (const { o, i } of this.kitEntries()) this.makeKitImage(o, i);
  }

  // tan/mai (K-A4): moi anh mai/tan dang ky o day; update() ha alpha khi bbox che than nhan vat (areaLayers.roofTargetAlpha)
  addRoof(img) {
    const f = img.frame, bbox = [img.x, img.y, img.width, img.height];
    let rects = [bbox];   // du phong: bbox ca anh; thuong thi doc pixel that -> mat na cac o 8 px dac (vd hall_roof chi cao ~102 / 235 px)
    try {
      const cv = document.createElement('canvas'); cv.width = f.cutWidth; cv.height = f.cutHeight; const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
      const m = alphaMaskRects(cx.getImageData(0, 0, f.cutWidth, f.cutHeight).data, f.cutWidth, f.cutHeight, img.x, img.y);
      if (m.length) rects = m;
    } catch (e) { /* khong doc duoc pixel: dung bbox */ }
    this.roofs.push({ img, rect: bbox, rects, base: img.alpha }); return img;
  }

  updateLayers(delta) {
    if (this.editFree) return;   // [editor] che do Sua: nhan vat dung yen, khong mo mai
    const p = this.player, x = p.x, y = p.y;
    if (this.meta.tierRows) {
      const lg = this.lastGood, ok = (nx, ny) => tierStepOk(this.meta, lg.x, lg.y, nx, ny, this.tier);
      if (lg && Math.hypot(x - lg.x, y - lg.y) < 8 && !ok(x, y)) p.setPosition(ok(x, lg.y) ? x : lg.x, ok(lg.x, y) && !ok(x, lg.y) ? y : lg.y);   // truot theo truc con hop le; khong thi ve vi tri truoc   // khong qua mep tang ngoai bac (chong xuyen); dich chuyen xa (>= 8 px) thi bo qua
      this.lastGood = { x: p.x, y: p.y };
      this.tier = tierAt(this.meta, p.x, p.y, this.tier);
    }
    p.setDepth(depthOf(p.y, this.tier));
    for (const r of this.roofs) {
      const im = r.img, a = im.depth > p.depth ? roofTargetAlpha(r.rects, x, y, r.base) : r.base;   // chi mo khi mai ve DE len nhan vat
      if (im.alpha !== a) im.alpha = a > im.alpha ? Math.min(a, im.alpha + delta / ROOF_FADE_MS) : Math.max(a, im.alpha - delta / ROOF_FADE_MS);
    }
  }

  onShutdown() {
    this.holdTimer?.remove(); this.holdTimer = null; this.holdFn = null;
    this.scale.off('resize', this.onResize, this);
    if (this.textures.exists('nightmask')) this.textures.remove('nightmask');
    // nen + du lieu cua khu nay: bo khoi cache (lan vao sau se nap lai) de texture khong tich luy qua cac khu
    if (this.textures.exists('ground:' + this.areaId)) this.textures.remove('ground:' + this.areaId);
    for (const a of this.meta?.atlases || []) { if (this.textures.exists(a)) this.textures.remove(a); this.cache.json.remove('spr:' + a); }
    for (const k of Object.keys(this.meta?.kits || {})) {
      const kk = kitCacheKey(this.areaId, k), kit = this.cache.json.get(kk);
      for (const name of Object.keys(kit?.pieces || {})) this.textures.remove(kitTextureKey(this.areaId, k, name));
      this.cache.json.remove(kk);
    }
    this.cache.json.remove('area:' + this.areaId);
  }

  // chuyen khu: fade den 250 ms -> restart scene voi khu moi -> (create) fade vao
  async goArea(area, spawn) {
    if (this.busy) return; this.busy = true; this.player.setVelocity(0, 0); this.ui.setPrompt(null);
    await this.ui.fadeTo(1, FADE_MS);
    this.scene.restart({ area, spawn, fromPortal: true });
  }

  makeAnims() {
    if (this.anims.exists('idle_down')) return;     // anim la toan cuc: chi tao 1 lan (restart khu khong tao lai)
    for (const [a, c] of Object.entries(ANIMS)) for (const d of DIR8)
      this.anims.create({ key: `${a}_${d}`, frames: this.anims.generateFrameNames('hero', { prefix: `dao_si_${a}_${d}_`, start: 0, end: c.n - 1, zeroPad: 2 }), frameRate: 1000 / c.ms, repeat: c.repeat });
    // dong tac ra chieu: tao tu meta.frameTags cua atlas hero_skill, thoi luong tung khung (ms) lay tu json, chay 1 lan (repeat 0)
    const sk = this.cache.json.get('hero_skill_json');
    for (const t of sk?.meta?.frameTags || []) {
      const frames = sk.frames.slice(t.from, t.to + 1).map(f => ({ key: 'hero_skill', frame: f.filename, duration: f.duration }));   // Phaser 4: duration cua khung = thoi gian khung (ms), uu tien hon frameRate
      this.anims.create({ key: t.name, frames, frameRate: 1000, repeat: t.repeat === undefined ? 0 : Math.max(0, +t.repeat - 1) });
    }
    for (const f of ['fern_a', 'fern_b', 'fern_c'])
      this.anims.create({ key: f + '_sway', frames: [1, 2, 1, 0].map(i => ({ key: 'sect', frame: `${f}_s${i}` })), frameRate: 1.6, repeat: -1 });
    for (let c = 0; c < 3; c++) this.anims.create({ key: `koi${c}`, frames: [0, 1].map(i => ({ key: 'sect', frame: `koi${c}_${i}` })), frameRate: 4, repeat: -1 });
  }

  makePond(pd, nKoi) {
    const fr = this.textures.getFrame('sect', 'pond_surface'), pw = fr.width, ph = fr.height;
    const x0 = Math.round(pd.cx - pw / 2), y0 = Math.round(pd.cy - ph / 2);
    this.fish = [];
    const N = nKoi;
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
    this.night = !this.night; this.ui.setDayNight(this.night); this.game.registry.set('night', this.night);
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
    this.cameras.main.setSize(W, H); this.cloudBack?.setSize(W, H); this.fogA.setSize(W, H); this.fogB.setSize(W, H);
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
    if (this.busy || this.editFree) return;
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

  // ra chieu: nhan vat dung lai, chay ketan_<huong> (ultimate) hoac kiemchi_<huong> (chieu thuong); hoi phuc idle khi het anim. Khoa di chuyen nhu interact (acting). Tra ve false neu dang ban.
  // hitAt (ms, tuy chon): thoi diem event 'hit' cua cue; khung giu (kiemchi 7, ketan 5) keo dai toi hitAt + 100 ms roi moi ha tay
  castAnim(kind, dir, hitAt) {
    if (this.busy || this.dialog || this.acting || !this.anims.exists(`${kind}_${dir || this.facing}`)) return false;
    if (dir) this.facing = dir;
    this.acting = true; this.pendingIt = null; this.player.setVelocity(0, 0);
    this.clearHold();
    const anim = this.anims.get(`${kind}_${this.facing}`), hi = kind === 'ketan' ? 5 : 7, t0 = this.time.now;
    if (hitAt !== undefined && hitAt !== null) {
      this.holdFn = (a, f) => {
        if (a !== anim || anim.frames.indexOf(f) !== hi) return;
        const delay = t0 + hitAt + 100 - (this.time.now + f.duration);   // khung giu da tu chay f.duration ms sau khi resume
        this.player.off('animationupdate', this.holdFn); this.holdFn = null;
        if (delay <= 0) return;
        this.player.anims.pause();
        this.holdTimer = this.time.delayedCall(delay, () => { this.holdTimer = null; this.player.anims.resume(); });
      };
      this.player.on('animationupdate', this.holdFn);
    }
    this.player.anims.play(anim.key);
    return true;
  }

  clearHold() {
    if (this.holdFn) { this.player.off('animationupdate', this.holdFn); this.holdFn = null; }
    if (this.holdTimer) { this.holdTimer.remove(); this.holdTimer = null; }
  }

  endSkill() { this.clearHold(); this.acting = false; this.player.anims.play(`idle_${this.facing}`, true); }

  endInteract() {
    this.acting = false;
    this.player.anims.play(`idle_${this.facing}`, true);
    const it = this.pendingIt; this.pendingIt = null;
    if (!it) return;
    const key = it.key === 'burner' && this.incenseLit ? 'burner_lit' : it.key;
    if (it.key === 'burner' && !this.incenseLit) this.lightIncense();
    this.dialog = { lines: this.TEXT[key].lines, i: 0, it };
    this.player.setVelocity(0, 0);
    this.ui.showDialog(true); this.showLine();
  }

  // tuy chon: texts[key].after = { title, text, to:{x,y,face} } -> chuyen "cho" trong khu sau khi doc het hoi thoai
  afterDialog(it) { const a = this.TEXT[it.key]?.after; if (a) this.transition(a.title, a.text, a.to); }

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
    if (!this.dialog && !this.acting && !this.busy && !this.editFree) {
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
    this.updateLayers(delta); this.shadow.setPosition(Math.round(p.x), Math.round(p.y) - 1);   // tang + depth + tan/mai mo (thay cho mo cong rieng 0.72)
    if (!this.busy && !this.editFree) for (const e of this.exits) if (e.r.contains(p.x, p.y)) { this.transition(e.title, e.text, e.to); break; }
    // cong chuyen khu: cham vung la chuyen; sau khi vao khu, phai buoc ra khoi moi cong thi cong moi "len dan" (tranh nhay qua lai)
    let hit = null, near = null;
    for (const q of this.portals) {
      if (q.r.contains(p.x, p.y)) hit = q;
      else if (Phaser.Geom.Rectangle.Overlaps(Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(q.r), 56, 56), new Phaser.Geom.Rectangle(p.x - 1, p.y - 1, 2, 2))) near = near || q;
    }
    if (!hit) this.portalArmed = true;
    if (hit && this.portalArmed && !this.busy && !this.editFree) this.goArea(hit.to.area, hit.to.spawn);
    // prompt
    const it = !this.dialog && !this.busy && !this.editFree && this.nearest();
    if (it) {
      const z = this.scale.zoom, r = this.game.canvas.getBoundingClientRect();
      const wy = it.key === 'hall' ? it.y - 70 : it.key === 'gate' ? it.y - 70 : it.y - 50;
      this.ui.setPrompt(this.TEXT[it.key]?.prompt || 'Xem', r.left + (it.x - cam.scrollX) * z, r.top + (wy - cam.scrollY) * z);
    } else if (near && !this.busy && !this.dialog && !this.editFree) {
      const z = this.scale.zoom, r = this.game.canvas.getBoundingClientRect(), q = near.r;
      this.ui.setPrompt('→ ' + (near.label || near.to.area), r.left + (q.centerX - cam.scrollX) * z, r.top + (q.y - 8 - cam.scrollY) * z, true);
    } else this.ui.setPrompt(null);
    // ---- ambience
    const ts = time / 1000;
    for (const f of this.foliage) f.img.x = f.x0 + Math.round(Math.sin(ts * f.f + f.ph) * f.amp);
    if (this.pond) this.updatePond(delta);
    if (this.cloudBack) {
      this.cloudBack.tilePositionX = Math.round(cam.scrollX * 0.5 + time * 0.004); this.cloudBack.tilePositionY = Math.round(cam.scrollY * 0.5);
      this.peaks.y = Math.round(this.meta.cliffBottom - 90 - 0.4 * Math.max(0, this.H - cam.height));
      this.seaDrift.tilePositionX = time * 0.006;
    }
    this.mistBands.forEach((m, i) => { m.tilePositionX = time * (0.009 + i * 0.003) + i * 77; });
    this.fogA.tilePositionX = cam.scrollX * 0.4 + time * 0.007; this.fogA.tilePositionY = cam.scrollY * 0.4;
    this.fogB.tilePositionX = cam.scrollX * 0.25 - time * 0.004; this.fogB.tilePositionY = cam.scrollY * 0.25 + time * 0.001;
    for (const g of this.glows) g.g.setAlpha(this.nightK * g.base * (0.86 + 0.14 * Math.sin(ts * 3.1 + g.ph) * Math.sin(ts * 1.7 + g.ph * 2)));
    if (this.cycle) { const nk = 0.5 - 0.5 * Math.cos(ts * 2 * Math.PI / 60); this.nightK = nk; this.applyNight(); const nn = nk > 0.5; if (nn !== this.night) { this.night = nn; this.ui.setDayNight(nn); } }
  }
}
