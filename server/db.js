const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';

let sslConfig;
if (useSsl) {
  const caPath = process.env.DB_SSL_CA_PATH;
  if (caPath && fs.existsSync(caPath)) {
    sslConfig = {
      ca: fs.readFileSync(caPath, 'utf8'),
      rejectUnauthorized
    };
  } else {
    sslConfig = { rejectUnauthorized };
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'reviewroll',
  port: Number(process.env.DB_PORT) || 3306,
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
