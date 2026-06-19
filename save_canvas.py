"""
Helper: reads base64 image files from the 'captures' folder and moves them
to phet-replacement/media/new with the correct filename.
Run: python save_canvas.py
"""
import os, base64, shutil

SRC = r'C:\Users\Mark Eichenlaub\Downloads'
DST = r'C:\Users\Mark Eichenlaub\github-aops\phet-replacement\media\new'

def move(src_name, dst_name):
    src = os.path.join(SRC, src_name)
    dst = os.path.join(DST, dst_name)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f'Copied {src_name} -> {dst_name}')
    else:
        print(f'NOT FOUND: {src_name}')

# Call this for each image after it's downloaded
files = [
    ('05_script_all_potential_v2.png', '05_script_all_potential_v2.png'),
    ('05_script_emilie_danger_v2.jpg', '05_script_emilie_danger_v2.jpg'),
    ('05_script_emilie_bottom1_v2.jpg', '05_script_emilie_bottom1_v2.jpg'),
    ('05_script_emilie_speed_ramp1_v2.png', '05_script_emilie_speed_ramp1_v2.png'),
    ('05_script_speedometer_fall_v2.png', '05_script_speedometer_fall_v2.png'),
]
for src, dst in files:
    move(src, dst)
