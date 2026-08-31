import React, {useEffect, useMemo, useState} from 'react';
import {School, Upload, Plus, X, Loader2} from 'lucide-react';
import {loadSchoolDetail} from '../../dataService';
import Field from '../ui/Field';
import Select from '../ui/Select';

const schoolIdentity = s => `${(s.name||'').trim()}::${s.year}::${s.term}`;

function ImportOfficeModal({school, schools, offices, onAddOffice, onConfirm, onClose}){
  const [officeId,setOfficeId]=useState('');
  const [newOffice,setNewOffice]=useState(''),[addingOffice,setAddingOffice]=useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [existingDetail, setExistingDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [manualOverrideId, setManualOverrideId] = useState('');
  
  const candidateIdentity = schoolIdentity(school);
  const duplicate = useMemo(() => {
    if (manualOverrideId) return schools?.find(s => s.id === manualOverrideId);
    return schools?.find(item => schoolIdentity(item) === candidateIdentity);
  }, [schools, candidateIdentity, manualOverrideId]);

  useEffect(() => {
    if (duplicate) {
      setLoadingDetail(true);
      loadSchoolDetail(duplicate.id)
        .then(detail => {
          setExistingDetail(detail);
          setLoadingDetail(false);
          setSelectedClasses(school.classrooms.map(c => c.id));
        })
        .catch(err => {
          console.error(err);
          setLoadingDetail(false);
        });
    } else {
      setSelectedClasses(school.classrooms.map(c => c.id));
    }
  }, [duplicate?.id, school.classrooms]); // safely depend on duplicate.id to avoid unnecessary re-fetches

  const toggleClass = id => {
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const ready = { ...school, loaded: true };
    const chosenClassrooms = ready.classrooms.filter(c => selectedClasses.includes(c.id));
    
    if (duplicate && existingDetail) {
      ready.id = duplicate.id;
      ready.officeId = duplicate.officeId;
      
      const mergedClassrooms = [];
      const mergedSessions = [];
      
      chosenClassrooms.forEach(importedClass => {
        const existingClass = existingDetail.classrooms.find(c => c.name === importedClass.name);
        if (existingClass) {
          const updatedClass = { ...importedClass, id: existingClass.id };
          const mergedStudents = [...existingClass.students];
          
          // Mark students not in import as inactive, reactivate others
          mergedStudents.forEach((es, i) => {
             const foundInImport = importedClass.students.find(s => String(s.no) === String(es.no));
             if (!foundInImport) {
               mergedStudents[i] = { ...es, active: false };
             }
          });
          
          importedClass.students.forEach(importSt => {
             const existIndex = mergedStudents.findIndex(s => String(s.no) === String(importSt.no));
             if (existIndex >= 0) {
                mergedStudents[existIndex] = { ...mergedStudents[existIndex], name: importSt.name, firstName: importSt.firstName, lastName: importSt.lastName, prefix: importSt.prefix, active: true };
             } else {
                mergedStudents.push({ ...importSt, active: true });
             }
          });
          
          updatedClass.students = mergedStudents;
          mergedClassrooms.push(updatedClass);
          mergedSessions.push(...existingDetail.sessions.filter(x => x.classId === existingClass.id));
        } else {
          mergedClassrooms.push(importedClass);
          mergedSessions.push(...ready.sessions.filter(x => x.classId === importedClass.id));
        }
      });
      
      // Retain existing classrooms that were NOT in the import
      existingDetail.classrooms.forEach(existingClass => {
        if (!chosenClassrooms.find(c => c.name === existingClass.name)) {
          mergedClassrooms.push(existingClass);
          mergedSessions.push(...existingDetail.sessions.filter(x => x.classId === existingClass.id));
        }
      });
      
      ready.classrooms = mergedClassrooms;
      ready.sessions = mergedSessions;
      await onConfirm(ready);
    } else {
      ready.classrooms = chosenClassrooms;
      ready.sessions = ready.sessions.filter(s => selectedClasses.includes(s.classId));
      ready.officeId = officeId;
      await onConfirm(ready);
    }
    setIsSubmitting(false);
  };

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal-card">
      <div className="modal-head"><div><span className="eyebrow">ก่อนนำเข้าข้อมูล</span><h2>ตรวจสอบการนำเข้า</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="ปิด"><X/></button></div>
      <div className="import-office-body">
        <div className="import-school-summary"><School/><span><small>โรงเรียนจากไฟล์ Excel</small><b>{school.name}</b><small>{school.classrooms.length} ห้อง · {school.sessions.length} ครั้งทดสอบ</small></span></div>
        
        {loadingDetail && <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)', marginTop: '1rem'}}><Loader2 size={16} className="spinning" /> กำลังตรวจสอบข้อมูลเดิม...</div>}
        
        {!loadingDetail && duplicate && (
          <div style={{background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '0.75rem 1rem', borderRadius: '8px', marginTop: '1rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <h4 style={{margin: 0, fontSize: '0.9rem', marginBottom: '0.25rem'}}>เป็นการอัปเดตโรงเรียนเดิม</h4>
                <p style={{margin: 0, fontSize: '0.85rem', opacity: 0.9}}>พบข้อมูล <b>{duplicate.name}</b> อยู่แล้ว ระบบจะอัปเดตเฉพาะรายชื่อนักเรียน โดยไม่ทับคะแนนสอบเดิม</p>
              </div>
              {manualOverrideId && (
                <button type="button" style={{background: 'rgba(0,0,0,0.1)', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--primary-dark)'}} onClick={() => setManualOverrideId('')}>ยกเลิกการรวม</button>
              )}
            </div>
          </div>
        )}

        {!loadingDetail && !duplicate && (
          <>
            <div style={{background: 'var(--surface-light)', padding: '1rem', borderRadius: '8px', marginTop: '1rem', border: '1px solid var(--border)'}}>
               <Field label="หากนี่คือไฟล์อัปเดตของโรงเรียนที่มีอยู่แล้วในระบบ โปรดเลือกโรงเรียนที่ต้องการรวมข้อมูล">
                  <Select value={manualOverrideId} onChange={setManualOverrideId}>
                    <option value="">-- สร้างเป็นโรงเรียนใหม่ --</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name} (ปี {s.year} เทอม {s.term})</option>)}
                  </Select>
               </Field>
            </div>
            <div style={{marginTop: '1rem'}}>
              <Field label="สำนักงานที่รับผิดชอบ (สำหรับโรงเรียนใหม่)">
                <div className="office-picker">
                  <Select value={officeId} onChange={setOfficeId}>
                    <option value="">ยังไม่ระบุสำนักงาน</option>
                    {offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}
                  </Select>
                  <button type="button" className="button" onClick={()=>setAddingOffice(!addingOffice)}><Plus/>เพิ่มสำนักงาน</button>
                </div>
              </Field>
            </div>
          </>
        )}
        {!loadingDetail && addingOffice && !duplicate && (
          <div className="office-create"><input autoFocus value={newOffice} onChange={e=>setNewOffice(e.target.value)} placeholder="ชื่อสำนักงาน เช่น สำนักงานหาดใหญ่"/><button type="button" className="primary" disabled={!newOffice.trim()} onClick={async()=>{const office=await onAddOffice(newOffice);if(office){setOfficeId(office.id);setNewOffice('');setAddingOffice(false)}}}>บันทึกสำนักงาน</button></div>
        )}

        {!loadingDetail && (
          <div className="import-classrooms-list" style={{marginTop: '1.5rem'}}>
            <h4 style={{margin: 0, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)'}}>สรุปการเปลี่ยนแปลง (Diff Summary)</h4>
            <div className="classrooms-scroll" style={{maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)'}}>
              {school.classrooms.map(c => {
                const exist = existingDetail?.classrooms.find(xc => xc.name === c.name);
                let diffInfo = null;
                
                if (exist) {
                  const newCount = c.students.filter(st => !exist.students.find(es => String(es.no) === String(st.no))).length;
                  const droppedCount = exist.students.filter(es => es.active !== false && !c.students.find(st => String(st.no) === String(es.no))).length;
                  const updateCount = c.students.length - newCount;
                  
                  diffInfo = (
                    <div style={{marginTop: '6px', fontSize: '0.8rem', display: 'flex', gap: '1rem', color: 'var(--text-light)'}}>
                       <span title="นักเรียนเลขที่ใหม่ที่ถูกเพิ่มเข้ามา"><b style={{color: '#15803d'}}>+{newCount}</b> เพิ่มใหม่</span>
                       <span title="นักเรียนที่มีเลขที่ตรงกับข้อมูลเดิม"><b style={{color: '#a16207'}}>~{updateCount}</b> อัปเดต/คงเดิม</span>
                       <span title="นักเรียนเก่าที่ไม่มีในไฟล์นี้ จะถูกระงับ (Inactivate)"><b style={{color: '#b91c1c'}}>-{droppedCount}</b> ระงับ</span>
                    </div>
                  );
                }
                
                return (
                  <label key={c.id} style={{display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', margin: 0}}>
                    <input type="checkbox" checked={selectedClasses.includes(c.id)} onChange={() => toggleClass(c.id)} style={{marginTop: '4px'}} />
                    <div style={{flex: 1}}>
                      <div style={{display: 'flex', alignItems: 'center'}}>
                        <span style={{fontWeight: 500}}>{c.name}</span>
                        {exist ? (
                          <span style={{marginLeft: 'auto', background: 'rgba(234,179,8,0.15)', color: '#a16207', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 500}}>อัปเดตรายชื่อ</span>
                        ) : (
                          <span style={{marginLeft: 'auto', background: 'rgba(34,197,94,0.15)', color: '#15803d', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 500}}>เพิ่มห้องใหม่ (+{c.students.length} คน)</span>
                        )}
                      </div>
                      {diffInfo}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="button" onClick={onClose}>ยกเลิก</button>
        <button type="button" className="primary" disabled={isSubmitting || loadingDetail || selectedClasses.length === 0} onClick={handleConfirm}>
          {isSubmitting ? <Loader2 size={18} className="spinning" style={{marginRight: '0.5rem'}}/> : <Upload size={18} style={{marginRight: '0.5rem'}}/>} ยืนยันการนำเข้า
        </button>
      </div>
    </div>
  </div>
}

export default ImportOfficeModal;
