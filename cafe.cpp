#include "RTree.h" // 請自行放置 RTree.h (如 https://github.com/david-gpu/RTree)
#include <cstdlib>
#include <ctime>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <chrono>
struct Cafe
{
  int id;
  std::string name;
  double rating;
  double lat, lon;
  int current_crowd;
};

// 從 CSV 讀取咖啡廳資料
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

// 宣告 RTree 類型：2 維、key 為 double、value 為 Cafe*
typedef RTree<Cafe *, double, 2> CafeTree;

// 將咖啡廳資料插入 RTree
// 將咖啡廳資料插入 RTree，並計算全域範圍
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

    double min[2] = {lat, lon};
    double max[2] = {lat, lon};
    tree.Insert(min, max, cafe);
  }

  std::cout << "? All cafe locations span:\n";
  std::cout << "Latitude:  " << global_lat_min << " ~ " << global_lat_max << "\n";
  std::cout << "Longitude: " << global_lon_min << " ~ " << global_lon_max << "\n";
}

// 查詢特定範圍的咖啡廳
void query_area(CafeTree &tree, double lat_min, double lon_min, double lat_max,
                double lon_max, int max_crowd)
{
  double min[2] = {lat_min, lon_min};
  double max[2] = {lat_max, lon_max};

  auto callback = [max_crowd](Cafe *cafe)
  {
    if (cafe->current_crowd <= max_crowd)
    {
      std::cout << "? ID: " << cafe->id
                << " | Name: " << cafe->name
                << " | Rating: " << cafe->rating
                << " | Crowd: " << cafe->current_crowd
                << " | Location: (" << cafe->lat << ", " << cafe->lon << ")\n";
    }
    return true; // 繼續搜尋
  };

  std::cout << "? Searching area (" << lat_min << ", " << lon_min << ") ~ ("
            << lat_max << ", " << lon_max << ")\n";
  auto start = std::chrono::high_resolution_clock::now();
  tree.Search(min, max, callback);
  auto end = std::chrono::high_resolution_clock::now();
  std::chrono::duration<double, std::milli> duration_ms = end - start;
  std::cout << "?? Query time: " << duration_ms.count() << " ms\n";
}

int main()
{
  // 1. 從 CSV 載入資料
  std::vector<Cafe *> cafes = read_cafes_from_csv("cafes.csv");

  if (cafes.empty())
  {
    std::cerr << "?? No data loaded from CSV.\n";
    return 1;
  }

  // 2. 建立 RTree 並插入
  CafeTree rtree;
  insert_to_rtree(rtree, cafes);

  // 3. 查詢台北市某個區域範圍
  query_area(rtree, 25.0201, 121.5, 25.0994, 121.6, 50);

  // 4. 釋放記憶體
  for (auto cafe : cafes)
    delete cafe;

  return 0;
}
