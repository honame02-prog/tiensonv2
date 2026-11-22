# Area Editor: chế độ biên tập khu vực trong game (thiết kế v1, 22/11)

Mục tiêu: người dùng tự đặt và chỉnh sprite (kit piece), nền, vùng đi được, điểm sinh, cổng và điểm FX ngay trong game, thấy đúng như lúc chơi. Claude chỉ kiểm tra, bake, chạy test và gợi ý.

## 0. Hiện trạng (đã trinh sát, commit 30d8ec1)
- Phaser 4, Vite 6. Mở cảnh bằng `?area=<id>` (`src/AreaScene.js:31`).
- Đã có tiền lệ cho công cụ dev: `?fxlab=1` nạp động `src/fxlab/*`, và plugin `fxlabSave` trong `vite.config.js` (chỉ ở dev, `POST /__fxlab/save`).
- Nguồn dữ liệu là `tools/areas/<id>.src.json`, gồm `{materials, area:{...}, bake:{...}, blockout?, kits?, pieces?}`.
  - `node tools/area_bake.mjs <src>` bake ra `public/assets/areas/<id>/{area.json, ground.png}`. Bake tái lập được: cùng nguồn cho cùng byte.
- Sprite đặt tay là `pieces: [{k:"<KIT>/<tên>", x, y}]`, toạ độ là điểm neo, tính bằng px thế giới. Điểm neo, va chạm (`collide`) và lớp (`ground|base|roof`) nằm trong `public/assets/kits/<KIT>/kit.json`. Code dùng chung giữa runtime và baker ở `src/areaKits.js`.
  - Hiện chỉ HVQ v2 có `pieces` (140 mảnh, ở cấp gốc của src.json).
- Thứ tự chiều sâu: `depthOf(y, tier) = y + tier*TIER_DEPTH` (`src/areaLayers.js:30`). Lớp ground = -99, roof = H+1.
- Va chạm: lưới `col` 32 px (sinh từ `bake.blocks` và blockout), cộng thêm `collide` của từng piece. Tầng: `tierRows`. Bậc: `steps`. Cổng: `portals`. Điểm sinh: `spawns`.
- Test có sẵn: `area_steps_walk_test`, `area_layers_test`, `area_kits_test`, `blockout_reach` (tự dựng vite ở cổng 519x).

## 1. Nguyên tắc
1. **Một nguồn sự thật.** Công cụ chỉ ghi `tools/areas/<id>.src.json`, rồi gọi đúng `area_bake.mjs`. Không bao giờ sửa trực tiếp `area.json` hay `ground.png`.
2. **Không mất dữ liệu.**
   - Mỗi lần lưu, sao lưu bản trước vào `tools/areas/.bak/<id>/<thời-gian>.src.json` (giữ 30 bản; thư mục này gitignore).
   - Khi tải, ghi lại hash của file. Lúc lưu, nếu file trên đĩa đã đổi (người khác hoặc Codex sửa), công cụ từ chối ghi và báo xung đột.
   - Bản nháp chưa lưu được tự giữ trong localStorage theo khu, để mở lại khi trình duyệt sập.
3. **Diff tối thiểu.** Khi ghi, giữ nguyên định dạng gốc của file: thứ tự khoá, kiểu xuống dòng (file hiện là JSON một dòng). Tải rồi lưu mà không sửa gì phải ra đúng từng byte cũ.
4. **Kiểm tra phía server trước khi ghi.** Dùng lại `validateKit` và `resolveKitPieces` của `src/areaKits.js`; toạ độ phải là số nguyên nằm trong khu. Bake lỗi thì khôi phục src cũ và báo lỗi.
5. **Tách biệt.**
   - Mã nằm trong `src/editor/*`, chỉ nạp động khi có `?edit=1`.
   - Thay đổi trong `AreaScene.js` giới hạn ở vài móc nối (hook): lấy danh sách sprite piece, bật/tắt việc theo dõi nhân vật.
   - Bản build không chứa editor (giống fxlab).
6. **Hình hiển thị là hình thật.** Cảnh hiện bằng chính `AreaScene` và các sprite đang chạy. Kéo một piece thì sprite thật di chuyển và độ sâu được tính lại bằng `depthOf`, nên không có lệch giữa lúc sửa và lúc chơi.

