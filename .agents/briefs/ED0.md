goal: Phản biện bản thiết kế docs/editor/THIET-KE.md (Area Editor trong game) TRƯỚC khi code. Mức rủi ro R3 (công cụ ghi vào dữ liệu nguồn tools/areas/*.src.json).

context:
- docs/editor/THIET-KE.md (toàn bộ thiết kế)
- src/AreaScene.js (dựng cảnh, preload :40-69, kit pieces :94-101, depth :97, camera :187, fxlab móc :210-212)
- src/areaKits.js, src/areaLayers.js (depthOf :30)
- tools/area_bake.mjs (đọc src, kits/pieces ở gốc hoặc trong area), tools/area_common.mjs (formatArea)
- vite.config.js (plugin fxlabSave — mẫu middleware)
- tools/areas/*.src.json, public/assets/kits/*/kit.json, NOTES-AREA.md

Hãy kiểm bằng mã thật và trả lời:
1. Có giả định nào trong §0 sai với mã không (trích file:dòng)?
2. Rủi ro mất/hỏng dữ liệu còn sót ở luồng lưu §3 (Windows: ghi nguyên tử, rename, file bị khoá; bake lỗi giữa chừng để lại ground.png/area.json lệch; hai tab cùng mở).
3. Việc dời/thêm piece trực tiếp trên sprite đang chạy: va chạm (staticGroup zone :101), đèn, depth theo tier — cần làm lại những gì để "chơi thử" đúng mà không cần bake? Có nên bỏ chơi thử không cần bake, thay bằng bake rồi scene.restart?
4. Round-trip đúng từng byte: JSON.stringify(JSON.parse(text)) có trả đúng file hiện có không (kiểm 5 file, chú ý số thực, unicode, thứ tự khoá, dòng mới cuối file)? Nếu không, đề xuất bộ ghi.
5. Thứ tự giai đoạn và phạm vi GĐ1 có hợp lý không; thiếu tính năng nào mà người dùng đặt sprite thẩm mỹ sẽ cần ngay (ví dụ: so ảnh concept chồng mờ lên cảnh — design/tienson/hvq-scene có concept V1.png)?
6. Cách test E2E: tools/ hiện dùng gì để điều khiển trình duyệt (playwright? puppeteer? CDP tự viết?) — trích file:dòng, đề xuất cách test.
Trả lời: danh sách finding P0/P1/P2, mỗi cái kèm file:dòng và đề xuất sửa cụ thể. Không sửa file nào.

do_not: không sửa/ghi file nào, không chạy bake (ghi đè public/), không chạy vite.
