# CM-GATE — Nguyệt môn: CẮT từ concept C + HẬU KỲ hoàn chỉnh

Mức rủi ro: R2 (đổi hình người chơi thấy, chỉ 1 mảnh). Thời hạn: 18 phút.

## Mục tiêu (1 câu)
Tạo mảnh nguyệt môn tường ngang `CM-WALL/moongate_h` (+ `moongate_h_roof`) bằng cách CẮT ĐÚNG vùng nguyệt môn trong ảnh concept C đã được người dùng duyệt, rồi xử lý hậu kỳ để thành sprite game sạch, hoàn chỉnh, thay cho `C-B3/moongate_h` trong khu HVQ v2.

## Bối cảnh (đã biết — không cần khám phá lại)
- Người dùng chê toàn bộ cách VẼ LẠI sprite (đợt S1: H-WALL/H-TERR/…) và yêu cầu quay lại CẮT ẢNH concept, nhưng hậu kỳ phải kỹ. Hình phải GIỐNG concept tới mức nhìn là nhận ra, không "diễn giải lại".
- Nguồn (đã chép vào repo): `.agents/refs/CM/`
  - `V1-original.png` 1672×941 — ảnh imagegen gốc độ phân giải cao (gấp ~3,483× khung game 480×270). NGUỒN CHÍNH để cắt.
  - `V1-original-gate.png`, `V1-generated-with-people.png` 1672×941 — biến thể (một bản có Đạo Sĩ). Tự so, chọn bản KHÔNG có người đứng che nguyệt môn; nếu bản tốt nhất có người che thì phải xoá người và vẽ bù (vòng đá, chân tường, nền).
  - `V1.png` 480×270 (bản đã lượng tử, camera game), `V1x2.png` 960×540. Dùng để biết vị trí/tỉ lệ ở 1×.
  - `18-the-canh-hvq.md`: thẻ cảnh. Nguyệt môn tường ngang: lỗ tròn ~108 px ở 1× (≈1,9× Đạo Sĩ cao 57 px), viền đá ~4 px, tường đỏ nâu, mái xám rêu có ngói.
  - Ảnh minh hoạ đã cắt sẵn ở 1×/4×: `.agents/refs/S1/H-WALL/v1_moongate_1x.png` (170×168), `v1_moongate_4x.png`.
