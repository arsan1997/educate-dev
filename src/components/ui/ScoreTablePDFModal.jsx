import React, {useEffect, useState} from 'react';
import {Download, Eye, FileText, X} from 'lucide-react';
import Field from './Field';
import Select from './Select';

function ScoreTablePDFModal({initialSelection,onClose,onPreview,onDownload}){
  const [selection,setSelection]=useState(initialSelection);
  const [busy,setBusy]=useState(false);

  useEffect(()=>setSelection(initialSelection),[initialSelection]);

  const selectClassroom=classroomId=>{
    const classroom=(selection.classrooms||[]).find(item=>String(item.id)===String(classroomId));
    setSelection(current=>({...current,classroomId,classroomName:classroom?.name||''}));
  };
  const run=async action=>{
    setBusy(true);
    try{await action(selection)}finally{setBusy(false)}
  };
  const classroomReady=selection.scope!=='classroom'||Boolean(selection.classroomId);

  return <div className="report-pdf-backdrop" onMouseDown={event=>event.target===event.currentTarget&&!busy&&onClose()}>
    <div className="report-pdf-modal" role="dialog" aria-modal="true" aria-labelledby="score-table-pdf-title">
      <div className="report-pdf-head">
        <div className="report-pdf-title-icon"><FileText/></div>
        <div className="report-pdf-title"><span className="eyebrow">PDF ตารางคะแนน</span><b id="score-table-pdf-title">เลือกชั้นที่ต้องการส่งออก</b><small>เลือกทุกห้องหรือส่งออกเฉพาะชั้นเรียน</small></div>
        <button type="button" className="icon" onClick={onClose} disabled={busy} aria-label="ปิดหน้าต่างเลือกชั้น"><X/></button>
      </div>
      <div className="report-pdf-body">
        <div className="report-pdf-note"><FileText size={17}/><span><b>คะแนนครบทุกครั้งทดสอบ</b> PDF จะแสดงคะแนน ลำดับ และเวลาของชั้นเรียนที่เลือก</span></div>
        <Field label="ต้องการส่งออกข้อมูลของ">
          <div className="report-pdf-scope">
            <label className={selection.scope==='all'?'selected':''}><input type="radio" name="score-table-scope" checked={selection.scope==='all'} onChange={()=>setSelection(current=>({...current,scope:'all'}))} disabled={busy}/><span className="report-pdf-scope-copy"><b>ทุกห้องเรียน</b><small>รวมตารางคะแนนทุกชั้นในโรงเรียนไว้ในไฟล์เดียว</small></span></label>
            <label className={selection.scope==='classroom'?'selected':''}><input type="radio" name="score-table-scope" checked={selection.scope==='classroom'} onChange={()=>setSelection(current=>({...current,scope:'classroom'}))} disabled={busy}/><span className="report-pdf-scope-copy"><b>เฉพาะชั้นเรียน</b><small>{selection.classroomName||'กรุณาเลือกชั้นเรียน'}</small></span><span className="report-pdf-scope-tag">เลือกได้</span></label>
          </div>
        </Field>
        {selection.scope==='classroom'&&<Field label="เลือกชั้นเรียน">
          <Select value={selection.classroomId||''} onChange={selectClassroom} disabled={busy} dropUp>
            <option value="" disabled hidden>เลือกชั้นเรียน</option>
            {(selection.classrooms||[]).map(classroom=><option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
          </Select>
        </Field>}
      </div>
      <div className="report-pdf-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button type="button" className="button" onClick={()=>run(onPreview)} disabled={busy||!classroomReady}>{busy?<span className="button-spinner"/>:<Eye/>}ดูตัวอย่าง PDF</button>
        <button type="button" className="primary" onClick={()=>run(async value=>{await onDownload(value);onClose()})} disabled={busy||!classroomReady}>{busy?<span className="button-spinner"/>:<Download/>}ดาวน์โหลด PDF</button>
      </div>
    </div>
  </div>;
}

export default ScoreTablePDFModal;
