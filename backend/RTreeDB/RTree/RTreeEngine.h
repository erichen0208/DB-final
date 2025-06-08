#include "RTree.h"
#include "../../MYsqlDB/Scoring.h"
#include <pybind11/pybind11.h>
#include <vector>
#include <cmath>
#include <string>
#include <algorithm> 
#include <fstream>
#include <utility>

#define NUMDIMS 2

// struct Cafe {
//   int id;
//   std::string name;
//   double rating;
//   double lat, lon;
//   int current_crowd;
// };

struct CafeLoc {
  int id;
  double lon, lat;
  double weight = 0.0;
  CafeLoc(int id, double lon, double lat) : id(id), lon(lon), lat(lat) {}
};

class RTreeEngine;

class CafeSearchIterator {
public:
  CafeSearchIterator(RTreeEngine* engine,
                     double lon, double lat,
                     double r_meters, double min_score, std::unordered_map<std::string, double> weights = {});

  CafeLoc next();

private:
  std::vector<CafeLoc> results_;
  size_t index_ = 0;
};

class RTreeEngine {
public:
  RTree<CafeLoc*, double, NUMDIMS> tree;

  bool init_mysql_connection() {
    return init_mysql();
  }

  void insert(const std::vector<Cafe> &cafes) {
      // Mysql
      if(!insert_cafes_to_mysql(cafes)) {
        std::cout << "❌ Failed to insert cafes to MySQL\n";
      }

      // Rtree
      for (const auto& cafe : cafes) {
          double min[2] = { cafe.lon, cafe.lat };
          double max[2] = { cafe.lon, cafe.lat };

          CafeLoc* newCafe = new CafeLoc(cafe.id, cafe.lon, cafe.lat);
          tree.Insert(min, max, newCafe);
      }
  }

  std::pair<std::vector<CafeLoc>, std::unordered_map<int, std::unordered_map<std::string, double>>> search(double lon, double lat, double r_meters, double min_score, std::unordered_map<std::string, double> weights = {}) {
    
    std::unordered_map<int, std::unordered_map<std::string, double>> cafeDatas = tree.LabelNodeWeight(mode_, lon, lat, weights);
    double min[2], max[2];
    bounding_box(lon, lat, r_meters, min, max);

    std::vector<CafeLoc> result;
    auto callback = [&result](CafeLoc *cafe) {
      result.push_back(*cafe);
      return true;
    };

    tree.Search(min, max, callback, false, min_score);
    return std::make_pair(result, cafeDatas);
  }

  CafeSearchIterator stream_search(double lon, double lat, double r_meters, double min_score, std::unordered_map<std::string, double> weights = {}) {
    tree.LabelNodeWeight(mode_, lon, lat, weights);
    return CafeSearchIterator(this, lon, lat, r_meters, min_score);
  }

private:
  std::string mode_ = "trimmed_mean";
  
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
                                              double r_meters, double min_score, std::unordered_map<std::string, double> weights) {
  double min[2], max[2];
  engine->bounding_box(lon, lat, r_meters, min, max);

  auto callback = [this](CafeLoc* cafe) { 
    results_.push_back(*cafe);  
    return true;
  };

  engine->tree.Search(min, max, callback, false, min_score);
}

inline CafeLoc CafeSearchIterator::next() { 
  if (index_ >= results_.size())
    throw pybind11::stop_iteration();
  return results_[index_++];
}

    // auto searchResult = tree.Search(min, max, callback, true, min_score);
    // std::ofstream outFile("search_result.txt");
    // if (outFile.is_open()) {
    //     for (const auto& record : searchResult.second) {
    //         outFile << "ID: " << record.id 
    //                 << ", IsDataPoint: " << (record.isDataPoint ? "true" : "false")
    //                 << ", Level: " << record.level 
    //                 << ", Weight: " << record.weight << std::endl;
    //     }
    //     outFile.close();
    // }
    // std::sort(result.begin(), result.end(), [](const Cafe& a, const Cafe& b) {
    //     return a.current_crowd < b.current_crowd;
    // });