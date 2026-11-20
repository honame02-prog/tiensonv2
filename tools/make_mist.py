# soft periodic mist texture for the ambient overlay (alpha quantised to 6 levels)
import numpy as np; from PIL import Image; from common import periodic_noise
n=0.6*periodic_noise(256,11,3)+0.4*periodic_noise(256,12,7); n=(n-n.min())/(n.max()-n.min())
a=np.clip((n-0.35)/0.65,0,1)**1.6*200
o=np.zeros((256,256,4),np.uint8); o[...,0]=226;o[...,1]=236;o[...,2]=236; o[...,3]=(np.round(a/40)*40).astype(np.uint8)
Image.fromarray(o).save('/workspace/game/tien-son-proto/public/assets/mist.png')
