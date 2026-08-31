const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Add import if not exists
if (!code.includes('verifyLockOwnership')) {
  code = code.replace(/import \{([^}]+)\} from '\.\/dataService'/, (m, p1) => {
    return 'import {' + p1 + ',verifyLockOwnership} from \'./dataService\'';
  });
}

// Ensure Swal is imported in App.jsx (if not already)
if (!code.includes('import Swal')) {
  code = code.replace(/(import React[^;]+;)/, '$1\nimport Swal from \'sweetalert2\';');
}

// Modify flushChanges
const flushChangesOriginal = `const flushChanges=async()=>{
   if(readOnly||!cloudReady.current||!hasDirty())return;
   const pending=dirtyRef.current;dirtyRef.current={schools:new Set(),sessions:new Set(),classrooms:new Set(),results:new Map()};setCloudStatus('saving');
   const allSessions=schools.flatMap(s=>s.sessions),allClassrooms=schools.flatMap(s=>s.classrooms);
   try{
    await Promise.all([`;

const flushChangesNew = `const flushChanges=async()=>{
   if(readOnly||!cloudReady.current||!hasDirty())return;
   
   // --- VERIFY LOCK OWNERSHIP BEFORE SAVE ---
   const pending=dirtyRef.current;
   const allSessions=schools.flatMap(s=>s.sessions);
   const allClassrooms=schools.flatMap(s=>s.classrooms);
   
   // Collect all classIds that are being modified
   const classIdsToSave = new Set();
   [...pending.classrooms].forEach(id => classIdsToSave.add(id));
   [...pending.sessions].forEach(id => {
       const session = allSessions.find(s => s.id === id);
       if (session) classIdsToSave.add(session.classId);
   });
   [...pending.results].forEach(([sessionId]) => {
       const session = allSessions.find(s => s.id === sessionId);
       if (session) classIdsToSave.add(session.classId);
   });
   
   // Check if we still hold the lock for these classes
   for (const cid of classIdsToSave) {
       const lockCheck = await verifyLockOwnership(cid, user?.id);
       if (!lockCheck.hasLock) {
           Swal.fire({
               icon: 'error',
               title: 'เซฟข้อมูลไม่สำเร็จ',
               text: \`คุณได้สูญเสียสิทธิ์การแก้ไขห้องเรียนนี้ (กำลังถูกแก้ไขโดย: \${lockCheck.lockedBy})\nเพื่อป้องกันข้อมูลสูญหาย ข้อมูลล่าสุดของคุณจะไม่ถูกบันทึก\`,
               confirmButtonText: 'รับทราบ (โหลดข้อมูลใหม่)'
           }).then(() => {
               window.location.reload();
           });
           setReadOnly(true);
           setCloudStatus('error');
           return; // Abort save immediately!
       }
   }
   // ----------------------------------------
   
   dirtyRef.current={schools:new Set(),sessions:new Set(),classrooms:new Set(),results:new Map()};setCloudStatus('saving');
   try{
    await Promise.all([`;

code = code.replace(flushChangesOriginal, flushChangesNew);

fs.writeFileSync('src/App.jsx', code);
