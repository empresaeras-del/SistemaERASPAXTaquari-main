import { createClient } from '@supabase/supabase-js';
import { supabase, registrarAuditoria } from "../lib/supabase";
import {
  getFromIDB,
  saveToIDB,
  getAllFromIDB,
  deleteFromIDB,
} from "../lib/idb";
import { NivelAcesso } from "../types";

export interface UsuarioCadastro {
  id: string;
  tenant_id: string;
  nome: string;
  email: string;
  nivel: NivelAcesso;
  modulos_permitidos: string[];
  status: "ativo" | "inativo";
  created_at?: string;
  deleted_at?: string | null;
}

const STORE_NAME = "usuarios";

const getIsolatedSupabaseClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:9999';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
};

export const getUsuarios = async (
  isOnline: boolean,
  tenantId?: string | null,
): Promise<UsuarioCadastro[]> => {
  let usuarios: UsuarioCadastro[] = [];

  if (isOnline) {
    try {
      let query = supabase.from("users").select("*").is("deleted_at", null);
      if (tenantId && tenantId !== "all") {
        query = query.eq("tenant_id", tenantId);
      }
      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        for (const item of data) {
          await saveToIDB(STORE_NAME, item);
        }
      }
      usuarios = data || [];
    } catch (error) {
      console.warn(
        "Supabase fetch failed, falling back to IDB.",
        error
      );
      usuarios = await getAllFromIDB<UsuarioCadastro>(STORE_NAME);
    }
  } else {
    usuarios = await getAllFromIDB<UsuarioCadastro>(STORE_NAME);
  }

  return usuarios.filter((u) => {
    if (u.deleted_at) return false;
    if (tenantId && tenantId !== "all" && u?.tenant_id !== tenantId)
      return false;
    return true;
  });
};

export const saveUsuario = async (
  usuario: UsuarioCadastro,
  isOnline: boolean,
  password?: string,
  currentUser?: { id?: string; nivel?: string }
): Promise<void> => {
  if (!isOnline) {
    throw new Error("Não é possível salvar enquanto estiver offline.");
  }

  const existing = await getFromIDB<UsuarioCadastro>(STORE_NAME, usuario.id);
  const isNew = !existing && Boolean(password);

  let finalUserId = usuario.id;

  if (isNew && password) {
    // 1. Cria a conta de autenticação no Supabase Auth usando cliente isolado (não desloga o admin)
    const tempClient = getIsolatedSupabaseClient();
    const { data: authData, error: authError } = await tempClient.auth.signUp({
      email: usuario.email.trim(),
      password: password,
      options: {
        data: {
          nome: usuario.nome.trim(),
          tenant_id: usuario.tenant_id,
          nivel: usuario.nivel
        }
      }
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('User already exists')) {
        throw new Error('Este e-mail já está cadastrado no sistema.');
      }
      if (authError.message.includes('Password should be at least')) {
        throw new Error('A senha deve conter no mínimo 6 caracteres.');
      }
      throw new Error(`Erro na autenticação: ${authError.message}`);
    }

    if (authData.user?.id) {
      finalUserId = authData.user.id;
    }
  } else if (!isNew && password && password.trim().length > 0) {
    // Alteração de senha em usuário existente
    const cleanPassword = password.trim();
    if (cleanPassword.length < 6) {
      throw new Error('A nova senha deve conter no mínimo 6 caracteres.');
    }

    // Caso A: O próprio usuário logado alterando sua própria senha
    if (currentUser?.id === usuario.id) {
      const { error: updateAuthErr } = await supabase.auth.updateUser({
        password: cleanPassword
      });
      if (updateAuthErr) {
        console.error("Erro ao atualizar senha no Supabase Auth:", updateAuthErr);
        throw new Error(`Erro ao atualizar senha: ${updateAuthErr.message}`);
      }
    } else if (currentUser?.nivel === 'super_admin' || currentUser?.nivel === 'admin') {
      // Caso B: Super Admin (ou Admin) alterando senha de outro usuário via RPC com search_path seguro
      try {
        const { error: rpcError } = await supabase.rpc('admin_alterar_senha_usuario', {
          target_user_id: usuario.id,
          new_password: cleanPassword
        });

        if (rpcError) {
          console.warn("RPC admin_alterar_senha_usuario erro:", rpcError);
          // Se for o próprio usuário, fallback para updateUser
          if (currentUser?.id === usuario.id) {
            const { error: fallbackErr } = await supabase.auth.updateUser({
              password: cleanPassword
            });
            if (fallbackErr) throw fallbackErr;
          } else {
            throw new Error(`Erro ao alterar senha do usuário: ${rpcError.message}`);
          }
        }
      } catch (err: any) {
        console.error("Falha ao atualizar senha do usuário no Supabase:", err);
        throw new Error(err.message || 'Erro ao alterar a senha do usuário no Supabase.');
      }
    }
  }

  const usuarioToSave: UsuarioCadastro = {
    ...usuario,
    id: finalUserId
  };

  // 2. Garante atualização na tabela public.users
  const { error: dbError } = await supabase.from("users").upsert({
    id: finalUserId,
    tenant_id: usuarioToSave.tenant_id,
    nome: usuarioToSave.nome.trim(),
    email: usuarioToSave.email.trim().toLowerCase(),
    nivel: usuarioToSave.nivel,
    modulos_permitidos: usuarioToSave.modulos_permitidos || ['*'],
    status: usuarioToSave.status || 'ativo',
    updated_at: new Date().toISOString()
  });

  if (dbError) {
    console.error("Erro ao salvar usuário na tabela users:", dbError);
    throw new Error(dbError.message || "Erro ao salvar dados do usuário no banco.");
  }

  // 3. Salva no IndexedDB local e registra auditoria
  await saveToIDB(STORE_NAME, usuarioToSave);
  await registrarAuditoria(isNew ? "Criar Usuário" : "Editar Usuário", {
    id: usuarioToSave.id,
    email: usuarioToSave.email,
    nivel: usuarioToSave.nivel,
    tenant_id: usuarioToSave.tenant_id,
    senha_alterada: Boolean(password && password.trim().length > 0)
  });
};

