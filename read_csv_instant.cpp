#include "RTree.h" // Make sure this path is correct (e.g., from https://github.com/nushoin/RTree/blob/master/RTree.h)
#include <cstdlib>
#include <ctime>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <chrono>
#include <map>    // For the offset index
#include <limits> // For numeric_limits

// Cafe struct remains the same
struct Cafe
{
    int id;
    std::string name;
    double rating;
    double lat, lon;
    int current_crowd;
};

// Data structure to hold only essential info for R-Tree insertion
struct CafeLocationInfo
{
    int id;
    double lat, lon;
};

// --- Forward declarations ---
Cafe fetch_cafe_details_by_id(int cafe_id, const std::string &filename, const std::map<int, std::streampos> &offset_index);

// --- Offset Index and Data Fetching ---

// Function to build an index of cafe IDs to their file offsets in the CSV
std::map<int, std::streampos> build_cafe_offset_index(const std::string &filename)
{
    std::map<int, std::streampos> index_map;
    std::ifstream file(filename, std::ios::binary);
    // std::ifstream file(filename);
    std::string line;

    if (!file.is_open())
    {
        std::cerr << "? Failed to open " << filename << " for indexing." << std::endl;
        return index_map;
    }

    std::getline(file, line); // Skip header line

    while (file)
    {
        std::streampos pos = file.tellg(); // ? 先記錄這一行的開頭位置

        if (!std::getline(file, line))
            break;

        if (line.empty())
            continue;

        std::stringstream ss(line);
        std::string item;

        std::getline(ss, item, ',');
        if (item.empty())
            continue;

        try
        {
            int cafe_id = std::stoi(item);
            index_map[cafe_id] = pos; // ? 儲存這一行開頭的位移
        }
        catch (const std::invalid_argument &ia)
        {
            std::cerr << "? Indexing: Invalid argument for ID '" << item << "' in line: " << line << " - " << ia.what() << std::endl;
        }
        catch (const std::out_of_range &oor)
        {
            std::cerr << "? Indexing: Out of range for ID '" << item << "' in line: " << line << " - " << oor.what() << std::endl;
        }
    }

    file.close();
    std::cout << "? Built offset index for " << index_map.size() << " cafes from " << filename << std::endl;
    return index_map;
}

// Function to read cafe details from CSV given an ID, using the offset index
Cafe fetch_cafe_details_by_id(int cafe_id, const std::string &filename, const std::map<int, std::streampos> &offset_index)
{
    Cafe cafe;
    cafe.id = -1; // Default to invalid ID, indicates failure

    auto it = offset_index.find(cafe_id);
    if (it == offset_index.end())
    {
        // This can be noisy if some IDs from R-Tree aren't in the index (should not happen if built from same file)
        // std::cerr << "? Cafe ID " << cafe_id << " not found in offset index." << std::endl;
        return cafe;
    }

    // std::ifstream file(filename); // Open file for reading
    std::ifstream file(filename, std::ios::binary);
    if (!file.is_open())
    {
        std::cerr << "? Failed to open " << filename << " for fetching details for ID " << cafe_id << std::endl;
        return cafe;
    }
    file.clear(); // ? 清除前一次的錯誤狀態（重要！）

    file.seekg(it->second); // Seek to the stored position for this cafe_id
    std::string line;
    if (std::getline(file, line)) // Read the line
    {
        std::stringstream ss(line);
        std::string item;

        try
        {
            std::getline(ss, item, ',');
            cafe.id = std::stoi(item);

            // Sanity check: the ID read from the line should match the requested cafe_id
            if (cafe.id != cafe_id)
            {
                std::cerr << "? ID mismatch after seeking in " << filename
                          << ". Expected " << cafe_id << ", got " << cafe.id
                          << " from line: " << line << std::endl;
                cafe.id = -1; // Mark as invalid
                file.close();
                return cafe;
            }

            std::getline(ss, item, ',');
            cafe.name = item;
            std::getline(ss, item, ',');
            cafe.lat = std::stod(item);
            std::getline(ss, item, ',');
            cafe.lon = std::stod(item);
            std::getline(ss, item, ',');
            cafe.rating = std::stod(item);
            std::getline(ss, item, ',');
            cafe.current_crowd = std::stoi(item);
        }
        catch (const std::invalid_argument &ia)
        {
            std::cerr << "? Fetching details (ID " << cafe_id << "): Invalid argument in line: '" << line << "' - " << ia.what() << std::endl;
            cafe.id = -1; // Mark as invalid due to parsing error
        }
        catch (const std::out_of_range &oor)
        {
            std::cerr << "? Fetching details (ID " << cafe_id << "): Out of range in line: '" << line << "' - " << oor.what() << std::endl;
            cafe.id = -1; // Mark as invalid
        }
    }
    else
    {
        std::cerr << "? Failed to read line for cafe ID " << cafe_id << " from " << filename << " after seeking." << std::endl;
    }
    file.close();
    return cafe;
}

