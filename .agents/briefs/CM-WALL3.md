# CM-WALL3 — Sửa tường viện CM-WALL2 theo lời chấm (làm tiếp trong worktree này)

Mức rủi ro: R2. Thời hạn: 20 phút. Bạn đang ở worktree nhánh `codex/CM-WALL2` (HEAD ace6f0c, việc CM-WALL2 của bạn đã xong). Brief gốc: `.agents/briefs/CM-WALL2.md` — mọi ràng buộc ở đó vẫn áp dụng (cắt từ concept, không vẽ thủ tục từ đầu, giữ nguyên giữa nguyệt môn byte-identical 3af2339, giữ anchor/footprint/collide/toạ độ, alpha 0/255, bảng màu, repro).

## Lời chấm của Opus trên records/CM-WALL2/compare.png (người dùng yêu cầu sửa rồi gộp)
1. **Vết bong vữa lặp**: dải bong vữa trắng chân tường có CÙNG hình răng cưa/vỏ sò ở mọi đoạn (cwall_h_2/4/6, post, góc). Phải đa dạng: mỗi đoạn lấy từ vùng khác nhau của tường đỏ trong V1-original/V2-original, vết bong có độ cao, hình, mật độ khác nhau; có đoạn gần như không bong, có đoạn bong lên cao; không có nhịp lặp nhìn ra khi xếp 3 đoạn cạnh nhau.
2. **Vạch dọc tối** giữa các đoạn trên mặt đỏ (mối ghép lát cắt). Xoá: mặt đỏ phải liền, không vạch tối dọc nào trừ chỗ có trụ thật.
3. **Cục ngói gồ giữa** cwall_h_4 và cwall_h_6 (hàng ngói đỉnh tường nhô lên một chỗ). Đỉnh mái phải thẳng, đều.
4. **Tường dọc `cwall_v` đọc như cột thang**: dãy ngói lặp đều như bậc thang, mặt đỏ chỉ 6 px. Trong góc 3/4 tường dọc phải đọc là một bức tường có mái: đỉnh mái ngói nhìn từ trên (hai mái dốc hai bên sống mái, sống mái sáng ở giữa, ngói xếp theo chiều dọc liền mạch, không nhịp lặp 32 px rõ), và mép đỏ mặt tường thấy rõ hơn (tăng chiều rộng phần nhìn thấy trong khuôn footprint cho phép; nếu cần rộng hơn 16 px ảnh thì giữ anchor/footprint/collide, ảnh được rộng hơn footprint, ghi rõ). Đối chiếu tường dọc/đỉnh tường nhìn từ trên trong V1/V2-original (vd tường bên trái cảnh V1 cạnh trúc, sống mái chạy dọc gần x≈350/1672 trong V1-original) và cắt từ đó nếu có.
5. **Cổng dọc `gate_v`** nhỏ, khó nhận ra: hai đầu tường bịt phải là đầu hồi rõ (ngói kết thúc gọn, mặt cắt đỏ có viền), khoảng hở 48 px nhìn ra là lối đi.
6. **Góc `corner_hv_L/R`**: sau khi sửa cwall_v, góc phải nối liền cả tường ngang và dọc mới.

## Kiểm (tự chạy, dán log vào records/CM-WALL3/)
- `build.py --verify` PASS (thêm kiểm: (a) độ khác giữa các đoạn bong vữa — so mask dải chân tường giữa các mảnh/biến thể, không cặp nào trùng > 70 %; (b) không cột nào trên mặt đỏ tối hơn hai cột bên cạnh quá ngưỡng bạn chọn và ghi rõ; (c) đỉnh mái cwall_h: y mép trên mỗi cột lệch ≤ 1 px).
- `--repro` 2 lần cùng SHA; `node tools/area_kits_test.mjs`, `node tools/area_steps_walk_test.mjs`, `node tools/blockout_reach.mjs`, `node tools/sprites/CM-WALL/layers.mjs`, `node tools/sprites/CM-WALL/runtime.mjs` PASS.
- `records/CM-WALL3/compare.png` cùng bố cục CM-WALL2 (concept|game V1; tây/đông trước(ace6f0c)|sau; mọi mảnh 4×) + thêm 1 hàng: 3 đoạn cwall_h_6 xếp liền và 4 cwall_v xếp chồng ở 4×.
- `records/CM-WALL3/report.md`: với từng mục 1–6, 1 dòng mô tả đã sửa gì + chứng cứ. Không dùng chữ "đạt".
- Commit tất cả trên nhánh này (`codex CM-WALL3: ...`). Write scope như CM-WALL2 + `records/CM-WALL3/`.
