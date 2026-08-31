import {supabase} from './supabase';
import { compareClassNames, normalizeExamSet } from './model';

const must=({data,error})=>{if(error)throw error;return data};
const chunks=a=>a.length?a:null;
const isMissingNoteColumn=error=>error&&(error.code==='42703'||error.code==='PGRST204'||String(error.message||'').toLowerCase().includes('note'));
const compact=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,'');
const normalizeRange=(start,end)=>({start:start||'',end:end||start||''});
const rangesOverlap=(aStart,aEnd,bStart,bEnd)=>{
 const a=normalizeRange(aStart,aEnd),b=normalizeRange(bStart,bEnd);
 if(!a.start||!b.start)return true;
 return a.start<=b.end&&b.start<=a.end;
};
export const parseExamFromAcademicTerm=term=>{
 const text=String(term||'');
 const botleyBasic=text.match(/\bBasic\s*([AB])\s*(\d+)\b/i);
 if(botleyBasic)return `Basic ${botleyBasic[1].toUpperCase()}${botleyBasic[2]}`;
 const match=text.match(/\b(Basic|Intermediate|Inter|Advance)\s*(\d+)\b/i);
 if(!match)return '';
 const level=match[1].toLowerCase();
 const normalizedLevel=level==='basic'?'Basic':level==='advance'?'Advance':'Intermediate';
 return `${normalizedLevel} ${match[2]}`;
};
const examFromEvaluation=data=>normalizeExamSet(data?.examLevel,data?.period,data?.robot);
const sameEvaluationContext=(row,criteria={})=>{
 if(criteria.schoolId&&row.school_id!==criteria.schoolId)return false;
 if(criteria.classId&&row.classroom_id!==criteria.classId)return false;
 if(criteria.teachingPeriod&&String(row.teaching_period)!==String(criteria.teachingPeriod))return false;
 if(criteria.robot&&row.robot_type&&row.robot_type!==criteria.robot)return false;
 const term=compact(criteria.term);
 if(term&&!compact(row.academic_term).includes(term))return false;
 const exam=compact(criteria.expectedExam||examFromEvaluation(criteria));
 if(exam&&!compact(row.academic_term).includes(exam))return false;
 return rangesOverlap(row.eval_date,row.end_date,criteria.date,criteria.endDate);
};
const matchesRobot=(row,criteria={})=>!criteria.robot||!row.robot_type||row.robot_type===criteria.robot;
const scoreEvaluationMatch=(row,criteria={})=>{
 let score=0;
 if(criteria.date&&rangesOverlap(row.eval_date,row.end_date,criteria.date,criteria.endDate))score+=20;
 const term=compact(criteria.term);
 if(term&&compact(row.academic_term).includes(term))score+=5;
 const exam=compact(criteria.expectedExam||examFromEvaluation(criteria));
 if(exam&&compact(row.academic_term).includes(exam))score+=5;
 if(criteria.teachingPeriod&&String(row.teaching_period)===String(criteria.teachingPeriod))score+=2;
 if(criteria.robot&&row.robot_type===criteria.robot)score+=1;
 return score;
};
const fetchAll = async (builderFn) => {
  let allData = [];
  let from = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await builderFn().range(from, from + size - 1);
    if (error) throw error;
    allData = allData.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return allData;
};
export async function loadSchools(){
 const schools=await fetchAll(()=>supabase.from('schools').select('*').eq('is_deleted',false).order('created_at'));if(!schools.length)return [];
 const ids=schools.map(s=>s.id),classrooms=(await fetchAll(()=>supabase.from('classrooms').select('*').in('school_id',ids).eq('is_deleted',false).order('created_at'))).sort((a,b)=>compareClassNames(a.name, b.name));
 const classIds=classrooms.map(c=>c.id),students=classIds.length?await fetchAll(()=>supabase.from('students').select('*').in('classroom_id',classIds).order('student_no')):[];
 const sessions=classIds.length?await fetchAll(()=>supabase.from('test_sessions').select('*').in('classroom_id',classIds).eq('is_deleted',false).order('created_at')):[];
 const sessionIds=sessions.map(s=>s.id),results=sessionIds.length?await fetchAll(()=>supabase.from('test_results').select('*').in('session_id',sessionIds)):[];
 return schools.map(s=>({id:s.id,name:s.name,year:s.academic_year,term:s.term,officeId:s.office_id||'',classrooms:classrooms.filter(c=>c.school_id===s.id).map(c=>({id:c.id,name:c.name,students:students.filter(st=>st.classroom_id===c.id).map(st=>({id:st.id,no:st.student_no,prefix:st.prefix||'',firstName:st.first_name||'',lastName:st.last_name||'',name:st.full_name,active:st.active!==false,leftAt:st.left_at||''}))})),sessions:sessions.filter(x=>classrooms.some(c=>c.school_id===s.id&&c.id===x.classroom_id)).map(x=>({id:x.id,classId:x.classroom_id,test:x.test_name,date:x.test_date,robot:x.robot_type,exam:x.exam_set,teachingPeriod:x.teaching_period||'',trainer:x.trainer,feedback:{detail:x.detail||'',summary:x.summary||''},entries:Object.fromEntries(results.filter(r=>r.session_id===x.id).map(r=>[r.student_id,{score:r.score==null?'':String(r.score),time:r.time_value||'',absent:r.absent,is_special:r.is_special,updatedBy:r.updated_by}]))}))}));
}

