# AG3 — Gói rừng rậm `forest` (che mép bản đồ, ≤15 phút)
goal: Tán rừng rậm và bụi để dựng "tường rừng" che mép bản đồ và lấp khoảng trống giữa các cây tùng cũ.
write_scope: tools/assetgen/forest/**, public/assets/forest/**, (records/assetgen/forest/)
Yêu cầu (dải "Lá tùng xanh lạnh" và "Lá tùng ô liu" + "Thân gỗ"; xem kỹ pine_a/pine_b trong ref-props-3x.png: tán = nhiều chùm lá kim xếp tầng, mỗi chùm sáng ở mép trên-trái, lõi tối, điểm sáng 1 px):
- `canopy_0..5`: khối tán rừng xa/dày (96–160 rộng, 80–120 cao), nhiều chùm chồng tầng, đáy tán tối gần đen để chìm vào mép; 3 cái tông lạnh (pine_b), 3 cái tông ô liu (pine_a). Có thể ghép ngang chồng lấn 30–50 % thành dải rừng liền.
- `trunkrow_0..1`: dải chân rừng 128×40 (thân cây tối san sát, rễ, bóng) đặt dưới hàng tán.
- `bush_0..3`: bụi thấp 32–56 rộng, 20–32 cao (lá rộng/ dương xỉ dày, dải "Dương xỉ/bụi").
- `tallgrass_0..3`: cụm cỏ cao 16–24 px (đặt mép đường, chân vách).
- Pivot giữa mép dưới. Tán có tách `canopy_i` (vẽ đè người) và không có phần chân riêng thì ghi foot [0,0] (không chặn; chặn do lưới bản đồ).
- Atlas `public/assets/forest/forest_atlas.png|json` (TexturePacker hash) + `forest_sprites.json` (w,h,foot).
- Sheet: khung 3× + bản dựng thử 1× 480×200: dải rừng liền (canopy chồng lấn + trunkrow) phía trên, bụi + cỏ cao ở dưới, đặt cạnh pine_a/pine_b cũ để so tông.
- Kiểm: `node tools/assetgen/forest/gen.mjs` + `check.mjs` in md5, % bão hoà > 0,35 (≤ 1 %), % alpha bán phần (0), độ sáng trung bình tán so pine_b_f0 (chênh ≤ 10 %).
done_when: 2 lần cùng md5; check PASS.

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
