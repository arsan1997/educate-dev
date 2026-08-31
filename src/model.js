const uid=(prefix='id')=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

export const ROBOT_TYPES=['Code & Go','Botley','Botzees','Mbot2'];
export const isBotleyRobot=value=>/botley/i.test(cellText(value));
export const BOTLEY_EXAM_OPTIONS=['Basic A1','Basic B1','Intermediate 1','Advance 1','Basic 2','Intermediate 2','Advance 2'];
export const STANDARD_EXAM_OPTIONS=['Basic 1','Basic 2','Intermediate 1','Intermediate 2','Advance 1','Advance 2'];
export const defaultExamForRobot=robot=>isBotleyRobot(robot)?'Basic A1':'Basic 1';
export const examOptionsForRobot=robot=>isBotleyRobot(robot)?BOTLEY_EXAM_OPTIONS:STANDARD_EXAM_OPTIONS;
const normalizeRobot=value=>{
 const s=cellText(value);
 if(/botley/i.test(s))return 'Botley';
 if(/botzees/i.test(s))return 'Botzees';
 if(/mbot\s*2/i.test(s))return 'Mbot2';
 if(/code\s*&?\s*go/i.test(s))return 'Code & Go';
 return 'Code & Go';
};

export function compareClassNames(nameA, nameB) {
  const normalizeThaiDigits = value => String(value || '').replace(/[๐-๙]/g, digit => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit)));
  const getLevelWeight = (name) => {
    if (!name) return 99;
    const n = normalizeThaiDigits(name).trim().replace(/\s+/g, ' ');
    if (/^(อ\.?|อนุบาล|ปฐมวัย|ชั้นอนุบาล|ระดับอนุบาล)/.test(n)) return 1;
    if (/^(ป\.?|ประถม|ประถมศึกษา|ชั้นประถม|ระดับประถม)/.test(n)) return 2;
    if (/^(ม\.?|มัธยม|มัธยมศึกษา|ชั้นมัธยม|ระดับมัธยม)/.test(n)) return 3;
    return 4;
  };
  const wA = getLevelWeight(nameA);
  const wB = getLevelWeight(nameB);
  if (wA !== wB) return wA - wB;
  return normalizeThaiDigits(nameA).localeCompare(normalizeThaiDigits(nameB), 'th', { numeric: true });
}

