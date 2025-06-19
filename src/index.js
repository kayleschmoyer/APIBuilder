const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const { loadSchema } = require('./db');
const { createCrud } = require('./apiGenerator');
const authenticate = require('./middleware/auth');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });

let schema = {};
const swagger = {
  openapi: '3.0.0',
  info: { title: 'Elite API Explorer', version: '1.0.0' },
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
      const codeDir = path.join(__dirname, '..', 'generated');
      if (!fs.existsSync(codeDir)) fs.mkdirSync(codeDir);
      const snippet = `const { createCrud } = require('../src/apiGenerator');

module.exports = ({ app, rateLimit, auth, swagger }) =>
  createCrud({
    app,
    basePath: ${JSON.stringify(basePath)},
    table: ${JSON.stringify(table)},
    mapping: ${JSON.stringify(cfg.columns, null, 2)},
    rateLimit,
    auth,
    swagger,
  });
`;
      fs.writeFileSync(path.join(codeDir, `${table}.js`), snippet);
    }
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

app.get('/swagger.json', (req, res) => {
  res.json(swagger);
});

const swaggerUiOptions = {
  swaggerUrl: '/swagger.json',
  explorer: true,
  customSiteTitle: 'Elite API Explorer',
  customCss: `
    .swagger-ui .topbar {
      background-color: #0f172a;
    }
    .swagger-ui .topbar .link, .swagger-ui .topbar .link:visited {
      color: #fff;
      font-weight: bold;
      font-size: 1.25rem;
    }
    .swagger-ui .info hgroup.main h2, .swagger-ui .info hgroup.main a {
      font-size: 2rem;
      font-weight: 700;
    }
  `,
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(null, swaggerUiOptions));

(async () => {
  const codeDir = path.join(__dirname, '..', 'configs');
  if (fs.existsSync(codeDir)) {
    const files = fs.readdirSync(codeDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const json = JSON.parse(fs.readFileSync(path.join(codeDir, file)));
      const basePath = '/api/v1';
      if (json.name) swagger.info.title = json.name;
      for (const [table, cfg] of Object.entries(json.tables)) {
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
    }
  }
  app.listen(config.port, () => {
    console.log('Server listening on port ' + config.port);
  });
})();
