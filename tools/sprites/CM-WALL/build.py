"""CM-GATE: concept pixels, landmark registration, median cells, binary cutout.
No generated texture/noise. Run --verify or --repro from any directory.
"""
from pathlib import Path
import hashlib, io, json, math, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/kits/CM-WALL'
REC = ROOT / 'records/CM-GATE'
REF = ROOT / '.agents/refs/CM'
SOURCE = REF / 'V1-original-gate.png'
W, H = 192, 146
# Source landmarks registered to the approved 480x270 concept crop (0,73,176,219).
# The variant without actors has a thinner, complete stone rim than original.png.
SX = [0, 113, 307, 508, 618]
DX = [8, 34, 96, 158, 184]
SY = [278, 286, 388, 758, 762]
DY = [0, 2, 27, 145, 146]
INNER = (307.5, 573.0, 166.5, 168.0)
OUTER = (307.0, 574.0, 183.0, 185.0)

def palette():
    style = (ROOT/'docs/assetgen/STYLE.md').read_text(encoding='utf-8')
    section = style.split('## 5.')[1].split('## 6.')[0]
    colors = [tuple(bytes.fromhex(h)) for h in re.findall(r'#([0-9a-fA-F]{6})', section)]
    concept = np.array(Image.open(REF/'V1.png').convert('RGB'))[73:219, :176]
    colors += [tuple(c) for c in np.unique(concept.reshape(-1,3),axis=0)]
    # Existing wall ends are also concept-derived and retain their exact palette.
    for name in ['cwall_h_2','cwall_h_2_roof']:
        a = np.array(Image.open(ROOT/f'public/assets/kits/C-B3/{name}.png').convert('RGBA'))
        seam_colors=[tuple(c) for c in np.unique(a[a[:,:,3]>0,:3],axis=0)]
        assert set(seam_colors)<=set(colors),'seam palette must already belong to STYLE5 + concept crop'
    return np.array(sorted(set(colors)),dtype=np.int32)

PAL = palette()

def quantize(rgb):
    rgb = np.asarray(rgb,dtype=np.int32)
    return PAL[((rgb[:,None,:]-PAL[None,:,:])**2).sum(axis=2).argmin(axis=1)].astype(np.uint8)

def coords():
    x = np.interp(np.arange(W)+.5, DX, SX)
    y = np.interp(np.arange(H)+.5, DY, SY)
    return np.meshgrid(x,y)

def ellipse(cx,cy,rx,ry):
    x,y = coords()
    return ((x-cx)/rx)**2+((y-cy)/ry)**2 <= 1

