const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const { loadSchema } = require('./db');
const { createCrud } = require('./apiGenerator');
const authenticate = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });

let schema = {};
const swagger = {
  openapi: '3.0.0',
  info: { title: 'Generated API', version: '1.0.0' },
  paths: {},
};

app.get('/schema', async (req, res) => {
  try {
    if (!Object.keys(schema).length) {
      schema = await loadSchema();
    }
    res.json(schema);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/configure', async (req, res) => {
  try {
    const { name, tables } = req.body; // { name, tables: { table: { columns } } }
    const basePath = '/api/v1';
    if (name) swagger.info.title = name;
    for (const [table, cfg] of Object.entries(tables)) {
      await createCrud({
        app,
        basePath,
        table,
        mapping: cfg.columns,
        rateLimit: limiter,
        auth: authenticate,
        swagger,
      });
    }
    const fs = require('fs');
    const dir = path.join(__dirname, '..', 'configs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const file = path.join(dir, `api-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(req.body, null, 2));
    res.json({ status: 'ok', file: path.basename(file) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swagger));

app.listen(config.port, () => {
  console.log('Server listening on port ' + config.port);
});
