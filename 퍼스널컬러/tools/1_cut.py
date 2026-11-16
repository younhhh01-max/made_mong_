import sys
from PIL import Image
from rembg import remove, new_session
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
sess = new_session("isnet-general-use")
res = remove(im, session=sess, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=15, alpha_matting_erode_size=8)
res.save(out)
print(res.size)
