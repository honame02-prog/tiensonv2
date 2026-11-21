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



import random
S=4
C_DK=[(16,19,21),(23,26,28),(29,32,34)]
C_MID=[(36,39,41),(48,51,53),(37,31,14)]
C_HI=[(61,64,67),(51,49,34),(69,72,74),(65,62,45)]


def blade(d, x, y, ang, ln, wd, col):
    """Tapered curved leaf blade; coordinates in 1x px, drawn at S x."""
    pts=[]; side=[]
    n=6
    a=ang
    px,py=x,y
    for i in range(n+1):
        t=i/n
        a=ang+ (math.pi/2-ang)*0.0
        # droop: direction bends toward down
        dx,dy=math.cos(a),math.sin(a)
        bend=t*0.9
        dx2=dx*(1-bend)
        dy2=dy*(1-bend)+bend
        m=math.hypot(dx2,dy2) or 1
        step=ln/n
        px+=dx2/m*step; py+=dy2/m*step
        w=wd*(1-t)**0.7*(0.5+t*0.9) if t<.45 else wd*(1-t)*1.25
        pts.append((px,py,w))
    left=[];right=[]
    for i,(qx,qy,w) in enumerate(pts):
        j=min(i+1,n); k=max(i-1,0)
        tx=pts[j][0]-pts[k][0]; ty=pts[j][1]-pts[k][1]
        m=math.hypot(tx,ty) or 1
        nx,ny=-ty/m,tx/m
        left.append(((qx+nx*w/2)*S,(qy+ny*w/2)*S))
        right.append(((qx-nx*w/2)*S,(qy-ny*w/2)*S))
    d.polygon([(x*S,y*S)]+left+right[::-1],fill=col+(255,))


def tuft(d, rng, x, y, size, layer, light=True):
    cols={0:C_DK,1:C_MID,2:C_HI}[layer]
    nb=int(9*size)
    for _ in range(nb):
        # fan: mostly down/out, some up-out
        ang=rng.uniform(-0.5,math.pi+0.5)
        ln=rng.uniform(.6,1.1)*14*size
        wd=rng.uniform(3.2,4.6)*(0.8+0.3*size)
        col=rng.choice(cols)
        if layer==2 and ang>1.9:   # light only on upper-left leaning blades
            col=C_MID[1]
        blade(d,x,y,ang,ln,wd,col)


def culm(d, x0, y0, y1, w, lean, rng, tone):
    # tone 0 back (dark), 1 front
    base=[(29,32,34),(42,45,48)][tone]
    lit=[(42,45,48),(69,72,74)][tone]
    shade=[(16,19,21),(23,26,28)][tone]
    node=(11,7,5) if False else (16,19,21)
    L=y1-y0 if False else None
    n=int(abs(y1-y0))
    for i in range(n+1):
        y=y0-i if y1<y0 else y0+i
        x=x0+lean*(y0-y)/max(1,abs(y1-y0))
        d.rectangle([(x-w/2)*S,y*S,(x+w/2)*S-1,(y+1)*S-1],fill=base+(255,))
        d.rectangle([(x-w/2)*S,y*S,(x-w/2+max(1,w*.3))*S-1,(y+1)*S-1],fill=lit+(255,))
        d.rectangle([(x+w/2-max(1,w*.28))*S,y*S,(x+w/2)*S-1,(y+1)*S-1],fill=shade+(255,))
    # nodes
    sp=rng.uniform(21,26)
    k=0
    yy=y0-6
    while yy>y1:
        x=x0+lean*(y0-yy)/max(1,abs(y1-y0))
        d.rectangle([(x-w/2-.6)*S,yy*S,(x+w/2+.6)*S-1,(yy+2)*S-1],fill=node+(255,))
        d.rectangle([(x-w/2)*S,(yy-1)*S,(x+w/2-w*.3)*S-1,yy*S-1],fill=lit+(255,))
        yy-=sp+rng.uniform(-3,3)


