# AG4a2 — bamboo vòng 2 (≤15 phút)
Trước tiên: `git checkout codex/AG4a -- tools/assetgen/bamboo public/assets/bamboo` rồi tiếp tục từ trạng thái file đó.
write_scope: tools/assetgen/bamboo/**, public/assets/bamboo/** (records/assetgen/bamboo/)
Opus xem ảnh 2× (cảnh ghép trên nền leaflitter + compare cạnh pine_a). GIỮ: thân có đốt sáng/tối, màu xanh xám, sáng trái/tối phải. LỖI HÌNH cần sửa:
1. Tán `bamboo_leaf_*` quá thưa: các nét lá 1 px rời nhau trông như CÀNH KHÔ/xương cá, không thành mảng lá. Sửa: mỗi chùm là quạt 5–12 lá mũi mác dày 2 px ở giữa (1 px đầu mút), lá chồng lên nhau tạo mảng đặc 60–75 % che phủ trong bao tán, 3 tông (tối trong lòng/vừa/sáng mép trên-trái), khe tối 1–3 px giữa các chùm. Mép ngoài lởm chởm đầu lá rủ xuống. Lấy tông/khối từ `pine_*_f*` và `fern_a` (sect_atlas) làm cọ màu. Tán phải che 25–40 % chiều cao trên của cụm thân (nhìn từ trên 3/4 thấy ngọn trúc là mảng lá, không phải cột trơ).
2. Thân song song đều như hàng rào: trong cụm, thân phải tỏa nhẹ từ gốc (nghiêng khác nhau −6°..+6°, cong nhẹ về ngọn), khoảng cách gốc không đều (2–14 px), 1–2 thân phía sau tối hơn 1 bậc và mảnh hơn (chiều sâu), ngọn mảnh dần.
3. Có cành nhánh ngang nhỏ 1 px ở đốt trên (2–4 nhánh mỗi thân) nối vào tán.
done_when: gen 2 lần cùng md5; verify/check PASS; sheet.png, compare.png, demo-1x.png cập nhật (demo dùng `public/assets/terrain/forest_*` lát, không dùng grass sáng).
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
