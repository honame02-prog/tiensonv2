# Generate Tiled-format JSON map (40x30) for the mountain-terrace courtyard.
import json,math,numpy as np
from PIL import Image
from common import periodic_noise
ROOT='/workspace/game/tien-son-proto/'
IDX=json.load(open(ROOT+'tools/tileset_index.json')); names=IDX['names']; gid={n:i+1 for i,n in enumerate(names)}
PROPS=json.load(open(ROOT+'public/assets/props.json'))['frames'] if __import__('os').path.exists(ROOT+'public/assets/props.json') else {}
W,H=40,30; T=32; rng=np.random.default_rng(7)
G,S,P,Wt,C=0,1,2,3,4; TN={S:'stone',P:'path',Wt:'water',C:'cliff'}
V=np.zeros((H+1,W+1),int)   # vertex terrain
yy,xx=np.mgrid[0:H+1,0:W+1].astype(float)
nz=periodic_noise(64,5,6)[:H+1,:W+1]
# cliff rim (organic)
rim=np.minimum.reduce([xx-1.6-nz*0.8, W-1.6-xx+nz*0.7, yy-1.6+nz*0.8])
V[rim<0]=C
SOUTH_RIM=25   # tile rows >= SOUTH_RIM+? : cliff, then face, then mist
V[yy>=SOUTH_RIM]=C
# stream + pond
def sx(y): return 28.0+1.6*math.sin(y/3.6)
for y in range(H+1):
    for x in range(W+1):
        if 3.5<=y<=19 and abs(x-sx(y))<=1.1+0.25*nz[y,x]: V[y,x]=Wt
        if ((x-29.5)/4.6)**2+((y-19.5)/2.9)**2<=1+0.25*nz[y,x]: V[y,x]=Wt
# stone courtyard (pavilion) and shrine terrace
def rrect(x0,y0,x1,y1,r=1.5):
    cx=np.clip(xx,x0+r,x1-r); cy=np.clip(yy,y0+r,y1-r); return (xx-cx)**2+(yy-cy)**2<=r*r+0.01
V[rrect(7,7,20,18)]=S
V[rrect(31,3,38,9,1.2)]=S
# paths (polyline, width)
def seg(pts,wid=1.3):
    m=np.zeros_like(V,bool)
    for (x0,y0),(x1,y1) in zip(pts,pts[1:]):
        L=max(1e-6,math.hypot(x1-x0,y1-y0)); t=np.clip(((xx-x0)*(x1-x0)+(yy-y0)*(y1-y0))/L**2,0,1)
        dd=np.hypot(xx-(x0+t*(x1-x0)),yy-(y0+t*(y1-y0))); m|=dd<=wid+0.3*nz
    return m
BRIDGE_Y=10
pm=seg([(21.2,12.6),(23.5,11.6),(26.0,10.4)]) | seg([(31.0,10.4),(33.0,11.1),(35.8,11.0)]) \
   | seg([(13.5,19.3),(13.2,21.5),(11.8,23.3)]) | seg([(21.2,17.0),(23.4,19.2),(24.3,21.2)],1.1)
V[pm&(V==G)]=P
# sanitize: each tile may contain grass + one other terrain only
for it in range(6):
    bad=0
    for y in range(H):
        for x in range(W):
            q=V[y:y+2,x:x+2]; s=set(q.flatten())-{G}
            if len(s)>1:
                # priority: keep cliff/water, demote path then stone
                for k in (P,S,Wt):
                    if k in s and len(s)>1: q[q==k]=G; s.discard(k); bad+=1
    if not bad: break
