# GĐ3: FxLab, chỉnh chiêu trong cảnh game thật (2026-11-20)

## Chạy
```
npm run dev          # rồi mở http://localhost:5173/?fxlab=1
```
`?fxlab=1` ngụ ý `?fx=1` (phím 1/2/3, 4, R, HUD, nút cảm ứng 1/2/3). Không cờ: game như cũ, không nạp mã FxLab (chunk riêng ~15 kB, import động). Chạy bản build (`npm run preview`) vẫn dùng được FxLab, chỉ không có nút "Lưu vào dự án".

Cũng có thể kết hợp tham số cũ: `?fxlab=1&night`, `&x=..&y=..&face=..`.

## Bảng
- Desktop: cột bên phải (340 px). Mobile (màn nhỏ, vd. 844x390): ngăn kéo dưới, cao tối đa 40% màn hình. Bấm tiêu đề để gập/mở; gập chỉ còn thanh tiêu đề + FPS.
- Hàng 1: chọn cue; dải màu (6 dải) kèm dải 7 ô xem trước. Đổi dải sẽ ghi `ramp` mới vào cue và đổi mọi token `<dải cũ>.N` sang dải mới (token `glow/core/anchor` tự theo dải).
- Hàng 2: Phát; Lặp (ô số = khoảng cách giữa hai lần phát, ms); Ngày/Đêm (cùng cờ `scene.night` với phím N); Đặt bù nhìn / Bỏ bù nhìn (1 Đạo Sĩ đứng yên cách người chơi 48 px theo hướng nhìn, quay mặt về phía người chơi; chiêu phát tại đó; người chơi vẫn đi lại).
- Không có bù nhìn: chiêu phát tại điểm trước mặt người chơi (36 px).
- Thanh thời gian: mỗi track một thanh ngang theo `at`/`dur` trên `duration`, màu theo token màu của track; con trỏ trắng chạy khi phát (đồng hồ thật, hitstop không làm chậm con trỏ). Bấm thanh để mở khối track.
- Khối track (bấm tiêu đề để mở): hộp tick bật/tắt (ghi `"off": true`, FxPlayer bỏ qua track này), ⧉ nhân bản, × xoá. Mọi tham số số là thanh trượt + ô số (khoảng theo tên tham số, `src/fxlab/schema.js`; ô số cho nhập vượt khoảng, thanh trượt tự nới). Mảng số (`alpha`, `scale`, `grow`...) mỗi phần tử một thanh. `color` = dropdown (glow / core / anchor / 0..6) + ô màu. Màu hạt của emitter là danh sách, thêm/bớt được. `config` của emitter hiện đầy đủ (speed, angle, lifespan, gravityY, ...).
- "+ Thêm track": chọn type rồi thêm (mẫu trong `NEW_TRACK`).
- Đổi gì cũng áp dụng ở lần phát kế tiếp, không reload. Phím 1/2/3 cũng dùng bản đang sửa.

## Lưu / xuất
- Nháp tự lưu localStorage, khóa `fxlab:draft:<id>`; mở lại trang vẫn còn. "Khôi phục bản gốc" xoá nháp và nạp lại file gốc.
- "Tải JSON": tải `<id>.json` (dạng giống các file trong `src/fx/cues`: mỗi track một dòng). "Chép JSON": vào clipboard.
- "Lưu vào dự án" (chỉ khi `vite` dev): POST `/__fxlab/save` `{id, json}` -> ghi `src/fx/cues/<id>.json`. Middleware ở `vite.config.js` (`apply: 'serve'`, không vào bản build): id chỉ `[a-z0-9-]`, `json` phải là cue hợp lệ có `id` khớp và `tracks`, đường dẫn phải nằm trong `src/fx/cues`. Sau khi ghi, Vite có thể tải lại trang; nháp trong localStorage vẫn còn, nên không mất gì.
- "Tạo cue mới từ bản sao": nhập id mới ([a-z0-9-]) rồi bấm; tạo bản sao cue hiện tại, vào danh sách ngay. Muốn giữ lâu dài: Tải JSON hoặc Lưu vào dự án (file mới trong `src/fx/cues` tự được `index.js` gom).

## Cảnh báo
Dòng đỏ khi: số hạt đỉnh trong lần phát > 120 (chiêu thường) hoặc > 300 (cue `ultimate: true`); FPS thấp nhất trong lúc phát tụt > 5 so với FPS nền trước khi phát (trung bình trượt lúc không có cue). Hiển thị cả FPS và `fx.stats()` (active/hạt/obj).

## Giới hạn
- `at`/`dur` của emitter bắn một lần (`frequency: -1`, `dur: 0`) vẫn là số hạt tức thời; ngân sách đo bằng đỉnh `fx.stats().particles` lấy mẫu mỗi 200 ms, có thể bỏ lỡ đỉnh rất ngắn.
- FPS đo bằng `actualFps` (đã làm mượt) nên phản ứng chậm hơn một nhịp; lần phát đầu có thể tụt do JIT/sinh texture (ring/cột kích cỡ mới sinh lúc phát).
- Chưa có kéo thả thanh thời gian (chỉnh `at`/`dur` bằng thanh trượt trong khối track), chưa có hoàn tác (có nháp + khôi phục bản gốc), chưa đổi tên cue/đổi thứ tự track.
- Track `anim` (atlas) hiện chỉ sửa được tham số số/chữ; chưa có chọn atlas (GĐ4).
- Cue tạo mới chưa lưu thì "Khôi phục bản gốc" sau khi tải lại trang sẽ xoá cue đó (không có bản gốc).
- Chưa thử chạm thật trên điện thoại; mobile mới kiểm bằng Playwright giả lập (`tools/fxlab_test.mjs`).
- Test: `node tools/fxlab_test.mjs` (cần `npm run build` + `npx vite preview --port 8090`).

## Kết quả kiểm (swiftshader, 20/11)
- `npm run build` pass (chunk FxLab riêng 14,5 kB; chunk game 1.739 kB).
- `node tools/fxlab_test.mjs`: 27 kiểm đạt, 0 lỗi console (desktop 960x540 và mobile 844x390); ảnh `shots/fxlab_desktop.png`, `shots/fxlab_mobile.png` (thư mục shots bị .gitignore).
- `node tools/fx_test.mjs` không hồi quy: desktop ngày 56,56,56,57,57 -> 55,55,53,54,53; đêm 53,52,52,51,51 -> 48,47,47,47,46; mobile CPU 4x ngày 31,31,32,32,32 -> 31,31,31,30,30; đêm 28,27,26,26,26 -> 23,24,23,24,24; không rò rỉ (active/hạt/obj = 0, tint khôi phục).
- Middleware lưu (vite dev, cổng 8091): POST id hợp lệ -> 200 và ghi `src/fx/cues/<id>.json`; `../x`, `a/b`, `Hoa` -> 400; id không khớp JSON -> 400; GET -> 405. File thử đã xoá.
