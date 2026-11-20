# AG3c — forest vòng 3 (≤12 phút)
Tiếp tục từ nhánh `codex/AG3b` (trước tiên: `git checkout codex/AG3b -- tools/assetgen/forest public/assets/forest`).
write_scope: tools/assetgen/forest/**, public/assets/forest/** (records/assetgen/forest/)
Opus đã xem demo 2×: đóng dấu cụm lá thật là ĐÚNG hướng. Lỗi còn:
1. Mép cắt thẳng: nhiều dấu lá bị cắt bởi hình chữ nhật (mép ngang/dọc thẳng ở đỉnh tán và giữa tán), có cả dải ngang lởm chởm như vết xé. Nguyên nhân khả dĩ: dấu chép cả vùng chữ nhật của khung cụm lá hoặc vượt khung canvas rồi bị xén. Sửa: chỉ chép pixel alpha=255 của dấu, canvas đủ rộng (đệm ≥ 12 px) rồi xén theo hộp bao thật; không có cạnh thẳng dài > 6 px trên viền tán (thêm kiểm: đếm đoạn thẳng ngang/dọc liền trên viền ngoài > 6 px = 0).
2. Chân rừng: các thân có vạch đứt ngang (sọc ngang trắng/tối cắt ngang thân ở cùng độ cao) — lỗi ghép đoạn thân. Thân phải liền từ đáy tới chỗ chìm vào tán; phần trên tối dần.
3. Tán lạnh: giảm số dấu bị làm tối quá (mảng đen lớn); khe tối chỉ 2–6 px.
done_when: gen + check/verify PASS (giữ kiểm cũ + kiểm cạnh thẳng mới); compare.png + demo-1x.png cập nhật.

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
