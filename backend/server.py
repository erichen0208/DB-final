from flask import Flask, jsonify, request, send_from_directory
from flask import Response, stream_with_context
from flask_cors import CORS
import os
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
    
    return jsonify(frame_data), 200

@app.route('/api/search/frames/<int:search_id>', methods=['GET'])
def get_search_frame(search_id):
    """Return a specific search path by id"""
    search_path = os.path.join(SEARCH_FRAMES_DIR, f'frame_{search_id}.json')
    
    if not os.path.exists(search_path):
        return jsonify({'error': 'Search path not found'}), 404
    
    with open(search_path, 'r') as f:
        search_data = json.load(f)
    
    return jsonify(search_data), 200

# For real-time RTree demo
import csv
from rtree_engine import Cafe, CafeLoc, RTreeEngine

db = RTreeEngine()
weights = {"curret_crowd": 0.5, "rating": 0.5}
cafe_file = 'csvs/cafes_100.csv'

@app.route('/api/initmysql', methods=['POST'])
def initialize_db():
    try:
        if db.init_mysql_connection():
            return jsonify({'status': 'success', 'message': 'MySQL connected'}), 200
        else:
            return jsonify({'status': 'error', 'message': 'MySQL connection failed'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/insert/cafes', methods=['POST'])
def insert_cafes_from_csv():
    try:
        cafes_batch = []
        
        with open(cafe_file, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            
            for row in csv_reader:
                cafe = Cafe()
                cafe.id = int(row['id'])
                cafe.name = row['name']
                cafe.rating = float(row['rating'])
                cafe.lat = float(row['latitude']) 
                cafe.lon = float(row['longitude'])
                cafe.current_crowd = int(row['current_crowd'])
                
                cafes_batch.append(cafe)
        
        # Insert all cafes at once using vector
        db.insert(cafes_batch)
        
        return jsonify({
            'status': 'success',
            'message': f'Imported {len(cafes_batch)} cafes from CSV'
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'Error processing CSV: {str(e)}'}), 500

@app.route('/api/search/cafes', methods=['GET'])
def search_cafes():
    try:
        required = ['lon', 'lat', 'radius', 'min_score']
        for param in required:
            if param not in request.args:
                return jsonify({'error': f'Missing required parameter: {param}'}), 400

        lon = float(request.args.get('lon'))
        lat = float(request.args.get('lat'))
        radius = float(request.args.get('radius'))
        min_score = float(request.args.get('min_score'))

        def generate():
            print("Streaming started")

            cafes = db.stream_search(lon, lat, radius, min_score, weights) 
            
            for i, cafe in enumerate(cafes):
                data = json.dumps({
                    'id': cafe.id,
                    'lat': cafe.lat,
                    'lon': cafe.lon
                })
                # print(f"Yielding cafe {i+1}: {data}")
                yield data + '\n' 
            
            print("Streaming ended")

        return Response(stream_with_context(generate()), mimetype='application/json')

    except ValueError:
        return jsonify({'error': 'Invalid parameter format. All parameters must be numbers.'}), 400
    except Exception as e:
        return jsonify({'error': f'Streaming search failed: {str(e)}'}), 500

@app.route('/api/search/cafes/regular', methods=['GET'])
def search_cafes_regular():
    try:
        print(weights)
        cafes = db.search(0, 0, 0, 0, weights)
        
        # Convert results to JSON format
        results = []
        for cafe in cafes:
            results.append({
                'id': cafe.id,
                'lat': cafe.lat,
                'lon': cafe.lon
            })
        
        print(f"Found {len(results)} cafes")
        
        return jsonify({
            'status': 'success',
            'count': len(results),
            'cafes': results
        }), 200

    except ValueError:
        return jsonify({'error': 'Invalid parameter format. All parameters must be numbers.'}), 400
    except Exception as e:
        return jsonify({'error': f'Search failed: {str(e)}'}), 500

@app.route('/api/update/weights', methods=['PUT'])
def update_weights():
    """Update the weights for crowd and rating"""
    global weights
    weights = request.json

    return jsonify({'status': 'success'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')