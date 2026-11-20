# Sea of clouds below the southern cliff (replaces the flat grey "void" band).
# Horizontally tileable. Rows of round cumulus puffs, lit from the upper left, quantised to a 6-tone ramp; farther rows hazier.
import numpy as np; from PIL import Image
W,H=512,224
RAMP=np.array([(118,132,156),(142,156,178),(172,183,200),(204,210,220),(228,230,232),(247,244,236)],float)
HAZE=np.array((150,166,184),float)
img=np.zeros((H,W,3)); 
for y in range(H): img[y]=HAZE*(0.92+0.08*y/H)
rng=np.random.default_rng(7)
yy,xx=np.mgrid[0:H,0:W]
L=np.array([-0.45,-0.75,0.5]); L/=np.linalg.norm(L)
rows=[(18,7,11),(40,9,14),(66,11,17),(96,13,20),(130,15,24),(170,17,28),(214,19,32)]
for ri,(base,rmin,rmax) in enumerate(rows):
    buf=np.full((H,W),-1.0); x=rng.uniform(0,20)
    while x<W:
        r=rng.uniform(rmin,rmax); cy=base-rng.uniform(0,r*0.5)
        for dx in (-W,0,W):
            d2=((xx-(x+dx))/r)**2+((yy-cy)/r)**2
            m=d2<1
            nz=np.sqrt(np.clip(1-d2,0,1)); nx=(xx-(x+dx))/r; ny=(yy-cy)/r
            b=np.clip(nx*L[0]+ny*L[1]+nz*L[2],0,1)
            b=0.25+0.75*b
            buf=np.where(m&(b>buf)|(m&(buf<0)),np.where(m,b,buf),buf)
        x+=r*rng.uniform(0.9,1.4)
    # fill below the puff row down to the bottom with the row's shadow body
    filled=buf>=0
    first=np.where(filled.any(0),filled.argmax(0),H)
    body=yy>=first[None,:]
    shade=np.where(filled,buf,np.clip(0.3-0.004*(yy-base),0.05,0.3))
    k=np.clip(np.round(shade*5.4),0,5).astype(int)
    col=RAMP[k]
    haze=max(0,0.45-0.08*ri)
    col=col*(1-haze)+HAZE*haze
    img=np.where((filled|body)[...,None],col,img)
for y in range(8): img[y]*=0.72+0.035*y          # contact shadow under the cliff
Image.fromarray(np.clip(img,0,255).astype(np.uint8)).save('/workspace/game/tien-son-proto/public/assets/cloudsea.png'); print('ok')