# --- tile layers
ground=np.zeros((H,W),int); collide=np.zeros((H,W),bool)
cover=IDX.get('cover',{})
def pick(lst): return lst[rng.integers(len(lst))]
for y in range(H):
    for x in range(W):
        q=V[y:y+2,x:x+2]; s=set(q.flatten())-{G}
        if y>=SOUTH_RIM+3 and False: pass
        if not s:
            r=rng.random(); p=(y%2)*2+(x%2)
            nm = f'grass_{p}' if r<0.55 else pick([f'grass_{p}_v0',f'grass_{p}_v1']) if r<0.9 else f'petals_{p}'
        else:
            p=(y%2)*2+(x%2); X=s.pop(); code=(q[0,0]==X)*8+(q[0,1]==X)*4+(q[1,0]==X)*2+(q[1,1]==X)*1
            if code==15:
                nm=f'{TN[X]}_{p}' if (X==Wt or rng.random()<0.7) else f'{TN[X]}_{p}_v0'
            else:
                nm=IDX['trans'][TN[X]][str(code)][str(p)]
            if X in (Wt,C) and (code==15 or cover.get(nm,0)>0.45): collide[y,x]=True
        ground[y,x]=gid[nm]
# south drop: below the cliff rim -> cliff face row then mist
for x in range(W):
    col=[y for y in range(H) if all(V[y:y+2,x:x+2].flatten()==C) and y>SOUTH_RIM-2]
    if col:
        y0=col[0]+1
        for y in range(y0,H):
            ground[y,x]=gid[f'cliffface_{x%2}'] if y==y0 else gid['void_0']; collide[y,x]=True
# --- objects
objs=[]; oid=[1]
def prop(key,tx,ty,collider=None,**props):
    o={'id':oid[0],'name':key,'type':'prop','x':tx*T,'y':ty*T,'width':0,'height':0,'point':True,'rotation':0,'visible':True,
       'properties':[{'name':'key','type':'string','value':key}]+[{'name':k,'type':type(v).__name__ if not isinstance(v,str) else 'string','value':v} for k,v in props.items()]}
    oid[0]+=1; objs.append(o)
    if collider:
        w,h=collider; cobjs.append({'id':oid[0],'name':key+'_col','type':'collider','x':tx*T-w/2,'y':ty*T-h,'width':w,'height':h,'rotation':0,'visible':True}); oid[0]+=1
cobjs=[]
bx=sx(BRIDGE_Y)
prop('pavilion',13.5,13.9,(150,40))
prop('shrine',34.6,6.6,(128,40))
prop('incense',34.6,8.2,(26,10))
prop('stone_lantern',20.6,11.0,(20,10)); prop('stone_lantern',20.6,15.4,(20,10))
prop('stone_lantern',31.0,8.6,(20,10)); prop('stone_lantern',38.0,8.6,(20,10))
prop('stone_lantern',12.0,19.3,(20,10)); prop('stone_lantern',15.2,19.3,(20,10))
prop('lantern_post_white',7.6,8.2,(8,6)); prop('lantern_post_teal',19.4,8.2,(8,6))
prop('lantern_post_white',32.2,4.4,(8,6)); prop('lantern_post_teal',37.2,4.4,(8,6))
for (k,x,y) in [('pine',5.0,6.0),('pine',23.2,5.0),('pine',37.0,16.5),('pine',4.4,21.5),('pine',35.5,23.8),
                ('plum',9.8,5.2),('plum',18.8,22.8),('plum',24.0,15.5),('plum',33.4,13.0),('plum',21.5,25.0),
                ('bamboo',3.2,11.0),('bamboo',4.2,14.0),('bamboo',3.0,16.8),('bamboo',38.3,12.0)]:
    prop(k,x,y,(22 if k!='bamboo' else 34,12))
for (k,x,y) in [('rock_a',26.6,4.1),('rock_c',29.8,3.7),('rock_b',17.0,24.6),('rock_d',8.8,23.0),('rock_c',25.6,9.0),('rock_b',36.0,19.5),('rock_d',22.5,7.6)]:
    prop(k,x,y,(30,12))
