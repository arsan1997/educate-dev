const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Lenovo/.gemini/antigravity/brain/43cdc760-c0e1-40ab-82d7-0fa07771e2c3/.system_generated/logs/transcript_full.jsonl', 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));

let allLines = {};

const extractLines = (content) => {
  const parts = content.split('Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n');
  if (parts.length > 1) {
    const codePart = parts[1].split('\nThe above content')[0];
    codePart.split('\n').forEach(cl => {
      const m = cl.match(/^(\d+): (.*)$/);
      if (m) allLines[parseInt(m[1])] = m[2];
      else if (cl.match(/^(\d+):$/)) allLines[parseInt(cl.match(/^(\d+):$/)[1])] = '';
    });
  }
};

const step35 = lines.find(l => l.step_index === 35);
if (step35 && step35.content) extractLines(step35.content);

const step41 = lines.find(l => l.step_index === 41);
if (step41 && step41.content) extractLines(step41.content);

const step42 = lines.find(l => l.step_index === 42);
if (step42 && step42.content) extractLines(step42.content);

let reconstructed = [];
for (let i = 1; i <= 948; i++) {
  reconstructed.push(allLines[i] !== undefined ? allLines[i] : `// MISSING LINE ${i}`);
}
fs.writeFileSync('tmp/uncommitted_main.jsx', reconstructed.join('\n'));
console.log('Recovered total lines:', Object.keys(allLines).length);
