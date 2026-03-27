const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' }); // load from server dir just in case, but assume path based on run

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'reviewroll',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('Starting migration...');
    
    // Check if Release_date exists in Movie
    const [cols] = await pool.query(`SHOW COLUMNS FROM Movie LIKE 'Release_date'`);
    if (cols.length === 0) {
      console.log('Adding new columns to Movie table...');
      await pool.query(`
        ALTER TABLE Movie 
        ADD COLUMN Release_date DATE DEFAULT NULL,
        ADD COLUMN Trailer_URL VARCHAR(500) DEFAULT NULL,
        ADD COLUMN Budget BIGINT DEFAULT 0,
        ADD COLUMN Revenue BIGINT DEFAULT 0,
        ADD COLUMN Trivia TEXT DEFAULT NULL
      `);
    }

    // Create Person table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Person (
          Person_ID INT AUTO_INCREMENT PRIMARY KEY,
          Name VARCHAR(200) NOT NULL,
          Biography TEXT DEFAULT NULL,
          Profile_Image_URL VARCHAR(500) DEFAULT NULL,
          Birth_date DATE DEFAULT NULL
      )
    `);

    // Create Movie_Cast table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Movie_Cast (
          Movie_ID INT NOT NULL,
          Person_ID INT NOT NULL,
          Character_name VARCHAR(200) DEFAULT NULL,
          Cast_order INT DEFAULT 0,
          PRIMARY KEY (Movie_ID, Person_ID),
          FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
          FOREIGN KEY (Person_ID) REFERENCES Person(Person_ID) ON DELETE CASCADE
      )
    `);

    // Create Movie_Crew table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Movie_Crew (
          Movie_ID INT NOT NULL,
          Person_ID INT NOT NULL,
          Job VARCHAR(100) NOT NULL,
          Department VARCHAR(100) NOT NULL,
          PRIMARY KEY (Movie_ID, Person_ID, Job),
          FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID) ON DELETE CASCADE,
          FOREIGN KEY (Person_ID) REFERENCES Person(Person_ID) ON DELETE CASCADE
      )
    `);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
