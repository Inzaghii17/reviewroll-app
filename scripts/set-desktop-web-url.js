const fs = require('fs');
const path = require('path');

const webUrl = process.argv[2];

if (!webUrl) {
  console.error('Usage: npm run desktop:configure:web -- https://your-app-url.onrender.com');
  process.exit(1);
}

if (!/^https?:\/\//i.test(webUrl)) {
  console.error('Invalid URL. Please provide a full URL starting with http:// or https://');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'electron', 'build-config.json');
const config = { webUrl: webUrl.trim() };

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`Desktop build configured to load hosted app: ${config.webUrl}`);
