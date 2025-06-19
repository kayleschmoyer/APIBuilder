const express = require('express');
const { getPrimaryKey, getPool } = require('./db');
const sanitize = name => { if (!/^\w+$/.test(name)) throw new Error('Unsafe identifier'); return name; };

function mapRow(row, mapping) {
  const out = {};
  for (const [col, alias] of Object.entries(mapping)) {
    out[alias] = row[col];
  }
  return out;
}

async function createCrud({ app, basePath, table, mapping, rateLimit, auth, swagger }) {
  const pool = await getPool();
  const tableSafe = sanitize(table);
  const columns = Object.keys(mapping).map(sanitize);
  const selectCols = columns.join(', ');
  const pk = await getPrimaryKey(table);
  if (!pk) {
    console.warn(`Table ${table} lacks primary key`);
    return;
  }
  const pkSafe = sanitize(pk);
  const router = express.Router();
  if (rateLimit) router.use(rateLimit);
  if (auth) router.use(auth);

  router.get('/', async (req, res) => {
    try {
      const result = await pool.request().query(`SELECT ${selectCols} FROM ${tableSafe}`);
      res.json(result.recordset.map(r => mapRow(r, mapping)));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get(`/:id`, async (req, res) => {
    try {
      const request = pool.request();
      request.input('id', req.params.id);
      const result = await request.query(`SELECT ${selectCols} FROM ${tableSafe} WHERE ${pkSafe}=@id`);
      if (!result.recordset.length) return res.status(404).end();
      res.json(mapRow(result.recordset[0], mapping));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const body = req.body;
      const cols = [];
      const params = [];
      const request = pool.request();
      Object.entries(mapping).forEach(([col, alias], i) => {
        if (body[alias] !== undefined) {
          cols.push(col);
          params.push(`@p${i}`);
          request.input(`p${i}`, body[alias]);
        }
      });
      if (!cols.length) return res.status(400).json({ error: 'No data' });
      const result = await request.query(`INSERT INTO ${tableSafe} (${cols.join(',')}) OUTPUT INSERTED.${selectCols} VALUES (${params.join(',')})`);
      res.status(201).json(mapRow(result.recordset[0], mapping));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const body = req.body;
      const sets = [];
      const request = pool.request();
      let idx = 0;
      Object.entries(mapping).forEach(([col, alias]) => {
        if (body[alias] !== undefined) {
          sets.push(`${col}=@p${idx}`);
          request.input(`p${idx}`, body[alias]);
          idx++;
        }
      });
      if (!sets.length) return res.status(400).json({ error: 'No data' });
      request.input('id', req.params.id);
      const result = await request.query(`UPDATE ${tableSafe} SET ${sets.join(',')} OUTPUT INSERTED.${selectCols} WHERE ${pkSafe}=@id`);
      if (!result.recordset.length) return res.status(404).end();
      res.json(mapRow(result.recordset[0], mapping));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const request = pool.request();
      request.input('id', req.params.id);
      const result = await request.query(`DELETE FROM ${tableSafe} OUTPUT DELETED.${selectCols} WHERE ${pkSafe}=@id`);
      if (!result.recordset.length) return res.status(404).end();
      res.json(mapRow(result.recordset[0], mapping));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.use(basePath + '/' + tableSafe, router);

  if (swagger) {
    const tag = tableSafe;
    swagger.paths[`${basePath}/${tableSafe}`] = {
      get: { tags: [tag], responses: { '200': { description: 'List' } } },
      post: { tags: [tag], responses: { '201': { description: 'Created' } } }
    };
    swagger.paths[`${basePath}/${tableSafe}/{id}`] = {
      get: { tags: [tag], parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: 'Item' } } },
      put: { tags: [tag], parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: [tag], parameters: [{ name: 'id', in: 'path', required: true }], responses: { '200': { description: 'Deleted' } } }
    };
  }
}

module.exports = { createCrud };
