-- ============================================================
-- Task 4 Query Demonstration Script (4 Basic + 3 Intermediate + 3 Advanced)
-- Schema: reviewroll
-- Purpose: Show query variety and mapping to app features
-- ============================================================

USE reviewroll;

-- ------------------------------------------------------------
-- Q1. Basic SELECT + ORDER BY
-- Feature: movie catalogue page
-- ------------------------------------------------------------
SELECT
  Movie_ID,
  Title,
  Release_year,
  Language,
  Duration,
  Avg_rating
FROM Movie
ORDER BY Release_year DESC, Avg_rating DESC, Title ASC;

-- ------------------------------------------------------------
-- Q2. Filtering + predicate
-- Feature: discover high-rated movies
-- ------------------------------------------------------------
SELECT
  Movie_ID,
  Title,
  Avg_rating
FROM Movie
WHERE Avg_rating >= 8.0
ORDER BY Avg_rating DESC, Title ASC;

-- ------------------------------------------------------------
-- Q3. JOIN (Movie + Genre)
-- Feature: movie card genre badges
-- ------------------------------------------------------------
SELECT
  m.Movie_ID,
  m.Title,
  COALESCE(GROUP_CONCAT(g.Genre_name ORDER BY g.Genre_name SEPARATOR ', '), 'Unassigned') AS Genres
FROM Movie m
LEFT JOIN Movie_Genre mg ON mg.Movie_ID = m.Movie_ID
LEFT JOIN Genre g ON g.Genre_ID = mg.Genre_ID
GROUP BY m.Movie_ID, m.Title
ORDER BY m.Title;

-- ------------------------------------------------------------
-- Q4. Aggregation + GROUP BY + HAVING
-- Feature: trending list based on engagement
-- ------------------------------------------------------------
SELECT
  m.Movie_ID,
  m.Title,
  COUNT(DISTINCT r.Rating_ID) AS rating_count,
  COUNT(DISTINCT rv.Review_ID) AS review_count,
  ROUND(AVG(r.Rating_value), 1) AS avg_rating
FROM Movie m
LEFT JOIN Rating r ON r.Movie_ID = m.Movie_ID
LEFT JOIN Review rv ON rv.Movie_ID = m.Movie_ID
GROUP BY m.Movie_ID, m.Title
HAVING COUNT(DISTINCT r.Rating_ID) >= 2
ORDER BY avg_rating DESC, review_count DESC;

-- ------------------------------------------------------------
-- INTERMEDIATE QUERIES
-- ------------------------------------------------------------

-- Q5. Correlated subquery
-- Feature: identify power users for moderation/analytics
-- ------------------------------------------------------------
SELECT
  u.User_ID,
  u.Name,
  (
    SELECT COUNT(*)
    FROM Review rv
    WHERE rv.User_ID = u.User_ID
  ) AS reviews_written
FROM User u
WHERE (
    SELECT COUNT(*)
    FROM Review rv
    WHERE rv.User_ID = u.User_ID
  ) >= (
    SELECT AVG(user_review_count)
    FROM (
      SELECT COUNT(*) AS user_review_count
      FROM Review
      GROUP BY User_ID
    ) x
  )
ORDER BY reviews_written DESC, u.Name;

-- ------------------------------------------------------------
-- Q6. CTE + window function (ranking)
-- Feature: dashboard popularity ranking
-- ------------------------------------------------------------
WITH movie_stats AS (
  SELECT
    m.Movie_ID,
    m.Title,
    COALESCE(ROUND(AVG(r.Rating_value), 1), 0) AS avg_rating,
    COUNT(r.Rating_ID) AS rating_count
  FROM Movie m
  LEFT JOIN Rating r ON r.Movie_ID = m.Movie_ID
  GROUP BY m.Movie_ID, m.Title
)
SELECT
  Movie_ID,
  Title,
  avg_rating,
  rating_count,
  DENSE_RANK() OVER (
    ORDER BY avg_rating DESC, rating_count DESC, Title ASC
  ) AS popularity_rank
FROM movie_stats
ORDER BY popularity_rank, Title;

-- ------------------------------------------------------------
-- Q7. Recursive CTE for forum reply hierarchy
-- Feature: nested thread view
-- ------------------------------------------------------------
SET @demo_thread_id := (
  SELECT dt.Thread_ID
  FROM Discussion_Thread dt
  WHERE EXISTS (
    SELECT 1
    FROM Discussion_Post dp
    WHERE dp.Thread_ID = dt.Thread_ID
      AND dp.Parent_post_ID IS NULL
      AND dp.Is_deleted = FALSE
  )
  AND EXISTS (
    SELECT 1
    FROM Discussion_Post dp2
    WHERE dp2.Thread_ID = dt.Thread_ID
      AND dp2.Parent_post_ID IS NOT NULL
      AND dp2.Is_deleted = FALSE
  )
  ORDER BY Thread_ID ASC
  LIMIT 1
);

WITH RECURSIVE post_tree AS (
  SELECT
    Post_ID,
    Thread_ID,
    Parent_post_ID,
    User_ID,
    Content,
    Created_at,
    0 AS depth,
    CAST(LPAD(Post_ID, 6, '0') AS CHAR(1000)) AS path
  FROM Discussion_Post
  WHERE Thread_ID = @demo_thread_id
    AND Parent_post_ID IS NULL

  UNION ALL

  SELECT
    c.Post_ID,
    c.Thread_ID,
    c.Parent_post_ID,
    c.User_ID,
    c.Content,
    c.Created_at,
    p.depth + 1 AS depth,
    CAST(CONCAT(p.path, '-', LPAD(c.Post_ID, 6, '0')) AS CHAR(1000)) AS path
  FROM Discussion_Post c
  JOIN post_tree p ON c.Parent_post_ID = p.Post_ID
)
SELECT
  pt.Post_ID,
  pt.depth,
  u.Name AS author,
  LEFT(pt.Content, 110) AS content_preview,
  pt.Created_at
FROM post_tree pt
JOIN User u ON u.User_ID = pt.User_ID
ORDER BY pt.path;

-- ------------------------------------------------------------
-- ADVANCED QUERIES
-- ------------------------------------------------------------

-- Q8. Trigger verification (auto thread creation)
-- Feature: guarantee each movie has a discussion thread
-- ------------------------------------------------------------
SELECT
  m.Movie_ID,
  m.Title,
  dt.Thread_ID,
  dt.Status,
  dt.Created_at
FROM Movie m
LEFT JOIN Discussion_Thread dt ON dt.Movie_ID = m.Movie_ID
ORDER BY m.Movie_ID;

-- ------------------------------------------------------------
-- Q9. Watchlist inventory by user
-- Feature: watchlist page summary
-- ------------------------------------------------------------
SELECT
  u.Name AS owner,
  wl.Watchlist_name,
  COUNT(wi.Movie_ID) AS item_count
FROM Watchlist wl
JOIN User u ON u.User_ID = wl.User_ID
LEFT JOIN Watchlist_Item wi ON wi.Watchlist_ID = wl.Watchlist_ID
GROUP BY u.Name, wl.Watchlist_name
ORDER BY owner, item_count DESC;

-- ------------------------------------------------------------
-- Q10. Admin queue (pending requests)
-- Feature: admin request approval screen
-- ------------------------------------------------------------
SELECT
  mr.Request_ID,
  mr.Requested_title,
  mr.Release_year,
  u.Name AS requested_by,
  mr.Requested_at
FROM Movie_Request mr
JOIN User u ON u.User_ID = mr.User_ID
ORDER BY mr.Requested_at DESC;
