"""Reproducible H-WALL, original procedural geometry; no concept architecture pixels.
Run from any directory: python -X utf8 tools/sprites/H-WALL/build.py [--verify|--repro]
Only the assembly floor samples the approved concept. No stochastic dithering.
"""
from pathlib import Path
import json, math, hashlib, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT/'public/assets/kits/H-WALL'
REC = ROOT/'records/S1-WALL'
DESIGN = Path(r'D:\SkillFX_TuThienChi_HoaLien\design\tienson')
PALFILE = DESIGN/'tam-thanh/TT2/src/hall-reference.png'
CONCEPT = DESIGN/'hvq-scene/C/V1.png'
S = 3
pa = np.array(Image.open(PALFILE).convert('RGBA'))
PAL = np.unique(pa[pa[:,:,3]>0,:3],axis=0).astype(np.int32)
assert len(PAL)==48

def col(rgb):
    return tuple(int(v) for v in PAL[((PAL-np.array(rgb))**2).sum(axis=1).argmin()])+(255,)

C = {k:col(v) for k,v in {
    'dark':(28,27,22),'shadow':(48,46,37),'stone':(92,89,76),
    'stone_light':(128,122,106),'stone_hi':(153,144,126),'stone_shade':(71,70,59),
    'red':(108,64,51),'red_light':(129,78,62),'red_shade':(83,47,38),
    'plaster':(143,126,102),'plaster_dark':(104,94,76),
    'tile':(75,76,65),'tile_light':(111,108,91),'tile_hi':(139,134,115),
    'tile_shade':(49,51,43),'moss':(59,62,43)
}.items()}

class Surface:
    def __init__(self,w,h):
        self.w,self.h=w,h
        self.im=Image.new('RGBA',(w*S,h*S)); self.d=ImageDraw.Draw(self.im)
    def rect(self,b,c): self.d.rectangle(tuple(round(v*S) for v in b),fill=C.get(c,c))
    def poly(self,pts,c): self.d.polygon([(round(x*S),round(y*S)) for x,y in pts],fill=C.get(c,c))
    def line(self,pts,c,width=1): self.d.line([(round(x*S),round(y*S)) for x,y in pts],fill=C.get(c,c),width=round(width*S))
    def ellipse(self,b,c): self.d.ellipse(tuple(round(v*S) for v in b),fill=C.get(c,c))
    def finish(self):
        a=np.array(self.im).reshape(self.h,S,self.w,S,4).transpose(0,2,1,3,4)
        # Median cells, alpha occupied majority, then exact hall quantization.
        m=np.median(a,axis=(2,3)).astype(np.uint8); mask=(a[:,:,:,:,3]>0).sum(axis=(2,3))>=5
        rgb=m[mask,:3].astype(np.int32)
        for i in range(0,len(rgb),4096):
            q=rgb[i:i+4096]; rgb[i:i+len(q)]=PAL[((q[:,None,:]-PAL[None,:,:])**2).sum(axis=2).argmin(axis=1)]
        m[mask,:3]=rgb; m[:,:,3]=mask*255; m[~mask]=0
        return Image.fromarray(m)

def masonry(s,x0,y0,x1,y1):
    s.rect((x0,y0,x1,y1),'stone_shade')
    for row,y in enumerate(range(y0,y1,4)):
        for x in range(x0-16*(row%2),x1,32):
            l,r=max(x0,x+1),min(x1,x+30)
            if r<=l: continue
            s.rect((l,y+1,r,min(y1,y+3)),'stone')
            s.line([(l,y+1),(r-2,y+1)],'stone_light')
    for x in range(x0+9,x1-3,47):
        s.rect((x,y1-2,x+5,y1),'moss')

def plaster(s,x0,y0,x1,y1):
    s.rect((x0,y0,x1,y1),'red')
    s.rect((x0,y0,x1,y0+3),'red_shade')
    s.line([(x0,y0+5),(x1,y0+5)],'red_light',2)
    # Sparse contiguous worn plaster islands, not a pixel noise field.
    for i,x in enumerate(range(x0+13,x1-7,39)):
        y=y1-10-(i%3)*6
        s.poly([(x,y+4),(x+3,y),(x+7,y+2),(x+5,y+7),(x+11,y+8),(x+7,y+11),(x+1,y+9)],'plaster_dark')
        s.poly([(x+2,y+3),(x+4,y+2),(x+5,y+6),(x+8,y+8),(x+3,y+8)],'plaster')
    for x in range(x0+25,x1-3,71):
        s.line([(x,y0+13),(x-2,y0+18),(x+1,y0+21)],'red_shade')

