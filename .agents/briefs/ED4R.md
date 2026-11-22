task_id: ED4R — review chéo toàn bộ Area Editor (R3, effort high)
goal: Tìm lỗi thật (đúng đắn, mất dữ liệu, bảo mật dev-server, rò rỉ vào bản build, hồi quy gameplay) trong diff `git diff e47e294 HEAD` của nhánh editor.

Trọng tâm theo thứ tự:
1. vite.config.js plugin areaEditor: path traversal ở /__areaed/concept?path và /__areaed/src?id; kích thước body; luồng save (đọc đĩa -> spliceTopLevel -> validateEdit -> saveArea) có dùng ĐÚNG baseHash client gửi không, hay vô tình đọc lại hash mới (làm mất phát hiện xung đột); /__areaed/check timeout + giết tiến trình; recoverJournals khi khởi động.
2. src/AreaScene.js: không có ?edit=1 thì hành vi phải y hệt commit 30d8ec1 (so diff từng chỗ có comment [editor]); restart với data.edit không rò rỉ texture/listener; kit mới nạp đúng.
3. src/editor/model.js + index.js: undo/redo đúng với nhóm ảnh mái; toạ độ: mục dời -> số nguyên, mục không dời -> giữ nguyên giá trị gốc; chỉ số placement sau remove/duplicate (ảnh mang setData('placement', i) có bị lệch chỉ số sau khi xoá phần tử giữa mảng không?); nháp localStorage theo id+baseHash; beforeunload.
4. tools/areaed/txn.mjs + srcio.mjs (đã có test) — chỉ soát chỗ plugin dùng sai API.
5. tools/editor_test.mjs: test có thật sự kiểm điều nó in ra không (assert lỏng?).
Trả: danh sách P0/P1/P2, mỗi cái file:dòng + kịch bản lỗi cụ thể + đề xuất sửa. Không sửa file.
do_not: không ghi file, không chạy bake/vite.
