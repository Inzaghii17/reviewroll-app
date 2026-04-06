-- ============================================================
-- ReviewRoll — DATABASE SCHEMA
-- Run ONCE manually: mysql -u root -p < db/schema.sql
-- DO NOT run again unless starting completely fresh.
-- Server startup does NOT drop or recreate this database.
-- ============================================================

CREATE DATABASE IF NOT EXISTS reviewroll;
USE reviewroll;

-- ================= USER =================

CREATE TABLE IF NOT EXISTS User (
    User_ID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(150) NOT NULL UNIQUE,
    Password_hash VARCHAR(255) NOT NULL,
    Role VARCHAR(20) NOT NULL DEFAULT 'USER'
);

-- ================= MOVIE =================

CREATE TABLE IF NOT EXISTS Movie (
    Movie_ID INT AUTO_INCREMENT PRIMARY KEY,
    Title VARCHAR(200) NOT NULL,
    Release_year INT NOT NULL,
    Release_date DATE DEFAULT NULL,
    Language VARCHAR(50) NOT NULL DEFAULT 'Unknown',
    Duration INT NOT NULL DEFAULT 0,
    Description TEXT,
    Avg_rating DECIMAL(3,1) DEFAULT 0,
    Image_URL VARCHAR(500) DEFAULT NULL,
    Trailer_URL VARCHAR(500) DEFAULT NULL,
    Budget BIGINT DEFAULT 0,
    Revenue BIGINT DEFAULT 0,
    Trivia TEXT DEFAULT NULL,
    INDEX idx_movie_title (Title)
);

-- ================= GENRE =================

CREATE TABLE IF NOT EXISTS Genre (
    Genre_ID INT AUTO_INCREMENT PRIMARY KEY,
    Genre_name VARCHAR(100) NOT NULL UNIQUE
);

-- ================= MOVIE_GENRE =================

CREATE TABLE IF NOT EXISTS Movie_Genre (
    Movie_ID INT NOT NULL,
    Genre_ID INT NOT NULL,
    PRIMARY KEY (Movie_ID, Genre_ID),
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
    FOREIGN KEY (Genre_ID) REFERENCES Genre(Genre_ID) ON DELETE CASCADE
);

-- ================= PERSON =================

CREATE TABLE IF NOT EXISTS Person (
    Person_ID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(200) NOT NULL,
    Biography TEXT DEFAULT NULL,
    Profile_Image_URL VARCHAR(500) DEFAULT NULL,
    Birth_date DATE DEFAULT NULL
);

-- ================= MOVIE_CAST =================

CREATE TABLE IF NOT EXISTS Movie_Cast (
    Movie_ID INT NOT NULL,
    Person_ID INT NOT NULL,
    Character_name VARCHAR(200) DEFAULT NULL,
    Cast_order INT DEFAULT 0,
    PRIMARY KEY (Movie_ID, Person_ID),
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
    FOREIGN KEY (Person_ID) REFERENCES Person(Person_ID) ON DELETE CASCADE
);

-- ================= MOVIE_CREW =================

CREATE TABLE IF NOT EXISTS Movie_Crew (
    Movie_ID INT NOT NULL,
    Person_ID INT NOT NULL,
    Job VARCHAR(100) NOT NULL,
    Department VARCHAR(100) NOT NULL,
    PRIMARY KEY (Movie_ID, Person_ID, Job),
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
    FOREIGN KEY (Person_ID) REFERENCES Person(Person_ID) ON DELETE CASCADE
);

-- ================= RATING =================

