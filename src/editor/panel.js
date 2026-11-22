// Area Editor: panel DOM (thanh tren, thu vien trai, thuoc tinh phai). Khong thu vien; phong cach theo src/fxlab/panel.js.
const CSS = `
#aed{position:fixed;inset:0;z-index:20;pointer-events:none;font:12px/1.35 'NotoSerifVN',Georgia,serif;color:#efe6d2}
#aed *{box-sizing:border-box}
#aed .bar,#aed .lib,#aed .prp,#aed .log{pointer-events:auto;background:rgba(18,16,22,.93);border:1px solid #b8913f}
#aed .bar{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;align-items:center;padding:4px 8px;border-width:0 0 1px}
#aed .lib{position:absolute;left:0;top:34px;bottom:0;width:230px;display:flex;flex-direction:column;border-width:0 1px 0 0}
#aed .prp{position:absolute;right:0;top:34px;bottom:0;width:250px;overflow-y:auto;padding:6px 8px;border-width:0 0 0 1px}
#aed button,#aed select,#aed input[type=text],#aed input[type=number],#aed input[type=search]{font:inherit;color:#f3e6c4;background:#352a2a;border:1px solid #8a6d32;border-radius:3px;padding:2px 6px;min-height:24px}
#aed button{cursor:pointer}#aed button:disabled{opacity:.45;cursor:default}#aed button.on{background:#7a2a22}
#aed .st{margin-left:auto;font:12px monospace}
#aed .st.ok{color:#9fe3a0}#aed .st.dirty{color:#ffd180}#aed .st.bake{color:#80d8ff}#aed .st.err{color:#ff8a80}
#aed .lib .q{margin:6px}#aed .lib .list{flex:1;overflow-y:auto;padding:0 6px 8px}
#aed details>summary{cursor:pointer;color:#f6e7bd;font-weight:700;margin:3px 0}
#aed .it{display:flex;gap:6px;align-items:center;padding:2px;border:1px solid transparent;border-radius:3px;cursor:pointer}
#aed .it:hover{background:#2a2226}#aed .it.on{border-color:#69f0ae;background:#1f3a2a}
#aed .it img{width:40px;height:40px;object-fit:contain;image-rendering:pixelated;background:#0d0c10;flex:none}
#aed .it small{color:#b9ab86;display:block}
#aed h4{margin:8px 0 3px;color:#e3c97f;font-size:12px}
#aed .f{display:flex;align-items:center;gap:5px;margin:3px 0}#aed .f label{width:64px;flex:none;color:#d9c9a0}
#aed .f input[type=number],#aed .f input[type=text]{flex:1;min-width:0}
#aed .f input[type=range]{flex:1;min-width:0}
#aed .m{color:#b9ab86;font:11px monospace;white-space:pre-wrap}
#aed .log{position:absolute;left:50%;top:60px;transform:translateX(-50%);width:min(640px,80vw);max-height:60vh;overflow:auto;padding:8px;display:none}
#aed .log pre{margin:0;white-space:pre-wrap;font:11px monospace}
#aed .zm{font:12px monospace;color:#cfe}
#aed .dr{pointer-events:auto;position:absolute;left:50%;top:40px;transform:translateX(-50%);background:#3a2f12;border:1px solid #e3c97f;padding:6px 10px;display:none;gap:8px;align-items:center;z-index:3}
#aed .dlg{pointer-events:auto;position:absolute;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:5}
#aed .dlg .box{background:#1d1820;border:1px solid #b8913f;padding:10px 12px;min-width:320px;max-width:80vw;max-height:70vh;overflow:auto}
#aed .dlg .bk{display:flex;gap:8px;align-items:center;margin:3px 0}#aed .dlg .bk span{flex:1}
#aed.play .lib,#aed.play .prp,#aed .hide{display:none}
`;
const KITS_OPEN_MAX = 400;

