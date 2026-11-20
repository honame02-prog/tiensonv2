# Tiên Sơn v2: ghép FxPlayer vào bản đầy đủ (2026-11-20)

Nguồn game: `game_tien-son-proto` (Phaser 4.2.1 + Vite 6, cảnh `SectScene`). Nguồn FX: repo `tienson/` commit a587e30.

## Thay đổi (theo commit)
1. Nhập nguyên bản (không node_modules/dist).
2. Mã chết vào `archive/`: `src/GameScene.js`, `TouchControls.js`, `main_v3_backup.js`, `worldtest.js`, `worldtest7.js`, `worldtest.html`, `worldtest7.html`, `tools/worldtest_shot.mjs` (grep: không còn import từ main.js/SectScene.js). `src/dialogs.js` giờ cũng không ai import (chỉ GameScene dùng) nhưng chưa chuyển, chờ chủ dự án xác nhận.
3. Chép `src/fx/**`, `tools/gpl_to_json.mjs`, `fx_test.mjs`, `fps_test.mjs`, `art/palette/tienson-fx.gpl`; playwright là devDependency.
4. Ghép vào SectScene: `FxPlayer.preload` trong preload, `this.fx = new FxPlayer(this, {maxParticles:300})` cuối create. `?fx=1` mới gọi `src/fx/fxdemo.js` (phím 1/2/3, 4, R, HUD DOM). Không cờ: không có phím, không HUD; chỉ khác là FxPlayer sinh vài texture `fx_*` và nghe sự kiện update (rỗng khi không có cue). `FxTestScene` KHÔNG mang sang (không cần).

## Độ sâu (SectScene)
| Lớp FX | depth | Lý do |
|---|---|---|
| ground (decal, ring) | -60 | trên bóng (-70) và decal sàn (-80), dưới actor (= y) |
| body (column, emitter, anim) | y + 0.5 (hạt +0.6) | xếp cùng nhân vật |
| light (mọi track `light`, trừ layer `overlay`) | 9100, ADD | trên lớp đêm MULTIPLY (9000) và đèn lồng (9001) nên ban đêm ánh sáng sàn phát sáng thật; ban ngày vẫn là ánh sáng cộng. Hệ quả: ánh sáng sàn cũng phủ lên Đạo Sĩ |
| overlay (flash) | 9500 | trên lớp đêm, sương (8600-8901); UI của game là DOM `#ui` z-index 10 nên luôn trên canvas |
Cấu hình được: `new FxPlayer(scene, { depths: { ground, light, overlay, dimBelow } })`.

Chọn cách đơn giản (light cố định 9100) thay vì đổi theo ngày/đêm. Nếu muốn ánh sáng ngày nằm dưới actor, đổi depth theo `scene.nightK`: chưa làm.
Lưu ý: column và emitter (body) vẫn bị lớp đêm nhân tối ban đêm (thấy ở ảnh đêm: cột lửa hơi tối hơn lõi sáng của light). Muốn emitter ADD cũng sáng ban đêm thì đưa `blend:"add"` emitter lên 9100: chưa làm.

## Texture key
Mọi key của FX có tiền tố `fx_` (fx_light, fx_light128, fx_ring*, fx_decal, fx_col_*, fx_px1/px2, fx_spark). SectScene dùng `ground, smeta, sspr, sect, decals, peaks, cloudBack, mistA, mistB, hero, shadow, nightmask`. Không trùng, không phải đổi tên.

## dim
Đối tượng bị tối: mọi game object có `setTint`, `visible`, `scrollFactorX != 0`, `depth < 8600`, `tintMode = MULTIPLY`, không phải FX. Loại: trời nền/sương màn hình (scrollFactor 0), sương thế giới (8600), lớp đêm (9000), đèn lồng (9001), overlay. Lưu 4 góc tint gốc từng đối tượng lúc bắt đầu dim; dim nhân vào tint gốc; trả lại đúng giá trị lưu. (Bản cũ dùng clearTint nên mất tint riêng.) Đối tượng sinh ra giữa lúc dim không bị dim. Emitter/Graphics (không có setTint) không bị dim.

## Số đo (swiftshader, không GPU, tham khảo; `node tools/fx_test.mjs http://localhost:8090/`, đã làm nóng trước khi đo; actualFps 5 mẫu cách 1 s; "phát" = lặp cả 3 cue mỗi 2 s)
| Điều kiện | Nền | Phát |
|---|---|---|
| Desktop 960x540, NGÀY | 56,56,56,57,57 | 55,55,53,54,53 |
| Desktop, ĐÊM | 53,52,52,51,51 | 48,47,47,47,46 |
| Mobile 844x390 dpr3, CPU 4x, NGÀY | 31,31,32,32,32 | 31,31,31,30,30 |
| Mobile CPU 4x, ĐÊM | 28,27,26,26,26 | 23,24,23,24,24 |
Chênh trung bình: desktop ngày -3,0; desktop đêm -4,6 (sát ngưỡng 5); mobile ngày -1,2; mobile đêm -2,6. Đỉnh: 64-79 hạt, 20-21 đối tượng, 3 cue đồng thời. Lỗi console: 0 ở cả hai. Sau khi dừng 5 s: active 0, hạt 0, objects 0, dimV 255, không kẹt hitstop, chữ ký tint của mọi đối tượng game giống hệt trước (đã gán tint riêng 4 góc khác nhau lên 1 prop để kiểm). Lúc dim ultimate: Đạo Sĩ 0x707070, lớp đêm/sương/sương màn hình giữ 0xffffff, prop có tint riêng 0xffd0a0->0x705b46 (nhân đúng).
Số đầu tiên của lần chạy đầu (chưa làm nóng) thấp hơn nhiều (ngày desktop 54 -> 34) vì JIT/sinh texture: lần phát đầu có giật nhẹ, tương tự bản cũ.
Build: bản gốc 1,718.96 kB (gzip 393.65 kB), sau ghép 1,736.53 kB (gzip 400.36 kB), ~10 s.

## Giới hạn / việc chưa làm
- Chưa đo trên máy thật, chưa thử chạm (mobile chỉ Playwright giả lập, FX bật bằng phím nên trên điện thoại chưa có cách phát; `?fx=1` chưa có nút cảm ứng).
- Chưa tích hợp vào gameplay: chỉ cue mẫu qua phím.
- Ánh sáng sàn (9100) phủ cả lên Đạo Sĩ; cột/hạt body bị lớp đêm làm tối.
- `dim` lọc theo depth < 8600: nếu sau này thêm đối tượng thế giới có depth >= 8600 (như gateRoof 8000 thì vẫn bị dim) thì phải chỉnh `dimBelow`.
- Chuẩn hóa xuống dòng: repo mới `core.autocrlf=false`, file nguồn gốc CRLF giữ nguyên.
- Ảnh: `shots/v2_ngay_hoa.png`, `v2_dem_hoa.png`, `v2_dem_kim.png`, `v2_strip.png` (thư mục shots bị .gitignore). JSON số đo: `shots/v2_fx_test.json`.
