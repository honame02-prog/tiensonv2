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
| Kéo vùng trống, hoặc kéo chuột phải (kể cả trên mảnh) | chọn theo khung (mảnh có điểm neo nằm trong khung) |
| Kéo mảnh | dời, bám 1 px. Giữ Ctrl: bám lưới 8 px. Ctrl+Shift: lưới 32 px |
| Chuột giữa kéo, hoặc Space+kéo | di chuyển camera |
| Lăn chuột | zoom quanh con trỏ: 0.25× · 0.5× · 1× … 6× (nhãn mức zoom hiện trên thanh trên) |
| Giữ C + kéo | dời ảnh concept (khi chưa khoá) |
Đường hồng hiện ra khi chân (điểm neo) mảnh đang kéo lệch không quá 2 px so với mảnh khác theo x hoặc y.

## Phím
`←↑↓→` dời 1 px · `Shift+mũi tên` 8 px · `Delete` xoá · `Ctrl+D` nhân bản (+8,+8) · `Ctrl+C / Ctrl+V` chép/dán (dán tại con trỏ) · `Ctrl+Z` hoàn tác · `Ctrl+Y` (hoặc Ctrl+Shift+Z) làm lại · `Ctrl+A` chọn hết · `F` đưa camera tới mục chọn · `0` thu nhỏ vừa khung cả khu · `Esc` bỏ chọn/thôi đặt · `Ctrl+S` lưu · `Tab` Sửa/Chơi thử.
Một lần kéo là một bước hoàn tác; các lần nhấn mũi tên liên tiếp (cùng tập chọn, cách nhau dưới 0,7 giây) gộp thành một bước. Chọn mảnh theo ảnh thực sự nằm dưới con trỏ: mái (vẽ trên cùng) che cây thì bấm vào phần mái chọn mảnh của mái; Alt+bấm đi xuống các lớp bên dưới.

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
- **Nháp:** thay đổi chưa lưu tự giữ trong localStorage theo khu và hash file; mở lại sẽ hiện banner "Có bản nháp chưa lưu" với hai nút Khôi phục / Bỏ nháp (chưa chọn thì nháp vẫn được giữ). Đóng tab khi chưa lưu sẽ có cảnh báo.
- Nút **Kiểm tra** chạy `node tools/blockout_reach.mjs` (tối đa 120 giây) và hiện kết quả.
- Toạ độ: mục bạn dời, nhân bản hoặc nhập số được ghi số nguyên (làm tròn toạ độ đích, ví dụ 827.2 nhập 827 thì ghi 827); mục không đụng giữ nguyên giá trị cũ.

## Khôi phục bản sao lưu
Mỗi lần lưu, bản trước đó của cả bộ ba (`<id>.src.json`, `area.json`, `ground.png`) được cất ở `tools/areas/.bak/<id>/<YYYYMMDD-HHMMSS-mmm>/` (giờ UTC, giữ 30 bản mới nhất, thư mục này gitignore).
**Trong editor:** nút "Sao lưu" trên thanh trên liệt kê các bản (mới nhất trên cùng, kèm thời gian). Bấm "Khôi phục", xác nhận trong hộp thoại của editor: bộ ba được ghi lại nguyên văn (không bake lại), bản hiện tại được sao lưu trước, rồi cảnh tải lại từ đĩa. Thay đổi chưa lưu sẽ mất.
**Bằng tay** (khi không mở được editor): sao chép ba file từ thư mục bản sao lưu về `tools/areas/<id>.src.json` và `public/assets/areas/<id>/{area.json,ground.png}`, hoặc chép riêng src rồi chạy `node tools/area_bake.mjs tools/areas/<id>.src.json`.
Máy chủ dev tự chạy `recoverJournals` khi khởi động (khôi phục nếu lần lưu trước hỏng giữa chừng) và chỉ phục vụ `/__areaed/*` sau khi xong.

## Bảo mật dev-server
`/__areaed/*` chỉ nhận Host là `localhost`, `127.0.0.1` hoặc `[::1]` kèm đúng cổng đang chạy (chống DNS rebinding) và, nếu có header Origin, phải cùng nguồn; sai trả 403. Truy cập qua IP LAN: đặt biến môi trường `AREAED_ALLOW_HOSTS=192.168.1.5:5173` khi chạy vite.

## Kiểm thử
`node tools/editor_test.mjs` dựng bản sao tạm của repo (cổng 5190) và chạy E2E (chạy một mạch mất vài phút vì bake HVQ 2 lần). Chia được 7 lượt: `--part=1` … `--part=7` (mỗi lượt dưới 60 giây, dùng chung bản sao tạm, chạy theo thứ tự; lượt 7 dọn dẹp): 1-2 lưu/bake + trả về đúng byte, 3 thêm/xoá/chơi thử/xung đột/không ?edit, 4 zoom + banner nháp + concept, 5 lớp phủ/khoá kit/kéo thả/chọn khung/Alt/phím tắt/panel/Kiểm tra/guide, 6 khôi phục sao lưu + chụp ảnh (`records/editor/ui-1x.png`, `ui-overview.png`), 7 bảo mật Host/Origin + chọn theo ảnh trúng + làm tròn + gộp nudge + token phiên lưu.
API cho test: `window.__areaed` (`state`, `select`, `moveBy`, `add`, `remove`, `duplicate`, `undo`, `redo`, `save`, `togglePlay`, `centerOn`, `fit`, `setLayer`, `hitsAt`, `pickAt`, `check`).
