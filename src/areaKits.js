// Shared by the runtime and baker. Coordinates/collision rectangles are anchor-relative pixels.
export const kitCacheKey = (area, kit) => `kit:${area}:${kit}`;
export const kitTextureKey = (area, kit, piece) => `${kitCacheKey(area, kit)}:${piece}`;
export const kitPieceUrl = (manifest, file) => manifest.slice(0, manifest.lastIndexOf('/') + 1) + file;

export function validateKit(id, kit) {
  if (kit?.kit !== id || !kit.pieces || typeof kit.pieces !== 'object') throw new Error(`Invalid kit ${id}`);
  const nums = (a, n) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
  for (const [name, p] of Object.entries(kit.pieces)) {
    if (!p.file || !['ground', 'base', 'roof'].includes(p.layer) || !nums(p.anchor, 2) || !nums(p.footprint, 2) || p.footprint.some(v => v < 0) ||
        !Array.isArray(p.collide) || p.collide.some(r => !nums(r, 4) || r[2] <= 0 || r[3] <= 0)) throw new Error(`Invalid piece ${id}/${name}`);
    if (p.pair && kit.pieces[p.pair]?.layer !== 'roof') throw new Error(`Invalid roof pair ${id}/${name}: ${p.pair}`);
  }
  return kit;
}

// A paired roof shares the base's world anchor, but has its own image anchor.
// An explicit roof at that same position takes precedence (no duplicate rendering/collision).
export function resolveKitPieces(meta, kits) {
  const given = meta.pieces || [], out = [];
  const lookup = o => {
    if (typeof o.k !== 'string' || !Number.isFinite(o.x) || !Number.isFinite(o.y)) throw new Error('Invalid kit placement');
    const slash = o.k.indexOf('/'), kit = o.k.slice(0, slash), name = o.k.slice(slash + 1), piece = kits[kit]?.pieces?.[name];
    if (slash < 1 || !meta.kits?.[kit] || !piece) throw new Error(`Unknown kit piece ${o.k}`);
    return { ...o, kit, name, piece };
  };
  for (const o of given) {
    const r = lookup(o); out.push(r);
    if (r.piece.pair) {
      const k = `${r.kit}/${r.piece.pair}`;
      if (!given.some(p => p.k === k && p.x === o.x && p.y === o.y)) out.push(lookup({ k, x: o.x, y: o.y }));
    }
  }
  return out;
}
