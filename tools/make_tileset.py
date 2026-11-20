# Build 32px seamless tileset + organic corner transitions from the swatch sheet.
# Each material = one 64x64 toroidally seamless texture (min-cut wrap at source res, box downscale x4),
# cut into 4 positional tiles (x%2,y%2). Variants share the base tile's 3px border => always seamless.
import json,numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter,binary_dilation
from common import *
ROOT='/workspace/game/tien-son-proto/'
pal=load_gpl(ROOT+'art/palette/tienson-world.gpl')
SW=np.array(Image.open(ROOT+'art/src/swatch.jpg').convert('RGB'),float)
T=32; K=64; S=4; N=K*S; M=36
CX=[(0,426),(427,853),(854,1280)]; CY=[(0,359),(360,720)]
def cell(c,r,pad=6):
    (x0,x1),(y0,y1)=CX[c],CY[r]; return SW[y0+pad:y1-pad,x0+pad:x1-pad]
def seam_path(err,start=None):
    R,m=err.shape; E=err.copy(); B=np.zeros((R,m),int)
    if start is not None: E[0]=1e18; E[0,start]=err[0,start]
    for r in range(1,R):
        for c in range(m):
            lo,hi=max(0,c-1),min(m,c+2); j=lo+np.argmin(E[r-1,lo:hi]); B[r,c]=j; E[r,c]=err[r,c]+E[r-1,j]
    return E,B
def backtrack(E,B,end):
    R=E.shape[0]; p=np.zeros(R,int); p[-1]=end
    for r in range(R-1,0,-1): p[r-1]=B[r,p[r]]
    return p
def wrap_x(I,N,m,cyclic=False):
    A=I[:,N:N+m]; Bm=I[:,0:m]; err=((A-Bm)**2).sum(-1)
    if not cyclic:
        E,Bk=seam_path(err); p=backtrack(E,Bk,E[-1].argmin())
    else:
        best=None
        for s in range(2,m-2,2):
            E,Bk=seam_path(err,s); lo,hi=max(0,s-1),s+2; e=E[-1,lo:hi].min()
            if best is None or e<best[0]: best=(e,backtrack(E,Bk,lo+E[-1,lo:hi].argmin()))
        p=best[1]
    out=I[:,:N].copy(); cols=np.arange(m)
    w=np.clip((cols[None,:]-p[:,None]+1.5)/3.0,0,1)[...,None]
    out[:,:m]=A*(1-w)+Bm*w
    return out
def make_periodic(I):
    H=wrap_x(I[:N+M,:N+M],N,M)
    return wrap_x(H.transpose(1,0,2),N,M,cyclic=True).transpose(1,0,2)
