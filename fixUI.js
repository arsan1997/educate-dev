const fs = require('fs');
let code = fs.readFileSync('src/pages/ScorePage.jsx', 'utf8');

// 1. Remove the broken ternary and restore the card
code = code.replace(/\{\(!schoolId \|\| !classId \|\| !sessionId\) \? <div className="card" style=\{\{padding: '40px', textAlign: 'center', color: 'var\(--text-light\)'\}\}><p>กรุณาเลือกโรงเรียน ชั้นเรียน และครั้งที่ทดสอบจากด้านบน<br\/>เพื่อเริ่มบันทึกคะแนน<\/p><\/div> : <><div className="card score-card">/, '<div className="card score-card">');

// 2. Add the proper ternary logic around the two cards (score-card and feedback card)
code = code.replace(/<div className="card score-card">/, '{(!schoolId || !classId || !sessionId) ? <div className="card" style={{padding: \'40px\', textAlign: \'center\', color: \'var(--text-light)\'}}><p>กรุณาเลือกโรงเรียน ชั้นเรียน และครั้งที่ทดสอบจากด้านบน<br/>เพื่อเริ่มบันทึกคะแนน</p></div> : (<><div className="card score-card">');

// 3. Fix the closing brackets at the end
code = code.replace(/<\/button><\/div><\/div>[\s\S]*$/, '</button></div></div></>)}\n  </>\n}\n\nexport default ScorePage;\n');

fs.writeFileSync('src/pages/ScorePage.jsx', code);
