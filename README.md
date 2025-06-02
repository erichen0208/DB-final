# DB Final Project

## Run with docker

```sh
# Open you docker desktop
docker compose build
docker compose up
```

## Run with host

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
