"""
Combine numbered PNG frames from gif_frames/<subdir>/ into an animated GIF.
Usage: python make_gif.py <subdir> <output_name.gif> [fps]
"""
import sys, os, glob
from PIL import Image

FRAMES_DIR = r'C:\Users\Mark Eichenlaub\github-aops\phet-replacement\media\gif_frames'
OUT_DIR = r'C:\Users\Mark Eichenlaub\github-aops\phet-replacement\media\new'

def make_gif(subdir, outname, fps=12):
    src = os.path.join(FRAMES_DIR, subdir)
    files = sorted(glob.glob(os.path.join(src, '*.png')) + glob.glob(os.path.join(src, '*.jpg')))
    if not files:
        print(f'No frames in {src}'); return
    frames = [Image.open(f).convert('RGBA') for f in files]
    # Convert to palette mode for GIF
    palette_frames = []
    for img in frames:
        bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        palette_frames.append(bg.convert('RGB').convert('P', palette=Image.Palette.ADAPTIVE, colors=256))
    out = os.path.join(OUT_DIR, outname)
    duration = int(1000 / fps)
    palette_frames[0].save(
        out, format='GIF', save_all=True,
        append_images=palette_frames[1:],
        duration=duration, loop=0, optimize=True
    )
    print(f'Saved {outname} ({len(frames)} frames @ {fps}fps) -> {out}')

if __name__ == '__main__':
    subdir = sys.argv[1]
    outname = sys.argv[2]
    fps = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    make_gif(subdir, outname, fps)
