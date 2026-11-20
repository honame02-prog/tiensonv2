import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

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

export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 2000 }, plugins: [fxlabSave()] });
