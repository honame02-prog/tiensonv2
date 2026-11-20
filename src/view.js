// Responsive internal resolution with integer scaling in DEVICE pixels.
// The short side targets ~BASE game px: devZoom = floor(shortSide * dpr / BASE) device px per game px (integer -> crisp pixels),
// CSS zoom = devZoom / dpr. Phones (390 css x dpr 3) get 5 device px per game px (~234 game px short side, hero ~107 css px tall);
// a 1280x720 desktop gets 3. The other side follows the aspect ratio.
export const BASE = 270;
export function computeView(w = window.innerWidth, h = window.innerHeight) {
  const dpr = window.devicePixelRatio || 1;
  const short = Math.min(w, h);
  const devZoom = Math.max(1, Math.floor(short * dpr / BASE));
  const zoom = devZoom / dpr;
  let gw = Math.ceil(w / zoom), gh = Math.ceil(h / zoom);
  // keep the world view reasonable on very large/odd screens
  gw = Math.min(gw, 1280); gh = Math.min(gh, 960);
  return { width: gw, height: gh, zoom, devZoom };
}
export const isTouchDevice = () =>
  ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
  (window.matchMedia?.('(pointer: coarse)').matches ?? true);
