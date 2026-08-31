import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from './model';
import {supabase,isSupabaseConfigured} from './supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from './dataService';
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
const baseTabs=[['dashboard','ภาพรวม',LayoutDashboard],['classroom','จัดการชั้นเรียน',Users],['scores','บันทึกผลทดสอบ',ClipboardPenLine],['reports','รายงาน',FileText]];
const restore=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const schoolIdentity=value=>[value?.name,value?.year,value?.term].map(part=>String(part??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('th-TH')).join('|');

function ConfirmModal({title='ยืนยันการทำรายการ',message,onConfirm,onClose,dangerLabel='ยืนยันลบ',danger=true}){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal-card confirm-card"><div className="confirm-icon"><AlertCircle size={48}/></div><h3>{title}</h3><p>{message}</p><div className="modal-actions"><button type="button" className="button" onClick={onClose}>ยกเลิก</button><button type="button" className={`primary${danger?' danger-btn':''}`} onClick={()=>{onConfirm();onClose()}}>{dangerLabel}</button></div></div></div>}

function AddSchoolModal({onClose,onAdd,offices,onAddOffice}){
  const [form,setForm]=useState({name:'',year:new Date().getFullYear()+543,term:'1',levels:'',officeId:''});
  const [newOffice,setNewOffice]=useState(''),[addingOffice,setAddingOffice]=useState(false);
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

function ImportOfficeModal({school,offices,onAddOffice,onConfirm,onClose}){
  const [officeId,setOfficeId]=useState('');
  const [newOffice,setNewOffice]=useState(''),[addingOffice,setAddingOffice]=useState(false);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal-card">
      <div className="modal-head"><div><span className="eyebrow">ก่อนนำเข้าข้อมูล</span><h2>ระบุสำนักงานที่รับผิดชอบ</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="ปิด"><X/></button></div>
      <div className="import-office-body">
        <div className="import-school-summary"><School/><span><small>โรงเรียนจากไฟล์ Excel</small><b>{school.name}</b><small>{school.classrooms.length} ห้อง · {school.sessions.length} ครั้งทดสอบ</small></span></div>
        <Field label="สำนักงานที่รับผิดชอบ"><div className="office-picker"><Select value={officeId} onChange={setOfficeId}><option value="">ยังไม่ระบุสำนักงาน</option>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select><button type="button" className="button" onClick={()=>setAddingOffice(!addingOffice)}><Plus/>เพิ่มสำนักงาน</button></div></Field>
        {addingOffice&&<div className="office-create"><input autoFocus value={newOffice} onChange={e=>setNewOffice(e.target.value)} placeholder="ชื่อสำนักงาน เช่น สำนักงานหาดใหญ่"/><button type="button" className="primary" disabled={!newOffice.trim()} onClick={async()=>{const office=await onAddOffice(newOffice);if(office){setOfficeId(office.id);setNewOffice('');setAddingOffice(false)}}}>บันทึกสำนักงาน</button></div>}
        <p className="import-office-hint">ข้อมูลสำนักงานไม่มีในไฟล์ Excel จึงเลือกหรือเพิ่มเองในขั้นตอนนี้ได้ครับ</p>
      </div>
      <div className="modal-actions"><button type="button" className="button" onClick={onClose}>ยกเลิก</button><button type="button" className="primary" onClick={()=>onConfirm({...school,officeId})}><Upload/>นำเข้าข้อมูล</button></div>
    </div>
  </div>
}

function App({user,profile,onSignOut}){
  const [dark,setDark]=useState(()=>restore('erp-dark',false)),[tab,setTab]=useState(()=>restore('erp-active-tab','dashboard')),[schools,setSchools]=useState([]),[toast,setToast]=useState('');
  const [offices,setOffices]=useState([]);
  const [schoolId,setSchoolId]=useState(()=>restore('erp-active-school',null)),[classId,setClassId]=useState(()=>restore('erp-active-class',null)),[sessionId,setSessionId]=useState(()=>restore('erp-active-session',null));
  const [confirming,setConfirming]=useState(null),[schoolAdding,setSchoolAdding]=useState(false),[pendingImport,setPendingImport]=useState(null),[pdfPreview,setPdfPreview]=useState(null);
  const tabs=profile.role==='super_admin'?[...baseTabs,['admin','จัดการผู้ใช้งาน',ShieldCheck]]:baseTabs;
  const readOnly=profile.role==='viewer';
  const viewerLocked=readOnly&&['classroom','scores','reports'].includes(tab);
  const refs=useRef({}),cloudReady=useRef(false),schoolLoadRequest=useRef(0),dirtyRef=useRef({schools:new Set(),sessions:new Set(),classrooms:new Set(),results:new Map()}),[cloudStatus,setCloudStatus]=useState('loading'),[contextLoading,setContextLoading]=useState(false),school=schools.find(s=>s.id===schoolId)||schools[0],classroom=school?.classrooms.find(c=>c.id===classId)||school?.classrooms[0];
  const classSessions=school?.sessions.filter(s=>s.classId===classroom?.id)||[],session=classSessions.find(s=>s.id===sessionId)||classSessions[0];
  const classroomStudents=(classroom?.students||[]).map(s=>({...s,score:'',time:'',absent:false,...(session?.entries?.[s.id]||{})}));
  const students=classroomStudents.filter(s=>s.active!==false||session?.entries?.[s.id]);
  const meta={school:school?.name||'',year:school?.year||'',term:school?.term||'',officeId:school?.officeId||'',level:classroom?.name||'',test:session?.test||'',date:session?.date||'',robot:session?.robot||'',exam:session?.exam||'',teachingPeriod:session?.teachingPeriod||'',trainer:session?.trainer||''};
  const feedback=session?.feedback||{detail:'',summary:''},stats=useMemo(()=>calcStats(students),[students]);
  const dashboardRows=(school?.classrooms||[]).map(c=>{
    const latest=school.sessions.filter(s=>s.classId===c.id).at(-1),
    merged=c.students.filter(st=>st.active!==false||latest?.entries?.[st.id]).map(st=>({...st,...(latest?.entries?.[st.id]||{})})),
    x=calcStats(merged);
    const scored=merged.filter(st=>!st.absent&&st.score!==''&&st.score!=null&&Number.isFinite(Number(st.score)));
    return {
      name:c.name,
      students:merged.length,
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
  const dashboardStats=calcStats((school?.classrooms||[]).flatMap(c=>{const latest=school.sessions.filter(s=>s.classId===c.id).at(-1);return c.students.filter(st=>st.active!==false||latest?.entries?.[st.id]).map(st=>({...st,...(latest?.entries?.[st.id]||{})}))}));
  const hasDirty=()=>{const d=dirtyRef.current;return d.schools.size||d.sessions.size||d.classrooms.size||d.results.size};
  const flushChanges=async()=>{
   if(readOnly||!cloudReady.current||!hasDirty())return;
   const pending=dirtyRef.current;dirtyRef.current={schools:new Set(),sessions:new Set(),classrooms:new Set(),results:new Map()};setCloudStatus('saving');
   const allSessions=schools.flatMap(s=>s.sessions),allClassrooms=schools.flatMap(s=>s.classrooms);
   try{
    await Promise.all([
     ...[...pending.schools].map(id=>{const target=schools.find(s=>s.id===id);return target?saveSchoolMeta(target,user.id):Promise.resolve()}),
     saveSessionRows([...pending.sessions].map(id=>allSessions.find(s=>s.id===id))),
     ...[...pending.classrooms].map(id=>{const room=allClassrooms.find(c=>c.id===id);return room?saveClassroomStudents(id,room.students):Promise.resolve()})
    ]);
    await Promise.all([...pending.results].map(([sessionId,studentIds])=>{const target=allSessions.find(s=>s.id===sessionId);return target?saveResultRows(sessionId,target.entries,user.id,[...studentIds]):Promise.resolve()}));
    setCloudStatus(hasDirty()?'saving':'saved');
   }catch(error){
    pending.schools.forEach(id=>dirtyRef.current.schools.add(id));pending.sessions.forEach(id=>dirtyRef.current.sessions.add(id));pending.classrooms.forEach(id=>dirtyRef.current.classrooms.add(id));pending.results.forEach((ids,sid)=>{const target=dirtyRef.current.results.get(sid)||new Set();ids.forEach(id=>target.add(id));dirtyRef.current.results.set(sid,target)});setCloudStatus(error.code==='42P01'?'setup':'error');throw error;
   }
  };
  useEffect(()=>{if(tabs.some(([id])=>id===tab))localStorage.setItem('erp-active-tab',JSON.stringify(tab));else setTab('dashboard')},[tab,profile.role]);
  useEffect(()=>{
    localStorage.setItem('erp-dark',JSON.stringify(dark));
    if(dark) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  },[dark]);
  useEffect(()=>localStorage.setItem('erp-active-school',JSON.stringify(school?.id)),[school?.id]);useEffect(()=>localStorage.setItem('erp-active-class',JSON.stringify(classroom?.id)),[classroom?.id]);useEffect(()=>localStorage.setItem('erp-active-session',JSON.stringify(session?.id)),[session?.id]);
  useEffect(()=>{let active=true;(async()=>{try{
   setCloudStatus('loading');
   const [index,remoteOffices]=await Promise.all([loadSchoolIndex(),loadOffices()]);
   if(!active)return;
   setOffices(remoteOffices);setSchools(index);
   if(!index.length){setSchoolId(null);setClassId(null);setSessionId(null);cloudReady.current=true;setCloudStatus('saved');return}
   const preferred=index.find(item=>String(item.id)===String(schoolId))||index[0];
   setSchoolId(preferred.id);setClassId(preferred.classrooms[0]?.id);setSessionId(null);
   try{
    const detail=await loadSchoolDetail(preferred.id);
    if(!active)return;
    setSchools(current=>current.map(item=>item.id===detail.id?{...detail,summary:item.summary}:item));
    setClassId(detail.classrooms[0]?.id);setSessionId(detail.sessions.find(x=>x.classId===detail.classrooms[0]?.id)?.id);
    cloudReady.current=true;setCloudStatus('saved');
   }catch(detailError){
    console.error('School detail load failed',detailError);
    cloudReady.current=true;setCloudStatus(detailError.code==='42P01'?'setup':'error');
   }
  }catch(e){console.error('Initial data load failed',e);cloudReady.current=true;setCloudStatus(e.code==='42P01'?'setup':'error')}})();return()=>{active=false}},[user.id]);
  useEffect(()=>{if(!cloudReady.current||readOnly||!hasDirty())return;setCloudStatus('saving');const timer=setTimeout(()=>flushChanges().catch(console.error),900);return()=>clearTimeout(timer)},[schools,user.id,readOnly]);
  useEffect(()=>{if(cloudStatus!=='saving')return;const warn=e=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[cloudStatus]);
  useEffect(()=>{if(cloudStatus==='saved'&&confirming?.waitForSave){const continueAction=confirming.onConfirm;setConfirming(null);continueAction?.();flash('บันทึกเสร็จแล้ว เปลี่ยนข้อมูลให้เรียบร้อยแล้ว')}},[cloudStatus,confirming]);
  const flash=t=>{setToast(t);setTimeout(()=>setToast(''),2400)},mutateSchool=fn=>setSchools(all=>all.map(s=>s.id===school.id?fn(s):s));
  const markSchool=id=>dirtyRef.current.schools.add(id),markSession=id=>dirtyRef.current.sessions.add(id),markClassroom=id=>dirtyRef.current.classrooms.add(id),markResult=(sid,studentId)=>{const ids=dirtyRef.current.results.get(sid)||new Set();ids.add(studentId);dirtyRef.current.results.set(sid,ids)};
  const selectSchoolNow=id=>{const s=schools.find(x=>x.id===id),request=++schoolLoadRequest.current;setSchoolId(id);setClassId(s?.classrooms[0]?.id);setSessionId(s?.sessions.find(x=>x.classId===s?.classrooms[0]?.id)?.id);if(!s||s.loaded)return;setContextLoading(true);loadSchoolDetail(id).then(detail=>{setSchools(all=>all.map(item=>item.id===id?{...detail,summary:item.summary}:item));if(schoolLoadRequest.current===request){setClassId(detail.classrooms[0]?.id);setSessionId(detail.sessions[0]?.id)}}).catch(error=>{console.error(error);flash(`โหลดข้อมูลโรงเรียนไม่สำเร็จ: ${error.message}`)}).finally(()=>{if(schoolLoadRequest.current===request)setContextLoading(false)})};
  const selectSchool=id=>{if(id===school?.id)return true;if(cloudStatus==='saving'){setConfirming({title:'กำลังบันทึก กรุณารอสักครู่',message:'เมื่อบันทึกบนคลาวด์เสร็จ ระบบจะปิดหน้าต่างและเปลี่ยนโรงเรียนให้อัตโนมัติ',danger:false,dangerLabel:'เปลี่ยนทันที',waitForSave:true,onConfirm:()=>selectSchoolNow(id)});return false}selectSchoolNow(id);return true};
  const selectSchoolAfter=s=>{schoolLoadRequest.current++;setContextLoading(false);setSchoolId(s.id);setClassId(s.classrooms[0]?.id);setSessionId(s.sessions[0]?.id);setTab('classroom')};
  const selectClassNow=id=>{setClassId(id);setSessionId(school.sessions.find(s=>s.classId===id)?.id)};
  const selectClass=id=>{if(id===classroom?.id)return true;if(cloudStatus==='saving'){setConfirming({title:'กำลังบันทึก กรุณารอสักครู่',message:'เมื่อบันทึกบนคลาวด์เสร็จ ระบบจะปิดหน้าต่างและเปลี่ยนระดับชั้นให้อัตโนมัติ',danger:false,dangerLabel:'เปลี่ยนทันที',waitForSave:true,onConfirm:()=>selectClassNow(id)});return false}selectClassNow(id);return true};
  const setMeta=next=>{if(!school)return;markSchool(school.id);if(session)markSession(session.id);mutateSchool(s=>({...s,name:next.school,year:next.year,term:next.term,officeId:next.officeId||'',sessions:s.sessions.map(x=>x.id===session?.id?{...x,test:next.test,date:next.date,robot:next.robot,exam:next.exam,teachingPeriod:next.teachingPeriod,trainer:next.trainer}:x)}))};
  const setFeedback=next=>{if(!session)return;markSession(session.id);mutateSchool(s=>({...s,sessions:s.sessions.map(x=>x.id===session.id?{...x,feedback:next}:x)}))};
  const update=(id,key,val)=>{if(!session)return;markResult(session.id,id);mutateSchool(s=>({...s,sessions:s.sessions.map(x=>x.id===session.id?{...x,entries:{...x.entries,[id]:{...x.entries[id],[key]:val}}}:x)}))};
  const setStudents=nextOrFn=>{if(!classroom||!session)return;const next=typeof nextOrFn==='function'?nextOrFn(classroomStudents):nextOrFn;markClassroom(classroom.id);next.forEach(st=>markResult(session.id,st.id));mutateSchool(s=>({...s,classrooms:s.classrooms.map(c=>c.id===classroom.id?{...c,students:next.map(({score,time,absent,...student})=>student)}:c),sessions:s.sessions.map(x=>x.id===session.id?{...x,entries:Object.fromEntries(next.map(st=>[st.id,{score:st.score,time:st.time,absent:st.absent}]))}:x)}))};
  const move=(i,key,e)=>{if(['Enter','ArrowDown'].includes(e.key)){e.preventDefault();refs.current[`${i+1}-${key}`]?.focus()}};
  const importExcel=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=new FileReader();r.onload=async ev=>{try{
   flash('กำลังอ่านไฟล์ Excel...');
   const imported=await parseSchoolWorkbook(ev.target.result,f.name);
   if(!imported.classrooms.length)throw Error('ไม่พบรายชื่อนักเรียน');
   const duplicate=schools.find(item=>schoolIdentity(item)===schoolIdentity(imported));
   if(duplicate){
    setConfirming({title:'พบข้อมูลโรงเรียนนี้แล้ว',message:`${duplicate.name} ปีการศึกษา ${duplicate.year} ภาคเรียนที่ ${duplicate.term} มีอยู่ในระบบแล้ว เพื่อป้องกันข้อมูลซ้ำ ระบบจะไม่นำเข้าเป็นรายการใหม่`,dangerLabel:'เปิดข้อมูลเดิม',danger:false,onConfirm:()=>{selectSchoolAfter(duplicate);flash('เปิดข้อมูลโรงเรียนเดิมแล้ว')}});
    return;
   }
   setPendingImport(imported);flash('อ่านไฟล์สำเร็จ กรุณาระบุสำนักงานก่อนนำเข้า');
  }catch(err){flash(`นำเข้าไม่สำเร็จ: ${err.message}`)}};r.readAsArrayBuffer(f)};
  const addSchool=async data=>{
   const candidate={name:data.name,year:String(data.year),term:String(data.term)},duplicate=schools.find(item=>schoolIdentity(item)===schoolIdentity(candidate));
   if(duplicate){setSchoolAdding(false);selectSchoolAfter(duplicate);flash(`โรงเรียน ${duplicate.name} มีอยู่แล้ว — เปิดข้อมูลเดิมให้แล้ว`);return;}
   const sid=`school-${Date.now()}`,sessions=data.classrooms.map(c=>({id:`session-${Date.now()}-${Math.random()}`,classId:c.id,test:'ครั้งที่ 1',date:new Date().toISOString().slice(0,10),robot:'Code & Go',exam:'Intermediate 1',teachingPeriod:'',trainer:'',feedback:{detail:'',summary:''},entries:{}})),s={id:sid,...candidate,officeId:data.officeId||'',loaded:true,classrooms:data.classrooms,sessions};
   try{setCloudStatus('saving');await saveSchoolBundle(s,user.id);setSchools(v=>[...v,s]);setSchoolAdding(false);selectSchoolAfter(s);setCloudStatus('saved');flash(`สร้างโรงเรียน ${data.name} เรียบร้อยแล้ว`)}catch(error){console.error(error);setCloudStatus('error');flash(`สร้างโรงเรียนไม่สำเร็จ: ${error.message}`)}
  };
  const addOffice=async name=>{try{const office=await createOffice(name,user.id);setOffices(all=>all.some(x=>x.id===office.id)?all:[...all,office].sort((a,b)=>a.name.localeCompare(b.name,'th')));flash(`เพิ่ม ${office.name} แล้ว`);return office}catch(error){console.error(error);flash(`เพิ่มสำนักงานไม่สำเร็จ: ${error.message}`);return null}};
  const addSession=()=>{const id=`session-${Date.now()}`,n=classSessions.length+1;markSession(id);mutateSchool(s=>({...s,sessions:[...s.sessions,{id,classId:classroom.id,test:`ครั้งที่ ${n}`,date:new Date().toISOString().slice(0,10),robot:'Code & Go',exam:`Intermediate ${n}`,teachingPeriod:'',trainer:session?.trainer||'',feedback:{detail:'',summary:''},entries:{}}]}));setSessionId(id)};
 
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
    if(readOnly){flash('บัญชีดูอย่างเดียวไม่สามารถส่งออก Excel ได้');return}
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

 const exportPDF=async(mode='download')=>{
  if(readOnly){flash('บัญชีดูอย่างเดียวไม่สามารถสร้าง PDF ได้');return}
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
  doc.addFont('THSarabun.ttf','THSarabun','bold');
  const originalDocText=doc.text.bind(doc);
  const splitThaiMarks=value=>{
   const marks=[];let clean='';
   for(let index=0;index<value.length;index++){
    const character=value[index],previous=value[index-1];
    if(/[\u0E48-\u0E4C]/.test(character)&&/[\u0E31\u0E34-\u0E37\u0E47]/.test(previous)){marks.push({character,index:clean.length});continue;}
    clean+=character;
   }
   return {clean,marks};
  };
  doc.text=(text,x,y,options,...rest)=>{
   const syntheticBold=doc.getFont()?.fontStyle==='bold';
   const previousLineWidth=doc.getLineWidth();
   const drawOptions=syntheticBold?{...(options||{}),renderingMode:'fillThenStroke'}:options;
   if(syntheticBold)doc.setLineWidth(.065);
   const lines=Array.isArray(text)?text:[text];
   if(!lines.every(line=>typeof line==='string')){const result=originalDocText(text,x,y,drawOptions,...rest);doc.setLineWidth(previousLineWidth);return result;}
   const processed=lines.map(splitThaiMarks);
   if(!processed.some(line=>line.marks.length)){const result=originalDocText(text,x,y,drawOptions,...rest);doc.setLineWidth(previousLineWidth);return result;}
   const cleanText=Array.isArray(text)?processed.map(line=>line.clean):processed[0].clean;
   const result=originalDocText(cleanText,x,y,drawOptions,...rest);
   const scale=doc.internal.scaleFactor,fontHeight=doc.getFontSize()/scale;
   const lineHeight=fontHeight*(drawOptions?.lineHeightFactor||doc.getLineHeightFactor?.()||1.15);
   const lift=fontHeight*.2,nudge=fontHeight*.05,align=drawOptions?.align;
   processed.forEach((line,lineIndex)=>{
    const width=doc.getTextWidth(line.clean),startX=align==='center'?x-width/2:align==='right'?x-width:x;
    line.marks.forEach(mark=>{
     const markX=startX+doc.getTextWidth(line.clean.slice(0,mark.index))-nudge;
     originalDocText(mark.character,markX,y+lineIndex*lineHeight-lift,syntheticBold?{renderingMode:'fillThenStroke'}:undefined);
    });
   });
   doc.setLineWidth(previousLineWidth);
   return result;
  };
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
  doc.setFont('THSarabun','bold');
  doc.setFontSize(14);
  doc.text('การประเมินคุณภาพหลักสูตรหุ่นยนต์ SCHOOL ROBOTICS',105,49,{align:'center'});

  doc.setFontSize(14);
  doc.text(`โรงเรียน : ${displaySchoolName}`,14.8,57);
  doc.setFont('THSarabun','bold');
  doc.text('สรุปผลสัมฤทธิ์และข้อเสนอแนะในการเรียนหุ่นยนต์ SCHOOL ROBOTICS',14.8,65.5);
  doc.text(`ประจำปี การศึกษา : ${term}/${year}`,14.8,74);
  doc.setFont('THSarabun','bold');
  doc.text(`จำนวนห้องเรียน : ${school.classrooms.length} ห้องเรียน`,14.8,82);
  doc.text(`ครั้งที่  :  ${testNumber}`,14.8,91.5);
  doc.text(`วันที่ : ${formatThaiDate(session?.date)}`,14.8,101);

  const detailRows=school.classrooms.map(c=>{
   const sess=sessionFor(c),entries=sess.entries||{};
   const eligibleStudents=c.students.filter(st=>st.active!==false||entries[st.id]);
   const absent=eligibleStudents.filter(st=>entries[st.id]?.absent).length;
   const examName=(sess.exam||`Intermediate ${testNumber}`).replace(/\s+(?=\d)/g,'');
   return [c.name,eligibleStudents.length,absent,sess.robot||'Code & Go',sess.teachingPeriod||'-',term,examName,sess.trainer||'-'];
  });

  doc.setFillColor(217,225,242);
  doc.setDrawColor(0,0,0);
  doc.setLineWidth(.3);
  doc.rect(14.3,109,175.9,8.5,'FD');
  doc.setFont('THSarabun','bold');
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
   headStyles:{font:'THSarabun',fontStyle:'bold',fontSize:11,cellPadding:.5,fillColor:[217,225,242],textColor:[0,0,0],minCellHeight:17},
   bodyStyles:{minCellHeight:8.5},
   columnStyles:{
    0:{cellWidth:20},1:{cellWidth:17},2:{cellWidth:17},3:{cellWidth:27},
    4:{cellWidth:19},5:{cellWidth:13},6:{cellWidth:29},7:{cellWidth:33.9}
   }
  });

  const feedbackRows=school.classrooms.flatMap(c=>{
   const sess=sessionFor(c);
   const text=[sess.feedback?.detail,sess.feedback?.summary].map(v=>v?.trim()).filter(Boolean).join('\n');
   return text?[[c.name,text]]:[];
  });
  if(feedbackRows.length){
  let summaryTitleY=doc.lastAutoTable.finalY+15;
  if(summaryTitleY>275){doc.addPage();summaryTitleY=20;}
  doc.setFont('THSarabun','bold');
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
   headStyles:{font:'THSarabun',fontStyle:'bold',fontSize:12,fillColor:[217,225,242],textColor:[0,0,0],halign:'center',minCellHeight:8.5},
   bodyStyles:{minCellHeight:8.5},
   columnStyles:{0:{cellWidth:19.7,halign:'center',fontStyle:'normal'},1:{cellWidth:156.2,halign:'left'}}
  });
  }

  const filename=`สรุปและข้อเสนอแนะ ครั้งที่ ${testNumber} -${fileSchoolName}.pdf`;
  if(mode==='preview'){
   const url=URL.createObjectURL(doc.output('blob'));
   flash('สร้างตัวอย่าง PDF เรียบร้อยแล้ว');
   return {url,filename};
  }
  doc.save(filename);
 };

 const openPDFPreview=async()=>{try{const preview=await exportPDF('preview');if(preview)setPdfPreview(preview)}catch(error){console.error('PDF preview failed',error);flash(`สร้างตัวอย่าง PDF ไม่สำเร็จ: ${error.message||'โปรดลองอีกครั้ง'}`)}};
 useEffect(()=>()=>{if(pdfPreview?.url)URL.revokeObjectURL(pdfPreview.url)},[pdfPreview?.url]);

 return <div className={`app${readOnly?' viewer-mode':''}`}>
  <aside><div className="brand"><img className="brand-logo" src={brandLogo} alt="School Robotics"/></div><nav>{tabs.map(([id,label,I])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><I/>{label}</button>)}</nav><div className="aside-foot"><div className="avatar">{(user.user_metadata?.full_name||user.email||'U').slice(0,2)}</div><div><b>{user.user_metadata?.full_name||user.email}</b><small>{profile.role==='super_admin'?'ผู้ดูแลระบบ':'ผู้ใช้งานระบบ'}</small></div><button className="logout" onClick={onSignOut} title="ออกจากระบบ"><LogOut/></button></div></aside>
  <main><header>
   <div className="mobile-brand"><img src={brandLogo} alt="School Robotics"/></div>
   {tab==='dashboard'?<div className="context dashboard-header-label"><LayoutDashboard/><div><small>ภาพรวมระบบ</small><b>ผลการประเมิน</b></div></div>:<div className="context dynamic-context"><School className="context-school-icon"/><div className="context-group school-context"><small>โรงเรียน · {schools.length} แห่ง</small><Select value={school?.id||''} onChange={selectSchool}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></div><span className="context-arrow">›</span><div className="context-group class-context"><small>ระดับชั้น</small><Select value={classroom?.id||''} onChange={selectClass}>{(school?.classrooms||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></div></div>}
   <span className={`cloud-state ${cloudStatus}`}>{cloudStatus==='saved'?<Cloud/>:<CloudOff/>}{cloudStatus==='loading'?'กำลังเชื่อมต่อ':cloudStatus==='saving'?'กำลังบันทึก':cloudStatus==='saved'?'บันทึกบนคลาวด์แล้ว':cloudStatus==='setup'?'รอสร้างฐานข้อมูล':'เชื่อมต่อไม่ได้'}</span>
   <button className="icon" onClick={()=>setDark(!dark)} aria-label="เปลี่ยนธีม">{dark?<Sun/>:<Moon/>}</button>
  </header>
   {readOnly&&<div className="viewer-banner"><ShieldCheck/><span><b>โหมดดูอย่างเดียว</b> บัญชีนี้ดูข้อมูลได้ แต่ไม่สามารถแก้ไข สร้าง PDF หรือส่งออก Excel ได้</span></div>}
   <section className={`content${viewerLocked?' viewer-locked':''}`} onClickCapture={e=>{if(viewerLocked){e.preventDefault();e.stopPropagation()}}} onKeyDownCapture={e=>{if(viewerLocked)e.preventDefault()}}>
   {viewerLocked&&<div className="viewer-lock-overlay" title="บัญชีดูอย่างเดียว ไม่สามารถแก้ไขหรือส่งออกข้อมูลได้" aria-label="ไม่สามารถกดได้"/>}
    {contextLoading&&<div className="context-loading"><Clock3/><span><b>กำลังโหลดข้อมูลโรงเรียน</b><small>โหลดเฉพาะโรงเรียนที่เลือกเพื่อลดการใช้โควตา</small></span></div>}
    {tab==='scores'&&<ScorePage {...{meta,setMeta,students,update,move,refs,feedback,setFeedback,stats,flash,schools}} sessions={classSessions} sessionId={session?.id} onSelectSession={setSessionId} onAddSession={addSession} onPreviewPDF={openPDFPreview} onSave={flushChanges}/>}
    {tab==='dashboard'&&<Dashboard stats={dashboardStats} classes={dashboardRows} school={school} schools={schools} offices={offices} onSelectSchool={selectSchoolNow}/>}
    {tab==='classroom'&&<Classroom {...{meta,setMeta,setStudents,importExcel,flash,offices}} students={classroomStudents} schools={schools} school={school} classroom={classroom} onAddSchool={()=>setSchoolAdding(true)} onAddOffice={addOffice} onSelectSchool={selectSchool} onSelectClass={selectClass} onDeleteSchool={id=>setConfirming({message:'ยืนยันการลบโรงเรียนนี้? ข้อมูลทั้งหมดจะถูกย้ายไปที่ถังขยะและจะไม่แสดงในหน้ารวม',onConfirm:async ()=>{try{setCloudStatus('saving');await deleteSchool(id);setSchools(all=>all.filter(s=>s.id!==id));const next=schools.find(s=>s.id!==id);if(next)selectSchoolAfter(next);else setSchoolId(null);flash('ลบโรงเรียนสำเร็จ (ย้ายไปถังขยะ)');setCloudStatus('saved')}catch(e){console.error(e);setCloudStatus('error');flash('ลบโรงเรียนไม่สำเร็จ')}}})}/>}
    {tab==='reports'&&<Reports {...{stats,exportExcel,exportPDF}} onPreviewPDF={openPDFPreview}/>}
    {tab==='admin'&&profile.role==='super_admin'&&<AccessAdmin schools={schools} currentUserId={user.id} flash={flash}/>}
   </section>
   <div className="bottom-nav">{tabs.map(([id,label,I])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><I/><small>{label.split(' ')[0]}</small></button>)}</div>
  </main>{toast&&<div className="toast"><CheckCircle2/>{toast}</div>}
  {confirming && <ConfirmModal {...confirming} onClose={()=>setConfirming(null)}/>} 
  {schoolAdding && <AddSchoolModal onClose={()=>setSchoolAdding(false)} onAdd={addSchool} offices={offices} onAddOffice={addOffice}/>}
  {pendingImport&&<ImportOfficeModal school={pendingImport} offices={offices} onAddOffice={addOffice} onClose={()=>setPendingImport(null)} onConfirm={async imported=>{const ready={...imported,loaded:true};try{setCloudStatus('saving');await saveSchoolBundle(ready,user.id);setSchools(v=>[...v,ready]);setPendingImport(null);selectSchoolAfter(ready);setCloudStatus('saved');flash(`นำเข้า ${ready.name}: ${ready.classrooms.length} ห้อง ${ready.sessions.length} ครั้งทดสอบ`)}catch(error){console.error(error);setCloudStatus('error');flash(`นำเข้าไม่สำเร็จ: ${error.message}`)}}}/>}
  {pdfPreview&&<PDFPreviewModal preview={pdfPreview} onClose={()=>setPdfPreview(null)}/>}
 </div>
}

function PDFPreviewModal({preview,onClose}){return <div className="pdf-preview-backdrop"><div className="pdf-preview-modal"><div className="pdf-preview-head"><div><span className="eyebrow">PDF PREVIEW</span><b>{preview.filename}</b></div><div><a className="primary" href={preview.url} download={preview.filename}><Download/>ดาวน์โหลด PDF</a><button className="icon" onClick={onClose} aria-label="ปิดตัวอย่าง"><X/></button></div></div><iframe src={preview.url} title={`ตัวอย่าง ${preview.filename}`}/></div></div>}

function AccessAdmin({schools,currentUserId,flash}){
 const [users,setUsers]=useState([]),[members,setMembers]=useState([]),[drafts,setDrafts]=useState({}),[loading,setLoading]=useState(true),[saving,setSaving]=useState('');
 const refresh=async()=>{setLoading(true);try{const data=await loadAccessAdmin();setUsers(data.profiles);setMembers(data.members);setDrafts(Object.fromEntries(data.profiles.map(p=>[p.id,{role:p.role,schoolIds:data.members.filter(m=>m.user_id===p.id).map(m=>m.school_id)}])))}catch(e){console.error(e);flash('โหลดรายชื่อผู้ใช้ไม่สำเร็จ')}finally{setLoading(false)}};
 useEffect(()=>{refresh()},[]);
 const change=(id,patch)=>setDrafts(all=>({...all,[id]:{...all[id],...patch}}));
 const toggleSchool=(id,schoolId)=>{const list=drafts[id]?.schoolIds||[];change(id,{schoolIds:list.includes(schoolId)?list.filter(x=>x!==schoolId):[...list,schoolId]})};
 const save=async p=>{const draft=drafts[p.id];if(!draft)return;setSaving(p.id);try{await updateUserAccess(p.id,draft.role,draft.schoolIds);flash(`บันทึกสิทธิ์ ${p.email||p.full_name} แล้ว`);await refresh()}catch(e){console.error(e);flash(`บันทึกสิทธิ์ไม่สำเร็จ: ${e.message}`)}finally{setSaving('')}};
 return <><div className="page-title"><div><span className="eyebrow">ADMINISTRATION</span><h1>จัดการผู้ใช้งาน</h1><p>อนุมัติบัญชี กำหนดบทบาท และเลือกโรงเรียนที่แต่ละคนเข้าถึงได้</p></div></div>
  <div className="access-note"><ShieldCheck/><div><b>บัญชีใหม่จะยังไม่เห็นข้อมูล</b><small>จนกว่า Super Admin จะเลือกสิทธิ์และโรงเรียน แล้วกดบันทึก</small></div></div>
  {loading?<div className="card admin-loading">กำลังโหลดรายชื่อผู้ใช้…</div>:<div className="admin-users">{users.map(p=>{const draft=drafts[p.id]||{role:p.role,schoolIds:[]},needsSchools=['school_admin','evaluator'].includes(draft.role);return <div className="card admin-user" key={p.id}>
   <div className="admin-user-head"><div className="avatar">{(p.full_name||p.email||'U').slice(0,2)}</div><div><b>{p.full_name||'ยังไม่ได้ระบุชื่อ'}</b><small>{p.email||'ไม่พบอีเมล'}{p.id===currentUserId?' · บัญชีของคุณ':''}</small></div><span className={`role-pill ${p.role}`}>{p.role==='pending'?'ระงับการเข้าถึง':p.role==='viewer'?'ดูอย่างเดียว':p.role==='super_admin'?'Super Admin':p.role==='school_admin'?'ผู้ดูแลโรงเรียน':'ผู้ประเมิน'}</span></div>
   <div className="admin-access-form"><Field label="ระดับสิทธิ์"><Select value={draft.role} onChange={role=>change(p.id,{role})}><option value="viewer">ดูอย่างเดียว</option><option value="evaluator">ผู้ประเมิน</option><option value="school_admin">ผู้ดูแลโรงเรียน</option><option value="super_admin">Super Admin</option><option value="pending">ระงับการเข้าถึง</option></Select></Field>
   {needsSchools&&<div className="school-permissions"><span>โรงเรียนที่เข้าถึงได้</span><div>{schools.map(s=><label key={s.id}><input type="checkbox" checked={draft.schoolIds.includes(String(s.id))} onChange={()=>toggleSchool(p.id,String(s.id))}/><span>{s.name}<small>ปี {s.year} · ภาคเรียน {s.term}</small></span></label>)}</div>{!schools.length&&<small>ยังไม่มีโรงเรียนในระบบ</small>}</div>}
   <button className="primary" disabled={saving===p.id||p.id===currentUserId&&draft.role!=='super_admin'} onClick={()=>save(p)}><Save/>{saving===p.id?'กำลังบันทึก…':'บันทึกสิทธิ์'}</button></div>
  </div>})}</div>}
 </>;
}

function Field({label,children,wide}){return <label className={wide?'field wide':'field'}><span>{label}</span>{children}</label>}
function Select({value,onChange,children}){return <div className="select-wrap"><select value={value} onChange={e=>onChange(e.target.value)}>{children}</select><ChevronDown/></div>}

function ScorePage({meta,setMeta,students,update,move,refs,feedback,setFeedback,stats,flash,schools,sessions,sessionId,onSelectSession,onAddSession,onPreviewPDF,onSave}){
  const [search,setSearch]=useState('');
  const set=(k,v)=>setMeta({...meta,[k]:v}),testNo=Number((meta.test||'').match(/\d+/)?.[0]||1),examLevel=/^basic|^beginner/i.test(meta.exam||'')?'Basic':/^advance/i.test(meta.exam||'')?'Advance':'Intermediate',expectedExam=`${examLevel} ${testNo}`,examOptions=['Basic','Intermediate','Advance'].map(level=>`${level} ${testNo}`);
  useEffect(()=>{if(sessionId&&meta.exam!==expectedExam)setMeta({...meta,exam:expectedExam})},[sessionId,meta.test,meta.exam]);
  
  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const ranks=useMemo(()=>calcRanks(students),[students]);
  const feedbackText = [feedback.detail,feedback.summary].filter(value=>value!=null&&value!=='').join('\n');
 
  if(!schools||!schools.length)return <div className="page-title"><div><span className="eyebrow">การประเมินผล</span><h1>บันทึกผลการทดสอบ</h1><p>ยังไม่มีข้อมูลโรงเรียน โปรดไปที่แท็บ "จัดการชั้นเรียน" เพื่อเพิ่มข้อมูล</p></div></div>;
  return <>
  <div className="page-title"><div><span className="eyebrow">การประเมินผล</span><h1>บันทึกผลการทดสอบ</h1><p>กรอกคะแนนและเวลาของนักเรียน ระบบจะคำนวณผลสัมฤทธิ์ให้อัตโนมัติ</p></div><div className="page-title-actions"><span className="status"><i/> กำลังบันทึกอัตโนมัติ</span><button type="button" className="button" onClick={onPreviewPDF}><Eye/>ดูตัวอย่าง PDF</button></div></div>
  <div className="card test-info"><div className="card-head"><div><b>ข้อมูลการทดสอบ</b><small>รายละเอียดสำหรับการประเมินครั้งนี้</small></div><span className="test-badge">{meta.test}</span></div><div className="form-grid">
   <Field label="ครั้งที่ทดสอบ"><div className="session-picker"><Select value={sessionId} onChange={onSelectSession}>{sessions.map(s=><option value={s.id} key={s.id}>{s.test}</option>)}</Select><button type="button" onClick={onAddSession} title="เพิ่มครั้งทดสอบ"><Plus/></button></div></Field>
   <Field label="วันที่ทดสอบ"><input type="date" value={meta.date} onChange={e=>set('date',e.target.value)}/></Field>
   <Field label="ประเภทหุ่นยนต์"><Select value={meta.robot} onChange={v=>set('robot',v)}>{ROBOT_TYPES.map(type=><option key={type} value={type}>{type}</option>)}</Select></Field>
    <Field label="ชุดข้อสอบ"><Select value={expectedExam} onChange={v=>set('exam',v)}>{examOptions.map(v=><option key={v}>{v}</option>)}</Select></Field>
    <Field label="คาบสอนปัจจุบัน"><input type="number" min="1" inputMode="numeric" value={meta.teachingPeriod} placeholder="เช่น 16" onChange={e=>set('teachingPeriod',e.target.value)}/></Field>
    <Field label="วิทยากรผู้ประเมิน" wide><input value={meta.trainer} onChange={e=>set('trainer',e.target.value)}/></Field>
  </div></div>
  <div className="card score-card"><div className="card-head"><div><b>คะแนนและเวลา</b><small>{meta.level} · นักเรียน {students.length} คน</small></div><div className="search-box"><input placeholder="ค้นหาชื่อนักเรียน..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="legend"><i/> ผ่านเกณฑ์ 35 คะแนน</div></div>
   <div className="table-wrap"><table><thead><tr><th>เลขที่</th><th className="center">ลำดับ</th><th>ชื่อ–นามสกุล</th><th className="center">ขาดสอบ</th><th>คะแนน <small>(เต็ม 50)</small></th><th>เวลา <small>(นาที:วินาที)</small></th><th>ผลประเมิน</th></tr></thead><tbody>{filteredStudents.map((s,i)=><tr key={s.id} className={s.absent?'absent':''}><td className="number">{String(s.no).padStart(2,'0')}</td><td className="center"><span className={`rank-badge ${ranks[s.id]&&ranks[s.id]<=3?`top-${ranks[s.id]}`:''}`}>{ranks[s.id]||'—'}</span></td><td><b>{s.name}</b></td><td className="center"><input className="check" type="checkbox" checked={s.absent} onChange={e=>update(s.id,'absent',e.target.checked)}/></td><td><input ref={el=>refs.current[`${i}-score`]=el} onKeyDown={e=>move(i,'score',e)} className="score-input" type="number" min="0" max="50" disabled={s.absent} value={s.score} placeholder="—" onChange={e=>update(s.id,'score',e.target.value)}/></td><td><input ref={el=>refs.current[`${i}-time`]=el} onKeyDown={e=>move(i,'time',e)} className="time-input" disabled={s.absent} value={s.time} placeholder="00:00" onChange={e=>update(s.id,'time',e.target.value)}/></td><td>{s.absent?<span className="result no"><AlertCircle/>ขาดสอบ</span>:s.score?<span className={+s.score>=35?'result yes':'result no'}>{+s.score>=35?<CheckCircle2/>:<X/>}{+s.score>=35?'ผ่าน':'ไม่ผ่าน'}</span>:<span className="muted">รอคะแนน</span>}</td></tr>)}</tbody></table></div>
   <div className="table-summary"><span>เข้าสอบ <b>{stats.present}</b> คน</span><span>ขาดสอบ <b>{stats.absent}</b> คน</span><span>คะแนนเฉลี่ย <b>{stats.avg.toFixed(1)}</b></span><span>ผ่านเกณฑ์ <b>{stats.rate.toFixed(0)}%</b></span></div>
  </div>
  <div className="card feedback"><div className="card-head"><div><b>สรุปและข้อเสนอแนะ</b><small>บันทึกผลการประเมินและข้อเสนอแนะของระดับชั้น ข้อมูลนี้จะปรากฏในรายงาน PDF</small></div></div><div className="feedback-grid"><Field label="ผลการประเมินและข้อเสนอแนะของระดับชั้น"><textarea value={feedbackText} onChange={e=>setFeedback({detail:e.target.value,summary:''})} placeholder="เช่น นักเรียนสามารถทำแบบทดสอบได้ตามภารกิจ... แนะนำให้ฝึกฝนเพิ่มเติมในเรื่อง..."/></Field></div></div>
  <div className="actions"><span><kbd>Enter ↵</kbd> หรือ <kbd>↓</kbd> เพื่อเลื่อนไปช่องถัดไป</span><button className="primary" onClick={async ()=>{flash('กำลังบันทึกข้อมูลที่เปลี่ยนแปลง...');try{await onSave();flash('บันทึกและประเมินผลเรียบร้อยแล้ว')}catch(e){console.error(e);flash('ไม่สามารถบันทึกได้: โปรดตรวจสอบการเชื่อมต่อ')}}}><Save/>บันทึกและประเมินผล</button></div>
  </>
}

function Dashboard({stats,classes,school,schools,offices,onSelectSchool}){
 const summarizeSchool=s=>{if(!s.loaded)return s.summary||{rooms:s.classrooms.length,students:0,scored:0,passed:0,scoreTotal:0};const results=s.classrooms.flatMap(c=>{const latest=s.sessions.filter(x=>x.classId===c.id).at(-1);return c.students.filter(st=>st.active!==false).map(st=>({...st,...(latest?.entries?.[st.id]||{})}))}),scored=results.filter(st=>!st.absent&&st.score!==''&&st.score!=null&&Number.isFinite(Number(st.score)));return {rooms:s.classrooms.length,students:results.length,scored:scored.length,passed:scored.filter(st=>Number(st.score)>=35).length,scoreTotal:scored.reduce((sum,st)=>sum+Number(st.score),0)}};
 const officeCards=[...offices.map(office=>({id:office.id,name:office.name,schools:schools.filter(s=>s.officeId===office.id)})),...(schools.some(s=>!s.officeId)?[{id:'unassigned',name:'ยังไม่ระบุสำนักงาน',schools:schools.filter(s=>!s.officeId)}]:[])].map(group=>{
  const summaries=group.schools.map(summarizeSchool),rooms=summaries.reduce((sum,x)=>sum+x.rooms,0),students=summaries.reduce((sum,x)=>sum+x.students,0),scored=summaries.reduce((sum,x)=>sum+x.scored,0),passed=summaries.reduce((sum,x)=>sum+x.passed,0),scoreTotal=summaries.reduce((sum,x)=>sum+x.scoreTotal,0);
  return {...group,rooms,students,avg:scored?scoreTotal/scored:0,rate:scored?passed/scored*100:0};
 });
 const [selectedOfficeId,setSelectedOfficeId]=useState(null),[dashboardView,setDashboardView]=useState('offices');
 const [insightOffice,setInsightOffice]=useState(''),[insights,setInsights]=useState({attention:[],outstanding:[],roomsToImprove:[],recent:[]}),[insightLoading,setInsightLoading]=useState(true),[insightError,setInsightError]=useState('');
 useEffect(()=>{let active=true;setInsightLoading(true);setInsightError('');loadDashboardInsights(insightOffice||null,20).then(data=>{if(active)setInsights(data)}).catch(error=>{console.error(error);if(active)setInsightError('ยังไม่ได้ติดตั้งฟังก์ชันสรุป Dashboard กรุณารัน schema.sql ใน Supabase')}).finally(()=>{if(active)setInsightLoading(false)});return()=>{active=false}},[insightOffice]);
 useEffect(()=>{if(dashboardView!=='offices'){const officeId=school?.officeId||'unassigned';if(officeCards.some(x=>x.id===officeId))setSelectedOfficeId(officeId)}},[school?.id,dashboardView]);
 const selectedOffice=officeCards.find(x=>x.id===selectedOfficeId);
 const openSchool=schoolId=>{const target=schools.find(item=>item.id===schoolId);setSelectedOfficeId(target?.officeId||'unassigned');onSelectSchool(schoolId);setDashboardView('school')};
 if(!school)return <div className="page-title"><div><span className="eyebrow">ภาพรวมโรงเรียน</span><h1>ผลสัมฤทธิ์การเรียนรู้</h1><p>ไม่มีข้อมูลโรงเรียน โปรดเพิ่มข้อมูลในแท็บจัดการชั้นเรียน</p></div></div>;
 return <>
  {dashboardView==='offices'&&<><div className="page-title office-page-title"><div><span className="eyebrow">ภาพรวมสำนักงาน</span><h1>สำนักงานที่รับผิดชอบ</h1><p>เลือกสำนักงานเพื่อดูโรงเรียนและผลการประเมิน · {officeCards.length} สำนักงาน</p></div></div><div className="office-grid office-grid-only">{officeCards.map(office=><button type="button" className="office-card card" key={office.id} onClick={()=>{setSelectedOfficeId(office.id);setDashboardView('schools');if(office.schools.length&&!office.schools.some(item=>item.id===school.id))onSelectSchool(office.schools[0].id)}}><div className="office-card-icon"><School/></div><div className="office-card-title"><b>{office.name}</b><small>{office.schools.length} โรงเรียน · {office.rooms} ห้องเรียน</small></div><strong>{office.students}<small> นักเรียน</small></strong><div className="office-card-metrics"><span>เฉลี่ย <b>{office.avg.toFixed(1)}</b></span><span>ผ่าน <b>{office.rate.toFixed(0)}%</b></span></div></button>)}</div><div className="dashboard-insights-head"><div><span className="eyebrow">ติดตามผู้เรียน</span><h2>ข้อมูลเด็กที่ควรรู้</h2><p>แสดงสูงสุด 20 รายการต่อหมวด โดยไม่ดาวน์โหลดข้อมูลนักเรียนทั้งหมด</p></div><div className="insight-office-filter"><small>กรองตามสำนักงาน</small><Select value={insightOffice} onChange={setInsightOffice}><option value="">สำนักงานทั้งหมด</option>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}{schools.some(s=>!s.officeId)&&<option value="unassigned">ยังไม่ระบุสำนักงาน</option>}</Select></div></div>{insightError?<div className="card insight-error"><AlertCircle/>{insightError}</div>:insightLoading?<div className="card insight-loading"><Clock3/>กำลังสรุปข้อมูลเด็ก...</div>:<div className="insight-grid">
   <div className="card insight-panel attention"><div className="insight-panel-head"><span><AlertCircle/><b>เด็กที่ต้องติดตาม</b></span><strong>{insights.attention.length}</strong></div><div className="insight-list">{insights.attention.map(item=><button key={`${item.session_id}-${item.student_id}`} onClick={()=>openSchool(item.school_id)}><span><b>{item.full_name}</b><small>{item.school_name} · {item.classroom_name} · เลขที่ {item.student_no}</small></span><em className={item.status}>{item.status==='absent'?'ขาดสอบ':item.status==='pending'?'รอคะแนน':`${item.score} คะแนน`}</em></button>)}{!insights.attention.length&&<p>ไม่พบเด็กที่ต้องติดตาม</p>}</div></div>
   <div className="card insight-panel outstanding"><div className="insight-panel-head"><span><CheckCircle2/><b>เด็กผลงานดี</b></span><strong>{insights.outstanding.length}</strong></div><div className="insight-list">{insights.outstanding.map(item=><button key={`${item.session_id}-${item.student_id}`} onClick={()=>openSchool(item.school_id)}><span><b>{item.full_name}</b><small>{item.school_name} · {item.classroom_name}</small></span><em>{item.score} คะแนน · {item.time_value||'—'}</em></button>)}{!insights.outstanding.length&&<p>ยังไม่มีผลคะแนน</p>}</div></div>
   <div className="card insight-panel improve"><div className="insight-panel-head"><span><LayoutDashboard/><b>ห้องที่ควรพัฒนา</b></span><strong>{insights.roomsToImprove.length}</strong></div><small className="insight-rule">ค่าเฉลี่ยต่ำกว่า 60% หรือยังไม่มีผลสอบ</small><div className="insight-list">{insights.roomsToImprove.map(item=><button key={item.classroom_id} onClick={()=>openSchool(item.school_id)}><span><b>{item.classroom_name}</b><small>{item.school_name} · เข้าคะแนน {item.scored}/{item.students} คน</small></span><em className={Number(item.scored)===0?'pending':''}>{Number(item.scored)===0?'ยังไม่มีคะแนน':`${item.avg_percent}%`}</em></button>)}{!insights.roomsToImprove.length&&<p>ทุกห้องผ่านค่าเฉลี่ย 60%</p>}</div></div>
   <div className="card insight-panel recent"><div className="insight-panel-head"><span><Clock3/><b>กิจกรรมล่าสุด</b></span><strong>{insights.recent.length}</strong></div><div className="insight-list">{insights.recent.map(item=><button key={item.session_id} onClick={()=>openSchool(item.school_id)}><span><b>{item.school_name}</b><small>{item.classroom_name} · {item.test_name} · {item.result_count} ผลสอบ</small></span><em>{item.test_date||'—'}</em></button>)}{!insights.recent.length&&<p>ยังไม่มีกิจกรรม</p>}</div></div>
  </div>}</>}
  {dashboardView==='schools'&&selectedOffice&&<><div className="page-title drill-page-title"><div><span className="eyebrow">สำนักงานที่รับผิดชอบ</span><h1>{selectedOffice.name}</h1><p>{selectedOffice.schools.length} โรงเรียน · {selectedOffice.rooms} ห้องเรียน · นักเรียน {selectedOffice.students} คน</p></div><button type="button" className="button" onClick={()=>{setDashboardView('offices');setSelectedOfficeId(null)}}><ChevronLeft/>สำนักงานทั้งหมด</button></div><div className="card office-schools"><div className="card-head"><div><b>โรงเรียนใน {selectedOffice.name}</b><small>เลือกโรงเรียนเพื่อดูภาพรวมผลการประเมินรายห้อง</small></div><span className="school-count">{selectedOffice.schools.length} โรงเรียน</span></div><div className="office-school-list">{selectedOffice.schools.map(item=>{const summary=summarizeSchool(item);return <button type="button" key={item.id} onClick={()=>{onSelectSchool(item.id);setDashboardView('school')}}><span><School/><b>{item.name}</b></span><small>{summary.rooms} ห้อง · นักเรียน {summary.students} คน</small></button>})}</div>{!selectedOffice.schools.length&&<div className="office-empty">ยังไม่มีโรงเรียนในสำนักงานนี้</div>}</div></>}
  {dashboardView==='school'&&<><div className="page-title drill-page-title"><div><span className="eyebrow">{selectedOffice?.name||'ภาพรวมโรงเรียน'}</span><h1>ผลสัมฤทธิ์การเรียนรู้</h1><p>{school.name} · ข้อมูลล่าสุดจาก {classes.length} ห้องเรียน</p></div><button type="button" className="button" onClick={()=>setDashboardView('schools')}><ChevronLeft/>โรงเรียนทั้งหมด</button></div>
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
  </div></>}
 </>;
}

function Classroom({meta,setMeta,students,setStudents,importExcel,flash,offices,schools,school,classroom,onAddSchool,onAddOffice,onSelectSchool,onSelectClass,onDeleteSchool}){
  const [adding,setAdding]=useState(false);
  const [addingOffice,setAddingOffice]=useState(false),[newOffice,setNewOffice]=useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [search, setSearch] = useState('');
  const [schoolSearch,setSchoolSearch]=useState(''),[officeFilter,setOfficeFilter]=useState(school?.officeId||'unassigned');
  const [statusFilter,setStatusFilter]=useState('active');
  const [confirming, setConfirming] = useState(null);

  const activeCount=students.filter(s=>s.active!==false).length;
  const filteredStudents=students.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())&&(statusFilter==='all'||(statusFilter==='active'?s.active!==false:s.active===false))).sort((a,b)=>Number(a.no)-Number(b.no));
  const officeSchools=schools.filter(s=>officeFilter==='unassigned'?!s.officeId:s.officeId===officeFilter),matchingSchools=officeSchools.filter(s=>s.name.toLocaleLowerCase('th-TH').includes(schoolSearch.trim().toLocaleLowerCase('th-TH')));
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

  if(!school)return <div className="page-title"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h1>จัดการโรงเรียนและชั้นเรียน</h1><p>ยังไม่มีข้อมูลโรงเรียน โปรดเพิ่มหรือนำเข้าไฟล์ Excel</p></div><div className="page-buttons"><button className="button" onClick={onAddSchool}><Plus/>เพิ่มโรงเรียน</button><label className="primary"><Upload/>นำเข้าไฟล์โรงเรียน<input type="file" accept=".xlsx,.xls" onChange={importExcel} hidden/></label></div></div>;
  return <>
  <div className="page-title"><div><span className="eyebrow">ข้อมูลพื้นฐาน</span><h1>จัดการโรงเรียนและชั้นเรียน</h1><p>1 ไฟล์ Excel = 1 โรงเรียน · ระบบอ่านทุกชีตและทุกครั้งทดสอบอัตโนมัติ</p></div><div className="page-buttons"><button className="button" onClick={onAddSchool}><Plus/>เพิ่มโรงเรียน</button><label className="primary"><Upload/>นำเข้าไฟล์โรงเรียน<input type="file" accept=".xlsx,.xls" onChange={importExcel} hidden/></label></div></div>
  <div className="card school-browser"><div className="school-browser-title"><School/><div><b>เลือกโรงเรียนที่ต้องการจัดการ</b><small>{officeSchools.length} โรงเรียนในสำนักงาน · พบ {matchingSchools.length} รายการ</small></div></div><Field label="สำนักงาน"><Select value={officeFilter} onChange={id=>{const next=schools.find(s=>id==='unassigned'?!s.officeId:s.officeId===id);if(!next||onSelectSchool(next.id)!==false){setOfficeFilter(id);setSchoolSearch('')}}}>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}{schools.some(s=>!s.officeId)&&<option value="unassigned">ยังไม่ระบุสำนักงาน</option>}</Select></Field><Field label="ค้นหาโรงเรียน"><div className="school-browser-search"><input value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)} placeholder="พิมพ์ชื่อโรงเรียน..."/>{schoolSearch&&<button type="button" onClick={()=>setSchoolSearch('')} aria-label="ล้างคำค้นหา"><X/></button>}</div></Field><Field label="โรงเรียน"><Select value={matchingSchools.some(s=>s.id===school.id)?school.id:''} onChange={onSelectSchool}><option value="" disabled>{matchingSchools.length?'เลือกโรงเรียน':'ไม่พบโรงเรียน'}</option>{matchingSchools.map(s=><option key={s.id} value={s.id}>{s.name} · {s.classrooms.length} ห้อง</option>)}</Select></Field></div>
  <div className="card filters">
   <div className="card-head"><div><b>ตั้งค่าโรงเรียนปัจจุบัน</b><small>{school.name} · {school.classrooms.length} ห้องเรียน</small></div></div>
   <Field label="โรงเรียน"><input value={meta.school} onChange={e=>setMeta({...meta,school:e.target.value})}/></Field>
   <Field label="สำนักงานที่รับผิดชอบ"><div className="office-picker"><Select value={meta.officeId||''} onChange={officeId=>setMeta({...meta,officeId})}><option value="">ยังไม่ระบุสำนักงาน</option>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select><button type="button" className="button" onClick={()=>setAddingOffice(!addingOffice)}><Plus/>เพิ่มสำนักงาน</button></div>{addingOffice&&<div className="office-create school-office-create"><input value={newOffice} onChange={e=>setNewOffice(e.target.value)} placeholder="ชื่อสำนักงาน"/><button type="button" className="primary" disabled={!newOffice.trim()} onClick={async()=>{const office=await onAddOffice(newOffice);if(office){setMeta({...meta,officeId:office.id});setNewOffice('');setAddingOffice(false)}}}>บันทึก</button></div>}</Field>
   <div className="form-grid mini"><Field label="ปีการศึกษา"><input value={meta.year} onChange={e=>setMeta({...meta,year:e.target.value})}/></Field><Field label="ภาคเรียนที่"><input value={meta.term} onChange={e=>setMeta({...meta,term:e.target.value})}/></Field><button type="button" className="school-delete-button" onClick={()=>onDeleteSchool(school.id)}><X/>ลบโรงเรียนนี้</button></div>
  </div>
  <div className="card classroom-list"><div className="card-head roster-head"><div><b>รายชื่อนักเรียน</b><small>{classroom?.name} · กำลังเรียน {activeCount} คน · ออกแล้ว {students.length-activeCount} คน</small></div><button className="primary roster-add" onClick={()=>setAdding(true)}><Plus/>เพิ่มนักเรียน</button></div><div className="roster-toolbar"><div className="roster-filter"><span>แสดงรายชื่อ</span><Select value={statusFilter} onChange={setStatusFilter}><option value="active">กำลังเรียน</option><option value="inactive">ออกแล้ว</option><option value="all">ทั้งหมด</option></Select></div><div className="roster-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input placeholder="ค้นหาชื่อหรือนามสกุล..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" onClick={()=>setSearch('')} aria-label="ล้างคำค้นหา"><X/></button>}</div><span className="roster-result">พบ {filteredStudents.length} คน</span></div>
  <div className="table-wrap"><table><thead><tr><th>เลขที่</th><th>ชื่อ–นามสกุล</th><th>สถานะ</th><th className="center">จัดการ</th></tr></thead><tbody>{filteredStudents.map(s=><tr key={s.id} className={s.active===false?'student-inactive':''}><td className="number">{String(s.no).padStart(2,'0')}</td><td><b>{s.name}</b></td><td><span className={`student-status ${s.active===false?'left':'active'}`}>{s.active===false?`ออกแล้ว${s.leftAt?` · ${s.leftAt}`:''}`:'กำลังเรียน'}</span></td><td className="center"><div className="student-actions"><button className="icon-btn" title="แก้ไขข้อมูลหรือสลับเลขที่" onClick={()=>setEditingStudent(s)}><Edit2 size={16}/></button>{s.active===false?<button className="icon-btn restore" title="กู้คืน" onClick={()=>restoreStudent(s.id)}><RotateCcw size={16}/></button>:<button className="icon-btn danger-text" title="ออกจากชั้นเรียน" onClick={()=>leaveStudent(s)}><UserMinus size={16}/></button>}</div></td></tr>)}</tbody></table></div></div>
  {adding && <AddStudentModal onClose={()=>setAdding(false)} onAdd={addStudents} nextNo={students.length+1}/>}
  {editingStudent && <AddStudentModal onClose={()=>setEditingStudent(null)} onAdd={data=>updateStudent(data[0])} student={editingStudent} isEdit={true}/>}
  {confirming && <ConfirmModal {...confirming} onClose={()=>setConfirming(null)}/>} 
  </>
}

