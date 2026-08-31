const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Lenovo/.gemini/antigravity/brain/43cdc760-c0e1-40ab-82d7-0fa07771e2c3/.system_generated/logs/transcript_full.jsonl', 'utf-8')
  .split('\n')
  .filter(Boolean)
  .map(l => {
    try { return JSON.parse(l); } catch(e) { return null; }
  })
  .filter(Boolean);

let outputs = [];
for (const l of lines) {
  if (l.content && l.content.includes('File Path: `file:///c:/Users/Lenovo/OneDrive/Desktop/educate/src/main.jsx`')) {
    outputs.push(l.content);
  }
}
console.log('Found outputs:', outputs.length);
if (outputs.length > 0) {
  outputs.sort((a,b) => a.length - b.length);
  const longest = outputs[outputs.length-1];
  console.log('Longest length:', longest.length);
  const match = longest.match(/Showing lines (\d+) to (\d+)/);
  if (match) {
    console.log('Longest shows lines:', match[1], 'to', match[2]);
  }
  
  // Let's print the actual missing lines 876-948 from the outputs if they exist
  let missing = [];
  for (const out of outputs) {
    const p = out.split('Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n');
    for (let i = 1; i < p.length; i++) {
      const codePart = p[i].split('\nThe above content')[0];
      const codeLines = codePart.split('\n');
      for (const cl of codeLines) {
        const m = cl.match(/^(\d+): (.*)$/);
        if (m) {
          const num = parseInt(m[1]);
          if (num >= 876 && num <= 948) {
            missing.push(cl);
          }
        }
      }
    }
  }
  console.log('Found missing lines count:', missing.length);
}
