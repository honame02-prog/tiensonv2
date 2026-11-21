# S1-TERR4 — tường chắn: rêu/ẩm/phong hoá phải THẤY bằng mắt (vòng 3 tối ưu số đo)
Kit H-TERR vòng 3 đã gộp. Minh hoạ BẮT BUỘC: .agents/refs/S1/H-TERR/v1_rwall_balus_4x.png, v2_rwall_balus_4x.png. Đọc _S1-common.md + _S1-aged.md.
Scout chấm vòng 3 (records/S1-TERR3/compare.png): số đo moss 19–28 % nhưng rêu chỉ là VẠCH OLIVE MẢNH ĐỀU trong mạch → nhìn vẫn sạch. KHÔNG có cụm rêu ở chân/góc/gờ, KHÔNG có vệt ẩm, khối đá chữ nhật mép sắc, tông gần một mảng xám, lan can nguyên vẹn. (Bài học LESSONS: không tối ưu số đo thay cho hình.)
Việc (mỗi điểm phải thấy ở 1×):
1. CỤM rêu: mảng olive tối/olive sáng 2 tông, kích thước 6–20 px, bám chân tường (dải rêu chân lởm chởm cao 4–10 px), góc trong, dưới gờ; không vẽ vạch đều trong mọi mạch (chỉ 30–40 % mạch có rêu).
2. 2–4 vệt ẩm tối xanh nâu mỗi đoạn 128, dài 12–30 px, rộng 2–4 px, từ gờ chảy xuống, mờ dần.
3. Khối đá: cạnh lệch 1–2 px, góc sứt, 3–4 tông có pha NÂU (không chỉ xám), vài khối nứt chéo.
4. Lan can: đầu trụ sứt 1–3 px không đều, chân trụ và chân thanh có rêu, thanh có đốm loang.
Tự kiểm: đặt sprite 4× CẠNH minh hoạ 4× trong compare.png và viết 4 câu so sánh cụ thể trong report trước khi kết thúc.
write_scope: public/assets/kits/H-TERR/, tools/sprites/H-TERR/, records/S1-TERR4/
done_when: build.py --verify PASS (giữ kiểm cũ); records/S1-TERR4/compare.png = minh hoạ 4× | sprite 4× | lắp thử 1×; ≤ 3 vòng.
