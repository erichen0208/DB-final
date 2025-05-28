cmake_minimum_required(VERSION 3.14)
project(RTreeEngine)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT DEFINED PYTHON_EXECUTABLE)
    find_package(Python3 REQUIRED COMPONENTS Interpreter Development)
else()
    set(Python3_EXECUTABLE ${PYTHON_EXECUTABLE})
    find_package(Python3 REQUIRED COMPONENTS Interpreter Development)
endif()

include(FetchContent)
FetchContent_Declare(
  pybind11
  GIT_REPOSITORY https://github.com/pybind/pybind11.git
  GIT_TAG        v2.12.0
)
FetchContent_MakeAvailable(pybind11)

include_directories(RTree)

add_library(rtree_engine_module MODULE bindings.cpp)
target_link_libraries(rtree_engine_module PRIVATE pybind11::module)
target_include_directories(rtree_engine_module PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/RTree)

set_target_properties(rtree_engine_module PROPERTIES
    PREFIX ""  
    SUFFIX ".cpython-310-darwin.so" 
    OUTPUT_NAME "rtree_engine"
)