import { defineConfig } from 'vite';
import { writeFileSync, readFileSync, readdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, sep, join, extname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';

// Chi khi chay `vite` (dev): FxLab "Luu vao du an" gui POST /__fxlab/save {id, json} -> ghi src/fx/cues/<id>.json. Khong co trong build.
const fxlabSave = () => ({
  name: 'fxlab-save',
  apply: 'serve',
  configureServer(server) {
    const dir = resolve(server.config.root, 'src/fx/cues');
    server.middlewares.use('/__fxlab/save', (req, res) => {
      const reply = (code, msg) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(msg)); };
      if (req.method !== 'POST') return reply(405, { ok: false, error: 'chi nhan POST' });
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try {
          const { id, json } = JSON.parse(body);
          if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) return reply(400, { ok: false, error: 'id chi gom [a-z0-9-]' });
          const text = typeof json === 'string' ? json : JSON.stringify(json, null, 1);
          const cue = JSON.parse(text);
          if (!cue || cue.id !== id || !Array.isArray(cue.tracks)) return reply(400, { ok: false, error: 'json khong phai cue hop le (id khop, co tracks)' });
          const file = resolve(dir, id + '.json');
          if (!file.startsWith(dir + sep)) return reply(400, { ok: false, error: 'duong dan ngoai thu muc cues' });
          writeFileSync(file, text.endsWith('\n') ? text : text + '\n');
          reply(200, { ok: true, file: 'src/fx/cues/' + id + '.json' });
        } catch (e) { reply(400, { ok: false, error: String(e.message || e) }); }
      });
    });
  },
});