function AddStudentModal({onClose,onAdd,nextNo,student,isEdit}){
  const [list, setList] = useState([{ no:student?.no||nextNo||'',prefix: student?.prefix || 'เด็กชาย', firstName: student?.firstName || '', lastName: student?.lastName || '' }]);
  
  const valid = list.every(item => item.firstName.trim() && item.lastName.trim() && (!isEdit||Number(item.no)>0));

  const addRow = () => setList([...list, { no:'',prefix: 'เด็กชาย', firstName: '', lastName: '' }]);
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
            gridTemplateColumns: isEdit ? '90px 130px 1fr 1fr' : '130px 1fr 1fr 40px',
            gap: '12px', 
            marginBottom: '16px',
            alignItems: 'end',
            paddingBottom: '16px',
            borderBottom: index === list.length - 1 ? '0' : '1px solid var(--line)'
          }}>
            {isEdit&&<Field label="เลขที่"><input type="number" min="1" value={item.no} onChange={e=>updateRow(index,'no',e.target.value)} /></Field>}
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

function Field({label,children,wide}){return <label className={wide?'field wide':'field'}><span>{label}</span>{children}</label>}

function Select({value,onChange,children}){return <div className="select-wrap"><select value={value} onChange={e=>onChange(e.target.value)}>{children}</select><ChevronDown/></div>}

