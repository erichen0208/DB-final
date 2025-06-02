#!/bin/bash
set -e
cd /app/RTreeDB
rm -rf build
mkdir -p build && cd build
cmake ..
make -j$(nproc)
cp *.so /app/
echo "✅ Built .so files:"
ls -la /app/*.so