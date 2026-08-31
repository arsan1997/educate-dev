import React from 'react';
import {LayoutDashboard, FileText, Download, Eye} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '../model';
import {supabase,isSupabaseConfigured} from '../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from '../dataService';
import brandLogo from '../assets/logo.png';

import Field from '../components/ui/Field';
import Select from '../components/ui/Select';

function Reports({stats,exportExcel,exportAllExcelZip,exportPDF,exportScoreTablePDF,onPreviewPDF,onPreviewScoreTablePDF,schools,schoolId,onSelectSchool}){

 return <>
  <div className="page-title"><div><span className="eyebrow">ส่งออกข้อมูล</span><h1>รายงานผลการประเมิน</h1><p>จัดทำเอกสารพร้อมพิมพ์หรือสำรองข้อมูลสำหรับใช้งานต่อ</p></div></div>
  <div className="card test-info" style={{marginBottom: '1.5rem'}}>
   <div className="form-grid" style={{gridTemplateColumns: '1fr'}}>
    <Field label="เลือกโรงเรียนที่ต้องการรายงาน"><Select value={schoolId} onChange={onSelectSchool}><option value="" disabled hidden>เลือกโรงเรียน</option>{schools?.map(s=><option value={s.id} key={s.id}>{s.name} ({s.classrooms?.length||0} ห้อง)</option>)}</Select></Field>
   </div>
  </div>
  <div className="report-grid">
   <div className="card report"><div className="report-icon pdf"><FileText/></div><div><h2>รายงานสรุปผลสัมฤทธิ์</h2><p>สถิติ ภาพรวมผลการประเมิน และข้อเสนอแนะในรูปแบบเอกสาร PDF</p></div><div className="mini-stats"><span>เฉลี่ย <b>{stats.avg.toFixed(1)}</b></span><span>ผ่าน <b>{stats.rate.toFixed(0)}%</b></span></div><div className="report-actions"><button className="primary" onClick={onPreviewPDF}><Eye/>ดูตัวอย่าง PDF</button><button className="button" onClick={()=>exportPDF('download')}><Download/>ดาวน์โหลดทันที</button></div></div>
   <div className="card report"><div className="report-icon pdf"><FileText/></div><div><h2>PDF ตารางคะแนน</h2><p>ตารางคะแนนรายห้อง พร้อมลำดับ คะแนน และเวลาในการทดสอบ</p></div><div className="report-actions"><button className="primary" onClick={onPreviewScoreTablePDF}><Eye/>ดูตัวอย่าง PDF</button><button className="button" onClick={()=>exportScoreTablePDF('download')}><Download/>ดาวน์โหลดทันที</button></div></div>
   <div className="card report"><div className="report-icon excel"><LayoutDashboard/></div><div><h2>ข้อมูลคะแนนและเวลา</h2><p>ข้อมูลดิบรายบุคคลและตารางสรุปผลรายห้องในไฟล์ Excel</p></div><div className="mini-stats"><span>นักเรียน <b>{stats.all}</b></span><span>เข้าสอบ <b>{stats.present}</b></span></div><div className="report-actions"><button className="button" onClick={exportExcel}><Download/>ส่งออกโรงเรียนนี้</button><button className="button" onClick={exportAllExcelZip} style={{borderColor: '#107c41', color: '#107c41'}}><Download size={16}/> ส่งออกทุกโรงเรียน (ZIP)</button></div></div>
  </div>
 </>;
}

export default Reports;
