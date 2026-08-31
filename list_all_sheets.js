const ExcelJS = require('exceljs');

async function listSheets() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('excel/คะแนนทดสอบ โรงเรียนศรีบางลางวิทยานุสรณ์.xlsx');
  
  console.log('Sheets in workbook:');
  workbook.worksheets.forEach(ws => {
    console.log(`- ${ws.name}`);
    // Peek at first few rows of each sheet
    for(let i=1; i<=10; i++) {
        const row = ws.getRow(i).values;
        if (row && row.length > 0) {
            console.log(`  Row ${i}:`, row);
        }
    }
  });
}

listSheets();
