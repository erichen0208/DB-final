#include "Scoring.h"
#include <iostream>
#include <vector>
#include <string>
#include <fstream>
#include <sstream>
#include <map>

using namespace std;

// struct Cafe {
//     int id;
//     string name;
//     double lat, lon, rating;
//     int current_crowd;
// };

vector<Cafe> load_cafes_csv(const string& filename) {
    vector<Cafe> cafes;
    ifstream file(filename);
    string line;

    getline(file, line); // skip header

    while (getline(file, line)) {
        stringstream ss(line);
        string item;
        Cafe c;

        getline(ss, item, ','); c.id = stoi(item);
        getline(ss, item, ','); c.name = item;
        getline(ss, item, ','); c.lat = stod(item);
        getline(ss, item, ','); c.lon = stod(item);
        getline(ss, item, ','); c.rating = stod(item);
        getline(ss, item, ','); c.current_crowd = stoi(item);

        cafes.push_back(c);
    }

    return cafes;
}

int main() {
    std::cout << "🧪 Simple MySQL Test\n";
    
    // 1. Initialize
    if (!init_mysql()) {
        std::cout << "❌ Failed to connect to MySQL\n";
        return 1;
    }
    
    // 2. Import test data
    auto cafes = load_cafes_csv("cafes_100.csv");
    
    if (import_cafes(cafes)) {
        std::cout << "✅ Data imported\n";
    }
    
    // 3. Get scores
    std::unordered_map<std::string, double> weights = {
        {"rating", 0.1},
        {"current_crowd", 0.7},
    };

    std::vector<int> test_ids = {1, 3, 5, 7, 9};
    auto scores = GetLeafNodeScores(test_ids, 121.5, 25.0, weights);
    
    std::cout << "📊 Results:\n";
    for (size_t i = 0; i < scores.size(); ++i) {
        std::cout << "   ID " << test_ids[i] << " → Score: " << scores[i] << "\n";
    }
    
    return 0;
}