"""H-BAMB round 3: dense round-one geometry -> cell median -> warm hall palette.
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
from geometry import draw_bamboo

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'public/assets/kits/H-BAMB'
REC = ROOT / 'records/S1-BAMB3r'
SRC = HERE / 'src'
PAL = np.array(json.loads((SRC / 'palette.json').read_text(encoding='utf-8')), dtype=np.int32)
PIECES = {}
FULL = {}



# Complete-object procedural geometry; no concept foliage pixels are used.
# Material subset of hall: warm gray / moss olive, excluding cold blue-grays.
VEG_PAL = np.array([c for c in PAL.tolist() if tuple(c) in {
    (20,17,13),(31,29,25),(37,36,30),(43,41,34),(51,49,34),
    (52,49,43),(62,58,52),(65,62,45),(67,64,58),(74,70,62),
    (81,77,70),(90,87,80)}], dtype=np.int32)
MANIFEST = json.loads((OUT / 'kit.json').read_text(encoding='utf-8'))
MANIFEST_SHA = hashlib.sha256((OUT / 'kit.json').read_bytes()).hexdigest()
ACTOR_STATS = {}
CANOPY_STATS = {}
NODE_STATS = {}


def dense_sprite(w, h, seed, kind='grove'):
    """Round-one forest mass with round-two warm material and node lighting."""
    if kind == 'left':
        density = lambda x: max(.08, 1-x/w*.9)
    elif kind == 'right':
        density = lambda x: max(.08, x/w*.9)
    else:
        density = lambda x: 1.0
    im = quant(clean(median(draw_bamboo(w,h,seed,density,kind),(w,h))),VEG_PAL)
    a = np.array(im)
    # Complete pieces have a clean, transparent one-pixel perimeter.
    a[0]=a[-1]=0
    a[:,0]=a[:,-1]=0
    return Image.fromarray(a)


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
    im = Image.new('RGBA', (64,64))
    d = ImageDraw.Draw(im)
    for y in range(64):
        c = round(path_centre(y,phase))
        # Binary alpha, with an irregular curved moss fringe rather than a tile
        # background. Broad value bands soften the stone shadows without dither.
        fringe = round(2*math.sin(2*math.pi*y/63)**2 + math.sin(4*math.pi*y/63)**2)
        d.line((c-14-fringe,y,c+13+fringe,y), fill=(62,58,52,255))
        d.line((c-14,y,c+14,y), fill=(51,49,34,255))
        d.line((c-12,y,c+12,y), fill=(43,41,34,255))
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
    for x,y in [(17,18),(47,40),(18,51),(46,8)]:
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
    board=Image.new('RGB',(1440,294),'#24241f')
    board.paste(concept,(0,24))
    board.paste(Image.open(SRC/'baseline-v1/assembly-scene.png').convert('RGB'),(480,24))
    board.paste(scene.convert('RGB'),(960,24))
    d=ImageDraw.Draw(board)
    d.text((8,7),'Concept C / V1 - native 480x270',fill='#d8d2c4')
    d.text((488,7),'Round 1 / ada254d / native 480x270',fill='#d8d2c4')
    d.text((968,7),f'Round 3 / Dao Si visible {ACTOR_STATS["visible_pct"]}%',fill='#d8d2c4')
    board.save(REC/'assembly.png')
    return hidden


def build():
    OUT.mkdir(parents=True,exist_ok=True)
    REC.mkdir(parents=True,exist_ok=True)
    gA=dense_sprite(128,160,11)
    gB=dense_sprite(128,160,23)
    eL=dense_sprite(64,128,31,'left')
    eR=dense_sprite(64,128,37,'right')
    wl=dense_sprite(128,96,41,'wall')
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
        bright=np.all(a[...,:3]==[81,77,70],axis=2)&mask
        dark=np.all(a[...,:3]==[20,17,13],axis=2)&mask
        # A readable node has a 3-wide, 2-high light lip above its dark ring.
        count=sum(bright[y:y+2,x:x+3].all() and dark[y+2,x:x+3].all()
                  for y in range(a.shape[0]-3) for x in range(a.shape[1]-2))
        NODE_STATS[name]=int(count)
        assert count>0, name+' missing two-pixel node highlight'
    for name in ['bamboo_grove_a','bamboo_grove_b']:
        mask=np.array(FULL[name])[...,3]>0
        baseline=np.array(Image.open(SRC/'baseline-v1'/(name+'.png')))[...,3]>0
        canopy_h=int(mask.shape[0]*.71)
        CANOPY_STATS[name]={
            'whole_frame_pct':round(float(mask.mean()*100),4),
            'v1_whole_frame_pct':round(float(baseline.mean()*100),4),
            'canopy_upper71_pct':round(float(mask[:canopy_h].mean()*100),4),
            'v1_canopy_upper71_pct':round(float(baseline[:canopy_h].mean()*100),4)}
        assert mask.mean()>=.85 and mask.sum()>=baseline.sum(), (name,CANOPY_STATS[name])
        assert mask[:canopy_h].sum()>=baseline[:canopy_h].sum(), (name,'canopy below v1')
    for letter in 'ab':
        a=np.array(Image.open(OUT/f'garden_path_{letter}.png'))
        assert not a[:,0,3].any() and not a[:,-1,3].any(), 'Opaque rectangular path edge'
        assert a[...,3].mean()/255<.75, 'Path needs open floor around moss fringe'
    (REC/'metrics.json').write_text(json.dumps({'actor':ACTOR_STATS,'canopy':CANOPY_STATS,'node_2px_highlight_matches':NODE_STATS,'manifest_sha256':MANIFEST_SHA,'sprites':{name:{'size':list(Image.open(OUT/p['file']).size),'anchor':p['anchor']} for name,p in PIECES.items()}},indent=2)+'\n',encoding='utf-8')
    coverage='/'.join(str(CANOPY_STATS[n]['whole_frame_pct']) for n in CANOPY_STATS)
    return f'PASS H-BAMB: sprites={len(files)} K-A5={off} alpha_intermediate={semi} pairs=5 seamless_paths=2 actor_occluded_pixels={hidden} actor_visible_pct={ACTOR_STATS['visible_pct']} upper_tips_only=YES manifest_unchanged=YES grove_frame_coverage_pct={coverage} canopy_ge_v1=YES nodes_2px=YES path_rectangle=NO'


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
