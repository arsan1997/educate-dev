import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from './model';
import {supabase,isSupabaseConfigured} from './supabase';
import {loadSchools,saveSchools,deleteSchool} from './dataService';
import brandLogo from './assets/logo.png';
import './styles.css';
import './dynamic.css';

const seed = [
  {id:1,no:1,name:'เด็กชายภาคิน ศรีสุข',score:'44',time:'02:31',absent:false},
  {id:2,no:2,name:'เด็กหญิงปุณณภา ใจดี',score:'47',time:'02:12',absent:false},
  {id:3,no:3,name:'เด็กชายธนกฤต พูนทรัพย์',score:'39',time:'03:05',absent:false},
  {id:4,no:4,name:'เด็กหญิงกัญญาวีร์ แสงทอง',score:'',time:'',absent:true},
  {id:5,no:5,name:'เด็กชายณัฐดนัย คงมั่น',score:'42',time:'02:48',absent:false},
  {id:6,no:6,name:'เด็กหญิงพิชญาภา วงศ์ดี',score:'45',time:'02:26',absent:false},
  {id:7,no:7,name:'เด็กชายศุภวิชญ์ มีสุข',score:'36',time:'03:19',absent:false},
  {id:8,no:8,name:'เด็กหญิงธัญชนก พิพัฒน์',score:'49',time:'01:58',absent:false},
];
const classes=[{name:'ป.4/1',students:32,avg:42.6,pass:91},{name:'ป.4/2',students:30,avg:39.8,pass:83},{name:'ป.5/1',students:35,avg:44.1,pass:94},{name:'ป.5/2',students:34,avg:41.3,pass:88}];
const tabs=[['dashboard','ภาพรวม',LayoutDashboard],['classroom','จัดการชั้นเรียน',Users],['scores','บันทึกผลทดสอบ',ClipboardPenLine],['reports','รายงาน',FileText]];
const restore=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const schoolIdentity=value=>[value?.name,value?.year,value?.term].map(part=>String(part??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('th-TH')).join('|');

function ConfirmModal({title='ยืนยันการทำรายการ',message,onConfirm,onClose,dangerLabel='ยืนยันลบ',danger=true}){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal-card confirm-card"><div className="confirm-icon"><AlertCircle size={48}/></div><h3>{title}</h3><p>{message}</p><div className="modal-actions"><button type="button" className="button" onClick={onClose}>ยกเลิก</button><button type="button" className={`primary${danger?' danger-btn':''}`} onClick={()=>{onConfirm();onClose()}}>{dangerLabel}</button></div></div></div>}

function AddSchoolModal({onClose,onAdd}){
  const [form,setForm]=useState({name:'',year:new Date().getFullYear()+543,term:'1',levels:''});
  const valid=form.name.trim()&&form.levels.trim();
  const submit=e=>{
    e.preventDefault();
    if(!valid)return;
    const classrooms=form.levels.split(',').map(n=>n.trim()).filter(Boolean).map(n=>({id:`class-${Date.now()}-${Math.random()}`,name:n,students:[]}));
    onAdd({...form,classrooms});
  };
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <form className="modal-card" onSubmit={submit}>
      <div className="modal-head"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h2>เพิ่มโรงเรียนใหม่</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="ปิด"><X/></button></div>
      <div style={{padding:'22px 24px',display:'flex',flexDirection:'column',gap:'15px'}}>
        <Field label="ชื่อโรงเรียน"><input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="เช่น โรงเรียนศรีบางลางวิทยานุสรณ์"/></Field>
        <div className="form-grid mini" style={{padding:0}}>
          <Field label="ปีการศึกษา"><input type="number" value={form.year} onChange={e=>setForm({...form,year:e.target.value})}/></Field>
          <Field label="ภาคเรียนที่"><input type="number" value={form.term} onChange={e=>setForm({...form,term:e.target.value})}/></Field>
        </div>
        <Field label="รายชื่อชั้นเรียน (แยกด้วยเครื่องหมายจุลภาค , )"><textarea value={form.levels} onChange={e=>setForm({...form,levels:e.target.value})} placeholder="เช่น ป.1/1, ป.1/2, ป.2/1" style={{height:'80px'}}/></Field>
      </div>
      <div className="modal-actions"><button type="button" className="button" onClick={onClose}>ยกเลิก</button><button className="primary" disabled={!valid}><Plus/>สร้างโรงเรียน</button></div>
    </form>
  </div>
}

function App({user,onSignOut}){
  const [dark,setDark]=useState(()=>restore('erp-dark',false)),[tab,setTab]=useState('dashboard'),[schools,setSchools]=useState(()=>restore('erp-schools-v2',[])),[toast,setToast]=useState('');
  const [schoolId,setSchoolId]=useState(()=>restore('erp-active-school',null)),[classId,setClassId]=useState(()=>restore('erp-active-class',null)),[sessionId,setSessionId]=useState(()=>restore('erp-active-session',null));
  const [confirming,setConfirming]=useState(null),[schoolAdding,setSchoolAdding]=useState(false);
  const refs=useRef({}),cloudReady=useRef(false),[cloudStatus,setCloudStatus]=useState('loading'),school=schools.find(s=>s.id===schoolId)||schools[0],classroom=school?.classrooms.find(c=>c.id===classId)||school?.classrooms[0];
  const classSessions=school?.sessions.filter(s=>s.classId===classroom?.id)||[],session=classSessions.find(s=>s.id===sessionId)||classSessions[0];
  const students=(classroom?.students||[]).map(s=>({...s,score:'',time:'',absent:false,...(session?.entries?.[s.id]||{})}));
  const meta={school:school?.name||'',year:school?.year||'',term:school?.term||'',level:classroom?.name||'',test:session?.test||'',date:session?.date||'',robot:session?.robot||'',exam:session?.exam||'',trainer:session?.trainer||''};
  const feedback=session?.feedback||{detail:'',summary:''},stats=useMemo(()=>calcStats(students),[students]);
  const dashboardRows=(school?.classrooms||[]).map(c=>{
    const latest=school.sessions.filter(s=>s.classId===c.id).at(-1),
    merged=c.students.map(st=>({...st,...(latest?.entries?.[st.id]||{})})),
    x=calcStats(merged);
    const scored=merged.filter(st=>!st.absent&&st.score!==''&&st.score!=null&&Number.isFinite(Number(st.score)));
    return {
      name:c.name,
      students:c.students.length,
      passed:scored.filter(st=>Number(st.score)>=35).length,
      failed:scored.filter(st=>Number(st.score)<35).length,
      absent:merged.filter(st=>st.absent).length,
      pending:merged.length-scored.length-merged.filter(st=>st.absent).length,
      avg:x.avg,
      pass:x.avg/50*100,
      tests:school.sessions.filter(s=>s.classId===c.id).length,
      feedback: latest?.feedback || { detail: '', summary: '' }
    }
  });
  const dashboardStats=calcStats((school?.classrooms||[]).flatMap(c=>{const latest=school.sessions.filter(s=>s.classId===c.id).at(-1);return c.students.map(st=>({...st,...(latest?.entries?.[st.id]||{})}))}));
  useEffect(()=>localStorage.setItem('erp-schools-v2',JSON.stringify(schools)),[schools]);
  useEffect(()=>{
    localStorage.setItem('erp-dark',JSON.stringify(dark));
    if(dark) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  },[dark]);
  useEffect(()=>localStorage.setItem('erp-active-school',JSON.stringify(school?.id)),[school?.id]);useEffect(()=>localStorage.setItem('erp-active-class',JSON.stringify(classroom?.id)),[classroom?.id]);useEffect(()=>localStorage.setItem('erp-active-session',JSON.stringify(session?.id)),[session?.id]);
  useEffect(()=>{let active=true;(async()=>{try{setCloudStatus('loading');const remote=await loadSchools();if(!active)return;if(remote.length>0){setSchools(remote);setSchoolId(remote[0].id);setClassId(remote[0].classrooms[0]?.id);setSessionId(remote[0].sessions[0]?.id)}else{setSchools([]);setSchoolId(null);setClassId(null);setSessionId(null);}cloudReady.current=true;setCloudStatus('saved')}catch(e){console.error(e);setCloudStatus(e.code==='42P01'?'setup':'error')}})();return()=>{active=false}},[user.id]);
  useEffect(()=>{if(!cloudReady.current)return;setCloudStatus('saving');const timer=setTimeout(async()=>{try{const cleanSchools=schools.map(s=>({...s,sessions:s.sessions.map(sess=>({...sess,date:sess.date||new Date().toISOString().slice(0,10),entries:Object.fromEntries(Object.entries(sess.entries||{}).map(([k,v])=>[k,{...v,score:v.absent?'':(v.score===''||v.score==null?'':String(Math.max(0,Math.min(50,Number(v.score)||0))))}]))}))}));await saveSchools(cleanSchools,user.id);setCloudStatus('saved')}catch(e){console.error(e);setCloudStatus(e.code==='42P01'?'setup':'error')}},900);return()=>clearTimeout(timer)},[schools,user.id]);
  const flash=t=>{setToast(t);setTimeout(()=>setToast(''),2400)},mutateSchool=fn=>setSchools(all=>all.map(s=>s.id===school.id?fn(s):s));
  const selectSchool=id=>{const s=schools.find(x=>x.id===id);setSchoolId(id);setClassId(s?.classrooms[0]?.id);setSessionId(s?.sessions.find(x=>x.classId===s?.classrooms[0]?.id)?.id)};
  const selectSchoolAfter=s=>{setSchoolId(s.id);setClassId(s.classrooms[0]?.id);setSessionId(s.sessions[0]?.id);setTab('classroom')};
  const selectClass=id=>{setClassId(id);setSessionId(school.sessions.find(s=>s.classId===id)?.id)};
  const setMeta=next=>mutateSchool(s=>({...s,name:next.school,year:next.year,term:next.term,sessions:s.sessions.map(x=>x.id===session?.id?{...x,test:next.test,date:next.date,robot:next.robot,exam:next.exam,trainer:next.trainer}:x)}));
  const setFeedback=next=>mutateSchool(s=>({...s,sessions:s.sessions.map(x=>x.id===session.id?{...x,feedback:next}:x)}));
  const update=(id,key,val)=>mutateSchool(s=>({...s,sessions:s.sessions.map(x=>x.id===session.id?{...x,entries:{...x.entries,[id]:{...x.entries[id],[key]:val}}}:x)}));
  const setStudents=nextOrFn=>{const next=typeof nextOrFn==='function'?nextOrFn(students):nextOrFn;mutateSchool(s=>({...s,classrooms:s.classrooms.map(c=>c.id===classroom.id?{...c,students:next.map(({score,time,absent,...student})=>student)}:c),sessions:s.sessions.map(x=>x.id===session.id?{...x,entries:Object.fromEntries(next.map(st=>[st.id,{score:st.score,time:st.time,absent:st.absent}]))}:x)}))};
  const move=(i,key,e)=>{if(['Enter','ArrowDown'].includes(e.key)){e.preventDefault();refs.current[`${i+1}-${key}`]?.focus()}};
  const importExcel=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=async ev=>{try{
   flash('กำลังอ่านไฟล์ Excel...');
   const imported=await parseSchoolWorkbook(ev.target.result,f.name);
   if(!imported.classrooms.length)throw Error('ไม่พบรายชื่อนักเรียน');
   const duplicate=schools.find(item=>schoolIdentity(item)===schoolIdentity(imported));
   if(duplicate){
    setConfirming({title:'พบข้อมูลโรงเรียนนี้แล้ว',message:`${duplicate.name} ปีการศึกษา ${duplicate.year} ภาคเรียนที่ ${duplicate.term} มีอยู่ในระบบแล้ว เพื่อป้องกันข้อมูลซ้ำ ระบบจะไม่นำเข้าเป็นรายการใหม่`,dangerLabel:'เปิดข้อมูลเดิม',danger:false,onConfirm:()=>{selectSchoolAfter(duplicate);flash('เปิดข้อมูลโรงเรียนเดิมแล้ว')}});
    return;
   }
   setSchools(v=>[...v,imported]);selectSchoolAfter(imported);flash(`นำเข้า ${imported.name}: ${imported.classrooms.length} ห้อง ${imported.sessions.length} ครั้งทดสอบ`);
  }catch(err){flash(`นำเข้าไม่สำเร็จ: ${err.message}`)}};r.readAsArrayBuffer(f)};
  const addSchool=data=>{
   const candidate={name:data.name,year:String(data.year),term:String(data.term)},duplicate=schools.find(item=>schoolIdentity(item)===schoolIdentity(candidate));
   if(duplicate){setSchoolAdding(false);selectSchoolAfter(duplicate);flash(`โรงเรียน ${duplicate.name} มีอยู่แล้ว — เปิดข้อมูลเดิมให้แล้ว`);return;}
   const sid=`school-${Date.now()}`,sessions=data.classrooms.map(c=>({id:`session-${Date.now()}-${Math.random()}`,classId:c.id,test:'ครั้งที่ 1',date:new Date().toISOString().slice(0,10),robot:'Code & Go',exam:'Intermediate 1',trainer:'',feedback:{detail:'',summary:''},entries:{}})),s={id:sid,...candidate,classrooms:data.classrooms,sessions};setSchools(v=>[...v,s]);setSchoolAdding(false);selectSchoolAfter(s);flash(`สร้างโรงเรียน ${data.name} เรียบร้อยแล้ว`);
  };
  const addSession=()=>{const id=`session-${Date.now()}`,n=classSessions.length+1;mutateSchool(s=>({...s,sessions:[...s.sessions,{id,classId:classroom.id,test:`ครั้งที่ ${n}`,date:new Date().toISOString().slice(0,10),robot:'Code & Go',exam:`Intermediate ${n}`,trainer:session?.trainer||'',feedback:{detail:'',summary:''},entries:{}}]}));setSessionId(id)};
 
  const exportExcelLegacy=async ()=>{
    if(!school)return;
    try{
    const {default:ExcelJS}=await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const usedSheetNames=new Set();
    const safeSheetName=raw=>{
      const base=String(raw||'ชีต').replace(/[\\/*?:\[\]]/g,'-').replace(/^'+|'+$/g,'').trim().slice(0,31)||'ชีต';
      let name=base,index=2;
      while(usedSheetNames.has(name.toLowerCase())){
        const suffix=`-${index++}`;
        name=base.slice(0,31-suffix.length)+suffix;
      }
      usedSheetNames.add(name.toLowerCase());
      return name;
    };
    const FONT_NAME = 'TH Sarabun New';
    const FONT_REG = { name: FONT_NAME, size: 14 };
    const FONT_BOLD = { name: FONT_NAME, size: 14, bold: true };
    const BORDER_THIN = {
      top: {style:'thin', color: {argb: 'FFD9D9D9'}},
      left: {style:'thin', color: {argb: 'FFD9D9D9'}},
      bottom: {style:'thin', color: {argb: 'FFD9D9D9'}},
      right: {style:'thin', color: {argb: 'FFD9D9D9'}}
    };
    
    // 0. Summary Sheet
    const summarySheet = workbook.addWorksheet(safeSheetName('สรุปผลภาพรวม'));
    summarySheet.addRow([]); // Gap
    const titleRow = summarySheet.getRow(2);
    titleRow.getCell(2).value = `รายงานผลสัมฤทธิ์: ${school.name}`;
    titleRow.getCell(2).font = { name: FONT_NAME, size: 22, bold: true, color: { argb: 'FF34443E' } };
    summarySheet.mergeCells(2, 2, 2, 12);
    
    summarySheet.getRow(3).getCell(2).value = `หลักสูตร SCHOOL ROBOTICS · ภาคเรียนที่ ${school.term}/${school.year}`;
    summarySheet.getRow(3).getCell(2).font = { name: FONT_NAME, size: 16, color: { argb: 'FF666666' } };
    summarySheet.mergeCells(3, 2, 3, 12);

    const applyHeaderStyle = (cell) => {
      cell.font = FONT_BOLD;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EEE9' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    };

    const sHRow = summarySheet.getRow(5);
    ['ชั้นเรียน', 'นักเรียน', 'ครั้งที่ 1', 'ครั้งที่ 2', 'ครั้งที่ 3', 'ครั้งที่ 4', 'ครั้งที่ 5', 'ครั้งที่ 6'].forEach((h, i) => {
      const cell = sHRow.getCell(i + 2);
      cell.value = h;
      applyHeaderStyle(cell);
      summarySheet.getColumn(i + 2).width = i === 0 ? 25 : 15;
    });

    school.classrooms.forEach((c, idx) => {
      const row = summarySheet.getRow(6 + idx);
      const nameCell = row.getCell(2);
      const countCell = row.getCell(3);
      nameCell.value = c.name;
      countCell.value = c.students.length;
      [nameCell, countCell].forEach(cell => {
        cell.font = FONT_REG;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = BORDER_THIN;
      });

      for (let i = 1; i <= 6; i++) {
        const sess = school.sessions.find(s => s.classId === c.id && s.test === `ครั้งที่ ${i}`);
        const cell = row.getCell(3 + i);
        if (sess) {
          const stats = calcStats(c.students.map(st => ({...st, ...(sess.entries?.[st.id] || {})})));
          const classroomAveragePercent=stats.avg/50;
          cell.value = Number(classroomAveragePercent.toFixed(4));
          cell.numFmt = '0.0%';
          cell.font = { ...FONT_REG, color: { argb: classroomAveragePercent > .65 ? 'FF174A8B' : 'FFFF0000' } };
        } else {
          cell.value = '-';
          cell.font = { ...FONT_REG, color: { argb: 'FFCCCCCC' } };
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = BORDER_THIN;
      }
    });

    // 1. Classroom Sheets
    school.classrooms.forEach(c => {
      const ws = workbook.addWorksheet(safeSheetName(c.name));
      ws.getRow(1).getCell(1).value = `รายชื่อนักเรียนและผลการประเมิน ชั้น ${c.name}`;
      ws.getRow(1).getCell(1).font = { name: FONT_NAME, size: 20, bold: true };
      ws.mergeCells(1, 1, 1, 12);

      const sessions = school.sessions.filter(s => s.classId === c.id);
      const hRow = ws.getRow(3);
      ['เลขที่', 'ชื่อ-นามสกุล'].forEach((h, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = h;
        applyHeaderStyle(cell);
      });
      ws.getColumn(1).width = 10;
      ws.getColumn(2).width = 40;

      sessions.forEach((s, i) => {
        const cell = hRow.getCell(3 + i);
        cell.value = s.test;
        applyHeaderStyle(cell);
        ws.getColumn(3 + i).width = 15;
      });

      c.students.forEach((st, idx) => {
        const row = ws.getRow(4 + idx);
        const noCell = row.getCell(1);
        const nameCell = row.getCell(2);
        noCell.value = st.no;
        nameCell.value = st.name;
        [noCell, nameCell].forEach(cell => {
          cell.font = FONT_REG;
          cell.alignment = { vertical: 'middle', horizontal: cell === nameCell ? 'left' : 'center' };
          cell.border = BORDER_THIN;
        });

        sessions.forEach((sess, si) => {
          const cell = row.getCell(3 + si);
          const entry = sess.entries?.[st.id];
          if (entry) {
            if (entry.absent) {
              cell.value = 'ข';
              cell.font = { ...FONT_REG, color: { argb: 'FFFF0000' } };
            } else {
              cell.value = Number(entry.score) || 0;
              cell.font = FONT_REG;
            }
          }
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = BORDER_THIN;
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `WebGen_${school.name}_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(()=>window.URL.revokeObjectURL(url),1000);
    flash('ส่งออก Excel เรียบร้อยแล้ว');
    }catch(error){
      console.error('Excel export failed',error);
      flash(`ส่งออก Excel ไม่สำเร็จ: ${error.message||'โปรดลองอีกครั้ง'}`);
    }
  };

  const exportExcel=async()=>{
   if(!school)return;
   try{
    flash('กำลังเตรียมไฟล์ Excel...');
    const [{default:ExcelJS},{logoBase64}]=await Promise.all([
     import('exceljs'),
     import('./assets/logoBase64')
    ]);
    const workbook=new ExcelJS.Workbook();
    workbook.creator='School Robotics Assessment';
    workbook.created=new Date();
    const FONT='TH Sarabun New';
    const thin={top:{style:'thin',color:{argb:'FF555555'}},left:{style:'thin',color:{argb:'FF555555'}},bottom:{style:'thin',color:{argb:'FF555555'}},right:{style:'thin',color:{argb:'FF555555'}}};
    const sessionColors=['FF8DB3E2','FFE6B8B7','FFC4D6A0','FFC4B7D7'];
    const usedNames=new Set();
    const sheetName=raw=>{
     const base=String(raw||'ชีต').replace(/\//g,'.').replace(/[\\*?:\[\]]/g,'-').slice(0,31)||'ชีต';
     let value=base,n=2;
     while(usedNames.has(value.toLowerCase())){const suffix=`-${n++}`;value=base.slice(0,31-suffix.length)+suffix;}
     usedNames.add(value.toLowerCase());return value;
    };
    const center={vertical:'middle',horizontal:'center',wrapText:true};
    const styleRange=(ws,range,{fill,bold=false,size=14,alignment=center}={})=>{
     ws.getCell(range.split(':')[0]);
     ws.getRows(1,ws.rowCount||1);
     const [start,end=range]=range.split(':'),decode=a=>{const m=a.match(/([A-Z]+)(\d+)/);let col=0;for(const ch of m[1])col=col*26+ch.charCodeAt(0)-64;return {row:+m[2],col}};
     const a=decode(start),b=decode(end);
     for(let r=a.row;r<=b.row;r++)for(let c=a.col;c<=b.col;c++){const cell=ws.getRow(r).getCell(c);cell.font={name:FONT,size,bold};cell.alignment=alignment;cell.border=thin;if(fill)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};}
    };
    const outlineRange=(ws,top,left,bottom,right)=>{
     const edge={style:'medium',color:{argb:'FF707070'}};
     for(let c=left;c<=right;c++){
      const topCell=ws.getRow(top).getCell(c),bottomCell=ws.getRow(bottom).getCell(c);
      topCell.border={...topCell.border,top:edge};bottomCell.border={...bottomCell.border,bottom:edge};
     }
     for(let r=top;r<=bottom;r++){
      const leftCell=ws.getRow(r).getCell(left),rightCell=ws.getRow(r).getCell(right);
      leftCell.border={...leftCell.border,left:edge};rightCell.border={...rightCell.border,right:edge};
     }
    };
    const thaiDate=value=>{
     if(!value)return '-';const [y,m,d]=String(value).slice(0,10).split('-').map(Number);
     return y&&m&&d?`${d}/${m}/${y+543}`:'-';
    };
    const sessionFor=(classroom,index)=>{
     const target=`ครั้งที่ ${index+1}`;
     return school.sessions.find(s=>s.classId===classroom.id&&s.test===target)||school.sessions.filter(s=>s.classId===classroom.id)[index];
    };
    const logoRaw=logoBase64?.replace(/^data:image\/[^;]+;base64,/, '');
    const imageId=logoRaw?workbook.addImage({base64:logoRaw,extension:'png'}):null;

    // ชีตรายห้อง: คะแนน เวลา และลำดับแบบเดียวกับไฟล์ต้นฉบับ
    school.classrooms.forEach(classroom=>{
     const ws=workbook.addWorksheet(sheetName(classroom.name),{views:[{state:'frozen',ySplit:12,xSplit:2,showGridLines:false}]});
     ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1,paperSize:9,margins:{left:.25,right:.25,top:.35,bottom:.35,header:.1,footer:.1}};
     ws.mergeCells('A1:D1');ws.getCell('A1').value=school.name;
     ws.mergeCells('F1:Q1');ws.getCell('F1').value='ผลการทดสอบและประเมินผลการเรียน School Robotics';
     ws.mergeCells('A3:D3');ws.getCell('A3').value=`ชั้น ${classroom.name}`;
     ws.mergeCells('F3:Q3');ws.getCell('F3').value='หลักสูตร School Robotics';
     ws.mergeCells('F5:Q5');ws.getCell('F5').value=`ภาคเรียนที่ ${school.term} ปีการศึกษา ${school.year}`;
     ['A1:D1','F1:Q1','A3:D3','F3:Q3','F5:Q5'].forEach(range=>styleRange(ws,range,{bold:true,size:range==='F1:Q1'?18:16,alignment:{vertical:'middle',horizontal:range.startsWith('A')?'left':'center'}}));
     ws.mergeCells('A8:A12');ws.getCell('A8').value='เลขที่';
     ws.mergeCells('B8:D12');ws.getCell('B8').value='ชื่อ-สกุล';
     ws.mergeCells('F8:Q8');ws.getCell('F8').value='คะแนนสอบ/ครั้งที่';
     styleRange(ws,'A8:D12',{fill:'FFEAF1DE',bold:true});styleRange(ws,'F8:Q12',{fill:'FFEAF1DE',bold:true});
     const starts=[6,9,12,15];
     const roomSessions=school.sessions.filter(s=>s.classId===classroom.id).slice(0,4);
     starts.forEach((col,index)=>{
      const sess=roomSessions[index],end=col+2;
      ws.mergeCells(9,col,9,end);ws.getRow(9).getCell(col).value=sess?.test||`ครั้งที่ ${index+1}`;
      ws.mergeCells(10,col,10,end);ws.getRow(10).getCell(col).value=sess?`${thaiDate(sess.date)} · ${sess.robot||'-'}`:'';
      ws.mergeCells(11,col,11,end);ws.getRow(11).getCell(col).value=sess?.exam||'';
      ws.getRow(12).getCell(col).value=50;ws.getRow(12).getCell(col+1).value='เวลา';ws.getRow(12).getCell(col+2).value='ลำดับ';
     });
     classroom.students.forEach((student,index)=>{
      const row=13+index;ws.getRow(row).height=22;ws.getRow(row).getCell(1).value=student.no;ws.getRow(row).getCell(2).value=student.name;ws.mergeCells(row,2,row,4);
      styleRange(ws,`A${row}:D${row}`,{size:14,alignment:{vertical:'middle',horizontal:'left'}});ws.getRow(row).getCell(1).alignment=center;
      roomSessions.forEach((sess,si)=>{
       const col=starts[si],entry=sess.entries?.[student.id],ranks=calcRanks(classroom.students.map(st=>({...st,...(sess.entries?.[st.id]||{})})));
       ws.getRow(row).getCell(col).value=entry?.absent?'x':entry?.score===''||entry?.score==null?'':Number(entry.score);
       ws.getRow(row).getCell(col+1).value=entry?.absent?'':entry?.time||'';
       ws.getRow(row).getCell(col+2).value=entry?.absent?'':ranks[student.id]||'';
       styleRange(ws,`${ws.getRow(row).getCell(col).address}:${ws.getRow(row).getCell(col+2).address}`,{fill:si%2?'FFFCE4D6':undefined,size:13});
      });
     const lastStudentRow=Math.max(12,12+classroom.students.length);
     outlineRange(ws,8,1,lastStudentRow,4);
     starts.forEach(col=>outlineRange(ws,8,col,lastStudentRow,col+2));
     });
     ws.mergeCells('T8:AB8');ws.getCell('T8').value='สรุปผลคะแนนการทดสอบ';
     const summaryHeaders=['ครั้งที่','คะแนนเฉลี่ย','เฉลี่ยรายห้อง','ต่ำกว่า 35','ขาดสอบ','การประเมิน'];
     [20,22,24,26,27,28].forEach((col,i)=>ws.getRow(9).getCell(col).value=summaryHeaders[i]);
     styleRange(ws,'T8:AB9',{fill:'FFFCE4D6',bold:true,size:13});
     roomSessions.forEach((sess,index)=>{
      const row=10+index,merged=classroom.students.map(st=>({...st,...(sess.entries?.[st.id]||{})})),x=calcStats(merged),avgPercent=x.avg/50*100;
      ws.getRow(row).getCell(20).value=sess.test;ws.getRow(row).getCell(22).value=Number(x.avg.toFixed(2));ws.getRow(row).getCell(24).value=avgPercent/100;ws.getRow(row).getCell(24).numFmt='0.00%';
      ws.getRow(row).getCell(26).value=merged.filter(st=>!st.absent&&st.score!==''&&Number(st.score)<35).length;ws.getRow(row).getCell(27).value=x.absent;ws.getRow(row).getCell(28).value=avgPercent>65?'ผ่าน':'ไม่ผ่าน';
      styleRange(ws,`T${row}:AB${row}`,{size:13});
     });
     outlineRange(ws,8,20,Math.max(13,9+roomSessions.length),28);
     ws.getColumn(1).width=8;ws.getColumn(2).width=16;ws.getColumn(3).width=16;ws.getColumn(4).width=16;ws.getColumn(5).width=2;
     for(let c=6;c<=17;c++)ws.getColumn(c).width=c%3===1?9:10;
     ws.getColumn(18).width=2;for(let c=20;c<=28;c++)ws.getColumn(c).width=13;
     if(imageId!==null)ws.addImage(imageId,{tl:{col:21,row:.25},ext:{width:210,height:74}});
    });

    // ชีตสรุป: ครั้งที่ 1-4 แยกสีตามต้นฉบับ
    const summary=workbook.addWorksheet(sheetName('สรุป'),{views:[{state:'frozen',ySplit:6,xSplit:2,showGridLines:false}]});
    summary.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1,paperSize:9};
    summary.mergeCells('A1:V1');summary.getCell('A1').value=school.name;
    summary.mergeCells('A2:V2');summary.getCell('A2').value='หลักสูตร School Robotics';
    summary.mergeCells('A3:V3');summary.getCell('A3').value=`ภาคเรียนที่ ${school.term} ปีการศึกษา ${school.year}`;
    ['A1:V1','A2:V2','A3:V3'].forEach((r,i)=>styleRange(summary,r,{bold:true,size:i===0?22:18}));
    summary.mergeCells('A4:A6');summary.getCell('A4').value='ชั้น';summary.mergeCells('B4:B6');summary.getCell('B4').value='จำนวน';
    styleRange(summary,'A4:B6',{fill:'FFFCE4D6',bold:true,size:14});
    const groupStarts=[3,8,13,18];
    groupStarts.forEach((start,index)=>{
     const end=start+4,color=sessionColors[index];summary.mergeCells(4,start,4,end);summary.getRow(4).getCell(start).value=`ครั้งที่ ${index+1}`;
     summary.mergeCells(5,start,5,end);const sample=school.classrooms.map(c=>sessionFor(c,index)).find(Boolean);summary.getRow(5).getCell(start).value=sample?`วันที่ ${thaiDate(sample.date)}`:'';
     ['หุ่นยนต์','แบบทดสอบ','เฉลี่ยรายห้อง','ประเมิน','วิทยากร'].forEach((h,i)=>summary.getRow(6).getCell(start+i).value=h);
     styleRange(summary,`${summary.getRow(4).getCell(start).address}:${summary.getRow(6).getCell(end).address}`,{fill:color,bold:true,size:13});
    });
    school.classrooms.forEach((classroom,index)=>{
     const row=7+index;summary.getRow(row).getCell(1).value=classroom.name;summary.getRow(row).getCell(2).value=classroom.students.length;styleRange(summary,`A${row}:B${row}`,{size:14});
     groupStarts.forEach((start,si)=>{
       const sess=sessionFor(classroom,si);if(!sess)return;const x=calcStats(classroom.students.map(st=>({...st,...(sess.entries?.[st.id]||{})}))),pct=x.avg/50;
      summary.getRow(row).getCell(start).value=sess.robot||'-';summary.getRow(row).getCell(start+1).value=(sess.exam||'').replace(/\s+(?=\d)/g,'');summary.getRow(row).getCell(start+2).value=pct;summary.getRow(row).getCell(start+2).numFmt='0.00%';summary.getRow(row).getCell(start+3).value=pct>.65?'ผ่าน':'ไม่ผ่าน';summary.getRow(row).getCell(start+4).value=sess.trainer||'-';
      styleRange(summary,`${summary.getRow(row).getCell(start).address}:${summary.getRow(row).getCell(start+4).address}`,{size:13});
     });
    });
    const totalRow=7+school.classrooms.length;summary.getRow(totalRow).getCell(1).value='รวม';summary.getRow(totalRow).getCell(2).value=school.classrooms.reduce((sum,c)=>sum+c.students.length,0);styleRange(summary,`A${totalRow}:V${totalRow}`,{bold:true,size:14});
    outlineRange(summary,4,1,totalRow,2);groupStarts.forEach(start=>outlineRange(summary,4,start,totalRow,start+4));
    summary.getColumn(1).width=12;summary.getColumn(2).width=10;for(let c=3;c<=22;c++)summary.getColumn(c).width=c%5===0?18:14;
    if(imageId!==null)summary.addImage(imageId,{tl:{col:17,row:.15},ext:{width:210,height:74}});

    const buffer=await workbook.xlsx.writeBuffer();
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=`คะแนนทดสอบ_${school.name}_${new Date().toISOString().slice(0,10)}.xlsx`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);flash('ส่งออก Excel เรียบร้อยแล้ว');
   }catch(error){console.error('Excel export failed',error);flash(`ส่งออก Excel ไม่สำเร็จ: ${error.message||'โปรดลองอีกครั้ง'}`);}
  };

 const exportPDF=async()=>{
  if(!school)return;
  flash('กำลังเตรียมไฟล์ PDF...');
  const [pdfModule,autoTableModule,{logoBase64},{fontBase64}]=await Promise.all([
   import('jspdf'),
   import('jspdf-autotable'),
   import('./assets/logoBase64'),
   import('./assets/fontBase64')
  ]);
  const jsPDF=pdfModule.jsPDF||pdfModule.default;
  const autoTable=autoTableModule.default||autoTableModule.autoTable;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  doc.addFileToVFS('THSarabun.ttf',fontBase64);
  doc.addFont('THSarabun.ttf','THSarabun','normal');
  const optimizeLogo=src=>new Promise(resolve=>{
   const img=new Image();
   img.onload=()=>{
    const canvas=document.createElement('canvas'),width=1200,height=Math.round(width*img.height/img.width);
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
    resolve(canvas.toDataURL('image/jpeg',.88));
   };
   img.onerror=()=>resolve(null);img.src=src;
  });

  const term=school.term||'2';
  const year=school.year||'2568';
  const displaySchoolName=school.name.replace(/^โรงเรียน\s*/,'').trim();
  const fileSchoolName=/^โรงเรียน/.test(school.name)?school.name:`โรงเรียน${school.name}`;
  const testNumber=(session?.test||'').match(/\d+/)?.[0]||'1';
  const formatThaiDate=value=>{
   if(!value)return '-';
   const [y,m,d]=String(value).slice(0,10).split('-').map(Number);
   return y&&m&&d?`${d}/${m}/${y+543}`:'-';
  };
  const sessionFor=c=>school.sessions.find(s=>s.classId===c.id&&s.test===session?.test)||school.sessions.filter(s=>s.classId===c.id).at(-1)||{};

  // ตำแหน่งและสัดส่วนอ้างอิงจากไฟล์ตัวอย่างในโฟลเดอร์ excel
  const optimizedLogo=logoBase64?await optimizeLogo(logoBase64):null;
  if(optimizedLogo)doc.addImage(optimizedLogo,'JPEG',62.3,15,68.4,23.1,undefined,'FAST');
  doc.setTextColor(0,0,0);
  doc.setFont('THSarabun','normal');
  doc.setFontSize(14);
  doc.text('การประเมินคุณภาพหลักสูตรหุ่นยนต์ SCHOOL ROBOTICS',105,49,{align:'center'});

  doc.setFontSize(14);
  doc.text(`โรงเรียน : ${displaySchoolName}`,14.8,57);
  doc.setFont('THSarabun','normal');
  doc.setFont('THSarabun','normal');
  doc.text('สรุปผลสัมฤทธิ์และข้อเสนอแนะในการเรียนหุ่นยนต์ SCHOOL ROBOTICS',14.8,65.5);
  doc.text(`ประจำปี การศึกษา : ${term}/${year}`,14.8,74);
  doc.setFont('THSarabun','normal');
  doc.setFont('THSarabun','normal');
  doc.text(`จำนวนห้องเรียน : ${school.classrooms.length} ห้องเรียน`,14.8,82);
  doc.text(`ครั้งที่  :  ${testNumber}`,14.8,91.5);
  doc.text(`วันที่ : ${formatThaiDate(session?.date)}`,14.8,101);

  const detailRows=school.classrooms.map(c=>{
   const sess=sessionFor(c),entries=sess.entries||{};
   const absent=c.students.filter(st=>entries[st.id]?.absent).length;
   const examName=(sess.exam||`Intermediate ${testNumber}`).replace(/\s+(?=\d)/g,'');
   return [c.name,c.students.length,absent,sess.robot||'Code & Go','16',term,examName,sess.trainer||'-'];
  });

  doc.setFillColor(217,225,242);
  doc.setDrawColor(0,0,0);
  doc.setLineWidth(.3);
  doc.rect(14.3,109,175.9,8.5,'FD');
  doc.setFont('THSarabun','normal');
  doc.setFontSize(14);
  doc.text('รายละเอียดการทดสอบ',102.25,115,{align:'center'});

  autoTable(doc,{
   startY:117.5,
   margin:{left:14.3,right:19.8},
   tableWidth:175.9,
   theme:'grid',
   head:[['ระดับชั้น','จำนวน\nนักเรียน','ขาดสอบ','ชื่อหุ่นยนต์\n(Robot)','คาบสอน\nปัจจุบัน','เทอม','ชุดข้อสอบ','วิทยากร\nผู้ประเมิน']],
   body:detailRows,
   styles:{font:'THSarabun',fontSize:12,cellPadding:1.2,halign:'center',valign:'middle',lineWidth:.3,lineColor:[0,0,0],textColor:[0,0,0],fillColor:[255,255,255]},
   headStyles:{font:'THSarabun',fontStyle:'normal',fontSize:11,cellPadding:.5,fillColor:[217,225,242],textColor:[0,0,0],minCellHeight:17},
   bodyStyles:{minCellHeight:8.5},
   columnStyles:{
    0:{cellWidth:20},1:{cellWidth:17},2:{cellWidth:17},3:{cellWidth:27},
    4:{cellWidth:19},5:{cellWidth:13},6:{cellWidth:29},7:{cellWidth:33.9}
   }
  });

  const feedbackRows=school.classrooms.map(c=>{
   const sess=sessionFor(c);
   const text=[sess.feedback?.detail,sess.feedback?.summary].map(v=>v?.trim()).filter(Boolean).join('\n');
   return [c.name,text||'นักเรียนมีพัฒนาการตามเกณฑ์ที่กำหนด'];
  });
  let summaryTitleY=doc.lastAutoTable.finalY+15;
  if(summaryTitleY>275){doc.addPage();summaryTitleY=20;}
  doc.setFont('THSarabun','normal');
  doc.setFontSize(14);
  const summaryTitle='สรุปและข้อเสนอแนะ';
  doc.text(summaryTitle,102.25,summaryTitleY,{align:'center'});
  doc.setLineWidth(.15);
  const summaryTitleWidth=doc.getTextWidth(summaryTitle);
  doc.line(102.25-summaryTitleWidth/2,summaryTitleY+1,102.25+summaryTitleWidth/2,summaryTitleY+1);

  autoTable(doc,{
   startY:summaryTitleY+8,
   margin:{left:14.3,right:19.8},
   tableWidth:175.9,
   theme:'grid',
   head:[['ระดับชั้น','รายละเอียด']],
   body:feedbackRows,
   styles:{font:'THSarabun',fontSize:12,cellPadding:2,lineWidth:.3,lineColor:[0,0,0],textColor:[0,0,0],fillColor:[255,255,255],valign:'middle'},
   headStyles:{font:'THSarabun',fontStyle:'normal',fontSize:12,fillColor:[217,225,242],textColor:[0,0,0],halign:'center',minCellHeight:8.5},
   bodyStyles:{minCellHeight:8.5},
   columnStyles:{0:{cellWidth:19.7,halign:'center',fontStyle:'normal'},1:{cellWidth:156.2,halign:'left'}}
  });

  doc.save(`สรุปและข้อเสนอแนะ ครั้งที่ ${testNumber} -${fileSchoolName}.pdf`);
 };

 return <div className="app">
  <aside><div className="brand"><img className="brand-logo" src={brandLogo} alt="School Robotics"/></div><nav>{tabs.map(([id,label,I])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><I/>{label}</button>)}</nav><div className="aside-foot"><div className="avatar">{(user.user_metadata?.full_name||user.email||'U').slice(0,2)}</div><div><b>{user.user_metadata?.full_name||user.email}</b><small>ผู้ใช้งานระบบ</small></div><button className="logout" onClick={onSignOut} title="ออกจากระบบ"><LogOut/></button></div></aside>
  <main><header>
   <div className="mobile-brand"><img src={brandLogo} alt="School Robotics"/></div>
   <div className="context dynamic-context">
    <School className="context-school-icon"/>
    <div className="context-group school-context"><small>โรงเรียน · {schools.length} แห่ง</small><Select value={school?.id||''} onChange={selectSchool}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
    <span className="context-arrow">›</span>
    <div className="context-group class-context"><small>ระดับชั้น</small><Select value={classroom?.id||''} onChange={selectClass}>{(school?.classrooms||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
   </div>
   <span className={`cloud-state ${cloudStatus}`}>{cloudStatus==='saved'?<Cloud/>:<CloudOff/>}{cloudStatus==='loading'?'กำลังเชื่อมต่อ':cloudStatus==='saving'?'กำลังบันทึก':cloudStatus==='saved'?'บันทึกบนคลาวด์แล้ว':cloudStatus==='setup'?'รอสร้างฐานข้อมูล':'เชื่อมต่อไม่ได้'}</span>
   <button className="icon" onClick={()=>setDark(!dark)} aria-label="เปลี่ยนธีม">{dark?<Sun/>:<Moon/>}</button>
  </header>
   <section className="content">
    {tab==='scores'&&<ScorePage {...{meta,setMeta,students,update,move,refs,feedback,setFeedback,stats,flash,schools}} userId={user.id} sessions={classSessions} sessionId={session?.id} onSelectSession={setSessionId} onAddSession={addSession}/>}
    {tab==='dashboard'&&<Dashboard stats={dashboardStats} classes={dashboardRows} school={school}/>} 
    {tab==='classroom'&&<Classroom {...{meta,setMeta,students,setStudents,importExcel,flash}} schools={schools} school={school} classroom={classroom} onAddSchool={()=>setSchoolAdding(true)} onSelectSchool={selectSchool} onSelectClass={selectClass} onDeleteSchool={id=>setConfirming({message:'ยืนยันการลบโรงเรียนนี้? ข้อมูลทั้งหมดจะถูกย้ายไปที่ถังขยะและจะไม่แสดงในหน้ารวม',onConfirm:async ()=>{try{setCloudStatus('saving');await deleteSchool(id);setSchools(all=>all.filter(s=>s.id!==id));const next=schools.find(s=>s.id!==id);if(next)selectSchoolAfter(next);else setSchoolId(null);flash('ลบโรงเรียนสำเร็จ (ย้ายไปถังขยะ)');setCloudStatus('saved')}catch(e){console.error(e);setCloudStatus('error');flash('ลบโรงเรียนไม่สำเร็จ')}}})}/>} 
    {tab==='reports'&&<Reports {...{stats,exportExcel,exportPDF}}/>}
   </section>
   <div className="bottom-nav">{tabs.map(([id,label,I])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><I/><small>{label.split(' ')[0]}</small></button>)}</div>
  </main>{toast&&<div className="toast"><CheckCircle2/>{toast}</div>}
  {confirming && <ConfirmModal {...confirming} onClose={()=>setConfirming(null)}/>} 
  {schoolAdding && <AddSchoolModal onClose={()=>setSchoolAdding(false)} onAdd={addSchool}/>}
 </div>
}

function Field({label,children,wide}){return <label className={wide?'field wide':'field'}><span>{label}</span>{children}</label>}
function Select({value,onChange,children}){return <div className="select-wrap"><select value={value} onChange={e=>onChange(e.target.value)}>{children}</select><ChevronDown/></div>}

function ScorePage({meta,setMeta,students,update,move,refs,feedback,setFeedback,stats,flash,schools,userId,sessions,sessionId,onSelectSession,onAddSession}){
  const [search,setSearch]=useState('');
  const set=(k,v)=>setMeta({...meta,[k]:v}),testNo=Number((meta.test||'').match(/\d+/)?.[0]||1),examLevel=/^basic|^beginner/i.test(meta.exam||'')?'Basic':/^advance/i.test(meta.exam||'')?'Advance':'Intermediate',expectedExam=`${examLevel} ${testNo}`,examOptions=['Basic','Intermediate','Advance'].map(level=>`${level} ${testNo}`);
  useEffect(()=>{if(meta.exam!==expectedExam)setMeta({...meta,exam:expectedExam})},[meta.test,meta.exam]);
  
  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const ranks=useMemo(()=>calcRanks(students),[students]);
  const feedbackText = [feedback.detail,feedback.summary].map(value=>value?.trim()).filter(Boolean).join('\n');
 
  if(!schools||!schools.length)return <div className="page-title"><div><span className="eyebrow">การประเมินผล</span><h1>บันทึกผลการทดสอบ</h1><p>ยังไม่มีข้อมูลโรงเรียน โปรดไปที่แท็บ "จัดการชั้นเรียน" เพื่อเพิ่มข้อมูล</p></div></div>;
  return <>
  <div className="page-title"><div><span className="eyebrow">การประเมินผล</span><h1>บันทึกผลการทดสอบ</h1><p>กรอกคะแนนและเวลาของนักเรียน ระบบจะคำนวณผลสัมฤทธิ์ให้อัตโนมัติ</p></div><span className="status"><i/> กำลังบันทึกอัตโนมัติ</span></div>
  <div className="card test-info"><div className="card-head"><div><b>ข้อมูลการทดสอบ</b><small>รายละเอียดสำหรับการประเมินครั้งนี้</small></div><span className="test-badge">{meta.test}</span></div><div className="form-grid">
   <Field label="ครั้งที่ทดสอบ"><div className="session-picker"><Select value={sessionId} onChange={onSelectSession}>{sessions.map(s=><option value={s.id} key={s.id}>{s.test}</option>)}</Select><button type="button" onClick={onAddSession} title="เพิ่มครั้งทดสอบ"><Plus/></button></div></Field>
   <Field label="วันที่ทดสอบ"><input type="date" value={meta.date} onChange={e=>set('date',e.target.value)}/></Field>
   <Field label="ประเภทหุ่นยนต์"><Select value={meta.robot} onChange={v=>set('robot',v)}>{ROBOT_TYPES.map(type=><option key={type} value={type}>{type}</option>)}</Select></Field>
   <Field label="ชุดข้อสอบ"><Select value={expectedExam} onChange={v=>set('exam',v)}>{examOptions.map(v=><option key={v}>{v}</option>)}</Select></Field>
   <Field label="วิทยากรผู้ประเมิน" wide><input value={meta.trainer} onChange={e=>set('trainer',e.target.value)}/></Field>
  </div></div>
  <div className="card score-card"><div className="card-head"><div><b>คะแนนและเวลา</b><small>{meta.level} · นักเรียน {students.length} คน</small></div><div className="search-box"><input placeholder="ค้นหาชื่อนักเรียน..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="legend"><i/> ผ่านเกณฑ์ 35 คะแนน</div></div>
   <div className="table-wrap"><table><thead><tr><th>เลขที่</th><th className="center">ลำดับ</th><th>ชื่อ–นามสกุล</th><th className="center">ขาดสอบ</th><th>คะแนน <small>(เต็ม 50)</small></th><th>เวลา <small>(นาที:วินาที)</small></th><th>ผลประเมิน</th></tr></thead><tbody>{filteredStudents.map((s,i)=><tr key={s.id} className={s.absent?'absent':''}><td className="number">{String(s.no).padStart(2,'0')}</td><td className="center"><span className={`rank-badge ${ranks[s.id]&&ranks[s.id]<=3?`top-${ranks[s.id]}`:''}`}>{ranks[s.id]||'—'}</span></td><td><b>{s.name}</b></td><td className="center"><input className="check" type="checkbox" checked={s.absent} onChange={e=>update(s.id,'absent',e.target.checked)}/></td><td><input ref={el=>refs.current[`${i}-score`]=el} onKeyDown={e=>move(i,'score',e)} className="score-input" type="number" min="0" max="50" disabled={s.absent} value={s.score} placeholder="—" onChange={e=>update(s.id,'score',e.target.value)}/></td><td><input ref={el=>refs.current[`${i}-time`]=el} onKeyDown={e=>move(i,'time',e)} className="time-input" disabled={s.absent} value={s.time} placeholder="00:00" onChange={e=>update(s.id,'time',e.target.value)}/></td><td>{s.absent?<span className="result no"><AlertCircle/>ขาดสอบ</span>:s.score?<span className={+s.score>=35?'result yes':'result no'}>{+s.score>=35?<CheckCircle2/>:<X/>}{+s.score>=35?'ผ่าน':'ไม่ผ่าน'}</span>:<span className="muted">รอคะแนน</span>}</td></tr>)}</tbody></table></div>
   <div className="table-summary"><span>เข้าสอบ <b>{stats.present}</b> คน</span><span>ขาดสอบ <b>{stats.absent}</b> คน</span><span>คะแนนเฉลี่ย <b>{stats.avg.toFixed(1)}</b></span><span>ผ่านเกณฑ์ <b>{stats.rate.toFixed(0)}%</b></span></div>
  </div>
  <div className="card feedback"><div className="card-head"><div><b>สรุปและข้อเสนอแนะ</b><small>บันทึกผลการประเมินและข้อเสนอแนะของระดับชั้น ข้อมูลนี้จะปรากฏในรายงาน PDF</small></div></div><div className="feedback-grid"><Field label="ผลการประเมินและข้อเสนอแนะของระดับชั้น"><textarea value={feedbackText} onChange={e=>setFeedback({detail:e.target.value,summary:''})} placeholder="เช่น นักเรียนสามารถทำแบบทดสอบได้ตามภารกิจ... แนะนำให้ฝึกฝนเพิ่มเติมในเรื่อง..."/></Field></div></div>
  <div className="actions"><span><kbd>Enter ↵</kbd> หรือ <kbd>↓</kbd> เพื่อเลื่อนไปช่องถัดไป</span><button className="primary" onClick={async ()=>{flash('กำลังตรวจสอบและบันทึกข้อมูล...');try{const cleanSchools=schools.map(s=>({...s,sessions:s.sessions.map(sess=>({...sess,date:sess.date||new Date().toISOString().slice(0,10),entries:Object.fromEntries(Object.entries(sess.entries||{}).map(([k,v])=>[k,{...v,score:v.absent?'':(v.score===''||v.score==null?'':String(Math.max(0,Math.min(50,Number(v.score)||0))))}]))}))}));await saveSchools(cleanSchools,userId);flash('บันทึกและประเมินผลเรียบร้อยแล้ว')}catch(e){console.error(e);flash('ไม่สามารถบันทึกได้: โปรดตรวจสอบวันที่หรือข้อมูลที่ผิดพลาด')}}}><Save/>บันทึกและประเมินผล</button></div>
  </>
}

function Dashboard({stats,classes,school}){
 if(!school)return <div className="page-title"><div><span className="eyebrow">ภาพรวมโรงเรียน</span><h1>ผลสัมฤทธิ์การเรียนรู้</h1><p>ไม่มีข้อมูลโรงเรียน โปรดเพิ่มข้อมูลในแท็บจัดการชั้นเรียน</p></div></div>;
 return <>
  <div className="page-title"><div><span className="eyebrow">ภาพรวมโรงเรียน</span><h1>ผลสัมฤทธิ์การเรียนรู้</h1><p>{school.name} · ข้อมูลล่าสุดจาก {classes.length} ห้องเรียน</p></div></div>
  <div className="stat-grid">{[['นักเรียนทั้งหมด',stats.all,'คน'],['เข้าสอบ',stats.present,'คน'],['คะแนนเฉลี่ย',stats.avg.toFixed(1),'/ 50'],['ผ่านเกณฑ์รายบุคคล',stats.rate.toFixed(0),'%']].map(x=><div className="stat card" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>{x[2]}</span></div>)}</div>
  <div className="card outcome-card">
   <div className="card-head outcome-head"><div><b>จำนวนนักเรียนและผลสอบรายห้อง</b><small>อ้างอิงผลการทดสอบครั้งล่าสุด · ภาคเรียนที่ {school.term}/{school.year}</small></div><div className="outcome-legend"><span><i className="pass"/>ผ่าน</span><span><i className="fail"/>ไม่ผ่าน</span><span><i className="absent"/>ขาดสอบ</span><span><i className="pending"/>รอคะแนน</span></div></div>
   <div className="outcome-chart">{classes.map(c=>{
    const percent=value=>c.students?value/c.students*100:0;
    return <div className="outcome-row" key={c.name}>
     <div className="outcome-class"><b>{c.name}</b><small>{c.students} คน · ทดสอบ {c.tests} ครั้ง</small></div>
     <div className="outcome-bar" aria-label={`${c.name} ผ่าน ${c.passed} ไม่ผ่าน ${c.failed} ขาดสอบ ${c.absent}`}>
      {c.passed>0&&<i className="pass" style={{width:`${percent(c.passed)}%`}} title={`ผ่าน ${c.passed} คน`}>{c.passed}</i>}
      {c.failed>0&&<i className="fail" style={{width:`${percent(c.failed)}%`}} title={`ไม่ผ่าน ${c.failed} คน`}>{c.failed}</i>}
      {c.absent>0&&<i className="absent" style={{width:`${percent(c.absent)}%`}} title={`ขาดสอบ ${c.absent} คน`}>{c.absent}</i>}
      {c.pending>0&&<i className="pending" style={{width:`${percent(c.pending)}%`}} title={`รอคะแนน ${c.pending} คน`}>{c.pending}</i>}
     </div>
     <div className="outcome-total"><strong>{c.students}</strong><small>คน</small></div>
    </div>})}</div>
  </div>
 </>;
}

function Classroom({meta,setMeta,students,setStudents,importExcel,flash,schools,school,classroom,onAddSchool,onSelectSchool,onSelectClass,onDeleteSchool}){
  const [adding,setAdding]=useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(null);

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const addStudents=list=>{
    const newStudents = list.map((data, index) => ({
      id: `student-${Date.now()}-${index}`,
      no: students.length + index + 1,
      prefix: data.prefix,
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.prefix}${data.firstName} ${data.lastName}`.trim(),
      score: '',
      time: '',
      absent: false
    }));
    setStudents([...students, ...newStudents]);
    setAdding(false);
    flash(`เพิ่มนักเรียน ${list.length} คน เรียบร้อยแล้ว`);
  };
  
  const updateStudent=data=>{
    setStudents(students.map(s => s.id === editingStudent.id ? {
      ...s,
      prefix: data.prefix,
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.prefix}${data.firstName} ${data.lastName}`.trim()
    } : s));
    setEditingStudent(null);
    flash(`แก้ไขข้อมูลเรียบร้อยแล้ว`);
  };

  const deleteStudent=id=>{
    setConfirming({
      message: 'ยืนยันการลบนักเรียนคนนี้ออกจากชั้นเรียน?',
      onConfirm: () => {
        setStudents(students.filter(s=>s.id!==id));
        flash('ลบข้อมูลนักเรียนเรียบร้อยแล้ว');
      }
    });
  };

  if(!school)return <div className="page-title"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h1>จัดการโรงเรียนและชั้นเรียน</h1><p>ยังไม่มีข้อมูลโรงเรียน โปรดเพิ่มหรือนำเข้าไฟล์ Excel</p></div><div className="page-buttons"><button className="button" onClick={onAddSchool}><Plus/>เพิ่มโรงเรียน</button><label className="primary"><Upload/>นำเข้าไฟล์โรงเรียน<input type="file" accept=".xlsx,.xls" onChange={importExcel} hidden/></label></div></div>;
  return <><div className="page-title"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h1>จัดการโรงเรียนและชั้นเรียน</h1><p>1 ไฟล์ Excel = 1 โรงเรียน · ระบบอ่านทุกชีตและทุกครั้งทดสอบอัตโนมัติ</p></div><div className="page-buttons"><button className="button" onClick={onAddSchool}><Plus/>เพิ่มโรงเรียน</button><label className="primary"><Upload/>นำเข้าไฟล์โรงเรียน<input type="file" accept=".xlsx,.xls" onChange={importExcel} hidden/></label></div></div><div className="school-strip">{schools.map(s=><button className={s.id===school.id?'school-chip active':'school-chip'} onClick={()=>onSelectSchool(s.id)} key={s.id}><School/><span><b>{s.name}</b><small>{s.classrooms.length} ห้อง · {s.sessions.length} ครั้งทดสอบ</small></span></button>)}</div><div className="card filters"><div className="card-head"><div><b>ตั้งค่าโรงเรียนปัจจุบัน</b></div><button className="button danger-text" onClick={()=>onDeleteSchool(school.id)}><X/>ลบโรงเรียนนี้</button></div><Field label="โรงเรียน"><input value={meta.school} onChange={e=>setMeta({...meta,school:e.target.value})}/></Field><div className="form-grid mini"><Field label="ปีการศึกษา"><input value={meta.year} onChange={e=>setMeta({...meta,year:e.target.value})}/></Field><Field label="ภาคเรียนที่"><input value={meta.term} onChange={e=>setMeta({...meta,term:e.target.value})}/></Field></div></div>
  <div className="card classroom-list"><div className="card-head"><div><b>รายชื่อนักเรียน</b><small>{classroom?.name} · {students.length} คน</small></div><div className="search-box"><input placeholder="ค้นหาชื่อนักเรียน..." value={search} onChange={e=>setSearch(e.target.value)}/></div><button className="button" onClick={()=>setAdding(true)}><Plus/>เพิ่มนักเรียน</button></div>
  <div className="table-wrap"><table><thead><tr><th>เลขที่</th><th>ชื่อ–นามสกุล</th><th className="center">จัดการ</th></tr></thead><tbody>{filteredStudents.map(s=><tr key={s.id}><td className="number">{String(s.no).padStart(2,'0')}</td><td><b>{s.name}</b></td><td className="center" style={{display:'flex',gap:'8px',justifyContent:'center'}}><button className="icon-btn" title="แก้ไข" onClick={()=>setEditingStudent(s)}><Edit2 size={16}/></button><button className="icon-btn danger-text" title="ลบ" onClick={()=>deleteStudent(s.id)}><X size={16}/></button></td></tr>)}</tbody></table></div></div>
  {adding && <AddStudentModal onClose={()=>setAdding(false)} onAdd={addStudents} nextNo={students.length+1}/>}
  {editingStudent && <AddStudentModal onClose={()=>setEditingStudent(null)} onAdd={data=>updateStudent(data[0])} student={editingStudent} isEdit={true}/>}
  {confirming && <ConfirmModal {...confirming} onClose={()=>setConfirming(null)}/>} 
  </>
}

function AddStudentModal({onClose,onAdd,nextNo,student,isEdit}){
  const [list, setList] = useState([{ prefix: student?.prefix || 'เด็กชาย', firstName: student?.firstName || '', lastName: student?.lastName || '' }]);
  
  const valid = list.every(item => item.firstName.trim() && item.lastName.trim());

  const addRow = () => setList([...list, { prefix: 'เด็กชาย', firstName: '', lastName: '' }]);
  const removeRow = (index) => setList(list.filter((_, i) => i !== index));
  const updateRow = (index, field, value) => {
    setList(list.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const submit=e=>{
    e.preventDefault();
    if(valid) onAdd(list.map(item => ({ ...item, firstName: item.firstName.trim(), lastName: item.lastName.trim() })));
  };

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <form className="modal-card" onSubmit={submit} style={{ width: isEdit ? 'min(540px, 100%)' : 'min(720px, 100%)' }}>
      <div className="modal-head">
        <div>
          <span className="eyebrow">{isEdit?`แก้ไขข้อมูลลำดับที่ ${student.no}`:`เพิ่มนักเรียนใหม่ (${list.length} คน)`}</span>
          <h2>{isEdit?'แก้ไขข้อมูลนักเรียน':'เพิ่มนักเรียนใหม่'}</h2>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด"><X/></button>
      </div>
      <div className="student-form-list" style={{ padding: '20px 24px', maxHeight: '60vh', overflow: 'auto' }}>
        {list.map((item, index) => (
          <div className="student-form-row" key={index} style={{ 
            display: 'grid', 
            gridTemplateColumns: isEdit ? '130px 1fr 1fr' : '130px 1fr 1fr 40px', 
            gap: '12px', 
            marginBottom: '16px',
            alignItems: 'end',
            paddingBottom: '16px',
            borderBottom: index === list.length - 1 ? '0' : '1px solid var(--line)'
          }}>
            <Field label="คำนำหน้า">
              <Select value={item.prefix} onChange={v => updateRow(index, 'prefix', v)}>
                <option>เด็กชาย</option>
                <option>เด็กหญิง</option>
                <option>นาย</option>
                <option>นางสาว</option>
              </Select>
            </Field>
            <Field label="ชื่อ">
              <input autoFocus={index === list.length - 1} value={item.firstName} onChange={e => updateRow(index, 'firstName', e.target.value)} placeholder="กรอกชื่อ"/>
            </Field>
            <Field label="นามสกุล">
              <input value={item.lastName} onChange={e => updateRow(index, 'lastName', e.target.value)} placeholder="กรอกนามสกุล"/>
            </Field>
            {!isEdit && list.length > 1 && (
              <button type="button" className="icon-btn danger-text" onClick={() => removeRow(index)} style={{ marginBottom: '4px' }}>
                <X size={16}/>
              </button>
            )}
          </div>
        ))}
        {!isEdit && (
          <button type="button" className="button" onClick={addRow} style={{ width: '100%', borderStyle: 'dashed', marginTop: '8px' }}>
            <Plus/>เพิ่มคนถัดไป
          </button>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="button" onClick={onClose}>ยกเลิก</button>
        <button className="primary" disabled={!valid}><Save/>{isEdit?'บันทึกการแก้ไข':'เพิ่มนักเรียนทั้งหมด'}</button>
      </div>
    </form>
  </div>
}
function Reports({stats,exportExcel,exportPDF}){return <><div className="page-title"><div><span className="eyebrow">ส่งออกข้อมูล</span><h1>รายงานผลการประเมิน</h1><p>จัดทำเอกสารพร้อมพิมพ์หรือสำรองข้อมูลสำหรับใช้งานต่อ</p></div></div><div className="report-grid"><div className="card report"><div className="report-icon pdf"><FileText/></div><div><h2>รายงานสรุปผลสัมฤทธิ์</h2><p>สถิติ ภาพรวมผลการประเมิน และข้อเสนอแนะในรูปแบบเอกสาร PDF</p></div><div className="mini-stats"><span>เฉลี่ย <b>{stats.avg.toFixed(1)}</b></span><span>ผ่าน <b>{stats.rate.toFixed(0)}%</b></span></div><button className="primary" onClick={exportPDF}><Download/>สร้างรายงาน PDF</button></div><div className="card report"><div className="report-icon excel"><LayoutDashboard/></div><div><h2>ข้อมูลคะแนนและเวลา</h2><p>ข้อมูลดิบรายบุคคลและตารางสรุปผลรายห้องในไฟล์ Excel</p></div><div className="mini-stats"><span>นักเรียน <b>{stats.all}</b></span><span>เข้าสอบ <b>{stats.present}</b></span></div><button className="button" onClick={exportExcel}><Download/>ส่งออก Excel</button></div></div></>}

function AuthPage(){const [mode,setMode]=useState('login'),[form,setForm]=useState({name:'',email:'',password:''}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const submit=async e=>{e.preventDefault();setBusy(true);setMessage('');const action=mode==='login'?supabase.auth.signInWithPassword({email:form.email,password:form.password}):supabase.auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.name}}});const {data,error}=await action;setBusy(false);if(error)return setMessage(error.message);if(mode==='register'&&!data.session)setMessage('สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี')};return <div className="auth-shell"><div className="auth-visual"><div className="brand auth-brand"><img className="brand-logo" src={brandLogo} alt="School Robotics"/></div><div><span className="eyebrow">School Robotics ERP</span><h1>ผลการเรียนรู้<br/>ที่มองเห็นได้จริง</h1><p>จัดการโรงเรียน ห้องเรียน และผลการประเมิน<br/>อย่างเป็นระบบในที่เดียว</p></div><div className="auth-points"><span><CheckCircle2/>ข้อมูลปลอดภัยด้วย Supabase</span><span><CheckCircle2/>รองรับหลายโรงเรียนและหลายผู้ใช้</span></div></div><div className="auth-panel"><form className="auth-card" onSubmit={submit}><div><span className="eyebrow">ยินดีต้อนรับ</span><h2>{mode==='login'?'เข้าสู่ระบบ':'สร้างบัญชีใหม่'}</h2><p>{mode==='login'?'กรอกข้อมูลเพื่อเข้าสู่ระบบประเมินผล':'เริ่มต้นใช้งานระบบสำหรับทีมของคุณ'}</p></div>{mode==='register'&&<Field label="ชื่อผู้ใช้งาน"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="ชื่อ-นามสกุล"/></Field>}<Field label="อีเมล"><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@school.ac.th"/></Field><Field label="รหัสผ่าน"><input type="password" required minLength="6" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="อย่างน้อย 6 ตัวอักษร"/></Field>{message&&<div className="auth-message">{message}</div>}<button className="primary auth-submit" disabled={busy}>{busy?'กำลังดำเนินการ…':mode==='login'?'เข้าสู่ระบบ':'สมัครสมาชิก'}</button><button type="button" className="auth-switch" onClick={()=>{setMode(mode==='login'?'register':'login');setMessage('')}}>{mode==='login'?'ยังไม่มีบัญชี? สมัครสมาชิก':'มีบัญชีแล้ว? เข้าสู่ระบบ'}</button></form></div></div>}

function Root(){const [session,setSession]=useState(undefined);useEffect(()=>{if(!supabase){setSession(null);return}supabase.auth.getSession().then(({data})=>setSession(data.session));const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));return()=>data.subscription.unsubscribe()},[]);if(!isSupabaseConfigured)return <div className="boot-screen">ยังไม่ได้ตั้งค่า Supabase</div>;if(session===undefined)return <div className="boot-screen"><Bot/>กำลังเชื่อมต่อระบบ…</div>;if(!session)return <AuthPage/>;return <App user={session.user} onSignOut={()=>{localStorage.clear();supabase.auth.signOut()}}/>}

createRoot(document.getElementById('root')).render(<Root/>);
