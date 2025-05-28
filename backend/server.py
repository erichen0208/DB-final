from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import glob
import json

app = Flask(__name__)
CORS(app)  

# For RTree concept and search path improvement demo
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

# For real-time RTree demo
import csv
import sys
sys.path.append("RTreeDB/build")
import rtree_engine

db = rtree_engine.RTreeEngine()
weights = {
    "crowd": 0.5,
    "rating": 0.5
}

@app.route('/api/insert/cafes', methods=['POST'])
def insert_cafes_from_csv():
    try:
        with open('cafes.csv', 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            
            imported_count = 0
            for row in csv_reader:
                cafe = rtree_engine.Cafe()
                cafe.id = int(row['id'])
                cafe.name = row['name']
                cafe.rating = float(row['rating'])
                cafe.lat = float(row['latitude']) 
                cafe.lon = float(row['longitude'])
                cafe.current_crowd = int(row['current_crowd'])
                
                db.insert(cafe)
                imported_count += 1
        
        return jsonify({
            'status': 'success',
            'message': f'Imported {imported_count} cafes from CSV'
        })
        
    except Exception as e:
        return jsonify({'error': f'Error processing CSV: {str(e)}'}), 500

@app.route('/api/insert/cafe', methods=['POST'])
def insert_one_cafe():
    
    cafe = rtree_engine.Cafe()
    cafe.id = cafe_data['id']
    cafe.name = cafe_data['name']
    cafe.rating = cafe_data['rating']
    cafe.lat = cafe_data['lat']
    cafe.lon = cafe_data['lon']
    cafe.current_crowd = cafe_data['current_crowd']
    db.insert(cafe)

    return jsonify({'status': 'success'})

@app.route('/api/search/cafes', methods=['GET'])
def search_all_cafes():
    """Return all cafes in the database"""

    cafes = db.search(0.0, 0.0, 0.0, 0.0)
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'rating': c.rating,
        'lat': c.lat,
        'lon': c.lon,
        'current_crowd': c.current_crowd
    } for c in cafes])

@app.route('/api/search', methods=['GET'])
def search_cafe():
    
    lon = float(request.args.get('lon'))
    lat = float(request.args.get('lat'))
    radius = float(request.args.get('radius'))
    min_score = float(request.args.get('min_score'))

    cafes = db.search(lon, lat, radius, min_score)
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'rating': c.rating,
        'lat': c.lat,
        'lon': c.lon,
        'current_crowd': c.current_crowd
    } for c in cafes])

@app.route('/api/update/weights', methods=['PUT'])
def update_weights():
    """Update the weights for crowd and rating"""
    global weights
    data = request.json
    
    if 'crowd' in data:
        weights['crowd'] = data['crowd']
    
    if 'rating' in data:
        weights['rating'] = data['rating']
    
    return jsonify({'status': 'success', 'weights': weights})

if __name__ == '__main__':
    app.run(debug=True)