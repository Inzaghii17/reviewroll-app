require('dotenv').config();

const app = require('./app');
const seedAdmin = require('./seed');
const PORT = process.env.PORT || 3000;

// Start server then seed admin
app.listen(PORT, async () => {
  console.log(`\n  ⚡ ReviewRoll running at http://localhost:${PORT}\n`);
  await seedAdmin();
});
