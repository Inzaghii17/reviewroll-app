# ReviewRoll Database Transactions & Triggers Analysis

## Executive Summary
- **Total Transactions Found**: 7 explicit transactions + 5 database triggers
- **Contradictions Found**: 3 critical issues identified
- **Status**: ⚠️ Issues need resolution before production

---

## 📋 PART 1: DATABASE TRANSACTIONS (Server-Level)

### Transaction 1: TMDB Auto-Fetch Movie (`server/routes/tmdb.js`)
**Type**: Multi-step transaction with validation\
**Scope**: TMDB API lookup + Movie insertion\
**Status**: ✅ Properly implemented with rollback

**Steps**:
1. Fetch movie from TMDB API
2. BEGIN TRANSACTION
3. Check for duplicate movie (by title + year)
4. IF duplicate → ROLLBACK with error
5. INSERT Movie record
6. INSERT Genres (loop)
7. INSERT Crew (loop)
8. INSERT Cast (loop)
9. COMMIT

**Rollback Condition**: 
- Duplicate movie detection
- Any database error

**Implementation Quality**: ✅ Good
```javascript
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  // ... multiple operations ...
  await conn.commit();
} catch (err) {
  await conn.rollback();
} finally {
  conn.release();
}
```

---

### Transaction 2: Admin Approve Movie Request (`server/routes/admin.js`)
**Type**: Multi-step transaction with optional TMDB fetch\
**Scope**: Movie addition with request deletion\
**Status**: ✅ Properly implemented

**Steps**:
1. Validate movie request exists
2. Optional: Fetch from TMDB
3. BEGIN TRANSACTION
4. Check for duplicate movie
5. IF duplicate → ROLLBACK with 409 error
6. INSERT Movie record
7. DELETE Movie_Request record
8. COMMIT
9. Return success

**Rollback Condition**: Duplicate detection or any error

**Implementation Quality**: ✅ Excellent
```javascript
await conn.beginTransaction();
const [[existing]] = await conn.query(...);
if (existing) {
  await conn.rollback();
  return res.status(409).json({ error: ... });
}
// ... insert and delete ...
await conn.commit();
```

---

### Transaction 3: Admin Direct Add Movie (`server/routes/admin.js`)
**Type**: Multi-step transaction with genre linking\
**Scope**: Movie insertion with genre management\
**Status**: ✅ Properly implemented

**Steps**:
1. Validate input (title, year, duration)
2. Handle image upload
3. BEGIN TRANSACTION
4. Check for duplicate movie
5. IF duplicate → ROLLBACK with 400 error
6. INSERT Movie record
7. INSERT/LINK Genres (loop)
8. COMMIT

**Rollback Condition**: Duplicate detection or any error

---

### Transaction 4: Rating Upsert (`server/routes/ratings.js`)
**Type**: Two separate queries (NOT a transaction)\
**Scope**: Rating insertion or update\
**Status**: ⚠️ ISSUE #1 - Race condition vulnerability

**Problem**:
```javascript
// Two separate queries - NOT atomic
const [existing] = await pool.query('SELECT Rating_ID FROM Rating WHERE ...');
if (existing.length > 0) {
  await pool.query('UPDATE Rating SET ...');
} else {
  await pool.query('INSERT INTO Rating ...');
}
```

**Risk**: Two users could both think they need to INSERT simultaneously
- User A checks: no rating exists
- User B checks: no rating exists (at same time)
- Both INSERT → Unique constraint violation
- Error not caught properly

**Contradicting with**: Database UNIQUE constraint `uq_user_movie_rating`

---

### Transaction 5: Movie Request Creation (`server/routes/requests.js`)
**Type**: Single query with trigger validation\
**Scope**: Movie request insertion\
**Status**: ⚠️ ISSUE #2 - Transaction on trigger side

**Implementation**:
```javascript
const [result] = await pool.query(
  'INSERT INTO Movie_Request (Requested_title, Release_year, User_ID) VALUES (?, ?, ?)',
  [title.trim(), releaseYear, req.user.id]
);
```

