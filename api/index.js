require('dotenv').config();

const app = require('../server/app');
const seedAdmin = require('../server/seed');

let seedPromise;
function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seedAdmin().catch((err) => {
      console.error('Admin seeding in Vercel failed:', err && err.message ? err.message : err);
    });
  }
  return seedPromise;
}

module.exports = async (req, res) => {
  await ensureSeeded();
  return app(req, res);
};
