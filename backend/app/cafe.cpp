#include "RTree/RTree.h" 
#include <cstdlib>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <chrono>
#include <filesystem> 
namespace fs = std::filesystem;

# define NUMDIMS 2
int operationId = 0;
int searchId = 0;
typedef std::pair<double*, double*> BoundingBox;
BoundingBox* target = nullptr;

struct Cafe
{
  int id;
  std::string name;
  double rating;
  double lat, lon;
  int current_crowd;
};
typedef RTree<Cafe *, double, NUMDIMS> CafeTree;

std::vector<Cafe *> read_cafes_from_csv(const std::string &filename)
{
  std::vector<Cafe *> cafes;
  std::ifstream file(filename);
  std::string line;

  if (!file.is_open())
  {
    std::cerr << "? Failed to open " << filename << std::endl;
    return cafes;
  }

  std::getline(file, line); // skip header

  while (std::getline(file, line))
  {
    std::stringstream ss(line);
    std::string item;
    Cafe *cafe = new Cafe();

    std::getline(ss, item, ',');
    cafe->id = std::stoi(item);
    std::getline(ss, item, ',');
    cafe->name = item;
    std::getline(ss, item, ',');
    cafe->lat = std::stod(item);
    std::getline(ss, item, ',');
    cafe->lon = std::stod(item);
    std::getline(ss, item, ',');
    cafe->rating = std::stod(item);
    std::getline(ss, item, ',');
    cafe->current_crowd = std::stoi(item);

    cafes.push_back(cafe);
  }

  file.close();
  return cafes;
}

void exportSearchPath(std::ofstream& outFile, const std::vector<CafeTree::SearchPathRecord> &searchPath)
{
    outFile << "  \"searchPaths\": [\n";
    for (size_t i = 0; i < searchPath.size(); ++i) {
        const auto &record = searchPath[i];
        outFile << "    {\n";
        outFile << "      \"id\": " << record.id << ",\n";
        outFile << "      \"level\": " << record.level << ",\n";
        outFile << "      \"isDataPoint\": " << (record.isDataPoint ? "true" : "false") << "\n";
        outFile << "    }";
        if (i < searchPath.size() - 1) outFile << ",";
        outFile << "\n";
    }
    outFile << "  ]\n";
}

void exportTreeState(CafeTree &tree, const std::string &operation, 
                     const std::vector<CafeTree::SearchPathRecord> &searchPath = {}) {  
    std::string filename;
    if (operation == "search") {
      filename = "frames/search/frame_" + std::to_string(searchId) + ".json";
    }  
    else {
      filename = "frames/insert/frame_" + std::to_string(operationId) + ".json";
    }

    fs::path dir = fs::path(filename).parent_path();
    if (!fs::exists(dir)) {
        fs::create_directories(dir);  
    }

    std::ofstream outFile(filename);
    if (!outFile.is_open()) {
        std::cerr << "Failed to open file: " << filename << std::endl;
        return;
    }

    auto treeStructure = tree.GetTreeStructure();

    outFile << "{\n";
    outFile << "  \"operation\": \"" << operation << "\",\n";
    outFile << "  \"operationId\": " << operationId << ",\n";
    if (operation == "search") {
        outFile << "  \"searchId\": " << searchId << ",\n";
    }
    outFile << "  \"treeSize\": " << tree.Count() << ",\n";

    if (target != nullptr) {
        outFile << "  \"target\": {\n";
        outFile << "    \"min\": [";
        for (int d = 0; d < NUMDIMS; d++) {
            outFile << (*target).first[d];
            if (d < NUMDIMS - 1) outFile << ", ";
        }
        outFile << "],\n";
        
        outFile << "    \"max\": [";
        for (int d = 0; d < NUMDIMS; d++) {
            outFile << (*target).second[d];
            if (d < NUMDIMS - 1) outFile << ", ";
        }
        outFile << "]\n  },\n";
    }

    // Export tree nodes with exact structure - but NOT data points
    outFile << "  \"treeNodes\": [\n";
    for (size_t i = 0; i < treeStructure.treeNodes.size(); ++i) {
        const auto& node = treeStructure.treeNodes[i];

        outFile << "    {\n";
        outFile << "      \"id\": " << node.id << ",\n";
        outFile << "      \"level\": " << node.level << ",\n";
        outFile << "      \"isLeaf\": " << (node.isLeaf ? "true" : "false") << ",\n";
        outFile << "      \"current_crowd\": " << node.weight << ",\n";
        
        // Output dimensions based on NUMDIMS
        outFile << "      \"min\": [";
        for (int d = 0; d < NUMDIMS; d++) {
            outFile << node.min[d];
            if (d < NUMDIMS - 1) outFile << ", ";
        }
        outFile << "],\n";
        
        outFile << "      \"max\": [";
        for (int d = 0; d < NUMDIMS; d++) {
            outFile << node.max[d];
            if (d < NUMDIMS - 1) outFile << ", ";
        }
        outFile << "],\n";

        // Export children IDs
        outFile << "      \"childIds\": [";
        for (size_t j = 0; j < node.childIds.size(); ++j) {
            outFile << node.childIds[j];
            if (j < node.childIds.size() - 1) outFile << ", ";
        }
        outFile << "]";

        // Add data point IDs for leaf nodes
        if (node.level == 0) { // This is a leaf node
            outFile << ",\n      \"dataPointIds\": [";
            for (size_t j = 0; j < node.dataPointIds.size(); ++j) {
                outFile << node.dataPointIds[j];
                if (j < node.dataPointIds.size() - 1) outFile << ", ";
            }
            outFile << "]";
        }

        outFile << "\n    }";
        if (i < treeStructure.treeNodes.size() - 1) outFile << ",";
        outFile << "\n";
    }
    outFile << "  ],\n";

    // Export data points in a separate section
    outFile << "  \"dataPoints\": [\n";
    for (size_t i = 0; i < treeStructure.dataPoints.size(); ++i) {
        const auto& dataPoint = treeStructure.dataPoints[i];
        Cafe* cafe = dataPoint.data;
        
        outFile << "    {\n";
        outFile << "      \"id\": " << dataPoint.id << ",\n";
        outFile << "      \"level\": " << dataPoint.level << ",\n";
        
        // Output dimensions based on NUMDIMS
        outFile << "      \"min\": [";
        for (int d = 0; d < NUMDIMS; d++) {
            outFile << dataPoint.min[d];
            if (d < NUMDIMS - 1) outFile << ", ";
        }
        outFile << "],\n";
        
        outFile << "      \"max\": [";
        for (int d = 0; d < NUMDIMS; d++) {
            outFile << dataPoint.max[d];
            if (d < NUMDIMS - 1) outFile << ", ";
        }
        outFile << "],\n";
        
        outFile << "      \"cafeId\": " << cafe->id << ",\n";
        outFile << "      \"name\": \"" << cafe->name << "\",\n";
        outFile << "      \"rating\": " << cafe->rating << ",\n";
        outFile << "      \"lat\": " << cafe->lat << ",\n";
        outFile << "      \"lon\": " << cafe->lon << ",\n";
        outFile << "      \"current_crowd\": " << cafe->current_crowd << "\n";
        
        outFile << "    }";
        if (i < treeStructure.dataPoints.size() - 1) outFile << ",";
        outFile << "\n";
    }
    
    if (operation == "search") {
        outFile << "  ],\n";
        exportSearchPath(outFile, searchPath);
    } else {
        outFile << "  ]\n";
    }

    outFile << "}\n";
    outFile.close();
}

