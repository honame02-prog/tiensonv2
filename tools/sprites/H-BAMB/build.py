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
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'public/assets/kits/H-BAMB'
REC = ROOT / 'records/S1-BAMB2'
SRC = HERE / 'src'
PAL = np.array(json.loads((SRC / 'palette.json').read_text(encoding='utf-8')), dtype=np.int32)
PIECES = {}
FULL = {}



# Generated whole-object sources; no concept foliage pixels are used.
# Material subset of hall: warm gray / moss olive, excluding cold blue-grays.
VEG_PAL = np.array([c for c in PAL.tolist() if tuple(c) in {
    (20,17,13),(31,29,25),(37,36,30),(43,41,34),(51,49,34),
    (52,49,43),(62,58,52),(65,62,45),(67,64,58),(74,70,62),
    (81,77,70),(90,87,80)}], dtype=np.int32)
MANIFEST = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
MANIFEST_SHA = hashlib.sha256((OUT / 'kit.json').read_bytes()).hexdigest()
ACTOR_STATS = {}


def source_sprite(filename, size, inset=2, shift=0, shade=1.0):
    src = Image.open(SRC / filename).convert('RGBA')
    a = np.array(src)
    # Ignore only the generator's low-alpha fringe; median makes binary alpha.
    a[a[...,3] < 128] = 0
    a[..., :3] = np.minimum(255, a[..., :3].astype(float)*shade).astype('uint8')
    src = Image.fromarray(a)
    src = src.crop(src.getbbox())
    w,h = size
    target = (w-2*inset-abs(shift), h-2*inset)
    obj = clean(median(src, target))
    obj = quant(obj, VEG_PAL)
    canvas = Image.new('RGBA', size)
    canvas.alpha_composite(obj, (inset+max(0,shift),inset))
    return canvas


def clean(im):
    """Drop isolated opaque pixels (no speckle)."""
    a=np.array(im); al=a[...,3]>0
    n=sum(np.roll(np.roll(al,dy,0),dx,1).astype(int) for dy in(-1,0,1) for dx in(-1,0,1) if dx or dy)
    a[al&(n<=1)]=0
    return Image.fromarray(a)


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


def quant(im, palette=PAL):
    a = np.array(im)
    mask = a[..., 3] > 0
    c = a[mask, :3].astype(np.int32)
    for i in range(0, len(c), 2048):
        d = ((c[i:i+2048, None] - palette[None])**2).sum(axis=2)
        c[i:i+2048] = palette[d.argmin(axis=1)]
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


def path_centre(y, phase):
    # Flat tangent at the common connectors: A/A, A/B, B/A and B/B all join.
    t = max(0.0,min(1.0,(y-4)/55))
    return 32 + phase*14*math.sin(math.pi*t)**2


def path_tile(phase):
    im = Image.new('RGBA', (64,64), (46,44,40,255))
    d = ImageDraw.Draw(im)
    for y in range(64):
        c = round(path_centre(y,phase))
        d.line((c-16,y,c+16,y), fill=(43,41,34,255))
        d.line((c-13,y,c+13,y), fill=(51,49,34,255))
    # Small worn stepping stones follow the curve instead of a straight strip.
    for i,cy in enumerate([0,11,22,33,44,55]):
        c = round(path_centre(cy,phase)) + (0 if i==0 else (-3 if i%2 else 3))
        rw = [11,10,12,10,11,10][i]
        for sy in [cy-63,cy,cy+63]:
            poly=[(c-rw+3,sy-5),(c+rw-3,sy-5),(c+rw,sy-2),
                  (c+rw-2,sy+4),(c-rw+2,sy+5),(c-rw,sy+1)]
            d.polygon([(x,y+2) for x,y in poly],fill=(24,22,18,255))
            d.polygon(poly,fill=(74,70,62,255) if i%2 else (67,64,58,255))
            d.line((c-rw+3,sy-5,c+rw-3,sy-5),fill=(90,87,80,255))
            d.line((c-rw+5,sy-1,c-rw+8,sy,c-rw+8,sy+2),fill=(56,53,47,255))
    for x,y in [(6,18),(55,40),(8,51),(54,8)]:
        d.polygon([(x,y),(x+5,y+2),(x+2,y+3)],fill=(51,49,34,255))
    return im


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
    # The sole permitted concept reuse: open paving for this assembly only.
    floor=concept.crop((370,20,466,76))
    scene=Image.new('RGBA',(480,270))
    for y in range(0,270,floor.height):
        for x in range(0,480,floor.width):
            scene.paste(floor,(x,y))
    for tn,y in [('a',60),('b',124),('a',188)]:
        scene.alpha_composite(Image.open(OUT/('garden_path_'+tn+'.png')),(65,y))
    placed=[('bamboo_wall',-8,-30),('bamboo_wall',80,-42),
            ('bamboo_grove_b',-47,-35),('bamboo_grove_a',53,-55),
            ('bamboo_edge_R',145,-18)]
    for name,x,y in sorted(placed,key=lambda t:t[2]+FULL[t[0]].height):
        scene.alpha_composite(FULL[name],(x,y))
    atlas=Image.open(ROOT/'public/assets/dao_si.png').convert('RGBA')
    data=json.loads((ROOT/'public/assets/dao_si.json').read_text(encoding='utf-8'))
    f=next(f['frame'] for f in data['frames'] if f['filename']=='dao_si_idle_down_00')
    actor=atlas.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
    actor_x,actor_y=69,108
    actor_mask=np.array(actor)[...,3]>0
    ys=np.where(actor_mask)[0]
    upper = np.indices(actor_mask.shape)[0] <= ys.min() + int((ys.max()-ys.min())*.28)
    total=int(actor_mask.sum())
    roof=Image.open(OUT/'bamboo_edge_L_roof.png').convert('RGBA')
    # Find a genuine tip overlap on the actor's upper silhouette only.
    options=[]
    for x in range(48,96):
        for y in range(18,53):
            mask=Image.new('RGBA',scene.size)
            mask.alpha_composite(roof,(x,y))
            coverage=np.array(mask)[actor_y:actor_y+64,actor_x:actor_x+64,3]>0
            hidden=int((coverage&actor_mask).sum())
            lower=int((coverage&actor_mask&~upper).sum())
            if 0<hidden<=total*.4 and lower==0:
                options.append((abs(hidden/total-.055),x,y,hidden))
    assert options, 'No safe canopy-tip overlap found'
    _,x,y,hidden=min(options)
    scene.alpha_composite(Image.open(OUT/'bamboo_edge_L.png'),(x,y))
    scene.alpha_composite(actor,(actor_x,actor_y))
    scene.alpha_composite(roof,(x,y))
    ACTOR_STATS.update(total=total,hidden=hidden,visible_pct=round(100*(1-hidden/total),2),
                       upper_only=True,position=[actor_x,actor_y],foreground=[x,y])
    scene.convert('RGB').save(REC/'assembly-scene.png')
    board=Image.new('RGB',(960,294),'#24241f')
    board.paste(concept,(0,24))
    board.paste(scene.convert('RGB'),(480,24))
    d=ImageDraw.Draw(board)
    d.text((8,7),'Concept C / V1 - native 480x270',fill='#d8d2c4')
    d.text((488,7),f'H-BAMB2 / Dao Si visible {ACTOR_STATS["visible_pct"]}%',fill='#d8d2c4')
    board.save(REC/'assembly.png')
    return hidden


