# HK-ENG — Engine nạp bộ mảnh (kit) vào khu + công cụ chụp camera có Đạo Sĩ

## goal
AreaScene nạp được bộ mảnh theo quy cách kit.json và đặt mảnh theo danh sách trong dữ liệu khu (lớp ground/base/roof + va chạm), và có công cụ chụp khung 480×270 tại toạ độ ô bất kỳ có nhiều Đạo Sĩ đứng làm thước.

## context
- Quy cách kit (ĐỌC KỸ): D:\SkillFX_TuThienChi_HoaLien\.agents\briefs\HK-kit-spec.md (kit.json: pieces{file, layer ground|base|roof, anchor, footprint, collide, pair}).
- Khu: public/assets/areas/huyen-van-quan-v2/area.json sinh từ tools/areas/huyen-van-quan-v2.src.json bằng tools/area_bake.mjs; nền ground.png nướng (depth -100), chất liệu tools/area_materials.json. src/AreaScene.js: objs dòng ~75, props (base/roof y-sort, mái mờ khi che nhân vật) dòng ~76–; areaLayers.js depthOf(y, tier) = y + tier*0.01; tierRows; steps.
- Công cụ sẵn: tools/area_shot.mjs (đặt nhân vật ?area=&x=&y=&face=), tools/blockout_shot.mjs (camera qua window.__scene.cameras.main), tools/area_layers_test.mjs (test lớp), playwright + node_modules/vite có sẵn.
- Bộ mảnh thật (C-R1, C-B3) đang được làm song song, CHƯA có. Bạn tạo bộ mảnh GIẢ để test.

## việc
1. Dữ liệu: src.json khu được khai báo `kits: {"C-R1": "assets/kits/C-R1/kit.json", ...}` và `pieces: [{"k":"C-R1/rwall_4","x":<px>,"y":<px>}, ...]` (x,y = vị trí anchor trong khu, px). Bake chuyển sang area.json. Mảnh `ground` được nướng vào ground.png khi bake (hoặc vẽ ở depth -99 nếu đơn giản hơn — nêu lựa chọn); `base` y-sort như props (depthOf chân); `roof` dùng đúng cơ chế mái mờ hiện có; `collide` thành vật cản đi bộ. Chất liệu nền có thể là texture tuần hoàn từ kit (vd `C-R1/slab_256`) thay cho slab cũ theo vùng tầng — thêm vào area_materials.json kiểu "texture".
2. Bộ mảnh giả tests/fixtures/kits/FAKE/ (khối màu có chữ, đủ 3 lớp, có collide) + test trong area_layers_test (hoặc test mới) chứng minh: ground dưới nhân vật, base sắp đúng theo y với nhân vật trước/sau, roof trên nhân vật và mờ khi che, collide chặn đi bộ, lỗ cổng (collide chừa lối) đi qua được.
3. tools/scene_shot.mjs: `node tools/scene_shot.mjs --area huyen-van-quan-v2 --view <x0>,<y0> (ô, góc trên-trái) --actors "x,y;x,y;..." (ô, Đạo Sĩ thật đứng, mặt hướng Nam) --out <png>` → PNG 480×270 đúng 1× (không UI, không hiệu ứng động/ sương che), kèm bản ×2. Dùng cho khung V1 = (1;16) và V2 = (12.5;15.2) như concept.
4. Không lắp mảnh thật vào HVQ (việc sau khi bộ mảnh xong); KHÔNG đổi hình khu hiện tại khi chưa có pieces (khu không khai báo kits phải render y hệt trước, chứng minh bằng so ảnh/so SHA ground.png).

## write_scope
src/, tools/, tests/, public/assets/kits/ (chỉ fixture nếu cần), docs/ (ghi chú định dạng). Không sửa public/assets/areas/*/ trừ khi bake lại cho ra y hệt.

## done_when
- `node tools/area_layers_test.mjs` (và test mới nếu có) PASS, in số mục.
- `node tools/blockout_walk.mjs` và reach vẫn TAT CA DAT.
- scene_shot chạy ra 2 PNG cho V1, V2 khu hiện tại (lưu .agents/codex/HK-ENG/shots/), 480×270.
- docs/assetgen/KIT.md ≤ 150 dòng mô tả định dạng kits/pieces và lệnh chụp.

## do_not
Không sửa ngoài write_scope; không nới test cũ; không đổi hành vi khu khác; không thêm phụ thuộc npm mới.
