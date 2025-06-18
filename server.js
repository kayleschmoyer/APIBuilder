const express = require('express');
const sql = require('mssql');
const app = express();

app.use(express.json());

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'your_password',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'master',
  options: {
    trustServerCertificate: true,
  },
};

function sanitizeIdentifier(name) {
  if (!/^\w+$/.test(name)) {
    throw new Error('Unsafe identifier: ' + name);
  }
  return name;
}

async function createCrudRoutes(app, table) {
  const tableSafe = sanitizeIdentifier(table);
  const pkQuery = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE ` +
    `WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + QUOTENAME(CONSTRAINT_NAME)), 'IsPrimaryKey') = 1 ` +
    `AND TABLE_NAME = @table`;

  const pkRequest = new sql.Request();
  pkRequest.input('table', sql.NVarChar, table);
  const pkResult = await pkRequest.query(pkQuery);
  const pkColumn = pkResult.recordset[0] && pkResult.recordset[0].COLUMN_NAME;
  if (!pkColumn) {
    console.warn(`Table ${table} has no primary key. Skipping.`);
    return;
  }
  const pkSafe = sanitizeIdentifier(pkColumn);

  app.get(`/${tableSafe}`, async (req, res) => {
    try {
      const result = await sql.query(`SELECT * FROM ${tableSafe}`);
      res.json(result.recordset);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get(`/${tableSafe}/:${pkSafe}`, async (req, res) => {
    try {
      const id = req.params[pkSafe];
      const request = new sql.Request();
      request.input('id', id);
      const result = await request.query(`SELECT * FROM ${tableSafe} WHERE ${pkSafe} = @id`);
      if (result.recordset.length === 0) return res.status(404).send();
      res.json(result.recordset[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`/${tableSafe}`, async (req, res) => {
    try {
      const keys = Object.keys(req.body).map(sanitizeIdentifier);
      if (!keys.length) return res.status(400).json({ error: 'No data' });
      const cols = keys.join(',');
      const params = keys.map((_, i) => `@p${i}`).join(',');
      const request = new sql.Request();
      keys.forEach((k, i) => request.input(`p${i}`, req.body[k]));
      const result = await request.query(`INSERT INTO ${tableSafe} (${cols}) OUTPUT INSERTED.* VALUES (${params})`);
      res.status(201).json(result.recordset[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put(`/${tableSafe}/:${pkSafe}`, async (req, res) => {
    try {
      const id = req.params[pkSafe];
      const keys = Object.keys(req.body).map(sanitizeIdentifier);
      if (!keys.length) return res.status(400).json({ error: 'No data' });
      const set = keys.map((k, i) => `${k}=@p${i}`).join(',');
      const request = new sql.Request();
      keys.forEach((k, i) => request.input(`p${i}`, req.body[k]));
      request.input('id', id);
      const result = await request.query(`UPDATE ${tableSafe} SET ${set} OUTPUT INSERTED.* WHERE ${pkSafe} = @id`);
      if (result.recordset.length === 0) return res.status(404).send();
      res.json(result.recordset[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete(`/${tableSafe}/:${pkSafe}`, async (req, res) => {
    try {
      const id = req.params[pkSafe];
      const request = new sql.Request();
      request.input('id', id);
      const result = await request.query(`DELETE FROM ${tableSafe} OUTPUT DELETED.* WHERE ${pkSafe} = @id`);
      if (result.recordset.length === 0) return res.status(404).send();
      res.json(result.recordset[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

async function start() {
  try {
    await sql.connect(config);
    const tablesResult = await sql.query`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'`;
    const tables = tablesResult.recordset.map(r => r.TABLE_NAME);
    for (const table of tables) {
      await createCrudRoutes(app, table);
    }
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log('API server listening on ' + port));
  } catch (err) {
    console.error('Failed to start API:', err);
    process.exit(1);
  }
}

start();
