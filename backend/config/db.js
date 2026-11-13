const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'your_mysql_username',
  password: process.env.DB_PASSWORD || 'your_mysql_password',
  database: process.env.DB_NAME || 'brandguard_ai_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const isConfigured = dbConfig.user !== 'your_mysql_username' && dbConfig.password !== 'your_mysql_password';

const pool = isConfigured ? mysql.createPool(dbConfig) : null;

const query = async (sql, params = []) => {
  if (!pool) {
    throw new Error('MySQL is not configured. Update backend/.env with real credentials.');
  }

  const [rows] = await pool.execute(sql, params);
  return rows;
};

const withTransaction = async (work) => {
  if (!pool) {
    throw new Error('MySQL is not configured. Update backend/.env with real credentials.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = { pool, query, withTransaction, isConfigured };
