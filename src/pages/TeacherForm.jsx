import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { School, CheckCircle2, Loader2, Send, CheckSquare, Square, Bot, Calendar, Clock, Search } from 'lucide-react';
import { loadSchoolIndex, saveTeacherRequests, loadTeacherRequests, loadOffices, lookupTeacherRequestSchool } from '../dataService';
import brandLogo from '../assets/logo.png';
import Select from '../components/ui/Select';
import Field from '../components/ui/Field';
import { ROBOT_TYPES } from '../model';
import Swal from 'sweetalert2';

const normalizeSchoolName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[๐-๙]/g, digit => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit)))
    .replace(/^(โรงเรียน|รร\.?|ร\.ร\.)\s*/u, '')
    .replace(/[\s.()（）\-_\/]+/g, '');

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

const TEACHER_REQUEST_MIN_SECONDS = 3;
const TEACHER_REQUEST_COOLDOWN_SECONDS = 20;
const LEARNING_CONTENT_OPTIONS = ['เทอม 1', 'เทอม 2'];
const normalizeLearningContent = value => {
  const text = String(value || '').trim();
  if (/^2(?:\D|$)|เทอม\s*2|term\s*2/i.test(text)) return 'เทอม 2';
  return 'เทอม 1';
};
const teacherRequestCooldownKey = (schoolId) => `teacher-request-last-submit:${schoolId}`;
const teacherRequestPendingKey = (schoolId) => `teacher-request-pending-classes:${schoolId}`;
const readLocalPendingClassIds = (schoolId) => {
  if (!schoolId) return [];
  try {
    const value = JSON.parse(localStorage.getItem(teacherRequestPendingKey(schoolId)) || '[]');
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
};
const rememberLocalPendingClassIds = (schoolId, classIds) => {
  if (!schoolId || !classIds.length) return;
  const merged = new Set([...readLocalPendingClassIds(schoolId), ...classIds.map(String)]);
  localStorage.setItem(teacherRequestPendingKey(schoolId), JSON.stringify([...merged]));
};
const syncLocalPendingClassIds = (schoolId, classIds) => {
  if (!schoolId) return;
  localStorage.setItem(teacherRequestPendingKey(schoolId), JSON.stringify([...new Set(classIds.map(String))]));
};
const escapeSwalHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

export default function TeacherForm() {
  const [schools, setSchools] = useState([]);
  const [offices, setOffices] = useState([]);
  const [filterOfficeId, setFilterOfficeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUpSchool, setLookingUpSchool] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requests, setRequests] = useState([]);
  
  const [schoolId, setSchoolId] = useState('');
  const [schoolNameInput, setSchoolNameInput] = useState('');
  const [schoolLookupMessage, setSchoolLookupMessage] = useState('');
  const [website, setWebsite] = useState('');
  
  // Object mapping classId -> { robot, term, period }
  const [configs, setConfigs] = useState({});
  const formStartedAtRef = useRef(Date.now());
  const [searchParams] = useSearchParams();
  const editSchoolId = searchParams.get('edit');
  const isEdit = !!editSchoolId;

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }

    Promise.all([
      loadSchoolIndex(),
      loadTeacherRequests().catch(() => []),
      loadOffices()
    ]).then(([schoolData, requestsData, officeData]) => {
      setSchools(schoolData);
      setOffices(officeData);
      setRequests(requestsData);
      
      if (isEdit) {
        setSchoolId(editSchoolId);
        const editSchool = schoolData.find(s => String(s.id) === String(editSchoolId));
        setSchoolNameInput(editSchool?.name || '');
        const schoolRequests = requestsData.filter(r => String(r.school_id) === String(editSchoolId) && r.status === 'pending');
        const loadedConfigs = {};
        schoolRequests.forEach(r => {
          loadedConfigs[r.classroom_id] = {
            robot: r.robot_type,
            term: normalizeLearningContent(r.academic_term),
            period: r.teaching_period
          };
        });
        setConfigs(loadedConfigs);
      }
      
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [isEdit, editSchoolId]);

  const selectedSchool = schools.find(s => s.id === schoolId);
  const classrooms = selectedSchool?.classrooms || [];
  const pendingClassIds = new Set(
    [
      ...requests
      .filter(r => String(r.school_id) === String(schoolId) && r.status === 'pending')
      .map(r => String(r.classroom_id)),
      ...readLocalPendingClassIds(schoolId)
    ]
  );
  const selectableClassrooms = isEdit ? classrooms : classrooms.filter(c => !pendingClassIds.has(String(c.id)));

  const handleSchoolInputChange = (value) => {
    setSchoolNameInput(value);
    if (!isEdit) {
      setSchoolId('');
      setConfigs({});
      setSchoolLookupMessage('');
      formStartedAtRef.current = Date.now();
    }
  };

  const handleSchoolLookup = async () => {
    const term = normalizeSchoolName(schoolNameInput);
    if (!term) {
      setSchoolId('');
      setConfigs({});
      setSchoolLookupMessage('กรุณาพิมพ์ชื่อโรงเรียนก่อนตรวจสอบ');
      return;
    }

    setLookingUpSchool(true);
    setSchoolLookupMessage('กำลังตรวจสอบชื่อโรงเรียน...');
    try {
      const matches = await lookupTeacherRequestSchool(schoolNameInput);
      if (matches.length === 1) {
        const matchedSchool = matches[0];
        const pendingClassroomIds = (matchedSchool.pendingClassroomIds || []).map(String);
        syncLocalPendingClassIds(matchedSchool.id, pendingClassroomIds);
        setSchools(matches);
        setRequests([...new Set(pendingClassroomIds)].map(classroomId => ({
          school_id: matchedSchool.id,
          classroom_id: classroomId,
          status: 'pending'
        })));
        setSchoolId(matchedSchool.id);
        setSchoolNameInput(matchedSchool.name);
        setConfigs({});
        setSchoolLookupMessage(`พบโรงเรียน ${matchedSchool.name}`);
        return;
      }

      setSchoolId('');
      setConfigs({});
      setRequests([]);
      setSchools([]);
      setSchoolLookupMessage(matches.length > 1
        ? 'พบหลายโรงเรียนที่ใกล้เคียงกัน กรุณาพิมพ์ชื่อให้ละเอียดขึ้น'
        : 'ไม่พบชื่อโรงเรียน กรุณาตรวจสอบชื่อหรือแจ้งทีมงาน');
    } catch (err) {
      console.error(err);
      setSchoolId('');
      setConfigs({});
      setRequests([]);
      setSchools([]);
      setSchoolLookupMessage('ตรวจสอบชื่อโรงเรียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLookingUpSchool(false);
    }
  };

  const toggleClass = (classId) => {
    if (!isEdit && pendingClassIds.has(String(classId))) return;
    setConfigs(prev => {
      const next = { ...prev };
      if (next[classId]) {
        delete next[classId];
      } else {
        // Default values when selected
        next[classId] = { robot: 'Code & Go', term: 'เทอม 1', period: '1' };
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const activeCount = Object.keys(configs).length;
    if (activeCount === selectableClassrooms.length) {
      setConfigs({});
    } else {
      const next = {};
      selectableClassrooms.forEach(c => {
        next[c.id] = configs[c.id] || { robot: 'Code & Go', term: 'เทอม 1', period: '1' };
      });
      setConfigs(next);
    }
  };

  const updateConfig = (classId, key, value) => {
    setConfigs(prev => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        [key]: value
      }
    }));
  };
  const isSubmittingRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!isEdit && website.trim()) {
      setSubmitted(true);
      return;
    }
    
    const activeIds = Object.keys(configs);
    if (!schoolId) return themeSwal.fire({
      icon: 'warning',
      iconColor: 'var(--orange)',
      title: 'แจ้งเตือน',
      text: 'กรุณาพิมพ์ชื่อโรงเรียนและกดตรวจสอบก่อนส่งข้อมูล',
      confirmButtonText: 'ตกลง'
    });
    if (activeIds.length === 0) return themeSwal.fire({
      icon: 'warning',
      iconColor: 'var(--orange)',
      title: 'แจ้งเตือน',
      text: 'กรุณาติ๊กเลือกชั้นเรียนอย่างน้อย 1 ห้อง',
      confirmButtonText: 'ตกลง'
    });

    if (!isEdit) {
      const secondsOnForm = (Date.now() - formStartedAtRef.current) / 1000;
      if (secondsOnForm < TEACHER_REQUEST_MIN_SECONDS) {
        return themeSwal.fire({
          icon: 'warning',
          iconColor: 'var(--orange)',
          title: 'กรุณาตรวจสอบข้อมูลอีกครั้ง',
          text: 'กรุณารอสักครู่แล้วกดส่งข้อมูลใหม่อีกครั้ง',
          confirmButtonText: 'ตกลง'
        });
      }

      const lastSubmit = Number(localStorage.getItem(teacherRequestCooldownKey(schoolId)) || 0);
      const remainingSeconds = TEACHER_REQUEST_COOLDOWN_SECONDS - Math.floor((Date.now() - lastSubmit) / 1000);
      if (remainingSeconds > 0) {
        return themeSwal.fire({
          icon: 'info',
          iconColor: 'var(--accent)',
          title: 'ส่งข้อมูลเร็วเกินไป',
          text: `กรุณารอประมาณ ${remainingSeconds} วินาทีก่อนส่งคำขอเพิ่มเติม`,
          confirmButtonText: 'ตกลง'
        });
      }

      const requestSummary = activeIds.map(classId => {
        const classroomName = classrooms.find(c => String(c.id) === String(classId))?.name || 'ไม่ทราบชื่อชั้นเรียน';
        const config = configs[classId] || {};
        return `
          <li style="padding:8px 0;border-bottom:1px solid var(--line);text-align:left">
            <b>${escapeSwalHtml(classroomName)}</b><br/>
            <small>หุ่นยนต์: ${escapeSwalHtml(config.robot || '-')} · เนื้อหาที่เรียน: ${escapeSwalHtml(normalizeLearningContent(config.term))} · คาบสอน: ${escapeSwalHtml(config.period || '-')}</small>
          </li>
        `;
      }).join('');

      const confirmResult = await themeSwal.fire({
        icon: 'question',
        iconColor: 'var(--brand)',
        title: 'ยืนยันส่งคำขอเตรียมความพร้อม?',
        html: `
          <div style="text-align:left;line-height:1.7">
            <p style="margin:0 0 10px">กรุณาตรวจสอบข้อมูลก่อนส่งแจ้งทีมงาน</p>
            <p style="margin:0 0 8px"><b>โรงเรียน:</b> ${escapeSwalHtml(selectedSchool?.name || schoolNameInput)}</p>
            <p style="margin:0 0 8px"><b>จำนวนห้องเรียน:</b> ${activeIds.length} ห้อง</p>
            <ul style="margin:8px 0 0;padding-left:18px;max-height:220px;overflow:auto">${requestSummary}</ul>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'ยืนยันส่งข้อมูล',
        cancelButtonText: 'กลับไปตรวจสอบ',
        reverseButtons: true
      });
      if (!confirmResult.isConfirmed) return;
    }
    
    isSubmittingRef.current = true;
    setSubmitting(true);
    try {
      await saveTeacherRequests(configs, schoolId, isEdit);
      if (!isEdit) {
        localStorage.setItem(teacherRequestCooldownKey(schoolId), String(Date.now()));
        rememberLocalPendingClassIds(schoolId, activeIds);
        setRequests(prev => {
          const seen = new Set(prev.map(row => `${row.school_id}:${row.classroom_id}`));
          const additions = activeIds
            .map(classroomId => ({ school_id: schoolId, classroom_id: classroomId, status: 'pending' }))
            .filter(row => {
              const key = `${row.school_id}:${row.classroom_id}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          return [...prev, ...additions];
        });
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      if (err.code === 'TEACHER_REQUEST_PENDING_DUPLICATE') {
        await themeSwal.fire({
          icon: 'warning',
          iconColor: 'var(--orange)',
          title: 'มีคำขอของห้องนี้แล้ว',
          text: 'ห้องเรียนนี้มีการส่งคำขอแล้ว กรุณากดตรวจสอบชื่อโรงเรียนอีกครั้งเพื่อดูรายการล่าสุด',
          confirmButtonText: 'ตกลง'
        });
        await handleSchoolLookup();
      } else {
        themeSwal.fire({
          icon: 'error',
          iconColor: 'var(--danger)',
          title: 'เกิดข้อผิดพลาด',
          text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง',
          confirmButtonText: 'ตกลง'
        });
      }
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleStartAnotherRequest = async () => {
    setSubmitted(false);
    setConfigs({});
    setWebsite('');
    formStartedAtRef.current = Date.now();
    if (!isEdit && schoolNameInput.trim()) {
      await handleSchoolLookup();
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 className="spin" size={40} color="var(--brand)" />
        <p style={{ color: 'var(--text-light)', marginTop: '15px' }}>กำลังโหลดข้อมูลโรงเรียน...</p>
      </div>
    );
  }

  if (submitted) {
    const totalClasses = Object.keys(configs).length;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: '500px', background: 'white', borderRadius: '12px', padding: '40px 30px', marginTop: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <CheckCircle2 size={64} color="var(--green)" style={{ margin: '0 auto 20px auto' }} />
          <h2>ส่งข้อมูลเรียบร้อยแล้ว</h2>
          <p style={{ color: 'var(--text-light)', marginTop: '10px' }}>ขอบคุณที่แจ้งข้อมูลให้ทีมงานทราบล่วงหน้าครับ<br/>ระบบได้รับข้อมูลสำหรับ {totalClasses} ห้องเรียนแล้ว</p>
          <button className="primary" onClick={handleStartAnotherRequest} style={{ marginTop: '30px' }}>
            ส่งฟอร์มใหม่อีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  const activeCount = Object.keys(configs).length;
  const allSelected = selectableClassrooms.length > 0 && activeCount === selectableClassrooms.length;
  const title = isEdit ? "แก้ไขคำขอเตรียมความพร้อม" : "แบบฟอร์มคำขอเตรียมความพร้อม";
  const subtitle = isEdit ? "แก้ไขข้อมูลและกดบันทึกเพื่ออัปเดตคำขอ" : "รบกวนคุณครูเลือกชั้นเรียนและระบุความก้าวหน้า เพื่อให้ทีมงานจัดเตรียมหุ่นยนต์และข้อสอบให้ตรงกับคาบเรียนครับ";

  return (
    <div className="teacher-request-page" style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' }}>
      <div className="teacher-request-shell" style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div className="teacher-request-header" style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src={brandLogo} alt="Logo" style={{ height: '60px', marginBottom: '15px' }} />
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 10px 0', color: 'var(--text)', fontWeight: '700' }}>{title}</h1>
          <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '1.05rem' }}>{subtitle}</p>
        </div>

        <form className="teacher-request-form" onSubmit={handleSubmit} style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input
            type="text"
            name="website"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', opacity: 0 }}
          />
          
          {isEdit && (
            <Field label="สำนักงาน" icon={<School size={18}/>}>
              <Select
                value={filterOfficeId}
                onChange={val => {setFilterOfficeId(val); setSchoolId(''); setConfigs({});}}
                disabled={isEdit || lookingUpSchool}
              >
                <option value="">-- ทุกสำนักงาน --</option>
                {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Field>
          )}

          <Field label="โรงเรียน" icon={<School size={18}/>}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
              <input
                type="text"
                value={schoolNameInput}
                onChange={e => handleSchoolInputChange(e.target.value)}
                onKeyDown={e => {
                  if (!isEdit && e.key === 'Enter') {
                    e.preventDefault();
                    handleSchoolLookup();
                  }
                }}
                disabled={isEdit}
                required
                placeholder="พิมพ์ชื่อโรงเรียน"
                style={{ flex: 1, minWidth: 0 }}
              />
            </div>
            {schoolLookupMessage && (
              <small style={{ display: 'block', marginTop: '8px', color: schoolId ? 'var(--green)' : '#856404' }}>
                {schoolLookupMessage}
              </small>
            )}
          </Field>

          {schoolId && classrooms.length > 0 && (
            <div className="teacher-class-list" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginTop: '10px' }}>
              <div className="teacher-class-toolbar" style={{ background: 'var(--bg)', padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', color: 'var(--text)' }}>
                  รายการชั้นเรียน ({activeCount}/{selectableClassrooms.length})
                </span>
                <button type="button" onClick={handleSelectAll} style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                  {allSelected ? <CheckSquare size={18}/> : <Square size={18}/>} {allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                </button>
              </div>
              
              <div className="teacher-class-scroll" style={{ overflowX: 'auto' }}>
                <table className="teacher-class-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                      <th style={{ padding: '15px 20px', width: '50px' }}></th>
                      <th style={{ padding: '15px 10px', color: '#495057', fontWeight: '600' }}>ชั้นเรียน</th>
                      <th style={{ padding: '15px 10px', color: '#495057', fontWeight: '600' }}>ประเภทหุ่นยนต์</th>
                      <th style={{ padding: '15px 10px', color: '#495057', fontWeight: '600', width: '130px' }}>เนื้อหาที่เรียน</th>
                      <th style={{ padding: '15px 20px 15px 10px', color: '#495057', fontWeight: '600', width: '120px' }}>คาบสอนปัจจุบัน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classrooms.map((c, idx) => {
                      const isActive = !!configs[c.id];
                      const config = configs[c.id] || {};
                      const isRequested = !isEdit && pendingClassIds.has(String(c.id));
                       
                      return (
                        <tr className={`teacher-class-row ${isActive ? 'active' : ''} ${isRequested ? 'requested' : ''}`} key={c.id} style={{ borderBottom: '1px solid #e9ecef', background: isActive ? '#f0f7ff' : isRequested ? '#f8f9fa' : 'transparent', transition: 'background 0.2s', opacity: isRequested ? 0.65 : 1 }}>
                          <td data-label="เลือก" className="teacher-class-check" style={{ padding: '15px 20px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={isActive}
                              disabled={isRequested}
                              onChange={() => toggleClass(c.id)}
                              style={{ width: '18px', height: '18px', cursor: isRequested ? 'not-allowed' : 'pointer' }}
                            />
                          </td>
                          <td data-label="ชั้นเรียน" className="teacher-class-name" style={{ padding: '15px 10px', fontWeight: '500', color: isActive ? 'var(--brand)' : 'var(--text)' }}>
                            {c.name}
                            {isRequested && <small style={{ display: 'block', color: 'var(--muted)', marginTop: '4px' }}>ส่งคำขอแล้ว</small>}
                          </td>
                          <td data-label="ประเภทหุ่นยนต์" className="teacher-class-field" style={{ padding: '10px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <Bot size={16} color="var(--text-light)" style={{ position: 'absolute', left: '10px', opacity: isActive ? 1 : 0.4 }} />
                              <select 
                                disabled={!isActive || isRequested}
                                value={config.robot || ''}
                                onChange={e => updateConfig(c.id, 'robot', e.target.value)}
                                style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #ced4da', background: isActive ? 'white' : '#f8f9fa', opacity: isActive ? 1 : 0.6 }}
                              >
                                {ROBOT_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                          </td>
                          <td data-label="เนื้อหาที่เรียน" className="teacher-class-field" style={{ padding: '10px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <Calendar size={16} color="var(--text-light)" style={{ position: 'absolute', left: '10px', opacity: isActive ? 1 : 0.4 }} />
                              <select 
                                disabled={!isActive || isRequested}
                                value={normalizeLearningContent(config.term)}
                                onChange={e => updateConfig(c.id, 'term', e.target.value)}
                                style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #ced4da', background: isActive ? 'white' : '#f8f9fa', opacity: isActive ? 1 : 0.6 }}
                              >
                                {LEARNING_CONTENT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </div>
                          </td>
                          <td data-label="คาบสอนปัจจุบัน" className="teacher-class-field" style={{ padding: '10px 20px 10px 10px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <Clock size={16} color="var(--text-light)" style={{ position: 'absolute', left: '10px', opacity: isActive ? 1 : 0.4 }} />
                              <input 
                                type="number"
                                disabled={!isActive || isRequested}
                                value={config.period || ''}
                                onChange={e => updateConfig(c.id, 'period', e.target.value)}
                                min="1"
                                style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #ced4da', background: isActive ? 'white' : '#f8f9fa', opacity: isActive ? 1 : 0.6 }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {schoolId && classrooms.length === 0 && (
            <div style={{ padding: '20px', background: '#fff3cd', color: '#856404', borderRadius: '8px', textAlign: 'center', fontSize: '1.05rem' }}>
              ไม่พบข้อมูลชั้นเรียนในโรงเรียนนี้
            </div>
          )}

          <div style={{ marginTop: '20px' }}>
            {!isEdit && !schoolId ? (
              <button type="button" className="primary" style={{ width: '100%', padding: '16px', fontSize: '1.15rem', borderRadius: '8px' }} onClick={handleSchoolLookup} disabled={lookingUpSchool || !schoolNameInput.trim()}>
                {lookingUpSchool ? <Loader2 className="spin" /> : <><Search size={20} style={{marginRight: '8px'}}/> ตรวจสอบชื่อโรงเรียน</>}
              </button>
            ) : (
              <button type="submit" className="primary" style={{ width: '100%', padding: '16px', fontSize: '1.15rem', borderRadius: '8px' }} disabled={submitting || activeCount === 0}>
                {submitting ? <Loader2 className="spin" /> : <><Send size={20} style={{marginRight: '8px'}}/> {isEdit ? 'อัปเดตข้อมูลคำขอ' : 'บันทึกข้อมูลและส่งแจ้งทีมงาน'}</>}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
