import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '../model';
import {supabase,isSupabaseConfigured} from '../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from '../dataService';
import brandLogo from '../assets/logo.png';
import Field from '../components/ui/Field';
import Select from '../components/ui/Select';

 function AccessAdmin({schools,currentUserId,flash}){
  const [users,setUsers]=useState([]),[members,setMembers]=useState([]),[drafts,setDrafts]=useState({}),[loading,setLoading]=useState(true),[saving,setSaving]=useState('');
  const [schoolSearch,setSchoolSearch]=useState({});
  const [userSearch,setUserSearch]=useState('');
 const refresh=async()=>{setLoading(true);try{const data=await loadAccessAdmin();const profiles=data?.profiles||[],memberRows=data?.members||[];setUsers(profiles);setMembers(memberRows);setDrafts(Object.fromEntries(profiles.map(p=>[p.id,{role:p.role,schoolIds:memberRows.filter(m=>m.user_id===p.id).map(m=>m.school_id)}])))}catch(e){console.error(e);flash('โหลดรายชื่อผู้ใช้ไม่สำเร็จ')}finally{setLoading(false)}};
 useEffect(()=>{refresh()},[]);
 const change=(id,patch)=>setDrafts(all=>({...all,[id]:{...all[id],...patch}}));
 const toggleSchool=(id,schoolId)=>{const list=drafts[id]?.schoolIds||[];change(id,{schoolIds:list.includes(schoolId)?list.filter(x=>x!==schoolId):[...list,schoolId]})};
 const save=async p=>{const draft=drafts[p.id];if(!draft)return;setSaving(p.id);try{await updateUserAccess(p.id,draft.role,draft.schoolIds);flash(`บันทึกสิทธิ์ ${p.email||p.full_name} แล้ว`);await refresh()}catch(e){console.error(e);flash(`บันทึกสิทธิ์ไม่สำเร็จ: ${e.message}`)}finally{setSaving('')}};
  return <><div className="page-title"><div><span className="eyebrow">ADMINISTRATION</span><h1>จัดการผู้ใช้งาน</h1><p>อนุมัติบัญชี กำหนดบทบาท และเลือกโรงเรียนที่แต่ละคนเข้าถึงได้</p></div></div>
  <div className="access-note"><ShieldCheck/><div><b>บัญชีใหม่จะยังไม่เห็นข้อมูล</b><small>จนกว่า Super Admin จะเลือกสิทธิ์และโรงเรียน แล้วกดบันทึก</small></div></div>

  <div style={{marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center'}}>
    <div style={{position:'relative', width: '300px'}}>
      <input type="text" placeholder="ค้นหาชื่อ, อีเมล หรือบทบาท..." value={userSearch} onChange={e=>setUserSearch(e.target.value)} style={{width:'100%', padding:'10px 15px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--bg)'}}/>
    </div>
  </div>

  {loading?<div className="card admin-loading">กำลังโหลดรายชื่อผู้ใช้…</div>:<div className="admin-users">{(users||[]).filter(p=>!userSearch.trim()||(p.full_name||'').toLowerCase().includes(userSearch.toLowerCase())||(p.email||'').toLowerCase().includes(userSearch.toLowerCase())||(p.role||'').includes(userSearch.toLowerCase())).map(p=>{const draft=drafts[p.id]||{role:p.role,schoolIds:[]},needsSchools=['school_admin','evaluator'].includes(draft.role);return <div className="card admin-user" key={p.id}>
   <div className="admin-user-head"><div className="avatar">{(p.full_name||p.email||'U').slice(0,2)}</div><div><b>{p.full_name||'ยังไม่ได้ระบุชื่อ'}</b><small>{p.email||'ไม่พบอีเมล'}{p.id===currentUserId?' · บัญชีของคุณ':''}</small></div><span className={`role-pill ${p.role}`}>{p.role==='pending'?'ระงับการเข้าถึง':p.role==='viewer'?'ดูอย่างเดียว':p.role==='super_admin'?'Super Admin':p.role==='school_admin'?'ผู้ดูแลโรงเรียน':'ผู้ประเมิน'}</span></div>
   <div className="admin-access-form"><Field label="ระดับสิทธิ์"><Select value={draft.role} onChange={role=>change(p.id,{role})}><option value="viewer">ดูอย่างเดียว</option><option value="evaluator">ผู้ประเมิน</option><option value="school_admin">ผู้ดูแลโรงเรียน</option><option value="super_admin">Super Admin</option><option value="pending">ระงับการเข้าถึง</option></Select></Field>
    {needsSchools&&<div className="school-permissions">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
        <span>โรงเรียนที่เข้าถึงได้ <small>({draft.schoolIds.length}/{schools.length})</small></span>
        <input type="text" placeholder="ค้นหาชื่อโรงเรียน..." className="school-search-input" style={{padding:'4px 8px', borderRadius:'6px', border:'1px solid var(--border)', fontSize:'0.85rem', width:'200px', background:'var(--bg)'}} value={schoolSearch[p.id]||''} onChange={e=>setSchoolSearch({...schoolSearch, [p.id]:e.target.value})} />
      </div>
      <div style={{maxHeight:'250px', overflowY:'auto', border:'1px solid var(--border)', padding:'8px', borderRadius:'6px', background:'var(--bg-alt)'}}>
        {schools.filter(s=>!(schoolSearch[p.id]||'').trim() || s.name.toLowerCase().includes(schoolSearch[p.id].toLowerCase())).map(s=><label key={s.id} style={{display:'flex', gap:'8px', alignItems:'center', padding:'6px', borderBottom:'1px solid var(--border)', cursor:'pointer', margin:0}}><input type="checkbox" checked={draft.schoolIds.includes(String(s.id))} onChange={()=>toggleSchool(p.id,String(s.id))}/><span>{s.name} <small style={{color:'var(--text-muted)'}}>ปี {s.year} · ภาค {s.term}</small></span></label>)}
        {!schools.length&&<small>ยังไม่มีโรงเรียนในระบบ</small>}
      </div>
    </div>}
   <button className="primary" disabled={saving===p.id||p.id===currentUserId&&draft.role!=='super_admin'} onClick={()=>save(p)}><Save/>{saving===p.id?'กำลังบันทึก…':'บันทึกสิทธิ์'}</button></div>
  </div>})}</div>}
 </>;
}

export default AccessAdmin;
