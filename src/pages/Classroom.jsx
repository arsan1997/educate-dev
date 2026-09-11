import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw, Trash2, ListOrdered} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '../model';
import {supabase,isSupabaseConfigured} from '../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice,acquireLock,releaseLock,keepLockAlive} from '../dataService';
import brandLogo from '../assets/logo.png';
import Field from '../components/ui/Field';
import Select from '../components/ui/Select';
import ConfirmModal from '../components/ui/ConfirmModal';
import AddStudentModal from '../components/modals/AddStudentModal';

function Classroom({meta,setMeta,students,setStudents,importExcel,importBulkExcel,flash,offices,schools,school,classroom,onAddSchool,onAddOffice,onDeleteOffice,onRenameSchool,onSelectSchool,onSelectClass,onDeleteStudent,onDeleteSchool,onDeleteClassroom,user,userProfiles,readOnly=false}){
  const [adding,setAdding]=useState(false);
  const [addingOffice,setAddingOffice]=useState(false),[newOffice,setNewOffice]=useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingNumbers,setEditingNumbers]=useState(false),[numberDraft,setNumberDraft]=useState({}),[savingNumbers,setSavingNumbers]=useState(false);
  const [search, setSearch] = useState('');
  const [schoolSearch,setSchoolSearch]=useState(''),[officeFilter,setOfficeFilter]=useState(school?.officeId||'unassigned');
  const [statusFilter,setStatusFilter]=useState('active');
  const [confirming, setConfirming] = useState(null);
  const [renamingSchool,setRenamingSchool]=useState(false),[schoolNameDraft,setSchoolNameDraft]=useState(''),[schoolNameError,setSchoolNameError]=useState(''),[savingSchoolName,setSavingSchoolName]=useState(false);
  const [editingSchoolMeta,setEditingSchoolMeta]=useState(false),[schoolMetaDraft,setSchoolMetaDraft]=useState(null);
  const [classroomLockReady,setClassroomLockReady]=useState(false),[classroomLockMessage,setClassroomLockMessage]=useState('');
  const editingBlocked=readOnly||!classroomLockReady;
  const schoolMetaEditingBlocked=editingBlocked||!editingSchoolMeta;
  const canDeleteSchoolStructure=String(user?.email||'').trim().toLowerCase()==='arsan113@gmail.com';

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
  const numberEditorRows=[...students].sort((a,b)=>Number(a.no)-Number(b.no)||String(a.name).localeCompare(String(b.name),'th'));
  const numberValidation=useMemo(()=>{
    const invalidIds=new Set(),counts=new Map();
    numberEditorRows.forEach(student=>{
      const value=String(numberDraft[student.id]??student.no).trim(),number=Number(value);
      if(!/^\d+$/.test(value)||!Number.isSafeInteger(number)||number<1){invalidIds.add(student.id);return;}
      counts.set(number,(counts.get(number)||0)+1);
    });
    const duplicateNumbers=new Set([...counts].filter(([,count])=>count>1).map(([number])=>number));
    const duplicateIds=new Set(numberEditorRows.filter(student=>duplicateNumbers.has(Number(String(numberDraft[student.id]??student.no).trim()))).map(student=>student.id));
    return {invalidIds,duplicateIds,duplicateNumbers,valid:!invalidIds.size&&!duplicateNumbers.size};
  },[numberEditorRows,numberDraft]);
  const officeSchools=schools.filter(s=>officeFilter==='unassigned'?!s.officeId:String(s.officeId)===String(officeFilter)),matchingSchools=officeSchools.filter(s=>s.name.toLocaleLowerCase('th-TH').includes(schoolSearch.trim().toLocaleLowerCase('th-TH')));
  useEffect(()=>{setOfficeFilter(school?.officeId||'unassigned');setSchoolSearch('')},[school?.id]);
  useEffect(()=>{setRenamingSchool(false);setSchoolNameDraft('');setSchoolNameError('');setEditingSchoolMeta(false);setSchoolMetaDraft(null);setAddingOffice(false);setNewOffice('')},[school?.id,classroom?.id]);

  const beginSchoolMetaEdit=()=>{
    if(editingBlocked)return;
    setSchoolMetaDraft({...meta});
    setEditingSchoolMeta(true);
  };
  const cancelSchoolMetaEdit=()=>{
    setEditingSchoolMeta(false);
    setSchoolMetaDraft(null);
    setAddingOffice(false);
    setNewOffice('');
  };
  const requestSchoolMetaSave=()=>{
    if(!schoolMetaDraft)return;
    const changes=[];
    const officeName=id=>offices.find(office=>String(office.id)===String(id))?.name||'ยังไม่ระบุสำนักงาน';
    if(String(schoolMetaDraft.officeId||'')!==String(meta.officeId||''))changes.push(`สำนักงาน: ${officeName(meta.officeId)} → ${officeName(schoolMetaDraft.officeId)}`);
    if(String(schoolMetaDraft.level||'')!==String(meta.level||''))changes.push(`ชื่อชั้นเรียน: ${meta.level||'—'} → ${schoolMetaDraft.level||'—'}`);
    if(String(schoolMetaDraft.year||'')!==String(meta.year||''))changes.push(`ปีการศึกษา: ${meta.year||'—'} → ${schoolMetaDraft.year||'—'}`);
    if(String(schoolMetaDraft.term||'')!==String(meta.term||''))changes.push(`ภาคเรียน: ${meta.term||'—'} → ${schoolMetaDraft.term||'—'}`);
    if(!changes.length){cancelSchoolMetaEdit();return;}
    setConfirming({
      title:'ตรวจสอบก่อนบันทึกข้อมูล',
      message:`โรงเรียน ${school.name}\nชั้นเรียน ${classroom?.name||'—'}\n\n${changes.join('\n')}`,
      danger:false,
      dangerLabel:'ยืนยันและบันทึก',
      onConfirm:()=>{
        setMeta(schoolMetaDraft);
        setEditingSchoolMeta(false);
        setSchoolMetaDraft(null);
        setAddingOffice(false);
        setNewOffice('');
        flash('รับการเปลี่ยนแปลงแล้ว กำลังบันทึกอัตโนมัติ');
      }
    });
  };

  const openSchoolRename=()=>{setSchoolNameDraft(school.name);setSchoolNameError('');setRenamingSchool(true)};
  const submitSchoolRename=async event=>{
    event.preventDefault();
    const nextName=schoolNameDraft.trim().replace(/\s+/g,' ');
    if(!nextName){setSchoolNameError('กรุณาระบุชื่อโรงเรียนใหม่');return}
    if(nextName===school.name){setRenamingSchool(false);return}
    try{
      setSavingSchoolName(true);setSchoolNameError('');
      await onRenameSchool(school.id,nextName);
      setSchoolSearch('');setRenamingSchool(false);
    }catch(error){setSchoolNameError(error.message||'เปลี่ยนชื่อโรงเรียนไม่สำเร็จ กรุณาลองใหม่')}
    finally{setSavingSchoolName(false)}
  };

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

  const openNumberEditor=()=>{
    setNumberDraft(Object.fromEntries(students.map(student=>[student.id,String(student.no)])));
    setEditingNumbers(true);
  };
  const saveStudentNumbers=async()=>{
    if(!numberValidation.valid)return;
    const assignments=numberEditorRows.map(student=>({id:student.id,no:Number(numberDraft[student.id]??student.no)}));
    const assignedNumbers=new Map(assignments.map(item=>[item.id,item.no]));
    const changedCount=students.filter(student=>Number(student.no)!==assignedNumbers.get(student.id)).length;
    if(!changedCount){setEditingNumbers(false);return;}
    try{
      setSavingNumbers(true);
      await saveStudentOrder(classroom.id,assignments);
      setStudents(students.map(student=>({...student,no:assignedNumbers.get(student.id)})));
      setEditingNumbers(false);
      flash(`บันทึกเลขที่นักเรียน ${changedCount} คนเรียบร้อยแล้ว`);
    }catch(error){console.error(error);flash(`แก้ไขเลขที่ทั้งห้องไม่สำเร็จ: ${error.message}`)}
    finally{setSavingNumbers(false);}
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
  const requestDeleteStudent=student=>{
    setEditingStudent(null);
    setConfirming({
      title:'ยืนยันการลบนักเรียนถาวร',
      message:`คุณแน่ใจหรือไม่ว่าต้องการลบ "${student.name}" ออกจากห้องเรียน?\nข้อมูลคะแนนและผลสอบทั้งหมดของนักเรียนคนนี้จะถูกลบถาวรและกู้คืนไม่ได้`,
      dangerLabel:'ลบถาวร',
      onConfirm:()=>onDeleteStudent?.(student)
    });
  };

  if(!school)return <div className="page-title classroom-page-title"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h1>จัดการโรงเรียนและชั้นเรียน</h1><p>ยังไม่มีข้อมูลโรงเรียน โปรดเพิ่มหรือนำเข้าไฟล์ Excel</p></div><div className="page-buttons classroom-page-actions"><a href="/template.xlsx" download className="button"><Download/>โหลดแบบฟอร์ม</a><button className="button" onClick={onAddSchool}><Plus/>เพิ่มโรงเรียน</button><div className="classroom-import-actions"><label className="primary"><Upload/>นำเข้า 1 โรงเรียน<input type="file" accept=".xlsx,.xls" onChange={importExcel} hidden/></label><label className="primary outline" title="นำเข้าข้อมูลหลายโรงเรียนพร้อมกัน (ไม่มี Popup ให้กดยืนยัน)"><Upload/>นำเข้ารวดเดียว (Bulk)<input type="file" multiple accept=".xlsx,.xls" onChange={importBulkExcel} hidden/></label></div></div></div>;
  return <>
  <div className="page-title classroom-page-title"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h1>จัดการโรงเรียนและชั้นเรียน</h1><p>1 ไฟล์ Excel = 1 โรงเรียน · ระบบอ่านทุกชีตและทุกครั้งทดสอบอัตโนมัติ</p></div><div className="page-buttons classroom-page-actions"><a href="/template.xlsx" download className="button"><Download/>โหลดแบบฟอร์ม</a><button className="button" onClick={onAddSchool}><Plus/>เพิ่มโรงเรียน</button><div className="classroom-import-actions"><label className="primary"><Upload/>นำเข้า 1 โรงเรียน<input type="file" accept=".xlsx,.xls" onChange={importExcel} hidden/></label><label className="primary outline" title="นำเข้าข้อมูลหลายโรงเรียนพร้อมกัน (ไม่มี Popup ให้กดยืนยัน)"><Upload/>นำเข้ารวดเดียว (Bulk)<input type="file" multiple accept=".xlsx,.xls" onChange={importBulkExcel} hidden/></label></div></div></div>
  <div className="card school-browser classroom-step-card"><div className="school-browser-title"><span className="classroom-step-number">1</span><School/><div><b>เลือกโรงเรียนที่จะจัดการ</b><small>{editingSchoolMeta?'กำลังแก้ไขข้อมูล กรุณาบันทึกหรือยกเลิกก่อนเปลี่ยนโรงเรียน':`${officeSchools.length} โรงเรียนในสำนักงาน · พบ ${matchingSchools.length} รายการ`}</small></div></div><Field label="สำนักงาน"><Select disabled={editingSchoolMeta} value={officeFilter} onChange={id=>{const next=schools.find(s=>id==='unassigned'?!s.officeId:String(s.officeId)===String(id));if(!next||onSelectSchool(next.id)!==false){setOfficeFilter(id);setSchoolSearch('')}}}>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}{schools.some(s=>!s.officeId)&&<option value="unassigned">ยังไม่ระบุสำนักงาน</option>}</Select></Field><Field label="ค้นหาโรงเรียน"><div className="school-browser-search"><input disabled={editingSchoolMeta} value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)} placeholder="พิมพ์ชื่อโรงเรียน..."/>{schoolSearch&&<button type="button" disabled={editingSchoolMeta} onClick={()=>setSchoolSearch('')} aria-label="ล้างคำค้นหา"><X/></button>}</div></Field><Field label="โรงเรียน"><Select disabled={editingSchoolMeta} value={matchingSchools.some(s=>s.id===school.id)?school.id:''} onChange={onSelectSchool}><option value="" disabled hidden>{matchingSchools.length?'เลือกโรงเรียน':'ไม่พบโรงเรียน'}</option>{matchingSchools.map(s=><option key={s.id} value={s.id}>{s.name}{(s.year||s.term)?' ('+(s.term?'เทอม '+s.term:'')+(s.term&&s.year?' ':'')+(s.year?'ปี '+s.year:'')+')':''} · {s.classrooms.length} ห้อง</option>)}</Select></Field></div>
  <div className="card classroom-editor-card">
   <div className="card-head classroom-editor-head"><div><span className="classroom-step-number">2</span><div><b>จัดการข้อมูลโรงเรียน</b><small>{editingSchoolMeta?'โหมดแก้ไข · ตรวจสอบและบันทึกเมื่อเสร็จ':'ล็อกไว้เพื่อป้องกันการเปลี่ยนข้อมูลโดยไม่ตั้งใจ'} · {school.name} · {school.classrooms.length} ห้องเรียน</small></div></div><div className="classroom-meta-actions">{editingSchoolMeta?<><button type="button" className="button" onClick={cancelSchoolMetaEdit}>ยกเลิก</button><button type="button" className="primary" onClick={requestSchoolMetaSave}><Save/>ตรวจสอบและบันทึก</button></>:<button type="button" className="button" disabled={editingBlocked} onClick={beginSchoolMetaEdit}><Edit2/>แก้ไขข้อมูล</button>}</div></div>
   {classroomLockMessage&&<div className="classroom-lock-banner"><ShieldCheck/><div><b>หยุดการแก้ไขชั่วคราว</b><small>{classroomLockMessage} หากไม่มีผู้ใช้อื่นกำลังแก้ไข กรุณารีเฟรชหน้าแล้วลองใหม่</small></div></div>}
   <div className="classroom-editor-layout">
    <div className="classroom-school-meta">
      <Field label="ชื่อโรงเรียน"><div className="school-name-control"><input readOnly value={school.name||''}/><button type="button" className="button" disabled={schoolMetaEditingBlocked} onClick={openSchoolRename}><Edit2/>แก้ไขชื่อ</button></div></Field>
     <Field label="สำนักงานที่รับผิดชอบ"><div className="office-picker" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}><Select disabled={schoolMetaEditingBlocked} style={{ flex: 1, minWidth: '200px' }} value={(schoolMetaDraft||meta).officeId||''} onChange={officeId=>setSchoolMetaDraft({...schoolMetaDraft,officeId})}><option value="">ยังไม่ระบุสำนักงาน</option>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select>{editingSchoolMeta&&(schoolMetaDraft||meta).officeId&&<button type="button" disabled={editingBlocked} className="button danger-text" title="ลบสำนักงานนี้" onClick={()=>{const o=offices.find(x=>x.id===(schoolMetaDraft||meta).officeId);if(o)onDeleteOffice?.(o.id,o.name)}}><Trash2 size={16}/></button>}<button type="button" disabled={schoolMetaEditingBlocked} className="button" onClick={()=>setAddingOffice(!addingOffice)}><Plus/>เพิ่มสำนักงาน</button></div>{addingOffice&&<div className="office-create school-office-create" style={{ marginTop: '12px' }}><input disabled={schoolMetaEditingBlocked} value={newOffice} onChange={e=>setNewOffice(e.target.value)} placeholder="ชื่อสำนักงาน"/><button type="button" className="primary" disabled={schoolMetaEditingBlocked||!newOffice.trim()} onClick={async()=>{const office=await onAddOffice(newOffice);if(office){setSchoolMetaDraft({...schoolMetaDraft,officeId:office.id});setNewOffice('');setAddingOffice(false)}}}>บันทึก</button></div>}</Field>
    </div>
    <div className="classroom-class-editor">
     <div className="classroom-subsection-head"><div><b>จัดการชั้นเรียน</b><small>เลือกชั้นเรียนเพื่อแก้ไขรายละเอียด</small></div><span>{school.classrooms.length} ห้อง</span></div>
     <div className="form-grid mini classroom-mini-form">
      <Field label="เลือกชั้นเรียน">
       <Select disabled={editingSchoolMeta} value={classroom?.id||''} onChange={onSelectClass}>
         {school.classrooms.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
       </Select>
     </Field>
      <Field label="ชื่อชั้นเรียน / ห้อง">
        <input disabled={schoolMetaEditingBlocked} value={(schoolMetaDraft||meta).level||''} onChange={e=>setSchoolMetaDraft({...schoolMetaDraft,level:e.target.value})}/>
     </Field>
      <Field label="ปีการศึกษา"><input disabled={schoolMetaEditingBlocked} value={(schoolMetaDraft||meta).year||''} onChange={e=>setSchoolMetaDraft({...schoolMetaDraft,year:e.target.value})}/></Field>
      <Field label="ภาคเรียนที่"><input disabled={schoolMetaEditingBlocked} value={(schoolMetaDraft||meta).term||''} onChange={e=>setSchoolMetaDraft({...schoolMetaDraft,term:e.target.value})}/></Field>
      {canDeleteSchoolStructure&&<div className="mini-actions classroom-danger-actions">
       <button type="button" disabled={editingBlocked} className="school-delete-button" onClick={()=>onDeleteClassroom(classroom?.id)}><X/>ลบชั้นเรียน</button>
       <button type="button" disabled={editingBlocked} className="school-delete-button" onClick={()=>onDeleteSchool(school.id)}><X/>ลบโรงเรียน</button>
      </div>}
     </div>
    </div>
   </div>
  </div>
  <div className="card classroom-list">
    <div className="card-head roster-head">
      <div><b>รายชื่อนักเรียน</b><small>{classroom?.name} · กำลังเรียน {activeCount} คน · ออกแล้ว {students.length-activeCount} คน</small></div>
       <div className="roster-head-actions"><button className="button roster-renumber" disabled={editingBlocked||!students.length} onClick={openNumberEditor}><ListOrdered/>แก้ไขเลขที่ทั้งห้อง</button><button className="primary roster-add" disabled={editingBlocked} onClick={()=>setAdding(true)}><Plus/>เพิ่มนักเรียน</button></div>
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
   {renamingSchool&&<div className="modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&!savingSchoolName&&setRenamingSchool(false)}><form className="modal-card school-rename-modal" onSubmit={submitSchoolRename} role="dialog" aria-modal="true" aria-labelledby="school-rename-title"><div className="modal-head"><div><span className="eyebrow">ข้อมูลสำคัญระดับโรงเรียน</span><h2 id="school-rename-title">กำลังเปลี่ยนชื่อโรงเรียน</h2></div><button type="button" className="modal-close" disabled={savingSchoolName} onClick={()=>setRenamingSchool(false)} aria-label="ปิด"><X/></button></div><div className="school-rename-body"><div className="school-rename-warning"><AlertCircle/><span><b>โปรดตรวจสอบว่าเป็นโรงเรียนที่ต้องการแก้ไข</b><small>รายการนี้เปลี่ยนเฉพาะชื่อ โรงเรียน ห้องเรียน นักเรียน และคะแนนยังเป็นข้อมูลชุดเดิม</small></span></div><dl className="school-rename-context"><div><dt>ชื่อปัจจุบัน</dt><dd>{school.name}</dd></div><div><dt>สำนักงาน</dt><dd>{offices.find(office=>String(office.id)===String(school.officeId))?.name||'ยังไม่ระบุสำนักงาน'}</dd></div><div><dt>ปี / ภาคเรียน</dt><dd>{school.year||'—'} / {school.term||'—'}</dd></div><div><dt>จำนวนห้อง</dt><dd>{school.classrooms.length} ห้อง</dd></div></dl><Field label="ชื่อโรงเรียนใหม่"><input autoFocus value={schoolNameDraft} onChange={event=>{setSchoolNameDraft(event.target.value);setSchoolNameError('')}} /></Field>{schoolNameError&&<p className="school-rename-error">{schoolNameError}</p>}</div><div className="modal-actions"><button type="button" className="button" disabled={savingSchoolName} onClick={()=>setRenamingSchool(false)}>ยกเลิก</button><button type="submit" className="primary" disabled={savingSchoolName||!schoolNameDraft.trim()||schoolNameDraft.trim().replace(/\s+/g,' ')===school.name}>{savingSchoolName?'กำลังบันทึก...':'ยืนยันเปลี่ยนชื่อ'}</button></div></form></div>}
   {adding && <AddStudentModal onClose={()=>setAdding(false)} onAdd={addStudents} nextNo={students.length+1}/>}
   {editingStudent && <AddStudentModal onClose={()=>setEditingStudent(null)} onAdd={data=>updateStudent(data[0])} onDelete={requestDeleteStudent} student={editingStudent} isEdit={true}/>}
   {editingNumbers&&<div className="modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&!savingNumbers&&setEditingNumbers(false)}><div className="modal-card bulk-number-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-number-title"><div className="modal-head"><div><span className="eyebrow">{classroom?.name}</span><h2 id="bulk-number-title">แก้ไขเลขที่ทั้งห้อง</h2><small>เปลี่ยนเฉพาะเลขที่ คะแนน สถานะ และข้อมูลนักเรียนเดิมจะคงอยู่</small></div><button type="button" className="modal-close" disabled={savingNumbers} onClick={()=>setEditingNumbers(false)} aria-label="ปิด"><X/></button></div><div className="bulk-number-body"><div className="bulk-number-note">กรอกเลขที่ใหม่ให้ครบทุกคน ระบบจะตรวจเลขที่ซ้ำก่อนบันทึก</div><div className="bulk-number-table-wrap"><table className="bulk-number-table"><thead><tr><th>เดิม</th><th>นักเรียน</th><th>เลขที่ใหม่</th></tr></thead><tbody>{numberEditorRows.map(student=>{const invalid=numberValidation.invalidIds.has(student.id),duplicate=numberValidation.duplicateIds.has(student.id);return <tr key={student.id} className={invalid||duplicate?'invalid':''}><td>{String(student.no).padStart(2,'0')}</td><td><b>{student.name}</b>{student.active===false&&<small>ออกแล้ว</small>}</td><td><input aria-label={`เลขที่ใหม่ของ ${student.name}`} className={invalid||duplicate?'input-error':''} type="number" min="1" step="1" inputMode="numeric" value={numberDraft[student.id]??student.no} onChange={event=>setNumberDraft(current=>({...current,[student.id]:event.target.value}))}/></td></tr>})}</tbody></table></div>{numberValidation.invalidIds.size>0&&<p className="bulk-number-error">กรุณากรอกเลขที่เป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไปให้ครบทุกคน</p>}{numberValidation.duplicateNumbers.size>0&&<p className="bulk-number-error">เลขที่ซ้ำ: {[...numberValidation.duplicateNumbers].sort((a,b)=>a-b).join(', ')}</p>}</div><div className="modal-actions"><button type="button" className="button" disabled={savingNumbers} onClick={()=>setEditingNumbers(false)}>ยกเลิก</button><button type="button" className="primary" disabled={savingNumbers||!numberValidation.valid} onClick={saveStudentNumbers}><Save/>{savingNumbers?'กำลังบันทึก...':'ตรวจสอบและบันทึก'}</button></div></div></div>}
   {confirming && <ConfirmModal {...confirming} onClose={()=>setConfirming(null)}/>}
  </>
}

export default Classroom;
