// FxLab: bang DOM thuan (khong thu vien). Desktop: cot ben phai. Mobile (man nho): ngan keo duoi. Gap lai duoc.
import { FX_PALETTE, resolveColor } from '../fx/palette.js';
import { ENUMS, BOOLS, TEXTS, TYPE_LABEL, NEW_TRACK, RAMPS, rangeOf } from './schema.js';
import { download, copyText, saveToProject, formatCue } from './store.js';

const CSS = `
#fxlab{position:fixed;z-index:12;right:0;top:0;bottom:0;width:340px;display:flex;flex-direction:column;background:rgba(18,16,22,.93);color:#efe6d2;
  font:12px/1.35 'NotoSerifVN',Georgia,serif;border-left:1px solid #b8913f;box-sizing:border-box;touch-action:pan-y}
#fxlab *{box-sizing:border-box}
#fxlab.c{bottom:auto;width:auto;border-bottom:1px solid #b8913f}
#fxlab.c .body{display:none}
#fxlab .hd{display:flex;align-items:center;gap:8px;padding:5px 8px;cursor:pointer;background:#2a1c1c;border-bottom:1px solid #b8913f;font-weight:700;color:#f6e7bd;user-select:none}
#fxlab .hd .fp{margin-left:auto;font:11px monospace;font-weight:400;color:#cfe}
#fxlab .body{flex:1;min-height:0;overflow-y:auto;padding:6px 8px 12px;overscroll-behavior:contain}
#fxlab .row{display:flex;gap:5px;align-items:center;margin:4px 0;flex-wrap:wrap}
#fxlab button,#fxlab select,#fxlab input[type=text],#fxlab input[type=number]{font:inherit;color:#f3e6c4;background:#352a2a;border:1px solid #8a6d32;border-radius:3px;padding:2px 6px;min-height:24px}
#fxlab button{cursor:pointer}#fxlab button:active{filter:brightness(1.3)}
#fxlab button.on{background:#7a2a22}
#fxlab .sw{display:inline-block;width:16px;height:16px;border:1px solid #000;vertical-align:middle;border-radius:2px;flex:none}
#fxlab .strip{display:flex}#fxlab .strip .sw{width:12px;border-radius:0}
#fxlab .tl{position:relative;margin:6px 0;background:#0d0c10;border:1px solid #5a4a28;padding:2px 0}
#fxlab .tl .lane{position:relative;height:7px;margin:1px 0}
#fxlab .tl .bar{position:absolute;top:0;bottom:0;border-radius:2px;opacity:.9;cursor:pointer;min-width:2px}
#fxlab .tl .bar.off{opacity:.25}
#fxlab .tl .cur{position:absolute;top:0;bottom:0;width:2px;background:#fff;left:0;display:none;pointer-events:none;z-index:1}
#fxlab .trk{margin:3px 0;border:1px solid #5a4a28;border-radius:3px;background:#221c20}
#fxlab .trk.off .th b{opacity:.4;text-decoration:line-through}
#fxlab .th{display:flex;align-items:center;gap:5px;padding:3px 5px;cursor:pointer;user-select:none}
#fxlab .th .m{color:#a99;font:11px monospace;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fxlab .th button{padding:0 6px;min-height:20px}
#fxlab .tb{padding:2px 6px 6px;display:none;border-top:1px solid #4a3c3c}
#fxlab .trk.open .tb{display:block}
#fxlab .f{display:flex;align-items:center;gap:5px;margin:2px 0}
#fxlab .f label{width:84px;flex:none;color:#d9c9a0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fxlab .f input[type=range]{flex:1;min-width:0;height:18px;accent-color:#d9b45e}
#fxlab .f input[type=number]{width:62px;flex:none}
#fxlab .grp{margin:3px 0 3px 6px;padding-left:6px;border-left:2px solid #6a5428}
#fxlab .grp>.gl{color:#e3c97f}
#fxlab .warn{color:#ff5a4a;font-weight:700}
#fxlab .st{font:11px monospace;color:#cfe;white-space:pre-wrap}
#fxlab .msg{color:#9fd;min-height:15px}
@media (max-width:900px) and (max-height:500px),(max-width:600px){
  #fxlab{top:auto;left:0;right:0;bottom:0;width:auto;height:min(40vh,320px);border-left:0;border-top:1px solid #b8913f}
  #fxlab.c{height:auto;top:auto;bottom:0;border-bottom:0}
  #fxlab .f label{width:70px}
}`;
const hex = n => '#' + n.toString(16).padStart(6, '0');

