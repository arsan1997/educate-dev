import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '../../model';
import {supabase,isSupabaseConfigured} from '../../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from '../../dataService';
import brandLogo from '../../assets/logo.png';

function PDFPreviewModal({preview,onClose}){return <div className="pdf-preview-backdrop"><div className="pdf-preview-modal"><div className="pdf-preview-head"><div><span className="eyebrow">PDF PREVIEW</span><b>{preview.filename}</b></div><div><a className="primary" href={preview.url} download={preview.filename}><Download/>ดาวน์โหลด PDF</a><button className="icon" onClick={onClose} aria-label="ปิดตัวอย่าง"><X/></button></div></div><iframe src={preview.url} title={`ตัวอย่าง ${preview.filename}`}/></div></div>}

export default PDFPreviewModal;
