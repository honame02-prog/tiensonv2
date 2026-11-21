# HK-LAY2 — Lắp vòng 2 khu huyen-van-quan-v2 (tiếp tục từ HK-LAY đã gộp, 190f526)

Đọc: .agents/briefs/HK-LAY.md (mục tiêu, lệnh kiểm), docs/assetgen/KIT.md, D:/SkillFX_TuThienChi_HoaLien/.codex-worktrees/tiensonv2-areas-v2/records/HK-LAY/compare.png (trái concept C, phải game vòng 1).

## Lỗi Opus thấy ở vòng 1 → việc
1. Nền có MẢNG CHỮ NHẬT lệch vân/sắc (rõ ở V1 dưới cổng nguyệt và quanh bậc, x≈1340–1520 y≈455–470 trong compare ×2): tìm nguồn (chỗ bóc nền dưới mảnh, slab_worn, đường biên vùng chất liệu) và xoá; sân phải liền một texture.
2. Mảng mòn sáng (slab_worn_128) loang thành vệt mây sáng rải đều → chỉ đặt ngay trước chân bậc và cửa, ít hơn, không chồng.
3. Mép trái V1 có dải tường dọc lạc chỗ (x≈2–20 px ở 1×): bỏ, hoặc nếu là tường biên khu thì phải là cwall_v đúng kiểu và không kẹp đôi.
4. Bộ C-B3 vừa sửa cwall_h (hết răng cưa) — chép lại bản mới từ D:\SkillFX_TuThienChi_HoaLien\design\tienson\assets-v2\C-B3\kit\; trụ cwall_post ở mỗi mối nối tường ngang.
5. Bộ mới C-P (D:\SkillFX_TuThienChi_HoaLien\design\tienson\assets-v2\C-P\kit\): vườn trúc Tây lộ (x 2–6.5, y 16.5–21) và Đông lộ tương ứng như V1 concept (trúc dày phía sau cổng nguyệt, lối đá garden_path qua lòng cổng); ding_big thay đỉnh nhỏ tại (19, 18); paper_burner tại (24, 18.4). Va chạm hợp lý.
6. Chụp lại V1/V2 cùng toạ độ Đạo Sĩ → records/HK-LAY2/compare.png [concept C | game] ×2. Tự xem tối đa 3 vòng: "cùng một cảnh với concept C?".

## write_scope
tools/areas/huyen-van-quan-v2.src.json, public/assets/areas/huyen-van-quan-v2/, public/assets/kits/, tools/area_materials.json, records/HK-LAY2/

## done_when
verify.mjs (chép từ D:/SkillFX_TuThienChi_HoaLien/.codex-worktrees/tiensonv2-areas-v2/records/HK-LAY/ sang records/HK-LAY2/; records/ bị gitignore nên worktree không có) (cả --walk, --custom) + node tools/blockout_reach.mjs TAT CA DAT; area_layers_test PASS; 0 lỗi console; compare.png đủ V1/V2; báo cáo nêu từng lỗi 1–5 đã xử lý thế nào.

## do_not
Không sửa src/ engine; không sửa PNG mảnh; không đổi khu khác; không nới test.
