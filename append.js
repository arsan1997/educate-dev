const fs = require('fs');
let content = fs.readFileSync('src/dataService.js', 'utf8');
content += `\nexport async function restoreClassroom(classroomId) {
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
`;
fs.writeFileSync('src/dataService.js', content);
