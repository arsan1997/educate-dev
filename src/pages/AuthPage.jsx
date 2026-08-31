import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '../model';
import {supabase,isSupabaseConfigured} from '../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from '../dataService';
import brandLogo from '../assets/logo.png';
import GoogleMark from '../components/ui/GoogleMark';
import AuthLoading from '../components/ui/AuthLoading';
import PendingAccess from '../components/ui/PendingAccess';
import Field from '../components/ui/Field';

function AuthPage(){
  const [mode,setMode]=useState('login'),[form,setForm]=useState({name:'',email:'',password:''}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const submit=async e=>{e.preventDefault();setBusy(true);setMessage('');const action=mode==='login'?supabase.auth.signInWithPassword({email:form.email,password:form.password}):supabase.auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.name}}});const {data,error}=await action;setBusy(false);if(error)return setMessage(error.message);if(mode==='register'&&!data.session)setMessage('สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี')};
  const loginWithGoogle=async ()=>{
    setBusy(true);setMessage('');
    const {error} = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if(error) { setBusy(false); setMessage(error.message); }
  };
  return <div className="auth-shell"><div className="auth-visual"><div className="brand auth-brand"><img className="brand-logo" src={brandLogo} alt="School Robotics"/></div><div><span className="eyebrow">School Robotics ERP</span><h1>ผลการเรียนรู้<br/>ที่มองเห็นได้จริง</h1><p>จัดการโรงเรียน ห้องเรียน และผลการประเมิน<br/>อย่างเป็นระบบในที่เดียว</p></div><div className="auth-points"><span><CheckCircle2/>ข้อมูลปลอดภัยด้วย Supabase</span><span><CheckCircle2/>รองรับหลายโรงเรียนและหลายผู้ใช้</span></div></div><div className="auth-panel"><form className="auth-card" onSubmit={submit}><div><span className="eyebrow">ยินดีต้อนรับ</span><h2>{mode==='login'?'เข้าสู่ระบบ':'สร้างบัญชีใหม่'}</h2><p>{mode==='login'?'กรอกข้อมูลเพื่อเข้าสู่ระบบประเมินผล':'เริ่มต้นใช้งานระบบสำหรับทีมของคุณ'}</p></div>
    <button type="button" className="button auth-google" onClick={loginWithGoogle} disabled={busy} style={{width:'100%', marginBottom: '16px', display: 'flex', justifyContent: 'center', gap: '8px'}}>
      <GoogleMark style={{width: '20px', height: '20px'}}/>
      {mode==='login' ? 'เข้าสู่ระบบด้วย Google' : 'สมัครสมาชิกด้วย Google'}
    </button>
    <div className="auth-divider" style={{display:'flex', alignItems:'center', textAlign:'center', color:'var(--muted)', fontSize:'0.85rem', margin:'0 0 16px 0'}}>
      <div style={{flex:1, height:'1px', background:'var(--line)'}}></div>
      <span style={{padding:'0 10px'}}>หรือใช้อีเมล</span>
      <div style={{flex:1, height:'1px', background:'var(--line)'}}></div>
    </div>
    {mode==='register'&&<Field label="ชื่อผู้ใช้งาน"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="ชื่อ-นามสกุล"/></Field>}<Field label="อีเมล"><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@school.ac.th"/></Field><Field label="รหัสผ่าน"><input type="password" required minLength="6" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="อย่างน้อย 6 ตัวอักษร"/></Field>{message&&<div className="auth-message">{message}</div>}<button className="primary auth-submit" disabled={busy}>{busy?'กำลังดำเนินการ…':mode==='login'?'เข้าสู่ระบบ':'สมัครสมาชิก'}</button><button type="button" className="auth-switch" onClick={()=>{setMode(mode==='login'?'register':'login');setMessage('')}}>{mode==='login'?'ยังไม่มีบัญชี? สมัครสมาชิก':'มีบัญชีแล้ว? เข้าสู่ระบบ'}</button></form></div></div>}

export default AuthPage;
