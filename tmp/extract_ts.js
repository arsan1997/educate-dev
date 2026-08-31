const fs = require('fs');
const ts = require('typescript');

const sourceCode = fs.readFileSync('tmp/full_uncommitted_main.jsx', 'utf-8');
const sourceFile = ts.createSourceFile('main.jsx', sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);

const functionsToExtract = [
  'ConfirmModal', 'AddSchoolModal', 'ImportOfficeModal', 'App', 
  'PDFPreviewModal', 'AccessAdmin', 'Field', 'Select', 'ScorePage', 
  'Dashboard', 'Classroom', 'AddStudentModal', 'Reports', 
  'GoogleMark', 'AuthLoading', 'PendingAccess', 'AuthPage', 'Root'
];

let extracted = {};
let remainingTokens = [];
let lastPos = 0;

function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name && functionsToExtract.includes(node.name.text)) {
    // Save previous text
    remainingTokens.push(sourceCode.substring(lastPos, node.pos));
    // Extract function text
    extracted[node.name.text] = sourceCode.substring(node.pos, node.end).trim();
    lastPos = node.end;
  } else if (ts.isVariableStatement(node)) {
    // If it's a const arrow function, we also extract it if its name matches
    const decl = node.declarationList.declarations[0];
    if (decl && decl.name && functionsToExtract.includes(decl.name.text) && decl.initializer && ts.isArrowFunction(decl.initializer)) {
      remainingTokens.push(sourceCode.substring(lastPos, node.pos));
      extracted[decl.name.text] = sourceCode.substring(node.pos, node.end).trim();
      lastPos = node.end;
    } else {
      ts.forEachChild(node, visit);
    }
  } else {
    ts.forEachChild(node, visit);
  }
}

visit(sourceFile);
remainingTokens.push(sourceCode.substring(lastPos));

fs.writeFileSync('tmp/extracted.json', JSON.stringify(extracted, null, 2));
fs.writeFileSync('tmp/remaining.jsx', remainingTokens.join('').trim());

console.log('Extraction complete. Found:', Object.keys(extracted).length);
