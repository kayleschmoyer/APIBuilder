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
  info: { 
    title: 'Elite API Explorer', 
    version: '1.0.0',
    description: 'A world-class API with enterprise-grade documentation',
    contact: {
      name: 'API Support',
      email: 'support@elite-api.com'
    }
  },
  servers: [
    {
      url: `http://localhost:${config.port || 3000}/api/v1`,
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token'
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
    const { name, tables } = req.body;
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

// Inject custom CSS before ReDoc loads
app.get('/elite-theme.css', (req, res) => {
  res.type('text/css');
  res.send(`
    /* Elite API Documentation Theme */
    :root {
      --elite-primary: #E6007A;
      --elite-primary-dark: #B3005F;
      --elite-primary-light: #FF1493;
      --elite-bg-dark: #0A0A0A;
      --elite-bg-sidebar: #141414;
      --elite-bg-code: #1E1E1E;
      --elite-text-primary: #FFFFFF;
      --elite-text-secondary: #B8B8B8;
      --elite-border: #2A2A2A;
      --elite-success: #00D9A3;
      --elite-warning: #FFB800;
      --elite-error: #FF3860;
      --elite-info: #00B4D8;
    }

    /* Global Styles */
    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background: #FFFFFF;
      margin: 0;
      overflow-x: hidden;
    }

    /* Elite Scrollbar */
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    ::-webkit-scrollbar-track {
      background: #F5F5F5;
    }

    ::-webkit-scrollbar-thumb {
      background: #D0D0D0;
      border-radius: 5px;
      transition: background 0.2s;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #B0B0B0;
    }

    .menu-content::-webkit-scrollbar-track {
      background: var(--elite-bg-sidebar);
    }

    .menu-content::-webkit-scrollbar-thumb {
      background: #3A3A3A;
    }

    /* Sidebar Enhancements */
    .menu-content {
      background: var(--elite-bg-sidebar) !important;
      padding: 24px 0 !important;
      font-size: 14px !important;
    }

    .menu-content > div {
      padding: 0 24px !important;
    }

    /* Search Box Elite Style */
    .search-box {
      background: #1A1A1A !important;
      border: 2px solid transparent !important;
      border-radius: 8px !important;
      padding: 12px 16px !important;
      color: var(--elite-text-primary) !important;
      font-size: 14px !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      margin-bottom: 24px !important;
    }

    .search-box:focus {
      outline: none !important;
      border-color: var(--elite-primary) !important;
      background: #222222 !important;
      box-shadow: 0 0 0 3px rgba(230, 0, 122, 0.1) !important;
    }

    .search-box::placeholder {
      color: #666666 !important;
    }

    /* Navigation Items */
    .menu-content li {
      margin: 2px 0 !important;
      transition: all 0.2s ease !important;
      border-radius: 6px !important;
      position: relative !important;
    }

    .menu-content li:hover {
      background: rgba(230, 0, 122, 0.05) !important;
    }

    .menu-content a {
      color: #E0E0E0 !important;
      text-decoration: none !important;
      display: block !important;
      padding: 8px 12px !important;
      border-radius: 6px !important;
      transition: all 0.2s ease !important;
      position: relative !important;
      overflow: hidden !important;
    }

    .menu-content a:hover {
      color: var(--elite-text-primary) !important;
      background: rgba(230, 0, 122, 0.1) !important;
      transform: translateX(4px);
    }

    .menu-content a.active {
      color: var(--elite-primary) !important;
      background: rgba(230, 0, 122, 0.15) !important;
      font-weight: 600 !important;
    }

    .menu-content a.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 70%;
      background: var(--elite-primary);
      border-radius: 0 3px 3px 0;
    }

    /* Operation Labels */
    .operation-type {
      font-weight: 700 !important;
      font-size: 11px !important;
      letter-spacing: 0.05em !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      display: inline-block !important;
      margin-right: 8px !important;
    }

    label[for*="get"] .operation-type { 
      background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%) !important; 
      color: white !important;
    }
    
    label[for*="post"] .operation-type { 
      background: linear-gradient(135deg, #00D9A3 0%, #00B894 100%) !important; 
      color: white !important;
    }
    
    label[for*="put"] .operation-type { 
      background: linear-gradient(135deg, #FFA502 0%, #FF6B6B 100%) !important; 
      color: white !important;
    }
    
    label[for*="delete"] .operation-type { 
      background: linear-gradient(135deg, #FF3860 0%, #E91E63 100%) !important; 
      color: white !important;
    }

    /* Main Content Area */
    .api-content {
      background: #FFFFFF !important;
      color: #1A1A1A !important;
      padding: 40px 60px !important;
      max-width: 900px !important;
      margin: 0 auto !important;
    }

    /* Headers with Modern Style */
    .api-content h1 {
      font-size: 36px !important;
      font-weight: 800 !important;
      color: #000000 !important;
      margin: 48px 0 24px !important;
      letter-spacing: -0.02em !important;
      line-height: 1.2 !important;
    }

    .api-content h2 {
      font-size: 28px !important;
      font-weight: 700 !important;
      color: #000000 !important;
      margin: 40px 0 20px !important;
      letter-spacing: -0.01em !important;
      position: relative !important;
      padding-bottom: 12px !important;
    }

    .api-content h2::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 60px;
      height: 3px;
      background: var(--elite-primary);
      border-radius: 2px;
    }

    .api-content h3 {
      font-size: 20px !important;
      font-weight: 600 !important;
      color: #000000 !important;
      margin: 32px 0 16px !important;
    }

    /* Paragraphs and Text */
    .api-content p {
      font-size: 16px !important;
      line-height: 1.8 !important;
      color: #3A3A3A !important;
      margin-bottom: 20px !important;
    }

    /* Code Styling */
    .api-content code {
      font-family: 'SF Mono', Monaco, Consolas, monospace !important;
      font-size: 14px !important;
      padding: 4px 8px !important;
      background: rgba(230, 0, 122, 0.08) !important;
      color: var(--elite-primary) !important;
      border-radius: 6px !important;
      font-weight: 500 !important;
      white-space: nowrap !important;
    }

    /* Code Blocks */
    .api-content pre {
      background: #1A1A1A !important;
      color: #E0E0E0 !important;
      padding: 24px !important;
      border-radius: 12px !important;
      overflow-x: auto !important;
      font-size: 14px !important;
      line-height: 1.6 !important;
      margin: 24px 0 !important;
      position: relative !important;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
    }

    .api-content pre code {
      background: transparent !important;
      color: #E0E0E0 !important;
      padding: 0 !important;
      white-space: pre !important;
    }

    /* Tables */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 24px 0 !important;
      background: #FFFFFF !important;
      border-radius: 12px !important;
      overflow: hidden !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
    }

    th {
      background: #F8F8F8 !important;
      color: #000000 !important;
      font-weight: 700 !important;
      font-size: 13px !important;
      letter-spacing: 0.05em !important;
      text-transform: uppercase !important;
      padding: 16px 20px !important;
      text-align: left !important;
      border-bottom: 2px solid #E0E0E0 !important;
    }

    td {
      padding: 16px 20px !important;
      color: #3A3A3A !important;
      font-size: 15px !important;
      border-bottom: 1px solid #F0F0F0 !important;
    }

    tr:last-child td {
      border-bottom: none !important;
    }

    tr:hover {
      background: #FAFAFA !important;
    }

    /* Property Types */
    .property-name {
      color: #000000 !important;
      font-weight: 600 !important;
      font-family: 'SF Mono', Monaco, Consolas, monospace !important;
      font-size: 14px !important;
    }

    .property-type {
      color: var(--elite-primary) !important;
      font-weight: 500 !important;
      font-size: 13px !important;
    }

    /* Right Panel - Code Examples */
    .api-info {
      background: var(--elite-bg-dark) !important;
      color: var(--elite-text-primary) !important;
      padding: 40px !important;
    }

    .api-info h1,
    .api-info h2,
    .api-info h3 {
      color: var(--elite-text-primary) !important;
      margin-bottom: 16px !important;
    }

    .api-info code {
      color: #FF6B9D !important;
      background: rgba(255, 107, 157, 0.1) !important;
    }

    .api-info pre {
      background: var(--elite-bg-code) !important;
      border: 1px solid var(--elite-border) !important;
      color: #E0E0E0 !important;
      padding: 20px !important;
      border-radius: 10px !important;
      font-size: 13px !important;
      line-height: 1.6 !important;
      overflow-x: auto !important;
    }

    /* Response Tabs */
    .react-tabs__tab-list {
      border-bottom: 2px solid var(--elite-border) !important;
      margin-bottom: 20px !important;
    }

    .react-tabs__tab {
      background: transparent !important;
      border: none !important;
      color: var(--elite-text-secondary) !important;
      font-weight: 500 !important;
      font-size: 14px !important;
      padding: 12px 20px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      position: relative !important;
    }

    .react-tabs__tab:hover {
      color: var(--elite-text-primary) !important;
    }

    .react-tabs__tab--selected {
      color: var(--elite-primary) !important;
    }

    .react-tabs__tab--selected::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--elite-primary);
    }

    /* Badges and Labels */
    .required-label {
      background: var(--elite-error) !important;
      color: white !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      margin-left: 8px !important;
      letter-spacing: 0.05em !important;
    }

    /* Buttons */
    button {
      background: var(--elite-primary) !important;
      color: white !important;
      border: none !important;
      padding: 10px 20px !important;
      border-radius: 8px !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }

    button:hover {
      background: var(--elite-primary-dark) !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(230, 0, 122, 0.3) !important;
    }

    /* Try it out Button */
    .try-out__btn {
      background: var(--elite-primary) !important;
      color: white !important;
      border-radius: 8px !important;
      padding: 8px 16px !important;
      font-weight: 600 !important;
      transition: all 0.2s ease !important;
    }

    .try-out__btn:hover {
      background: var(--elite-primary-dark) !important;
      transform: scale(1.05);
    }

    /* Loading Animation */
    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }

    .loading {
      animation: pulse 1.5s ease-in-out infinite;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .api-content {
        padding: 20px !important;
      }

      .api-content h1 {
        font-size: 28px !important;
      }

      .api-content h2 {
        font-size: 22px !important;
      }

      table {
        font-size: 14px !important;
      }

      th, td {
        padding: 12px !important;
      }
    }

    /* Animations */
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .api-content > * {
      animation: fadeIn 0.5s ease-out;
    }

    /* Elite Status Indicators */
    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
      animation: pulse 2s ease-in-out infinite;
    }

    .status-indicator.success {
      background: var(--elite-success);
    }

    .status-indicator.error {
      background: var(--elite-error);
    }

    .status-indicator.warning {
      background: var(--elite-warning);
    }

    /* Copy Code Button */
    .copy-code-button {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(255, 255, 255, 0.1) !important;
      color: var(--elite-text-secondary) !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      padding: 6px 12px !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }

    .copy-code-button:hover {
      background: rgba(255, 255, 255, 0.2) !important;
      color: var(--elite-text-primary) !important;
    }

    /* Schema Nested Items */
    .nested-schema {
      margin-left: 20px !important;
      padding-left: 20px !important;
      border-left: 2px solid #E0E0E0 !important;
    }

    /* Expand/Collapse Arrows */
    .expand-arrow {
      transition: transform 0.2s ease !important;
    }

    .expand-arrow.expanded {
      transform: rotate(90deg);
    }

    /* Final Polish */
    .api-content ul,
    .api-content ol {
      margin: 20px 0 !important;
      padding-left: 30px !important;
    }

    .api-content li {
      margin: 8px 0 !important;
      line-height: 1.8 !important;
      color: #3A3A3A !important;
    }

    /* Elite Hover Effects */
    a {
      transition: all 0.2s ease !important;
    }

    a:hover {
      opacity: 0.8;
    }

    /* Performance Optimization */
    * {
      will-change: auto;
    }

    /* Print Styles */
    @media print {
      .menu-content,
      .api-info {
        display: none !important;
      }

      .api-content {
        max-width: 100% !important;
        padding: 20px !important;
      }
    }
  `);
});

app.get('/docs',
  redoc({
    title: 'Elite API Explorer - World-Class Documentation',
    specUrl: '/swagger.json',
    options: {
      theme: {
        colors: {
          primary: { main: '#E6007A' },
          success: { main: '#00D9A3' },
          warning: { main: '#FFB800' },
          error: { main: '#FF3860' },
          info: { main: '#00B4D8' }
        },
        typography: {
          fontSize: '16px',
          lineHeight: '1.7',
          fontFamily: '-apple-system, BlinkMacSystemFont, Inter, Segoe UI, Roboto, sans-serif',
          headings: {
            fontFamily: '-apple-system, BlinkMacSystemFont, Inter, Segoe UI, Roboto, sans-serif',
            fontWeight: '700'
          },
          code: {
            fontSize: '14px',
            fontFamily: 'SF Mono, Monaco, Consolas, Courier New, monospace'
          }
        },
        sidebar: {
          backgroundColor: '#141414',
          textColor: '#E0E0E0'
        },
        rightPanel: {
          backgroundColor: '#0A0A0A'
        }
      },
      scrollYOffset: 0,
      hideDownloadButton: false,
      disableSearch: false,
      requiredPropsFirst: true,
      sortPropsAlphabetically: true,
      showExtensions: true,
      nativeScrollbars: false,
      pathInMiddlePanel: true,
      expandResponses: '200,201',
      jsonSampleExpandLevel: 3,
      hideSchemaTitles: false,
      simpleOneOfTypeLabel: false,
      menuToggle: true,
      untrustedSpec: false,
      hideHostname: false
    },
    // Inject our custom CSS
    headHtml: '<link rel="stylesheet" href="/elite-theme.css">'
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
    console.log(`
    ╔══════════════════════════════════════════╗
    ║       🚀 ELITE API EXPLORER 🚀           ║
    ╠══════════════════════════════════════════╣
    ║  Server:  http://localhost:${config.port}         ║
    ║  Docs:    http://localhost:${config.port}/docs    ║
    ╠══════════════════════════════════════════╣
    ║  Status:  ● Online                       ║
    ║  Theme:   Elite Dark & Light             ║
    ╚══════════════════════════════════════════╝
    `);
  });
})();