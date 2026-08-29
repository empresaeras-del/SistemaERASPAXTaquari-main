import { saveToIDB } from './idb';
import { generateUUID } from '../utils/uuid';
import { get } from './idb-safe';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:9999';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';

if (import.meta.env.DEV) {
  console.log('Supabase URL is:', supabaseUrl);
}
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

export const isolatedSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
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
  let userEmail = 'sistema@eras.com.br';
  let userNivel: string | undefined = undefined;

  // 1. Tenta obter do perfil em cache no localStorage (mais rápido e completo)
  try {
    const cached = localStorage.getItem('cached_user_profile');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.id) userId = parsed.id;
      if (parsed.nome) userName = parsed.nome;
      if (parsed.email) userEmail = parsed.email;
      if (parsed.nivel) userNivel = parsed.nivel;
      if (parsed.tenant_id && parsed.tenant_id !== 'all') tenantId = parsed.tenant_id;
    }
  } catch (e) {}

  // 2. Se não encontrou nome real, tenta obter do Supabase Auth
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      userId = userData.user.id;
      if (!userEmail || userEmail === 'sistema@eras.com.br') {
        userEmail = userData.user.email || '';
      }
      const meta = userData.user.user_metadata || {};
      const appMeta = userData.user.app_metadata || {};
      if (userName === 'Sistema') {
        userName = meta.nome || meta.full_name || userData.user.email?.split('@')[0] || 'Usuário';
      }
      if (!userNivel) {
        userNivel = appMeta.nivel || meta.nivel;
      }
      if (meta.tenant_id && meta.tenant_id !== 'all') {
        tenantId = meta.tenant_id;
      }
    }
  } catch (e) {
    // Ignore Supabase errors for offline
  }

  try {
    const storedTenant = await get('tenant_id');
    if (storedTenant && storedTenant !== 'all') tenantId = storedTenant;
  } catch (e) {}

  const payloadDetalhes = {
    ...(typeof detalhes === 'object' && detalhes !== null ? detalhes : { info: detalhes }),
    usuario: userName,
    usuario_email: userEmail
  };

  // 3. Tentar gravar no Supabase (se configurado/online)
  try {
    if (isSupabaseConfigured) {
      // Tenta insert direto primeiro
      const { error: insertErr } = await supabase.from('auditoria').insert([{
        tenant_id: tenantId,
        usuario_id: userId === 'system' ? null : userId,
        usuario_nome: userName,
        acao,
        detalhes: payloadDetalhes
      }]);

      // Se falhar (ex: RPC obrigatório por permissão), faz fallback para RPC
      if (insertErr) {
        await supabase.rpc('registrar_audit', {
          user_id: userId,
          acao,
          detalhes: payloadDetalhes
        });
      }
    }
  } catch (error) {
    console.warn('Erro ao registrar auditoria no Supabase, mantendo no IDB:', error);
  }

  // 4. Sempre gravar no IDB para visualização local/offline instantânea
  try {
    const log = {
      id: generateUUID(),
      tenant_id: tenantId,
      usuario_id: userId,
      usuario_nome: userName,
      acao,
      detalhes: payloadDetalhes,
      created_at: new Date().toISOString(),
      usuarios: {
        nome: userName,
        email: userEmail,
        nivel: userNivel
      }
    };
    await saveToIDB('auditoria', log);
  } catch (error) {
    console.error('Erro ao salvar auditoria no IDB:', error);
  }
};
