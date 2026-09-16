import { createClient } from '@supabase/supabase-js';
import { supabase, isolatedSupabase, registrarAuditoria } from "../lib/supabase";
import {
  getFromIDB,
  saveToIDB,
  getAllFromIDB,
  deleteFromIDB,
} from "../lib/idb";
import { NivelAcesso, Usuario } from "../types";
import { canChangeUserPassword } from "../utils/permissions";
import {
  validarTrocaDeSenha,
  MENSAGEM_SENHA_CURTA,
  MENSAGEM_SENHA_IGUAL_A_ATUAL,
  TrocaDeSenha
} from "../utils/senhaUsuario";

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
      let query = supabase.from("users").select("*").is("deleted_at", null);
      if (tenantId && tenantId !== "all") {
        query = query.eq("tenant_id", tenantId);
      }
      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        for (const item of data) {
          const sanitizedItem: UsuarioCadastro = {
            id: item.id,
            tenant_id: item.tenant_id || (item as any).empresa_id || '',
            nome: item.nome || '',
            email: item.email || '',
            nivel: item.nivel || 'funcionario',
            modulos_permitidos: item.modulos_permitidos || ['*'],
            status: item.status || 'ativo',
            created_at: item.created_at,
            deleted_at: item.deleted_at
          };
          await saveToIDB(STORE_NAME, sanitizedItem);
        }
      }
      usuarios = (data || []).map(item => ({
        ...item,
        tenant_id: item.tenant_id || (item as any).empresa_id || ''
      }));
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

  const existing = usuario.id ? await getFromIDB<UsuarioCadastro>(STORE_NAME, usuario.id) : null;
  const isNew = !existing && Boolean(password);

  let finalUserId = usuario.id;

  if (isNew && password) {
    // 1. Cria a conta de autenticação no Supabase Auth usando cliente isolado (não desloga o admin)
    const { data: authData, error: authError } = await isolatedSupabase.auth.signUp({
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

    // A MESMA pergunta que a tela faz para mostrar o campo, feita aqui no ponto de
    // escrita. Sem esta recusa explícita, quem não tem direito cairia fora dos dois
    // ramos abaixo e a senha seria **descartada em silêncio**: o save terminaria com
    // "usuário salvo com sucesso" e a senha continuaria a antiga. É a armadilha do
    // PGRST204 que o CLAUDE.md documenta, por outro caminho.
    if (!canChangeUserPassword(currentUser as Usuario, usuario, isOnline)) {
      throw new Error(MENSAGEM_SENHA_SEM_PERMISSAO);
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
    } else {
      // Caso B: super_admin redefinindo a senha de outro usuário, via RPC com
      // search_path seguro. A RPC aplica a mesma regra do lado do servidor — é ela
      // quem de fato decide, e o guard acima existe para a recusa chegar antes com
      // uma mensagem que explica o motivo.
      const { error: rpcError } = await supabase.rpc('admin_alterar_senha_usuario', {
        target_user_id: usuario.id,
        new_password: cleanPassword
      });

      if (rpcError) {
        console.error("RPC admin_alterar_senha_usuario erro:", rpcError);
        throw new Error(`Erro ao alterar senha do usuário: ${rpcError.message}`);
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
    empresa_id: usuarioToSave.tenant_id,
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


export const MENSAGEM_SENHA_SEM_PERMISSAO =
  'Apenas o Super Administrador redefine a senha de outro usuário. O próprio usuário pode ' +
  'trocar a dele pelo menu do topo, em "Alterar minha senha".';

export const MENSAGEM_SENHA_SEM_CONEXAO =
  'Sem conexão. A troca de senha só vale quando chega ao servidor — tente novamente online.';
export const MENSAGEM_SENHA_ATUAL_INCORRETA = 'A senha atual não confere.';
export const MENSAGEM_SENHA_SEM_EMAIL =
  'Não foi possível identificar o e-mail da sua conta. Entre novamente e tente de novo.';
export const MENSAGEM_SENHA_MUITAS_TENTATIVAS =
  'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
export const MENSAGEM_SENHA_SESSAO_EXPIRADA =
  'Sua sessão expirou. Entre novamente para trocar a senha.';

const traduzirErroDeTrocaDeSenha = (mensagem: string): string => {
  if (/Password should be at least/i.test(mensagem)) return MENSAGEM_SENHA_CURTA;
  if (/should be different from the old password/i.test(mensagem)) {
    return MENSAGEM_SENHA_IGUAL_A_ATUAL;
  }
  if (/pwned|leaked|weak/i.test(mensagem)) {
    return 'Esta senha aparece em vazamentos conhecidos. Escolha outra.';
  }
  if (/Auth session missing|JWT expired|invalid claim/i.test(mensagem)) {
    return MENSAGEM_SENHA_SESSAO_EXPIRADA;
  }
  if (/Too many requests|rate limit/i.test(mensagem)) {
    return MENSAGEM_SENHA_MUITAS_TENTATIVAS;
  }
  return `Não foi possível alterar a senha: ${mensagem}`;
};

/**
 * Troca a senha do usuário que está logado, conferindo antes a senha atual.
 *
 * Por que conferir, se `supabase.auth.updateUser({ password })` não exige a senha
 * antiga: sem a conferência, **uma sessão aberta é a única credencial necessária**.
 * Quem sentar na máquina destravada de um operador trocaria a senha dele e o
 * trancaria para fora, sem saber senha nenhuma. A senha atual é o que prova que quem
 * está no teclado é o dono da conta.
 *
 * A conferência usa `isolatedSupabase` — o cliente sem persistência que já existe para
 * chamadas de auth que não podem mexer na sessão viva (é o mesmo usado no cadastro de
 * usuário, para não deslogar o admin). Duas armadilhas ficam fechadas por isso:
 *
 * - Um `signInWithPassword` no cliente principal **substituiria a sessão em uso**.
 * - O `signOut()` do supabase-js tem `scope: 'global'` por PADRÃO, o que revogaria
 *   todas as sessões do usuário — inclusive a que está usando o sistema neste momento,
 *   e as dos outros aparelhos dele. Por isso o `scope: 'local'` explícito abaixo: ele
 *   encerra só a sessão efêmera que a conferência acabou de abrir.
 *
 * A senha vai ao servidor exatamente como foi digitada, sem `trim` — é o que o login
 * envia (ver `AuthContext.signIn`), e aparar aqui gravaria uma senha diferente da que
 * o usuário vai digitar amanhã.
 */
export const alterarPropriaSenha = async (
  parametros: TrocaDeSenha & { email?: string | null },
  isOnline: boolean
): Promise<void> => {
  const { email, senhaAtual, novaSenha, confirmacao } = parametros;

  const validacao = validarTrocaDeSenha({ senhaAtual, novaSenha, confirmacao });
  if (!validacao.ok) throw new Error(validacao.mensagem);

  // Não entra na fila de sync de propósito: uma troca de senha enfileirada ficaria
  // pendente sem ninguém saber, e o usuário sairia daqui achando que a senha mudou.
  if (!isOnline) throw new Error(MENSAGEM_SENHA_SEM_CONEXAO);

  const emailDaConta = (email || '').trim();
  if (!emailDaConta) throw new Error(MENSAGEM_SENHA_SEM_EMAIL);

  const { error: erroConferencia } = await isolatedSupabase.auth.signInWithPassword({
    email: emailDaConta,
    password: senhaAtual
  });

  if (erroConferencia) {
    if (/Invalid login credentials/i.test(erroConferencia.message)) {
      throw new Error(MENSAGEM_SENHA_ATUAL_INCORRETA);
    }
    if (/Too many requests|rate limit/i.test(erroConferencia.message)) {
      throw new Error(MENSAGEM_SENHA_MUITAS_TENTATIVAS);
    }
    throw new Error(`Não foi possível conferir a senha atual: ${erroConferencia.message}`);
  }

  try {
    await isolatedSupabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    // Falhar ao descartar a sessão efêmera não é motivo para não trocar a senha.
    console.warn('Não foi possível encerrar a sessão de conferência:', e);
  }

  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) {
    throw new Error(traduzirErroDeTrocaDeSenha(error.message || 'erro do servidor'));
  }

  // A senha NUNCA entra no log — nem a antiga, nem a nova, nem o tamanho delas.
  await registrarAuditoria('Alterar Própria Senha', {
    email: emailDaConta,
    origem: 'menu do usuário'
  });
};