def build():
    src = np.array(Image.open(SOURCE).convert('RGB'))
    # Hand-traced object silhouette only; all RGB remains sampled from the photograph.
    contour = [(0,613),(112,613),(112,424),(102,416),(100,409),(87,402),
      (80,389),(79,377),(84,370),(92,370),(99,376),(110,376),(124,363),
      (133,350),(123,344),(115,334),(112,324),(114,316),(121,311),(129,312),
      (134,318),(130,323),(140,329),(158,329),(184,322),(217,309),
      (251,298),(281,290),(308,287),(336,290),(370,299),(403,312),
      (432,325),(456,331),(474,327),(483,320),(483,313),(493,312),
      (500,318),(504,329),(500,341),(489,351),(496,363),(508,374),
      (521,375),(527,369),(535,371),(540,379),(538,390),(530,401),
      (515,411),(509,423),(508,613),(618,613),(618,758),(0,758)]
    mask = Image.new('L',(src.shape[1],src.shape[0]))
    ImageDraw.Draw(mask).polygon(contour,fill=255)
    m = np.array(mask)>0
    xedges=np.interp(np.arange(W+1),DX,SX)
    yedges=np.interp(np.arange(H+1),DY,SY)
    a=np.zeros((H,W,4),np.uint8)
    for y in range(H):
        y0,y1=round(yedges[y]),round(yedges[y+1]); y1=max(y0+1,y1)
        for x in range(8,184):
            x0,x1=round(xedges[x]),round(xedges[x+1]); x1=max(x0+1,x1)
            solid=m[y0:y1,x0:x1]
            if solid.size and solid.mean()>=.5:
                a[y,x,:3]=np.median(src[y0:y1,x0:x1][solid],axis=0)
                a[y,x,3]=255
    solid=a[:,:,3]>0
    # Match the approved quantized concept's material medians. This retains the
    # original tile/plaster/stone variation without the raw image's orange cast.
    reference=np.zeros((H,W,3),np.uint8)
    reference[:,8:184]=np.array(Image.open(REF/'V1.png').convert('RGB'))[73:219,:176]
    xmap,ymap=coords()
    stone=ellipse(*OUTER)&~ellipse(*INNER)
    tile=ymap < (369+54*(np.abs((xmap-307)/210)**1.3))
    for material in [stone, tile&~stone, ~stone&~tile]:
        use=material&solid&~ellipse(*INNER)
        if use.any():
            before=np.median(a[use,:3],axis=0)
            target=np.median(reference[use],axis=0)
            a[use,:3]=np.clip(a[use,:3].astype(float)*(target/np.maximum(before,1)),0,255).astype(np.uint8)
    a[solid,:3]=quantize(a[solid,:3])
    inside=ellipse(*INNER)
    ring=ellipse(*OUTER)&~inside
    a[inside]=0
    # Repair only incomplete silhouette cells on the fitted continuous stone rim,
    # sampling the same radial stone position in the source, never painting a ring.
    xmap,ymap=coords()
    repair=ring & (a[:,:,3]==0)
    if repair.any():
        a[repair,:3]=quantize(src[np.rint(ymap[repair]).astype(int),np.rint(xmap[repair]).astype(int)])
        a[repair,3]=255
    # Clean vertical joins: exact source-derived C-B3 material under the jambs.
    wall=Image.alpha_composite(Image.open(ROOT/'public/assets/kits/C-B3/cwall_h_2.png').convert('RGBA'),
                               Image.open(ROOT/'public/assets/kits/C-B3/cwall_h_2_roof.png').convert('RGBA'))
    wa=np.array(wall)
    a[76:146,:34]=wa[:,30:64]
    a[76:146,158:]=wa[:,:34]
    # Restore the concept gate in front of the side-wall strips where they meet.
    # The 34/158 px cuts coincide with the thick vertical plaster jambs.
    a[inside]=0
    a[a[:,:,3]==0]=0
    # Selective shadow is retained from the upper-left-lit original; no black outline.
    yy,xx=np.indices((H,W))
    roofmask=(yy<60)|(((xx<34)|(xx>=158))&(yy<96))
    base=a.copy(); roof=a.copy(); base[roofmask]=0; roof[~roofmask]=0
    return {'moongate_h.png':Image.fromarray(base),
            'moongate_h_roof.png':Image.fromarray(roof)},Image.fromarray(a),int(repair.sum())

def pngbytes(im):
    b=io.BytesIO(); im.save(b,format='PNG',optimize=False); return b.getvalue()

def manifest(repair):
    source={'file':'.agents/refs/CM/V1-original-gate.png','crop':[0,278,618,762],
      'concept_frame':[0,73,176,219], 'registration':{'source_x':SX,'dest_x':DX,'source_y':SY,'dest_y':DY},
      'method':'median occupied cells; exact STYLE5 + V1 crop + C-B3 source palette; binary silhouette; ellipse aperture',
      'seam_donor':'C-B3/cwall_h_2 + cwall_h_2_roof, 34px ends, exact 70px height',
      'ring_repair_pixels':repair,'inner_source_ellipse':INNER,'outer_source_ellipse':OUTER}
    return {'kit':'CM-WALL','tile':32,'palette':[('#%02x%02x%02x'%tuple(c)) for c in PAL],
      'pieces':{'moongate_h':{'file':'moongate_h.png','layer':'base','anchor':[8,145],
       'footprint':[176,16],'collide':[[-8,-16,70,16],[122,-16,62,16]],'pair':'moongate_h_roof','source':source},
       'moongate_h_roof':{'file':'moongate_h_roof.png','layer':'roof','anchor':[8,145],
        'footprint':[176,16],'collide':[],'source':source}}}

