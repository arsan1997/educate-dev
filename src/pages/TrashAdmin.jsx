import React, {useEffect, useState} from 'react';
import {Trash2, RotateCcw, X} from 'lucide-react';
import {loadDeletedSchools, restoreSchool, loadDeletedClassrooms, restoreClassroom, loadDeletedSessions, restoreSession, hardDeleteSchool, hardDeleteClassroom, hardDeleteSession, loadDeletedOnsiteEvaluations, restoreOnsiteEvaluation, hardDeleteOnsiteEvaluation} from '../dataService';

function TrashAdmin({flash, setConfirming}) {
  const [view, setView] = useState('school'); // 'school', 'classroom', 'session'
  const [deletedSchools, setDeletedSchools] = useState([]);
  const [deletedClassrooms, setDeletedClassrooms] = useState([]);
  const [deletedSessions, setDeletedSessions] = useState([]);
  const [deletedOnsite, setDeletedOnsite] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const formatDate = (isoString) => {
    if(!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('th-TH', {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
  };

  const refresh = async () => {
    setLoading(true);
    try {
      if(view === 'school') setDeletedSchools(await loadDeletedSchools());
      else if(view === 'classroom') setDeletedClassrooms(await loadDeletedClassrooms());
      else if(view === 'session') setDeletedSessions(await loadDeletedSessions());
      else if(view === 'onsite') setDeletedOnsite(await loadDeletedOnsiteEvaluations());
    } catch(e) {
      console.error(e);
      flash(`โหลดข้อมูลไม่สำเร็จ: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [view]);

  const handleRestore = (type, id, name) => {
    setConfirming({
      title: 'ยืนยันการกู้คืนข้อมูล',
      message: `คุณต้องการกู้คืน "${name}" ให้กลับไปแสดงในระบบตามปกติใช่หรือไม่?`,
      danger: false,
      dangerLabel: 'กู้คืน',
      onConfirm: async () => {
        try {
          if(type === 'school') await restoreSchool(id);
          else if(type === 'classroom') await restoreClassroom(id);
          else if(type === 'session') await restoreSession(id);
          else if(type === 'onsite') await restoreOnsiteEvaluation(id);
          flash(`กู้คืน ${name} สำเร็จ!`);
          refresh();
        } catch(e) {
          console.error(e);
          flash(`กู้คืนไม่สำเร็จ: ${e.message}`);
        }
      }
    });
  };

  const handleHardDelete = (type, id, name) => {
    setConfirming({
      title: 'ยืนยันการลบถาวร',
      message: `คุณแน่ใจหรือไม่ที่จะลบ "${name}" อย่างถาวร?\nข้อมูลนี้และข้อมูลที่เกี่ยวข้องทั้งหมดจะไม่สามารถกู้คืนได้อีก!`,
      dangerLabel: 'ลบถาวร',
      onConfirm: async () => {
        try {
          if(type === 'school') await hardDeleteSchool(id);
          else if(type === 'classroom') await hardDeleteClassroom(id);
          else if(type === 'session') await hardDeleteSession(id);
          else if(type === 'onsite') await hardDeleteOnsiteEvaluation(id);
          flash(`ลบ ${name} อย่างถาวรแล้ว!`);
          refresh();
        } catch(e) {
          console.error(e);
          flash(`ลบถาวรไม่สำเร็จ: ${e.message}`);
        }
      }
    });
  };

  const renderSchoolTable = () => (
    deletedSchools.length === 0 ? <div className="empty-state">ไม่มีข้อมูลโรงเรียนในถังขยะ</div> :
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ชื่อโรงเรียน</th>
            <th>ปีการศึกษา</th>
            <th>เทอม</th>
            <th>วันที่ลบ (ล่าสุด)</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {deletedSchools.filter(s=>!search.trim() || s.name.toLowerCase().includes(search.toLowerCase())).map(s => (
            <tr key={s.id}>
              <td><b>{s.name}</b></td>
              <td>{s.year || '-'}</td>
              <td>{s.term || '-'}</td>
              <td><small style={{color:'var(--muted)'}}>{formatDate(s.deletedAt)}</small></td>
              <td style={{display:'flex', gap:'8px'}}>
                <button className="button" style={{padding:'4px 8px'}} onClick={() => handleRestore('school', s.id, s.name)} title="กู้คืนข้อมูล"><RotateCcw size={16} /> กู้คืน</button>
                <button className="button danger-text" style={{padding:'4px 8px'}} onClick={() => handleHardDelete('school', s.id, s.name)} title="ลบถาวร"><X size={16} /> ลบถาวร</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderClassroomTable = () => (
    deletedClassrooms.length === 0 ? <div className="empty-state">ไม่มีข้อมูลชั้นเรียนในถังขยะ</div> :
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ชื่อชั้นเรียน</th>
            <th>โรงเรียน</th>
            <th>วันที่ลบ (ล่าสุด)</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {deletedClassrooms.filter(s=>!search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || (s.schoolName||'').toLowerCase().includes(search.toLowerCase())).map(s => (
            <tr key={s.id}>
              <td><b>{s.name}</b></td>
              <td>{s.schoolName || '-'}</td>
              <td><small style={{color:'var(--muted)'}}>{formatDate(s.deletedAt)}</small></td>
              <td style={{display:'flex', gap:'8px'}}>
                <button className="button" style={{padding:'4px 8px'}} onClick={() => handleRestore('classroom', s.id, s.name)} title="กู้คืนข้อมูล"><RotateCcw size={16} /> กู้คืน</button>
                <button className="button danger-text" style={{padding:'4px 8px'}} onClick={() => handleHardDelete('classroom', s.id, s.name)} title="ลบถาวร"><X size={16} /> ลบถาวร</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSessionTable = () => (
    deletedSessions.length === 0 ? <div className="empty-state">ไม่มีข้อมูลรอบการสอบในถังขยะ</div> :
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>รอบการสอบ</th>
            <th>ชั้นเรียน</th>
            <th>โรงเรียน</th>
            <th>วันที่ลบ (ล่าสุด)</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {deletedSessions.filter(s=>!search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || (s.className||'').toLowerCase().includes(search.toLowerCase()) || (s.schoolName||'').toLowerCase().includes(search.toLowerCase())).map(s => (
            <tr key={s.id}>
              <td><b>{s.name}</b></td>
              <td>{s.className || '-'}</td>
              <td>{s.schoolName || '-'}</td>
              <td><small style={{color:'var(--muted)'}}>{formatDate(s.deletedAt)}</small></td>
              <td style={{display:'flex', gap:'8px'}}>
                <button className="button" style={{padding:'4px 8px'}} onClick={() => handleRestore('session', s.id, s.name)} title="กู้คืนข้อมูล"><RotateCcw size={16} /> กู้คืน</button>
                <button className="button danger-text" style={{padding:'4px 8px'}} onClick={() => handleHardDelete('session', s.id, s.name)} title="ลบถาวร"><X size={16} /> ลบถาวร</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOnsiteTable = () => (
    deletedOnsite.length === 0 ? <div className="empty-state">ไม่มีใบปะหน้าหน้างานในถังขยะ</div> :
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>วันที่เข้าสอน</th>
            <th>วิทยากร</th>
            <th>ชั้นเรียน</th>
            <th>โรงเรียน</th>
            <th>วันที่ลบ (ล่าสุด)</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {deletedOnsite.filter(s=>!search.trim() || (s.trainer||'').toLowerCase().includes(search.toLowerCase()) || (s.className||'').toLowerCase().includes(search.toLowerCase())).map(s => (
            <tr key={s.id}>
              <td><b>{s.date ? new Date(s.date).toLocaleDateString('th-TH', {year: 'numeric', month: 'short', day: 'numeric'}) : '-'}</b></td>
              <td>{s.trainer || '-'}</td>
              <td>{s.className || '-'}</td>
              <td>{s.schoolName || '-'}</td>
              <td><small style={{color:'var(--muted)'}}>{formatDate(s.deletedAt)}</small></td>
              <td style={{display:'flex', gap:'8px'}}>
                <button className="button" style={{padding:'4px 8px'}} onClick={() => handleRestore('onsite', s.id, `ใบปะหน้าห้อง ${s.className || 'ไม่ระบุ'}`)} title="กู้คืนข้อมูล"><RotateCcw size={16} /> กู้คืน</button>
                <button className="button danger-text" style={{padding:'4px 8px'}} onClick={() => handleHardDelete('onsite', s.id, `ใบปะหน้าห้อง ${s.className || 'ไม่ระบุ'}`)} title="ลบถาวร"><X size={16} /> ลบถาวร</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return <>
    <div className="page-title">
      <div>
        <span className="eyebrow">ADMINISTRATION</span>
        <h1>ถังขยะ (กู้คืนข้อมูล)</h1>
        <p>กู้คืนข้อมูลที่ถูกลบไปแล้ว หรือเลือกลบถาวรเพื่อประหยัดพื้นที่</p>
      </div>
    </div>
    
    <div className="card" style={{borderLeft:'4px solid var(--danger)', marginBottom:'20px'}}>
      <div className="card-head" style={{color:'var(--danger)', paddingBottom:'10px'}}>
        <div>
          <b><Trash2 size={16} style={{display:'inline',verticalAlign:'text-bottom',marginRight:'4px'}}/> จัดการถังขยะ</b>
          <small>เลือกประเภทข้อมูลที่ต้องการดู</small>
        </div>
      </div>
      
      <div style={{padding:'0 20px 20px'}}>
        <div className="trash-toolbar" style={{display:'flex', gap:'10px', alignItems:'center', marginBottom: '20px', flexWrap: 'wrap', justifyContent:'space-between'}}>
          <div style={{display:'flex', gap:'10px'}}>
            <button className={`button ${view==='school'?'primary':''}`} onClick={()=>setView('school')}>โรงเรียน</button>
            <button className={`button ${view==='classroom'?'primary':''}`} onClick={()=>setView('classroom')}>ชั้นเรียน</button>
            <button className={`button ${view==='session'?'primary':''}`} onClick={()=>setView('session')}>รอบการทดสอบ</button>
            <button className={`button ${view==='onsite'?'primary':''}`} onClick={()=>setView('onsite')}>ใบปะหน้าหน้างาน</button>
          </div>
          <div style={{position:'relative', width:'300px', maxWidth:'100%'}}>
            <input type="text" placeholder="ค้นหาชื่อ..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:'100%', padding:'10px 15px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--bg)'}}/>
          </div>
        </div>
        
        {loading ? <div className="admin-loading" style={{padding:'20px', textAlign:'center'}}>กำลังโหลดข้อมูล…</div> : 
          view === 'school' ? renderSchoolTable() :
          view === 'classroom' ? renderClassroomTable() :
          view === 'session' ? renderSessionTable() :
          renderOnsiteTable()
        }
      </div>
    </div>
  </>;
}

export default TrashAdmin;
