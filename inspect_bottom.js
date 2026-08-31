const ExcelJS = require('exceljs');

async function inspectExcelBottom() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('excel/คะแนนทดสอบ โรงเรียนศรีบางลางวิทยานุสรณ์.xlsx');
  const worksheet = workbook.worksheets[0];

  const lastRow = worksheet.actualRowCount;
  console.log('Last Row:', lastRow);

  // Inspect last 15 rows
  for (let i = lastRow - 15; i <= lastRow; i++) {
    if (i < 1) continue;
    const row = worksheet.getRow(i);
    console.log(`Row ${i}:`, row.values);
  }
}

inspectExcelBottom();
