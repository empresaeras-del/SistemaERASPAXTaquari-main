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
  password?: string
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
    tenant_id: usuarioToSave.tenant_id
  });
};

export const deleteUsuario = async (
  id: string,
  isOnline: boolean,
): Promise<void> => {
  if (!isOnline) {
    throw new Error("Não é possível excluir enquanto estiver offline.");
  }

  const { error } = await supabase
    .from("users")
    .update({ 
      deleted_at: new Date().toISOString(),
      status: 'inativo'
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir usuário no Supabase:", error);
    throw new Error(error.message || "Falha ao excluir usuário.");
  }

  const user = await getFromIDB<UsuarioCadastro>(STORE_NAME, id);
  if (user) {
    user.deleted_at = new Date().toISOString();
    user.status = 'inativo';
    await saveToIDB(STORE_NAME, user);
  }
  await registrarAuditoria("Excluir Usuário (Soft Delete)", { id });
};
