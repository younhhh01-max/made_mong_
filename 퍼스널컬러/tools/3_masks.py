import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
src, outdir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
a = np.array(im).astype(float)
rgb, al = a[..., :3], a[..., 3] / 255
H, W = al.shape
lum = rgb @ np.array([0.299, 0.587, 0.114])
# 머리카락: 어두운 정도 x 불투명도
hair = np.clip((150 - lum) / 70, 0, 1) * al
hair[1262:] = 0
# 피부: 밝고 불투명한 곳, 옷 띠 위쪽만
skin = np.clip((lum - 120) / 40, 0, 1) * np.clip((al - 0.6) / 0.4, 0, 1)
skin[1262:] = 0
sk = Image.fromarray((skin * 255).astype(np.uint8))
d = ImageDraw.Draw(sk)
for cx in (455, 692.5):           # 눈은 빼기
    d.ellipse([cx - 58, 528, cx + 58, 588], fill=0)
d.ellipse([492, 772, 662, 858], fill=0)   # 입술 빼기
sk = sk.filter(ImageFilter.GaussianBlur(5))
hm = Image.fromarray((hair * 255).astype(np.uint8))
dh = ImageDraw.Draw(hm)
for cx in (455, 692.5):           # 눈동자·속눈썹 빼기
    dh.ellipse([cx - 62, 528, cx + 62, 598], fill=0)
dh.rectangle([520, 690, 635, 745], fill=0)   # 콧구멍
dh.ellipse([488, 768, 666, 862], fill=0)     # 입술
hm = hm.filter(ImageFilter.GaussianBlur(1.2))
half = (W // 2, H // 2)
sk.resize(half, Image.LANCZOS).save(f"{outdir}/skin_mask.jpg", quality=85)
hm.resize(half, Image.LANCZOS).save(f"{outdir}/hair_mask.jpg", quality=85)
im.save(f"{outdir}/face.webp", quality=90, method=6)
# 기준 피부색: 볼·이마·턱 평균
pts = [(440, 650, 30), (705, 650, 30), (577, 930, 25), (577, 610, 18)]
cols = [rgb[y - r:y + r, x - r:x + r].reshape(-1, 3).mean(0) for x, y, r in pts]
print("native skin", np.mean(cols, 0).round())
