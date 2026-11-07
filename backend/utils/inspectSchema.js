require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [columns] = await connection.execute(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA, EXTRA
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [process.env.DB_NAME]
    );
    const [foreignKeys] = await connection.execute(
      `SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY TABLE_NAME, COLUMN_NAME`,
      [process.env.DB_NAME]
    );

    const requestedTables = process.argv.slice(2);
    const tableNames = [...new Set(columns.map((column) => column.TABLE_NAME))]
      .filter((tableName) => !requestedTables.length || requestedTables.includes(tableName));
    for (const tableName of tableNames) {
      const tableColumns = columns
        .filter((column) => column.TABLE_NAME === tableName)
        .map(({ COLUMN_NAME, COLUMN_TYPE, COLUMN_KEY, IS_NULLABLE, COLUMN_DEFAULT, EXTRA }) => (
          `${COLUMN_NAME}:${COLUMN_TYPE}${COLUMN_KEY ? `(${COLUMN_KEY})` : ''}${IS_NULLABLE === 'NO' && COLUMN_DEFAULT === null && !EXTRA.includes('auto_increment') ? '!' : ''}`
        ));
      const tableKeys = foreignKeys
        .filter((key) => key.TABLE_NAME === tableName)
        .map(({ COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME }) => (
          `${COLUMN_NAME}->${REFERENCED_TABLE_NAME}.${REFERENCED_COLUMN_NAME}`
        ));
      console.log(`${tableName} | ${tableColumns.join(', ')}${tableKeys.length ? ` | FK ${tableKeys.join(', ')}` : ''}`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Schema inspection failed: ${error.code || error.message}`);
  process.exitCode = 1;
});
