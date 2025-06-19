const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const redoc = require('redoc-express');
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
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
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

app.get('/docs',
  redoc({
    title: 'Elite API Explorer',
    specUrl: '/swagger.json',
    redocOptions: {
      scrollYOffset: 50,
      theme: {
        colors: {
          primary: { main: '#E6007A' },
          text: { primary: '#212121', secondary: '#212121' },
        },
        sidebar: {
          backgroundColor: '#212121',
          textColor: '#FFFFFF',
          activeTextColor: '#F5F5DC',
        },
        rightPanel: {
          backgroundColor: '#F5F5DC',
          textColor: '#212121',
        },
        typography: {
          fontFamily: 'Inter, sans-serif',
        },
      },
    },
  })
);

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
