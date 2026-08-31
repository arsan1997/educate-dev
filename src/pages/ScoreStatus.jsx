import React, {useEffect, useMemo, useState} from 'react';
import {AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock3, ExternalLink, RefreshCw, Search} from 'lucide-react';
import {loadScoreEntryStatus,loadScoreEntryRooms,loadScoreEntryTestRounds} from '../dataService';
import Select from '../components/ui/Select';

const thaiDateTime=value=>{
  if(!value)return '—';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '—';
  return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(date);
};
const isScoreComplete=row=>row.roomCount>0&&row.roomsWithoutSession===0&&row.pendingStudentCount===0;
const isFullyComplete=row=>isScoreComplete(row)&&row.roomsWithoutSuggestions===0;
const hasStartedScoring=row=>row.scoredStudentCount+row.absentStudentCount>0;
const isWaitingForSuggestions=row=>isScoreComplete(row)&&row.roomsWithoutSuggestions>0;

function ScoreStatus({offices=[]}){
  const [rows,setRows]=useState([]);
  const [officeId,setOfficeId]=useState('');
  const [search,setSearch]=useState('');
  const [testNumber,setTestNumber]=useState('');
  const [testRounds,setTestRounds]=useState([]);
  const [statusFilter,setStatusFilter]=useState('all');
  const [expanded,setExpanded]=useState({});
  const [showFullyScoredBySchool,setShowFullyScoredBySchool]=useState({});
  const [roomsBySchool,setRoomsBySchool]=useState({});
  const [roomLoading,setRoomLoading]=useState({});
  const [roomErrors,setRoomErrors]=useState({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const refresh=async()=>{
    setLoading(true);
    setError('');
    try{
      const [nextRows,nextRounds]=await Promise.all([loadScoreEntryStatus(testNumber===''?null:Number(testNumber)),loadScoreEntryTestRounds()]);
      setRows(nextRows);
      setTestRounds(nextRounds);
      setExpanded({});
      setShowFullyScoredBySchool({});
      setRoomsBySchool({});
      setRoomErrors({});
    }catch(err){
      console.error(err);
      setError(`ไม่สามารถโหลดสถานะการกรอกคะแนนได้: ${err.message||'โปรดลองอีกครั้ง'}`);
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{refresh()},[]);

  useEffect(()=>{
    if(loading)return;
    refresh();
  },[testNumber]);

  const toggleSchoolDetails=schoolId=>{
    const willExpand=!expanded[schoolId];
    setExpanded(current=>({...current,[schoolId]:willExpand}));
    if(!willExpand||roomsBySchool[schoolId]||roomLoading[schoolId])return;
    setRoomLoading(current=>({...current,[schoolId]:true}));
    setRoomErrors(current=>({...current,[schoolId]:''}));
    loadScoreEntryRooms(schoolId,testNumber===''?null:Number(testNumber)).then(rooms=>{
      setRoomsBySchool(current=>({...current,[schoolId]:rooms}));
    }).catch(err=>{
      console.error(err);
      setRoomErrors(current=>({...current,[schoolId]:err.message||'ไม่สามารถโหลดรายละเอียดห้องเรียนได้'}));
    }).finally(()=>{
      setRoomLoading(current=>({...current,[schoolId]:false}));
    });
  };

  const scopedRows=useMemo(()=>{
    const keyword=search.trim().toLocaleLowerCase('th-TH');
    return rows.filter(row=>(!officeId||String(row.officeId)===String(officeId))&&(!keyword||row.name.toLocaleLowerCase('th-TH').includes(keyword)));
  },[rows,officeId,search]);
  const summary=useMemo(()=>{
    const started=scopedRows.filter(row=>hasStartedScoring(row)&&!isScoreComplete(row));
    return {
      schools:scopedRows.length,
      started:started.length,
      empty:scopedRows.filter(row=>!hasStartedScoring(row)).length,
      feedback:scopedRows.filter(isWaitingForSuggestions).length,
      complete:scopedRows.filter(isFullyComplete).length
    };
  },[scopedRows]);
  const suggestionSummary=useMemo(()=>scopedRows.reduce((total,row)=>({
    withSuggestions:total.withSuggestions+row.roomsWithSuggestions,
    withoutSuggestions:total.withoutSuggestions+row.roomsWithoutSuggestions,
    exempt:total.exempt+row.roomsExemptFromSuggestions
  }),{withSuggestions:0,withoutSuggestions:0,exempt:0}),[scopedRows]);
  const statusFor=row=>{
    if(isFullyComplete(row))return row.absentStudentCount>0?{label:`เสร็จสมบูรณ์ · ขาด ${row.absentStudentCount} คน`,className:'complete'}:{label:'เสร็จสมบูรณ์',className:'complete'};
    if(isWaitingForSuggestions(row))return {label:'คะแนนครบ · รอข้อเสนอแนะ',className:'warning'};
    if(hasStartedScoring(row)&&!isScoreComplete(row))return {label:'อยู่ระหว่างกรอกคะแนน',className:'started'};
    return {label:row.roomsWithoutSession===row.roomCount?'ยังไม่ได้สร้างครั้งนี้':'รอกรอกคะแนน',className:'empty'};
  };
  const roomStatusFor=room=>{
    if(!room.hasTestSession)return {label:'ยังไม่ได้สร้างครั้งนี้',className:'empty'};
    if(room.studentCount===0)return {label:'ไม่มีนักเรียน',className:'empty'};
    if(room.pendingStudentCount===0)return room.absentStudentCount>0?{label:`คะแนนครบ · ขาด ${room.absentStudentCount} คน`,className:'complete'}:{label:'คะแนนครบทุกคน',className:'complete'};
    if(room.scoredStudentCount+room.absentStudentCount>0)return {label:'อยู่ระหว่างกรอกคะแนน',className:'started'};
    return {label:'รอกรอกคะแนน',className:'empty'};
  };
  const suggestionStatusFor=room=>{
    if(!room.hasTestSession)return {label:'ยังไม่มีรอบทดสอบ',className:'empty'};
    if(!room.suggestionsRequired)return {label:'ไม่ต้องกรอกข้อเสนอแนะ (ขาดทั้งหมด)',className:'exempt'};
    return room.hasSuggestions
      ?{label:'ข้อเสนอแนะกรอกแล้ว',className:'complete'}
      :{label:'ยังไม่กรอกข้อเสนอแนะ',className:'warning'};
  };
  const filteredRows=useMemo(()=>scopedRows.filter(row=>{
    if(statusFilter==='started')return hasStartedScoring(row)&&!isScoreComplete(row);
    if(statusFilter==='empty')return !hasStartedScoring(row);
    if(statusFilter==='feedback')return isWaitingForSuggestions(row);
    if(statusFilter==='complete')return isFullyComplete(row);
    return true;
  }),[scopedRows,statusFilter]);
  const scoreHref=(schoolId,classId='',sessionId='')=>{
    const query=new URLSearchParams({schoolId:String(schoolId)});
    if(classId)query.set('classId',String(classId));
    if(sessionId)query.set('sessionId',String(sessionId));
    return `/scores?${query.toString()}`;
  };

  return <>
    <div className="page-title score-status-title">
      <div>
        <span className="eyebrow">ติดตามการประเมินผล</span>
        <h1>สถานะการกรอกคะแนน</h1>
        <p>เลือกครั้งที่ทดสอบเพื่อดูสถานะของรอบนั้นโดยเฉพาะ</p>
      </div>
      <button type="button" className="button" onClick={refresh} disabled={loading}><RefreshCw className={loading?'spin':''}/>รีเฟรชข้อมูล</button>
    </div>

    <div className="card score-status-filters">
      <div className="field"><span>สำนักงาน</span><Select value={officeId} onChange={setOfficeId}><option value="">ทุกสำนักงาน</option>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select></div>
      <div className="field"><span>ครั้งที่ทดสอบ</span><Select value={testNumber} onChange={value=>{setTestNumber(value);setStatusFilter('all');setExpanded({});setShowFullyScoredBySchool({});setRoomsBySchool({});setRoomErrors({})}}><option value="">ทุกครั้งที่ทดสอบ</option>{testRounds.map(round=><option key={round} value={round}>ครั้งที่ {round}</option>)}</Select></div>
      <div className="field score-status-search"><span>ค้นหาโรงเรียน</span><div className="score-status-search-input"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="พิมพ์ชื่อโรงเรียน..."/></div></div>
    </div>

    <div className="stat-grid score-status-stats">
      {[
        ['โรงเรียนทั้งหมด',summary.schools,'แห่ง','all'],
        ['อยู่ระหว่างกรอกคะแนน',summary.started,'แห่ง','started'],
        ['ยังรอบันทึก',summary.empty,'แห่ง','empty'],
        ['รอข้อเสนอแนะ',summary.feedback,'แห่ง','feedback'],
        ['เสร็จสมบูรณ์',summary.complete,'แห่ง','complete']
      ].map(([label,value,unit,type])=><button type="button" className={`stat card score-status-stat ${type} ${statusFilter===type?'selected':''}`} onClick={()=>setStatusFilter(type)} aria-pressed={statusFilter===type} key={label}><small>{label}</small><strong>{value}</strong><span>{unit}</span></button>)}
    </div>

    <div className="card score-status-feedback-summary">
      <div><b>ข้อคิดเห็นและข้อเสนอแนะ (Suggestions)</b><small>ตรวจสอบแยกจากสถานะคะแนน เฉพาะห้องที่มีรอบทดสอบแล้ว</small></div>
       <div className="score-status-feedback-metrics"><span className="complete"><strong>{suggestionSummary.withSuggestions}</strong><small>ห้องกรอกแล้ว</small></span><span className="warning"><strong>{suggestionSummary.withoutSuggestions}</strong><small>ห้องยังไม่กรอก</small></span><span className="exempt"><strong>{suggestionSummary.exempt}</strong><small>ห้องไม่ต้องกรอก</small></span></div>
    </div>

    <div className="card score-status-card">
      <div className="card-head"><div><b>สถานะรายโรงเรียน</b><small>{testNumber?`แสดงเฉพาะครั้งที่ ${testNumber} · `:'แสดงภาพรวมทุกครั้ง · '}{statusFilter==='all'?'กดการ์ดด้านบนเพื่อกรอง แล้วกดดูห้องเรียนหรือเปิดหน้ากรอกคะแนน':'กำลังแสดงตามสถานะที่เลือก'}</small></div><span className="score-status-count">{filteredRows.length} โรงเรียน</span></div>
      {loading?<div className="score-status-message"><Clock3 className="spin"/>กำลังตรวจสอบคะแนน...</div>:error?<div className="score-status-message error">{error}</div>:!filteredRows.length?<div className="score-status-message">ไม่พบโรงเรียนตามเงื่อนไขที่เลือก</div>:<div className="table-wrap"><table className="score-status-table score-status-compact-table"><thead><tr><th>โรงเรียน</th><th>สถานะ</th><th>ความคืบหน้า</th><th className="center">รายละเอียด</th><th className="center">ดำเนินการ</th></tr></thead><tbody>{filteredRows.map(row=>{
        const status=statusFor(row);
        const isExpanded=Boolean(expanded[row.id]);
        const rooms=roomsBySchool[row.id]||[];
        const isFullyScored=room=>roomStatusFor(room).className==='complete'&&room.absentStudentCount===0&&suggestionStatusFor(room).className==='complete';
        const orderedRooms=[...rooms].sort((a,b)=>Number(isFullyScored(a))-Number(isFullyScored(b)));
        const fullyScoredRooms=orderedRooms.filter(isFullyScored);
        const visibleRooms=showFullyScoredBySchool[row.id]?orderedRooms:orderedRooms.filter(room=>!isFullyScored(room));
        return <React.Fragment key={row.id}>
          <tr className="score-status-school-row">
            <td data-label="โรงเรียน"><b><a className="score-status-school-link" href={scoreHref(row.id)} target="_blank" rel="noopener noreferrer">{row.name}</a></b>{(row.term||row.year)&&<small>เทอม {row.term||'—'} · ปี {row.year||'—'}</small>}</td>
            <td data-label="สถานะ"><span className={`score-status-badge ${status.className}`}>{status.className!=='empty'&&<CheckCircle2/>}{status.label}</span><small>{row.roomsWithScores}/{row.roomCount} ห้องมีคะแนน</small><small>{row.roomsWithSuggestions+row.roomsWithoutSuggestions>0?`${row.roomsWithSuggestions}/${row.roomsWithSuggestions+row.roomsWithoutSuggestions} ห้องมีข้อเสนอแนะ`:'ยังไม่มีรอบทดสอบสำหรับข้อเสนอแนะ'}{row.roomsExemptFromSuggestions>0?` · ไม่ต้องกรอก ${row.roomsExemptFromSuggestions} ห้อง`:''}</small></td>
            <td data-label="ความคืบหน้า"><div className="score-status-progress"><b>{row.scoredStudentCount}/{row.studentCount} คน</b><small>มีคะแนน · ขาด {row.absentStudentCount} · รอ {row.pendingStudentCount}</small><small>อัปเดต {thaiDateTime(row.updatedAt)}</small></div></td>
            <td data-label="รายละเอียด" className="center"><button type="button" className="button score-status-expand" onClick={()=>toggleSchoolDetails(row.id)}>{isExpanded?<><ChevronUp/>ซ่อน</>:<><ChevronDown/>ดูห้อง</>}</button></td>
            <td data-label="ดำเนินการ" className="center"><a className="button score-status-open-score" href={scoreHref(row.id)} target="_blank" rel="noopener noreferrer"><ExternalLink/>ไปกรอกคะแนน</a></td>
          </tr>
          {isExpanded&&<tr className="score-status-details"><td colSpan="5"><div className="score-status-room-list">{roomLoading[row.id]?<div className="score-status-inline-message"><Clock3 className="spin"/>กำลังโหลดรายละเอียดห้องเรียน...</div>:roomErrors[row.id]?<div className="score-status-inline-message error">{roomErrors[row.id]}</div>:<>{visibleRooms.map(room=>{
            const roomStatus=roomStatusFor(room);
            const suggestionStatus=suggestionStatusFor(room);
            return <div className="score-status-room" key={room.id}><div><b>{room.name}</b><small>{room.hasTestSession&&room.latestTest?`${room.latestTest}${room.latestTestDate?` · ${room.latestTestDate}`:''}`:'ยังไม่ได้สร้างครั้งที่เลือก'} · อัปเดต {thaiDateTime(room.updatedAt)}</small></div><div className="score-status-room-state"><span className={`score-status-badge ${roomStatus.className}`}>{roomStatus.className!=='empty'&&<CheckCircle2/>}{roomStatus.label}</span><span className={`score-status-badge ${suggestionStatus.className}`}>{suggestionStatus.className==='complete'?<CheckCircle2/>:suggestionStatus.className==='warning'?<AlertCircle/>:null}{suggestionStatus.label}</span></div><div className="score-status-progress"><b>{room.scoredStudentCount}/{room.studentCount} คน</b><small>มีคะแนน · ขาด {room.absentStudentCount} · รอ {room.pendingStudentCount}</small></div><a className="button score-status-open-score" href={scoreHref(row.id,room.id,room.sessionId)} target="_blank" rel="noopener noreferrer"><ExternalLink/>เปิดห้องนี้</a></div>})}{!visibleRooms.length&&fullyScoredRooms.length>0&&<div className="score-status-inline-message">ทุกห้องมีคะแนนและข้อเสนอแนะครบแล้ว</div>}{fullyScoredRooms.length>0&&<button type="button" className="score-status-completed-toggle" onClick={()=>setShowFullyScoredBySchool(current=>({...current,[row.id]:!current[row.id]}))}>{showFullyScoredBySchool[row.id]?`ซ่อนห้องที่คะแนนและข้อเสนอแนะครบ ${fullyScoredRooms.length} ห้อง`:`แสดงห้องที่คะแนนและข้อเสนอแนะครบ ${fullyScoredRooms.length} ห้อง`}</button>}{!visibleRooms.length&&!fullyScoredRooms.length&&<div className="score-status-inline-message">ยังไม่มีห้องเรียนในโรงเรียนนี้</div>}</>}</div></td></tr>}
        </React.Fragment>;
      })}</tbody></table></div>}
    </div>
  </>;
}

export default ScoreStatus;