export const sampleSchool={
 id:'school-demo',name:'โรงเรียนอนุบาลเชียงใหม่',year:'2569',term:'1',
 classrooms:[{id:'class-demo',name:'ป.4/1',students:[
  {id:'s1',no:1,name:'เด็กชายภาคิน ศรีสุข'},{id:'s2',no:2,name:'เด็กหญิงปุณณภา ใจดี'},
  {id:'s3',no:3,name:'เด็กชายธนกฤต พูนทรัพย์'},{id:'s4',no:4,name:'เด็กหญิงกัญญาวีร์ แสงทอง'},
  {id:'s5',no:5,name:'เด็กชายณัฐดนัย คงมั่น'},{id:'s6',no:6,name:'เด็กหญิงพิชญาภา วงศ์ดี'},
  {id:'s7',no:7,name:'เด็กชายศุภวิชญ์ มีสุข'},{id:'s8',no:8,name:'เด็กหญิงธัญชนก พิพัฒน์'}]}],
 sessions:[{id:'session-demo',classId:'class-demo',test:'ครั้งที่ 1',date:'2026-06-18',robot:'Code & Go',exam:'Basic 1',trainer:'ครูณัฐวุฒิ ใจงาม',feedback:{detail:'นักเรียนทำภารกิจควบคุมหุ่นยนต์เดินลอดอุโมงค์และกลับสู่จุดเริ่มต้น',summary:'นักเรียนส่วนใหญ่ผ่านเกณฑ์และเข้าใจลำดับคำสั่ง แนะนำให้ฝึกการวางแผนก่อนเริ่มภารกิจ'},entries:{s1:{score:'44',time:'02:31'},s2:{score:'47',time:'02:12'},s3:{score:'39',time:'03:05'},s4:{score:'',time:'',absent:true},s5:{score:'42',time:'02:48'},s6:{score:'45',time:'02:26'},s7:{score:'36',time:'03:19'},s8:{score:'49',time:'01:58'}}}]
};

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
const normalizeTime=v=>{if(v==null||v==='')return '';const s=String(v).trim();if(s.includes(':'))return s;const n=Number(v);if(!Number.isFinite(n))return '';const min=Math.trunc(n),sec=Math.round((n-min)*100);return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`};
export const normalizeExamSet=(value,n=1,robot='')=>{
 const s=cellText(value),fallback=defaultExamForRobot(robot);
 if(!s)return fallback;
 const botleyBasic=s.match(/basic\s*([ab])\s*(\d+)?/i);
 if(botleyBasic)return `Basic ${botleyBasic[1].toUpperCase()}${botleyBasic[2]||1}`;
 const basic=s.match(/basic\s*(\d+)?/i);
 if(basic)return isBotleyRobot(robot)?(basic[1]?`Basic ${basic[1]}`:fallback):`Basic ${basic[1]||1}`;
 const intermediate=s.match(/inter(?:mediate)?\s*(\d+)?/i);
 if(intermediate)return `Intermediate ${intermediate[1]||1}`;
 const advance=s.match(/advance\s*(\d+)?/i);
 if(advance)return `Advance ${advance[1]||1}`;
 return fallback;
};
const parseDate=v=>{const s=cellText(v);if(/^\d{6}$/.test(s)){const y=+s.slice(0,2)+2000,m=+s.slice(2,4),d=+s.slice(4,6);if(m>=1&&m<=12&&d>=1&&d<=31)return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`}const slash=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(slash){const d=+slash[1],m=+slash[2],rawYear=+slash[3],y=rawYear>2400?rawYear-543:rawYear;if(m>=1&&m<=12&&d>=1&&d<=31)return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`}return new Date().toISOString().slice(0,10)};
const isSummarySheet=name=>/^(สรุป(?:ผล|และข้อเสนอแนะ)?|ภาพรวม|รายงานสรุป|summary|overview|dashboard)(?:\s|$)/i.test(cellText(name));

export async function parseSchoolWorkbook(arrayBuffer,fileName){
 const XLSX=await import('xlsx');
 const wb=XLSX.read(arrayBuffer,{type:'array'});
 const sheets=wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null})}));
 const headerValues=(sheets[0]?.rows||[]).slice(0,10).flat().map(cellText).filter(Boolean),headerText=headerValues.join(' ');
 let top=headerValues.find(v=>/^โรงเรียน/.test(v));
 if(!top) top=headerValues.find(v=>v.length>5&&!/รายชื่อ|รายงาน|ลำดับ|ชั้นเรียน|หลักสูตร|เลขประจำตัว|สถานะ|ครู|ว\.ด\.ป\.|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นาย|นางสาว/.test(v));
 const cleanSchoolName = (top || fileName).replace(/\.(xlsx|xls|docx|csv)$/i,'').replace(/^คะแนนทดสอบ[_\s-]*/,'').replace(/[_\s-]*\d{4}-\d{2}-\d{2}$/,'').replace(/^โรงเรียน\s*/,'').replace(/\s*\(ห้อง.*\)/i,'').replace(/\s*อำเภอ.*/,'').replace(/\s*ภาคเรียน.*/,'').replace(/\s*ปีการศึกษา.*/,'').trim();
 const term=headerText.match(/ภาคเรียนที่\s*(\d+)/)?.[1]||'1',year=headerText.match(/ปีการศึกษา\s*(\d{4})/)?.[1]||'2568';
 const school={id:uid('school'),name:cleanSchoolName,year,term,classrooms:[],sessions:[]};

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
  const scoreCols=[];
  for(let r=0;r<Math.min(firstStudentRow,20);r++) {
    for(let c=0;c<(sheet.rows[r]?.length||0)-1;c++) {
      const val = cellText(sheet.rows[r][c]);
      if((val==='50' || val.includes('คะแนน')) && /เวลา|วินาที/i.test(cellText(sheet.rows[r][c+1]))) scoreCols.push(c);
    }
  }
  Object.entries(classGroups).forEach(([cName, groupStudents]) => {
    const classId=uid('class');
    school.classrooms.push({id:classId,name:cName,students:groupStudents.map(({rawClass,rowIdx,...s})=>s)});
    [...new Set(scoreCols)].forEach((col,index)=>{
      const metaRows=sheet.rows.slice(0,firstStudentRow),groupMeta=metaRows.flatMap(r=>[r[col],r[col+1],r[col+2]]).map(cellText).filter(Boolean);
      const testNo=Number(groupMeta.map(v=>v.match(/ครั้งที่\s*(\d+)/)?.[1]).find(Boolean))||index+1;
      const robot=normalizeRobot(groupMeta.find(v=>/code\s*&?\s*go|botley|botzees|mbot\s*2/i.test(v)));
      const exam=normalizeExamSet(groupMeta.find(v=>/inter|advance|begin|basic/i.test(v)),testNo,robot);
      const dateRaw=groupMeta.find(v=>/^\d{6}$/.test(v)||/\d{1,2}\/\d{1,2}\/\d{4}/.test(v));
      const entries={};
      groupStudents.forEach((student)=>{
        const source=sheet.rows[student.rowIdx]||[];
        const score=source[col],time=source[col+1];
        entries[student.id]={score:typeof score==='number'?String(score):'',time:normalizeTime(time),absent:String(score).toLowerCase()==='x'};
      });
      school.sessions.push({id:uid('session'),classId,test:`ครั้งที่ ${testNo}`,date:parseDate(dateRaw),robot,exam,teachingPeriod:'',trainer:'',feedback:{detail:'',summary:''},entries});
    });
    if(!scoreCols.length)school.sessions.push({id:uid('session'),classId,test:'ครั้งที่ 1',date:new Date().toISOString().slice(0,10),robot:'Code & Go',exam:'Basic 1',trainer:'',feedback:{detail:'',summary:''},entries:{}});
  });
 }
 school.classrooms.sort((a,b)=>compareClassNames(a.name, b.name));
 return school;
}

export const calcStats=students=>{const present=students.filter(s=>!s.absent),scored=present.filter(s=>!s.is_special&&s.score!==''&&s.score!==null&&s.score!==undefined&&Number.isFinite(Number(s.score))&&Number(s.score)>=0),scores=scored.map(s=>Number(s.score)),passed=scores.filter(v=>v>=35).length;return {all:students.length,absent:students.length-present.length,present:present.length,avg:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0,rate:scores.length?passed/scores.length*100:0}};

const timeToSeconds=value=>{
 const text=String(value??'').trim();
 if(!text)return Number.NaN;
 const parts=text.split(/[:.]/).map(Number);
 if(parts.length===2&&parts.every(Number.isFinite))return parts[0]*60+parts[1];
 const seconds=Number(text);
 return Number.isFinite(seconds)?seconds:Number.NaN;
};

export const calcRanks=students=>{
  const ranked=students
   .filter(student=>!student.absent&&student.score!==''&&student.score!=null&&Number.isFinite(Number(student.score)))
  .map(student=>{
   const timeValue=timeToSeconds(student.time);
   return {...student,scoreValue:Number(student.score),timeValue:Number.isFinite(timeValue)?timeValue:Number.POSITIVE_INFINITY};
  })
  .sort((a,b)=>b.scoreValue-a.scoreValue||a.timeValue-b.timeValue||Number(a.no)-Number(b.no));
 const ranks={};
 ranked.forEach((student,index)=>{
  const previous=ranked[index-1];
  ranks[student.id]=previous&&student.scoreValue===previous.scoreValue&&student.timeValue===previous.timeValue?ranks[previous.id]:index+1;
 });
 return ranks;
};
