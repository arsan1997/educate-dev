import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw, Trash2, Loader2, Calculator} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES,defaultExamForRobot,examOptionsForRobot,normalizeExamSet} from '../model';
import {supabase,isSupabaseConfigured} from '../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice,loadEvaluationForSessionSync,parseExamFromAcademicTerm,acquireLock,releaseLock,keepLockAlive} from '../dataService';
import brandLogo from '../assets/logo.png';
import Field from '../components/ui/Field';
import Select from '../components/ui/Select';
import ThaiDateInput from '../components/ui/ThaiDateInput';
import Swal from 'sweetalert2';

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

const makeMissionRows=()=>Array.from({length:5},()=>({value:'',mode:'time'}));
const sessionNumber=value=>Number(String(value||'').match(/\d+/)?.[0])||0;
const sessionResultCount=session=>Object.values(session?.entries||{}).filter(entry=>entry?.absent||entry?.is_special||entry?.score!==''&&entry?.score!=null||entry?.time).length;
const sessionDateLabel=value=>{
  const [year,month,day]=String(value||'').slice(0,10).split('-').map(Number);
  return year&&month&&day?`${day}/${month}/${year+543}`:'ไม่ระบุวันที่';
};
const parseMissionSeconds=value=>{
  const text=String(value||'').trim();
  if(!text)return 150;
  if(/^\d{1,2}$/.test(text))return Number(text);
  if(/^\d{3,4}$/.test(text)){
    const minutes=Number(text.slice(0,-2)),seconds=Number(text.slice(-2));
    return minutes*60+seconds;
  }
  const parts=text.split(/[:.]/);
  if(parts.length===2){
    const minutes=Number(parts[0]),seconds=Number(parts[1]);
    if(Number.isFinite(minutes)&&Number.isFinite(seconds)&&minutes>=0&&seconds>=0)return minutes*60+seconds;
    return Number.NaN;
  }
  const seconds=Number(text);
  return Number.isFinite(seconds)&&seconds>=0?seconds:Number.NaN;
};
const formatTotalTime=totalSeconds=>{
  const minutes=Math.floor(totalSeconds/60),seconds=totalSeconds%60;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
};
const scoreMission=(seconds,mode)=>{
  if(mode==='dnf')return 0;
  if(mode==='add5')return 5;
  if(seconds<=120)return 10;
  return Math.max(0,10-Math.ceil((seconds-120)/10));
};
const summarizeMissions=rows=>{
  let totalSeconds=0,totalScore=0,invalid=false;
  const missions=rows.map(row=>{
    if(row.mode==='time'&&!String(row.value||'').trim()){
      return {...row,seconds:0,score:0};
    }
    const seconds=parseMissionSeconds(row.value);
    if(!Number.isFinite(seconds)){
      invalid=true;
      return {...row,seconds:0,score:0};
    }
    const score=scoreMission(seconds,row.mode);
    totalSeconds+=seconds;
    totalScore+=score;
    return {...row,seconds,score};
  });
  return {missions,totalSeconds,totalScore,time:formatTotalTime(totalSeconds),invalid};
};

