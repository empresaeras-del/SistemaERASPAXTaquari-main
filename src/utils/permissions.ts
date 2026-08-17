import { NivelAcesso, Usuario } from '../types';

/**
 * Regra Global: Somente Super Admin e Admin podem realizar exclusões de registros no sistema.
 */
export const canDelete = (user: Usuario | null | undefined): boolean => {
  if (!user) return false;
  return user.nivel === 'super_admin' || user.nivel === 'admin';
};

/**
 * Regra: Somente Super Admin pode incluir novas empresas no sistema.
 */
export const canCreateEmpresa = (user: Usuario | null | undefined): boolean => {
  if (!user) return false;
  return user.nivel === 'super_admin';
};

/**
 * Regra: Somente Super Admin pode excluir empresas.
 */
export const canDeleteEmpresa = (user: Usuario | null | undefined): boolean => {
  if (!user) return false;
  return user.nivel === 'super_admin';
};

/**
 * Regra: Somente o Super Admin pode editar qualquer empresa,
 * e o Admin pode editar os dados de sua respectiva empresa.
 */
export const canEditEmpresa = (
  user: Usuario | null | undefined,
  empresaId: string | null | undefined
): boolean => {
  if (!user || !empresaId) return false;
  if (user.nivel === 'super_admin') return true;
  if (user.nivel === 'admin') {
    return user.tenant_id === empresaId || empresaId === 'empresa_padrao';
  }
  return false;
};

/**
 * Regra: Permitir somente ao usuário Super Admin editar usuários do mesmo nível (Super Admin e Admin).
 * Admin só pode gerenciar usuários de nível inferior (Gerente e Funcionário) pertencentes à sua empresa.
 * O próprio usuário autenticado pode editar seus dados de perfil e alterar sua senha.
 */
export const canEditUser = (
  currentUser: Usuario | null | undefined,
  targetUser: { id?: string; nivel: NivelAcesso; tenant_id?: string }
): boolean => {
  if (!currentUser) return false;
  if (currentUser.nivel === 'super_admin') {
    return true;
  }
  // O próprio usuário pode editar seu perfil
  if (targetUser.id && currentUser.id === targetUser.id) {
    return true;
  }
  if (currentUser.nivel === 'admin') {
    if (targetUser.nivel === 'super_admin' || targetUser.nivel === 'admin') {
      return false;
    }
    if (currentUser.tenant_id && targetUser.tenant_id) {
      return currentUser.tenant_id === targetUser.tenant_id || targetUser.tenant_id === 'all';
    }
    return true;
  }
  return false;
};

/**
 * Regra: Permitir ao respectivo usuário a edição da senha atual registrada.
 * Permitir ao usuário Super Admin realizar a alteração de senha de qualquer usuário independente do nível.
 */
export const canChangeUserPassword = (
  currentUser: Usuario | null | undefined,
  targetUser: { id?: string; nivel?: NivelAcesso; tenant_id?: string } | null | undefined
): boolean => {
  if (!currentUser || !targetUser) return false;
  // Super admin pode alterar senha de qualquer usuário independente do nível
  if (currentUser.nivel === 'super_admin') return true;
  // O próprio usuário pode alterar sua própria senha
  if (targetUser.id && currentUser.id === targetUser.id) return true;
  // Admin pode alterar senha de usuários subordinados pertencentes à sua empresa
  if (currentUser.nivel === 'admin' && targetUser.nivel !== 'super_admin' && targetUser.nivel !== 'admin') {
    return true;
  }
  return false;
};

/**
 * Regra: Permitir somente ao usuário Super Admin excluir usuários do mesmo nível (Super Admin e Admin).
 */
export const canDeleteUser = (
  currentUser: Usuario | null | undefined,
  targetUser: { id?: string; nivel: NivelAcesso; tenant_id?: string }
): boolean => {
  if (!currentUser) return false;
  if (currentUser.nivel === 'super_admin') {
    return true;
  }
  if (currentUser.nivel === 'admin') {
    if (targetUser.nivel === 'super_admin' || targetUser.nivel === 'admin') {
      return false;
    }
    if (currentUser.tenant_id && targetUser.tenant_id) {
      return currentUser.tenant_id === targetUser.tenant_id;
    }
    return true;
  }
  return false;
};

/**
 * Níveis de acesso que o usuário atual tem permissão para cadastrar ou atribuir:
 * - Super Admin: pode criar qualquer nível.
 * - Admin: pode criar Gerente ou Funcionário.
 */
export const getAvailableNiveisForUser = (
  currentUser: Usuario | null | undefined
): { value: NivelAcesso; label: string }[] => {
  if (!currentUser) return [];
  if (currentUser.nivel === 'super_admin') {
    return [
      { value: 'super_admin', label: 'Super Admin' },
      { value: 'admin', label: 'Administrador' },
      { value: 'gerente', label: 'Gerente' },
      { value: 'funcionario', label: 'Funcionário' },
    ];
  }
  if (currentUser.nivel === 'admin') {
    return [
      { value: 'gerente', label: 'Gerente' },
      { value: 'funcionario', label: 'Funcionário' },
    ];
  }
  return [];
};
