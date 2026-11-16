import sys
import numpy as np
from PIL import Image, ImageFilter
src, out, prev = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert("RGBA")
a = np.array(im).astype(float)
rgb, al = a[..., :3], a[..., 3] / 255
bg = np.array([222, 203, 185], float)
H, W = al.shape
# 바깥(투명) 영역에서 24px 안쪽까지를 가장자리로 본다
outside = Image.fromarray(((al < 0.5) * 255).astype(np.uint8))
near = np.array(outside.filter(ImageFilter.MaxFilter(49))) > 0
ys = np.arange(H)[:, None] * np.ones((1, W))
zone = near & (ys < 1110)
lum = rgb @ np.array([0.299, 0.587, 0.114])
bgl = bg @ np.array([0.299, 0.587, 0.114])
dark = np.clip((bgl - lum) / (bgl - 45) * 1.25, 0, 1)   # 머리카락일수록 1
al2 = al.copy()
al2[zone] = np.minimum(al[zone], dark[zone])
# 반투명 가장자리 색에서 배경색을 빼서 베이지 띠를 없앤다
m = (al2 > 0.02) & (al2 < 0.98)
fg = (rgb - (1 - al2[..., None]) * bg) / np.maximum(al2[..., None], 0.02)
rgb2 = rgb.copy()
rgb2[m] = np.clip(fg[m], 0, 255)
# 머리 가장자리(바깥 24px)는 밝은 띠가 남지 않게 머리카락 색으로 당긴다
hairc = np.array([54, 40, 34], float)
edge = zone & (al2 < 0.98)
w = dark[edge][:, None]
rgb2[edge] = rgb2[edge] * w + hairc * (1 - w)
al2[zone] = np.clip((al2[zone] - 0.35) / 0.65, 0, 1) ** 1.3
res = np.dstack([rgb2, al2 * 255]).astype(np.uint8)
Image.fromarray(res, "RGBA").save(out, optimize=True)
p = Image.new("RGBA", im.size, (70, 140, 90, 255)); p.alpha_composite(Image.fromarray(res, "RGBA"))
p.convert("RGB").crop((150, 0, 1000, 700)).save(prev)
