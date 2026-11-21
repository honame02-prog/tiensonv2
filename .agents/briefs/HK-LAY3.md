# HK-LAY3 — Bậc thềm HVQ v2 khớp concept C (R2)

goal: Mọi bậc trong khu huyen-van-quan-v2 đọc ra đúng bậc đá như concept C đã duyệt: đủ mảnh, má bậc thẳng, lan can có trụ, nối liền tường chắn và nền đá, không còn nền blockout trần quanh bậc.

## context
- Concept duyệt: D:\SkillFX_TuThienChi_HoaLien\design\tienson\hvq-scene\C\ (V1.png, V2.png, the.md, tools/build.py). Thẻ: D:\SkillFX_TuThienChi_HoaLien\design\tienson\18-the-canh-hvq.md dòng 15 ("bậc cùng chất đá tường chắn, đủ rộng 1 bước Đạo Sĩ, có má bậc + lan can").
- Ảnh hiện trạng + so sánh: records/HK-SHOT3/ (cmp-V1.png, cmp-V2.png, steps-grid.png, diff-V*.png, shots/, walk.mjs, cmds.txt). Khung V1 view (1,16), V2 view (12.5,15.2).
- Dữ liệu bậc: public/assets/areas/huyen-van-quan-v2/area.json:78-86 (`steps` 8 mục), mảnh đặt :90-104 (C-R1/stair_3x2, stair_cheek_L/R). Kit: public/assets/kits/C-R1/kit.json:168-202. Quy cách kit: .agents/briefs/HK-kit-spec.md, docs/assetgen/KIT.md.
- Thứ tự sơ đồ khối: D:\SkillFX_TuThienChi_HoaLien\design\tienson\15-so-do-khoi.md:41-71.

## Lỗi cần sửa (từ ảnh so concept)
1. bac-vao [576,1504,128,96] 0→1: KHÔNG có mảnh nào (blockout trần, chữ "BẬC ĐÁ"). Đặt bậc đá rộng (bậc vào chính) + má 2 bên.
2. bac-t3t (V1) và bac-t3d: má trái hiện là một dải bậc chéo vỡ cạnh tường chắn → bỏ; má bậc là khối đá thẳng đứng đối xứng hai bên, đỉnh má có trụ lan can. Concept: ~7 bậc, rộng ~85 px, lan can đá thấp nối liền lan can trên tường chắn. Game: đáy bậc thấp hơn đỉnh tường chắn 10–15 px → khớp lại.
3. V2 bậc phụ trái/phải: mất má bậc ngoài; trụ lan can nghiêng/gom lệch (x≈560–570 cmp-V2) → trụ dọc, cách đều như concept.
4. bac-t2 và bac-t4t/bac-t4d: sàn trên bậc là nền blockout trần (be/xanh, vàng/cam) → phủ nền đá cùng chất (bộ sàn đã có) tối thiểu 3 ô quanh đầu và chân mỗi bậc; nối mép bậc với tường chắn hai bên.
5. moon-128, moon-1152 (bậc qua cổng nguyệt 2→3): không có mảnh → 2–3 bậc thấp trong lòng cổng, đọc được là bậc, không che lòng cổng.
6. Tường chắn dưới lan can quanh các bậc tầng 2→3 (V1 từ cổng nguyệt tới bac-t3t): hiện đen đặc thành khối → đá xếp có vân, sắc độ như tường chắn trong concept (sáng hơn nền 1 bậc tối, có mạch).
7. Trụ/tường dọc lạc ngay dưới bac-t3t (V1 game x≈205 ở 1x, y 215–270; và y 0–60) → xoá nếu là mảnh bậc/tường thừa.

## write_scope
public/assets/areas/huyen-van-quan-v2/area.json, public/assets/areas/huyen-van-quan-v2/floor-kit.json, public/assets/areas/huyen-van-quan-v2/ground*.png, public/assets/kits/C-R1/, tools/areas/huyen-van-quan-v2.src.json, records/HK-LAY3/

## do_not
- KHÔNG sửa src/ (một worker đang sửa lỗi Đạo Sĩ không đi lên được bậc trong src/areaLayers.js / AreaScene.js). Không đổi `steps` rect/lo/hi trừ khi cần khớp hình; nếu đổi, ghi rõ trong report.
- Không đụng V1 phần cổng nguyệt/trúc/tường đỏ (để việc sau), trừ mục 5–7.
- Không đổi kit C-B3, C-P. Không thêm màu ngoài bảng màu kit.

## done_when
- Chụp lại bằng tools/scene_shot.mjs như records/HK-SHOT3/cmds.txt → records/HK-LAY3/{cmp-V1.png,cmp-V2.png,steps-grid.png} (concept | game) và tự xem tối đa 3 vòng.
- Kit verify PASS (lệnh trong HK-kit-spec.md), area_layers_test + blockout_reach như HK-LAY2, 0 lỗi console.
- report: bảng 8 bậc (mảnh đã đặt, đã khớp concept chưa), số đo diff ô 40×45 V1/V2 trước/sau (trước: V1 TB 9.1, V2 TB 5.7).
