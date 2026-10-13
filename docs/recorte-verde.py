"""Recorte adaptativo de vídeo em fundo verde (o verde pode variar/amarelar).
usage: process.py src out.mp4 mode [ss] [t] [vf] [mask]
 mode=stack -> cor em cima, alfa embaixo (H.264 comum)
 mode=bake  -> compõe sobre o creme do site
 mask: "x0,y0,x1,y1;..." (frações) forçadas a transparente (reflexos no fundo)"""
import subprocess, sys
import numpy as np

src, out, mode = sys.argv[1], sys.argv[2], sys.argv[3]
ss = sys.argv[4] if len(sys.argv) > 4 else "0"
tt = sys.argv[5] if len(sys.argv) > 5 else "60"
vf = sys.argv[6] if len(sys.argv) > 6 and sys.argv[6] else "null"
masks = [tuple(map(float, m.split(","))) for m in sys.argv[7].split(";")] if len(sys.argv) > 7 and sys.argv[7] else []

info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0",
                       "-i", src], capture_output=True, text=True).stdout.split("\n")[0].split(",")
probe = subprocess.run(["ffmpeg", "-v", "error", "-ss", ss, "-i", src, "-frames:v", "1", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       capture_output=True).stdout
# descobre o tamanho depois do filtro
dims = subprocess.run(["ffmpeg", "-v", "error", "-ss", ss, "-i", src, "-frames:v", "1", "-vf", vf, "-f", "image2pipe", "-vcodec", "ppm", "-"],
                      capture_output=True).stdout.split(b"\n")[1].split()
W, H = int(dims[0]), int(dims[1])

dec = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", ss, "-t", tt, "-i", src, "-an", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       stdout=subprocess.PIPE)
OH = H * 2 if mode == "stack" else H
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{OH}", "-r", "24", "-i", "-",
                        "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-g", "4", "-keyint_min", "4",
                        "-sc_threshold", "0", "-bf", "0", "-movflags", "+faststart", out], stdin=subprocess.PIPE)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
yy /= H
xx /= W
X = np.stack([np.ones_like(xx), xx, yy, xx * yy, xx ** 2, yy ** 2], -1)
mask = np.zeros((H, W), bool)
for x0, y0, x1, y1 in masks:
    mask |= (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
CREME = np.array([248, 234, 207], np.float32)
n = W * H * 3
while True:
    buf = dec.stdout.read(n)
    if len(buf) < n:
        break
    im = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    cand = (g > r * 0.95) & (g > b * 1.6) & (g - b > 60)
    bg = np.empty_like(im)
    A = X[cand][::9]
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, im[..., c][cand][::9], rcond=None)
        bg[..., c] = X @ coef
    dist = np.sqrt(((im - bg) ** 2).sum(-1))
    a = np.clip((dist - 28) / 72, 0, 1)
    a[cand & (dist < 45)] = 0
    # na área marcada só some o que tem cara de reflexo (verde-amarelado/claro); metal e louça ficam
    glare = mask & ((g >= r * 0.93) | ((r + g + b) / 3 > 238))
    a[glare] = 0
    a = a[..., None]
    fg = np.clip((im - (1 - a) * bg) / np.maximum(a, 0.03), 0, 255)
    fg[..., 1] = np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]) * 1.05 + 4)
    if mode == "stack":
        fg = a * fg + (1 - a) * fg.mean((0, 1))  # sem halo verde na interpolação
        frame = np.concatenate([fg, np.repeat(a * 255, 3, -1)], 0)
    else:
        # brilhos sem tom rosado: onde o azul passa o verde, vira branco quente
        lum = (fg * np.array([0.3, 0.59, 0.11], np.float32)).sum(-1, keepdims=True)
        pink = (fg[..., 2:3] > fg[..., 1:2])
        fg = np.where(pink, lum * np.array([1.06, 0.97, 0.84], np.float32), fg)
        frame = a * fg + (1 - a) * CREME
    enc.stdin.write(np.clip(frame + 0.5, 0, 255).astype(np.uint8).tobytes())
enc.stdin.close()
enc.wait()
dec.wait()
print("ok", out, W, H)
