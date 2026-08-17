import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
console.log("URL:", supabaseUrl ? "Exists" : "Missing");

if (supabaseUrl && supabaseAnonKey) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  supabase.from('credenciados').select('cnpj_cpf').limit(1).then(({data, error}) => {
    console.log(data, error);
  });
}
