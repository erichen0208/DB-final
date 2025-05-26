# DB Final Project

## Backend

1. Python:

```sh
cd backend
conda create -n rtree-backend python=3.10
conda activate rtree-backend
pip install -r requirements.txt
```

2. C++:

```sh
cd backend/app
g++ -std=c++17 -o rtree_test test.cpp
```

## Frontend

```sh
cd frontend
npm install
```

## How to run

1. Run `rtree_test` to get a new directory **frames**, which contains the tree structure of each operation.

```
cd backend/app
./rtree-test
```

2. Run Flask

```sh
cd backend/app
python server.py
```

3. Run React

```sh
cd frontend
npm run dev
```
