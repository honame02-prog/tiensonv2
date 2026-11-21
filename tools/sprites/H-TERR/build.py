"""S1-TERR2: single-object ImageGen sources, cell median and hall mineral palette.
Run from any directory: python -X utf8 tools/sprites/H-TERR/build.py [--verify|--repro]
Native join geometry is retained; source texture is sampled by area median.
Only the assembly's paving is sampled from the approved concept.
"""
from pathlib import Path
import colorsys
import hashlib
import json
import sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
DESIGN = Path('D:/SkillFX_TuThienChi_HoaLien/design/tienson')
OUT = ROOT/'public/assets/kits/H-TERR'
REC = ROOT/'records/S1-TERR2'
SRC = Path(__file__).resolve().parent/'src'
HALL = DESIGN/'tam-thanh/TT2/src/hall-reference.png'
CONCEPT = DESIGN/'hvq-scene/C/V1.png'
PAL = sorted({tuple(p[:3]) for p in Image.open(HALL).convert('RGBA').getdata() if p[3]})
assert len(PAL) == 48


def color(rgb):
    return min(PAL, key=lambda p: sum((int(a)-int(b))**2 for a, b in zip(p, rgb)))+(255,)


# Warm mineral family only; no black outlines, red timber or glazed gold.
C = {k: color(v) for k, v in {
    'joint': (43,41,34), 'shade': (56,53,47), 'dark': (67,64,58),
    'stone': (81,77,70), 'light': (97,97,95), 'edge': (116,114,110),
    'top': (140,135,130), 'moss': (51,49,34), 'olive': (65,62,45),
    'mid': (90,87,80), 'bottom': (37,36,30),
}.items()}
PIECES = {}
IMAGES = {}


def put(name, im, anchor, footprint, layer='ground', collide=None):
    a = np.array(im)
    # Palette quantization, no dither, binary alpha, clean transparent RGB.
    for p in np.unique(a[a[...,3]>0,:3], axis=0):
        a[np.all(a[...,:3] == p, axis=2) & (a[...,3]>0), :3] = color(p)[:3]
    a[a[...,3] == 0] = 0
    im = Image.fromarray(a)
    IMAGES[name] = im
    PIECES[name] = dict(file=name+'.png', layer=layer, anchor=anchor,
                        footprint=footprint, collide=collide or [])
    im.save(OUT/(name+'.png'))


def cell_sample(a, width, height):
    """TT2 area median; alpha by occupied majority, never nearest shrink."""
    out = np.zeros((height,width,4),np.uint8)
    ys=np.rint(np.linspace(0,a.shape[0],height+1)).astype(int)
    xs=np.rint(np.linspace(0,a.shape[1],width+1)).astype(int)
    for y in range(height):
        for x in range(width):
            b=a[ys[y]:ys[y+1],xs[x]:xs[x+1]]
            m=b[...,3]>=200
            if m.sum()>=max(1,m.size/2):
                out[y,x,:3]=np.median(b[m,:3],axis=0)
                out[y,x,3]=255
    return out


def source(name, width, height):
    a=np.array(Image.open(SRC/name).convert('RGBA'))
    m=a[...,3]>=200
    ys,xs=np.where(m)
    a=a[ys.min():ys.max()+1,xs.min():xs.max()+1]
    a=cell_sample(a,width,height)
    # Material-aware tone mapping keeps warm mineral and olive families.
    mineral=np.array([p for p in PAL if abs(p[0]-p[1])<=8 and
                      0<=p[1]-p[2]<=15 and 37<=sum(p)/3<=140])
    olive=np.array([(51,49,34),(65,62,45)])
    rgb=a[...,:3].astype(float)
    lum=rgb@np.array([.2126,.7152,.0722])
    moss=(rgb[...,1]-rgb[...,2]>20)&((rgb[...,0]-rgb[...,1])<.45*(rgb[...,1]-rgb[...,2]))&(lum<110)
    tone=np.where(lum>=78,np.maximum(lum*.60+22,81),lum*.66+13)
    target=np.stack([tone+3,tone,tone-6],axis=-1)
    for y,x in zip(*np.where(a[...,3]>0)):
        family=olive if moss[y,x] else mineral
        q=rgb[y,x]*.50 if moss[y,x] else target[y,x]
        a[y,x,:3]=family[((family-q)**2).sum(axis=1).argmin()]
    # Remove isolated dark/bright flecks only, retain connected mortar and wear.
    clean=a.copy()
    for y in range(1,height-1):
        for x in range(1,width-1):
            b=a[y-1:y+2,x-1:x+2]
            if not (b[...,3]==255).all(): continue
            vals,counts=np.unique(b[...,:3].reshape(-1,3),axis=0,return_counts=True)
            winner=vals[counts.argmax()]
            if counts.max()>=5 and abs(float(a[y,x,:3].mean())-winner.mean())>24:
                clean[y,x,:3]=winner
    return Image.fromarray(clean)


