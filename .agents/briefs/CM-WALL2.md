# CM-WALL2 — Tường viện: CẮT từ concept C + HẬU KỲ (cùng công thức nguyệt môn đã duyệt)

Mức rủi ro: R2. Thời hạn: 25 phút.

## Mục tiêu (1 câu)
Làm lại toàn bộ mảnh tường viện đỏ nâu mái ngói xám rêu của khu HVQ v2 vào kit `CM-WALL` bằng CÔNG THỨC của `tools/sprites/CM-WALL/build.py` (nguyệt môn, người dùng đã DUYỆT 21/11), thay mọi mảnh `C-B3/*` còn dùng trong area.json, sao cho tường đồng chất với nguyệt môn.

## Bối cảnh (đã biết)
- Công thức chuẩn đã duyệt: `tools/sprites/CM-WALL/build.py` (cắt từ ảnh gốc độ phân giải cao → thu nhỏ theo ô → lượng tử bảng STYLE §5 + màu đo từ V1.png → tách nền alpha 0/255 → vẽ bù chỗ hỏng → tách lớp mái). Mở rộng script này (hoặc thêm module cạnh nó), KHÔNG đổi điểm ảnh phần giữa nguyệt môn đã duyệt.
- Nguồn: `.agents/refs/CM/` — `V1-original.png` 1672×941 (nguồn chính, tường đỏ trái/phải nguyệt môn), `V1-original-gate.png`, `V1.png` 480×270, `18-the-canh-hvq.md`. V2 gốc (nếu cần thêm mẫu tường): `D:/SkillFX_TuThienChi_HoaLien/design/tienson/hvq-scene/C/src/V2-original.png` (1672×941) — chép vào `.agents/refs/CM/` nếu dùng. Minh hoạ 1×/4×: `.agents/refs/S1/H-WALL/v1_redwall_left_*.png`.
- Mảnh C-B3 đang dùng trong `public/assets/areas/huyen-van-quan-v2/area.json`: `cwall_h_2` ×3, `cwall_post` ×14, `cwall_v` ×33, `gate_v` ×3 (đếm bằng grep `"k":"C-B3/`). Kit `C-B3` còn có `cwall_h_4`, `cwall_h_6`, `corner_hv_L/R` (chưa dùng nhưng phải có bản mới).
- Quy ước C-B3 (`public/assets/kits/C-B3/kit.json`): cwall_h_N anchor [0,70] footprint [32N,16] có pair roof; cwall_v anchor [0,32] footprint [16,32]; gate_v anchor [0,80] footprint [16,80]; cwall_post anchor [0,70] footprint [20,16]; corner_hv_L/R anchor [0,70] footprint [40,32]. Mảnh mới GIỮ NGUYÊN anchor/footprint/collide/pair của mảnh cùng tên để thay trực tiếp, không phải dời toạ độ trong area.json.
- Nguyệt môn `CM-WALL/moongate_h`: hai đoạn đầu 34×70 px hiện chép nguyên C-B3 (để nối). Được làm lại 2 đoạn đầu cho khớp tường mới; phần giữa (mái cong + vòng đá + tường quanh lỗ) giữ nguyên từng điểm ảnh — script verify phải chứng minh (so mask vùng giữa byte-identical với bản 3af2339).
- Quy cách kit: `docs/assetgen/KIT.md`, `validateKit` `src/areaKits.js:6-11`. Chụp cảnh: `tools/scene_shot.mjs` (`docs/assetgen/KIT.md:76-86`, mẫu `records/HK-SHOT3/cmds.txt`).
- Python + Pillow/numpy, Node 24. Không cài, không mạng.

