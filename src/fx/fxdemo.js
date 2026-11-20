// Che do thu FX trong SectScene, chi bat khi URL co ?fx=1. Phim 1/2/3 = cue mau (chan / truoc mat nguoi choi), 4 = ca ba quanh nguoi choi, 5 = cue anim (atlas, GD4) tai chan, 6 = Cot Linh Lanh Hoa (GD5, 3 atlas floor/back/front) len hinh nom dung truoc mat Dao Si, R = lap moi 2 s.
// Hien FPS + fx.stats() goc man hinh (DOM, tren canvas, duoi UI cua game). Khong co co thi file nay khong duoc goi.
export const CUE_IDS = ['demo-bang-vong', 'demo-hoa-cot', 'demo-kim-giang'];
export const ANIM_ID = 'demo-anim-strike';
export const TD_ID = 'cot-linh-td';   // GD5: chieu top-down 3 lop, phim 6   // GD4: cue track anim (atlas SkillFX vocab-strike), phim 5
const DIR_ANGLE = { right: 0, down_right: 45, down: 90, down_left: 135, left: 180, up_left: 225, up: 270, up_right: 315 };

export function setupFxDemo(scene) {
  const fx = scene.fx;
  const front = d => { const a = (DIR_ANGLE[scene.facing] ?? 90) * Math.PI / 180; return { x: Math.cos(a) * d, y: Math.sin(a) * d }; };
  // chan nguoi choi = (x, y) vi origin sprite o chan; diem truoc mat = lech 36 px theo huong nhin
  const cast = (i) => {
    const p = scene.player, f = front(i === 0 ? 0 : 36);
    return fx.play(CUE_IDS[i], { x: p.x + f.x, y: p.y + f.y, onEvent: n => { scene.lastFxEvent = n; } });
  };
  const castAnim = () => fx.play(ANIM_ID, { x: scene.player.x, y: scene.player.y, onEvent: n => { scene.lastFxEvent = n; } });
  // GD5: hinh nom = sprite Dao Si idle_down to mau cam, dung yen truoc mat nguoi choi 56 px; depth = y nhu moi actor; chan = (x, y) vi origin cung (32/64, 61/64)
  let dummy = null;
  const castTd = () => {
    const p = scene.player, f = front(56);
    if (!dummy || !dummy.scene) {
      dummy = scene.add.sprite(0, 0, 'hero', 'dao_si_idle_down_00').setOrigin(32 / 64, 61 / 64).setTint(0xffb070);
      dummy.anims.play('idle_down'); demo.dummy = dummy;
    }
    dummy.setPosition(Math.round(p.x + f.x), Math.round(p.y + f.y)).setDepth(dummy.y);
    return fx.play(TD_ID, { x: dummy.x, y: dummy.y, target: dummy, onEvent: n => { scene.lastFxEvent = n; (scene.fxEvents ||= []).push(n); } });
  };
  const castAll = () => {
    const p = scene.player;
    return Promise.all(CUE_IDS.map((id, i) => {
      const a = (-90 + i * 120) * Math.PI / 180;   // 3 cue cach deu quanh nguoi choi, ban kinh 40
      return fx.play(id, { x: p.x + Math.cos(a) * 40, y: p.y + Math.sin(a) * 28 }).done;
    }));
  };
  const frontPoint = d => { const p = scene.player, f = front(d); return { x: p.x + f.x, y: p.y + f.y }; };
  const demo = { cast, castAll, castAnim, castTd, frontPoint, looping: false, loopTimer: null };
  demo.setLoop = on => {
    demo.looping = on; demo.loopTimer?.remove(); demo.loopTimer = null;
    if (on) { castAll(); demo.loopTimer = scene.time.addEvent({ delay: 2000, loop: true, callback: castAll }); }
  };
  const kb = scene.input.keyboard;
  ['ONE', 'TWO', 'THREE'].forEach((k, i) => kb.on(`keydown-${k}`, () => cast(i)));
  kb.on('keydown-FOUR', castAll);
  kb.on('keydown-FIVE', castAnim);
  kb.on('keydown-SIX', castTd);
  kb.on('keydown-R', () => demo.setLoop(!demo.looping));
  // nut cam ung 1/2/3 (theo style .dn cua ui.js: vong vang tren nen toi), phat cue truoc mat nguoi choi
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:4px;top:26px;z-index:11;display:flex;gap:8px';
  [...CUE_IDS, ANIM_ID, TD_ID].forEach((id, i) => {
    const b = document.createElement('div');
    b.textContent = i < CUE_IDS.length ? i + 1 : i + 2; b.title = id;
    b.style.cssText = 'width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;font:700 16px Georgia,serif;color:#f0cf7a;background:radial-gradient(circle at 40% 30%,rgba(60,58,66,.92),rgba(22,20,26,.92));box-shadow:0 0 0 1.5px #c9a656,0 0 0 4px rgba(16,12,10,.45),0 4px 10px rgba(0,0,0,.4)';
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.style.transform = 'scale(.92)'; i < CUE_IDS.length ? cast(i) : i === CUE_IDS.length ? castAnim() : castTd(); });
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
  scene.events.once('shutdown', () => { dummy?.destroy(); t.remove(); hud.remove(); bar.remove(); demo.setLoop(false); });
  window.__fxdemo = demo; window.__fx = fx;
  return demo;
}
