# ReviewRoll — Database Transactions Analysis

This document catalogues every database transaction in the ReviewRoll application,
covering standard (non-conflicting) transactions, conflicting transactions with their
resolutions, stored procedures, and trigger behaviour.

---

## 1. Transaction Overview

ReviewRoll uses **MySQL InnoDB** with the **SQLAlchemy** session layer in the
Flask backend. Every write operation is wrapped in an explicit transaction
(`START TRANSACTION` / `COMMIT` / `ROLLBACK`). SQLAlchemy's
`autocommit=False` setting means every session begins a transaction implicitly;
we issue `START TRANSACTION` explicitly for operations that require pessimistic
row locking (`SELECT ... FOR UPDATE`).

**Isolation level used:** `REPEATABLE READ` (MySQL InnoDB default), explicitly
set on sessions that perform locking reads.

---

## 2. Standard (Non-Conflicting) Transactions

These transactions involve a single write operation that cannot race with a
concurrent session. They use the standard `commit` / `rollback` pattern.

### 2.1 User Registration
**File:** `backend-flask/app/routes/auth.py` — `POST /api/auth/register`

**Operations:**
1. `SELECT User_ID FROM User WHERE Email = :email` — check for duplicate email.
2. `INSERT INTO User (Name, Email, Password_hash)` — create the account.
3. `COMMIT`

**Conflict risk:** None beyond what MySQL's `UNIQUE` constraint on `Email` already
enforces. If two registrations with the same email arrive simultaneously, the
second insert raises an integrity error caught by the `except` block → 409.

**Rollback condition:** Any exception during insert.

---

### 2.2 Submit Movie Request
**File:** `backend-flask/app/routes/requests.py` — `POST /api/requests`

**Operations:**
1. `INSERT INTO Movie_Request (Requested_title, Release_year, User_ID)`
2. `COMMIT`

**Conflict risk:** None. The `before_movie_request_insert` trigger (see §5)
atomically rejects a request if the requested title already exists in the `Movie`
table, so no application-level TOCTOU is possible.

**Rollback condition:** Trigger raises `SQLSTATE 45000` (duplicate rejection) or
any other exception.

---

### 2.3 Submit a Review
**File:** `backend-flask/app/routes/reviews.py` — `POST /api/reviews/<movie_id>`

**Operations:**
1. `INSERT INTO Review (Review_text, User_ID, Movie_ID)`
2. `SELECT` the inserted row to return it to the client.
3. `COMMIT`

**Conflict risk:** None. Reviews have no uniqueness constraint — a user can submit
multiple reviews, so concurrent inserts are valid behaviour.

**Rollback condition:** Any exception during insert or the follow-up select.

---

### 2.4 Delete a Review
**File:** `backend-flask/app/routes/reviews.py` — `DELETE /api/reviews/<review_id>`

**Operations:**
1. `SELECT * FROM Review WHERE Review_ID = :id` — verify existence and ownership.
2. `DELETE FROM Review WHERE Review_ID = :id`
3. `COMMIT`

**Conflict risk:** Minimal. The ownership check (`User_ID` or `ADMIN` role)
ensures only one actor can legitimately delete a given review.

**Rollback condition:** Any exception.

---

### 2.5 Create a Watchlist
**File:** `backend-flask/app/routes/watchlists.py` — `POST /api/watchlists`

**Operations:**
1. `INSERT INTO Watchlist (Watchlist_name, User_ID)`
2. `COMMIT`

**Conflict risk:** None. No uniqueness constraint on watchlist names — a user may
have multiple watchlists with the same name.

**Rollback condition:** Any exception.

---

### 2.6 Remove a Movie from a Watchlist
**File:** `backend-flask/app/routes/watchlists.py` — `DELETE /api/watchlists/<id>/movies/<movie_id>`

**Operations:**
1. `SELECT * FROM Watchlist WHERE Watchlist_ID = :id AND User_ID = :uid` — verify ownership.
2. `DELETE FROM Watchlist_Item WHERE Watchlist_ID = :id AND Movie_ID = :mid`
3. `COMMIT`

**Conflict risk:** None. Deleting a non-existent row in MySQL is a no-op (0 rows
affected) — the operation is naturally idempotent.

**Rollback condition:** Any exception.

---

### 2.7 Reject a Movie Request
**File:** `backend-flask/app/routes/admin.py` — `DELETE /api/admin/requests/<id>`

**Operations:**
1. `SELECT * FROM Movie_Request WHERE Request_ID = :id` — verify existence.
2. `DELETE FROM Movie_Request WHERE Request_ID = :id`
3. `COMMIT`

**Conflict risk:** Very low. If two admins reject simultaneously, the second gets
a 404 on the initial select — no data corruption.

**Rollback condition:** Any exception.

---

## 3. Conflicting Transactions

These are write operations where two concurrent sessions can legitimately race
over the same rows, causing data corruption without explicit locking. All three
are resolved using `SELECT ... FOR UPDATE` (pessimistic row locking) under
`REPEATABLE READ` isolation.

**Locking mechanism:**

