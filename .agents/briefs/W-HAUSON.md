# W-HAUSON — dựng khu `hau-son` (Hậu Sơn rừng trúc) — worker
Điều kiện: làm trong worktree nhánh `hau-son` (đã có sẵn file gói bamboo, bamboofloor, terrain/leaflitter_* lấy tạm từ nhánh Codex vòng 2, CHƯA gộp master — người dùng cho dùng tạm). Commit trên nhánh hau-son, không đụng master.
Đọc trước: `NOTES-AREA.md` (mục "Thêm khu mới"), `tools/areas/son-dao.src.json` (mẫu), `.agents/briefs/W-SONDAO.md` (cách đã lắp terrain/cliff/forest), `public/assets/bamboo/bamboo_sprites.json`, `public/assets/bamboofloor/bamboofloor_sprites.json`.
Không sửa: `src/fx/**`, `skillfx/**`, `public/assets/sect/**`, `public/assets/{terrain,cliff,forest,bamboo,bamboofloor}/*` (ngoài đọc). Không dừng máy chủ cổng 5174. Mỗi lệnh ≤ 60 s.

## Cổng (Opus chọn): nối với SƠN ĐẠO ở mép ĐÔNG giữa đường
- Sơn Đạo: mở 1 khe rộng ~64 px trong dải rừng mép đông quanh y≈380–460 (bỏ/dời các canopy/trunkrow chắn khe, nối đường đất/đá từ đường chính tới khe), thêm portal `to-hau-son` rect sát mép đông → `hau-son/west`, nhãn "Hậu Sơn". Thêm spawn `east` trong Sơn Đạo cạnh khe.
- HVQ KHÔNG đổi gì: không sửa `area_wrap_hvq.mjs` hay `public/assets/areas/huyen-van-quan/**`.

## Khu hau-son (tools/areas/hau-son.src.json → public/assets/areas/hau-son/)
- Cỡ 640×640. Nền chủ đạo `leaflitter` (thêm loại chất liệu này vào area_materials.json theo dạng `terrain` đã có: ô lát liền, biến thể ngẫu nhiên, không lật), vài mảng `forest`/`grass` mép.
- Lối đi: đường đá `bamboofloor:stone_path_*` uốn từ cổng tây (spawn `west`, portal `to-son-dao` → `son-dao/east`) vào một khoảng trống giữa khu (~160×120) có 2–3 `mossrock`, 1 đoạn hàng rào `fence_bamboo_h_*` + `fence_bamboo_post` men một bên lối, vài `bamboo_clump` mép đường.
- Rừng trúc: 25–40 cụm `bamboo:bamboo_stem_*` có tán `bamboo_leaf_*` (dùng `layers` như pine_a/canopy trong AreaScene), mật độ dày ở mép, thưa dần vào trong, không xếp lưới (jitter, khoảng cách tối thiểu ~20 px), không chắn lối đi.
- Bao mép: mép bắc dùng vách `cliff:*` (như Sơn Đạo), 3 mép còn lại dày đặc trúc + `forest:canopy_*/trunkrow_*` để không thấy ra ngoài; va chạm chặn người ở mép và ở chân cụm trúc/đá (như pine/rock Sơn Đạo).
- AreaScene/loader: nạp atlas `bamboo` và `bamboofloor` giống cách đã nạp cliff/forest (chỉ khi cần, không làm đổi HVQ).
- Tên khu hiển thị "Hậu Sơn".

## Test
- `node tools/area_bake.mjs tools/areas/hau-son.src.json` 2 lần cùng md5; bake lại son-dao.
- Cập nhật `tools/area_test.mjs`: thêm qua–về Sơn Đạo ↔ Hậu Sơn 2 lần (spawn đúng west/east), tên khu "Hậu Sơn", nhãn cổng, FPS hau-son ≥ 0,8× HVQ, va chạm mép + 1 cụm trúc, chụp shots/area_hau-son*.png; giữ nguyên mọi kiểm cũ.
- `npm run build` sạch; `node tools/area_test.mjs` TẤT CẢ ĐẠT, 0 lỗi console.
- HVQ 0 pixel khác: `tools/area_shot.mjs` chụp 8 điểm HVQ trước và sau thay đổi, `tools/png_diff.mjs` → 0.
- Xuất `design/tienson/ref11/hauson-4goc.png` (4 góc + giữa khu, 1×, có Đạo Sĩ).
Báo cáo: file đổi, kết quả từng lệnh (dòng log thật), FPS, md5, png_diff.
