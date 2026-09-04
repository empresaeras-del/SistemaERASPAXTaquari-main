import { UsuarioCadastro } from '../services/usuariosService';
import { getAllModuleAndSubmoduleIds } from './permissions';

/**
 * Funções puras extraídas de pages/Configuracoes.tsx — comportamento idêntico
 * ao original, só relocadas para poder ser testadas isoladamente sem montar
 * o componente. Ver CLAUDE.md, seção "God components".
 */

export interface FiltrosUsuarios {
  searchTerm: string;
  statusFilter: 'todos' | 'ativo' | 'inativo';
  tenantFilter: string;
}

/** Filtra usuários por nome/e-mail, status e empresa (tenant). */
export const filtrarUsuarios = (
  usuarios: UsuarioCadastro[],
  { searchTerm, statusFilter, tenantFilter }: FiltrosUsuarios
): UsuarioCadastro[] => {
  return usuarios.filter((u) => {
    if (!u) return false;
    const matchName =
      (u.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || u.status === statusFilter;
    const matchTenant = tenantFilter === 'all' || u.tenant_id === tenantFilter;
    return matchName && matchStatus && matchTenant;
  });
};

/**
 * Formata agência/conta bancária: só dígitos, hífen e X/x (dígito
 * verificador), sempre em maiúsculas. Mesma regra para os dois campos no
 * original — unificada aqui para não manter duas cópias idênticas.
 */
export const formatAgenciaOuConta = (value: string): string => {
  return value.replace(/[^0-9-Xx]/g, '').toUpperCase();
};

/**
 * Normaliza a lista de módulos permitidos de um usuário para edição: um
 * usuário com "todos os módulos" é armazenado como `['*']` ou lista vazia,
 * mas o seletor de permissões precisa da lista completa e explícita para
 * marcar todas as caixas.
 */
export const normalizeModulos = (mods?: string[]): string[] => {
  if (!mods || mods.length === 0 || mods.includes('*')) {
    return getAllModuleAndSubmoduleIds();
  }
  return mods;
};

/**
 * Decide como persistir os módulos permitidos de um usuário ao salvar:
 * `super_admin` sempre grava `['*']`; qualquer outro nível grava `['*']`
 * somente se selecionou explicitamente todos os módulos/submódulos
 * disponíveis (evita salvar uma lista enorme quando "selecionar tudo" foi
 * escolhido, e mantém `['*']` funcionando como sinônimo de "acesso total"
 * mesmo se a lista de módulos do sistema crescer depois).
 */
export const normalizarModulosParaSalvar = (
  nivel: string | undefined,
  modulosPermitidos: string[] | undefined
): string[] => {
  const permitidos = modulosPermitidos || [];
  const allSubmoduleIds = getAllModuleAndSubmoduleIds();
  const isAllSelected = permitidos.includes('*') || permitidos.length >= allSubmoduleIds.length;

  return (isAllSelected || nivel === 'super_admin') ? ['*'] : permitidos;
};
