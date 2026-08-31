import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Link as LinkIcon, Copy, BellRing, Check, Search, X, FileText, Download, Eye, Loader2, Calendar, School, Trash2, Edit2 } from 'lucide-react';
import { loadTeacherRequests, updateTeacherRequestStatusBySchool, updateTeacherRequestRows, deleteTeacherRequestBySchool, loadSchoolIndex, loadEvaluationsSummary, loadEvaluationDatesForSchool, deleteOnsiteEvaluation } from '../dataService';
import Select from '../components/ui/Select';
import Field from '../components/ui/Field';
import PDFPreviewModal from '../components/ui/PDFPreviewModal';
import ThaiDateInput from '../components/ui/ThaiDateInput';
import Swal from 'sweetalert2';
import { ROBOT_TYPES } from '../model';

const parseTermInfo = (termStr) => {
  if (!termStr) return { term: '-', exam: '-', dateRange: '' };
  const m = termStr.match(/^(.+?)(?:\s+\(([^)]+)\))?(?:\s+\(([^)]+)\))?$/);
  if (m) {
    return {
      term: m[1]?.trim() || termStr,
      exam: m[2] || '-',
      dateRange: m[3] ? ` (${m[3]})` : ''
    };
  }
  return { term: termStr, exam: '-', dateRange: '' };
};

const LEARNING_CONTENT_OPTIONS = ['เทอม 1', 'เทอม 2'];
const normalizeLearningContent = value => {
  const text = String(value || '').trim();
  if (/^2(?:\D|$)|เทอม\s*2|term\s*2/i.test(text)) return 'เทอม 2';
  return 'เทอม 1';
};

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

const parseLocalDate = (isoDate) => {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatThaiDate = (isoDate) => {
  const date = parseLocalDate(isoDate);
  if (!date) return '-';
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return '-';
  const start = startDate || endDate;
  const end = endDate || startDate;
  if (start === end) return formatThaiDate(start);
  return `${formatThaiDate(start)} - ${formatThaiDate(end)}`;
};

const formatStackedDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return '-';
  const start = startDate || endDate;
  const end = endDate || startDate;
  if (start === end) return formatThaiDate(start);
  return `${formatThaiDate(start)} -\n${formatThaiDate(end)}`;
};

const getEvaluationEndDate = (item) => item?.end_date || item?.eval_date || '';

const getSummaryDateRange = (items, fallbackDate) => {
  const dates = items
    .flatMap(item => [item.eval_date, getEvaluationEndDate(item)])
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return formatDateRange(fallbackDate, fallbackDate);
  return formatDateRange(dates[0], dates[dates.length - 1]);
};

const formatEvaluationDateRange = (item) => formatStackedDateRange(item?.eval_date, getEvaluationEndDate(item));

