#include <mysql/mysql.h>
#include <fstream>
#include <sstream>
#include <iostream>
#include <vector>
#include <string>
#include "ini.h"
using namespace std;

// 全域設定結構
struct DBConfig {
    string host;
    string user;
    string password;
    string database;
    unsigned int port = 3306;
} config;

int config_handler(void* user, const char* section, const char* name, const char* value) {
    DBConfig* cfg = (DBConfig*)user;
    if (string(section) == "mysql") {
        if (string(name) == "host") cfg->host = value;
        else if (string(name) == "user") cfg->user = value;
        else if (string(name) == "password") cfg->password = value;
        else if (string(name) == "database") cfg->database = value;
        else if (string(name) == "port") cfg->port = stoi(value);
    }
    return 1;
}

bool load_config(const string& path) {
    return ini_parse(path.c_str(), config_handler, &config) == 0;
}

struct Cafe {
    int id;
    string name;
    double lat, lon, rating;
    int current_crowd;
};

// 載入 CSV 檔
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

void import_to_mysql(const vector<Cafe>& cafes) {
    MYSQL* conn = mysql_init(nullptr);
    if (!mysql_real_connect(conn, config.host.c_str(), config.user.c_str(),
                            config.password.c_str(), nullptr,
                            config.port, nullptr, 0)) {
        cerr << "❌ MySQL connection failed: " << mysql_error(conn) << endl;
        return;
    }

    stringstream create_db_sql;
    create_db_sql << "CREATE DATABASE IF NOT EXISTS " << config.database;
    if (mysql_query(conn, create_db_sql.str().c_str())) {
        cerr << "❌ Failed to create database: " << mysql_error(conn) << endl;
        mysql_close(conn);
        return;
    }
    if (mysql_select_db(conn, config.database.c_str())) {
        cerr << "❌ Failed to select database; " << mysql_error(conn) << endl;
        mysql_close(conn);
        return;
    }

    // 建立表格
    const char* create_sql = R"(
        CREATE TABLE IF NOT EXISTS Cafe (
            id INT PRIMARY KEY,
            name VARCHAR(100),
            lat DOUBLE,
            lon DOUBLE,
            rating DOUBLE,
            current_crowd INT
        )
    )";
    if (mysql_query(conn, create_sql)) {
        cerr << "❌ Failed to create table: " << mysql_error(conn) << endl;
        mysql_close(conn);
        return;
    }

    // 清空舊資料（可選）
    mysql_query(conn, "DELETE FROM Cafe");

    // 寫入資料
    for (const auto& cafe : cafes) {
        stringstream ss;
        ss << "INSERT INTO Cafe (id, name, lat, lon, rating, current_crowd) VALUES ("
           << cafe.id << ", '"
           << cafe.name << "', "
           << cafe.lat << ", "
           << cafe.lon << ", "
           << cafe.rating << ", "
           << cafe.current_crowd << ")";

        if (mysql_query(conn, ss.str().c_str())) {
            cerr << "⚠️ Failed to insert cafe " << cafe.id << ": " << mysql_error(conn) << endl;
        }
    }

    mysql_close(conn);
    cout << "✅ All cafes imported to MySQL.\n";
}

int main() {
    if (!load_config("config.ini")) {
        cerr << "❌ Failed to load config.ini\n";
        return 1;
    }

    auto cafes = load_cafes_csv("cafes.csv");
    cout << "✔️ Loaded " << cafes.size() << " cafes.\n";

    import_to_mysql(cafes);
    return 0;
}