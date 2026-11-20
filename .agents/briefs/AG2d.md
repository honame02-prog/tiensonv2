# AG2d — cliff vòng 4: vách bắc (≤12 phút)
Trước tiên: `git checkout codex/AG2c -- tools/assetgen/cliff public/assets/cliff`. Bản vòng 2 ở nhánh `codex/AG2b`.
write_scope: tools/assetgen/cliff/**, public/assets/cliff/** (records/assetgen/cliff/)
Giữ sườn tây/đông, vách nam, góc, boulder của AG2c. Lỗi: vách bắc AG2c thành lưới ô ~32 px đều có cột đứng (như tường chạm khắc/hàng rào lặp) — KÉM hơn AG2b. Sửa: lấy cách dựng vách bắc của AG2b (khối đá không đều xếp so le, đọc ra vách núi) làm nền, chỉ sửa: (a) đỉnh khối tròn-bằng thay vì chóp nhọn, (b) khối bè ngang hơn và kích thước đa dạng hơn (có 1–2 khối lớn 40–56 px mỗi đoạn), (c) không có khe đứng thẳng liền nhau chạy suốt chiều cao, (d) không có chu kỳ lặp ≤ 64 px (4 biến thể khác nhau rõ). Giữ mép ghép khớp, mọi kiểm cũ.
done_when: gen + check PASS; compare.png + map_1x.png cập nhật.

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