CREATE TABLE IF NOT EXISTS Rating (
    Rating_ID INT AUTO_INCREMENT PRIMARY KEY,
    Rating_value INT NOT NULL CHECK (Rating_value BETWEEN 1 AND 10),
    User_ID INT NOT NULL,
    Movie_ID INT NOT NULL,
    Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_movie_rating (User_ID, Movie_ID),
    FOREIGN KEY (User_ID) REFERENCES User(User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE
);

-- ================= REVIEW =================

CREATE TABLE IF NOT EXISTS Review (
    Review_ID INT AUTO_INCREMENT PRIMARY KEY,
    Review_text TEXT NOT NULL,
    User_ID INT NOT NULL,
    Movie_ID INT NOT NULL,
    Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES User(User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE
);

-- ================= WATCHLIST =================

CREATE TABLE IF NOT EXISTS Watchlist (
    Watchlist_ID INT AUTO_INCREMENT PRIMARY KEY,
    Watchlist_name VARCHAR(100) NOT NULL,
    User_ID INT NOT NULL,
    Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES User(User_ID) ON DELETE CASCADE
);

-- ================= WATCHLIST_ITEM =================

CREATE TABLE IF NOT EXISTS Watchlist_Item (
    Watchlist_ID INT NOT NULL,
    Movie_ID INT NOT NULL,
    PRIMARY KEY (Watchlist_ID, Movie_ID),
    FOREIGN KEY (Watchlist_ID) REFERENCES Watchlist(Watchlist_ID) ON DELETE CASCADE,
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE
);

-- ================= DISCUSSION_THREAD =================

CREATE TABLE IF NOT EXISTS Discussion_Thread (
    Thread_ID INT AUTO_INCREMENT PRIMARY KEY,
    Movie_ID INT DEFAULT NULL,
    Genre_ID INT DEFAULT NULL,
    Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status VARCHAR(10) DEFAULT 'OPEN',
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
    FOREIGN KEY (Genre_ID) REFERENCES Genre(Genre_ID) ON DELETE CASCADE
);

-- ================= DISCUSSION_POST =================

CREATE TABLE IF NOT EXISTS Discussion_Post (
    Post_ID INT AUTO_INCREMENT PRIMARY KEY,
    Content TEXT NOT NULL,
    User_ID INT NOT NULL,
    Thread_ID INT NOT NULL,
    Parent_post_ID INT DEFAULT NULL,
    Is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES User(User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Thread_ID) REFERENCES Discussion_Thread(Thread_ID) ON DELETE CASCADE,
    FOREIGN KEY (Parent_post_ID) REFERENCES Discussion_Post(Post_ID) ON DELETE CASCADE
);

-- ================= MOVIE_REQUEST =================

CREATE TABLE IF NOT EXISTS Movie_Request (
    Request_ID INT AUTO_INCREMENT PRIMARY KEY,
    Requested_title VARCHAR(200) NOT NULL,
    Release_year INT NOT NULL,
    User_ID INT NOT NULL,
    Requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES User(User_ID) ON DELETE CASCADE
);

-- ================= TRIGGERS =================

DROP TRIGGER IF EXISTS after_rating_insert;
DROP TRIGGER IF EXISTS after_rating_update;
DROP TRIGGER IF EXISTS before_movie_request_insert;
DROP TRIGGER IF EXISTS after_movie_insert;
DROP TRIGGER IF EXISTS after_genre_insert;

DELIMITER //

-- Trigger 1: Auto-update Avg_rating when a rating is inserted
CREATE TRIGGER after_rating_insert
AFTER INSERT ON Rating
FOR EACH ROW
BEGIN
    UPDATE Movie
    SET Avg_rating = (
        SELECT ROUND(AVG(Rating_value), 1)
        FROM Rating
        WHERE Movie_ID = NEW.Movie_ID
    )
    WHERE Movie_ID = NEW.Movie_ID;
END//

-- Trigger 2: Auto-update Avg_rating when a rating is updated
CREATE TRIGGER after_rating_update
AFTER UPDATE ON Rating
FOR EACH ROW
BEGIN
    UPDATE Movie
    SET Avg_rating = (
        SELECT ROUND(AVG(Rating_value), 1)
        FROM Rating
        WHERE Movie_ID = NEW.Movie_ID
    )
    WHERE Movie_ID = NEW.Movie_ID;
END//

-- Trigger 3: Prevent duplicate Movie_Request
CREATE TRIGGER before_movie_request_insert
BEFORE INSERT ON Movie_Request
FOR EACH ROW
BEGIN
    DECLARE movie_exists INT DEFAULT 0;
    SELECT COUNT(*) INTO movie_exists
    FROM Movie
    WHERE LOWER(Title) = LOWER(NEW.Requested_title)
      AND Release_year = NEW.Release_year;
    IF movie_exists > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Movie already exists in the database. Duplicate request rejected.';
    END IF;
END//

-- Trigger 4: Auto-create Discussion_Thread when a Movie is inserted
CREATE TRIGGER after_movie_insert
AFTER INSERT ON Movie
FOR EACH ROW
BEGIN
    INSERT INTO Discussion_Thread (Movie_ID, Genre_ID, Status)
    VALUES (NEW.Movie_ID, NULL, 'OPEN');
END//

-- Trigger 5: Auto-create Discussion_Thread when a Genre is inserted
CREATE TRIGGER after_genre_insert
AFTER INSERT ON Genre
FOR EACH ROW
BEGIN
    INSERT INTO Discussion_Thread (Movie_ID, Genre_ID, Status)
    VALUES (NULL, NEW.Genre_ID, 'OPEN');
END//

DELIMITER ;

-- Back-fill threads for any movies/genres that don't have one yet
INSERT IGNORE INTO Discussion_Thread (Movie_ID, Genre_ID, Status)
SELECT Movie_ID, NULL, 'OPEN' FROM Movie
WHERE Movie_ID NOT IN (
    SELECT Movie_ID FROM Discussion_Thread WHERE Movie_ID IS NOT NULL
);

INSERT IGNORE INTO Discussion_Thread (Movie_ID, Genre_ID, Status)
SELECT NULL, Genre_ID, 'OPEN' FROM Genre
WHERE Genre_ID NOT IN (
    SELECT Genre_ID FROM Discussion_Thread WHERE Genre_ID IS NOT NULL
);
