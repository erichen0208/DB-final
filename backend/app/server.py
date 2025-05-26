# app.py
from flask import Flask, jsonify, request, send_from_directory
import os
import glob
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure frames directory
INSERT_FRAMES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frames/insert')
SEARCH_FRAMES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frames/search')

@app.route('/api/insert/frames/<int:frame_id>', methods=['GET'])
def get_insert_frame(frame_id):
    """Return a specific frame by id"""
    frame_path = os.path.join(INSERT_FRAMES_DIR, f'frame_{frame_id}.json')
    
    if not os.path.exists(frame_path):
        return jsonify({'error': 'Frame not found'}), 404
    
    with open(frame_path, 'r') as f:
        frame_data = json.load(f)
    
    return jsonify(frame_data)

@app.route('/api/search/frames/<int:search_id>', methods=['GET'])
def get_search_frame(search_id):
    """Return a specific search path by id"""
    search_path = os.path.join(SEARCH_FRAMES_DIR, f'frame_{search_id}.json')
    
    if not os.path.exists(search_path):
        return jsonify({'error': 'Search path not found'}), 404
    
    with open(search_path, 'r') as f:
        search_data = json.load(f)
    
    return jsonify(search_data)

if __name__ == '__main__':
    app.run(debug=True)