def down(I):
    h,w,_=I.shape; return I.reshape(h//S,S,w//S,S,3).mean((1,3))
def busyness(c):
    g=c.mean(-1); return np.abs(np.diff(g,axis=0)).mean()+np.abs(np.diff(g,axis=1)).mean()+c.std(axis=(0,1)).sum()*0.3
d=np.minimum.outer(np.arange(T),np.arange(T)); d=np.minimum(d,d[::-1,::-1])
def edgew(lo=3,hi=10): return np.clip((d-lo)/(hi-lo),0,1)[...,None]
def variant(base,v,lo=3,hi=10):
    v=v-v.reshape(-1,3).mean(0)+base.reshape(-1,3).mean(0); w=edgew(lo,hi); return base*(1-w)+v*w
tiles={}; cover={}; TEX={}
def sub(tex,p): r,c=divmod(p,2); return tex[r*T:(r+1)*T,c*T:(c+1)*T]
def crops2(img,size):
    h,w,_=img.shape; out=[]
    for y in np.linspace(0,h-size,3).astype(int):
        for x in np.linspace(0,w-size,4).astype(int): out.append(img[y:y+size,x:x+size])
    return out
def material(name,img,nvar=1,contrast=1.0):
    cs=crops2(img,N+M); order=np.argsort([busyness(c) for c in cs])
    tex=down(make_periodic(cs[order[0]])); m=tex.reshape(-1,3).mean(0); tex=(tex-m)*contrast+m; TEX[name]=tex
    small=crops2(img,T*S)
    for p in range(4):
        tiles[f'{name}_{p}']=sub(tex,p)
        for k in range(nvar):
            v=down(small[order[(p*nvar+k)%len(small)]])
            tiles[f'{name}_{p}_v{k}']=variant(sub(tex,p),(v-v.reshape(-1,3).mean(0))*contrast+v.reshape(-1,3).mean(0))
material('stone',cell(0,0),1,1.05); material('grass',cell(1,0),2,0.9)
material('path',cell(0,1),1,0.95); material('cliff',cell(1,1),1,1.0)
grass=TEX['grass']
# remove grey pebbles/dirt dashes from base grass (they repeated every 64px); variants keep theirs
LG=to_lab(grass); chm=np.hypot(LG[...,1],LG[...,2]); hu=np.degrees(np.arctan2(LG[...,2],LG[...,1]))
peb=binary_dilation((chm<19)|(hu<84),iterations=1)
gw=np.tile(grass,(3,3,1)); mw=np.tile(~peb,(3,3)).astype(float)
num=np.stack([uniform_filter(gw[...,i]*mw,15,mode='wrap') for i in range(3)],-1); den=uniform_filter(mw,15,mode='wrap')[...,None]+1e-6
fill=(num/den)[K:2*K,K:2*K]; nn=periodic_noise(K,77,10)[...,None]*14
grass[peb]=(fill+nn)[peb]
for p in range(4):
    tiles[f'grass_{p}']=sub(grass,p)
    for k in range(2):
        nm=f'grass_{p}_v{k}'; w=edgew(3,10); tiles[nm]=sub(grass,p)*(1-w)+tiles[nm]*w
# petals on moss -> colour-matched grass variants
pc=crops2(cell(2,1),T*S)
for p in range(4):
    v=down(pc[[1,5,6,10][p]]); red=(v[...,0]>v[...,1]*1.35)&(v[...,0]>90)
    v2=v.copy(); v2[~red]=v[~red]-v[~red].mean(0)+grass.reshape(-1,3).mean(0)
    w=edgew(4,11); w=np.where(red[...,None],np.maximum(w,edgew(2,5)),w)
    tiles[f'petals_{p}']=sub(grass,p)*(1-w)+v2*w
# water: synthesised (swatch water is full of koi) from sampled teal shades, ordered dither + glints
wc=cell(2,0); X=wc.reshape(-1,3); ok=(X[:,2]>X[:,0]*1.15)&(X[:,1]>X[:,0])&(X.max(1)<160)
sh=kmeans(X[ok][::5],4); sh=sh[np.argsort(sh.sum(1))]
n=0.7*periodic_noise(K,3,2.5)+0.3*periodic_noise(K,8,6)
bayer=np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]])/16.0
lev=(n+1)/2*2.2+0.4; lv=np.floor(lev+np.tile(bayer,(K//4,K//4))-0.5).clip(0,2).astype(int)
wt=sh[lv].copy(); rng=np.random.default_rng(4); hl=np.array([150,200,196])
for _ in range(26):
    y,x=rng.integers(K,size=2); L=rng.integers(2,5)
    for i in range(L): wt[y,(x+i)%K]=hl if i in(1,2) or L<3 else sh[3]
TEX['water']=wt
for p in range(4): tiles[f'water_{p}']=sub(wt,p)
cl=TEX['cliff']
for p in range(2):
    f=sub(cl,p).copy(); y=np.arange(T)[:,None,None]/T
    f=f*(0.85-0.5*y)+np.array([150,170,175])*(y**2)*0.45; f[:2]*=0.55; tiles[f'cliffface_{p}']=f
mn=periodic_noise(T,7,3); tiles['void_0']=np.array([200,214,215])+mn[...,None]*10
# corner transitions grass <-> X
yy,xx=np.mgrid[0:T,0:T]; u=(xx+0.5)/T; v=(yy+0.5)/T
NE=periodic_noise(K,21,3.0)*0.75+periodic_noise(K,33,8)*0.25
wint=np.clip(np.minimum.reduce([u,1-u,v,1-v])*4,0,1)
cfg={'stone':dict(amp=.30,ai=.12,rim=.04,dk=.55,lip=.0),'path':dict(amp=.36,ai=.14,rim=.03,dk=.82,lip=.0),
     'water':dict(amp=.26,ai=.14,rim=.06,dk=.6,lip=.035,foam=1),'cliff':dict(amp=.32,ai=.12,rim=.05,dk=.5,lip=.03)}
trans={}
for Xn,c in cfg.items():
    tex=TEX[Xn]
    for p in range(4):
        ne=sub(NE,p); ni=periodic_noise(T,200+p+len(Xn),4)
        for code in range(1,15):
            a,b_,cc,dd=[(code>>s)&1 for s in (3,2,1,0)]
            f=a*(1-u)*(1-v)+b_*u*(1-v)+cc*(1-u)*v+dd*u*v
            f=f+c['amp']*ne+c['ai']*ni*wint
            mask=f>0.5; t=np.where(mask[...,None],sub(tex,p),sub(grass,p)).copy()
            band=mask&(f<0.5+c['rim']); t[band]*=c['dk']
            if c['lip']: gl=(~mask)&(f>0.5-c['lip']); t[gl]*=0.8
            if c.get('foam'):
                fb=mask&(f>=0.5+c['rim'])&(f<0.5+c['rim']*1.7)
                t[fb]=t[fb]*0.4+np.array([170,215,205])*0.6
                spark=fb&(ne>0.35); t[spark]=np.array([225,238,232])
            nm=f'{Xn}_t{code:02d}_{p}'; tiles[nm]=t; cover[nm]=float(mask.mean())
            trans.setdefault(Xn,{}).setdefault(str(code),{})[str(p)]=nm
names=list(tiles); COLS=16; rows=(len(names)+COLS-1)//COLS
sheet=np.zeros((rows*T,COLS*T,4),np.uint8)
for i,nm in enumerate(names):
    r,cl_=divmod(i,COLS); sheet[r*T:(r+1)*T,cl_*T:(cl_+1)*T,:3]=snap(np.clip(tiles[nm],0,255),pal); sheet[r*T:(r+1)*T,cl_*T:(cl_+1)*T,3]=255
Image.fromarray(sheet).save(ROOT+'public/assets/tileset32.png')
json.dump({'tilesize':T,'columns':COLS,'count':len(names),'names':names,'trans':trans,'cover':cover},open(ROOT+'tools/tileset_index.json','w'))
print(len(names),'tiles',sheet.shape)
