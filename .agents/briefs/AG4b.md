# AG4b — gói `bamboofloor`: nền lá trúc khô, hàng rào trúc, đá rêu, đường đá — lô 2 Hậu Sơn (≤15 phút)
write_scope: tools/assetgen/bamboofloor/**, public/assets/bamboofloor/**, public/assets/terrain/leaflitter_*.png, public/assets/terrain/terrain.json (CHỈ thêm mục leaflitter, không đổi byte nghĩa các bộ cũ) (đầu ra kiểm: records/assetgen/bamboofloor/)
Một việc Codex khác làm song song `tools/assetgen/bamboo/` + `public/assets/bamboo/` — KHÔNG đụng.
Mẫu: `tools/assetgen/terrain/` (cách quilting ô 128 lát liền đã duyệt), `public/assets/terrain/terrain.json`, `tools/assetgen/cliff/` (vân đá). Đọc, KHÔNG sửa các gói cũ.

## Nguyên tắc hình (bài học lô 1: check PASS ≠ đẹp)
- Lấy pixel tài nguyên cũ làm cọ: quilting từ `public/assets/terrain/forest_*.png` đã duyệt; vân đá cắt từ `rock_a` trong `public/assets/sect/sect_atlas.png|json`; không vẽ nhiễu thủ tục tự do.
- Tránh nhịp lặp đều: không lưới ô lộ, không hàng đốm, cọc rào khác cao/nghiêng nhẹ, phiến đá khác cỡ.
- KHÔNG lật ngang thứ có hướng sáng (sáng trên-trái).

## Sản phẩm
- `leaflitter_0..3` (128×128 lát liền 4 mép, chọn biến thể ngẫu nhiên không lật): nền quilting `forest_*` + rải lá trúc khô 1×3–1×5 px nghiêng ngẫu nhiên, màu vàng xám trầm #8a8460–#5a5640, mật độ vừa (đất vẫn lộ), vài cụm lá dày hơn; thêm mục vào `terrain.json` theo đúng dạng các bộ cũ.
- Atlas `public/assets/bamboofloor/bamboofloor_atlas.png|json` + `bamboofloor_sprites.json` (dạng như forest_sprites.json, có `foot`):
  - `fence_bamboo_h_0..1` 64×28, ghép ngang liền (mép trái/phải khớp), 2 thanh ngang buộc dây + cọc trúc đứng không đều; `fence_bamboo_post` cọc đầu/cuối.
  - `mossrock_0..2` 20–40 px: vân `rock_a` + rêu xanh xám trên đỉnh (dải dương xỉ), bóng dưới-phải.
  - `stone_path_0..3`: phiến đá bước 12–20 px, decal phẳng (không bóng đổ cao), mép bo nhẹ, 2–4 phiến mỗi khung, khe cỏ giữa.

## done_when
- `node tools/assetgen/bamboofloor/gen.mjs` chạy 2 lần cùng md5 mọi file ra; các file terrain cũ (dirt/forest/grass/gravel *.png) giữ nguyên md5.
- `node tools/assetgen/bamboofloor/check.mjs` PASS: alpha bán phần 0 (sprite), bão hoà > 0,35 ≤ 1 %, leaflitter mép ghép chênh ≤ 4 (cả 4 mép, mọi cặp biến thể), fence_h mép trái-phải khớp ≤ 4.
- `records/assetgen/bamboofloor/sheet.png` (3×), `compare.png` (2×, cạnh `rock_a`, `fern_a`, `forest_0` cũ), `demo-1x.png` (480×270: leaflitter 4×3 ô lát + đường đá uốn + 1 đoạn rào + 2 đá rêu + Đạo Sĩ khung đầu).
## Bối cảnh chung (đọc trước)
- Game Tiên Sơn (Phaser 4, top-down 3/4, 480×270). Thẻ phong cách BẮT BUỘC: `docs/assetgen/STYLE.md`. Ảnh mẫu: `docs/assetgen/ref-props-3x.png` (tùng/đá/đèn/bia/dương xỉ 3×), `docs/assetgen/ref-board-raw.png` (atlas + 2 khu). Tài nguyên gốc để lấy mẫu màu/so sánh: `public/assets/sect/sect_atlas.png|json`, `public/assets/sect/ground_bake.png`, `public/assets/dao_si.png` (khung 64×64, khung đầu ở x0 y0).
- Sinh bằng code: Node thuần (đã có Node 24), dùng `tools/png.mjs` (`decodePng(buf)` → {w,h,data RGBA}; `encodePng({w,h,data}, file)`). KHÔNG cài npm, không tải gì từ mạng. PRNG có seed cố định (vd mulberry32) → chạy 2 lần cùng md5.
- Vẽ thủ tục: nhiễu giá trị/Perlin tự viết, hình dạng bằng đa giác/ellipse có nhiễu mép, tô theo DẢI MÀU trong STYLE.md §5 (lượng tử hoá về dải, không trộn RGB tự do), sáng trên-trái, viền chọn lọc mép dưới-phải.
- Viết bảng xem `records/assetgen/<gói>/sheet.png`: 3× trên nền #2a2e2a, mọi khung + nhãn đơn giản (không cần chữ) + đặt cạnh Đạo Sĩ khung đầu và `rock_a`/`pine_a` cũ để so cỡ/tông.
- Tự kiểm: chạy gen 2 lần so md5; tự xem sheet.png nếu bạn xem được ảnh (tối đa 3 vòng chỉnh), so với ref-props-3x.png theo STYLE.md §9.
- Báo cáo: danh sách file + kích thước, md5 2 lần, nhận xét tự chấm theo §9, giới hạn còn lại.
## Không được
- Sửa file ngoài write_scope (đặc biệt `src/**`, `tools/area_bake.mjs`, `public/assets/sect/**`, `public/assets/areas/**`).
- Ảnh vật thể alpha bán phần (trừ ghi rõ), màu bão hoà cao, gradient trơn, viền đen kín.
