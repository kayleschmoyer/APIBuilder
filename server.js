const express = require('express');
const sql = require('mssql');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'your_password',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'master',
  options: {
    trustServerCertificate: true,
  },
};

let schema = {};

async function loadSchema() {
  const result = await sql.query`SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_NAME, ORDINAL_POSITION`;
  schema = {};
  for (const row of result.recordset) {
    if (!schema[row.TABLE_NAME]) schema[row.TABLE_NAME] = [];
    schema[row.TABLE_NAME].push(row.COLUMN_NAME);
  }
}

function sanitizeIdentifier(name) {
  if (!/^\w+$/.test(name)) {
    throw new Error('Unsafe identifier: ' + name);
  }
  return name;
}

async function createCrudRoutes(app, table, fields = null) {
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
  const selected = Array.isArray(fields) && fields.length ? fields.map(sanitizeIdentifier) : null;
  const selectCols = selected ? selected.concat(pkSafe).join(',') : '*';

  app.get(`/${tableSafe}`, async (req, res) => {
    try {
      const result = await sql.query(`SELECT ${selectCols} FROM ${tableSafe}`);
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
      const result = await request.query(`SELECT ${selectCols} FROM ${tableSafe} WHERE ${pkSafe} = @id`);
      if (result.recordset.length === 0) return res.status(404).send();
      res.json(result.recordset[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post(`/${tableSafe}`, async (req, res) => {
    try {
      const keys = Object.keys(req.body)
        .filter(k => !selected || selected.includes(k))
        .map(sanitizeIdentifier);
      if (!keys.length) return res.status(400).json({ error: 'No data' });
      const cols = keys.join(',');
      const params = keys.map((_, i) => `@p${i}`).join(',');
      const request = new sql.Request();
      keys.forEach((k, i) => request.input(`p${i}`, req.body[k]));
      const outputCols = selected ? selected.concat(pkSafe).map(c => `INSERTED.${c}`).join(',') : 'INSERTED.*';
      const result = await request.query(`INSERT INTO ${tableSafe} (${cols}) OUTPUT ${outputCols} VALUES (${params})`);
      res.status(201).json(result.recordset[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put(`/${tableSafe}/:${pkSafe}`, async (req, res) => {
    try {
      const id = req.params[pkSafe];
      const keys = Object.keys(req.body)
        .filter(k => !selected || selected.includes(k))
        .map(sanitizeIdentifier);
      if (!keys.length) return res.status(400).json({ error: 'No data' });
      const set = keys.map((k, i) => `${k}=@p${i}`).join(',');
      const request = new sql.Request();
      keys.forEach((k, i) => request.input(`p${i}`, req.body[k]));
      request.input('id', id);
      const outputCols = selected ? selected.concat(pkSafe).map(c => `INSERTED.${c}`).join(',') : 'INSERTED.*';
      const result = await request.query(`UPDATE ${tableSafe} SET ${set} OUTPUT ${outputCols} WHERE ${pkSafe} = @id`);
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
      const outputCols = selected ? selected.concat(pkSafe).map(c => `DELETED.${c}`).join(',') : 'DELETED.*';
      const result = await request.query(`DELETE FROM ${tableSafe} OUTPUT ${outputCols} WHERE ${pkSafe} = @id`);
      if (result.recordset.length === 0) return res.status(404).send();
      res.json(result.recordset[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

app.get('/schema', (req, res) => {
  res.json(schema);
});

app.post('/configure', async (req, res) => {
  try {
    for (const [table, cols] of Object.entries(req.body)) {
      if (!schema[table]) continue;
      await createCrudRoutes(app, table, Array.isArray(cols) ? cols : []);
    }
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function start() {
  try {
    await sql.connect(config);
    await loadSchema();
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log('API server listening on ' + port));
  } catch (err) {
    console.error('Failed to start API:', err);
    process.exit(1);
  }
}

start();