export function createPanel(S, A) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'aed';
  root.innerHTML = `<div class="bar">
    <b class="nm"></b>
    <button data-a="save" title="Ctrl+S">Lưu</button>
    <button data-a="undo" title="Ctrl+Z">Hoàn tác</button><button data-a="redo" title="Ctrl+Y">Làm lại</button>
    <button data-a="play" title="Tab">Chơi thử</button>
    <details class="ov" style="position:relative"><summary style="cursor:pointer">Lớp phủ</summary><div class="ovl" style="position:absolute;top:24px;left:0;background:#221c20;border:1px solid #b8913f;padding:6px;z-index:2;white-space:nowrap"></div></details>
    <button data-a="check">Kiểm tra</button><button data-a="bak">Sao lưu</button>
    <button data-a="reload" class="hide" style="display:none">Tải lại từ đĩa</button>
    <span class="zm" title="Lăn chuột: zoom 0.25-6×; phím 0: vừa khung cả khu"></span><span class="st"></span></div>
    <div class="dr"><span>Có bản nháp chưa lưu của khu này.</span><button data-a="drrestore">Khôi phục</button><button data-a="drdiscard">Bỏ nháp</button></div>
    <div class="dlg"><div class="box"></div></div>
    <div class="lib"><input class="q" type="search" placeholder="Tìm mảnh / kit..."><div class="list"></div></div>
    <div class="prp"></div><div class="log"><button data-a="closelog" style="float:right">Đóng</button><pre></pre></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  root.querySelector('.nm').textContent = S.id;
  const LAYER_NAMES = { grid: 'Lưới 32', col: 'Lưới chặn (col)', tier: 'Màu tầng', collide: 'Va chạm piece', anchor: 'Điểm neo', frame: 'Khung ảnh', portals: 'Cổng', spawns: 'Điểm sinh', steps: 'Bậc', exits: 'Vùng exits' };
  $('.ovl').innerHTML = Object.entries(LAYER_NAMES).map(([k, n]) => `<label style="display:block"><input type="checkbox" data-layer="${k}"> ${n}</label>`).join('');
  const bind = (el, ev, fn) => el.addEventListener(ev, fn);
  const m = () => S.model;

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'save') A.save(); else if (a === 'undo') A.undo(); else if (a === 'redo') A.redo(); else if (a === 'play') A.togglePlay();
    else if (a === 'check') A.check(); else if (a === 'closelog') $('.log').style.display = 'none'; else if (a === 'reload') location.reload();
    else if (a === 'drrestore') A.applyDraft(); else if (a === 'drdiscard') A.discardDraft(); else if (a === 'bak') showBackups(); else if (a === 'bkrestore') askRestore(e.target.closest('[data-a]').dataset.name);
    else if (a === 'del') A.remove(); else if (a === 'dup') A.duplicate(); else if (a === 'clearconcept') A.concept.clear();
  });
  bind($('.ovl'), 'change', e => { const k = e.target.dataset.layer; if (k) A.setLayer(k, e.target.checked); });

  // ---------- hop thoai DOM cua editor (khong dung window.confirm) + danh sach ban sao luu
  const dlg = $('.dlg'), box = $('.dlg .box');
  const openBox = html => { box.innerHTML = html; dlg.style.display = 'flex'; };
  const closeBox = () => { dlg.style.display = 'none'; box.innerHTML = ''; };
  function confirmBox(msg, okLabel) {
    return new Promise(res => {
      openBox(`<div style="margin-bottom:8px">${msg}</div><div class="f"><button data-cf="1">${okLabel}</button><button data-cf="0">Hủy</button></div>`);
      box.onclick = e => { const b = e.target.closest('[data-cf]'); if (b) { box.onclick = null; closeBox(); res(b.dataset.cf === '1'); } };
    });
  }
  const fmtName = n => `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6, 8)} ${n.slice(9, 11)}:${n.slice(11, 13)}:${n.slice(13, 15)} (UTC)`;
  async function showBackups() {
    openBox('<div>Đang tải...</div>');
    const r = await A.listBackups();
    openBox(`<b>Bản sao lưu của ${S.id}</b> (mới nhất trên cùng; mỗi lần lưu cất bản trước đó)${(r.list || []).map(n => `<div class="bk" data-name="${n}"><span>${fmtName(n)}</span><code>${n}</code><button data-a="bkrestore" data-name="${n}">Khôi phục</button></div>`).join('') || '<div class="m">Chưa có bản sao lưu</div>'}${r.error ? '<div class="m">Lỗi: ' + r.error + '</div>' : ''}<div class="f"><button data-a="bkclose">Đóng</button></div>`);
  }
  async function askRestore(name) {
    const ok = await confirmBox(`Khôi phục bản ${fmtName(name)}? Mọi thay đổi chưa lưu sẽ mất; bản hiện tại được sao lưu trước. Cảnh sẽ tải lại.`, 'Khôi phục');
    if (!ok) return showBackups();
    openBox('<div>Đang khôi phục...</div>');
    const r = await A.restore(name);
    if (r.ok) return;   // trang tải lại
    openBox(`<div class="m">Lỗi: ${r.error}</div><div class="f"><button data-a="bkclose">Đóng</button></div>`);
  }
  root.addEventListener('click', e => { if (e.target.closest('[data-a=bkclose]')) closeBox(); });

  // ---------- thu vien
  const libList = $('.list'), q = $('.q');
  function renderLib() {
    const term = q.value.trim().toLowerCase(), html = [];
    for (const [kit, d] of Object.entries(S.lib || {}).sort()) {
      const names = Object.keys(d.pieces).filter(n => !term || n.toLowerCase().includes(term) || kit.toLowerCase().includes(term));
      if (!names.length) continue;
      const open = term || d.inArea || d.opened;
      const items = open ? names.slice(0, KITS_OPEN_MAX).map(n => {
        const p = d.pieces[n], k = kit + '/' + n, size = p.w ? `${p.w}×${p.h}` : '';
        return `<div class="it${S.armed === k ? ' on' : ''}" draggable="true" data-k="${k}"><img loading="lazy" src="${A.thumbUrl(kit, n)}"><div><b>${n}</b><small>${size} · ${p.layer}</small></div></div>`;
      }).join('') : '';
      html.push(`<details data-kit="${kit}"${open ? ' open' : ''}><summary>${kit} (${names.length})${d.inArea ? ' •' : ''}</summary>${items}</details>`);
    }
    libList.innerHTML = html.join('') || '<div class="m">Không có kit</div>';
  }
  bind(q, 'input', renderLib);
  bind(libList, 'click', e => { const it = e.target.closest('.it'); if (it) A.arm(S.armed === it.dataset.k ? null : it.dataset.k); });
  bind(libList, 'dragstart', e => { const it = e.target.closest('.it'); if (it) { e.dataTransfer.setData('text/areaed', it.dataset.k); e.dataTransfer.effectAllowed = 'copy'; } });
  bind(libList, 'toggle', e => {   // mo kit chua liet ke mảnh: ve lai
    const d = e.target; if (d.tagName === 'DETAILS' && d.open && !d.querySelector('.it')) { S.lib[d.dataset.kit].opened = true; renderLib(); }
  }, true);

  // ---------- thuoc tinh
  let concepts = null;
  const prp = $('.prp');
  const num = (label, id, v, step = 1) => `<div class="f"><label>${label}</label><input type="number" id="aed-${id}" value="${v}" step="${step}"></div>`;
  function renderProps(force) {
    if (!force && prp.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    const M = m(), sel = M.sel, ps = sel.map(i => M.pieces[i]).filter(Boolean);
    let h = '<h4>Mục đang chọn</h4>';
    if (!ps.length) h += '<div class="m">Chưa chọn. Bấm vào mảnh, Shift+bấm để thêm, kéo khung vùng trống (hoặc kéo chuột phải) để chọn nhiều.</div>';
    else if (ps.length === 1) {
      const p = ps[0], info = A.pieceInfo(p.k), t = A.tierAtFoot(p), d = A.depthAt(sel[0]);
      h += `<div class="f"><label>k</label><input type="text" id="aed-k" value="${p.k}"></div>${num('x', 'x', p.x)}${num('y', 'y', p.y)}
        <div class="m">lớp: ${info?.layer ?? '?'}\ndepth: ${d == null ? '?' : (+d).toFixed(2)}\ntầng tại chân: ${t.toFixed(2)}\nva chạm: ${info?.collide?.length ? JSON.stringify(info.collide) : 'không'}\nchỉ số placement: ${sel[0]}</div>`;
    } else h += `<div class="m">${ps.length} mục</div>${num('Δx', 'dx', 0)}${num('Δy', 'dy', 0)}`;
    h += `<div class="f"><button data-a="dup" ${ps.length ? '' : 'disabled'}>Nhân bản</button><button data-a="del" ${ps.length ? '' : 'disabled'}>Xoá</button></div>`;
    h += '<h4>Kit trong khu (ẩn / khoá)</h4>' + Object.keys(M.kits).sort().map(k => `<div class="f"><label style="width:auto;flex:1">${k}</label><label style="width:auto"><input type="checkbox" data-kf="hidden:${k}" ${S.hidden.has(k) ? 'checked' : ''}> ẩn</label><label style="width:auto"><input type="checkbox" data-kf="locked:${k}" ${S.locked.has(k) ? 'checked' : ''}> khoá</label></div>`).join('');
    const c = S.concept;
    h += `<h4>Lớp phủ concept</h4><div class="f"><select id="aed-cs"><option value="">(không)</option>${(concepts || []).map(p => `<option ${c.path === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="m">${c.name || c.path || 'Thả file ảnh vào cảnh để dùng'}</div>
      <div class="f"><label>mờ</label><input type="range" id="aed-co" min="0" max="1" step="0.05" value="${c.opacity}"></div>
      ${num('x', 'cx', c.x)}${num('y', 'cy', c.y)}${num('zoom', 'cz', c.zoom, 0.05)}
      <div class="f"><label style="width:auto"><input type="checkbox" id="aed-cl" ${c.locked ? 'checked' : ''}> khoá</label><label style="width:auto"><input type="checkbox" id="aed-cv" ${c.visible ? 'checked' : ''}> hiện</label><button data-a="clearconcept">Bỏ</button></div>
      <div class="m">Giữ C + kéo: dời concept (khi chưa khoá).</div>`;
    prp.innerHTML = h;
  }
  bind(prp, 'change', e => {
    const id = e.target.id, M = m(), v = +e.target.value;
    if (e.target.dataset.kf) { const [f, k] = e.target.dataset.kf.split(':'); A.setKitFlag(k, f, e.target.checked); return; }
    if (id === 'aed-x' || id === 'aed-y') { const i = M.sel[0], p = M.pieces[i]; M.setPos(i, id === 'aed-x' ? Math.round(v) : p.x, id === 'aed-y' ? Math.round(v) : p.y); }
    else if (id === 'aed-dx' || id === 'aed-dy') M.moveBy(id === 'aed-dx' ? Math.round(v) : 0, id === 'aed-dy' ? Math.round(v) : 0);
    else if (id === 'aed-k') { if (!A.setK(e.target.value)) { S.op = { kind: 'error', msg: 'không có mảnh ' + e.target.value }; } }
    else if (id === 'aed-cs') { e.target.value ? A.concept.load(e.target.value) : A.concept.clear(); }
    else if (id === 'aed-co') { S.concept.opacity = v; A.concept.apply(); }
    else if (id === 'aed-cx') { S.concept.x = Math.round(v); A.concept.apply(); } else if (id === 'aed-cy') { S.concept.y = Math.round(v); A.concept.apply(); }
    else if (id === 'aed-cz') { S.concept.zoom = Math.max(0.05, v || 1); A.concept.apply(); }
    else if (id === 'aed-cl') { S.concept.locked = e.target.checked; A.concept.apply(); } else if (id === 'aed-cv') { S.concept.visible = e.target.checked; A.concept.apply(); }
    renderProps(true); refresh();
  });
  bind(prp, 'input', e => { if (e.target.id === 'aed-co') { S.concept.opacity = +e.target.value; A.concept.apply(); } });

  // ---------- thanh tren + trang thai
  function status() {
    const o = S.op;
    if (o?.kind === 'baking') return ['bake', 'Đang bake...'];
    if (o?.kind === 'error') return ['err', (o.code === 'conflict' ? 'XUNG ĐỘT: file trên đĩa đã đổi. ' : 'Lỗi: ') + o.msg];
    if (m().dirty) return ['dirty', 'Chưa lưu'];
    return ['ok', o?.kind === 'saved' ? `Đã lưu (${o.ms} ms)` : 'Đã lưu'];
  }
  function refresh() {
    const M = m(), [cls, txt] = status(), s = $('.st'); s.className = 'st ' + cls; s.textContent = txt + (S.armed ? '  | đang đặt: ' + S.armed + ' (Esc để thôi)' : '');
    $('[data-a=save]').disabled = S.op?.kind === 'baking' || !S.baseHash;
    $('[data-a=undo]').disabled = !M.undoStack.length; $('[data-a=redo]').disabled = !M.redoStack.length;
    $('[data-a=play]').textContent = S.mode === 'play' ? 'Sửa (Tab)' : 'Chơi thử (Tab)';
    $('.zm').textContent = S.scene ? (+S.scene.cameras.main.zoom.toFixed(2)) + '×' : ''; $('.dr').style.display = S.draft && S.mode === 'edit' ? 'flex' : 'none';
    $('[data-a=reload]').style.display = S.op?.code === 'conflict' ? '' : 'none';
    for (const c of root.querySelectorAll('[data-layer]')) c.checked = !!S.layers[c.dataset.layer];
    libList.querySelectorAll('.it').forEach(it => it.classList.toggle('on', it.dataset.k === S.armed));
    if (S.mode === 'edit') renderProps();
  }
  fetch('/__areaed/concepts').then(r => r.json()).then(l => { concepts = l; if (S.mode === 'edit') renderProps(true); }).catch(() => {});
  return {
    refresh, renderLib,
    setMode(mode) { root.classList.toggle('play', mode === 'play'); if (mode === 'edit') { renderLib(); renderProps(true); } },
    showLog(t) { $('.log').style.display = 'block'; $('.log pre').textContent = t; },
    destroy() { root.remove(); st.remove(); },
  };
}
