import React, { useEffect, useMemo, useState } from 'react';
import { Award, Clock3, Loader2, Medal, RefreshCw, School, Trophy, Users } from 'lucide-react';
import { loadExamTestLeaderboard } from '../dataService';
import brandLogo from '../assets/logo.png';

const medalStyles = [
  { label: 'อันดับ 1', color: '#b7791f', bg: '#fff7d6', border: '#f4c430', medal: '#d97706' },
  { label: 'อันดับ 2', color: '#475569', bg: '#f8fafc', border: '#cbd5e1', medal: '#64748b' },
  { label: 'อันดับ 3', color: '#92400e', bg: '#fff1e6', border: '#f59e0b', medal: '#b45309' }
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
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadRows = async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await loadExamTestLeaderboard();
      setRows(data);
      setUpdatedAt(new Date());
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
  const updateText = updatedAt ? updatedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';

  return (
    <div style={{ minHeight: '100vh', background: '#eef2f7', color: '#0f172a', fontFamily: 'var(--font-sans, "Sarabun", sans-serif)' }}>
      <style>{podiumCss}</style>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 18px 34px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src={brandLogo} alt="School Robotics" style={{ width: 128, height: 46, objectFit: 'contain' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.55rem, 3vw, 2.5rem)', lineHeight: 1.05, fontWeight: 900 }}>กระดานคะแนนการแข่งขัน</h1>
              <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '1rem', fontWeight: 600 }}>{selectedSchool?.name || 'School Robotics'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ffffff', border: '1px solid #dbe3ef', borderRadius: 12, padding: '10px 12px', color: '#475569', fontWeight: 700 }}>
              <Clock3 size={18} /> {updateText}
            </span>
            <button type="button" onClick={() => setAutoRefresh(value => !value)} style={{ border: '1px solid #dbe3ef', background: autoRefresh ? '#dcfce7' : '#ffffff', color: autoRefresh ? '#166534' : '#475569', borderRadius: 12, padding: '10px 14px', fontWeight: 800, cursor: 'pointer' }}>
              อัปเดตอัตโนมัติ
            </button>
            <button type="button" onClick={() => loadRows(true)} disabled={refreshing} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, background: '#1d4ed8', color: '#ffffff', borderRadius: 12, padding: '11px 16px', fontWeight: 900, cursor: 'pointer', minWidth: 108, justifyContent: 'center' }}>
              {refreshing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />} รีเฟรช
            </button>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
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
            <section style={{ background: '#ffffff', border: '1px solid #dbe3ef', borderRadius: 18, padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}><Trophy color="#d97706" /> 3 อันดับแรก</h2>
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontWeight: 700 }}>{selectedClassroom?.name || '-'} · {selectedSession?.name || '-'}</p>
                </div>
                <div style={{ display: 'flex', gap: 10, color: '#475569', fontWeight: 800, flexWrap: 'wrap' }}>
                  <span style={summaryPill}><Users size={17} /> มีคะแนน {rankedRows.length} คน</span>
                  {selectedSession?.robot && <span style={summaryPill}>{selectedSession.robot}</span>}
                </div>
              </div>

              <div className={`podium-grid ${podiumRows.length === 1 ? 'single-winner' : ''}`}>
                {podiumSlots.map(slot => <PodiumSlot key={slot.rankIndex} {...slot} />)}
              </div>
            </section>

            <section style={{ background: '#ffffff', border: '1px solid #dbe3ef', borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, fontSize: '1.25rem' }}>
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
}
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
