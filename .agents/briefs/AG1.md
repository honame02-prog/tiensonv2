# AG1 — Gói chất liệu nền `terrain` (≤15 phút)
goal: Mẫu chất liệu nền LÁT LIỀN (wrap, không lật gương) để thay mẫu cắt từ ground_bake đang lộ hoa văn kính vạn hoa ở Sơn Đạo.
write_scope: tools/assetgen/terrain/**, public/assets/terrain/**, (đầu ra kiểm ở records/assetgen/terrain/)
Yêu cầu:
- Chất liệu: `grass` (cỏ rêu, dải "Cỏ rêu"), `forest` (nền rừng: cỏ tối + lá kim rụng + đất lộ, tối hơn grass ~30 %), `dirt` (đường đất nâu nén, có sỏi nhỏ 1–2 px, vết bánh/chân mờ), `gravel` (sỏi đá xám nhỏ trên đất, dải "Đá xám ấm"). Mỗi chất liệu 4 biến thể 128×128, cùng tông và cùng mật độ để trộn ngẫu nhiên từng ô mà không thấy mép ô.
- Tông/độ sáng trung bình của `grass` khớp mảng cỏ ground_bake x140–288 y24–284 (chênh trung bình RGB ≤ 6); `dirt` khớp mảng đất x246–306 y978–1023.
- Chi tiết: cỏ có cụm lá 2–4 px sáng trên-trái, đốm rêu, vài hoa li ti màu trầm (≤ 0,3 % pixel); không có hoạ tiết lớn > 40 px tạo điểm nhận diện lặp.
- Liền mép: pixel cột 0 nối liền cột 127 (nhiễu tuần hoàn). Mọi biến thể chung khung nhiễu nền tuần hoàn để ghép A|B không lộ mép (mép ô: chênh trung bình cột ≤ 4).
- Xuất `public/assets/terrain/<mat>_<i>.png` + `public/assets/terrain/terrain.json` `{tile:128, materials:{grass:["grass_0.png",…],…}}`.
- Kiểm: `node tools/assetgen/terrain/gen.mjs` + `node tools/assetgen/terrain/check.mjs` in: md5 các file, chênh mép trái-phải/trên-dưới từng ô, chênh mép giữa 2 biến thể ghép, chênh trung bình so mảng gốc. Sheet: mỗi chất liệu 1 khối 960×540 lát ngẫu nhiên biến thể (seed) ở 1× + dải 4 biến thể 3×.
done_when: gen chạy < 20 s, 2 lần cùng md5; check.mjs in PASS cho mọi ngưỡng trên.

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