// Chi khi chay `vite` (dev): Area Editor (src/editor, ?edit=1). Doc/ghi tools/areas/<id>.src.json qua tools/areaed/{srcio,txn}.mjs (giu dinh dang, hash chong xung dot, bake giao dich). Khong co trong build.
const areaEditor = () => ({
  name: 'area-editor',
  apply: 'serve',
  configureServer(server) {
    const root = server.config.root, ID = /^[A-Za-z0-9_-]+$/;
    const mod = n => import(pathToFileURL(resolve(root, 'tools/areaed', n)).href);
    // recoverJournals xong moi phuc vu /__areaed/* (moi handler await ready)
    const ready = mod('txn.mjs').then(m => m.recoverJournals(root)).then(r => { if (r?.length) console.log('[areaed] da khoi phuc journal:', r.join(', ')); }).catch(e => console.warn('[areaed] recoverJournals:', e.message));
    server.areaedReady = ready;
    // middleware nay tra loi TRUOC bo loc Host cua Vite -> tu kiem Host (chong DNS rebinding) va Origin cung nguon; sai -> 403. AREAED_ALLOW_HOSTS=host:port,... de cho phep them (vd truy cap qua LAN)
    const extraHosts = (process.env.AREAED_ALLOW_HOSTS || '').split(',').filter(Boolean);
    const hostOk = req => { const h = req.headers.host || '', m = /^(localhost|127\.0\.0\.1|\[::1\]):(\d+)$/.exec(h), port = server.httpServer?.address()?.port; return !!(m && (!port || +m[2] === port)) || extraHosts.includes(h); };
    const originOk = req => { const o = req.headers.origin; if (o === undefined) return true; try { return new URL(o).host === req.headers.host; } catch { return false; } };
    const reply = (res, code, msg) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(msg)); };
    const body = req => new Promise((ok, no) => {
      let b = ''; req.on('data', c => { b += c; if (b.length > 8e6) { req.destroy(); no(new Error('body qua lon')); } });
      req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); req.on('error', no);
    });
    const query = req => new URL(req.url, 'http://x').searchParams;
    const srcFile = id => resolve(root, 'tools/areas', id + '.src.json');
    const handle = (path, method, fn) => server.middlewares.use(path, async (req, res) => {
      if (!hostOk(req)) return reply(res, 403, { ok: false, error: 'Host khong duoc phep' });
      if (!originOk(req)) return reply(res, 403, { ok: false, error: 'Origin khong cung nguon' });
      if (req.method !== method) return reply(res, 405, { ok: false, error: 'chi nhan ' + method });
      try { await ready; await fn(req, res); } catch (e) { reply(res, 500, { ok: false, code: 'io', error: String(e.message || e) }); }
    });
    // rong x cao PNG tu IHDR (khong can thu vien)
    const pngSize = f => { try { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; } catch { return [0, 0]; } };
    const conceptRoot = [process.env.AREAED_CONCEPT_DIR, resolve(root, '../design/tienson'), resolve(root, '../../design/tienson')].filter(Boolean).find(d => existsSync(d));
    const IMG = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

    handle('/__areaed/src', 'GET', async (req, res) => {
      const id = query(req).get('id');
      if (!ID.test(id || '') || !existsSync(srcFile(id))) return reply(res, 404, { ok: false, error: 'khong co khu ' + id });
      const { hashText, parseSrc, editableView } = await mod('srcio.mjs'), text = readFileSync(srcFile(id), 'utf8');
      reply(res, 200, { id, hash: hashText(text), view: editableView(parseSrc(text).obj) });
    });
    handle('/__areaed/kits', 'GET', async (req, res) => {
      const dir = resolve(root, 'public/assets/kits'), out = [];
      for (const d of readdirSync(dir).sort()) {
        const mf = join(dir, d, 'kit.json'); if (!existsSync(mf)) continue;
        let kit; try { kit = JSON.parse(readFileSync(mf, 'utf8')); } catch { continue; }
        if (kit.kit !== d || !kit.pieces) continue;
        const pieces = {};
        for (const [n, p] of Object.entries(kit.pieces)) {
          const [w, h] = pngSize(join(dir, d, p.file));
          pieces[n] = { file: p.file, layer: p.layer, anchor: p.anchor, footprint: p.footprint, collide: p.collide, pair: p.pair, w, h };
        }
        out.push({ kit: d, url: 'assets/kits/' + d + '/kit.json', pieces });
      }
      reply(res, 200, out);
    });
    handle('/__areaed/concepts', 'GET', async (req, res) => {
      const out = [];
      const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (IMG[extname(e.name).toLowerCase()]) out.push(relative(conceptRoot, p).split(sep).join('/')); } };
      if (conceptRoot) walk(conceptRoot);
      reply(res, 200, out.sort());
    });
    handle('/__areaed/concept', 'GET', async (req, res) => {
      const p = query(req).get('path') || '', file = conceptRoot && resolve(conceptRoot, p);   // chi doc, chan duong dan thoat ra ngoai thu muc concept
      if (!file || !file.startsWith(conceptRoot + sep) || !IMG[extname(file).toLowerCase()]) return reply(res, 400, { ok: false, error: 'duong dan concept khong hop le' });
      if (!existsSync(file) || !statSync(file).isFile()) return reply(res, 404, { ok: false, error: 'khong co concept' });
      res.setHeader('Content-Type', IMG[extname(file).toLowerCase()]); createReadStream(file).pipe(res);
    });
    handle('/__areaed/backups', 'GET', async (req, res) => {
      const id = query(req).get('id');
      if (!ID.test(id || '')) return reply(res, 400, { ok: false, error: 'id khong hop le' });
      reply(res, 200, { ok: true, list: await (await mod('txn.mjs')).listBackups(root, id) });   // moi nhat truoc; ten dung truc tiep cho restore
    });
    handle('/__areaed/restore', 'POST', async (req, res) => {
      const { id, name } = await body(req);
      if (!ID.test(id || '') || typeof name !== 'string') return reply(res, 400, { ok: false, code: 'invalid', error: 'id/name khong hop le' });
      const r = await (await mod('txn.mjs')).restoreBackup(root, id, name); delete r.diskText; reply(res, r.ok ? 200 : 400, r);
    });
    handle('/__areaed/save', 'POST', async (req, res) => {
      const { id, baseHash, pieces, kits } = await body(req);
      if (!ID.test(id || '') || !existsSync(srcFile(id))) return reply(res, 400, { ok: false, code: 'invalid', error: 'id khong hop le' });
      if (typeof baseHash !== 'string' || !Array.isArray(pieces) || !kits || typeof kits !== 'object') return reply(res, 400, { ok: false, code: 'invalid', error: 'thieu baseHash/pieces/kits' });
      const { parseSrc, editableView, spliceTopLevel, validateEdit } = await mod('srcio.mjs'), { saveArea } = await mod('txn.mjs');
      const text = readFileSync(srcFile(id), 'utf8'), obj = parseSrc(text).obj, view = editableView(obj), edits = {};
      if (!isDeepStrictEqual(pieces, view.pieces)) edits.pieces = pieces;   // khoa khong doi -> khong dong vao (giu nguyen tung byte)
      if (!isDeepStrictEqual(kits, view.kits)) edits.kits = kits;
      const kitsJson = {}, pub = resolve(root, 'public');
      for (const [k, url] of Object.entries(kits)) {
        try { const f = resolve(pub, url); if (f.startsWith(pub + sep)) kitsJson[k] = JSON.parse(readFileSync(f, 'utf8')); } catch { /* validateEdit bao thieu kit */ }
      }
      const v = validateEdit({ id, fileId: id, obj, edits, kitsJson });
      if (!v.ok) return reply(res, 400, { ok: false, code: 'invalid', error: v.errors.join('; ') });
      const r = await saveArea({ root, id, baseHash, newText: Object.keys(edits).length ? spliceTopLevel(text, edits) : text });
      delete r.diskText; reply(res, r.ok ? 200 : r.code === 'conflict' ? 409 : 400, r);
    });
    handle('/__areaed/check', 'POST', async (req, res) => {
      const { id } = await body(req);
      if (!ID.test(id || '')) return reply(res, 400, { ok: false, error: 'id khong hop le' });
      const p = spawn(process.execPath, ['tools/blockout_reach.mjs'], { cwd: root, windowsHide: true });
      let out = '', err = '';
      const t = setTimeout(() => p.kill(), 120000);
      p.stdout.on('data', b => { out += b; }); p.stderr.on('data', b => { err += b; });
      p.on('close', code => { clearTimeout(t); reply(res, 200, { ok: code === 0, exit: code, stdout: out.slice(-8000), stderr: err.slice(-4000) }); });
    });
  },
});

export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 2000 }, plugins: [fxlabSave(), areaEditor()] });