export async function loadSchoolIndex(){
 const schools=await fetchAll(()=>supabase.from('schools').select('*').eq('is_deleted',false).order('created_at'));
 if(!schools.length)return [];
 const classrooms=(await fetchAll(()=>supabase.from('classrooms').select('id,school_id,name,created_at').in('school_id',schools.map(s=>s.id)).eq('is_deleted',false).order('created_at'))).sort((a,b)=>compareClassNames(a.name, b.name));
 const summaryResponse=await supabase.rpc('school_dashboard_summaries');
 const summaries=summaryResponse.error?[]:(summaryResponse.data||[]),summaryMap=new Map(summaries.map(x=>[x.school_id,x]));
 return schools.map(s=>{
  const summary=summaryMap.get(s.id)||{},rooms=classrooms.filter(c=>c.school_id===s.id);
  return {id:s.id,name:s.name,year:s.academic_year,term:s.term,officeId:s.office_id||'',loaded:false,classrooms:rooms.map(c=>({id:c.id,name:c.name,students:[]})),sessions:[],summary:{rooms:Number(summary.rooms||rooms.length),students:Number(summary.students||0),scored:Number(summary.scored||0),passed:Number(summary.passed||0),scoreTotal:Number(summary.score_total||0)}};
 });
}

export async function loadSchoolDetail(schoolId){
 const school=must(await supabase.from('schools').select('*').eq('id',String(schoolId)).eq('is_deleted',false).single());
 const classrooms=(await fetchAll(()=>supabase.from('classrooms').select('*').eq('school_id',String(schoolId)).eq('is_deleted',false).order('created_at'))).sort((a,b)=>compareClassNames(a.name, b.name)),classIds=classrooms.map(c=>c.id);
 const [students,sessions]=classIds.length
  ?await Promise.all([fetchAll(()=>supabase.from('students').select('*').in('classroom_id',classIds).order('student_no')),fetchAll(()=>supabase.from('test_sessions').select('*').in('classroom_id',classIds).eq('is_deleted',false).order('created_at'))])
  :[[],[]];
 const sessionIds=sessions.map(s=>s.id);
 const results=sessionIds.length?await fetchAll(()=>supabase.from('test_results').select('*').in('session_id',sessionIds)):[];
 return {
  id:school.id,name:school.name,year:school.academic_year,term:school.term,officeId:school.office_id||'',loaded:true,
  classrooms:classrooms.map(c=>({id:c.id,name:c.name,students:students.filter(st=>st.classroom_id===c.id).map(st=>({id:st.id,no:st.student_no,prefix:st.prefix||'',firstName:st.first_name||'',lastName:st.last_name||'',name:st.full_name,active:st.active!==false,leftAt:st.left_at||''}))})),
  sessions:sessions.map(x=>({id:x.id,classId:x.classroom_id,test:x.test_name,date:x.test_date,endDate:x.test_end_date,robot:x.robot_type,exam:x.exam_set,teachingPeriod:x.teaching_period||'',trainer:x.trainer,term:x.term==null?(school.term||''):x.term,year:x.academic_year==null?(school.academic_year||''):x.academic_year,feedback:{detail:x.detail||'',summary:x.summary||''},entries:Object.fromEntries(results.filter(r=>r.session_id===x.id).map(r=>[r.student_id,{score:r.score==null?'':String(r.score),time:r.time_value||'',absent:r.absent,is_special:r.is_special,updatedBy:r.updated_by}]))}))
 };
}

export async function loadClassroomDetail(classroomId){
 const classroom=must(await supabase.from('classrooms').select('*').eq('id',String(classroomId)).eq('is_deleted',false).single());
 const school=must(await supabase.from('schools').select('term,academic_year').eq('id',String(classroom.school_id)).eq('is_deleted',false).single());
 const [students,sessions]=await Promise.all([
  fetchAll(()=>supabase.from('students').select('*').eq('classroom_id',String(classroomId)).order('student_no')),
  fetchAll(()=>supabase.from('test_sessions').select('*').eq('classroom_id',String(classroomId)).eq('is_deleted',false).order('created_at'))
 ]);
 const sessionIds=sessions.map(s=>s.id),results=sessionIds.length?await fetchAll(()=>supabase.from('test_results').select('*').in('session_id',sessionIds)):[];
 return {
  classroom:{id:classroom.id,name:classroom.name,students:students.map(st=>({id:st.id,no:st.student_no,prefix:st.prefix||'',firstName:st.first_name||'',lastName:st.last_name||'',name:st.full_name,active:st.active!==false,leftAt:st.left_at||''}))},
  sessions:sessions.map(x=>({id:x.id,classId:x.classroom_id,test:x.test_name,date:x.test_date,endDate:x.test_end_date,robot:x.robot_type,exam:x.exam_set,teachingPeriod:x.teaching_period||'',trainer:x.trainer,term:x.term==null?(school.term||''):x.term,year:x.academic_year==null?(school.academic_year||''):x.academic_year,feedback:{detail:x.detail||'',summary:x.summary||''},entries:Object.fromEntries(results.filter(r=>r.session_id===x.id).map(r=>[r.student_id,{score:r.score==null?'':String(r.score),time:r.time_value||'',absent:r.absent,is_special:r.is_special,updatedBy:r.updated_by}]))}))
 };
}

