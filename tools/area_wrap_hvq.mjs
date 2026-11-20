// Mot lan (20/11): boc meta cu assets/sect/testmap_meta.json thanh public/assets/areas/huyen-van-quan/area.json (giu nguyen anh ground_bake.png).
// Chay lai duoc: node tools/area_wrap_hvq.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { formatArea } from './area_common.mjs';
const old = JSON.parse(readFileSync('public/assets/sect/testmap_meta.json', 'utf8'));
const T = (prompt, ...lines) => ({ prompt, lines: lines.map(([who, text]) => ({ who, text })) });
const texts = {
  stele_a: T('Đọc bia', ['Bia đá cổ', 'Chữ khắc đã mòn gần hết dưới lớp rêu. Chỉ còn đọc được mấy dòng: «Huyền Vân Quan, khai sơn năm thứ ba niên hiệu Thái Bình…»'], ['Bia đá cổ', '«…tổ sư dẫn ba mươi sáu đệ tử lên núi, dựng điện thờ Tam Thanh giữa biển mây. Ngàn năm hương khói chưa từng tắt.»']),
  stele_b: T('Đọc bia', ['Bia giới luật', '«Tĩnh tâm như nước, giữ đạo như núi. Vào sơn môn, chớ mang theo sân hận.»'], ['Bia giới luật', 'Bên dưới có ai khắc thêm một dòng nhỏ, nét còn mới: «Đi chậm thôi, rêu trơn lắm.»']),
  burner: T('Thắp hương', ['Lư hương đồng', 'Lư đồng đã xỉn màu rỉ xanh, tro hương phủ dày cả tấc.'], ['Đạo sĩ', 'Thắp ba nén hương, kính Tam Thanh, kính tổ sư.']),
  burner_lit: T('Thắp hương', ['Lư hương đồng', 'Khói hương lặng lẽ bay lên rồi tan vào sương núi.']),
  hall: T('Xem cửa điện', ['Chính điện', 'Cánh cửa gỗ nặng khép hờ. Bên trong, tượng Tam Thanh mờ khuất sau làn khói trầm.'], ['Chính điện', '(Nội điện sẽ mở ở bản sau.)']),
  gate: T('Sơn môn', ['Sơn môn', 'Tấm biển gỗ trên cổng đã bạc màu, nét chữ vàng chỉ còn lờ mờ: «Huyền Vân Quan».'], ['Sơn môn', 'Bước qua cổng là bậc đá dài dẫn xuống núi.']),
};
const cb = old.cliffBottom, W = old.width;
const a = {
  id: 'huyen-van-quan', name: 'Huyền Vân Quan', sub: 'Sơn môn · Chính điện', ground: 'assets/sect/ground_bake.png', backdrop: 'sect',
  width: W, height: old.height, cliffBottom: cb, baked: old.baked,
  spawns: { default: [...old.spawn, 'up'], gate: [496, 738, 'up'] },
  portals: [{ id: 'to-son-dao', rect: [462, 944, 68, 14], to: { area: 'son-dao', spawn: 'north' }, label: 'Sơn Đạo' }],
  features: {
    pond: old.pond, koi: 5, smoke: true,
    mist: [[-100, cb - 150, W + 200, 190, 0.42], [-100, 700, 9 * 32 + 100, 220, 0.38], [22 * 32, 700, 9 * 32 + 100, 220, 0.38]],
  },
  exits: [{ rect: [7 * 32, 30 * 32, 2.2 * 32, 3 * 32], title: 'Đường xuống núi', text: 'Khu vực kế tiếp đang được xây dựng.', to: { x: 10.5 * 32, y: 31 * 32, face: 'right' } }],
  texts, walls: old.walls, stairs: old.stairs, col: old.col, objs: old.objs, props: old.props,
};
mkdirSync('public/assets/areas/huyen-van-quan', { recursive: true });
writeFileSync('public/assets/areas/huyen-van-quan/area.json', formatArea(a));
console.log('ok');