// --- R-Tree Specific Code ---

// RTree 類型：2 維、key 為 double、value 為 int (Cafe ID)
typedef RTree<int, double, 2> CafeIdTree;

// 從 CSV 讀取咖啡廳位置資料 for R-Tree
std::vector<CafeLocationInfo> read_cafe_locations_from_csv(const std::string &filename)
{
    std::vector<CafeLocationInfo> locations;
    // std::ifstream file(filename);
    std::ifstream file(filename, std::ios::binary);
    std::string line;

    if (!file.is_open())
    {
        std::cerr << "? Failed to open " << filename << " to read locations." << std::endl;
        return locations;
    }

    std::getline(file, line); // Skip header

    while (std::getline(file, line))
    {
        if (line.empty())
            continue; // Skip empty lines

        std::stringstream ss(line);
        std::string item;
        CafeLocationInfo loc_info;

        try
        {
            std::getline(ss, item, ','); // id
            if (item.empty())
                continue;
            loc_info.id = std::stoi(item);

            std::getline(ss, item, ','); // name (skip for location info)

            std::getline(ss, item, ','); // lat
            if (item.empty())
                continue;
            loc_info.lat = std::stod(item);

            std::getline(ss, item, ','); // lon
            if (item.empty())
                continue;
            loc_info.lon = std::stod(item);

            // Skip reading rating and current_crowd as they are not needed for CafeLocationInfo
            locations.push_back(loc_info);
        }
        catch (const std::invalid_argument &ia)
        {
            std::cerr << "? Reading locations: Invalid argument in line: '" << line << "' - " << ia.what() << std::endl;
        }
        catch (const std::out_of_range &oor)
        {
            std::cerr << "? Reading locations: Out of range in line: '" << line << "' - " << oor.what() << std::endl;
        }
    }
    file.close();
    std::cout << "? Read " << locations.size() << " locations for R-Tree from " << filename << std::endl;
    return locations;
}

// 將咖啡廳位置資料插入 RTree，並計算全域範圍
void insert_to_rtree(CafeIdTree &tree, const std::vector<CafeLocationInfo> &locations)
{
    if (locations.empty())
    {
        std::cout << "? No locations to insert into R-tree." << std::endl;
        return;
    }
    double global_lat_min = std::numeric_limits<double>::max();
    double global_lat_max = std::numeric_limits<double>::lowest();
    double global_lon_min = std::numeric_limits<double>::max();
    double global_lon_max = std::numeric_limits<double>::lowest();

    for (const auto &loc_info : locations)
    {
        double lat = loc_info.lat;
        double lon = loc_info.lon;

        global_lat_min = std::min(global_lat_min, lat);
        global_lat_max = std::max(global_lat_max, lat);
        global_lon_min = std::min(global_lon_min, lon);
        global_lon_max = std::max(global_lon_max, lon);

        double min_coord[2] = {lat, lon}; // For points, min and max are the same
        double max_coord[2] = {lat, lon};
        tree.Insert(min_coord, max_coord, loc_info.id); // Insert cafe ID
    }

    std::cout << "? Inserted " << locations.size() << " items into R-Tree.\n";
    std::cout << "? All cafe locations span:\n";
    std::cout << "Latitude:  " << global_lat_min << " ~ " << global_lat_max << "\n";
    std::cout << "Longitude: " << global_lon_min << " ~ " << global_lon_max << "\n";
}

