// FxLab: ban nhap localStorage theo id cue, dinh dang JSON, tai / chep / luu vao du an.
const KEY = 'fxlab:draft:';
export const clone = o => JSON.parse(JSON.stringify(o));
export const validId = id => typeof id === 'string' && /^[a-z0-9-]+$/.test(id);

export function loadDrafts() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY)) { try { const c = JSON.parse(localStorage.getItem(k)); if (c && c.id === k.slice(KEY.length) && Array.isArray(c.tracks)) out[c.id] = c; } catch (e) { /* bo ban hong */ } }
    }
  } catch (e) { /* localStorage bi chan */ }
  return out;
}
export function saveDraft(cue) { try { localStorage.setItem(KEY + cue.id, JSON.stringify(cue)); return true; } catch (e) { return false; } }
export function dropDraft(id) { try { localStorage.removeItem(KEY + id); } catch (e) { /* bo qua */ } }

// cung dang voi cac file trong src/fx/cues: dong dau la thuoc tinh cue, moi track 1 dong
export function formatCue(cue) {
  const head = Object.entries(cue).filter(([k]) => k !== 'tracks').map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ');
  return `{ ${head},\n  "tracks": [\n${cue.tracks.map(t => '    ' + JSON.stringify(t)).join(',\n')}\n  ] }\n`;
}
export function download(cue) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([formatCue(cue)], { type: 'application/json' }));
  a.download = cue.id + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* thu cach cu */ }
  const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-999px';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* khong chep duoc */ }
  ta.remove(); return ok;
}
export async function saveToProject(cue) {
  const r = await fetch('/__fxlab/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cue.id, json: formatCue(cue) }) });
  const j = await r.json().catch(() => ({ ok: false, error: 'phản hồi không hợp lệ' }));
  if (!r.ok || !j.ok) throw new Error(j.error || r.status);
  return j.file;
}