export const deleteUsuario = async (
  id: string,
  isOnline: boolean,
): Promise<void> => {
  if (!isOnline) {
    throw new Error("Não é possível excluir enquanto estiver offline.");
  }

  // 1. Tenta via RPC seguro (com verificação de nível e suporte a auth ban)
  let rpcSuccess = false;
  try {
    const { data, error: rpcError } = await supabase.rpc('admin_excluir_usuario', {
      target_user_id: id,
      hard_delete: false
    });

    if (!rpcError) {
      rpcSuccess = true;
    } else {
      console.warn("RPC admin_excluir_usuario não executou ou falhou, tentando fallback direto:", rpcError);
    }
  } catch (err) {
    console.warn("Erro ao invocar RPC admin_excluir_usuario:", err);
  }

  // 2. Fallback direto caso o RPC não esteja criado ainda no banco
  if (!rpcSuccess) {
    let { error } = await supabase
      .from("users")
      .update({ 
        deleted_at: new Date().toISOString(),
        status: 'inativo'
      })
      .eq("id", id);

    if (error) {
      // Se a coluna deleted_at não existir no banco legado, tenta atualizar apenas status
      if (error.message?.includes('deleted_at') || error.code === '42703') {
        const fallbackUpdate = await supabase
          .from("users")
          .update({ status: 'inativo' })
          .eq("id", id);
        error = fallbackUpdate.error;
      }
    }

    if (error) {
      console.error("Erro ao excluir usuário no Supabase:", error);
      throw new Error(error.message || "Falha ao excluir usuário no Supabase.");
    }
  }

  // 3. Atualiza localmente no IndexedDB
  const user = await getFromIDB<UsuarioCadastro>(STORE_NAME, id);
  if (user) {
    user.deleted_at = new Date().toISOString();
    user.status = 'inativo';
    await saveToIDB(STORE_NAME, user);
  }
  await deleteFromIDB(STORE_NAME, id);

  await registrarAuditoria("Excluir Usuário (Soft Delete)", { id });
};

