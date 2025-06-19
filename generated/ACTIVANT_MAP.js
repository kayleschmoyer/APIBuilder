const { createCrud } = require('../src/apiGenerator');

module.exports = ({ app, rateLimit, auth, swagger }) =>
  createCrud({
    app,
    basePath: "/api/v1",
    table: "ACTIVANT_MAP",
    mapping: {
  "VAST_MFG": "VAST_MFG",
  "ACTIVANT_LINE": "ACTIVANT_LINE"
},
    rateLimit,
    auth,
    swagger,
  });
