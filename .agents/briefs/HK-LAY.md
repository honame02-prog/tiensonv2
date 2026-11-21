# HK-LAY — Lắp bộ mảnh C-R1 + C-B3 vào khu huyen-van-quan-v2, chụp V1/V2 có Đạo Sĩ

## goal
Khu huyen-van-quan-v2 trong game, ở khung V1 và V2, trông như cảnh concept C đã được người dùng duyệt — vẽ bằng bộ mảnh thật qua engine kits/pieces (docs/assetgen/KIT.md), không phải ảnh dán.

## context
- Engine kits/pieces + tools/scene_shot.mjs: xem docs/assetgen/KIT.md (vừa gộp từ HK-ENG).
- Bộ mảnh: D:\SkillFX_TuThienChi_HoaLien\design\tienson\assets-v2\C-R1\kit\ và ...\C-B3\kit\ (kit.json + PNG, đã verify). Chép vào public/assets/kits/C-R1/, public/assets/kits/C-B3/ (không sửa PNG).
- Đích thẩm mỹ: D:\SkillFX_TuThienChi_HoaLien\design\tienson\hvq-scene\C\V1.png, V2.png (480×270) và preview.png của hai bộ (cách mảnh ghép thành cảnh). Thẻ: D:\SkillFX_TuThienChi_HoaLien\design\tienson\18-the-canh-hvq.md.
- Sơ đồ: D:\SkillFX_TuThienChi_HoaLien\design\tienson\15-so-do-khoi.md mục 1 (+ bổ sung 1.3: tường viện NGANG y ≈ 22.8 ở x 1–7 và x 33–39, mỗi đoạn 1 cổng nguyệt quay về camera; tường viện dọc x = 7 và x = 33 cấp 2–3 với khoảng hở cổng y ≈ 19.6 và y ≈ 31). Mép đài theo tierRows + steps trong area.json.

## việc
1. Nền: sân cấp 2 và 3 dùng texture `C-R1/slab_256` (+ `slab_worn_128` trước bậc); cấp khác giữ chất liệu cũ.
2. Mép đài cấp 3→2 (Nam): tường chắn rwall_2/4/6 + đầu rwall_end_L/R; mép Bắc–Nam: redge_v; lan can balus trên mép, trụ balus_post ở mối nối; bậc stair_3x2 + stair_cheek tại các steps hiện có (ít nhất 2 bậc lên cấp 3). Làm cho TOÀN dải y ≈ 23 (mép cấp 3), không chỉ trong khung.
3. Tường viện: cwall_v dọc x = 7 và x = 33 (cấp 2–3), gate_v tại khe cổng; cwall_h + moongate_h đoạn ngang y ≈ 22.8 hai bên; corner_hv ở góc; cwall_post che mối nối.
4. Va chạm: nhân vật không đi xuyên tường, đi qua được cổng nguyệt và khe cổng dọc và bậc. blockout_walk / reach vẫn TAT CA DAT (cập nhật điểm đi nếu tường mới chặn lối cũ hợp lệ — nêu rõ).
5. Chụp: scene_shot V1 = (1;16), V2 = (12.5;15.2), Đạo Sĩ ở cùng toạ độ như concept C (đọc C/the.md, C/tools) → records/HK-LAY/shots/V1.png, V2.png (+×2). Ảnh so: compare.png = [concept C | game] cho V1 và V2 ở ×2.
6. Tự xem compare.png tối đa 3 vòng: "game có trông như concept C, cùng một cảnh không?" — sửa vị trí/lựa mảnh, không sửa PNG mảnh.

## write_scope
tools/areas/huyen-van-quan-v2.src.json, public/assets/areas/huyen-van-quan-v2/, public/assets/kits/, tools/area_materials.json, tools/blockout_* (chỉ điểm đi nếu cần), records/HK-LAY/

## done_when
- area_layers_test PASS; blockout_walk + reach TAT CA DAT; 0 lỗi console khi vào khu.
- compare.png có đủ V1/V2; báo cáo nêu số pieces đã đặt, lối đi đã kiểm (qua cổng nguyệt, khe cổng dọc, bậc).

## do_not
Không sửa src/ engine (nếu thiếu tính năng, ghi rõ trong báo cáo); không sửa PNG mảnh; không đổi khu khác.
