import React, {useEffect, useMemo, useState} from 'react';
import {LayoutDashboard, FileText, Download, Eye} from 'lucide-react';
import {calcStats} from '../model';

import Field from '../components/ui/Field';
import Select from '../components/ui/Select';

const testNumberFor=session=>Number(String(session?.test||'').match(/\d+/)?.[0])||0;
const hasReportData=session=>Boolean(session?.date||session?.endDate||session?.robot||session?.exam||session?.teachingPeriod||session?.trainer||session?.feedback?.detail||session?.feedback?.summary||Object.values(session?.entries||{}).some(entry=>entry?.absent||entry?.is_special||entry?.score!==''&&entry?.score!=null||entry?.time));

function Reports({stats,exportExcel,exportAllExcelZip,exportPDF,exportScoreTablePDF,onPreviewPDF,onPreviewScoreTablePDF,schools,schoolId,onSelectSchool}){
 const school=schools?.find(item=>String(item.id)===String(schoolId))||null;
 const attempts=useMemo(()=>Array.from(new Set((school?.sessions||[]).map(testNumberFor).filter(Boolean))).sort((a,b)=>a-b),[school]);
 const [testNumber,setTestNumber]=useState('');
 useEffect(()=>setTestNumber(current=>attempts.some(item=>String(item)===String(current))?current:(attempts[0]||'')),[attempts]);
 const selectedTestNumber=Number(testNumber)||0;
 const selectedStudents=useMemo(()=>{
  if(!school||!selectedTestNumber)return [];
  return school.classrooms.flatMap(classroom=>{
   const session=school.sessions.find(item=>String(item.classId)===String(classroom.id)&&testNumberFor(item)===selectedTestNumber);
   if(!session)return [];
   const entries=session.entries||{};
   return classroom.students.filter(student=>student.active!==false||entries[student.id]).map(student=>({...student,...(entries[student.id]||{})}));
  });
 },[school,selectedTestNumber]);
 const summaryStats=useMemo(()=>calcStats(selectedStudents),[selectedStudents]);
 const roomsWithData=useMemo(()=>school?.classrooms.filter(classroom=>school.sessions.some(item=>String(item.classId)===String(classroom.id)&&testNumberFor(item)===selectedTestNumber&&hasReportData(item))).length||0,[school,selectedTestNumber]);
 const summaryOptions={school,testNumber:selectedTestNumber,scope:'all'};
 const summaryReady=Boolean(school&&selectedTestNumber);

 return <>
  <div className="page-title"><div><span className="eyebrow">ส่งออกข้อมูล</span><h1>รายงานผลการประเมิน</h1><p>จัดทำเอกสารพร้อมพิมพ์หรือสำรองข้อมูลสำหรับใช้งานต่อ</p></div></div>
  <div className="card test-info" style={{marginBottom: '1.5rem'}}>
   <div className="form-grid report-filter-grid">
    <Field label="เลือกโรงเรียนที่ต้องการรายงาน"><Select value={schoolId} onChange={onSelectSchool}><option value="" disabled hidden>เลือกโรงเรียน</option>{schools?.map(s=><option value={s.id} key={s.id}>{s.name} ({s.classrooms?.length||0} ห้อง)</option>)}</Select></Field>
    <Field label="รอบสำหรับรายงานสรุป"><Select value={String(testNumber)} onChange={setTestNumber} disabled={!attempts.length}><option value="" disabled hidden>{school?.loaded?'ยังไม่มีครั้งทดสอบ':'กำลังโหลดข้อมูลโรงเรียน...'}</option>{attempts.map(number=><option value={number} key={number}>ครั้งที่ {number} · มีข้อมูล {school?.classrooms.filter(classroom=>school.sessions.some(item=>String(item.classId)===String(classroom.id)&&testNumberFor(item)===number&&hasReportData(item))).length||0}/{school?.classrooms.length||0} ห้อง</option>)}</Select></Field>
   </div>
  </div>
  <div className="report-grid">
   <div className="card report"><div className="report-icon pdf"><FileText/></div><div><h2>รายงานสรุปผลสัมฤทธิ์</h2><p>สถิติและข้อเสนอแนะของครั้งที่ {selectedTestNumber||'-'} · มีข้อมูล {roomsWithData}/{school?.classrooms.length||0} ห้อง</p></div><div className="mini-stats"><span>เฉลี่ย <b>{summaryStats.avg.toFixed(1)}</b></span><span>ผ่าน <b>{summaryStats.rate.toFixed(0)}%</b></span></div><div className="report-actions"><button className="primary" disabled={!summaryReady} onClick={()=>onPreviewPDF(summaryOptions)}><Eye/>ดูตัวอย่าง PDF</button><button className="button" disabled={!summaryReady} onClick={()=>exportPDF('download',summaryOptions)}><Download/>ดาวน์โหลดทันที</button></div></div>
   <div className="card report"><div className="report-icon pdf"><FileText/></div><div><h2>PDF ตารางคะแนน</h2><p>ตารางคะแนนทุกครั้งของทุกห้อง พร้อมลำดับ คะแนน และเวลาในการทดสอบ</p></div><div className="report-actions"><button className="primary" onClick={onPreviewScoreTablePDF}><Eye/>ดูตัวอย่าง PDF</button><button className="button" onClick={()=>exportScoreTablePDF('download')}><Download/>ดาวน์โหลดทันที</button></div></div>
   <div className="card report"><div className="report-icon excel"><LayoutDashboard/></div><div><h2>ข้อมูลคะแนนและเวลา</h2><p>ข้อมูลดิบรายบุคคลและตารางสรุปผลรายห้องในไฟล์ Excel</p></div><div className="mini-stats"><span>นักเรียน <b>{stats.all}</b></span><span>เข้าสอบ <b>{stats.present}</b></span></div><div className="report-actions"><button className="button" onClick={exportExcel}><Download/>ส่งออกโรงเรียนนี้</button><button className="button" onClick={exportAllExcelZip} style={{borderColor: '#107c41', color: '#107c41'}}><Download size={16}/> ส่งออกทุกโรงเรียน (ZIP)</button></div></div>
  </div>
 </>;
}

export default Reports;
