# AG2c — cliff vòng 3 (≤12 phút)
Tiếp tục từ nhánh `codex/AG2b` (trước tiên: `git checkout codex/AG2b -- tools/assetgen/cliff public/assets/cliff`).
write_scope: tools/assetgen/cliff/**, public/assets/cliff/** (records/assetgen/cliff/)
Opus đã xem map_1x 2×: vách bắc đã ra vách đá (giữ hướng). Lỗi còn:
1. Vách bắc: các khối xếp thành hàng răng cưa tam giác đều nhau (như dãy chóp núi lặp, "mái ngói nhọn"). Sửa: khối bè ngang hơn (rộng/cao 1,3–2,2), đỉnh khối tròn-bằng không nhọn, xen 1–2 khối lớn (40–56 px) mỗi đoạn, khe ngang dài hơn khe dọc → cảm giác lớp đá trầm tích nghiêng nhẹ.
2. Sườn tây/đông: vân sọc chéo song song đều như dây thừng xoắn. Sửa: dùng cùng ngôn ngữ khối như vách bắc (khối xếp chồng theo chiều dọc, nhìn nghiêng), mép trong (giáp cỏ) lượn ±4 px có rêu/cỏ rủ, không sọc chéo.
3. Vách nam: viền răng cưa tam giác lặp nhỏ — làm môi đá tròn-bằng không đều.
4. Nền cỏ trong map_1x lộ ô vuông: dùng cỏ quilting từ ground_bake hoặc đơn sắc #576948 có nhiễu nhẹ (chỉ để xem).
done_when: gen + check PASS (giữ mọi kiểm cũ); compare.png cập nhật.

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
