# HK-LAY4 — V1 cổng nguyệt, trúc, tường đỏ khớp concept C (R2)

goal: Khung V1 (Tây lộ – cổng nguyệt, view 1,16) đọc giống concept C/V1: cổng nguyệt trong tường đỏ liền, lòng cổng là lối đá nhỏ giữa rừng trúc dày, nền sân không mảng chữ nhật.

## context
- Concept: D:\SkillFX_TuThienChi_HoaLien\design\tienson\hvq-scene\C\V1.png (+ the.md, tools/build.py). Thẻ 18: design/tienson/18-the-canh-hvq.md.
- Hiện trạng: records/HK-SHOT3/cmp-V1.png, diff-V1.png (ô lệch nhất (2,1)=38, (2,0)=34, (2,2)=29: vùng cổng/trúc). Sau HK-LAY3 (bậc đã sửa): records/HK-LAY3/cmp-V1.png.
- Dữ liệu: public/assets/areas/huyen-van-quan-v2/area.json (pieces), kit C-B3 (cwall_h_*, cổng nguyệt), C-P (bamboo_a/b/edge, garden_path_64). Quy cách: .agents/briefs/HK-kit-spec.md.

## Lỗi cần sửa
1. Lòng cổng nguyệt: game lát đá vuông + lối thẳng đi lên; concept: lối đá nhỏ hẹp cong giữa trúc dày, đá rêu, lá. Phía sau cổng (bên trong) phải đầy trúc tối, cổng là khung nhìn vào rừng trúc.
2. Trúc: game thưa, vài cụm nhỏ; concept: rừng trúc dày phủ toàn bộ phía trên-trái cổng tới mép khung (≈ 1/3 khung V1), có lớp roof che Đạo Sĩ.
3. Tường đỏ hai bên cổng: game cắt vuông cụt, ngắn; concept: tường đỏ chân đá liền từ mép trái khung tới chân tường chắn/lan can, mái ngói chạy trên đỉnh tường cổng. Đầu tường bo bằng trụ/đầu tường, không cắt cụt.
4. Mảng chữ nhật lệch sắc trên nền sân (cạnh cổng, góc trái dưới, góc phải dưới V1) → nền liền vân.
5. Concept có mái đình nhỏ ở mép dưới giữa V1 và mái + cửa đỏ ở mép trên — nếu sơ đồ khối có công trình ở đó thì đặt mảnh tương ứng; nếu không, ghi lý do, không tự thêm.

## write_scope
public/assets/areas/huyen-van-quan-v2/, public/assets/kits/C-B3/, public/assets/kits/C-P/, tools/areas/huyen-van-quan-v2.src.json, records/HK-LAY4/

## do_not
- Không sửa src/, kit C-R1, mảnh bậc / `steps` (HK-LAY3 vừa làm). Không chặn lối đi qua cổng nguyệt (blockout_reach phải ĐẠT).
- Không thêm màu ngoài bảng màu kit.

## done_when
- records/HK-LAY4/{cmp-V1.png,cmp-V2.png} (concept | game, như records/HK-SHOT3/cmds.txt), tự xem tối đa 3 vòng.
- Kit verify PASS; area_layers_test, blockout_reach, test đi bậc (tools/, do HK-STEPFIX thêm) ĐẠT; 0 lỗi console.
- report: diff ô 40×45 V1 trước/sau (trước HK-LAY3: TB 9.1), các ô (2,0)(2,1)(2,2).
