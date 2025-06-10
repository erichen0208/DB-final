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
#include <queue>
#include <chrono>
#include <iomanip>

#define NUMDIMS 2

struct CafeLoc {
    int id;
    double lon, lat;
    double weight = 0.0;
    CafeLoc(int id, double lon, double lat) : id(id), lon(lon), lat(lat) {}
};

class RTreeEngine {
public:
    RTree<CafeLoc*, double, NUMDIMS> tree;

    bool init_mysql_connection() {
        return init_mysql();
    }

    void insert(const std::vector<Cafe>& cafes) {
        // Mysql
        if (!insert_cafes_to_mysql(cafes)) {
            std::cout << "❌ Failed to insert cafes to MySQL\n";
        }

        // Rtree
        for (const auto& cafe : cafes) {
            double min[2] = {cafe.lon, cafe.lat};
            double max[2] = {cafe.lon, cafe.lat};

            CafeLoc* newCafe = new CafeLoc(cafe.id, cafe.lon, cafe.lat);
            tree.Insert(min, max, newCafe);
        }
    }

    void bounding_box(double lon, double lat, double r_meters, double* min, double* max) {
        if (r_meters <= 0) {
            min[0] = 121.50;
            min[1] = 25.02;
            max[0] = 121.60;
            max[1] = 25.10;
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

        min[0] = lon - r_lon;
        min[1] = lat - r_lat;
        max[0] = lon + r_lon;
        max[1] = lat + r_lat;
    }

    std::pair<std::vector<CafeLoc>, std::unordered_map<int, std::unordered_map<std::string, double>>> search(double lon, double lat, double r_meters, double min_score, std::unordered_map<std::string, double> weights = {}) {
        
        auto start_time = std::chrono::high_resolution_clock::now();

        std::unordered_map<int, std::unordered_map<std::string, double>> cafeDatas = tree.LabelNodeWeight(mode_, lon, lat, r_meters, weights);
        
        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end_time - start_time);
        double seconds = duration.count() / 1000000.0; 
        std::cout << std::fixed << std::setprecision(3) << "[LabelNodeWeight Time (Regular)] " << seconds << "s" << std::endl;
        
        double min[2], max[2];
        bounding_box(lon, lat, r_meters, min, max);

        std::vector<CafeLoc> result;
        auto callback = [&result](CafeLoc* cafe) {
            result.push_back(*cafe);
            return true;
        };

        tree.Search(min, max, callback, false, min_score);
        std::sort(result.begin(), result.end(), [](const CafeLoc& a, const CafeLoc& b) {
            return a.weight > b.weight;
        });
        return std::make_pair(result, cafeDatas);
    }

    void stream_search(double lon, double lat, double r_meters, double min_score, 
                                   std::unordered_map<std::string, double> weights,
                                   std::function<void(const CafeLoc&, const std::unordered_map<std::string, double>&)> callback) {
      
      auto start_time = std::chrono::high_resolution_clock::now();
                              
      std::unordered_map<int, std::unordered_map<std::string, double>> cafeDatas = 
          tree.LabelNodeWeight(mode_, lon, lat, r_meters, weights);

      auto end_time = std::chrono::high_resolution_clock::now();
      auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end_time - start_time);
      double seconds = duration.count() / 1000000.0; 
      std::cout << std::fixed << std::setprecision(3) << "[LabelNodeWeight Time (Optimization)] " << seconds << "s" << std::endl;
    
      
      double min[2], max[2];
      bounding_box(lon, lat, r_meters, min, max);

      auto search_callback = [&](CafeLoc* cafe) {
          if (cafe && cafe->weight >= min_score) {
              // Get cafe details
              auto cafe_details = cafeDatas.find(cafe->id) != cafeDatas.end() ? 
                                cafeDatas[cafe->id] : std::unordered_map<std::string, double>{};
              
              // Call Python callback immediately
              callback(*cafe, cafe_details);
          }
          return true; // Continue searching
      };

      tree.Search(min, max, search_callback, false, min_score);
    }

private:
    std::string mode_ = "trimmed_mean";
};
