import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), '');
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const newCred = {
    razao_social: 'TEST CLINIC',
    cnpj_cpf: '04311093001106',
    ramo_atividade: 'clinica_medica',
    status: 'ativo'
  };
  
  const { data, error } = await supabase.from('credenciados').insert([newCred]).select().single();
  if (error) {
    console.error("Error from insert:", JSON.stringify(error, null, 2));
  }
}
test();