```
Session A: START TRANSACTION
           SELECT ... FOR UPDATE   ← acquires row-level write lock
           (performs writes)
           COMMIT                  ← releases lock

Session B: START TRANSACTION
           SELECT ... FOR UPDATE   ← BLOCKS until A commits
           (re-reads updated state, handles conflict gracefully)
           COMMIT
```

---

### 3.1 Concurrent Movie Request Approval ⚡
**File:** `backend-flask/app/routes/admin.py` — `POST /api/admin/requests/<id>/approve`

**Conflict scenario:**
Two admins click "Approve" on the same movie request at the same millisecond.
Without locking, both sessions pass the duplicate-movie `SELECT` check and both
execute `INSERT INTO Movie` → **two identical movies in the catalogue**.

**Resolution:**

```python
session.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'))
session.execute(text('START TRANSACTION'))

# Row-level write lock on the request being approved.
# Session B BLOCKS here until Session A commits.
req_row = session.execute(
    text('SELECT * FROM Movie_Request WHERE Request_ID = :id FOR UPDATE'),
    {'request_id': request_id},
).mappings().first()
```

**What happens after the lock is released:**
- Session A: inserts the movie, deletes the request row, commits.
- Session B: re-reads `Movie_Request` → row is gone → returns **404 "Request not
  found or already approved by another admin"** → no duplicate inserted.

**Additional guard:** A second `SELECT Movie_ID FROM Movie WHERE LOWER(Title) = ...`
check inside the lock ensures that even a same-title request from a different
`Request_ID` cannot produce a duplicate.

**Rollback conditions:**
- Request row not found after lock (already approved) → explicit `ROLLBACK` + 404.
- Movie already exists in catalogue → explicit `ROLLBACK` + 409.
- Any SQL exception → `ROLLBACK` + 500.

---

### 3.2 Concurrent Rating Submission ⚡
**File:** `backend-flask/app/routes/ratings.py` — `POST /api/ratings/<movie_id>`

**Conflict scenario:**
A user double-clicks the star rating widget, or has two browser tabs open.
Two POST requests arrive simultaneously. Without locking, both sessions read
`SELECT Rating_ID ... WHERE User_ID = :uid AND Movie_ID = :mid` → both see no
existing row → both attempt `INSERT INTO Rating` →
**UNIQUE KEY `uq_user_movie_rating` violation → 500 crash**.

**Resolution:**

```python
session.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'))
session.execute(text('START TRANSACTION'))

# FOR UPDATE on a non-existent row acquires a next-key (gap) lock,
# preventing any concurrent INSERT into that key range.
existing = session.execute(
    text(
        'SELECT Rating_ID FROM Rating'
        ' WHERE User_ID = :user_id AND Movie_ID = :movie_id FOR UPDATE'
    ),
    {'user_id': user_id, 'movie_id': movie_id},
).mappings().first()
```

**What happens after the lock is released:**
- Session A: inserts the rating, commits.
- Session B: re-reads → finds the now-existing row → takes the `UPDATE` branch
  instead of `INSERT` → updates the rating value cleanly →
  **zero constraint violations**.

**Rollback conditions:**
- Any SQL exception → `ROLLBACK` + 500.

---

### 3.3 Concurrent Watchlist Movie Add ⚡
**File:** `backend-flask/app/routes/watchlists.py` — `POST /api/watchlists/<id>/movies`

**Conflict scenario:**
A user double-clicks the "Add to Watchlist" button before the first request
completes (common on mobile or slow networks). Two POST requests arrive
simultaneously. Both sessions pass the `SELECT 1 FROM Watchlist_Item` existence
check → both attempt `INSERT INTO Watchlist_Item` →
**PRIMARY KEY `(Watchlist_ID, Movie_ID)` violation → 500 crash**.

**Resolution:**

```python
session.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'))
session.execute(text('START TRANSACTION'))

# Lock the parent Watchlist row as a mutex for all operations on its items.
# Session B blocks here until Session A commits.
watchlist = session.execute(
    text(
        'SELECT * FROM Watchlist'
        ' WHERE Watchlist_ID = :watchlist_id AND User_ID = :user_id FOR UPDATE'
    ),
    {'watchlist_id': watchlist_id, 'user_id': user_id},
).mappings().first()

# Critical re-check INSIDE the lock — this is what prevents the duplicate.
existing = session.execute(
    text(
        'SELECT 1 FROM Watchlist_Item'
        ' WHERE Watchlist_ID = :watchlist_id AND Movie_ID = :movie_id LIMIT 1'
    ),
    {'watchlist_id': watchlist_id, 'movie_id': movie_id},
).mappings().first()
```

**What happens after the lock is released:**
- Session A: inserts the `Watchlist_Item`, commits.
- Session B: re-checks `Watchlist_Item` inside the lock → finds the row → returns
  **409 "This movie is already added to this watchlist"** →
  **zero primary key violations**.

**Rollback conditions:**
- Watchlist not found after lock → explicit `ROLLBACK` + 404.
- Item already exists → explicit `ROLLBACK` + 409.
- Any SQL exception → `ROLLBACK` + 500.

