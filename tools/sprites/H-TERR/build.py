"""S1-TERR3: R2 ImageGen stone with deterministic clustered weathering.
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
REC = ROOT/'records/S1-TERR3'
SRC = Path(__file__).resolve().parent/'src'
HALL = DESIGN/'tam-thanh/TT2/src/hall-reference.png'
CONCEPT = DESIGN/'hvq-scene/C/V1.png'
PAL = sorted({tuple(map(int,p[:3])) for p in np.array(Image.open(HALL).convert('RGBA')).reshape(-1,4) if p[3]})
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
    im = weather(name, Image.fromarray(a))
    a = np.array(im)
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



def moss_pixels(a):
    return ((a[...,:3]==C['moss'][:3]).all(2) |
            (a[...,:3]==C['olive'][:3]).all(2)) & (a[...,3]>0)


def weather(name, im):
    """R2 silhouette is immutable. All marks are connected 2px+ clusters.

    The low band follows the foot, joints gather olive deposits, and rain
    drips start at the coping. No stochastic pixels or copied concept pixels.
    """
    a=np.array(im); h,w=a.shape[:2]; mask=a[...,3]>0
    if name.startswith('rwall'):
        y0=h-50
        # Reserve readable stone planes: soften R2's deep source flecks into
        # warm mineral midtones before adding strongly localised damp areas.
        face=a[y0+6:y0+48]
        lum=face[...,:3].mean(2)
        face[(lum<70)&(lum>=50),:3]=C['stone'][:3]
        # The body has four mineral levels; strongest chalk is coping only.
        face[(face[...,:3]==C['top'][:3]).all(2),:3]=C['edge'][:3]
        # Lower irregular moss shelf, with short lobes and exposed stone gaps.
        for x in range(w):
            depth=(4,6,5,7,4,5,3,6)[(x//5)%8]
            for y in range(h-depth,h):
                if mask[y,x]:
                    a[y,x,:3]=C['moss' if y>=h-3 else 'olive'][:3]
        # Damp olive collects in existing mortar in patches, not on every block.
        original=np.array(im)
        for y in range(y0+19,h-7):
            for x in range(w):
                if mask[y,x] and original[y,x,:3].mean()<58 and (x//12)%4 in (0,1):
                    a[y,x,:3]=C['olive'][:3]
        im=Image.fromarray(a); d=ImageDraw.Draw(im)
        # 2-3 runoff stains / 128px; narrow and tapering under the coping.
        for i,x in enumerate(range(16,w-4,48)):
            length=(20,14,25,17)[i%4]
            d.line([(x,y0+6),(x,y0+12),(x+1,y0+length)],fill=C['olive'],width=3)
            d.line([(x,y0+6),(x,y0+length-3)],fill=C['moss'],width=2)
        # A few connected cracks in face stones, with a worn light lip.
        for x in range(37,w-6,79):
            d.line([(x,y0+13),(x-2,y0+17),(x,y0+20)],fill=C['dark'],width=2)
            d.line([(x+2,y0+13),(x,y0+17)],fill=C['light'],width=2)
        # Shallow chips do not cut through the closed coping silhouette.
        for x in range(12,w-3,43):
            d.rectangle((x,y0+1,x+3,y0+2),fill=C['mid'])
            d.line((x+2,y0+3,x+5,y0+3),fill=C['light'],width=1)
        # 1-2 thin sparse hanging vines, only on the _b variants.
        if name.endswith('_b'):
            for x in ([w//2] if w<160 else [55,151]):
                d.line([(x,y0+3),(x,y0+12),(x-2,y0+20),(x-2,y0+29),(x-4,y0+34)],fill=C['moss'],width=2)
                for yy,xx in [(10,x-4),(18,x),(27,x-6)]:
                    d.polygon([(xx,y0+yy),(xx+4,y0+yy),(xx+3,y0+yy+2),(xx,y0+yy+3)],fill=C['olive'])
        # Returns also carry humidity at their inside seam and upper ledge.
        if 'corner' in name:
            x=12 if name.endswith('L') else 18
            d.line((x,9,x,30),fill=C['olive'],width=2)
            d.rectangle((x-2,28,x+2,34),fill=C['moss'])
    else:
        im=Image.fromarray(a); d=ImageDraw.Draw(im)
        centres=[6] if name=='balus_post' else list(range(6,w-5,32))
        for i,x in enumerate(centres):
            # Chipped cap colour, not a hole through the vertical post.
            d.rectangle((x+1,3,x+3,5),fill=C['dark'])
            d.rectangle((x-3,3,x-1,4),fill=C['top'])
            # Foot moss wraps the plinth and grows into its inside corner.
            d.rectangle((x-4,25,x+3,29),fill=C['olive'])
            d.rectangle((x-3,28,x+4,29),fill=C['moss'])
            d.rectangle((x-3,22,x-1,26),fill=C['olive'])
            if i%2==0:
                d.rectangle((x,15,x+2,18),fill=C['olive'])
        if name!='balus_post':
            for x in range(17,w-12,32):
                d.rectangle((x,25,x+7,27),fill=C['olive'])
                d.rectangle((x+2,12,x+6,14),fill=C['olive'])
    a=np.array(im)
    # Restore the exact R2 alpha mask even where a mark crosses an open slot.
    a[...,3]=np.array(mask,dtype=np.uint8)*255
    a[~mask]=0
    return Image.fromarray(a)

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
    d.text((504,7),'H-TERR R3 / 1x / joined H-STAIR',fill='#b9b1a9')
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



def compare():
    """Exact 4x reference | exact 4x sprites | unchanged 1x assembly."""
    ref=ROOT/'.agents/refs/S1/H-TERR'
    board=Image.new('RGB',(2072,854),'#24241f'); d=ImageDraw.Draw(board)
    d.text((12,10),'ILLUSTRATION / 4x / 192px crop',fill='#b9b1a9')
    d.text((800,10),'H-TERR R3 / 4x nearest',fill='#b9b1a9')
    d.text((1580,10),'ASSEMBLY / 1x / 480 x 270',fill='#b9b1a9')
    for row,version in enumerate(('v1','v2')):
        original=Image.open(ref/(version+'_rwall_balus_1x.png')).convert('RGBA')
        # Reference only; no pixels enter any asset, source, or palette.
        crop=original.crop((0,0,192,80)).resize((768,320),Image.Resampling.NEAREST)
        y=40+row*360
        board.paste(crop,(12,y),crop)
        native=Image.new('RGBA',(192,80))
        native.alpha_composite(IMAGES['rwall_6'+('_b' if row else '')],(0,30))
        native.alpha_composite(IMAGES['balus_4'],(0,0))
        native.alpha_composite(IMAGES['balus_2'],(128,0))
        big=native.resize((768,320),Image.Resampling.NEAREST)
        board.paste(big,(800,y),big)
        d.text((12,y+326),version+' reference',fill='#b9b1a9')
        d.text((800,y+326),'rwall_6'+('_b' if row else '')+' / balus_4 + balus_2',fill='#b9b1a9')
    board.paste(Image.open(REC/'assembly-frame.png'),(1580,40))
    d.text((1580,326),'Existing H-STAIR + real 64px Dao Si',fill='#b9b1a9')
    # Unscaled detail makes native visual assessment explicit.
    d.text((1580,370),'ILLUSTRATION / 1x',fill='#b9b1a9')
    small=Image.open(ref/'v1_rwall_balus_1x.png').convert('RGBA')
    board.paste(small,(1580,394),small)
    d.text((1580,520),'SPRITES / 1x',fill='#b9b1a9')
    board.paste(native,(1580,544),native)
    d.text((1580,656),'Before R2 / 1x',fill='#b9b1a9')
    before=REC/'before-rwall_6_b.png'
    if before.exists():
        old=Image.open(before).convert('RGBA')
        board.paste(old,(1580,680),old)
    d.text((12,805),'Weathering pass 2 / R2 geometry, palette, anchors and closed ends preserved',fill='#b9b1a9')
    board.save(REC/'compare.png')


def age_metrics(name,a):
    a=a[-50:]  # closed elbows have a 32px upper return above this face
    face=a[6:48]
    moss=moss_pixels(face)
    ratio=float(moss.mean())
    # Count measured runs attached to the coping; group adjacent columns.
    whole=moss_pixels(a)
    columns=[]; lengths=[]
    for x in range(a.shape[1]):
        length=0
        for y in range(6,37):
            if not whole[y,x]: break
            length+=1
        if length>=10:
            columns.append(x); lengths.append(length)
    groups=[]
    for x,n in zip(columns,lengths):
        if groups and x==groups[-1][-1][0]+1: groups[-1].append((x,n))
        else: groups.append([(x,n)])
    measured=[max(n for x,n in g) for g in groups]
    # Mineral tone count excludes green/brown damp deposits and coping.
    rgb,count=np.unique(face[~moss,:3],axis=0,return_counts=True)
    tones=[list(map(int,p)) for p,n in zip(rgb,count) if n>=8 and p.mean()>=65]
    assert ratio>=.12,(name,'moss below 12%',ratio)
    assert 2*a.shape[1]/128<=len(groups)<=4*a.shape[1]/128,(name,'wet streak count',measured)
    assert all(10<=n<=30 for n in measured),(name,'wet streak length',measured)
    assert 3<=len(tones)<=4,(name,'stone tone count',tones)
    # Most moss is at the foot and mortar, rather than uniformly sprinkled.
    foot=float(moss[-8:].sum()/max(1,moss.sum()))
    assert foot>.35,(name,'moss not concentrated near foot',foot)
    return dict(moss_ratio=round(ratio,4),wet_streaks=len(groups),
                wet_lengths=measured,stone_tones=len(tones),foot_share=round(foot,4),
                face_light=round(float((face[...,:3].mean(2)>=70).mean()),4))

def verify():
    kit=json.loads((OUT/'kit.json').read_text(encoding='utf-8'))
    palette=set(PAL); outside=gold=0; pixels=0
    metrics={}
    contract=json.loads((Path(__file__).parent/'baseline-contract.json').read_text(encoding='utf-8'))
    assert hashlib.sha256((OUT/'kit.json').read_bytes()).hexdigest()==contract['kit_sha256'],'manifest changed'
    assert kit['kit']=='H-TERR'
    for name,p in kit['pieces'].items():
        a=np.array(Image.open(OUT/p['file']).convert('RGBA'))
        assert list(Image.open(OUT/p['file']).size)==contract['pieces'][name]['size'],name
        assert hashlib.sha256(a[...,3].tobytes()).hexdigest()==contract['pieces'][name]['alpha_sha256'],(name,'silhouette changed')
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
            assert (face>=70).mean()>.65,(name,'face too dark',float((face>=70).mean()))
        if name.startswith('rwall_'):
            metrics[name]=age_metrics(name,a)
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
    (REC/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n',encoding='utf-8')
    age='; '.join(f'{n}:moss={v["moss_ratio"]:.2%},wet={v["wet_streaks"]},tones={v["stone_tones"]},light={v["face_light"]:.2%}' for n,v in metrics.items())
    print('AGED '+age)
    assert Image.open(REC/'compare.png').size==(2072,854)
    moss_min=min(v['moss_ratio'] for v in metrics.values())
    moss_max=max(v['moss_ratio'] for v in metrics.values())
    return f'PASS H-TERR moss={moss_min:.2%}..{moss_max:.2%} tones=4 pieces={len(kit["pieces"])} K-A5={outside} gold={gold} alpha=0/255 pixels={pixels} post-pitch=32 closed-ends=4'


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
    assembly(); sheet(); compare(); print(verify())


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
