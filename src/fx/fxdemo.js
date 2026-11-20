// Che do thu FX trong SectScene, chi bat khi URL co ?fx=1. Phim 1/2/3 = cue mau (chan / truoc mat nguoi choi), 4 = ca ba quanh nguoi choi, R = lap moi 2 s.
// Hien FPS + fx.stats() goc man hinh (DOM, tren canvas, duoi UI cua game). Khong co co thi file nay khong duoc goi.
export const CUE_IDS = ['demo-bang-vong', 'demo-hoa-cot', 'demo-kim-giang'];
const DIR_ANGLE = { right: 0, down_right: 45, down: 90, down_left: 135, left: 180, up_left: 225, up: 270, up_right: 315 };

export function setupFxDemo(scene) {
  const fx = scene.fx;
  const front = d => { const a = (DIR_ANGLE[scene.facing] ?? 90) * Math.PI / 180; return { x: Math.cos(a) * d, y: Math.sin(a) * d }; };
  // chan nguoi choi = (x, y) vi origin sprite o chan; diem truoc mat = lech 36 px theo huong nhin
  const cast = (i) => {
    const p = scene.player, f = front(i === 0 ? 0 : 36);
    return fx.play(CUE_IDS[i], { x: p.x + f.x, y: p.y + f.y, onEvent: n => { scene.lastFxEvent = n; } });
  };
  const castAll = () => {
    const p = scene.player;
    return Promise.all(CUE_IDS.map((id, i) => {
      const a = (-90 + i * 120) * Math.PI / 180;   // 3 cue cach deu quanh nguoi choi, ban kinh 40
      return fx.play(id, { x: p.x + Math.cos(a) * 40, y: p.y + Math.sin(a) * 28 }).done;
    }));
  };
  const frontPoint = d => { const p = scene.player, f = front(d); return { x: p.x + f.x, y: p.y + f.y }; };
  const demo = { cast, castAll, frontPoint, looping: false, loopTimer: null };
  demo.setLoop = on => {
    demo.looping = on; demo.loopTimer?.remove(); demo.loopTimer = null;
    if (on) { castAll(); demo.loopTimer = scene.time.addEvent({ delay: 2000, loop: true, callback: castAll }); }
  };
  const kb = scene.input.keyboard;
  ['ONE', 'TWO', 'THREE'].forEach((k, i) => kb.on(`keydown-${k}`, () => cast(i)));
  kb.on('keydown-FOUR', castAll);
  kb.on('keydown-R', () => demo.setLoop(!demo.looping));
  // nut cam ung 1/2/3 (theo style .dn cua ui.js: vong vang tren nen toi), phat cue truoc mat nguoi choi
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:4px;top:26px;z-index:11;display:flex;gap:8px';
  CUE_IDS.forEach((id, i) => {
    const b = document.createElement('div');
    b.textContent = i + 1; b.title = id;
    b.style.cssText = 'width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;font:700 16px Georgia,serif;color:#f0cf7a;background:radial-gradient(circle at 40% 30%,rgba(60,58,66,.92),rgba(22,20,26,.92));box-shadow:0 0 0 1.5px #c9a656,0 0 0 4px rgba(16,12,10,.45),0 4px 10px rgba(0,0,0,.4)';
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.style.transform = 'scale(.92)'; cast(i); });
    const up = () => { b.style.transform = ''; };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    bar.appendChild(b);
  });
  document.body.appendChild(bar);
  demo.btnBar = bar;
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:4px;top:4px;z-index:11;pointer-events:none;font:11px monospace;color:#fff;background:#000a;padding:2px 5px;white-space:pre';
  document.body.appendChild(hud);
  const t = scene.time.addEvent({ delay: 250, loop: true, callback: () => {
    const s = fx.stats();
    hud.textContent = `FPS ${Math.round(scene.game.loop.actualFps)}  fx: active ${s.active} hat ${s.particles} obj ${s.objects}${demo.looping ? '  [R: lap]' : ''}`;
  } });
  scene.events.once('shutdown', () => { t.remove(); hud.remove(); bar.remove(); demo.setLoop(false); });
  window.__fxdemo = demo; window.__fx = fx;
  return demo;
}