def roof(s,w,y=0):
    s.rect((0,y+1,w-1,y+10),'tile_shade')
    s.rect((0,y+2,w-1,y+6),'tile')
    s.line([(0,y+1),(w-1,y+1)],'tile_light',2)
    for x in range(2,w,6):
        s.poly([(x,y+3),(x+2,y+3),(x+3,y+8),(x,y+8)],'tile_light')
        s.line([(x+3,y+4),(x+4,y+9)],'dark')
    s.line([(0,y+10),(w-1,y+10)],'dark')
    s.line([(0,y+8),(w-1,y+8)],'tile')

def horizontal(w):
    s=Surface(w,64); plaster(s,0,12,w-1,55); masonry(s,0,56,w-1,63); roof(s,w,1)
    return s,lambda x,y:y<13

def post():
    s=Surface(14,68); plaster(s,2,14,11,58)
    s.rect((10,14,12,59),'red_shade'); s.line([(2,16),(2,56)],'red_light',2)
    masonry(s,1,59,12,67); roof(s,14,1)
    s.rect((1,12,12,15),'stone'); s.line([(1,12),(11,12)],'stone_light')
    return s,lambda x,y:y<16

def end(side):
    s=Surface(22,64)
    plaster(s,4,13,21,55); masonry(s,4,56,21,63)
    s.poly([(4,13),(0,17),(0,57),(4,63),(7,63),(7,13)],'red_shade')
    s.poly([(2,17),(4,15),(5,15),(5,55),(2,55)],'red_light')
    s.poly([(0,57),(4,56),(7,58),(7,63),(4,63),(0,60)],'stone')
    roof(s,22,1)
    s.poly([(0,3),(3,0),(7,1),(7,9),(3,11),(0,8)],'tile')
    s.line([(1,3),(3,1),(6,2)],'tile_hi')
    if side=='R': s.im=s.im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return s,lambda x,y:y<13

def vertical(length):
    s=Surface(18,length+14)
    s.rect((2,0,16,length+6),'red_shade'); s.rect((2,0,5,length+6),'red')
    s.rect((3,0,16,length-1),'tile_shade'); s.rect((5,0,13,length-1),'tile')
    s.line([(5,0),(5,length-1)],'tile_light',2)
    for y in range(0,length,6):
        s.line([(6,y+1),(12,y+1)],'tile_light',2)
        s.line([(13,y+2),(15,y+4)],'dark')
    masonry(s,1,length+7,16,length+13)
    return s,lambda x,y:y<length and x>=3

def corner(side):
    s=Surface(48,112)
    v,_=vertical(64); s.im.alpha_composite(v.im,(0,0))
    h,_=horizontal(48); s.im.alpha_composite(h.im,(0,48*S))
    p,_=post(); s.im.alpha_composite(p.im,(0,44*S))
    if side=='R': s.im=s.im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return s,lambda x,y:(y<61 or (x<15 if side=='L' else x>=33) and y<64)

