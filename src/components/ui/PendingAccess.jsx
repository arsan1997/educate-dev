import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from '../../model';
import {supabase,isSupabaseConfigured} from '../../supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from '../../dataService';
import brandLogo from '../../assets/logo.png';

function PendingAccess({user,onSignOut,onRefresh}){return <div className="pending-shell"><div className="pending-card"><img src={brandLogo} alt="School Robotics"/><div className="pending-icon"><Clock3/></div><span className="eyebrow">WAITING FOR APPROVAL</span><h1>บัญชีกำลังรออนุมัติ</h1><p>สมัครสมาชิกเรียบร้อยแล้ว กรุณาแจ้ง Admin ให้กำหนดสิทธิ์และโรงเรียนสำหรับ <b>{user.email}</b></p><div className="pending-actions"><button className="primary" onClick={onRefresh}>ตรวจสอบสิทธิ์อีกครั้ง</button><button className="button" onClick={onSignOut}><LogOut/>ออกจากระบบ</button></div></div></div>}

export default PendingAccess;
