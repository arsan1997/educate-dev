import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES,compareClassNames} from '../../model';
import {supabase,isSupabaseConfigured} from '../../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from '../../dataService';
import brandLogo from '../../assets/logo.png';
import Field from '../ui/Field';
import Select from '../ui/Select';

function AddSchoolModal({onClose,onAdd,offices,onAddOffice}){
  const [form,setForm]=useState({name:'',year:new Date().getFullYear()+543,term:'1',levels:'',officeId:''});
  const [newOffice,setNewOffice]=useState(''),[addingOffice,setAddingOffice]=useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const valid=form.name.trim()&&form.levels.trim()&&!isSubmitting;
  const submit=async e=>{
    e.preventDefault();
    if(!valid)return;
    setIsSubmitting(true);
    const classrooms=form.levels.split(',').map(n=>n.trim()).filter(Boolean).map(n=>({id:`class-${Date.now()}-${Math.random()}`,name:n,students:[]})).sort((a,b)=>compareClassNames(a.name, b.name));
    await onAdd({...form,classrooms});
    setIsSubmitting(false);
  };
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <form className="modal-card" onSubmit={submit}>
      <div className="modal-head"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h2>เพิ่มโรงเรียนใหม่</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="ปิด"><X/></button></div>
      <div style={{padding:'22px 24px',display:'flex',flexDirection:'column',gap:'15px'}}>
        <Field label="ชื่อโรงเรียน"><input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="เช่น โรงเรียนศรีบางลางวิทยานุสรณ์"/></Field>
        <Field label="สำนักงานที่รับผิดชอบ"><div className="office-picker"><Select value={form.officeId} onChange={officeId=>setForm({...form,officeId})}><option value="">ยังไม่ระบุสำนักงาน</option>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select><button type="button" className="button" onClick={()=>setAddingOffice(!addingOffice)}><Plus/>เพิ่มสำนักงาน</button></div></Field>
        {addingOffice&&<div className="office-create"><input value={newOffice} onChange={e=>setNewOffice(e.target.value)} placeholder="ชื่อสำนักงาน เช่น สำนักงานหาดใหญ่"/><button type="button" className="primary" disabled={!newOffice.trim()} onClick={async()=>{const office=await onAddOffice(newOffice);if(office){setForm({...form,officeId:office.id});setNewOffice('');setAddingOffice(false)}}}>บันทึกสำนักงาน</button></div>}
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

export default AddSchoolModal;
