# AG1c — terrain vòng 3: sửa dirt + forest (≤12 phút)
Tiếp tục từ nhánh `codex/AG1b` (worktree này dựng từ main; trước tiên: `git checkout codex/AG1b -- tools/assetgen/terrain public/assets/terrain`).
write_scope: tools/assetgen/terrain/**, public/assets/terrain/** (records/assetgen/terrain/)
Opus đã xem ghép 2×: grass ĐẠT (giữ nguyên byte), gravel tạm đạt (giữ). Lỗi còn:
1. dirt: dải biên chung 8 px lộ thành VIỀN XANH thẳng dọc/ngang ở mỗi mép ô 128 (thấy lưới ô rõ), giữa ô là mảng nâu loang khối vuông. Sửa: biên chung lấy từ CHÍNH dirt (không cỏ); cỏ chỉ là đốm ngẫu nhiên ≤ 3 % diện tích, không bám mép; khối quilting nhỏ hơn (10–12 px) + làm mịn đường cắt.
2. forest: REPEAT x lag 127 = 0,257 > 0,25. Đổi seed/ khối để ≤ 0,25.
3. check.mjs: khi lỗi phải in dòng FAIL và thoát mã 1, không được ném lỗi Node (hiện check in stack trace "Node.js v24.19.0"). Độ trễ lặp bỏ qua vùng 120–136 và bội 128 (do dải biên chung, cố ý).
4. COLOR dirt chênh G 8,9 > 6: chỉnh dải màu dirt về mảng đất thật.
done_when: `node tools/assetgen/terrain/gen.mjs && node tools/assetgen/terrain/check.mjs` thoát 0, in PASS; compare.png cập nhật.

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
