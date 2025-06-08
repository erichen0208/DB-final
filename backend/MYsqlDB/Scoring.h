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

struct Cafe {
    int id;
    std::string name;
    double lat, lon, rating;
    int current_crowd;
};

class MySQLScoring {
private:
    MYSQL* connection;
    std::string host, user, password, database;
    
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
            std::string query = "INSERT INTO Cafe (id, name, rating, lat, lon, current_crowd) VALUES (" +
                            std::to_string(cafe.id) + ", '" + cafe.name + "', " +
                            std::to_string(cafe.rating) + ", " + std::to_string(cafe.lat) + ", " +
                            std::to_string(cafe.lon) + ", " + std::to_string(cafe.current_crowd) + ") " +
                            "ON DUPLICATE KEY UPDATE name=VALUES(name)";
            
            if (mysql_query(connection, query.c_str()) != 0) {
                std::cerr << "Insert failed: " << mysql_error(connection) << std::endl;
                return false;
            }
        }
        return true;
    }
    
    // Get scores for cafe IDs
    std::vector<double> GetLeafNodeScores(const std::vector<int>& dataIds, 
                                double lon, double lat,
                                const std::unordered_map<std::string, double>& weights,
                                std::unordered_map<int, std::unordered_map<std::string, double>>& cafeDatas) {
        std::vector<double> scores;
        if (dataIds.empty()) return scores;

        MYSQL* conn = mysql_init(nullptr);
        if (!mysql_real_connect(conn, host.c_str(), user.c_str(),
                                password.c_str(), database.c_str(),
                                3306, nullptr, 0)) {
            std::cerr << "Connection failed: " << mysql_error(conn) << std::endl;
            return scores;
        }


        std::stringstream ss;
        ss << "SELECT *";
        ss << " FROM Cafe WHERE id IN (";
        for (size_t i = 0; i < dataIds.size(); ++i) {
            ss << dataIds[i];
            if (i < dataIds.size() - 1) ss << ",";
        }
        ss << ")";

        if (mysql_query(conn, ss.str().c_str())) {
            std::cerr << "Query failed: " << mysql_error(conn) << std::endl;
            mysql_close(conn);
            return scores;
        }

        MYSQL_RES* res = mysql_store_result(conn);
        if (!res) {
            std::cerr << "Failed to store result: " << mysql_error(conn) << std::endl;
            mysql_close(conn);
            return scores;
        }

        std::map<std::string, int> field_index;
        MYSQL_FIELD* fields = mysql_fetch_fields(res);
        unsigned int num_fields = mysql_num_fields(res);
        for (unsigned int i = 0; i < num_fields; ++i) {
            field_index[fields[i].name] = i;
        }

        std::map<std::string, double> min_val, max_val;
        std::map<int, std::vector<std::string>> rows_data;

        MYSQL_ROW row;
        while ((row = mysql_fetch_row(res))) {
            int id = std::atoi(row[field_index["id"]]);
            rows_data[id] = {};
            for (const auto& field_weight : weights) {
                const std::string& key = field_weight.first;
                if (field_index.count(key) && row[field_index[key]]) {
                    double val = std::atof(row[field_index[key]]);
                    rows_data[id].push_back(row[field_index[key]]);
                    if (min_val.find(key) == min_val.end()) {
                        min_val[key] = max_val[key] = val;
                    } else {
                        min_val[key] = std::min(min_val[key], val);
                        max_val[key] = std::max(max_val[key], val);
                    }
                }
            }
        }

        mysql_data_seek(res, 0);
        std::map<int, double> score_map;
        while ((row = mysql_fetch_row(res))) {
            int id = std::atoi(row[field_index["id"]]);
            double score = 0.0;

            for (unsigned int i = 0; i < num_fields; ++i) {
                std::string field_name = fields[i].name;
                
                // Check if the field isn't NULL
                if (row[i]) {
                    // Handle numeric fields
                    if (fields[i].type == MYSQL_TYPE_LONG || 
                        fields[i].type == MYSQL_TYPE_FLOAT || 
                        fields[i].type == MYSQL_TYPE_DOUBLE || 
                        fields[i].type == MYSQL_TYPE_DECIMAL) {
                        cafeDatas[id][field_name] = std::atof(row[i]);
                    } 
                    else {
                        cafeDatas[id][field_name] = 0.0;  
                        if (field_name == "name") {
                            cafeDatas[id][field_name] = std::atof(row[i]);
                        }
                    }
                }
            }

            for (const auto& field_weight : weights) {

                const std::string& key = field_weight.first;
                double weight = field_weight.second;

                if (key == "distance") {
                    // Calculate distance score based on lon/lat
                    double curr_lon = std::atof(row[field_index["lon"]]);
                    double curr_lat = std::atof(row[field_index["lat"]]);
                    double dist = std::sqrt(std::pow(lat - curr_lat, 2) + std::pow(lon - curr_lon, 2));
                    score += -weight * dist; // Adjust this based on your distance metric
                }
                else if (field_index.count(key) && row[field_index[key]]) {
                    double val = std::atof(row[field_index[key]]);

                    cafeDatas[id][key] = val;

                    double norm = 0.0;
                    if (max_val[key] > min_val[key]) {
                        norm = (val - min_val[key]) / (max_val[key] - min_val[key]);
                    }
                    if (key == "current_crowd") {
                        weight = -weight;
                    }
                    score += weight * norm;
                }
            }

            score_map[id] = score;
            cafeDatas[id]["score"] = std::round(score * 1000.0) / 1000.0; 
        }

        mysql_free_result(res);
        mysql_close(conn);

        for (int id : dataIds) {
            scores.push_back(score_map.count(id) ? score_map[id] : -9999.0);
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

std::vector<double> GetLeafNodeScores(const std::vector<int>& dataIds, double lon, double lat, 
                                      const std::unordered_map<std::string, double>& weights,
                                    std::unordered_map<int, std::unordered_map<std::string, double>>& cafeDatas) {
    return mysql_db.GetLeafNodeScores(dataIds, lon, lat, weights, cafeDatas);
}

#endif // SCORING_H

// g++ -std=c++17 -o test test.cpp -lmysqlclient