export default function OnsiteDashboard({ flash, offices }) {
  const teacherLink = `${window.location.origin}/request`;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSchools, setExpandedSchools] = useState({});
  const [filterRequestRobot, setFilterRequestRobot] = useState('');
  const [filterRequestTerm, setFilterRequestTerm] = useState('');
  const [editingRequestGroup, setEditingRequestGroup] = useState(null);
  const [editingRequestRows, setEditingRequestRows] = useState([]);
  const [savingRequestEdit, setSavingRequestEdit] = useState(false);

  // Daily Summary State
  const [schools, setSchools] = useState([]);
  const [summaryOfficeId, setSummaryOfficeId] = useState('');
  const [summarySchoolId, setSummarySchoolId] = useState('');
  const [summaryDate, setSummaryDate] = useState(new Date().toISOString().slice(0, 10));
  const [summaryDates, setSummaryDates] = useState([]);
  const [loadingSummaryDates, setLoadingSummaryDates] = useState(false);
  const [summaryData, setSummaryData] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [logoSrc, setLogoSrc] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await loadTeacherRequests();
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    loadSchoolIndex().then(data => setSchools(data)).catch(console.error);
    import('../assets/logoBase64').then(mod => setLogoSrc(mod.logoBase64)).catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSummaryDates([]);
    setSummaryData([]);
    if (!summarySchoolId) return;
    setLoadingSummaryDates(true);
    loadEvaluationDatesForSchool(summarySchoolId).then(dates => {
      if (cancelled) return;
      setSummaryDates(dates);
      const hasCurrent = dates.some(item => item.date <= summaryDate && (item.endDate || item.date) >= summaryDate);
      if (!hasCurrent && dates[0]?.date) setSummaryDate(dates[0].date);
    }).catch(err => {
      console.error(err);
      if (flash) flash('โหลดรายการวันที่ใบปะหน้าไม่สำเร็จ');
    }).finally(() => {
      if (!cancelled) setLoadingSummaryDates(false);
    });
    return () => { cancelled = true; };
  }, [summarySchoolId]);

  const copyLink = () => {
    navigator.clipboard.writeText(teacherLink);
    if (flash) flash('คัดลอกลิงก์เรียบร้อยแล้ว ส่งให้ครูได้เลย');
  };

  const handleAcknowledge = async (schoolId) => {
    try {
      await updateTeacherRequestStatusBySchool(schoolId, 'done');
      if (flash) flash('บันทึกสถานะ "จัดเตรียมแล้ว" เรียบร้อย');
      fetchRequests();
      setExpandedSchools(prev => ({ ...prev, [schoolId]: false }));
    } catch (err) {
      themeSwal.fire({
        icon: 'error',
        iconColor: 'var(--danger)',
        title: 'เกิดข้อผิดพลาด',
        text: 'เกิดข้อผิดพลาดในการบันทึกสถานะ',
        confirmButtonText: 'ตกลง'
      });
      console.error(err);
    }
  };

  const handleDeleteRequestGroup = (schoolId) => {
    themeSwal.fire({
      title: 'ยืนยันการลบทิ้ง',
      text: 'คุณแน่ใจหรือไม่ว่าต้องการลบคำขอเตรียมความพร้อมของโรงเรียนนี้?',
      icon: 'warning',
      iconColor: 'var(--orange)',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ลบทิ้งเลย',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteTeacherRequestBySchool(schoolId);
          if (flash) flash('ลบคำขอเรียบร้อยแล้ว');
          fetchRequests();
        } catch (err) {
          themeSwal.fire({
            icon: 'error',
            iconColor: 'var(--danger)',
            title: 'ลบไม่สำเร็จ',
            text: err.message,
            confirmButtonText: 'ตกลง'
          });
          console.error(err);
        }
      }
    });
  };

  const openRequestEditor = (group) => {
    setEditingRequestGroup(group);
    setEditingRequestRows(group.details.map(req => ({
      id: req.id,
      classroomName: req.classrooms?.name || '-',
      robot_type: req.robot_type || ROBOT_TYPES[0],
      academic_term: normalizeLearningContent(req.academic_term),
      teaching_period: req.teaching_period || '',
      note: req.note || ''
    })));
  };

  const updateEditingRequestRow = (id, key, value) => {
    setEditingRequestRows(rows => rows.map(row => row.id === id ? { ...row, [key]: value } : row));
  };

  const saveRequestEditor = async () => {
    setSavingRequestEdit(true);
    try {
      await updateTeacherRequestRows(editingRequestRows);
      setEditingRequestGroup(null);
      setEditingRequestRows([]);
      await fetchRequests();
      if (flash) flash('แก้ไขคำขอเตรียมความพร้อมเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      themeSwal.fire({
        icon: 'error',
        iconColor: 'var(--danger)',
        title: 'บันทึกไม่สำเร็จ',
        text: err.message || 'ไม่สามารถบันทึกคำขอได้',
        confirmButtonText: 'ตกลง'
      });
    } finally {
      setSavingRequestEdit(false);
    }
  };

  const handleDeleteSummary = (id) => {
    themeSwal.fire({
      title: 'ยืนยันการลบ',
      text: 'คุณแน่ใจหรือไม่ว่าต้องการลบใบปะหน้าห้องนี้?',
      icon: 'warning',
      iconColor: 'var(--orange)',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ลบทิ้ง',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteOnsiteEvaluation(id);
          setSummaryData(prev => prev.filter(x => x.id !== id));
          if (summarySchoolId) setSummaryDates(await loadEvaluationDatesForSchool(summarySchoolId));
          themeSwal.fire({
            icon: 'success',
            iconColor: 'var(--green)',
            title: 'สำเร็จ',
            text: 'ลบข้อมูลเรียบร้อยแล้ว',
            confirmButtonText: 'ตกลง'
          });
        } catch (e) {
          console.error(e);
          themeSwal.fire({
            icon: 'error',
            iconColor: 'var(--danger)',
            title: 'ผิดพลาด',
            text: 'ไม่สามารถลบข้อมูลได้',
            confirmButtonText: 'ตกลง'
          });
        }
      }
    });
  };

  const toggleExpand = (schoolId) => {
    setExpandedSchools(prev => ({
      ...prev,
      [schoolId]: !prev[schoolId]
    }));
  };

  const getPeriodSummary = (details) => {
    const summary = {};
    details.forEach(req => {
      if (!summary[req.robot_type]) summary[req.robot_type] = {};
      const period = req.teaching_period;
      if (!summary[req.robot_type][period]) summary[req.robot_type][period] = 0;
      summary[req.robot_type][period]++;
    });
    
    return Object.entries(summary).map(([robot, periods]) => {
      let totalPeriods = 0;
      let totalRooms = 0;
      
      const periodData = Object.entries(periods)
        .sort((a,b) => Number(a[0]) - Number(b[0]))
        .map(([p, count]) => {
          const numP = Number(p);
          if (!isNaN(numP)) {
            totalPeriods += (numP * count);
            totalRooms += count;
          }
          return { period: p, count };
        });
        
      const average = totalRooms > 0 ? Math.round(totalPeriods / totalRooms) : null;
      return { robot, periodData, average };
    });
  };

  const fetchSummary = async () => {
    if (!summarySchoolId || !summaryDate) {
      return themeSwal.fire({
        icon: 'warning',
        iconColor: 'var(--orange)',
        title: 'แจ้งเตือน',
        text: 'กรุณาเลือกโรงเรียนและวันที่ให้ครบถ้วนก่อนดึงข้อมูล',
        confirmButtonText: 'ตกลง',
      });
    }
    
    setLoadingSummary(true);
    try {
      const data = await loadEvaluationsSummary(summarySchoolId, summaryDate);
      setSummaryData(data);
      if (data.length === 0) {
        themeSwal.fire({
          icon: 'info',
          iconColor: 'var(--accent)',
          title: 'ไม่พบข้อมูล',
          text: 'ไม่พบข้อมูลประเมินในวันและโรงเรียนที่เลือก',
          confirmButtonText: 'ตกลง',
        });
      } else {
        if (flash) flash(`โหลดข้อมูลประเมิน ${data.length} รายการสำเร็จ`);
      }
    } catch(err) {
      console.error(err);
      themeSwal.fire({
        icon: 'error',
        iconColor: 'var(--danger)',
        title: 'เกิดข้อผิดพลาด',
        text: 'เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message,
        confirmButtonText: 'ตกลง',
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  const targetSchool = schools.find(s => s.id === summarySchoolId);
  const selectedSummaryDateOption = summaryDates.find(item => item.date <= summaryDate && (item.endDate || item.date) >= summaryDate)?.date || '';
  const totalPresent = summaryData.reduce((sum, item) => sum + (item.present_count || 0), 0);
  const totalAbsent = summaryData.reduce((sum, item) => sum + (item.absent_count || 0), 0);
  const joinedClasses = [...new Set(summaryData.map(item => item.classrooms?.name).filter(Boolean))].join(', ');
  const joinedTrainers = [...new Set(summaryData.map(item => item.trainer_name).filter(Boolean))].join(', ');
  const formatTrainerNames = value => {
    const names = String(value || '-')
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);

    if (!names.length) return '-';

    const rows = [];
    for (let i = 0; i < names.length; i += 2) {
      rows.push(names.slice(i, i + 2).join(','));
    }
    return rows.join('\n');
  };
  const joinedIssues = summaryData.map(item => item.issues ? `[${item.classrooms?.name}]: ${item.issues}` : null).filter(Boolean).join('\n\n');
  const joinedSuggestions = summaryData.map(item => item.suggestions ? `[${item.classrooms?.name}]: ${item.suggestions}` : null).filter(Boolean).join('\n\n');
  const termParsed = summaryData.length > 0 ? parseTermInfo(summaryData[0].academic_term) : {};
  const termAndYear = termParsed.term;
  const displayTestDate = getSummaryDateRange(summaryData, summaryDate);
  const teachingPeriod = [...new Set(summaryData.map(item => item.teaching_period).filter(Boolean))].join(', ');
  const robotType = [...new Set(summaryData.map(item => item.robot_type).filter(Boolean))].join(', ');

  const handleGeneratePDF = async (mode = 'download') => {
    if (summaryData.length === 0) return themeSwal.fire({
      icon: 'info',
      iconColor: 'var(--accent)',
      title: 'ไม่มีข้อมูล',
      text: 'ไม่มีข้อมูลสำหรับออกรายงาน',
      confirmButtonText: 'ตกลง'
    });
    try {
      const [pdfModule, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')]);
      const jsPDF = pdfModule.jsPDF || pdfModule.default;
      const html2canvas = html2canvasModule.default || html2canvasModule;
      
      const element = document.getElementById('pdf-content');
      if (!element) throw new Error("PDF content element not found");
      const captureWidth = Math.max(794, Math.ceil(element.scrollWidth || 0));
      
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        width: captureWidth,
        windowWidth: captureWidth
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const horizontalMargin = 4;
      const repeatedHeaderTopMargin = 10;
      const imageWidth = pdfWidth - (horizontalMargin * 2);
      const pageHeightPx = Math.floor((pdfPageHeight / imageWidth) * canvas.width);
      const elementRect = element.getBoundingClientRect();
      const elementHeight = Math.max(element.scrollHeight, elementRect.height, 1);
      const canvasScaleY = canvas.height / elementHeight;
      const minimumSliceHeight = Math.round(80 * canvasScaleY);
      const issueTitle = Array.from(element.querySelectorAll('h2'))
        .find(heading => heading.textContent?.trim().includes('ปัญหาและข้อเสนอแนะ'));
      const issueTableHeader = issueTitle?.nextElementSibling?.querySelector?.('thead');
      const issueTableHeaderRect = issueTableHeader?.getBoundingClientRect();
      const issueHeaderTop = issueTableHeaderRect
        ? Math.max(0, Math.round((issueTableHeaderRect.top - elementRect.top) * canvasScaleY))
        : null;
      const issueHeaderBottom = issueTableHeaderRect
        ? Math.min(canvas.height, Math.round((issueTableHeaderRect.bottom - elementRect.top) * canvasScaleY))
        : null;
      const issueHeaderHeight = issueHeaderTop !== null && issueHeaderBottom !== null
        ? Math.max(1, issueHeaderBottom - issueHeaderTop)
        : 0;
      const issueHeaderCanvas = issueHeaderHeight ? document.createElement('canvas') : null;
      if (issueHeaderCanvas) {
        issueHeaderCanvas.width = canvas.width;
        issueHeaderCanvas.height = issueHeaderHeight;
        const issueHeaderContext = issueHeaderCanvas.getContext('2d');
        issueHeaderContext.fillStyle = '#ffffff';
        issueHeaderContext.fillRect(0, 0, issueHeaderCanvas.width, issueHeaderCanvas.height);
        issueHeaderContext.drawImage(canvas, 0, issueHeaderTop, canvas.width, issueHeaderHeight, 0, 0, canvas.width, issueHeaderHeight);
      }
      const issueHeaderImgData = issueHeaderCanvas?.toDataURL('image/png');
      const issueHeaderPdfHeight = issueHeaderHeight ? (issueHeaderHeight * imageWidth) / canvas.width : 0;
      const rowBreaks = Array.from(element.querySelectorAll('tr'))
        .map(row => Math.round((row.getBoundingClientRect().bottom - elementRect.top) * canvasScaleY))
        .filter(y => y > 0 && y < canvas.height)
        .sort((a, b) => a - b);

      let sliceStart = 0;
      let pageIndex = 0;
      while (sliceStart < canvas.height - 1) {
        const shouldRepeatIssueHeader = pageIndex > 0 && issueHeaderImgData && issueHeaderBottom !== null && sliceStart >= issueHeaderBottom;
        const availablePageHeightPx = shouldRepeatIssueHeader
          ? Math.floor(((pdfPageHeight - repeatedHeaderTopMargin - issueHeaderPdfHeight) / imageWidth) * canvas.width)
          : pageHeightPx;
        const naturalEnd = Math.min(canvas.height, sliceStart + availablePageHeightPx);
        const candidates = rowBreaks.filter(y => y > sliceStart + minimumSliceHeight && y <= naturalEnd);
        const sliceEnd = naturalEnd < canvas.height && candidates.length ? candidates[candidates.length - 1] : naturalEnd;
        const sliceHeight = Math.max(1, sliceEnd - sliceStart);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const pageContext = pageCanvas.getContext('2d');
        pageContext.drawImage(canvas, 0, sliceStart, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        const pageImgData = pageCanvas.toDataURL('image/png');
        const pageImageHeight = (sliceHeight * imageWidth) / canvas.width;

        if (pageIndex > 0) pdf.addPage();
        if (shouldRepeatIssueHeader) {
          pdf.addImage(issueHeaderImgData, 'PNG', horizontalMargin, repeatedHeaderTopMargin, imageWidth, issueHeaderPdfHeight);
        }
        pdf.addImage(pageImgData, 'PNG', horizontalMargin, shouldRepeatIssueHeader ? repeatedHeaderTopMargin + issueHeaderPdfHeight : 0, imageWidth, pageImageHeight);
        sliceStart = sliceEnd;
        pageIndex += 1;
      }
      
      const filename = `สรุปใบปะหน้า_${targetSchool?.name}_${summaryDate}.pdf`;
      if (mode === 'preview') {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfPreview({ url, filename });
      } else {
        pdf.save(filename);
      }
    } catch (err) {
      console.error('PDF Generation Error:', err);
      themeSwal.fire({
        icon: 'error',
        iconColor: 'var(--danger)',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถสร้าง PDF ได้',
        confirmButtonText: 'ตกลง'
      });
    }
  };

  const uniqueRequestTerms = [...new Set(requests.map(r => normalizeLearningContent(r.academic_term)).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'th'));
  const filteredRequests = requests.filter(r => 
    (!filterRequestRobot || r.robot_type === filterRequestRobot) &&
    (!filterRequestTerm || normalizeLearningContent(r.academic_term) === filterRequestTerm)
  );

  const groupedRequests = filteredRequests.reduce((acc, curr) => {
    if (!acc[curr.school_id]) {
      acc[curr.school_id] = {
        school_id: curr.school_id,
        schoolName: curr.schools?.name || 'ไม่ทราบชื่อโรงเรียน',
        created_at: curr.created_at,
        status: curr.status,
        details: []
      };
    }
    acc[curr.school_id].details.push(curr);
    if (curr.status === 'pending') acc[curr.school_id].status = 'pending';
    if (new Date(curr.created_at) > new Date(acc[curr.school_id].created_at)) {
      acc[curr.school_id].created_at = curr.created_at;
    }
    return acc;
  }, {});

  const groupArray = Object.values(groupedRequests).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  const formatDate = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="page-content onsite-page">
      {/* Hidden PDF Template */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -100 }}>
        <div id="pdf-content" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#fff', padding: '40px 20px', boxSizing: 'border-box', color: '#2c3e50', fontFamily: '"Sarabun", "Kanit", sans-serif' }}>
           {/* Header */}
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', width: '100%', boxSizing: 'border-box' }}>
              <div>{logoSrc && <img src={logoSrc} alt="logo" style={{ height: '60px' }} />}</div>
              <div style={{ textAlign: 'right' }}>
                 {/* <h1 style={{ margin: '0 0 5px 0', color: '#1a5276', fontSize: '24px', fontWeight: 'bold'}}>สรุปใบปะหน้าประจำวัน</h1> */}
                 <h1 style={{ margin: '0 0 5px 0', color: '#1a5276', fontSize: '24px', fontWeight: 'bold'}}>การประเมินคุณภาพหลักสูตรหุ่นยนต์</h1>
                 <br />
                 <h1 style={{ margin: '0 0 5px 0', color: '#acacad', fontSize: '18px', fontWeight: 'bold'}}>SCHOOL ROBOTICS</h1>
                 {/* <p style={{ margin: '0', color: '#7f8c8d', fontSize: '14px' }}>การประเมินคุณภาพหลักสูตรหุ่นยนต์ SCHOOL ROBOTICS</p> */}
              </div>
           </div>

           {/* Info Section */}
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '15px 20px', fontSize: '15px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
              <div style={{ wordBreak: 'break-word' }}><strong style={{color: '#1e293b', display: 'block', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px'}}>โรงเรียน</strong> <span style={{fontSize: '16px', fontWeight: 'bold', color: '#0f172a'}}>{targetSchool?.name || '-'}</span></div>
              <div style={{ wordBreak: 'break-word' }}><strong style={{color: '#1e293b', display: 'block', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px'}}>ภาคเรียน/ปีการศึกษา</strong> <span style={{fontSize: '16px', fontWeight: 'bold', color: '#0f172a'}}>{termAndYear || '-'}</span></div>
              <div style={{ wordBreak: 'break-word' }}><strong style={{color: '#1e293b', display: 'block', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px'}}>วันที่เข้าทดสอบ</strong> <span style={{fontSize: '16px', fontWeight: 'bold', color: '#0f172a'}}>{displayTestDate}</span></div>
           </div>

           {/* Break down by Classroom Table */}
           <h2 style={{ margin: '0 0 12px 0', color: '#1a5276', fontSize: '18px', borderLeft: '4px solid #3498db', paddingLeft: '10px' }}>รายละเอียดการทดสอบ</h2>
           <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: '35px', fontSize: '14px', boxSizing: 'border-box'}}>
             <thead>
                <tr style={{ backgroundColor: '#2980b9', color: '#ffffff' }}>
                  <th style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '10%' }}>ห้องเรียน</th>
                  <th style={{ boxSizing: 'border-box', padding: '10px 6px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '18%' }}>วันที่ทดสอบ</th>
                  <th style={{ boxSizing: 'border-box', padding: '10px 6px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '9%' }}>หุ่นยนต์</th>
                  <th style={{ boxSizing: 'border-box', padding: '10px 6px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '13%' }}>ชุดข้อสอบ</th>
                  <th style={{ boxSizing: 'border-box', padding: '10px 6px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '7%' }}>คาบสอนปัจจุบัน</th>
                  <th style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '7%' }}>เข้าสอบ</th>
                  <th style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '7%' }}>ขาดสอบ</th>
                  <th style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '29%' }}>วิทยากร</th>
                </tr>
             </thead>
             <tbody>
               {summaryData.map((item, idx) => {
                  const pItem = parseTermInfo(item.academic_term);
                  const isEven = idx % 2 === 0;
                  return (
                  <tr key={item.id || idx} style={{ backgroundColor: isEven ? '#ffffff' : '#f8f9fa' }}>
                    <td style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>{item.classrooms?.name}</td>
                    <td style={{ boxSizing: 'border-box', padding: '10px 6px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', fontSize: '11.5px', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word', lineHeight: 1.35 }}>
                      <span style={{ display: 'inline-block', textAlign: 'left', whiteSpace: 'pre-line' }}>{formatEvaluationDateRange(item)}</span>
                    </td>
                    <td style={{ boxSizing: 'border-box', padding: '10px 6px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', fontSize: '13px', whiteSpace: 'nowrap' }}>{item.robot_type}</td>
                    <td style={{ boxSizing: 'border-box', padding: '10px 6px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', fontSize: '13px', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word', lineHeight: 1.25 }}>{pItem.exam}</td>
                    <td style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center' }}>{item.teaching_period}</td>
                    <td style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>{item.present_count}</td>
                    <td style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', color: '#dc2626', fontWeight: 'bold' }}>{item.absent_count}</td>
                    <td style={{ boxSizing: 'border-box', padding: '8px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'left', whiteSpace: 'pre-line', wordBreak: 'normal', overflowWrap: 'break-word', lineHeight: 1.45, fontSize: '13px' }}>{formatTrainerNames(item.trainer_name)}</td>
                  </tr>
                  );
               })}
               <tr style={{ backgroundColor: '#e2e8f0' }}>
                 <td colSpan={5} style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>รวมยอดนักเรียนทั้งหมด</td>
                 <td style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', textAlign: 'center', fontWeight: 'bold', color: '#16a34a', fontSize: '15px' }}>{totalPresent}</td>
                 <td style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', textAlign: 'center', fontWeight: 'bold', color: '#dc2626', fontSize: '15px' }}>{totalAbsent}</td>
                 <td style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #cbd5e1' }}></td>
               </tr>
             </tbody>
           </table>

           <h2 style={{ margin: '0 0 12px 0', color: '#d35400', fontSize: '18px', borderLeft: '4px solid #e67e22', paddingLeft: '10px' }}>ปัญหาและข้อเสนอแนะ</h2>
           <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '14px', boxSizing: 'border-box' }}>
             <thead>
               <tr style={{ backgroundColor: '#e67e22', color: '#ffffff' }}>
                 <th style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '24%' }}>ห้องเรียน / วิทยากร</th>
                 <th style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '38%' }}>ปัญหาที่พบ</th>
                 <th style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center', width: '38%' }}>ข้อเสนอแนะ</th>
               </tr>
             </thead>
             <tbody>
               {summaryData.map((item, idx) => {
                 const isEven = idx % 2 === 0;
                 return (
                 <tr key={(item.id || idx) + '_issues'} style={{ backgroundColor: isEven ? '#ffffff' : '#fcf3eb' }}>
                   <td style={{ boxSizing: 'border-box', padding: '8px 8px', border: '1px solid #e2e8f0', verticalAlign: 'top', textAlign: 'left', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                     <div style={{ fontWeight: 'bold', color: '#334155', fontSize: '15px' }}>{item.classrooms?.name}</div>
                     <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>วิทยากร:</div>
                     <div style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'pre-line', lineHeight: 1.45 }}>{formatTrainerNames(item.trainer_name)}</div>
                   </td>
                   <td style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'top', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', color: item.issues ? '#334155' : '#94a3b8' }}>
                     {item.issues || '-'}
                   </td>
                   <td style={{ boxSizing: 'border-box', padding: '10px 8px', border: '1px solid #e2e8f0', verticalAlign: 'top', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', color: item.suggestions ? '#334155' : '#94a3b8' }}>
                     {item.suggestions || '-'}
                   </td>
                 </tr>
                 );
               })}
             </tbody>
           </table>
        </div>
      </div>

      {pdfPreview && <PDFPreviewModal preview={pdfPreview} onClose={() => setPdfPreview(null)} />}

      <div className="page-title">
        <div>
          <span className="eyebrow">On-site Tasks</span>
          <h1>จัดการงานหน้างาน</h1>
          <p>เลือกฟอร์มที่ต้องการใช้งาน หรือคัดลอกลิงก์ให้โรงเรียน</p>
        </div>
      </div>

      {/* Daily Summary Section (NEW) */}
      <div className="card onsite-summary-card" style={{ marginTop: '20px', padding: '30px' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={22} color="var(--brand)"/> สรุปใบปะหน้าประจำวัน (Daily Report)
        </h2>
        <div className="onsite-filter-grid" style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <Field label="สำนักงาน" icon={<School size={18}/>}>
              <Select value={summaryOfficeId} onChange={val => {setSummaryOfficeId(val); setSummarySchoolId('');}}>
                <option value="">-- ทุกสำนักงาน --</option>
                {offices?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <Field label="โรงเรียน" icon={<School size={18}/>}>
              <Select value={summarySchoolId} onChange={setSummarySchoolId}>
                <option value="" disabled>-- เลือกโรงเรียน --</option>
                {(summaryOfficeId ? schools.filter(s => String(s.officeId) === String(summaryOfficeId)) : schools).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <Field label="วันที่เข้าสอน" icon={<Calendar size={18}/>}>
              <ThaiDateInput value={summaryDate} onChange={setSummaryDate} placeholder="เลือกวันที่" />
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <Field label="วันที่ที่มีใบปะหน้า" icon={<Calendar size={18}/>}>
              <Select value={selectedSummaryDateOption} onChange={setSummaryDate} disabled={!summarySchoolId || loadingSummaryDates || !summaryDates.length}>
                <option value="">{loadingSummaryDates ? 'กำลังโหลดวันที่...' : summarySchoolId ? '-- เลือกจากวันที่ที่พบ --' : 'เลือกโรงเรียนก่อน'}</option>
                {summaryDates.map(item => (
                  <option key={`${item.date}-${item.endDate || ''}`} value={item.date}>
                    {formatDateRange(item.date, item.endDate)} · {item.classroomCount || item.count} ห้อง{item.robots.length ? ` · ${item.robots.join(', ')}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <button className="button" onClick={fetchSummary} disabled={loadingSummary} style={{ padding: '11px 20px', height: '42px', marginBottom: '8px' }}>
            {loadingSummary ? <><Loader2 size={16} className="spin" style={{marginRight: '8px'}}/> โหลดข้อมูล...</> : <><Search size={16} style={{marginRight: '8px'}}/> ดึงข้อมูล</>}
          </button>
        </div>

        {summaryData.length > 0 && (
          <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
            <h3 style={{ margin: '0 0 15px 0', color: 'var(--text)' }}>ข้อมูลที่พร้อมสรุป ({summaryData.length} ห้อง)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '5px' }}>วิทยากร</div>
                <div style={{ fontWeight: '600' }}>{joinedTrainers}</div>
              </div>
              <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '5px' }}>ห้องเรียน</div>
                <div style={{ fontWeight: '600', color: 'var(--brand)' }}>{joinedClasses}</div>
              </div>
              <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '5px' }}>ยอดนักเรียนรวม</div>
                <div style={{ fontWeight: '600' }}><span style={{color: '#16a34a'}}>มา {totalPresent}</span> / <span style={{color: '#dc2626'}}>ขาด {totalAbsent}</span></div>
              </div>
            </div>

            <div className="onsite-table-wrap" style={{ marginTop: '20px', marginBottom: '20px', overflowX: 'auto' }}>
              <table className="responsive-card-table onsite-summary-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>ห้องเรียน</th>
                    <th style={{ padding: '10px' }}>ชุดข้อสอบ</th>
                    <th style={{ padding: '10px' }}>วิทยากร</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                      <td data-label="ห้องเรียน" style={{ padding: '10px' }}>{item.classrooms?.name}</td>
                      <td data-label="ชุดข้อสอบ" style={{ padding: '10px' }}>{parseTermInfo(item.academic_term).exam}</td>
                      <td data-label="วิทยากร" style={{ padding: '10px' }}>{item.trainer_name}</td>
                      <td data-label="จัดการ" style={{ padding: '10px', textAlign: 'right' }}>
                        <button className="button danger-text" onClick={() => handleDeleteSummary(item.id)} style={{ padding: '4px 10px', fontSize: '13px' }} title="ลบใบปะหน้าห้องนี้">
                          <Trash2 size={16} style={{marginRight: '5px'}}/> ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="button" onClick={() => handleGeneratePDF('preview')}>
                <Eye size={16} style={{marginRight: '5px'}}/> ดูตัวอย่าง PDF
              </button>
              <button className="primary" onClick={() => handleGeneratePDF('download')}>
                <Download size={16} style={{marginRight: '5px'}}/> ดาวน์โหลด PDF ใบสรุป
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="form-grid onsite-link-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '30px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 20px', gap: '15px' }}>
          <div style={{ padding: '20px', background: 'var(--brand-light)', color: 'var(--brand)', borderRadius: '50%' }}>
            <ClipboardCheck size={48} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 5px 0' }}>ฟอร์มบันทึกผลการทดสอบ (สำหรับวิทยากร)</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', margin: 0 }}>วิทยากรใช้มือถือบันทึกผลหลังทดสอบเสร็จแต่ละห้อง</p>
          </div>
          <button className="primary" style={{ marginTop: '10px' }} onClick={() => window.open('/evaluate', '_blank')}>เปิดฟอร์ม</button>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 20px', gap: '15px' }}>
          <div style={{ padding: '20px', background: '#f0f9ff', color: '#0284c7', borderRadius: '50%' }}>
            <LinkIcon size={48} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 5px 0' }}>ลิงก์เตรียมความพร้อม (สำหรับคุณครู)</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', margin: 0 }}>ส่งลิงก์นี้ให้ครูเพื่อระบุข้อมูลห้องเรียนล่วงหน้า</p>
          </div>
          <div className="onsite-link-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px', width: '100%', justifyContent: 'center' }}>
             <button className="button" onClick={() => window.open('/request', '_blank')}>เปิดดูฟอร์ม</button>
             <button className="primary" onClick={copyLink}><Copy size={16} style={{marginRight: '5px'}}/>คัดลอกลิงก์</button>
          </div>
        </div>
      </div>

      {/* Recent Requests Table */}
      <div className="card" style={{ marginTop: '30px' }}>
        <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BellRing size={20} color="var(--brand)"/> รายการคำขอเตรียมความพร้อมล่าสุด
          </h2>
          <div className="onsite-request-filters" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Select value={filterRequestTerm} onChange={setFilterRequestTerm} style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}>
              <option value="">-- เนื้อหาที่เรียนทั้งหมด --</option>
              {uniqueRequestTerms.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select value={filterRequestRobot} onChange={setFilterRequestRobot} style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}>
              <option value="">-- หุ่นยนต์ทั้งหมด --</option>
              {ROBOT_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
            <button className="button" onClick={fetchRequests} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              {loading ? 'กำลังโหลด...' : 'รีเฟรชข้อมูล'}
            </button>
          </div>
        </div>
        
        <div className="onsite-table-wrap" style={{ overflowX: 'auto', padding: '0' }}>
          <table className="responsive-card-table onsite-request-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                <th style={{ padding: '15px 20px', color: '#495057', fontWeight: '600', width: '150px' }}>ล่าสุดเมื่อ</th>
                <th style={{ padding: '15px 10px', color: '#495057', fontWeight: '600' }}>โรงเรียน</th>
                <th style={{ padding: '15px 10px', color: '#495057', fontWeight: '600', textAlign: 'center' }}>จำนวนห้องเรียน</th>
                <th style={{ padding: '15px 10px', color: '#495057', fontWeight: '600', textAlign: 'center', width: '130px' }}>สถานะ</th>
                <th style={{ padding: '15px 20px', color: '#495057', fontWeight: '600', textAlign: 'right', width: '220px' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {groupArray.map(group => {
                const isExpanded = expandedSchools[group.school_id];
                const periodSummaries = getPeriodSummary(group.details);
                return (
                <React.Fragment key={group.school_id}>
                  <tr className="onsite-request-row" style={{ borderBottom: isExpanded ? 'none' : '1px solid #e9ecef', background: group.status === 'pending' ? '#fff9f0' : 'white', transition: 'background 0.2s' }}>
                    <td data-label="ล่าสุดเมื่อ" style={{ padding: '15px 20px', color: 'var(--text-light)', fontSize: '0.9rem' }}>{formatDate(group.created_at)}</td>
                    <td data-label="โรงเรียน" style={{ padding: '15px 10px', fontWeight: '600', color: 'var(--text)' }}>{group.schoolName}</td>
                    <td data-label="จำนวนห้องเรียน" style={{ padding: '15px 10px', textAlign: 'center', color: 'var(--text-light)' }}>
                       <span style={{ background: '#e2e8f0', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600' }}>
                         {group.details.length} ห้อง
                       </span>
                    </td>
                    <td data-label="สถานะ" style={{ padding: '15px 10px', textAlign: 'center' }}>
                      {group.status === 'pending' ? (
                        <span style={{ display: 'inline-block', background: '#fef08a', color: '#854d0e', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600' }}>รอจัดเตรียม</span>
                      ) : (
                        <span style={{ display: 'inline-block', background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: 'fit-content', margin: '0 auto' }}><Check size={14}/> เตรียมแล้ว</span>
                      )}
                    </td>
                    <td data-label="จัดการ" style={{ padding: '15px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="button" style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => toggleExpand(group.school_id)}>
                          <Search size={14} /> {isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                        </button>
                        {group.status === 'pending' && (
                          <button className="primary" style={{ padding: '6px 12px', fontSize: '0.85rem', border: 'none' }} onClick={() => handleAcknowledge(group.school_id)}>
                            รับทราบ
                          </button>
                        )}
                        <button className="button primary-text" style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand)' }} onClick={() => openRequestEditor(group)} title="แก้ไขคำขอ">
                          <Edit2 size={14} />
                        </button>
                        <button className="button danger-text" style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleDeleteRequestGroup(group.school_id)} title="ลบคำขอนี้ทิ้ง">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="onsite-request-expanded-row" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
                      <td colSpan="5" style={{ padding: '15px 25px 25px', borderLeft: '4px solid var(--accent)' }}>
                        <div style={{ background: 'var(--panel)', borderRadius: '12px', padding: '20px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                          <h4 style={{ margin: '0 0 15px 0', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                            <FileText size={18} color="var(--accent)"/> สรุปภาพรวมคาบเรียน (เพื่อคำนวณหาระดับข้อสอบ)
                          </h4>
                          <div style={{ background: 'var(--accent-soft)', padding: '15px 20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}>
                            {periodSummaries.map((s, idx) => (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: idx === periodSummaries.length - 1 ? 0 : '18px' }}>
                                <div style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {/* <span style={{ fontSize: '1.2rem' }}>🤖</span>  */}
                                  หุ่นยนต์ {s.robot}
                                  {s.average !== null && (
                                    <span style={{ marginLeft: '10px', background: 'var(--accent)', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                      เฉลี่ย: คาบ {s.average}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '28px' }}>
                                  {s.periodData.map((pd, pIdx) => (
                                     <div key={pIdx} style={{ background: 'white', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <span style={{ fontWeight: '700', color: 'var(--text)' }}>คาบ {pd.period}</span>
                                        <span style={{ background: 'var(--bg)', color: 'var(--muted)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600' }}>{pd.count} ห้อง</span>
                                     </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <table className="responsive-card-table onsite-detail-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--line)' }}>
                                <th style={{ padding: '12px 10px', color: 'var(--muted)', fontWeight: '600' }}>ชั้นเรียน</th>
                                <th style={{ padding: '12px 10px', color: 'var(--muted)', fontWeight: '600' }}>หุ่นยนต์</th>
                                <th style={{ padding: '12px 10px', color: 'var(--muted)', fontWeight: '600' }}>เนื้อหาที่เรียน</th>
                                <th style={{ padding: '12px 10px', color: 'var(--accent)', fontWeight: '700' }}>คาบเรียนที่</th>
                                <th style={{ padding: '12px 10px', color: 'var(--muted)', fontWeight: '600' }}>หมายเหตุ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.details.map(req => (
                                <tr key={req.id} style={{ borderBottom: '1px solid var(--line)' }}>
                                  <td data-label="ชั้นเรียน" style={{ padding: '12px 10px', fontWeight: '600', color: 'var(--text)' }}>{req.classrooms?.name}</td>
                                  <td data-label="หุ่นยนต์" style={{ padding: '12px 10px', color: 'var(--text)' }}>{req.robot_type}</td>
                                  <td data-label="เนื้อหาที่เรียน" style={{ padding: '12px 10px', color: 'var(--muted)' }}>{normalizeLearningContent(req.academic_term)}</td>
                                  <td data-label="คาบเรียนที่" style={{ padding: '12px 10px' }}>
                                    <span style={{ display: 'inline-block', background: 'var(--accent-soft)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>
                                      คาบ {req.teaching_period}
                                    </span>
                                  </td>
                                  <td data-label="หมายเหตุ" style={{ padding: '12px 10px', color: req.note ? 'var(--text)' : 'var(--muted)', whiteSpace: 'pre-wrap' }}>{req.note || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!loading && groupArray.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>
              ยังไม่มีคำขอเตรียมความพร้อมใหม่ในขณะนี้
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal Removed in favor of Expandable Rows */}

      {editingRequestGroup && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && !savingRequestEdit && setEditingRequestGroup(null)}>
          <div className="modal-card" style={{ maxWidth: '900px', width: 'min(900px, calc(100vw - 32px))' }}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">คำขอเตรียมความพร้อม</span>
                <h2>แก้ไขข้อมูลที่ครูส่งมา</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '12px' }}>{editingRequestGroup.schoolName}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setEditingRequestGroup(null)} disabled={savingRequestEdit} aria-label="ปิด"><X/></button>
            </div>

            <div className="onsite-edit-table-wrap" style={{ padding: '22px 24px', overflowX: 'auto' }}>
              <table className="responsive-card-table onsite-edit-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '940px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>ชั้นเรียน</th>
                    <th style={{ padding: '10px' }}>หุ่นยนต์</th>
                    <th style={{ padding: '10px' }}>เนื้อหาที่เรียน</th>
                    <th style={{ padding: '10px' }}>คาบสอนปัจจุบัน</th>
                    <th style={{ padding: '10px' }}>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {editingRequestRows.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td data-label="ชั้นเรียน" style={{ padding: '10px', fontWeight: 700 }}>{row.classroomName}</td>
                      <td data-label="หุ่นยนต์" style={{ padding: '10px' }}>
                        <select value={row.robot_type} onChange={e => updateEditingRequestRow(row.id, 'robot_type', e.target.value)} disabled={savingRequestEdit} style={{ width: '100%', height: '38px', border: '1px solid var(--line)', borderRadius: '7px', padding: '0 10px', background: 'var(--panel)', color: 'var(--text)' }}>
                          {ROBOT_TYPES.map(robot => <option key={robot} value={robot}>{robot}</option>)}
                        </select>
                      </td>
                      <td data-label="เนื้อหาที่เรียน" style={{ padding: '10px' }}>
                        <select value={normalizeLearningContent(row.academic_term)} onChange={e => updateEditingRequestRow(row.id, 'academic_term', e.target.value)} disabled={savingRequestEdit} style={{ width: '100%', height: '38px', border: '1px solid var(--line)', borderRadius: '7px', padding: '0 10px', background: 'var(--panel)', color: 'var(--text)' }}>
                          {LEARNING_CONTENT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </td>
                      <td data-label="คาบสอนปัจจุบัน" style={{ padding: '10px' }}>
                        <input type="number" min="1" value={row.teaching_period} onChange={e => updateEditingRequestRow(row.id, 'teaching_period', e.target.value)} disabled={savingRequestEdit} style={{ width: '100%', height: '38px', border: '1px solid var(--line)', borderRadius: '7px', padding: '0 10px', background: 'var(--panel)', color: 'var(--text)' }} />
                      </td>
                      <td data-label="หมายเหตุ" style={{ padding: '10px' }}>
                        <textarea value={row.note || ''} onChange={e => updateEditingRequestRow(row.id, 'note', e.target.value)} disabled={savingRequestEdit} placeholder="เช่น ข้อสอบชุด Intermediate 2" rows={2} style={{ width: '100%', minHeight: '54px', border: '1px solid var(--line)', borderRadius: '7px', padding: '8px 10px', background: 'var(--panel)', color: 'var(--text)', resize: 'vertical' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setEditingRequestGroup(null)} disabled={savingRequestEdit}>ยกเลิก</button>
              <button type="button" className="primary" onClick={saveRequestEditor} disabled={savingRequestEdit || editingRequestRows.length === 0}>
                {savingRequestEdit ? <Loader2 size={18} className="spin" style={{ marginRight: '6px' }} /> : null}
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
