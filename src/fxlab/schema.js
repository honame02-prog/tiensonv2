// FxLab: khoang thanh truot theo ten tham so, mau track moi theo type, danh sach lua chon.
// Khoang [min, max, step]. Khoa khong co trong bang: suy ra tu gia tri hien co.
export const RANGES = {
  at: [0, 4000, 10], dur: [0, 3000, 10],
  rx: [4, 200, 1], ry: [4, 200, 1], width: [1, 8, 1], w: [4, 120, 1], h: [8, 240, 1],
  x: [-120, 120, 1], y: [-240, 120, 1],
  power: [0, 2, 0.05], intensity: [0, 0.03, 0.001], alpha: [0, 1, 0.05], scale: [0, 3, 0.05], scaleX: [0, 3, 0.05], scaleY: [0, 3, 0.05],
  grow: [4, 200, 1], flicker: [0, 300, 10], max: [1, 300, 1], to: [0, 1, 0.05], in: [0, 2000, 10], hold: [0, 3000, 10], out: [0, 2000, 10], fps: [1, 60, 1],
  // config cua emitter (Phaser)
  speed: [0, 400, 1], angle: [-360, 720, 1], lifespan: [50, 3000, 10], gravityY: [-400, 600, 5], gravityX: [-400, 400, 5],
  quantity: [1, 60, 1], frequency: [-1, 500, 1], start: [0, 1, 0.05], end: [0, 1, 0.05], delay: [0, 2000, 10],
};
export const ENUMS = {
  tex: ['fx_px1', 'fx_px2', 'fx_spark'], blend: ['add', 'normal'], layer: ['ground', 'body', 'overlay'],
  ease: ['Linear', 'Quad.easeIn', 'Quad.easeOut', 'Quad.easeInOut', 'Cubic.easeIn', 'Cubic.easeOut', 'Cubic.easeInOut', 'Sine.easeIn', 'Sine.easeOut', 'Sine.easeInOut', 'Expo.easeOut', 'Back.easeOut'],
};
export const BOOLS = ['rotate'];
export const TEXTS = ['name', 'atlas', 'anim'];
export const TYPE_LABEL = { light: 'ánh sáng', decal: 'hình sàn', ring: 'vòng sàn', emitter: 'hạt', column: 'cột', shake: 'rung', flash: 'chớp', hitstop: 'khựng', dim: 'tối nền', event: 'sự kiện', anim: 'anim' };
export const NEW_TRACK = {
  light: { at: 0, type: 'light', rx: 60, power: 1, dur: 800, color: 'glow', alpha: [0, 1, 0] },
  decal: { at: 0, type: 'decal', rx: 32, dur: 1000, color: 'anchor', alpha: [0, 0.9, 0] },
  ring: { at: 0, type: 'ring', grow: [12, 56], width: 3, dur: 600, ease: 'Quad.easeOut', color: 'core', alpha: [1, 0.8, 0] },
  emitter: { at: 0, type: 'emitter', tex: 'fx_px2', dur: 600, max: 40, blend: 'add', color: ['core', 'glow'],
    config: { frequency: 40, quantity: 2, speed: { min: 30, max: 90 }, angle: { min: 255, max: 285 }, lifespan: { min: 400, max: 800 }, gravityY: -20, alpha: { start: 1, end: 0 } } },
  column: { at: 0, type: 'column', w: 24, h: 90, dur: 800, scaleX: [0.7, 1, 0.2], scaleY: [0.1, 1, 1], alpha: [1, 1, 0] },
  shake: { at: 0, type: 'shake', dur: 200, intensity: 0.006 },
  flash: { at: 0, type: 'flash', color: 'core', alpha: 0.5, dur: 200 },
  hitstop: { at: 0, type: 'hitstop', dur: 70 },
  dim: { at: 0, type: 'dim', to: 0.5, in: 150, hold: 600, out: 300 },
  event: { at: 0, type: 'event', name: 'hit' },
  anim: { at: 0, type: 'anim', atlas: 'vocab-strike', anim: 'vocab-strike', layer: 'body', blend: 'normal' },
};
// [min, max, step] cho 1 tham so: theo ten khoa (duong dan cuoi), neu la so thi mo rong de chua gia tri hien co
export function rangeOf(key, v) {
  const r = RANGES[key] || (Number.isInteger(v) ? [Math.min(0, v * 2), Math.max(100, v * 3), 1] : [Math.min(0, v * 2), Math.max(1, v * 3), 0.05]);
  return [Math.min(r[0], v), Math.max(r[1], v), r[2]];
}
export const RAMPS = ['hoa', 'bang', 'kim', 'moc', 'tam', 'u'];
