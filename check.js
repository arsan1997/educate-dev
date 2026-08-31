const fs=require('fs');
const p=require('path');
const d=fs.readFileSync('src/dataService.js','utf8');
const walk=(dir)=>{
  fs.readdirSync(dir).forEach(f=>{
    const full=p.join(dir,f);
    if(fs.statSync(full).isDirectory()) walk(full);
    else if(f.endsWith('.jsx')){
      const code=fs.readFileSync(full,'utf8');
      const m=code.match(/import\s+\{([^}]+)\}\s+from\s+['"].*dataService['"]/);
      if(m){
        m[1].split(',').map(s=>s.trim()).filter(Boolean).forEach(fn=>{
          if(!d.includes(fn)) console.log('Missing '+fn+' in '+f);
        });
      }
    }
  });
};
walk('src');
