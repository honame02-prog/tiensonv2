"""CM-WALL2. Source-cell assembly; no synthetic texture or random pixels."""
from pathlib import Path
import copy, hashlib, io, json, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

def install(g):
    root, out, ref = g['ROOT'],g['OUT'],g['REF']
    rec=root/'records/CM-WALL2'
    gate_build,gate_manifest=g['build'],g['manifest']
    quantize=g['quantize']; pal=g['PAL']
    old=json.loads((root/'public/assets/kits/C-B3/kit.json').read_text(encoding='utf-8'))
    names=['cwall_h_2','cwall_h_4','cwall_h_6','cwall_post','cwall_v','gate_v','corner_hv_L','corner_hv_R']
    crops={'left_plaster':[0,619,108,735], 'right_plaster':[514,619,618,735],
           'plinth':[0,735,108,759], 'tiles':[185,289,425,394]}
    def cell(src,box,size):
        x0,y0,x1,y1=box; w,h=size
        xe=np.linspace(x0,x1,w+1); ye=np.linspace(y0,y1,h+1)
        a=np.empty((h,w,3),np.uint8)
        for y in range(h):
            for x in range(w):
                p=src[round(ye[y]):max(round(ye[y])+1,round(ye[y+1])),round(xe[x]):max(round(xe[x])+1,round(xe[x+1]))]
                a[y,x]=np.median(p.reshape(-1,3),axis=0)
        return a
    def approved(name):
        b=subprocess.check_output(['git','show',f'3af2339:public/assets/kits/CM-WALL/{name}.png'],cwd=root)
        return np.array(Image.open(io.BytesIO(b)).convert('RGBA'))
    def build():
        src=np.array(Image.open(ref/'V1-original.png').convert('RGB'))
        # Same 3.14 source pixels/game pixel as the gate's central registration.
        left=cell(src,crops['left_plaster'],(34,37)); right=cell(src,crops['right_plaster'],(33,37))
        plinth=cell(src,crops['plinth'],(34,8))
        # Unbend the actual gate roof along its ridge, retaining round tile ends.
        roof=np.empty((20,76,3),np.uint8)
        for x in range(76):
            sx=185+x*240/76; dx=sx-307
            ridge=290+0.00078*dx*dx
            eave=365+0.00155*dx*dx
            roof[:,x]=cell(src,(sx,ridge,sx+240/76,eave),(1,20))[:,0]
        # Calibrate materials to the same quantized V1 medians as the gate.
        gate=np.array(gate_build()[1])
        sample=gate[40:120,34:158]
        red=(sample[:,:,0]>sample[:,:,1]*1.28)&(sample[:,:,3]>0)
        plaster_target=np.median(sample[red,:3],axis=0)
        materials=[(left,plaster_target),(right,plaster_target),(plinth,(67,64,58)),(roof,(74,72,63))]
        for a,target in materials:
            med=np.median(a.reshape(-1,3),axis=0)
            a[:]=quantize(np.clip(a.reshape(-1,3).astype(float)*np.array(target)/med,0,255)).reshape(a.shape)
        def horizontal(w,variant):
            a=np.zeros((70,w,4),np.uint8); a[:,:,3]=255
            pos=0; i=variant
            # Source-window quilting with a minimum-error cut through 8px overlap.
            # A seam follows low-contrast plaster, not a straight repeated stripe.
            while pos<w:
                donor=(left if i%2==0 else right).copy()
                if (i//2)%2: donor=donor[:,::-1]
                donor=np.roll(donor,(i*11+variant*7)%donor.shape[1],axis=1)
                n=min(donor.shape[1],w-pos); patch=np.zeros((70,n,3),np.uint8)
                patch[25:62]=donor[:,:n]
                for x in range(n):
                    rx=(x+i*13+variant*17)%76
                    patch[:20,x]=roof[:,rx];patch[20:25,x]=roof[15:20,rx]
                    patch[62:,x]=plinth[:,(x+i*9)%34]
                if pos==0:
                    a[:,:n,:3]=patch;pos=n-8
                else:
                    ov=min(8,n); error=((a[:,pos:pos+ov,:3].astype(float)-patch[:,:ov])**2).sum(axis=2)
                    cost=error.copy(); prev=np.zeros((70,ov),int)
                    for y in range(1,70):
                        for x in range(ov):
                            lo=max(0,x-1);hi=min(ov,x+2); q=lo+cost[y-1,lo:hi].argmin()
                            cost[y,x]+=cost[y-1,q];prev[y,x]=q
                    cut=np.zeros(70,int);cut[-1]=cost[-1].argmin()
                    for y in range(68,-1,-1):cut[y]=prev[y+1,cut[y+1]]
                    for y in range(70): a[y,pos+cut[y]:pos+n,:3]=patch[y,cut[y]:]
                    pos+=max(1,n-8)
                if pos+8>=w:break
                i+=1
            return a
        hs={n:horizontal(32*n,n//2) for n in (2,4,6)}
        # Controlled fill at modular boundaries, using the same source column.
        seam=hs[2][:,0].copy()
        for a in hs.values():
            for k in range(3):
                t=(3-k)/3
                for x in (k,a.shape[1]-1-k):
                    a[:,x,:3]=quantize(a[:,x,:3]*(1-t)+seam[:,:3]*t)
        wholes={f'cwall_h_{n}':Image.fromarray(a) for n,a in hs.items()}
        # Narrow post (20/16=1.25), its cap is a cut portion of the same eave.
        post=hs[4][:,48:68].copy()
        post[:20]=hs[2][:20,19:39]
        wholes['cwall_post']=Image.fromarray(post)
        # Turn source tiles along north/south: a 14px roof plus 6px red side.
        v=np.zeros((32,20,4),np.uint8); v[:,:,3]=255
        for y in range(32):
            v[y,:14,:3]=roof[np.linspace(0,19,14).astype(int),(y+21)%76]
            v[y,14:,:3]=right[(y+3)%37,10:16]
        # Roundtrip source rows at the wrap; no horizontal cap every 32 pixels.
        v[-1]=v[0]
        wholes['cwall_v']=Image.fromarray(v)
        gatev=np.zeros((80,24,4),np.uint8)
        gatev[:16,:20]=np.tile(v,(1,1,1))[:16]
        gatev[64:,:20]=v[16:]
        # Face at exposed ends, cut from the red plaster itself.
        gatev[13:16,3:18,:3]=right[21:24,8:23]; gatev[13:16,3:18,3]=255
        gatev[64:67,3:18,:3]=left[18:21,8:23]; gatev[64:67,3:18,3]=255
        wholes['gate_v']=Image.fromarray(gatev)
        corner=hs[2][:,:40].copy()
        for y in range(54): corner[y,:20]=v[y%32]
        wholes['corner_hv_L']=Image.fromarray(corner)
        wholes['corner_hv_R']=Image.fromarray(corner[:,::-1].copy())
        # ONLY permitted 34x70 end rectangles change. Every other layer byte stays.
        gateims,_,repair=gate_build()
        for name,im in list(gateims.items()):
            a=np.array(im); rooflayer='_roof' in name
            end=hs[2].copy()
            if rooflayer: end[20:]=0
            else: end[:20]=0
            a[76:146,:34]=end[:,30:64]; a[76:146,158:192]=end[:,:34]
            a[76:146,0]=end[:,0]; a[76:146,-1]=end[:,-1]
            gateims[name]=Image.fromarray(a)
        ims=dict(gateims)
        wholes['moongate_h']=Image.alpha_composite(gateims['moongate_h.png'],gateims['moongate_h_roof.png'])
        for name in names:
            a=np.array(wholes[name]); yy,xx=np.indices(a.shape[:2])
            if name=='cwall_v': mask=xx<14
            elif name=='gate_v': mask=(xx<14)&((yy<13)|(yy>=67))
            elif name.startswith('corner'):
                side=(xx<14) if name.endswith('L') else (xx>=26)
                mask=(yy<20)|(side&(yy<54))
            else: mask=yy<20
            b=a.copy(); r=a.copy(); b[mask]=0; r[~mask]=0
            ims[name+'.png']=Image.fromarray(b); ims[name+'_roof.png']=Image.fromarray(r)
        return ims,wholes,repair
    def manifest(repair):
        kit=gate_manifest(repair)
        for p in kit['pieces'].values():
            p['source']['seam_donor']='CM-WALL/cwall_h_2; source-cell plaster and flattened gate tiles; only 34x70 ends replaced'
        for name in names:
            for key in [name,name+'_roof']:
                p=copy.deepcopy(old['pieces'][key]); p['source']={'file':'.agents/refs/CM/V1-original.png','crops':crops,
                   'method':'median source cells; gate ridge unbending; material calibration to V1; exact palette; controlled boundary fill; 14px rotated tile roof for verticals'}
                kit['pieces'][key]=p
        return kit
    def verify(ims,wholes):
        kit=json.loads((out/'kit.json').read_text(encoding='utf-8')); colors=set()
        for name,whole in wholes.items():
            b=np.array(Image.open(out/(name+'.png')).convert('RGBA')); r=np.array(Image.open(out/(name+'_roof.png')).convert('RGBA'))
            assert b.shape==r.shape
            assert Image.open(out/(name+'.png')).size==Image.open(root/f'public/assets/kits/C-B3/{name}.png').size,(name,'size')
            for k in (name,name+'_roof'):
                for field in ['anchor','footprint','collide','pair','layer']:
                    assert kit['pieces'][k].get(field)==old['pieces'][k].get(field),(k,field)
            for a in (b,r):
                assert set(np.unique(a[:,:,3]))<={0,255},name
                colors.update(map(tuple,a[a[:,:,3]>0,:3]))
            assert not ((b[:,:,3]>0)&(r[:,:,3]>0)).any(),name
            assert np.array_equal(np.array(Image.alpha_composite(Image.fromarray(b),Image.fromarray(r))),np.array(whole)),name
        assert colors<=set(map(tuple,pal))
        mask=np.ones((146,192),bool); mask[76:146,:34]=False; mask[76:146,158:]=False
        for name in ('moongate_h','moongate_h_roof'):
            now=np.array(Image.open(out/(name+'.png')).convert('RGBA')); before=approved(name)
            assert np.array_equal(now[mask],before[mask]),'approved center changed: '+name
        print('PASS approved moongate: base+roof outside two 34x70 ends byte-identical 3af2339; changed protected pixels=0')
        h=[np.array(wholes[f'cwall_h_{n}']) for n in (2,4,6)]
        blocks=[a[:,x:x+32].tobytes() for a in h for x in range(0,a.shape[1],32)]
        assert len(set(blocks))==len(blocks),'identical horizontal 32px source blocks'
        diffs=[]
        for a in h:
            for b in h: diffs.append(float(np.abs(a[:,-1,:3].astype(float)-b[:,0,:3]).mean()))
        gate=np.array(wholes['moongate_h'])
        diffs += [float(np.abs(h[0][:,-1,:3].astype(float)-gate[76:146,0,:3]).mean()),float(np.abs(gate[76:146,-1,:3].astype(float)-h[0][:,0,:3]).mean())]
        assert max(diffs)<=5,diffs
        for a in h: assert np.where(a[:,0,3]>0)[0][0]==0
        v=np.array(wholes['cwall_v']); stack=np.tile(v,(3,1,1))
        vd=max(float(np.abs(stack[y-1].astype(float)-stack[y].astype(float)).mean()) for y in (32,64)); assert vd<=5
        assert not np.array(wholes['gate_v'])[16:64,:,3].any()
        assert np.array(wholes['cwall_post']).shape[1]/16<=1.3
        assert kit==json.loads(json.dumps(manifest(build()[2])))
        area=json.loads((root/'public/assets/areas/huyen-van-quan-v2/area.json').read_text(encoding='utf-8'))
        baseline=json.loads(subprocess.check_output(['git','show','HEAD:public/assets/areas/huyen-van-quan-v2/area.json'],cwd=root))
        expected=copy.deepcopy(baseline)
        expected['kits'].pop('C-B3',None)
        for p in expected['pieces']: p['k']=p['k'].replace('C-B3/','CM-WALL/')
        assert area==expected,'area modifications must only replace kit references'
        assert 'C-B3' not in json.dumps(area)
        print(f'PASS CM-WALL2 verify: {len(ims)} PNGs, dimensions/anchor/footprint/collide/pair=C-B3, alpha=0/255, palette={len(colors)}/{len(pal)}, base+roof=exact')
        print(f'PASS joins: horizontal+moongate mean RGB delta max={max(diffs):.3f}, roof y=0; unique horizontal blocks={len(set(blocks))}/{len(blocks)}; vertical 3-stack seam={vd:.3f}; post=1.25x; gate opening=48px; C-B3 refs=0; coordinates unchanged')
    def sheet(wholes):
        board=Image.new('RGB',(1440,2200),(42,46,42)); d=ImageDraw.Draw(board)
        x=y=12; rowh=0
        for name,im in wholes.items():
            w,h=im.size
            if x+w*4>1430: x=12;y+=rowh+32;rowh=0
            d.text((x,y),name,fill='white'); big=im.resize((w*4,h*4),Image.Resampling.NEAREST); board.paste(big,(x,y+18),big)
            x+=w*4+24;rowh=max(rowh,h*4+18)
        board.crop((0,0,1440,y+rowh+12)).save(rec/'sheet.png')
    def compare():
        _,wholes,_=build(); sheet(wholes)
        sh=Image.open(rec/'sheet.png'); board=Image.new('RGB',(1960,900+sh.height),(42,46,42)); d=ImageDraw.Draw(board)
        d.text((10,8),'V1 CONCEPT | GAME view 0,17.78125 - Dao Si',fill='white')
        board.paste(Image.open(ref/'V1.png').resize((960,540),Image.Resampling.NEAREST),(10,30))
        if (rec/'after-v1.png').exists(): board.paste(Image.open(rec/'after-v1.png').resize((960,540),Image.Resampling.NEAREST),(990,30))
        for i,label in enumerate(('west','east')):
            x=10+i*980; d.text((x,585),label+' BEFORE 3af2339 | AFTER',fill='white')
            for j,when in enumerate(('before','after')):
                p=rec/f'{when}-{label}.png'
                if p.exists():board.paste(Image.open(p).convert('RGB'),(x+j*490,610))
        d.text((10,890),'ALL NEW PIECES - 4x nearest - #2a2e2a',fill='white');board.paste(sh,(10,915));board.save(rec/'compare.png')
    def main():
        out.mkdir(parents=True,exist_ok=True);rec.mkdir(parents=True,exist_ok=True)
        ims,wholes,repair=build()
        if '--repro' in sys.argv:
            second,_,_=build(); dig=hashlib.sha256()
            for name,im in ims.items():
                a=g['pngbytes'](im); assert a==g['pngbytes'](second[name])==(out/name).read_bytes();dig.update(name.encode()+a)
            print(f'PASS repro: {len(ims)} PNGs; 2 independent builds = disk; SHA256={dig.hexdigest()}');return
        if '--verify' not in sys.argv and '--compare' not in sys.argv:
            for name,im in ims.items():(out/name).write_bytes(g['pngbytes'](im))
            (out/'kit.json').write_text(json.dumps(manifest(repair),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            sheet(wholes)
        verify(ims,wholes)
        if '--compare' in sys.argv:compare()
    g.update(build=build,manifest=manifest,verify=verify,compare=compare,main=main,REC=rec)
