import React, { useEffect, useMemo, useState } from 'react';
import { Award, Loader2, Medal, RefreshCw, School, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import { loadExamTestLeaderboard } from '../dataService';
import brandLogo from '../assets/logo.png';

const medalStyles = [
  { label: 'อันดับ 1', color: '#d95f18', bg: '#fff7ed', border: '#fb923c', medal: '#e96b22' },
  { label: 'อันดับ 2', color: '#174b87', bg: '#eef5ff', border: '#78a4d4', medal: '#2e68a5' },
  { label: 'อันดับ 3', color: '#934d24', bg: '#fff3eb', border: '#d99569', medal: '#b86532' }
];

const uniqueBy = (items, keyFn) => {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const timeText = value => value || '-';
const scoreText = value => (value === 0 || value ? Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '-');
const fireworks = [
  { left: '10%', top: '22%', delay: '0s', color: '#e96b22', distance: '92px' },
  { left: '88%', top: '18%', delay: '.7s', color: '#2e68a5', distance: '106px' },
  { left: '7%', top: '61%', delay: '1.4s', color: '#2e68a5', distance: '88px' },
  { left: '92%', top: '66%', delay: '2.1s', color: '#e96b22', distance: '98px' },
  { left: '50%', top: '11%', delay: '2.8s', color: '#e96b22', distance: '82px' },
  { left: '29%', top: '48%', delay: '3.5s', color: '#2e68a5', distance: '76px' },
  { left: '72%', top: '48%', delay: '4.2s', color: '#e96b22', distance: '76px' }
];

function PodiumSlot({ student, rankIndex, height }) {
  const style = medalStyles[rankIndex];
  if (!student) return <div className="podium-slot podium-slot-empty" aria-hidden="true" />;

  return (
    <article className={`podium-slot podium-rank-${rankIndex + 1}`} style={{ '--podium-height': `${height}px`, '--podium-bg': style.bg, '--podium-border': style.border, '--podium-color': style.color, '--podium-medal': style.medal }}>
      <div className="podium-student-card">
        <div className="podium-card-top">
          <span>{style.label}</span>
          <Medal size={rankIndex === 0 ? 36 : 31} color={style.medal} />
        </div>
        <h3>{student.student_name}</h3>
        <p>เลขที่ {student.student_no}</p>
        <div className="podium-metrics">
          <div><small style={metricLabel}>คะแนน</small><strong>{scoreText(student.score)}</strong></div>
          <div><small style={metricLabel}>เวลา</small><strong>{timeText(student.time_value)}</strong></div>
        </div>
      </div>
      <div className="podium-block">
        <span>{rankIndex + 1}</span>
      </div>
    </article>
  );
}

export default function ExamTest() {
  const [rows, setRows] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  const loadRows = async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await loadExamTestLeaderboard();
      setRows(data);
    } catch (err) {
      setError(err.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => loadRows(true), 15000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (err) {
      setError(err.message || 'อุปกรณ์นี้ไม่รองรับการเปิดเต็มจอ');
    }
  };

  const schools = useMemo(() => uniqueBy(rows, row => row.school_id)
    .map(row => ({ id: row.school_id, name: row.school_name, year: row.academic_year, term: row.term }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th')), [rows]);

  const classrooms = useMemo(() => uniqueBy(rows.filter(row => !schoolId || row.school_id === schoolId), row => row.classroom_id)
    .map(row => ({ id: row.classroom_id, name: row.classroom_name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th', { numeric: true })), [rows, schoolId]);

  const sessions = useMemo(() => uniqueBy(rows.filter(row => (!schoolId || row.school_id === schoolId) && (!classroomId || row.classroom_id === classroomId)), row => row.session_id)
    .map(row => ({
      id: row.session_id,
      name: row.test_name,
      date: row.test_date,
      robot: row.robot_type,
      exam: row.exam_set
    }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.name.localeCompare(b.name, 'th', { numeric: true })), [rows, schoolId, classroomId]);

  useEffect(() => {
    if (!schools.length) return;
    if (!schoolId || !schools.some(item => item.id === schoolId)) setSchoolId(schools[0].id);
  }, [schools, schoolId]);

  useEffect(() => {
    if (!classrooms.length) {
      setClassroomId('');
      return;
    }
    if (!classroomId || !classrooms.some(item => item.id === classroomId)) setClassroomId(classrooms[0].id);
  }, [classrooms, classroomId]);

  useEffect(() => {
    if (!sessions.length) {
      setSessionId('');
      return;
    }
    if (!sessionId || !sessions.some(item => item.id === sessionId)) setSessionId(sessions[0].id);
  }, [sessions, sessionId]);

  const selectedSchool = schools.find(item => item.id === schoolId);
  const selectedClassroom = classrooms.find(item => item.id === classroomId);
  const selectedSession = sessions.find(item => item.id === sessionId);

  const rankedRows = useMemo(() => rows
    .filter(row => row.school_id === schoolId && row.classroom_id === classroomId && row.session_id === sessionId)
    .sort((a, b) => Number(b.score) - Number(a.score)
      || Number(a.time_seconds ?? Number.POSITIVE_INFINITY) - Number(b.time_seconds ?? Number.POSITIVE_INFINITY)
      || Number(a.student_no) - Number(b.student_no))
    .map((row, index) => ({ ...row, displayRank: index + 1 })), [rows, schoolId, classroomId, sessionId]);

  const podiumRows = rankedRows.slice(0, 3);
  const podiumSlots = [
    { student: podiumRows[1], rankIndex: 1, height: 82 },
    { student: podiumRows[0], rankIndex: 0, height: 128 },
    { student: podiumRows[2], rankIndex: 2, height: 66 }
  ];
  return (
    <div className="competition-board">
      <style>{podiumCss}</style>
      <div className="arena-glow arena-glow-one" />
      <div className="arena-glow arena-glow-two" />
      <div className="arena-grid" />
      <div className="fireworks-layer" aria-hidden="true">
        {fireworks.map((firework,fireworkIndex)=><span className="firework" key={fireworkIndex} style={{'--firework-left':firework.left,'--firework-top':firework.top,'--firework-delay':firework.delay,'--firework-color':firework.color,'--firework-distance':firework.distance}}>
          {Array.from({length:16},(_,sparkIndex)=><i key={sparkIndex} style={{'--spark-angle':`${sparkIndex*22.5}deg`}} />)}
        </span>)}
      </div>
      <div className="competition-shell">
        <header className="competition-header">
          <div className="competition-brand">
            <button type="button" className="competition-logo-wrap" onClick={toggleFullscreen} title={isFullscreen ? 'กดโลโก้เพื่อออกจากโหมดเต็มจอ' : 'กดโลโก้เพื่อเปิดเต็มจอ'} aria-label={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'เปิดโหมดเต็มจอ'}>
              <img src={brandLogo} alt="School Robotics" />
            </button>
            <div>
              <div className="competition-kicker"><Sparkles size={15} /> SCHOOL ROBOTICS CHAMPIONSHIP</div>
              <h1>กระดานคะแนนการแข่งขัน</h1>
              <p>{selectedSchool?.name || 'School Robotics'}</p>
            </div>
          </div>
          <div className="competition-actions">
            <button type="button" className={`arena-button ${autoRefresh ? 'active' : ''}`} onClick={() => setAutoRefresh(value => !value)}>
              <Zap size={17} /> อัตโนมัติ
            </button>
            <button type="button" className="arena-button refresh" onClick={() => loadRows(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />} รีเฟรช
            </button>
          </div>
        </header>

        <section className="competition-filters">
          <label style={{ display: 'grid', gap: 7, color: '#475569', fontWeight: 800 }}>
            โรงเรียน
            <select value={schoolId} onChange={event => setSchoolId(event.target.value)} style={selectStyle}>
              {schools.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 7, color: '#475569', fontWeight: 800 }}>
            ระดับชั้น
            <select value={classroomId} onChange={event => setClassroomId(event.target.value)} style={selectStyle}>
              {classrooms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 7, color: '#475569', fontWeight: 800 }}>
            ครั้งที่ทดสอบ
            <select value={sessionId} onChange={event => setSessionId(event.target.value)} style={selectStyle}>
              {sessions.map(item => <option key={item.id} value={item.id}>{item.name}{item.exam ? ` · ${item.exam}` : ''}</option>)}
            </select>
          </label>
        </section>

        {error && <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 12, padding: 14, marginBottom: 18, fontWeight: 800 }}>{error}</div>}

        {loading ? (
          <div style={emptyStyle}><Loader2 className="spin" size={34} /> กำลังโหลดคะแนน</div>
        ) : !rankedRows.length ? (
          <div style={emptyStyle}><Award size={40} /> ยังไม่มีคะแนนในระดับชั้นนี้</div>
        ) : (
          <>
            <section className="podium-arena">
              <div className="section-heading">
                <div>
                  <span className="section-eyebrow">HALL OF FAME</span>
                  <h2><Trophy /> 3 อันดับแรก</h2>
                  <p>{selectedClassroom?.name || '-'} · {selectedSession?.name || '-'}</p>
                </div>
                <div className="competition-summary">
                  <span style={summaryPill}><Users size={17} /> มีคะแนน {rankedRows.length} คน</span>
                  {selectedSession?.robot && <span style={summaryPill}>{selectedSession.robot}</span>}
                </div>
              </div>

              <div className={`podium-grid ${podiumRows.length === 1 ? 'single-winner' : ''}`}>
                {podiumSlots.map(slot => <PodiumSlot key={slot.rankIndex} {...slot} />)}
              </div>
            </section>

            <section className="leaderboard-table-card">
              <div className="leaderboard-title">
                <School color="#2563eb" /> รายชื่อผู้มีคะแนนทั้งหมด
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                      <th style={thStyle}>อันดับ</th>
                      <th style={thStyle}>เลขที่</th>
                      <th style={thStyle}>ชื่อ-นามสกุล</th>
                      <th style={thStyle}>คะแนน</th>
                      <th style={thStyle}>เวลา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedRows.map(student => (
                      <tr key={student.student_id} style={{ borderTop: '1px solid #eef2f7', background: student.displayRank <= 3 ? '#fffaf0' : '#ffffff' }}>
                        <td style={tdStyle}><span style={{ ...rankBadge, background: student.displayRank <= 3 ? '#fef3c7' : '#e0f2fe', color: student.displayRank <= 3 ? '#92400e' : '#075985' }}>{student.displayRank}</span></td>
                        <td style={tdStyle}>{student.student_no}</td>
                        <td style={{ ...tdStyle, fontWeight: 900 }}>{student.student_name}</td>
                        <td style={{ ...tdStyle, fontWeight: 900, color: Number(student.score) >= 35 ? '#15803d' : '#b45309' }}>{scoreText(student.score)}</td>
                        <td style={tdStyle}>{timeText(student.time_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const podiumCss = `
.competition-board {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  color: #f8fafc;
  font-family: var(--font-sans, "Sarabun", sans-serif);
  background:
    radial-gradient(circle at 50% -15%, rgba(37,99,235,.42), transparent 42%),
    linear-gradient(145deg, #050b1d 0%, #0b1735 48%, #071126 100%);
}
.competition-board::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(115deg, transparent 0 47%, rgba(255,255,255,.025) 47% 48%, transparent 48% 100%);
  background-size: 84px 84px;
}
.competition-shell {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 1760px;
  min-height: 100vh;
  margin: 0 auto;
  padding: clamp(16px, 2vw, 34px) clamp(14px, 3vw, 56px) 48px;
}
.arena-glow {
  position: fixed;
  z-index: 0;
  width: 42vw;
  height: 42vw;
  border-radius: 999px;
  filter: blur(100px);
  opacity: .24;
  pointer-events: none;
}
.arena-glow-one { top: -22vw; left: -12vw; background: #2563eb; }
.arena-glow-two { right: -18vw; bottom: -24vw; background: #7c3aed; }
.arena-grid {
  position: fixed;
  inset: 0;
  z-index: 0;
  opacity: .16;
  pointer-events: none;
  background-image: linear-gradient(rgba(96,165,250,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,.22) 1px, transparent 1px);
  background-size: 52px 52px;
  mask-image: linear-gradient(to bottom, transparent, #000 20%, #000 75%, transparent);
}
.competition-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 18px;
  padding: clamp(16px, 2vw, 26px);
  border: 1px solid rgba(148,163,184,.2);
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(15,23,42,.86), rgba(30,58,138,.28));
  box-shadow: 0 24px 70px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.08);
  backdrop-filter: blur(18px);
}
.competition-brand { display: flex; align-items: center; gap: 20px; min-width: 0; }
.competition-logo-wrap {
  display: grid;
  place-items: center;
  width: 154px;
  height: 70px;
  flex: 0 0 auto;
  padding: 10px 16px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 12px 34px rgba(37,99,235,.28);
}
.competition-logo-wrap img { width: 100%; height: 100%; object-fit: contain; }
.competition-kicker { display: flex; align-items: center; gap: 7px; color: #60a5fa; font-size: .74rem; font-weight: 900; letter-spacing: .16em; }
.competition-brand h1 { margin: 5px 0 0; font-size: clamp(1.65rem, 3.2vw, 3.25rem); line-height: 1; font-weight: 950; letter-spacing: -.035em; text-shadow: 0 4px 25px rgba(59,130,246,.35); }
.competition-brand p { margin: 8px 0 0; color: #cbd5e1; font-size: clamp(.95rem, 1.4vw, 1.15rem); font-weight: 700; }
.competition-actions { display: flex; align-items: center; justify-content: flex-end; gap: 9px; flex-wrap: wrap; }
.live-badge,.update-clock,.arena-button { min-height: 43px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 12px; font-weight: 900; }
.live-badge { padding: 0 13px; color: #fecaca; border: 1px solid rgba(248,113,113,.32); background: rgba(127,29,29,.32); letter-spacing: .08em; }
.live-badge i { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 5px rgba(239,68,68,.14), 0 0 18px #ef4444; animation: livePulse 1.5s ease-in-out infinite; }
@keyframes livePulse { 50% { opacity: .45; transform: scale(.8); } }
.update-clock { padding: 0 13px; color: #cbd5e1; border: 1px solid rgba(148,163,184,.2); background: rgba(15,23,42,.6); font-variant-numeric: tabular-nums; }
.arena-button { padding: 0 14px; border: 1px solid rgba(148,163,184,.24); color: #e2e8f0; background: rgba(30,41,59,.7); cursor: pointer; transition: .2s ease; }
.arena-button:hover { transform: translateY(-2px); border-color: rgba(96,165,250,.65); background: rgba(30,64,175,.38); }
.arena-button.active { color: #bbf7d0; border-color: rgba(74,222,128,.4); background: rgba(22,101,52,.32); }
.arena-button.refresh { color: #fff; border-color: transparent; background: linear-gradient(135deg,#2563eb,#4f46e5); box-shadow: 0 10px 26px rgba(37,99,235,.3); }
.arena-button.fullscreen { background: rgba(124,58,237,.3); border-color: rgba(167,139,250,.38); }
.competition-filters {
  display: grid;
  grid-template-columns: repeat(3,minmax(220px,1fr));
  gap: 13px;
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid rgba(148,163,184,.18);
  border-radius: 20px;
  background: rgba(15,23,42,.66);
  box-shadow: 0 18px 50px rgba(0,0,0,.18);
  backdrop-filter: blur(16px);
}
.competition-filters label { color: #a5b4fc !important; text-transform: uppercase; letter-spacing: .05em; font-size: .76rem; }
.competition-filters select { box-shadow: 0 8px 18px rgba(0,0,0,.13); }
.podium-arena {
  position: relative;
  overflow: hidden;
  margin-bottom: 20px;
  padding: clamp(18px, 2vw, 30px);
  border: 1px solid rgba(96,165,250,.25);
  border-radius: 26px;
  background: linear-gradient(145deg,rgba(30,41,59,.9),rgba(17,24,39,.82));
  box-shadow: 0 28px 80px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06);
}
.podium-arena::before { content:""; position:absolute; width:420px; height:220px; top:-150px; left:50%; transform:translateX(-50%); border-radius:50%; background:#f59e0b; opacity:.15; filter:blur(55px); pointer-events:none; }
.section-heading { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
.section-eyebrow { color:#fbbf24; font-size:.72rem; font-weight:950; letter-spacing:.18em; }
.section-heading h2 { display:flex; align-items:center; gap:10px; margin:5px 0 0; color:#fff; font-size:clamp(1.4rem,2vw,2rem); font-weight:950; }
.section-heading h2 svg { color:#fbbf24; filter:drop-shadow(0 0 12px rgba(251,191,36,.5)); }
.section-heading p { margin:6px 0 0; color:#94a3b8; font-weight:800; }
.competition-summary { display:flex; gap:10px; color:#cbd5e1; font-weight:800; flex-wrap:wrap; }
.competition-summary > span { color:#dbeafe !important; background:rgba(30,64,175,.22) !important; border-color:rgba(96,165,250,.28) !important; }
.leaderboard-table-card { overflow:hidden; border:1px solid rgba(148,163,184,.2); border-radius:24px; background:#fff; box-shadow:0 28px 80px rgba(0,0,0,.3); }
.leaderboard-title { display:flex; align-items:center; gap:10px; padding:18px 22px; color:#0f172a; border-bottom:1px solid #e2e8f0; font-size:1.28rem; font-weight:950; background:linear-gradient(90deg,#eff6ff,#fff); }
:fullscreen .competition-board { overflow-y:auto; }
:fullscreen .competition-board .competition-shell { max-width:none; padding-left:3vw; padding-right:3vw; }
.podium-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.18fr) minmax(0, 1fr);
  gap: 14px;
  align-items: end;
}
.podium-grid.single-winner {
  grid-template-columns: minmax(0, .72fr) minmax(260px, .92fr) minmax(0, .72fr);
}
.podium-slot {
  min-width: 0;
  display: grid;
  grid-template-rows: auto var(--podium-height);
  gap: 10px;
}
.podium-slot-empty {
  opacity: 0;
  pointer-events: none;
}
.podium-student-card {
  min-height: 148px;
  display: grid;
  align-content: space-between;
  gap: 8px;
  padding: 14px;
  border: 2px solid var(--podium-border);
  border-radius: 16px;
  background: var(--podium-bg);
  box-shadow: 0 18px 45px rgba(0,0,0,.2);
  transform: translateZ(0);
  transition: transform .25s ease, box-shadow .25s ease;
}
.podium-student-card:hover { transform: translateY(-5px); box-shadow:0 24px 55px rgba(0,0,0,.28); }
.podium-rank-1 .podium-student-card {
  min-height: 170px;
  box-shadow: 0 16px 34px rgba(217,119,6,.15);
}
.podium-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--podium-color);
  font-weight: 900;
  font-size: 1rem;
}
.podium-student-card h3 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(1.1rem, 2.2vw, 1.42rem);
  line-height: 1.18;
  font-weight: 900;
  overflow-wrap: anywhere;
}
.podium-rank-1 .podium-student-card h3 {
  font-size: clamp(1.22rem, 2.5vw, 1.62rem);
}
.podium-student-card p {
  margin: 0;
  color: #64748b;
  font-weight: 800;
}
.podium-metrics {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 12px;
}
.podium-metrics strong {
  display: block;
  color: var(--podium-color);
  font-size: 1.55rem;
  line-height: 1;
}
.podium-metrics div:last-child {
  text-align: right;
}
.podium-metrics div:last-child strong {
  color: #334155;
  font-size: 1.16rem;
}
.podium-block {
  display: grid;
  place-items: center;
  min-height: var(--podium-height);
  border: 2px solid var(--podium-border);
  border-radius: 16px 16px 8px 8px;
  background: linear-gradient(180deg, var(--podium-bg), #ffffff);
  box-shadow: 0 18px 36px rgba(0,0,0,.18);
}
.podium-block span {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  background: #ffffff;
  color: var(--podium-color);
  border: 2px solid var(--podium-border);
  font-size: 1.75rem;
  font-weight: 900;
}
@media (max-width: 760px) {
  .competition-shell { padding: 10px 10px 28px; }
  .competition-header { padding: 14px; border-radius: 18px; }
  .competition-brand { gap: 11px; }
  .competition-logo-wrap { width: 92px; height: 51px; padding: 8px; border-radius: 13px; }
  .competition-kicker { font-size: .55rem; letter-spacing: .08em; }
  .competition-brand h1 { font-size: 1.45rem; }
  .competition-brand p { font-size: .82rem; }
  .competition-actions { width: 100%; justify-content: stretch; }
  .live-badge,.update-clock { flex: 1; }
  .arena-button { flex: 1; padding: 0 10px; font-size: .78rem; }
  .competition-filters { grid-template-columns: 1fr; padding: 12px; border-radius: 16px; }
  .podium-arena { padding: 14px 10px; border-radius: 18px; }
  .leaderboard-table-card { border-radius: 18px; }
  .podium-grid,
  .podium-grid.single-winner {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .podium-slot {
    grid-template-rows: auto;
    gap: 0;
  }
  .podium-slot-empty {
    display: none;
  }
  .podium-rank-1 {
    order: 1;
  }
  .podium-rank-2 {
    order: 2;
  }
  .podium-rank-3 {
    order: 3;
  }
  .podium-block {
    display: none;
  }
  .podium-student-card,
  .podium-rank-1 .podium-student-card {
    min-height: 0;
    padding: 10px;
    border-radius: 12px;
  }
  .podium-card-top {
    font-size: .86rem;
  }
  .podium-card-top svg {
    width: 24px;
    height: 24px;
  }
  .podium-student-card h3,
  .podium-rank-1 .podium-student-card h3 {
    font-size: 1rem;
    line-height: 1.18;
  }
  .podium-student-card p {
    font-size: .78rem;
  }
  .podium-metrics strong {
    font-size: 1.28rem;
  }
  .podium-metrics div:last-child strong {
    font-size: .9rem;
  }
}

/* Broadcast studio theme: bright control deck with a focused champion stage. */
.competition-board {
  color: #10224a;
  background:
    radial-gradient(circle at 88% 4%, rgba(56,189,248,.2), transparent 25%),
    radial-gradient(circle at 8% 44%, rgba(99,102,241,.12), transparent 30%),
    linear-gradient(180deg,#f8fbff 0%,#edf3ff 52%,#f7f9fe 100%);
}
.competition-board::before {
  background-image: radial-gradient(rgba(30,64,175,.12) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(to bottom,#000,transparent 72%);
}
.competition-shell { max-width: 1880px; }
.arena-glow { opacity: .14; filter: blur(125px); }
.arena-glow-one { background:#38bdf8; }
.arena-glow-two { background:#6366f1; }
.arena-grid { display:none; }
.competition-header {
  position:relative;
  overflow:hidden;
  margin-bottom:14px;
  padding:clamp(15px,1.7vw,23px);
  border:1px solid rgba(37,99,235,.13);
  border-radius:22px;
  background:rgba(255,255,255,.94);
  box-shadow:0 18px 55px rgba(30,64,175,.12),inset 0 1px 0 #fff;
}
.competition-header::before {
  content:"";
  position:absolute;
  inset:0 auto 0 0;
  width:7px;
  background:linear-gradient(180deg,#22d3ee,#2563eb 52%,#f59e0b);
}
.competition-header::after {
  content:"";
  position:absolute;
  width:300px;
  height:300px;
  right:-160px;
  top:-190px;
  border:34px solid rgba(37,99,235,.055);
  border-radius:50%;
  pointer-events:none;
}
.competition-brand,.competition-actions { position:relative; z-index:1; }
.competition-logo-wrap {
  width:145px;
  height:64px;
  border:1px solid #e1eaf8;
  background:#fff;
  box-shadow:0 10px 28px rgba(30,64,175,.1);
}
.competition-kicker { color:#2563eb; }
.competition-brand h1 {
  color:#10224a;
  font-size:clamp(1.7rem,2.7vw,2.85rem);
  text-shadow:none;
}
.competition-brand p { color:#64748b; }
.live-badge {
  color:#b91c1c;
  border-color:#fecaca;
  background:#fff1f2;
  box-shadow:0 6px 18px rgba(239,68,68,.08);
}
.update-clock {
  color:#334155;
  border-color:#dbe5f4;
  background:#f8fbff;
}
.arena-button {
  color:#334155;
  border-color:#dbe5f4;
  background:#fff;
  box-shadow:0 6px 18px rgba(30,64,175,.06);
}
.arena-button:hover { color:#1d4ed8; background:#eff6ff; border-color:#93c5fd; }
.arena-button.active { color:#047857; border-color:#a7f3d0; background:#ecfdf5; }
.arena-button.refresh { background:linear-gradient(135deg,#0ea5e9,#2563eb); }
.arena-button.fullscreen { color:#4338ca; background:#eef2ff; border-color:#c7d2fe; }
.competition-filters {
  gap:11px;
  margin-bottom:16px;
  padding:13px 15px 15px;
  border:1px solid rgba(37,99,235,.12);
  border-radius:18px;
  background:rgba(255,255,255,.92);
  box-shadow:0 14px 42px rgba(30,64,175,.09);
}
.competition-filters label { color:#52627d !important; letter-spacing:.04em; }
.competition-filters select {
  min-height:48px !important;
  border-color:#d8e3f2 !important;
  background:#f8fbff !important;
  box-shadow:inset 0 1px 0 #fff,0 5px 14px rgba(30,64,175,.045) !important;
}
.competition-filters select:focus { border-color:#60a5fa !important; box-shadow:0 0 0 4px rgba(59,130,246,.12) !important; }
.podium-arena {
  margin-bottom:16px;
  padding:clamp(18px,2vw,28px);
  border:1px solid rgba(96,165,250,.22);
  border-radius:26px;
  background:
    radial-gradient(circle at 50% 10%,rgba(56,189,248,.2),transparent 25%),
    linear-gradient(125deg,#091a3d 0%,#102b63 52%,#111b46 100%);
  box-shadow:0 24px 65px rgba(15,35,80,.23),inset 0 1px 0 rgba(255,255,255,.08);
}
.podium-arena::before { width:520px; height:250px; top:-175px; opacity:.24; background:#fbbf24; }
.podium-arena::after {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:linear-gradient(110deg,transparent 0 42%,rgba(255,255,255,.035) 42% 43%,transparent 43% 100%);
  background-size:80px 80px;
}
.section-heading { align-items:center; }
.section-eyebrow { color:#67e8f9; }
.section-heading h2 svg { color:#facc15; }
.section-heading p { color:#bfdbfe; }
.competition-summary > span { color:#e0f2fe !important; background:rgba(14,165,233,.12) !important; border-color:rgba(125,211,252,.25) !important; }
.podium-grid { gap:clamp(10px,1.4vw,20px); }
.podium-student-card {
  border-width:1px;
  box-shadow:0 18px 46px rgba(2,8,23,.3),inset 0 1px 0 #fff;
}
.podium-rank-1 .podium-student-card {
  border-width:2px;
  box-shadow:0 22px 58px rgba(245,158,11,.22),0 0 0 5px rgba(250,204,21,.07);
}
.podium-block {
  border-width:1px;
  box-shadow:0 18px 35px rgba(2,8,23,.25),inset 0 1px 0 #fff;
}
.podium-block span { box-shadow:0 8px 20px rgba(15,23,42,.1); }
.leaderboard-table-card {
  border-color:#dbe5f4;
  border-radius:22px;
  box-shadow:0 20px 55px rgba(30,64,175,.12);
}
.leaderboard-title {
  color:#10224a;
  background:linear-gradient(90deg,#fff,#eef6ff 50%,#fff);
}
.leaderboard-table-card tbody tr { transition:background .18s ease,transform .18s ease; }
.leaderboard-table-card tbody tr:hover { background:#eef6ff !important; }
:fullscreen .competition-board { background:#edf3ff; }
:fullscreen .competition-header { position:sticky; top:0; z-index:5; }

@media (min-width:1200px) {
  .competition-header { flex-wrap:nowrap; }
  .competition-brand { flex:1; }
  .competition-actions { flex-wrap:nowrap; }
  .podium-student-card { min-height:156px; }
  .podium-rank-1 .podium-student-card { min-height:180px; }
}

@media (max-width:760px) {
  .competition-board::before { background-size:18px 18px; }
  .competition-header { border-radius:16px; }
  .competition-logo-wrap { width:90px; height:49px; }
  .competition-filters { border-radius:15px; }
  .podium-arena { border-radius:18px; }
  .podium-student-card { box-shadow:0 10px 24px rgba(2,8,23,.2); }
}

/* Minimal School Robotics palette: white, blue and orange only. */
.competition-board {
  color:#17375f;
  background:#f5f7fa;
}
.competition-board::before,.arena-glow,.arena-grid { display:none; }
.fireworks-layer {
  position:fixed;
  inset:0;
  z-index:3;
  overflow:hidden;
  pointer-events:none;
}
.firework {
  position:absolute;
  left:var(--firework-left);
  top:var(--firework-top);
  width:6px;
  height:6px;
}
.firework::before {
  content:"";
  position:absolute;
  inset:-5px;
  border:2px solid var(--firework-color);
  border-radius:50%;
  animation:fireworkFlash 4.9s ease-out infinite;
  animation-delay:var(--firework-delay);
  opacity:0;
}
.firework i {
  position:absolute;
  left:0;
  top:0;
  width:8px;
  height:8px;
  border-radius:50%;
  background:var(--firework-color);
  box-shadow:0 0 10px color-mix(in srgb,var(--firework-color) 80%,transparent);
  filter:drop-shadow(0 1px 1px rgba(255,255,255,.9));
  opacity:0;
  animation:fireworkBurst 4.9s cubic-bezier(.2,.72,.3,1) infinite;
  animation-delay:var(--firework-delay);
}
@keyframes fireworkBurst {
  0%,6% { opacity:0; transform:rotate(var(--spark-angle)) translateY(0) scale(.3); }
  8% { opacity:1; }
  42% { opacity:.45; }
  56% { opacity:0; transform:rotate(var(--spark-angle)) translateY(calc(var(--firework-distance) * -1)) scale(.85); }
  100% { opacity:0; transform:rotate(var(--spark-angle)) translateY(calc(var(--firework-distance) * -1)) scale(.2); }
}
@keyframes fireworkFlash {
  0%,6% { opacity:0; transform:scale(.15); }
  8% { opacity:.9; }
  22% { opacity:0; transform:scale(2.3); }
  100% { opacity:0; transform:scale(2.3); }
}
.competition-shell { max-width:1720px; padding-top:20px; }
.competition-header {
  overflow:visible;
  margin-bottom:12px;
  padding:18px 20px;
  border:1px solid #dce4ee;
  border-radius:16px;
  background:#fff;
  box-shadow:0 5px 18px rgba(23,75,135,.07);
}
.competition-header::before {
  inset:16px auto 16px 0;
  width:4px;
  border-radius:0 4px 4px 0;
  background:#e96b22;
}
.competition-header::after { display:none; }
.competition-logo-wrap {
  width:138px;
  height:60px;
  padding:8px 12px;
  border:1px solid #e1e7ef;
  border-radius:12px;
  appearance:none;
  cursor:pointer;
  box-shadow:none;
  transition:border-color .18s ease,background .18s ease;
}
.competition-logo-wrap:hover { border-color:#9eb8d6; background:#f8fbff; }
.competition-logo-wrap:focus-visible { outline:3px solid rgba(46,104,165,.18); outline-offset:2px; }
.competition-kicker { color:#2e68a5; letter-spacing:.12em; }
.competition-brand h1 { color:#17375f; font-size:clamp(1.65rem,2.5vw,2.65rem); }
.competition-brand p { margin-top:6px; color:#65758a; }
.live-badge,.update-clock,.arena-button {
  min-height:40px;
  border-radius:9px;
  box-shadow:none;
}
.live-badge { color:#c75415; border-color:#f2c6aa; background:#fff7f2; }
.live-badge i { background:#e96b22; box-shadow:none; animation:none; }
.update-clock { color:#3b4d63; border-color:#dce4ee; background:#fff; }
.arena-button { color:#31516f; border-color:#dce4ee; background:#fff; }
.arena-button:hover { transform:none; color:#174b87; border-color:#9eb8d6; background:#f5f9fd; }
.arena-button.active { color:#174b87; border-color:#abc3dd; background:#f2f7fc; }
.arena-button.refresh { border-color:#174b87; background:#174b87; box-shadow:none; }
.arena-button.fullscreen { color:#d95f18; border-color:#f1c09f; background:#fff8f2; }
.competition-filters {
  gap:12px;
  margin-bottom:12px;
  padding:14px;
  border:1px solid #dce4ee;
  border-radius:14px;
  background:#fff;
  box-shadow:none;
}
.competition-filters label { color:#53667c !important; letter-spacing:0; text-transform:none; }
.competition-filters select {
  min-height:45px !important;
  border-color:#dce4ee !important;
  border-radius:9px !important;
  background:#fff !important;
  box-shadow:none !important;
}
.competition-filters select:focus { border-color:#2e68a5 !important; box-shadow:0 0 0 3px rgba(46,104,165,.1) !important; }
.podium-arena {
  margin-bottom:12px;
  padding:20px;
  border:1px solid #dce4ee;
  border-radius:16px;
  background:#fff;
  box-shadow:none;
}
.podium-arena::before,.podium-arena::after { display:none; }
.section-heading { margin-bottom:16px; }
.section-eyebrow { color:#e96b22; letter-spacing:.13em; }
.section-heading h2 { color:#17375f; }
.section-heading h2 svg { color:#e96b22; filter:none; }
.section-heading p { color:#65758a; }
.competition-summary { color:#31516f; }
.competition-summary > span {
  color:#174b87 !important;
  border-color:#d5e0ec !important;
  background:#f5f9fd !important;
}
.podium-grid { gap:12px; }
.podium-student-card,
.podium-rank-1 .podium-student-card {
  border-width:1px;
  border-radius:12px;
  box-shadow:none;
}
.podium-student-card:hover { transform:none; box-shadow:none; }
.podium-rank-1 .podium-student-card { box-shadow:inset 0 4px 0 #e96b22; }
.podium-rank-2 .podium-student-card { box-shadow:inset 0 4px 0 #2e68a5; }
.podium-rank-3 .podium-student-card { box-shadow:inset 0 4px 0 #b86532; }
.podium-block {
  border-width:1px;
  border-radius:12px 12px 6px 6px;
  box-shadow:none;
  background:var(--podium-bg);
}
.podium-block span { width:48px; height:48px; box-shadow:none; }
.leaderboard-table-card {
  border-color:#dce4ee;
  border-radius:16px;
  box-shadow:none;
}
.leaderboard-title {
  color:#17375f;
  background:#fff;
  border-bottom-color:#dce4ee;
}
.leaderboard-title svg { color:#e96b22 !important; }
.leaderboard-table-card thead tr { background:#f4f7fa !important; color:#53667c !important; }
.leaderboard-table-card tbody tr:hover { background:#f7f9fc !important; }
:fullscreen .competition-board { background:#f5f7fa; }
:fullscreen .competition-header { position:static; }

@media (max-width:760px) {
  .competition-shell { padding-top:10px; }
  .competition-header,.competition-filters,.podium-arena,.leaderboard-table-card { border-radius:12px; }
  .podium-student-card { box-shadow:none; }
  .firework:nth-child(3),.firework:nth-child(4) { display:none; }
}

@media (prefers-reduced-motion:reduce) {
  .fireworks-layer { display:none; }
}
`;

const selectStyle = {
  width: '100%',
  minHeight: 44,
  border: '1px solid #dbe3ef',
  borderRadius: 12,
  background: '#ffffff',
  color: '#0f172a',
  padding: '0 12px',
  fontSize: '.98rem',
  fontWeight: 800,
  outline: 'none'
};

const emptyStyle = {
  minHeight: 280,
  display: 'grid',
  placeItems: 'center',
  gap: 12,
  background: '#ffffff',
  border: '1px solid #dbe3ef',
  borderRadius: 18,
  color: '#64748b',
  fontWeight: 900,
  fontSize: '1.25rem',
  textAlign: 'center'
};

const summaryPill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  background: '#eef6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 999,
  padding: '8px 12px'
};

const metricLabel = {
  display: 'block',
  color: '#64748b',
  fontWeight: 900,
  marginBottom: 2
};

const thStyle = {
  padding: '10px 14px',
  fontSize: '.95rem',
  fontWeight: 900,
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '11px 14px',
  fontSize: '1rem',
  color: '#1e293b',
  whiteSpace: 'nowrap'
};

const rankBadge = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 34,
  height: 34,
  borderRadius: 999,
  fontWeight: 900
};