// These RPCs aggregate in PostgreSQL so the status screen does not download
// every student and score row.  Room details are requested only when expanded.
export async function loadScoreEntryStatus(testNumber=null){
 const data=must(await supabase.rpc('score_entry_status_summaries',{p_test_number:testNumber}));
 return (data||[]).map(row=>({
  id:row.school_id,
  name:row.school_name,
  year:row.academic_year||'',
  term:row.term||'',
  officeId:row.office_id||'',
  roomCount:Number(row.room_count||0),
  roomsWithScores:Number(row.rooms_with_scores||0),
  studentCount:Number(row.student_count||0),
  scoredStudentCount:Number(row.scored_student_count||0),
  absentStudentCount:Number(row.absent_student_count||0),
  pendingStudentCount:Number(row.pending_student_count||0),
   roomsWithoutSession:Number(row.rooms_without_session||0),
   roomsWithSuggestions:Number(row.rooms_with_suggestions||0),
   roomsWithoutSuggestions:Number(row.rooms_without_suggestions||0),
   roomsExemptFromSuggestions:Number(row.rooms_exempt_from_suggestions||0),
   updatedAt:row.updated_at||''
 })).sort((a,b)=>a.name.localeCompare(b.name,'th'));
}

export async function loadScoreEntryRooms(schoolId,testNumber=null){
 const data=must(await supabase.rpc('score_entry_status_rooms',{p_school_id:String(schoolId),p_test_number:testNumber}));
 return (data||[]).map(row=>({
  id:row.classroom_id,
  name:row.classroom_name,
  studentCount:Number(row.student_count||0),
  scoredStudentCount:Number(row.scored_student_count||0),
  absentStudentCount:Number(row.absent_student_count||0),
  pendingStudentCount:Number(row.pending_student_count||0),
   hasScores:Boolean(row.has_scores),
   hasTestSession:Boolean(row.has_test_session),
   hasSuggestions:Boolean(row.has_suggestions),
   suggestionsRequired:row.suggestions_required===undefined?Boolean(row.has_test_session):Boolean(row.suggestions_required),
   sessionId:row.session_id||'',
  latestTest:row.latest_test||'',
  latestTestDate:row.latest_test_date||'',
  updatedAt:row.updated_at||''
 })).sort((a,b)=>compareClassNames(a.name,b.name));
}

export async function loadScoreEntryTestRounds(){
 const data=must(await supabase.rpc('score_entry_status_test_rounds'));
 return [...new Set((data||[]).map(row=>Number(row.test_number)).filter(Number.isInteger))].sort((a,b)=>a-b);
}

export async function loadDashboardInsights(officeId=null,limit=20){
 const data=must(await supabase.rpc('dashboard_insights',{p_office_id:officeId||null,p_limit:limit}));
 return {attention:data?.attention||[],outstanding:data?.outstanding||[],roomsToImprove:data?.rooms_to_improve||[],recent:data?.recent||[]};
}













































export async function saveResultRows(sessionId,entries,userId,studentIds){
 const wanted=studentIds?new Set(studentIds.map(String)):null,now=new Date().toISOString();
 const rows=Object.entries(entries||{}).filter(([studentId])=>!wanted||wanted.has(String(studentId))).map(([studentId,r])=>({session_id:String(sessionId),student_id:String(studentId),score:r.score===''||r.score==null?null:Number(r.score),time_value:r.time||'',absent:Boolean(r.absent),is_special:Boolean(r.is_special),updated_by:userId,updated_at:now}));
 if(rows.length)must(await supabase.from('test_results').upsert(rows,{onConflict:'session_id,student_id'}));
}

export async function saveSchoolBundle(school,userId){
 await saveSchools([school],userId);
 const classroomRows=(school.classrooms||[]).map(c=>({
  id:c.id,
  school_id:school.id,
  name:c.name,
  is_deleted:false,
  updated_at:new Date().toISOString()
 }));
 if(classroomRows.length)must(await supabase.from('classrooms').upsert(classroomRows));
 await Promise.all((school.classrooms||[]).map(c=>saveClassroomStudents(c.id,c.students||[])));
 await saveSessionRows(school.sessions||[]);
 await Promise.all((school.sessions||[]).map(s=>saveResultRows(s.id,s.entries||{},userId)));
}