function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'text') e.textContent = v; else e[k] = v; }
  for (const k of kids) if (k) e.append(k);
  return e;
}
const opt = (v, t = v) => h('option', { value: v, text: t });
const tokSw = (tok, ramp) => { try { return hex(resolveColor(tok, ramp)); } catch (e) { return '#f0f'; } };

export function createPanel(lab) {
  document.head.appendChild(h('style', { textContent: CSS }));
  const root = h('div', { id: 'fxlab' });
  const body = h('div', { class: 'body' });
  const fpsEl = h('span', { class: 'fp' });
  const arrow = h('span', { text: '▾' });
  const hd = h('div', { class: 'hd', onclick: () => { root.classList.toggle('c'); arrow.textContent = root.classList.contains('c') ? '▸' : '▾'; } }, arrow, h('span', { text: 'FxLab · chỉnh chiêu' }), fpsEl);
  root.append(hd, body);
  // go chu trong o nhap khong kich phim game (WASD, N, R...); chan cuon trang cua main.js de cuon duoc trong bang
  const typing = e => e.target.tagName === 'SELECT' || (e.target.tagName === 'INPUT' && ['text', 'number'].includes(e.target.type));
  for (const ev of ['keydown', 'keyup']) root.addEventListener(ev, e => { if (typing(e)) e.stopPropagation(); });   // nut / thanh truot / tick van cho phim game (N, WASD) di qua
  for (const ev of ['touchmove', 'wheel', 'pointerdown']) root.addEventListener(ev, e => e.stopPropagation());

  const open = new Set();   // track dang mo (theo doi tuong)
  const say = t => { msgEl.textContent = t; };
  const cueSel = h('select', { onchange: () => lab.select(cueSel.value) });
  const rampSel = h('select', { onchange: () => lab.recolor(rampSel.value) }, ...RAMPS.map(r => opt(r)));
  const strip = h('span', { class: 'strip' });
  const loopMs = h('input', { type: 'number', value: 2000, min: 300, max: 10000, step: 100, title: 'khoảng cách giữa 2 lần phát (ms)', style: 'width:64px', onchange: () => lab.looping && lab.setLoop(true, +loopMs.value) });
  const btnLoop = h('button', { onclick: () => lab.setLoop(!lab.looping, +loopMs.value) });
  const btnNight = h('button', { onclick: () => lab.toggleNight() });
  const btnDummy = h('button', { onclick: () => lab.toggleDummy() });
  const durEl = h('div'), tl = h('div', { class: 'tl' }), cur = h('div', { class: 'cur' }), list = h('div');
  const addSel = h('select', {}, ...Object.keys(NEW_TRACK).map(t => opt(t, `${t} (${TYPE_LABEL[t]})`)));
  const stEl = h('div', { class: 'st' }), warnEl = h('div', { class: 'warn' }), msgEl = h('div', { class: 'msg' });
  const newId = h('input', { type: 'text', placeholder: 'id mới [a-z0-9-]', style: 'width:130px' });
  body.append(
    h('div', { class: 'row' }, cueSel, rampSel, strip),
    h('div', { class: 'row' }, h('button', { text: '▶ Phát', onclick: () => lab.play() }), btnLoop, loopMs, btnNight, btnDummy),
    durEl, tl, list,
    h('div', { class: 'row' }, addSel, h('button', { text: '+ Thêm track', onclick: () => lab.addTrack(addSel.value) })),
    h('div', { class: 'row' },
      h('button', { text: 'Tải JSON', onclick: () => { download(lab.cue); say('Đã tải ' + lab.cue.id + '.json'); } }),
      h('button', { text: 'Chép JSON', onclick: async () => say(await copyText(formatCue(lab.cue)) ? 'Đã chép JSON' : 'Không chép được') }),
      import.meta.env.DEV ? h('button', { text: 'Lưu vào dự án', onclick: async () => { try { say('Đã lưu ' + await saveToProject(lab.cue)); lab.saved(); } catch (e) { say('Lỗi lưu: ' + e.message); } } }) : null,
      h('button', { text: 'Khôi phục bản gốc', onclick: () => lab.reset() })),
    h('div', { class: 'row' }, newId, h('button', { text: 'Tạo cue mới từ bản sao', onclick: () => say(lab.createCopy(newId.value.trim())) })),
    stEl, warnEl, msgEl);
  document.body.appendChild(root);

  // ---- truong nhap
  function num(label, v, rk, set) {
    const [mn, mx, step] = rangeOf(rk, v);
    const r = h('input', { type: 'range', min: mn, max: mx, step, value: v });
    const n = h('input', { type: 'number', step, value: v });
    const apply = x => { if (Number.isFinite(x)) { set(x); lab.touch(); } };
    r.addEventListener('input', () => { n.value = r.value; apply(+r.value); });
    n.addEventListener('input', () => { if (n.value === '') return; r.max = Math.max(+r.max, +n.value); r.min = Math.min(+r.min, +n.value); r.value = n.value; apply(+n.value); });
    return h('div', { class: 'f' }, h('label', { text: label, title: label }), r, n);
  }
  function colorSel(tok, set) {
    const ramp = lab.cue.ramp, sw = h('span', { class: 'sw' }), s = h('select');
    s.append(opt('glow', 'glow (3)'), opt('core', 'core (6)'), opt('anchor', 'anchor (0)'));
    for (let i = 0; i <= 6; i++) s.append(opt(`${ramp}.${i}`, `${i}`));
    if (![...s.options].some(o => o.value === tok)) s.append(opt(tok, tok));
    s.value = tok; sw.style.background = tokSw(tok, ramp);
    s.addEventListener('change', () => { set(s.value); sw.style.background = tokSw(s.value, ramp); lab.touch(); });
    return [s, sw];
  }
  // o = track hoac doi tuong con (config...); parentKey = ten khoa cha ('' o muc track)
  function fields(box, o, parentKey = '') {
    for (const k of Object.keys(o)) {
      const v = o[k], rk = (k === 'min' || k === 'max') ? parentKey : k, label = parentKey ? `${parentKey}.${k}` : k;
      if (!parentKey && (k === 'type' || k === 'off' || (o.type === 'anim' && (k === 'atlas' || k === 'anim')))) continue;
      if (k === 'color' && typeof v === 'string') { const [s, sw] = colorSel(v, x => { o.color = x; }); box.append(h('div', { class: 'f' }, h('label', { text: 'màu' }), s, sw)); }
      else if (k === 'color' && Array.isArray(v)) {
        const g = h('div', { class: 'grp' }, h('div', { class: 'gl', text: 'màu hạt (đầu → cuối)' }));
        v.forEach((t, i) => { const [s, sw] = colorSel(t, x => { v[i] = x; }); g.append(h('div', { class: 'f' }, h('label', { text: `#${i + 1}` }), s, sw,
          v.length > 1 ? h('button', { text: '×', onclick: () => { v.splice(i, 1); lab.structure(); } }) : null)); });
        g.append(h('button', { text: '+ màu', onclick: () => { v.push(v[v.length - 1] || 'glow'); lab.structure(); } }));
        box.append(g);
      }
      else if (typeof v === 'number') box.append(num(label, v, rk, x => { o[k] = x; }));
      else if (typeof v === 'boolean' || BOOLS.includes(k)) box.append(h('div', { class: 'f' }, h('label', { text: k }), h('input', { type: 'checkbox', checked: !!v, onchange: e => { o[k] = e.target.checked; lab.touch(); } })));
      else if (typeof v === 'string' && ENUMS[k]) { const s = h('select', {}, ...ENUMS[k].map(x => opt(x))); if (!ENUMS[k].includes(v)) s.append(opt(v)); s.value = v; s.onchange = () => { o[k] = s.value; lab.touch(); }; box.append(h('div', { class: 'f' }, h('label', { text: k }), s)); }
      else if (typeof v === 'string' && TEXTS.includes(k)) box.append(h('div', { class: 'f' }, h('label', { text: k }), h('input', { type: 'text', value: v, oninput: e => { o[k] = e.target.value; lab.touch(); } })));
      else if (Array.isArray(v)) {
        const g = h('div', { class: 'grp' }, h('div', { class: 'gl', text: k }));
        v.forEach((x, i) => { if (typeof x === 'number') g.append(num(`${k}[${i}]`, x, k, y => { v[i] = y; })); });
        box.append(g);
      }
      else if (v && typeof v === 'object') { const g = h('div', { class: 'grp' }, h('div', { class: 'gl', text: k })); fields(g, v, k); box.append(g); }
    }
  }

  // track anim: o chon atlas (index.json) + tag; doi xong nap atlas, phat lai
  function atlasPick(tr) {
    const list = lab.atlases, cur = list.find(a => a.key === tr.atlas);
    const sa = h('select', { class: 'atlas-sel' }, ...list.map(a => opt(a.key, `${a.key} (${a.frames}f)`))), st = h('select', { class: 'tag-sel' }, ...(cur ? cur.tags : [tr.anim]).map(t => opt(t)));
    if (!cur) sa.append(opt(tr.atlas));
    sa.value = tr.atlas; st.value = tr.anim;
    sa.onchange = () => lab.pickAtlas(tr, sa.value);
    st.onchange = () => lab.pickAtlas(tr, tr.atlas, st.value);
    return h('div', { class: 'f' }, h('label', { text: 'atlas / tag' }), sa, st);
  }

  // ---- khoi track
  function trackBlock(tr, i) {
    const meta = h('span', { class: 'm' }), box = h('div', { class: 'tb' });
    const blk = h('div', { class: 'trk' + (open.has(tr) ? ' open' : '') + (tr.off ? ' off' : '') });
    const th = h('div', { class: 'th', onclick: e => { if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return; blk.classList.toggle('open'); blk.classList.contains('open') ? open.add(tr) : open.delete(tr); } },
      h('input', { type: 'checkbox', checked: !tr.off, title: 'bật/tắt track', onchange: e => { if (e.target.checked) delete tr.off; else tr.off = true; blk.classList.toggle('off', !!tr.off); lab.touch(); } }),
      h('b', { text: tr.type }), meta,
      h('button', { text: '⧉', title: 'nhân bản', onclick: () => lab.dupTrack(i) }),
      h('button', { text: '×', title: 'xoá track', onclick: () => lab.delTrack(i) }));
    blk.append(th, box);
    if (tr.type === 'anim') box.append(atlasPick(tr));
    fields(box, tr);
    blk._upd = () => { meta.textContent = `at ${tr.at} · dur ${tr.dur ?? '-'}`; };
    blk._upd();
    return blk;
  }

  return {
    render() {
      cueSel.replaceChildren(...lab.ids().map(id => opt(id))); cueSel.value = lab.cue.id;
      rampSel.value = lab.cue.ramp; this.renderStrip();
      durEl.replaceChildren(num('duration (ms)', lab.cue.duration ?? 1000, 'dur', x => { lab.cue.duration = x; }),
        h('div', { class: 'f' }, h('label', { text: 'ultimate' }), h('input', { type: 'checkbox', checked: !!lab.cue.ultimate, onchange: e => { lab.cue.ultimate = e.target.checked; lab.touch(); } }), h('span', { text: ' ngân sách hạt: 300 / thường 120' })));
      list.replaceChildren(...lab.cue.tracks.map(trackBlock));
      this.renderTimeline(); this.buttons();
    },
    renderStrip() { strip.replaceChildren(...FX_PALETTE[lab.cue.ramp].map(c => { const s = h('span', { class: 'sw' }); s.style.background = hex(c); return s; })); },
    renderTimeline() {
      const D = Math.max(1, lab.cue.duration || 1);
      tl.replaceChildren(cur, ...lab.cue.tracks.map((tr, i) => {
        const lane = h('div', { class: 'lane' }), b = h('div', { class: 'bar' + (tr.off ? ' off' : ''), title: `${tr.type} at ${tr.at} dur ${tr.dur ?? 0}` });
        const col = typeof tr.color === 'string' ? tr.color : Array.isArray(tr.color) ? tr.color[0] : 'glow';
        const l = Math.min(100, (tr.at || 0) / D * 100);
        b.style.left = l + '%'; b.style.width = Math.max(0.6, Math.min(100 - l, (tr.dur || 0) / D * 100)) + '%';
        b.style.background = tokSw(col, lab.cue.ramp);
        b.onclick = () => { const blk = list.children[i]; blk.classList.add('open'); open.add(tr); blk.scrollIntoView({ block: 'nearest' }); };
        lane.append(b); return lane;
      }));
      [...list.children].forEach(b => b._upd?.());
    },
    setCursor(f) { if (f == null) { cur.style.display = 'none'; return; } cur.style.display = 'block'; cur.style.left = Math.min(100, f * 100) + '%'; },
    buttons() {
      btnLoop.classList.toggle('on', lab.looping); btnLoop.textContent = lab.looping ? 'Lặp: bật' : 'Lặp';
      btnNight.textContent = lab.scene.night ? 'Đêm → Ngày' : 'Ngày → Đêm'; btnDummy.textContent = lab.dummy ? 'Bỏ bù nhìn' : 'Đặt bù nhìn';
    },
    setStats(fps, s, peak, warns) {
      fpsEl.textContent = `FPS ${fps}`;
      stEl.textContent = `FPS ${fps} · active ${s.active} · hạt ${s.particles} · obj ${s.objects} · đỉnh hạt ${peak.particles}/${peak.limit}`;
      warnEl.replaceChildren(...warns.map(w => h('div', { text: '⚠ ' + w })));
      this.buttons();
    },
    say, root, open,
  };
}
