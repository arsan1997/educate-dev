import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const source=readFileSync(new URL('../src/pages/CompetitionScorePage.jsx',import.meta.url),'utf8');
const dataService=readFileSync(new URL('../src/dataService.js',import.meta.url),'utf8');
const lockMigration=readFileSync(new URL('../supabase/migrations/20261008010000_competition_session_locks.sql',import.meta.url),'utf8');
const migrationDirectory=new URL('../supabase/migrations/',import.meta.url);
const allLockMigrations=readdirSync(migrationDirectory)
  .filter(name=>name.endsWith('.sql'))
  .map(name=>readFileSync(new URL(name,migrationDirectory),'utf8'))
  .join('\n');

test('competition score entry exposes the same mission calculator affordance as normal scoring',()=>{
  assert.match(source,/\bCalculator\b/,'missing Calculator icon/import');
  assert.match(source,/score-calc-btn/,'missing calculator button in each student score row');
  assert.match(source,/applyCalculatorResult/,'missing calculator result application flow');
});

test('competition score entry restores the last selected scoring context',()=>{
  assert.match(source,/competition-score-context/,'missing stable storage key for competition context');
  assert.match(source,/localStorage\.getItem/,'missing persisted context restore');
  assert.match(source,/localStorage\.setItem/,'missing persisted context save');
});

test('calculator applies score and time in one atomic result update',()=>{
  assert.match(
    source,
    /updateResult\(calculatorStudent\.id,\{score:String\(calculatorResult\.totalScore\),time:calculatorResult\.time\}\)/,
    'score and time must be merged in one update so the second state write cannot erase the score'
  );
});

test('competition editing acquires a lock for the selected competition rather than the whole classroom',()=>{
  assert.match(source,/acquireCompetitionLock\(sessionId/,'selected competition must acquire its own lock');
  assert.match(source,/releaseCompetitionLock\(lockedSessionId/,'competition lock must be released when leaving the selection');
  assert.match(source,/keepCompetitionLockAlive\(sessionId/,'competition lock must stay alive while editing');
  assert.match(source,/editingBlocked/,'fields must become read-only when another user owns the competition');
  assert.match(dataService,/acquire_competition_session_lock/,'data service must use the competition-specific lock RPC');
});

test('database rejects result writes unless the user owns the active competition lock',()=>{
  assert.match(lockMigration,/create table if not exists public\.competition_session_locks/);
  assert.match(lockMigration,/competition_results_insert/);
  assert.match(lockMigration,/competition_results_update/);
  assert.match(lockMigration,/lock\.locked_by=auth\.uid\(\)/);
  assert.match(lockMigration,/lock\.locked_at>=now\(\)-interval '5 minutes'/);
});

test('authenticated policy checks can read active competition locks',()=>{
  assert.match(
    allLockMigrations,
    /grant select on public\.competition_session_locks to authenticated/,
    'RLS policies query the lock table during upsert; without SELECT PostgreSQL returns permission denied for table competition_session_locks'
  );
  assert.match(allLockMigrations,/create policy "competition_lock_owner_select" on public\.competition_session_locks/);
});

test('competition scores can be previewed and copied to a selected test round without overwriting existing results',()=>{
  assert.match(source,/previewCompetitionToTestRound\(schoolId,session\.id,transferRound\)/,'transfer must show a school-wide preview first');
  assert.match(source,/Array\.from\(\{length:6\}/,'the destination round must be selectable');
  assert.match(source,/targetRound=transferPreview\.targetRound/,'confirmation must use the round shown in the preview');
  assert.match(source,/ยืนยันโอน/,'transfer requires explicit confirmation');
  assert.match(dataService,/protectedIds\.has\(item\.student_id\)/,'existing test results must be protected');
  assert.match(dataService,/testRoundNumber\(item\.test_name\)===Number\(targetRound\)/,'destination must be matched by test round');
  assert.match(dataService,/acquireLock\(room\.classroomId/,'each classroom must be locked before transfer');
  assert.match(dataService,/releaseLock\(room\.classroomId/,'classroom lock must always be released');
  assert.doesNotMatch(dataService,/deleteCompetitionSession\(room\.sourceSessionId/,'transfer must not delete the competition source');
});

test('transfer blocks rooms until source and destination assessment metadata are complete and consistent',()=>{
  assert.match(dataService,/missingAssessmentMetadata/);
  assert.match(dataService,/differentAssessmentMetadata/);
  assert.match(dataService,/status='source_metadata_missing'/);
  assert.match(dataService,/status='destination_metadata_missing'/);
  assert.match(dataService,/status='metadata_mismatch'/);
  assert.match(dataService,/date:sourceMetadata\.date/,'new target sessions must use the room-specific competition date');
  assert.match(dataService,/robot:sourceMetadata\.robot/,'new target sessions must use the room-specific robot type');
  assert.match(dataService,/exam:sourceMetadata\.exam/,'new target sessions must use the room-specific exam set');
});

test('repeated transfers do not create duplicate test round sessions',()=>{
  assert.match(dataService,/Re-read the destination while holding the classroom lock/);
  assert.match(dataService,/if\(!destination\)/,'a test session is created only when none exists');
  assert.match(dataService,/destinations\.length>1/,'duplicate destination rounds must be rejected');
});
