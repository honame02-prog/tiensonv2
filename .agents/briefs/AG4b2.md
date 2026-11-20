# AG4b2 — bamboofloor vòng 2 (≤15 phút)
Trước tiên: `git checkout codex/AG4b -- tools/assetgen/bamboofloor public/assets/bamboofloor public/assets/terrain` rồi tiếp tục từ trạng thái file đó.
write_scope: tools/assetgen/bamboofloor/**, public/assets/bamboofloor/**, public/assets/terrain/leaflitter_*.png, public/assets/terrain/terrain.json (chỉ mục leaflitter) (records/assetgen/bamboofloor/)
Opus xem ảnh 2×. GIỮ: lát liền mép, mossrock (vân rock_a + rêu đỉnh) ĐẠT. LỖI HÌNH cần sửa:
1. `leaflitter_*` trông RẰN RI (mảng nâu đất loang trên xanh) + vạch vàng rải đều như HOA GIẤY. Nền rừng trúc phải là THẢM LÁ KHÔ: lá phủ 55–70 % diện tích, tông chủ đạo vàng xám/ô liu trầm (#6e6a4c–#8a8460, bóng #4a4636), xanh chỉ lộ thành mảng nhỏ; lá khô tụ thành dải/đống không đều (mật độ thay đổi theo nhiễu tần số thấp, có vùng dày và vùng thưa), lá chồng nhau, hướng nghiêng ngẫu nhiên nhưng mỗi đống có hướng chung nhẹ; đất nâu chỉ lộ chấm nhỏ. Không có vạch sáng tách rời đứng một mình đều khắp ô. Vẫn lát liền 4 mép, không lộ lưới ô.
2. `stone_path_*` xám sáng như sỏi nổi trên nền: hạ sáng 2 bậc về dải đá của `rock_a`/slab cũ (sáng nhất ≈ dải giữa rock_a), phiến PHẲNG bo góc dạng đa giác không đều (không bầu dục trứng), 1 px tối viền dưới-phải + 1 px lá khô/cỏ lấn mép, mặt có 1–2 vết nứt/đốm rêu.
3. `fence_bamboo_h_*` cọc cách đều như hàng rào sắt: cọc khoảng cách không đều (6–14 px), cao lệch ±3 px, 1–2 cọc nghiêng, thanh ngang hơi võng, nút buộc dây sẫm ở chỗ giao; màu trúc khô vàng xám có đốt.
done_when: gen 2 lần cùng md5; check PASS (bao gồm mép ghép ≤ 4, terrain cũ không đổi md5); sheet.png, compare.png, demo-1x.png cập nhật.
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
