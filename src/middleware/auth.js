const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(auth.slice(7), config.jwtSecret);
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
  if (config.apiKey && req.headers['x-api-key'] === config.apiKey) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = authenticate;
