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

export const getUsuarios = async (
  isOnline: boolean,
  tenantId?: string | null,
): Promise<UsuarioCadastro[]> => {
  let usuarios: UsuarioCadastro[] = [];

  if (isOnline) {
    try {
      let query = supabase.from("users").select("*").eq("deleted_at", null);
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
        "Supabase fetch failed (likely not configured), falling back to IDB.",
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
): Promise<void> => {
  if (!isOnline) {
    throw new Error("Não é possível salvar enquanto estiver offline.");
  }

  // Ensure ID doesn't conflict or is missing. Real auth will replace this eventually.
  try {
    const { error } = await supabase.from("users").upsert(usuario);
    if (error) {
      console.warn("Supabase save failed, proceeding with IDB only.", error);
    }
  } catch (err) {
    console.warn("Supabase save threw error, proceeding with IDB only.", err);
  }

  await saveToIDB(STORE_NAME, usuario);
  await registrarAuditoria("Salvar Usuário", {
    id: usuario.id,
    email: usuario.email,
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
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.warn(
      "Supabase delete failed (likely not configured), proceeding with IDB only.",
    );
  }

  const user = await getFromIDB<UsuarioCadastro>(STORE_NAME, id);
  if (user) {
    user.deleted_at = new Date().toISOString();
    await saveToIDB(STORE_NAME, user);
  }
  await registrarAuditoria("Excluir Usuário (Soft Delete)", { id });
};
