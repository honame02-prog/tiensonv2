// Kiem toi duoc cho khu xam: node tools/blockout_reach.mjs   (sau khi bake 3 khu)
// BFS 4 huong tren luoi col tu spawn mac dinh toi: moi cong, moi spawn, o canh moi khoi hall/building/pavilion/gate. Cong -> spawn dich phai ton tai 2 chieu.
import { readFileSync } from 'node:fs';
const IDS = ['huyen-van-quan-v2', 'son-dao-v3', 'hau-son-v3'];
const M = {}; for (const id of IDS) M[id] = { a: JSON.parse(readFileSync(`public/assets/areas/${id}/area.json`, 'utf8')), s: JSON.parse(readFileSync(`tools/areas/${id}.src.json`, 'utf8')) };
let fail = 0; const say = (ok, m) => { console.log((ok ? 'OK   ' : 'LOI  ') + m); if (!ok) fail++; };
for (const id of IDS) {
  const { a, s } = M[id], col = a.col, R = col.length, C = col[0].length;
  const cellOf = (x, y) => [Math.min(C - 1, Math.max(0, Math.floor(x / 32))), Math.min(R - 1, Math.max(0, Math.floor(y / 32)))];
  const [sx, sy] = cellOf(a.spawns.default[0], a.spawns.default[1]);
  const seen = Array.from({ length: R }, () => Array(C).fill(0)); let q = [[sx, sy]]; seen[sy][sx] = col[sy][sx] ? 0 : 1; if (col[sy][sx]) say(false, `${id}: spawn mac dinh nam trong o chan (${sx},${sy})`);
  while (q.length) { const nq = []; for (const [x, y] of q) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= C || Y >= R || seen[Y][X] || col[Y][X]) continue; seen[Y][X] = 1; nq.push([X, Y]); } q = nq; }
  const walkTotal = col.flat().filter(v => !v).length, walkSeen = seen.flat().filter(Boolean).length;
  console.log(`== ${id}: ${C}x${R} o, di duoc ${walkTotal}, tu spawn mac dinh toi ${walkSeen} (${(walkSeen / walkTotal * 100).toFixed(1)} %)`);
  const reach = (x, y) => { const [cx, cy] = cellOf(x, y); return !!seen[cy][cx]; };
  let ok = 0, tot = 0; const bad = [];
  for (const p of a.portals) { tot++; const r = reach(p.rect[0] + p.rect[2] / 2, p.rect[1] + p.rect[3] / 2); r ? ok++ : bad.push('cong ' + p.id); }
  for (const e of a.exits || []) { tot++; const r = reach(e.rect[0] + e.rect[2] / 2, e.rect[1] + e.rect[3] / 2); r ? ok++ : bad.push('exit ' + e.title); }
  for (const [k, v] of Object.entries(a.spawns)) { tot++; reach(v[0], v[1]) ? ok++ : bad.push('spawn ' + k); }
  for (const b of s.blockout.blocks.filter(b => ['hall', 'building', 'pavilion', 'gate'].includes(b.kind))) {
    tot++; const [x, y, w, h] = b.rect, bx = x / 32, by = y / 32, bw = w / 32, bh = h / 32, wallSet = new Set(s.blockout.wallCells.map(c => c.join(',')));
    // B = o thuoc khoi (giao >= 0.3 o, tru o tuong); dat tieu chi: co o toi duoc nam trong B hoac ke 4 huong voi B
    const B = []; let best = null;
    for (let cy = Math.max(0, Math.floor(by)); cy < Math.min(R, Math.ceil(by + bh)); cy++) for (let cx = Math.max(0, Math.floor(bx)); cx < Math.min(C, Math.ceil(bx + bw)); cx++) {
      const o = Math.max(0, Math.min(cx + 1, bx + bw) - Math.max(cx, bx)) * Math.max(0, Math.min(cy + 1, by + bh) - Math.max(cy, by)); if (!best || o > best.o) best = { cx, cy, o }; if (o >= 0.3 && !wallSet.has(cx + ',' + cy)) B.push([cx, cy]); }
    if (!B.length && best) B.push([best.cx, best.cy]);
    let hit = false; for (const [cx, cy] of B) { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = cx + dx, Y = cy + dy; if (X >= 0 && Y >= 0 && X < C && Y < R && seen[Y][X]) hit = true; } }
    hit ? ok++ : bad.push(`${b.kind} ${b.id}`);
  }
  say(ok === tot, `${id}: toi duoc ${ok}/${tot} (cong + exit + spawn + khoi hall/building/pavilion/gate)${bad.length ? ' — KHONG TOI: ' + bad.join(', ') : ''}`);
  for (const p of a.portals) { const t = M[p.to.area]; const sp = t?.a.spawns[p.to.spawn]; const back = t?.a.portals.find(q => q.to.area === id);
    say(!!t && !!sp && !!back && !!M[id].a.spawns[back.to.spawn], `cong ${id}/${p.id} -> ${p.to.area}:${p.to.spawn} ${sp ? 'spawn co' : 'SPAWN KHONG CO'}; chieu nguoc ${back ? back.id + ' -> ' + back.to.spawn + (M[id].a.spawns[back.to.spawn] ? ' co' : ' KHONG CO') : 'KHONG CO'}`); }
}
console.log(fail ? `\n${fail} LOI` : '\nTAT CA DAT'); process.exit(fail ? 1 : 0);
