import React,{useEffect,useMemo,useRef,useState} from 'react';
import {AlertCircle,ArrowRightLeft,Calculator,CheckCircle2,Loader2,Plus,RefreshCw,RotateCcw,Save,ShieldCheck,Trash2,Trophy,X} from 'lucide-react';
import Swal from 'sweetalert2';
import {calcRanks,ROBOT_TYPES,defaultExamForRobot,examOptionsForRobot} from '../model';
import {acquireCompetitionLock,deleteCompetitionSession,keepCompetitionLockAlive,loadClassroomDetail,loadCompetitionClassroom,previewCompetitionToTestRound,releaseCompetitionLock,saveCompetitionResults,saveCompetitionSession,transferCompetitionToTestRound,verifyCompetitionLock} from '../dataService';
import Field from '../components/ui/Field';
import Select from '../components/ui/Select';
import ThaiDateInput from '../components/ui/ThaiDateInput';

const dialog=Swal.mixin({
  customClass:{confirmButton:'primary',cancelButton:'button',popup:'swal-theme-popup',title:'swal-theme-title'},
  buttonsStyling:false,background:'var(--panel)',color:'var(--text)'
});

const scoreValue=value=>value===''||value==null?'':String(value);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
const CONTEXT_KEY='competition-score-context';
const readStoredContext=()=>{
  try{return JSON.parse(localStorage.getItem(CONTEXT_KEY))||{}}catch{return {}}
};
const makeMissionRows=()=>Array.from({length:5},()=>({value:'',mode:'time'}));
const parseMissionSeconds=value=>{
  const text=String(value||'').trim();
  if(!text)return 150;
  if(/^\d{1,2}$/.test(text))return Number(text);
  if(/^\d{3,4}$/.test(text))return Number(text.slice(0,-2))*60+Number(text.slice(-2));
  const parts=text.split(/[:.]/);
  if(parts.length===2){
    const minutes=Number(parts[0]),seconds=Number(parts[1]);
    return Number.isFinite(minutes)&&Number.isFinite(seconds)&&minutes>=0&&seconds>=0?minutes*60+seconds:Number.NaN;
  }
  const seconds=Number(text);
  return Number.isFinite(seconds)&&seconds>=0?seconds:Number.NaN;
};
const formatTotalTime=totalSeconds=>`${String(Math.floor(totalSeconds/60)).padStart(2,'0')}:${String(totalSeconds%60).padStart(2,'0')}`;
const scoreMission=(seconds,mode)=>mode==='dnf'?0:mode==='add5'?5:seconds<=120?10:Math.max(0,10-Math.ceil((seconds-120)/10));
const summarizeMissions=rows=>{
  let totalSeconds=0,totalScore=0,invalid=false;
  const missions=rows.map(row=>{
    if(row.mode==='time'&&!String(row.value||'').trim())return {...row,seconds:0,score:0};
    const seconds=parseMissionSeconds(row.value);
    if(!Number.isFinite(seconds)){invalid=true;return {...row,seconds:0,score:0}}
    const score=scoreMission(seconds,row.mode);
    totalSeconds+=seconds;totalScore+=score;
    return {...row,seconds,score};
  });
  return {missions,totalSeconds,totalScore,time:formatTotalTime(totalSeconds),invalid};
};