export async function deleteSchool(schoolId){
 must(await supabase.from('schools').update({is_deleted:true}).eq('id',String(schoolId)));
}

export async function loadDeletedSchools(){
 const rows = must(await supabase.from('schools').select('id,name,academic_year,term,updated_at').eq('is_deleted',true).order('updated_at',{ascending:false}))||[];
 return rows.map(s=>({id:s.id, name:s.name, year:s.academic_year, term:s.term, deletedAt: s.updated_at}));
}

export async function restoreSchool(schoolId){
 must(await supabase.from('schools').update({is_deleted:false}).eq('id',String(schoolId)));
}

export async function deleteClassroom(classroomId){
 must(await supabase.from('classrooms').update({is_deleted: true, updated_at: new Date().toISOString()}).eq('id',String(classroomId)));
}
export async function deleteSession(sessionId){
 must(await supabase.from('test_sessions').update({is_deleted: true, updated_at: new Date().toISOString()}).eq('id',String(sessionId)));
}
export async function loadDeletedClassrooms() {
  const rows = must(await supabase.from('classrooms').select('id,name,school_id,updated_at,schools(name)').eq('is_deleted',true).order('updated_at',{ascending:false}))||[];
  return rows.map(c=>({id:c.id, name:c.name, schoolName: c.schools?.name, deletedAt: c.updated_at}));
}
export async function loadDeletedSessions() {
  console.log("Fetching deleted sessions...");
  const response = await supabase.from('test_sessions').select('id,test_name,classroom_id,updated_at,classrooms(name, schools(name))').eq('is_deleted',true).order('updated_at',{ascending:false});
  console.log("Response:", response);
  const rows = must(response)||[];
  return rows.map(s=>({id:s.id, name:s.test_name, className: s.classrooms?.name, schoolName: s.classrooms?.schools?.name, deletedAt: s.updated_at}));
}

export async function restoreSession(sessionId) {
  must(await supabase.from('test_sessions').update({is_deleted: false, updated_at: new Date().toISOString()}).eq('id', String(sessionId)));
}

export async function hardDeleteSession(sessionId) {
  must(await supabase.from('test_sessions').delete().eq('id', String(sessionId)));
}

