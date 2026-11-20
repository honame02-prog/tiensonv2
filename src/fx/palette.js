// Bang mau FX: doc fx-palette.json (sinh tu art/palette/tienson-fx.gpl bang tools/gpl_to_json.mjs).
import raw from './fx-palette.json';

const toInt = h => parseInt(h.slice(1), 16);
export const FX_PALETTE = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v.map(toInt)]));

// token -> 0xRRGGBB. Token: "hoa.3", "glow" (=3), "core" (=6), "anchor" (=0), so nguyen, "#rrggbb".
export function resolveColor(tok, ramp, palette = FX_PALETTE) {
  if (typeof tok === 'number') return tok;
  if (tok == null) return 0xffffff;
  if (tok[0] === '#') return parseInt(tok.slice(1), 16);
  const r = palette[ramp];
  if (tok === 'glow') return r[3];
  if (tok === 'core') return r[6];
  if (tok === 'anchor') return r[0];
  const m = /^(\w+)\.([0-6])$/.exec(tok);
  if (m && palette[m[1]]) return palette[m[1]][+m[2]];
  throw new Error(`FX: token mau khong hop le "${tok}"`);
}
