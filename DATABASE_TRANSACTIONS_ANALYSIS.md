# MySQL Schema Evaluation Report

## 1. Schema Compatibility
**Severity: High**
There are massive incompatibilities between the provided `schema.sql` and the Node.js backend. 

- **Argument Mismatches in Stored Procedures:** The Node.js application passes up to 14 arguments to these stored procedures (e.g., `sp_add_tmdb_movie(Title, Year, Language, Duration, Description, Image_URL, Budget, Revenue, Release_date, Trailer_URL, Trivia, GenresJSON, CastJSON, CrewJSON, out_movie_id, out_error_code)`). Your new stored procedures only accept 2 or 3 arguments (`p_Title`, `p_Year`, `p_Genres`). Any backend call to these procedures will result in a fatal `Incorrect number of arguments` SQL error.
- **Missing `OUT` Parameters:** The Javascript routes rely heavily on retrieving output variables. For example, the code explicitly performs: `SELECT @out_movie_id AS movieId, @out_error_code AS errorCode`. Since your new stored procedures no longer declare or assign `OUT` parameters, the backend will receive `null` values for `errorCode` and fail silently or crash later when expecting a `movieId`.
- **Missing Columns in procedures:** Important fields like `Language`, `Duration`, `Description`, `Image_URL`, etc., are completely ignored by the stored procedures during insertion.

## 2. Transaction Correctness
**Severity: High**

- **Loss of Transactional Output:** While `START TRANSACTION`, `COMMIT`, and `ROLLBACK` are syntactically present, the actual transaction control flow is broken because failure states are no longer communicated to the backend. In `sp_approve_movie_request`, if `v_dup > 0`, you simply `ROLLBACK;` but don't set an HTTP-friendly error code or `OUT` parameter. The backend route will act as if the transaction miraculously succeeded and return a `201 OK` or a `200 OK` despite no data being inserted. 
- **Missing Transactions:** The `sp_add_manual_movie` no longer checks for movie duplication before inserting, which will lead to duplicate movies sharing the same Title/Year. 
- **Array Parsing Logic Gutted:** `sp_add_manual_movie` attempts to insert `p_Genres` as a single literal string. If the user passes `"Action, Sci-Fi"`, the database will create a literal genre called `"Action, Sci-Fi"`, rather than splitting it and looping over it. 

## 3. Trigger Behavior
**Severity: High**

- **Missing Triggers:** You removed `after_movie_insert` and `after_genre_insert`. The application originally relied on these to automatically insert records into `Discussion_Thread`. Without them, the forum features on your web app will encounter `404 Not Found` or `null` reference errors when users try to visit discussion boards for newly added movies.
- **Removed Update Trigger:** The `after_rating_update` trigger was deleted. If a user changes their rating from 5 to 10, the application will no longer recalculate the movie's `Avg_rating`.

## 4. Data Integrity & Constraints
**Severity: High**

- **Missing `ON DELETE CASCADE`:** Almost all `FOREIGN KEY` constraints are missing their `ON DELETE CASCADE` declarations (e.g., in `Movie_Crew`, `Rating`, `Review`, `Watchlist`). MySQL defaults to `ON DELETE RESTRICT`. Because of this, it will be impossible to delete a Movie or a User from the platform if they have left a rating or review, leading to fatal backend constraint errors.
- **Removed `NOT NULL` Constraints:** You removed `NOT NULL` from columns across the board (like `Release_date`, `User_ID`, `Movie_ID`). This makes it possible to insert orphaned reviews or ratings that point to absolutely nothing.

## 5. Concurrency & Consistency
**Severity: Medium**

- **Race Conditions (TOCTOU):** The duplicate checking mechanism in `sp_approve_movie_request` uses a `SELECT COUNT(*)` followed by an `INSERT`. Under heavy load or concurrent requests, two transactions could pass the `SELECT` check simultaneously and insert duplicate rows. Since `(Title, Release_year)` lacks a strict `UNIQUE` constraint, both rows will perfectly save. You need either a `SELECT ... FOR UPDATE` or a composite `UNIQUE` index.  

## 6. Performance & Design Issues
**Severity: Medium**

- **Missing Indexes:** The `INDEX idx_movie_title (Title)` was removed from the `Movie` table. The backend performs many text-based `SELECT` searches using `LOWER(Title)`, which will now require full table scans instead of efficient index lookups. This will severely degrade performance as the catalog grows.
- **Incomplete TMDB Data:** By removing the JSON logic inside `sp_add_tmdb_movie`, you are dropping all metadata about Cast and Crew. 

## 7. Final Verdict

**Production Ready?** No.
**Transactions Correctly Implemented?** No. 

**Critical Issues to Fix immediately:**
1. **Restore Procedure Parameters:** Add all 14 `IN` and `OUT` parameters back to your SPs so the backend doesn't crash from argument mismatches.
2. **Restore Cascading Deletes:** Put `ON DELETE CASCADE` back on all foreign keys linking to `User` and `Movie`.
3. **Restore Triggers:** Return the automatic `Discussion_Thread` triggers and the Rating Update trigger.
4. **Restore Iteration Logic:** Reimplement the comma-parser for `sp_add_manual_movie` and the `JSON_EXTRACT` loop for `sp_add_tmdb_movie`.
