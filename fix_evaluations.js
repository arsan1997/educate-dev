const url = 'https://bumbeczlxcgmbnnsjxvi.supabase.co';
const key = 'sb_publishable_BFEkZHOYUdNd0pxL9eO_Dw_gq2OdjtW';

async function run() {
  try {
    const res = await fetch(`${url}/rest/v1/onsite_evaluations?school_id=is.null&select=id,classroom_id`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const evals = await res.json();
    console.log('Evaluations missing school_id:', evals.length);
    
    for (const ev of evals) {
      if (!ev.classroom_id) continue;
      
      const resClass = await fetch(`${url}/rest/v1/classrooms?id=eq.${ev.classroom_id}&select=school_id`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      const cls = await resClass.json();
      if (cls.length > 0) {
        const schoolId = cls[0].school_id;
        console.log(`Fixing eval ${ev.id}: setting school_id=${schoolId}`);
        await fetch(`${url}/rest/v1/onsite_evaluations?id=eq.${ev.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ school_id: schoolId })
        });
      }
    }
    console.log('Done.');
  } catch (err) {
    console.error(err);
  }
}
run();
