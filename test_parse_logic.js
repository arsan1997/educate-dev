const fs = require('fs');
const XLSX = require('xlsx');

const cellText=v=>String(v??'').trim().replace(/\s+/g,' ');
const isStudentName=v=>{const s=cellText(v);return s.length>3&&(/[ก-๙]/.test(s)||/student|เด็ก/i.test(s))&&!/โรงเรียน|ชั้น|หลักสูตร|คะแนน|เวลา|ครั้งที่|หมายเหตุ|ลำดับ|ชื่อ|สกุล|ประจำตัว|ประชาชน|ป\.\d+|ม\.\d+/.test(s)};

const filePath = './excel/รายชื่อป.4.1.xlsx';
const wb = XLSX.readFile(filePath);
console.log("Sheets: ", wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

const headerValues = rows.slice(0, 10).flat().map(cellText).filter(Boolean);
const headerText = headerValues.join(' ');

let className = wb.SheetNames[0].replace(/^(.*)\.(\d+)$/,'$1/$2');
if(/sheet|student|รายชื่อ/i.test(className)){
  const roomMatch = headerText.match(/\(ห้อง\s*(.*?)\)/);
  if(roomMatch) className = roomMatch[1].trim();
  else className = `ห้อง 1`;
}
console.log("Extracted Class Name:", className);

const students = [];
rows.forEach((row, ri) => {
  for (let c = 0; c < Math.min(row.length, 5); c++) {
    const no = Number(row[c]);
    if (Number.isInteger(no) && no > 0 && no < 300) {
      let nameStr = '';
      for(let i=1; i<=4; i++) {
         if(isStudentName(row[c+i])) {
            nameStr = cellText(row[c+i]);
            break;
         }
      }
      if(nameStr) {
        let studentClass = '';
        for(let j=0; j<row.length; j++) {
           const text = cellText(row[j]);
           const cmatch = text.match(/(ป\.\d+\/\d+|ม\.\d+\/\d+)/);
           if(cmatch) {
             studentClass = cmatch[1];
             break;
           }
        }
        students.push({ no, name: nameStr, rawClass: studentClass });
        break;
      }
    }
  }
});

const classGroups = {};
students.forEach(st => {
   const cName = st.rawClass || className;
   if(!classGroups[cName]) classGroups[cName] = [];
   classGroups[cName].push(st);
});

console.log("Class Groups:", Object.keys(classGroups));
console.log("Group 1 Size:", classGroups[Object.keys(classGroups)[0]]?.length);

