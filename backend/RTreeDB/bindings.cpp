#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/operators.h>
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

    py::class_<CafeLoc>(m, "CafeLoc")
        .def(py::init<int, double, double>())
        .def_readwrite("id", &CafeLoc::id)
        .def_readwrite("lon", &CafeLoc::lon)
        .def_readwrite("lat", &CafeLoc::lat);

    py::class_<RTreeEngine>(m, "RTreeEngine")
        .def(py::init<>())
        .def("init_mysql_connection", &RTreeEngine::init_mysql_connection)
        .def("insert", &RTreeEngine::insert)
        .def("search", &RTreeEngine::search)
        .def("stream_search", &RTreeEngine::stream_search);

    py::class_<CafeSearchIterator>(m, "CafeSearchIterator")
        .def("__iter__", [](CafeSearchIterator &self) -> CafeSearchIterator& { return self; })
        .def("__next__", &CafeSearchIterator::next);
}