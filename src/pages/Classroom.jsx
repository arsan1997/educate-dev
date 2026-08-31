import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw, Trash2} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '../model';
import {supabase,isSupabaseConfigured} from '../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice,acquireLock,releaseLock,keepLockAlive} from '../dataService';
import brandLogo from '../assets/logo.png';
import Field from '../components/ui/Field';
import Select from '../components/ui/Select';
import ConfirmModal from '../components/ui/ConfirmModal';
import AddStudentModal from '../components/modals/AddStudentModal';

function Classroom({meta,setMeta,students,setStudents,importExcel,importBulkExcel,flash,offices,schools,school,classroom,onAddSchool,onAddOffice,onDeleteOffice,onSelectSchool,onSelectClass,onDeleteSchool,onDeleteClassroom,user,userProfiles,readOnly=false}){
  const [adding,setAdding]=useState(false);
  const [addingOffice,setAddingOffice]=useState(false),[newOffice,setNewOffice]=useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [search, setSearch] = useState('');
  const [schoolSearch,setSchoolSearch]=useState(''),[officeFilter,setOfficeFilter]=useState(school?.officeId||'unassigned');
  const [statusFilter,setStatusFilter]=useState('active');
  const [confirming, setConfirming] = useState(null);
  const [classroomLockReady,setClassroomLockReady]=useState(false),[classroomLockMessage,setClassroomLockMessage]=useState('');
  const editingBlocked=readOnly||!classroomLockReady;

  useEffect(()=>{
    let active=true;
    let heartbeatInterval=null;
    setClassroomLockReady(false);
    setClassroomLockMessage('');
    if(readOnly||!classroom?.id||!user?.id)return undefined;
    const userName=userProfiles?.[user.id]?.full_name||user.email||'แอดมิน';
    acquireLock(classroom.id,user.id,userName).then(result=>{
      if(!active)return;
      if(result.success){
        setClassroomLockReady(true);
        heartbeatInterval=setInterval(()=>keepLockAlive(classroom.id,user.id).catch(console.error),60000);
      }
      else setClassroomLockMessage(`ห้องเรียนนี้ยังแก้ไขไม่ได้: ${result.lockedBy}`);
    }).catch(error=>{
      if(!active)return;
      console.error(error);
      setClassroomLockMessage('ระบบไม่สามารถยืนยันสิทธิ์การแก้ไขห้องนี้ได้ กรุณาลองใหม่');
    });
    return ()=>{active=false;if(heartbeatInterval)clearInterval(heartbeatInterval);releaseLock(classroom.id,user.id)};
  },[classroom?.id,user?.id,readOnly]);

  const activeCount=students.filter(s=>s.active!==false).length;
  const filteredStudents=students.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())&&(statusFilter==='all'||(statusFilter==='active'?s.active!==false:s.active===false))).sort((a,b)=>Number(a.no)-Number(b.no));
  const officeSchools=schools.filter(s=>officeFilter==='unassigned'?!s.officeId:String(s.officeId)===String(officeFilter)),matchingSchools=officeSchools.filter(s=>s.name.toLocaleLowerCase('th-TH').includes(schoolSearch.trim().toLocaleLowerCase('th-TH')));
  useEffect(()=>{setOfficeFilter(school?.officeId||'unassigned');setSchoolSearch('')},[school?.id]);

  const addStudents=list=>{
    const newStudents = list.map((data, index) => ({
      id: `student-${Date.now()}-${index}`,
      no: Math.max(0,...students.map(s=>Number(s.no)||0)) + index + 1,
      prefix: data.prefix,
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.prefix}${data.firstName} ${data.lastName}`.trim(),
      active: true,
      leftAt: '',
      score: '',
      time: '',
      absent: false
    }));
    setStudents([...students, ...newStudents]);
    setAdding(false);
    flash(`เพิ่มนักเรียน ${list.length} คน เรียบร้อยแล้ว`);
  };
  
  const updateStudent=async data=>{
    const oldNo=Number(editingStudent.no),newNo=Math.max(1,Number(data.no)||oldNo),occupied=students.find(s=>s.id!==editingStudent.id&&Number(s.no)===newNo);
    const next=students.map(s=>s.id===editingStudent.id?{...s,no:newNo,prefix:data.prefix,firstName:data.firstName,lastName:data.lastName,name:`${data.prefix}${data.firstName} ${data.lastName}`.trim()}:occupied&&s.id===occupied.id?{...s,no:oldNo}:s);
    try{
      if(newNo!==oldNo)await saveStudentOrder(classroom.id,next.map(s=>({id:s.id,no:s.no})));
      setStudents(next);setEditingStudent(null);
      flash(occupied?`สลับเลขที่ ${oldNo} และ ${newNo} เรียบร้อยแล้ว`:'แก้ไขข้อมูลเรียบร้อยแล้ว');
    }catch(error){console.error(error);flash(`เปลี่ยนเลขที่ไม่สำเร็จ: ${error.message}`)}
  };

  const leaveStudent=student=>{
    setConfirming({
      title:'เปลี่ยนสถานะนักเรียน',message:`ยืนยันว่า ${student.name} ออกจากชั้นเรียน? ผลสอบเดิมจะยังอยู่ครบ`,dangerLabel:'ทำเครื่องหมายว่าออกแล้ว',
      onConfirm: () => {
        setStudents(students.map(s=>s.id===student.id?{...s,active:false,leftAt:new Date().toISOString().slice(0,10)}:s));
        flash('บันทึกสถานะออกจากชั้นเรียนแล้ว');
      }
    });
  };
  const restoreStudent=id=>{setStudents(students.map(s=>s.id===id?{...s,active:true,leftAt:''}:s));flash('กู้คืนนักเรียนกลับเข้าชั้นเรียนแล้ว')};

  if(!school)return <div className="page-title classroom-page-title"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h1>จัดการโรงเรียนและชั้นเรียน</h1><p>ยังไม่มีข้อมูลโรงเรียน โปรดเพิ่มหรือนำเข้าไฟล์ Excel</p></div><div className="page-buttons classroom-page-actions"><a href="/template.xlsx" download className="button"><Download/>โหลดแบบฟอร์ม</a><button className="button" onClick={onAddSchool}><Plus/>เพิ่มโรงเรียน</button><div className="classroom-import-actions"><label className="primary"><Upload/>นำเข้า 1 โรงเรียน<input type="file" accept=".xlsx,.xls" onChange={importExcel} hidden/></label><label className="primary outline" title="นำเข้าข้อมูลหลายโรงเรียนพร้อมกัน (ไม่มี Popup ให้กดยืนยัน)"><Upload/>นำเข้ารวดเดียว (Bulk)<input type="file" multiple accept=".xlsx,.xls" onChange={importBulkExcel} hidden/></label></div></div></div>;
  return <>
  <div className="page-title classroom-page-title"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h1>จัดการโรงเรียนและชั้นเรียน</h1><p>1 ไฟล์ Excel = 1 โรงเรียน · ระบบอ่านทุกชีตและทุกครั้งทดสอบอัตโนมัติ</p></div><div className="page-buttons classroom-page-actions"><a href="/template.xlsx" download className="button"><Download/>โหลดแบบฟอร์ม</a><button className="button" onClick={onAddSchool}><Plus/>เพิ่มโรงเรียน</button><div className="classroom-import-actions"><label className="primary"><Upload/>นำเข้า 1 โรงเรียน<input type="file" accept=".xlsx,.xls" onChange={importExcel} hidden/></label><label className="primary outline" title="นำเข้าข้อมูลหลายโรงเรียนพร้อมกัน (ไม่มี Popup ให้กดยืนยัน)"><Upload/>นำเข้ารวดเดียว (Bulk)<input type="file" multiple accept=".xlsx,.xls" onChange={importBulkExcel} hidden/></label></div></div></div>
  <div className="card school-browser classroom-step-card"><div className="school-browser-title"><span className="classroom-step-number">1</span><School/><div><b>เลือกโรงเรียนที่จะจัดการ</b><small>{officeSchools.length} โรงเรียนในสำนักงาน · พบ {matchingSchools.length} รายการ</small></div></div><Field label="สำนักงาน"><Select value={officeFilter} onChange={id=>{const next=schools.find(s=>id==='unassigned'?!s.officeId:String(s.officeId)===String(id));if(!next||onSelectSchool(next.id)!==false){setOfficeFilter(id);setSchoolSearch('')}}}>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}{schools.some(s=>!s.officeId)&&<option value="unassigned">ยังไม่ระบุสำนักงาน</option>}</Select></Field><Field label="ค้นหาโรงเรียน"><div className="school-browser-search"><input value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)} placeholder="พิมพ์ชื่อโรงเรียน..."/>{schoolSearch&&<button type="button" onClick={()=>setSchoolSearch('')} aria-label="ล้างคำค้นหา"><X/></button>}</div></Field><Field label="โรงเรียน"><Select value={matchingSchools.some(s=>s.id===school.id)?school.id:''} onChange={onSelectSchool}><option value="" disabled hidden>{matchingSchools.length?'เลือกโรงเรียน':'ไม่พบโรงเรียน'}</option>{matchingSchools.map(s=><option key={s.id} value={s.id}>{s.name}{(s.year||s.term)?' ('+(s.term?'เทอม '+s.term:'')+(s.term&&s.year?' ':'')+(s.year?'ปี '+s.year:'')+')':''} · {s.classrooms.length} ห้อง</option>)}</Select></Field></div>
  <div className="card classroom-editor-card">
   <div className="card-head classroom-editor-head"><div><span className="classroom-step-number">2</span><div><b>จัดการข้อมูลโรงเรียน</b><small>กำลังแก้ไข {school.name} · {school.classrooms.length} ห้องเรียน</small></div></div></div>
   {classroomLockMessage&&<div className="classroom-lock-banner"><ShieldCheck/><div><b>หยุดการแก้ไขชั่วคราว</b><small>{classroomLockMessage} หากไม่มีผู้ใช้อื่นกำลังแก้ไข กรุณารีเฟรชหน้าแล้วลองใหม่</small></div></div>}
   <div className="classroom-editor-layout">
    <div className="classroom-school-meta">
     <Field label="ชื่อโรงเรียน"><input disabled={editingBlocked} value={meta.school||''} onChange={e=>setMeta({...meta,school:e.target.value})}/></Field>
     <Field label="สำนักงานที่รับผิดชอบ"><div className="office-picker" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}><Select disabled={editingBlocked} style={{ flex: 1, minWidth: '200px' }} value={meta.officeId||''} onChange={officeId=>setMeta({...meta,officeId})}><option value="">ยังไม่ระบุสำนักงาน</option>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select>{meta.officeId&&<button type="button" disabled={editingBlocked} className="button danger-text" title="ลบสำนักงานนี้" onClick={()=>{const o=offices.find(x=>x.id===meta.officeId);if(o)onDeleteOffice?.(o.id,o.name)}}><Trash2 size={16}/></button>}<button type="button" disabled={editingBlocked} className="button" onClick={()=>setAddingOffice(!addingOffice)}><Plus/>เพิ่มสำนักงาน</button></div>{addingOffice&&<div className="office-create school-office-create" style={{ marginTop: '12px' }}><input disabled={editingBlocked} value={newOffice} onChange={e=>setNewOffice(e.target.value)} placeholder="ชื่อสำนักงาน"/><button type="button" className="primary" disabled={editingBlocked||!newOffice.trim()} onClick={async()=>{const office=await onAddOffice(newOffice);if(office){setMeta({...meta,officeId:office.id});setNewOffice('');setAddingOffice(false)}}}>บันทึก</button></div>}</Field>
    </div>
    <div className="classroom-class-editor">
     <div className="classroom-subsection-head"><div><b>จัดการชั้นเรียน</b><small>เลือกชั้นเรียนเพื่อแก้ไขรายละเอียด</small></div><span>{school.classrooms.length} ห้อง</span></div>
     <div className="form-grid mini classroom-mini-form">
      <Field label="เลือกชั้นเรียน">
       <Select value={classroom?.id||''} onChange={onSelectClass}>
         {school.classrooms.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
       </Select>
     </Field>
      <Field label="ชื่อชั้นเรียน / ห้อง">
        <input disabled={editingBlocked} value={meta.level||''} onChange={e=>setMeta({...meta,level:e.target.value})}/>
     </Field>
      <Field label="ปีการศึกษา"><input disabled={editingBlocked} value={meta.year||''} onChange={e=>setMeta({...meta,year:e.target.value})}/></Field>
      <Field label="ภาคเรียนที่"><input disabled={editingBlocked} value={meta.term||''} onChange={e=>setMeta({...meta,term:e.target.value})}/></Field>
      <div className="mini-actions classroom-danger-actions">
        <button type="button" disabled={editingBlocked} className="school-delete-button" onClick={()=>onDeleteClassroom(classroom?.id)}><X/>ลบชั้นเรียน</button>
        <button type="button" disabled={editingBlocked} className="school-delete-button" onClick={()=>onDeleteSchool(school.id)}><X/>ลบโรงเรียน</button>
     </div>
     </div>
    </div>
   </div>
  </div>
  <div className="card classroom-list">
    <div className="card-head roster-head">
      <div><b>รายชื่อนักเรียน</b><small>{classroom?.name} · กำลังเรียน {activeCount} คน · ออกแล้ว {students.length-activeCount} คน</small></div>
      <button className="primary roster-add" disabled={editingBlocked} onClick={()=>setAdding(true)}><Plus/>เพิ่มนักเรียน</button>
    </div>
    <div className="roster-toolbar">
      <div className="roster-filter">
        <span>ระดับชั้น</span>
        <Select value={classroom?.id||''} onChange={onSelectClass}>
          {school.classrooms.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div className="roster-filter">
        <span>แสดงรายชื่อ</span>
        <Select value={statusFilter} onChange={setStatusFilter}>
          <option value="active">กำลังเรียน</option>
          <option value="inactive">ออกแล้ว</option>
          <option value="all">ทั้งหมด</option>
        </Select>
      </div>
      <div className="roster-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input placeholder="ค้นหาชื่อหรือนามสกุล..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button type="button" onClick={()=>setSearch('')} aria-label="ล้างคำค้นหา"><X/></button>}
      </div>
      <span className="roster-result">พบ {filteredStudents.length} คน</span>
    </div>
  <div className="table-wrap classroom-table-wrap"><table className="responsive-card-table classroom-student-table"><thead><tr><th>เลขที่</th><th>ชื่อ–นามสกุล</th><th>สถานะ</th><th className="center">จัดการ</th></tr></thead><tbody>{filteredStudents.map(s=><tr key={s.id} className={s.active===false?'student-inactive':''}><td data-label="เลขที่" className="number">{String(s.no).padStart(2,'0')}</td><td data-label="ชื่อ–นามสกุล"><b>{s.name}</b></td><td data-label="สถานะ"><span className={`student-status ${s.active===false?'left':'active'}`}>{s.active===false?`ออกแล้ว${s.leftAt?` · ${s.leftAt}`:''}`:'กำลังเรียน'}</span></td><td data-label="จัดการ" className="center"><div className="student-actions"><button disabled={editingBlocked} className="icon-btn" title="แก้ไขข้อมูลหรือสลับเลขที่" onClick={()=>setEditingStudent(s)}><Edit2 size={16}/></button>{s.active===false?<button disabled={editingBlocked} className="icon-btn restore" title="กู้คืน" onClick={()=>restoreStudent(s.id)}><RotateCcw size={16}/></button>:<button disabled={editingBlocked} className="icon-btn danger-text" title="ออกจากชั้นเรียน" onClick={()=>leaveStudent(s)}><UserMinus size={16}/></button>}</div></td></tr>)}</tbody></table></div></div>
  {adding && <AddStudentModal onClose={()=>setAdding(false)} onAdd={addStudents} nextNo={students.length+1}/>}
  {editingStudent && <AddStudentModal onClose={()=>setEditingStudent(null)} onAdd={data=>updateStudent(data[0])} student={editingStudent} isEdit={true}/>}
  {confirming && <ConfirmModal {...confirming} onClose={()=>setConfirming(null)}/>} 
  </>
}

export default Classroom;
