# AG2b — cliff vòng 2 (≤15 phút)
goal: Vách núi đá TỰ NHIÊN bao mép bản đồ, không còn giống tường gạch.
write_scope: tools/assetgen/cliff/**, public/assets/cliff/**, (records/assetgen/cliff/)
Lỗi vòng 1: mặt vách là lưới khối chữ nhật thẳng đứng đều (tường gạch/hàng rào), cao bằng nhau, đỉnh thẳng; sườn đông/tây có dải sáng bên PHẢI (sai nguồn sáng); tảng đá là chóp tam giác trơn.
Cách làm:
- Mặt vách bắc: ghép từ **khối đá lớn không đều** (đa giác 5–8 cạnh, rộng 14–40, cao 10–30, nghiêng ±20°, xếp so le như vách núi đá phân lớp nghiêng, KHÔNG thẳng hàng dọc). Mỗi khối: mặt trên/trái sáng 2 bậc, mặt dưới/phải tối 2 bậc, vân lấy bằng cách lấy mẫu pixel từ `rock_a`/`rock_b` (sect_atlas) theo toạ độ tương đối rồi ánh xạ độ sáng theo mặt; khe giữa khối tối #181010–#24241f rộng 1–2 px, có rêu điểm ở khe nằm ngang.
- Đường đỉnh lượn ±6 px (vẫn khớp ở x=0 và x=63), viền cỏ rủ bằng cách đóng dấu `tuft*`/`fern*` từ decals + cỏ quilting; chân vách: dải bóng tối 6–8 px + đá vụn đóng dấu `rock_c` và sỏi 2–5 px.
- Chiều cao biến thể 64–84 px (khớp đỉnh ở mép bằng cách nội suy về cao 72 tại x=0/63).
- Sườn tây (cliff_w): mặt sáng hướng phải-vào-trong? KHÔNG — nguồn sáng trên-trái: sườn TÂY bản đồ là vách quay mặt sang PHẢI → mặt đó tối hơn mặt bắc; sườn ĐÔNG quay mặt sang TRÁI → sáng hơn. Trên mỗi khối vẫn sáng trên-trái. (Sửa check LIGHT tương ứng: east > west.)
- Tảng `boulder_*`: khối tròn-góc cạnh gồm 3–5 mặt, vân từ rock_a, rêu ở đỉnh, giống phong cách rock_a phóng lớn (không chóp tam giác).
done_when: gen + check PASS (giữ kiểm mép/alpha/bão hoà/md5); compare.png: map_1x mới cạnh `rock_a`, `rock_b`, `stele_a` cũ ở 2×.

## Vòng 2 — lý do làm lại (Opus xem ảnh 2×, scout chấm 3–5/10)
Bản vòng 1 nằm ở nhánh `codex/<id gốc>` (xem bằng `git show codex/AG1:tools/assetgen/...`), check số liệu PASS nhưng HÌNH KHÔNG ĐẠT: trông như hoạ sĩ khác. Nguyên tắc vòng 2: **dùng chính pixel của tài nguyên cũ làm cọ/mẫu** (cắt từ `public/assets/sect/sect_atlas.png` theo `sect_atlas.json`, `public/assets/sect/decals.png|json`, `public/assets/sect/ground_bake.png`), không vẽ nhiễu thủ tục tự do. Đây là tài nguyên của chính dự án, được phép tái dùng.
- KHÔNG lật ngang (flipX) cụm có hướng sáng (sẽ thành sáng trên-phải). Đa dạng bằng chọn cụm khác + làm tối/sáng theo tầng.
- Tự kiểm bằng mắt: xuất `records/assetgen/<gói>/compare.png` = tài nguyên mới đặt cạnh tài nguyên cũ ở 2× trên cùng nền. Nếu bạn xem được ảnh, xem nó tối đa 3 vòng.

## Bối cảnh chung (đọc trước)
- Game Tiên Sơn (Phaser 4, top-down 3/4, 480×270). Thẻ phong cách BẮT BUỘC: `docs/assetgen/STYLE.md`. Ảnh mẫu: `docs/assetgen/ref-props-3x.png` (tùng/đá/đèn/bia/dương xỉ 3×), `docs/assetgen/ref-board-raw.png` (atlas + 2 khu). Tài nguyên gốc để lấy mẫu màu/so sánh: `public/assets/sect/sect_atlas.png|json`, `public/assets/sect/ground_bake.png`, `public/assets/dao_si.png` (khung 64×64, khung đầu ở x0 y0).
- Sinh bằng code: Node thuần (đã có Node 24), dùng `tools/png.mjs` (`decodePng(buf)` → {w,h,data RGBA}; `encodePng({w,h,data}, file)`). KHÔNG cài npm, không tải gì từ mạng. PRNG có seed cố định (vd mulberry32) → chạy 2 lần cùng md5.
- Vẽ thủ tục: nhiễu giá trị/Perlin tự viết, hình dạng bằng đa giác/ellipse có nhiễu mép, tô theo DẢI MÀU trong STYLE.md §5 (lượng tử hoá về dải, không trộn RGB tự do), sáng trên-trái, viền chọn lọc mép dưới-phải.
- Viết bảng xem `records/assetgen/<gói>/sheet.png`: 3× trên nền #2a2e2a, mọi khung + nhãn đơn giản (không cần chữ) + đặt cạnh Đạo Sĩ khung đầu và `rock_a`/`pine_a` cũ để so cỡ/tông.
- Tự kiểm: chạy gen 2 lần so md5; tự xem sheet.png nếu bạn xem được ảnh (tối đa 3 vòng chỉnh), so với ref-props-3x.png theo STYLE.md §9.
- Báo cáo: danh sách file + kích thước, md5 2 lần, nhận xét tự chấm theo §9, giới hạn còn lại.
## Không được
- Sửa file ngoài write_scope (đặc biệt `src/**`, `tools/area_bake.mjs`, `public/assets/sect/**`, `public/assets/areas/**`).
- Ảnh vật thể alpha bán phần (trừ ghi rõ), màu bão hoà cao, gradient trơn, viền đen kín.
