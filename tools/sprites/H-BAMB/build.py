"""H-BAMB: whole-object imagegen source -> cell median -> hall palette.
Run with Python 3 + Pillow + numpy; --verify --repro validates saved outputs.
Never samples vegetation from the scene concept or another kit.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'public/assets/kits/H-BAMB'
REC = ROOT / 'records/S1-BAMB'
SRC = HERE / 'src'
PAL = np.array(json.loads((SRC / 'palette.json').read_text(encoding='utf-8')), dtype=np.int32)
PIECES = {}
FULL = {}


def median(im, size):
    a = np.array(im.convert('RGBA'))
    w, h = size
    xs = np.rint(np.linspace(0, im.width, w+1)).astype(int)
    ys = np.rint(np.linspace(0, im.height, h+1)).astype(int)
    b = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            cell = a[ys[y]:ys[y+1], xs[x]:xs[x+1]]
            mask = cell[..., 3] >= 128
            if mask.sum() >= max(1, mask.size/2):
                b[y, x, :3] = np.median(cell[mask, :3], axis=0)
                b[y, x, 3] = 255
    return Image.fromarray(b)


def quant(im):
    a = np.array(im)
    mask = a[..., 3] > 0
    c = a[mask, :3].astype(np.int32)
    for i in range(0, len(c), 2048):
        d = ((c[i:i+2048, None] - PAL[None])**2).sum(axis=2)
        c[i:i+2048] = PAL[d.argmin(axis=1)]
    a[mask, :3] = c
    a[~mask] = 0
    return Image.fromarray(a)


def save(name, im, layer, anchor, footprint, collide=None, pair=None):
    im.save(OUT / (name+'.png'))
    p = dict(file=name+'.png', layer=layer, anchor=anchor, footprint=footprint,
             collide=collide or [])
    if pair:
        p['pair'] = pair
    PIECES[name] = p


def split(name, im, foot):
    a = np.array(im)
    h, w = a.shape[:2]
    # Entire canopy and upper culms are foreground, with a staggered lower edge.
    x = np.arange(w)
    line = (h*.71 + 3*np.sin(x*.13) + 2*np.cos(x*.29)).astype(int)
    roof_mask = np.arange(h)[:, None] < line[None]
    roof, base = a.copy(), a.copy()
    roof[~roof_mask] = 0
    base[roof_mask] = 0
    anchor = [0, h-2]
    save(name, Image.fromarray(base), 'base', anchor, foot,
         [[int(w*.22), -12, int(w*.52), 10]], name+'_roof')
    save(name+'_roof', Image.fromarray(roof), 'roof', anchor, foot)
    FULL[name] = im


def path_tile(phase):
    # Periodic centre line: every tile has the same north/south connection.
    im = Image.new('RGBA', (64,64), (31,29,25,255))
    d = ImageDraw.Draw(im)
    def cx(y):
        return 32 + phase*7*math.sin(2*math.pi*y/63)
    for y in range(64):
        c = int(cx(y))
        d.line((c-23,y,c+23,y), fill=(37,36,30,255))
        d.line((c-18,y,c+17,y), fill=(43,41,34,255))
    stones = [(-12, -8, 18, 15), (7, 0, 18, 14), (-8, 13, 23, 15),
              (10, 26, 20, 14), (-10, 39, 22, 15), (7, 52, 19, 16)]
    for i,(dx,y,w,h) in enumerate(stones):
        c = round(cx(y%64))+dx-w//2
        for sy in (y-64, y, y+64):
            poly=[(c+3,sy),(c+w-3,sy-1),(c+w,sy+4),(c+w-2,sy+h-2),
                  (c+4,sy+h),(c,sy+h-4),(c-1,sy+4)]
            d.polygon(poly, fill=(24,22,18,255))
            inset=[(a,b-2) for a,b in poly]
            d.polygon(inset, fill=(67,64,58,255) if i%2 else (74,70,62,255))
            d.line((c+4,sy-2,c+w-4,sy-3),fill=(90,87,80,255),width=2)
            d.line((c+5,sy+6,c+10,sy+7,c+11,sy+10),fill=(56,53,47,255),width=2)
    # Sparse grouped fallen leaves, no pixel noise/dither.
    for x,y in [(9,18),(51,40),(12,51),(50,8)]:
        d.polygon([(x,y),(x+5,y+2),(x+2,y+3)],fill=(51,49,34,255))
    a=np.array(im)
    a[-1]=a[0]
    a[:,-1]=a[:,0]
    return Image.fromarray(a)


def sheet():
    rows=[]
    for name,p in PIECES.items():
        im=Image.open(OUT/p['file']).convert('RGBA')
        rows.append((name, im, p))
    width=870
    height=sum(max(im.height*3,48)+33 for _,im,_ in rows)+12
    canvas=Image.new('RGB',(width,height),'#383832')
    d=ImageDraw.Draw(canvas)
    y=10
    for name,im,p in rows:
        d.text((10,y),f'{name}  {im.width}x{im.height}  anchor={p["anchor"]}',fill='#e0dbce')
        y+=22
        canvas.paste(im,(10,y),im)
        big=im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST)
        canvas.paste(big,(180,y),big)
        y+=max(big.height,48)+11
    canvas.save(REC/'sheet.png')


def assemble():
    concept=Image.open(SRC/'concept-V1.png').convert('RGB')
    # Only floor pixels are permitted concept reuse; sample open lower-right paving.
    floor=concept.crop((256,214,352,270))
    scene=Image.new('RGBA',(480,270))
    for y in range(0,270,floor.height):
        for x in range(0,480,floor.width):
            scene.paste(floor,(x,y))
    for y in (0,64,128):
        tile=Image.open(OUT/('garden_path_a.png' if y!=64 else 'garden_path_b.png'))
        scene.alpha_composite(tile,(81,y))
    placed=[('bamboo_wall',-5,-12),('bamboo_wall',90,-26),
            ('bamboo_grove_b',-35,-4),('bamboo_grove_a',40,-35),
            ('bamboo_edge_L',142,9),('bamboo_grove_b',-15,69),
            ('bamboo_edge_R',118,74)]
    # Draw all base+roofs except a near foreground clump, then actor, then its roof.
    for name,x,y in placed:
        scene.alpha_composite(FULL[name],(x,y))
    near=('bamboo_edge_R',83,56)
    name,x,y=near
    scene.alpha_composite(Image.open(OUT/(name+'.png')),(x,y))
    atlas=Image.open(ROOT/'public/assets/dao_si.png').convert('RGBA')
    data=json.loads((ROOT/'public/assets/dao_si.json').read_text(encoding='utf-8'))
    f=next(f['frame'] for f in data['frames'] if f['filename']=='dao_si_idle_down_00')
    actor=atlas.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
    actor_x,actor_y=88,102
    scene.alpha_composite(actor,(actor_x,actor_y))
    before=np.array(scene)
    scene.alpha_composite(Image.open(OUT/(name+'_roof.png')),(x,y))
    changed=np.any(np.array(scene)!=before,axis=2)
    am=np.zeros((270,480),bool)
    am[actor_y:actor_y+64,actor_x:actor_x+64]=np.array(actor)[...,3]>0
    hidden=int((changed&am).sum())
    scene.convert('RGB').save(REC/'assembly-scene.png')
    board=Image.new('RGB',(960,294),'#24241f')
    board.paste(concept,(0,24))
    board.paste(scene.convert('RGB'),(480,24))
    d=ImageDraw.Draw(board)
    d.text((8,7),'Concept C / V1 - native 480x270',fill='#d8d2c4')
    d.text((488,7),'H-BAMB / native 480x270 / real Dao Si',fill='#d8d2c4')
    board.save(REC/'assembly.png')
    return hidden


def build():
    OUT.mkdir(parents=True,exist_ok=True)
    REC.mkdir(parents=True,exist_ok=True)
    source=Image.open(SRC/'bamboo-source.png').convert('RGBA')
    # Full source silhouettes only; no crop of any source canopy or culm.
    a=quant(median(source,(128,160)))
    b=quant(median(source.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(128,160)))
    split('bamboo_grove_a',a,[128,24])
    split('bamboo_grove_b',b,[128,24])
    split('bamboo_edge_L',quant(median(source,(64,128))),[64,20])
    split('bamboo_edge_R',quant(median(source.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(64,128))),[64,20])
    split('bamboo_wall',quant(median(source,(128,96))),[128,24])
    for letter,phase in [('a',1),('b',-1)]:
        save('garden_path_'+letter,path_tile(phase),'ground',[0,64],[64,64])
    (OUT/'kit.json').write_text(json.dumps({'kit':'H-BAMB','pieces':PIECES},indent=2)+'\n',encoding='utf-8')
    sheet()
    hidden=assemble()
    return hidden


def verify(hidden):
    files=list(OUT.glob('*.png'))
    allowed=set(map(tuple,PAL.tolist()))
    off=semi=0
    for path in files:
        a=np.array(Image.open(path).convert('RGBA'))
        semi+=int(((a[...,3]!=0)&(a[...,3]!=255)).sum())
        off+=sum(tuple(c) not in allowed for c in a[a[...,3]>0,:3])
        assert np.all(a[a[...,3]==0]==0),path.name+' hidden RGB'
    assert off==semi==0,(off,semi)
    for letter in 'ab':
        a=np.array(Image.open(OUT/f'garden_path_{letter}.png'))
        assert np.array_equal(a[0],a[-1]) and np.array_equal(a[:,0],a[:,-1])
    for name,full in FULL.items():
        b=Image.open(OUT/(name+'.png')).convert('RGBA')
        b.alpha_composite(Image.open(OUT/(name+'_roof.png')))
        assert np.array_equal(np.array(b),np.array(full)),name+' split reconstruction'
    assert hidden>0,'Actor must visibly overlap foreground roof'
    return f'PASS H-BAMB: sprites={len(files)} K-A5={off} alpha_intermediate={semi} pairs=5 seamless_paths=2 actor_occluded_pixels={hidden}'


if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--verify',action='store_true')
    ap.add_argument('--repro',action='store_true')
    args=ap.parse_args()
    hidden=build()
    msg=verify(hidden) if args.verify else 'H-BAMB build complete'
    if args.repro:
        def hashes():
            return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.iterdir() if p.is_file()}
        first=hashes()
        hidden=build()
        assert first==hashes(),'Non-deterministic output'
        msg+=' reproducible=YES'
    (REC/'verify.log').write_text(msg+'\n',encoding='utf-8')
    print(msg)