**Trigger Validation**: `before_movie_request_insert` trigger checks:
- Does movie already exist? If YES → REJECT with SIGNAL SQLSTATE '45000'

**Issue**: 
- Error handling catches trigger error correctly
- But IF there's a race condition between checking and inserting, it won't be caught
- No explicit transaction wrapping

---

### Transaction 6: Add to Watchlist (`server/routes/watchlists.js`)
**Type**: Single query (NOT a transaction)\
**Scope**: Watchlist item insertion\
**Status**: ✅ SAFE but could be audited

**Implementation**:
```javascript
const [existing] = await pool.query('SELECT 1 FROM Watchlist_Item WHERE ...');
if (existing.length > 0) {
  return res.status(409).json({ error: 'already added' });
}
await pool.query('INSERT INTO Watchlist_Item (Watchlist_ID, Movie_ID) VALUES (?, ?)');
```

**Race Condition Risk**: Same as Transaction 4
- User A checks: movie not in watchlist
- User B checks: movie not in watchlist (at same time)
- Both INSERT → Potential duplicate despite check

---

### Transaction 7: Watchlist Removal (`server/routes/watchlists.js`)
**Type**: Single query (atomic)\
**Scope**: Direct deletion\
**Status**: ✅ SAFE (no race condition possible)

---

## 🔗 PART 2: DATABASE TRIGGERS (Auto-transactions)

### Trigger 1: `after_rating_insert` ✅
**Event**: After INSERT on Rating table\
**Action**: Auto-update Movie.Avg_rating\
**Type**: AFTER INSERT trigger

**Logic**:
```sql
UPDATE Movie
SET Avg_rating = (
  SELECT ROUND(AVG(Rating_value), 1)
  FROM Rating
  WHERE Movie_ID = NEW.Movie_ID
)
WHERE Movie_ID = NEW.Movie_ID;
```

**Issue**: Runs AFTER every rating insert
- High database load if many ratings inserted
- Could cause performance issues at scale

---

### Trigger 2: `after_rating_update` ✅
**Event**: After UPDATE on Rating table\
**Action**: Auto-update Movie.Avg_rating\
**Type**: AFTER UPDATE trigger

Same as Trigger 1 but for updates.

---

### Trigger 3: `before_movie_request_insert` ✅
**Event**: Before INSERT on Movie_Request table\
**Action**: Reject duplicate movie requests\
**Type**: BEFORE INSERT trigger

**Logic**:
```sql
DECLARE movie_exists INT DEFAULT 0;
SELECT COUNT(*) INTO movie_exists
FROM Movie
WHERE LOWER(Title) = LOWER(NEW.Requested_title)
  AND Release_year = NEW.Release_year;
IF movie_exists > 0 THEN
  SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'Movie already exists...';
END IF;
```

**Protection**: Prevents requesting movies already in database ✅
**Contradiction with**: Transaction 4 (same check happens in application)

---

### Trigger 4: `after_movie_insert` ✅
**Event**: After INSERT on Movie table\
**Action**: Auto-create Discussion_Thread\
**Type**: AFTER INSERT trigger

**Logic**:
```sql
INSERT INTO Discussion_Thread (Movie_ID, Genre_ID, Status)
VALUES (NEW.Movie_ID, NULL, 'OPEN');
```

**Purpose**: Every new movie gets a discussion thread
**Performance**: Minimal impact (one insert per movie)

---

### Trigger 5: `after_genre_insert` ✅
**Event**: After INSERT on Genre table\
**Action**: Auto-create Discussion_Thread\
**Type**: AFTER INSERT trigger

**Logic**:
```sql
INSERT INTO Discussion_Thread (Movie_ID, Genre_ID, Status)
VALUES (NULL, NEW.Genre_ID, 'OPEN');
```

**Purpose**: Every new genre gets a discussion thread
**Performance**: Minimal impact

---

