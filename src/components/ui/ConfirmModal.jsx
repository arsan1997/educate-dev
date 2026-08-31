import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '../../model';
import {supabase,isSupabaseConfigured} from '../../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from '../../dataService';
import brandLogo from '../../assets/logo.png';

function ConfirmModal({title='ยืนยันการทำรายการ',message,onConfirm,onClose,dangerLabel='ยืนยันลบ',danger=true,saveLabel,onSave}){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal-card confirm-card"><div className="confirm-icon"><AlertCircle size={48}/></div><h3>{title}</h3><p style={{whiteSpace: 'pre-line'}}>{message}</p><div className="modal-actions"><button type="button" className="button" onClick={onClose}>ยกเลิก</button>{saveLabel&&<button type="button" className="primary" onClick={()=>{onSave();onClose()}}>{saveLabel}</button>}<button type="button" className={danger?'button danger-text':'primary'} onClick={()=>{onConfirm();onClose()}}>{dangerLabel}</button></div></div></div>}

export default ConfirmModal;
