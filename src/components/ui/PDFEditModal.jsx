import React, {useEffect, useState} from 'react';
import {Download, Eye, Edit2, X} from 'lucide-react';
import Field from './Field';

function PDFEditModal({type,initialDraft,onClose,onPreview,onDownload,onWord}){
  const [draft,setDraft]=useState(initialDraft);
  const [busy,setBusy]=useState(false);
  const isSummary=type==='summary';

  useEffect(()=>setDraft(initialDraft),[initialDraft]);

  const update=(key,value)=>setDraft(current=>({...current,[key]:value}));
  const updateLayout=(key,value)=>setDraft(current=>({...current,layout:{...(current.layout||{}),[key]:value}}));
  const updateFeedback=(classroomId,value)=>setDraft(current=>({...current,feedbackRows:(current.feedbackRows||[]).map(row=>row.classroomId===classroomId?{...row,text:value}:row)}));
  const run=async action=>{
    setBusy(true);
    try{await action(draft)}finally{setBusy(false)}
  };

  return <div className="pdf-edit-backdrop">
    <div className="pdf-edit-card" role="dialog" aria-modal="true" aria-labelledby="pdf-edit-title">
      <div className="pdf-edit-head">
        <div><span className="eyebrow">แก้ไขเอกสาร PDF</span><b id="pdf-edit-title">แก้ไขโครงสร้างและส่งออก</b></div>
        <button type="button" className="icon" onClick={onClose} disabled={busy} aria-label="ปิดหน้าต่างแก้ไข"><X/></button>
      </div>
      <div className="pdf-edit-body">
        <div className="pdf-edit-note"><Edit2 size={16}/><span>การแก้ไขนี้ใช้กับไฟล์ PDF รอบนี้เท่านั้น ยังไม่บันทึกทับข้อมูลหลักในระบบ</span></div>
        <div className="form-grid">
          <Field label="ชื่อโรงเรียน" wide><input value={draft.schoolName||''} onChange={event=>update('schoolName',event.target.value)} /></Field>
          <Field label="ภาคเรียน"><input value={draft.term||''} onChange={event=>update('term',event.target.value)} inputMode="numeric" /></Field>
          <Field label="ปีการศึกษา"><input value={draft.year||''} onChange={event=>update('year',event.target.value)} inputMode="numeric" /></Field>
        </div>
        <div className="pdf-edit-structure">
          <div className="pdf-edit-section-title"><b>โครงสร้างเอกสาร</b><small>เลือกซ่อน/แสดงข้อความและองค์ประกอบที่จะส่งออก</small></div>
          <div className="pdf-edit-structure-grid">
            {[['schoolName','ชื่อโรงเรียน'],['reportTitle','หัวข้อรายงาน'],['curriculum','หัวข้อหลักสูตร'],['termYear','ภาคเรียนและปีการศึกษา'],['logo','โลโก้']].map(([key,label])=><label key={key} className="pdf-edit-check"><input type="checkbox" checked={draft.layout?.[key]!==false} onChange={event=>updateLayout(key,event.target.checked)}/><span>{label}</span></label>)}
            {isSummary&&<><label className="pdf-edit-check"><input type="checkbox" checked={draft.layout?.details!==false} onChange={event=>updateLayout('details',event.target.checked)}/><span>ตารางรายละเอียดการทดสอบ</span></label><label className="pdf-edit-check"><input type="checkbox" checked={draft.layout?.feedback!==false} onChange={event=>updateLayout('feedback',event.target.checked)}/><span>สรุปและข้อเสนอแนะ</span></label></>}
          </div>
          <Field label="ขนาดตัวอักษรทั้งเอกสาร"><div className="pdf-edit-range"><input type="range" min="0.8" max="1.3" step="0.05" value={draft.layout?.fontScale||1} onChange={event=>updateLayout('fontScale',Number(event.target.value))}/><b>{Math.round((draft.layout?.fontScale||1)*100)}%</b></div></Field>
        </div>
        {isSummary&&<div className="pdf-edit-feedback">
          <div className="pdf-edit-section-title"><b>สรุปและข้อเสนอแนะ</b><small>แก้ข้อความที่จะพิมพ์ลงใน PDF ได้โดยไม่เปลี่ยนข้อมูลต้นฉบับ</small></div>
          <div className="pdf-edit-feedback-list">
            {(draft.feedbackRows||[]).map(row=><Field key={row.classroomId} label={row.classroomName} wide><textarea value={row.text||''} onChange={event=>updateFeedback(row.classroomId,event.target.value)} rows={3} placeholder="พิมพ์สรุปและข้อเสนอแนะ" /></Field>)}
          </div>
        </div>}
        <div className="pdf-edit-limitation">คะแนน ลำดับ และค่าเฉลี่ยยังคำนวณจากข้อมูลในระบบ เพื่อป้องกันตัวเลขในรายงานไม่ตรงกับคะแนนจริง</div>
      </div>
      <div className="pdf-edit-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button type="button" className="button" onClick={()=>run(onPreview)} disabled={busy}>{busy?<span className="button-spinner"/>:<Eye/>}ดูตัวอย่าง PDF</button>
        <button type="button" className="button" onClick={()=>run(onWord)} disabled={busy}>{busy?<span className="button-spinner"/>:<Edit2/>}ส่งออก Word</button>
        <button type="button" className="primary" onClick={()=>run(async value=>{await onDownload(value);onClose()})} disabled={busy}>{busy?<span className="button-spinner"/>:<Download/>}ดาวน์โหลดฉบับแก้ไข</button>
      </div>
    </div>
  </div>;
}

export default PDFEditModal;
