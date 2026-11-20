import numpy as np
from PIL import Image

def load_gpl(path):
    cols=[]
    for line in open(path):
        p=line.split()
        if len(p)>=3 and all(t.isdigit() for t in p[:3]): cols.append([int(t) for t in p[:3]])
    return np.array(cols,float)

def save_gpl(path,cols,name):
    with open(path,'w') as f:
        f.write(f'GIMP Palette\nName: {name}\nColumns: 8\n#\n')
        for c in cols: f.write('%3d %3d %3d\t#%02x%02x%02x\n'%(*c,*c))

def to_lab(rgb):
    c=rgb/255.0; c=np.where(c>0.04045,((c+0.055)/1.055)**2.4,c/12.92)
    M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
    xyz=c@M.T/np.array([0.9505,1,1.089])
    f=np.where(xyz>0.008856,np.cbrt(xyz),7.787*xyz+16/116)
    return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)

def snap(rgb,pal):
    sh=rgb.shape; flat=rgb.reshape(-1,3).astype(float)
    L=to_lab(flat); P=to_lab(pal)
    out=np.empty(len(flat),int)
    for i in range(0,len(flat),65536):
        d=((L[i:i+65536,None,:]-P[None])**2).sum(-1); out[i:i+65536]=d.argmin(1)
    return pal[out].reshape(sh).astype(np.uint8)

def kmeans(X,k,it=25,seed=0):
    rng=np.random.default_rng(seed); C=X[rng.choice(len(X),k,replace=False)]
    for _ in range(it):
        lab=((X[:,None]-C[None])**2).sum(-1).argmin(1)
        for j in range(k):
            m=lab==j
            if m.any(): C[j]=X[m].mean(0)
    return C

def periodic_noise(n,seed,cut=4.0,shape=None):
    rng=np.random.default_rng(seed); h,w=shape or (n,n)
    F=np.fft.fft2(rng.standard_normal((h,w)))
    fy=np.fft.fftfreq(h)*h; fx=np.fft.fftfreq(w)*w
    R=np.sqrt(fy[:,None]**2+fx[None]**2)
    r=np.real(np.fft.ifft2(F*np.exp(-(R/cut)**2)))
    r-=r.mean(); return r/(np.abs(r).max()+1e-9)
