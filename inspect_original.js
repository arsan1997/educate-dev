const ExcelJS = require('exceljs');

async function inspectOriginal() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('excel/คะแนนทดสอบ โรงเรียนศรีบางลางวิทยานุสรณ์.xlsx');
  const worksheet = workbook.worksheets[0];

  console.log('Original Sheet info:');
  
  // Inspect headers row (usually 5-9 in this format)
  for (let i = 5; i <= 9; i++) {
    const row = worksheet.getRow(i);
    console.log(`Row ${i}:`);
    row.eachCell({includeEmpty: false}, (cell, colNumber) => {
        if (cell.fill) {
            console.log(`  Cell ${colNumber} Fill:`, JSON.stringify(cell.fill));
        }
        if (cell.font) {
            console.log(`  Cell ${colNumber} Font:`, JSON.stringify(cell.font));
        }
    });
  }

  // Check Logo in Original
  console.log('Images:', worksheet.getImages().length);
  worksheet.getImages().forEach((img, idx) => {
      console.log(`Image ${idx} range:`, img.range);
  });
}

inspectOriginal();
