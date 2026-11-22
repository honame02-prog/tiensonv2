task_id: ED2 — giao dịch lưu + bake an toàn (R3)
goal: Viết tools/areaed/txn.mjs (ES module, Node thuần) + test, theo docs/editor/THIET-KE.md §3 và §5b.2.

context:
- Bake: `node tools/area_bake.mjs tools/areas/<id>.src.json [--out <dir>]` (tools/area_bake.mjs:224 — có sẵn --out; ghi ground.png trước area.json; trường ground trong area.json luôn `assets/areas/<id>/ground.png`). Bake HVQ 1280x1280 có thể 10-30 s.
- Output thật: public/assets/areas/<id>/{area.json,ground.png}. Nguồn: tools/areas/<id>.src.json.
- Một module khác (srcio.mjs, việc song song) sẽ tạo newText; txn KHÔNG phụ thuộc nó — nhận sẵn newText.

API phải xuất:
- `saveArea({root, id, baseHash, newText, bakeTimeoutMs=120000, keepBackups=30}) -> Promise<{ok:true, hash, ms, bakeLog} | {ok:false, code:'conflict'|'invalid'|'bake'|'io', error, diskText?, bakeLog?}>`
  Trình tự: (1) khoá theo id (hàng đợi promise trong tiến trình; lần gọi sau chờ lần trước); (2) đọc src trên đĩa, sha256; khác baseHash -> conflict + diskText; (3) id ^[a-z0-9-]+$, đường dẫn resolve phải nằm trong root/tools/areas; JSON.parse(newText) được và obj.area.id===id, nếu không -> invalid; (4) ghi newText ra file tạm (tools/areas/.staging/<id>.src.json), chạy bake với `--out <tmp dir trong root/tools/areas/.staging/<id>-out>` bằng child_process (process.execPath), timeout -> giết tiến trình, code 'bake'; kiểm tmp có area.json (parse được, id đúng) và ground.png (chữ ký PNG); (5) sao lưu: copy src + area.json + ground.png hiện tại vào tools/areas/.bak/<id>/<YYYYMMDD-HHMMSS-mmm>/, xoay vòng giữ keepBackups; (6) commit: ghi journal tools/areas/.staging/<id>.journal.json {backupDir, files}, rồi thay 3 file bằng atomicReplace (ghi tmp cùng thư mục, fsync, rename; EPERM/EBUSY/EACCES thử lại tối đa 10 lần, 100 ms); lỗi giữa chừng -> khôi phục từ backupDir các file đã thay, code 'io'; xong xoá journal + staging; (7) trả hash mới.
- `recoverJournals(root)`: khi khởi động, nếu còn journal (sập giữa commit) -> khôi phục từ backupDir, trả danh sách khu đã khôi phục.
- `listBackups(root, id)`, `restoreBackup(root, id, name)` (restore cũng qua khoá + atomicReplace + backup trước khi restore).
- Thêm tools/areas/.bak/ và tools/areas/.staging/ vào .gitignore.

write_scope: tools/areaed/txn.mjs, tools/areaed/txn_test.mjs, .gitignore
done_when: `node tools/areaed/txn_test.mjs` in "TXN PASS" exit 0. Test chạy trên một root GIẢ trong os.tmpdir() (copy tối thiểu: tools/area_bake.mjs + các module nó import (tools/png.mjs, tools/area_common.mjs, src/areaKits.js, tools/area_materials.json/tools/areas/blockout-materials.json nếu cần, public/assets/sect/ground_bake.png nếu bake cần, public/assets/kits/*), và một khu nhỏ — dùng tools/areas/son-dao.src.json hoặc tạo khu nháp 320x320 từ nó). Các ca:
 1. Lưu thành công: src/area.json/ground.png mới, backup có 3 file, hash đúng; bake tái lập (lưu cùng text 2 lần -> md5 output giống).
 2. Conflict: sửa file trên đĩa sau khi lấy baseHash -> code conflict, đĩa không đổi.
 3. Bake lỗi (newText tham chiếu kit không tồn tại) -> code bake, 3 file thật giữ nguyên byte.
 4. Hai saveArea đồng thời cùng baseHash -> 1 ok, 1 conflict.
 5. Mô phỏng lỗi giữa commit (hook test làm atomicReplace file thứ 2 ném lỗi) -> 3 file trở lại byte cũ.
 6. recoverJournals sau journal treo -> khôi phục đúng.
 7. Xoay vòng backup giữ đúng keepBackups.
 8. id '../x' hoặc 'A' -> invalid.
do_not: không bao giờ ghi vào tools/areas/ hay public/ của repo thật (chỉ root giả); không sửa area_bake.mjs; không thêm dependency.