## Việc làm
1. **Tường ngang `cwall_h_2/4/6` (+roof)**: cắt đoạn tường đỏ liền từ V1-original (trái và phải nguyệt môn), thu nhỏ đúng tỉ lệ nguyệt môn (cùng hệ số, cùng chiều cao đỉnh tường/chân tường như hai đầu nguyệt môn). Đoạn dài hơn mẫu thì ghép nhiều lát cắt, mối ghép giấu dưới trụ hoặc làm liền bằng vẽ bù — KHÔNG lặp y hệt nhìn ra (mỗi biến thể khác vết bong vữa/rêu). Hai đầu mỗi mảnh nối khít nhau và với nguyệt môn (đỉnh mái, mép ngói, chân tường cùng hàng y).
2. **Trụ `cwall_post`**: cắt từ trụ/đầu tường trong concept nếu có; nếu không, dựng từ chính chất liệu tường + ngói đã cắt (vẽ bù), thanh, ≤ 1,3× độ dày tường (bài học B3c: trụ to như tháp canh bị chê).
3. **Tường dọc `cwall_v`, cổng dọc `gate_v`, góc `corner_hv_L/R`**: góc nhìn 3/4 thấy đỉnh mái ngói chạy dọc + mép tường đỏ. Lấy đúng ngói/đỉnh tường/màu đỏ đã cắt ở bước 1, dựng theo hướng dọc (vẽ bù có kiểm soát), lát dọc liền khi xếp chồng 33 mảnh (không thấy mối nối theo nhịp 32 px). gate_v là khoảng hở có hai đầu tường bịt gọn.
4. **Nguyệt môn**: làm lại 2 đoạn đầu 34×70 cho khớp cwall_h mới; giữ nguyên phần giữa (verify byte-identical).
5. **Kit + lắp**: thêm các mảnh vào `public/assets/kits/CM-WALL/kit.json`; trong area.json đổi MỌI `C-B3/<tên>` sang `CM-WALL/<tên>` (giữ toạ độ). Không còn tham chiếu C-B3 nào trong area.json HVQ v2.

## Kiểm (done_when — tự chạy, dán log)
- `python -X utf8 tools/sprites/CM-WALL/build.py --verify` PASS: mọi mảnh đúng kích thước/anchor so C-B3, alpha 0/255, bảng màu, lớp base+roof ghép = ảnh hợp nhất, mép nối cwall_h–cwall_h và cwall_h–moongate khớp (đo cột mép: chênh màu trung bình nhỏ, đỉnh mái cùng y), cwall_v xếp chồng 3 mảnh liền (đo hàng mép), phần giữa nguyệt môn byte-identical 3af2339.
- `--repro` 2 lần cùng SHA256.
- `node tools/area_kits_test.mjs`, `node tools/area_steps_walk_test.mjs`, `node tools/blockout_reach.mjs` và test lớp hiện có: PASS.
- `grep -c '"k":"C-B3/' public/assets/areas/huyen-van-quan-v2/area.json` = 0.
- Ảnh `records/CM-WALL2/compare.png`: hàng 1 = concept V1 | game cùng khung (`--view 0,17.78125`, có Đạo Sĩ) ; hàng 2 = game 2 khung khác có tường dọc + trụ + gate_v (chọn khung từ toạ độ area.json, ghi lệnh vào `records/CM-WALL2/cmds.txt`) trước (C-B3, chụp ở base 3af2339) | sau ; hàng 3 = sheet 4× mọi mảnh mới trên #2a2e2a. `records/CM-WALL2/report.md`.
- Tự xem compare.png (tối đa 3 vòng) và trả lời mỗi câu 1 dòng có chứng cứ: (a) tường có đồng chất với nguyệt môn; (b) có thấy lặp/mối nối không; (c) tường dọc đọc ra là tường có mái trong góc 3/4 không; (d) trụ có quá to không.

## Không được
- Không vẽ lại thủ tục từ đầu (cách S1 bị chê). Điểm ảnh bắt nguồn từ concept; chỉ vẽ bù chỗ thiếu/hỏng và dựng hướng dọc từ chất liệu đã cắt.
- Không đổi phần giữa nguyệt môn đã duyệt. Không sửa `C-B3`, `H-*`, `src/**`, test. Không dời toạ độ trong area.json.
- Write scope: `tools/sprites/CM-WALL/`, `public/assets/kits/CM-WALL/`, `records/CM-WALL2/`, `.agents/refs/CM/` (chỉ thêm V2-original nếu dùng), `public/assets/areas/huyen-van-quan-v2/area.json` (chỉ đổi tên kit).
- Không dùng chữ "đạt" về thẩm mỹ trong báo cáo.

## Bài học liên quan
- Cắt ô 32 px từ imagegen không nối khít → mối nối giấu dưới trụ / mặt cắt gọn, hoặc vẽ bù cho liền.
- Trụ to/dày như tháp canh, tường dọc mảnh đã bị chê (B3c).
- Số đo chỉ là điều kiện cần; hình giống concept là mục tiêu. Chấm đặt cạnh concept cùng khung.
