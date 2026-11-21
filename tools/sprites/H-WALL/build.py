"""Reproducible H-WALL, ImageGen whole-object sources, median cells and hall palette; no concept architecture pixels.
Run from any directory: python -X utf8 tools/sprites/H-WALL/build.py [--verify|--repro]
Only the assembly floor samples the approved concept. No stochastic dithering.
"""
from pathlib import Path
import json, math, hashlib, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT/'public/assets/kits/H-WALL'
REC = ROOT/'records/S1-WALL2'
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

SOURCE = Path(__file__).resolve().parent/'source'
CACHE = {}

def source(name):
    if name not in CACHE:
        a=np.array(Image.open(SOURCE/(name+'.png')).convert('RGBA'))
        mag=(a[:,:,0]>100)&(a[:,:,2]>80)&(a[:,:,0]>a[:,:,1].astype(float)*1.4)&(a[:,:,2]>a[:,:,1].astype(float)*1.4)
        a[mag]=0
        im=Image.fromarray(a); CACHE[name]=im.crop(im.getbbox())
    return CACHE[name].copy()

def sample(im,w,h,material=None):
    # Median occupied samples into a 2px cluster grid, then exact hall palette.
    w2,h2=(w+1)//2,(h+1)//2
    a=np.array(im.convert('RGBA')); out=np.zeros((h2,w2,4),np.uint8)
    xs=np.rint(np.linspace(0,a.shape[1],w2+1)).astype(int)
    ys=np.rint(np.linspace(0,a.shape[0],h2+1)).astype(int)
    for y in range(h2):
        for x in range(w2):
            block=a[ys[y]:ys[y+1],xs[x]:xs[x+1]]
            solid=block[:,:,3]>0
            if solid.sum()>=max(1,solid.size/2):
                out[y,x,:3]=np.median(block[solid,:3],axis=0)
                out[y,x,3]=255
    colors=out[out[:,:,3]>0,:3].astype(np.int32)
    palette=PAL
    original_colors=colors.copy()
    if material=='mineral':
        palette=PAL[(PAL[:,0]-PAL[:,1]<15)&(PAL[:,0]-PAL[:,2]<22)]
    elif material in ('plaster','architecture'):
        # Pale weathered islands use mineral tones; the plaster stays russet.
        pale=(colors[:,0]>145)&(colors[:,1]>110)&(colors[:,2]>75)
        if pale.any():
            grey=(colors[pale]@np.array([.2126,.7152,.0722]))*.82
            colors[pale]=np.stack([grey+5,grey+2,grey-4],axis=1).astype(int)
    for i in range(0,len(colors),4096):
        q=colors[i:i+4096]
        colors[i:i+len(q)]=palette[((q[:,None,:]-palette[None,:,:])**2).sum(axis=2).argmin(axis=1)]
    if material=='architecture':
        mineral=(original_colors[:,0]<original_colors[:,1]*1.3)|(original_colors[:,0]-original_colors[:,2]<32)
        p=PAL[(PAL[:,0]-PAL[:,1]<15)&(PAL[:,0]-PAL[:,2]<22)]
        q=original_colors[mineral]
        if len(q): colors[mineral]=p[((q[:,None,:]-p[None,:,:])**2).sum(axis=2).argmin(axis=1)]
    out[out[:,:,3]>0,:3]=colors
    return Image.fromarray(out).resize((w2*2,h2*2),Image.Resampling.NEAREST).crop((0,0,w,h))

def surface(im):
    s=Surface(*im.size); s.im=im.resize((im.width*S,im.height*S),Image.Resampling.NEAREST)
    s.d=ImageDraw.Draw(s.im); return s