function ScorePage({meta,setMeta,students,update,move,refs,feedback,setFeedback,stats,flash,schools,offices,schoolId,classId,classrooms,onSelectSchool,onSelectClass,sessions,sessionId,onSelectSession,onAddSession,onEditSession,onDeleteSession,onRefreshClassroom,isRefreshingRoom,onPreviewPDF,onPreviewScoreTablePDF,onSave,onResetSession,saveBlocked=false,blockedBy='',retryingSaveLock=false,onRetrySaveLock,onReloadAfterLock,userProfiles,user}){
  const [search,setSearch]=useState('');
  const [studentRoomSearch,setStudentRoomSearch]=useState('');
  const [statusFilter, setStatusFilter]=useState('all');
  const [isSyncing, setIsSyncing]=useState(false);
  const [filterOfficeId, setFilterOfficeId] = useState('');
  const [calculatorStudent,setCalculatorStudent]=useState(null);
  const [missionRows,setMissionRows]=useState(makeMissionRows);
  const missionRefs=useRef({});
  
  // Locking state
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const editingBlocked=isLocked||saveBlocked;
  
  const set=(k,v)=>setMeta({...meta,[k]:v}),examOptions=examOptionsForRobot(meta.robot),normalizedExam=normalizeExamSet(meta.exam,1,meta.robot);
  const selectedSchoolName=schools.find(item=>String(item.id)===String(schoolId))?.name||'';
  const studentRoomMatches=useMemo(()=>{
    const keyword=studentRoomSearch.trim().toLocaleLowerCase();
    if(!schoolId||keyword.length<2)return [];
    return classrooms.flatMap(room=>room.students
      .filter(student=>student.active!==false&&String(student.name||'').toLocaleLowerCase().includes(keyword))
      .map(student=>({student,classroomId:room.id,classroomName:room.name})))
      .slice(0,8);
  },[classrooms,schoolId,studentRoomSearch]);
  useEffect(()=>setStudentRoomSearch(''),[schoolId,classId]);
  const hasRecordedResult = students.some(s=>s.absent||s.is_special||s.score!==''&&s.score!=null||s.time);
  const sessionMetadataIsBlank=Boolean(sessionId)&&!hasRecordedResult&&!meta.date&&!meta.endDate&&!meta.robot&&!meta.exam&&!meta.teachingPeriod&&!meta.trainer&&!meta.sessionTerm&&!meta.sessionYear&&!feedback?.detail&&!feedback?.summary;
  const shouldPreserveExistingExam=sessionId&&meta.exam&&!examOptions.includes(normalizedExam);
  const expectedExam=sessionMetadataIsBlank?'':(examOptions.includes(normalizedExam)||shouldPreserveExistingExam?normalizedExam:defaultExamForRobot(meta.robot));
  const displayExamOptions=shouldPreserveExistingExam?[normalizedExam,...examOptions]:examOptions;
  const duplicateSessionGroups=useMemo(()=>{
    const groups=new Map();
    (sessions||[]).forEach(item=>{
      const number=sessionNumber(item.test),key=String(number);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(item);
    });
    return [...groups.values()].filter(group=>group.length>1);
  },[sessions]);
  const sessionOptionLabel=session=>{
    const group=duplicateSessionGroups.find(items=>items.some(item=>item.id===session.id));
    if(!group)return session.test;
    const itemNumber=group.findIndex(item=>item.id===session.id)+1;
    return `${session.test} · รายการที่ ${itemNumber} · ${sessionDateLabel(session.date)} · ${session.exam||'ไม่ระบุชุดข้อสอบ'} · ผลสอบ ${sessionResultCount(session)}`;
  };
  useEffect(()=>{if(sessionId&&!sessionMetadataIsBlank&&meta.exam!==expectedExam)setMeta({...meta,exam:expectedExam})},[sessionId,meta.exam,expectedExam,sessionMetadataIsBlank]);

  // Lock acquisition effect
  useEffect(() => {
    if (!classId || !user?.id) return;
    
    let isCancelled = false;
    let heartbeatInterval = null;
    
    const tryLock = async () => {
      const userName = userProfiles[user.id]?.full_name || user.email || 'แอดมิน';
      const result = await acquireLock(classId, user.id, userName);
      
      if (isCancelled) return;

      if (result.success) {
        setIsLocked(false);
        setLockMessage('');
        heartbeatInterval = setInterval(() => {
          keepLockAlive(classId, user.id).catch(console.error);
        }, 60000); // Heartbeat every 1 min
      } else {
        setIsLocked(true);
        setLockMessage(`ห้องเรียนนี้กำลังถูกแก้ไขโดย: ${result.lockedBy}`);
        themeSwal.fire({
          icon: 'warning',
          iconColor: 'var(--orange)',
          title: 'ห้องเรียนถูกล็อค',
          text: `ห้องเรียนนี้กำลังถูกแก้ไขโดย: ${result.lockedBy}\nคุณสามารถดูข้อมูลได้อย่างเดียว (Read-only) กรุณารอให้อีกฝ่ายทำงานเสร็จ`,
          confirmButtonText: 'รับทราบ'
        });
      }
    };
    
    tryLock();

    // Release lock on unmount, or when switching classes/tabs
    const handleUnload = () => releaseLock(classId, user.id);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      isCancelled = true;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      releaseLock(classId, user.id);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [classId, user?.id]);
  
  // Evaluation mismatch check
  const [evalMismatchWarning, setEvalMismatchWarning] = useState(false);
  const lastSeenEvalRef = useRef(null);

  useEffect(() => {
    if (!classId || !meta.sessionTerm || !meta.sessionYear || !expectedExam) return;
    const checkEval = async () => {
      try {
        const evalData = await loadEvaluationForSessionSync(classId, meta.sessionTerm, meta.sessionYear, expectedExam, {robot: meta.robot});
        if (evalData) {
          const currentUpdated = evalData.updated_at || evalData.created_at;
          if (lastSeenEvalRef.current && currentUpdated !== lastSeenEvalRef.current) {
            setEvalMismatchWarning(true);
          } else {
            lastSeenEvalRef.current = currentUpdated;
            setEvalMismatchWarning(false);
          }
        }
      } catch(e) {}
    };
    checkEval();
    const interval = setInterval(checkEval, 30000);
    return () => clearInterval(interval);
  }, [classId, meta.sessionTerm, meta.sessionYear, expectedExam, meta.robot]);

  const handleSync = async () => {
    if (!classId) {
      flash('กรุณาเลือกชั้นเรียนก่อนดึงข้อมูลจากประเมินหน้างาน');
      return;
    }
    setIsSyncing(true);
    try {
      const evalData = await loadEvaluationForSessionSync(classId, meta.sessionTerm, meta.sessionYear, expectedExam, {robot: meta.robot});
      if (evalData) {
        const syncedExam = parseExamFromAcademicTerm(evalData.academic_term);
        const syncedRobot = ROBOT_TYPES.find(type=>type.toLowerCase()===String(evalData.robot_type||'').toLowerCase());
        setMeta({
          ...meta,
          date: evalData.eval_date || meta.date,
          endDate: evalData.end_date ?? '',
          robot: syncedRobot || meta.robot,
          teachingPeriod: evalData.teaching_period ?? meta.teachingPeriod,
          trainer: evalData.trainer_name ?? '',
          exam: syncedExam || meta.exam
        });
        setFeedback({detail: evalData.issues ?? '', summary: evalData.suggestions ?? ''});
        lastSeenEvalRef.current = evalData.updated_at || evalData.created_at;
        setEvalMismatchWarning(false);
        flash('ดึงข้อมูลจากประเมินหน้างานสำเร็จ');
      } else {
        flash('ไม่พบข้อมูลประเมินหน้างานที่ตรงกับห้องและวันที่นี้');
      }
    } catch (err) {
      console.error(err);
      flash('ดึงข้อมูลไม่สำเร็จ');
    } finally {
      setIsSyncing(false);
    }
  };
  
  const formatTimeInput = (studentId, value) => {
    if (!value) return;
    const s = String(value).trim();
    if (/^\d{1,2}$/.test(s)) {
      const seconds = Number(s);
      update(studentId, 'time', `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`);
      return;
    }
    if (s.includes(':')) return;
    let formatted = s;
    if (/^\d{3,4}$/.test(s)) {
      const min = s.slice(0, -2).padStart(2, '0');
      const sec = s.slice(-2);
      formatted = `${min}:${sec}`;
    } else if (s.includes('.')) {
      const [min, sec] = s.split('.');
      formatted = `${min.padStart(2, '0')}:${(sec || '0').padEnd(2, '0')}`;
    }
    if (formatted !== s) {
      update(studentId, 'time', formatted);
    }
  };

  const calculatorResult=useMemo(()=>summarizeMissions(missionRows),[missionRows]);
  const openCalculator=student=>{
    if(isLocked||student.absent)return;
    setCalculatorStudent(student);
    setMissionRows(makeMissionRows());
  };
  const updateMission=(index,patch)=>setMissionRows(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));
  const setMissionMode=(index,mode)=>setMissionRows(rows=>rows.map((row,i)=>i===index?{...row,mode,value:mode==='time'?row.value||'':'2.30'}:row));
  const moveMission=(index,e)=>{
    if(['Enter','ArrowDown'].includes(e.key)){
      e.preventDefault();
      missionRefs.current[index+1]?.focus();
    }else if(e.key==='ArrowUp'){
      e.preventDefault();
      missionRefs.current[index-1]?.focus();
    }
  };
  const applyCalculatorResult=()=>{
    if(!calculatorStudent||calculatorResult.invalid)return;
    update(calculatorStudent.id,'score',String(calculatorResult.totalScore));
    update(calculatorStudent.id,'time',calculatorResult.time);
    setCalculatorStudent(null);
  };

  const filteredStudents = students.filter(s => {
    const hasScore = s.score !== '' && s.score !== null && s.score !== undefined;
    if (!s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'absent') return s.absent;
    if (statusFilter === 'passed') return !s.absent && hasScore && Number(s.score) >= 35;
    if (statusFilter === 'failed') return !s.absent && hasScore && Number(s.score) < 35;
    if (statusFilter === 'pending') return !s.absent && !hasScore;
    return true;
  });
  const ranks=useMemo(()=>calcRanks(students),[students]);
 
  if(!schools||!schools.length)return <div className="page-title"><div><span className="eyebrow">การประเมินผล</span><h1>บันทึกผลการทดสอบ</h1><p>ยังไม่มีข้อมูลโรงเรียน โปรดไปที่แท็บ "จัดการชั้นเรียน" เพื่อเพิ่มข้อมูล</p></div></div>;
  return <>
  <div className="page-title">
    <div>
      <span className="eyebrow">การประเมินผล</span>
      <h1>บันทึกผลการทดสอบ {editingBlocked && <span style={{color: '#f59e0b', fontSize: '16px', marginLeft: '10px'}}><ShieldCheck size={20} style={{verticalAlign:'middle', marginRight:'5px'}}/> {saveBlocked?`หยุดการแก้ไขชั่วคราว${blockedBy?`: ${blockedBy}`:''}`:lockMessage} (Read-only)</span>}</h1>
      <p>กรอกคะแนนและเวลาของนักเรียน ระบบจะคำนวณผลสัมฤทธิ์ให้อัตโนมัติ</p>
    </div>
    <div className="page-title-actions">
       {!editingBlocked && <span className="status" style={{marginRight:'10px'}}><i/> บันทึกอัตโนมัติทุก 5 วิ</span>}
       <button type="button" className="button" onClick={onRefreshClassroom} disabled={isRefreshingRoom||!classId||editingBlocked} title="รีโหลดชุดทดสอบและคะแนนของห้องนี้">{isRefreshingRoom?<Loader2 className="spin"/>:<RotateCcw/>}รีโหลดห้อง</button>
      <button type="button" className="button" onClick={onPreviewPDF}><Eye/>ดูตัวอย่าง PDF</button>
      <button type="button" className="button" onClick={onPreviewScoreTablePDF}><FileText/>PDF ตารางคะแนน</button>
       <button type="button" className="primary" disabled={editingBlocked} onClick={async ()=>{if(editingBlocked)return;flash('กำลังบันทึกข้อมูล...');try{await onSave();flash('บันทึกข้อมูลเรียบร้อยแล้ว')}catch(e){flash('บันทึกไม่สำเร็จ')}}}><Save/>บันทึกเดี๋ยวนี้</button>
    </div>
   </div>
   {saveBlocked&&<div className="score-lock-banner"><ShieldCheck/><div><b>ระบบหยุดการกรอกชั่วคราว</b><small>ไม่พบสิทธิ์แก้ไขห้องนี้ในขณะนี้ ข้อมูลที่เห็นยังคงอยู่บนหน้านี้</small></div><button type="button" className="button" disabled={retryingSaveLock} onClick={onRetrySaveLock}>{retryingSaveLock?<Loader2 className="spin"/>:<RotateCcw/>}ลองยืนยันสิทธิ์อีกครั้ง</button><button type="button" className="button" onClick={onReloadAfterLock}>โหลดข้อมูลล่าสุด</button></div>}
   <div className="card test-info"><div className="card-head"><div><b>ข้อมูลการทดสอบ</b><small>รายละเอียดสำหรับการประเมินครั้งนี้</small></div><div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>{evalMismatchWarning && <span style={{color: '#d97706', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'}}><AlertCircle size={14}/> มีประเมินหน้างานอัปเดตใหม่ล่าสุด</span>}<button type="button" className={`button ${evalMismatchWarning ? 'pulse-warning' : ''}`} style={{padding: '4px 10px', fontSize: '13px', borderColor: evalMismatchWarning ? '#f59e0b' : '', color: evalMismatchWarning ? '#d97706' : ''}} onClick={handleSync} disabled={isSyncing||editingBlocked}>{isSyncing ? <Loader2 size={14} className="spin"/> : <RotateCcw size={14}/>} ดึงจากประเมินหน้างาน</button><span className="test-badge">{meta.test}</span></div></div><div className="form-grid">
    <Field label="สำนักงาน"><Select value={filterOfficeId} onChange={val=>{setFilterOfficeId(val); onSelectSchool('');}}>
      <option value="">-- ทุกสำนักงาน --</option>
      {offices?.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}
    </Select></Field>
    <Field label="โรงเรียน"><Select value={schoolId} onChange={onSelectSchool}><option value="" disabled hidden>เลือกโรงเรียน</option>{(filterOfficeId ? schools.filter(s=>String(s.officeId)===String(filterOfficeId)) : schools).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</Select></Field>
    <Field label="ชั้นเรียน"><Select value={classId} onChange={onSelectClass} disabled={!schoolId}><option value="" disabled hidden>เลือกชั้นเรียน</option>{classrooms.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</Select></Field>
    <Field label="ค้นหานักเรียนในโรงเรียนนี้" wide><div className="student-room-search">
      <div className="student-room-search-input"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input value={studentRoomSearch} onChange={event=>setStudentRoomSearch(event.target.value)} disabled={!schoolId} placeholder={schoolId?'พิมพ์ชื่ออย่างน้อย 2 ตัวอักษร...':'เลือกโรงเรียนก่อนค้นหา'}/>{studentRoomSearch&&<button type="button" onClick={()=>setStudentRoomSearch('')} aria-label="ล้างคำค้นหานักเรียน"><X/></button>}</div>
      {studentRoomSearch.trim().length>=2&&<div className="student-room-results">{studentRoomMatches.length?studentRoomMatches.map(({student,classroomId,classroomName})=><button type="button" className="student-room-result" key={student.id} onClick={()=>onSelectClass(classroomId)}><b>{student.name}</b><small>{selectedSchoolName} · ชั้น {classroomName} · เลขที่ {student.no}</small></button>):<div className="student-room-empty">ไม่พบนักเรียนที่กำลังเรียนอยู่ในโรงเรียนนี้</div>}</div>}
    </div></Field>
    <Field label="ครั้งที่ทดสอบ"><div className="session-picker"><Select value={sessionId||''} onChange={onSelectSession} disabled={!classId||editingBlocked}><option value="" disabled hidden>{sessions.length ? 'เลือกครั้งที่ทดสอบ' : 'ยังไม่มีข้อมูล (กดปุ่ม + ด้านขวา)'}</option>{sessions.map(s=><option value={s.id} key={s.id}>{sessionOptionLabel(s)}</option>)}</Select><button type="button" onClick={onAddSession} disabled={!classId||editingBlocked} title="เพิ่มครั้งทดสอบ"><Plus/></button>{sessionId&&<button type="button" onClick={()=>onEditSession(sessionId)} disabled={!classId||editingBlocked} title="แก้ไขเลขครั้งทดสอบ"><Edit2 size={20}/></button>}{sessions.length>1&&<button type="button" onClick={()=>onDeleteSession(sessionId)} disabled={editingBlocked} title="ลบครั้งทดสอบ" className="danger-text"><Trash2 size={20}/></button>}</div></Field>
   {duplicateSessionGroups.length>0&&<div style={{gridColumn:'1 / -1',padding:'10px 14px',border:'1px solid #f59e0b',borderRadius:'8px',background:'rgba(245,158,11,.10)',color:'#92400e',fontSize:'13px'}}><b>พบเลขครั้งซ้ำ:</b> {duplicateSessionGroups.map(group=>`ครั้งที่ ${sessionNumber(group[0].test)} (${group.length} รายการ)`).join(', ')} กรุณาเลือกจากรายละเอียดในรายการ แล้วกดปุ่มดินสอเพื่อแก้ให้ไม่ซ้ำ ระบบจะไม่ลบคะแนนเดิม</div>}
    <Field label="วันที่ทดสอบ"><div className="date-range-fields"><ThaiDateInput value={meta.date || ''} onChange={value=>setMeta({...meta,date:value,endDate:meta.endDate&&meta.endDate>value?meta.endDate:''})} placeholder="วันเริ่มต้น" disabled={editingBlocked}/><span>ถึง</span><ThaiDateInput value={meta.endDate || ''} onChange={value=>{if(meta.date&&value<meta.date){flash('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น');return;}set('endDate',value===meta.date?'':value)}} placeholder="วันสิ้นสุด" title="วันสิ้นสุด (ไม่จำเป็นต้องระบุ หากสอบแค่วันเดียว)" disabled={editingBlocked}/></div></Field>
    <Field label="ภาคเรียน"><input type="number" min="1" max="3" value={meta.sessionTerm} onChange={e=>set('sessionTerm',e.target.value)} disabled={editingBlocked}/></Field>
    <Field label="ปีการศึกษา"><input type="number" min="2500" max="2600" value={meta.sessionYear} onChange={e=>set('sessionYear',e.target.value)} disabled={editingBlocked}/></Field>
    <Field label="ประเภทหุ่นยนต์"><Select value={meta.robot} onChange={v=>setMeta({...meta,robot:v,exam:defaultExamForRobot(v)})} disabled={editingBlocked}><option value="">-- ยังไม่ระบุหุ่นยนต์ --</option>{ROBOT_TYPES.map(type=><option key={type} value={type}>{type}</option>)}</Select></Field>
    <Field label="ชุดข้อสอบ"><Select value={expectedExam} onChange={v=>set('exam',v)} disabled={editingBlocked}>{!expectedExam&&<option value="">-- ยังไม่ระบุชุดข้อสอบ --</option>}{displayExamOptions.map(v=><option key={v} value={v}>{v}</option>)}</Select></Field>
     <Field label="คาบสอนปัจจุบัน"><input type="number" min="1" inputMode="numeric" value={meta.teachingPeriod} placeholder="เช่น 16" onChange={e=>set('teachingPeriod',e.target.value)} disabled={editingBlocked}/></Field>
     <Field label="วิทยากรผู้ประเมิน" wide><input value={meta.trainer} onChange={e=>set('trainer',e.target.value)} disabled={editingBlocked}/></Field>
  </div></div>
  {(!schoolId || !classId || !sessionId) ? <div className="card" style={{padding: '40px', textAlign: 'center', color: 'var(--text-light)'}}><p>กรุณาเลือกโรงเรียน ชั้นเรียน และครั้งที่ทดสอบจากด้านบน<br/>เพื่อเริ่มบันทึกคะแนน</p></div> : (<><div className="card score-card">
    <div className="card-head">
      <div><b>คะแนนและเวลา</b><small>{meta.level} · นักเรียน {students.length} คน</small></div>
      <div className="legend"><i/> ผ่านเกณฑ์ 35 คะแนน</div>
    </div>
    <div className="roster-toolbar" style={{borderBottom: '1px solid var(--border)', padding: '12px 20px', background: 'var(--bg)'}}>
      <div className="roster-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input placeholder="ค้นหาชื่อนักเรียน..." value={search ?? ''} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button type="button" onClick={()=>setSearch('')} aria-label="ล้างคำค้นหา"><X/></button>}
      </div>
      <div className="roster-filter">
        <span>สถานะ</span>
        <Select value={statusFilter} onChange={setStatusFilter}>
          <option value="all">แสดงทั้งหมด</option>
          <option value="passed">ผ่านเกณฑ์</option>
          <option value="failed">ไม่ผ่าน</option>
          <option value="absent">ขาดสอบ</option>
          <option value="pending">รอคะแนน</option>
        </Select>
      </div>
      <span className="roster-result" style={{marginLeft:'auto'}}>พบ {filteredStudents.length} คน</span>
    </div>
    <div className="table-wrap score-table-wrap"><table className="responsive-card-table score-entry-table"><thead><tr><th>เลขที่</th><th className="center">ลำดับ</th><th>ชื่อ–นามสกุล</th><th className="center">ขาดสอบ</th><th className="center">เด็กพิเศษ</th><th>เวลา <small>(นาที:วินาที)</small></th><th>คะแนน <small>(เต็ม 50)</small></th><th>ผลประเมิน</th><th>ผู้ประเมิน</th></tr></thead><tbody>{filteredStudents.map((s,i)=><tr key={s.id} className={s.absent?'absent':''}><td data-label="เลขที่" className="number">{String(s.no).padStart(2,'0')}</td><td data-label="ลำดับ" className="center"><span className={`rank-badge ${ranks[s.id]&&ranks[s.id]<=3?`top-${ranks[s.id]}`:''}`}>{ranks[s.id]||'—'}</span></td><td data-label="ชื่อ–นามสกุล"><b>{s.name}</b>{s.is_special?<span style={{marginLeft: '8px', fontSize: '11px', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: '100px', fontWeight: 600}}>เด็กพิเศษ</span>:''}</td><td data-label="ขาดสอบ" className="center"><input className="check" type="checkbox" checked={s.absent||false} onChange={e=>update(s.id,'absent',e.target.checked)} disabled={editingBlocked}/></td><td data-label="เด็กพิเศษ" className="center"><input className="check" type="checkbox" checked={s.is_special||false} onChange={e=>update(s.id,'is_special',e.target.checked)} disabled={editingBlocked}/></td><td data-label="เวลา"><input ref={el=>refs.current[`${i}-time`]=el} onKeyDown={e=>move(i,'time',e)} className="time-input" disabled={s.absent || editingBlocked} value={s.time ?? ''} placeholder="00:00" onChange={e=>update(s.id,'time',e.target.value)} onBlur={e=>formatTimeInput(s.id,e.target.value)}/></td><td data-label="คะแนน"><div className="score-tool"><input ref={el=>refs.current[`${i}-score`]=el} onKeyDown={e=>move(i,'score',e)} onWheel={e=>e.currentTarget.blur()} className="score-input" type="number" min="0" max="50" disabled={s.absent || editingBlocked} value={s.score ?? ''} placeholder="—" onChange={e=>update(s.id,'score',e.target.value)}/><button type="button" className="score-calc-btn" title="คำนวณคะแนนและเวลารวมจาก 5 ภารกิจ" aria-label={`คำนวณคะแนนของ ${s.name}`} disabled={s.absent || editingBlocked} onClick={()=>openCalculator(s)}><Calculator/></button></div></td><td data-label="ผลประเมิน">{s.absent?<span className="result no"><AlertCircle/>ขาดสอบ</span>:s.score?<span className={+s.score>=35?'result yes':'result no'}>{+s.score>=35?<CheckCircle2/>:<X/>}{+s.score>=35?'ผ่าน':'ไม่ผ่าน'}</span>:<span className="muted">รอคะแนน</span>}</td><td data-label="ผู้ประเมิน" className="evaluator-name"><small>{s.updatedBy ? (userProfiles?.[s.updatedBy] || 'ไม่ทราบชื่อ') : <span className="muted">—</span>}</small></td></tr>)}</tbody></table></div>
   <div className="table-summary"><span>เข้าสอบ <b>{stats.present}</b> คน</span><span>ขาดสอบ <b>{stats.absent}</b> คน</span><span>คะแนนเฉลี่ย <b>{stats.avg.toFixed(1)}</b></span><span>ผ่านเกณฑ์ <b>{stats.rate.toFixed(0)}%</b></span></div>
  </div>
  <div className="card feedback"><div className="card-head"><div><b>สรุปปัญหาและข้อเสนอแนะ</b><small>บันทึกปัญหาอุปสรรคและข้อเสนอแนะ ข้อมูลนี้จะปรากฏในรายงาน PDF</small></div></div><div className="form-grid" style={{alignItems: 'start'}}><Field label="ปัญหาและอุปสรรค (Issues)"><textarea value={feedback.detail ?? ''} onChange={e=>setFeedback({...feedback, detail:e.target.value})} placeholder="ระบุปัญหาหรืออุปสรรคที่พบ..." rows="3" disabled={editingBlocked}/></Field><Field label="ข้อคิดเห็นและข้อเสนอแนะ (Suggestions)"><textarea value={feedback.summary ?? ''} onChange={e=>setFeedback({...feedback, summary:e.target.value})} placeholder="ระบุข้อเสนอแนะหรือแนวทางการแก้ไข..." rows="3" disabled={editingBlocked}/></Field></div></div>
  <div className="actions"><span><kbd>Enter ↵</kbd> หรือ <kbd>↓</kbd> เพื่อเลื่อนไปช่องถัดไป</span><div style={{display: 'flex', gap: '10px'}}><button type="button" className="button danger-text" disabled={editingBlocked||!sessionId} onClick={() => {
    if (editingBlocked) return;
    const hasSessionData=hasRecordedResult||Boolean(meta.date||meta.endDate||meta.robot||meta.exam||meta.teachingPeriod||meta.trainer||meta.sessionTerm||meta.sessionYear||feedback?.detail||feedback?.summary);
    themeSwal.fire({
      title: 'ยืนยันรีเซตข้อมูลครั้งนี้?',
      text: hasSessionData
        ? 'คะแนน เวลา สถานะ และรายละเอียดชุดทดสอบของนักเรียนทุกคนจะถูกล้าง เหลือเฉพาะเลขครั้งและรหัสรอบเดิม ข้อมูลที่รีเซตแล้วจะไม่สามารถกู้คืนจากหน้านี้ได้'
        : 'ครั้งนี้ยังไม่มีข้อมูลที่กรอก ระบบจะคงเลขครั้งและรหัสรอบเดิมไว้ แล้วเปิดเป็นช่องว่างสำหรับกรอกใหม่',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันรีเซตข้อมูล',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        onResetSession();
      }
    });
  }}><RotateCcw size={16} style={{marginRight: '5px'}}/>รีเซตข้อมูลครั้งนี้</button><button className="primary" disabled={editingBlocked} onClick={async ()=>{
    if (editingBlocked) return;
    flash('กำลังบันทึกข้อมูลที่เปลี่ยนแปลง...');try{await onSave();flash('บันทึกและประเมินผลเรียบร้อยแล้ว')}catch(e){console.error(e);flash('ไม่สามารถบันทึกได้: โปรดตรวจสอบการเชื่อมต่อ')}}}><Save/>บันทึกและประเมินผล</button></div></div></>)}
  {calculatorStudent&&<div className="calc-modal-backdrop" role="dialog" aria-modal="true" aria-label={`คำนวณคะแนนของ ${calculatorStudent.name}`}>
    <div className="calc-modal">
      <div className="calc-modal-head">
        <div><b>คำนวณคะแนนและเวลา</b><small>{calculatorStudent.name}</small></div>
        <button type="button" className="icon" onClick={()=>setCalculatorStudent(null)} aria-label="ปิดหน้าต่างคำนวณ"><X/></button>
      </div>
      <div className="calc-modal-body">
        <div className="calc-mission-list">
          {missionRows.map((row,index)=>{
            const mission=calculatorResult.missions[index];
            return <div className="calc-mission-row" key={index}>
              <span>{index+1}</span>
              <input ref={el=>missionRefs.current[index]=el} value={row.value} inputMode="decimal" placeholder="1.21 หรือ 121" onKeyDown={e=>moveMission(index,e)} onChange={e=>updateMission(index,{value:e.target.value,mode:'time'})}/>
              <button type="button" className={row.mode==='add5'?'active':''} onClick={()=>setMissionMode(index,'add5')}>+5</button>
              <button type="button" className={row.mode==='dnf'?'active dnf':''} onClick={()=>setMissionMode(index,'dnf')}>DNF</button>
              <strong className={mission.score===0?'zero':mission.score===5?'half':'full'}>{mission.score}</strong>
            </div>
          })}
        </div>
        <div className="calc-summary">
          <div><small>เวลารวม</small><b>{calculatorResult.invalid?'--:--':calculatorResult.time}</b></div>
          <div><small>คะแนนรวม</small><b>{calculatorResult.invalid?'--':calculatorResult.totalScore}<span>/50</span></b></div>
        </div>
        {calculatorResult.invalid&&<p className="calc-error">ตรวจสอบรูปแบบเวลา เช่น 1.21 หรือ 121</p>}
      </div>
      <div className="calc-modal-actions">
        <button type="button" className="button" onClick={()=>setMissionRows(makeMissionRows())}><RotateCcw/>ล้าง</button>
        <button type="button" className="primary" disabled={calculatorResult.invalid||isLocked} onClick={applyCalculatorResult}><CheckCircle2/>ใช้ผลนี้</button>
      </div>
    </div>
  </div>}
  </>
}

export default ScorePage;
