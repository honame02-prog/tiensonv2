# AG4a — gói `bamboo`: trúc (thân, tán, bụi) — lô 2 Hậu Sơn rừng trúc (≤15 phút)
write_scope: tools/assetgen/bamboo/**, public/assets/bamboo/** (đầu ra kiểm: records/assetgen/bamboo/)
Mẫu cấu trúc: `tools/assetgen/forest/` + `public/assets/forest/forest_sprites.json` (đã duyệt, cách khai `layers` của `pine_a`/canopy). Đọc, KHÔNG sửa.

## Nguyên tắc hình (bài học lô 1: check PASS ≠ đẹp)
- Lấy pixel tài nguyên cũ làm cọ khi có thể: màu/khối sáng-tối từ `pine_*_f*` và `fern_a` trong `public/assets/sect/sect_atlas.png|json`; không vẽ nhiễu thủ tục tự do.
- Tránh nhịp lặp đều: thân trong cụm khác cao, khác rộng, khác khoảng cách; đốt không thẳng hàng giữa các thân; tán không đối xứng.
- KHÔNG lật ngang cụm có hướng sáng (sáng luôn trên-trái).

## Sản phẩm
- `bamboo_stem_0..5`: cụm 2–5 thân cao 90–150 px, thân rộng 3–6 px, đốt mỗi 10–18 px (đốt = 1 px tối + 1 px sáng phía trên, đốt hơi phình 1 px), thân hơi cong/nghiêng ±6°, mặt trái thân sáng 1 bậc, phải tối, đỉnh thân tối dần chìm vào tán. Màu xanh xám trầm (giữa dải "Lá tùng xanh lạnh" và "Dương xỉ/bụi" STYLE.md §5; sáng nhất ≈ #8e9a72). Chân: bóng tối ngang chân + vài lá khô.
- `bamboo_leaf_0..5` (tán, lớp vẽ đè người, như `pine_a_f*`): chùm lá mũi mác 1×4–2×7 px xếp nghiêng rủ xuống, mỗi chùm 5–12 lá, chồng thành mảng 40–90 px; sáng mép trên-trái; khe tối giữa chùm 1–3 px; mép ngoài lởm chởm theo lá, KHÔNG khối tròn, không mép cắt thẳng, không dải bánh kếp.
- `bamboo_clump_0..2`: bụi trúc thấp 40–64 px (măng + lá) đặt mép đường.
- `public/assets/bamboo/bamboo_atlas.png|json` + `bamboo_sprites.json` khai `layers` như `pine_a` (base = thân, clusters = tán với `cy`), `foot` thân [8–14, 6].

## done_when
- `node tools/assetgen/bamboo/gen.mjs` chạy 2 lần cùng md5 mọi file ra.
- `node tools/assetgen/bamboo/check.mjs` PASS: alpha bán phần 0, pixel bão hoà > 0,35 ≤ 1 %, mọi sprite có trong atlas.
- `records/assetgen/bamboo/sheet.png` (3×), `compare.png` (2×, cạnh `pine_a`, `fern_a`, `rock_a` cũ cùng nền), `demo-1x.png` (480×270: 6–10 cụm trúc trên nền `forest_*`/`grass_*` của `public/assets/terrain/` + Đạo Sĩ khung đầu, tán vẽ sau người).
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
