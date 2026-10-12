// MySQL connection pool (credentials from env — never hardcode).
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'fixmate',
  password: process.env.DB_PASSWORD || 'fixmate_pass',
  database: process.env.DB_NAME || 'fixmate',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  decimalNumbers: true
});

module.exports = pool;