def gate():
    s=Surface(176,148)
    plaster(s,0,96,175,139); masonry(s,0,140,175,147)
    # Original arched wall silhouette with raised shoulders.
    arch=[(24,45),(30,40),(40,32),(52,24),(68,18),(88,16),(108,18),(124,24),(136,32),(146,40),(152,45)]
    s.poly(arch+[(152,147),(24,147)],'red')
    s.poly([(145,45),(152,45),(152,139),(146,139)],'red_shade')
    for x,y in [(27,114),(143,112),(39,54),(126,53),(62,30),(111,30)]:
        s.poly([(x,y),(x+4,y-2),(x+6,y+2),(x+3,y+6),(x+7,y+9),(x+2,y+10)],'plaster_dark')
        s.poly([(x+1,y),(x+3,y),(x+3,y+4),(x+1,y+5)],'plaster')
    # The structural circle is 108x108; 4px stone ring outside it.
    s.ellipse((30,32,145,147),'stone_shade')
    s.ellipse((31,32,144,146),'stone')
    s.d.arc((31*S,32*S,144*S,146*S),180,285,fill=C['stone_hi'],width=2*S)
    s.d.arc((31*S,32*S,144*S,146*S),285,360,fill=C['stone_light'],width=S)
    for angle in range(0,360,30):
        a=math.radians(angle)
        s.line([(88+54*math.cos(a),90+54*math.sin(a)),(88+58*math.cos(a),90+58*math.sin(a))],'stone_shade')
    # Curving ceramic cap: continuous solid band with discrete glazed roll tiles.
    def ry(x): return 12+23*(abs(x-88)/66)**1.65
    upper=[(x,ry(x)) for x in range(22,155,2)]
    lower=[(x,ry(x)+12) for x in range(154,21,-2)]
    s.poly(upper+lower,'tile_shade')
    s.line([(x,ry(x)+3) for x in range(22,155,2)],'tile_light',3)
    s.line([(x,ry(x)) for x in range(22,155,2)],'stone_light',2)
    for x in range(24,153,6):
        y=ry(x); s.poly([(x,y+3),(x+2,y+3),(x+3,y+10),(x,y+10)],'tile_light')
        s.line([(x+3,y+4),(x+4,y+11)],'dark')
    for x,sgn in [(22,-1),(154,1)]:
        s.poly([(x,ry(x)+9),(x+sgn*8,ry(x)+4),(x+sgn*10,ry(x)-2),(x+sgn*7,ry(x)),(x,ry(x)+2)],'tile')
        s.line([(x,ry(x)+2),(x+sgn*7,ry(x)),(x+sgn*10,ry(x)-2)],'tile_light')
    # Shoulder roofs exactly meet ordinary wall y=baseline-64+2.
    for off in [0,152]:
        t=Surface(24,13); roof(t,24,1); s.im.alpha_composite(t.im,(off*S,84*S))
    s.ellipse((34,36,141.99,143.99),(0,0,0,0))
    return s,lambda x,y:(y<49 and 12<=x<=164) or (y<97 and (x<24 or x>=152))

manifest={'kit':'H-WALL','tile':32,'pieces':{}}
FULL={}
def emit(name,s,roofmask,foot,collide,anchor=None):
    im=s.finish(); FULL[name]=im
    a=np.array(im); yy,xx=np.indices(a.shape[:2]); mask=np.vectorize(roofmask)(xx,yy)
    base=a.copy(); cap=a.copy(); base[mask]=0; cap[~mask]=0
    anchor=anchor or [0,s.h]
    for suffix,arr,layer in [('',base,'base'),('_roof',cap,'roof')]:
        n=name+suffix; Image.fromarray(arr).save(OUT/(n+'.png'))
        p={'file':n+'.png','layer':layer,'anchor':anchor,'footprint':foot,'collide':collide if not suffix else []}
        if not suffix:p['pair']=name+'_roof'
        manifest['pieces'][n]=p

def create():
    OUT.mkdir(parents=True,exist_ok=True); REC.mkdir(parents=True,exist_ok=True)
    for n,w in [(2,64),(3,96),(4,128)]: emit('wall_h_'+str(n),*horizontal(w),[w,16],[[0,-16,w,16]])
    emit('wall_post',*post(),[14,16],[[1,-16,12,16]])
    for side in ['L','R']:
        emit('wall_end_'+side,*end(side),[22,16],[[0,-16,22,16]])
        emit('wall_corner_'+side,*corner(side),[48,64],[[0 if side=='L' else 32,-112,16,64],[0,-16,48,16]])
    for name,length in [('wall_v',64),('wall_v_4',128)]:
        emit(name,*vertical(length),[16,length],[[1,-length-14,16,length+14]])
    emit('moongate_h',*gate(),[176,16],[[0,-16,34,16],[142,-16,34,16]])
    (OUT/'kit.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    sheet(); assembly()

def font(size=12):
    return ImageFont.truetype('C:/Windows/Fonts/consola.ttf',size)

def sheet():
    width=1050; rowh=475
    sheet=Image.new('RGB',(width,rowh*len(FULL)),(39,40,36)); d=ImageDraw.Draw(sheet)
    for i,(name,im) in enumerate(FULL.items()):
        y=i*rowh; p=manifest['pieces'][name]
        d.text((16,y+8),f'{name}   {im.width}x{im.height}   anchor={p["anchor"]}   BASE+ROOF',font=font(15),fill='white')
        sheet.paste(im,(16,y+40),im)
        big=im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST); sheet.paste(big,(220,y+30),big)
        d.text((16,y+210),'1x',font=font(),fill='white'); d.text((800,y+40),'3x nearest',font=font(),fill='white')
    sheet.save(REC/'sheet.png')

