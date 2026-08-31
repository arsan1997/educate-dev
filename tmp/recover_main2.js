const fs = require('fs');

const transcript = fs.readFileSync('C:/Users/Lenovo/.gemini/antigravity/brain/43cdc760-c0e1-40ab-82d7-0fa07771e2c3/.system_generated/logs/transcript_full.jsonl', 'utf-8');

const steps = transcript.split('\n').filter(Boolean).map(l => JSON.parse(l));

let allLines = {};

for (const step of steps) {
  if (step.content && step.content.includes('File Path: `file:///c:/Users/Lenovo/OneDrive/Desktop/educate/src/main.jsx`')) {
    const parts = step.content.split('Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n');
    for (let i = 1; i < parts.length; i++) {
      const codePart = parts[i].split('\nThe above content')[0];
      const codeLines = codePart.split('\n');
      for (const cl of codeLines) {
        const match = cl.match(/^(\d+): (.*)$/);
        if (match) {
          allLines[parseInt(match[1])] = match[2];
        } else if (cl.match(/^(\d+):$/)) {
          allLines[parseInt(cl.match(/^(\d+):$/)[1])] = '';
        }
      }
    }
  }
}

let maxLine = Math.max(...Object.keys(allLines).map(Number));
let reconstructed = [];
let missingCount = 0;
for (let i = 1; i <= 948; i++) {
  if (allLines[i] !== undefined) {
    reconstructed.push(allLines[i]);
  } else {
    reconstructed.push('// MISSING LINE ' + i);
    missingCount++;
  }
}

fs.writeFileSync('tmp/recovered_main.jsx', reconstructed.join('\n'));
console.log('Recovered lines:', Object.keys(allLines).length);
console.log('Missing lines:', missingCount);