def wall_image(w):
    im=source('wall')
    # Explicit material bands retain 12px cap, 44px vertical plaster, 8px stone.
    # Original generation is 1716x566 after chroma removal.
    cuts=[0,153,510,im.height]
    out=Image.new('RGBA',(128,64))
    for sy0,sy1,dy,dh in zip(cuts,cuts[1:],[0,12,56],[12,44,8]):
        out.alpha_composite(sample(im.crop((0,sy0,im.width,sy1)),128,dh,'plaster' if dy==12 else 'mineral'),(0,dy))
    # A joinable module has no transparent end-column or cut-off foundation.
    a=np.array(out)
    a[:,:2]=a[:,2:4]; a[:,-2:]=a[:,2:4]
    out=Image.fromarray(a); d=ImageDraw.Draw(out)
    # Two 4px rows of cylindrical tile barrels + 2px ridge/eave.
    d.rectangle((0,0,127,1),fill=C['tile_light'])
    for row,ty in enumerate((2,6)):
        for x in range(0,128,6):
            d.rectangle((x,ty,x+3,ty+3),fill=C['tile'])
            d.rectangle((x,ty,x+1,ty+3),fill=C['tile_light'])
            d.rectangle((x+4,ty,x+5,ty+3),fill=C['tile_shade'])
    d.rectangle((0,10,127,11),fill=C['tile_shade'])
    # Wide damp trails hang from the eave, without letter-like cracks/speckles.
    for x,length in ((18,16),(54,24),(92,18),(116,12)):
        d.rectangle((x,12,x+3,17),fill=C['red_shade'])
        d.rectangle((x,18,x+1,12+length-1),fill=C['red_shade'])
    # Sparse exposed masonry in the worn lower plaster, 2px mortar courses.
    for x,y in ((8,48),(92,50)):
        d.rectangle((x+2,y,x+9,y+1),fill=C['red_shade'])
        d.rectangle((x,y+2,x+13,y+5),fill=C['red_shade'])
        d.rectangle((x+2,y+2,x+5,y+3),fill=C['stone_shade'])
        d.rectangle((x+8,y+2,x+11,y+3),fill=C['stone_shade'])
        if y+7<=55: d.rectangle((x+4,y+6,x+11,y+7),fill=C['stone_shade'])
    # Gray 8px foundation, staggered stone joints at least 2px wide.
    d.rectangle((0,56,127,63),fill=C['stone_shade'])
    for row,ty in enumerate((56,60)):
        for x in range(-16*row,128,32):
            d.rectangle((x+2,ty,x+29,ty+1),fill=C['stone_light'] if row==0 else C['stone'])
    a=np.array(out)
    for y in range(2,64):
        for x in range(128):
            if a[y,x,3]==0: a[y,x]=a[y,min(124,max(4,x)),:]
    return Image.fromarray(a).crop((0,0,w,64))

def masonry(s,x0,y0,x1,y1):
    im=wall_image(128).crop((0,56,128,64))
    im=sample(im,x1-x0+1,y1-y0+1)
    s.im.alpha_composite(im.resize((im.width*S,im.height*S),Image.Resampling.NEAREST),(x0*S,y0*S))

def horizontal(w):
    return surface(wall_image(w)),lambda x,y:y<13

def post():
    raw=source('post'); im=sample(raw,14,68,'plaster')
    # Source cap and foundation are mineral rather than reddish plaster.
    top=sample(raw.crop((0,0,raw.width,round(raw.height*.15))),14,12,'mineral')
    im.alpha_composite(top,(0,0))
    im.alpha_composite(wall_image(14).crop((0,56,14,64)),(0,60))
    return surface(im),lambda x,y:y<16

def end(side):
    raw=source('end'); im=sample(raw,22,64,'plaster')
    im.alpha_composite(sample(raw.crop((0,0,raw.width,round(raw.height*.16))),22,12,'mineral'),(0,0))
    im.alpha_composite(wall_image(22).crop((0,56,22,64)),(0,56))
    if side=='R': im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return surface(im),lambda x,y:y<13

