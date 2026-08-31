const fs = require('fs');

// Patch App.jsx
let appCode = fs.readFileSync('src/App.jsx', 'utf8');
// Stop auto-selecting class and session when selecting a school
appCode = appCode.replace(/setClassId\(s\?\.classrooms\[0\]\?\.id\);setSessionId\(s\?\.sessions\.find\(x=>x\.classId===s\?\.classrooms\[0\]\?\.id\)\?\.id\);/g, "setClassId('');setSessionId('');");
appCode = appCode.replace(/setClassId\(detail\.classrooms\[0\]\?\.id\);setSessionId\(detail\.sessions\[0\]\?\.id\)/g, "setClassId('');setSessionId('')");
// Disable localStorage restore for school, class, session so it always defaults to empty
appCode = appCode.replace(/useState\(\(\)=>restore\('erp-active-school',null\)\)/, "useState('')");
appCode = appCode.replace(/useState\(\(\)=>restore\('erp-active-class',null\)\)/, "useState('')");
appCode = appCode.replace(/useState\(\(\)=>restore\('erp-active-session',null\)\)/, "useState('')");
fs.writeFileSync('src/App.jsx', appCode);

// Patch ScorePage.jsx
let scoreCode = fs.readFileSync('src/pages/ScorePage.jsx', 'utf8');

// Add placeholder to Session Select
scoreCode = scoreCode.replace(
  /<Select value=\{sessionId\|\|''\} onChange=\{onSelectSession\}>\{sessions\.map\(s=><option value=\{s\.id\} key=\{s\.id\}>\{s\.test\}<\/option>\)\}<\/Select>/,
  '<Select value={sessionId||\'\'} onChange={onSelectSession}><option value="" disabled hidden>{sessions.length ? \'เลือกครั้งที่ทดสอบ\' : \'ยังไม่มีข้อมูล (กดปุ่ม + ด้านขวา)\'}</option>{sessions.map(s=><option value={s.id} key={s.id}>{s.test}</option>)}</Select>'
);

// Hide the score-card if no session is selected
if (!scoreCode.includes('{(!schoolId || !classId || !sessionId) ?')) {
  scoreCode = scoreCode.replace(
    /<div className="card score-card">/,
    `{(!schoolId || !classId || !sessionId) ? <div className="card" style={{padding: '40px', textAlign: 'center', color: 'var(--text-light)'}}><p>กรุณาเลือกโรงเรียน ชั้นเรียน และครั้งที่ทดสอบจากด้านบน<br/>เพื่อเริ่มบันทึกคะแนน</p></div> : <><div className="card score-card">`
  );
  
  // Need to close the fragment after the actions div
  scoreCode = scoreCode.replace(
    /<\/button><\/div><\/div>/,
    `</button></div></div></>`
  );
}

fs.writeFileSync('src/pages/ScorePage.jsx', scoreCode);
