import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data: creds, error: fetchErr } = await supabase.from('credenciados').select('*').limit(1);
  if (fetchErr) {
    console.error("Fetch error:", fetchErr);
    return;
  }
  const cred = creds[0];
  console.log("cred", cred.id);
  const { id, created_at, updated_at, empresa_id, ...dataToSave } = cred;
  const { data, error } = await supabase.from('credenciados').update(dataToSave).eq('id', cred.id).select().single();
  if (error) {
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log("success");
  }
}

test();
