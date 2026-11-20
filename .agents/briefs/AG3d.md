# AG3d — forest vòng 4: chân rừng (≤10 phút)
Trước tiên: `git checkout codex/AG3c -- tools/assetgen/forest public/assets/forest`.
write_scope: tools/assetgen/forest/**, public/assets/forest/** (records/assetgen/forest/)
Người dùng duyệt canopy/bush/tallgrass (GIỮ NGUYÊN). Lỗi duy nhất: trunkrow_* có VẠCH NGANG ĐỨT ở đáy (các đoạn ngang sáng/tối nằm cùng hàng cắt ngang thân, như vết xé) và thân như cọc đều. Sửa: thân liền mạch từ chân tới đỉnh khung (đỉnh tối dần chìm vào tán), chân có rễ loe 1–3 px + bóng tối mềm ngang chân, không đoạn ngang nào dài > 4 px trừ dải bóng; độ rộng 3–10 px, cao chênh ±20 %, khoảng cách không đều.
done_when: gen + verify/check PASS; demo-1x.png + compare.png cập nhật.

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