## ⚠️ PART 3: CONTRADICTIONS & ISSUES

### ⛔ ISSUE #1: Race Condition in Rating Upsert
**Location**: `server/routes/ratings.js` line 9-20\
**Severity**: HIGH\
**Type**: Race condition with UNIQUE constraint

**Problem**:
```javascript
// NOT ATOMIC - can fail with race condition
const [existing] = await pool.query('SELECT ... WHERE User_ID = ? AND Movie_ID = ?');
if (existing.length > 0) {
  await pool.query('UPDATE Rating SET ...');
} else {
  await pool.query('INSERT INTO Rating ...'); // Can violate UNIQUE constraint
}
```

**Scenario**:
1. User rates movie with 8 stars
2. Exactly at same time, another rate attempt comes in
3. Both queries see no existing rating
4. Both try to INSERT
5. Second one fails: "Duplicate entry for unique constraint"

**Fix Option 1: Use ON DUPLICATE KEY UPDATE**
```javascript
// Single atomic query
await pool.query(
  `INSERT INTO Rating (Rating_value, User_ID, Movie_ID) VALUES (?, ?, ?)
   ON DUPLICATE KEY UPDATE Rating_value = VALUES(Rating_value)`,
  [rating, userId, movieId]
);
```

**Fix Option 2: Use Transaction**
```javascript
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  const [existing] = await conn.query('SELECT Rating_ID FROM Rating WHERE USER_ID = ? AND Movie_ID = ?');
  if (existing.length > 0) {
    await conn.query('UPDATE Rating SET ...');
  } else {
    await conn.query('INSERT INTO Rating ...');
  }
  await conn.commit();
} finally {
  conn.release();
}
```

---

### ⛔ ISSUE #2: Duplicate Validation Contradiction
**Location**: Trigger 3 + `server/routes/requests.js`\
**Severity**: MEDIUM\
**Type**: Redundant validation in two places

**Problem**:
Database has a TRIGGER that rejects duplicate movie requests:
```sql
-- In database
CREATE TRIGGER before_movie_request_insert
IF movie_exists > 0 THEN SIGNAL ... END IF;
```

Application also checks same thing:
```javascript
// In Express (NOT in current code but should be)
// Actually application doesn't check - relies solely on trigger
```

**Contradiction**: 
- Trigger prevents duplicate at database level ✅
- Application doesn't have explicit transaction for this ⚠️
- If trigger fails, error handling is correct but not optimal

**Current Error Handling**:
```javascript
catch (err) {
  if (err.sqlState === '45000') {
    return res.status(409).json({ error: err.message });
  }
  // ...
}
```

**Status**: ✅ Acceptable, but could be cleaner

---

### ⛔ ISSUE #3: Watchlist Duplicate Race Condition
**Location**: `server/routes/watchlists.js` line 73-88\
**Severity**: MEDIUM\
**Type**: Race condition similar to Issue #1

**Problem**:
```javascript
// NOT ATOMIC
const [existing] = await pool.query('SELECT 1 FROM Watchlist_Item WHERE ...');
if (existing.length > 0) {
  return res.status(409).json({ error: 'already added' });
}
await pool.query('INSERT INTO Watchlist_Item (Watchlist_ID, Movie_ID) VALUES (?, ?)');
```

**Scenario**:
1. User clicks "Add to Watchlist" twice quickly
2. First query sees movie not in watchlist
3. Second query sees movie not in watchlist (at same time)
4. Both try INSERT
5. Both fail or one succeeds with duplicate

**Fix**: 
```javascript
await pool.query(
  `INSERT IGNORE INTO Watchlist_Item (Watchlist_ID, Movie_ID) VALUES (?, ?)`,
  [watchlistId, movieId]
);
// Returns success even if already exists (IGNORE clause)
```

---

## ✅ PART 4: SECURE TRANSACTIONS

### ✅ Transaction 1: TMDB Auto-Fetch Movie
- **Status**: Properly implemented ✅
- **Rollback**: Duplicate detection ✅
- **Error handling**: Good ✅
- **No contradictions**: ✅