prop('koi_pond',7.2,25.4,(110,40))
prop('bridge',bx,BRIDGE_Y+1.15,None)
# bridge: walk zone (removes water collision) + rails
bw=5*T
cobjs.append({'id':oid[0],'name':'bridge_walk','type':'walkable','x':(bx-2.2)*T,'y':(BRIDGE_Y-0.9)*T,'width':4.4*T,'height':1.4*T,'rotation':0,'visible':True}); oid[0]+=1
for yy_ in (BRIDGE_Y-1.25,BRIDGE_Y+0.55):
    cobjs.append({'id':oid[0],'name':'bridge_rail','type':'collider','x':(bx-1.6)*T,'y':yy_*T,'width':3.2*T,'height':0.35*T,'rotation':0,'visible':True}); oid[0]+=1
spawn={'id':oid[0],'name':'spawn','type':'spawn','x':13.0*T,'y':21.5*T,'width':0,'height':0,'point':True,'rotation':0,'visible':True}; oid[0]+=1
npc={'id':oid[0],'name':'tra_su','type':'npc','x':17.6*T,'y':15.6*T,'width':0,'height':0,'point':True,'rotation':0,'visible':True,
     'properties':[{'name':'dialog','type':'string','value':'tra_su'}]}; oid[0]+=1
# remove collision under bridge walk zone handled at runtime (object layer)
tileset={'firstgid':1,'name':'tienson32','image':'tileset32.png','imagewidth':IDX['columns']*T,'imageheight':((IDX['count']+IDX['columns']-1)//IDX['columns'])*T,
 'tilewidth':T,'tileheight':T,'columns':IDX['columns'],'tilecount':IDX['count'],'margin':0,'spacing':0,
 'tiles':[]}
colgids=sorted(set(int(g) for g in ground[collide]))
# collision as its own tile layer using the same tiles marked with property collides
for i,n in enumerate(names):
    b=n.split('_')[0]
    if b in('void','cliffface') or (b in('water','cliff') and '_t' not in n) or (b in('water','cliff') and cover.get(n,0)>0.45):
        tileset['tiles'].append({'id':i,'properties':[{'name':'collides','type':'bool','value':True}]})
coll=np.where(collide,ground,0)
def layer(i,name,data,vis=True): return {'id':i,'name':name,'type':'tilelayer','width':W,'height':H,'x':0,'y':0,'opacity':1,'visible':vis,'data':[int(v) for v in data.flatten()]}
m={'type':'map','version':'1.10','tiledversion':'1.11.0','orientation':'orthogonal','renderorder':'right-down','width':W,'height':H,'tilewidth':T,'tileheight':T,'infinite':False,
   'nextlayerid':6,'nextobjectid':oid[0],
   'layers':[layer(1,'ground',ground),layer(2,'collision',coll,False),
     {'id':3,'name':'props','type':'objectgroup','draworder':'topdown','x':0,'y':0,'opacity':1,'visible':True,'objects':objs,'properties':[{'name':'ysort','type':'bool','value':True}]},
     {'id':4,'name':'colliders','type':'objectgroup','draworder':'topdown','x':0,'y':0,'opacity':1,'visible':True,'objects':cobjs},
     {'id':5,'name':'actors','type':'objectgroup','draworder':'topdown','x':0,'y':0,'opacity':1,'visible':True,'objects':[spawn,npc]}],
   'tilesets':[tileset]}
json.dump(m,open(ROOT+'public/assets/map.json','w'))
# preview render
ts=np.array(Image.open(ROOT+'public/assets/tileset32.png').convert('RGB'))
out=np.zeros((H*T,W*T,3),np.uint8); C_=IDX['columns']
for y in range(H):
    for x in range(W):
        i=ground[y,x]-1; r,c=divmod(i,C_); out[y*T:(y+1)*T,x*T:(x+1)*T]=ts[r*T:(r+1)*T,c*T:(c+1)*T]
Image.fromarray(out).save(ROOT+'art/map_ground_preview.png')
print('ok', len(objs),'props')
