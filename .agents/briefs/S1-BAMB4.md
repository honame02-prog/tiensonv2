# S1-BAMB4 — trúc: bỏ mép cắt thẳng, lối đá nhỏ hơn
Kit H-BAMB vòng 3r đã gộp (tông và độ phủ đã gần minh hoạ — giữ). Ảnh minh hoạ BẮT BUỘC: .agents/refs/S1/H-BAMB/ (xem _S1-common.md). So: records/S1-BAMB3r/assembly.png.
Opus chấm 3r: khối rừng trúc ghép ra thành HÌNH CHỮ NHẬT — mép dưới cắt ngang thẳng tắp, mép phải cắt dọc thẳng. Minh hoạ: mép rừng lởm chởm, lá rủ thấp không đều, gốc trúc + bụi thấp + đá rêu ở chân, phía ngoài thưa dần.
Việc:
1. Mép dưới mỗi grove: lá rủ + gốc + bụi thấp, đường viền dưới dao động ≥ 16 px; không còn hàng pixel nào nằm ngang dài > 24 px ở mép alpha dưới (thêm kiểm vào verify).
2. bamboo_edge_L/R thực sự dùng để khép hai bên (thưa dần, thân lẻ nghiêng nhẹ); assembly phải dùng chúng.
3. garden_path: đá lát nhỏ hơn (12–20 px), không đều, rêu và lá rụng giữa kẽ, viền lối lẫn vào rêu — như lòng cổng nguyệt trong minh hoạ v1_gate_path.
write_scope: public/assets/kits/H-BAMB/, tools/sprites/H-BAMB/, records/S1-BAMB4/
done_when: build.py --verify --repro PASS (giữ kiểm cũ + kiểm mép mới); records/S1-BAMB4/compare.png = minh hoạ 1× | lắp thử 1× (cùng khung, Đạo Sĩ); ≤ 3 vòng.
