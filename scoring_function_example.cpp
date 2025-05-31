#include <mysql/mysql.h>
#include <iostream>
#include <sstream>
#include <vector>
#include <string>
#include <map>
#include <unordered_map>
#include <cmath>
#include "ini.h"
using namespace std;

// === 全域設定 ===
struct DBConfig {
    string host;
    string user;
    string password;
    string database;
    unsigned int port = 3306;
} config;

struct ScoringConfig {
    double lat;
    double lon;
    double distance_weight;
} scoring_config;


int config_handler(void* user, const char* section, const char* name, const char* value) {
    DBConfig* cfg = &config;  // MySQL 部分

    if (string(section) == "mysql") {
        if (string(name) == "host") cfg->host = value;
        else if (string(name) == "user") cfg->user = value;
        else if (string(name) == "password") cfg->password = value;
        else if (string(name) == "database") cfg->database = value;
        else if (string(name) == "port") cfg->port = stoi(value);
    } 
    else if (string(section) == "scoring") {
        if (string(name) == "lat") scoring_config.lat = atof(value);
        else if (string(name) == "lon") scoring_config.lon = atof(value);
        else if (string(name) == "distance_weight") scoring_config.distance_weight = atof(value);
    }
    return 1;
}


bool load_config(const string& path) {
    return ini_parse(path.c_str(), config_handler, &config) == 0;
}

vector<double> GetLeafNodeScores(const vector<int>& dataIds, double lat, double lon, 
                                  const unordered_map<string, double>& weights, double distance_weight) {
    vector<double> scores;
    if (dataIds.empty()) return scores;

    MYSQL* conn = mysql_init(nullptr);
    if (!mysql_real_connect(conn, config.host.c_str(), config.user.c_str(),
                            config.password.c_str(), config.database.c_str(),
                            config.port, nullptr, 0)) {
        cerr << "Connection failed: " << mysql_error(conn) << endl;
        return scores;
    }

    vector<string> selected_fields = {"id", "lat", "lon"};
    for (const auto& [field, _] : weights) {
        selected_fields.push_back(field);
    }

    stringstream ss;
    ss << "SELECT ";
    for (size_t i = 0; i < selected_fields.size(); ++i) {
        ss << selected_fields[i];
        if (i < selected_fields.size() - 1) ss << ", ";
    }
    ss << " FROM Cafe WHERE id IN (";
    for (size_t i = 0; i < dataIds.size(); ++i) {
        ss << dataIds[i];
        if (i < dataIds.size() - 1) ss << ",";
    }
    ss << ")";

    if (mysql_query(conn, ss.str().c_str())) {
        cerr << "Query failed: " << mysql_error(conn) << endl;
        mysql_close(conn);
        return scores;
    }

    MYSQL_RES* res = mysql_store_result(conn);
    if (!res) {
        cerr << "Failed to store result: " << mysql_error(conn) << endl;
        mysql_close(conn);
        return scores;
    }

    map<string, int> field_index;
    MYSQL_FIELD* fields;
    unsigned int num_fields = mysql_num_fields(res);
    fields = mysql_fetch_fields(res);
    for (unsigned int i = 0; i < num_fields; ++i) {
        field_index[fields[i].name] = i;
    }

    map<string, double> min_val, max_val;
    map<int, vector<string>> rows_data;

    MYSQL_ROW row;
    while ((row = mysql_fetch_row(res))) {
        int id = atoi(row[field_index["id"]]);
        rows_data[id] = {};
        for (const auto& [key, weight] : weights) {
            if (field_index.count(key) && row[field_index[key]]) {
                double val = atof(row[field_index[key]]);
                rows_data[id].push_back(row[field_index[key]]);
                if (!min_val.count(key)) {
                    min_val[key] = max_val[key] = val;
                } else {
                    min_val[key] = min(min_val[key], val);
                    max_val[key] = max(max_val[key], val);
                }
            }
        }
    }

    mysql_data_seek(res, 0);
    map<int, double> score_map;
    while ((row = mysql_fetch_row(res))) {
        int id = atoi(row[field_index["id"]]);
        double score = 0.0;

        for (const auto& [key, weight] : weights) {
            if (field_index.count(key) && row[field_index[key]]) {
                double val = atof(row[field_index[key]]);
                double norm = 0.0;
                if (max_val[key] > min_val[key]) {
                    norm = (val - min_val[key]) / (max_val[key] - min_val[key]);
                }
                score += weight * norm;
            }
        }

        double curr_lat = atof(row[field_index["lat"]]);
        double curr_lon = atof(row[field_index["lon"]]);
        double dist = sqrt(pow(lat - curr_lat, 2) + pow(lon - curr_lon, 2));
        score += distance_weight * dist;

        score_map[id] = score;
    }

    mysql_free_result(res);
    mysql_close(conn);

    for (int id : dataIds) {
        scores.push_back(score_map.count(id) ? score_map[id] : -9999.0);
    }

    return scores;
}

int main() {
    if (!load_config("config.ini")) {
        cerr << "❌ Failed to load config.ini\n";
        return 1;
    }

    vector<int> query_ids = {1, 3, 5, 10};
    unordered_map<string, double> weights = {
        {"rating", 0.4},
        {"current_crowd", -0.3}
    };

    auto scores = GetLeafNodeScores(
        query_ids, 
        scoring_config.lat, 
        scoring_config.lon, 
        weights, 
        scoring_config.distance_weight
    );

    for (size_t i = 0; i < query_ids.size(); ++i) {
        cout << "Cafe ID " << query_ids[i] << " → Score: " << scores[i] << endl;
    }
    return 0;
}
