import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '../../model';
import {supabase,isSupabaseConfigured} from '../../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from '../../dataService';
import brandLogo from '../../assets/logo.png';
import Field from '../ui/Field';
import Select from '../ui/Select';

const STUDENT_PREFIXES = ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว'];

const initialStudentRow = (student, nextNo) => {
  const fullName = String(student?.name || '').trim().replace(/\s+/g, ' ');
  const namePrefix = STUDENT_PREFIXES.find(prefix => fullName.startsWith(prefix));
  const prefix = namePrefix || student?.prefix || 'เด็กชาย';
  const nameWithoutPrefix = namePrefix ? fullName.slice(namePrefix.length).trim() : fullName;
  const nameParts = nameWithoutPrefix.split(/\s+/).filter(Boolean);
  const fallbackLastName = nameParts.length > 1 ? nameParts.at(-1) : '';
  const fallbackFirstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts.join(' ');

  return {
    no: student?.no || nextNo || '',
    prefix,
    firstName: student?.firstName || fallbackFirstName,
    lastName: student?.lastName || fallbackLastName
  };
};

function AddStudentModal({onClose,onAdd,nextNo,student,isEdit}){
  const [list, setList] = useState([initialStudentRow(student, nextNo)]);
  
  const valid = list.every(item => item.firstName.trim() && item.lastName.trim() && (!isEdit||Number(item.no)>0));

  const addRow = () => setList([...list, { no:'',prefix: 'เด็กชาย', firstName: '', lastName: '' }]);
  const removeRow = (index) => setList(list.filter((_, i) => i !== index));
  const updateRow = (index, field, value) => {
    setList(list.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const submit=e=>{
    e.preventDefault();
    if(valid) onAdd(list.map(item => ({ ...item, firstName: item.firstName.trim(), lastName: item.lastName.trim() })));
  };

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <form className="modal-card" onSubmit={submit} style={{ width: isEdit ? 'min(540px, 100%)' : 'min(720px, 100%)' }}>
      <div className="modal-head">
        <div>
          <span className="eyebrow">{isEdit?`แก้ไขข้อมูลลำดับที่ ${student.no}`:`เพิ่มนักเรียนใหม่ (${list.length} คน)`}</span>
          <h2>{isEdit?'แก้ไขข้อมูลนักเรียน':'เพิ่มนักเรียนใหม่'}</h2>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด"><X/></button>
      </div>
      <div className="student-form-list" style={{ padding: '20px 24px', maxHeight: '60vh', overflow: 'auto' }}>
        {list.map((item, index) => (
          <div className="student-form-row" key={index} style={{ 
            display: 'grid', 
            gridTemplateColumns: isEdit ? '90px 130px 1fr 1fr' : '130px 1fr 1fr 40px',
            gap: '12px', 
            marginBottom: '16px',
            alignItems: 'end',
            paddingBottom: '16px',
            borderBottom: index === list.length - 1 ? '0' : '1px solid var(--line)'
          }}>
            {isEdit&&<Field label="เลขที่"><input type="number" min="1" value={item.no} onChange={e=>updateRow(index,'no',e.target.value)} /></Field>}
            <Field label="คำนำหน้า">
              <Select value={item.prefix} onChange={v => updateRow(index, 'prefix', v)}>
                {STUDENT_PREFIXES.map(prefix => <option key={prefix} value={prefix}>{prefix}</option>)}
              </Select>
            </Field>
            <Field label="ชื่อ">
              <input autoFocus={index === list.length - 1} value={item.firstName} onChange={e => updateRow(index, 'firstName', e.target.value)} placeholder="กรอกชื่อ"/>
            </Field>
            <Field label="นามสกุล">
              <input value={item.lastName} onChange={e => updateRow(index, 'lastName', e.target.value)} placeholder="กรอกนามสกุล"/>
            </Field>
            {!isEdit && list.length > 1 && (
              <button type="button" className="icon-btn danger-text" onClick={() => removeRow(index)} style={{ marginBottom: '4px' }}>
                <X size={16}/>
              </button>
            )}
          </div>
        ))}
        {!isEdit && (
          <button type="button" className="button" onClick={addRow} style={{ width: '100%', borderStyle: 'dashed', marginTop: '8px' }}>
            <Plus/>เพิ่มคนถัดไป
          </button>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="button" onClick={onClose}>ยกเลิก</button>
        <button className="primary" disabled={!valid}><Save/>{isEdit?'บันทึกการแก้ไข':'เพิ่มนักเรียนทั้งหมด'}</button>
      </div>
    </form>
  </div>
}

export default AddStudentModal;