---

## 4. Stored Procedure Transactions

Three stored procedures in `db/schema.sql` manage complex multi-table inserts as
single atomic units. Each uses `START TRANSACTION` / `COMMIT` / `ROLLBACK` with
an `EXIT HANDLER FOR SQLEXCEPTION`.

### 4.1 `sp_approve_movie_request`
Atomically:
1. Checks for a duplicate movie (`Title` + `Release_year`).
2. Inserts the new `Movie` row.
3. Deletes the `Movie_Request` row.
4. `COMMIT` — or `ROLLBACK` + sets `OUT p_ErrorCode = 409` on duplicate.

**Why a stored procedure?** The insert and the request deletion must be atomic —
if the insert succeeds but the delete fails, the request would be approved twice.

---

### 4.2 `sp_add_manual_movie`
Atomically:
1. Duplicate check.
2. Inserts `Movie`.
3. Parses a comma-separated genre string and loops to `INSERT IGNORE INTO Genre` +
   `INSERT IGNORE INTO Movie_Genre` for each token.
4. `COMMIT` — or `ROLLBACK` + `OUT p_ErrorCode = 409/1`.

---

### 4.3 `sp_add_tmdb_movie`
Atomically:
1. Duplicate check.
2. Inserts `Movie`.
3. Loops over `p_GenresJSON` → inserts genres.
4. Loops over `p_CastJSON` → upserts `Person` + inserts `Movie_Cast`.
5. Loops over `p_CrewJSON` → upserts `Person` + inserts `Movie_Crew`.
6. `COMMIT` — or `ROLLBACK` + `OUT p_ErrorCode = 409/1`.

**Why atomic?** If cast import fails halfway through, the movie would exist with
partial or no cast data — a partial import is worse than no import.

---

## 5. Triggers

Triggers execute automatically within the same transaction as the DML statement
that fires them. They cannot be rolled back independently — if the trigger body
fails, the entire parent transaction rolls back.

### 5.1 `after_rating_insert`
**Event:** `AFTER INSERT ON Rating`
**Action:** Recalculates `Movie.Avg_rating` as `ROUND(AVG(Rating_value), 1)` for
the affected movie.
**Why a trigger?** Keeps `Avg_rating` perfectly in sync without requiring the
application layer to issue a second UPDATE after every rating insert.

---

### 5.2 `after_rating_update`
**Event:** `AFTER UPDATE ON Rating`
**Action:** Same recalculation as `after_rating_insert` for the affected movie.
**Why needed?** A user changing their rating from 5 → 9 requires a fresh average;
without this trigger the displayed rating would remain stale until the next new
rating was submitted.

---

### 5.3 `before_movie_request_insert`
**Event:** `BEFORE INSERT ON Movie_Request`
**Action:** Checks whether `LOWER(Title)` + `Release_year` already exist in the
`Movie` table. If found, raises `SIGNAL SQLSTATE '45000'` with the message
`'Duplicate movie request rejected.'`
**Why a trigger?** Prevents users from requesting movies that are already in the
catalogue, enforced at the database level regardless of what the application layer
does.

---

### 5.4 `after_movie_insert`
**Event:** `AFTER INSERT ON Movie`
**Action:** `INSERT INTO Discussion_Thread (Movie_ID, Genre_ID, Status) VALUES (NEW.Movie_ID, NULL, 'OPEN')`
**Why a trigger?** Every new movie automatically gets a discussion thread — no
admin setup required, and it cannot be forgotten by the application layer.

---

### 5.5 `after_genre_insert`
**Event:** `AFTER INSERT ON Genre`
**Action:** `INSERT INTO Discussion_Thread (Movie_ID, Genre_ID, Status) VALUES (NULL, NEW.Genre_ID, 'OPEN')`
**Why a trigger?** Every new genre automatically gets a genre-wide discussion thread.

---

## 6. Conflict Demo Script

A standalone SQL demonstration of all three conflicting transaction scenarios
is located at:

```
db/transactions_conflict_demo.sql
```

Run it in **two separate MySQL terminal sessions** to observe the `FOR UPDATE`
blocking behaviour live. Each scenario is labelled `[A-1]`, `[B-1]` etc.

---

## 7. ACID Properties — Summary

| Property | How ReviewRoll achieves it |
|---|---|
| **Atomicity** | Every write endpoint uses `COMMIT` / `ROLLBACK`. Stored procedures use `EXIT HANDLER FOR SQLEXCEPTION` to roll back on any error. |
| **Consistency** | `CHECK` constraints (Rating 1–10), `UNIQUE` keys (Email, Genre_name), `NOT NULL` constraints, `ON DELETE CASCADE` foreign keys, and triggers enforce business rules at the DB level. |
| **Isolation** | `REPEATABLE READ` isolation on all conflicting transactions; `SELECT ... FOR UPDATE` prevents phantom reads and lost updates on contested rows. |
| **Durability** | InnoDB's write-ahead log (WAL/redo log) ensures committed transactions survive crashes. |
