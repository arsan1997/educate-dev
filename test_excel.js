const fs = require('fs');

async function run() {
  const { parseSchoolWorkbook } = await import('./src/model.js');
  const filePath = './excel/Prepared_สายบุรีอิสลามวิทยา_2026-06-23.xlsx';
  const buffer = fs.readFileSync(filePath);
  
  try {
    const school = await parseSchoolWorkbook(buffer.buffer, 'Prepared_สายบุรีอิสลามวิทยา_2026-06-23.xlsx');
    
    // Check "ห้อง 1"
    const room1 = school.classrooms.find(c => c.name === 'ห้อง 1');
    console.log("ห้อง 1 Students:");
    room1.students.forEach(st => console.log(`${st.no}: ${st.name}`));
    
    const st14 = room1.students.find(s => s.no === 14);
    if (!st14) {
      console.log("\n!!! Student 14 is missing. Let's find why by reading the excel directly !!!");
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buffer);
      // We don't know which sheet it is, maybe it's named "ห้อง 1" or something similar.
      // Let's just find the row that has 14 but wasn't parsed.
      wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
        rows.forEach((row, ri) => {
          for(let c=0; c<row.length; c++) {
            if(row[c] == 14) {
              console.log(`Sheet: ${sheetName}, Row ${ri}:`, row);
            }
          }
        });
      });
    }

  } catch (err) {
    console.error(err);
  }
}

run();
