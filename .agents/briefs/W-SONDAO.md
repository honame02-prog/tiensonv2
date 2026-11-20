# W-SONDAO — lắp tài nguyên lô 1 vào Sơn Đạo (worker, R2)
goal: Sơn Đạo hết mép bản đồ cắt thẳng và hết cỏ lát gương, dùng gói `terrain`, `cliff`, `forest` vừa gộp vào main.
context:
- Định dạng khu: `NOTES-AREA.md` (đọc trước). Bake: `tools/area_bake.mjs` (mirror() ở ~dòng 56, matPix ~58–61, cutTile 26–33), chất liệu `tools/area_materials.json`, nguồn khu `tools/areas/son-dao.src.json` (640×800).
- Gói mới: `public/assets/terrain/terrain.json` (`{tile:128, materials:{grass,forest,dirt,gravel:[png…]}}`, ô lát liền, KHÔNG lật gương); `public/assets/cliff/cliff_atlas.png|json` + `cliff_sprites.json` (w,h,foot, `tileable` n/s 64 rộng, w/e 64 cao; góc nw/ne/sw/se; boulder_0..2); `public/assets/forest/forest_atlas.png|json` + `forest_sprites.json` (canopy_0..5, trunkrow_0..1, bush_0..3, tallgrass_0..3). Pivot mọi khung = giữa mép dưới.
- AreaScene (`src/AreaScene.js`): props đặt `left=x-round(w/2), top=y-h`, depth = y chân (~dòng 76–110), FOOT bảng ~20–21, atlas `sect` nạp ở ~50.
Việc:
1. `area_materials.json`: thêm `type:"terrain"` (`set:"grass"` …) — bake lấy pixel từ ô 128 của bộ, chọn biến thể theo hash(ô, seed), wrap modulo (không mirror). Đổi grass/forest/dirt của Sơn Đạo sang terrain (giữ cobble/slab cũ). Mép giữa 2 chất liệu vẫn dither như cũ.
2. AreaScene: nạp atlas `cliff`, `forest` khi area.json có `atlases:["cliff","forest"]` (khu không khai báo thì không nạp → HVQ không đổi). Props hỗ trợ khoá dạng `"cliff:cliff_n_0"` / `"forest:canopy_2"` (atlas:frame); kích thước/foot lấy từ `<atlas>_sprites.json`. Canopy/trunkrow foot [0,0] (không chặn).
3. `son-dao.src.json`: bao mép: bắc = hàng cliff_n (ghép 64 px, biến thể xoay vòng theo seed) + góc; tây/đông = cliff_w/e hoặc dải rừng (canopy chồng lấn 30–50 % + trunkrow) xen kẽ; nam = cliff_s hoặc rừng; vài boulder/bush/tallgrass dọc đường. Nền ngoài vùng chơi (#1b2a1e) không còn lộ ở khung hình camera tại spawn và các góc. Vùng chặn (`blocks`) phủ vách/rừng để không đi xuyên. Cổng bắc về HVQ vẫn đi được (đường xuyên qua vách bắc: để khe 64–96 px ở chỗ đường).
4. Bake lại: `node tools/area_bake.mjs tools/areas/son-dao.src.json` (chạy 2 lần cùng md5).
done_when (dán log thật):
- `npm run build` OK; `node tools/area_test.mjs` PASS (qua–về 3 lần, 0 lỗi console, không rò rỉ).
- HVQ không đổi: `node tools/area_shot.mjs after` rồi `node tools/png_diff.mjs` với ảnh base_hvq_* trong `shots/` → 0 pixel khác.
- Chụp 4 ảnh Sơn Đạo (spawn bắc, giữa đường, góc tây-nam, góc đông-bắc) bằng `?area=son-dao&x=&y=` vào `shots/sondao_v2_*.png`; báo đường dẫn (KHÔNG cần tự chấm thẩm mỹ).
do_not: sửa `src/fx/**`, `public/assets/{terrain,cliff,forest,sect}/**`, `tools/assetgen/**`, `skillfx/**`; dừng máy chủ cổng 5174 (preview tự mở cổng 8100); commit (Opus commit).
Mỗi lệnh ≤ 60 s; build/test dài hơn thì chạy nền và đợi bằng vòng kiểm file log.
