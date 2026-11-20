# Placeholder NPC "Trà Sư": palette-swapped idle frames of the hero (teal robe -> ochre, red scarf -> moss green)
import json,numpy as np,colorsys
from PIL import Image
ROOT='/workspace/game/tien-son-proto/'
im=np.array(Image.open(ROOT+'public/assets/hero.png').convert('RGBA')).astype(float)
fr={f['filename']:f['frame'] for f in json.load(open(ROOT+'public/assets/hero.json'))['frames']}
out=np.zeros((64,64*4,4),np.uint8)
for i,d in enumerate(['down','left','right','up']):
    f=fr[f'khach_lu_hanh_video_v2_walk_{d}_00']; c=im[f['y']:f['y']+64,f['x']:f['x']+64].copy()
    for y in range(64):
        for x in range(64):
            r,g,b,a=c[y,x]
            if a==0: continue
            h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255)
            hd=h*360
            if s>0.12 and 150<hd<230: h=32/360; s=min(1,s*1.25); l=min(1,l*1.08)      # teal/blue -> ochre
            elif s>0.25 and (hd<20 or hd>330): h=95/360; s*=0.7                       # red -> moss
            elif s<0.15 and 0.2<l<0.6: h=30/360; s=0.18; l*=1.05                       # grey coat -> warm grey-brown
            rr,gg,bb=colorsys.hls_to_rgb(h,l,s); c[y,x,:3]=[rr*255,gg*255,bb*255]
    out[:,i*64:(i+1)*64]=np.clip(c,0,255).astype(np.uint8)
Image.fromarray(out).save(ROOT+'public/assets/npc_trasu.png'); print('ok')
