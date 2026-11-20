// HUD / dialog / touch controls as a DOM overlay rendered at native device resolution (crisp vector text and rings),
// while the world canvas underneath stays integer-scaled pixel art.
const DEAD = 0.18;            // joystick dead zone (fraction of radius)
export const RUN_AT = 0.68;   // deflection at which walking becomes running

const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;z-index:10;font-family:'NotoSerifVN',Georgia,'Times New Roman',serif;color:#f3ecdc;
  -webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}
#ui *{box-sizing:border-box}
#ui .title{position:absolute;top:calc(14px + env(safe-area-inset-top));left:0;right:0;text-align:center;transition:opacity 1.6s;opacity:1}
#ui .title b{display:inline-block;font-weight:700;font-size:19px;letter-spacing:.06em;color:#f6e7bd;
  text-shadow:0 1px 0 #2a160c,0 0 10px rgba(20,14,10,.85),0 0 2px rgba(20,14,10,.9)}
#ui .title i{display:block;font-style:normal;font-size:11.5px;letter-spacing:.32em;color:#e3c97f;margin-top:3px;text-transform:uppercase;
  text-shadow:0 0 6px rgba(20,14,10,.9)}
#ui .title .rule{display:block;width:120px;height:1px;margin:6px auto 0;background:linear-gradient(90deg,transparent,#d8b25a,transparent)}
#ui .help{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));max-width:92vw;
  padding:6px 14px;border-radius:999px;background:rgba(18,16,20,.58);border:1px solid rgba(216,178,90,.35);
  font-size:12.5px;letter-spacing:.02em;color:#efe6d2;white-space:nowrap;transition:opacity 1.5s}
#ui.touch .help{bottom:auto;top:calc(70px + env(safe-area-inset-top));white-space:normal;text-align:center;width:max-content}
#ui .help kbd{font-family:inherit;font-weight:700;color:#f0cf7a;padding:0 2px}
#ui .prompt{position:absolute;transform:translate(-50%,-100%);padding:3px 10px 4px;border-radius:4px;font-size:13px;white-space:nowrap;
  background:rgba(22,16,16,.78);border:1px solid rgba(216,178,90,.55);color:#f6e7bd;display:none}
#ui .prompt:after{content:'';position:absolute;left:50%;bottom:-5px;width:8px;height:8px;margin-left:-4px;transform:rotate(45deg);
  background:rgba(22,16,16,.78);border-right:1px solid rgba(216,178,90,.55);border-bottom:1px solid rgba(216,178,90,.55)}
#ui .prompt kbd{font-family:inherit;font-weight:700;color:#14100c;background:#e3c272;border-radius:3px;padding:0 5px;margin-right:6px;font-size:12px}
/* dialog */
#ui .dlg{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom));width:min(620px,calc(100vw - 28px));
  min-height:96px;padding:22px 22px 18px;display:none;pointer-events:auto;
  background:linear-gradient(180deg,rgba(28,22,24,.94),rgba(16,14,18,.94));
  border:1px solid #b8913f;border-radius:6px;box-shadow:0 0 0 3px rgba(16,12,10,.55),inset 0 0 0 4px rgba(16,12,10,.6),inset 0 0 0 5px rgba(184,145,63,.35),0 10px 30px rgba(0,0,0,.45)}
