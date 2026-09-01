import React, {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Swal from 'sweetalert2';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, ClipboardCheck, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw, FileCog, Trash2, MapPin, Warehouse} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES,compareClassNames,defaultExamForRobot,examOptionsForRobot} from './model';
import {supabase,isSupabaseConfigured} from './supabase';
import {loadSchoolIndex,loadSchoolDetail,loadClassroomDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveClassroomMeta,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice,deleteOffice,loadAllProfiles,saveSchools,deleteClassroom,deleteSession,acquireLock,verifyLockOwnership,searchSchoolStudents} from './dataService';
import brandLogo from './assets/logo.png';
import './styles.css';
import './dynamic.css';

import ConfirmModal from './components/ui/ConfirmModal';
import AddSchoolModal from './components/modals/AddSchoolModal';
import ImportOfficeModal from './components/modals/ImportOfficeModal';
import PDFPreviewModal from './components/ui/PDFPreviewModal';
import Select from './components/ui/Select';
import Field from './components/ui/Field';
import './index.css';

const Dashboard=lazy(()=>import('./pages/Dashboard'));
const Classroom=lazy(()=>import('./pages/Classroom'));
const ScorePage=lazy(()=>import('./pages/ScorePage'));
const Reports=lazy(()=>import('./pages/Reports'));
const AccessAdmin=lazy(()=>import('./pages/AccessAdmin'));
const TrashAdmin=lazy(()=>import('./pages/TrashAdmin'));
const AuthPage=lazy(()=>import('./pages/AuthPage'));
const DataPrep=lazy(()=>import('./pages/DataPrep'));
const PublicSearch=lazy(()=>import('./pages/PublicSearch'));
const ExamTest=lazy(()=>import('./pages/ExamTest'));
const PendingAccess=lazy(()=>import('./components/ui/PendingAccess'));
const OnsiteDashboard=lazy(()=>import('./pages/OnsiteDashboard'));
const EvaluateForm=lazy(()=>import('./pages/EvaluateForm'));
const TeacherForm=lazy(()=>import('./pages/TeacherForm'));
const DebugEvals=lazy(()=>import('./pages/DebugEvals'));
const StockPage=lazy(()=>import('./pages/StockPage'));
const ScoreStatus=lazy(()=>import('./pages/ScoreStatus'));

const pageLoading=<div className="boot-screen"><Bot/>กำลังโหลดหน้า…</div>;

