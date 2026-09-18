import { supabase, isolatedSupabase, registrarAuditoria } from '../lib/supabase';
import {
  CadastroDeUsuario,
  TITULO_AVISO_CADASTROS_INCOMPLETOS,
} from '../utils/cadastrosIncompletos';
import { avisoJaEnviado } from './notificacoesService';

/**
 * Acesso aos cadastros de usuário pela metade.
 *
 * A leitura é a RPC `listar_cadastros_incompletos()` (migration `20260914141704`), que é
 * `SECURITY DEFINER` porque `auth.users` não é legível por `authenticated` — é lá que ficam
 * `email_confirmed_at`, `last_sign_in_at` e o metadata do convite. A própria função decide
 * o escopo: tudo para super_admin, a empresa para admin, nada para os demais níveis.
 */

/**
 * Os cadastros incompletos que este usuário pode ver.
 *
 * **Não segue o padrão offline-first, de propósito.** Guardar isso no IndexedDB seria
 * espalhar e-mails e níveis de acesso por cada navegador, e o cache velho diria "há 2
 * cadastros pendentes" depois de os dois terem sido resolvidos — um aviso errado é pior que
 * nenhum. Offline, a resposta honesta é "não sei": lista vazia, nenhum aviso.
 */
export const getCadastrosIncompletos = async (
  isOnline: boolean,
): Promise<CadastroDeUsuario[]> => {
  if (!isOnline) return [];
  const { data, error } = await supabase.rpc('listar_cadastros_incompletos');
  if (error) throw error;
  return (data || []) as CadastroDeUsuario[];
};

/**
 * Reenvia o e-mail de confirmação do convite.
 *
 * `resend` é do GoTrue e vale com a chave pública — não precisa de `service_role`, então o
 * próprio admin resolve isso da tela, sem passar por painel nenhum. Usa o cliente isolado
 * pelo mesmo motivo que `saveUsuario` usa no `signUp`: nada aqui pode encostar na sessão de
 * quem está logado.
 *
 * A recusa do servidor **sobe**. Um "reenviado com sucesso" sobre um limite de envio
 * estourado ou um e-mail já confirmado é a mesma perda silenciosa que este projeto já
 * documenta em `saveAtendimento`: o admin marcaria a pendência como resolvida e ela
 * continuaria lá.
 */
export const reenviarConfirmacaoDeEmail = async (email: string): Promise<void> => {
  const destino = (email || '').trim().toLowerCase();
  if (!destino) throw new Error('Cadastro sem e-mail: não há para onde reenviar a confirmação.');

  const { error } = await isolatedSupabase.auth.resend({ type: 'signup', email: destino });
  if (error) throw new Error(error.message || 'Não foi possível reenviar a confirmação.');

  try {
    await registrarAuditoria('Reenviar Confirmação de Cadastro', { email: destino });
  } catch (e) {
    console.warn('Falha ao registrar auditoria do reenvio de confirmação:', e);
  }
};

/**
 * Cria o perfil que faltava para um cadastro que já autentica.
 *
 * Os dados vêm do `raw_user_meta_data` do convite, que a RPC já devolveu: é o único lugar
 * onde a intenção de quem cadastrou sobreviveu, e escolher nível ou empresa por conta
 * própria transformaria um reparo numa decisão de acesso.
 *
 * `created_at` recebe a data em que a credencial nasceu, não `now()` — a linha não deve
 * afirmar que o cadastro é de hoje quando a pessoa já autenticava há semanas.
 */
export const criarPerfilDoCadastro = async (cadastro: CadastroDeUsuario): Promise<void> => {
  if (!cadastro?.usuario_id) throw new Error('Cadastro sem identificador.');
  if (!cadastro.tenant_id) {
    throw new Error(
      'O convite deste usuário não registrou a empresa. Defina a empresa antes de criar o perfil.',
    );
  }

  const { error } = await supabase.from('users').insert({
    id: cadastro.usuario_id,
    tenant_id: cadastro.tenant_id,
    empresa_id: cadastro.tenant_id,
    nome: (cadastro.nome || cadastro.email || '').trim(),
    email: (cadastro.email || '').trim().toLowerCase(),
    nivel: cadastro.nivel || 'funcionario',
    modulos_permitidos: ['*'],
    status: 'ativo',
    created_at: cadastro.criado_em || new Date().toISOString(),
  });
  if (error) throw new Error(error.message || 'Não foi possível criar o perfil de acesso.');

  await registrarAuditoria('Criar Perfil de Acesso Ausente', {
    id: cadastro.usuario_id,
    email: cadastro.email,
    nivel: cadastro.nivel || 'funcionario',
    tenant_id: cadastro.tenant_id,
  });
};

/**
 * Este aviso, com este conteúdo, já foi dado a este admin?
 *
 * Fina camada sobre `avisoJaEnviado`, que é onde a regra mora e está documentada — os dois
 * avisos deste projeto (cadastros pela metade e parcelas vencidas) fazem a mesma pergunta,
 * e ela é respondida num lugar só. O que esta função acrescenta é fixar o título do
 * assunto, para o chamador não poder errá-lo.
 */
export const avisoDeCadastrosJaEnviado = async (
  isOnline: boolean,
  usuarioId: string,
  mensagem: string,
): Promise<boolean> =>
  avisoJaEnviado(isOnline, usuarioId, TITULO_AVISO_CADASTROS_INCOMPLETOS, mensagem);
