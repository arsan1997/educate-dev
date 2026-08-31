const ExcelJS = require('exceljs');

async function inspectExcel() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('excel/webgen.xlsx');
  const worksheet = workbook.worksheets[0];

  console.log('Images info:');
  worksheet.getImages().forEach((img, idx) => {
      console.log(`Image ${idx}:`);
      console.log(`  Range tl: col=${img.range.tl.col}, row=${img.range.tl.row}`);
      console.log(`  Range br: col=${img.range.br.col}, row=${img.range.br.row}`);
      console.log(`  Range tl offsets: x=${img.range.tl.nativeColOff}, y=${img.range.tl.nativeRowOff}`);
  });
  
  // Also check column widths and row heights
  console.log('Col widths:', worksheet.columns.map(c => c.width));
  for(let i=1; i<=10; i++) {
      console.log(`Row ${i} height:`, worksheet.getRow(i).height);
  }
}

inspectExcel();
