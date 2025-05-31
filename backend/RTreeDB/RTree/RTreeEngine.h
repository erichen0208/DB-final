#include "RTree.h"
#include <pybind11/pybind11.h>
#include <vector>
#include <cmath>
#include <string>
#include <algorithm> 
#define NUMDIMS 2

struct Cafe {
  int id;
  std::string name;
  double rating;
  double lat, lon;
  int current_crowd;
};

class RTreeEngine;

class CafeSearchIterator {
public:
  CafeSearchIterator(RTreeEngine* engine,
                     double lon, double lat,
                     double r_meters, double min_score);

  Cafe next();

private:
  std::vector<Cafe> results_;
  size_t index_ = 0;
};

class RTreeEngine {
public:
  RTree<Cafe*, double, NUMDIMS> tree;

  void insert(const Cafe &cafe) {
    double min[2] = { cafe.lon, cafe.lat };
    double max[2] = { cafe.lon, cafe.lat };
    Cafe* newCafe = new Cafe(cafe); 
    tree.Insert(min, max, newCafe);
  }

  std::vector<Cafe> search(double lon, double lat, double r_meters, double min_score) {
    double min[2], max[2];
    bounding_box(lon, lat, r_meters, min, max);

    std::vector<Cafe> result;
    auto callback = [min_score, &result](Cafe *cafe) {
      if (cafe->current_crowd >= min_score)
        result.push_back(*cafe);
      return true;
    };

    tree.Search(min, max, callback, false);
    std::sort(result.begin(), result.end(), [](const Cafe& a, const Cafe& b) {
        return a.current_crowd < b.current_crowd;
    });
    return result;
  }

  CafeSearchIterator stream_search(double lon, double lat, double r_meters, double min_score) {
    return CafeSearchIterator(this, lon, lat, r_meters, min_score);
  }

private:
  void bounding_box(double lon, double lat, double r_meters, double* min, double* max) {
    if (r_meters <= 0) {
        min[0] = 121.50;
        min[1] = 25.02;
        max[0] = 121.60;
        max[1] = 25.10;
        return;
    }

    double lat_radians = lat * M_PI / 180.0;
    double r_lat = r_meters / 111000.0;
    double r_lon = r_meters / (111320.0 * cos(lat_radians));

    min[0] = lon - r_lon;
    min[1] = lat - r_lat;
    max[0] = lon + r_lon;
    max[1] = lat + r_lat;
  }

  friend class CafeSearchIterator;
};

inline CafeSearchIterator::CafeSearchIterator(RTreeEngine* engine,
                                              double lon, double lat,
                                              double r_meters, double min_score) {
  double min[2], max[2];
  engine->bounding_box(lon, lat, r_meters, min, max);

  auto callback = [min_score, this](Cafe* cafe) {
    if (cafe->current_crowd >= min_score)
      results_.push_back(*cafe);
    return true;
  };

  engine->tree.Search(min, max, callback, false);
}

inline Cafe CafeSearchIterator::next() {
  if (index_ >= results_.size())
    throw pybind11::stop_iteration();
  return results_[index_++];
}