## 2. Giao diện (DOM phủ lên canvas, như fxlab/panel)
- **Thanh trên:** tên khu, chọn khu, Lưu (Ctrl+S), Hoàn tác/Làm lại (Ctrl+Z/Y), nút Chơi thử ⇄ Sửa (phím Tab), bật/tắt các lớp phủ, trạng thái (đã lưu / chưa lưu / đang bake / lỗi).
- **Trái: Thư viện.** Liệt kê kit dùng được: kit của khu, cộng tất cả kit trong `public/assets/kits` (thêm kit mới thì tự ghi vào map `kits`). Mỗi mảnh có ảnh thu nhỏ, tên, kích thước, lớp. Có ô tìm kiếm. Kéo mảnh vào cảnh, hoặc chọn rồi bấm vào cảnh để đặt.
- **Phải: Thuộc tính** của mục đang chọn: `k`, `x`, `y` (sửa số), lớp, độ sâu tính được, tầng tại chân, va chạm. Chọn nhiều thì hiện số lượng và sửa lệch tương đối.
- **Cảnh:**
  - Camera tự do: kéo chuột giữa hoặc giữ Space+kéo để di chuyển; con lăn để zoom 1×–6× (nearest, số nguyên); phím F để đưa camera về mục đang chọn.
  - Bấm để chọn mảnh ở trên cùng (theo độ sâu). Alt+bấm để chọn mảnh bên dưới. Shift+bấm để chọn thêm. Kéo vùng trống để chọn theo khung.
  - Kéo để di chuyển, bám 1 px. Giữ Ctrl để bám lưới 8 px, Ctrl+Shift để bám 32 px.
  - Mũi tên dời 1 px, Shift+mũi tên dời 8 px. Delete để xoá, Ctrl+D để nhân bản (lệch +8,+8), Ctrl+C/V để chép/dán.
  - Có đường căn (guide) khi chân mảnh thẳng hàng với mảnh khác.
- **Lớp phủ (bật/tắt từng lớp):** lưới 32 px, lưới chặn `col`, màu tầng `tierRows`, khung va chạm của piece, điểm neo, khung ảnh, cổng, điểm sinh, bậc, vùng `exits`.
- **Chơi thử:** Tab đưa nhân vật về vị trí camera, chơi bình thường với dữ liệu đang sửa. Tab lần nữa quay lại chế độ sửa.

## 3. Lưu và bake (plugin dev `areaEditor` trong `vite.config.js`)
- `GET /__areaed/src?id=` trả `{text, hash}`.
- `GET /__areaed/kits` trả danh sách kit và mảnh.
- `POST /__areaed/save {id, baseHash, src}`, gồm các bước:
  1. Kiểm `id` theo regex và đường dẫn.
  2. So `baseHash`. Nếu khác, trả 409 kèm bản trên đĩa.
  3. Kiểm hợp lệ.
  4. Sao lưu bản cũ.
  5. Ghi file theo cách giữ định dạng.
  6. Chạy `node tools/area_bake.mjs`, có timeout 120 s.
  7. Bake lỗi: khôi phục bản sao lưu, trả lỗi kèm log. Thành công: trả `{ok, hash, md5, ms}`.
- Hàng đợi: mỗi khu chỉ một lần lưu/bake chạy cùng lúc.
- Sau khi lưu xong, client giữ nguyên cảnh, không tải lại. Lần bake mới sẽ có hiệu lực khi vào khu ở lần sau, hoặc khi bấm "Tải lại từ đĩa".
- `POST /__areaed/check {id}` chạy `blockout_reach` (và `area_kits_test` nếu được) rồi trả kết quả dạng chữ.

## 4. Giai đoạn
| GĐ | Nội dung | Xong khi |
|---|---|---|
| **1** | Khung editor, camera, lớp phủ, chọn/kéo/dời/xoá/nhân bản/hoàn tác, thư viện kit, thuộc tính, lưu và bake an toàn, chơi thử, nút kiểm tra | Các test của §5 đạt; người dùng tự đặt được mảnh ở HVQ v2 và lưu được |
| 2 | Sửa `spawns`, `portals`, `exits`, `steps` (kéo khung, kéo góc); tô ô `col` và `tierRows` (tô bằng cọ, chỉ hiệu lực khi khu không sinh col từ blockout, nếu không thì sửa `bake.blocks`) | Có test round-trip; reach đạt |
| 3 | Nền: sửa `bake.regions`, `bake.paths`, `bake.blocks` (đa giác, kéo đỉnh), xem trước bake ngay tại chỗ, đổi chất liệu | Bake giữ tái lập được |
| 4 | Điểm FX: đặt điểm phát, phát thử cue tại chỗ (FxPlayer), mở FxLab gắn với điểm đó | |
| 5 | (cần sửa runtime và baker) `flip`, `scale` của piece; ghi đè lớp/độ sâu theo từng piece | Ảnh chụp khớp từng điểm ảnh với bản không flip |

## 5. Kiểm thử (bắt buộc cho GĐ 1)
- **Đơn vị (Node):**
  - Bộ ghi giữ định dạng: round-trip đúng từng byte với cả 5 file src.json hiện có.
  - Validate: kit sai, toạ độ không nguyên, ngoài khu, `id` lạ, đường dẫn `..`.
  - Xung đột hash, khôi phục khi bake lỗi, xoay vòng bản sao lưu.