def verify(ims,whole):
    disk={name:np.array(Image.open(OUT/name).convert('RGBA')) for name in ims}
    b,r=disk.values(); full=np.array(whole); combined=np.array(Image.alpha_composite(Image.fromarray(b),Image.fromarray(r)))
    assert b.shape==r.shape==(H,W,4)
    assert set(np.unique(b[:,:,3]))<= {0,255} and set(np.unique(r[:,:,3]))<= {0,255}
    assert not ((b[:,:,3]>0)&(r[:,:,3]>0)).any()
    assert np.array_equal(full,combined),'layer reconstruction'
    inside=ellipse(*INNER); hole=(full[:,:,3][inside]==0).mean()
    assert hole>=.95
    ring=ellipse(*OUTER)&~inside
    assert (full[:,:,3][ring]==255).all(),'ring continuity'
    # Every one of 1440 angular perimeter samples lands in a nontransparent ring cell.
    samples=set()
    for t in np.linspace(0,2*math.pi,1440,endpoint=False):
        sx=307+174*math.cos(t); sy=573.5+176.5*math.sin(t)
        px=round(float(np.interp(sx,SX,DX))-.5); py=round(float(np.interp(sy,SY,DY))-.5)
        samples.add((px,py)); assert full[py,px,3]==255,(px,py)
    allowed=set(map(tuple,PAL)); colors=set(map(tuple,full[full[:,:,3]>0,:3]))
    assert colors<=allowed
    wall=np.array(Image.alpha_composite(Image.open(ROOT/'public/assets/kits/C-B3/cwall_h_2.png').convert('RGBA'),Image.open(ROOT/'public/assets/kits/C-B3/cwall_h_2_roof.png').convert('RGBA')))
    assert np.array_equal(full[76:146,:34],wall[:,30:64])
    assert np.array_equal(full[76:146,158:],wall[:,:34])
    from collections import deque
    seen=set(); start=tuple(np.argwhere(ring)[0]); q=deque([start]); seen.add(start)
    while q:
        y,x=q.popleft()
        for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
            p=(y+dy,x+dx)
            if 0<=p[0]<H and 0<=p[1]<W and ring[p] and p not in seen: seen.add(p); q.append(p)
    assert len(seen)==ring.sum(),'ring is not a single connected component'
    kit=json.loads((OUT/'kit.json').read_text(encoding='utf-8'))
    assert kit==json.loads(json.dumps(manifest(build()[2])))
    print(f'PASS CM-GATE verify: {W}x{H}, alpha=0/255, aperture={hole:.2%}, ring={len(seen)}px connected/{len(samples)} perimeter cells solid, palette={len(colors)}/{len(PAL)}, layers=exact')
    iy,ix=np.where(inside)
    print(f'PASS seams: both 34x70px ends byte-identical to C-B3; aperture bbox={ix.max()-ix.min()+1}x{iy.max()-iy.min()+1}px; anchor=[8,145], clear collision width=60px')

def compare():
    _,whole,_=build()
    bg=(42,46,42)
    board=Image.new('RGB',(1784,814),bg); d=ImageDraw.Draw(board)
    d.text((8,6),'CONCEPT V1 (same 480x270 frame)',fill='white')
    d.text((500,6),'GAME view 0,17.78125 / Dao Si in aperture',fill='white')
    d.text((1000,6),'CM-WALL 4x nearest / #2a2e2a',fill='white')
    board.paste(Image.open(REF/'V1.png').convert('RGB'),(8,28))
    shot=REC/'scene.png'
    if shot.exists(): board.paste(Image.open(shot).convert('RGB'),(500,28))
    big=whole.resize((W*4,H*4),Image.Resampling.NEAREST)
    board.paste(big,(1000,28),big)
    d.text((8,634),'BEFORE C-B3 1x',fill='white'); d.text((250,634),'AFTER CM-WALL 1x',fill='white')
    old=Image.alpha_composite(Image.open(ROOT/'public/assets/kits/C-B3/moongate_h.png').convert('RGBA'),Image.open(ROOT/'public/assets/kits/C-B3/moongate_h_roof.png').convert('RGBA'))
    board.paste(old,(8,656),old); board.paste(whole,(250,656),whole)
    board.save(REC/'compare.png')

def main():
    OUT.mkdir(parents=True,exist_ok=True); REC.mkdir(parents=True,exist_ok=True)
    ims,whole,repair=build()
    if '--repro' in sys.argv:
        second,_,_=build()
        for name,im in ims.items():
            a=pngbytes(im); b=pngbytes(second[name]); assert a==b==(OUT/name).read_bytes()
            print(f'PASS repro {name} SHA256={hashlib.sha256(a).hexdigest()} (2 independent builds = disk)')
        return
    if '--verify' not in sys.argv:
        for name,im in ims.items(): (OUT/name).write_bytes(pngbytes(im))
        (OUT/'kit.json').write_text(json.dumps(manifest(repair),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        whole.save(REC/'merged.png')
        compare()
        print(f'BUILT CM-GATE: concept crop [0,278,618,762], repaired ring cells={repair}')
    verify(ims,whole)
    if '--compare' in sys.argv: compare()

from walls import install
install(globals())

if __name__=='__main__': main()
