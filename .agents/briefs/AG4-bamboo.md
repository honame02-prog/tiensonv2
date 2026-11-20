# AG4 — gói `bamboo` cho Hậu Sơn rừng trúc (lô 2, Codex, chia 2 việc ≤15 phút)
Thẻ phong cách: `docs/assetgen/STYLE.md`. Bài học lô 1 (LESSONS 20–21/11): check số liệu PASS không có nghĩa là đẹp. Phải dựng hình bằng **pixel tài nguyên cũ làm cọ** khi có thể, xuất `compare.png` đặt cạnh tài nguyên cũ ở 2×, và tránh nhịp lặp đều (hàng rào, lưới ô, răng cưa).

## AG4a — trúc (tools/assetgen/bamboo/, public/assets/bamboo/)
- `bamboo_stem_0..5`: cụm 2–5 thân trúc cao 90–150 px, thân rộng 3–6 px, đốt mỗi 10–18 px (đốt = 1 px tối + 1 px sáng phía trên), thân hơi cong/nghiêng ±6°, các thân trong cụm khác cao/khác rộng. Màu: xanh xám trầm (pha giữa dải "Lá tùng xanh lạnh" và "Dương xỉ/bụi"; sáng nhất ≈ #8e9a72), mặt trái thân sáng 1 bậc, phải tối.
- Tán trúc `bamboo_leaf_0..5` (tách lớp như `pine_a_f*`, vẽ đè người): chùm lá mũi mác 1×4–2×7 px xếp nghiêng rủ xuống, mỗi chùm 5–12 lá, chồng thành mảng 40–90 px; sáng mép trên-trái; khe tối giữa chùm 1–3 px. Không thành khối tròn.
- `bamboo_clump_0..2`: bụi trúc thấp 40–64 px (măng + lá) đặt mép đường.
- sprites.json khai `layers` như `pine_a` (base = thân, clusters = tán với `cy`), foot thân [8–14, 6].
## AG4b — nền và vật trang trí (tools/assetgen/bamboofloor/, public/assets/terrain/ + public/assets/bamboo/)
- Chất liệu `leaflitter_0..3` (128 lát liền, theo cách AG1: quilting từ `forest_*` đã duyệt + rải lá trúc khô 1×3–1×5 px màu vàng xám trầm #8a8460–#5a5640 mật độ vừa); ghi thêm vào `terrain.json` (không đổi byte các bộ cũ).
- `fence_bamboo_h_0..1` (64×28, ghép ngang liền) + `fence_bamboo_post`; `mossrock_0..2` (dùng vân `rock_a` + rêu đỉnh); `stone_path_0..3` (phiến đá bước 12–20 px, decal phẳng).
## Kiểm (mỗi việc)
gen 2 lần cùng md5; check: alpha bán phần 0, bão hoà > 0,35 ≤ 1 %, mép ghép (fence, leaflitter) chênh ≤ 4; compare.png 2× cạnh `pine_a`, `fern_a`, `rock_a`; demo 480×270 1×: rừng trúc 6–10 cụm trên leaflitter + đường đá + Đạo Sĩ.
Bổ sung `_common.txt` (header chung) khi chạy.