#ui .dlg:before,#ui .dlg:after{content:'';position:absolute;top:-5px;width:9px;height:9px;transform:rotate(45deg);background:#d9b45e;border:1px solid #5c3a14}
#ui .dlg:before{left:-5px}#ui .dlg:after{right:-5px}
#ui .dlg .name{position:absolute;top:-14px;left:22px;padding:3px 14px 4px;font-weight:700;font-size:14px;letter-spacing:.05em;color:#f8e9bf;
  background:linear-gradient(180deg,#9a2a22,#6e1a16);border:1px solid #d1aa55;border-radius:3px;box-shadow:0 2px 6px rgba(0,0,0,.4)}
#ui .dlg .text{font-size:16.5px;line-height:1.6;color:#f1eadb;min-height:52px}
#ui .dlg .next{position:absolute;right:16px;bottom:9px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
  border-top:8px solid #e0bd66;animation:nextb 0.9s ease-in-out infinite}
@keyframes nextb{50%{transform:translateY(3px);opacity:.45}}
/* touch */
#ui .pad{position:absolute;left:0;top:0;bottom:0;width:55%;pointer-events:none}
#ui.touch .pad{pointer-events:auto;touch-action:none}
#ui .joy{position:absolute;width:var(--d);height:var(--d);margin:calc(var(--d)/-2) 0 0 calc(var(--d)/-2);display:none;opacity:.55;transition:opacity .2s}
#ui.touch .joy{display:block}
#ui .joy.on{opacity:1;transition:none}
#ui .joy svg{position:absolute;inset:0;overflow:visible}
#ui .knob{position:absolute;left:50%;top:50%;width:calc(var(--d)*.4);height:calc(var(--d)*.4);margin:calc(var(--d)*-.2) 0 0 calc(var(--d)*-.2);border-radius:50%;
  background:radial-gradient(circle at 38% 32%,#d3574a 0%,#9b2a22 48%,#5f1512 100%);
  box-shadow:0 0 0 1.5px #e2bf69,0 0 0 3px rgba(30,14,10,.55),0 4px 10px rgba(0,0,0,.45),inset 0 1px 2px rgba(255,220,180,.35)}
#ui .knob:after{content:'';position:absolute;inset:28%;border-radius:50%;border:1px solid rgba(240,207,122,.55)}
#ui .joy.run .knob{background:radial-gradient(circle at 38% 32%,#f07a52 0%,#bf3522 48%,#701a12 100%)}
#ui .btn{position:absolute;right:calc(26px + env(safe-area-inset-right));bottom:calc(30px + env(safe-area-inset-bottom));width:84px;height:84px;border-radius:50%;
  display:none;pointer-events:auto;touch-action:none;align-items:center;justify-content:center;flex-direction:column;
  background:radial-gradient(circle at 40% 30%,#b8382c 0%,#86201a 55%,#4f110e 100%);
  box-shadow:0 0 0 2px #d9b45e,0 0 0 5px rgba(28,14,10,.6),0 0 0 6px rgba(217,180,94,.45),0 8px 18px rgba(0,0,0,.45),inset 0 2px 3px rgba(255,214,170,.35),inset 0 -6px 12px rgba(0,0,0,.35)}
#ui.touch .btn{display:flex}
#ui .btn .ico{width:30px;height:30px}
#ui .btn .lbl{font-weight:700;font-size:12px;letter-spacing:.04em;color:#f6e3b0;margin-top:1px;text-shadow:0 1px 1px rgba(0,0,0,.6)}
#ui .btn.down{transform:scale(.94);filter:brightness(1.15)}
#ui.dlgopen .help{opacity:0!important}
#ui .dn{position:absolute;top:calc(12px + env(safe-area-inset-top));right:calc(12px + env(safe-area-inset-right));width:44px;height:44px;border-radius:50%;
  pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;cursor:pointer;
  background:radial-gradient(circle at 40% 30%,rgba(60,58,66,.92),rgba(22,20,26,.92));box-shadow:0 0 0 1.5px #c9a656,0 0 0 4px rgba(16,12,10,.45),0 4px 10px rgba(0,0,0,.4)}
#ui .dn svg{width:24px;height:24px}
#ui .dn.down{transform:scale(.92)}
#ui .toast{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);padding:12px 22px;border-radius:6px;font-size:16px;letter-spacing:.03em;
  background:rgba(14,12,16,.82);border:1px solid rgba(216,178,90,.55);color:#f3e6c4;opacity:0;transition:opacity .6s;text-align:center;max-width:86vw;white-space:normal}
#ui .fade{position:absolute;inset:0;background:#07080b;opacity:0;transition:opacity .7s;pointer-events:none}
@media (orientation:portrait){ #ui.touch .dlg{bottom:calc(150px + env(safe-area-inset-bottom))} }
@media (orientation:landscape){ #ui.touch .dlg{width:min(560px,calc(100vw - var(--d)*2 - 110px))} }
`;
const JOY_SVG = `<svg viewBox="-50 -50 100 100">
  <defs><radialGradient id="jg" r="0.5"><stop offset="0.55" stop-color="#140f12" stop-opacity="0.18"/><stop offset="1" stop-color="#140f12" stop-opacity="0.42"/></radialGradient></defs>
  <circle r="49" fill="url(#jg)"/>
  <circle r="48.5" fill="none" stroke="#e2bf69" stroke-width="1.4" stroke-opacity="0.9"/>
  <circle r="45" fill="none" stroke="#e2bf69" stroke-width="0.6" stroke-opacity="0.35"/>
  <circle r="${(RUN_AT * 48).toFixed(1)}" fill="none" stroke="#f3ecdc" stroke-width="0.7" stroke-opacity="0.35" stroke-dasharray="1.6 3.2"/>
  ${[0, 90, 180, 270].map(a => `<path d="M0,-48.5 l-3.2,5 h6.4z" fill="#e2bf69" fill-opacity="0.85" transform="rotate(${a})"/>`).join('')}
  ${[45, 135, 225, 315].map(a => `<circle cx="0" cy="-46.6" r="0.9" fill="#e2bf69" fill-opacity="0.7" transform="rotate(${a})"/>`).join('')}
</svg>`;
// raised open palm (gold line icon)
const HAND_SVG = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="#f0cf7a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 12.5V5.5a1.4 1.4 0 0 1 2.8 0V11"/><path d="M10.8 10.5V4.2a1.4 1.4 0 0 1 2.8 0v6.3"/><path d="M13.6 10.8V5.4a1.4 1.4 0 0 1 2.8 0v7.2"/>
  <path d="M16.4 9.5a1.4 1.4 0 0 1 2.8 0V15c0 3.4-2.6 6-6 6h-1.1c-2 0-3.4-.8-4.6-2.3l-3-3.9a1.45 1.45 0 0 1 2.2-1.9L8 14.2"/></svg>`;

export class UI {
  constructor({ onAction, onDialogTap, title = 'Tiên Sơn', sub = 'Sân Đình Mây' }) {
    this.onAction = onAction; this.onDialogTap = onDialogTap;
    this.vec = { x: 0, y: 0 }; this.mag = 0; this.joyId = null; this.btnId = null; this.touchMode = false;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const r = this.root = document.createElement('div'); r.id = 'ui';
    r.innerHTML = `<div class="pad"></div>
      <div class="fade"></div><div class="title"><b>${title}</b><i>${sub}</i><span class="rule"></span></div><div class="toast"></div>
      <div class="help"></div><div class="prompt"></div>
      <div class="joy"><svg></svg><div class="knob"></div></div>
      <div class="btn">${HAND_SVG}<span class="lbl">Tương tác</span></div>
      <div class="dlg"><div class="name"></div><div class="text"></div><div class="next"></div></div>`;
    document.body.appendChild(r);
    const q = s => r.querySelector(s);
    this.pad = q('.pad'); this.joy = q('.joy'); this.knob = q('.knob'); this.btn = q('.btn'); this.lbl = q('.lbl');
    this.dlg = q('.dlg'); this.dName = q('.name'); this.dText = q('.text'); this.dNext = q('.next');
    this.title = q('.title'); this.help = q('.help'); this.prompt = q('.prompt');
    this.joy.querySelector('svg').outerHTML = JOY_SVG;
    this.help.innerHTML = '<kbd>WASD</kbd>/<kbd>↑↓←→</kbd> đi &nbsp;·&nbsp; giữ <kbd>Shift</kbd> chạy &nbsp;·&nbsp; <kbd>E</kbd>/<kbd>Space</kbd> tương tác';
    this._titleT = setTimeout(() => { this.title.style.opacity = 0; }, 4500);
    this.helpTimer = setTimeout(() => { this.help.style.opacity = 0; }, 12000);
    this.layout();
    window.addEventListener('resize', () => this.layout());
    // first touch anywhere switches to touch UI
    window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') this.enableTouch(); }, { capture: true });
    this.pad.addEventListener('pointerdown', e => this.joyDown(e));
    window.addEventListener('pointermove', e => this.joyMove(e));
    window.addEventListener('pointerup', e => this.joyUp(e)); window.addEventListener('pointercancel', e => this.joyUp(e));
    this.btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.btnId = e.pointerId; this.btn.classList.add('down'); this.onAction(); });
    const btnUp = e => { if (e.pointerId === this.btnId) { this.btnId = null; this.btn.classList.remove('down'); } };
    window.addEventListener('pointerup', btnUp); window.addEventListener('pointercancel', btnUp);
    this.dlg.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.onDialogTap(); });
    window.addEventListener('blur', () => this.release());
  }
  layout() {
    const s = Math.min(innerWidth, innerHeight);
    this.D = Math.round(Math.max(118, Math.min(150, s * 0.33)));
    this.root.style.setProperty('--d', this.D + 'px');
    const sa = 20;
    this.home = { x: Math.round(this.D / 2 + 28), y: Math.round(innerHeight - this.D / 2 - 30 - sa / 2) };
    if (this.joyId === null) this.placeJoy(this.home.x, this.home.y);
  }
  enableTouch() {
    if (this.touchMode) return;
    this.touchMode = true; this.root.classList.add('touch');
    this.help.innerHTML = 'Kéo bên trái để đi · kéo hết vòng để chạy · chạm <kbd>tay</kbd> để tương tác';
    this.help.style.opacity = 1; clearTimeout(this.helpTimer); this.helpTimer = setTimeout(() => { this.help.style.opacity = 0; }, 9000);
    this.onTouchMode?.();
  }
  placeJoy(x, y) { this.joy.style.left = x + 'px'; this.joy.style.top = y + 'px'; this.knob.style.transform = ''; this.ox = x; this.oy = y; }
  joyDown(e) {
    if (e.pointerType === 'touch') this.enableTouch();
    if (!this.touchMode || this.joyId !== null) return;
    e.preventDefault(); this.joyId = e.pointerId;
    const R = this.D / 2;
    this.placeJoy(Math.max(R + 6, e.clientX), Math.min(innerHeight - R - 6, Math.max(R + 6, e.clientY)));
    this.joy.classList.add('on'); this.joyMove(e);
    this.requestFullscreen();
  }
  joyMove(e) {
    if (e.pointerId !== this.joyId) return;
    const R = this.D / 2, dx = e.clientX - this.ox, dy = e.clientY - this.oy, len = Math.hypot(dx, dy);
    const cl = Math.min(len, R), nx = len ? dx / len : 0, ny = len ? dy / len : 0;
    this.knob.style.transform = `translate(${(nx * cl).toFixed(1)}px,${(ny * cl).toFixed(1)}px)`;
    if (len / R < DEAD) { this.vec = { x: 0, y: 0 }; this.mag = 0; } else { this.vec = { x: nx, y: ny }; this.mag = Math.min(1, len / R); }
    this.joy.classList.toggle('run', this.mag >= RUN_AT);
  }
  joyUp(e) {
    if (e.pointerId !== this.joyId) return;
    this.joyId = null; this.vec = { x: 0, y: 0 }; this.mag = 0;
    this.joy.classList.remove('on', 'run'); this.placeJoy(this.home.x, this.home.y);
  }
  release() { this.joyId = null; this.btnId = null; this.vec = { x: 0, y: 0 }; this.mag = 0; this.joy.classList.remove('on', 'run'); this.btn.classList.remove('down'); if (this.home) this.placeJoy(this.home.x, this.home.y); }
  requestFullscreen() {
    if (this.triedFs) return; this.triedFs = true;
    const el = document.documentElement;
    try { if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* not allowed */ }
  }
  // ---- day/night toggle button (top-right), toast, fade
  addDayNight(onToggle) {
    const b = this.dn = document.createElement('div'); b.className = 'dn'; b.title = 'Ngày / đêm (N)'; this.root.appendChild(b);
    this.setDayNight(false);
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); onToggle(); });
    const up = () => b.classList.remove('down'); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  setDayNight(night) {
    if (!this.dn) return;
    this.dn.innerHTML = night
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="#f0cf7a" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="#f0cf7a" stroke-width="1.6" stroke-linejoin="round"><path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/></svg>';
  }
  toast(text, ms = 2600) {
    const t = this.root.querySelector('.toast'); t.textContent = text; t.style.opacity = 1;
    clearTimeout(this._tt); this._tt = setTimeout(() => { t.style.opacity = 0; }, ms);
  }
  fadeTo(a, ms = 700) {
    const f = this.root.querySelector('.fade'); f.style.transition = `opacity ${ms}ms`; f.style.opacity = a;
    return new Promise(r => setTimeout(r, ms + 30));
  }
  // ---- dialog
  showDialog(on) { this.dlg.style.display = on ? 'block' : 'none'; this.root.classList.toggle('dlgopen', on); this.dialogOpen = on; if (on) { this.prompt.style.display = 'none'; this._pl = null; this.lbl.textContent = 'Tiếp'; } }
  setDialog(name, text, done) { this.dName.textContent = name; this.dText.textContent = text; this.dNext.style.visibility = done ? 'visible' : 'hidden'; }
  // ---- prompt above a world point (CSS px) + contextual button label
  setTitle(name, sub) {   // ten khu hien khi vao khu (mo roi mo dan sau 4.5 s)
    this.title.querySelector('b').textContent = name; this.title.querySelector('i').textContent = sub || '';
    this.title.style.opacity = 1; clearTimeout(this._titleT); this._titleT = setTimeout(() => { this.title.style.opacity = 0; }, 4500);
  }
  setPrompt(label, x, y, plain = false) {   // plain: nhan khong co phim E (nhan cong)
    if (!label) { if (this._pl !== null) { this.prompt.style.display = 'none'; this._pl = null; } this.lbl.textContent = this.dialogOpen ? 'Tiếp' : 'Tương tác'; return; }
    if (this._pl !== label) { this.prompt.innerHTML = (this.touchMode || plain ? '' : '<kbd>E</kbd>') + label; this._pl = label; this.prompt.style.display = 'block'; }
    this.prompt.style.left = Math.round(x) + 'px'; this.prompt.style.top = Math.round(y) + 'px';
    if (!plain) this.lbl.textContent = label;
  }
}
