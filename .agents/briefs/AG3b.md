# AG3b — forest vòng 2 (≤15 phút)
goal: Tường rừng rậm trông như cùng hoạ sĩ với pine_a/pine_b, không còn dải tán phẳng và hàng rào thân.
write_scope: tools/assetgen/forest/**, public/assets/forest/**, (records/assetgen/forest/)
Lỗi vòng 1: canopy là các dải "bánh kếp" bầu dục nằm ngang xếp hàng đều, mặt phẳng, đỉnh khối bằng; trunkrow = cọc đều nhau như hàng rào; bush = khối chữ nhật bo; tallgrass đơn điệu.
Cách làm:
- `canopy_*`: ĐÓNG DẤU các cụm lá thật `pine_a_f0..f9` (ô liu) hoặc `pine_b_f0..f4` (lạnh) cắt từ sect_atlas (alpha nhị phân giữ nguyên). Mỗi khối 25–60 dấu, xếp thành 2–4 "ngọn cây" chồng nhau, mỗi ngọn là 1 hình nón tròn đỉnh có đường viền trên GỒ GHỀ (không bằng); dấu ở sau/dưới làm tối 15–40 % (nhân màu, lượng tử về dải), dấu trước/trên giữ nguyên → chiều sâu. Giữa các dấu để lộ khe tối #0a110d. Không lật ngang.
- `trunkrow_*`: thân cắt dải từ `pine_a_trunk`/`pine_b_trunk` (đoạn thân thật), rộng 3–10 px, cao chênh ±20 %, nghiêng nhẹ, khoảng cách ngẫu nhiên 6–30 px, có thân che nhau, chân là bóng tối + rễ, phía trên chìm vào tối (để ghép dưới tán).
- `bush_*`: đóng dấu 3–7 khung `fern_a/b/c` + decals `fern*` chồng nhau, viền ngoài không đều; `tallgrass_*`: đóng dấu decals `tuft*` 2–4 cái.
- Giữ sprites.json, atlas, kiểm cũ (bão hoà, alpha, md5, độ sáng so pine_b_f0).
done_when: gen + check PASS; compare.png: demo dải rừng mới cạnh pine_a, pine_b cũ ở 2×.

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
