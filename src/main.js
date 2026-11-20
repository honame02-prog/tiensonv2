import * as Phaser from 'phaser';
import { AreaScene } from './AreaScene.js';
import { computeView } from './view.js';

// block page scroll / pinch-zoom / long-press on mobile
const stop = e => e.preventDefault();
document.addEventListener('touchmove', stop, { passive: false });
document.addEventListener('gesturestart', stop);
document.addEventListener('contextmenu', stop);
document.addEventListener('dblclick', stop);

async function start() {
  // make sure the pixel font is ready before Phaser rasterises any text
  try { await Promise.all([document.fonts.load('500 16px NotoSerifVN'), document.fonts.load('700 16px NotoSerifVN')]); } catch (e) { /* fall back */ }
  const v = computeView();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: v.width,
    height: v.height,
    backgroundColor: '#8ea2b6',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, zoom: v.zoom, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    physics: { default: 'arcade', arcade: { debug: new URLSearchParams(location.search).has('debug') } },
    scene: [AreaScene],
  });
  let last = '';
  const relayout = () => {
    const n = computeView(); const key = `${n.width}x${n.height}@${n.zoom}`;
    if (key === last) return; last = key;
    game.scale.setZoom(n.zoom);
    game.scale.resize(n.width, n.height);
  };
  last = `${v.width}x${v.height}@${v.zoom}`;
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', () => { relayout(); setTimeout(relayout, 250); setTimeout(relayout, 800); });
  window.visualViewport?.addEventListener('resize', relayout);
  document.addEventListener('fullscreenchange', () => setTimeout(relayout, 100));
  window.__game = game;
}
start();
