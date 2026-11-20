// FxLab (GD3): chinh chieu truc tiep trong canh game that. Chi duoc nap khi URL co ?fxlab=1 (import dong tu SectScene).
// Cue dang sua la ban sao song trong fx.cues[id]: sua xong ap dung ngay o lan phat ke tiep, khong reload.
import { createPanel } from './panel.js';
import { NEW_TRACK } from './schema.js';
import { clone, validId, loadDrafts, saveDraft, dropDraft } from './store.js';

const DIR8 = ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'];
const BUDGET = { normal: 120, ultimate: 300 };

export function setupFxLab(scene, demo) {
  const fx = scene.fx, base = {};   // base = ban goc de khoi phuc
  for (const id of Object.keys(fx.cues)) { base[id] = clone(fx.cues[id]); fx.cues[id] = clone(fx.cues[id]); }
  for (const [id, c] of Object.entries(loadDrafts())) { fx.cues[id] = c; try { fx.warm(c); } catch (e) { /* ban nhap hong: de nguyen */ } }

  const lab = {
    scene, fx, base, looping: false, dummy: null, loopTimer: null,
    cue: null, play0: 0, handle: null, peak: { particles: 0, limit: 120 }, minFps: 99, baseFps: 0, tracking: false,
    ids: () => Object.keys(fx.cues).sort(),
    select(id) { lab.cue = fx.cues[id]; panel.render(); panel.say(''); lab.resetPeak(); },
    // sua nho (keo thanh truot): ap dung + luu nhap + ve lai thanh thoi gian
    touch() { try { fx.warm(lab.cue); } catch (e) { /* tham so tam thoi chua hop le */ } saveDraft(lab.cue); panel.renderTimeline(); },
    structure() { lab.touch(); panel.render(); },
    saved() { dropDraft(lab.cue.id); base[lab.cue.id] = clone(lab.cue); },
    recolor(ramp) {
      const old = lab.cue.ramp, re = t => (typeof t === 'string' && t.startsWith(old + '.') ? ramp + t.slice(old.length) : t);
      for (const tr of lab.cue.tracks) { if (Array.isArray(tr.color)) tr.color = tr.color.map(re); else if (tr.color) tr.color = re(tr.color); if (tr.ramp === old) tr.ramp = ramp; }
      lab.cue.ramp = ramp; lab.structure();
    },
    addTrack(type) { const t = clone(NEW_TRACK[type]); t.at = Math.min(t.at, lab.cue.duration || 0); lab.cue.tracks.push(t); panel.open.add(t); lab.structure(); },
    dupTrack(i) { lab.cue.tracks.splice(i + 1, 0, clone(lab.cue.tracks[i])); lab.structure(); },
    delTrack(i) { lab.cue.tracks.splice(i, 1); lab.structure(); },
    reset() {
      const id = lab.cue.id;
      dropDraft(id);
      if (base[id]) { fx.cues[id] = clone(base[id]); lab.select(id); panel.say('Đã khôi phục bản gốc'); }
      else { delete fx.cues[id]; lab.select(lab.ids()[0]); panel.say('Đã xoá cue ' + id); }
    },
    createCopy(id) {
      if (!validId(id)) return 'id chỉ gồm a-z, 0-9, gạch ngang';
      if (fx.cues[id]) return 'id đã có';
      const c = clone(lab.cue); c.id = id; fx.cues[id] = c; base[id] = clone(c); saveDraft(c); lab.select(id);
      return 'Đã tạo ' + id + ' (nháp trong trình duyệt; bấm Tải JSON / Lưu vào dự án để giữ)';
    },
    // ---- phat
    target() {
      if (lab.dummy) return { x: lab.dummy.x, y: lab.dummy.y };
      return demo.frontPoint(36);
    },
    play() {
      const s = fx.stats(), idle = s.active === 0 && !lab.tracking;
      if (idle) lab.resetPeak();
      try { fx.warm(lab.cue); } catch (e) { /* bo qua */ }
      const { x, y } = lab.target();
      lab.play0 = performance.now(); lab.tracking = true;
      lab.handle = fx.play(lab.cue, { x, y, onEvent: n => { scene.lastFxEvent = n; } });
      lab.handle.done.then(() => { lab.tracking = fx.stats().active > 0; });
      return lab.handle;
    },
    resetPeak() { lab.peak = { particles: 0, limit: lab.cue?.ultimate ? BUDGET.ultimate : BUDGET.normal }; lab.minFps = 99; },
    setLoop(on, ms = 2000) {
      lab.looping = on; clearTimeout(lab.loopTimer); lab.loopTimer = null;
      const step = () => { if (!lab.looping) return; lab.play(); lab.loopTimer = setTimeout(step, Math.max(300, ms || 2000)); };
      if (on) step();
      panel.buttons();
    },
    toggleNight() { scene.toggleNight(); panel.buttons(); },
    toggleDummy() {
      if (lab.dummy) { lab.dummy.shadowImg.destroy(); lab.dummy.destroy(); lab.dummy = null; }
      else {
        const { x, y } = demo.frontPoint(48), toward = DIR8[(DIR8.indexOf(scene.facing) + 4) % 8] || 'down';
        const d = scene.add.sprite(Math.round(x), Math.round(y), 'hero', 'dao_si_idle_down_00').setOrigin(32 / 64, 61 / 64).setDepth(y);
        d.play(`idle_${toward}`);
        d.shadowImg = scene.add.image(Math.round(x), Math.round(y) - 1, 'shadow').setDepth(-70);
        lab.dummy = d;
      }
      panel.buttons();
    },
  };
  const panel = createPanel(lab);
  lab.panel = panel;

  // ---- do FPS / ngan sach hat; con tro thoi gian
  lab.baseFps = scene.game.loop.actualFps;
  const tick = setInterval(() => {
    const fps = Math.round(scene.game.loop.actualFps), s = fx.stats(), warns = [];
    if (s.active === 0 && !lab.tracking) lab.baseFps = lab.baseFps * 0.7 + fps * 0.3;   // FPS nen truoc khi phat
    else { lab.peak.particles = Math.max(lab.peak.particles, s.particles); lab.minFps = Math.min(lab.minFps, fps); }
    if (s.active === 0) lab.tracking = false;
    if (lab.peak.particles > lab.peak.limit) warns.push(`Hạt ${lab.peak.particles} vượt ngân sách ${lab.peak.limit}${lab.cue.ultimate ? ' (tuyệt chiêu)' : ''}`);
    if (lab.minFps < 99 && lab.baseFps - lab.minFps > 5) warns.push(`FPS tụt ${Math.round(lab.baseFps - lab.minFps)} so với trước khi phát (${Math.round(lab.baseFps)} → ${lab.minFps})`);
    lab.warns = warns;
    panel.setStats(fps, s, lab.peak, warns);
  }, 200);
  const raf = () => {
    if (lab.dead) return;
    const t = performance.now() - lab.play0, D = lab.cue.duration || 1;
    panel.setCursor(lab.tracking && t <= D + 50 ? t / D : null);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  scene.events.once('shutdown', () => { lab.dead = true; clearInterval(tick); lab.setLoop(false); lab.dummy && lab.toggleDummy(); panel.root.remove(); });

  lab.select(lab.ids().includes('demo-hoa-cot') ? 'demo-hoa-cot' : lab.ids()[0]);
  window.__fxlab = lab;
  return lab;
}
