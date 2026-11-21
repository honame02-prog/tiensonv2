# S1-TERR2 — vòng 2 H-TERR (vòng 1 GẦN, chất chưa đạt)
Tiếp từ kit H-TERR hiện có (đã gộp): giữ tên file, kích thước, anchor, kit.json, verify trong tools/sprites/H-TERR/build.py. Đọc _S1-common.md + thẻ 19. So: records/S1-TERR/assembly.png.
Chấm vòng 1: (1) GẦN: mặt đứng tối và mỏng, chưa tách khỏi nền. (2) KHÔNG: xám đều, block lặp máy móc, thiếu rêu olive/vệt ẩm/mép mòn; có chấm tối lạ (khoảng x565,y183; x825,y183; x695,y210; x628,y233 trong assembly). (3) GẦN: đầu tường trái/góc phải chưa thấy kín.
Việc: imagegen từng đoạn tường chắn + lan can đơn lẻ (cùng camera, sáng trái-trên) rồi median + lượng tử hall như TT2; không có imagegen thì vẽ thủ tục đủ lớp: đá khối kích thước không đều, 3 tông, mép trên sáng, bóng dưới gờ đậm, rêu olive ở kẽ và chân, vệt ẩm dọc, dây leo thưa ở biến thể _b. Bỏ chấm lạ. assembly.png có cả đầu tường + góc + lan can nối bậc.
write_scope: public/assets/kits/H-TERR/, tools/sprites/H-TERR/, records/S1-TERR2/
done_when: build.py PASS (K-A5 0, alpha 0/255, post-pitch 32, closed-ends); records/S1-TERR2/assembly.png cạnh concept; tự chấm 3 câu, ≤ 3 vòng.
