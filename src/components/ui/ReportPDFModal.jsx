import React, {useEffect, useState} from 'react';
import {Download, Eye, FileText, X} from 'lucide-react';
import Field from './Field';
import Select from './Select';

function ReportPDFModal({initialSelection,onClose,onPreview,onDownload}){
  const [selection,setSelection]=useState(initialSelection);
  const [busy,setBusy]=useState(false);

  useEffect(()=>setSelection(initialSelection),[initialSelection]);

  const run=async action=>{
    setBusy(true);
    try{await action(selection)}finally{setBusy(false)}
  };

  return <div className="report-pdf-backdrop" onMouseDown={event=>event.target===event.currentTarget&&!busy&&onClose()}>
    <div className="report-pdf-modal" role="dialog" aria-modal="true" aria-labelledby="report-pdf-title">
      <div className="report-pdf-head">
        <div className="report-pdf-title-icon"><FileText/></div>
        <div className="report-pdf-title"><span className="eyebrow">รายงานสรุป PDF</span><b id="report-pdf-title">สร้างรายงานที่ต้องการดู</b><small>เลือกรอบทดสอบและขอบเขตของข้อมูล</small></div>
        <button type="button" className="icon" onClick={onClose} disabled={busy} aria-label="ปิดหน้าต่างเลือกรายงาน"><X/></button>
      </div>
      <div className="report-pdf-body">
        <div className="report-pdf-note"><FileText size={17}/><span><b>ข้อมูลตรงตามรอบที่เลือก</b> ห้องที่ยังไม่มีข้อมูลจะแสดงสถานะ “ยังไม่มีข้อมูลครั้งนี้” โดยไม่ดึงผลจากรอบอื่นมาแทน</span></div>
        <Field label="เลือกครั้งที่ทดสอบ">
          <Select value={String(selection.testNumber||'')} onChange={value=>setSelection(current=>({...current,testNumber:Number(value)}))} disabled={busy}>
            {(selection.attempts||[]).map(attempt=><option key={attempt.number} value={attempt.number}>ครั้งที่ {attempt.number} · มีข้อมูล {attempt.roomCount}/{selection.totalRooms} ห้อง</option>)}
          </Select>
        </Field>
        <Field label="ต้องการแสดงข้อมูลของ">
          <div className="report-pdf-scope">
            <label className={selection.scope==='all'?'selected':''}><input type="radio" name="report-scope" checked={selection.scope==='all'} onChange={()=>setSelection(current=>({...current,scope:'all'}))} disabled={busy}/><span className="report-pdf-scope-copy"><b>ทุกห้องเรียน</b><small>สรุปผลทุกห้องในโรงเรียนสำหรับครั้งที่เลือก</small></span><span className="report-pdf-scope-tag">แนะนำ</span></label>
            <label className={selection.scope==='classroom'?'selected':''}><input type="radio" name="report-scope" checked={selection.scope==='classroom'} onChange={()=>setSelection(current=>({...current,scope:'classroom'}))} disabled={busy}/><span className="report-pdf-scope-copy"><b>เฉพาะห้องที่กำลังเลือก</b><small>{selection.classroomName||'ยังไม่ได้เลือกห้องเรียน'}</small></span></label>
          </div>
        </Field>
      </div>
      <div className="report-pdf-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button type="button" className="button" onClick={()=>run(onPreview)} disabled={busy}>{busy?<span className="button-spinner"/>:<Eye/>}ดูตัวอย่าง PDF</button>
        <button type="button" className="primary" onClick={()=>run(async value=>{await onDownload(value);onClose()})} disabled={busy}>{busy?<span className="button-spinner"/>:<Download/>}ดาวน์โหลด PDF</button>
      </div>
    </div>
  </div>;
}

export default ReportPDFModal;
