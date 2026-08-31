import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Sun, Moon, LayoutDashboard, Users, ClipboardPenLine, FileText, Upload, Plus, Save, Download, ChevronDown, ChevronLeft, School, Bot, CheckCircle2, AlertCircle, X, LogOut, Cloud, CloudOff, Edit2, ShieldCheck, Clock3, Eye, UserMinus, RotateCcw} from 'lucide-react';
import {sampleSchool,parseSchoolWorkbook,calcStats,calcRanks,ROBOT_TYPES} from './model';
import {supabase,isSupabaseConfigured} from './supabase';
import {loadSchoolIndex,loadSchoolDetail,loadDashboardInsights,saveSchoolMeta,saveSessionRows,saveClassroomStudents,saveResultRows,saveSchoolBundle,deleteSchool,loadCurrentProfile,loadAccessAdmin,updateUserAccess,saveStudentOrder,loadOffices,createOffice} from './dataService';
import brandLogo from './assets/logo.png';
import './styles.css';
import './dynamic.css';

const seed = [
  {id:1,no:1,name:'เด็กชายภาคิน ศรีสุข',score:'44',time:'02:31',absent:false},
  {id:2,no:2,name:'เด็กหญิงปุณณภา ใจดี',score:'47',time:'02:12',absent:false},
  {id:3,no:3,name:'เด็กชายธนกฤต พูนทรัพย์',score:'39',time:'03:05',absent:false},
  {id:4,no:4,name:'เด็กหญิงกัญญาวีร์ แสงทอง',score:'',time:'',absent:true},
  {id:5,no:5,name:'เด็กชายณัฐดนัย คงมั่น',score:'42',time:'02:48',absent:false},
  {id:6,no:6,name:'เด็กหญิงพิชญาภา วงศ์ดี',score:'45',time:'02:26',absent:false},
  {id:7,no:7,name:'เด็กชายศุภวิชญ์ มีสุข',score:'36',time:'03:19',absent:false},
  {id:8,no:8,name:'เด็กหญิงธัญชนก พิพัฒน์',score:'49',time:'01:58',absent:false},
];
const classes=[{name:'ป.4/1',students:32,avg:42.6,pass:91},{name:'ป.4/2',students:30,avg:39.8,pass:83},{name:'ป.5/1',students:35,avg:44.1,pass:94},{name:'ป.5/2',students:34,avg:41.3,pass:88}];
const baseTabs=[['dashboard','ภาพรวม',LayoutDashboard],['classroom','จัดการชั้นเรียน',Users],['scores','บันทึกผลทดสอบ',ClipboardPenLine],['reports','รายงาน',FileText]];
const restore=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const schoolIdentity=value=>[value?.name,value?.year,value?.term].map(part=>String(part??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('th-TH')).join('|');


createRoot(document.getElementById('root')).render(<Root/>);