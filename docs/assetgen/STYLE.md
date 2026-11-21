# Tiên Sơn — Thẻ phong cách tài nguyên (20/11, Opus)

Chuẩn cho mọi tài nguyên môi trường/nhân vật do Codex sinh bằng code. Rút từ tài nguyên đang dùng: `tiensonv2/public/assets/sect/` (sect_atlas 59 khung, ground_bake 992×1152, decals 38 khung) và Đạo Sĩ (`dao_si.png`, khung 64×64).
Ảnh mẫu: `design/tienson/ref11/ref-board-raw.png` (atlas 1× + Huyền Vân Quan + Sơn Đạo), `design/tienson/ref11/ref-props-3x.png` (tùng, đá, đèn, bia, dương xỉ, lư ở 3×).

## 1. Cảm giác chung
Pixel art **chi tiết, trầm, hơi cũ** (tranh thuỷ mặc phai màu + rêu): độ bão hoà THẤP, xám ấm, xanh rêu/ô liu, gỗ đỏ sẫm. Không màu kẹo, không xanh lá tươi, không trắng tinh (sáng nhất ~#d8d8d0 ở đá lát đã mòn, điểm nhấn ≤ #f0f0e8 vài pixel). Cảm giác "núi sương, đạo quán cổ". Tài nguyên mới đặt cạnh tài nguyên cũ phải KHÔNG nhận ra là do người khác vẽ.

## 2. Góc nhìn, kích thước, tỉ lệ
- Top-down 3/4 (nhìn chếch ~30–40°): mặt đất thấy mặt trên; vật đứng thấy mặt trước + nóc. Màn hình game 480×270, phóng nguyên số; tài nguyên vẽ ở 1× (1 pixel ảnh = 1 pixel game).
- Thước: Đạo Sĩ cao ~44 px thực trong khung 64. Cửa cao ~1,5 người; đèn đá 46 px; bia 52–56; tùng 155–175; điện 338×235.
- Lưới logic 32 px (va chạm), nhưng hình KHÔNG được bám lưới (không thấy ô vuông).

## 3. Ánh sáng và bóng
- Nguồn sáng **trên-trái**: mặt trên/trái sáng hơn 2–3 bậc, mặt dưới/phải tối. Bóng đổ mềm về **dưới-phải**, đặt trên đất (decal riêng hoặc vẽ vào nền), alpha 25–40 % màu #101410.
- Không dùng gradient trơn; chuyển sắc bằng bậc màu + nhiễu/dither 1 px theo vân vật liệu.

## 4. Viền và độ chi tiết
- Viền **chọn lọc**: mép dưới/phải và chỗ khuất dùng màu gần đen ấm (#0e0c08–#24241f, không #000 thuần); mép trên/trái để màu khối hoặc sáng 1 bậc (không đóng viền đen cả vòng). Không viền ngoài 2 px.
- Mật độ chi tiết cao: vân 1–2 px (đá: vết nứt, rêu điểm; gỗ: thớ; lá: chùm kim). Khối lớn chia 5–7 bậc sáng. Ít nhất 1 điểm sáng nhỏ (1–3 px) ở đỉnh khối để "bắt sáng".
- Alpha nhị phân (0/255) cho vật thể. Chỉ sương/khói/hào quang được alpha bán phần.
- Không khử răng cưa (anti-alias) ra nền trong suốt.

## 5. Bảng màu (dải tối → sáng, đo từ tài nguyên thật)
| Nhóm | Dải |
|---|---|
| Viền/khuất | #0e0c08 #181010 #201c18 #24241f |
| Đá xám ấm (rock_a) | #24241f #34342f #3d3b38 #48453f #54504c #69635e #8b8480 |
| Đá lát (cobble/slab) | #4b4e4b #676767 #73756a #7e7c77 #84837e #8c8b86 #95938c, mòn sáng #c0c0b8 #d0d0c8 |
| Lá tùng ô liu (pine_a) | #201c0c #322e15 #3b371a #44402a #524e33 #625e3e #7d765c |
| Lá tùng xanh lạnh (pine_b) | #0a110d #16221c #212e27 #2b3830 #39473d #48574b #667063 |
| Thân gỗ | #0e0c08 #211c15 #2a251d #342e24 #413a30 #4f473b #7b7062 |
| Cỏ rêu (nền) | #27332d #364636 #46583f #576948 #697a52 #7d8b5d #949e6e |
| Dương xỉ/bụi | #191a0f #30301f #3b3c24 #474731 #515234 #5f5f42 #8e8e6f |
| Đất nâu | #3d3e37 #564a45 #665951 (+ pha cỏ #46583f ở mép) |
| Ngói/mái | #131110 #1d1d1d #26292a #32302c #414140 #545350 #74726e |
| Gỗ son (cột) | đỏ sẫm #3c1e18 #5a2a20 #7a3a2a (bão hoà thấp) |
| Điểm nhấn ấm | đèn #f0c070 #ffd890 (chỉ vài pixel + glow riêng) |
Màu mới phải nằm trong biên độ: bão hoà HSV ≤ 0,35 (trừ điểm nhấn), độ sáng ≤ 0,85.

## 6. Pivot, chân, độ sâu
- Điểm đặt `(x, y)` = **giữa mép dưới** của khung (chân chạm đất). AreaScene: `left = x − round(w/2)`, `top = y − h`; depth = y chân.
- Khung cắt sát hình: hàng pixel cuối cùng của khung là chỗ chân chạm đất (đáy thân cây, đáy đá); bóng đổ không nằm trong khung đồ vật (để depth đúng).
- Vật cao (cây, vách) có thể tách `*_base` (phần dưới, depth theo chân) và `*_top`/cụm tán (depth cao hơn, vẽ đè người) như `pine_a` + `pine_a_f*`, `hall_base`/`hall_roof`.
- Va chạm: khai báo kích thước chân `[w, h]` (như bảng FOOT: rock_c [16,6], pine_a [26,10]).

## 7. Định dạng đầu ra
- Ảnh: PNG RGBA. Atlas đóng gói kiểu **TexturePacker hash** giống `sect_atlas.json`: `{"frames":{key:{"frame":{x,y,w,h},"rotated":false,"trimmed":false,"spriteSourceSize":{x:0,y:0,w,h},"sourceSize":{w,h}}},"meta":{"image":"<tên>.png","size":{w,h},"scale":"1"}}`, đệm 1–2 px giữa khung, cạnh atlas ≤ 2048.
- Kèm `<gói>_sprites.json` giống `sect_sprites.json`: `{"sprites":{key:{w,h,foot:[fw,fh]}}, "layers":{…tách tán nếu có}}`.
- Mẫu chất liệu nền: PNG không trong suốt, **tự lát liền (wrap) không cần lật gương**, kích thước 128×128 hoặc 256×256, ≥ 3 biến thể cùng chất liệu để trộn; kèm `terrain.json` liệt kê.
- Sinh bằng code tái lập: `node tools/assetgen/<gói>/gen.mjs` → ra `public/assets/<gói>/`; chỉ dùng Node thuần + `tools/png.mjs` (decodePng/encodePng), seed cố định → cùng byte. Không cài gói npm, không tải ảnh ngoài.
- Mỗi gói xuất thêm `records/assetgen/<gói>/sheet.png` (bảng xem 3× trên nền #2a2e2a + đặt cạnh Đạo Sĩ và 1 tài nguyên cũ để so).

## 8. Điều cấm
Bão hoà cao, màu thuần (#00ff00, #ff0000), gradient trơn, viền đen kín 2 px, alpha mờ trên vật rắn, hoa văn lặp thấy rõ ở khoảng cách 480 px, khối hình học trần (hình tròn/vuông hoàn hảo không vân), ảnh lấy từ Internet.

## 9. Kiểm (scout/Codex chấm chữ theo thẻ này)
1) Đặt cạnh tài nguyên cũ có lạc tông không. 2) Nguồn sáng trên-trái nhất quán. 3) Viền chọn lọc, không viền đen kín. 4) Chân đúng mép dưới. 5) Chất liệu nền: không thấy đường nối hay hoa văn đối xứng ở ảnh 960×540. 6) Script chạy 2 lần cho cùng md5.

