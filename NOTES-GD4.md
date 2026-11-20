# GD4: atlas SkillFX trong FxPlayer

## Xuat atlas (repo skillfx)
```
cd skillfx
node tools/phaser-atlas.mjs vocab/vocab-strike --out ../tiensonv2/public/assets/fx [--name key] [--fps 30] [--scale 1] [--palette x.gpl] [--no-snap]
```
- Render qua `renderFrames` (khung trong suot, khong nhan vat), lay mau theo fps dich, cat vien, gop khung trung (sha1 noi dung + vi tri cat), ep mau ve `art/palette/tienson-fx.gpl` (OKLab gan nhat; alpha >= 128 -> 255, con lai -> 0), dong goi shelf (rong <= 2048, 1 px cach), PNG khong mat du lieu.
- Ra `<key>.png`, `<key>.json` (Aseprite hash: khoa khung "0","1",.. vi `createFromAseprite` tra theo chi so; `meta.frameTags` 1 tag = ten key; `meta.pivot` = `meta.origin` cua hieu ung) va cap nhat `index.json` (manifest cho FxLab).
- Mau vocab-strike: 61 khung -> 46 khung rieng, atlas 509x239, PNG 14438 byte.

## Cue (track anim)
`{ "at": 0, "type": "anim", "atlas": "vocab-strike", "anim": "vocab-strike", "layer": "body|ground|overlay", "blend": "normal|add", "fps"?, "loop"?, "originX"?, "originY"?, "scale"?, "alpha"?, "color"?, "rotate"?, "dur"? }`
- Nap: `FxPlayer.preload(scene, cues)` goi `load.aseprite` cho moi atlas o `assets/fx/<atlas>.{png,json}` (hoac `atlasUrl`/`atlasJson`). Anim tao 1 lan khi `new FxPlayer` (hoac luc nap muon: `fx.ensureAtlas(key)`).
- Goc sprite = `meta.pivot / sourceSize` (originX/originY cua cue de ghi de), dat tai (x, y) cua run. `dur` mac dinh = do dai tag (theo `fps` neu co). Het anim sprite tu an va huy khi het `dur`; `stop()`/kill huy ngay. Depth nhu cac track khac (body = y+0.5, ground -60, overlay 9500).
- Cue mau `demo-anim-strike`: phim 5 (hoac nut 5) trong `?fx=1`.
- FxLab: track anim co o chon atlas + tag (doc `assets/fx/index.json`); doi xong nap atlas (neu chua co) va phat lai. Nut "+ Them track" co loai `anim`.

## Test
`npm run build` roi `node tools/gd4_test.mjs` (tu bat `vite preview` cong 8095 va tat). fx_test / fxlab_test: `node tools/fxlab_test.mjs <baseUrl>` voi preview dang chay.

## Gioi han
- Ep mau 2 muc alpha (khong ban trong suot); hieu ung dung light/ADD mem se mat do dep khi snap.
- Anim key = ten tag, toan cuc: hai atlas trung ten tag se va nhau (dat `--name` khac nhau).
- Mot tag moi atlas; khung xoay (rotated) khong dung. `--scale` > 1 chi phong to nguyen so (nearest).
- Hieu ung SkillFX xuat o toa do rig: pivot la goc hieu ung (chan nguoi thi trieu), khong tu lat theo huong nhin; `rotate` chi xoay sprite quanh goc.
- ensureAtlas luc chay dung loader cua scene; nap trong luc scene dang nap khac se doi `complete` chung.
