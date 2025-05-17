#include "RTree/RTree.h"
#include <iostream>
#include <vector>
#include <random>
#include <chrono>
#include <cassert>
#include <array>
#include <fstream>
#include <iomanip>
#include <string>

// Simple class to use as the data element
struct MyData {
    int id;
    MyData(int i) : id(i) {}
};

// Function to generate random coordinate in range [min, max]
double randomCoordinate(double min, double max) {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    std::uniform_real_distribution<> dis(min, max);
    return dis(gen);
}

// Template function to export tree structure to JSON based on dimension
template<int NUMDIMS>
void exportTreeState(RTree<MyData*, double, NUMDIMS>& tree,
    const std::vector<std::pair<std::array<double, NUMDIMS>, std::array<double, NUMDIMS>>>& boundingBoxes,
    const std::string& operation,
    int operationId,
    int frameCount,
    const std::pair<std::array<double, NUMDIMS>, std::array<double, NUMDIMS>>* target = nullptr) {

    std::string filename = "frames/frame_" + std::to_string(frameCount) + ".json";
    std::ofstream outFile(filename);

    if (!outFile.is_open()) {
        std::cerr << "Failed to open file: " << filename << std::endl;
        return;
    }

    // Get tree structure
    auto treeStructure = tree.GetTreeStructure();

    outFile << "{\n";
    outFile << "  \"dimensions\": " << NUMDIMS << ",\n";
    outFile << "  \"operation\": \"" << operation << "\",\n";
    outFile << "  \"operationId\": " << operationId << ",\n";
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
        outFile << "      \"children\": [";
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
        
        outFile << "    {\n";
        outFile << "      \"id\": " << dataPoint.id << ",\n";
        
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
        outFile << "]\n";
        
        outFile << "    }";
        if (i < treeStructure.dataPoints.size() - 1) outFile << ",";
        outFile << "\n";
    }
    outFile << "  ]\n";

    outFile << "}\n";
    outFile.close();
}

