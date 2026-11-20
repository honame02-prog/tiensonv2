# World palette = hero palette (48) + k-means colours from terrain swatches and prop sheet
import numpy as np
from PIL import Image
from common import *
ROOT='/workspace/game/tien-son-proto/'
hero=load_gpl('/workspace/game-art/characters/khach_lu_hanh_64/palette/tienson-48.gpl')
sw=np.array(Image.open(ROOT+'art/src/swatch.jpg').convert('RGB'),float)
pr=np.array(Image.open(ROOT+'art/src/props.jpg').convert('RGB'),float)
rng=np.random.default_rng(1)
a=sw.reshape(-1,3); a=a[rng.choice(len(a),40000)]
b=pr.reshape(-1,3); b=b[(b.min(1)<225)]; b=b[rng.choice(len(b),30000)]
X=np.concatenate([a,b]); L=to_lab(X); P=to_lab(hero); d=((L[:,None]-P[None])**2).sum(-1).min(1); X=X[d>40]
C=kmeans(to_lab(X),40); LX=to_lab(X); cols=[X[((LX-c)**2).sum(1).argmin()] for c in C]
pal=np.unique(np.round(np.concatenate([hero,np.array(cols),[[236,240,236],[255,255,255]]])).astype(int),axis=0)
save_gpl(ROOT+'art/palette/tienson-world.gpl',pal,'tienson-world'); print(len(pal))
