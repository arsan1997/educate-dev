import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function DebugEvals() {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from('onsite_evaluations').select('id, classroom_id, academic_term, created_at, teaching_period, classrooms(name)')
      .order('created_at', { ascending: false }).limit(10)
      .then(res => {
        if (res.error) setError(res.error.message);
        else setData(res.data);
      });
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Debug Evals</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <pre style={{ background: '#eee', padding: 10, overflow: 'auto' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
