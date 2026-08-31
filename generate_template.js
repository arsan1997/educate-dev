const fs = require('fs');
const XLSX = require('xlsx');

// Create a new workbook
const wb = XLSX.utils.book_new();

// Data for the template
const data = [
  ['โรงเรียนต้นแบบมาตรฐาน'],
  ['ปีการศึกษา 2568', 'ภาคเรียนที่ 1'],
  [],
  ['ลำดับ', 'เลขประจำตัวประชาชน', 'เลขประจำตัวนักเรียน', 'ชั้นเรียน', 'ชื่อ - นามสกุล']
];

// Add 10 empty rows for examples
for (let i = 1; i <= 10; i++) {
  data.push([i, '', '', 'ป.4/1', '']);
}

// Convert data to worksheet
const ws = XLSX.utils.aoa_to_sheet(data);

// Adjust column widths
ws['!cols'] = [
  { wch: 8 },  // ลำดับ
  { wch: 20 }, // เลขบัตร
  { wch: 15 }, // รหัสนักเรียน
  { wch: 10 }, // ชั้นเรียน
  { wch: 30 }  // ชื่อ
];

// Append worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

// Ensure public directory exists
if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public');
}

// Write to public folder
XLSX.writeFile(wb, './public/template.xlsx');
console.log('Template created at public/template.xlsx');