export async function searchStudentScores(searchTerm) {
  if (!searchTerm) return [];
  const normalized = searchTerm
    .replace(/^(?:ด\.ช\.|เด็กชาย)\s*/, 'เด็กชาย ')
    .replace(/^(?:ด\.ญ\.|เด็กหญิง)\s*/, 'เด็กหญิง ')
    .trim()
    .replace(/\s+/g, '%');
  const { data, error } = await supabase.rpc('search_student_scores', { search_name: normalized });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveTeacherRequests(configs, schoolId, isEdit=false) {
  if (isEdit) {
    await supabase.from('teacher_requests').delete().eq('school_id', schoolId).eq('status', 'pending');
  }
  const rows = Object.entries(configs).map(([classroomId, config]) => ({
    classroom_id: classroomId,
    robot_type: config.robot,
    academic_term: config.term,
    teaching_period: String(config.period)
  }));
  if (!rows.length) return;
  if (!isEdit) {
    const rpcResponse = await supabase.rpc('save_teacher_requests', {
      p_school_id: schoolId,
      p_requests: rows
    });
    if (!rpcResponse.error) {
      const result = rpcResponse.data || {};
      if (Number(result.inserted || 0) === 0 && Number(result.duplicates || 0) > 0) {
        const error = new Error('TEACHER_REQUEST_PENDING_DUPLICATE');
        error.code = 'TEACHER_REQUEST_PENDING_DUPLICATE';
        error.duplicateClassroomIds = result.duplicate_classroom_ids || [];
        throw error;
      }
      return result;
    }
    must(rpcResponse);
  }
  const insertRows = rows.map(row => ({
    school_id: schoolId,
    classroom_id: row.classroom_id,
    robot_type: row.robot_type,
    academic_term: row.academic_term,
    teaching_period: row.teaching_period,
    status: 'pending'
  }));
  if (rows.length) {
    const response=await supabase.from('teacher_requests').insert(insertRows);
    if(response.error?.code==='23505'){
      const error=new Error('TEACHER_REQUEST_PENDING_DUPLICATE');
      error.code='TEACHER_REQUEST_PENDING_DUPLICATE';
      error.cause=response.error;
      throw error;
    }
    must(response);
  }
}

export async function lookupTeacherRequestSchool(schoolName) {
  const { data, error } = await supabase.rpc('teacher_request_school_lookup', { p_school_name: schoolName });
  must({ data, error });
  const schoolMap = new Map();
  (data || []).forEach(row => {
    if (!schoolMap.has(row.school_id)) {
      schoolMap.set(row.school_id, {
        id: row.school_id,
        name: row.school_name,
        officeId: row.office_id || '',
        classrooms: [],
        pendingClassroomIds: []
      });
    }
    const school = schoolMap.get(row.school_id);
    if (row.classroom_id) {
      school.classrooms.push({ id: row.classroom_id, name: row.classroom_name, students: [] });
      if (row.is_pending) school.pendingClassroomIds.push(row.classroom_id);
    }
  });
  return Array.from(schoolMap.values()).map(school => ({
    ...school,
    classrooms: [...school.classrooms].sort((a,b) => compareClassNames(a.name, b.name))
  }));
}

export async function loadTeacherRequests() {
  const baseSelect = `
      id,
      school_id,
      classroom_id,
      robot_type,
      academic_term,
      teaching_period,
      status,
      created_at,
      schools (name),
      classrooms (name)
    `;
  const noteSelect = `
      id,
      school_id,
      classroom_id,
      robot_type,
      academic_term,
      teaching_period,
      note,
      status,
      created_at,
      schools (name),
      classrooms (name)
    `;
  let { data, error } = await supabase
    .from('teacher_requests')
    .select(noteSelect)
    .order('created_at', { ascending: false });
  if (isMissingNoteColumn(error)) {
    const fallback = await supabase
      .from('teacher_requests')
      .select(baseSelect)
      .order('created_at', { ascending: false });
    data = (fallback.data || []).map(row => ({ ...row, note: '' }));
    error = fallback.error;
  }
  must({ data, error });
  return data || [];
}

export async function updateTeacherRequestStatusBySchool(schoolId, status) {
  must(await supabase
    .from('teacher_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('school_id', schoolId)
    .eq('status', 'pending')
  );
}

export async function updateTeacherRequestRows(rows) {
  if (!rows || !rows.length) return;
  await Promise.all(rows.map(async row => {
    const baseUpdate = {
      robot_type: row.robot_type,
      academic_term: row.academic_term,
      teaching_period: String(row.teaching_period || ''),
      updated_at: new Date().toISOString()
    };
    const response = await supabase
      .from('teacher_requests')
      .update({ ...baseUpdate, note: row.note || '' })
      .eq('id', row.id);
    if (isMissingNoteColumn(response.error)) {
      must(await supabase.from('teacher_requests').update(baseUpdate).eq('id', row.id));
      return;
    }
    must(response);
  }));
}

export async function deleteTeacherRequestBySchool(schoolId) {
  must(await supabase
    .from('teacher_requests')
    .delete()
    .eq('school_id', schoolId)
  );
}

export async function saveEvaluation(data) {
  let displayDate = '';
  if (data.endDate) {
    const d1 = new Date(data.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const d2 = new Date(data.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    displayDate = ` (${d1} - ${d2})`;
  }

  const row = {
    school_id: data.schoolId,
    classroom_id: data.classId,
    robot_type: data.robot,
    academic_term: `${data.term} (${examFromEvaluation(data)})${displayDate}`,
    teaching_period: String(data.teachingPeriod || data.period),
    trainer_name: data.trainer,
    present_count: Number(data.present) || 0,
    absent_count: Number(data.absent) || 0,
    issues: data.issues || '',
    suggestions: data.suggestions || '',
    eval_date: data.date,
    end_date: data.endDate || null
  };

  const existing=data.id?null:await loadExistingEvaluation(data);
  const targetId=data.id||existing?.id;
  if (existing) {
    row.eval_date=[existing.eval_date,data.date].filter(Boolean).sort()[0]||data.date;
    row.end_date=[existing.end_date||existing.eval_date,data.endDate||data.date].filter(Boolean).sort().at(-1)||data.endDate||null;
  }

  if (targetId) {
    must(await supabase.from('onsite_evaluations').update(row).eq('id', targetId));
  } else {
    must(await supabase.from('onsite_evaluations').insert([row]));
  }
}

export async function deleteOnsiteEvaluation(id) {
  must(await supabase.from('onsite_evaluations').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id));
}

export async function loadDeletedOnsiteEvaluations() {
  const { data, error } = await supabase
    .from('onsite_evaluations')
    .select('id, eval_date, trainer_name, classrooms(name, schools(name)), updated_at')
    .eq('is_deleted', true)
    .order('updated_at', { ascending: false });
  must({ error });
  return (data || []).map(d => ({
    id: d.id,
    date: d.eval_date,
    trainer: d.trainer_name,
    className: d.classrooms?.name,
    schoolName: d.classrooms?.schools?.name,
    deletedAt: d.updated_at
  }));
}

export async function restoreOnsiteEvaluation(id) {
  must(await supabase.from('onsite_evaluations').update({ is_deleted: false, updated_at: new Date().toISOString() }).eq('id', id));
}

export async function hardDeleteOnsiteEvaluation(id) {
  must(await supabase.from('onsite_evaluations').delete().eq('id', id));
}

export async function loadExistingEvaluation(criteriaOrClassId, date, period) {
  const criteria=typeof criteriaOrClassId==='object'
    ?criteriaOrClassId
    :{classId:criteriaOrClassId,date,teachingPeriod:period};
  if (!criteria.classId || !criteria.date) return null;
  const { data, error } = await supabase
    .from('onsite_evaluations')
    .select('*')
    .eq('classroom_id', criteria.classId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows=(data||[]).filter(row=>matchesRobot(row,criteria));
  const exact=rows.find(row=>sameEvaluationContext(row,criteria));
  if(exact)return exact;
  return rows.find(row=>rangesOverlap(row.eval_date,row.end_date,criteria.date,criteria.endDate))||null;
}

export async function loadLatestEvaluationForDay(classId, date) {
  if (!classId || !date) return null;
  const { data, error } = await supabase
    .from('onsite_evaluations')
    .select('*')
    .eq('classroom_id', classId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data||[]).find(row=>rangesOverlap(row.eval_date,row.end_date,date,date))||null;
}

export async function loadEvaluationForSessionSync(classId, term, year, expectedExam, sessionRange={}) {
  if (!classId) return null;
  const criteria={classId,term:year?`${term}/${year}`:term,expectedExam,date:sessionRange.date,endDate:sessionRange.endDate,teachingPeriod:sessionRange.teachingPeriod,robot:sessionRange.robot};
  const { data, error } = await supabase
    .from('onsite_evaluations')
    .select('*')
    .eq('classroom_id', classId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) console.error("Sync error:", error);
  const rows=(data||[]).filter(row=>matchesRobot(row,criteria));
  const exact=rows.find(row=>sameEvaluationContext(row,criteria));
  if(exact)return exact;
  const dated=rows
    .filter(row=>!criteria.date||rangesOverlap(row.eval_date,row.end_date,criteria.date,criteria.endDate))
    .sort((a,b)=>scoreEvaluationMatch(b,criteria)-scoreEvaluationMatch(a,criteria));
  if(dated[0])return dated[0];
  return rows.sort((a,b)=>scoreEvaluationMatch(b,{...criteria,date:null,endDate:null})-scoreEvaluationMatch(a,{...criteria,date:null,endDate:null}))[0]||null;
}

export async function loadEvaluationsSummary(schoolId, date) {
  const { data, error } = await supabase
    .from('onsite_evaluations')
    .select(`
      id,
      classroom_id,
      classroom_id,
      robot_type,
      academic_term,
      teaching_period,
      trainer_name,
      present_count,
      absent_count,
      issues,
      suggestions,
      eval_date,
      end_date,
      created_at,
      classrooms (name)
    `)
    .eq('school_id', schoolId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });
  must({ data, error });
  return (data || []).filter(row=>!date||rangesOverlap(row.eval_date,row.end_date,date,date));
}

export async function loadEvaluationDatesForSchool(schoolId) {
  if (!schoolId) return [];
  const { data, error } = await supabase
    .from('onsite_evaluations')
    .select(`
      id,
      classroom_id,
      robot_type,
      academic_term,
      teaching_period,
      eval_date,
      end_date,
      classrooms (name)
    `)
    .eq('school_id', schoolId)
    .eq('is_deleted', false)
    .order('eval_date', { ascending: false });
  must({ data, error });
  const grouped = new Map();
  (data || []).forEach(row => {
    const key = `${row.eval_date || ''}|${row.end_date || ''}`;
    const entry = grouped.get(key) || {
      date: row.eval_date || '',
      endDate: row.end_date || '',
      count: 0,
      classrooms: new Set(),
      robots: new Set()
    };
    entry.count += 1;
    if (row.classroom_id) entry.classrooms.add(row.classroom_id);
    if (row.robot_type) entry.robots.add(row.robot_type);
    grouped.set(key, entry);
  });
  return [...grouped.values()]
    .map(entry => ({
      date: entry.date,
      endDate: entry.endDate,
      count: entry.count,
      classroomCount: entry.classrooms.size,
      robots: [...entry.robots]
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.endDate).localeCompare(String(a.endDate)));
}

export async function loadOffices() {
  const { data, error } = await supabase.from('offices').select('*').eq('active', true).order('name');
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

const normalizeInventoryNumber=value=>{
  const n=Number(value);
  return Number.isFinite(n)&&n>0?Math.floor(n):0;
};
const mapInventoryItem=row=>({
  id: row.id,
  name: row.name,
  category: row.category || 'other',
  robotType: row.robot_type || '',
  powerType: row.power_type || '',
  fieldType: row.field_type || '',
  unit: row.unit || 'ชิ้น',
  active: row.active !== false,
  sortOrder: Number(row.sort_order || 0)
});
const mapInventoryRow=row=>({
  ownerId: row.office_id || row.school_id || '',
  itemId: row.item_id,
  quantity: Number(row.quantity || 0),
  usableQuantity: Number(row.usable_quantity ?? row.quantity ?? 0),
  notes: row.notes || '',
  checkedAt: row.checked_at || '',
  updatedAt: row.updated_at || '',
  updatedBy: row.updated_by || ''
});
const mapStockMovement=row=>({
  id: row.id,
  type: row.movement_type,
  itemId: row.item_id,
  quantity: Number(row.quantity || 0),
  fromOwnerType: row.from_owner_type || '',
  fromOwnerId: row.from_owner_id || '',
  toOwnerType: row.to_owner_type || '',
  toOwnerId: row.to_owner_id || '',
  relatedSchoolId: row.related_school_id || '',
  note: row.note || '',
  createdBy: row.created_by || '',
  createdAt: row.created_at || '',
  itemName: row.inventory_items?.name || '',
  itemUnit: row.inventory_items?.unit || ''
});

export async function loadInventoryItems(){
  const {data,error}=await supabase.from('inventory_items').select('*').eq('active',true).order('sort_order');
  if(error){
    if(error.code==='42P01')return [];
    throw error;
  }
  return (data||[]).map(mapInventoryItem);
}

export async function loadOfficeInventory(){
  const {data,error}=await supabase.from('office_inventory').select('*');
  if(error){
    if(error.code==='42P01')return [];
    throw error;
  }
  return (data||[]).map(mapInventoryRow);
}

export async function loadSchoolInventory(schoolIds=[]){
  const ids=(schoolIds||[]).map(String).filter(Boolean);
  const builder=()=>supabase.from('school_inventory').select('*');
  const {data,error}=ids.length?await builder().in('school_id',ids):await builder();
  if(error){
    if(error.code==='42P01')return [];
    throw error;
  }
  return (data||[]).map(mapInventoryRow);
}

export async function saveOfficeInventory(row,userId){
  const payload={
    office_id: String(row.ownerId),
    item_id: String(row.itemId),
    quantity: normalizeInventoryNumber(row.quantity),
    usable_quantity: normalizeInventoryNumber(row.usableQuantity),
    notes: row.notes || '',
    updated_by: userId,
    updated_at: new Date().toISOString()
  };
  must(await supabase.from('office_inventory').upsert(payload,{onConflict:'office_id,item_id'}));
}

export async function saveSchoolInventory(row,userId){
  const today=new Date().toISOString().slice(0,10);
  const payload={
    school_id: String(row.ownerId),
    item_id: String(row.itemId),
    quantity: normalizeInventoryNumber(row.quantity),
    usable_quantity: normalizeInventoryNumber(row.usableQuantity),
    notes: row.notes || '',
    checked_at: row.checkedAt || today,
    updated_by: userId,
    updated_at: new Date().toISOString()
  };
  must(await supabase.from('school_inventory').upsert(payload,{onConflict:'school_id,item_id'}));
}

export async function loadStockMovements(limit=80){
  const {data,error}=await supabase
    .from('stock_movements')
    .select('id,movement_type,item_id,quantity,from_owner_type,from_owner_id,to_owner_type,to_owner_id,related_school_id,note,created_by,created_at,inventory_items(name,unit)')
    .order('created_at',{ascending:false})
    .limit(limit);
  if(error){
    if(error.code==='42P01')return [];
    throw error;
  }
  return (data||[]).map(mapStockMovement);
}

export async function applyStockMovement(form){
  const payload={
    p_movement_type: form.type,
    p_item_id: String(form.itemId || ''),
    p_quantity: normalizeInventoryNumber(form.quantity),
    p_from_office_id: form.fromOfficeId || null,
    p_to_office_id: form.toOfficeId || null,
    p_school_id: form.schoolId || null,
    p_note: form.note || ''
  };
  const {data,error}=await supabase.rpc('apply_stock_movement',payload);
  must({data,error});
  return data;
}

// --- Classroom Locking Mechanism ---

// Locks are granted only by database RPCs.  If the RPC cannot confirm a lock,
// callers remain read-only rather than risking two editors overwriting each other.
export async function acquireLock(classId, userId, userName) {
 if(!classId||!userId)return {success:false,lockedBy:'ไม่สามารถยืนยันผู้ใช้งานได้'};
 try{
  const {data,error}=await supabase.rpc('acquire_classroom_lock',{p_classroom_id:String(classId),p_locked_by_name:userName||null});
  if(error)throw error;
  const lock=Array.isArray(data)?data[0]:data;
  if(!lock)throw new Error('ไม่ได้รับสถานะการล็อกจากระบบ');
  return {success:Boolean(lock.success),lockedBy:lock.locked_by_name||'แอดมินท่านอื่น'};
 }catch(error){
  console.warn('Acquire lock failed:',error);
  return {success:false,lockedBy:'ระบบไม่สามารถยืนยันสิทธิ์การแก้ไขได้'};
 }
}

export async function verifyLockOwnership(classId, userId) {
 if(!classId||!userId)return {hasLock:null,lockedBy:'ไม่สามารถยืนยันผู้ใช้งานได้'};
 try{
  const {data,error}=await supabase.rpc('verify_classroom_lock',{p_classroom_id:String(classId)});
  if(error)throw error;
  const lock=Array.isArray(data)?data[0]:data;
  if(!lock)throw new Error('ไม่ได้รับสถานะการล็อกจากระบบ');
  return {hasLock:Boolean(lock.has_lock),lockedBy:lock.locked_by_name||'ไม่มีสิทธิ์ล็อกห้องนี้'};
 }catch(error){
  console.warn('Verify lock failed:',error);
  return {hasLock:null,lockedBy:'ระบบไม่สามารถยืนยันสิทธิ์การแก้ไขได้'};
 }
}

export async function keepLockAlive(classId, userId) {
 if(!classId||!userId)return;
 const {error}=await supabase.rpc('keep_classroom_lock_alive',{p_classroom_id:String(classId)});
 if(error)throw error;
}

export async function releaseLock(classId, userId) {
 if(!classId||!userId)return;
 const {error}=await supabase.rpc('release_classroom_lock',{p_classroom_id:String(classId)});
 if(error)console.warn('Release lock failed:',error);
}

export async function createOffice(name, userId) {
  const { data, error } = await supabase.from('offices').insert([{ name, created_by: userId, active: true }]).select().single();
  must({ data, error });
  return data;
}

export async function deleteOffice(id) {
  must(await supabase.from('offices').update({ active: false }).eq('id', id));
}

export async function loadAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*');
  must({ data, error });
  return data || [];
}

export async function saveSchools(schools, userId) {
  if (!schools || !schools.length) return;
  const now = new Date().toISOString();
  const rows = schools.map(s => ({
    id: s.id,
    name: s.name,
    academic_year: s.year,
    term: s.term,
    office_id: s.officeId || null,
    updated_at: now
  }));
  const existing = must(await supabase.from('schools').select('id').in('id', rows.map(row => row.id))) || [];
  const existingIds = new Set(existing.map(row => row.id));
  const inserts = rows.filter(row => !existingIds.has(row.id)).map(row => ({...row, created_by: userId}));
  const updates = rows.filter(row => existingIds.has(row.id));
  if (inserts.length) must(await supabase.from('schools').insert(inserts));
  await Promise.all(updates.map(async ({id, ...row}) => must(await supabase.from('schools').update(row).eq('id', id))));
}

export async function saveSchoolMeta(school, userId) {
  must(await supabase.from('schools').update({
    name: school.name,
    academic_year: school.year,
    term: school.term,
    office_id: school.officeId || null,
    updated_at: new Date().toISOString()
  }).eq('id', school.id));
}

export async function saveClassroomMeta(classId, name) {
  must(await supabase.from('classrooms').update({ name, updated_at: new Date().toISOString() }).eq('id', classId));
}

export async function saveClassroomStudents(classId, students) {
  if (!students || !students.length) return;
  const rows = students.map(st => ({
    id: st.id,
    classroom_id: classId,
    student_no: st.no,
    prefix: st.prefix || '',
    first_name: st.firstName || '',
    last_name: st.lastName || '',
    full_name: st.name,
    active: st.active !== false,
    left_at: st.leftAt || null
  }));
  must(await supabase.from('students').upsert(rows));
}

export async function saveSessionRows(sessions) {
  const validSessions=(sessions||[]).filter(session=>session?.id);
  if (!validSessions.length) return;
  const rows = validSessions.map(s => ({
    id: s.id,
    classroom_id: s.classId,
    test_name: s.test,
    test_date: s.date || null,
    test_end_date: s.endDate || null,
    robot_type: s.robot,
    exam_set: s.exam,
    teaching_period: s.teachingPeriod || '',
    trainer: s.trainer,
    term: s.term,
    academic_year: s.year,
    detail: s.feedback?.detail || '',
    summary: s.feedback?.summary || ''
  }));
  must(await supabase.from('test_sessions').upsert(rows));
}

export async function loadCurrentProfile(user) {
  if (!user || !user.id) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function loadAccessAdmin() {
  const [profilesResponse, membersResponse] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('school_members').select('*')
  ]);
  return {
    profiles: must(profilesResponse) || [],
    members: must(membersResponse) || []
  };
}

export async function updateUserAccess(userId, role, schoolIds=[]) {
  must(await supabase.rpc('admin_set_user_access', {
    p_user_id: userId,
    p_role: role,
    p_school_ids: schoolIds
  }));
}

export async function saveStudentOrder(classroomId, assignments) {
  must(await supabase.rpc('reorder_student_numbers', {
    p_classroom_id: String(classroomId),
    p_assignments: assignments || []
  }));
}


export async function restoreClassroom(classroomId) {
  must(await supabase.from("classrooms").update({ is_deleted: false, updated_at: new Date().toISOString() }).eq("id", String(classroomId)));
}

export async function hardDeleteSchool(schoolId) {
  must(await supabase.from("schools").delete().eq("id", String(schoolId)));
}

export async function hardDeleteClassroom(classroomId) {
  must(await supabase.from("classrooms").delete().eq("id", String(classroomId)));
}

export async function searchPublicStudentScores(searchTerm) {
  return searchStudentScores(searchTerm);
}

export async function loadExamTestLeaderboard() {
  const { data, error } = await supabase.rpc('get_exam_test_leaderboard');
  if (error) throw new Error(error.message);
  return data || [];
}