- **E2E (`tools/editor_test.mjs`, tự dựng vite ở cổng riêng, chạy trên một khu nháp copy từ HVQ v2 trong thư mục tạm):**
  1. Mở `?area=<nháp>&edit=1`, không có lỗi console.
  2. Gọi API test `window.__areaed`: chọn một mảnh, dời +5,+3, lưu. File thay đổi đúng một piece; area.json bake lại có piece mới.
  3. Hoàn tác rồi lưu: file trở lại đúng từng byte bản gốc.
  4. Thêm một mảnh từ thư viện, xoá một mảnh, nhân bản, rồi kiểm số lượng.
  5. Sửa file trên đĩa trong lúc editor đang mở: lưu nhận 409.
  6. Bản build (`vite build`) không chứa chuỗi `__areaed`.
- **Hồi quy:** 4 test khu hiện có vẫn đạt. Không có `?edit=1` thì cảnh giống từng điểm ảnh với trước (so bằng `area_shot` + `png_diff`).
- **Duyệt chéo:** Codex review toàn bộ diff (effort high) trước khi bàn giao.

## 5b. Sửa theo phản biện Codex ED0 (bắt buộc, thay thế phần mâu thuẫn ở trên)
1. **Bộ ghi src (`tools/areaed/srcio.mjs`)**
   - Không dùng `JSON.stringify` cho cả file, vì kiểm thử cho thấy sai byte ở 4/4 file.
   - Thay vào đó, tách token JSON, rồi chỉ thay đoạn giá trị của khoá cấp gốc bị sửa (GĐ1 chỉ có `pieces`, `kits`). Phần còn lại giữ nguyên từng byte.
   - Nếu khoá chưa có, chèn vào cuối object gốc theo đúng kiểu phân cách của file.
2. **Giao dịch lưu (`tools/areaed/txn.mjs`)**
   - Bước 1, khoá theo khu (hàng đợi trong tiến trình), rồi đọc lại hash trong lúc đang giữ khoá. Khác `baseHash` thì trả 409.
   - Bước 2, bake vào thư mục tạm bằng `area_bake.mjs --out <tmp>`, kiểm cả `area.json` và `ground.png`.
   - Bước 3, sao lưu src cùng hai file output cũ.
   - Bước 4, ghi nguyên tử: ghi file tạm cùng thư mục, fsync, rename. Trên Windows, nếu file bị khoá (EPERM/EBUSY) thì thử lại có giới hạn. Không xoá bản gốc trước khi rename.
   - Bước 5, có journal để khôi phục cả nguồn lẫn output nếu hỏng giữa chừng. Khi khôi phục cũng kiểm hash để không đè lên sửa đổi từ bên ngoài.
3. **Ràng buộc**
   - `area.id` phải khớp tên file.
   - GĐ1 chỉ cho sửa `pieces` và `kits`.
   - Đường dẫn kit phải có dạng `assets/kits/<KIT>/kit.json`, nằm trong `public/`.
4. **Đơn vị thao tác là placement** (một mục trong `pieces`), không phải ảnh.
   - Một placement có thể sinh nhiều ảnh: mảnh mái tự sinh ở `src/areaKits.js:29`, ví dụ 140 placement ra 210 ảnh.
   - Chọn, kéo, xoá, nhân bản thì đi cả nhóm ảnh của placement đó.
5. **Xem trước**
   - Khi kéo: chỉ dời ảnh của nhóm (khung, độ sâu `depthOf`), chưa cập nhật collider, mask mái hay đèn.
   - **Chơi thử** = `scene.restart` với area đã nạp, trong đó `pieces`/`kits` lấy từ bộ nhớ editor (không ghi đĩa). Collider, mask và đèn được dựng lại đúng. Riêng ground.png và `col` giữ bản đã bake, nếu chứng minh được là pieces không ảnh hưởng tới chúng.
6. **Mã editor** chỉ được import khi `import.meta.env.DEV && ?edit=1`.
7. **Thêm vào GĐ1: lớp phủ concept.** Chọn ảnh trong `design/` hoặc kéo thả ảnh vào, chỉnh độ mờ, dời, zoom, khoá. Lưu cấu hình theo khu trong localStorage. Kèm khoá hoặc ẩn từng kit.
8. **Test E2E dùng Playwright** (như `tools/area_kits_test.mjs`). Server test phải nạp `vite.config.js` (có plugin), không phải kiểu `area_tool_vite.mjs` bỏ config. Test thêm: hai tab cùng sửa, lỗi ghi (bake lỗi thì khôi phục).
9. **Ghi chú GĐ2:** va chạm lấy từ `bake.colRows` (`tools/area_bake.mjs:192`), không phải `area.col`.

## 6. Ngoài phạm vi / rủi ro
- Hai người cùng sửa một khu: đã chặn bằng hash. Công cụ không gộp tự động.
- Khu không có `pieces` (son-dao-v3, hau-son-v3): GĐ 1 vẫn cho thêm mảnh; mảng `pieces` được tạo ở cấp gốc của src.
- Bake HVQ 1280×1280 có thể mất 10–30 s. Trong lúc bake, nút Lưu bị khoá và hiện tiến trình.
