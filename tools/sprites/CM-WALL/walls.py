"""CM-WALL3. Source-cell assembly; no synthetic texture or random pixels."""
from pathlib import Path
import copy, hashlib, io, json, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

def install(g):
    root, out, ref = g['ROOT'],g['OUT'],g['REF']
    rec=root/'records/CM-WALL3'
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
            sx=185+x*195/76; dx=sx-307
            ridge=286+0.0025*dx*dx
            eave=359+0.0022*dx*dx
            roof[:,x]=cell(src,(sx,ridge,sx+195/76,eave),(1,20))[:,0]
        # Calibrate materials to the same quantized V1 medians as the gate.
        gate=np.array(gate_build()[1])
        sample=gate[40:120,34:158]
        red=(sample[:,:,0]>sample[:,:,1]*1.28)&(sample[:,:,3]>0)
        plaster_target=np.median(sample[red,:3],axis=0)
        materials=[(left,plaster_target),(right,plaster_target),(plinth,(67,64,58)),(roof,(74,72,63))]
        for a,target in materials:
            med=np.median(a.reshape(-1,3),axis=0)
            a[:]=quantize(np.clip(a.reshape(-1,3).astype(float)*np.array(target)/med,0,255)).reshape(a.shape)
        # Distinct source windows: tall flaking, shallow wear, and almost intact
        # plaster. Do not roll a 33px donor: that formerly made shell rhythms.
        patches=[('V1-original.png',(0,619,105,733)),
                 ('V1-original.png',(516,620,614,730)),
                 ('V1-original-gate.png',(3,622,107,710)),
                 ('V1-original.png',(518,623,611,689)),
                 ('V1-original-gate.png',(22,626,108,734)),
                 ('V1-original.png',(0,622,82,718)),
                 ('V1-original-gate.png',(517,621,604,733)),
                 ('V1-original.png',(6,620,101,696)),
                 ('V1-original.png',(525,618,615,724)),
                 ('V1-original-gate.png',(1,622,91,725)),
                 ('V1-original.png',(28,625,108,732)),
                 ('V1-original-gate.png',(534,623,616,700))]
        donors=[]
        for i,(file,box) in enumerate(patches):
            raw=cell(np.array(Image.open(ref/file).convert('RGB')),box,(40,37))
            # Match intact RED pixels only, never normalize by the amount of white
            # exposed plaster (which formerly darkened entire patch columns).
            red=(raw[:,:,0]>raw[:,:,1]*1.35)
            med=np.median(raw[red],axis=0)
            raw=quantize(np.clip(raw.reshape(-1,3).astype(float)*plaster_target/med,0,255)).reshape(raw.shape)
            if i%3==1: raw=raw[:,::-1].copy()
            donors.append(raw)
        # A single straight ridge from the concept, removing moss/tree/cap intrusions.
        # The complete roof slope is still the unbent original tile surface above.
        for y in range(6):
            row=roof[y].astype(float);lum=row.mean(axis=1)
            target=np.maximum(lum,108) if y<2 else np.minimum(lum,90)
            roof[y]=quantize(np.clip(row*target[:,None]/np.maximum(lum[:,None],1),0,255))
        def horizontal(w,variant):
            a=np.zeros((70,w,4),np.uint8);a[:,:,3]=255
            face=np.empty((37,w,3),np.uint8)
            start={1:0,2:2,3:6,4:9,5:10}.get(variant,0)
            # Overlap blend conceals a cut without a dark straight vertical stripe.
            pos=0;idx=start
            while pos<w:
                donor=donors[idx%len(donors)];n=min(40,w-pos)
                if pos:
                    overlap=min(8,n)
                    for x in range(overlap):
                        t=(x+1)/(overlap+1)
                        face[:,pos+x]=quantize(face[:,pos+x]*(1-t)+donor[:,x]*t)
                    face[:,pos+overlap:pos+n]=donor[:,overlap:n]
                else:face[:,:n]=donor[:,:n]
                if pos+n==w:break
                pos+=32;idx+=1
            # Remove only long column shadows caused by the cut, preserving flecks.
            for unused in range(2):
                lum=face[:23].mean(axis=(0,2))
                for x in range(2,w-2):
                    neighbor=(lum[x-2:x].mean()+lum[x+1:x+3].mean())/2
                    if neighbor-lum[x]>4:
                        face[:,x]=quantize(np.clip(face[:,x].astype(float)+(neighbor-lum[x]-2),0,255))
            a[25:62,:,:3]=face
            # Continuous tile run; no independent roof quilt with an offset ridge.
            for x in range(w):
                rx=(x+variant*17)%76
                a[:20,x,:3]=roof[:,rx];a[20:25,x,:3]=roof[15:20,rx]
                a[62:,x,:3]=plinth[:,(x+variant*7)%34]
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
        post=horizontal(20,5)
        post[:20]=hs[2][:20,19:39]
        wholes['cwall_post']=Image.fromarray(post)
        # Real N/S wall roof from V1: two slopes and a bright axial ridge.
        # 18px roof + 10px plaster; 28px canvas overhangs the 16px footprint.
        vr=cell(src,(638,6,695,270),(18,84))
        med=np.median(vr.reshape(-1,3),axis=0)
        vr=quantize(np.clip(vr.reshape(-1,3).astype(float)*(74,72,63)/med,0,255)).reshape(vr.shape)
        v=np.zeros((32,28,4),np.uint8);v[:,:,3]=255
        v[:,:18,:3]=vr[13:45]
        v[:,18:,:3]=donors[7][2:34,10:20]
        # Fix the ONLY modular wrap; preserve all internal roof tile courses.
        for j in range(3):
            t=(3-j)/3
            for y in (j,31-j):
                v[y,:,:3]=quantize(v[y,:,:3]*(1-t)+v[0,:,:3]*t)
        wholes['cwall_v']=Image.fromarray(v)
        gatev=np.zeros((80,28,4),np.uint8)
        gatev[:16]=v[:16];gatev[64:]=v[16:]
        # Actual decorated gable termination, not another horizontal tile rung.
        gable=cell(src,(638,274,696,314),(18,12))
        med=np.median(gable.reshape(-1,3),axis=0)
        gable=quantize(np.clip(gable.reshape(-1,3).astype(float)*(78,74,64)/med,0,255)).reshape(gable.shape)
        gatev[4:16,:18,:3]=gable
        gatev[64:76,:18,:3]=gable[::-1]
        # Clearly outlined red end faces; all colors sampled from the source.
        for y0 in (12,64):
            gatev[y0:y0+4,18:,:3]=donors[3][10:14,12:22]
            gatev[y0:y0+4,18,:3]=plinth[2,6]
            gatev[y0:y0+4,27,:3]=plinth[5,12]
        wholes['gate_v']=Image.fromarray(gatev)
        corner=horizontal(40,4)
        # Overlapping elbow: vertical surface continues into the horizontal eave.
        # Keep the lower horizontal plaster, so neither branch ends in a gap.
        corner[:54,:28]=np.tile(v,(2,1,1))[:54]
        corner[:20,18:]=hs[2][:20,18:40]
        wholes['corner_hv_L']=Image.fromarray(corner)
        rightcorner=horizontal(40,5)
        rightcorner[:54,12:]=np.tile(v[:,::-1],(2,1,1))[:54]
        rightcorner[:20,:22]=hs[2][:20,:22]
        wholes['corner_hv_R']=Image.fromarray(rightcorner)
        # ONLY permitted 34x70 end rectangles change. Every other layer byte stays.
        # 22/11: nguyet mon lam lai theo cong thuc CM-TERR (moongate.py); chi thay 2 dau 34x70 nhu cu.
        import moongate
        gateims,_=moongate.build(); repair=0
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
            if name=='cwall_v': mask=xx<18
            elif name=='gate_v': mask=xx<18
            elif name.startswith('corner'):
                side=(xx<18) if name.endswith('L') else (xx>=22)
                mask=(yy<20)|(side&(yy<54))
            else: mask=yy<20
            b=a.copy(); r=a.copy(); b[mask]=0; r[~mask]=0
            ims[name+'.png']=Image.fromarray(b); ims[name+'_roof.png']=Image.fromarray(r)
        return ims,wholes,repair
    def manifest(repair):
        kit=gate_manifest(repair)
        import moongate
        for p in kit['pieces'].values():
            p['source']=json.loads(json.dumps(moongate.SOURCE))
        for name in names:
            for key in [name,name+'_roof']:
                p=copy.deepcopy(old['pieces'][key]); p['source']={'file':'.agents/refs/CM/V1-original.png','crops':crops,
                   'method':'CM-WALL3: 12 distinct original/gate source windows with overlap; intact-red median calibration; straight source ridge; actual vertical two-slope roof crop [638,6,695,270]; 18px roof + 10px red side; 28px canvas, footprint/anchor unchanged; source gable [638,274,696,314]'}
                kit['pieces'][key]=p
        return kit
    def verify(ims,wholes):
        kit=json.loads((out/'kit.json').read_text(encoding='utf-8')); colors=set()
        for name,whole in wholes.items():
            b=np.array(Image.open(out/(name+'.png')).convert('RGBA')); r=np.array(Image.open(out/(name+'_roof.png')).convert('RGBA'))
            assert b.shape==r.shape
            expected_size={'cwall_v':(28,32),'gate_v':(28,80)}.get(name,Image.open(root/f'public/assets/kits/C-B3/{name}.png').size)
            assert Image.open(out/(name+'.png')).size==expected_size,(name,'size')
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
        import moongate
        mg,_=moongate.build()
        for name in ('moongate_h','moongate_h_roof'):
            now=np.array(Image.open(out/(name+'.png')).convert('RGBA')); before=np.array(mg[name+'.png'])
            assert np.array_equal(now[mask],before[mask]),'moongate centre differs from moongate.py: '+name
        print('PASS moongate: base+roof outside two 34x70 ends byte-identical to moongate.py (CM-TERR recipe 22/11)')
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
        from quality import verify_quality
        verify_quality(wholes,rec)
        print(f'PASS CM-WALL3 verify: {len(ims)} PNGs, dimensions=baseline except vertical canvas 28px; anchor/footprint/collide/pair=C-B3, alpha=0/255, palette={len(colors)}/{len(pal)}, base+roof=exact')
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
            x=10+i*980; d.text((x,585),label+' BEFORE ace6f0c | AFTER',fill='white')
            for j,when in enumerate(('before','after')):
                p=rec/f'{when}-{label}.png'
                if p.exists():board.paste(Image.open(p).convert('RGB'),(x+j*490,610))
        d.text((10,890),'ALL NEW PIECES - 4x nearest - #2a2e2a',fill='white');board.paste(sh,(10,915));
        y=board.height+20
        extra=Image.new('RGB',(max(2320,board.width),y+850),(42,46,42));extra.paste(board,(0,0));d=ImageDraw.Draw(extra)
        d.text((10,y),'REPEAT AUDIT: cwall_h_6 x3 adjacent / cwall_v x4 stacked - 4x nearest',fill='white')
        h=np.array(wholes['cwall_h_6']);strip=Image.fromarray(np.tile(h,(1,3,1)));strip=strip.resize((strip.width*4,strip.height*4),Image.Resampling.NEAREST);extra.paste(strip,(8,y+24),strip)
        v=np.array(wholes['cwall_v']);stack=Image.fromarray(np.tile(v,(4,1,1)));stack=stack.resize((stack.width*4,stack.height*4),Image.Resampling.NEAREST);extra.paste(stack,(8,y+24+strip.height+12),stack)
        extra=extra.crop((0,0,extra.width,y+24+strip.height+12+stack.height+12));extra.save(rec/'compare.png')
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
