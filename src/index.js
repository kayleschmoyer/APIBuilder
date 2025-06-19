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
  if (!Object.keys(schema).length) schema = await loadSchema();
  res.json(schema);
});

app.post('/configure', async (req, res) => {
  try {
    const configData = req.body; // { table: { columns: { col: alias } } }
    const basePath = '/api/v1';
    for (const [table, cfg] of Object.entries(configData)) {
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
    const file = path.join(__dirname, '..', 'configs', `api-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(configData, null, 2));
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
