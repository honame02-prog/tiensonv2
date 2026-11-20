# Tiên Sơn – prototype chơi thử đầu tiên (Phaser 4)

Game khám phá chill, núi tiên phương Đông, pixel art nhìn từ trên xuống 3/4.
Phaser 4.2.1 + Vite, độ phân giải trong 480×270, phóng to theo số nguyên cho vừa cửa sổ.

## Chạy
```bash
npm i
npm run dev        # mở địa chỉ Vite in ra (mặc định http://localhost:5173)
npm run build      # xuất bản web tĩnh ra dist/
npm run preview    # xem bản build ở http://localhost:8080
```
Thêm `?debug=1` vào URL để hiện khung va chạm.

## Điều khiển
- WASD hoặc phím mũi tên: đi 8 hướng; giữ Shift để chạy
- E hoặc Space: làm động tác tương tác (giơ tay), gần đối tượng thì mở hội thoại sau động tác; / xem đồ vật (Trà Sư, miếu, lư hương, hồ cá), bấm tiếp để qua câu thoại

## Nội dung
- `public/assets/tileset32.png`: 271 ô 32px. Gồm đá lát, cỏ rêu, đất, nước, vách đá, mỗi loại là texture 64×64 liền mạch cắt thành 4 ô theo vị trí, kèm biến thể và ô cỏ có hoa mai rụng. Có 16 ô chuyển tiếp góc cho cỏ↔đá, cỏ↔đường, cỏ↔nước (viền tối + bọt), cỏ↔vách. Thêm ô mặt vách và ô sương trời.
- `public/assets/props.png/.json`: atlas 17 đồ vật (đình, miếu, cầu, hồ koi, tùng, mai, trúc, đèn đá, cột đèn lồng, lư hương, 4 tảng đá).
- `public/assets/map.json`: bản đồ định dạng Tiled 40×30. Các lớp: `ground`, `collision` (lớp tile, ô có thuộc tính `collides`), `props` (object, sắp theo y), `colliders` (khung va chạm + vùng đi được trên cầu), `actors` (điểm xuất phát, NPC). Mở được bằng Tiled.
- `public/assets/dao_si.png/.json`: nhân vật chính Đạo sĩ trẻ (atlas từ game-art/characters/dao_si/export), 8 hướng × idle(6f/150ms) · walk(8f/100ms) · run(8f/75ms) · interact(8f/90ms, chạy 1 lần), pivot (32,61). `hero.png` cũ (Khách Lữ Hành) không còn dùng.
- `public/assets/npc_trasu.png`: Trà Sư tạm thời, là nhân vật chính đổi bảng màu.
- Font Galmuri11/Galmuri9 (giấy phép SIL OFL, xem `public/fonts/Galmuri-OFL.md`), hiển thị đủ dấu tiếng Việt.

## Tạo lại asset (Python 3 + numpy, scipy, Pillow)
```bash
cd tools
python3 make_palette.py   # art/palette/tienson-world.gpl (48 màu nhân vật + 39 màu môi trường)
python3 make_tileset.py   # tileset32.png + tileset_index.json
python3 make_props.py     # tách đồ vật từ art/src/props.jpg, đóng atlas (Aseprite --sheet-pack nếu có, không thì dùng bộ đóng gói riêng)
python3 make_npc.py
python3 make_mist.py
python3 make_map.py       # map.json (tạo bằng script, cố định seed)
```
`make_palette.py` cần file `/workspace/game-art/.../tienson-48.gpl`. File palette đã xuất nằm sẵn trong `art/palette/`.
`tools/smoke_test.mjs` là bài test Playwright đã dùng để chụp ảnh trong `../shots/`.

## Điện thoại / cảm ứng
- Tự bật khi máy có màn hình cảm ứng (hoặc ngay lần chạm đầu tiên).
- Chạm và kéo ở nửa trái màn hình: cần điều khiển ảo hiện ra đúng chỗ ngón cái. Hướng analog đã chuẩn hóa, hoạt ảnh 4 hướng chọn giống bàn phím.
- Nút **E** góc phải dưới: nói chuyện / xem. Chạm vào khung thoại để qua câu. Đa chạm: vừa giữ cần vừa bấm E được.
- Lần chạm đầu tiên sẽ xin toàn màn hình (nếu trình duyệt cho phép).
- Độ phân giải trong tự đổi theo màn hình: cạnh ngắn ≈ 270 px game × zoom nguyên (zoom = floor(cạnh ngắn / 270)), cạnh dài theo tỉ lệ. Chơi được cả ngang lẫn dọc, tự cập nhật khi xoay máy.
- Bản 1 file HTML tự chứa: `npm run build && python3 tools/make_single_html.py [đường_dẫn_ra.html]`.
- Test cảm ứng: `tools/mobile_test.mjs` (Playwright + CDP Input.dispatchTouchEvent).

## v2 – Đạo sĩ trẻ (17/10/2026)
- Cần ảo: kéo nhẹ (< 68% bán kính) = đi 58 px/s, kéo hết cỡ = chạy 118 px/s; hướng 8 theo góc cần; thả ra = đứng thở giữ hướng cuối (nhả chéo không bị bật về hướng thẳng).
- Phóng to nguyên theo pixel THIẾT BỊ: devZoom = floor(cạnh ngắn × dpr / 216); điện thoại 390×844 @3x → 5 px thiết bị / px game (234×507 px game).
- Test: `node tools/daosi_test.mjs [file.html]` (dọc, ngang, desktop; 8 hướng × đi/chạy, thả, tương tác, NPC). Ảnh: `../shots/daosi/`.

## v3 – giao diện sắc nét (17/10/2026)
- HUD, cần ảo, nút tương tác, khung thoại là lớp DOM (`src/ui.js`) vẽ ở độ phân giải gốc của máy, không phóng pixel. Font Noto Serif (subset tiếng Việt, OFL) nhúng `public/fonts/NotoSerifVN-500/700.woff`. Galmuri chuyển sang `fonts_unused/`. `TouchControls.js` cũ không còn dùng.
- Thế giới: phóng to nguyên theo pixel thiết bị, cạnh ngắn ≈ 270 px game (`src/view.js` BASE=270): điện thoại 390×844 @3x → 4 px thiết bị / px game (293×633).
- Mép nam: các hàng 'void' được phủ biển mây (`public/assets/cloudsea.png`, `tools/make_cloudsea.py`), camera chỉ cho thấy dải mây ~30 px dưới vách.
