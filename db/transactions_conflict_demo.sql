-- ============================================================
-- ReviewRoll — CONFLICTING TRANSACTIONS DEMO
-- ============================================================
-- PURPOSE: Demonstrate concurrency conflict handling at the
--          database level, matching Task 6 of the project.
--
-- HOW TO RUN:
--   Open TWO separate MySQL terminal connections to the
--   `reviewroll` database. Run steps labelled [A] in the
--   first terminal and steps labelled [B] in the second,
--   in the exact order shown. Observe how Session B BLOCKS
--   on the FOR UPDATE lock and resolves cleanly after A commits.
-- ============================================================

USE reviewroll;

-- ============================================================
-- SCENARIO 1: Concurrent Movie Request Approval
-- ============================================================
-- Setup: assume a movie request with Request_ID = 1 exists.
-- Two admins click "Approve" at the same time.
--
-- WITHOUT locking: both pass the duplicate check → two
--   identical rows inserted into Movie.
-- WITH FOR UPDATE: Session B blocks on the lock → after A
--   deletes the request and commits, B finds no row → returns
--   "not found" → zero duplicates.
-- ============================================================

-- [SETUP] Insert a sample request if none exists
INSERT IGNORE INTO Movie_Request (Request_ID, Requested_title, Release_year, User_ID)
VALUES (999, 'Interstellar', 2014, 1);

-- ── Session A ────────────────────────────────────────────────
-- [A-1] Start transaction and lock the request row
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT * FROM Movie_Request WHERE Request_ID = 999 FOR UPDATE;
-- ← Session B will BLOCK at its equivalent SELECT FOR UPDATE
--   until A commits or rolls back.

-- [A-2] Verify movie does not already exist, then insert
SELECT Movie_ID FROM Movie WHERE LOWER(Title) = 'interstellar' AND Release_year = 2014;
-- (returns 0 rows — safe to insert)

INSERT INTO Movie (Title, Release_year, Language, Duration, Description)
VALUES ('Interstellar', 2014, 'en', 169, 'A team of explorers travel through a wormhole.');

DELETE FROM Movie_Request WHERE Request_ID = 999;

-- [A-3] Commit — this releases the FOR UPDATE lock
COMMIT;
-- ← Session B unblocks NOW

-- ── Session B ────────────────────────────────────────────────
-- [B-1] Start transaction and attempt to lock the SAME row
--       (Run this BEFORE A-3 to see the blocking effect)
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT * FROM Movie_Request WHERE Request_ID = 999 FOR UPDATE;
-- ★ BLOCKS here until Session A commits ★
-- After A commits: this returns EMPTY SET (row was deleted)

-- [B-2] No row returned → rollback and surface a 404
ROLLBACK;
-- Result: only ONE movie inserted, zero duplicates ✓


-- ============================================================
-- SCENARIO 2: Concurrent Rating Submission (same user, same movie)
-- ============================================================
-- Setup: User 1 rates Movie 1 from two browser tabs simultaneously.
--
-- WITHOUT locking: both tabs see no existing rating → both
--   INSERT → UNIQUE KEY (User_ID, Movie_ID) violation.
-- WITH FOR UPDATE: Session B blocks → after A inserts and
--   commits, B finds the row and takes the UPDATE path → no crash.
-- ============================================================

-- [SETUP] Ensure no existing rating for this user+movie pair
DELETE FROM Rating WHERE User_ID = 1 AND Movie_ID = 1;

-- ── Session A ────────────────────────────────────────────────
-- [A-1] Lock the rating row (or gap if not yet existing)
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT Rating_ID FROM Rating WHERE User_ID = 1 AND Movie_ID = 1 FOR UPDATE;
-- Returns empty — no existing rating. Gap lock acquired.

-- [A-2] Insert the rating
INSERT INTO Rating (Rating_value, User_ID, Movie_ID) VALUES (8, 1, 1);

-- [A-3] Commit
COMMIT;

-- ── Session B ────────────────────────────────────────────────
-- [B-1] Attempt to lock the same row
--       (Run BEFORE A-3 to observe blocking)
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT Rating_ID FROM Rating WHERE User_ID = 1 AND Movie_ID = 1 FOR UPDATE;
-- ★ BLOCKS until A commits ★
-- After A commits: returns Rating_ID = <new id> (row now exists)

-- [B-2] Row exists → UPDATE instead of INSERT
UPDATE Rating SET Rating_value = 9 WHERE User_ID = 1 AND Movie_ID = 1;

COMMIT;
-- Result: one clean row with Rating_value = 9, no constraint error ✓


-- ============================================================
-- SCENARIO 3: Concurrent Watchlist Add (double-click)
-- ============================================================
-- Setup: User 1 double-clicks "Add to Watchlist" for Movie 1.
--
-- WITHOUT locking: both requests see no Watchlist_Item row →
--   both INSERT → PRIMARY KEY (Watchlist_ID, Movie_ID) crash.
-- WITH FOR UPDATE on Watchlist: Session B blocks → after A
--   inserts the item, B re-checks, finds it, returns 409.
-- ============================================================

-- [SETUP] Ensure a watchlist exists and the item is not there
INSERT IGNORE INTO Watchlist (Watchlist_ID, Watchlist_name, User_ID) VALUES (1, 'Favourites', 1);
DELETE FROM Watchlist_Item WHERE Watchlist_ID = 1 AND Movie_ID = 1;

-- ── Session A ────────────────────────────────────────────────
-- [A-1] Lock the parent Watchlist row (acts as a mutex)
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT * FROM Watchlist WHERE Watchlist_ID = 1 AND User_ID = 1 FOR UPDATE;

-- [A-2] Check item doesn't exist, then insert
SELECT 1 FROM Watchlist_Item WHERE Watchlist_ID = 1 AND Movie_ID = 1 LIMIT 1;
-- Returns empty — safe to insert
INSERT INTO Watchlist_Item (Watchlist_ID, Movie_ID) VALUES (1, 1);

-- [A-3] Commit
COMMIT;

-- ── Session B ────────────────────────────────────────────────
-- [B-1] Attempt to lock the SAME Watchlist row
--       (Run BEFORE A-3)
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT * FROM Watchlist WHERE Watchlist_ID = 1 AND User_ID = 1 FOR UPDATE;
-- ★ BLOCKS until A commits ★

-- [B-2] After unblocking: re-check item (now exists)
SELECT 1 FROM Watchlist_Item WHERE Watchlist_ID = 1 AND Movie_ID = 1 LIMIT 1;
-- Returns 1 row → conflict detected → surface 409

ROLLBACK;
-- Result: exactly one Watchlist_Item row, no PK violation ✓


-- ============================================================
-- EXPECTED OUTCOMES SUMMARY
-- ============================================================
-- Scenario 1: Only 1 Movie row inserted for 'Interstellar'
-- Scenario 2: Only 1 Rating row; final value = last committed update
-- Scenario 3: Only 1 Watchlist_Item row; duplicate gracefully rejected
--
-- All three demonstrate:
--   • Atomicity  — partial work is rolled back on conflict
--   • Isolation  — concurrent sessions do not observe each other's
--                  uncommitted writes (REPEATABLE READ)
--   • Consistency — business rules (no duplicates) are upheld
--                   even under concurrent load
-- ============================================================