- Mảnh đang dùng trong game: `public/assets/kits/C-B3/moongate_h.png` 192×146 + `moongate_h_roof.png`, `kit.json` dòng ~149-185 (anchor [8,145], footprint [176,16], collide 2 khối hai bên lỗ, pair roof, lỗ trong suốt thật). Mảnh MỚI giữ cùng quy ước (anchor/footprint/collide/pair) để thay thế trực tiếp; nếu kích thước đổi thì tính lại anchor/collide cho đúng chân tường và lỗ đi qua được.
- Đặt trong khu: `public/assets/areas/huyen-van-quan-v2/area.json` dòng 136 và 138 (`C-B3/moongate_h` tại x 46 và 1074, y 730), hai bên là `C-B3/cwall_h_2`.
- Quy cách kit: `docs/assetgen/KIT.md`, `validateKit` ở `src/areaKits.js:6-11`. Bảng màu: `docs/assetgen/STYLE.md` §5 (viền #0e0c08–#24241f, đá #4b4e4b–#95938c, ngói #131110–#74726e…). Công thức TT2 đã được duyệt: STYLE.md §10 (imagegen → median theo ô → bảng hall → làm sạch).
- Chụp cảnh: `tools/scene_shot.mjs` (xem `docs/assetgen/KIT.md:76-86`, mẫu `records/HK-SHOT3/cmds.txt` dòng 7-8, khung moon: `--view 0,17.78125`).
- Python + Pillow/numpy dùng được (đã dùng ở tools/sprites/*). Không cài thêm gì, không mạng.

## Việc làm (đường ống hậu kỳ — viết thành script tái lập)
Script `tools/sprites/CM-WALL/build.py` với `--verify` và `--repro`:
1. **Định vị và cắt**: tìm vùng nguyệt môn trên `V1-original.png` khớp vị trí trong `V1.png` (ghi toạ độ cắt nguồn vào kit.json `source`). Cắt rộng đủ: mái + toàn vòng tròn + đoạn tường đỏ hai bên tới điểm nối với `cwall_h_2` + chân tường.
2. **Thu nhỏ về 1×** (hệ số ≈ 1/3,483, cho khớp kích thước 1× trong `V1.png`): không dùng nội suy làm nhoè; dùng median/mode theo ô hoặc thu nhỏ có chọn màu đại diện, rồi lượng tử về bảng STYLE §5 + màu đo từ `V1.png` vùng tương ứng (đỏ nâu tường, rêu). Kết quả phải đọc như pixel art sạch: không nhiễu lấm tấm, không dải gradient trơn.
3. **Tách nền (alpha)**: xoá hết trúc/cây/trời phía sau mái và hai bên. Mép mái/ngói/đỉnh tường cắt theo đường bao thật của vật thể, alpha 0/255 (không bán phần), không để quầng màu nền.
4. **Lỗ cổng tròn**: phần trong vòng tròn TRONG SUỐT thật (người chơi đi qua thấy nền game). Vòng đá viền là một ellipse liền, nét đều, không răng cưa lệch, không đứt; mép dưới vòng nằm sát mặt đất, khớp chân tường.
5. **Vẽ bù chỗ hỏng**: chỗ người/vật che, mép cắt bị cụt, chân tường bị nền đè → vẽ bù cho liền (vòng đá, mạch tường, vết bong vữa, rêu chân tường) cùng chất với phần còn lại.
6. **Tách lớp mái**: `moongate_h_roof` = phần mái/ngói và phần tường trên đầu người chơi (vẽ đè lên nhân vật khi đi qua); `moongate_h` = phần còn lại (base). Ghép 2 lớp lại phải trùng khít ảnh hợp nhất.
7. **Viền và ánh sáng**: viền tối chọn lọc theo STYLE (sáng trên-trái, viền mép dưới-phải), không viền đen kín quanh toàn bộ.
8. **Hai đầu mảnh**: đầu trái/phải là mặt cắt đứng gọn, chiều cao đỉnh tường và chân tường khớp `C-B3/cwall_h_2` ở hai bên (đo từ PNG đó); không tự sửa cwall_h_2. Nếu chất liệu lệch rõ với cwall_h_2, ghi vào báo cáo (việc sau).
9. **Kit + lắp**: `public/assets/kits/CM-WALL/kit.json` + 2 PNG. Đổi đúng 2 dòng area.json 136, 138 sang `CM-WALL/moongate_h` (chỉnh x/y nếu anchor đổi để chân tường vẫn ở y 730 và thẳng hàng cwall_h_2). Nếu engine cần đăng ký kit mới ở 1 file danh sách, được sửa đúng 1 dòng đó và ghi rõ trong báo cáo.

## Kiểm (done_when — tự chạy, dán log)
- `python -X utf8 tools/sprites/CM-WALL/build.py --verify` PASS: kích thước, alpha chỉ 0/255, lỗ trong suốt ≥ 95 % diện tích ellipse trong, vòng đá liền (không lỗ hổng trên chu vi), mọi màu nằm trong bảng, 2 lớp ghép = ảnh hợp nhất.
- `python -X utf8 tools/sprites/CM-WALL/build.py --repro` 2 lần cùng SHA256.
- `node tools/area_kits_test.mjs` (hoặc test kit tương đương có sẵn) PASS; `node tools/area_steps_walk_test.mjs` và test tới-được/lớp đang có vẫn PASS (đi qua cổng được).
- Ảnh `records/CM-GATE/compare.png`: hàng 1 = vùng concept `V1.png` cắt cùng khung | ảnh chụp game (scene_shot khung `--view 0,17.78125`, có Đạo Sĩ đứng trong lòng cổng) | sprite 4× nearest trên nền #2a2e2a. Hàng 2 = trước (C-B3) | sau (CM-WALL) ở 1×. Thêm `records/CM-GATE/report.md`.
- Tự xem compare.png (tối đa 3 vòng chỉnh) và trả lời trong báo cáo, mỗi câu 1 dòng, có chứng cứ: (a) nhìn có nhận ra đúng nguyệt môn concept không, chỗ nào khác; (b) mép cắt nền có sót quầng không; (c) vòng đá có đều, liền; (d) nối với cwall_h_2 hai bên thế nào.

## Không được
- Không vẽ lại từ đầu bằng thủ tục/nhiễu (đó là cách S1 bị chê). Điểm ảnh phải bắt nguồn từ ảnh concept, chỉ vẽ bù chỗ hỏng.
- Không sửa file ngoài: `tools/sprites/CM-WALL/`, `public/assets/kits/CM-WALL/`, `records/CM-GATE/`, `public/assets/areas/huyen-van-quan-v2/area.json` (chỉ 2 dòng), và 1 dòng đăng ký kit nếu bắt buộc.
- Không sửa `C-B3`, `H-*`, `src/**` (trừ 1 dòng đăng ký nếu bắt buộc), không nới test.
- Không dùng chữ "đạt" về thẩm mỹ trong báo cáo; chỉ mô tả và số đo.

## Bài học liên quan (LESSONS)
- Tối ưu số đo thay vì hình là lỗi đã gặp nhiều lần: số đo chỉ là điều kiện cần, hình giống concept mới là mục tiêu.
- Cắt ô 32 px từ imagegen không nối khít; mối nối nên giấu dưới trụ/mặt cắt gọn.
- Chấm luôn đặt cạnh concept cùng khung camera.
