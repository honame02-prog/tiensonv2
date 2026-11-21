# S1-BAMB3 — vòng 3 H-BAMB: GHÉP mật độ vòng 1 + tông vòng 2
Kit hiện tại = vòng 2 (đã gộp). Vòng 1 ở commit ada254d (`git show ada254d:public/assets/kits/H-BAMB/<file>`, ảnh records/S1-BAMB/assembly.png). So concept D:\SkillFX_TuThienChi_HoaLien\design\tienson\hvq-scene\C\V1.png góc trên-trái. Đọc _S1-common.md + thẻ 19.
Scout chấm vòng 2: (1) KHÔNG: tán thưa hơn vòng 1, khoảng trống lớn quanh tán, thân không thấy đốt. (2) GẦN: sáng hơn, đỡ lạnh, nhưng chưa rõ 3 tầng, chưa có lá sáng xanh rêu mép trên-trái. (3) Đạo Sĩ lộ 94 % ĐẠT; lối đá cong nhẹ đạt; nhưng lối đá nằm trên NỀN TỐI HÌNH CHỮ NHẬT cạnh thẳng.
Việc: mật độ tán ≥ vòng 1 (phủ ≥ 85 % khung sprite grove, lá tối sâu bên trong), thân đọc đốt 2 px sáng ở mắt đốt; giữ tông vòng 2 + thêm tầng lá sáng xanh rêu mép trên-trái; bỏ nền tối chữ nhật (bóng mềm không có cạnh thẳng). Giữ actor_visible_pct ≥ 60, các kiểm --verify --repro hiện có.
write_scope: public/assets/kits/H-BAMB/, tools/sprites/H-BAMB/, records/S1-BAMB3/
done_when: build.py --verify --repro PASS + đo thêm độ phủ tán; records/S1-BAMB3/assembly.png gồm concept | vòng 1 | vòng 3; ≤ 3 vòng tự sửa.
