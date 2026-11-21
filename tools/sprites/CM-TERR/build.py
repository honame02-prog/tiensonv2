"""CM-TERR (Opus tự làm, thử nghiệm so với Codex): tường chắn đá cắt từ concept C gốc.
Cùng công thức CM-GATE: điểm ảnh lấy từ V1-original, median theo ô, lượng tử về
bảng STYLE §5 + màu concept V1.png, không sinh texture/nhiễu.
Chạy: python -X utf8 tools/sprites/CM-TERR/build.py [--verify|--repro]
"""
from pathlib import Path
import hashlib, json, re, sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
REF = ROOT / '.agents/refs/CM'
OUT = ROOT / 'public/assets/kits/CM-TERR'
OLD = ROOT / 'public/assets/kits/C-R1'
H = 56
# Mặt tường liền trong V1-original (1672x941): từ sau tường đỏ nguyệt môn tới trụ cạnh bậc.
SX0, SX1 = 618, 1240          # 1240 gồm trụ đá sáng cạnh bậc (src 1210..1240)
SY0, SY1 = 586, 757           # gờ đỉnh (coping) -> chân rêu
STRIP_W = round((SX1 - SX0) / ((SY1 - SY0) / H))   # cùng tỉ lệ hai trục


def palette():
    style = (ROOT / 'docs/assetgen/STYLE.md').read_text(encoding='utf-8')
    sec = style.split('## 5.')[1].split('## 6.')[0]
    cols = {tuple(bytes.fromhex(h)) for h in re.findall(r'#([0-9a-fA-F]{6})', sec)}
    v1 = np.array(Image.open(REF / 'V1.png').convert('RGB'))[165:225, 180:360]  # vùng tường chắn ở 1x
    cols |= {tuple(int(v) for v in c) for c in np.unique(v1.reshape(-1, 3), axis=0)}
    return np.array(sorted(cols), dtype=np.int32)


PAL = palette()


def quantize(img):
    flat = img.reshape(-1, 3).astype(np.int32)
    idx = ((flat[:, None, :] - PAL[None, :, :]) ** 2).sum(2).argmin(1)
    return PAL[idx].reshape(img.shape).astype(np.uint8)


def strip():
    """Thu nhỏ mặt tường về 1x bằng median theo ô (không nội suy)."""
    src = np.array(Image.open(REF / 'V1-original.png').convert('RGB'))
    xe = np.linspace(SX0, SX1, STRIP_W + 1).round().astype(int)
    ye = np.linspace(SY0, SY1, H + 1).round().astype(int)
    out = np.zeros((H, STRIP_W, 3), np.uint8)
    for y in range(H):
        for x in range(STRIP_W):
            cell = src[ye[y]:max(ye[y] + 1, ye[y + 1]), xe[x]:max(xe[x] + 1, xe[x + 1])]
            out[y, x] = np.median(cell.reshape(-1, 3), axis=0)
    # Ảnh imagegen gốc ám cam (đo: R85 G68 B50) so với concept đã duyệt ở 1x
    # (R75 G72 B62). Chuyển trung bình/độ lệch từng kênh về vùng tường chắn của V1.png.
    ref = np.array(Image.open(REF / 'V1.png').convert('RGB')).astype(float)[168:217, 178:346].reshape(-1, 3)
    f = out.astype(float).reshape(-1, 3)
    f = (f - f.mean(0)) / (f.std(0) + 1e-6) * ref.std(0) + ref.mean(0)
    out = np.clip(f, 0, 255).reshape(out.shape).astype(np.uint8)
    return quantize(out)


def build():
    s = strip()                       # ~ H x STRIP_W, trụ đá ở ~10 px cuối bên phải
    W = s.shape[1]
    post = W - 11                      # cột bắt đầu trụ cạnh bậc (đo từ nguồn 1210/1240)
    face = s[:, :post]                 # chỉ mặt đá, không trụ
    fw = face.shape[1]
    pieces = {}
    # Các cửa sổ cắt ở vị trí khác nhau để các mảnh không giống hệt nhau.
    def win(width, off):
        off = off % max(1, fw - width + 1)
        return face[:, off:off + width]
    pieces['rwall_6'] = win(192, 0) if fw >= 192 else np.concatenate([face, face[:, ::-1]], 1)[:, :192]
    # Nguồn liền chỉ ~193 px nên rwall_4 lấy bản soi ngang (khối đá đối xứng, sáng từ trên) để không trùng rwall_6.
    pieces['rwall_4'] = face[:, ::-1][:, 20:148]
    pieces['rwall_2'] = win(64, fw // 2 - 20)
    # Đầu tường: mặt đá + trụ đá thật cạnh bậc. Trái = soi gương (trụ ở bên trái).
    end_r = s[:, W - 32:W]
    pieces['rwall_end_R'] = end_r
    pieces['rwall_end_L'] = end_r[:, ::-1]
    return pieces


def save(pieces):
    OUT.mkdir(parents=True, exist_ok=True)
    old = json.loads((OLD / 'kit.json').read_text(encoding='utf-8'))
    oldp = old.get('pieces', old)
    kit = {'kit': 'CM-TERR', 'pieces': {}}
    for name, arr in pieces.items():
        a = np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)])
        Image.fromarray(a, 'RGBA').save(OUT / f'{name}.png', optimize=False)
        meta = dict(oldp[name])
        meta['file'] = f'{name}.png'
        meta['source'] = f'V1-original median cells x{SX0}..{SX1} y{SY0}..{SY1} -> {H}px (Opus CM-TERR)'
        kit['pieces'][name] = meta
    (OUT / 'kit.json').write_text(json.dumps(kit, ensure_ascii=False, indent=2), encoding='utf-8')


def sha_all():
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.glob('*'))}


def verify():
    ok = True
    pal = {tuple(c) for c in PAL.tolist()}
    for name in ['rwall_2', 'rwall_4', 'rwall_6', 'rwall_end_L', 'rwall_end_R']:
        a = np.array(Image.open(OUT / f'{name}.png').convert('RGBA'))
        o = Image.open(OLD / f'{name}.png').size
        cols = {tuple(c) for c in a[:, :, :3].reshape(-1, 3).tolist()}
        bad = len(cols - pal)
        size_ok = (a.shape[1], a.shape[0]) == o
        alpha_ok = set(np.unique(a[:, :, 3]).tolist()) <= {0, 255}
        print(f"{'PASS' if size_ok and alpha_ok and not bad else 'FAIL'} {name} {a.shape[1]}x{a.shape[0]} (C-R1 {o[0]}x{o[1]}) colors={len(cols)} off_palette={bad}")
        ok &= size_ok and alpha_ok and not bad
    a2, a4 = [np.array(Image.open(OUT / f'{n}.png'))[:, :64, :3] for n in ('rwall_2', 'rwall_4')]
    same = float((a2 == a4).all(2).mean())
    print(f"variety rwall_2 vs rwall_4 first 64 cols identical={same:.2%}")
    print('PASS CM-TERR' if ok else 'FAIL CM-TERR')
    return ok


if __name__ == '__main__':
    if '--verify' in sys.argv:
        sys.exit(0 if verify() else 1)
    save(build())
    if '--repro' in sys.argv:
        h1 = sha_all(); save(build()); h2 = sha_all()
        print('REPRO', 'PASS' if h1 == h2 else 'FAIL', len(h1), 'files')
    else:
        print('built', sorted(p.name for p in OUT.glob('*.png')), 'STRIP_W', STRIP_W)
