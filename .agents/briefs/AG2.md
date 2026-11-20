# AG2 — Gói vách núi `cliff` (che mép bản đồ, ≤15 phút)
goal: Đoạn vách đá ghép được để bao mép bản đồ Sơn Đạo (hiện là hình chữ nhật cắt thẳng trên nền tối #1b2a1e).
write_scope: tools/assetgen/cliff/**, public/assets/cliff/**, (records/assetgen/cliff/)
Yêu cầu (nhìn 3/4, sáng trên-trái, dải "Đá xám ấm" + mép cỏ "Cỏ rêu"):
- `cliff_n_0..3` (mép BẮC/trên bản đồ: thấy MẶT VÁCH đứng hướng về người xem, cao 72 px, rộng 64 px; đỉnh có viền cỏ/rêu rủ 4–8 px; chân vách tối dần, có đá vụn). Ghép ngang liền: mép trái/phải các biến thể khớp nhau (cùng chiều cao đường đỉnh ở x=0 và x=63 ±1 px).
- `cliff_s_0..2` (mép NAM/dưới: chỉ thấy MÔI VÁCH nhìn từ trên: dải đá nóc 64×28, phía dưới rơi vào bóng tối/sương) — người chơi đứng phía trên nhìn xuống vực.
- `cliff_w_0..2`, `cliff_e_0..2` (mép TÂY/ĐÔNG: sườn đá nhìn nghiêng, 40×64, ghép dọc liền; tây sáng hơn đông theo nguồn sáng).
- Góc: `cliff_nw`, `cliff_ne` (nối n với w/e), `cliff_sw`, `cliff_se`.
- 3 tảng đá lớn đứng riêng `boulder_0..2` (48–72 px rộng) để phá nhịp lặp.
- Pivot = giữa mép dưới (STYLE §6). Atlas `public/assets/cliff/cliff_atlas.png|json` (TexturePacker hash) + `cliff_sprites.json` (w,h,foot) + ghi trong sprites.json: `tileable:{n:{w:64},s:{w:64},w:{h:64},e:{h:64}}`.
- Sheet: các khung 3× + bản ghép thử 1× một bản đồ 320×240 (cỏ phẳng màu #576948 ở giữa, vách bao 4 phía + góc + 2 tảng) để thấy đường ghép.
- Kiểm: `node tools/assetgen/cliff/gen.mjs` + `node tools/assetgen/cliff/check.mjs` in md5, độ lệch mép ghép (đường đỉnh n, chênh màu cột mép), % pixel có bão hoà > 0,35, % alpha bán phần (phải 0).
done_when: 2 lần cùng md5; check PASS (lệch mép ≤ 1 px, alpha bán phần 0, bão hoà vượt ≤ 1 %).

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
