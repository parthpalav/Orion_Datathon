// Vercel entry: serves the compiled Express API (server/dist) as one function. vercel.json routes /api/* and /health here.
module.exports = require('../server/dist/vercel.js').default;
