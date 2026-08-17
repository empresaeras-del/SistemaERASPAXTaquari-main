import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const newCred = {
    razao_social: 'TEST CLINIC',
    cnpj_cpf: '00000000001',
    ramo_atividade: 'clinica_medica',
    status: 'ativo'
  };
  
  console.log("Creating...");
  const { data: inserted, error: insertErr } = await supabase.from('credenciados').insert([newCred]).select().single();
  if (insertErr) {
    console.error("Insert error:", JSON.stringify(insertErr, null, 2));
    return;
  }
  
  console.log("Inserted:", inserted.id);
  
  console.log("Updating...");
  const updateData = { razao_social: 'TEST CLINIC UPDATED' };
  const { data: updated, error: updateErr } = await supabase.from('credenciados').update(updateData).eq('id', inserted.id).select().single();
  
  if (updateErr) {
    console.error("Update error:", JSON.stringify(updateErr, null, 2));
  } else {
    console.log("Updated:", updated.razao_social);
  }
}

test();