WALL = source('imagegen-wall.png',192,50)
RAIL = source('imagegen-balus.png',140,30)


def masonry(w, damp=False):
    """Whole-object median source; native opaque silhouette and end joins."""
    a=np.array(WALL.crop((0,0,w,50)))
    for y in range(50):
        occupied=np.where(a[y,:,3]>0)[0]
        for x in np.where(a[y,:,3]==0)[0]:
            a[y,x]=a[y,occupied[np.argmin(abs(occupied-x))]] if len(occupied) else C['stone']
    if w==192:
        # Long 6-cell runs: lift the brightest sub-70 face tone one step to stone.
        lum=a[...,:3].mean(axis=2)
        a[6:48][(abs(lum[6:48]-63)<1)&(a[6:48,:,3]>0),:3]=C['stone'][:3]
    im=Image.fromarray(a)
    d=ImageDraw.Draw(im)
    # Flat joining strip; chipped highlights use connected 2px clusters.
    d.line((0,0,w-1,0),fill=C['top'])
    d.line((0,5,w-1,5),fill=C['shade'])
    if damp:
        # Sparse vine is a continuous stem, never floating dark square dots.
        x=min(w-15,82)
        d.line([(x,3),(x,12),(x-2,18),(x-2,28),(x-4,35)],fill=C['moss'],width=2)
        for yy,xx in [(10,x-4),(18,x),(27,x-6)]:
            d.polygon([(xx,yy),(xx+4,yy),(xx+3,yy+2),(xx,yy+3)],fill=C['olive'])
        for xx in [w//3,w-23]:
            # Thin wet runs that remain attached to coping/mortar.
            d.line([(xx,6),(xx,12),(xx+1,18)],fill=C['olive'],width=2)
            d.line([(xx+1,18),(xx+1,23)],fill=C['dark'],width=2)
    return im


def closed_end(side, corner=False):
    h=82 if corner else 50
    y=h-50
    im=Image.new('RGBA',(32,h))
    im.alpha_composite(masonry(32),(0,y))
    right=side=='R'
    x0=16 if right else 0
    # Solid 16px return; each course has a closed, shaded end plane.
    ret=np.array(masonry(32).crop((0,0,16,50)))
    if right:
        original=ret.copy()
        for rgb in np.unique(original[...,:3].reshape(-1,3),axis=0):
            ret[np.all(original[...,:3]==rgb,axis=2),:3]=color(rgb.astype(float)*.82)[:3]
    ret=Image.fromarray(ret)
    if corner:
        im.alpha_composite(ret,(x0,0))
        im.alpha_composite(ret.crop((0,18,16,50)),(x0,50))
    else:
        im.alpha_composite(ret,(x0,0))
    d=ImageDraw.Draw(im)
    if corner:
        d.rectangle((x0,0,x0+4,y+4),fill=C['edge'])
        d.line((x0,0,x0,y+4),fill=C['top'])
        d.line((x0+5,5,x0+5,y+4),fill=C['shade'])
    d.rectangle((0,y,31,y+2),fill=C['edge'])
    d.line((0,y,31,y),fill=C['top'])
    d.line((0,y+5,31,y+5),fill=C['shade'])
    # Exposed upright arris and foot close the end without a black outline.
    edge=x0+15 if right else x0
    d.line((edge,y+6,edge,h-2),fill=C['dark'] if right else C['light'])
    d.line((x0,h-1,x0+15,h-1),fill=C['shade'])
    return im


def rail_skin(im, offset=0):
    a=np.array(im); tex=np.array(RAIL)
    for y,x in zip(*np.where(a[...,3]>0)):
        tx=min(139,x+offset)
        if tex[y,tx,3]: a[y,x,:3]=tex[y,tx,:3]
    return Image.fromarray(a)


def post(d,x):
    # x is post centre, foot y=29. Cap is chipped yet closed, 28px high.
    d.rectangle((x-4,7,x+3,26),fill=C['stone'])
    d.rectangle((x-4,7,x-2,26),fill=C['edge'])
    d.rectangle((x+2,8,x+3,26),fill=C['dark'])
    d.rectangle((x-5,25,x+4,29),fill=C['mid'])
    d.line((x-5,25,x+3,25),fill=C['edge'])
    d.rectangle((x-5,3,x+4,6),fill=C['mid'])
    d.rectangle((x-4,2,x+2,3),fill=C['top'])
    d.rectangle((x-5,4,x+2,4),fill=C['edge'])
    d.line((x+4,4,x+4,6),fill=C['dark'])
    d.rectangle((x-1,11,x,19),fill=C['light'])
    d.rectangle((x-4,27,x-2,29),fill=C['olive'])


def balustrade(w):
    im = Image.new('RGBA',(w+12,30))
    d = ImageDraw.Draw(im)
    # Nominal span w, with 6px end overhang: centres 0,32,...w in world.
    d.rectangle((6,10,w+6,14),fill=C['mid'])
    d.line((6,10,w+6,10),fill=C['edge'])
    d.line((6,14,w+6,14),fill=C['shade'])
    d.rectangle((6,23,w+6,27),fill=C['stone'])
    d.line((6,23,w+6,23),fill=C['light'])
    d.line((6,27,w+6,27),fill=C['dark'])
    # Broad open slots between vertical posts, no diagonal supports.
    for x in range(6,w+7,32):
        post(d,x)
    return rail_skin(im)


def assembly():
    concept = Image.open(CONCEPT).convert('RGBA')
    # Exception permitted by S1-common: paving ONLY. No architecture copied.
    floor = concept.crop((215,28,475,138))
    canvas = Image.new('RGBA',(480,270))
    for y in range(0,270,floor.height):
        for x in range(0,480,floor.width):
            canvas.paste(floor,(x,y))
    placements=[]
    def place(name,x,y):
        ax,ay=PIECES[name]['anchor']
        canvas.alpha_composite(IMAGES[name],(x-ax,y-ay))
        placements.append(dict(k='H-TERR/'+name,x=x,y=y))
    # Main terrace with actual stair kit at its opening; no stair pixels modified.
    for name,x in [('rwall_2',24),('rwall_4_b',88),('rwall_2',216)]:
        place(name,x,156)
    place('rwall_end_L',8,156)
    place('rwall_end_R',280,156)
    for name,x in [('balus_2',24),('balus_4',88),('balus_2',216)]:
        place(name,x,156)
    stairs=ROOT/'public/assets/kits/H-STAIR'
    def stair(name,x,y):
        meta=json.loads((stairs/'kit.json').read_text(encoding='utf-8'))['pieces'][name]
        ax,ay=meta['anchor']
        canvas.alpha_composite(Image.open(stairs/meta['file']).convert('RGBA'),(x-ax,y-ay))
        placements.append(dict(k='H-STAIR/'+name,x=x,y=y))
    stair('stair_3',312,220)
    stair('stair_cheek_L',294,220)
    stair('stair_cheek_R',408,220)
    place('rwall_2_b',416,156)
    place('rwall_end_L',416,156)
    place('balus_2',416,156)
    # Separate sample dais exercises BOTH elbows and both closed return planes.
    place('rwall_corner_L',50,220)
    place('rwall_4_b',82,220)
    place('rwall_corner_R',210,220)
    place('balus_4',82,220)
    place('balus_post',50,188)
    place('balus_post',226,188)
    # Real, unmodified 64px Dao Si frame, pivot (32,61).
    frames=json.loads((ROOT/'public/assets/dao_si.json').read_text(encoding='utf-8'))['frames']
    frame=next(f for f in frames if f['filename']=='dao_si_idle_down_00')['frame']
    atlas=Image.open(ROOT/'public/assets/dao_si.png').convert('RGBA')
    actor=atlas.crop((frame['x'],frame['y'],frame['x']+64,frame['y']+64))
    for x,y in [(220,132),(362,205)]:
        canvas.alpha_composite(actor,(x-32,y-61))
    canvas.save(REC/'assembly-frame.png')
    together=Image.new('RGB',(976,294),'#24241f')
    together.paste(concept,(0,24))
    together.paste(canvas,(496,24))
    d=ImageDraw.Draw(together)
    d.text((8,7),'APPROVED TARGET C / V1 / 1x',fill='#b9b1a9')
    d.text((504,7),'H-TERR R2 / 1x / joined H-STAIR',fill='#b9b1a9')
    together.save(REC/'assembly.png')
    (REC/'placements.json').write_text(json.dumps(placements,indent=2)+'\n',encoding='utf-8')


def sheet():
    # Every piece, unscaled + 3x nearest, name and native dimensions.
    rowh=370
    sh=Image.new('RGB',(1280,rowh*((len(IMAGES)+1)//2)),'#24241f')
    d=ImageDraw.Draw(sh)
    for i,(name,im) in enumerate(IMAGES.items()):
        x=(i%2)*640+14; y=(i//2)*rowh+12
        d.text((x,y),f'{name} {im.width}x{im.height} anchor={PIECES[name]["anchor"]}',fill='#b9b1a9')
        # Alpha checker kept separate from sprite pixels.
        sh.paste(im,(x,y+22),im)
        big=im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST)
        sh.paste(big,(x,y+84),big)
    sh.save(REC/'sheet.png')


def verify():
    kit=json.loads((OUT/'kit.json').read_text(encoding='utf-8'))
    palette=set(PAL); outside=gold=0; pixels=0
    assert kit['kit']=='H-TERR'
    for name,p in kit['pieces'].items():
        a=np.array(Image.open(OUT/p['file']).convert('RGBA'))
        assert set(np.unique(a[...,3])) <= {0,255},name
        assert (a[a[...,3]==0,:3]==0).all(),name
        assert 0 <= p['anchor'][0] <= a.shape[1] and 0 <= p['anchor'][1] <= a.shape[0],name
        for rgb,n in zip(*np.unique(a[a[...,3]>0,:3],axis=0,return_counts=True)):
            outside += int(n) if tuple(rgb) not in palette else 0
            h,s,v=colorsys.rgb_to_hsv(*(rgb.astype(float)/255))
            if 40 <= h*360 <= 60 and s>.45 and v>.6:
                gold+=int(n)
        pixels+=int((a[...,3]>0).sum())
        if name.startswith('rwall_') and name.split('_')[1] in ('2','4','6'):
            assert a.shape==(50,int(name.split('_')[1])*32,4)
            assert (a[...,3]==255).all(),name
            # Luminance of face excludes coping: keep substantial light stone.
            face=a[6:48,:,:3].mean(axis=2)
            assert (face>=70).mean()>.65,(name,'face too dark')
        if name in ('balus_2','balus_4'):
            span=int(name[-1])*32
            assert p['anchor']==[6,30]
            for x in range(6,span+7,32):
                assert (a[8:23,x,3]==255).all(),(name,'post not vertical')
            for x in range(22,span,32):
                assert (a[15:23,x,3]==0).all(),(name,'slot closed')
    assert outside==gold==0
    assert set(p['file'] for p in kit['pieces'].values())==set(p.name for p in OUT.glob('*.png'))
    assert Image.open(REC/'assembly-frame.png').size==(480,270)
    return f'PASS H-TERR pieces={len(kit["pieces"])} K-A5={outside} gold={gold} alpha=0/255 pixels={pixels} post-pitch=32 closed-ends=4'


def main():
    OUT.mkdir(parents=True,exist_ok=True); REC.mkdir(parents=True,exist_ok=True)
    for n in (2,4,6):
        for suffix,damp in [('',False),('_b',True)]:
            put(f'rwall_{n}{suffix}',masonry(n*32,damp),[0,0],[n*32,6],collide=[[0,0,n*32,50]])
    for side in ('L','R'):
        put('rwall_end_'+side,closed_end(side),[0,0],[32,16],collide=[[0,0,32,50]])
        put('rwall_corner_'+side,closed_end(side,True),[0,32],[32,48],
            collide=[[0,0,32,50],[0 if side=='L' else 16,-32,16,32]])
    for n in (2,4):
        put(f'balus_{n}',balustrade(n*32),[6,30],[n*32,6],'base',[[0,-6,n*32,6]])
    im=Image.new('RGBA',(12,30)); post(ImageDraw.Draw(im),6)
    put('balus_post',rail_skin(im,64),[6,30],[12,6],'base',[[-5,-6,10,6]])
    (OUT/'kit.json').write_text(json.dumps(dict(kit='H-TERR',pieces=PIECES),indent=2)+'\n',encoding='utf-8')
    assembly(); sheet(); print(verify())


if __name__=='__main__':
    if '--verify' in sys.argv:
        print(verify())
    elif '--repro' in sys.argv:
        paths=sorted(OUT.glob('*'))+sorted(REC.glob('*.png'))+[REC/'placements.json']
        before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
        main()
        assert before=={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
        print(f'REPRO PASS {len(paths)} files SHA256 identical')
    else:
        main()
