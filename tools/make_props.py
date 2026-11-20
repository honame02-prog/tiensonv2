# Slice props sheet -> transparent, scaled, palette-snapped PNGs -> atlas (Aseprite --sheet-pack if present, else own shelf packer)
import json,os,shutil,subprocess,numpy as np
from PIL import Image
from scipy import ndimage as nd
from common import *
ROOT='/workspace/game/tien-son-proto/'; OUT=ROOT+'art/props/'; os.makedirs(OUT,exist_ok=True)
pal=load_gpl(ROOT+'art/palette/tienson-world.gpl')
im=np.array(Image.open(ROOT+'art/src/props.jpg').convert('RGB'),float)
P={'pavilion':((430,692,8,322),('w',192)),'pine':((851,1072,35,318),('h',120)),'plum':((1066,1278,41,324),('h',118)),
   'stone_lantern':((678,794,98,318),('h',50)),'paper_white':((793,848,166,309),('h',24)),'paper_teal':((853,909,173,309),('h',24)),
   'bamboo':((6,184,332,655),('h',130)),'shrine':((991,1266,340,664),('w',164)),'rock_a':((185,326,346,476),('w',56)),
   'rock_b':((319,429,354,449),('w',42)),'rock_c':((427,525,381,461),('w',38)),'rock_d':((161,270,502,623),('w',42)),
   'incense':((868,980,515,640),('w',38)),'koi_pond':((537,862,455,663),('w',150)),'bridge':((252,532,464,670),('w',164))}
meta={}
for name,((x0,x1,y0,y1),(ax,tv)) in P.items():
    c=im[y0:y1,x0:x1]
    white=(c.min(-1)>222)&((c.max(-1)-c.min(-1))<22)
    if name=='bridge': white|=(c.min(-1)>128)&((c.max(-1)-c.min(-1))<12)&(np.arange(c.shape[0])[:,None]>c.shape[0]*0.45)
    thr=25 if name in('pine','plum','bamboo') else 260
    lab,n=nd.label(white); bg=np.zeros_like(white)
    border=set(lab[0])|set(lab[-1])|set(lab[:,0])|set(lab[:,-1])
    sizes=nd.sum(white,lab,range(1,n+1))
    for i in range(1,n+1):
        if i in border or sizes[i-1]>thr: bg|=lab==i
    if name=='paper_white': bg=np.isin(lab,list(border-{0}))   # lantern body itself is near-white
    a=nd.binary_opening(~bg,iterations=1)
    # defringe: drop light, low-saturation JPEG halo pixels on the silhouette, then erode 1px
    halo=(c.min(-1)>175)&((c.max(-1)-c.min(-1))<40)&~nd.binary_erosion(a,iterations=4)
    if name!='paper_white': a&=~halo
    a=nd.binary_erosion(a,iterations=1 if name in('paper_white','paper_teal','bamboo') else 2).astype(float)
    l2,n2=nd.label(a>0.5)
    if n2>1:
        s2=nd.sum(a>0.5,l2,range(1,n2+1)); keep=[i+1 for i,v in enumerate(s2) if v>0.03*s2.max()]; a=np.isin(l2,keep).astype(float)
    ys,xs=np.nonzero(a); c=c[ys.min():ys.max()+1,xs.min():xs.max()+1]; a=a[ys.min():ys.max()+1,xs.min():xs.max()+1]
    h,w=a.shape; sc=tv/(w if ax=='w' else h); nw,nh=max(1,round(w*sc)),max(1,round(h*sc))
    pre=np.dstack([c*a[...,None],a*255]).astype(np.uint8)
    r=np.array(Image.fromarray(pre,'RGBA').resize((nw,nh),Image.LANCZOS),float)
    al=r[...,3]/255.0; rgb=r[...,:3]/np.maximum(al[...,None],1e-3)
    o=np.zeros((nh,nw,4),np.uint8); o[...,:3]=snap(np.clip(rgb,0,255),pal); o[...,3]=(al>0.5)*255
    Image.fromarray(o).save(OUT+name+'.png'); meta[name]={'w':nw,'h':nh,'scale':round(sc,3)}