### ✅ Transaction 2: Admin Approve Request
- **Status**: Properly implemented ✅
- **Rollback**: Duplicate detection ✅
- **Error handling**: Excellent ✅
- **Atomic**: Movie add + Request delete in one transaction ✅

### ✅ Transaction 3: Admin Direct Add Movie
- **Status**: Properly implemented ✅
- **Rollback**: Duplicate detection ✅
- **Error handling**: Good ✅

---

## 📊 SUMMARY TABLE

| # | Location | Type | Status | Issue |
|---|----------|------|--------|-------|
| 1 | tmdb.js | Transaction | ✅ Good | None |
| 2 | admin.js (approve) | Transaction | ✅ Good | None |
| 3 | admin.js (add) | Transaction | ✅ Good | None |
| 4 | ratings.js | Upsert | ⚠️ Issue | Race condition #1 |
| 5 | requests.js | Trigger | ✅ Good | Handled |
| 6 | watchlists.js (add) | Insert | ⚠️ Issue | Race condition #3 |
| 7 | watchlists.js (remove) | Delete | ✅ Safe | None |
| T1 | Schema: Rating insert | Trigger | ✅ Good | High DB load at scale |
| T2 | Schema: Rating update | Trigger | ✅ Good | High DB load at scale |
| T3 | Schema: Request check | Trigger | ✅ Good | Works with app |
| T4 | Schema: Movie thread | Trigger | ✅ Good | None |
| T5 | Schema: Genre thread | Trigger | ✅ Good | None |

---

## 🔧 RECOMMENDED FIXES

### Priority 1 (HIGH) - Fix Before Deployment

**Fix Issue #1: Rating Race Condition**\
File: `server/routes/ratings.js`

Replace SELECT-IF-INSERT logic with atomic query:
```javascript
// OLD (race condition):
const [existing] = await pool.query('SELECT Rating_ID FROM Rating WHERE ...');
if (existing.length > 0) {
  await pool.query('UPDATE Rating SET ...');
} else {
  await pool.query('INSERT INTO Rating ...');
}

// NEW (atomic):
await pool.query(
  `INSERT INTO Rating (Rating_value, User_ID, Movie_ID) VALUES (?, ?, ?)
   ON DUPLICATE KEY UPDATE Rating_value = VALUES(Rating_value)`,
  [rating, req.user.id, movieId]
);
```

**Fix Issue #3: Watchlist Duplicate**\
File: `server/routes/watchlists.js`

Replace SELECT-IF-INSERT with INSERT IGNORE:
```javascript
// OLD (race condition):
const [existing] = await pool.query('SELECT 1 FROM Watchlist_Item WHERE ...');
if (existing.length > 0) {
  return res.status(409).json({ error: 'already added' });
}
await pool.query('INSERT INTO Watchlist_Item ...');

// NEW (safe):
await pool.query(
  `INSERT IGNORE INTO Watchlist_Item (Watchlist_ID, Movie_ID) VALUES (?, ?)`,
  [req.params.id, movieId]
);
res.json({ message: 'Movie added to watchlist' });
```

### Priority 2 (MEDIUM) - Performance Optimization

**Optimize Trigger Performance**\
Triggers 1 & 2 recalculate average for every rating:

Consider:
- Add caching layer (Redis) for average ratings
- Or batch update averages periodically
- Current implementation is safe but can be slow with many ratings

---

## 🎯 FINAL VERDICT

**Current State**: ⚠️ **PARTIALLY SAFE**
- 3 out of 7 transactions are properly implemented
- 2 critical race conditions found
- 5 database triggers properly configured

**Before Deployment**:
- ✅ Fix Issue #1 (Rating race condition)
- ✅ Fix Issue #3 (Watchlist race condition)
- ✅ Test thoroughly with concurrent requests
- ⚠️ Consider performance optimization for triggers

**After Fixes**: Production Ready ✅
