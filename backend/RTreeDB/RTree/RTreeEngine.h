#include "RTree.h"
#include "../../MYsqlDB/Scoring.h"
#include <pybind11/pybind11.h>
#include <vector>
#include <cmath>
#include <string>
#include <algorithm> 
#include <fstream>
#include <utility>
#include <filesystem>

#define NUMDIMS 2

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
                     double r_meters, double min_score, 
                     const std::unordered_map<int, std::unordered_map<std::string, double>>& cafe_datas,
                     std::unordered_map<std::string, double> weights = {});

  CafeLoc next();

  const std::unordered_map<int, std::unordered_map<std::string, double>>& get_cafe_datas() const {
    return cafe_datas_;
  }

private:
  std::vector<CafeLoc> results_;
  size_t index_ = 0;
  std::unordered_map<int, std::unordered_map<std::string, double>> cafe_datas_;
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
    tree.LabelNodeId();
    std::unordered_map<int, std::unordered_map<std::string, double>> cafeDatas = tree.LabelNodeWeight(mode_, lon, lat, r_meters, weights);
    double min[2], max[2];
    bounding_box(lon, lat, r_meters, min, max);

    std::vector<CafeLoc> result;
    auto callback = [&result](CafeLoc *cafe) {
      result.push_back(*cafe);
      return true;
    };

    auto searchResult = tree.Search(min, max, callback, true, min_score);
    exportSearchPath(searchResult.second);
    return std::make_pair(result, cafeDatas);
  }

  CafeSearchIterator stream_search(double lon, double lat, double r_meters, double min_score, std::unordered_map<std::string, double> weights = {}) {
    std::unordered_map<int, std::unordered_map<std::string, double>> cafeDatas = tree.LabelNodeWeight(mode_, lon, lat, r_meters, weights);
    return CafeSearchIterator(this, lon, lat, r_meters, min_score, cafeDatas, weights);
  }

private:
  std::string mode_ = "trimmed_mean";
  
  void bounding_box(double lon, double lat, double r_meters, double* min, double* max) {
    if (r_meters <= 0) {
        min[0] = 121.50; min[1] = 25.02;
        max[0] = 121.60; max[1] = 25.10;
        return;
    }

    // WGS84 ellipsoid parameters for higher accuracy
    const double a = 6378137.0;      // Semi-major axis
    const double e2 = 0.00669437999014; // First eccentricity squared
    
    double lat_rad = lat * M_PI / 180.0;
    double M = a * (1 - e2) / pow(1 - e2 * sin(lat_rad) * sin(lat_rad), 1.5);
    double N = a / sqrt(1 - e2 * sin(lat_rad) * sin(lat_rad));
    
    double r_lat = r_meters / M * 180.0 / M_PI;
    double r_lon = r_meters / (N * cos(lat_rad)) * 180.0 / M_PI;

    min[0] = lon - r_lon; min[1] = lat - r_lat;
    max[0] = lon + r_lon; max[1] = lat + r_lat;
  }

  void exportSearchPath(const std::vector<RTree<CafeLoc*, double, NUMDIMS>::SearchPathRecord> &searchPath)
  {
      static int search_id = 0;
      std::string filename = "search_result.json";
      
      std::ofstream outFile(filename);
      if (!outFile.is_open()) {
        std::cerr << "Failed to open file: " << filename << std::endl;
        return;
      }
      outFile << "{\n";
      outFile << "  \"searchPaths\": [\n";
      for (size_t i = 0; i < searchPath.size(); ++i) {
          const auto &record = searchPath[i];
          outFile << "    {\n";
          outFile << "      \"id\": " << record.id << ",\n";
          outFile << "      \"level\": " << record.level << ",\n";
          outFile << "      \"weight\": " << record.weight << ",\n";
          outFile << "      \"isDataPoint\": " << (record.isDataPoint ? "true" : "false") << "\n";
          outFile << "    }";
          if (i < searchPath.size() - 1) outFile << ",";
          outFile << "\n";
      }
      outFile << "  ]\n";
      outFile << "}\n";
      outFile.close();
  }

  friend class CafeSearchIterator;
};


inline CafeSearchIterator::CafeSearchIterator(RTreeEngine* engine,
                                              double lon, double lat,
                                              double r_meters, double min_score,
                                              const std::unordered_map<int, std::unordered_map<std::string, double>>& cafe_datas,
                                              std::unordered_map<std::string, double> weights)
    : cafe_datas_(cafe_datas) {  // Initialize cafe_datas_ member
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
