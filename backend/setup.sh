rm -rf RTreeDB/build
mkdir RTreeDB/build && cd RTreeDB/build
cmake .. -DPYTHON_EXECUTABLE=$(which python)
make -j
cp *.so ../../