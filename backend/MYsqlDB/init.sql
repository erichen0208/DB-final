CREATE DATABASE IF NOT EXISTS cafeDB;
USE cafeDB;

CREATE TABLE IF NOT EXISTS Cafe (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    lon DECIMAL(11,8),
    lat DECIMAL(10,8),
    rating DECIMAL(3,2),
    current_crowd INT
);

-- Docker already created the user, just grant privileges
GRANT ALL PRIVILEGES ON cafeDB.* TO 'user'@'%';
FLUSH PRIVILEGES;