def assembly():
    concept=Image.open(CONCEPT).convert('RGBA')
    # Exclusively unobstructed paving, no copied wall/rail/bamboo pixels.
    paving=concept.crop((210,34,266,74))
    scene=Image.new('RGBA',(480,270))
    for y in range(0,270,40):
        for x in range(0,480,56):scene.alpha_composite(paving,(x,y))
    placements=[('wall_h_2',-45,218),('wall_h_4',174,218),('wall_h_3',302,218),('wall_end_R',394,218),('moongate_h',0,218),('wall_post',171,218),('wall_post',296,218)]
    for name,x,y in placements:
        im=FULL[name]; scene.alpha_composite(im,(x,y-im.height))
    atlas=Image.open(ROOT/'public/assets/dao_si.png').convert('RGBA')
    frames=json.loads((ROOT/'public/assets/dao_si.json').read_text(encoding='utf-8'))['frames']
    f=next(f['frame'] for f in frames if f['filename']=='dao_si_idle_down_00')
    actor=atlas.crop((f['x'],f['y'],f['x']+64,f['y']+64))
    scene.alpha_composite(actor,(58,158)); scene.alpha_composite(actor,(254,180))
    scene.save(REC/'assembly-scene.png')
    board=Image.new('RGB',(976,302),(31,32,29)); board.paste(concept,(0,32)); board.paste(scene,(496,32))
    d=ImageDraw.Draw(board); d.text((8,8),'CONCEPT V1 1x',font=font(15),fill='white'); d.text((504,8),'H-WALL ASSEMBLY 480x270 1x',font=font(15),fill='white')
    board.save(REC/'assembly.png')
    (REC/'placements.json').write_text(json.dumps(placements,indent=2)+'\n',encoding='utf-8')

def verify():
    kit=json.loads((OUT/'kit.json').read_text(encoding='utf-8'))
    outside=0; images=0; overlap=0
    for name,p in kit['pieces'].items():
        a=np.array(Image.open(OUT/p['file']).convert('RGBA')); images+=1
        assert set(np.unique(a[:,:,3]))<={0,255},name
        used=np.unique(a[a[:,:,3]>0,:3],axis=0)
        outside+=sum(not np.any(np.all(PAL==c,axis=1)) for c in used)
        assert p['anchor'][1]<=a.shape[0] and p['anchor'][0]<a.shape[1]
        if p['layer']=='base':
            r=np.array(Image.open(OUT/kit['pieces'][p['pair']]['file']).convert('RGBA'))
            overlap+=int(((a[:,:,3]>0)&(r[:,:,3]>0)).sum())
    assert outside==0 and overlap==0
    gatebase=Image.open(OUT/'moongate_h.png').convert('RGBA'); gateroof=Image.open(OUT/'moongate_h_roof.png').convert('RGBA')
    g=np.array(Image.alpha_composite(gatebase,gateroof))
    hole=g[36:144,34:142,3]==0
    # Every sample inside the inscribed circle is transparent, including its centre.
    yy,xx=np.indices((108,108)); circle=(xx-53.5)**2+(yy-53.5)**2<=53**2
    assert hole[circle].all() and g[90,88,3]==0
    assert Image.open(REC/'assembly-scene.png').size==(480,270)
    result=f'PASS H-WALL PNG={images} K-A5={outside} alpha=0/255 roof_overlap={overlap} aperture=108x108 transparent=PASS assembly=480x270'
    print(result); (REC/'verify.log').write_text(result+'\n',encoding='utf-8')
    return result

if __name__=='__main__':
    if '--verify' in sys.argv:verify()
    elif '--repro' in sys.argv:
        before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*')}
        create();verify()
        after={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*')}
        assert before==after
        print(f'REPRO PASS {len(after)} files SHA256 identical')
    else:create();verify()
