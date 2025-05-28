#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "RTree/RTreeEngine.h"

namespace py = pybind11;

PYBIND11_MODULE(rtree_engine, m) {
    py::class_<Cafe>(m, "Cafe")
        .def(py::init<>())
        .def_readwrite("id", &Cafe::id)
        .def_readwrite("name", &Cafe::name)
        .def_readwrite("rating", &Cafe::rating)
        .def_readwrite("lat", &Cafe::lat)
        .def_readwrite("lon", &Cafe::lon)
        .def_readwrite("current_crowd", &Cafe::current_crowd);

    py::class_<RTreeEngine>(m, "RTreeEngine")
        .def(py::init<>())
        .def("insert", &RTreeEngine::insert)
        .def("search", &RTreeEngine::search);
}
