# Area Editor: hướng dẫn dùng

Chỉ chạy được khi bật máy chủ dev (`npm run dev`, hoặc `npx vite`). Bản build không có editor.

## Mở
`http://localhost:5173/?area=<id-khu>&edit=1`, ví dụ `?area=huyen-van-quan-v2&edit=1`.
Không có `edit=1` thì game chạy như bình thường.

## Chế độ Sửa và Chơi thử
- **Tab** (hoặc nút trên thanh): Sửa ⇄ Chơi thử.
- Chơi thử: nhân vật xuất hiện ở tâm camera, chơi bình thường với dữ liệu đang sửa (chưa ghi đĩa). Va chạm, mái, đèn dựng lại đúng. Nếu tâm camera nằm trong ô chặn thì nhân vật sẽ kẹt, bấm Tab quay lại rồi chọn chỗ khác.
- Cổng chuyển khu trong lúc Chơi thử sẽ đưa sang khu khác; editor mở lại cho khu đó.

## Chuột
| Thao tác | Tác dụng |
|---|---|
| Bấm | chọn mảnh trên cùng (bỏ qua vùng trong suốt của ảnh) |
| Alt+bấm | chọn mảnh nằm dưới (bấm lặp để đi xuống dần) |
| Shift+bấm | thêm/bớt khỏi vùng chọn |
| Kéo vùng trống, hoặc kéo chuột phải | chọn theo khung (mảnh có điểm neo nằm trong khung) |
| Kéo mảnh | dời, bám 1 px. Giữ Ctrl: bám lưới 8 px. Ctrl+Shift: lưới 32 px |
| Chuột giữa kéo, hoặc Space+kéo | di chuyển camera |
| Lăn chuột | zoom nguyên 1×–6× (quanh con trỏ) |
| Giữ C + kéo | dời ảnh concept (khi chưa khoá) |
Đường hồng hiện ra khi chân (điểm neo) mảnh đang kéo thẳng hàng x hoặc y với mảnh khác.

## Phím
`←↑↓→` dời 1 px · `Shift+mũi tên` 8 px · `Delete` xoá · `Ctrl+D` nhân bản (+8,+8) · `Ctrl+C / Ctrl+V` chép/dán (dán tại con trỏ) · `Ctrl+Z` hoàn tác · `Ctrl+Y` (hoặc Ctrl+Shift+Z) làm lại · `Ctrl+A` chọn hết · `F` đưa camera tới mục chọn · `Esc` bỏ chọn/thôi đặt · `Ctrl+S` lưu · `Tab` Sửa/Chơi thử.
Một lần kéo là một bước hoàn tác; các lần nhấn mũi tên liên tiếp gộp thành một bước.

## Thư viện (trái) và Thuộc tính (phải)
- Thư viện: mọi kit trong `public/assets/kits` cùng kit của khu. Gõ vào ô tìm. Kéo mảnh vào cảnh, hoặc bấm chọn mảnh rồi bấm vào cảnh để đặt (lặp lại được; `Esc` để thôi). Dùng kit chưa có trong khu thì editor tự ghi kit đó vào `kits` của khu (cảnh nạp lại một lần).
- Thuộc tính: `k`, `x`, `y` (sửa số), lớp, depth, tầng tại chân, va chạm. Chọn nhiều mục thì sửa lệch Δx, Δy.
- Mục "Kit trong khu": ẩn hoặc khoá từng kit (khoá = không chọn được).
- Mảnh có mái đi kèm (`pair`) sinh ảnh mái tự động; chọn/kéo/xoá/nhân bản cả nhóm.

## Lớp phủ
Menu "Lớp phủ" bật/tắt: lưới 32, `col`, màu tầng, va chạm piece, điểm neo, khung ảnh, cổng, điểm sinh, bậc, vùng exits.

**Concept:** chọn ảnh trong danh sách (đọc từ `design/tienson/**`, chỉ đọc) hoặc thả file ảnh vào cảnh. Chỉnh độ mờ, x, y, zoom, khoá, hiện. Cấu hình lưu theo khu trong localStorage của trình duyệt (ảnh thả từ file không nhớ lại được sau khi tải lại trang).

## Lưu
- **Ctrl+S** hoặc nút Lưu: ghi `tools/areas/<id>.src.json` (chỉ đoạn `pieces` và `kits`, giữ nguyên phần còn lại từng byte), rồi bake lại `area.json` và `ground.png`. HVQ v2 bake mất khoảng 18 giây (có thể tới 45 giây khi máy bận); trong lúc đó trạng thái là "Đang bake...".
- Trạng thái trên thanh: Đã lưu / Chưa lưu / Đang bake / Lỗi.
- Giao dịch an toàn: bake thử trước, sao lưu bản cũ, ghi nguyên tử, lỗi thì khôi phục.
- **Xung đột:** nếu file src trên đĩa đã bị đổi (Codex hoặc người khác) từ lúc mở editor, lưu bị từ chối ("XUNG ĐỘT"); không ghi gì. Bấm "Tải lại từ đĩa" (bản nháp của bạn vẫn còn trong localStorage để so lại).
- **Nháp:** thay đổi chưa lưu tự giữ trong localStorage theo khu và hash file; mở lại sẽ hỏi có khôi phục không. Đóng tab khi chưa lưu sẽ có cảnh báo.
- Nút **Kiểm tra** chạy `node tools/blockout_reach.mjs` (tối đa 120 giây) và hiện kết quả.
- Toạ độ: mục bạn dời được ghi số nguyên; mục không đụng giữ nguyên giá trị cũ (nguồn có sẵn toạ độ lẻ như y 827.2).

## Khôi phục bản sao lưu
Mỗi lần lưu, bản cũ (src + `area.json` + `ground.png`) được cất ở `tools/areas/.bak/<id>/<thời-gian>/`, giữ 30 bản mới nhất. Cách khôi phục: tắt editor, rồi
1. chọn thư mục bản sao lưu cần (tên là thời gian, mới nhất ở cuối khi sắp tên);
2. chép `<id>.src.json` trong đó đè lên `tools/areas/<id>.src.json`;
3. chạy `node tools/area_bake.mjs tools/areas/<id>.src.json` để bake lại (hoặc chép luôn `area.json`, `ground.png` về `public/assets/areas/<id>/`).
Hoặc gọi hàm `restoreBackup(root, id, name)` trong `tools/areaed/txn.mjs` (khôi phục nguyên cả bộ ba, kể cả khi hỏng giữa chừng: máy chủ dev tự chạy `recoverJournals` khi khởi động).

## Kiểm thử
`node tools/editor_test.mjs` dựng bản sao tạm của repo (cổng 5190) và chạy E2E. Vì bake HVQ lâu, chia được 3 lượt: `--part=1`, `--part=2`, `--part=3` (mỗi lượt dưới 60 giây, dùng chung bản sao tạm; lượt 3 dọn dẹp).
API cho test: `window.__areaed` (`state`, `select`, `moveBy`, `add`, `remove`, `duplicate`, `undo`, `redo`, `save`, `togglePlay`, `centerOn`, `check`).
