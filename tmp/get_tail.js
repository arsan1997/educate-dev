const fs = require('fs');
const execSync = require('child_process').execSync;
execSync('git show HEAD:src/main.jsx > tmp/old_main.jsx');
const lines = fs.readFileSync('tmp/old_main.jsx', 'utf-8').split('\n');
const idx1 = lines.findIndex(l => l.includes('<Field label="คำนำหน้า">'));
const idx2 = lines.findIndex(l => l.includes('function Reports'));
console.log('Lines between:', idx2 - idx1);
console.log(lines.slice(idx1 + 1, idx2).join('\n'));
