const fs = require('fs');
const XLSX = require('xlsx');

const cellText=v=>String(v??'').trim().replace(/\s+/g,' ');

const isStudentName=v=>{const s=cellText(v);return s.length>=2&&(/[ก-๙]/.test(s)||/student|เด็ก/i.test(s))&&!/โรงเรียน|หลักสูตร|คะแนน|เวลา|ครั้งที่|หมายเหตุ|ลำดับ|ประจำตัว|ประชาชน|ป\.\d+|ม\.\d+/.test(s)&&!/^(ชั้น|ชื่อ|สกุล)$/.test(s)&&!/^ชื่อ\s*[-]?\s*(นาม)?สกุล/.test(s)};

const extractClass=v=>{
  const s=cellText(v);
  const m=s.match(/(ป\.|ม\.|ประถมศึกษาปีที่|มัธยมศึกษาปีที่)\s*(\d+)\s*[\/\.]\s*(\d+)/);
  if(m) return `${(m[1]==='ม.'||m[1]==='มัธยมศึกษาปีที่')?'ม.':'ป.'}${m[2]}/${m[3]}`;
  const mRoom=s.match(/\(ห้อง\s*(.*?)\)/);
  if(mRoom) return mRoom[1].trim().replace(/(\d+)\.(\d+)$/,'$1/$2');
  return null;
};

const uid=(prefix='id')=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const isSummarySheet=name=>/^(สรุป(?:ผล|และข้อเสนอแนะ)?|ภาพรวม|รายงานสรุป|summary|overview|dashboard)(?:\s|$)/i.test(cellText(name));

function parseSchoolWorkbook(filePath){
 const wb=XLSX.readFile(filePath);
 const sheets=wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null})}));
 const school={classrooms:[]};

 for(const sheet of sheets){
  if(isSummarySheet(sheet.name))continue;
  const allStudents=[];let firstStudentRow=Infinity;
  let currentSectionClass=null;
  sheet.rows.forEach((row,ri)=>{
    const rowStr=row.map(cellText).join(' ');
    const secClass=extractClass(rowStr);
    if(secClass) currentSectionClass=secClass;
    for(let c=0;c<Math.min(row.length, 5);c++){
      const no=Number(row[c]);
      if(Number.isInteger(no)&&no>0&&no<300){
        let nameStr='';
        for(let i=1;i<=4;i++){
          if(isStudentName(row[c+i])){
            nameStr=cellText(row[c+i]).replace(/^(?:ด\.ช\.|เด็กชาย)\s*/, 'เด็กชาย').replace(/^(?:ด\.ญ\.|เด็กหญิง)\s*/, 'เด็กหญิง');
            for(let j=1; j<=3; j++){
              const nextVal = cellText(row[c+i+j]);
              if(nextVal && !/\d/.test(nextVal) && !/ชั้น|หมายเหตุ|คะแนน|เวลา|สอบ|ขาด/.test(nextVal) && !extractClass(nextVal)){
                nameStr += '  ' + nextVal;
              } else if(nextVal) {
                break;
              }
            }
            nameStr = nameStr.trim().replace(/\s+/g, '  ');
            break;
          }
        }
        if(nameStr){
          let rawClass='';
          for(let j=0;j<row.length;j++){
            const cVal=extractClass(row[j]);
            if(cVal){rawClass=cVal;break;}
          }
          if(!rawClass && currentSectionClass) rawClass=currentSectionClass;
          allStudents.push({id:uid('student'),no,name:nameStr,rawClass,rowIdx:ri});
          firstStudentRow=Math.min(firstStudentRow,ri);
          break;
        }
      }
    }
  });
  if(!allStudents.length)continue;
  let defaultClassName=sheet.name.replace(/^(.*)\.(\d+)$/,'$1/$2');
  if(/sheet|student|รายชื่อ/i.test(defaultClassName)){
    const sheetHeader = sheet.rows.slice(0,10).flat().map(cellText).filter(Boolean).join(' ');
    const extracted = extractClass(sheetHeader);
    if(extracted) defaultClassName = extracted;
    else defaultClassName = `ห้อง ${school.classrooms.length + 1}`;
  }
  const classGroups = {};
  allStudents.forEach(st => {
    const cName = st.rawClass || defaultClassName;
    if(!classGroups[cName]) classGroups[cName] = [];
    classGroups[cName].push(st);
  });
  Object.entries(classGroups).forEach(([cName, groupStudents]) => {
    school.classrooms.push({id:uid('class'),name:cName,students:groupStudents.map(({rawClass,rowIdx,...s})=>s)});
  });
 }
 return school;
}

const res = parseSchoolWorkbook('./excel/Prepared_เด็กชาย อัศวิน เบญอาหมัดธีรกุล_2026-06-30.xlsx');
let total = 0;
res.classrooms.forEach(c => {
  console.log(`Class ${c.name}: ${c.students.length} students`);
  total += c.students.length;
});
console.log('Total:', total);
