# Chung cho S1-* (vẽ từng sprite HVQ) — R2

ĐỌC TRƯỚC: thẻ quy cách D:\SkillFX_TuThienChi_HoaLien\design\tienson\19-the-sprite-hvq.md (mục 1, 2, 4 + mục 3 phần của bộ mình). Concept đích: D:\SkillFX_TuThienChi_HoaLien\design\tienson\hvq-scene\C\V1.png, V2.png, the.md. Mẫu chất được duyệt: design/tienson/tam-thanh/TT2/ (tools/build.py: median theo ô, lượng tử bảng hall 48 màu). Định dạng kit: docs/assetgen/KIT.md, .agents/briefs/HK-kit-spec.md (lệnh verify).

LUẬT CỨNG
- KHÔNG crop/paste điểm ảnh từ ảnh concept hay từ kit C-R1/C-B3/C-P (đó là cách cũ bị bỏ). Ngoại lệ duy nhất: nền đá lát cho ẢNH LẮP THỬ được crop từ concept.
- Nguồn hình: imagegen một vật đơn lẻ trọn vẹn (nếu có công cụ) rồi median + lượng tử; hoặc vẽ thủ tục bằng Python/PIL. Script tái tạo được: tools/sprites/<KIT>/build.py (chạy lại ra đúng PNG).
- Không sửa src/, area.json, kit khác. Đạo Sĩ thật: public/assets/ (sprite dao_si 64×64) chỉ để dán vào ảnh lắp thử.

DONE_WHEN
- public/assets/kits/<KIT>/*.png + kit.json; kit verify PASS; K-A5 = 0; alpha 0/255.
- records/<ID>/sheet.png (mọi sprite 1× và 3×, có nhãn tên + kích thước) và records/<ID>/assembly.png: khung 480×270 lắp thử như vùng tương ứng của concept, có Đạo Sĩ, đặt CẠNH crop concept cùng tỉ lệ. Tự xem và sửa tối đa 3 vòng theo 3 câu ở thẻ mục 4.
- report: danh sách sprite (tên, w×h, anchor), tự chấm 3 câu, lệnh đã chạy.