## 10. Công thức công trình lớn (khoá 21/11, mẫu Tam Thanh điện TT2 được duyệt)
Áp cho mọi công trình/sprite lớn (điện, lầu, cổng, nhà). Mẫu: `design/tienson/tam-thanh/TT2/` ở gốc dự án SkillFX (`src/prompt.txt`, `tools/build.py`, `metrics.md`).
1. **Thiết kế dáng trước (TT0):** Codex tra mẫu + đề xuất 2–3 concept imagegen có mô tả và thông số; Opus chọn/hợp nhất; người dùng duyệt. Không gò theo nháp silhouette.
2. **Vẽ trọn một bức:** imagegen sinh MỘT sprite pixel art hoàn chỉnh, tham chiếu = concept duyệt + sprite chuẩn `hall`; prompt nêu: lưới pixel vuông đều phóng ~3×, góc 3/4 cao như `hall` (thấy rộng mặt mái), ánh sáng trái-trên, mảng bóng lớn rõ, cấu trúc đối xứng, nền trong suốt, cấm dither/nhiễu/anime/3D/ngói vàng. Sửa dáng bằng lượt imagegen tinh chỉnh trên chính ảnh đó (một sửa đổi mỗi lượt), không vá bằng mã.
3. **Hạ về cỡ thật bằng median theo ô** (không nearest từ ảnh mịn), alpha theo đa số, lượng tử RGB gần nhất về bảng `hall` (48 màu; rêu chọn dải olive của `hall`), bỏ điểm sáng cô lập.
4. **Đối xứng cấu trúc:** lấy nửa trái làm chuẩn, gương sang phải, tô lại bóng nửa phải trong cùng nhóm vật liệu (giữ chữ biển).
5. **Tách lớp:** `<ten>` (đủ), `<ten>_base` (thân + đài, dưới nhân vật), `<ten>_roof` (mái + băng cổ lầu, trên nhân vật), chia tại đáy dầm mái; base+roof = đủ từng pixel, alpha 0/255.
6. **Kiểm:** K-A5 = 0 màu ngoài bảng; diện tích theo thẻ; 0 px vàng lưu ly (H 40–60°, S > 0,45, V > 0,6); đối xứng bản đồ vật liệu ≤ 2 %; script `--repro` tái tạo khớp SHA256. Ảnh so: `hall` | concept | sprite ×2 và ×1 cùng đáy.
7. **Chấm tổng thể trước chi tiết:** "liền một bức, đẹp ngang concept, cùng bộ với `hall`?" Nền tảng sai thì làm lại, không vá.
**Cấm (bài học TT1 21/11):** ghép cọ pixel cắt từ `hall` + hình học bằng mã → rời rạc, máy móc, bị chê dù mọi số đo đạt.
