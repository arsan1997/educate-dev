import React, { useState } from 'react';
import { Search, Loader2, Award, ChevronRight, School, User, Clock3 } from 'lucide-react';
import { searchPublicStudentScores } from '../dataService';

export default function PublicSearch() {
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const t = term.trim();
    if (t.length < 4) {
      setError('กรุณาพิมพ์ชื่ออย่างน้อย 4 ตัวอักษร');
      return;
    }
    setError('');
    setLoading(true);
    setHasSearched(false);
    
    try {
      const data = await searchPublicStudentScores(t);
      // Group by student
      const grouped = {};
      (data || []).forEach(row => {
        const key = `${row.school_name}|${row.academic_year}|${row.term}|${row.classroom_name}|${row.student_name}`;
        if (!grouped[key]) {
          grouped[key] = {
            student_name: row.student_name,
            student_no: row.student_no,
            school_name: row.school_name,
            academic_year: row.academic_year,
            term: row.term,
            classroom_name: row.classroom_name,
            tests: []
          };
        }
        if (row.test_name && (row.score !== null || row.absent)) {
          grouped[key].tests.push({
            test_name: row.test_name,
            robot_type: row.robot_type,
            exam_set: row.exam_set,
            score: row.score,
            time_value: row.time_value,
            absent: row.absent,
            rank: row.rank,
            total_students: row.total_students
          });
        }
      });
      const sortedResults = Object.values(grouped).map(student => {
        student.tests.sort((a, b) => {
          const numA = parseInt((a.test_name.match(/\d+/) || [0])[0], 10);
          const numB = parseInt((b.test_name.match(/\d+/) || [0])[0], 10);
          if (numA !== numB) return numA - numB;
          return a.test_name.localeCompare(b.test_name);
        });
        return student;
      });
      setResults(sortedResults);
      setHasSearched(true);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)', padding: '3rem 1rem', fontFamily: 'var(--font-sans, "Inter", sans-serif)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', padding: '1.2rem', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', color: 'white', borderRadius: '24px', marginBottom: '1.5rem', boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)' }}>
            <Award size={40} />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>ค้นหาผลคะแนน</h1>
          <p style={{ color: '#64748b', fontSize: '1.2rem', fontWeight: '500' }}>สำหรับผู้ปกครองและนักเรียนในโครงการ School Robotics</p>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input 
              type="text" 
              placeholder="พิมพ์ชื่อ-นามสกุล ของนักเรียน (เช่น สมชาย ใจดี)..." 
              value={term}
              onChange={e => setTerm(e.target.value)}
              style={{ width: '100%', padding: '1.2rem 1.2rem 1.2rem 3.5rem', fontSize: '1.15rem', borderRadius: '16px', border: 'none', outline: 'none', background: 'rgba(255, 255, 255, 0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.05)', color: '#1e293b', fontWeight: '500', backdropFilter: 'blur(10px)' }}
            />
            <Search size={22} color="#94a3b8" style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: '0 2.5rem', background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '1.15rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)', transition: 'transform 0.1s, box-shadow 0.1s' }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'none'}
          >
            {loading ? <Loader2 className="spin" /> : 'ค้นหา'}
          </button>
        </form>

        {error && <div style={{ padding: '1.2rem', background: '#fef2f2', color: '#b91c1c', borderRadius: '12px', marginBottom: '2rem', textAlign: 'center', fontWeight: '600', border: '1px solid #fecaca', boxShadow: '0 2px 10px rgba(185, 28, 28, 0.05)' }}>{error}</div>}

        {hasSearched && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255, 255, 255, 0.8)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.05)' }}>
            <User size={64} color="#cbd5e1" style={{ marginBottom: '1.5rem' }} />
            <h3 style={{ color: '#334155', marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: '700' }}>ไม่พบข้อมูลนักเรียน</h3>
            <p style={{ color: '#64748b', fontSize: '1.1rem' }}>กรุณาตรวจสอบการสะกดชื่อ-นามสกุลใหม่อีกครั้ง</p>
          </div>
        )}

        {results.map((student, idx) => (
          <div key={idx} style={{ background: 'white', borderRadius: '24px', marginBottom: '2rem', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#0f172a' }}>
                <div style={{ padding: '0.5rem', background: '#eff6ff', borderRadius: '12px', color: '#2563eb' }}><User size={28} /></div>
                {student.student_name}
              </h2>
              <div style={{ display: 'flex', gap: '1.5rem', color: '#64748b', fontSize: '1rem', flexWrap: 'wrap', fontWeight: '500' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '100px' }}><School size={16} color="#475569" /> โรงเรียน{student.school_name}</span>
                <span style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '100px' }}>ปีการศึกษา {student.academic_year} เทอม {student.term}</span>
                <span style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '100px' }}>ชั้น {student.classroom_name} (เลขที่ {student.student_no})</span>
              </div>
            </div>

            <div style={{ padding: '2rem' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#334155', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ผลการทดสอบ <ChevronRight size={20} color="#94a3b8" />
              </h3>
              
              {student.tests.length === 0 ? (
                <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', textAlign: 'center', color: '#94a3b8', fontWeight: '500' }}>
                  ยังไม่มีผลการทดสอบ
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {student.tests.map((test, tidx) => (
                    <div key={tidx} style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', border: '1px solid #e2e8f0', transition: 'background 0.2s', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}>
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{ fontWeight: '800', fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.25rem' }}>{test.test_name}</div>
                        <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: '500', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ background: '#e2e8f0', padding: '0.1rem 0.5rem', borderRadius: '6px' }}>{test.robot_type}</span>
                          <span style={{ background: '#e2e8f0', padding: '0.1rem 0.5rem', borderRadius: '6px' }}>ชุด {test.exam_set}</span>
                        </div>
                      </div>
                      
                      {test.absent ? (
                        <div style={{ padding: '0.75rem 1.5rem', background: '#fef2f2', color: '#b91c1c', borderRadius: '100px', fontWeight: '700', fontSize: '1rem', border: '1px solid #fecaca' }}>ขาดสอบ</div>
                      ) : (
                        <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>คะแนน</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: test.score >= 35 ? '#16a34a' : (test.score >= 25 ? '#ca8a04' : '#dc2626') }}>
                              {test.score}<span style={{ fontSize: '1.1rem', color: '#94a3b8', fontWeight: '600' }}>/50</span>
                            </div>
                          </div>
                          
                          <div style={{ width: '1px', height: '40px', background: '#e2e8f0' }}></div>

                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>เวลา</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
                              <Clock3 size={18} color="#94a3b8"/> {test.time_value || '-'}
                            </div>
                          </div>

                          <div style={{ width: '1px', height: '40px', background: '#e2e8f0' }}></div>

                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ลำดับห้อง</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#2563eb' }}>
                              #{test.rank} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: '600' }}>/ {test.total_students}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