// Template function to run the test suite with a specific dimension
template<int NUMDIMS>
void runTests() {
    // Create directory for frames if it doesn't exist
    system("mkdir -p frames");
    
    // Create an RTree with the specified number of dimensions
    RTree<MyData*, double, NUMDIMS> tree;
    
    // Test 1: Insert multiple items with different bounding boxes
    const int NUM_ITEMS = 100; // Using fewer items for clearer visualization
    std::vector<MyData*> dataItems;
    
    // Use arrays for bounding boxes - explicitly specify the type
    using Point = std::array<double, NUMDIMS>;
    std::vector<std::pair<Point, Point>> boundingBoxes;
    
    std::cout << "=== Test 1: Inserting " << NUM_ITEMS << " items in " 
              << NUMDIMS << "D space ===" << std::endl;
    
    int frameCount = 0;
    // Export initial empty tree - explicitly specify the template parameter
    exportTreeState<NUMDIMS>(tree, boundingBoxes, "init", -1, frameCount++);
    
    for (int i = 0; i < NUM_ITEMS; i++) {
        // Every 10 insertions, export a frame (to keep number of frames manageable)
        bool exportFrame = (i % 10 == 0) || (i < 10) || (i >= NUM_ITEMS - 10);
        
        MyData* data = new MyData(i);
        dataItems.push_back(data);
        
        // Create a random bounding box
        Point min, max;
        for (int j = 0; j < NUMDIMS; j++) {
            min[j] = randomCoordinate(0.0, 90.0);
            max[j] = min[j] + randomCoordinate(2.0, 10.0); // Ensure max > min
        }
        
        // Store bounding box for later retrieval tests
        boundingBoxes.push_back(std::make_pair(min, max));
        
        // Insert into tree
        tree.Insert(min.data(), max.data(), data);
        
        if (exportFrame) {
            exportTreeState<NUMDIMS>(tree, boundingBoxes, "insert", i, frameCount++, &boundingBoxes[i]);
        }
        
        if (i % 10 == 0) {
            std::cout << "  Inserted " << (i+1) << " items..." << std::endl;
        }
    }
    
    std::cout << "Inserted " << NUM_ITEMS << " items" << std::endl;
    std::cout << "Tree size: " << tree.Count() << std::endl;
    
    // Test 2: Search for specific items
    std::cout << "\n=== Test 2: Searching for specific items ===" << std::endl;
    
    for (int i = 0; i < 3; i++) {
        int index = i * (NUM_ITEMS / 3); // Pick evenly distributed samples
        const Point& min = boundingBoxes[index].first;
        const Point& max = boundingBoxes[index].second;
        
        std::cout << "Searching for item " << index << " within bounds: [";
        for (int d = 0; d < NUMDIMS; d++) {
            std::cout << min[d];
            if (d < NUMDIMS - 1) std::cout << ",";
        }
        std::cout << "] to [";
        for (int d = 0; d < NUMDIMS; d++) {
            std::cout << max[d];
            if (d < NUMDIMS - 1) std::cout << ",";
        }
        std::cout << "]" << std::endl;
        
        bool found = false;
        tree.Search(min.data(), max.data(), [&found, index](MyData* data) -> bool {
            if (data->id == index) {
                found = true;
            }
            return true; // continue searching
        });
        
        // Export state after search - explicitly specify template parameter
        exportTreeState<NUMDIMS>(tree, boundingBoxes, "search", index, frameCount++, &boundingBoxes[index]);
        
        std::cout << (found ? "Found" : "Did not find") << " item with ID " << index << std::endl;
    }
    
    // Test 3: Range query
    std::cout << "\n=== Test 3: Range query ===" << std::endl;
    for (int i = 0; i < 3; i++) {
        std::array<double, NUMDIMS> queryMin, queryMax;
        for (int j = 0; j < NUMDIMS; j++) {
            queryMin[j] = randomCoordinate(0.0, 45.0);
            queryMax[j] = queryMin[j] + randomCoordinate(45.0, 45.0); // Ensure max > min
        }
        
        std::vector<int> foundIds;
        tree.Search(queryMin.data(), queryMax.data(), [&foundIds](MyData* data) -> bool {
            foundIds.push_back(data->id);
            return true; // continue searching
        });
        
        // Export state after range query - explicitly specify template parameter
        auto queryPair = std::make_pair(queryMin, queryMax);
        exportTreeState<NUMDIMS>(tree, boundingBoxes, "range_query", -1, frameCount++, &queryPair);
        
        std::cout << "Found " << foundIds.size() << " items in the range query: " << " within bounds: [";
        for (int d = 0; d < NUMDIMS; d++) {
            std::cout << queryMin[d];
            if (d < NUMDIMS - 1) std::cout << ",";
        }
        std::cout << "] to [";
        for (int d = 0; d < NUMDIMS; d++) {
            std::cout << queryMax[d];
            if (d < NUMDIMS - 1) std::cout << ",";
        }
        std::cout << "]" << std::endl; 
    }
    
    // Test 4: Remove some items
    std::cout << "\n=== Test 4: Removing items ===" << std::endl;
    int numToRemove = 30; // Removing fewer items for clearer visualization
    
    for (int i = 0; i < numToRemove; i++) {
        // Export frame every few removals
        bool exportFrame = (i % 5 == 0) || (i < 5) || (i >= numToRemove - 5);
        
        const Point& min = boundingBoxes[i].first;
        const Point& max = boundingBoxes[i].second;
        
        // Remove item
        tree.Remove(min.data(), max.data(), dataItems[i]);
        
        if (exportFrame) {
            exportTreeState<NUMDIMS>(tree, boundingBoxes, "remove", i, frameCount++, &boundingBoxes[i]);
        }
        
        if (i % 10 == 0) {
            std::cout << "  Removed " << (i+1) << " items..." << std::endl;
        }
    }
    
    std::cout << "Removed " << numToRemove << " items" << std::endl;
    std::cout << "Tree size: " << tree.Count() << std::endl;
    
    // Clean up
    for (auto data : dataItems) {
        delete data;
    }
    
    std::cout << "Tests completed successfully!" << std::endl;
    std::cout << "Generated " << frameCount << " frames for animation" << std::endl;
}

int main(int argc, char* argv[]) {
    int dimensions = 2; // Default to 2D
    
    // Check if user specified dimensions
    if (argc > 1) {
        dimensions = std::stoi(argv[1]);
        if (dimensions != 2 && dimensions != 3) {
            std::cerr << "Error: Dimensions must be either 2 or 3" << std::endl;
            std::cerr << "Usage: " << argv[0] << " [dimensions]" << std::endl;
            return 1;
        }
    }
    
    std::cout << "Running R-Tree tests in " << dimensions << "D space" << std::endl;
    
    // Run tests based on the dimension parameter
    if (dimensions == 2) {
        runTests<2>();
    } else {
        runTests<3>();
    }
    
    return 0;
}