task_id: ED3 — giao diện Area Editor trong game + plugin dev + E2E (R3)
goal: Người dùng mở `?area=<id>&edit=1` trên dev server và tự đặt/dời/xoá/nhân bản kit piece, thấy đúng hình game, lưu an toàn; theo docs/editor/THIET-KE.md §2, §3, §5, §5b (5b thắng khi mâu thuẫn).

context (đã trinh sát, đừng khám phá lại diện rộng):
- src/AreaScene.js 542 dòng: area id :31; preload :40-69 (area.json :43, kit pieces :49-53, atlases :55-57); dựng kit piece :94-101 (kit.json :94; staticGroup zone collide :101; depth ground -99 / roof H+1 / depthOf(y,tier) :97); mask mái :217; đèn/nightmask :362; nhân vật depthOf :236; camera follow :187; fxlab móc :210-212 (import động — mẫu cho editor).
- src/areaKits.js: kitPieceUrl, validateKit, resolveKitPieces — 1 placement có thể sinh nhiều ảnh (mái tự sinh :29; HVQ 140 placement -> 210 ảnh).
- src/areaLayers.js depthOf :30. src/fxlab/panel.js: mẫu panel DOM.
- vite.config.js: plugin fxlabSave (mẫu middleware dev).
- Pieces KHÔNG ảnh hưởng ground.png/col khi bake (tools/area_bake.mjs:186-230 chỉ copy kitArea), nên chơi thử = scene.restart với pieces/kits từ bộ nhớ là chính xác.
- STYLE: 1 px ảnh = 1 px game, pixel art, neo = giữa mép dưới (docs/assetgen/STYLE.md:42), lưới 32 px.
- Module server do việc khác (Codex) viết, sẽ có ở tools/areaed/ khi bạn tới bước plugin; API (dùng đúng tên):
  - srcio.mjs: hashText(text), parseSrc(text)->{obj,spans}, spliceTopLevel(text, {pieces?,kits?})->newText, editableView(obj)->{id,width,height,kits,pieces}, validateEdit({id,fileId,obj,edits,kitsJson})->{ok,errors}
  - txn.mjs: saveArea({root,id,baseHash,newText})->{ok,hash,ms,bakeLog}|{ok:false,code:'conflict'|'invalid'|'bake'|'io',error,diskText?}; recoverJournals(root); listBackups(root,id); restoreBackup(root,id,name)
  Nếu chưa có file khi bạn cần, viết plugin theo API này và báo lại; KHÔNG tự viết srcio/txn.

