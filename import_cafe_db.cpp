#include <mysql/mysql.h>
#include <fstream>
#include <sstream>
#include <iostream>
#include <vector>
#include <string>
#include "ini.h"

// 全域設定結構
struct DBConfig {
    std::string host;
    std::string user;
    std::string password;
    std::string database;
    unsigned int port = 3306;
} config;

int config_handler(void* user, const char* section, const char* name, const char* value) {
    DBConfig* cfg = (DBConfig*)user;
    if (std::string(section) == "mysql") {
        if (std::string(name) == "host") cfg->host = value;
        else if (std::string(name) == "user") cfg->user = value;
        else if (std::string(name) == "password") cfg->password = value;
        else if (std::string(name) == "database") cfg->database = value;
        else if (std::string(name) == "port") cfg->port = std::stoi(value);
    }
    return 1;
}

bool load_config(const std::string& path) {
    return ini_parse(path.c_str(), config_handler, &config) == 0;
}

struct Cafe {
    int id;
    std::string name;
    double lat, lon, rating;
    int current_crowd;
};

// 載入 CSV 檔
std::vector<Cafe> load_cafes_csv(const std::string& filename) {
    std::vector<Cafe> cafes;
    std::ifstream file(filename);
    std::string line;

    std::getline(file, line); // skip header

    while (std::getline(file, line)) {
        std::stringstream ss(line);
        std::string item;
        Cafe c;

        std::getline(ss, item, ','); c.id = std::stoi(item);
        std::getline(ss, item, ','); c.name = item;
        std::getline(ss, item, ','); c.lat = std::stod(item);
        std::getline(ss, item, ','); c.lon = std::stod(item);
        std::getline(ss, item, ','); c.rating = std::stod(item);
        std::getline(ss, item, ','); c.current_crowd = std::stoi(item);

        cafes.push_back(c);
    }

    return cafes;
}

void import_to_mysql(const std::vector<Cafe>& cafes) {
    MYSQL* conn = mysql_init(nullptr);
    if (!mysql_real_connect(conn, config.host.c_str(), config.user.c_str(),
                            config.password.c_str(), config.database.c_str(),
                            config.port, nullptr, 0)) {
        std::cerr << "❌ MySQL connection failed: " << mysql_error(conn) << std::endl;
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
        std::cerr << "❌ Failed to create table: " << mysql_error(conn) << std::endl;
        mysql_close(conn);
        return;
    }

    // 清空舊資料（可選）
    mysql_query(conn, "DELETE FROM Cafe");

    // 寫入資料
    for (const auto& cafe : cafes) {
        std::stringstream ss;
        ss << "INSERT INTO Cafe (id, name, lat, lon, rating, current_crowd) VALUES ("
           << cafe.id << ", '"
           << mysql_real_escape_string_quote(conn, cafe.name.c_str(), cafe.name.size(), '\'') << "', "
           << cafe.lat << ", "
           << cafe.lon << ", "
           << cafe.rating << ", "
           << cafe.current_crowd << ")";

        if (mysql_query(conn, ss.str().c_str())) {
            std::cerr << "⚠️ Failed to insert cafe " << cafe.id << ": " << mysql_error(conn) << std::endl;
        }
    }

    mysql_close(conn);
    std::cout << "✅ All cafes imported to MySQL.\n";
}

int main() {
    if (!load_config("db_config.ini")) {
        std::cerr << "❌ Failed to load db_config.ini\n";
        return 1;
    }

    auto cafes = load_cafes_csv("cafes.csv");
    std::cout << "✔️ Loaded " << cafes.size() << " cafes.\n";

    import_to_mysql(cafes);
    return 0;
}