const baseTabs=[['dashboard','ภาพรวม',LayoutDashboard],['classroom','จัดการชั้นเรียน',Users],['onsite','หน้างาน',MapPin],['scores','บันทึกผลทดสอบ',ClipboardPenLine],['score-status','ติดตามการกรอกคะแนน',ClipboardCheck],['reports','รายงาน',FileText],['dataprep','เตรียมข้อมูล',FileCog]];
const BRAND_LOGO_ASPECT_RATIO = 17616 / 6250;
const themeSwal = Swal.mixin({
  customClass: {
    confirmButton: 'primary',
    cancelButton: 'button',
    popup: 'swal-theme-popup',
    title: 'swal-theme-title'
  },
  buttonsStyling: false,
  background: 'var(--panel)',
  color: 'var(--text)'
});
const restore=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const schoolIdentity=value=>[value?.name,value?.year,value?.term].map(part=>String(part??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('th-TH')).join('|');
const sessionTestNumber=value=>Number(String(value||'').match(/\d+/)?.[0])||0;
const sessionHasRecordedResult=session=>Object.values(session?.entries||{}).some(entry=>entry?.absent||entry?.is_special||entry?.score!==''&&entry?.score!=null||entry?.time);
const sessionResultCount=session=>Object.values(session?.entries||{}).filter(entry=>entry?.absent||entry?.is_special||entry?.score!==''&&entry?.score!=null||entry?.time).length;
const sessionHasMetadata=session=>Boolean(session?.date||session?.endDate||session?.robot||session?.exam||session?.teachingPeriod||session?.trainer||session?.term||session?.year||session?.feedback?.detail||session?.feedback?.summary);
const sessionHasAnyData=session=>sessionHasRecordedResult(session)||sessionHasMetadata(session);
const sessionIsBlank=session=>!sessionHasAnyData(session);
const feedbackTextFromSession=session=>[session?.feedback?.detail,session?.feedback?.summary]
 .filter(value=>value!==undefined&&value!==null&&String(value).length>0)
 .map(String)
 .join('\n');
const mergeClassroomDetailIntoSchool=(school,detail)=>({...school,
 classrooms:school.classrooms.map(classroom=>classroom.id===detail.classroom.id?detail.classroom:classroom),
 sessions:[...school.sessions.filter(session=>session.classId!==detail.classroom.id),...detail.sessions]
});

function App({user,profile,onSignOut}){
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  let tab = 'dashboard';
  if (path.startsWith('/scores')) tab = 'scores';
  else if (path.startsWith('/score-status')) tab = 'score-status';
  else if (path.startsWith('/onsite') || path.startsWith('/evaluate')) tab = 'onsite';
  else if (path.startsWith('/stock')) tab = 'stock';
  else if (path.startsWith('/classroom')) tab = 'classroom';
  else if (path.startsWith('/reports')) tab = 'reports';
  else if (path.startsWith('/dataprep')) tab = 'dataprep';
  else if (path.startsWith('/admin/users')) tab = 'admin';
  else if (path.startsWith('/admin/trash')) tab = 'trash';

  const [dark,setDark]=useState(()=>restore('erp-dark',false)),[schools,setSchools]=useState([]),[toast,setToast]=useState('');
  const [offices,setOffices]=useState([]);
  const [userProfiles,setUserProfiles]=useState({});
  const [schoolId,setSchoolId]=useState(''),[classId,setClassId]=useState(''),[sessionId,setSessionId]=useState('');
  const [confirming,setConfirming]=useState(null),[schoolAdding,setSchoolAdding]=useState(false),[pendingImport,setPendingImport]=useState(null),[pdfPreview,setPdfPreview]=useState(null),[pdfEditor,setPdfEditor]=useState(null),[scoreSaveBlocked,setScoreSaveBlocked]=useState(null),[retryingScoreLock,setRetryingScoreLock]=useState(false);
  const pdfSettings={scale:1};
  const isSuperOwner = user.email === 'arsan113@gmail.com';
  const tabs=baseTabs;
  const readOnly=profile.role==='viewer';
  const viewerLocked=readOnly&&['classroom','scores','reports'].includes(tab);
  const refs=useRef({}),previousPathRef=useRef(path),cloudReady=useRef(false),schoolLoadRequest=useRef(0),dirtyRef=useRef({schools:new Set(),sessions:new Set(),classrooms:new Set(),results:new Map()}),lockRetryTimer=useRef(null),[cloudStatus,setCloudStatus]=useState('loading'),[contextLoading,setContextLoading]=useState(false),[contextLoadError,setContextLoadError]=useState(''),[roomRefreshing,setRoomRefreshing]=useState(false),school=schools.find(s=>s.id===schoolId)||schools[0],classroom=school?.classrooms.find(c=>c.id===classId)||school?.classrooms[0];
  const scoreTargetRequest=useRef(''),contextRetryRef=useRef(null);
  const searchStudentsInSchool=useCallback((targetSchoolId,classroomIds,term)=>searchSchoolStudents(targetSchoolId,classroomIds,term),[]);
  const classSessions=(school?.sessions.filter(s=>s.classId===classroom?.id)||[]).sort((a,b)=>(parseInt((a.test.match(/\d+/)||[])[0])||0)-(parseInt((b.test.match(/\d+/)||[])[0])||0)),session=classSessions.find(s=>s.id===sessionId)||classSessions[0];
  const classroomStudents=(classroom?.students||[]).map(s=>({...s,score:'',time:'',absent:false,updatedBy:'',...(session?.entries?.[s.id]||{})}));
  const students=classroomStudents.filter(s=>s.active!==false||session?.entries?.[s.id]);
  const meta={school:school?.name||'',year:school?.year||'',term:school?.term||'',officeId:school?.officeId||'',level:classroom?.name||'',test:session?.test||'',date:session?.date||'',endDate:session?.endDate||'',robot:session?.robot||'',exam:session?.exam||'',teachingPeriod:session?.teachingPeriod||'',trainer:session?.trainer||'',sessionTerm:session?.term||'',sessionYear:session?.year||''};
  const feedback=session?.feedback||{detail:'',summary:''},stats=useMemo(()=>calcStats(students),[students]);
  const scoreSchool=schools.find(s=>s.id===schoolId)||null;
  const scoreClassroom=scoreSchool?.classrooms.find(c=>c.id===classId)||null;
  const scoreClassSessions=(scoreSchool?.sessions.filter(s=>s.classId===scoreClassroom?.id)||[]).sort((a,b)=>(parseInt((a.test.match(/\d+/)||[])[0])||0)-(parseInt((b.test.match(/\d+/)||[])[0])||0));
  const scoreSession=scoreClassSessions.find(s=>s.id===sessionId)||null;
  const scoreClassroomStudents=(scoreClassroom?.students||[]).map(s=>({...s,score:'',time:'',absent:false,updatedBy:'',...(scoreSession?.entries?.[s.id]||{})}));
  const scoreStudents=scoreClassroomStudents.filter(s=>s.active!==false||scoreSession?.entries?.[s.id]);
  const scoreMeta={school:scoreSchool?.name||'',year:scoreSchool?.year||'',term:scoreSchool?.term||'',officeId:scoreSchool?.officeId||'',level:scoreClassroom?.name||'',test:scoreSession?.test||'',date:scoreSession?.date||'',endDate:scoreSession?.endDate||'',robot:scoreSession?.robot||'',exam:scoreSession?.exam||'',teachingPeriod:scoreSession?.teachingPeriod||'',trainer:scoreSession?.trainer||'',sessionTerm:scoreSession?.term||'',sessionYear:scoreSession?.year||''};
  const scoreFeedback=scoreSession?.feedback||{detail:'',summary:''};
  const scoreStats=useMemo(()=>calcStats(scoreStudents),[scoreStudents]);
  useEffect(()=>{
    const blurNumberInputOnWheel=event=>{
      const target=event.target;
      if(target instanceof HTMLInputElement&&target.type==='number')target.blur();
    };
    document.addEventListener('wheel',blurNumberInputOnWheel,{capture:true});
    return()=>document.removeEventListener('wheel',blurNumberInputOnWheel,{capture:true});
  },[]);
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
      pass:x.rate,
      tests:school.sessions.filter(s=>s.classId===c.id).length,
      feedback: latest?.feedback || { detail: '', summary: '' }
    }
  });
  const dashboardStats=calcStats((school?.classrooms||[]).flatMap(c=>{const latest=school.sessions.filter(s=>s.classId===c.id).at(-1);return c.students.filter(st=>st.active!==false||latest?.entries?.[st.id]).map(st=>({...st,...(latest?.entries?.[st.id]||{})}))}));
  const hasDirty=()=>{const d=dirtyRef.current;return d.schools.size||d.sessions.size||d.classrooms.size||d.results.size};
  const flushChanges=async()=>{
   if(readOnly||!cloudReady.current||!hasDirty())return;
   
   // --- VERIFY LOCK OWNERSHIP BEFORE SAVE ---
   const pending=dirtyRef.current;
   const allSessions=schools.flatMap(s=>s.sessions);
   const allClassrooms=schools.flatMap(s=>s.classrooms);
   
   // Collect all classIds that are being modified
   const classIdsToSave = new Set();
   [...pending.classrooms].forEach(id => classIdsToSave.add(id));
   [...pending.sessions].forEach(id => {
       const session = allSessions.find(s => s.id === id);
       if (session) classIdsToSave.add(session.classId);
   });
   [...pending.results].forEach(([sessionId]) => {
       const session = allSessions.find(s => s.id === sessionId);
       if (session) classIdsToSave.add(session.classId);
   });
   
   // Check if we still hold the lock for these classes
   for (const cid of classIdsToSave) {
       const lockCheck = await verifyLockOwnership(cid, user?.id);
        if (lockCheck.hasLock===null) {
             if(!lockRetryTimer.current){
               flash('ตรวจสอบสิทธิ์การแก้ไขไม่ได้ชั่วคราว กำลังลองใหม่...');
               lockRetryTimer.current=setTimeout(()=>{
                 lockRetryTimer.current=null;
                 flushChanges().catch(console.error);
               },3000);
             }
             setCloudStatus('saving');
             return;
        }
        if (!lockCheck.hasLock) {
             setScoreSaveBlocked({classId:cid,lockedBy:lockCheck.lockedBy});
             setCloudStatus('error');
             flash(`หยุดการกรอกชั่วคราว: ${lockCheck.lockedBy}`);
             return;
        }
   }
   // ----------------------------------------
   
   dirtyRef.current={schools:new Set(),sessions:new Set(),classrooms:new Set(),results:new Map()};setCloudStatus('saving');
   try{
    await Promise.all([
     ...[...pending.schools].map(id=>{const target=schools.find(s=>s.id===id);return target?saveSchoolMeta(target,user.id):Promise.resolve()}),
     saveSessionRows([...pending.sessions].map(id=>allSessions.find(s=>s.id===id))),
     ...[...pending.classrooms].map(id=>{const room=allClassrooms.find(c=>c.id===id);return room?Promise.all([saveClassroomMeta(id,room.name),saveClassroomStudents(id,room.students)]):Promise.resolve()})
    ]);
    await Promise.all([...pending.results].map(([sessionId,studentIds])=>{const target=allSessions.find(s=>s.id===sessionId);return target?saveResultRows(sessionId,target.entries,user.id,[...studentIds]):Promise.resolve()}));
    setCloudStatus(hasDirty()?'saving':'saved');
   }catch(error){
    pending.schools.forEach(id=>dirtyRef.current.schools.add(id));pending.sessions.forEach(id=>dirtyRef.current.sessions.add(id));pending.classrooms.forEach(id=>dirtyRef.current.classrooms.add(id));pending.results.forEach((ids,sid)=>{const target=dirtyRef.current.results.get(sid)||new Set();ids.forEach(id=>target.add(id));dirtyRef.current.results.set(sid,target)});setCloudStatus(error.code==='42P01'?'setup':'error');throw error;
   }
  };
  useEffect(()=>{
    localStorage.setItem('erp-dark',JSON.stringify(dark));
    if(dark) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  },[dark]);
  useEffect(()=>localStorage.setItem('erp-active-school',JSON.stringify(school?.id)),[school?.id]);useEffect(()=>localStorage.setItem('erp-active-class',JSON.stringify(classroom?.id)),[classroom?.id]);useEffect(()=>localStorage.setItem('erp-active-session',JSON.stringify(session?.id)),[session?.id]);
  useEffect(()=>{
    const wasScores=previousPathRef.current.startsWith('/scores');
    const isScores=path.startsWith('/scores');
    if(isScores&&!wasScores){setSchoolId('');setClassId('');setSessionId('');}
    previousPathRef.current=path;
  },[path]);
  useEffect(()=>{let active=true;(async()=>{try{
   setCloudStatus('loading');
   const [index,remoteOffices,currProfile,profilesData]=await Promise.all([loadSchoolIndex(),loadOffices(),loadCurrentProfile(user),loadAllProfiles()]);
   if(!active)return;
   setOffices(remoteOffices);setSchools(index);
   setUserProfiles(Object.fromEntries((profilesData||[]).map(p=>[p.id,p.full_name||p.email])));
   if(!index.length){setSchoolId(null);setClassId(null);setSessionId(null);cloudReady.current=true;setCloudStatus('saved');return}
   if(path.startsWith('/scores')){setSchoolId('');setClassId('');setSessionId('');cloudReady.current=true;setCloudStatus('saved');return}
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
  useEffect(()=>()=>{if(lockRetryTimer.current)clearTimeout(lockRetryTimer.current)},[]);
  useEffect(()=>{if(cloudStatus!=='saving')return;const warn=e=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[cloudStatus]);
  useEffect(()=>{if(cloudStatus==='saved'&&confirming?.waitForSave){const continueAction=confirming.onConfirm;setConfirming(null);continueAction?.();flash('บันทึกเสร็จแล้ว เปลี่ยนข้อมูลให้เรียบร้อยแล้ว')}},[cloudStatus,confirming]);
  const flash=t=>{setToast(t);setTimeout(()=>setToast(''),2400)},mutateSchool=fn=>setSchools(all=>all.map(s=>s.id===school.id?fn(s):s));
  const scoreEntryBlocked=scoreSaveBlocked?.classId===classroom?.id;
  const retryScoreSaveLock=async()=>{
    if(!scoreSaveBlocked)return;
    setRetryingScoreLock(true);
    try{
      const result=await acquireLock(scoreSaveBlocked.classId,user.id,userProfiles?.[user.id]||user.email||'แอดมิน');
      if(!result.success){
        setScoreSaveBlocked(current=>current?{...current,lockedBy:result.lockedBy}:current);
        flash(`ยังไม่สามารถแก้ไขห้องนี้ได้: ${result.lockedBy}`);
        return;
      }
      setScoreSaveBlocked(null);
      flash('ยืนยันสิทธิ์แก้ไขแล้ว กำลังบันทึกข้อมูลที่ค้างอยู่...');
      await flushChanges();
    }catch(error){
      console.error(error);
      flash('ยืนยันสิทธิ์แก้ไขไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }finally{setRetryingScoreLock(false)}
  };
  const markSchool=id=>dirtyRef.current.schools.add(id),markSession=id=>dirtyRef.current.sessions.add(id),markClassroom=id=>dirtyRef.current.classrooms.add(id),markResult=(sid,studentId)=>{const ids=dirtyRef.current.results.get(sid)||new Set();ids.add(studentId);dirtyRef.current.results.set(sid,ids)};
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase.channel(`public:test_results:session_id=eq.${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_results', filter: `session_id=eq.${sessionId}` }, payload => {
        if (!payload.new) return;
        const { student_id, score, time_value, absent, updated_by } = payload.new;
        if (updated_by === user.id) return;
        setSchools(current => current.map(s => {
          if (!s.sessions?.some(x => x.id === sessionId)) return s;
          return {...s, sessions: s.sessions.map(x => x.id !== sessionId ? x : {...x, entries: {...x.entries, [student_id]: { score: score === null ? '' : String(score), time: time_value || '', absent: Boolean(absent), updatedBy: updated_by }}})}
        }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, user.id]);
  const selectSchoolNow=id=>{const s=schools.find(x=>x.id===id),request=++schoolLoadRequest.current;setSchoolId(id);setClassId('');setSessionId('');setContextLoadError('');contextRetryRef.current=()=>selectSchoolNow(id);if(!s||s.loaded){contextRetryRef.current=null;return}setContextLoading(true);loadSchoolDetail(id).then(detail=>{setSchools(all=>all.map(item=>item.id===id?{...detail,summary:item.summary}:item));if(schoolLoadRequest.current===request){setClassId('');setSessionId('');contextRetryRef.current=null}}).catch(error=>{console.error(error);if(schoolLoadRequest.current===request)setContextLoadError(`โหลดข้อมูลโรงเรียนไม่สำเร็จ: ${error.message}`)}).finally(()=>{if(schoolLoadRequest.current===request)setContextLoading(false)})};
  const guardNavigation = (action) => {
    if (hasDirty()) {
      setConfirming({
        title: 'มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก',
        message: 'คุณต้องการบันทึกข้อมูลที่เพิ่งแก้ไขหรือไม่?\nหากเลือก "ทิ้งข้อมูล" การแก้ไขล่าสุดจะสูญหาย',
        saveLabel: 'บันทึกข้อมูล',
        onSave: async () => {
          flash('กำลังบันทึกข้อมูล...');
          try { await flushChanges(); action(); } catch(e) {}
        },
        dangerLabel: 'ทิ้งข้อมูล',
        danger: true,
        onConfirm: () => {
          dirtyRef.current={schools:new Set(),sessions:new Set(),classrooms:new Set(),results:new Map()};
          setCloudStatus('saved');
          action();
        }
      });
      return false;
    }
    if (cloudStatus === 'saving') {
      setConfirming({
        title: 'กำลังบันทึก กรุณารอสักครู่',
        message: 'ระบบกำลังบันทึกข้อมูลอยู่ กรุณารอหรือกดยืนยันเพื่อเปลี่ยนหน้าทันที',
        dangerLabel: 'เปลี่ยนทันที',
        danger: true,
        waitForSave: true,
        onConfirm: action
      });
      return false;
    }
    action();
    return true;
  };

  const navigateTab = (id) => {
    let target = '/';
    if (id === 'admin') target = '/admin/users';
    else if (id === 'trash') target = '/admin/trash';
    else if (id !== 'dashboard') target = `/${id}`;
    guardNavigation(() => navigate(target));
  };
  const selectSchool=id=>{if(id&&id===schoolId)return true; return guardNavigation(()=>selectSchoolNow(id));};
  const selectSchoolAfter=s=>{schoolLoadRequest.current++;setContextLoading(false);setSchoolId(s.id);setClassId(s.classrooms[0]?.id);setSessionId(s.sessions[0]?.id);navigate('/classroom')};
  const selectClassNow=id=>{
   const scoreSchoolIsPartial=path.startsWith('/scores')&&scoreSchool?.id===schoolId&&!scoreSchool.loaded;
   const hasClassSessions=scoreSchool?.sessions.some(session=>session.classId===id);
   if(scoreSchoolIsPartial&&!hasClassSessions){
    const request=++schoolLoadRequest.current;
     setClassId(id);setSessionId('');setContextLoadError('');contextRetryRef.current=()=>selectClassNow(id);setContextLoading(true);
    loadClassroomDetail(id).then(detail=>{
     if(schoolLoadRequest.current!==request)return;
     setSchools(all=>all.map(item=>item.id===schoolId?mergeClassroomDetailIntoSchool(item,detail):item));
      setSessionId(detail.sessions[0]?.id||'');
      contextRetryRef.current=null;
     }).catch(error=>{
      console.error(error);
      if(schoolLoadRequest.current===request)setContextLoadError(`โหลดข้อมูลห้องเรียนไม่สำเร็จ: ${error.message}`);
    }).finally(()=>{
     if(schoolLoadRequest.current===request)setContextLoading(false);
    });
    return;
   }
    const availableSessions=path.startsWith('/scores')?scoreSchool?.sessions:school?.sessions;
    setContextLoadError('');contextRetryRef.current=null;
    setClassId(id);setSessionId(availableSessions?.find(session=>session.classId===id)?.id||'');
  };
  const selectClass=id=>{if(id&&id===classId)return true; return guardNavigation(()=>selectClassNow(id));};
  useEffect(()=>{
    if(!path.startsWith('/scores')){
      scoreTargetRequest.current='';
      return;
    }
    const params=new URLSearchParams(location.search);
    const requestedSchoolId=params.get('schoolId');
    if(!requestedSchoolId){
      scoreTargetRequest.current='';
      return;
    }
    const target=schools.find(item=>String(item.id)===String(requestedSchoolId));
    if(!target)return;
    const requestKey=`${location.pathname}${location.search}`;
    if(scoreTargetRequest.current===requestKey)return;
    scoreTargetRequest.current=requestKey;
    const requestedClassId=params.get('classId')||'';
    const requestedSessionId=params.get('sessionId')||'';
    const nextClassId=target.classrooms.some(item=>String(item.id)===String(requestedClassId))?requestedClassId:(target.classrooms[0]?.id||'');
    const applyTarget=(schoolData,sessionsSource=schoolData.sessions)=>{
      const nextClass=schoolData.classrooms.some(item=>String(item.id)===String(requestedClassId))?requestedClassId:(schoolData.classrooms[0]?.id||'');
      const sessionsForClass=sessionsSource.filter(item=>String(item.classId)===String(nextClass));
      const nextSession=sessionsForClass.some(item=>String(item.id)===String(requestedSessionId))?requestedSessionId:(sessionsForClass[0]?.id||'');
      setSchoolId(schoolData.id);
      setClassId(nextClass);
      setSessionId(nextSession);
    };
     if(target.loaded){
      applyTarget(target);
      setContextLoadError('');
      contextRetryRef.current=null;
      setContextLoading(false);
      return;
    }
     if(!nextClassId){
      applyTarget(target);
      setContextLoadError('');
      contextRetryRef.current=null;
      setContextLoading(false);
      return;
    }
    const targetClass=target.classrooms.find(item=>String(item.id)===String(nextClassId));
    const targetClassAlreadyLoaded=target.sessions.some(item=>String(item.classId)===String(nextClassId))||targetClass?.students?.length>0;
     if(targetClassAlreadyLoaded){
      applyTarget(target);
      setContextLoadError('');
      contextRetryRef.current=null;
      setContextLoading(false);
      return;
    }
    const request=++schoolLoadRequest.current;
    setSchoolId(target.id);
     setClassId('');
     setSessionId('');
     setContextLoadError('');
     contextRetryRef.current=()=>window.location.reload();
    setContextLoading(true);
    loadClassroomDetail(nextClassId).then(detail=>{
      if(schoolLoadRequest.current!==request)return;
       setSchools(current=>current.map(item=>item.id===target.id?mergeClassroomDetailIntoSchool(item,detail):item));
       contextRetryRef.current=null;
      applyTarget({...target,classrooms:target.classrooms.map(item=>item.id===detail.classroom.id?detail.classroom:item),sessions:detail.sessions},detail.sessions);
     }).catch(error=>{
      console.error(error);
      if(schoolLoadRequest.current===request)setContextLoadError(`โหลดข้อมูลห้องเรียนไม่สำเร็จ: ${error.message}`);
    }).finally(()=>{
      if(schoolLoadRequest.current===request)setContextLoading(false);
    });
  },[path,location.search,schools]);
  useEffect(()=>{
    if(!path.startsWith('/scores')||!schoolId||!classId||!sessionId)return;
    const params=new URLSearchParams(location.search);
    if(params.get('schoolId')===String(schoolId)&&params.get('classId')===String(classId)&&params.get('sessionId')===String(sessionId))return;
    params.set('schoolId',schoolId);params.set('classId',classId);params.set('sessionId',sessionId);
    navigate({pathname:'/scores',search:`?${params.toString()}`},{replace:true});
  },[path,location.search,schoolId,classId,sessionId,navigate]);
  const refreshClassroomNow=async()=>{
    if(!school||!classroom)return;
    const targetSchoolId=school.id,targetClassroomId=classroom.id,currentSessionId=sessionId;
    try{
      setRoomRefreshing(true);
      const detail=await loadClassroomDetail(targetClassroomId);
      setSchools(all=>all.map(s=>{
        if(s.id!==targetSchoolId)return s;
        return {
          ...s,
          classrooms:s.classrooms.map(c=>c.id===targetClassroomId?detail.classroom:c),
          sessions:[...s.sessions.filter(item=>item.classId!==targetClassroomId),...detail.sessions]
        };
      }));
      const stillSelected=detail.sessions.some(item=>item.id===currentSessionId);
      setSessionId(stillSelected?currentSessionId:(detail.sessions[0]?.id||''));
      flash(`รีโหลดข้อมูลห้อง ${detail.classroom.name} เรียบร้อยแล้ว`);
    }catch(error){
      console.error(error);
      flash(`รีโหลดข้อมูลห้องไม่สำเร็จ: ${error.message}`);
    }finally{
      setRoomRefreshing(false);
    }
  };
  const refreshClassroom=()=>guardNavigation(refreshClassroomNow);
  const editSession=async id=>{
    const target=school?.sessions.find(item=>item.id===id&&item.classId===classroom?.id);
    if(!target)return;
    const currentNumber=sessionTestNumber(target.test)||1;
    const input=await themeSwal.fire({
      title:'แก้ไขครั้งที่ทดสอบ',
      text:'แก้เฉพาะเลขครั้ง โดยคงคะแนนและข้อมูลเดิมไว้',
      input:'number',
      inputValue:currentNumber,
      inputAttributes:{min:1,max:99,step:1},
      showCancelButton:true,
      confirmButtonText:'ตรวจสอบ',
      cancelButtonText:'ยกเลิก',
      inputValidator:value=>{
        const number=Number(value);
        return Number.isInteger(number)&&number>0?'': 'กรุณาระบุเลขครั้งเป็นจำนวนเต็มมากกว่า 0';
      }
    });
    if(!input.isConfirmed)return;
    const nextNumber=Number(input.value),nextName=`ครั้งที่ ${nextNumber}`;
    if(nextNumber===currentNumber)return;
    const conflict=school.sessions.find(item=>item.id!==id&&item.classId===classroom?.id&&sessionTestNumber(item.test)===nextNumber);
    if(conflict){
      const sourceCount=sessionResultCount(target),conflictCount=sessionResultCount(conflict);
      await themeSwal.fire({
        icon:'warning',
        title:`มี ${nextName} อยู่แล้ว`,
        text:sessionIsBlank(conflict)
          ? 'รายการครั้งนี้มีอยู่แล้ว แต่ถูกเคลียจนว่าง ไม่มีคะแนนหรือรายละเอียดชุดทดสอบ ให้เลือกรายการนี้จากช่องครั้งที่ทดสอบเพื่อกรอกต่อ ระบบจะไม่สร้างชื่อซ้ำ'
          : sourceCount||conflictCount
            ? `ครั้งที่นี้มีผลสอบอยู่แล้ว (เดิม ${conflictCount} รายการ / รายการที่กำลังแก้ ${sourceCount} รายการ) ระบบจะไม่ทับข้อมูลให้อัตโนมัติ`
            : 'มีรายละเอียดของรอบนี้อยู่แล้ว ระบบจะไม่สร้างชื่อซ้ำให้อัตโนมัติ',
        confirmButtonText:'รับทราบ'
      });
      return;
    }
    const confirm=await themeSwal.fire({
      icon:'question',
      title:`เปลี่ยนเป็น ${nextName}?`,
      text:sessionHasRecordedResult(target)?'คะแนนและข้อมูลเดิมจะยังอยู่กับครั้งเดิม':'ครั้งนี้ยังไม่มีผลคะแนน ระบบจะเปลี่ยนเฉพาะชื่อครั้ง',
      showCancelButton:true,
      confirmButtonText:'ยืนยันการแก้ไข',
      cancelButtonText:'ยกเลิก'
    });
    if(!confirm.isConfirmed)return;
    markSession(id);
    mutateSchool(s=>({...s,sessions:s.sessions.map(item=>item.id===id?{...item,test:nextName}:item)}));
    flash(`แก้เป็น ${nextName} แล้ว กำลังบันทึกอัตโนมัติ`);
  };
  const setMeta=next=>{if(!school||scoreEntryBlocked)return;const endDate=next.endDate&&next.endDate===next.date?'':next.endDate;markSchool(school.id);if(session)markSession(session.id);if(classroom&&next.level!==classroom.name)markClassroom(classroom.id);mutateSchool(s=>({...s,name:next.school,year:next.year,term:next.term,officeId:next.officeId||'',classrooms:s.classrooms.map(c=>c.id===classId?{...c,name:next.level}:c),sessions:s.sessions.map(x=>x.id===session?.id?{...x,test:next.test,date:next.date,endDate,robot:next.robot,exam:next.exam,teachingPeriod:next.teachingPeriod,trainer:next.trainer,term:next.sessionTerm,year:next.sessionYear}:x)}))};
  const setFeedback=next=>{if(!session||scoreEntryBlocked)return;markSession(session.id);mutateSchool(s=>({...s,sessions:s.sessions.map(x=>x.id===session.id?{...x,feedback:next}:x)}))};
  const update=(id,key,val)=>{if(!session||scoreEntryBlocked)return;markResult(session.id,id);mutateSchool(s=>({...s,sessions:s.sessions.map(x=>x.id===session.id?{...x,entries:{...x.entries,[id]:{...x.entries[id],[key]:val,updatedBy:user.id}}}:x)}))};
  const resetCurrentSession = () => {
    if (!session || !classroom || scoreEntryBlocked) return;
    const studentIds = [...new Set([...classroom.students.map(s => s.id), ...Object.keys(session.entries || {})])];
    studentIds.forEach(id => markResult(session.id, id));
    markSession(session.id);
    mutateSchool(s => ({
      ...s,
      sessions: s.sessions.map(x => {
        if (x.id !== session.id) return x;
        const entries = Object.fromEntries(studentIds.map(id => [id, {score:'', time:'', absent:false, is_special:false, updatedBy:''}]));
        return {
          ...x,
          date:'',
          endDate:'',
          robot:'',
          exam:'',
          teachingPeriod:'',
          trainer:'',
          term:'',
          year:'',
          feedback:{detail:'',summary:''},
          entries
        };
      })
    }));
    flash('รีเซตข้อมูลครั้งนี้แล้ว กำลังบันทึกอัตโนมัติ');
  };
  const setStudents=nextOrFn=>{if(!classroom||!session)return;const next=typeof nextOrFn==='function'?nextOrFn(classroomStudents):nextOrFn;markClassroom(classroom.id);next.forEach(st=>markResult(session.id,st.id));mutateSchool(s=>({...s,classrooms:s.classrooms.map(c=>c.id===classroom.id?{...c,students:next.map(({score,time,absent,updatedBy,...student})=>student)}:c),sessions:s.sessions.map(x=>x.id===session.id?{...x,entries:Object.fromEntries(next.map(st=>[st.id,{score:st.score,time:st.time,absent:st.absent,updatedBy:st.updatedBy}]))}:x)}))};
  const move=(i,key,e)=>{if(['Enter','ArrowDown'].includes(e.key)){e.preventDefault();refs.current[`${i+1}-${key}`]?.focus()}};
  const importExcel=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=new FileReader();r.onload=async ev=>{try{
   flash('กำลังอ่านไฟล์ Excel...');
   const imported=await parseSchoolWorkbook(ev.target.result,f.name);
   if(!imported.classrooms.length)throw Error('ไม่พบรายชื่อนักเรียน');
   setPendingImport(imported);flash('อ่านไฟล์สำเร็จ กำลังเตรียมข้อมูลการนำเข้า...');
  }catch(err){flash(`นำเข้าไม่สำเร็จ: ${err.message}`)}};r.readAsArrayBuffer(f)};
  const importBulkExcel=async e=>{
   const files=Array.from(e.target.files);e.target.value='';if(!files.length)return;
   flash(`กำลังนำเข้าข้อมูลจาก ${files.length} ไฟล์...`);setCloudStatus('saving');
   let successCount=0,failedCount=0;
   for(const f of files){
    try{
     const buffer=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=ev=>resolve(ev.target.result);r.onerror=reject;r.readAsArrayBuffer(f)});
     const data=await parseSchoolWorkbook(buffer,f.name);
     if(!data.classrooms.length)throw Error('ไม่มีนักเรียน');
     const candidate={name:data.name,year:String(data.year),term:String(data.term)},duplicate=schools.find(item=>schoolIdentity(item)===schoolIdentity(candidate));
     if(duplicate){failedCount++;continue;}
     const sid=`school-${Date.now()}-${Math.random()}`,sessions=data.classrooms.map(c=>({id:`session-${Date.now()}-${Math.random()}`,classId:c.id,test:'ครั้งที่ 1',date:new Date().toISOString().slice(0,10),endDate:'',robot:'Code & Go',exam:'Basic 1',teachingPeriod:'',trainer:'',term:String(data.term),year:String(data.year),feedback:{detail:'',summary:''},entries:{}})),s={id:sid,...candidate,officeId:'',loaded:true,classrooms:data.classrooms,sessions};
     await saveSchoolBundle(s,user.id);
     setSchools(v=>[...v,s]);
     successCount++;
    }catch(err){console.error(err);failedCount++;}
   }
   setCloudStatus('saved');flash(`นำเข้าสำเร็จ ${successCount} โรงเรียน (ข้าม/ผิดพลาด ${failedCount} ไฟล์)`);
  };
  const addSchool=async data=>{
   const candidate={name:data.name,year:String(data.year),term:String(data.term)},duplicate=schools.find(item=>schoolIdentity(item)===schoolIdentity(candidate));
   if(duplicate){setSchoolAdding(false);selectSchoolAfter(duplicate);flash(`โรงเรียน ${duplicate.name} มีอยู่แล้ว — เปิดข้อมูลเดิมให้แล้ว`);return;}
   const sid=`school-${Date.now()}`,sessions=data.classrooms.map(c=>({id:`session-${Date.now()}-${Math.random()}`,classId:c.id,test:'ครั้งที่ 1',date:new Date().toISOString().slice(0,10),robot:'Code & Go',exam:'Basic 1',teachingPeriod:'',trainer:'',term:String(data.term),year:String(data.year),feedback:{detail:'',summary:''},entries:{}})),s={id:sid,...candidate,officeId:data.officeId||'',loaded:true,classrooms:data.classrooms,sessions};
   try{
      setCloudStatus('saving');
      await saveSchoolBundle(s,user.id);
      setSchools(v=>v.some(x=>x.id===s.id)?v:[...v,s]);
      setSchoolAdding(false);
      selectSchoolAfter(s);
      setCloudStatus('saved');
      flash(`สร้างโรงเรียน ${data.name} เรียบร้อยแล้ว`)
   }catch(error){console.error(error);setCloudStatus('error');flash(`สร้างโรงเรียนไม่สำเร็จ: ${error.message}`)}
  };
  const addOffice=async name=>{try{const office=await createOffice(name,user.id);setOffices(all=>all.some(x=>x.id===office.id)?all:[...all,office].sort((a,b)=>a.name.localeCompare(b.name,'th')));flash(`เพิ่ม ${office.name} แล้ว`);return office}catch(error){console.error(error);flash(`เพิ่มสำนักงานไม่สำเร็จ: ${error.message}`);return null}};
  const removeOffice=async (id,name)=>{setConfirming({title:`ยืนยันการลบสำนักงาน "${name}"`,message:`โรงเรียนที่อยู่ในสำนักงานนี้จะถูกปลดเป็น "ยังไม่ระบุสำนักงาน"\nคุณแน่ใจหรือไม่ว่าต้องการลบสำนักงานนี้?`,dangerLabel:'ลบสำนักงาน',onConfirm:async ()=>{try{await deleteOffice(id);setOffices(all=>all.filter(x=>x.id!==id));setSchools(all=>all.map(s=>s.officeId===id?{...s,officeId:''}:s));flash(`ลบสำนักงาน ${name} แล้ว`)}catch(error){console.error(error);flash(`ลบสำนักงานไม่สำเร็จ: ${error.message}`)}}})};
  const addSession=()=>{const id=`session-${Date.now()}`,n=Math.max(0,...classSessions.map(item=>sessionTestNumber(item.test)))+1;markSession(id);mutateSchool(s=>({...s,sessions:[...s.sessions,{id,classId:classroom.id,test:`ครั้งที่ ${n}`,date:'',endDate:'',robot:'',exam:'',teachingPeriod:'',trainer:'',term:'',year:'',feedback:{detail:'',summary:''},entries:{}}]}));setSessionId(id)};
  const removeSession=id=>{setConfirming({title:'ยืนยันการลบครั้งทดสอบ',message:'คุณแน่ใจหรือไม่ว่าต้องการลบครั้งที่ทดสอบนี้? ข้อมูลคะแนนและเวลาในครั้งนี้จะถูกลบทิ้งถาวร',dangerLabel:'ลบทิ้ง',onConfirm:async()=>{try{setCloudStatus('saving');await deleteSession(id);setSchools(all=>all.map(s=>s.id===school.id?{...s,sessions:s.sessions.filter(x=>x.id!==id)}:s));const remain=school.sessions.filter(x=>x.classId===classroom.id&&x.id!==id);setSessionId(remain.length?remain[remain.length-1].id:null);flash('ลบครั้งที่ทดสอบสำเร็จ');setCloudStatus('saved')}catch(e){console.error(e);setCloudStatus('error');flash(`ลบไม่สำเร็จ: ${e.message}`)}}})};
 
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
    ['ชั้นเรียน', 'นักเรียน', 'ครั้งที่ 1\n% ผ่าน', 'ครั้งที่ 2\n% ผ่าน', 'ครั้งที่ 3\n% ผ่าน', 'ครั้งที่ 4\n% ผ่าน', 'ครั้งที่ 5\n% ผ่าน', 'ครั้งที่ 6\n% ผ่าน'].forEach((h, i) => {
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
          const classroomPassRate=stats.rate/100;
          cell.value = Number(classroomPassRate.toFixed(4));
          cell.numFmt = '0.0%';
          cell.font = { ...FONT_REG, color: { argb: classroomPassRate >= .6 ? 'FF174A8B' : 'FFFF0000' } };
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

  const generateExcelWorkbook=async(targetSchool)=>{
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
      const thaiDateRange=(start,end)=>end&&end!==start?`${thaiDate(start)}-${thaiDate(end)}`:thaiDate(start);
     const exportExam=sess=>sess?.exam||defaultExamForRobot(sess?.robot);
     const sessionFor=(classroom,index)=>targetSchool.sessions.find(s=>s.classId===classroom.id&&sessionTestNumber(s.test)===index+1)||null;
    const logoRaw=logoBase64?.replace(/^data:image\/[^;]+;base64,/, '');
    const imageId=logoRaw?workbook.addImage({base64:logoRaw,extension:'png'}):null;

    targetSchool.classrooms.forEach(classroom=>{
      const ws=workbook.addWorksheet(sheetName(classroom.name),{views:[{state:'frozen',ySplit:13,xSplit:2,showGridLines:false}]});
     ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1,paperSize:9,margins:{left:.25,right:.25,top:.35,bottom:.35,header:.1,footer:.1}};
     ws.mergeCells('A1:D1');ws.getCell('A1').value=targetSchool.name;
     ws.mergeCells('F1:Q1');ws.getCell('F1').value='ผลการทดสอบและประเมินผลการเรียน School Robotics';
     ws.mergeCells('A3:D3');ws.getCell('A3').value=`ชั้น ${classroom.name}`;
     ws.mergeCells('F3:Q3');ws.getCell('F3').value='หลักสูตร School Robotics';
     ws.mergeCells('F5:Q5');ws.getCell('F5').value=`ภาคเรียนที่ ${targetSchool.term} ปีการศึกษา ${targetSchool.year}`;
     ['A1:D1','F1:Q1','A3:D3','F3:Q3','F5:Q5'].forEach(range=>styleRange(ws,range,{bold:true,size:range==='F1:Q1'?18:16,alignment:{vertical:'middle',horizontal:range.startsWith('A')?'left':'center'}}));
      ws.mergeCells('A8:A13');ws.getCell('A8').value='เลขที่';
      ws.mergeCells('B8:D13');ws.getCell('B8').value='ชื่อ-สกุล';
      ws.mergeCells('F8:Q8');ws.getCell('F8').value='คะแนนสอบ/ครั้งที่';
      styleRange(ws,'A8:D13',{fill:'FFEAF1DE',bold:true});styleRange(ws,'F8:Q13',{fill:'FFEAF1DE',bold:true});
     const starts=[6,9,12,15];
      const roomSessions=Array.from({length:4},(_,index)=>sessionFor(classroom,index));
     starts.forEach((col,index)=>{
       const sess=roomSessions[index],end=col+2;
       ws.mergeCells(9,col,9,end);ws.getRow(9).getCell(col).value=sess?.test||`ครั้งที่ ${index+1}`;
       ws.mergeCells(10,col,10,end);ws.getRow(10).getCell(col).value=sess?thaiDateRange(sess.date,sess.endDate):'';
       ws.mergeCells(11,col,11,end);ws.getRow(11).getCell(col).value=sess?.robot||'';
        ws.mergeCells(12,col,12,end);ws.getRow(12).getCell(col).value=sess?exportExam(sess):'';
       ws.getRow(13).getCell(col).value=50;ws.getRow(13).getCell(col+1).value='เวลา';ws.getRow(13).getCell(col+2).value='ลำดับ';
      });
      classroom.students.forEach((student,index)=>{
       const row=14+index;ws.getRow(row).height=22;ws.getRow(row).getCell(1).value=student.no;ws.getRow(row).getCell(2).value=student.name;ws.mergeCells(row,2,row,4);
      styleRange(ws,`A${row}:D${row}`,{size:14,alignment:{vertical:'middle',horizontal:'left'}});ws.getRow(row).getCell(1).alignment=center;
       roomSessions.forEach((sess,si)=>{
        const col=starts[si],entry=sess?.entries?.[student.id],ranks=sess?calcRanks(classroom.students.map(st=>({...st,...(sess.entries?.[st.id]||{})}))):{};
        ws.getRow(row).getCell(col).value=entry?.absent?'x':entry?.score===''||entry?.score==null?'':Number(entry.score);
        ws.getRow(row).getCell(col+1).value=entry?.absent?'':entry?.time||'';
        ws.getRow(row).getCell(col+2).value=entry?.absent?'':ranks[student.id]||'';
        styleRange(ws,`${ws.getRow(row).getCell(col).address}:${ws.getRow(row).getCell(col+2).address}`,{fill:si%2?'FFFCE4D6':undefined,size:13});
       });
      });
      const lastStudentRow=Math.max(13,13+classroom.students.length);
      outlineRange(ws,8,1,lastStudentRow,4);
      starts.forEach(col=>outlineRange(ws,8,col,lastStudentRow,col+2));
     ws.mergeCells('T8:AB8');ws.getCell('T8').value='สรุปผลคะแนนการทดสอบ';
     const summaryHeaders=['ครั้งที่','คะแนนเฉลี่ย','% ผู้ผ่านเกณฑ์','ต่ำกว่า 35','ขาดสอบ','การประเมิน'];
     [20,22,24,26,27,28].forEach((col,i)=>ws.getRow(9).getCell(col).value=summaryHeaders[i]);
     styleRange(ws,'T8:AB9',{fill:'FFFCE4D6',bold:true,size:9});
      roomSessions.forEach((sess,index)=>{
       const row=10+index;
       ws.getRow(row).getCell(20).value=sess?.test||`ครั้งที่ ${index+1}`;
       if(sess){
        const merged=classroom.students.map(st=>({...st,...(sess.entries?.[st.id]||{})})),x=calcStats(merged),passRate=x.rate/100;
        ws.getRow(row).getCell(22).value=Number(x.avg.toFixed(2));ws.getRow(row).getCell(24).value=passRate;ws.getRow(row).getCell(24).numFmt='0.00%';
        ws.getRow(row).getCell(26).value=merged.filter(st=>!st.absent&&st.score!==''&&Number(st.score)<35).length;ws.getRow(row).getCell(27).value=x.absent;ws.getRow(row).getCell(28).value=x.rate>=60?'ผ่าน':'ไม่ผ่าน';
       }
       styleRange(ws,`T${row}:AB${row}`,{size:13});
      });
      outlineRange(ws,8,20,13,28);
     ws.getColumn(1).width=8;ws.getColumn(2).width=16;ws.getColumn(3).width=16;ws.getColumn(4).width=16;ws.getColumn(5).width=2;
     for(let c=6;c<=17;c++)ws.getColumn(c).width=c%3===1?9:10;
     ws.getColumn(18).width=2;for(let c=20;c<=28;c++)ws.getColumn(c).width=13;
     if(imageId!==null)ws.addImage(imageId,{tl:{col:21,row:.25},ext:{width:210,height:74}});
    });

    const summary=workbook.addWorksheet(sheetName('สรุป'),{views:[{state:'frozen',ySplit:6,xSplit:2,showGridLines:false}]});
    summary.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1,paperSize:9};
    summary.mergeCells('A1:V1');summary.getCell('A1').value=targetSchool.name;
    summary.mergeCells('A2:V2');summary.getCell('A2').value='หลักสูตร School Robotics';
    summary.mergeCells('A3:V3');summary.getCell('A3').value=`ภาคเรียนที่ ${targetSchool.term} ปีการศึกษา ${targetSchool.year}`;
    ['A1:V1','A2:V2','A3:V3'].forEach((r,i)=>styleRange(summary,r,{bold:true,size:i===0?22:18}));
    summary.mergeCells('A4:A6');summary.getCell('A4').value='ชั้น';summary.mergeCells('B4:B6');summary.getCell('B4').value='จำนวน';
    styleRange(summary,'A4:B6',{fill:'FFFCE4D6',bold:true,size:14});
    const groupStarts=[3,8,13,18];
    groupStarts.forEach((start,index)=>{
     const end=start+4,color=sessionColors[index];summary.mergeCells(4,start,4,end);summary.getRow(4).getCell(start).value=`ครั้งที่ ${index+1}`;
     summary.mergeCells(5,start,5,end);const sample=targetSchool.classrooms.map(c=>sessionFor(c,index)).find(Boolean);summary.getRow(5).getCell(start).value=sample?`วันที่ ${thaiDate(sample.date)}`:'';
     ['หุ่นยนต์','แบบทดสอบ','% ผู้ผ่านเกณฑ์','ประเมิน','วิทยากร'].forEach((h,i)=>summary.getRow(6).getCell(start+i).value=h);
     styleRange(summary,`${summary.getRow(4).getCell(start).address}:${summary.getRow(6).getCell(end).address}`,{fill:color,bold:true,size:13});
    });
    targetSchool.classrooms.forEach((classroom,index)=>{
     const row=7+index;summary.getRow(row).getCell(1).value=classroom.name;summary.getRow(row).getCell(2).value=classroom.students.length;styleRange(summary,`A${row}:B${row}`,{size:14});
     groupStarts.forEach((start,si)=>{
       const sess=sessionFor(classroom,si);
       styleRange(summary,`${summary.getRow(row).getCell(start).address}:${summary.getRow(row).getCell(start+4).address}`,{size:13});
       if(!sess)return;const x=calcStats(classroom.students.map(st=>({...st,...(sess.entries?.[st.id]||{})}))),passRate=x.rate/100;
        summary.getRow(row).getCell(start).value=sess.robot||'-';summary.getRow(row).getCell(start+1).value=exportExam(sess).replace(/\s+(?=\d)/g,'');summary.getRow(row).getCell(start+2).value=passRate;summary.getRow(row).getCell(start+2).numFmt='0.00%';summary.getRow(row).getCell(start+3).value=x.rate>=60?'ผ่าน':'ไม่ผ่าน';summary.getRow(row).getCell(start+4).value=sess.trainer||'-';
     });
    });
    const totalRow=7+targetSchool.classrooms.length;summary.getRow(totalRow).getCell(1).value='รวม';summary.getRow(totalRow).getCell(2).value=targetSchool.classrooms.reduce((sum,c)=>sum+c.students.length,0);styleRange(summary,`A${totalRow}:V${totalRow}`,{bold:true,size:14});
    outlineRange(summary,4,1,totalRow,2);groupStarts.forEach(start=>outlineRange(summary,4,start,totalRow,start+4));
    summary.getColumn(1).width=12;summary.getColumn(2).width=10;for(let c=3;c<=22;c++)summary.getColumn(c).width=c%5===0?18:14;
    if(imageId!==null)summary.addImage(imageId,{tl:{col:17,row:.15},ext:{width:210,height:74}});

    return workbook;
  };

  const exportExcel=async()=>{
    if(readOnly){flash('บัญชีดูอย่างเดียวไม่สามารถส่งออก Excel ได้');return}
    if(!school)return;
   try{
    flash('กำลังเตรียมไฟล์ Excel...');
    const workbook = await generateExcelWorkbook(school);
    const buffer=await workbook.xlsx.writeBuffer();
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=`คะแนนทดสอบ_${school.name}_${new Date().toISOString().slice(0,10)}.xlsx`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);flash('ส่งออก Excel เรียบร้อยแล้ว');
   }catch(error){console.error('Excel export failed',error);flash(`ส่งออก Excel ไม่สำเร็จ: ${error.message||'โปรดลองอีกครั้ง'}`);}
  };

  const exportAllExcelZip = async () => {
    if(readOnly){flash('บัญชีดูอย่างเดียวไม่สามารถส่งออกข้อมูลได้');return}
    if(!schools || schools.length === 0) return;
    try {
      flash('กำลังดึงข้อมูลทุกโรงเรียนและสร้างไฟล์ (อาจใช้เวลาสักครู่)...');
      setCloudStatus('saving');
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      
      for(const s of schools) {
        const fullSchool = await loadSchoolDetail(s.id);
        const workbook = await generateExcelWorkbook(fullSchool);
        const buffer = await workbook.xlsx.writeBuffer();
        zip.file(`คะแนนทดสอบ_${fullSchool.name}_${new Date().toISOString().slice(0,10)}.xlsx`, buffer);
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Backup_All_Schools_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1000);
      flash('สำรองข้อมูลทุกโรงเรียนสำเร็จแล้ว!');
      setCloudStatus('saved');
    } catch(err) {
      console.error(err);
      flash('สำรองข้อมูลไม่สำเร็จ: ' + err.message);
      setCloudStatus('error');
    }
  };

 const exportScoreTablePDF=async(mode='download',overrides={})=>{
 if(readOnly){flash('บัญชีดูอย่างเดียวไม่สามารถสร้าง PDF ได้');return}
 if(!school)return;
  const duplicateSessionGroups=Array.from((school.sessions||[]).filter(item=>item.classId).reduce((groups,item)=>{
   const key=`${item.classId}:${sessionTestNumber(item.test)}`;
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(item);
   return groups;
  },new Map()).values()).filter(group=>group.length>1);
  if(duplicateSessionGroups.length){
   const duplicateSummary=duplicateSessionGroups.map(group=>{
    const classroomName=school.classrooms.find(item=>item.id===group[0].classId)?.name||'ไม่ทราบห้อง';
    return `${classroomName} · ครั้งที่ ${sessionTestNumber(group[0].test)} (${group.length} รายการ)`;
   }).join(', ');
   await themeSwal.fire({
    icon:'warning',
    title:'พบเลขครั้งทดสอบซ้ำ',
    text:`${duplicateSummary} กรุณาแก้เลขครั้งในหน้าบันทึกผลทดสอบก่อนสร้าง PDF เพื่อป้องกันการแสดงข้อมูลผิดช่อง`,
    confirmButtonText:'รับทราบ'
   });
   return;
  }
 flash('กำลังเตรียม PDF ตารางคะแนน...');
  const [pdfModule,autoTableModule,{logoBase64},{fontBase64}]=await Promise.all([
   import('jspdf'),
   import('jspdf-autotable'),
   import('./assets/logoBase64'),
   import('./assets/fontBase64')
  ]);
  const jsPDF=pdfModule.jsPDF||pdfModule.default;
  const autoTable=autoTableModule.default||autoTableModule.autoTable;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
   doc.addFileToVFS('THSarabun.ttf',fontBase64);
   doc.addFont('THSarabun.ttf','THSarabun','normal');
   doc.addFont('THSarabun.ttf','THSarabun','bold');
   const layout=overrides.layout||{};
   const pdfScale=(Number(pdfSettings.scale)||1)*(Number(layout.fontScale)||1);
   const pdfFontSize=size=>Math.round(size*pdfScale*10)/10;
   const isVisible=key=>layout[key]!==false;
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
   const processed=lines.map(splitThaiMarks),cleanLines=processed.map(line=>line.clean);
   const result=originalDocText(Array.isArray(text)?cleanLines:cleanLines[0],x,y,drawOptions,...rest);
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

  const pageWidth=doc.internal.pageSize.getWidth();
  const rawSchoolName=String(overrides.schoolName??school.name??'').trim();
  const fileSchoolName=/^โรงเรียน/.test(rawSchoolName)?rawSchoolName:`โรงเรียน${rawSchoolName}`;
  const sessionTerms=[...new Set((school.sessions||[]).map(s=>String(s.term||'').trim()).filter(Boolean))]
   .sort((a,b)=>Number(a)-Number(b)||a.localeCompare(b,'th'));
  const hasSecondOrLater=(school.sessions||[]).some(s=>sessionHasRecordedResult(s)&&sessionTestNumber(s.test)>=2);
  let defaultTerm=sessionTerms.length>1?`${sessionTerms[0]}-${sessionTerms.at(-1)}`:sessionTerms[0]||String(school.term||'').trim();
  if(hasSecondOrLater&&defaultTerm==='1')defaultTerm='1-2';
  const term=String(overrides.term??defaultTerm).trim()||defaultTerm;
  const year=String(overrides.year??school.year??'').trim();
  const sessionColors=[[141,179,226],[230,184,183],[196,216,160],[196,183,215]];
  const softGreen=[234,241,222],softOrange=[252,228,214],softCream=[252,244,235],lineColor=[0,0,0];
  const monthNames=['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const dateParts=value=>String(value||'').slice(0,10).split('-').map(Number);
  const thaiDate=value=>{const [y,m,d]=dateParts(value);return y&&m&&d?`${d}/${m}/${y+543}`:''};
  const thaiDateLong=value=>{const [y,m,d]=dateParts(value);return y&&m&&d?`${String(d).padStart(2,'0')} ${monthNames[m]} ${y+543}`:''};
   const dateRange=(start,end)=>end&&end!==start?`${thaiDate(start)}-${thaiDate(end)}`:thaiDate(start);
  const orderedClassrooms=[...(school.classrooms||[])].sort((a,b)=>compareClassNames(a.name,b.name));
  const orderedSessions=classroom=>[...(school.sessions||[])]
   .filter(s=>s.classId===classroom.id)
   .sort((a,b)=>sessionTestNumber(a.test)-sessionTestNumber(b.test)||String(a.test).localeCompare(String(b.test),'th'));
   const sessionAt=(classroom,index)=>{
    const session=orderedSessions(classroom).find(item=>sessionTestNumber(item.test)===index+1);
    return sessionHasRecordedResult(session)?session:null;
   };
   const examName=sess=>sess?.exam||defaultExamForRobot(sess?.robot);
   const compactExam=sess=>examName(sess).replace(/\s+(?=\d)/g,' ');
  const sessionStats=(classroom,sess)=>{
   if(!sess)return {avg:0,rate:0,absent:0,below:0,assessment:'ไม่ผ่าน'};
   const entries=sess.entries||{};
   const students=classroom.students.filter(st=>st.active!==false||entries[st.id]).map(st=>({...st,...(entries[st.id]||{})}));
   const stats=calcStats(students),scored=students.filter(st=>!st.absent&&st.score!==''&&st.score!=null&&Number.isFinite(Number(st.score)));
   const below=scored.filter(st=>Number(st.score)<35).length;
   return {avg:stats.avg,rate:stats.rate,absent:stats.absent,below,assessment:stats.rate>=60?'ผ่าน':'ไม่ผ่าน'};
  };
   const addHeader=(classroomName='')=>{
    doc.setTextColor(0,0,0);
    doc.setFont('THSarabun','bold');
    const reportTitle='ผลการทดสอบและประเมินผลการเรียน School Robotics';
     doc.setFontSize(pdfFontSize(15));
    const reportTitleLeft=pageWidth/2-doc.getTextWidth(reportTitle)/2;
    const schoolNameMaxWidth=Math.max(40,reportTitleLeft-13-8);
    let schoolNameFontSize=13;
    doc.setFontSize(pdfFontSize(schoolNameFontSize));
    while(schoolNameFontSize>7&&doc.getTextWidth(fileSchoolName)>schoolNameMaxWidth){
     schoolNameFontSize-=.5;
     doc.setFontSize(pdfFontSize(schoolNameFontSize));
    }
    if(isVisible('schoolName'))doc.text(fileSchoolName,13,16);
    doc.setFontSize(pdfFontSize(13));
    if(classroomName)doc.text(`ชั้น ${classroomName}`,13,23);
    doc.setFontSize(pdfFontSize(15));
    if(isVisible('reportTitle'))doc.text(reportTitle,pageWidth/2,16,{align:'center'});
   doc.setFontSize(pdfFontSize(13));
   if(isVisible('curriculum'))doc.text('หลักสูตร School Robotics',pageWidth/2,25,{align:'center'});
   if(isVisible('termYear'))doc.text(`ภาคเรียนที่ ${term} ปีการศึกษา ${year}`,pageWidth/2,35,{align:'center'});
   if(logoBase64&&isVisible('logo'))doc.addImage(logoBase64,'PNG',234,13,50,50/BRAND_LOGO_ASPECT_RATIO,undefined,'FAST');
  };
  const addSummaryHeader=()=>{
   doc.setTextColor(0,0,0);
   doc.setFont('THSarabun','bold');
    doc.setFontSize(pdfFontSize(16));
   doc.text(fileSchoolName,pageWidth/2,18,{align:'center'});
    doc.setFontSize(pdfFontSize(13));
   doc.text('หลักสูตร School Robotics',pageWidth/2,28,{align:'center'});
   doc.text(`ภาคเรียนที่ ${term} ปีการศึกษา ${year}`,pageWidth/2,39,{align:'center'});
   if(logoBase64)doc.addImage(logoBase64,'PNG',226,17,52,52/BRAND_LOGO_ASPECT_RATIO,undefined,'FAST');
  };

  orderedClassrooms.forEach((classroom,classIndex)=>{
   if(classIndex>0)doc.addPage();
   addHeader(classroom.name);
   const roomSessions=Array.from({length:4},(_,index)=>sessionAt(classroom,index));
   const students=classroom.students.filter(st=>st.active!==false||roomSessions.some(sess=>sess?.entries?.[st.id]));
   const rankMaps=roomSessions.map(sess=>sess?calcRanks(students.map(st=>({...st,...(sess.entries?.[st.id]||{})}))):{});
    const head=[
    [{content:'เลขที่',rowSpan:6,styles:{fillColor:softGreen}}, {content:'ชื่อ-สกุล',rowSpan:6,styles:{fillColor:softGreen}}, {content:'คะแนนสอบ/ครั้งที่',colSpan:12,styles:{fillColor:softGreen}}],
    roomSessions.flatMap((sess,index)=>[{content:sess?.test||`ครั้งที่ ${index+1}`,colSpan:3,styles:{fillColor:softGreen}}]),
    roomSessions.flatMap(sess=>[{content:sess?dateRange(sess.date,sess.endDate):'',colSpan:3}]),
    roomSessions.flatMap(sess=>[{content:sess?.robot||'',colSpan:3}]),
     roomSessions.flatMap(sess=>[{content:sess?compactExam(sess):'',colSpan:3}]),
    roomSessions.flatMap(()=>['ลำดับ','คะแนน (50)','เวลา'])
   ];
   const body=students.map(student=>{
    const row=[student.no||'',student.name||''];
    roomSessions.forEach((sess,index)=>{
     if(!sess){row.push('','','');return;}
     const entry=sess.entries?.[student.id]||{},score=entry.absent?'x':entry.score===''||entry.score==null?'':Number(entry.score);
     row.push(entry.absent?'':rankMaps[index][student.id]||'',score,entry.absent?'':entry.time||'');
    });
    return row;
   });
   autoTable(doc,{
    startY:41,
    margin:{left:8,right:66},
    tableWidth:222,
    theme:'grid',
    head,
    body,
     styles:{font:'THSarabun',fontSize:pdfFontSize(7.5),cellPadding:.35,lineWidth:.16,lineColor,textColor:[0,0,0],halign:'center',valign:'middle',overflow:'ellipsize'},
     headStyles:{font:'THSarabun',fontStyle:'bold',fontSize:pdfFontSize(7.2),cellPadding:.25,fillColor:softGreen,textColor:[0,0,0],minCellHeight:4.2},
    bodyStyles:{minCellHeight:4.25},
    columnStyles:{
      0:{cellWidth:8},1:{cellWidth:62,halign:'left',fontSize:pdfFontSize(8)},
     2:{cellWidth:8,fillColor:softCream},3:{cellWidth:14},4:{cellWidth:12},
     5:{cellWidth:8,fillColor:softCream},6:{cellWidth:14},7:{cellWidth:12},
     8:{cellWidth:8,fillColor:softCream},9:{cellWidth:14},10:{cellWidth:12},
     11:{cellWidth:8,fillColor:softCream},12:{cellWidth:14},13:{cellWidth:12}
    },
     didParseCell:data=>{
      if(data.section==='head'&&data.row.index===5&&[3,6,9,12].includes(data.column.index)){
        data.cell.styles.fontSize=pdfFontSize(6.2);
       data.cell.styles.overflow='linebreak';
      }
      if(data.section==='body'&&students[data.row.index]?.active===false){
       data.cell.styles.fillColor=[255,0,0];
       data.cell.styles.textColor=[255,255,255];
      }
    }
   });
   const summaryRows=roomSessions.map((sess,index)=>{
    if(!sess)return [`ครั้งที่ ${index+1}`,'','','','',''];
    const stats=sessionStats(classroom,sess);
    return [sess.test,stats.avg?stats.avg.toFixed(2):'0.00',`${stats.rate.toFixed(2)}%`,stats.below,stats.absent,stats.assessment];
   });
   autoTable(doc,{
    startY:41,
    margin:{left:235,right:8},
    tableWidth:54,
    theme:'grid',
    head:[[{content:'สรุปผลคะแนนการทดสอบ',colSpan:6}],['ครั้งที่','คะแนนเฉลี่ย','% ผ่าน','ต่ำกว่า 35','ขาดสอบ','ประเมิน']],
    body:summaryRows,
     styles:{font:'THSarabun',fontSize:pdfFontSize(6.6),cellPadding:.4,lineWidth:.16,lineColor,textColor:[0,0,0],halign:'center',valign:'middle',overflow:'linebreak'},
     headStyles:{font:'THSarabun',fontStyle:'bold',fontSize:pdfFontSize(4.5),fillColor:softGreen,textColor:[0,0,0]},
    columnStyles:{0:{cellWidth:9},1:{cellWidth:10},2:{cellWidth:10},3:{cellWidth:9},4:{cellWidth:8},5:{cellWidth:8}}
   });
   doc.setFont('THSarabun','bold');
   doc.setFontSize(pdfFontSize(8));
   doc.text('หมายเหตุ',235,92);
   doc.setFont('THSarabun','normal');
   doc.text('0 คือนักเรียนที่ทำข้อสอบไม่ได้เลย',252,92);
   doc.text('X คือนักเรียนที่ไม่ได้เข้าสอบ',252,99);
   doc.text('35 คะแนนขึ้นไป ผ่านเกณฑ์',252,106);
  });

  for(let startIndex=0;startIndex<4;startIndex+=2){
   doc.addPage();
   addSummaryHeader();
   const groupIndexes=[startIndex,startIndex+1];
   const head=[
    [{content:'ชั้น',rowSpan:3,styles:{fillColor:softOrange}}, {content:'จำนวน',rowSpan:3,styles:{fillColor:softOrange}}, ...groupIndexes.map(index=>({content:`ครั้งที่ ${index+1}`,colSpan:4,styles:{fillColor:sessionColors[index]}}))],
    groupIndexes.map(index=>{
     const sample=orderedClassrooms.map(c=>sessionAt(c,index)).find(Boolean);
     return {content:sample?`วันที่ ${thaiDateLong(sample.date)}`:'วันที่',colSpan:4,styles:{fillColor:sessionColors[index]}};
    }),
    groupIndexes.flatMap(()=>['หุ่นยนต์','แบบทดสอบ','% ผู้ที่ผ่านเกณฑ์','ประเมิน'])
   ];
   const body=orderedClassrooms.map(classroom=>{
    const row=[classroom.name,classroom.students.length];
    groupIndexes.forEach(index=>{
     const sess=sessionAt(classroom,index),stats=sessionStats(classroom,sess);
      row.push(sess?.robot||'',sess?compactExam(sess):'',sess?`${stats.rate.toFixed(2).replace(/\.00$/,'')}%`:'',sess?stats.assessment:'');
    });
    return row;
   });
   const totalStudents=orderedClassrooms.reduce((sum,c)=>sum+c.students.length,0);
   body.push(['รวม',totalStudents,'','','','',...Array(groupIndexes.length===2?4:0).fill('')]);
   autoTable(doc,{
    startY:48,
    margin:{left:8,right:18},
    tableWidth:246,
    theme:'grid',
    head,
    body,
    styles:{font:'THSarabun',fontSize:pdfFontSize(10),cellPadding:1.8,lineWidth:.22,lineColor,textColor:[0,0,0],halign:'center',valign:'middle'},
    headStyles:{font:'THSarabun',fontStyle:'bold',fontSize:pdfFontSize(10),fillColor:softGreen,textColor:[0,0,0],minCellHeight:8},
    bodyStyles:{minCellHeight:9},
    columnStyles:{0:{cellWidth:18,fontStyle:'bold'},1:{cellWidth:18},2:{cellWidth:32},3:{cellWidth:32},4:{cellWidth:32},5:{cellWidth:25},6:{cellWidth:32},7:{cellWidth:32},8:{cellWidth:32},9:{cellWidth:25}},
    didParseCell:data=>{
     if(data.section==='body'&&data.row.index===body.length-1)data.cell.styles.fontStyle='bold';
    }
   });
  }

  const filename=`ตารางคะแนนทดสอบ ${fileSchoolName}.pdf`;
  if(mode==='preview'){
   const url=URL.createObjectURL(doc.output('blob'));
   flash('สร้างตัวอย่าง PDF ตารางคะแนนเรียบร้อยแล้ว');
   return {url,filename};
  }
  doc.save(filename);
 };

 const exportPDF=async(mode='download',overrides={})=>{
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
   const layout=overrides.layout||{};
   const pdfScale=(Number(pdfSettings.scale)||1)*(Number(layout.fontScale)||1);
   const pdfFontSize=size=>Math.round(size*pdfScale*10)/10;
   const isVisible=key=>layout[key]!==false;
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

  const rawSchoolName=String(overrides.schoolName??school.name??'').trim();
  const term=String(overrides.term??school.term??'2').trim()||'2';
  const year=String(overrides.year??school.year??'2568').trim()||'2568';
  const displaySchoolName=rawSchoolName.replace(/^โรงเรียน\s*/,'').trim();
  const fileSchoolName=/^โรงเรียน/.test(rawSchoolName)?rawSchoolName:`โรงเรียน${rawSchoolName}`;
  const testNumber=(session?.test||'').match(/\d+/)?.[0]||'1';
  const thaiWordSegmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('th',{granularity:'word'}):null;
  const graphemeSegmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('th',{granularity:'grapheme'}):null;
  const wrapPdfText=(value,maxWidth,fontSize,fontStyle='normal')=>{
   doc.setFont('THSarabun',fontStyle);
   doc.setFontSize(pdfFontSize(fontSize));
   return String(value??'').split(/\r\n|\r|\n/).map(line=>{
    const segments=thaiWordSegmenter?Array.from(thaiWordSegmenter.segment(line),part=>part.segment):Array.from(line);
    const lines=[];let current='';
    const appendPart=part=>{
     const next=current+part;
     if(current&&doc.getTextWidth(next)>maxWidth){lines.push(current);current=part}else current=next;
    };
    segments.forEach(segment=>{
     const parts=doc.getTextWidth(segment)>maxWidth
      ?(graphemeSegmenter?Array.from(graphemeSegmenter.segment(segment),part=>part.segment):Array.from(segment))
      :[segment];
     parts.forEach(appendPart);
    });
    if(current||!lines.length)lines.push(current);
    return lines.join('\n');
   }).join('\n');
  };
  const wrapEvaluatorText=(value,maxWidth,fontSize,fontStyle='normal')=>{
   doc.setFont('THSarabun',fontStyle);
   doc.setFontSize(pdfFontSize(fontSize));
   return String(value??'').split(/\r\n|\r|\n/).map(line=>{
    const units=line.match(/[^,]*,|[^,]+/g)||[''];
    const lines=[];let current='';
    units.forEach(unit=>{
     const next=current+unit;
     if(current&&doc.getTextWidth(next)>maxWidth){lines.push(current);current=unit}else current=next;
    });
    if(current||!lines.length)lines.push(current);
    return lines.join('\n');
   }).join('\n');
  };
  const fitPdfText=(value,{maxWidth,maxFontSize,minFontSize,maxLines=Infinity,fontStyle='normal',wrap=wrapPdfText})=>{
   const minimum=Number(minFontSize),maximum=Number(maxFontSize);
   for(let fontSize=maximum;fontSize>=minimum;fontSize=Math.round((fontSize-.5)*10)/10){
    const text=wrap(value,maxWidth,fontSize,fontStyle);
    if(text.split('\n').length<=maxLines)return {text,fontSize:pdfFontSize(fontSize)};
   }
   return {text:wrap(value,maxWidth,minimum,fontStyle),fontSize:pdfFontSize(minimum)};
  };
  const formatThaiDate = (start, end) => {
   if(!start)return '-';
   const [y1,m1,d1]=String(start).slice(0,10).split('-').map(Number);
   const t1 = y1&&m1&&d1?`${d1}/${m1}/${y1+543}`:'-';
    if(!end||end===start) return t1;
   const [y2,m2,d2]=String(end).slice(0,10).split('-').map(Number);
   const t2 = y2&&m2&&d2?`${d2}/${m2}/${y2+543}`:'-';
   return `${t1} - ${t2}`;
  };
  const sessionFor=c=>school.sessions.find(s=>s.classId===c.id&&s.test===session?.test)||school.sessions.filter(s=>s.classId===c.id).at(-1)||{};
  const reportExam=s=>s?.exam||defaultExamForRobot(s?.robot);

  // ตำแหน่งและสัดส่วนอ้างอิงจากไฟล์ตัวอย่างในโฟลเดอร์ excel
  const optimizedLogo=logoBase64?await optimizeLogo(logoBase64):null;
   if(optimizedLogo&&isVisible('logo'))doc.addImage(optimizedLogo,'JPEG',62.3,15,68.4,68.4/BRAND_LOGO_ASPECT_RATIO,undefined,'FAST');
  doc.setTextColor(0,0,0);
  doc.setFont('THSarabun','bold');
   doc.setFontSize(pdfFontSize(14));
  if(isVisible('reportTitle'))doc.text('การประเมินคุณภาพหลักสูตรหุ่นยนต์ SCHOOL ROBOTICS',105,49,{align:'center'});

  doc.setFontSize(pdfFontSize(14));
  if(isVisible('schoolName'))doc.text(`โรงเรียน : ${displaySchoolName}`,14.8,57);
  doc.setFont('THSarabun','bold');
  if(isVisible('reportTitle'))doc.text('สรุปผลสัมฤทธิ์และข้อเสนอแนะในการเรียนหุ่นยนต์ SCHOOL ROBOTICS',14.8,65.5);
  if(isVisible('termYear'))doc.text(`ประจำปี การศึกษา : ${term}/${year}`,14.8,74);
  doc.setFont('THSarabun','bold');
  doc.text(`จำนวนห้องเรียน : ${school.classrooms.length} ห้องเรียน`,14.8,82);
  doc.text(`ครั้งที่  :  ${testNumber}`,14.8,91.5);
  doc.text(`วันที่ : ${formatThaiDate(session?.date, session?.endDate)}`,14.8,101);

  const detailRows=school.classrooms.map(c=>{
   const sess=sessionFor(c),entries=sess.entries||{};
   const eligibleStudents=c.students.filter(st=>st.active!==false||entries[st.id]);
   const absent=eligibleStudents.filter(st=>entries[st.id]?.absent).length;
   const examName=reportExam(sess).replace(/\s+(?=\d)/g,' ');
   return [c.name,eligibleStudents.length,absent,sess.robot||'Code & Go',sess.teachingPeriod||'-',term,examName,sess.trainer||'-'];
  });
  const detailColumnWidths=[22,16,16,25,19,13,26,38.9];
  const detailColumnStyles=detailColumnWidths.reduce((styles,width,index)=>{
   styles[index]={cellWidth:width};
   if(index===7)styles[index].fontSize=pdfFontSize(11);
   return styles;
  },{});
  const detailColumnLayout={
   0:{maxFontSize:12,minFontSize:9.5,maxLines:1},
   3:{maxFontSize:12,minFontSize:10,maxLines:2},
   4:{maxFontSize:12,minFontSize:10,maxLines:2},
   6:{maxFontSize:12,minFontSize:10,maxLines:2},
   7:{maxFontSize:11,minFontSize:9.5,maxLines:3,wrap:wrapEvaluatorText}
  };
  const detailBody=detailRows.map(row=>row.map((value,columnIndex)=>{
   const layout=detailColumnLayout[columnIndex];
   if(!layout||typeof value!=='string')return value;
   const fitted=fitPdfText(value,{...layout,maxWidth:detailColumnWidths[columnIndex]-2.4});
   return {content:fitted.text,styles:{fontSize:fitted.fontSize}};
  }));

  if(isVisible('details')){
  doc.setFillColor(217,225,242);
  doc.setDrawColor(0,0,0);
  doc.setLineWidth(.3);
  doc.rect(14.3,109,175.9,8.5,'FD');
  doc.setFont('THSarabun','bold');
   doc.setFontSize(pdfFontSize(14));
  doc.text('รายละเอียดการทดสอบ',102.25,115,{align:'center'});

  autoTable(doc,{
   startY:117.5,
   margin:{left:14.3,right:19.8},
   tableWidth:175.9,
   theme:'grid',
   head:[['ระดับชั้น','จำนวน\nนักเรียน','ขาดสอบ','ชื่อหุ่นยนต์\n(Robot)','คาบสอน\nปัจจุบัน','เทอม','ชุดข้อสอบ','วิทยากร\nผู้ประเมิน']],
   body:detailBody,
   styles:{font:'THSarabun',fontSize:pdfFontSize(12),cellPadding:{top:1.8,right:1.2,bottom:1.8,left:1.2},halign:'center',valign:'middle',overflow:'linebreak',lineWidth:.3,lineColor:[0,0,0],textColor:[0,0,0],fillColor:[255,255,255]},
   headStyles:{font:'THSarabun',fontStyle:'bold',fontSize:pdfFontSize(11),cellPadding:.5,fillColor:[217,225,242],textColor:[0,0,0],minCellHeight:17},
   bodyStyles:{minCellHeight:9.5},
   columnStyles:detailColumnStyles,
   rowPageBreak:'avoid',
   showHead:'everyPage'
  });
  }

  const feedbackByClassroom=overrides.feedbackByClassroom||{};
  const feedbackRows=school.classrooms.flatMap(c=>{
   const sess=sessionFor(c);
   const defaultText=feedbackTextFromSession(sess);
   const text=Object.prototype.hasOwnProperty.call(feedbackByClassroom,c.id)?String(feedbackByClassroom[c.id]??''):defaultText;
   return text?[[c.name,text]]:[];
  });
  if(isVisible('feedback')&&feedbackRows.length){
  const feedbackTextMaxWidth=152.2;
  const fittedFeedbackRows=feedbackRows.map(([classroomName,text])=>{
   const fitted=fitPdfText(text,{maxWidth:feedbackTextMaxWidth,maxFontSize:12,minFontSize:10,maxLines:8});
   return {classroomName,text:fitted.text,fontSize:fitted.fontSize};
  });
  const wrappedFeedbackRows=fittedFeedbackRows.map(row=>[row.classroomName,{content:row.text,styles:{fontSize:row.fontSize}}]);
  doc.setFont('THSarabun','normal');
   doc.setFontSize(pdfFontSize(12));
  const feedbackLineHeight=fontSize=>fontSize/doc.internal.scaleFactor*(doc.getLineHeightFactor?.()||1.15);
  const firstFeedbackRow=fittedFeedbackRows[0];
  const firstFeedbackRowHeight=Math.max(1,firstFeedbackRow.text.split('\n').length)*feedbackLineHeight(firstFeedbackRow.fontSize)+4;
  const pageHeight=doc.internal.pageSize.getHeight(),summaryTitleGap=8,feedbackHeaderHeight=8.5,bottomSafe=40;
  let summaryTitleY=(doc.lastAutoTable?.finalY||109)+15;
  if(summaryTitleY+summaryTitleGap+feedbackHeaderHeight+firstFeedbackRowHeight>pageHeight-bottomSafe){doc.addPage();summaryTitleY=20;}
  doc.setFont('THSarabun','bold');
   doc.setFontSize(pdfFontSize(14));
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
   body:wrappedFeedbackRows,
   styles:{font:'THSarabun',fontSize:pdfFontSize(12),cellPadding:2,lineWidth:.3,lineColor:[0,0,0],textColor:[0,0,0],fillColor:[255,255,255],valign:'middle'},
   headStyles:{font:'THSarabun',fontStyle:'bold',fontSize:pdfFontSize(12),fillColor:[217,225,242],textColor:[0,0,0],halign:'center',minCellHeight:8.5},
   bodyStyles:{minCellHeight:8.5},
   columnStyles:{0:{cellWidth:19.7,halign:'center',fontStyle:'normal'},1:{cellWidth:156.2,halign:'left'}},
   rowPageBreak:'avoid',
   showHead:'everyPage'
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

 const buildPdfEditDraft=type=>{
  const feedbackRows=(school?.classrooms||[]).map(classroom=>{
   const matchingSessions=(school?.sessions||[]).filter(item=>item.classId===classroom.id);
   const selectedSession=matchingSessions.find(item=>item.test===session?.test)||matchingSessions.at(-1)||{};
   const text=feedbackTextFromSession(selectedSession);
   return {classroomId:classroom.id,classroomName:classroom.name,text};
  });
  return {type,schoolName:school?.name||'',term:school?.term||'',year:school?.year||'',layout:{schoolName:true,reportTitle:true,curriculum:true,termYear:true,logo:true,details:true,feedback:true,fontScale:1},feedbackRows};
 };
 const openPDFEditor=type=>{
  if(readOnly){flash('บัญชีดูอย่างเดียวไม่สามารถแก้ไขเอกสาร PDF ได้');return}
  if(!school){flash('กรุณาเลือกโรงเรียนก่อนสร้าง PDF');return}
  setPdfEditor(buildPdfEditDraft(type));
 };
 const pdfOverrides=draft=>({schoolName:draft.schoolName,term:draft.term,year:draft.year,...(draft.type==='summary'?{feedbackByClassroom:Object.fromEntries((draft.feedbackRows||[]).map(row=>[row.classroomId,row.text]))}:{})});
 const previewEditedPDF=async draft=>{
  try{
   const preview=draft.type==='score'?await exportScoreTablePDF('preview',pdfOverrides(draft)):await exportPDF('preview',pdfOverrides(draft));
   if(preview)setPdfPreview(preview);
  }catch(error){console.error('Edited PDF preview failed',error);flash(`สร้างตัวอย่าง PDF ไม่สำเร็จ: ${error.message||'โปรดลองอีกครั้ง'}`)}
 };
 const downloadEditedPDF=async draft=>{
  try{
   if(draft.type==='score')await exportScoreTablePDF('download',pdfOverrides(draft));
   else await exportPDF('download',pdfOverrides(draft));
  }catch(error){console.error('Edited PDF download failed',error);flash(`ดาวน์โหลด PDF ไม่สำเร็จ: ${error.message||'โปรดลองอีกครั้ง'}`);throw error}
 };
 const exportEditedWord=async draft=>{
  try{
   const {default:JSZip}=await import('jszip');
   const xmlEscape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
   const layout=draft.layout||{},visible=key=>layout[key]!==false;
   const run=(value,bold=false)=>String(value??'').split(/\r\n|\r|\n/).map((line,index)=>`${index?'<w:br/>':''}<w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:eastAsia="TH Sarabun New"/>${bold?'<w:b/>':''}<w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`).join('');
   const paragraph=(value='',bold=false,align='left')=>`<w:p><w:pPr><w:jc w:val="${align}"/></w:pPr>${run(value,bold)}</w:p>`;
   const cell=(value,header=false)=>`<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/>${header?'<w:shd w:fill="D9E1F2"/>':''}</w:tcPr>${paragraph(value,header,'center')}</w:tc>`;
   const table=rows=>`<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="6" w:color="000000"/><w:left w:val="single" w:sz="6" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:color="000000"/><w:right w:val="single" w:sz="6" w:color="000000"/><w:insideH w:val="single" w:sz="6" w:color="000000"/><w:insideV w:val="single" w:sz="6" w:color="000000"/></w:tblBorders></w:tblPr>${rows.map((row,rowIndex)=>`<w:tr>${row.map(value=>cell(value,rowIndex===0)).join('')}</w:tr>`).join('')}</w:tbl>`;
   const rawSchoolName=String(draft.schoolName||school?.name||'').trim(),term=String(draft.term??school?.term??'').trim(),year=String(draft.year??school?.year??'').trim();
   const fileSchoolName=/^โรงเรียน/.test(rawSchoolName)?rawSchoolName:`โรงเรียน${rawSchoolName}`;
   const body=[];
   if(visible('schoolName'))body.push(paragraph(fileSchoolName,true,'center'));
   if(visible('reportTitle'))body.push(paragraph(draft.type==='score'?'ผลการทดสอบและประเมินผลการเรียน School Robotics':'การประเมินคุณภาพหลักสูตรหุ่นยนต์ SCHOOL ROBOTICS',true,'center'));
   if(visible('curriculum'))body.push(paragraph('หลักสูตร School Robotics',false,'center'));
   if(visible('termYear'))body.push(paragraph(`ภาคเรียนที่ ${term} ปีการศึกษา ${year}`,false,'center'));
   if(draft.type==='summary'){
    const sessionFor=c=>(school?.sessions||[]).find(item=>item.classId===c.id&&item.test===session?.test)||(school?.sessions||[]).filter(item=>item.classId===c.id).at(-1)||{};
    if(visible('details')){
     body.push(paragraph('รายละเอียดการทดสอบ',true,'center'));
      const detailWordRows=[['ระดับชั้น','จำนวนนักเรียน','ขาดสอบ','ชื่อหุ่นยนต์','คาบสอนปัจจุบัน','เทอม','ชุดข้อสอบ','วิทยากรผู้ประเมิน'],...(school?.classrooms||[]).map(c=>{const sess=sessionFor(c),entries=sess.entries||{},eligible=c.students.filter(st=>st.active!==false||entries[st.id]);return [c.name,eligible.length,eligible.filter(st=>entries[st.id]?.absent).length,sess.robot||'Code & Go',sess.teachingPeriod||'-',term,sess.exam||'-',sess.trainer||'-']})];
      body.push(table(detailWordRows));
    }
    if(visible('feedback')){
     const feedbackRows=draft.feedbackRows||[];
     body.push(paragraph('สรุปและข้อเสนอแนะ',true,'center'));
     body.push(table([['ระดับชั้น','รายละเอียด'],...feedbackRows.filter(row=>String(row.text||'').trim()).map(row=>[row.classroomName,row.text])]));
    }
   }else{
    const number=value=>Number(String(value||'').match(/\d+/)?.[0])||0;
    const ordered=[...(school?.classrooms||[])].sort((a,b)=>String(a.name).localeCompare(String(b.name),'th'));
    ordered.forEach(classroom=>{
     body.push(paragraph(`ชั้น ${classroom.name}`,true,'left'));
     const sessions=[...(school?.sessions||[])].filter(item=>item.classId===classroom.id).sort((a,b)=>number(a.test)-number(b.test)).slice(0,4);
     const rows=[['เลขที่','ชื่อ-สกุล',...sessions.flatMap(item=>[`ครั้งที่ ${number(item.test)} คะแนน`,`ครั้งที่ ${number(item.test)} เวลา`])]];
     classroom.students.filter(st=>st.active!==false||sessions.some(item=>item.entries?.[st.id])).forEach(student=>rows.push([student.no||'',student.name||'',...sessions.flatMap(item=>{const entry=item.entries?.[student.id]||{};return [entry.absent?'x':entry.score??'',entry.absent?'':entry.time||'']})]));
     body.push(table(rows));
    });
   }
   const section= draft.type==='score'?'<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>':'<w:pgSz w:w="11906" w:h="16838"/>';
   const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/>${section}</w:sectPr></w:body></w:document>`;
   const zip=new JSZip();
   zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
   zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
   zip.file('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
   zip.file('word/document.xml',documentXml);
   zip.file('word/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:eastAsia="TH Sarabun New"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>');
   const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
   anchor.href=url;anchor.download=`${draft.type==='score'?'ตารางคะแนน':'สรุปและข้อเสนอแนะ'} -${fileSchoolName}.docx`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);flash('ส่งออก Word เรียบร้อยแล้ว');
  }catch(error){console.error('Word export failed',error);flash(`ส่งออก Word ไม่สำเร็จ: ${error.message||'โปรดลองอีกครั้ง'}`);throw error}
 };
 const openPDFPreview=async()=>{try{const preview=await exportPDF('preview');if(preview)setPdfPreview(preview)}catch(error){console.error('PDF preview failed',error);flash(`สร้างตัวอย่าง PDF ไม่สำเร็จ: ${error.message||'โปรดลองอีกครั้ง'}`)}};
 const openScoreTablePDFPreview=async()=>{try{const preview=await exportScoreTablePDF('preview');if(preview)setPdfPreview(preview)}catch(error){console.error('Score table PDF preview failed',error);flash(`สร้าง PDF ตารางคะแนนไม่สำเร็จ: ${error.message||'โปรดลองอีกครั้ง'}`)}};
 useEffect(()=>()=>{if(pdfPreview?.url)URL.revokeObjectURL(pdfPreview.url)},[pdfPreview?.url]);

  const removeSchool=async id=>{setConfirming({title:`ยืนยันการลบ ${school.name}`,message:'คุณแน่ใจหรือไม่? ข้อมูลทั้งหมดจะถูกลบทิ้ง',dangerLabel:'ลบโรงเรียน',onConfirm:async()=>{try{await deleteSchool(id);setSchools(all=>all.filter(s=>s.id!==id));setSchool(null);setClassroom(null);setSessionId(null);flash(`ลบโรงเรียน ${school.name} แล้ว`)}catch(e){console.error(e);flash(`ลบไม่สำเร็จ: ${e.message}`)}}})};
  const removeClassroom=id=>{setConfirming({title:'ยืนยันการลบชั้นเรียน',message:'ลบชั้นเรียนและข้อมูลทั้งหมด (รวมการทดสอบ)?',dangerLabel:'ลบ',onConfirm:async()=>{try{setCloudStatus('saving');await deleteClassroom(id);setSchools(all=>all.map(s=>s.id===school.id?{...s,classrooms:s.classrooms.filter(c=>c.id!==id),sessions:s.sessions.filter(x=>x.classId!==id)}:s));setClassroom(null);setSessionId(null);flash('ลบชั้นเรียนสำเร็จ');setCloudStatus('saved')}catch(e){console.error(e);setCloudStatus('error');flash(`ลบไม่สำเร็จ: ${e.message}`)}}})};

   return <>
    {path.startsWith('/admin') && profile.role === 'super_admin' ? 
    <div className={`app${readOnly?' viewer-mode':''}`}>
      <aside>
        <div className="brand"><img className="brand-logo" src={brandLogo} alt="School Robotics"/></div>
        <nav>
          <button className={tab==='admin'?'active':''} onClick={()=>navigateTab('admin')}><ShieldCheck/>จัดการผู้ใช้งาน</button>
          {isSuperOwner && <button className={tab==='trash'?'active':''} onClick={()=>navigateTab('trash')}><Trash2/>ถังขยะกู้คืน</button>}
        </nav>
        <div className="aside-foot" style={{flexDirection: 'column', gap: '12px'}}>
           <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
             <div className="avatar">{(user.user_metadata?.full_name||user.email||'U').slice(0,2)}</div>
             <div style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', display:'flex', flexDirection:'column'}}><b>{user.user_metadata?.full_name||user.email}</b><small>แอดมินระบบ</small></div>
           </div>
           <button className="button" style={{width:'100%', justifyContent:'center'}} onClick={()=>navigateTab('dashboard')}><ChevronLeft/> กลับหน้าผู้ใช้งาน</button>
           <button className="button danger-text" style={{width:'100%', justifyContent:'center'}} onClick={onSignOut} title="ออกจากระบบ"><LogOut/> ออกจากระบบ</button>
         </div>
      </aside>
      <main>
        <header>
          <div className="mobile-brand"><img src={brandLogo} alt="School Robotics"/></div>
          {tab==='admin'?<div className="context dashboard-header-label"><ShieldCheck/><div><small>แอดมินระบบ</small><b>จัดการผู้ใช้งาน</b></div></div>
          :<div className="context dashboard-header-label"><Trash2/><div><small>แอดมินระบบ</small><b>ถังขยะกู้คืน</b></div></div>}
          <span className={`cloud-state ${cloudStatus}`}>{cloudStatus==='saved'?<Cloud/>:<CloudOff/>}{cloudStatus==='loading'?'กำลังเชื่อมต่อ':cloudStatus==='saving'?'กำลังบันทึก':cloudStatus==='saved'?'บันทึกบนคลาวด์แล้ว':cloudStatus==='setup'?'รอสร้างฐานข้อมูล':'เชื่อมต่อไม่ได้'}</span>
          <button className="icon" onClick={()=>setDark(!dark)} aria-label="เปลี่ยนธีม">{dark?<Sun/>:<Moon/>}</button>
        </header>
        <section className="content">
          <Routes>
            <Route path="/admin/users" element={<AccessAdmin schools={schools} currentUserId={user.id} flash={flash}/>} />
            <Route path="/admin/trash" element={isSuperOwner ? <TrashAdmin flash={flash} setConfirming={setConfirming}/> : <Navigate to="/admin/users" />} />
            <Route path="*" element={<Navigate to="/admin/users" />} />
          </Routes>
        </section>
        <div className="bottom-nav">
          <button className={tab==='admin'?'active':''} onClick={()=>navigateTab('admin')}><ShieldCheck/><small>ผู้ใช้งาน</small></button>
          {isSuperOwner && <button className={tab==='trash'?'active':''} onClick={()=>navigateTab('trash')}><Trash2/><small>ถังขยะ</small></button>}
          <button onClick={()=>navigateTab('dashboard')}><ChevronLeft/><small>กลับ</small></button>
        </div>
      </main>
    </div>
    :
    <div className={`app${readOnly?' viewer-mode':''}`}>
     <aside><div className="brand"><img className="brand-logo" src={brandLogo} alt="School Robotics"/></div><nav>{tabs.map(([id,label,I])=><button className={tab===id?'active':''} onClick={()=>navigateTab(id)} key={id}><I/>{label}</button>)}</nav><div className="aside-foot"><div className="avatar">{(user.user_metadata?.full_name||user.email||'U').slice(0,2)}</div><div><b>{user.user_metadata?.full_name||user.email}</b><small>{profile.role==='super_admin'?'ผู้ดูแลระบบ':'ผู้ใช้งานระบบ'}</small></div>{profile.role==='super_admin'&&<button className="icon" onClick={()=>navigateTab('admin')} title="เข้าสู่โหมดแอดมินระบบ"><ShieldCheck/></button>}<button className="logout" onClick={onSignOut} title="ออกจากระบบ"><LogOut/></button></div></aside>
     <main><header>
      <div className="mobile-brand"><img src={brandLogo} alt="School Robotics"/></div>
      {tab==='dashboard'?<div className="context dashboard-header-label"><LayoutDashboard/><div><small>ภาพรวมระบบ</small><b>ผลการประเมิน</b></div></div>
      :tab==='onsite'?<div className="context dashboard-header-label"><MapPin/><div><small>ภารกิจ</small><b>จัดการงานหน้างาน</b></div></div>
      :tab==='stock'?<div className="context dashboard-header-label"><Warehouse/><div><small>Inventory</small><b>Stock อุปกรณ์</b></div></div>
       :tab==='scores'?<div className="context dashboard-header-label"><ClipboardPenLine/><div><small>การประเมินผล</small><b>บันทึกผลการทดสอบ</b></div></div>
       :tab==='score-status'?<div className="context dashboard-header-label"><ClipboardCheck/><div><small>การประเมินผล</small><b>ติดตามการกรอกคะแนน</b></div></div>
      :tab==='classroom'?<div className="context dashboard-header-label"><Users/><div><small>ข้อมูลพื้นฐาน</small><b>จัดการชั้นเรียน</b></div></div>
      :tab==='reports'?<div className="context dashboard-header-label"><FileText/><div><small>ส่งออกข้อมูล</small><b>รายงานผลการประเมิน</b></div></div>
      :tab==='dataprep'?<div className="context dashboard-header-label"><FileCog/><div><small>ระบบฐานข้อมูล</small><b>เตรียมข้อมูล</b></div></div>
      :<div className="context dynamic-context"><School className="context-school-icon"/><div className="context-group school-context"><small>โรงเรียน · {schools.length} แห่ง</small><Select value={school?.id||''} onChange={e=>selectSchool(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}{(s.year||s.term)?' ('+(s.term?'เทอม '+s.term:'')+(s.term&&s.year?' ':'')+(s.year?'ปี '+s.year:'')+')':''}</option>)}</Select></div><span className="context-arrow">›</span><div className="context-group class-context"><small>ระดับชั้น</small><Select value={classroom?.id||''} onChange={e=>selectClass(e.target.value)}>{(school?.classrooms||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></div></div>}
      <span className={`cloud-state ${cloudStatus}`}>{cloudStatus==='saved'?<Cloud/>:<CloudOff/>}{cloudStatus==='loading'?'กำลังเชื่อมต่อ':cloudStatus==='saving'?'กำลังบันทึก':cloudStatus==='saved'?'บันทึกบนคลาวด์แล้ว':cloudStatus==='setup'?'รอสร้างฐานข้อมูล':'เชื่อมต่อไม่ได้'}</span>
      <button className="icon" onClick={()=>setDark(!dark)} aria-label="เปลี่ยนธีม">{dark?<Sun/>:<Moon/>}</button>
     </header>
      {readOnly&&<div className="viewer-banner"><ShieldCheck/><span><b>โหมดดูอย่างเดียว</b> บัญชีนี้ดูข้อมูลได้ แต่ไม่สามารถแก้ไข สร้าง PDF หรือส่งออก Excel ได้</span></div>}
      <section className={`content${viewerLocked?' viewer-locked':''}`} onClickCapture={e=>{if(viewerLocked){e.preventDefault();e.stopPropagation()}}} onKeyDownCapture={e=>{if(viewerLocked)e.preventDefault()}}>
      {viewerLocked&&<div className="viewer-lock-overlay" title="บัญชีดูอย่างเดียว ไม่สามารถแก้ไขหรือส่งออกข้อมูลได้" aria-label="ไม่สามารถกดได้"/>}
       {contextLoading&&<div className="context-loading"><Clock3/><span><b>กำลังโหลดข้อมูลโรงเรียน</b><small>โหลดเฉพาะโรงเรียนที่เลือกเพื่อลดการใช้โควตา</small></span></div>}
       {contextLoadError&&!contextLoading&&<div className="context-load-error"><AlertCircle/><span><b>{contextLoadError}</b><small>กรุณาตรวจสอบการเชื่อมต่อ แล้วลองโหลดข้อมูลอีกครั้ง</small></span><button type="button" className="button" onClick={()=>contextRetryRef.current?contextRetryRef.current():window.location.reload()}><RotateCcw/>ลองใหม่</button></div>}
       <Routes>
         <Route path="/" element={<Dashboard stats={dashboardStats} classes={dashboardRows} school={school} schools={schools} offices={offices} onSelectSchool={selectSchoolNow}/>} />
         <Route path="/onsite" element={<OnsiteDashboard flash={flash} offices={offices} />} />
         <Route path="/evaluate" element={<EvaluateForm />} />
         <Route path="/stock" element={<StockPage schools={schools} offices={offices} user={user} profile={profile} flash={flash}/>} />
           <Route path="/scores" element={<ScorePage meta={scoreMeta} setMeta={setMeta} students={scoreStudents} update={update} move={move} refs={refs} feedback={scoreFeedback} setFeedback={setFeedback} stats={scoreStats} flash={flash} schools={schools} offices={offices} schoolId={schoolId||''} classId={classId||''} classrooms={scoreSchool?.classrooms||[]} onSelectSchool={selectSchool} onSelectClass={selectClass} onSearchStudents={searchStudentsInSchool} sessions={scoreClassSessions} sessionId={scoreSession?.id} onSelectSession={id=>guardNavigation(()=>setSessionId(id))} onAddSession={addSession} onEditSession={editSession} onDeleteSession={removeSession} onRefreshClassroom={refreshClassroom} isRefreshingRoom={roomRefreshing} onPreviewPDF={openPDFPreview} onPreviewScoreTablePDF={openScoreTablePDFPreview} onSave={flushChanges} onResetSession={resetCurrentSession} saveBlocked={scoreEntryBlocked} blockedBy={scoreSaveBlocked?.lockedBy||''} retryingSaveLock={retryingScoreLock} onRetrySaveLock={retryScoreSaveLock} onReloadAfterLock={()=>window.location.reload()} userProfiles={userProfiles} user={user}/>} />
          <Route path="/score-status" element={<ScoreStatus offices={offices}/>} />
          <Route path="/classroom" element={<Classroom {...{meta,setMeta,setStudents,importExcel,importBulkExcel,flash,offices,user,userProfiles,readOnly}} students={classroomStudents} schools={schools} school={school} classroom={classroom} onAddSchool={()=>setSchoolAdding(true)} onAddOffice={addOffice} onDeleteOffice={removeOffice} onSelectSchool={selectSchool} onSelectClass={selectClass} onDeleteSchool={id=>setConfirming({message:'ยืนยันการลบโรงเรียนนี้? ข้อมูลทั้งหมดจะถูกย้ายไปที่ถังขยะและจะไม่แสดงในหน้ารวม',onConfirm:async ()=>{try{setCloudStatus('saving');await deleteSchool(id);setSchools(all=>all.filter(s=>s.id!==id));const next=schools.find(s=>s.id!==id);if(next)selectSchoolAfter(next);else setSchoolId(null);flash('ลบโรงเรียนสำเร็จ (ย้ายไปถังขยะ)');setCloudStatus('saved')}catch(e){console.error(e);setCloudStatus('error');flash('ลบโรงเรียนไม่สำเร็จ')}}})} onDeleteClassroom={id=>setConfirming({title:'ยืนยันการลบชั้นเรียน',message:'คุณแน่ใจหรือไม่ว่าต้องการลบชั้นเรียนนี้? ข้อมูลนักเรียนและผลสอบทั้งหมดในชั้นเรียนนี้จะถูกลบทิ้งถาวร',dangerLabel:'ลบทิ้ง',onConfirm:async()=>{try{setCloudStatus('saving');await deleteClassroom(id);setSchools(all=>all.map(s=>s.id===school.id?{...s,classrooms:s.classrooms.filter(c=>c.id!==id),sessions:s.sessions.filter(x=>x.classId!==id)}:s));const nextClass=school.classrooms.find(c=>c.id!==id);if(nextClass)selectClassNow(nextClass.id);else{navigate('/');selectSchoolNow(school.id);}flash('ลบชั้นเรียนสำเร็จ');setCloudStatus('saved')}catch(e){console.error(e);setCloudStatus('error');flash(`ลบชั้นเรียนไม่สำเร็จ: ${e.message}`)}}})}/>} />
         <Route path="/debug" element={<DebugEvals />} />
          <Route path="/reports" element={<Reports {...{stats,exportExcel,exportAllExcelZip,exportPDF,exportScoreTablePDF}} onPreviewPDF={openPDFPreview} onPreviewScoreTablePDF={openScoreTablePDFPreview} schools={schools} schoolId={school?.id||''} onSelectSchool={selectSchool}/>} />
         <Route path="/dataprep" element={<DataPrep />} />
         <Route path="*" element={<Navigate to="/" />} />
       </Routes>
      </section>
      <div className="bottom-nav">
        {tabs.map(([id,label,I])=><button className={tab===id?'active':''} onClick={()=>navigateTab(id)} key={id}><I/><small>{label.split(' ')[0]}</small></button>)}
        {profile.role==='super_admin'&&<button onClick={()=>navigateTab('admin')}><ShieldCheck/><small>แอดมิน</small></button>}
      </div>
     </main>
    </div>
    }
  {toast&&<div className="toast"><CheckCircle2/>{toast}</div>}
  {confirming && <ConfirmModal {...confirming} onClose={()=>setConfirming(null)}/>} 
  {schoolAdding && <AddSchoolModal onClose={()=>setSchoolAdding(false)} onAdd={addSchool} offices={offices} onAddOffice={addOffice}/>}
  {pendingImport&&<ImportOfficeModal school={pendingImport} schools={schools} offices={offices} onAddOffice={addOffice} onClose={()=>setPendingImport(null)} onConfirm={async imported=>{const ready={...imported,loaded:true};try{setCloudStatus('saving');await saveSchoolBundle(ready,user.id);setSchools(v=>v.some(x=>x.id===ready.id)?v.map(x=>x.id===ready.id?ready:x):[...v,ready]);setPendingImport(null);selectSchoolAfter(ready);setCloudStatus('saved');flash(`นำเข้าสำเร็จ: ${ready.classrooms.length} ห้อง`)}catch(error){console.error(error);setCloudStatus('error');flash(`นำเข้าไม่สำเร็จ: ${error.message}`)}}}/>}
  {pdfPreview&&<PDFPreviewModal preview={pdfPreview} onClose={()=>setPdfPreview(null)}/>}
 </>
}

function Root(){
  const [session,setSession]=useState(undefined);
  const [profile,setProfile]=useState(undefined);
  const location = useLocation();

  useEffect(()=>{
    if(!supabase){setSession(null);return}
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return()=>data.subscription.unsubscribe()
  },[]);
  useEffect(()=>{
    if(session?.user){
      loadCurrentProfile(session.user).then(setProfile).catch(()=>setProfile(null));
    }else if(session===null){
      setProfile(null);
    }
  },[session]);

  if(location.pathname === '/search') return <Suspense fallback={pageLoading}><PublicSearch /></Suspense>;
  if(location.pathname === '/exam_test') return <Suspense fallback={pageLoading}><ExamTest /></Suspense>;
  if(location.pathname === '/request') return <Suspense fallback={pageLoading}><TeacherForm /></Suspense>;
  
  if(!isSupabaseConfigured)return <div className="boot-screen">ยังไม่ได้ตั้งค่า Supabase</div>;
  if(session===undefined||(session&&profile===undefined))return <div className="boot-screen"><Bot/>กำลังเชื่อมต่อระบบ…</div>;
  if(!session)return <Suspense fallback={pageLoading}><AuthPage/></Suspense>;
  if(profile?.role==='pending')return <Suspense fallback={pageLoading}><PendingAccess user={session.user} onSignOut={()=>{localStorage.clear();supabase.auth.signOut()}} onRefresh={()=>window.location.reload()}/></Suspense>;
  return <Suspense fallback={pageLoading}><App user={session.user} profile={profile||{}} onSignOut={()=>{localStorage.clear();supabase.auth.signOut()}}/></Suspense>
}

export default Root;
