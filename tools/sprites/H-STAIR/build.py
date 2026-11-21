"""Whole procedural H-STAIR sprites; no concept pixels enter the delivered kit.
Run from any directory: python -X utf8 tools/sprites/H-STAIR/build.py
Concept sampling is restricted to paving in the assembly evidence.
S1-STAIR3: aged mineral planes, edge moss and a worn central walking path.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
PROJECT = next(p for p in ROOT.parents if (p / 'design/tienson/19-the-sprite-hvq.md').exists())
REF = PROJECT / 'design/tienson'
OUT = ROOT / 'public/assets/kits/H-STAIR'
REC = ROOT / 'records/S1-STAIR3'
HALL = REF / 'tam-thanh/TT2/src/hall-reference.png'
CONCEPT = REF / 'hvq-scene/C'
COL = dict(shadow='#25241e', joint='#34312b', dark='#3e3a34', moss='#413e2d', wet='#333122',
           face='#514d46', face_light='#5a5750', top='#74726e', worn='#8c8782',
           top_dark='#61615f', light='#b9b1a9', edge='#2b2922')
FONT = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 12)


def age_stair(im, count, tread=5, riser=4):
    """Connected weathering clusters; no noise/dither or reference pixels.
    The original alpha and stair geometry are retained exactly.
    """
    a = np.array(im)
    d = ImageDraw.Draw(im)
    w, h = im.size
    landing = h-count*(tread+riser)
    if landing>3:
        d.polygon([(9,2),(w//3-3,2),(w//3-3,4),(w//2,4),
                   (w//2,7),(12,7),(12,5),(9,5)],fill=COL['top_dark'])
        d.polygon([(w//2+9,1),(w-12,1),(w-12,4),(w-19,4),
                   (w-19,6),(w//2+9,6)],fill=COL['worn'])
        d.polygon([(3,1),(9,1),(9,5),(7,5),(7,landing-1),(3,landing-1)],fill=COL['moss'])
        d.polygon([(w-10,3),(w-4,3),(w-4,landing-1),
                   (w-14,landing-1),(w-14,landing-5),(w-10,landing-5)],fill=COL['moss'])
        d.line([(w//3,8),(w//3+2,10),(w//3+2,landing-2)],fill=COL['face_light'])
    for row in range(count):
        y = landing+row*(tread+riser)
        inset = (count-1-row)*3//max(1,count-1)
        l, r = inset, w-1-inset
        # Large worn, unequal mineral planes follow the travelled middle.
        c = w//2 + [0,-3,2,1][row%4]
        half = w//4 + [1,-2,3,-1][row%4]
        d.polygon([(c-half+3,y),(c+half-7,y),(c+half-7,y+1),
                   (c+half,y+1),(c+half,y+tread-2),
                   (c-half,y+tread-2),(c-half,y+1),(c-half+3,y+1)],fill=COL['top'])
        # Polished lip has broad but unequal, connected worn islands.
        box(d,(c-half+4,y+tread-2,c-6,y+tread-1),'worn')
        box(d,(c+[-2,3,0,5][row%4],y+tread-1,c+half-5,y+tread-1),'worn')
        box(d,(c+5,y+tread-2,max(c+6,c+half-11),y+tread-2),'worn')
        box(d,(c-half+9,y,c-half+15,y),'top_dark')
        # Chipped nose: breaks stay part of the slab, never alpha holes.
        for x, length in [(l+9+(row*7)%13,3),(r-13-(row*5)%11,4)]:
            box(d,(x,y+tread-1,x+length,y+tread-1),'top_dark')
            box(d,(x+1,y+tread,x+length-1,y+tread),'face_light')
        if row % 3 == 1:
            x=w//3+row%4
            d.line([(x,y),(x+2,y+1),(x+2,y+tread-2)],fill=COL['face'])
        # Damp riser joints spread from the cheeks, with irregular roots.
        for side in (0,1):
            reach=[7,10,8,12,9][(row+side*2)%5]
            xs = l+2 if side==0 else r-2
            sign=1 if side==0 else -1
            def pts(coords):
                return [(xs+sign*xx,y+yy) for xx,yy in coords]
            d.polygon(pts([(0,0),(reach-3,0),(reach-3,1),
                           (reach,1),(reach,tread-3),(reach-2,tread-3),
                           (reach-2,tread-2),(0,tread-2)]),fill=COL['moss'])
            box(d,(min(xs,xs+sign*3),y,max(xs,xs+sign*3),y+1),'wet')
            d.polygon(pts([(0,tread),(reach-2,tread),(reach-2,tread+1),
                           (reach+2,tread+1),(reach+2,tread+riser-2),
                           (0,tread+riser-2)]),fill=COL['wet'])
            # Olive tongues grow out of the mortar, strongest at the toe.
            if (row+side)%2==0:
                xx=xs+sign*(reach-2)
                box(d,(min(xs,xx),y+tread+1,max(xs,xx),y+tread+riser-2),'moss')
    # Two narrow wet streaks run down from an upper ledge, outside the path.
    start = min(landing+2,h-12)
    length = min(23,h-start-1)
    for x in [13,w-14]:
        box(d,(x,start,x+1,start+length-1),'wet')
        box(d,(x-1,start+4,x-1,start+length-5),'moss')
    b=np.array(im)
    b[:,:,3]=a[:,:,3]
    b[a[:,:,3]==0]=0
    return Image.fromarray(b)


def age_cheek(im):
    """Mortar moss, streaked upright stone and chipped caps on the old mask."""
    original=np.array(im)
    d=ImageDraw.Draw(im)
    h=im.height
    # Broad connected stone patches, lit left edge remains legible.
    for y in range(33,h-7,12):
        box(d,(6,y+2,10,y+6),'face_light')
        d.line([(4,y),(8,y),(8,y+1),(13,y+1)],fill=COL['wet'],width=1)
        box(d,(12,y+2,13,y+3),'moss')
        if y%24==9:
            d.line([(7,y+3),(8,y+5),(8,y+7)],fill=COL['dark'])
    # One 23px runoff per cheek: two on an assembled pair.
    box(d,(11,32,12,54),'wet')
    box(d,(10,36,10,49),'moss')
    # Moss is attached to the inner edge and foot, not sprinkled on stone.
    d.polygon([(15,55),(15,h-1),(4,h-1),(4,h-5),
               (7,h-5),(7,h-8),(9,h-8),(9,h-3),(14,h-3),(14,55)],fill=COL['moss'])
    box(d,(4,h-3,15,h-1),'wet')
    for y in [2,h-28]:
        box(d,(11,y+2,14,y+3),'top_dark')
        box(d,(12,y+4,14,y+5),'dark')
        box(d,(3,y+23,6,y+25),'moss')
        box(d,(11,y+21,14,y+25),'wet')
    b=np.array(im)
    b[:,:,3]=original[:,:,3]
    b[original[:,:,3]==0]=0
    return Image.fromarray(b)


def box(d, xy, color):
    d.rectangle(xy, fill=COL.get(color, color))


def stair(w, h, count, tread=5, riser=4):
    """Distinct tread / 1px worn nose / recessed riser, at native pixels.
    A small stone shoulder (not a camera vanishing point) closes at the toe.
    Seams divide each course into 2 or 3 unequal, staggered whole slabs.
    """
    im = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(im)
    landing = h - count * (tread + riser)
    if landing:
        box(d, (3, 0, w-4, landing-1), 'top')
        box(d, (3, 0, w-4, 0), 'worn')
        if landing > 2:
            for x in [w*3//8, w*3//4]:
                box(d, (x, 1, x, landing-1), 'top_dark')
            box(d, (3, 1, 5, landing-1), 'moss')
    for row in range(count):
        y = landing + row*(tread+riser)
        inset = (count-1-row)*3//max(1, count-1)
        left, right = inset, w-1-inset
        # The upper courses catch more light; lower courses sit in the damp.
        top = 'top' if row < count//3 else ('top_dark' if row < count*2//3 else 'face_light')
        nose = 'worn' if row < count*2//3 else 'top'
        face = 'face' if row < count//3 else 'dark'
        box(d, (left, y, right, y+tread-2), top)
        box(d, (left, y+tread-1, right, y+tread-1), nose)
        box(d, (left, y+tread, right, y+tread+riser-2), face)
        box(d, (left, y+tread+1, right, y+tread+riser-2), 'dark')
        box(d, (left, y+tread+riser-1, right, y+tread+riser-1), 'joint')
        # Alternating two/three slabs, unequal widths, never a dotted tread.
        phase = [(-5, 4), (7, -3), (0, 8), (-8, -1)][row % 4]
        joints = ([w//3+phase[0], w*2//3+phase[1]]
                  if w >= 90 and row % 3 != 1 else [w//2+phase[0]])
        # Broad mineral planes follow slab boundaries, not random flecks.
        shade = {'top': 'top_dark', 'top_dark': 'face_light', 'face_light': 'face'}[top]
        boundaries = [left+2] + joints + [right-2]
        for slab, (x0, x1) in enumerate(zip(boundaries, boundaries[1:])):
            if (slab+row) % 2 == 0:
                box(d, (x0+2, y, x1-2, y+1), shade)
                box(d, (x0+2, y+2, x0+max(4, (x1-x0)//3), y+2), shade)
        for x in joints:
            box(d, (x, y, x, y+tread-2), 'face')
            box(d, (x, y+tread, x, y+tread+riser-2), 'joint')
            # Worn lip stays connected: no detached dark flecks on top.
            box(d, (x-1, y+tread-1, x+1, y+tread-1), top)
        # Broad wear on one slab edge, 1px bright nose remains elsewhere.
        cx = [w//5, w*3//5, w//3, w*4//5][row % 4]
        box(d, (cx, y+tread-2, cx+5, y+tread-2), nose)
        box(d, (left, y, left+1, y+tread-2), 'dark')
        box(d, (right-1, y, right, y+tread-2), 'dark')
        # Damp contact shadows and olive clusters hug inner cheek corners.
        for x0, x1 in [(left+2, left+4), (right-4, right-2)]:
            box(d, (x0, y, x1, y+1), 'moss')
            if row % 3 == 2:
                box(d, (x0, y+2, x1-1, y+tread-2), 'moss')
    return im


def cheek(run):
    """Frontal oblique projection: parallel masonry, upright terminal posts.
    Top of deck is y=30. The diagonal handrail runs north/south in world
    space, projected as a longitudinal strip; no converging perspective.
    44px structural height is metadata; projected run is NOT wall height.
    """
    im = Image.new('RGBA', (18, run+30))
    d = ImageDraw.Draw(im)
    end = run+29
    # Closed masonry cheek, narrow cap, shadow along inner edge.
    box(d, (3, 30, 15, end), 'face')
    box(d, (3, 30, 5, end), 'top_dark')
    box(d, (14, 30, 15, end), 'joint')
    for y in range(35, end-3, 12):
        box(d, (4, y, 13, y+1), 'dark')
        box(d, (6, y+2, 12, min(y+7, end)), 'face_light')
    # Open rail slots. Uprights stay vertical in the image.
    for y in [35, run//2+25]:
        box(d, (6, y-6, 11, y+7), 'face_light')
        box(d, (11, y-6, 12, y+7), 'dark')
    box(d, (3, 9, 7, end-20), 'top_dark')
    box(d, (3, 9, 4, end-20), 'worn')
    box(d, (8, 12, 9, end-20), 'joint')
    # Back and toe baluster posts, both 28px tall and 14px wide.
    for y in [2, end-27]:
        box(d, (2, y+5, 15, y+27), 'face')
        box(d, (3, y+5, 5, y+25), 'top_dark')
        box(d, (12, y+6, 15, y+27), 'dark')
        box(d, (1, y+2, 16, y+5), 'top_dark')
        box(d, (2, y, 14, y+2), 'top')
        box(d, (3, y, 10, y), 'worn')
        box(d, (5, y+12, 10, y+15), 'face_light')
        box(d, (1, y+25, 16, y+27), 'joint')
    box(d, (3, end-3, 6, end-2), 'moss')
    return im


def actor():
    atlas = Image.open(ROOT/'public/assets/dao_si.png').convert('RGBA')
    frames = json.loads((ROOT/'public/assets/dao_si.json').read_text(encoding='utf-8'))['frames']
    f = next(f['frame'] for f in frames if f['filename'] == 'dao_si_idle_down_00')
    return atlas.crop((f['x'], f['y'], f['x']+f['w'], f['y']+f['h']))


def paving():
    # Evidence-only clean paving crop: large area, no architectural pixels.
    tile = Image.open(CONCEPT/'V1.png').convert('RGBA').crop((338, 0, 480, 140))
    im = Image.new('RGBA', (480, 270))
    for y in range(0, 270, tile.height):
        for x in range(0, 480, tile.width):
            im.paste(tile, (x, y))
    return im


def retaining_wall(im, y, gaps, placements):
    """Use the unmodified merged H-TERR kit, with closed end returns.
    Wall coping y is the upper deck; stair toe meets wall y+50 exactly.
    """
    kit = ROOT/'public/assets/kits/H-TERR'
    meta = json.loads((kit/'kit.json').read_text(encoding='utf-8'))['pieces']
    def place(name, x, yy):
        piece = Image.open(kit/meta[name]['file']).convert('RGBA')
        ax, ay = meta[name]['anchor']
        im.alpha_composite(piece, (x-ax, yy-ay))
        placements.append(dict(kit='H-TERR', piece=name, anchor=[x, yy]))
    intervals = []
    edge = 0
    for left, right in sorted(gaps):
        intervals.append((edge, left)); edge = right
    intervals.append((edge, 480))
    for left, right in intervals:
        if right <= left:
            continue
        # Native spans overlap only under end caps, never scaled or cropped.
        wall = Image.new('RGBA', im.size)
        for i, x in enumerate(range(left, right, 64)):
            name = 'rwall_2_b' if i % 3 == 1 else 'rwall_2'
            piece = Image.open(kit/meta[name]['file']).convert('RGBA')
            wall.alpha_composite(piece, (min(x, right-64), y))
            placements.append(dict(kit='H-TERR', piece=name, anchor=[min(x, right-64), y]))
        im.alpha_composite(wall)
        place('rwall_end_L', left, y)
        place('rwall_end_R', right-32, y)
        for x in range(left, right, 64):
            place('balus_2', min(x, right-64), y)


def compose(images, variant):
    im = paving()
    placements = []
    if variant == 1:
        specs = [('stair_3', 340, 158, '')]
        retaining_wall(im, 172, [(326, 450)], placements)
        rulers = [(396, 196), (284, 126)]
    else:
        specs = [('stair_4', 176, -44, '_4'), ('stair_3', -38, 178, ''), ('stair_3', 422, 178, '')]
        retaining_wall(im, 2, [(162, 318)], placements)
        retaining_wall(im, 192, [(-52, 72), (408, 532)], placements)
        rulers = [(240, 36), (43, 238), (448, 215)]
    for name, x, y, suffix in specs:
        im.alpha_composite(images[name], (x, y))
        for side, xx in [('L', x-14), ('R', x+images[name].width-4)]:
            key = f'stair_cheek{suffix}_{side}'
            im.alpha_composite(images[key], (xx, y-30))
            placements.append(dict(kit='H-STAIR', piece=key, top_left=[xx,y-30]))
        placements.append(dict(kit='H-STAIR', piece=name, top_left=[x,y]))
    a = actor()
    for x,y in rulers:
        im.alpha_composite(a, (x-32, y-61))
    im.convert('RGB').save(REC/f'assembly-V{variant}.png')
    return im, placements


def evidence(images):
    paving().save(REC/'paving.png')
    height = 12 + sum(max(96, im.height*3)+44 for im in images.values())
    sheet = Image.new('RGB', (790, height), '#262725')
    d = ImageDraw.Draw(sheet)
    y = 12
    for name, im in images.items():
        d.text((12,y), f'{name}  {im.width}x{im.height}  1x / 3x', font=FONT, fill='#ddd5c7')
        sheet.paste(im, (24,y+24), im)
        big = im.resize((im.width*3, im.height*3), Image.Resampling.NEAREST)
        sheet.paste(big, (220,y+24), big)
        y += max(96,im.height*3)+44
    sheet.crop((0,0,790,y)).save(REC/'sheet.png')
    panel = Image.new('RGB', (980, 600), '#262725')
    d = ImageDraw.Draw(panel)
    placements = {}
    for row, variant in enumerate([1,2]):
        im, p = compose(images, variant)
        placements[f'V{variant}'] = p
        y = row*300
        d.text((6,y+5), f'Concept C V{variant} 1x', font=FONT, fill='#ddd5c7')
        d.text((496,y+5), 'H-STAIR R3 + real H-TERR / 1x', font=FONT, fill='#ddd5c7')
        panel.paste(Image.open(CONCEPT/f'V{variant}.png').convert('RGB'), (0,y+25))
        panel.paste(im.convert('RGB'), (490,y+25))
    panel.save(REC/'assembly.png')
    (REC/'placements.json').write_text(json.dumps(placements, indent=2)+'\n',encoding='utf-8')
    compare(images)


def compare(images):
    """Exact 4x reference | exact 4x sprite | 480x270 native assembly."""
    panel=Image.new('RGB',(2082,1150),'#262725')
    d=ImageDraw.Draw(panel)
    placements={}
    for row,(name,suffix,ref) in enumerate([
            ('stair_3','','v1_stair_4x.png'),
            ('stair_4','_4','v2_stair_main_4x.png')]):
        oy=row*560
        for x,title in [(12,'CONCEPT ILLUSTRATION / 4x'),
                        (906,'H-STAIR R3 / 4x'),
                        (1590,'ASSEMBLY / 1x / H-TERR + DAO SI')]:
            d.text((x,oy+12),title,font=FONT,fill='#ddd5c7')
        reference=Image.open(ROOT/'.agents/refs/S1/H-STAIR'/ref).convert('RGB')
        panel.paste(reference,(12,oy+38))
        body=images[name]
        assembled=Image.new('RGBA',(body.width+28,body.height+30))
        assembled.alpha_composite(body,(14,30))
        assembled.alpha_composite(images[f'stair_cheek{suffix}_L'],(0,0))
        assembled.alpha_composite(images[f'stair_cheek{suffix}_R'],(body.width+10,0))
        big=assembled.resize((assembled.width*4,assembled.height*4),Image.Resampling.NEAREST)
        panel.paste(big,(906,oy+38),big)
        im=paving()
        x=(480-body.width)//2
        y=156-body.height
        p=[]
        retaining_wall(im,106,[(x-14,x+body.width+14)],p)
        im.alpha_composite(assembled,(x-14,y-30))
        a=actor()
        foot=(240,y+body.height*2//3)
        im.alpha_composite(a,(foot[0]-32,foot[1]-61))
        im.convert('RGB').save(REC/f'joined-{name}-1x.png')
        panel.paste(im.convert('RGB'),(1590,oy+38))
        d.text((1590,oy+322),f'{name}: {body.width}x{body.height}; unchanged anchors',font=FONT,fill='#ddd5c7')
        placements[name]={'H-TERR':p,'stair_top_left':[x,y],
                          'cheek_top_left':[[x-14,y-30],[x+body.width-4,y-30]],
                          'actor_foot':foot,'wall_top':106,'wall_toe':156,'stair_toe':156}
    d.text((12,1130),'No concept architecture pixels in sprites; only assembly paving uses the permitted concept floor crop.',font=FONT,fill='#ddd5c7')
    panel.save(REC/'compare.png')
    (REC/'joined-placements.json').write_text(json.dumps(placements,indent=2)+'\n',encoding='utf-8')


def material_checks():
    baseline=json.loads((Path(__file__).parent/'baseline.json').read_text(encoding='utf-8'))
    assert hashlib.sha256((OUT/'kit.json').read_bytes()).hexdigest()==baseline['kit_sha256'], 'manifest changed'
    moss_colors=np.array([tuple(bytes.fromhex(COL[c][1:])) for c in ('moss','wet')])
    stats={}
    for name,base in baseline['pieces'].items():
        im=Image.open(OUT/f'{name}.png').convert('RGBA')
        assert list(im.size)==base['size']
        assert hashlib.sha256(im.getchannel('A').tobytes()).hexdigest()==base['alpha_sha256'], (name,'original silhouette')
        a=np.array(im); opaque=a[:,:,3]>0
        m=(a[:,:,:3,None]==moss_colors.T).all(axis=2).any(axis=2)&opaque
        rgb=a[:,:,:3].astype(float); lum=rgb.mean(axis=2)
        vertical=np.zeros(opaque.shape,bool); tread_mask=vertical.copy()
        if name.startswith('stair_cheek'):
            vertical[30:,3:16]=True
            if name.endswith('_R'):
                vertical=vertical[:,::-1].copy()
            # Mirror the measured lane for the opposite cheek.
            lane=11 if name.endswith('_L') else 6
            streaks=[m[32:55,lane].all()]
            threshold=.12
        else:
            n={'stair_3':7,'stair_4':9,'stair_low_2':3}[name]
            pitch=8 if n==3 else 9
            t=pitch-4; landing=im.height-n*pitch
            for row in range(n):
                y=landing+row*pitch
                tread_mask[y:y+t]=True
                vertical[y+t:y+pitch]=True
            start=min(landing+2,im.height-12); length=min(23,im.height-start-1)
            streaks=[m[start:start+length,x].all() for x in (13,im.width-14)]
            ratio=float(m[tread_mask&opaque].mean())
            assert ratio>=.08,(name,'tread moss',ratio)
            center=tread_mask.copy(); center[:,:im.width//3]=False; center[:,2*im.width//3:]=False
            edge=tread_mask.copy(); edge[:,im.width//6:-im.width//6]=False
            wear=float(lum[center&opaque].mean()-lum[edge&opaque].mean())
            assert wear>=20,(name,'central wear too dim',wear)
            # All moss remains in the two side thirds; the travelled middle is clear.
            edge_share=float(m[:, :im.width//3].sum()+m[:, 2*im.width//3:].sum())/max(1,m.sum())
            assert edge_share>=.9,(name,'moss away from cheeks')
            threshold=.08
        vertical&=opaque
        face_ratio=float(m[vertical].mean())
        assert face_ratio>=threshold,(name,'vertical moss',face_ratio)
        tones,counts=np.unique(a[opaque&~m,:3],axis=0,return_counts=True)
        large_tones=int((counts>=max(3,int(opaque.sum()*.02))).sum())
        assert large_tones>=3,(name,'stone tones',large_tones)
        assert all(streaks),(name,'10-30px wet streak broken')
        stats[name]={'moss_ratio_vertical':round(face_ratio,4),
                     'moss_ratio_all':round(float(m[opaque].mean()),4),
                     'wet_streaks':sum(bool(s) for s in streaks),'wet_streak_length':23 if name.startswith('stair_cheek') else length,
                     'stone_tones':large_tones}
        if not name.startswith('stair_cheek'):
            stats[name].update(moss_ratio_tread=round(ratio,4),central_wear_lift=round(wear,2),moss_at_edges=round(edge_share,4))
    (REC/'material-checks.json').write_text(json.dumps(stats,indent=2)+'\n',encoding='utf-8')
    return stats


def verify():
    hall = np.array(Image.open(HALL).convert('RGBA'))
    palette = set(map(tuple, hall[hall[:,:,3]>0,:3]))
    assert len(palette) == 48
    manifest = json.loads((OUT/'kit.json').read_text(encoding='utf-8'))
    outside = semi = gold = 0
    hashes = {}
    expected = {'stair_3':(96,64), 'stair_4':(128,96), 'stair_low_2':(60,24),
                'stair_cheek_L':(18,94), 'stair_cheek_R':(18,94),
                'stair_cheek_4_L':(18,126), 'stair_cheek_4_R':(18,126)}
    assert set(manifest['pieces']) == set(expected)
    for name, size in expected.items():
        path = OUT/f'{name}.png'
        im = Image.open(path)
        assert im.mode == 'RGBA' and im.size == size, name
        a = np.array(im)
        semi += int(((a[:,:,3]>0)&(a[:,:,3]<255)).sum())
        colors = a[a[:,:,3]>0,:3]
        outside += sum(tuple(c) not in palette for c in colors)
        gold += int(((colors[:,0]>120)&(colors[:,1]>75)&(colors[:,0]>colors[:,1]*1.2)&(colors[:,1]>colors[:,2]*1.35)).sum())
        assert np.all(a[a[:,:,3]==0] == 0), name
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    for suffix in ['', '_4']:
        a = np.array(Image.open(OUT/f'stair_cheek{suffix}_L.png'))
        b = np.array(Image.open(OUT/f'stair_cheek{suffix}_R.png'))
        assert np.array_equal(a[:,:,3], b[:,::-1,3]), 'cheek silhouette symmetry'
    assert outside == semi == gold == 0
    # Confirm every required tread reads as a brighter band than its riser.
    for name, n in [('stair_3',7),('stair_4',9),('stair_low_2',3)]:
        a = np.array(Image.open(OUT/f'{name}.png'))[:,:,:3].astype(float)
        pitch = 8 if n==3 else 9
        landing = a.shape[0]-n*pitch
        for i in range(n):
            y = landing+i*pitch
            assert a[y+1,8:-8].mean() > a[y+pitch-3,8:-8].mean()+12, (name,i)
    stats=material_checks()
    (REC/'checks.json').write_text(json.dumps(dict(pieces=7, KA5=outside, alpha_partial=semi,
        gold_pixels=gold, structural_height=44, wall_cap=6, sha256=hashes),indent=2)+'\n',encoding='utf-8')
    print(f'PASS H-STAIR: pieces=7 K-A5={outside} alpha_partial={semi} gold={gold} steps=7/9/3 cheek_pairs=2 symmetric; wall=44+6')
    for name,s in stats.items():
        print(f"MATERIAL {name}: moss_ratio_vertical={s['moss_ratio_vertical']:.2%} "
              f"moss_ratio_tread={s.get('moss_ratio_tread',0):.2%} "
              f"wet_streaks={s['wet_streaks']} length={s['wet_streak_length']} stone_tones={s['stone_tones']}")
    print('PASS S1-STAIR3 aged: moss>=8% treads / >=12% cheeks; wet_streaks=2/pair length=10-30; original alpha+kit unchanged')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REC.mkdir(parents=True, exist_ok=True)
    images = {'stair_3':age_stair(stair(96,64,7),7),
              'stair_4':age_stair(stair(128,96,9),9),
              'stair_low_2':age_stair(stair(60,24,3,4,4),3,4,4)}
    for suffix, run in [('',64),('_4',96)]:
        left = age_cheek(cheek(run))
        right = left.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        # Same silhouette, darker east-facing cap under upper-left light.
        a = np.array(right)
        for src,dst in [('worn','top'),('top','top_dark')]:
            rgb = tuple(bytes.fromhex(COL[src][1:]))
            mask = np.all(np.array(right)[:,:,:3] == rgb, axis=2)
            a[mask,:3] = tuple(bytes.fromhex(COL[dst][1:]))
        images[f'stair_cheek{suffix}_L'] = left
        images[f'stair_cheek{suffix}_R'] = Image.fromarray(a)
    for name, im in images.items():
        im.save(OUT/f'{name}.png')
    evidence(images)
    verify()


if __name__ == '__main__':
    main()