def post(lname):
    L=np.array(Image.open(OUT+lname+'.png')); lh,lw=L.shape[:2]
    W_,H_=26,62; o=np.zeros((H_,W_,4),np.uint8); dark=(43,33,26); wood=(87,65,43); woodl=(124,88,52); px=5
    o[6:H_,px:px+4,:3]=wood; o[6:H_,px,:3]=woodl; o[6:H_,px+3,:3]=dark; o[6:H_,px:px+4,3]=255
    o[H_-3:H_,px-2:px+6,:3]=dark; o[H_-3:H_,px-2:px+6,3]=255
    o[6:9,px-1:W_-2,:3]=wood; o[6,px-1:W_-2,:3]=woodl; o[8,px-1:W_-2,:3]=dark; o[6:9,px-1:W_-2,3]=255
    cx=px+4+(W_-px-6)//2; o[9:12,cx,:3]=dark; o[9:12,cx,3]=255
    y0=12; x0=cx-lw//2; reg=o[y0:y0+lh,x0:x0+lw]; m=L[...,3]>0; reg[m]=L[m]
    return o
for k,src in (('lantern_post_white','paper_white'),('lantern_post_teal','paper_teal')):
    o=post(src); Image.fromarray(o).save(OUT+k+'.png'); meta[k]={'w':o.shape[1],'h':o.shape[0]}
foot={'pavilion':10,'shrine':10,'pine':8,'plum':8,'bamboo':8,'stone_lantern':3,'incense':3,'koi_pond':14,'bridge':18,
      'rock_a':5,'rock_b':4,'rock_c':4,'rock_d':5,'lantern_post_white':2,'lantern_post_teal':2,'paper_white':0,'paper_teal':0}
for k in meta: meta[k]['oy']=round(1-foot.get(k,4)/meta[k]['h'],4)
json.dump(meta,open(ROOT+'public/assets/props_meta.json','w'),indent=1)
files=sorted(OUT+k+'.png' for k in meta)
ase=shutil.which('aseprite') or ('/usr/local/bin/aseprite' if os.path.exists('/usr/local/bin/aseprite') else None)
if ase:
    subprocess.run([ase,'-b',*files,'--sheet',ROOT+'public/assets/props.png','--data',ROOT+'public/assets/props.json',
      '--sheet-pack','--format','json-hash','--filename-format','{title}','--shape-padding','2','--border-padding','1'],check=True)
else:  # simple shelf packer, Phaser/Aseprite-compatible json-hash
    ims=[(os.path.basename(f)[:-4],Image.open(f)) for f in files]; ims.sort(key=lambda t:-t[1].height)
    WID=512; x=y=1; rowh=0; pos={}
    for nm,img in ims:
        if x+img.width+1>WID: x=1; y+=rowh+2; rowh=0
        pos[nm]=(x,y); x+=img.width+2; rowh=max(rowh,img.height)
    Hh=y+rowh+1; sheet=Image.new('RGBA',(WID,Hh))
    fr={}
    for nm,img in ims:
        sheet.paste(img,pos[nm]); w,h=img.size
        fr[nm]={'frame':{'x':pos[nm][0],'y':pos[nm][1],'w':w,'h':h},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':w,'h':h},'sourceSize':{'w':w,'h':h},'duration':100}
    sheet.save(ROOT+'public/assets/props.png')
    json.dump({'frames':fr,'meta':{'app':'tools/make_props.py shelf packer','image':'props.png','size':{'w':WID,'h':Hh},'scale':'1'}},open(ROOT+'public/assets/props.json','w'),indent=1)
print('packed with','aseprite' if ase else 'own packer',len(meta),'props')
