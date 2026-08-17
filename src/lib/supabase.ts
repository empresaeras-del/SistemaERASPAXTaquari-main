import { saveToIDB } from './idb';
import { get } from './idb-safe';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:9999';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';

console.log('Supabase URL is:', supabaseUrl);
export const isSupabaseConfigured = !(supabaseUrl.includes('localhost:9999') || supabaseUrl.includes('placeholder'));
export const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: (url, options) => {
          if (supabaseUrl.includes('localhost:9999') || supabaseUrl.includes('placeholder')) {
             return Promise.resolve(new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
          }
          return fetch(url, options);
        }
      }
    });

// Wrapper para auditoria
export const registrarAuditoria = async (acao: string, detalhes: any) => {
  let userId = 'system';
  let tenantId = 'empresa_padrao';
  let userName = 'Sistema';

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      userId = userData.user.id;
      userName = userData.user.email || 'Usuário Supabase';
    }
  } catch (e) {
    // Ignore Supabase errors for offline
  }

  try {
    const storedTenant = await get('tenant_id');
    if (storedTenant) tenantId = storedTenant;
  } catch (e) {}

  // 1. Tentar gravar via RPC no Supabase (se configurado/online)
  try {
    if (isSupabaseConfigured) {
      await supabase.rpc('registrar_audit', {
        user_id: userId,
        acao,
        detalhes
      });
    }
  } catch (error) {
    console.warn('Erro ao registrar auditoria no Supabase, caindo para IDB:', error);
  }

  // 2. Sempre gravar no IDB para visualização local/offline
  try {
    const log = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      usuario_id: userId,
      acao,
      detalhes,
      created_at: new Date().toISOString(),
      usuarios: {
        nome: userName,
        email: userName
      }
    };
    await saveToIDB('auditoria', log);
  } catch (error) {
    console.error('Erro ao salvar auditoria no IDB:', error);
  }
};
