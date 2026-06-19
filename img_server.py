"""Flask-based save server for canvas image frames."""
import sys, os
from flask import Flask, request, make_response

DST = r'C:\Users\Mark Eichenlaub\github-aops\phet-replacement\media\new'
FRAMES_DIR = r'C:\Users\Mark Eichenlaub\github-aops\phet-replacement\media\gif_frames'

app = Flask(__name__)

@app.after_request
def cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return resp

@app.route('/', methods=['OPTIONS', 'POST'])
def save():
    if request.method == 'OPTIONS':
        return make_response('', 200)
    filename = request.args.get('filename', 'image.bin')
    subdir = request.args.get('dir', None)
    dest_dir = os.path.join(FRAMES_DIR, subdir) if subdir else DST
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, filename)
    data = request.get_data()
    with open(dest, 'wb') as f:
        f.write(data)
    sys.stderr.write(f'SAVED {len(data)}b -> {subdir or ""}/{filename}\n')
    sys.stderr.flush()
    return 'ok', 200

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8744
    app.run(host='127.0.0.1', port=port, threaded=True)
