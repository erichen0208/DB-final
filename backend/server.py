from flask import Flask, jsonify, request
from flask import Response, stream_with_context
from flask_cors import CORS
import os
import json
import time
import queue
import threading

app = Flask(__name__)
CORS(app)  

# For RTree visualization
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

# For real-time demo
import csv
from rtree_engine import Cafe, CafeLoc, RTreeEngine

db = RTreeEngine()
weights = {"rating": 0.3, "price_level": 0.2, "current_crowd": 0.8, "distance": 1.2}

@app.route('/api/initmysql', methods=['POST'])
def initialize_db():
    try:
        if db.init_mysql_connection():
            return jsonify({'status': 'success', 'message': 'MySQL connected'}), 200
        else:
            return jsonify({'status': 'error', 'message': 'MySQL connection failed'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/insert/cafes/<int:num_cafes>', methods=['POST'])
def insert_cafes_from_csv(num_cafes):
    try:
        cafes_batch = []
        cafe_file = f'csvs/cafes_{num_cafes}.csv'
        
        with open(cafe_file, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            
            for row in csv_reader:
                cafe = Cafe()
                cafe.id = int(row['id'])
                cafe.name = row['name']
                cafe.rating = float(row['rating'])
                cafe.lat = float(row['latitude']) 
                cafe.lon = float(row['longitude'])
                cafe.price_level = int(row['price_level'])
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
        required = ['lon', 'lat', 'radius']
        for param in required:
            if param not in request.args:
                return jsonify({'error': f'Missing required parameter: {param}'}), 400

        lon = float(request.args.get('lon'))
        lat = float(request.args.get('lat'))
        radius = float(request.args.get('radius'))
        min_score = 0

        # Create a thread-safe queue
        result_queue = queue.Queue()
        search_complete = threading.Event()

        def cafe_callback(cafe_loc, cafe_details):
            """Callback function called by C++ for each found cafe"""
            data = {
                'id': cafe_loc.id,
                'lon': cafe_loc.lon,
                'lat': cafe_loc.lat,
                'name': f"Cafe {cafe_loc.id}",
                'rating': cafe_details.get("rating", 0.0),
                'price_level': cafe_details.get("price_level", 0),
                'current_crowd': cafe_details.get("current_crowd", 0),
                'score': cafe_details.get("score", 0.0),
                'distance': cafe_details.get("distance", 0.0)
            }
            result_queue.put(data)

        def search_thread():
            """Run the search in a separate thread"""
            try:
                db.stream_search(lon, lat, radius, min_score, weights, cafe_callback)
            except Exception as e:
                result_queue.put({'error': str(e)})
            finally:
                search_complete.set()

        def generate():
            start_time = time.time()
            
            # Start search in background thread
            thread = threading.Thread(target=search_thread)
            thread.start()
            
            count = 0
            while True:
                try:
                    # Wait for next item with timeout
                    data = result_queue.get(timeout=1.0)
                    
                    if 'error' in data:
                        yield json.dumps({'error': data['error']}) + '\n'
                        break
                    
                    count += 1
                    if count == 1:
                        print(f"[First Result Time (Optimization)] {time.time() - start_time:.3f}s")
                    
                    yield json.dumps(data) + '\n'
                    
                except queue.Empty:
                    # Check if search is complete
                    if search_complete.is_set():
                        break
                    # Otherwise continue waiting
                    continue
            
            thread.join()  # Wait for search thread to complete
            print(f"Found and streamed {count} cafes")

        response = Response(
            stream_with_context(generate()),
            mimetype='application/json',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )
        return response

    except ValueError:
        return jsonify({'error': 'Invalid parameter format. All parameters must be numbers.'}), 400
    except Exception as e:
        return jsonify({'error': f'Search failed: {str(e)}'}), 500

@app.route('/api/search/cafes/regular', methods=['GET'])
def search_cafes_regular():
    try:
        required = ['lon', 'lat', 'radius']
        for param in required:
            if param not in request.args:
                return jsonify({'error': f'Missing required parameter: {param}'}), 400

        lon = float(request.args.get('lon'))
        lat = float(request.args.get('lat'))
        radius = float(request.args.get('radius'))
        min_score = 0

        # print(f"[Weights] {weights}")
        start_time = time.time()
        
        # Get all data at once using db.search
        cafeLocs, cafeDatas = db.search(lon, lat, radius, min_score, weights)
        
        def generate():
            count = 0
            for cafe in cafeLocs:
                count += 1
                if count == 1:
                    print(f"[First Result Time (Regular)] {time.time() - start_time:.3f}s")
                data = {
                    'id': cafe.id,
                    'lat': cafe.lat,
                    'lon': cafe.lon,
                    'name': f"Cafe {cafe.id}",
                    'rating': cafeDatas[cafe.id]["rating"],
                    'current_crowd': cafeDatas[cafe.id]["current_crowd"],
                    'price_level': cafeDatas[cafe.id]["price_level"],
                    'score': cafeDatas[cafe.id]["score"],
                    'distance': cafeDatas[cafe.id]["distance"]
                }
                yield json.dumps(data) + '\n'

            print(f"Found and streamed {count} cafes")

        response = Response(
            stream_with_context(generate()), 
            mimetype='application/json',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no' 
            }
        )
        return response

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