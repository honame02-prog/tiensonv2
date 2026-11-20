# NOTES-AREA — nhiều khu vực (20/11)

Thiết kế: `../design/tienson/10-khu-vuc.md`. Cảnh dùng chung: `src/AreaScene.js` (key `'sect'`, thay `SectScene`). Vào khu bằng `?area=<id>` (mặc định `huyen-van-quan`), thử vị trí `?x=&y=&face=`.

## Định dạng `public/assets/areas/<id>/area.json`
- `id, name, sub` (tên + dòng phụ hiện 4.5 s khi vào), `ground` (PNG nền, đường dẫn từ gốc public), `backdrop` (`"sect"` = biển mây/núi xa như cũ, `"none"`), `bg` (màu nền camera), `width, height`.
- `spawns`: `{ default:[x,y,dir], <tên>:[x,y,dir] }`. `portals`: `[{id, rect:[x,y,w,h], to:{area,spawn}, label}]` — chạm vùng (toạ độ chân) là chuyển; lại gần ≤ 56 px hiện nhãn `→ label`. Sau khi vào khu, phải bước ra khỏi mọi cổng thì cổng mới hoạt động (không nhảy qua lại).
- `features`: `pond {cx,cy,rx,ry}` (+ `koi` số cá), `smoke:true` (cần prop `burner`), `mist:[[x,y,w,h,alpha]]`. Thiếu khoá thì cảnh không dựng phần đó.
- `exits`: `[{rect,title,text,to:{x,y,face}}]` — vùng "chờ" (toast + dịch chuyển trong khu, như đường xuống núi cũ). `texts`: `{ <key prop>: {prompt, lines:[{who,text}], after?} }` — prop có `texts` (stele*, burner, hall, gate) tương tác được.
- Dữ liệu meta cũ: `col` (lưới 32 px, 1 = chặn), `stairs`, `walls`, `objs` (decal), `props` (`{key,x,y}`, chân chặn theo bảng `FOOT` trong AreaScene), `cliffBottom` (chỉ khu có `backdrop:"sect"`).
- Chuyển khu: fade đen 250 ms → `scene.restart({area,spawn,fromPortal})` → fade vào. Ngày/đêm giữ qua khu (`registry.night`). UI DOM chỉ tạo 1 lần (`registry.ui`). Khi rời khu, texture `ground:<id>` + json khu bị gỡ khỏi cache.
- Huyền Vân Quan = `huyen-van-quan` (ảnh vẫn `assets/sect/ground_bake.png`; bọc từ `testmap_meta.json` bằng `tools/area_wrap_hvq.mjs`). Cổng ở chân cầu thang (`rect [462,944,68,14]`) → `son-dao`/`north`; Sơn Đạo → `huyen-van-quan`/`gate` (dưới mái sơn môn, quay lên).

## Bake (Node thuần, không cài gói)
```
node tools/area_bake.mjs tools/areas/<id>.src.json     # -> public/assets/areas/<id>/ground.png + area.json (~9 s cho 640x800)
```
Cùng nguồn + seed → cùng byte (md5 in ra). `src.json` = `{ materials, area:{…trường area.json trừ col/objs/props/ground/width/height…}, bake:{ width,height,seed, paths, regions, blocks, props, scatter } }`.
- `paths`: nét đường Catmull-Rom `{pts:[[x,y]…], width:[…]}` (độ rộng theo điểm). `regions` (theo thứ tự lớp, cái đầu phải `fill`): `{material, fill|path(+width|widthMul)|poly(+smooth), dither(px, mép nhiễu), wobble(px, mép lượn), rim:{px,shadow,dark}}` — `rim` = viền tối 1 px + bóng dưới mép.
- `blocks`: đa giác chặn → ô lưới 32 px (≥5/9 điểm mẫu trong đa giác). `props`/`objs`: đặt tay. `scatter`: `{keys, kind:"decal"?, count, on:[chất liệu], avoidPaths:[{path,dist}], keepClear:[[x,y,r]], minDist, seed}` rải theo chất liệu thực tế đã vẽ.
- Chất liệu: `tools/area_materials.json` (mẫu cắt từ `ground_bake.png`: `grass, cobble, slab`; `forest` = cỏ tối hơn; `dirt` = `recolor` — độ sáng của cỏ ánh xạ lên bảng màu lấy từ mảng đất thật x246–306,y978–1023). Lát gương + trộn 2 lớp lệch để giấu đường nối.

## Thêm khu mới
1. Viết `tools/areas/<id>.src.json` (copy `son-dao.src.json`), đặt `spawns`, `portals` (cả hai phía), `texts`.
2. `node tools/area_bake.mjs tools/areas/<id>.src.json`.
3. Thêm cổng tương ứng trong `area.json` của khu nối (HVQ: sửa `tools/area_wrap_hvq.mjs` rồi chạy lại, hoặc sửa trực tiếp).
4. Kiểm: `?area=<id>`, `node tools/area_test.mjs` (sau `npm run build`), cập nhật test nếu thêm khu.
Cần tài nguyên mới (nội thất, trúc, nước chảy, NPC…) thì hỏi phong cách trước, không tự vẽ.

## Công cụ / test
`tools/png.mjs` (PNG decode/encode), `tools/area_shot.mjs <tiền tố>` + `tools/png_diff.mjs A B` (chụp 8 điểm HVQ với phần động bị ẩn, so điểm ảnh), `tools/area_test.mjs` (qua–về 3 lần, rò rỉ, console, nhãn cổng, FPS, va chạm, ảnh `shots/area_*.png`).

## Giới hạn đã biết
- Lát gương lộ đối xứng (hoa văn kính vạn hoa) trên mảng cỏ rừng lớn nhìn từ xa; cận cảnh khó thấy. Đất nâu phẳng hơn đất thật (ánh xạ từ cỏ).
- Va chạm theo lưới 32 px nên mép chặn lệch tới ±16 px so với đa giác nguồn. Cây chỉ chặn gốc (26×10), tán không chặn.
- `exits` "Đường xuống núi" (đầu tây bãi hạ) của HVQ vẫn là chỗ chờ (toast + dịch chuyển). Hộp thoại cổng sơn môn không còn tự động chuyển cảnh "Hạ sơn" (đã có cổng thật ở chân cầu thang).
- Cổng đặt ở chân cầu thang (không ở dưới mái sơn môn) để cầu thang vẫn đi bộ được và điểm spawn `gate` không đè lên cổng.
