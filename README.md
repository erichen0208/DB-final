# DB Final Project

## Run with Docker (Recommended)

```sh
# Open your docker desktop, build image first
docker compose build

# Run containers in background
docker compose up -d

# Shut down containers
docker compose down -v
```

- After the container is running successfully (should wait a second), do the below initialization:

```sh
# Initialize mysql
curl -X POST http://localhost:5000/api/initmysql

# Insert cafes, choices = [100, 10000, 1000000]
curl -X POST http://localhost:5000/api/insert/cafes/100
```

- And now, you can go to browser, using `http://localhost:5173/` for demo !

## Alterative: Run with Host (Non Recommended, and haven't test yet)

### Backend

1. Python:

```sh
cd backend
conda create -n rtree-backend python=3.10
conda activate rtree-backend
pip install -r requirements.txt
```

2. C++:

```sh
cd backend
chmod +x setup.sh
./setup.sh
```

- Note. Before run `./setup.sh`, please modify `backend/RTreeDB/CMakeLists.txt`, line 30, based on you OS (I don't know about wins)

### Frontend

```sh
cd frontend
npm install
```

### How to run

1. Run Backend

```sh
cd backend
python server.py
```

2. Run Frontend

```sh
cd frontend
npm run dev
```
