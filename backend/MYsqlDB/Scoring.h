#ifndef SCORING_H
#define SCORING_H

#include <mariadb/mysql.h>
#include <vector>
#include <string>
#include <unordered_map>
#include <iostream>
#include <sstream>
#include <map>
#include <cmath>
#include <cstdlib> 

constexpr double EARTH_RADIUS = 6371000.0;

struct Cafe {
    int id;
    std::string name;
    double lat, lon, rating;
    int price_level, current_crowd;
};

class MySQLScoring {
private:
    MYSQL* connection;
    std::string host, user, password, database;

    double deg2rad(double deg) {
        return deg * M_PI / 180.0;
    }

    double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = deg2rad(lat2 - lat1);
        double dLon = deg2rad(lon2 - lon1);

        lat1 = deg2rad(lat1);
        lat2 = deg2rad(lat2);

        double a = std::pow(std::sin(dLat / 2), 2) +
                std::cos(lat1) * std::cos(lat2) * std::pow(std::sin(dLon / 2), 2);
        double c = 2 * std::atan2(std::sqrt(a), std::sqrt(1 - a));

        return EARTH_RADIUS * c;
    }
    
public:
    MySQLScoring() : connection(nullptr) {}
    
    ~MySQLScoring() {
        if (connection) {
            mysql_close(connection);
        }
    }
    
    // Simple config loading from environment variables (ROOT ONLY)
    bool init() {
        // Use Docker environment variables
        const char* env_host = std::getenv("MYSQL_HOST");
        const char* env_user = std::getenv("MYSQL_USER");
        const char* env_password = std::getenv("MYSQL_PASSWORD");
        const char* env_database = std::getenv("MYSQL_DATABASE");
        
        // Set to user credentials as default
        host = env_host ? env_host : "mysql";
        user = env_user ? env_user : "user";             
        password = env_password ? env_password : "password";  
        database = env_database ? env_database : "cafeDB";
                
        return connect();
    }

    // Connect to MySQL
    bool connect() {
        connection = mysql_init(nullptr);
        if (!connection) return false;
        
        if (!mysql_real_connect(connection, host.c_str(), user.c_str(), 
                               password.c_str(), database.c_str(), 3306, nullptr, 0)) {
            std::cerr << "MySQL connection failed: " << mysql_error(connection) << std::endl;
            return false;
        }

        return true;
    }
    
    // Import cafe data
    bool insert_cafes_to_mysql(const std::vector<Cafe>& cafes) {
        if (!connection) return false;
        
        for (const auto& cafe : cafes) {
            std::string escaped_name = cafe.name;
            size_t pos = 0;
            while ((pos = escaped_name.find("'", pos)) != std::string::npos) {
                escaped_name.replace(pos, 1, "\\'");
                pos += 2;
            }

            // std::cout << "Cafe Price Level: " << cafe.price_level << std::endl;

            std::string query = "INSERT INTO Cafe (id, name, rating, lat, lon, price_level, current_crowd) VALUES (" +
                            std::to_string(cafe.id) + ", '" + escaped_name + "', " +
                            std::to_string(cafe.rating) + ", " + std::to_string(cafe.lat) + ", " + 
                            std::to_string(cafe.lon) + ", " + std::to_string(cafe.price_level) + ", " + 
                            std::to_string(cafe.current_crowd) + ") " +
                            "ON DUPLICATE KEY UPDATE name=VALUES(name)";
            
            if (mysql_query(connection, query.c_str()) != 0) {
                std::cerr << "Insert failed: " << mysql_error(connection) << std::endl;
                return false;
            }
        }
        return true;
    }
    
    std::unordered_map<int, std::unordered_map<std::string, double>> GetAllCafeData(double lon, double lat, double r_meters) {
        std::unordered_map<int, std::unordered_map<std::string, double>> cafeDatas;
        
        if (!connection) return cafeDatas;



        // Get all cafes within the search radius in one query
        std::string query = "SELECT * FROM Cafe;";
        if (mysql_query(connection, query.c_str())) {
            std::cerr << "Query failed: " << mysql_error(connection) << std::endl;
            return cafeDatas;
        }

        MYSQL_RES* res = mysql_store_result(connection);
        if (!res) return cafeDatas;

        std::map<std::string, int> field_index;
        MYSQL_FIELD* fields = mysql_fetch_fields(res);
        unsigned int num_fields = mysql_num_fields(res);
        for (unsigned int i = 0; i < num_fields; ++i) {
            field_index[fields[i].name] = i;
        }

        MYSQL_ROW row;
        while ((row = mysql_fetch_row(res))) {
            int id = std::atoi(row[field_index["id"]]);
            
            // Store all field values
            for (unsigned int i = 0; i < num_fields; ++i) {
                std::string field_name = fields[i].name;
                if (row[i]) {
                    cafeDatas[id][field_name] = std::atof(row[i]);
                }
            }
            
            // Calculate distance once
            double curr_lon = std::atof(row[field_index["lon"]]);
            double curr_lat = std::atof(row[field_index["lat"]]);
            double dist_meters = haversine(lat, lon, curr_lat, curr_lon);
            cafeDatas[id]["distance"] = std::round(dist_meters);
        }

        mysql_free_result(res);
        return cafeDatas;
    }

    std::vector<double> GetLeafNodeScores(const std::vector<int>& dataIds, 
                                const double lon, const double lat, const double r_meters,
                                const std::unordered_map<std::string, double>& weights,
                                std::unordered_map<int, std::unordered_map<std::string, double>>& cafeDatas) {
        std::vector<double> scores;
        
        for (int id : dataIds) {
            auto it = cafeDatas.find(id);
            if (it == cafeDatas.end()) {
                scores.push_back(0.0);
                continue;
            }
            
            const auto& cafeData = it->second;
            double score = 0.0;
            double total_weight = 0.0;

            for (const auto& field_weight : weights) {
                const std::string& key = field_weight.first;
                double weight = field_weight.second;
                double norm = 0.0;
                
                if (key == "distance") {
                    norm = 1 - (cafeData.at("distance") / (r_meters * 2));
                }
                else if (key == "rating") {
                    norm = (cafeData.at("rating") - 3.0) / 2.0;
                } 
                else if (key == "price_level") {
                    norm = 1 - (cafeData.at("price_level") / 5.0);
                }
                else if (key == "current_crowd") {
                    norm = 1 - (cafeData.at("current_crowd") / 100.0);
                }
                
                score += norm * weight;
                total_weight += weight;
            }

            score = total_weight > 0 ? score / total_weight : score;
            scores.push_back(std::round(score * 1000.0) / 1000.0);
            cafeDatas[id]["score"] = std::round(score * 1000.0) / 1000.0;
        }

        return scores;    
    }
};

MySQLScoring mysql_db;

bool init_mysql() {
    return mysql_db.init();
}

bool insert_cafes_to_mysql(const std::vector<Cafe>& cafes) {
    return mysql_db.insert_cafes_to_mysql(cafes);
}

std::vector<double> GetLeafNodeScores(const std::vector<int>& dataIds, const double lon, const double lat, const double r_meters,
                                      const std::unordered_map<std::string, double>& weights,
                                    std::unordered_map<int, std::unordered_map<std::string, double>>& cafeDatas) {
    return mysql_db.GetLeafNodeScores(dataIds, lon, lat, r_meters, weights, cafeDatas);
}

std::unordered_map<int, std::unordered_map<std::string, double>> GetAllCafeData(double lon, double lat, double r_meters) {
    return mysql_db.GetAllCafeData(lon, lat, r_meters);
}

#endif // SCORING_H

// g++ -std=c++17 -o test test.cpp -lmysqlclient