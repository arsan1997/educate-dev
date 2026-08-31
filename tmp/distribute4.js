const fs = require('fs');

const extracted = JSON.parse(fs.readFileSync('tmp/extracted.json', 'utf-8'));
let remaining = fs.readFileSync('tmp/remaining.jsx', 'utf-8');

const getImports = (depth) => {
  const prefix = depth === 2 ? '../../' : '../';
  return `import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '${prefix}model';
import {supabase,isSupabaseConfigured} from '${prefix}supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from '${prefix}dataService';
import brandLogo from '${prefix}assets/logo.png';
`;
};

const files = {
  'src/components/ui/Field.jsx': { comps: ['Field'], depth: 2 },
  'src/components/ui/Select.jsx': { comps: ['Select'], depth: 2 },
  'src/components/ui/ConfirmModal.jsx': { comps: ['ConfirmModal'], depth: 2 },
  'src/components/ui/PDFPreviewModal.jsx': { comps: ['PDFPreviewModal'], depth: 2 },
  'src/components/ui/AuthLoading.jsx': { comps: ['AuthLoading'], depth: 2 },
  'src/components/ui/PendingAccess.jsx': { comps: ['PendingAccess'], depth: 2 },
  'src/components/ui/GoogleMark.jsx': { comps: ['GoogleMark'], depth: 2 },
  
  'src/components/modals/AddSchoolModal.jsx': { comps: ['AddSchoolModal'], deps: ['../ui/Field', '../ui/Select'], depth: 2 },
  'src/components/modals/ImportOfficeModal.jsx': { comps: ['ImportOfficeModal'], deps: ['../ui/Field', '../ui/Select'], depth: 2 },
  'src/components/modals/AddStudentModal.jsx': { comps: ['AddStudentModal'], deps: ['../ui/Field', '../ui/Select'], depth: 2 },
  
  'src/pages/Dashboard.jsx': { comps: ['Dashboard'], deps: ['../components/ui/Select'], depth: 1 },
  'src/pages/Classroom.jsx': { comps: ['Classroom'], deps: ['../components/ui/Field', '../components/ui/Select', '../components/ui/ConfirmModal', '../components/modals/AddStudentModal'], depth: 1 },
  'src/pages/ScorePage.jsx': { comps: ['ScorePage'], deps: ['../components/ui/Field', '../components/ui/Select'], depth: 1 },
  'src/pages/Reports.jsx': { comps: ['Reports'], deps: [], depth: 1 },
  'src/pages/AccessAdmin.jsx': { comps: ['AccessAdmin'], deps: ['../components/ui/Field', '../components/ui/Select'], depth: 1 },
  'src/pages/AuthPage.jsx': { comps: ['AuthPage'], deps: ['../components/ui/GoogleMark', '../components/ui/AuthLoading', '../components/ui/PendingAccess'], depth: 1 },
};

// Generate components
for (const [path, info] of Object.entries(files)) {
  let content = getImports(info.depth);
  if (info.deps) {
    info.deps.forEach(dep => {
      const depName = dep.split('/').pop();
      content += `import ${depName} from '${dep}';\n`;
    });
  }
  content += '\n';
  info.comps.forEach(comp => {
    content += extracted[comp] + '\n\n';
    content += `export default ${comp};\n`;
  });
  fs.writeFileSync(path, content);
}

console.log('Distributed uncommitted AST components.');