// 查詢特定範圍的咖啡廳
void query_area(CafeIdTree &tree, double lat_min, double lon_min, double lat_max,
                double lon_max, int max_crowd,
                const std::string &csv_filename,
                const std::map<int, std::streampos> &offset_index)
{
    double query_min[2] = {lat_min, lon_min};
    double query_max[2] = {lat_max, lon_max};
    int result_count = 0;

    std::cout << "\n? Searching area (" << lat_min << ", " << lon_min << ") ~ ("
              << lat_max << ", " << lon_max << ") with max crowd " << max_crowd << "\n";

    auto start_time = std::chrono::high_resolution_clock::now();

    // ? 用 lambda 取代傳統 callback，直接用外部變數
    tree.Search(query_min, query_max, [&](const int &cafe_id) -> bool
                {
                    Cafe cafe = fetch_cafe_details_by_id(cafe_id, csv_filename, offset_index);

                    if (cafe.id != -1 && cafe.current_crowd <= max_crowd)
                    {
                        std::cout << "? ID: " << cafe.id
                                  << " | Name: " << cafe.name
                                  << " | Rating: " << cafe.rating
                                  << " | Crowd: " << cafe.current_crowd
                                  << " | Location: (" << cafe.lat << ", " << cafe.lon << ")\n";

                        result_count++;
                    }
                    return true; // keep searching
                });

    auto end_time = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> duration_ms = end_time - start_time;

    std::cout << "? Found " << result_count << " cafes matching criteria.\n";
    std::cout << "?? Query time (including on-demand file reads for details): " << duration_ms.count() << " ms\n";
}

int main()
{
    const std::string csv_file = "cafes.csv"; // Your CSV file name

    // 0. Build offset index for quick data retrieval from CSV during search
    std::map<int, std::streampos> cafe_offset_index = build_cafe_offset_index(csv_file);
    // std::cout << "? Cafe ID 對應的 offset index:\n";
    // for (const auto &entry : cafe_offset_index)
    // {
    //     std::cout << "  ID " << entry.first << " -> offset " << entry.second << "\n";
    // }
    // std::ifstream testfile(csv_file);
    // if (testfile.is_open())
    // {
    //     for (const auto &[id, offset] : cafe_offset_index)
    //     {
    //         testfile.clear(); // 清除 stream 狀態
    //         testfile.seekg(offset);
    //         std::string line;
    //         std::getline(testfile, line);
    //         std::cout << "[ID " << id << "] at offset " << offset << ": " << line << "\n";
    //     }
    //     testfile.close();
    // }
    // Check if index building was meaningful (e.g., file existed and had data)
    // If cafe_offset_index is empty, it might mean the CSV file was not found, empty, or had issues.
    // The functions build_cafe_offset_index and read_cafe_locations_from_csv will print errors.

    // 1. 從 CSV 載入位置資料 (ID, lat, lon only)
    std::vector<CafeLocationInfo> locations = read_cafe_locations_from_csv(csv_file);
    if (!locations.empty())
    {
        const CafeLocationInfo &loc = locations[0];
        std::cout << "? 第一筆 CafeLocation:\n";
        std::cout << "  ID:  " << loc.id << "\n";
        std::cout << "  Lat: " << loc.lat << "\n";
        std::cout << "  Lon: " << loc.lon << "\n";
    }
    if (locations.empty() && cafe_offset_index.empty())
    {
        std::cerr << "?? No data loaded from CSV or index could not be built. Exiting." << std::endl;
        return 1;
    }
    if (locations.empty() && !cafe_offset_index.empty())
    {
        std::cerr << "?? Index built but no locations loaded for R-Tree. Check CSV content/format for location data." << std::endl;
        // Proceeding might lead to an empty R-Tree query
    }

    // 2. 建立 RTree 並插入位置資料 (IDs and their coordinates)
    CafeIdTree rtree;
    insert_to_rtree(rtree, locations);

    // 3. 查詢台北市某個區域範圍
    // Example query: Taipei City area, max crowd 50
    // Ensure R-tree is not empty and index is available before querying
    if (rtree.Count() > 0 && !cafe_offset_index.empty())
    {
        query_area(rtree, 25.0201, 121.5, 25.0994, 121.6, 50, csv_file, cafe_offset_index);

        // Add another query example if needed
        // query_area(rtree, 25.00, 121.51, 25.05, 121.55, 30, csv_file, cafe_offset_index);
    }
    else
    {
        std::cout << "?? Skipping query as R-Tree is empty or offset index is not available.\n";
    }

    // 4. 釋放記憶體
    // `locations` vector goes out of scope.
    // `rtree` (RTree object) cleans up its own memory upon destruction.
    // `cafe_offset_index` map goes out of scope.
    // No dynamically allocated `Cafe*` pointers are stored long-term in vectors.

    return 0;
}