import React, { useState } from 'react';
import { Upload, FileCog, Download, Trash2, X, RefreshCw, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseSchoolWorkbook, calcStats, compareClassNames } from '../model';

export default function DataPrep() {
  const [files, setFiles] = useState([]);
  const [mergedSchool, setMergedSchool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFiles = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const parsedList = [];
      for (const file of selectedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const parsed = await parseSchoolWorkbook(arrayBuffer, file.name);
        if (parsed.classrooms.length > 0) {
          parsedList.push({ file, parsed });
        }
      }

      if (!parsedList.length) {
        throw new Error('ไม่พบรายชื่อนักเรียนในไฟล์ที่เลือกเลย');
      }

      setFiles(prev => [...prev, ...parsedList]);
      
      // Combine
      combineSchools([...files, ...parsedList]);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const removeFile = (index) => {
    const nextFiles = [...files];
    nextFiles.splice(index, 1);
    setFiles(nextFiles);
    combineSchools(nextFiles);
  };

  const combineSchools = (currentFiles) => {
    if (!currentFiles.length) {
      setMergedSchool(null);
      return;
    }

    const base = currentFiles[0].parsed;
    const combined = {
      name: base.name,
      year: base.year,
      term: base.term,
      classrooms: [],
      sessions: []
    };

    let classCount = 0;
    for (const { parsed } of currentFiles) {
      for (const room of parsed.classrooms) {
        // give new ID to avoid conflict
        const newClassId = `class-prep-${++classCount}`;
        const clonedRoom = { ...room, id: newClassId };
        combined.classrooms.push(clonedRoom);

        // Map old sessions to new class id
        const roomSessions = parsed.sessions.filter(s => s.classId === room.id);
        for (const sess of roomSessions) {
          combined.sessions.push({ ...sess, id: `session-prep-${Math.random()}`, classId: newClassId });
        }
      }
    }

    // Sort classrooms by name
    combined.classrooms.sort((a, b) => compareClassNames(a.name, b.name));
    setMergedSchool(combined);
  };

  const exportCombinedExcel = async () => {
    if (!mergedSchool) return;
    try {
      setLoading(true);
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const usedSheetNames = new Set();
      const safeSheetName = raw => {
        const base = String(raw || 'ชีต').replace(/[\\/*?:\[\]]/g, '-').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'ชีต';
        let name = base, index = 2;
        while (usedSheetNames.has(name.toLowerCase())) {
          const suffix = `-${index++}`;
          name = base.slice(0, 31 - suffix.length) + suffix;
        }
        usedSheetNames.add(name.toLowerCase());
        return name;
      };
      
      const FONT_NAME = 'TH Sarabun New';
      const FONT_REG = { name: FONT_NAME, size: 14 };
      const FONT_BOLD = { name: FONT_NAME, size: 14, bold: true };
      const BORDER_THIN = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };

      const applyHeaderStyle = (cell) => {
        cell.font = FONT_BOLD;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EEE9' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      };

      // Create a sheet for each classroom
      mergedSchool.classrooms.forEach(c => {
        const ws = workbook.addWorksheet(safeSheetName(c.name));
        ws.getRow(1).getCell(1).value = `รายชื่อนักเรียน ชั้น ${c.name}`;
        ws.getRow(1).getCell(1).font = { name: FONT_NAME, size: 20, bold: true };
        ws.mergeCells(1, 1, 1, 12);
        
        // Let's add basic school context to make it compliant with our parser
        ws.getRow(2).getCell(1).value = `โรงเรียน ${mergedSchool.name} ภาคเรียนที่ ${mergedSchool.term} ปีการศึกษา ${mergedSchool.year}`;
        ws.getRow(2).getCell(1).font = FONT_REG;

        const sessions = mergedSchool.sessions.filter(s => s.classId === c.id);
        const hRow = ws.getRow(4);
        ['เลขที่', 'ชื่อ-นามสกุล'].forEach((h, i) => {
          const cell = hRow.getCell(i + 1);
          cell.value = h;
          applyHeaderStyle(cell);
        });
        ws.getColumn(1).width = 10;
        ws.getColumn(2).width = 40;

        sessions.forEach((s, i) => {
          const cell = hRow.getCell(3 + i * 3);
          cell.value = s.test;
          applyHeaderStyle(cell);
          ws.mergeCells(4, 3 + i * 3, 4, 3 + i * 3 + 2);
          
          ws.getRow(5).getCell(3 + i * 3).value = 50; // Score
          ws.getRow(5).getCell(3 + i * 3 + 1).value = 'เวลา';
          ws.getRow(5).getCell(3 + i * 3 + 2).value = 'ลำดับ';
          
          ws.getColumn(3 + i * 3).width = 10;
          ws.getColumn(3 + i * 3 + 1).width = 10;
          ws.getColumn(3 + i * 3 + 2).width = 10;
        });

        c.students.forEach((st, idx) => {
          const row = ws.getRow(6 + idx);
          const noCell = row.getCell(1);
          const nameCell = row.getCell(2);
          noCell.value = st.no;
          nameCell.value = st.name;
          [noCell, nameCell].forEach(cell => {
            cell.font = FONT_REG;
            cell.alignment = { vertical: 'middle', horizontal: cell === nameCell ? 'left' : 'center' };
            cell.border = BORDER_THIN;
          });

          sessions.forEach((sess, si) => {
            const cellScore = row.getCell(3 + si * 3);
            const cellTime = row.getCell(3 + si * 3 + 1);
            const entry = sess.entries?.[st.id];
            
            if (entry) {
              if (entry.absent) {
                cellScore.value = 'x';
                cellScore.font = { ...FONT_REG, color: { argb: 'FFFF0000' } };
              } else {
                cellScore.value = Number(entry.score) || '';
                cellScore.font = FONT_REG;
              }
              cellTime.value = entry.time || '';
            }
            [cellScore, cellTime].forEach(c => {
              c.alignment = { vertical: 'middle', horizontal: 'center' };
              c.border = BORDER_THIN;
            });
          });
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Prepared_${mergedSchool.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      setSuccess('สร้างไฟล์ Excel ที่จัดรูปแบบแล้วสำเร็จ! คุณสามารถนำไฟล์นี้ไปอัปโหลดเข้าสู่ระบบได้เลย');
    } catch (err) {
      setError(`ส่งออกไม่ได้: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-title">
        <div>
          <span className="eyebrow">เครื่องมือพิเศษ</span>
          <h1>จัดเตรียมข้อมูล Excel</h1>
          <p>รวมไฟล์รายชื่อหลายๆ ห้องที่แยกไฟล์กัน ให้กลายเป็นไฟล์เดียวที่พร้อมนำเข้าสู่ระบบหลัก (ไม่มีการอัปเดตลงคลาวด์ในหน้านี้)</p>
        </div>
      </div>

      {error && <div className="toast error"><X size={18}/>{error}</div>}
      {success && <div className="toast success"><CheckCircle2 size={18}/>{success}</div>}

      <div className="card">
        <div className="card-head">
          <div>
            <b>1. อัปโหลดไฟล์ Excel ที่ต้องการนำมารวมกัน</b>
            <small>สามารถเลือกหลายไฟล์พร้อมกันได้</small>
          </div>
          <label className="button primary">
            {loading ? <RefreshCw className="spin"/> : <Upload />}
            เลือกไฟล์ Excel
            <input type="file" multiple accept=".xlsx,.xls" onChange={handleFiles} hidden disabled={loading}/>
          </label>
        </div>

        {files.length > 0 && (
          <div className="table-wrap" style={{marginTop: '1rem'}}>
            <table>
              <thead>
                <tr>
                  <th>ชื่อไฟล์ที่เลือก</th>
                  <th>อ่านได้กี่ห้องเรียน</th>
                  <th className="center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={i}>
                    <td><FileSpreadsheet size={16} style={{verticalAlign: 'middle', marginRight: '0.5rem', color: '#107c41'}}/> <b>{f.file.name}</b></td>
                    <td>{f.parsed.classrooms.map(c => c.name).join(', ')}</td>
                    <td className="center">
                      <button className="icon-btn danger-text" onClick={() => removeFile(i)} title="เอาออก">
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mergedSchool && files.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <b>2. ตรวจสอบข้อมูลและดาวน์โหลด</b>
              <small>ระบบจะนำข้อมูลทั้งหมดมาจัดลงในไฟล์เดียว และแยก Sheet ตามห้องเรียนให้ถูกต้อง</small>
            </div>
            <button className="button primary" onClick={exportCombinedExcel} disabled={loading}>
              {loading ? <RefreshCw className="spin"/> : <Download />}
              ดาวน์โหลดไฟล์ Excel 
            </button>
          </div>
          
          <div style={{padding: '1.5rem', background: 'var(--bg)', borderRadius: '8px', margin: '1rem', border: '1px solid var(--border)'}}>
            <h3 style={{margin: '0 0 1rem 0'}}>{mergedSchool.name} (ปีการศึกษา {mergedSchool.year} ภาคเรียนที่ {mergedSchool.term})</h3>
            <div style={{display: 'flex', gap: '2rem', flexWrap: 'wrap'}}>
              <div>
                <div style={{fontSize: '0.8rem', color: 'var(--text-light)'}}>รวมห้องเรียนทั้งหมด</div>
                <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{mergedSchool.classrooms.length} ห้อง</div>
              </div>
              <div>
                <div style={{fontSize: '0.8rem', color: 'var(--text-light)'}}>รวมนักเรียนทั้งหมด</div>
                <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{mergedSchool.classrooms.reduce((sum, c) => sum + c.students.length, 0)} คน</div>
              </div>
            </div>
            
            <div style={{marginTop: '1.5rem'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.75rem'}}>รายการตรวจสอบความสมบูรณ์ของข้อมูล (Data Quality Check):</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                {mergedSchool.classrooms.map(c => {
                  const sortedNos = c.students.map(s => Number(s.no)).filter(n => !isNaN(n) && n > 0).sort((a,b) => a - b);
                  const missingNos = [];
                  const duplicateNos = [];
                  if (sortedNos.length > 0) {
                    let current = 1;
                    let index = 0;
                    while(index < sortedNos.length) {
                      if (sortedNos[index] < current) {
                         if (sortedNos[index] === sortedNos[index-1] && !duplicateNos.includes(sortedNos[index])) {
                            duplicateNos.push(sortedNos[index]);
                         }
                         index++;
                      } else if (sortedNos[index] === current) {
                         current++;
                         index++;
                      } else {
                         missingNos.push(current);
                         current++;
                      }
                    }
                  }
                  
                  const formatRanges = (arr) => {
                     if (!arr.length) return '';
                     let ranges = [], start = arr[0], prev = arr[0];
                     for (let i = 1; i <= arr.length; i++) {
                       if (arr[i] === prev + 1) { prev = arr[i]; }
                       else { 
                         ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
                         start = arr[i]; prev = arr[i];
                       }
                     }
                     return ranges.join(', ');
                  };
                  
                  const hasIssues = missingNos.length > 0 || duplicateNos.length > 0;
                  
                  return (
                    <div key={c.id} style={{padding: '0.75rem', background: hasIssues ? '#fffbef' : 'var(--surface)', border: `1px solid ${hasIssues ? '#fde68a' : 'var(--border)'}`, borderRadius: '8px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <span style={{fontWeight: 'bold'}}>{c.name}</span>
                        <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>({c.students.length} คน)</span>
                        {!hasIssues && <span style={{marginLeft: 'auto', color: '#15803d', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px'}}><CheckCircle2 size={14}/> ข้อมูลสมบูรณ์ เรียงเลขที่ถูกต้อง</span>}
                        {hasIssues && <span style={{marginLeft: 'auto', color: '#b45309', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px'}}><AlertCircle size={14}/> พบข้อสังเกต</span>}
                      </div>
                      {hasIssues && (
                        <div style={{marginTop: '0.5rem', fontSize: '0.85rem', color: '#b45309', background: 'rgba(245,158,11,0.1)', padding: '0.5rem', borderRadius: '4px'}}>
                           {missingNos.length > 0 && <div style={{marginBottom: duplicateNos.length > 0 ? '4px' : 0}}>• <b>เลขที่ขาดหายไป:</b> {formatRanges(missingNos)} <span style={{opacity: 0.8}}>(ระบบข้ามแถวที่ไม่มีชื่อ หรือไฟล์ต้นฉบับพิมพ์เลขที่ตกหล่น)</span></div>}
                           {duplicateNos.length > 0 && <div>• <b>เลขที่ซ้ำซ้อน:</b> {duplicateNos.join(', ')} <span style={{opacity: 0.8}}>(มีนักเรียนใช้เลขที่เดียวกันมากกว่า 1 คน)</span></div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
