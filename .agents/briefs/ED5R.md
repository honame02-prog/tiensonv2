task_id: ED5R — review chéo bản cuối Area Editor vòng 2 (R3, effort high)
goal: Tìm lỗi thật (đúng đắn, mất dữ liệu, bảo mật dev-server, rò rỉ vào bản build, hồi quy gameplay) trong diff `git diff e47e294 e488286` của nhánh editor. Vòng trước (ED4R, xem .agents/codex/ED4R/report.md) đã có 7 finding và commit e488286 nói đã sửa — kiểm lại từng sửa đó có đúng và đủ không.

Trọng tâm theo thứ tự:
1. recoverJournals (vite.config.js + tools/areaed/txn.mjs): mọi request /__areaed/* có thật sự CHỜ khôi phục journal xong mới phục vụ không (kể cả khi recover reject)? Test hiện có (tools/areaed/txn_test.mjs, tools/editor_test.mjs) chỉ kiểm Promise tồn tại — chỉ ra chỗ assert lỏng và đề xuất test kiểm THỨ TỰ (request đến trong lúc recover đang chạy phải bị giữ tới khi recover xong).
2. Endpoint /__areaed/restore và /__areaed/backups: path traversal trong tên backup/id, khôi phục backup của khu khác, khôi phục khi có xung đột baseHash, có đi qua txn nguyên tử + bake không, có tạo backup của bản hiện tại trước khi đè không, liệt kê backups có lộ đường dẫn tuyệt đối không.
3. Hàm kiểm Host/Origin: bypass bằng Host có cổng lạ, `localhost.evil.com`, `127.0.0.1.nip.io`, IPv6 `[::1]`, Origin `null`, thiếu Origin với POST, chữ hoa; DNS rebinding. Áp cho MỌI endpoint ghi (save, restore, check) chứ không chỉ một số?
4. Token phiên khi lưu: sinh thế nào (đủ ngẫu nhiên?), gửi tới client qua đâu (có lấy được bằng GET cross-origin không), so sánh thế nào, mọi endpoint ghi đều yêu cầu token chưa, server restart thì client cũ xử lý ra sao.
5. Các sửa khác của e488286: await recover, chọn theo depth ảnh trúng, làm tròn toạ độ đích, gộp nudge cùng selection vào 1 bước undo, zoom 0.17–6x, banner nháp DOM (XSS khi chèn tên/chuỗi vào DOM?).
6. src/AreaScene.js: không có ?edit=1 thì hành vi y hệt 30d8ec1.
7. tools/editor_test.mjs: assert có kiểm thật điều nó in ra không; `--part=N` phụ thuộc `--part=1` chạy trước (trạng thái để lại) — nêu rủi ro.
Trả: danh sách P0/P1/P2, mỗi cái file:dòng + kịch bản lỗi cụ thể + đề xuất sửa. Nêu rõ finding nào của ED4R đã sửa đúng / chưa đúng. Không sửa file.
do_not: không ghi file, không chạy bake/vite/dev server.
