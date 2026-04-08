-- ============================================================
-- ReviewRoll — DATABASE SCHEMA
-- ============================================================

CREATE DATABASE IF NOT EXISTS reviewroll;
USE reviewroll;

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS User (
    User_ID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(150) NOT NULL UNIQUE,
    Password_hash VARCHAR(255) NOT NULL,
    Role VARCHAR(20) NOT NULL DEFAULT 'USER'
);

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

CREATE TABLE IF NOT EXISTS Genre (
    Genre_ID INT AUTO_INCREMENT PRIMARY KEY,
    Genre_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Person (
    Person_ID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(200) NOT NULL,
    Biography TEXT DEFAULT NULL,
    Profile_Image_URL VARCHAR(500) DEFAULT NULL,
    Birth_date DATE DEFAULT NULL
);

-- ============================================================
-- RELATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS Movie_Genre (
    Movie_ID INT NOT NULL,
    Genre_ID INT NOT NULL,
    PRIMARY KEY (Movie_ID, Genre_ID),
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
    FOREIGN KEY (Genre_ID) REFERENCES Genre(Genre_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Movie_Cast (
    Movie_ID INT NOT NULL,
    Person_ID INT NOT NULL,
    Character_name VARCHAR(200) DEFAULT NULL,
    Cast_order INT DEFAULT 0,
    PRIMARY KEY (Movie_ID, Person_ID),
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
    FOREIGN KEY (Person_ID) REFERENCES Person(Person_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Movie_Crew (
    Movie_ID INT NOT NULL,
    Person_ID INT NOT NULL,
    Job VARCHAR(100) NOT NULL,
    Department VARCHAR(100) NOT NULL,
    PRIMARY KEY (Movie_ID, Person_ID, Job),
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
    FOREIGN KEY (Person_ID) REFERENCES Person(Person_ID) ON DELETE CASCADE
);

-- ============================================================
-- USER INTERACTIONS
-- ============================================================

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

CREATE TABLE IF NOT EXISTS Review (
    Review_ID INT AUTO_INCREMENT PRIMARY KEY,
    Review_text TEXT NOT NULL,
    User_ID INT NOT NULL,
    Movie_ID INT NOT NULL,
    Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES User(User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Watchlist (
    Watchlist_ID INT AUTO_INCREMENT PRIMARY KEY,
    Watchlist_name VARCHAR(100) NOT NULL,
    User_ID INT NOT NULL,
    Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES User(User_ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Watchlist_Item (
    Watchlist_ID INT NOT NULL,
    Movie_ID INT NOT NULL,
    PRIMARY KEY (Watchlist_ID, Movie_ID),
    FOREIGN KEY (Watchlist_ID) REFERENCES Watchlist(Watchlist_ID) ON DELETE CASCADE,
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE
);

-- ============================================================
-- DISCUSSION
-- ============================================================

CREATE TABLE IF NOT EXISTS Discussion_Thread (
    Thread_ID INT AUTO_INCREMENT PRIMARY KEY,
    Movie_ID INT DEFAULT NULL,
    Genre_ID INT DEFAULT NULL,
    Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status VARCHAR(10) DEFAULT 'OPEN',
    FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
    FOREIGN KEY (Genre_ID) REFERENCES Genre(Genre_ID) ON DELETE CASCADE
);

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

-- ============================================================
-- REQUEST
-- ============================================================

CREATE TABLE IF NOT EXISTS Movie_Request (
    Request_ID INT AUTO_INCREMENT PRIMARY KEY,
    Requested_title VARCHAR(200) NOT NULL,
    Release_year INT NOT NULL,
    User_ID INT NOT NULL,
    Requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (User_ID) REFERENCES User(User_ID) ON DELETE CASCADE
);

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS after_rating_insert;
DROP TRIGGER IF EXISTS after_rating_update;
DROP TRIGGER IF EXISTS before_movie_request_insert;
DROP TRIGGER IF EXISTS after_movie_insert;
DROP TRIGGER IF EXISTS after_genre_insert;

DELIMITER //

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
        SET MESSAGE_TEXT = 'Duplicate movie request rejected.';
    END IF;
END//

CREATE TRIGGER after_movie_insert
AFTER INSERT ON Movie
FOR EACH ROW
BEGIN
    INSERT INTO Discussion_Thread (Movie_ID, Genre_ID, Status)
    VALUES (NEW.Movie_ID, NULL, 'OPEN');
END//

CREATE TRIGGER after_genre_insert
AFTER INSERT ON Genre
FOR EACH ROW
BEGIN
    INSERT INTO Discussion_Thread (Movie_ID, Genre_ID, Status)
    VALUES (NULL, NEW.Genre_ID, 'OPEN');
END//

DELIMITER ;

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

DELIMITER //

DROP PROCEDURE IF EXISTS sp_approve_movie_request//
CREATE PROCEDURE sp_approve_movie_request(
    IN p_RequestID INT,
    IN p_Title VARCHAR(200),
    IN p_Year INT,
    IN p_Language VARCHAR(50),
    IN p_Duration INT,
    IN p_Description TEXT,
    IN p_ImageUrl VARCHAR(500),
    IN p_Budget BIGINT,
    IN p_Revenue BIGINT,
    IN p_ReleaseDate DATE,
    IN p_TrailerUrl VARCHAR(500),
    IN p_Trivia TEXT,
    OUT p_MovieID INT,
    OUT p_ErrorCode INT
)
BEGIN
    DECLARE v_duplicate INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_ErrorCode = 1;
    END;

    SET p_ErrorCode = 0;
    SET p_MovieID = -1;

    START TRANSACTION;

    SELECT Movie_ID INTO v_duplicate FROM Movie WHERE LOWER(Title) = LOWER(p_Title) AND Release_year = p_Year LIMIT 1;
    
    IF v_duplicate > 0 THEN
        SET p_ErrorCode = 409;
        ROLLBACK;
    ELSE
        INSERT INTO Movie (Title, Release_year, Language, Duration, Description, Image_URL, Budget, Revenue, Release_date, Trailer_URL, Trivia)
        VALUES (p_Title, p_Year, p_Language, p_Duration, p_Description, p_ImageUrl, p_Budget, p_Revenue, p_ReleaseDate, p_TrailerUrl, p_Trivia);
        
        SET p_MovieID = LAST_INSERT_ID();
        
        DELETE FROM Movie_Request WHERE Request_ID = p_RequestID;
        
        COMMIT;
    END IF;
END//

DROP PROCEDURE IF EXISTS sp_add_manual_movie//
CREATE PROCEDURE sp_add_manual_movie(
    IN p_Title VARCHAR(200),
    IN p_Year INT,
    IN p_Language VARCHAR(50),
    IN p_Duration INT,
    IN p_Description TEXT,
    IN p_ImageUrl VARCHAR(500),
    IN p_Budget BIGINT,
    IN p_Revenue BIGINT,
    IN p_ReleaseDate DATE,
    IN p_TrailerUrl VARCHAR(500),
    IN p_Trivia TEXT,
    IN p_Genres TEXT,
    OUT p_MovieID INT,
    OUT p_ErrorCode INT
)
BEGIN
    DECLARE v_duplicate INT DEFAULT 0;
    DECLARE start_pos INT DEFAULT 1;
    DECLARE comma_pos INT;
    DECLARE genre_chunk VARCHAR(100);
    DECLARE v_genreID INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_ErrorCode = 1;
    END;

    SET p_ErrorCode = 0;
    SET p_MovieID = -1;

    START TRANSACTION;

    SELECT Movie_ID INTO v_duplicate FROM Movie WHERE LOWER(Title) = LOWER(p_Title) AND Release_year = p_Year LIMIT 1;

    IF v_duplicate > 0 THEN
        SET p_ErrorCode = 409;
        ROLLBACK;
    ELSE
        INSERT INTO Movie (Title, Release_year, Language, Duration, Description, Image_URL, Budget, Revenue, Release_date, Trailer_URL, Trivia)
        VALUES (p_Title, p_Year, p_Language, p_Duration, p_Description, p_ImageUrl, p_Budget, p_Revenue, p_ReleaseDate, p_TrailerUrl, p_Trivia);
        
        SET p_MovieID = LAST_INSERT_ID();

        IF p_Genres IS NOT NULL AND LENGTH(p_Genres) > 0 THEN
            WHILE start_pos > 0 AND start_pos <= LENGTH(p_Genres) DO
                SET comma_pos = LOCATE(',', p_Genres, start_pos);
                IF comma_pos > 0 THEN
                    SET genre_chunk = SUBSTRING(p_Genres, start_pos, comma_pos - start_pos);
                    SET start_pos = comma_pos + 1;
                ELSE
                    SET genre_chunk = SUBSTRING(p_Genres, start_pos);
                    SET start_pos = 0;
                END IF;

                SET genre_chunk = TRIM(genre_chunk);
                IF LENGTH(genre_chunk) > 0 THEN
                    INSERT IGNORE INTO Genre (Genre_name) VALUES (genre_chunk);
                    SELECT Genre_ID INTO v_genreID FROM Genre WHERE Genre_name = genre_chunk LIMIT 1;
                    INSERT IGNORE INTO Movie_Genre (Movie_ID, Genre_ID) VALUES (p_MovieID, v_genreID);
                END IF;
            END WHILE;
        END IF;

        COMMIT;
    END IF;
END//

DROP PROCEDURE IF EXISTS sp_add_tmdb_movie//
CREATE PROCEDURE sp_add_tmdb_movie(
    IN p_Title VARCHAR(200),
    IN p_Year INT,
    IN p_Language VARCHAR(50),
    IN p_Duration INT,
    IN p_Description TEXT,
    IN p_ImageUrl VARCHAR(500),
    IN p_Budget BIGINT,
    IN p_Revenue BIGINT,
    IN p_ReleaseDate DATE,
    IN p_TrailerUrl VARCHAR(500),
    IN p_Trivia TEXT,
    IN p_GenresJSON JSON,
    IN p_CastJSON JSON,
    IN p_CrewJSON JSON,
    OUT p_MovieID INT,
    OUT p_ErrorCode INT
)
BEGIN
    DECLARE v_duplicate INT DEFAULT 0;
    DECLARE i INT;
    DECLARE v_len INT;
    DECLARE v_name VARCHAR(200);
    DECLARE v_profImg VARCHAR(500);
    DECLARE v_char VARCHAR(200);
    DECLARE v_job VARCHAR(100);
    DECLARE v_dept VARCHAR(100);
    DECLARE v_personID INT;
    DECLARE v_genreName VARCHAR(100);
    DECLARE v_genreID INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_ErrorCode = 1;
    END;

    SET p_ErrorCode = 0;
    SET p_MovieID = -1;

    START TRANSACTION;

    SELECT Movie_ID INTO v_duplicate FROM Movie WHERE LOWER(Title) = LOWER(p_Title) AND Release_year = p_Year LIMIT 1;
    IF v_duplicate > 0 THEN
        SET p_ErrorCode = 409;
        ROLLBACK;
    ELSE
        INSERT INTO Movie (Title, Release_year, Language, Duration, Description, Image_URL, Budget, Revenue, Release_date, Trailer_URL, Trivia)
        VALUES (p_Title, p_Year, p_Language, p_Duration, p_Description, p_ImageUrl, p_Budget, p_Revenue, p_ReleaseDate, p_TrailerUrl, p_Trivia);

        SET p_MovieID = LAST_INSERT_ID();

        IF p_GenresJSON IS NOT NULL THEN
            SET i = 0;
            SET v_len = JSON_LENGTH(p_GenresJSON);
            WHILE i < v_len DO
                SET v_genreName = JSON_UNQUOTE(JSON_EXTRACT(p_GenresJSON, CONCAT('$[', i, ']')));
                IF v_genreName IS NOT NULL AND v_genreName != 'null' THEN
                    INSERT IGNORE INTO Genre (Genre_name) VALUES (v_genreName);
                    SELECT Genre_ID INTO v_genreID FROM Genre WHERE Genre_name = v_genreName LIMIT 1;
                    INSERT IGNORE INTO Movie_Genre (Movie_ID, Genre_ID) VALUES (p_MovieID, v_genreID);
                END IF;
                SET i = i + 1;
            END WHILE;
        END IF;

        IF p_CastJSON IS NOT NULL THEN
            SET i = 0;
            SET v_len = JSON_LENGTH(p_CastJSON);
            WHILE i < v_len DO
                SET v_name = JSON_UNQUOTE(JSON_EXTRACT(p_CastJSON, CONCAT('$[', i, '].name')));
                SET v_profImg = JSON_UNQUOTE(JSON_EXTRACT(p_CastJSON, CONCAT('$[', i, '].profile_path')));
                SET v_char = JSON_UNQUOTE(JSON_EXTRACT(p_CastJSON, CONCAT('$[', i, '].character')));
                
                IF v_profImg = 'null' THEN SET v_profImg = NULL; END IF;

                IF v_name IS NOT NULL AND v_name != 'null' THEN
                    INSERT IGNORE INTO Person (Name, Profile_Image_URL) VALUES (v_name, v_profImg);
                    IF v_profImg IS NOT NULL THEN
                        UPDATE Person SET Profile_Image_URL = v_profImg WHERE Name = v_name AND Profile_Image_URL IS NULL;
                    END IF;
                    
                    SELECT Person_ID INTO v_personID FROM Person WHERE Name = v_name LIMIT 1;
                    INSERT IGNORE INTO Movie_Cast (Movie_ID, Person_ID, Character_name, Cast_order) VALUES (p_MovieID, v_personID, v_char, i);
                END IF;
                SET i = i + 1;
            END WHILE;
        END IF;

        IF p_CrewJSON IS NOT NULL THEN
            SET i = 0;
            SET v_len = JSON_LENGTH(p_CrewJSON);
            WHILE i < v_len DO
                SET v_name = JSON_UNQUOTE(JSON_EXTRACT(p_CrewJSON, CONCAT('$[', i, '].name')));
                SET v_profImg = JSON_UNQUOTE(JSON_EXTRACT(p_CrewJSON, CONCAT('$[', i, '].profile_path')));
                SET v_job = JSON_UNQUOTE(JSON_EXTRACT(p_CrewJSON, CONCAT('$[', i, '].job')));
                SET v_dept = JSON_UNQUOTE(JSON_EXTRACT(p_CrewJSON, CONCAT('$[', i, '].department')));

                IF v_profImg = 'null' THEN SET v_profImg = NULL; END IF;

                IF v_name IS NOT NULL AND v_name != 'null' AND v_job IS NOT NULL AND v_dept IS NOT NULL THEN
                    INSERT IGNORE INTO Person (Name, Profile_Image_URL) VALUES (v_name, v_profImg);
                    SELECT Person_ID INTO v_personID FROM Person WHERE Name = v_name LIMIT 1;
                    INSERT IGNORE INTO Movie_Crew (Movie_ID, Person_ID, Job, Department) VALUES (p_MovieID, v_personID, v_job, v_dept);
                END IF;
                SET i = i + 1;
            END WHILE;
        END IF;

        COMMIT;
    END IF;
END//

DELIMITER ;