export default function CompetitionScorePage({schools,offices,user,userProfiles,flash,onTransferComplete,readOnly=false}){
  const restoredContext=useRef(readStoredContext()).current;
  const [officeId,setOfficeId]=useState(restoredContext.officeId||'');
  const [schoolId,setSchoolId]=useState(restoredContext.schoolId||'');
  const [classroomId,setClassroomId]=useState(restoredContext.classroomId||'');
  const [students,setStudents]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [sessionId,setSessionId]=useState(restoredContext.sessionId||'');
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const loadRequest=useRef(0);
  const inputRefs=useRef({});
  const editRevision=useRef(0);
  const [calculatorStudent,setCalculatorStudent]=useState(null);
  const [missionRows,setMissionRows]=useState(makeMissionRows);
  const missionRefs=useRef({});
  const [lockState,setLockState]=useState(readOnly?'readonly':'idle');
  const [lockMessage,setLockMessage]=useState('');
  const [lockRetry,setLockRetry]=useState(0);
  const [transferPreview,setTransferPreview]=useState(null);
  const [transferBusy,setTransferBusy]=useState(false);
  const [transferRound,setTransferRound]=useState(2);

  const visibleSchools=officeId?schools.filter(s=>String(s.officeId)===String(officeId)):schools;
  const school=schools.find(item=>String(item.id)===String(schoolId));
  const classrooms=school?.classrooms||[];
  const session=sessions.find(item=>String(item.id)===String(sessionId));
  const editingBlocked=readOnly||Boolean(sessionId)&&lockState!=='owned';

  useEffect(()=>{
    localStorage.setItem(CONTEXT_KEY,JSON.stringify({officeId,schoolId,classroomId,sessionId}));
  },[officeId,schoolId,classroomId,sessionId]);

  useEffect(()=>{
    if(officeId&&offices.length&&!offices.some(item=>String(item.id)===String(officeId)))setOfficeId('');
  },[offices,officeId]);

  useEffect(()=>{
    if(!visibleSchools.length){setSchoolId('');return;}
    if(!schoolId||!visibleSchools.some(item=>String(item.id)===String(schoolId)))setSchoolId(String(visibleSchools[0].id));
  },[visibleSchools,schoolId]);

  useEffect(()=>{
    if(!classrooms.length){setClassroomId('');return;}
    if(!classroomId||!classrooms.some(item=>String(item.id)===String(classroomId)))setClassroomId(String(classrooms[0].id));
  },[schoolId,classrooms,classroomId]);

  const loadRoom=async(targetClassroomId,{quiet=false}={})=>{
    if(!targetClassroomId)return;
    const request=++loadRequest.current;
    if(!quiet)setLoading(true);
    try{
      const [detail,competitionSessions]=await Promise.all([
        loadClassroomDetail(targetClassroomId),
        loadCompetitionClassroom(targetClassroomId)
      ]);
      if(request!==loadRequest.current)return;
      setStudents(detail.classroom.students||[]);
      setSessions(competitionSessions);
      setSessionId(current=>competitionSessions.some(item=>item.id===current)?current:(competitionSessions.at(-1)?.id||''));
      setDirty(false);
      editRevision.current=0;
    }catch(error){
      console.error(error);
      flash(`โหลดข้อมูลการแข่งขันไม่สำเร็จ: ${error.message}`);
    }finally{
      if(request===loadRequest.current)setLoading(false);
    }
  };

  useEffect(()=>{loadRoom(classroomId)},[classroomId]);

  useEffect(()=>{
    if(readOnly||!sessionId||!user?.id){
      setLockState(readOnly?'readonly':'idle');
      setLockMessage('');
      return undefined;
    }

    let cancelled=false;
    let heartbeatInterval=null;
    const lockedSessionId=sessionId;
    setLockState('checking');
    setLockMessage('กำลังตรวจสอบสิทธิ์การแก้ไข…');

    const acquire=async()=>{
      const profile=userProfiles?.[user.id];
      const userName=(typeof profile==='string'?profile:profile?.full_name)||user.email||'แอดมิน';
      const result=await acquireCompetitionLock(sessionId,user.id,userName);
      if(cancelled){
        if(result.success)releaseCompetitionLock(lockedSessionId,user.id);
        return;
      }
      if(!result.success){
        setLockState('blocked');
        setLockMessage(`รายการนี้กำลังถูกแก้ไขโดย: ${result.lockedBy}`);
        dialog.fire({
          icon:'warning',title:'รายการแข่งขันกำลังถูกบันทึก',
          text:`รายการนี้กำลังถูกแก้ไขโดย: ${result.lockedBy} คุณสามารถดูข้อมูลได้อย่างเดียวจนกว่าอีกฝ่ายจะออกจากรายการ`,
          confirmButtonText:'รับทราบ'
        });
        return;
      }
      setLockState('owned');
      setLockMessage('');
      heartbeatInterval=setInterval(async()=>{
        try{
          const alive=await keepCompetitionLockAlive(sessionId,user.id);
          if(!alive&&!cancelled){
            setLockState('blocked');
            setLockMessage('สิทธิ์แก้ไขรายการนี้หมดอายุ กรุณาลองยืนยันสิทธิ์อีกครั้ง');
          }
        }catch(error){console.error('Competition lock heartbeat failed:',error)}
      },60000);
    };
    acquire();

    const handleUnload=()=>releaseCompetitionLock(lockedSessionId,user.id);
    window.addEventListener('beforeunload',handleUnload);
    return()=>{
      cancelled=true;
      if(heartbeatInterval)clearInterval(heartbeatInterval);
      releaseCompetitionLock(lockedSessionId,user.id);
      window.removeEventListener('beforeunload',handleUnload);
    };
  },[sessionId,user?.id,readOnly,lockRetry]);

  const entries=session?.entries||{};
  const scoreStudents=useMemo(()=>students
    .filter(student=>student.active!==false||entries[student.id])
    .map(student=>({score:'',time:'',absent:false,is_special:false,updatedBy:'',...student,...(entries[student.id]||{})})),[students,entries]);
  const ranks=useMemo(()=>calcRanks(scoreStudents.map(student=>student.is_special?{...student,absent:true}:student)),[scoreStudents]);
  const filteredStudents=scoreStudents.filter(student=>{
    const hasScore=student.score!==''&&student.score!=null;
    if(!String(student.name||'').toLowerCase().includes(search.toLowerCase()))return false;
    if(statusFilter==='absent')return student.absent;
    if(statusFilter==='passed')return !student.absent&&hasScore&&Number(student.score)>=35;
    if(statusFilter==='failed')return !student.absent&&hasScore&&Number(student.score)<35;
    if(statusFilter==='pending')return !student.absent&&!hasScore;
    return true;
  }).sort((a,b)=>Number(a.no)-Number(b.no)||String(a.name).localeCompare(String(b.name),'th'));

  const mutateSession=patch=>{
    if(!session||editingBlocked)return;
    setSessions(items=>items.map(item=>item.id===session.id?{...item,...patch}:item));
    editRevision.current+=1;
    setDirty(true);
  };
  const updateResult=(studentId,keyOrPatch,value)=>{
    if(!session||editingBlocked)return;
    const current=entries[studentId]||{score:'',time:'',absent:false,is_special:false,updatedBy:''};
    const patch=typeof keyOrPatch==='string'?{[keyOrPatch]:value}:keyOrPatch;
    mutateSession({entries:{...entries,[studentId]:{...current,...patch,updatedBy:user.id}}});
  };
  const formatTime=(studentId,value)=>{
    const text=String(value||'').trim();
    if(!text)return;
    if(/^\d{3,4}$/.test(text))updateResult(studentId,'time',`${text.slice(0,-2).padStart(2,'0')}:${text.slice(-2)}`);
    else if(text.includes('.')){
      const [minute,second]=text.split('.');
      updateResult(studentId,'time',`${minute.padStart(2,'0')}:${(second||'0').padEnd(2,'0')}`);
    }
  };

  const calculatorResult=useMemo(()=>summarizeMissions(missionRows),[missionRows]);
  const openCalculator=student=>{
    if(editingBlocked||student.absent)return;
    setCalculatorStudent(student);
    setMissionRows(makeMissionRows());
  };
  const updateMission=(index,patch)=>setMissionRows(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,...patch}:row));
  const setMissionMode=(index,mode)=>setMissionRows(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,mode,value:mode==='time'?row.value||'':'2.30'}:row));
  const moveMission=(index,event)=>{
    if(['Enter','ArrowDown'].includes(event.key)){event.preventDefault();missionRefs.current[index+1]?.focus()}
    else if(event.key==='ArrowUp'){event.preventDefault();missionRefs.current[index-1]?.focus()}
  };
  const applyCalculatorResult=()=>{
    if(!calculatorStudent||calculatorResult.invalid)return;
    updateResult(calculatorStudent.id,{score:String(calculatorResult.totalScore),time:calculatorResult.time});
    setCalculatorStudent(null);
  };

  const saveNow=async({quiet=false}={})=>{
    if(!session||readOnly)return;
    if(lockState!=='owned')throw new Error(lockMessage||'ยังไม่ได้รับสิทธิ์แก้ไขรายการนี้');
    const revision=editRevision.current;
    setSaving(true);
    try{
      const ownership=await verifyCompetitionLock(session.id,user.id);
      if(!ownership.hasLock){
        setLockState('blocked');
        setLockMessage(`ไม่สามารถบันทึกได้: ${ownership.lockedBy}`);
        throw new Error(`ไม่สามารถบันทึกได้: ${ownership.lockedBy}`);
      }
      await saveCompetitionSession(session,user.id);
      await saveCompetitionResults(session.id,session.entries,user.id);
      if(editRevision.current===revision)setDirty(false);
      if(!quiet)flash('บันทึกคะแนนการแข่งขันเรียบร้อยแล้ว');
    }catch(error){
      console.error(error);
      flash(`บันทึกการแข่งขันไม่สำเร็จ: ${error.message}`);
      throw error;
    }finally{setSaving(false)}
  };

  const changeContext=async action=>{
    if(dirty&&session){
      try{await saveNow({quiet:true})}catch{return;}
    }
    action();
  };

  useEffect(()=>{
    if(!dirty||!session||readOnly)return undefined;
    const timer=setTimeout(()=>saveNow({quiet:true}).catch(()=>{}),5000);
    return()=>clearTimeout(timer);
  },[dirty,session,readOnly,lockState]);

  const addCompetition=async()=>{
    if(!classroomId||readOnly)return;
    if(dirty&&session){
      try{await saveNow({quiet:true})}catch{return;}
    }
    const number=sessions.length+1;
    const result=await dialog.fire({
      title:'เพิ่มการแข่งขันภายใน',input:'text',inputValue:`การแข่งขันภายใน ครั้งที่ ${number}`,
      inputLabel:'ชื่อรายการแข่งขัน',showCancelButton:true,confirmButtonText:'สร้างการแข่งขัน',cancelButtonText:'ยกเลิก',
      inputValidator:value=>String(value||'').trim()?'':'กรุณาระบุชื่อการแข่งขัน'
    });
    if(!result.isConfirmed)return;
    const next={id:`competition-${Date.now()}`,classId:classroomId,name:String(result.value).trim(),date:new Date().toISOString().slice(0,10),robot:'',exam:'',entries:{}};
    try{
      await saveCompetitionSession(next,user.id);
      setSessions(items=>[...items,next]);
      setSessionId(next.id);
      editRevision.current=0;
      flash('สร้างการแข่งขันภายในแล้ว');
    }catch(error){console.error(error);flash(`สร้างการแข่งขันไม่สำเร็จ: ${error.message}`)}
  };

  const removeCompetition=async()=>{
    if(!session||editingBlocked)return;
    const result=await dialog.fire({icon:'warning',title:'ลบการแข่งขันนี้?',text:'คะแนนการแข่งขันรายการนี้จะไม่แสดง แต่คะแนนประเมินปกติและข้อมูลหน้างานจะไม่ถูกแตะต้อง',showCancelButton:true,confirmButtonText:'ลบการแข่งขัน',cancelButtonText:'ยกเลิก'});
    if(!result.isConfirmed)return;
    try{
      await deleteCompetitionSession(session.id);
      const remaining=sessions.filter(item=>item.id!==session.id);
      setSessions(remaining);setSessionId(remaining.at(-1)?.id||'');setDirty(false);
      flash('ลบการแข่งขันแล้ว');
    }catch(error){console.error(error);flash(`ลบการแข่งขันไม่สำเร็จ: ${error.message}`)}
  };

  const openTransferPreview=async()=>{
    if(!session||readOnly)return;
    if(dirty){try{await saveNow({quiet:true})}catch{return;}}
    setTransferBusy(true);
    try{
      const preview=await previewCompetitionToTestRound(schoolId,session.id,transferRound);
      setTransferPreview(preview);
    }catch(error){console.error(error);flash(`ตรวจสอบการโอนคะแนนไม่สำเร็จ: ${error.message}`)}
    finally{setTransferBusy(false)}
  };
  const changeTransferRound=async value=>{
    const nextRound=Number(value);
    setTransferRound(nextRound);
    setTransferBusy(true);
    try{setTransferPreview(await previewCompetitionToTestRound(schoolId,session.id,nextRound))}
    catch(error){console.error(error);flash(`ตรวจสอบครั้งที่ ${nextRound} ไม่สำเร็จ: ${error.message}`)}
    finally{setTransferBusy(false)}
  };
  const confirmTransfer=async()=>{
    if(!transferPreview?.totals.transferable||transferBusy)return;
    setTransferBusy(true);
    try{
      const profile=userProfiles?.[user.id];
      const userName=(typeof profile==='string'?profile:profile?.full_name)||user.email||'แอดมิน';
      const targetRound=transferPreview.targetRound;
      const result=await transferCompetitionToTestRound({schoolId,sourceSessionId:session.id,targetRound,userId:user.id,userName});
      try{await onTransferComplete?.(schoolId)}catch(refreshError){console.warn('Refresh transferred school failed:',refreshError)}
      setTransferPreview(null);
      await dialog.fire({
        icon:result.errors.length?'warning':'success',title:'โอนคะแนนเสร็จแล้ว',
        html:`โอนไปครั้งที่ ${targetRound} สำเร็จ <b>${result.transferred}</b> คน จาก <b>${result.completedRooms}</b> ห้อง<br>สร้างรายการครั้งที่ ${targetRound} ใหม่ <b>${result.createdSessions}</b> ห้อง<br>เก็บคะแนนเดิมไว้ <b>${result.protected}</b> คน${result.lockedRooms?`<br>ห้องที่กำลังถูกแก้ไขและข้ามไป <b>${result.lockedRooms}</b> ห้อง`:''}${result.errors.length?`<br><small>${result.errors.map(escapeHtml).join('<br>')}</small>`:''}`,
        confirmButtonText:'รับทราบ'
      });
    }catch(error){console.error(error);flash(`โอนคะแนนไม่สำเร็จ: ${error.message}`)}
    finally{setTransferBusy(false)}
  };

  const metadataLabel=key=>({date:'วันที่',robot:'ประเภทหุ่นยนต์',exam:'ชุดทดสอบ'}[key]||key);
  const transferStatusLabel=room=>({
    ready:'พร้อมโอน',create:`พร้อมโอน · จะสร้างครั้งที่ ${transferPreview?.targetRound||transferRound}`,source_missing:'ไม่พบรายการแข่งขันชื่อเดียวกัน',source_duplicate:'รายการแข่งขันชื่อซ้ำ',destination_duplicate:`ครั้งที่ ${transferPreview?.targetRound||transferRound} ซ้ำ`,source_empty:'ยังไม่มีคะแนน',protected:`มีคะแนนครั้งที่ ${transferPreview?.targetRound||transferRound} อยู่แล้ว`,
    source_metadata_missing:`ข้อมูลแข่งขันไม่ครบ: ${room.sourceMissingFields.map(metadataLabel).join(', ')}`,
    destination_metadata_missing:`ข้อมูลปลายทางไม่ครบ: ${room.destinationMissingFields.map(metadataLabel).join(', ')}`,
    metadata_mismatch:`ข้อมูลไม่ตรงกัน: ${room.metadataMismatchFields.map(metadataLabel).join(', ')}`
  }[room.status]||room.status);
  const openCompetitionSetup=room=>{
    setTransferPreview(null);
    if(room.sourceSessionId)setSessionId(String(room.sourceSessionId));
    setClassroomId(String(room.classroomId));
  };

  const examOptions=examOptionsForRobot(session?.robot||'');
  const scored=scoreStudents.filter(student=>!student.absent&&student.score!==''&&student.score!=null);
  const absent=scoreStudents.filter(student=>student.absent).length;

  if(!schools.length)return <div className="page-title"><div><span className="eyebrow">การแข่งขันภายใน</span><h1>บันทึกคะแนนการแข่งขัน</h1><p>ยังไม่มีข้อมูลโรงเรียนและนักเรียน</p></div></div>;

  return <>
    <div className="page-title">
      <div><span className="eyebrow">การแข่งขันภายใน</span><h1><Trophy/> บันทึกคะแนนการแข่งขัน</h1><p>ใช้รายชื่อนักเรียนเดิม แต่เก็บคะแนนแยกจากผลการทดสอบและประเมินหน้างาน</p></div>
      <div className="page-title-actions">
        {!readOnly&&<span className="status"><i/> {lockState==='checking'?'กำลังตรวจสอบสิทธิ์':lockState==='blocked'?'เปิดแบบอ่านอย่างเดียว':dirty?'รอบันทึกอัตโนมัติ':'บันทึกแล้ว'}</span>}
        <button className="button" disabled={!classroomId||loading} onClick={()=>loadRoom(classroomId)}>{loading?<Loader2 className="spin"/>:<RefreshCw/>}รีโหลด</button>
        <button className="primary" disabled={!session||saving||editingBlocked} onClick={()=>saveNow()}>{saving?<Loader2 className="spin"/>:<Save/>}บันทึกเดี๋ยวนี้</button>
      </div>
    </div>
    {sessionId&&lockState==='checking'&&<div className="score-lock-banner"><Loader2 className="spin"/><div><b>กำลังตรวจสอบสิทธิ์การแก้ไข</b><small>ระบบกำลังตรวจสอบว่ามีผู้ใช้อื่นบันทึกรายการแข่งขันนี้อยู่หรือไม่</small></div></div>}
    {sessionId&&lockState==='blocked'&&<div className="score-lock-banner"><ShieldCheck/><div><b>เปิดดูได้อย่างเดียว</b><small>{lockMessage}</small></div><button type="button" className="button" onClick={()=>setLockRetry(value=>value+1)}><RefreshCw/>ลองอีกครั้ง</button></div>}
    <div className="card test-info">
      <div className="card-head"><div><b>ข้อมูลการแข่งขัน</b><small>คะแนนส่วนนี้ไม่ถูกนำไปรวมกับผลการทดสอบปกติ จนกว่าจะยืนยันโอนคะแนน</small></div>{session&&<div className="competition-card-actions"><button className="button" disabled={readOnly||transferBusy} onClick={openTransferPreview}>{transferBusy?<Loader2 className="spin"/>:<ArrowRightLeft/>}โอนไปผลทดสอบ</button><button className="button danger-text" disabled={editingBlocked} onClick={removeCompetition}><Trash2/>ลบการแข่งขัน</button></div>}</div>
      <div className="form-grid">
        <Field label="สำนักงาน"><Select value={officeId} onChange={value=>changeContext(()=>{setOfficeId(value);setSchoolId('');setClassroomId('')})}><option value="">-- ทุกสำนักงาน --</option>{offices.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="โรงเรียน"><Select value={schoolId} onChange={value=>changeContext(()=>{setSchoolId(value);setClassroomId('')})}><option value="" disabled>เลือกโรงเรียน</option>{visibleSchools.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="ชั้นเรียน"><Select value={classroomId} onChange={value=>changeContext(()=>setClassroomId(value))} disabled={!schoolId}><option value="" disabled>เลือกชั้นเรียน</option>{classrooms.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="รายการแข่งขัน"><div className="session-picker"><Select value={sessionId} onChange={value=>changeContext(()=>setSessionId(value))} disabled={!classroomId}><option value="" disabled>{sessions.length?'เลือกรายการแข่งขัน':'ยังไม่มีการแข่งขัน'}</option>{sessions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select><button type="button" disabled={!classroomId||readOnly} onClick={addCompetition} title="เพิ่มการแข่งขัน"><Plus/></button></div></Field>
        {session&&<>
          <Field label="ชื่อการแข่งขัน" wide><input value={session.name} disabled={editingBlocked} onChange={event=>mutateSession({name:event.target.value})}/></Field>
          <Field label="วันที่แข่งขัน"><ThaiDateInput value={session.date||''} disabled={editingBlocked} onChange={value=>mutateSession({date:value})}/></Field>
          <Field label="ประเภทหุ่นยนต์"><Select value={session.robot||''} disabled={editingBlocked} onChange={value=>mutateSession({robot:value,exam:defaultExamForRobot(value)})}><option value="">-- ยังไม่ระบุ --</option>{ROBOT_TYPES.map(type=><option key={type} value={type}>{type}</option>)}</Select></Field>
          <Field label="ชุดข้อสอบ"><Select value={session.exam||''} disabled={editingBlocked} onChange={value=>mutateSession({exam:value})}><option value="">-- ยังไม่ระบุ --</option>{examOptions.map(option=><option key={option} value={option}>{option}</option>)}</Select></Field>
        </>}
      </div>
    </div>
    {!session?<div className="card" style={{padding:40,textAlign:'center'}}><Trophy size={38}/><p>กดปุ่ม + เพื่อสร้างการแข่งขันภายในสำหรับห้องนี้</p></div>:<div className="card score-card">
      <div className="card-head"><div><b>คะแนนและเวลา</b><small>{school?.name} · {classrooms.find(item=>item.id===classroomId)?.name} · นักเรียน {scoreStudents.length} คน</small></div><div className="legend"><i/> ผ่านเกณฑ์ 35 คะแนน</div></div>
      <div className="roster-toolbar" style={{borderBottom:'1px solid var(--border)',padding:'12px 20px',background:'var(--bg)'}}>
        <div className="roster-search"><input placeholder="ค้นหาชื่อนักเรียน..." value={search} onChange={event=>setSearch(event.target.value)}/>{search&&<button onClick={()=>setSearch('')} aria-label="ล้างคำค้นหา"><X/></button>}</div>
        <div className="roster-filter"><span>สถานะ</span><Select value={statusFilter} onChange={setStatusFilter}><option value="all">แสดงทั้งหมด</option><option value="passed">ผ่านเกณฑ์</option><option value="failed">ไม่ผ่าน</option><option value="absent">ขาดแข่งขัน</option><option value="pending">รอคะแนน</option></Select></div>
        <span className="roster-result">พบ {filteredStudents.length} คน</span>
      </div>
      <div className="table-wrap score-table-wrap"><table className="responsive-card-table score-entry-table"><thead><tr><th>เลขที่</th><th className="center">อันดับ</th><th>ชื่อ–นามสกุล</th><th className="center">ขาดแข่งขัน</th><th className="center">เด็กพิเศษ</th><th>เวลา <small>(นาที:วินาที)</small></th><th>คะแนน <small>(เต็ม 50)</small></th><th>ผลการแข่งขัน</th><th>ผู้บันทึก</th></tr></thead><tbody>
        {filteredStudents.map((student,index)=><tr key={student.id} className={student.absent?'absent':''}>
          <td data-label="เลขที่" className="number">{String(student.no).padStart(2,'0')}</td>
          <td data-label="อันดับ" className="center"><span className={`rank-badge ${ranks[student.id]&&ranks[student.id]<=3?`top-${ranks[student.id]}`:''}`}>{ranks[student.id]||'—'}</span></td>
          <td data-label="ชื่อ–นามสกุล"><b>{student.name}</b>{student.is_special&&<span style={{marginLeft:8,fontSize:11,background:'#f59e0b',color:'white',padding:'2px 6px',borderRadius:100}}>เด็กพิเศษ</span>}</td>
          <td data-label="ขาดแข่งขัน" className="center"><input className="check" type="checkbox" checked={student.absent||false} disabled={editingBlocked} onChange={event=>updateResult(student.id,'absent',event.target.checked)}/></td>
          <td data-label="เด็กพิเศษ" className="center"><input className="check" type="checkbox" checked={student.is_special||false} disabled={editingBlocked} onChange={event=>updateResult(student.id,'is_special',event.target.checked)}/></td>
          <td data-label="เวลา"><input ref={element=>inputRefs.current[`${index}-time`]=element} className="time-input" value={student.time||''} placeholder="00:00" disabled={student.absent||editingBlocked} onChange={event=>updateResult(student.id,'time',event.target.value)} onBlur={event=>formatTime(student.id,event.target.value)}/></td>
          <td data-label="คะแนน"><div className="score-tool"><input ref={element=>inputRefs.current[`${index}-score`]=element} className="score-input" type="number" min="0" max="50" value={scoreValue(student.score)} placeholder="—" disabled={student.absent||editingBlocked} onChange={event=>updateResult(student.id,'score',event.target.value)}/><button type="button" className="score-calc-btn" title="คำนวณคะแนนและเวลารวมจาก 5 ภารกิจ" aria-label={`คำนวณคะแนนของ ${student.name}`} disabled={student.absent||editingBlocked} onClick={()=>openCalculator(student)}><Calculator/></button></div></td>
          <td data-label="ผลการแข่งขัน">{student.absent?<span className="result no"><AlertCircle/>ขาดแข่งขัน</span>:student.score!==''?<span className={Number(student.score)>=35?'result yes':'result no'}>{Number(student.score)>=35?<CheckCircle2/>:<X/>}{Number(student.score)>=35?'ผ่าน':'ไม่ผ่าน'}</span>:<span className="muted">รอคะแนน</span>}</td>
          <td data-label="ผู้บันทึก" className="evaluator-name"><small>{student.updatedBy?(userProfiles[student.updatedBy]||'ไม่ทราบชื่อ'):<span className="muted">—</span>}</small></td>
        </tr>)}
      </tbody></table></div>
      <div className="table-summary"><span>มีคะแนน <b>{scored.length}</b> คน</span><span>ขาดแข่งขัน <b>{absent}</b> คน</span><span>รอคะแนน <b>{scoreStudents.length-scored.length-absent}</b> คน</span></div>
    </div>}
    {calculatorStudent&&<div className="calc-modal-backdrop" role="dialog" aria-modal="true" aria-label={`คำนวณคะแนนของ ${calculatorStudent.name}`}>
      <div className="calc-modal">
        <div className="calc-modal-head"><div><b>คำนวณคะแนนและเวลา</b><small>{calculatorStudent.name}</small></div><button type="button" className="icon" onClick={()=>setCalculatorStudent(null)} aria-label="ปิดหน้าต่างคำนวณ"><X/></button></div>
        <div className="calc-modal-body">
          <div className="calc-mission-list">{missionRows.map((row,index)=>{const mission=calculatorResult.missions[index];return <div className="calc-mission-row" key={index}><span>{index+1}</span><input ref={element=>missionRefs.current[index]=element} value={row.value} inputMode="decimal" placeholder="1.21 หรือ 121" onKeyDown={event=>moveMission(index,event)} onChange={event=>updateMission(index,{value:event.target.value,mode:'time'})}/><button type="button" className={row.mode==='add5'?'active':''} onClick={()=>setMissionMode(index,'add5')}>+5</button><button type="button" className={row.mode==='dnf'?'active dnf':''} onClick={()=>setMissionMode(index,'dnf')}>DNF</button><strong className={mission.score===0?'zero':mission.score===5?'half':'full'}>{mission.score}</strong></div>})}</div>
          <div className="calc-summary"><div><small>เวลารวม</small><b>{calculatorResult.invalid?'--:--':calculatorResult.time}</b></div><div><small>คะแนนรวม</small><b>{calculatorResult.invalid?'--':calculatorResult.totalScore}<span>/50</span></b></div></div>
          {calculatorResult.invalid&&<p className="calc-error">ตรวจสอบรูปแบบเวลา เช่น 1.21 หรือ 121</p>}
        </div>
        <div className="calc-modal-actions"><button type="button" className="button" onClick={()=>setMissionRows(makeMissionRows())}><RotateCcw/>ล้าง</button><button type="button" className="primary" disabled={calculatorResult.invalid||editingBlocked} onClick={applyCalculatorResult}><CheckCircle2/>ใช้ผลนี้</button></div>
      </div>
    </div>}
    {transferPreview&&<div className="calc-modal-backdrop" role="dialog" aria-modal="true" aria-label={`ตรวจสอบการโอนคะแนนไปครั้งที่ ${transferPreview.targetRound}`}>
      <div className="calc-modal competition-transfer-modal">
        <div className="calc-modal-head"><div><b>ตรวจสอบก่อนโอนไปผลทดสอบ ครั้งที่ {transferPreview.targetRound}</b><small>{school?.name} · {transferPreview.source.name}</small></div><button type="button" className="icon" disabled={transferBusy} onClick={()=>setTransferPreview(null)} aria-label="ปิดหน้าต่าง"><X/></button></div>
        <div className="calc-modal-body">
          <div className="competition-transfer-round"><label>โอนไปผลทดสอบ</label><Select value={String(transferPreview.targetRound)} onChange={changeTransferRound} disabled={transferBusy}>{Array.from({length:6},(_,index)=><option value={index+1} key={index+1}>ครั้งที่ {index+1}</option>)}</Select>{transferBusy&&<Loader2 className="spin"/>}</div>
          <div className="competition-transfer-summary"><span><small>พร้อมโอน</small><b>{transferPreview.totals.transferable}</b> คน</span><span><small>ห้องที่พร้อม</small><b>{transferPreview.totals.readyRooms}</b>/{transferPreview.totals.rooms} ห้อง</span><span><small>คะแนนเดิมที่เก็บไว้</small><b>{transferPreview.totals.protected}</b> คน</span></div>
          <p className="competition-transfer-note"><ShieldCheck/>ต้องมีวันที่ ประเภทหุ่นยนต์ และชุดทดสอบครบทุกห้อง ระบบไม่แก้ไขคะแนนแข่งขันและไม่เขียนทับคะแนนเดิมในครั้งที่ {transferPreview.targetRound}</p>
          <div className="table-wrap"><table className="competition-transfer-table"><thead><tr><th>ห้อง</th><th>ข้อมูลการแข่งขัน</th><th>สถานะ</th><th className="center">โอนได้</th><th className="center">จัดการ</th></tr></thead><tbody>{transferPreview.rooms.map(room=>{const destinationIssue=['destination_metadata_missing','metadata_mismatch','destination_duplicate'].includes(room.status);return <tr key={room.classroomId}><td><b>{room.classroomName}</b></td><td className="competition-transfer-meta"><small>วันที่ {room.sourceMetadata.date||'—'}</small><small>หุ่น {room.sourceMetadata.robot||'—'}</small><small>ชุด {room.sourceMetadata.exam||'—'}</small></td><td><span className={`competition-transfer-status ${['ready','create'].includes(room.status)?'ready':room.status==='protected'?'protected':'warning'}`}>{transferStatusLabel(room)}</span>{room.protectedCount>0&&<small className="competition-transfer-protected">เก็บคะแนนเดิม {room.protectedCount} คน</small>}</td><td className="center">{room.transferableCount}</td><td className="center">{destinationIssue?<a className="button competition-transfer-action" href={`/scores?schoolId=${encodeURIComponent(schoolId)}&classId=${encodeURIComponent(room.classroomId)}&sessionId=${encodeURIComponent(room.destinationSessionId||'')}`} target="_blank" rel="noopener noreferrer">ตั้งค่าครั้งที่ {transferPreview.targetRound}</a>:!['ready','create','protected','source_empty'].includes(room.status)?<button type="button" className="button competition-transfer-action" onClick={()=>openCompetitionSetup(room)}>ตั้งค่าแข่งขัน</button>:<span className="muted">—</span>}</td></tr>})}</tbody></table></div>
        </div>
        <div className="calc-modal-actions"><button type="button" className="button" disabled={transferBusy} onClick={()=>setTransferPreview(null)}>ยกเลิก</button><button type="button" className="primary" disabled={!transferPreview.totals.transferable||transferBusy} onClick={confirmTransfer}>{transferBusy?<Loader2 className="spin"/>:<ArrowRightLeft/>}ยืนยันโอนไปครั้งที่ {transferPreview.targetRound} · {transferPreview.totals.transferable} คน</button></div>
      </div>
    </div>}
  </>;
}
