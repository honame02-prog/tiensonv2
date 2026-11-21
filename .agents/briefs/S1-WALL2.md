# S1-WALL2 — vẽ lại chất H-WALL (vòng 2, Opus chấm vòng 1 CHƯA ĐẠT)

Tiếp từ nhánh codex/S1-WALL (commit "S1-WALL: worker hoan tat"): giữ tên file, kích thước khung, anchor, kit.json, cơ chế verify. Đọc _S1-common.md + thẻ 19. So: records/S1-WALL/assembly.png (trái concept V1, phải bản vòng 1).

## Opus chấm vòng 1 (3 câu thẻ mục 4)
1. Đọc ra vật? Một nửa. Tường đỏ đọc như DẢI PHẲNG nằm ngang nhìn từ trên, không ra mặt đứng cao 40–44 px. Mái ngói chỉ là 1 đường mảnh tối.
2. Cùng chất? KHÔNG. Vữa đỏ tô phẳng một màu, có ký hiệu lạ ("<", chấm trắng rời). Concept: vữa đỏ nâu bạc loang (đậm nhạt theo mảng lớn, vệt ẩm chảy dọc từ mái xuống, sứt lộ gạch vài chỗ), chân đá xám 8 px rõ, mái ngói xám rêu dày ~10–12 px có hàng ngói ống đọc được, bờ nóc, ngói đầu ở hai đầu.
3. Đầu/mối nối kín? Đạt.
Cổng nguyệt: dáng vòng tròn ổn; mái cong trên cổng còn mỏng — concept có mái cong rõ, hai đầu đao vểnh nhẹ, viền đá vòng cổng sáng 4 px.

## Việc
- Dùng imagegen cho từng vật đơn lẻ (đoạn tường 128, cổng nguyệt, trụ, đầu tường) cùng góc camera, sáng trái-trên, nền phẳng → median + lượng tử bảng hall như TT2. Không có imagegen: vẽ thủ tục nhưng đủ các lớp chất trên (mảng loang 3 tông, vệt ẩm dọc, chân đá có mạch, ngói ống từng hàng).
- Bỏ mọi ký hiệu/chấm lạ. Chi tiết nhỏ nhất 2 px.
- assembly.png phải có cả lan can + tường chắn đơn giản cạnh cổng như concept để so dáng (có thể tạm vẽ xám).

write_scope: public/assets/kits/H-WALL/, tools/sprites/H-WALL/, records/S1-WALL2/
done_when: build.py --verify PASS (K-A5 0, alpha 0/255, aperture 108×108); records/S1-WALL2/assembly.png cạnh concept; tự chấm lại 3 câu; tối đa 3 vòng tự sửa.
