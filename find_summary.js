const ExcelJS = require('exceljs');

async function findSummary() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('excel/คะแนนทดสอบ โรงเรียนศรีบางลางวิทยานุสรณ์.xlsx');
  const worksheet = workbook.worksheets[0];

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (typeof cell.value === 'string' && (cell.value.includes('เฉลี่ย') || cell.value.includes('ผ่านเกณฑ์'))) {
        console.log(`Found at Row ${rowNumber}, Col ${colNumber}: "${cell.value}"`);
      }
    });
  });
}

findSummary();
