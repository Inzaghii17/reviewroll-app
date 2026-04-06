const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.join(__dirname, '..', 'dist');
const outputDir = path.join(__dirname, '..', 'public', 'downloads');
const outputZip = path.join(outputDir, 'ReviewRoll-latest-win.zip');
const outputSha = path.join(outputDir, 'ReviewRoll-latest-win.zip.sha256');

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Run npm run build:desktop:zip first.');
  process.exit(1);
}

const zipCandidates = fs
  .readdirSync(distDir)
  .filter(name => name.toLowerCase().endsWith('.zip'))
  .map(name => {
    const fullPath = path.join(distDir, name);
    const stat = fs.statSync(fullPath);
    return { fullPath, name, mtimeMs: stat.mtimeMs };
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

if (!zipCandidates.length) {
  console.error('No .zip desktop artifacts found in dist.');
  process.exit(1);
}

const latest = zipCandidates[0];
fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(latest.fullPath, outputZip);

const hash = crypto.createHash('sha256').update(fs.readFileSync(outputZip)).digest('hex');
fs.writeFileSync(outputSha, `${hash}  ReviewRoll-latest-win.zip\n`, 'utf8');

console.log(`Published desktop zip: ${outputZip}`);
console.log(`Checksum written: ${outputSha}`);
console.log(`Source artifact used: ${latest.name}`);
