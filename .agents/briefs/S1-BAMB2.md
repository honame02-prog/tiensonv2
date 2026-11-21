# S1-BAMB2 — vòng 2 H-BAMB (vòng 1: dáng đạt, tông chưa đạt)
Tiếp từ kit H-BAMB hiện có (đã gộp, build.py vẽ thủ tục + --verify --repro): giữ tên file, kích thước, anchor, kit.json. Đọc _S1-common.md + thẻ 19. So: records/S1-BAMB/assembly.png với concept D:\SkillFX_TuThienChi_HoaLien\design\tienson\hvq-scene\C\V1.png (góc trên-trái).
Chấm vòng 1: (1) ĐẠT: thân có đốt, lá thành khối. (2) KHÔNG: trúc tối và lạnh hơn concept, thiếu lá sáng xanh rêu ở mép trên-trái mỗi khối lá (sáng trái-trên); lối đá là dải thẳng. (3) GẦN: hai cạnh bên cụm trúc cắt thẳng đứng, đáy cụm phẳng; Đạo Sĩ trong ảnh lắp thử bị che quá nhiều (chỉ lộ đầu vai).
Việc: nếu có imagegen thì tạo nguồn từng cụm trúc đơn lẻ rồi median + lượng tử hall; nếu không, chỉnh thủ tục: 3 tầng tông lá (tối sâu trong, trung, sáng rêu ở mép trên-trái), mép cụm lởm chởm theo lá, đáy có gốc + bụi thấp; garden_path_a/b có đường cong (lối đá nhỏ cong) và biến thể nối được; trong assembly đặt Đạo Sĩ ở lối đi lộ ≥ 60 % thân, chỉ ngọn trúc che.
write_scope: public/assets/kits/H-BAMB/, tools/sprites/H-BAMB/, records/S1-BAMB2/
done_when: build.py --verify --repro PASS; records/S1-BAMB2/assembly.png cạnh concept; tự chấm 3 câu, ≤ 3 vòng.
