const url = 'https://bumbeczlxcgmbnnsjxvi.supabase.co';
const key = 'sb_publishable_BFEkZHOYUdNd0pxL9eO_Dw_gq2OdjtW';

async function run() {
  try {
    const res = await fetch(`${url}/rest/v1/onsite_evaluations?select=id,school_id,eval_date&order=created_at.desc&limit=5`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const evals = await res.json();
    console.log(JSON.stringify(evals, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
