# ReviewRoll (Node/Express Localhost)

ReviewRoll is a movie discovery and community website running on:
- Node.js + Express backend
- Vanilla JS frontend from `public/`
- MySQL database

This repository has been cleaned to keep only the localhost website stack and Task 4 SQL demo queries.

## Project Structure

- `server/` - Express app, routes, middleware, DB connection, admin seeding
- `public/` - Static frontend (HTML/CSS/JS)
- `db/schema.sql` - Database schema, triggers, and stored procedures
- `db/task4_query_demo.sql` - 10 Task 4 queries (4 basic, 3 intermediate, 3 advanced)

## Local Setup

1. Create `.env` from `.env.example` and update values:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=reviewroll
JWT_SECRET=replace_me_with_a_long_random_secret
PORT=3000
```

2. Install dependencies:

```bash
npm install
```

3. Import database schema:

PowerShell:

```powershell
Get-Content .\db\schema.sql | mysql -u root -p
```

4. Start the app:

```bash
npm start
```

5. Open:
- Website: `http://localhost:3000`
- API health: `http://localhost:3000/api/health`

## Default Admin User

Admin is auto-seeded when the server starts.

- Email: `admin@reviewroll.com`
- Password: `admin123`

## Task 4 SQL Queries

Run the Task 4 query file:

```powershell
Get-Content .\db\task4_query_demo.sql | mysql -u root -p
```

Query set includes:
- 4 basic queries
- 3 intermediate queries
- 3 advanced queries
