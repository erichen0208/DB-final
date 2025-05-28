#include "RTree.h"
#include <string>
#define NUMDIMS 2

struct Cafe {
  int id;
  std::string name;
  double rating;
  double lat, lon;
  int current_crowd;
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

    double minLon, minLat, maxLon, maxLat;

    if (r_meters <= 0) {
        minLon = 121.50;
        minLat = 25.02; 
        maxLon = 121.60;
        maxLat = 25.10;
    }
    else {
        double lat_radians = lat * M_PI / 180.0;
        double r_lat_degrees = r_meters / 111000.0;
        double r_lon_degrees = r_meters / (111320.0 * cos(lat_radians));
        
        minLon = lon - r_lon_degrees;
        minLat = lat - r_lat_degrees;
        maxLon = lon + r_lon_degrees;
        maxLat = lat + r_lat_degrees;
    }

    double min[2] = {minLon, minLat};
    double max[2] = {maxLon, maxLat};
    
    std::vector<Cafe> result;
    auto callback = [min_score, &result](Cafe *cafe) {
      if (cafe->current_crowd >= min_score) {
        result.push_back(*cafe);
      }
      return true;
    };

    tree.Search(min, max, callback, false);
    return result;
  }
};
