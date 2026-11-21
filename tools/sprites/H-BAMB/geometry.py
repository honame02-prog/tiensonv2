"""Round-one complete-object bamboo geometry, adapted to warm hall tones."""
import math
import numpy as np
from PIL import Image, ImageDraw
import random
S=4
C_DK=[(20,17,13),(31,29,25),(37,36,30)]
C_MID=[(43,41,34),(52,49,43),(51,49,34)]
C_HI=[(65,62,45),(74,70,62),(81,77,70),(65,62,45)]


def blade(d, x, y, ang, ln, wd, col):
    """Tapered curved leaf blade; coordinates in 1x px, drawn at S x."""
    pts=[]
    n=6
    px,py=x,y
    for i in range(n+1):
        t=i/n
        a=ang
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
    base=[(37,36,30),(51,49,34)][tone]
    lit=[(51,49,34),(81,77,70)][tone]
    shade=[(20,17,13),(31,29,25)][tone]
    node=(20,17,13)
    n=int(abs(y1-y0))
    for i in range(n+1):
        y=y0-i if y1<y0 else y0+i
        x=x0+lean*(y0-y)/max(1,abs(y1-y0))
        d.rectangle([(x-w/2)*S,y*S,(x+w/2)*S-1,(y+1)*S-1],fill=base+(255,))
        d.rectangle([(x-w/2)*S,y*S,(x-w/2+max(1,w*.3))*S-1,(y+1)*S-1],fill=lit+(255,))
        d.rectangle([(x+w/2-max(1,w*.28))*S,y*S,(x+w/2)*S-1,(y+1)*S-1],fill=shade+(255,))
    # nodes
    sp=rng.uniform(21,26)
    yy=y0-6
    while yy>y1:
        x=x0+lean*(y0-yy)/max(1,abs(y1-y0))
        d.rectangle([(x-w/2-.6)*S,yy*S,(x+w/2+.6)*S-1,(yy+2)*S-1],fill=node+(255,))
        d.rectangle([(x-w/2)*S,(yy-2)*S,(x+w/2-w*.3)*S-1,yy*S-1],fill=lit+(255,))
        yy-=sp+rng.uniform(-3,3)


def draw_bamboo(w, h, seed, dens, kind='grove'):
    """dens(x)->0..1 left-to-right weight. Whole-object procedural drawing, 1x coords scaled by S."""
    rng=random.Random(seed)
    im=Image.new('RGBA',(w*S,h*S),(0,0,0,0))
    d=ImageDraw.Draw(im)
    def foot(x):
        # Broad rooting pads interrupted by narrow deep recesses, never a crop row.
        return h-3-(1.2+1.2*math.sin(x*.27+seed)+
                    19*max(0,math.sin(x*.077+seed*.7))**14)
    if kind in ('grove','wall'):
        # Dense back crowns compensate the open rooting recesses without
        # flattening the lower edge or changing the front lighting/material.
        crown_rng=random.Random(seed+901)
        for x in range(5,w-4,6):
            tuft(d,crown_rng,x,-2,.95,0)
    # 1. dark canopy mass (back): big overlapping tufts, filled solid
    for k in range(int(w*h/150*3.2)):
        x=rng.uniform(0,w)
        if rng.random()>dens(x)+0.08: continue
        y=rng.uniform(4,h*.74)
        tuft(d,rng,x,y,rng.uniform(1.0,1.5),0)
    # solid under-mass for density below canopy
    for k in range(int(w/3)):
        x=rng.uniform(0,w)
        if rng.random()>dens(x): continue
        for yy in range(int(h*.5),h-3,5):
            tuft(d,rng,x+rng.uniform(-6,6),yy,rng.uniform(.8,1.1),0)
    # Continuous shaded soil/low foliage behind the culms; the tips define its
    # irregular outline, rather than a rectangle reaching the image boundary.
    if kind in ('grove', 'wall'):
        edge=[(x*S,foot(x)*S) for x in range(1,w-1)]
        d.polygon([(S,h*.68*S),((w-2)*S,h*.68*S)]+edge[::-1],fill=C_DK[0]+(255,))
    # 2. back culms
    ncul=max(3,int(w/9))
    xs=sorted(rng.uniform(4,w-4) for _ in range(ncul))
    for x in xs:
        if rng.random()>dens(x)+.1: continue
        culm(d,x,foot(x)-2,2+rng.uniform(0,8),rng.uniform(4,5),rng.uniform(-4,4),rng,0)
    # 3. mid foliage
    for k in range(int(w*h/260)):
        x=rng.uniform(0,w)
        if rng.random()>dens(x): continue
        y=rng.uniform(6,h*.72)
        tuft(d,rng,x,y,rng.uniform(.9,1.3),1)
    # 4. front culms (thicker, lighter), fewer
    for x in xs[1::2]:
        if rng.random()>dens(x)+.1: continue
        culm(d,x+rng.uniform(-3,3),foot(x)-1,6+rng.uniform(0,14),rng.uniform(5,6.5),rng.uniform(-3,3),rng,1)
    # 5. highlight foliage top-left of crowns
    for k in range(int(w*h/380)):
        x=rng.uniform(0,w)
        if rng.random()>dens(x): continue
        y=[h*.10,h*.32,h*.54][k%3]+rng.uniform(-3,3)
        tuft(d,rng,x-3,y,rng.uniform(.75,1.0),2)
    # 6. Root fans, low drooping shrubs and moss-covered worn stones.
    for x in range(3,w-3,7):
        if rng.random()<dens(x)+.1:
            y=foot(x)-rng.uniform(3,7)
            tuft(d,rng,x+rng.uniform(-2,2),y,.65,0)
            tuft(d,rng,x-2,y-1,.48,1)
    for x in range(9,w-7,19):
        if rng.random()>dens(x)+.12: continue
        y=foot(x)-2; rw=rng.uniform(4,7)
        poly=[(x-rw,y-1),(x-rw+2,y-5),(x+2,y-6),
              (x+rw,y-3),(x+rw-1,y),(x-2,y+1)]
        d.polygon([(px*S,py*S) for px,py in poly],fill=(52,49,43,255))
        d.line([(px*S,py*S) for px,py in poly[:4]],fill=(67,64,58,255),width=S)
        tuft(d,rng,x-2,y-4,.32,1)
    a=np.array(im)
    xs=np.arange(w*S)/S
    cut=np.array([foot(x) for x in xs])*S
    yy=np.arange(h*S)[:,None]
    a[yy>cut[None,:]]=0
    if kind in ('left','right'):
        # A broken outer silhouette with separate leaning culms behind it.
        extent=9+8*np.sin(np.arange(h*S)/S*.071+seed)+5*np.sin(np.arange(h*S)/S*.23)
        xx=np.arange(w*S)[None,:]/S
        outside=(xx<extent[:,None]) if kind=='left' else (xx>w-1-extent[:,None])
        a[outside]=0
    return Image.fromarray(a)
