# AG1b — terrain vòng 2 (≤15 phút)
goal: Mẫu nền lát liền có VÂN giống ground_bake, không còn nhiễu mềm/rằn ri và lưới đốm lặp.
write_scope: tools/assetgen/terrain/**, public/assets/terrain/**, (records/assetgen/terrain/)
Lỗi vòng 1: grass = nhiễu mờ + lưới đốm tối lặp chu kỳ ~64 px thấy rõ; forest/gravel = mảng rằn ri; dirt = mảng xanh loang trên nâu; gravel không có viên sỏi nào.
Cách làm:
- `grass`: tổng hợp kết cấu dạng **image quilting / patch-based** từ mẫu cỏ thật ground_bake `[140,24,148,260]` (khối 24–32 px, chồng lấn 6–8 px, cắt theo đường lỗi nhỏ nhất), làm **xuyến (toroidal)** để lát liền 128×128; 4 biến thể khác seed nhưng mép 8 px ngoài chung 1 dải biên (sinh dải biên trước, rồi lấp ruột) → ghép biến thể nào cũng liền.
- `forest`: quilting từ grass rồi nhân (0.66,0.74,0.70) + rải dấu lá kim rụng (1×3–1×5 px, màu "Thân gỗ"/ô liu tối) và vài mảng đất 6–12 px.
- `dirt`: quilting từ mảng đất thật x246–306 y978–1023 (khối 12–16 px) + viên sỏi 2–4 px (mỗi viên: 1 px sáng trên-trái, 1 px tối dưới-phải, dải "Đá xám ấm"), mật độ ~1 viên/80 px²; cỏ chỉ lấn ở rìa, không loang giữa.
- `gravel`: nền dirt tối 10 % + sỏi dày 1 viên/20 px², viên 2–6 px có khối sáng/tối như trên.
- Thêm kiểm "lặp": lát 960×540 ngẫu nhiên biến thể, tự tương quan độ sáng (đã trừ trung bình, chuẩn hoá) ở độ trễ 32..160 px theo x và y, bỏ qua bội số 128: max ≤ 0,25. Giữ các kiểm cũ (mép, chênh tông ≤ 6 với mẫu gốc, md5 2 lần).
done_when: gen + check PASS; compare.png = cạnh nhau 2×: mảng grass gốc 240×128 | grass mới 240×128 | dirt gốc | dirt mới.

## Vòng 2 — lý do làm lại (Opus xem ảnh 2×, scout chấm 3–5/10)
Bản vòng 1 nằm ở nhánh `codex/<id gốc>` (xem bằng `git show codex/AG1:tools/assetgen/...`), check số liệu PASS nhưng HÌNH KHÔNG ĐẠT: trông như hoạ sĩ khác. Nguyên tắc vòng 2: **dùng chính pixel của tài nguyên cũ làm cọ/mẫu** (cắt từ `public/assets/sect/sect_atlas.png` theo `sect_atlas.json`, `public/assets/sect/decals.png|json`, `public/assets/sect/ground_bake.png`), không vẽ nhiễu thủ tục tự do. Đây là tài nguyên của chính dự án, được phép tái dùng.
- KHÔNG lật ngang (flipX) cụm có hướng sáng (sẽ thành sáng trên-phải). Đa dạng bằng chọn cụm khác + làm tối/sáng theo tầng.
- Tự kiểm bằng mắt: xuất `records/assetgen/<gói>/compare.png` = tài nguyên mới đặt cạnh tài nguyên cũ ở 2× trên cùng nền. Nếu bạn xem được ảnh, xem nó tối đa 3 vòng.

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
