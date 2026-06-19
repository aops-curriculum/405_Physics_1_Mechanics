"""
Dev server for energy_skate_park: serves static files + accepts POST /save to write images.
Run: python dev_server.py [port]   (default 8743)
"""
import sys, os
from flask import Flask, request, send_from_directory, make_response

ROOT = os.path.dirname(os.path.abspath(__file__))
MEDIA_NEW = r'C:\Users\Mark Eichenlaub\github-aops\phet-replacement\media\new'
FRAMES_DIR = r'C:\Users\Mark Eichenlaub\github-aops\phet-replacement\media\gif_frames'

app = Flask(__name__, static_folder=ROOT)

@app.route('/save', methods=['POST', 'OPTIONS'])
def save():
    if request.method == 'OPTIONS':
        r = make_response('', 200)
        return r
    filename = request.args.get('filename', 'image.bin')
    subdir = request.args.get('dir', None)
    dest_dir = os.path.join(FRAMES_DIR, subdir) if subdir else MEDIA_NEW
    os.makedirs(dest_dir, exist_ok=True)
    data = request.get_data()
    dest = os.path.join(dest_dir, filename)
    with open(dest, 'wb') as f:
        f.write(data)
    sys.stderr.write(f'SAVED {len(data)}b -> {subdir or "new"}/{filename}\n')
    sys.stderr.flush()
    return 'ok', 200

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def static_files(path):
    if not path:
        path = 'index.html'
    return send_from_directory(ROOT, path)

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8743
    sys.stderr.write(f'dev_server on 127.0.0.1:{port}, root={ROOT}\n')
    sys.stderr.flush()
    app.run(host='127.0.0.1', port=port, threaded=True)
