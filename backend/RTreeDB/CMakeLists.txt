cmake_minimum_required(VERSION 3.14)
project(RTreeEngine)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Python setup
if(NOT DEFINED PYTHON_EXECUTABLE)
    find_package(Python3 REQUIRED COMPONENTS Interpreter Development)
else()
    set(Python3_EXECUTABLE ${PYTHON_EXECUTABLE})
    find_package(Python3 REQUIRED COMPONENTS Interpreter Development)
endif()

# pybind11
include(FetchContent)
FetchContent_Declare(
  pybind11
  GIT_REPOSITORY https://github.com/pybind/pybind11.git
  GIT_TAG        v2.12.0
)
FetchContent_MakeAvailable(pybind11)

# Include RTree headers
include_directories(RTree)

# MySQL headers
include_directories(/usr/include/mariadb)

# MySQL library
find_library(MYSQL_CLIENT_LIB NAMES mysqlclient PATHS /usr/lib/x86_64-linux-gnu REQUIRED)

# Build shared module
add_library(rtree_engine_module MODULE bindings.cpp)

# Link dependencies
target_link_libraries(rtree_engine_module PRIVATE pybind11::module ${MYSQL_CLIENT_LIB})

# Set output properties
set_target_properties(rtree_engine_module PROPERTIES
    PREFIX ""
    SUFFIX ".cpython-310-x86_64-linux-gnu.so"
    OUTPUT_NAME "rtree_engine"
)

# set_target_properties(rtree_engine_module PROPERTIES
#     PREFIX ""  
#     SUFFIX ".cpython-310-x86_64-linux-gnu.so" # macOS: ".cpython-310-darwin.so"; Linux(docker): ".cpython-310-x86_64-linux-gnu.so"
#     OUTPUT_NAME "rtree_engine"
# )