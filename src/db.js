const sql = require('mssql');
const config = require('./config');

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config.db);
  }
  return pool;
}

async function loadSchema() {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT TABLE_NAME, COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );
  const schema = {};
  for (const row of result.recordset) {
    if (!schema[row.TABLE_NAME]) schema[row.TABLE_NAME] = [];
    schema[row.TABLE_NAME].push(row.COLUMN_NAME);
  }
  return schema;
}

async function getPrimaryKey(table) {
  const pool = await getPool();
  const result = await pool.request()
    .input('table', sql.NVarChar, table)
    .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
             WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + QUOTENAME(CONSTRAINT_NAME)), 'IsPrimaryKey') = 1
               AND TABLE_NAME = @table`);
  return result.recordset[0] && result.recordset[0].COLUMN_NAME;
}

module.exports = {
  getPool,
  loadSchema,
  getPrimaryKey,
};