def vertical(length):
    s=Surface(18,length+14)
    cap=wall_image(128).crop((0,0,128,12)).transpose(Image.Transpose.ROTATE_270)
    cap=sample(cap,14,length)
    s.im.alpha_composite(cap.resize((14*S,length*S),Image.Resampling.NEAREST),(3*S,0))
    s.rect((1,0,2,length+6),'red_shade'); s.rect((3,length,16,length+6),'red_shade')
    s.line([(1,0),(1,length+6)],'red_light',2)
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
    im=source('gate'); a=np.array(im)
    # Find the actual generated central opening; keep its source around the whole gate.
    hole=Image.fromarray(np.where(a[:,:,3]==0,255,0).astype(np.uint8)).copy()
    ImageDraw.floodfill(hole,(im.width//2,int(im.height*.64)),128)
    hy,hx=np.where(np.array(hole)==128)
    sx=[0,int(hx.min()),int(hx.max())+1,im.width]
    sy=[0,int(hy.min()),int(hy.max())+1,im.height]
    dx=[0,34,142,176]; dy=[0,36,144,148]
    out=Image.new('RGBA',(176,148))
    for yi in range(3):
        for xi in range(3):
            patch=im.crop((sx[xi],sy[yi],sx[xi+1],sy[yi+1]))
            # Material-aware median keeps the gray cap and russet underside distinct.
            out.alpha_composite(sample(patch,dx[xi+1]-dx[xi],dy[yi+1]-dy[yi], 'architecture'),(dx[xi],dy[yi]))
    # Exactly four stone pixels outside a strict 108x108 aperture. Blocky 2px
    # voussoirs prevent single-pixel sparks around the structural ring.
    ar=np.array(out); yy,xx=np.indices((148,176))
    r=np.sqrt((xx-87.5)**2+(yy-89.5)**2)
    # Reclaim any excess generated stone around the hole; the frame is 4px.
    grey=(ar[:,:,0].astype(int)-ar[:,:,1].astype(int)<20)
    ar[(r>58)&(r<=64)&grey]=C['red']
    ring=(r<=58)&(r>54)
    angle=np.arctan2(yy-89.5,xx-87.5)
    light=(xx+yy)<175
    ar[ring]=C['stone']
    ar[ring&light]=C['stone_light']
    ar[ring&(r>56)&light]=C['stone_hi']
    joints=(np.floor((angle+math.pi)*12/math.pi)%4==0)&ring
    ar[joints]=C['stone_shade']
    out=Image.fromarray(ar); d=ImageDraw.Draw(out)
    d.ellipse((34,36,141,143),fill=(0,0,0,0))
    # Straight 24px shoulders meet the other 64px wall modules at the same foot.
    for off in (0,152):
        # Remove the generation's original shoulder cap before fitting ours.
        ImageDraw.Draw(out).rectangle((off,54,off+23,147),fill=(0,0,0,0))
        shoulder=wall_image(24); out.alpha_composite(shoulder,(off,84))
    # Re-open structural hole after shoulders; base remains open for actors.
    ImageDraw.Draw(out).ellipse((34,36,141,143),fill=(0,0,0,0))
    return surface(out),lambda x,y:(y<49 and 12<=x<=164) or (y<97 and (x<24 or x>=152))

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
    # Grey rail/retaining-wall context is assembly-only, never exported as kit.
    d=ImageDraw.Draw(scene)
    d.rectangle((150,199,479,243),fill=C['stone_shade'])
    for row,y in enumerate(range(201,243,10)):
        for x in range(142-20*(row%2),480,40):
            d.rectangle((x+2,y+2,x+38,y+9),fill=C['stone'])
            d.rectangle((x+2,y+2,x+38,y+3),fill=C['stone_light'])
    d.rectangle((150,195,479,200),fill=C['stone_light'])
    for y in (177,189):
        d.rectangle((150,y,479,y+4),fill=C['stone'])
        d.rectangle((150,y,479,y+1),fill=C['stone_hi'])
    for x in range(154,480,32):
        d.rectangle((x,174,x+7,197),fill=C['stone_shade'])
        d.rectangle((x,172,x+9,176),fill=C['stone_light'])
        d.rectangle((x,177,x+3,195),fill=C['stone'])
    placements=[('wall_h_2',-38,218),('wall_h_2',147,218),('wall_end_R',205,218),('moongate_h',0,218),('wall_post',171,218)]
    # Wall behind rail context, as on concept's left courtyard ledge.
    # Draw stonework only to the right of the terminating red wall.
    context=scene.copy()
    for name,x,y in placements:
        im=FULL[name]; scene.alpha_composite(im,(x,y-im.height))
    scene.alpha_composite(context.crop((227,168,480,244)),(227,168))
    atlas=Image.open(ROOT/'public/assets/dao_si.png').convert('RGBA')
    frames=json.loads((ROOT/'public/assets/dao_si.json').read_text(encoding='utf-8'))['frames']
    f=next(f['frame'] for f in frames if f['filename']=='dao_si_idle_down_00')
    actor=atlas.crop((f['x'],f['y'],f['x']+64,f['y']+64))
    scene.alpha_composite(actor,(58,158)); scene.alpha_composite(actor,(254,180))
    scene.save(REC/'assembly-scene.png')
    board=Image.new('RGB',(976,302),(31,32,29)); board.paste(concept,(0,32)); board.paste(scene,(496,32))
    d=ImageDraw.Draw(board); d.text((8,8),'CONCEPT V1 1x',font=font(15),fill='white'); d.text((504,8),'H-WALL R2 / RAIL CONTEXT 1x',font=font(15),fill='white')
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
