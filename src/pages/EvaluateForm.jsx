import React, { useState, useEffect } from 'react';
import { Loader2, Save, School, Bot, Calendar, Clock, Users, AlertCircle, MessageSquare, CheckCircle2, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { loadSchoolIndex, saveEvaluation, loadExistingEvaluation, loadLatestEvaluationForDay, loadOffices, parseExamFromAcademicTerm } from '../dataService';
import Select from '../components/ui/Select';
import Field from '../components/ui/Field';
import ThaiDateInput from '../components/ui/ThaiDateInput';
import { ROBOT_TYPES, defaultExamForRobot, examOptionsForRobot } from '../model';

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

export default function EvaluateForm() {
  const [schools, setSchools] = useState([]);
  const [offices, setOffices] = useState([]);
  const [filterOfficeId, setFilterOfficeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [form, setForm] = useState({
    id: null,
    schoolId: '',
    classId: '',
    robot: 'Code & Go',
    term: '1/2569',
    period: '1',
    teachingPeriod: '1',
    examLevel: 'Basic 1',
    trainer: '',
    date: new Date().toISOString().slice(0, 10),
    endDate: '',
    present: '',
    absent: '',
    issues: '',
    suggestions: ''
  });

  const availablePeriods = ['1', '2', '3', '4'];
  const examOptions = examOptionsForRobot(form.robot);
  const selectedExam = examOptions.includes(form.examLevel) ? form.examLevel : defaultExamForRobot(form.robot);

  useEffect(() => {
    if (!availablePeriods.includes(form.period)) {
      setForm(prev => ({ ...prev, period: availablePeriods[0] }));
    }
  }, [form.term, form.period]);

  useEffect(() => {
    if (!examOptions.includes(form.examLevel)) {
      setForm(prev => ({ ...prev, examLevel: defaultExamForRobot(prev.robot) }));
    }
  }, [form.robot, form.examLevel]);

  useEffect(() => {
    Promise.all([loadSchoolIndex(), loadOffices()]).then(([schoolData, officeData]) => {
      setSchools(schoolData);
      setOffices(officeData);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  // Auto-discover the latest teaching period they worked on today when class/date changes
  useEffect(() => {
    async function discoverLatest() {
      if (form.id) return;
      if (form.classId && form.date) {
        try {
          const latest = await loadLatestEvaluationForDay(form.classId, form.date);
          if (latest && String(latest.teaching_period) !== String(form.teachingPeriod)) {
            setForm(prev => ({ ...prev, teachingPeriod: latest.teaching_period || '1' }));
          }
        } catch (err) {
          console.error("Discovery error", err);
        }
      }
    }
    discoverLatest();
  }, [form.id, form.classId, form.date]);

  useEffect(() => {
    async function checkExisting() {
      if (form.id) return;
      if (form.classId && form.date && form.teachingPeriod) {
        try {
          const existing = await loadExistingEvaluation(form);
          if (existing) {
            setForm(prev => ({
              ...prev,
              id: existing.id,
              teachingPeriod: existing.teaching_period ?? prev.teachingPeriod,
              present: existing.present_count ?? '',
              absent: existing.absent_count ?? '',
              issues: existing.issues ?? '',
              suggestions: existing.suggestions ?? '',
              trainer: existing.trainer_name ?? '',
              date: existing.eval_date ?? prev.date,
              endDate: prev.endDate || existing.end_date || '',
              examLevel: parseExamFromAcademicTerm(existing.academic_term) || prev.examLevel
            }));
          } else {
            setForm(prev => ({
              ...prev,
              id: null,
              present: '',
              absent: '',
              issues: '',
              suggestions: ''
            }));
          }
        } catch (err) {
          console.error("Failed to check existing evaluation", err);
        }
      }
    }
    checkExisting();
  }, [form.id, form.classId, form.date, form.teachingPeriod, form.term, form.period, form.examLevel, form.robot]);

  const selectedSchool = schools.find(s => s.id === form.schoolId);
  const classrooms = selectedSchool?.classrooms || [];
  const resetEvaluationFields = (patch={}) => ({
    ...patch,
    id: null,
    present: '',
    absent: '',
    issues: '',
    suggestions: '',
    trainer: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.schoolId || !form.classId) return themeSwal.fire({
      icon: 'warning',
      iconColor: 'var(--orange)',
      title: 'แจ้งเตือน',
      text: 'กรุณาเลือกโรงเรียนและชั้นเรียน',
      confirmButtonText: 'ตกลง'
    });
    
    setSubmitting(true);
    try {
      await saveEvaluation(form);
      setSubmitted(true);
      // Reset some fields for the next classroom
      setForm(prev => ({
        ...prev,
        id: null,
        classId: '',
        present: '',
        absent: '',
        issues: '',
        suggestions: '',
        endDate: ''
      }));
    } catch (err) {
      console.error(err);
      themeSwal.fire({
        icon: 'error',
        iconColor: 'var(--danger)',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถบันทึกข้อมูลได้',
        confirmButtonText: 'ตกลง'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
        <Loader2 className="spin" size={40} color="var(--brand)" />
      </div>
    );
  }

  return (
    <div className="page-content" style={{ paddingBottom: '100px' }}>
      
      <div className="page-title">
        <div>
          <span className="eyebrow">Instructor</span>
          <h1>ประเมินหน้างาน (สำหรับวิทยากร)</h1>
          <p>กรอกข้อมูลสรุปผลการทดสอบของแต่ละห้อง ข้อมูลจะถูกรวบรวมเพื่อออกใบปะหน้าอัตโนมัติ</p>
        </div>
      </div>

      {submitted && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <CheckCircle2 color="#16a34a" size={32} />
          <div>
            <h3 style={{ margin: '0 0 5px 0', color: '#166534' }}>บันทึกข้อมูลสำเร็จ!</h3>
            <p style={{ margin: 0, color: '#15803d' }}>ข้อมูลการสอนของคุณถูกบันทึกเข้าระบบเรียบร้อยแล้ว คุณสามารถกรอกประเมินห้องถัดไปต่อได้เลย</p>
          </div>
          <button className="button" style={{ marginLeft: 'auto' }} onClick={() => setSubmitted(false)}>ปิด</button>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="card" style={{ padding: '30px', marginTop: '20px' }}>
        <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px' }}>1. ข้อมูลพื้นฐาน</h3>
        <div className="form-grid" style={{ marginBottom: '40px' }}>
          <Field label="สำนักงาน" icon={<School size={18}/>}>
            <Select 
              value={filterOfficeId} 
              onChange={val => {setFilterOfficeId(val); setForm(prev => ({ ...prev, ...resetEvaluationFields({ schoolId: '', classId: '' }) }));}}
            >
              <option value="">-- ทุกสำนักงาน --</option>
              {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          
          <Field label="โรงเรียน" icon={<School size={18}/>}>
            <Select 
              value={form.schoolId} 
              onChange={val => setForm(prev => ({ ...prev, ...resetEvaluationFields({ schoolId: val, classId: '' }) }))}
              required
            >
              <option value="" disabled>-- เลือกโรงเรียน --</option>
              {(filterOfficeId ? schools.filter(s => String(s.officeId) === String(filterOfficeId)) : schools).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="ชั้นเรียน" icon={<Users size={18}/>}>
            <Select value={form.classId} onChange={val => setForm(prev => ({...prev, ...resetEvaluationFields({ classId: val })}))} disabled={!form.schoolId}>
              <option value="" disabled>{form.schoolId ? '-- เลือกชั้นเรียน --' : 'กรุณาเลือกโรงเรียนก่อน'}</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="ประเภทหุ่นยนต์" icon={<Bot size={18}/>}>
            <Select value={form.robot} onChange={val => setForm({...form, robot: val, examLevel: defaultExamForRobot(val)})}>
              {ROBOT_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="วันที่เข้าสอน" icon={<Calendar size={18}/>}>
            <div className="date-range-fields">
              <ThaiDateInput value={form.date} onChange={value => setForm({...form, date: value})} placeholder="วันเริ่มต้น" required />
              <span>ถึง</span>
              <ThaiDateInput value={form.endDate} onChange={value => setForm({...form, endDate: value})} placeholder="วันสิ้นสุด" title="ถึงวันที่ (ถ้ามี)" />
            </div>
            <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>* เลือกช่องที่ 2 เฉพาะกรณีที่ประเมินห้องนี้หลายวัน</small>
          </Field>
          <Field label="ภาคเรียน/ปี" icon={<Calendar size={18}/>}>
            <input type="text" value={form.term} onChange={e => setForm({...form, term: e.target.value})} required />
          </Field>
          <Field label="ครั้งที่สอบ" icon={<FileText size={18}/>}>
            <Select value={form.period} onChange={val => setForm({...form, period: val})}>
              {availablePeriods.map(p => <option key={p} value={p}>ครั้งที่ {p}</option>)}
            </Select>
          </Field>
          <Field label="คาบสอนปัจจุบัน" icon={<Clock size={18}/>}>
            <input type="text" value={form.teachingPeriod} onChange={e => setForm({...form, teachingPeriod: e.target.value})} placeholder="เช่น 1, 2, 3 หรือ 08:30" required />
          </Field>
          <Field label="ชุดข้อสอบ" icon={<FileText size={18}/>}>
            <Select value={selectedExam} onChange={val => setForm({...form, examLevel: val})}>
              {examOptions.map(option => <option key={option} value={option}>{option}</option>)}
            </Select>
          </Field>
          <Field label="วิทยากรผู้สอน" icon={<Users size={18}/>}>
            <input type="text" value={form.trainer} onChange={e => setForm({...form, trainer: e.target.value})} placeholder="ชื่อวิทยากร" />
          </Field>
        </div>

        <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px' }}>2. ยอดนักเรียนเข้าเรียน</h3>
        <div className="form-grid" style={{ marginBottom: '40px' }}>
          <Field label="มาเรียน (คน)">
            <input type="number" value={form.present} onChange={e => setForm({...form, present: e.target.value})} min="0" placeholder="จำนวนคนมา" required />
          </Field>
          <Field label="ขาดเรียน (คน)">
            <input type="number" value={form.absent} onChange={e => setForm({...form, absent: e.target.value})} min="0" placeholder="จำนวนคนขาด" required />
          </Field>
        </div>

        <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px' }}>3. สรุปผลการสอน</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Field label="ปัญหาที่พบ" icon={<AlertCircle size={18}/>}>
            <textarea 
              value={form.issues} 
              onChange={e => setForm({...form, issues: e.target.value})}
              rows={4}
              placeholder="ระบุปัญหาที่พบระหว่างการสอน (เว้นว่างได้)"
              style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', resize: 'vertical' }}
            />
          </Field>
          <Field label="ข้อเสนอแนะ" icon={<MessageSquare size={18}/>}>
            <textarea 
              value={form.suggestions} 
              onChange={e => setForm({...form, suggestions: e.target.value})}
              rows={4}
              placeholder="ข้อเสนอแนะเพิ่มเติม (เว้นว่างได้)"
              style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', resize: 'vertical' }}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
          <button type="submit" className="primary" disabled={submitting} style={{ width: '100%', maxWidth: '300px', fontSize: '1.1rem', padding: '15px' }}>
            {submitting ? <><Loader2 className="spin" size={20} style={{marginRight: '8px'}}/> กำลังบันทึก...</> : <><Save size={20} style={{marginRight: '8px'}}/> {form.id ? 'อัปเดตข้อมูลการสอน' : 'บันทึกข้อมูลการสอน'}</>}
          </button>
        </div>

      </form>
    </div>
  );
}
