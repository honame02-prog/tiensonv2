"""S1-TERR: original procedural masonry. No concept pixels in kit sprites.
Run from any directory: python -X utf8 tools/sprites/H-TERR/build.py [--verify|--repro]
Geometry is drawn at native size: median reduction is unnecessary (1:1 cells).
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
REC = ROOT/'records/S1-TERR'
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


def masonry(w, damp=False):
    """44px visible ashlar below a 6px coping. Seam phase repeats at 64px."""
    im = Image.new('RGBA', (w,50))
    d = ImageDraw.Draw(im)
    d.rectangle((0,6,w-1,49), fill=C['joint'])
    # Large 32x14 blocks, running bond. Flat color clusters, no noise/dither.
    for row in range(3):
        y = 6+row*14
        for j, x in enumerate(range(-16 if row%2 else 0,w,32)):
            x0, x1 = max(0,x), min(w-1,x+30)
            if x1 < x0:
                continue
            tone = ['stone','mid','stone','light'][(j+row*2)%4]
            d.rectangle((x0,y+1,x1,y+12), fill=C[tone])
            d.line((x0,y+1,x1-2,y+1), fill=C['light'], width=1)
            d.line((x0,y+12,x1,y+12), fill=C['dark'])
            # Worn planes, at least 2px per detail, deterministic not speckled.
            if x >= 0 and x+27 < w:
                d.rectangle((x+5,y+3,x+14,y+4), fill=C['mid'])
                if (j+row)%3 == 0:
                    d.line([(x+24,y+2),(x+24,y+5),(x+22,y+7)],fill=C['dark'],width=2)
                    d.rectangle((x+2,y+10,x+7,y+11),fill=C['light'])
    d.rectangle((0,48,w-1,49),fill=C['shade'])
    # Coping: upper lit plane, beveled lip, shaded underside.
    d.rectangle((0,0,w-1,2), fill=C['edge'])
    d.line((0,0,w-1,0), fill=C['top'])
    d.rectangle((0,3,w-1,4),fill=C['mid'])
    d.line((0,5,w-1,5),fill=C['shade'])
    for x in range(30,w,32):
        d.rectangle((x,0,x+1,3),fill=C['dark'])
    if damp:
        for x, y in [(12,21),(43,34),(w-17,7)]:
            d.rectangle((x,y,x+3,y+8),fill=C['dark'])
            d.rectangle((x-3,y+7,x+5,y+9),fill=C['moss'])
        # One sparse trailing vine, with paired leaf clusters.
        x=w-16
        d.line([(x,4),(x,12),(x-2,20),(x-2,27)], fill=C['moss'],width=2)
        for y, off in [(8,-3),(15,2),(23,-4)]:
            d.rectangle((x+off,y,x+off+3,y+2), fill=C['olive'])
    return im


def closed_end(side, corner=False):
    # 16px return plane; a corner additionally extends 32px north.
    h = 82 if corner else 50
    im = Image.new('RGBA',(32,h))
    y = h-50
    im.alpha_composite(masonry(32), (0,y))
    d = ImageDraw.Draw(im)
    right = side == 'R'
    x0 = 16 if right else 0
    d.rectangle((x0,0,x0+15,h-1), fill=C['dark'] if right else C['stone'])
    d.rectangle((x0,0,x0+15,2),fill=C['edge'])
    d.rectangle((x0,3,x0+15,5),fill=C['mid'])
    for yy in range(7,h-1,14):
        d.line((x0,yy,x0+15,yy),fill=C['joint'])
        d.line((x0,yy+1,x0+12,yy+1),fill=C['mid'])
        # Offset joints of the closed return; avoid open hollow ends.
        xx = x0+(5 if (yy//14)%2 else 10)
        d.line((xx,yy+1,xx,min(yy+13,h-1)),fill=C['shade'])
    # Coping across the elbow, and a clear top strip along the return.
    if corner:
        d.rectangle((x0,0,x0+3,y+3),fill=C['edge'])
        d.rectangle((x0+4,0,x0+5,y+2),fill=C['light'])
    d.rectangle((0,y,31,y+2),fill=C['edge'])
    d.line((0,y,31,y),fill=C['top'])
    d.rectangle((0,y+3,31,y+4),fill=C['mid'])
    d.line((0,y+5,31,y+5),fill=C['shade'])
    return im


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
    return im


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
    for name,x in [('rwall_2',24),('rwall_4_b',88),('rwall_4',216)]:
        place(name,x,170)
    place('rwall_end_L',24,170)
    place('rwall_end_R',312,170)
    for name,x in [('balus_2',24),('balus_4',88),('balus_4',216)]:
        place(name,x,170)
    place('rwall_end_L',440,170)
    place('balus_post',440,170)
    place('balus_post',472,170)
    # Secondary dais: actual north return + corner joined to a straight span.
    place('rwall_corner_L',360,216)
    place('rwall_2_b',392,216)
    place('rwall_end_R',448,216)
    place('balus_2',384,216)
    place('balus_post',360,184)
    # Real, unmodified 64px Dao Si frame, pivot (32,61).
    frames=json.loads((ROOT/'public/assets/dao_si.json').read_text(encoding='utf-8'))['frames']
    frame=next(f for f in frames if f['filename']=='dao_si_idle_down_00')['frame']
    atlas=Image.open(ROOT/'public/assets/dao_si.png').convert('RGBA')
    actor=atlas.crop((frame['x'],frame['y'],frame['x']+64,frame['y']+64))
    for x,y in [(220,132),(288,258)]:
        canvas.alpha_composite(actor,(x-32,y-61))
    canvas.save(REC/'assembly-frame.png')
    together=Image.new('RGB',(976,294),'#24241f')
    together.paste(concept,(0,24))
    together.paste(canvas,(496,24))
    d=ImageDraw.Draw(together)
    d.text((8,7),'APPROVED TARGET C / V1 / 1x',fill='#b9b1a9')
    d.text((504,7),'H-TERR / 1x / gap reserved for stair kit',fill='#b9b1a9')
    together.save(REC/'assembly.png')
    (REC/'placements.json').write_text(json.dumps(placements,indent=2)+'\n',encoding='utf-8')


def sheet():
    # Every piece, unscaled + 3x nearest, name and native dimensions.
    rowh=288
    sh=Image.new('RGB',(960,rowh*((len(IMAGES)+1)//2)),'#24241f')
    d=ImageDraw.Draw(sh)
    for i,(name,im) in enumerate(IMAGES.items()):
        x=(i%2)*480+14; y=(i//2)*rowh+12
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
    put('balus_post',im,[6,30],[12,6],'base',[[-5,-6,10,6]])
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