void insert_to_rtree(CafeTree &tree, const std::vector<Cafe *> &cafes)
{
  double global_lat_min = std::numeric_limits<double>::max();
  double global_lat_max = std::numeric_limits<double>::lowest();
  double global_lon_min = std::numeric_limits<double>::max();
  double global_lon_max = std::numeric_limits<double>::lowest();

  for (auto cafe : cafes)
  {
    double lat = cafe->lat;
    double lon = cafe->lon;

    global_lat_min = std::min(global_lat_min, lat);
    global_lat_max = std::max(global_lat_max, lat);
    global_lon_min = std::min(global_lon_min, lon);
    global_lon_max = std::max(global_lon_max, lon);

    double min[2] = {lon, lat};
    double max[2] = {lon, lat};
    
    // Create target for visualization
    double* targetMin = new double[2]{min[0], min[1]};
    double* targetMax = new double[2]{max[0], max[1]};
    target = new BoundingBox(targetMin, targetMax);
    
    tree.Insert(min, max, cafe);
    tree.LabelNodeId(); 
    tree.LabelNodeWeight();
    exportTreeState(tree, "insert");
    operationId++;
    
    // Clean up target
    delete[] targetMin;
    delete[] targetMax;
    delete target;
    target = nullptr;
  }

  std::cout << "? All cafe locations span:\n";
  std::cout << "Longitude: " << global_lon_min << " ~ " << global_lon_max << "\n";
  std::cout << "Latitude:  " << global_lat_min << " ~ " << global_lat_max << "\n";
}

void query_area(CafeTree &tree, double lat_min, double lon_min, double lat_max,
                double lon_max, int max_crowd)
{
  double min[2] = {lon_min, lat_min};
  double max[2] = {lon_max, lat_max};

  double* targetMin = new double[2]{min[0], min[1]};
  double* targetMax = new double[2]{max[0], max[1]};
  target = new BoundingBox(targetMin, targetMax);

  auto callback = [max_crowd](Cafe *cafe)
  {

    std::cout << "? ID: " << cafe->id
              << " | Name: " << cafe->name
              << " | Rating: " << cafe->rating
              << " | Crowd: " << cafe->current_crowd
              << " | Location: (" << cafe->lon << ", " << cafe->lat << ")\n";
    
    return true; 
  };


  std::cout << "? Searching area (" << lat_min << ", " << lon_min << ") ~ ("
            << lat_max << ", " << lon_max << ")\n";

  auto start = std::chrono::high_resolution_clock::now();
  auto searchResult = tree.Search(min, max, callback, true);
  auto end = std::chrono::high_resolution_clock::now();
  std::chrono::duration<double, std::milli> duration_ms = end - start;
  
  exportTreeState(tree, "search", searchResult.second);
  operationId++;
  searchId++;
}

int main()
{
  std::vector<Cafe *> cafes = read_cafes_from_csv("cafes.csv");

  if (cafes.empty())
  {
    std::cerr << "No data loaded from CSV.\n";
    return 1;
  }

  CafeTree rtree;

  insert_to_rtree(rtree, cafes);

  query_area(rtree, 25.06, 121.5, 25.0994, 121.56, 50);

  for (auto cafe : cafes)
    delete cafe;

  return 0;
}