function Reports({stats,exportExcel,exportPDF,onPreviewPDF}){return <><div className="page-title"><div><span className="eyebrow">ส่งออกข้อมูล</span><h1>รายงานผลการประเมิน</h1><p>จัดทำเอกสารพร้อมพิมพ์หรือสำรองข้อมูลสำหรับใช้งานต่อ</p></div></div><div className="report-grid"><div className="card report"><div className="report-icon pdf"><FileText/></div><div><h2>รายงานสรุปผลสัมฤทธิ์</h2><p>สถิติ ภาพรวมผลการประเมิน และข้อเสนอแนะในรูปแบบเอกสาร PDF</p></div><div className="mini-stats"><span>เฉลี่ย <b>{stats.avg.toFixed(1)}</b></span><span>ผ่าน <b>{stats.rate.toFixed(0)}%</b></span></div><div className="report-actions"><button className="primary" onClick={onPreviewPDF}><Eye/>ดูตัวอย่าง PDF</button><button className="button" onClick={()=>exportPDF('download')}><Download/>ดาวน์โหลดทันที</button></div></div><div className="card report"><div className="report-icon excel"><LayoutDashboard/></div><div><h2>ข้อมูลคะแนนและเวลา</h2><p>ข้อมูลดิบรายบุคคลและตารางสรุปผลรายห้องในไฟล์ Excel</p></div><div className="mini-stats"><span>นักเรียน <b>{stats.all}</b></span><span>เข้าสอบ <b>{stats.present}</b></span></div><button className="button" onClick={exportExcel}><Download/>ส่งออก Excel</button></div></div></>}

