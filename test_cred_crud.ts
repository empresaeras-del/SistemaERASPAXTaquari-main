import { supabase } from './src/lib/supabase.ts';

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
    console.error("Insert error:", insertErr);
    return;
  }
  
  console.log("Inserted:", inserted.id);
  
  console.log("Updating...");
  const updateData = { razao_social: 'TEST CLINIC UPDATED' };
  const { data: updated, error: updateErr } = await supabase.from('credenciados').update(updateData).eq('id', inserted.id).select().single();
  
  if (updateErr) {
    console.error("Update error:", updateErr);
  } else {
    console.log("Updated:", updated.razao_social);
  }
}

test();
