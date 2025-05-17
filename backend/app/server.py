# app.py
from flask import Flask, jsonify, request, send_from_directory
import os
import glob
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure frames directory
FRAMES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frames')

@app.route('/api/frames', methods=['GET'])
def get_frames():
    """Return a list of all available frames"""
    frame_files = sorted(glob.glob(os.path.join(FRAMES_DIR, 'frame_*.json')),
                         key=lambda x: int(os.path.basename(x).split('_')[1].split('.')[0]))
    
    frames = []
    for frame in frame_files:
        frame_id = int(os.path.basename(frame).split('_')[1].split('.')[0])
        frames.append({
            'id': frame_id,
            'filename': os.path.basename(frame)
        })
    
    return jsonify(frames)

@app.route('/api/frames/<int:frame_id>', methods=['GET'])
def get_frame(frame_id):
    """Return a specific frame by id"""
    frame_path = os.path.join(FRAMES_DIR, f'frame_{frame_id}.json')
    
    if not os.path.exists(frame_path):
        return jsonify({'error': 'Frame not found'}), 404
    
    with open(frame_path, 'r') as f:
        frame_data = json.load(f)
    
    return jsonify(frame_data)

@app.route('/api/frames/count', methods=['GET'])
def get_frame_count():
    """Return the total number of frames"""
    frame_files = glob.glob(os.path.join(FRAMES_DIR, 'frame_*.json'))
    return jsonify({'count': len(frame_files)})

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """Serve the React app - in production, this should use a proper web server"""
    if path != "" and os.path.exists("build/" + path):
        return send_from_directory('build', path)
    else:
        return send_from_directory('build', 'index.html')

if __name__ == '__main__':
    app.run(debug=True)