function GoogleMark(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.32 2.98-7.39Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.63.39 3.17 1.04 4.53l3.35-2.61Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>}

function AuthLoading({message='กำลังเชื่อมต่อระบบ…'}){return <div className="auth-loading"><div className="auth-loading-card"><img src={brandLogo} alt="School Robotics"/><div className="auth-spinner"><i/><i/><i/></div><b>{message}</b><small>กรุณารอสักครู่</small></div></div>}

function PendingAccess({user,onSignOut,onRefresh}){return <div className="pending-shell"><div className="pending-card"><img src={brandLogo} alt="School Robotics"/><div className="pending-icon"><Clock3/></div><span className="eyebrow">WAITING FOR APPROVAL</span><h1>บัญชีกำลังรออนุมัติ</h1><p>สมัครสมาชิกเรียบร้อยแล้ว กรุณาแจ้ง Admin ให้กำหนดสิทธิ์และโรงเรียนสำหรับ <b>{user.email}</b></p><div className="pending-actions"><button className="primary" onClick={onRefresh}>ตรวจสอบสิทธิ์อีกครั้ง</button><button className="button" onClick={onSignOut}><LogOut/>ออกจากระบบ</button></div></div></div>}

function AuthPage(){const [mode,setMode]=useState('login'),[form,setForm]=useState({name:'',email:'',password:''}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const submit=async e=>{e.preventDefault();setBusy(true);setMessage('');const action=mode==='login'?supabase.auth.signInWithPassword({email:form.email,password:form.password}):supabase.auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.name}}});const {data,error}=await action;setBusy(false);if(error)return setMessage(error.message);if(mode==='register'&&!data.session)setMessage('สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี')};return <div className="auth-shell"><div className="auth-visual"><div className="brand auth-brand"><img className="brand-logo" src={brandLogo} alt="School Robotics"/></div><div><span className="eyebrow">School Robotics ERP</span><h1>ผลการเรียนรู้<br/>ที่มองเห็นได้จริง</h1><p>จัดการโรงเรียน ห้องเรียน และผลการประเมิน<br/>อย่างเป็นระบบในที่เดียว</p></div><div className="auth-points"><span><CheckCircle2/>ข้อมูลปลอดภัยด้วย Supabase</span><span><CheckCircle2/>รองรับหลายโรงเรียนและหลายผู้ใช้</span></div></div><div className="auth-panel"><form className="auth-card" onSubmit={submit}><div><span className="eyebrow">ยินดีต้อนรับ</span><h2>{mode==='login'?'เข้าสู่ระบบ':'สร้างบัญชีใหม่'}</h2><p>{mode==='login'?'กรอกข้อมูลเพื่อเข้าสู่ระบบประเมินผล':'เริ่มต้นใช้งานระบบสำหรับทีมของคุณ'}</p></div>{mode==='register'&&<Field label="ชื่อผู้ใช้งาน"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="ชื่อ-นามสกุล"/></Field>}<Field label="อีเมล"><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@school.ac.th"/></Field><Field label="รหัสผ่าน"><input type="password" required minLength="6" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="อย่างน้อย 6 ตัวอักษร"/></Field>{message&&<div className="auth-message">{message}</div>}<button className="primary auth-submit" disabled={busy}>{busy?'กำลังดำเนินการ…':mode==='login'?'เข้าสู่ระบบ':'สมัครสมาชิก'}</button><button type="button" className="auth-switch" onClick={()=>{setMode(mode==='login'?'register':'login');setMessage('')}}>{mode==='login'?'ยังไม่มีบัญชี? สมัครสมาชิก':'มีบัญชีแล้ว? เข้าสู่ระบบ'}</button></form></div></div>}


function Root(){const [session,setSession]=useState(undefined);useEffect(()=>{if(!supabase){setSession(null);return}supabase.auth.getSession().then(({data})=>setSession(data.session));const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));return()=>data.subscription.unsubscribe()},[]);if(!isSupabaseConfigured)return <div className="boot-screen">ยังไม่ได้ตั้งค่า Supabase</div>;if(session===undefined)return <div className="boot-screen"><Bot/>กำลังเชื่อมต่อระบบ…</div>;if(!session)return <AuthPage/>;return <App user={session.user} onSignOut={()=>{localStorage.clear();supabase.auth.signOut()}}/>}


createRoot(document.getElementById('root')).render(<Root/>);
