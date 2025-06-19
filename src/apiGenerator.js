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

    if (!swagger.tags) swagger.tags = [];
    if (!swagger.tags.find(t => t.name === tag)) {
      swagger.tags.push({ name: tag, description: `${tableSafe} operations` });
    }

    if (!swagger.components) swagger.components = {};
    if (!swagger.components.schemas) swagger.components.schemas = {};

    const pathBase = `${basePath}/${tableSafe}`;

    const idParam = {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string', example: '1' },
      description: `Primary key of ${tableSafe}`,
    };

    const properties = {};
    const exampleRecord = {};
    for (const alias of Object.values(mapping)) {
      properties[alias] = {
        type: 'string',
        description: `${alias} field`,
        example: `${alias} example`,
      };
      exampleRecord[alias] = `${alias} example`;
    }

    const schemaName = `${tableSafe}`;
    swagger.components.schemas[schemaName] = {
      type: 'object',
      properties,
      description: `${tableSafe} object`,
    };

    const bodySchema = {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${schemaName}` },
          example: exampleRecord,
        },
      },
    };

    const okListResponse = {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: { $ref: `#/components/schemas/${schemaName}` },
          },
          example: [exampleRecord],
        },
      },
    };

    const okItemResponse = {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${schemaName}` },
          example: exampleRecord,
        },
      },
    };

    swagger.paths[pathBase] = {
      get: {
        tags: [tag],
        summary: `List ${tableSafe}`,
        description: `Retrieve an array of **${tableSafe}** records.`,
        responses: { '200': okListResponse },
      },
      post: {
        tags: [tag],
        summary: `Create ${tableSafe}`,
        description: `Create a new **${tableSafe}** record.`,
        requestBody: bodySchema,
        responses: { '201': okItemResponse },
      },
    };

    swagger.paths[`${pathBase}/{id}`] = {
      get: {
        tags: [tag],
        summary: `Get ${tableSafe}`,
        description: `Retrieve a single **${tableSafe}** by id`,
        parameters: [idParam],
        responses: {
          '200': okItemResponse,
          '404': { description: 'Not Found' },
        },
      },
      put: {
        tags: [tag],
        summary: `Update ${tableSafe}`,
        description: `Update an existing **${tableSafe}** record`,
        parameters: [idParam],
        requestBody: bodySchema,
        responses: {
          '200': okItemResponse,
          '404': { description: 'Not Found' },
        },
      },
      delete: {
        tags: [tag],
        summary: `Delete ${tableSafe}`,
        description: `Delete an existing **${tableSafe}** record`,
        parameters: [idParam],
        responses: {
          '200': okItemResponse,
          '404': { description: 'Not Found' },
        },
      },
    };
  }
}

module.exports = { createCrud };
