/**
 * Quem enxerga quais logs da Ata de Ocorrências.
 *
 * ## Por que isto é uma função pura, e não um `if` dentro do service
 *
 * A regra tem duas metades que se parecem e não são:
 *
 * - **super_admin vê tudo**, de todas as empresas e de todos os usuários. A empresa
 *   escolhida no topo da tela é um *filtro opcional* dele — quando não há empresa
 *   escolhida (`'all'`), o escopo é global de verdade.
 * - **Os demais níveis veem a própria empresa inteira** — todos os usuários dela, não só
 *   as próprias ações. E, ao contrário do super_admin, **a seleção de empresa da tela não
 *   os alarga**: o escopo vem do `tenant_id` do usuário, não do seletor.
 *
 * Essa segunda parte é o motivo de a decisão não poder morar no seletor. Hoje o
 * `AppContext` força `empresaSelecionada = user.tenant_id` para quem não é super_admin,
 * então usar o seletor dá o resultado certo **por acidente** — e passaria a dar o errado
 * no dia em que alguém mexesse naquele `if`. A guarda de verdade é a RLS
 * (`has_tenant_access`); esta função existe para a tela pedir exatamente o que tem
 * direito, em vez de pedir demais e depender de o banco aparar.
 *
 * Ver `services/auditoriaService.ts` e a seção da Ata de Ocorrências no CLAUDE.md.
 */
import { ehTenantUtilizavel, TENANT_SEM_FILTRO } from './tenant';

export const NIVEL_VISAO_GLOBAL = 'super_admin';

export type EscopoAuditoria =
  /** Sem filtro de empresa: todos os logs de todas as empresas. Só super_admin. */
  | { tipo: 'global' }
  /** Uma empresa: todos os logs de todos os usuários dela. */
  | { tipo: 'empresa'; tenantId: string }
  /** Não dá para determinar a empresa — a tela não deve inventar uma. */
  | { tipo: 'indefinido'; motivo: string };

export const MENSAGEM_ESCOPO_INDEFINIDO =
  'Não foi possível determinar a empresa do seu usuário, então nenhum log pode ser listado com segurança.';

export interface UsuarioDoEscopo {
  nivel?: string | null;
  tenant_id?: string | null;
}

/**
 * Decide o escopo a partir do usuário logado e da empresa escolhida no topo da tela.
 *
 * `empresaSelecionada` só é considerada para o super_admin, e só como estreitamento.
 */
export const escopoDaAuditoria = (
  usuario: UsuarioDoEscopo | null | undefined,
  empresaSelecionada?: string | null,
): EscopoAuditoria => {
  const nivel = (usuario?.nivel ?? '').trim();

  if (nivel === NIVEL_VISAO_GLOBAL) {
    // O seletor estreita a visão global, nunca a substitui: sem empresa utilizável
    // escolhida (inclusive o sentinela 'all'), o super_admin vê tudo.
    return ehTenantUtilizavel(empresaSelecionada)
      ? { tipo: 'empresa', tenantId: (empresaSelecionada as string).trim() }
      : { tipo: 'global' };
  }

  // Demais níveis: a empresa vem do usuário, e o seletor não a alarga nem a troca.
  if (ehTenantUtilizavel(usuario?.tenant_id)) {
    return { tipo: 'empresa', tenantId: (usuario!.tenant_id as string).trim() };
  }

  return { tipo: 'indefinido', motivo: MENSAGEM_ESCOPO_INDEFINIDO };
};

/**
 * O valor que os services deste projeto esperam como `tenantId`: `'all'` significa
 * "sem filtro". Devolve `null` quando o escopo é indefinido — o chamador deve recusar a
 * listagem em vez de cair no `'all'`, que aqui seria o oposto do pretendido.
 */
export const tenantDoEscopo = (escopo: EscopoAuditoria): string | null => {
  if (escopo.tipo === 'global') return TENANT_SEM_FILTRO;
  if (escopo.tipo === 'empresa') return escopo.tenantId;
  return null;
};

/** Rótulo curto para o cabeçalho da tela. */
export const rotuloDoEscopo = (escopo: EscopoAuditoria): string => {
  if (escopo.tipo === 'global') return 'VISÃO GLOBAL';
  if (escopo.tipo === 'empresa') return 'EMPRESA';
  return 'SEM ESCOPO';
};
