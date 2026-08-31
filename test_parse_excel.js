const fs = require('fs');
const XLSX = require('xlsx');

const filePath = './excel/Prepared_เด็กชาย อัศวิน เบญอาหมัดธีรกุล_2026-06-30.xlsx';
const wb = XLSX.readFile(filePath);

console.log('Sheets:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  console.log(`\n--- Sheet: ${sheetName} ---`);
  console.log('Total rows:', rows.length);
  // Print first 10 rows
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    console.log(`Row ${i}:`, rows[i]);
  }
}
