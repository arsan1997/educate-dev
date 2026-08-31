const ExcelJS = require('exceljs');

async function inspectExcel() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('excel/webgen.xlsx');
  const worksheet = workbook.worksheets[0];

  console.log('Sheet Name:', worksheet.name);

  // Inspect first 10 rows
  for (let i = 1; i <= 20; i++) {
    const row = worksheet.getRow(i);
    const values = row.values;
    console.log(`Row ${i}:`, values);
    
    // Inspect some styles for the first few rows
    if (i < 10) {
        row.eachCell((cell, colNumber) => {
            if (cell.fill) {
                console.log(`  Cell ${i}:${colNumber} Fill:`, JSON.stringify(cell.fill));
            }
            if (cell.font) {
                console.log(`  Cell ${i}:${colNumber} Font:`, JSON.stringify(cell.font));
            }
        });
    }
  }

  // Check for images
  console.log('Images:', worksheet.getImages().length);
  worksheet.getImages().forEach((img, idx) => {
      console.log(`Image ${idx}:`, JSON.stringify(img.range));
  });
}

inspectExcel();
