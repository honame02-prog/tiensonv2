"""CM-WALL3 additional visual regression measurements (source-derived pixels)."""
import json
from itertools import combinations
import numpy as np
from PIL import Image

def verify_quality(wholes,rec):
    masks=[]; contrasts={}; ridges={}; edges={}
    def wear(a):
        rgb=a[:,:,:3].astype(float)
        return (rgb[:,:,0]-rgb[:,:,1]<16)&(rgb[:,:,1]>65)&(a[:,:,3]>0)
    for n in (2,4,6):
        name=f'cwall_h_{n}';a=np.array(wholes[name]);band=a[35:62]
        for x in range(0,a.shape[1],32):
            masks.append((f'{name}@{x}',wear(band[:,x:x+32])))
        # Compare full-height RED field (exclude roof shadow and actual erosion).
        lum=a[28:45,:,:3].astype(float).mean(axis=(0,2));d=[]
        for x in range(2,len(lum)-2):
            left=lum[x-2:x].mean();right=lum[x+1:x+3].mean()
            d.append(min(left,right)-lum[x])
        contrasts[name]=float(max(d))
        # Visual ridge registration, not just an opaque rectangular silhouette.
        top=(a[:,:,3]>0).argmax(axis=0);edges[name]=int(top.max()-top.min())
        luminance=a[:6,:,:3].mean(axis=2)
        ridge=luminance.argmax(axis=0);ridges[name]=int(ridge.max()-ridge.min())
    for name,x0,x1 in [('cwall_post',0,20),('corner_hv_L',28,40),('corner_hv_R',0,12)]:
        a=np.array(wholes[name])[35:62,x0:x1]
        # Normalize horizontal extent only, retaining every vertical erosion level.
        ids=np.floor(np.arange(32)*a.shape[1]/32).astype(int)
        masks.append((name,wear(a[:,ids])))
    pairs=[]
    for (an,a),(bn,b) in combinations(masks,2):
        union=(a|b).sum();score=float((a&b).sum()/union) if union else 1.
        pairs.append((score,an,bn))
    pairs.sort(reverse=True)
    report={'wear_metric':'intersection / union of exposed-plaster masks, 12 distinct 32px face windows + post + both exposed corner faces; rows35:62; R-G<16 and G>65',
        'wear_max_iou':pairs[0][0],'wear_worst_pair':pairs[0][1:],
        'wear_counts':{name:int(m.sum()) for name,m in masks},
        'red_column_threshold_rgb':8,'red_column_metric':'mean RGB on rows28:45; column lower than BOTH adjacent 2-column means',
        'red_column_max':contrasts,'roof_ridge_y_range':ridges,'roof_silhouette_y_range':edges}
    (rec/'quality.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('QUALITY',json.dumps(report))
    assert pairs[0][0]<=.70,('repeated erosion mask',pairs[:3])
    assert max(contrasts.values())<=8,('vertical dark stripe',contrasts)
    assert max(edges.values())<=1,('roof silhouette bump',edges)
    assert max(ridges.values())<=1,('ridge bump',ridges)
    print(f'PASS CM-WALL3 quality: erosion mask max IoU={pairs[0][0]:.3f} <=0.70 ({len(pairs)} pairs); dark column max={max(contrasts.values()):.3f} <=8 RGB; roof ridge y range={max(ridges.values())} <=1px')