Phải làm:
1. AreaScene (thay đổi tối thiểu, có comment): gắn mỗi ảnh kit piece với chỉ số placement (setData('placement', i)) gồm cả ảnh mái tự sinh; nhận `init({..., edit:{pieces,kits}})` để restart với dữ liệu trong bộ nhớ (nạp thêm kit mới chưa có trong area); nạp editor chỉ khi `import.meta.env.DEV && sp.get('edit')==='1'` (đồng thời thêm guard DEV cho fxlab :210-212). Không có ?edit=1 thì hành vi y hệt cũ.
2. src/editor/*: chế độ Sửa/Chơi thử (Tab); camera tự do (kéo chuột giữa / Space+kéo, lăn zoom nguyên 1–6×, F tới mục chọn), dừng follow + input nhân vật khi Sửa; chọn theo placement (trên cùng theo depth; Alt = lớp dưới; Shift thêm; kéo khung); kéo dời (bám 1 px, Ctrl 8, Ctrl+Shift 32); mũi tên 1 px / Shift 8; Delete; Ctrl+D nhân bản (+8,+8); Ctrl+C/V; Ctrl+Z/Y (ngăn xếp lệnh, gộp 1 lần kéo = 1 bước); đường căn chân thẳng hàng. Khi kéo: dời mọi ảnh của placement, tính lại depth bằng depthOf và tier tại chân.
   Panel DOM: thanh trên (khu, Lưu Ctrl+S, Hoàn tác/Làm lại, Sửa⇄Chơi thử, lớp phủ, trạng thái đã lưu/chưa lưu/đang bake/lỗi kèm thông báo), trái Thư viện (GET /__areaed/kits: mọi kit trong public/assets/kits, ảnh thu nhỏ, tên, kích thước, lớp, tìm kiếm; kéo vào cảnh hoặc chọn rồi bấm cảnh; dùng kit ngoài khu thì thêm vào kits), phải Thuộc tính (k, x, y sửa số, lớp, depth, tier, collide; nhiều mục = sửa lệch).
   Lớp phủ bật/tắt từng loại: lưới 32, col, tierRows (màu theo tầng), collide piece, neo, khung ảnh, portals, spawns, steps, exits.
   Lớp phủ concept: chọn ảnh từ GET /__areaed/concepts (liệt kê png/webp/jpg trong ../design/tienson/** tương đối repo gốc D:\SkillFX_TuThienChi_HoaLien\design — chỉ đọc, chặn path traversal) hoặc thả file ảnh; độ mờ, dời, zoom, khoá; lưu cấu hình theo khu trong localStorage (try/catch). Khoá/ẩn theo kit.
   Nháp chưa lưu: localStorage theo id+baseHash, hỏi khôi phục khi mở lại. Cảnh báo beforeunload khi chưa lưu.
   API test `window.__areaed`: state(), select(idx[]), moveBy(dx,dy), add(k,x,y), remove(), duplicate(), undo(), redo(), save()->Promise, togglePlay().
3. vite.config.js plugin `areaEditor` (apply:'serve'): GET /__areaed/src?id, GET /__areaed/kits, GET /__areaed/concepts, GET /__areaed/concept?path, POST /__areaed/save {id, baseHash, pieces, kits} (đọc text đĩa -> spliceTopLevel -> validateEdit -> saveArea), POST /__areaed/check {id} (chạy node tools/blockout_reach.mjs và báo stdout/exit; timeout 120 s), gọi recoverJournals khi khởi động. Giữ fxlabSave.
4. tools/editor_test.mjs (Playwright như tools/area_kits_test.mjs): dựng bản sao repo tạm trong os.tmpdir() (src, public, tools, index.html, vite.config.js, package.json; node_modules = junction tới node_modules thật), chạy vite VỚI config (có plugin) trên cổng riêng 5190 strictPort, root = bản sao. Ca: (a) mở ?area=huyen-van-quan-v2&edit=1 không lỗi console; (b) chọn 1 placement, moveBy(5,3), save -> src bản sao chỉ đổi đoạn pieces đúng 1 mục, area.json bake lại có toạ độ mới; (c) undo + save -> src trở lại ĐÚNG BYTE gốc; (d) add/remove/duplicate -> đếm đúng, ảnh mái đi cùng; (e) sửa src trên đĩa khi editor mở -> save trả conflict, UI báo; (f) togglePlay -> nhân vật đi được, va chạm piece mới có hiệu lực (đứng chặn); (g) không ?edit=1: không tải module editor (kiểm network). Cuối in "EDITOR E2E PASS".
5. Hồi quy: `npx vite build --outDir <tmp>` rồi grep bundle KHÔNG chứa "__areaed"; chạy lại node tools/area_steps_walk_test.mjs, area_layers_test.mjs, area_kits_test.mjs, blockout_reach.mjs đều đạt.

write_scope: src/editor/**, src/AreaScene.js, vite.config.js, tools/editor_test.mjs, docs/editor/HUONG-DAN.md (hướng dẫn dùng tiếng Việt cho người dùng: cách mở, phím tắt, lưu, khôi phục bản sao lưu).
done_when: tools/editor_test.mjs in "EDITOR E2E PASS"; 4 test khu cũ đạt; build không chứa __areaed. Báo cáo log thật từng lệnh.
do_not: không sửa tools/areaed/* (việc khác); không ghi vào tools/areas/*.src.json hay public/assets/areas/ của repo thật (chỉ bản sao tạm); không thêm dependency npm; không commit; không kill tiến trình bạn không khởi chạy (có dev server đang chạy ở worktree khác cổng 5173/5176 — đừng đụng); chạy lệnh dài > 60 s thì chia nhỏ.
