require('dotenv').config();

module.exports = {
  db: {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'your_password',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'master',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
    options: {
      trustServerCertificate: true,
    },
  },
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'secret',
  apiKey: process.env.API_KEY || null,
};