def build():
    OUT.mkdir(parents=True,exist_ok=True)
    REC.mkdir(parents=True,exist_ok=True)
    gA=source_sprite('grove-imagegen-v2.png',(128,160))
    gB=source_sprite('grove-imagegen-v2.png',(128,160),inset=3,shift=7,shade=.92)
    eL=source_sprite('edge-imagegen-v2.png',(64,128),inset=2)
    # Use a complete grove for the opposite edge: no mirror that reverses light.
    eR=source_sprite('grove-imagegen-v2.png',(64,128),inset=3,shift=3)
    wl=source_sprite('grove-imagegen-v2.png',(128,96),inset=2,shade=.8)
    split('bamboo_grove_a',gA,[128,24])
    split('bamboo_grove_b',gB,[128,24])
    split('bamboo_edge_L',eL,[64,20])
    split('bamboo_edge_R',eR,[64,20])
    split('bamboo_wall',wl,[128,24])
    for letter,phase in [('a',1),('b',-1)]:
        save('garden_path_'+letter,path_tile(phase),'ground',[0,64],[64,64])
    assert {'kit':'H-BAMB','pieces':PIECES} == MANIFEST, 'Manifest metadata changed'
    assert hashlib.sha256((OUT/'kit.json').read_bytes()).hexdigest() == MANIFEST_SHA
    sheet()
    hidden=assemble()
    return hidden


def verify(hidden):
    files=list(OUT.glob('*.png'))
    assert {p.name for p in files} == {p['file'] for p in MANIFEST['pieces'].values()}
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
    assert 0 < hidden <= ACTOR_STATS['total']*.4, 'Actor visibility below 60%'
    assert ACTOR_STATS['upper_only']
    # All variant combinations share both connector rows, including stone edges.
    aa=np.array(Image.open(OUT/'garden_path_a.png'))
    bb=np.array(Image.open(OUT/'garden_path_b.png'))
    assert np.array_equal(aa[0],bb[-1]) and np.array_equal(bb[0],aa[-1])
    for name,full in FULL.items():
        a=np.array(full); mask=a[...,3]>0
        assert not mask[0].any() and not mask[-1].any()
        assert not mask[:,0].any() and not mask[:,-1].any(), name+' clipped edge'
    (REC/'metrics.json').write_text(json.dumps({'actor':ACTOR_STATS,'manifest_sha256':MANIFEST_SHA,'sprites':{name:{'size':list(Image.open(OUT/p['file']).size),'anchor':p['anchor']} for name,p in PIECES.items()}},indent=2)+'\n',encoding='utf-8')
    return f'PASS H-BAMB: sprites={len(files)} K-A5={off} alpha_intermediate={semi} pairs=5 seamless_paths=2 actor_occluded_pixels={hidden} actor_visible_pct={ACTOR_STATS['visible_pct']} upper_tips_only=YES manifest_unchanged=YES'


if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--verify',action='store_true')
    ap.add_argument('--repro',action='store_true')
    args=ap.parse_args()
    hidden=build()
    msg=verify(hidden) if args.verify else 'H-BAMB build complete'
    if args.repro:
        def hashes():
            return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in list(OUT.iterdir()) + list(REC.glob('*.png')) if p.is_file()}
        first=hashes()
        hidden=build()
        assert first==hashes(),'Non-deterministic output'
        msg+=' reproducible=YES'
    (REC/'verify.log').write_text(msg+'\n',encoding='utf-8')
    print(msg)
