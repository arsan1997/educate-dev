const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Lenovo/.gemini/antigravity/brain/43cdc760-c0e1-40ab-82d7-0fa07771e2c3/.system_generated/logs/transcript_full.jsonl', 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const step42 = lines.find(l => l.step_index === 42);

if (step42 && step42.content) {
  const content = step42.content;
  console.log(content.substring(0, 500));
  console.log('---');
  console.log(content.substring(content.length - 500));
  
  const extract = [];
  content.split('\n').forEach(line => {
    const m = line.match(/^(\d+): (.*)$/);
    if (m && parseInt(m[1]) >= 870) {
      extract.push(m[1] + ': ' + m[2]);
    } else if (line.match(/^(\d+):$/)) {
      const num = parseInt(line.match(/^(\d+):$/)[1]);
      if (num >= 870) extract.push(num + ': ');
    }
  });
  
  fs.writeFileSync('tmp/missing.jsx', extract.join('\n'));
  console.log('Extracted lines:', extract.length);
} else {
  console.log('Step 42 not found or no content.');
}
