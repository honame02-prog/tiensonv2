# S1-WALL3 — làm lại NGUYỆT MÔN (moongate_h + _roof) bám ảnh minh hoạ
Người dùng: "nguyệt môn chưa quá đạt". Kit H-WALL vòng 2 đã gộp (giữ các mảnh khác; chỉ sửa moongate_h, moongate_h_roof, và wall_h/wall_post nếu cần để vai cổng nối liền).
ẢNH MINH HOẠ BẮT BUỘC: .agents/refs/S1/H-WALL/v1_moongate_1x.png + _4x.png, v1_redwall_left_*.png (xem _S1-common.md mục ẢNH MINH HOẠ). So hiện trạng: records/S1-WALL2/assembly.png.
Opus so minh hoạ với vòng 2:
1. Mái cổng: minh hoạ mái RỘNG HƠN vai cổng mỗi bên ~6–8 px, bờ nóc cong võng giữa, hai đầu đao vểnh rõ (đầu đao có đá cuộn), 3–4 hàng ngói ống đọc được, diềm mái tối bên dưới. Vòng 2 mái nhỏ, mỏng, phẳng.
2. Vai cổng: tường đỏ hai bên lỗ nâng cao lên tận chân mái, rộng ~30–34 px mỗi bên; vữa đỏ nâu bạc loang mảng lớn, bong lộ gạch xám ở chân phải/trái, vệt ẩm dọc dưới mái.
3. Vòng cổng: viền đá SÁNG xám nhạt 3–4 px liền mạch quanh lỗ, có bóng mảnh phía trong-dưới; đáy lỗ là ngưỡng đá thấp. Lỗ ~108×108 TRONG SUỐT.
4. Chân tường: dải đá xám ~8 px chạy liền qua vai và đoạn tường kề, nối đúng với tường đỏ ngang (wall_h) hai bên — không lệch cao.
Việc: imagegen dùng minh hoạ làm tham chiếu, vẽ nguyệt môn TRỌN (cả phần mái/vai bị trúc che trong concept), median + lượng tử hall; mỗi vòng đặt sprite 1× cạnh minh hoạ 1× (và 4×) và tự so 4 điểm trên.
write_scope: public/assets/kits/H-WALL/, tools/sprites/H-WALL/, records/S1-WALL3/
done_when: build.py PASS (K-A5 0, alpha 0/255, aperture 108x108, transparent, repro); records/S1-WALL3/compare.png = minh hoạ 4× | sprite 4× | lắp thử 1× (cổng + tường đỏ hai bên + lan can, Đạo Sĩ đứng trong lỗ); tự chấm 4 điểm; ≤ 3 vòng.