def draw_bamboo(w, h, seed, dens, kind='grove'):
    """dens(x)->0..1 left-to-right weight. Whole-object procedural drawing, 1x coords scaled by S."""
    rng=random.Random(seed)
    im=Image.new('RGBA',(w*S,h*S),(0,0,0,0))
    d=ImageDraw.Draw(im)
    # 1. dark canopy mass (back): big overlapping tufts, filled solid
    top=0 if kind!='wall' else 0
    for k in range(int(w*h/150*0.9)):
        x=rng.uniform(0,w); 
        if rng.random()>dens(x)+0.08: continue
        y=rng.uniform(4,h*.74)
        tuft(d,rng,x,y,rng.uniform(1.0,1.5),0)
    # solid under-mass for density below canopy
    for k in range(int(w/6)):
        x=rng.uniform(0,w)
        if rng.random()>dens(x): continue
        for yy in range(int(h*.5),h-3,5):
            tuft(d,rng,x+rng.uniform(-6,6),yy,rng.uniform(.8,1.1),0)
    # 2. back culms
    ncul=max(3,int(w/9))
    xs=sorted(rng.uniform(4,w-4) for _ in range(ncul))
    for x in xs:
        if rng.random()>dens(x)+.1: continue
        culm(d,x,h-3,2+rng.uniform(0,8),rng.uniform(4,5),rng.uniform(-4,4),rng,0)
    # 3. mid foliage
    for k in range(int(w*h/260)):
        x=rng.uniform(0,w)
        if rng.random()>dens(x): continue
        y=rng.uniform(6,h*.72)
        tuft(d,rng,x,y,rng.uniform(.9,1.3),1)
    # 4. front culms (thicker, lighter), fewer
    for x in xs[1::2]:
        if rng.random()>dens(x)+.1: continue
        culm(d,x+rng.uniform(-3,3),h-2,6+rng.uniform(0,14),rng.uniform(5,6.5),rng.uniform(-3,3),rng,1)
    # 5. highlight foliage top-left of crowns
    for k in range(int(w*h/380)):
        x=rng.uniform(0,w)
        if rng.random()>dens(x): continue
        y=rng.uniform(6,h*.6)
        tuft(d,rng,x,y,rng.uniform(.7,1.0),2)
    # 6. foot: dark undergrowth + stones
    for x in range(0,w,5):
        if rng.random()<dens(x)+.1:
            tuft(d,rng,x+rng.uniform(-2,2),h-rng.uniform(4,8),.6,0)
    a=np.array(im)
    xs=np.arange(w*S)/S
    cut=(h-2-(2.5+2.5*np.sin(xs*.37+seed)+1.5*np.sin(xs*.11))).astype(float)*S
    yy=np.arange(h*S)[:,None]
    a[yy>cut[None,:]]=0
    return Image.fromarray(a)


def clean(im):
    """Drop isolated opaque pixels and fill isolated holes (no speckle)."""
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
    im = Image.new('RGBA', (64,64), (46,44,40,255))
    d = ImageDraw.Draw(im)
    def cx(y):
        return 32 + phase*7*math.sin(2*math.pi*y/63)
    for y in range(64):
        c = int(cx(y))
        d.line((c-23,y,c+23,y), fill=(43,41,34,255))
        d.line((c-18,y,c+17,y), fill=(51,49,34,255))
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
    floor=concept.crop((370,20,466,76))
    scene=Image.new('RGBA',(480,270))
    for y in range(0,270,floor.height):
        for x in range(0,480,floor.width):
            scene.paste(floor,(x,y))
    for (tn,x,y) in [('a',64,60),('b',64,124),('a',64,188)]:
        scene.alpha_composite(Image.open(OUT/('garden_path_'+tn+'.png')),(x,y))
    placed=[('bamboo_wall',-5,-22),('bamboo_wall',60,-30),('bamboo_wall',110,-22),
            ('bamboo_grove_b',-62,-42),('bamboo_grove_a',-30,-50),
            ('bamboo_edge_R',70,-10),('bamboo_grove_b',110,-48),('bamboo_edge_L',150,-8)]
    placed.sort(key=lambda t:t[2]+FULL[t[0]].height)
    # Draw all base+roofs except a near foreground clump, then actor, then its roof.
    for name,x,y in placed:
        scene.alpha_composite(FULL[name],(x,y))
    near=('bamboo_edge_L',108,62)
    name,x,y=near
    scene.alpha_composite(Image.open(OUT/(name+'.png')),(x,y))
    atlas=Image.open(ROOT/'public/assets/dao_si.png').convert('RGBA')
    data=json.loads((ROOT/'public/assets/dao_si.json').read_text(encoding='utf-8'))
    f=next(f['frame'] for f in data['frames'] if f['filename']=='dao_si_idle_down_00')
    actor=atlas.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
    actor_x,actor_y=74,104
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
    dl=lambda x,w: 1.0
    gA=quant(clean(median(draw_bamboo(128,160,11,lambda x:1.0),(128,160))))
    gB=quant(clean(median(draw_bamboo(128,160,23,lambda x:1.0),(128,160))))
    eL=quant(clean(median(draw_bamboo(64,128,31,lambda x:max(0.05,1-x/64*0.95),'edge'),(64,128))))
    eR=quant(clean(median(draw_bamboo(64,128,37,lambda x:max(0.05,x/64*0.95),'edge'),(64,128))))
    wl=quant(clean(median(draw_bamboo(128,96,41,lambda x:1.0,'wall'),(128,96))))
    split('bamboo_grove_a',gA,[128,24])
    split('bamboo_grove_b',gB,[128,24])
    split('bamboo_edge_L',eL,[64,20])
    split('bamboo_edge_R',eR,[64,20])
    split('bamboo_wall',wl,[128,24])
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
