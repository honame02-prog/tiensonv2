task_id: ED1 — bộ đọc/ghi src.json giữ nguyên byte (R3)
goal: Viết tools/areaed/srcio.mjs (ES module, Node thuần, không thêm gói) + test đơn vị, theo docs/editor/THIET-KE.md §5b.1 và §5b.3.

context:
- Nguồn khu: tools/areas/*.src.json (5 file; 1 file nhiều dòng, còn lại 1 dòng; có/không có LF cuối). pieces/kits ở CẤP GỐC (huyen-van-quan-v2 có 140 pieces) — tools/area_bake.mjs:15-17 chấp nhận cả gốc lẫn trong area.
- src/areaKits.js: validateKit(id, json), resolveKitPieces(area, kits) — dùng lại để kiểm.
- ED0 đo: JSON.stringify sai byte 4/4 file.

API phải xuất (đúng tên):
- `hashText(text) -> string` (sha256 hex).
- `parseSrc(text) -> {obj, spans}`: obj = JSON.parse; spans = map khoá cấp gốc -> {start,end} vị trí đoạn GIÁ TRỊ trong text (tokenizer JSON tự viết, đúng chuỗi có escape/unicode, số thực, lồng nhau).
- `spliceTopLevel(text, edits) -> newText`: edits = {key: value} (value undefined = xoá khoá). Chỉ thay đoạn giá trị khoá đó; khoá mới chèn cuối object gốc (`,"key":<json>` khớp kiểu file 1 dòng; file nhiều dòng thì theo thụt lề đang dùng). Giá trị mới serialize: mảng `pieces` dạng mỗi phần tử `{"k":"..","x":N,"y":N}` liền, giữ thứ tự khoá trong phần tử như dữ liệu đầu vào. Không đổi LF cuối file.
- `editableView(obj) -> {id, width, height, kits, pieces}` (width/height từ obj.bake).
- `validateEdit({id, fileId, obj, edits, kitsJson}) -> {ok, errors:[...]}`: id khớp tên file; chỉ cho khoá 'pieces','kits'; kits url dạng `assets/kits/<KIT>/kit.json` với KIT ^[A-Za-z0-9_-]+$; pieces: k dạng "<KIT>/<tên>" KIT có trong kits, x,y số nguyên trong [0,width]x[0,height]; mảnh có trong kit (dùng validateKit/resolveKitPieces với kitsJson = {KIT: kit.json đã đọc}).

write_scope: tools/areaed/srcio.mjs, tools/areaed/srcio_test.mjs
done_when: `node tools/areaed/srcio_test.mjs` in "SRCIO PASS" và exit 0, test gồm:
 1. Round-trip: với cả 5 file thật, spliceTopLevel(text, {}) === text; spliceTopLevel(text,{pieces: obj.pieces}) === text khi có pieces (hvq) — nếu serialize mảng gốc khác byte thì chứng minh bằng test rằng CHỈ đoạn pieces khác và JSON.parse tương đương.
 2. Dời 1 piece: diff chỉ nằm trong đoạn pieces; JSON.parse(new) sâu-bằng obj trừ piece đó.
 3. Thêm khoá pieces/kits vào hau-son-v3 (chưa có): parse được, các khoá khác giữ byte.
 4. Tokenizer: chuỗi có \" \\ á, số -1.5e3, mảng lồng.
 5. validateEdit bắt: id lệch, khoá lạ ('area'), kit url '../x', KIT không có, x=1.5, x=-1, y>height, mảnh không có trong kit.
do_not: không sửa file ngoài write_scope; không ghi vào tools/areas/ hay public/ (test chỉ đọc file thật, ghi vào os.tmpdir()); không thêm dependency.
