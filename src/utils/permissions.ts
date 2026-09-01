import { NivelAcesso, Usuario } from '../types';
import { systemAlert } from './systemAlert';

export interface SubModuloInfo {
  id: string;
  label: string;
  descricao: string;
  tipo?: 'formulario' | 'lista' | 'operacional' | 'gestao' | 'relatorio';
  paths: string[];
}

export interface ModuloInfo {
  id: string;
  label: string;
  descricao: string;
  categoria: string;
  iconName: string;
  paths: string[];
  subModulos: SubModuloInfo[];
}

export const MODULOS_SISTEMA: ModuloInfo[] = [
  {
    id: 'dashboard',
    label: 'Dashboard & Indicadores',
    descricao: 'Indicadores, gráficos, atalhos rápidos e visão geral do sistema',
    categoria: 'Visão Geral',
    iconName: 'LayoutDashboard',
    paths: ['/'],
    subModulos: [
      {
        id: 'dashboard_metricas',
        label: 'Visão Geral & Indicadores',
        descricao: 'Acesso ao painel executivo com métricas, gráficos e atalhos rápidos',
        tipo: 'gestao',
        paths: ['/']
      }
    ]
  },
  {
    id: 'associados',
    label: 'Associados & Contratos',
    descricao: 'Lista de associados, cadastros, dependentes, atendimentos, contratos e guias',
    categoria: 'Atendimento & Vendas',
    iconName: 'Users',
    paths: ['/associados', '/contratos', '/atendimentos', '/requisicoes'],
    subModulos: [
      {
        id: 'associados_lista',
        label: 'Lista & Cadastro de Associados',
        descricao: 'Formulário de novo associado, edição, titulares, dependentes e carteirinhas',
        tipo: 'formulario',
        paths: ['/associados']
      },
      {
        id: 'associados_atendimentos',
        label: 'Atendimentos & Ocorrências',
        descricao: 'Formulário de registro de atendimentos, histórico de contatos e solicitações',
        tipo: 'formulario',
        paths: ['/atendimentos']
      },
      {
        id: 'associados_contratos',
        label: 'Gestão de Contratos PAX',
        descricao: 'Visualização, emissão, assinatura e controle de vigência dos contratos',
        tipo: 'gestao',
        paths: ['/contratos']
      },
      {
        id: 'associados_requisicoes',
        label: 'Requisições & Emissão de Guias',
        descricao: 'Formulário de emissão de guias médicas/odontológicas e requisições',
        tipo: 'formulario',
        paths: ['/requisicoes']
      }
    ]
  },
  {
    id: 'financeiro',
    label: 'Financeiro & Caixas',
    descricao: 'Contas a receber, contas a pagar, conciliação bancária e fluxo de caixa',
    categoria: 'Controladoria & Finanças',
    iconName: 'DollarSign',
    paths: ['/financeiro/contas-a-receber', '/financeiro/contas-a-pagar', '/caixas', '/financeiro/caixas', '/financeiro'],
    subModulos: [
      {
        id: 'financeiro_receber',
        label: 'Contas a Receber',
        descricao: 'Mensalidades, parcelas a receber, quitações, geração de carnês e recibos',
        tipo: 'formulario',
        paths: ['/financeiro/contas-a-receber', '/financeiro/contas-a-receber/nova', '/financeiro/contas-a-receber/:id/editar']
      },
      {
        id: 'financeiro_pagar',
        label: 'Contas a Pagar',
        descricao: 'Formulário de novas despesas, pagamentos a fornecedores e baixas de títulos',
        tipo: 'formulario',
        paths: ['/financeiro/contas-a-pagar', '/financeiro/contas-a-pagar/nova', '/financeiro/contas-a-pagar/:id/editar']
      },
      {
        id: 'financeiro_caixas',
        label: 'Caixas & Fluxo de Caixa',
        descricao: 'Abertura, fechamento de caixa, sangrias, suprimentos e histórico de movimentações',
        tipo: 'operacional',
        paths: ['/caixas', '/financeiro/caixas']
      }
    ]
  },
  {
    id: 'planos',
    label: 'Planos Pax',
    descricao: 'Planos funerários, coberturas, regras de contratação e faixas de preço',
    categoria: 'Produtos & Serviços',
    iconName: 'Package',
    paths: ['/planos'],
    subModulos: [
      {
        id: 'planos_gestao',
        label: 'Planos & Coberturas PAX',
        descricao: 'Cadastro e edição de planos, faixas etárias, carências e coberturas adicionais',
        tipo: 'formulario',
        paths: ['/planos']
      }
    ]
  },
  {
    id: 'itens_funerarios',
    label: 'Itens Funerários / Estoque',
    descricao: 'Estoque, catálogo de urnas, artigos funerários e movimentações',
    categoria: 'Operações Funerárias',
    iconName: 'Package',
    paths: ['/itens-funerarios'],
    subModulos: [
      {
        id: 'itens_estoque',
        label: 'Catálogo de Urnas & Estoque',
        descricao: 'Cadastro de urnas, ornamentações, coroas, controle de entradas/saídas e saldo',
        tipo: 'operacional',
        paths: ['/itens-funerarios']
      }
    ]
  },
  {
    id: 'credenciados',
    label: 'Rede Credenciada',
    descricao: 'Prestadores de saúde, tabela de procedimentos e faturamento de remessas',
    categoria: 'Rede de Convênios',
    iconName: 'Building2',
    paths: ['/credenciados', '/procedimentos', '/faturamentos'],
    subModulos: [
      {
        id: 'credenciados_prestadores',
        label: 'Prestadores & Clínicas Credenciadas',
        descricao: 'Formulário de cadastro de médicos, clínicas, laboratórios e especialidades',
        tipo: 'formulario',
        paths: ['/credenciados']
      },
      {
        id: 'credenciados_procedimentos',
        label: 'Procedimentos & Tabela de Exames',
        descricao: 'Tabela de preços, exames, consultas e descontos aos associados',
        tipo: 'formulario',
        paths: ['/procedimentos']
      },
      {
        id: 'credenciados_faturamentos',
        label: 'Faturamento de Remessas',
        descricao: 'Conciliação de guias, lotes de faturamento e fechamento com prestadores',
        tipo: 'gestao',
        paths: ['/faturamentos']
      }
    ]
  },
  {
    id: 'administracao',
    label: 'Administração & Parceiros',
    descricao: 'Fornecedores, parceiros comerciais e prestadores administrativos',
    categoria: 'Administrativo',
    iconName: 'Briefcase',
    paths: ['/fornecedores'],
    subModulos: [
      {
        id: 'administracao_fornecedores',
        label: 'Fornecedores & Parceiros',
        descricao: 'Cadastro e gestão de empresas parceiras, fornecedores de insumos e frotas',
        tipo: 'formulario',
        paths: ['/fornecedores']
      }
    ]
  },
  {
    id: 'auditoria',
    label: 'Ata de Ocorrências / Auditoria',
    descricao: 'Logs de auditoria, registros de segurança e rastreabilidade de ações',
    categoria: 'Governança & Segurança',
    iconName: 'ShieldAlert',
    paths: ['/auditoria'],
    subModulos: [
      {
        id: 'auditoria_logs',
        label: 'Ata de Ocorrências & Auditoria',
        descricao: 'Visualização cronológica de eventos, cadastros, alterações e exclusões',
        tipo: 'relatorio',
        paths: ['/auditoria']
      }
    ]
  },
  {
    id: 'configuracoes',
    label: 'Configurações & Documentos',
    descricao: 'Configurações gerais, cadastro de empresas/usuários e documentos padrões',
    categoria: 'Sistema & Parâmetros',
    iconName: 'Settings',
    paths: ['/configuracoes', '/documentos'],
    subModulos: [
      {
        id: 'configuracoes_geral',
        label: 'Configurações Gerais, Empresas & Usuários',
        descricao: 'Gerenciamento de empresas, usuários, segurança de sessão e backup',
        tipo: 'gestao',
        paths: ['/configuracoes']
      },
      {
        id: 'configuracoes_documentos',
        label: 'Documentos Padrões & Minutas',
        descricao: 'Editor de modelos, minutas de contrato, declarações e layouts de impressão',
        tipo: 'formulario',
        paths: ['/documentos']
      }
    ]
  },
  {
    id: 'tutorial',
    label: 'Tutorial & Guia do Sistema',
    descricao: 'Guia completo de orientação, manuais operacionais, passo a passo e FAQ',
    categoria: 'Orientação & Treinamento',
    iconName: 'GraduationCap',
    paths: ['/tutorial'],
    subModulos: [
      {
        id: 'tutorial_guia',
        label: 'Guia Interativo & Manuais',
        descricao: 'Acesso a todos os manuais operacionais e tutoriais passo a passo do sistema',
        tipo: 'operacional',
        paths: ['/tutorial']
      }
    ]
  }
];

export interface PerfilPermissaoPreset {
  id: string;
  nome: string;
  descricao: string;
  modulos: string[];
}

export const PERFIS_PERMISSAO_PRESETS: PerfilPermissaoPreset[] = [
  {
    id: 'completo',
    nome: 'Acesso Completo',
    descricao: 'Todos os módulos e submódulos do sistema',
    modulos: ['*']
  },
  {
    id: 'atendimento_vendas',
    nome: 'Atendimento & Adesões PAX',
    descricao: 'Associados, atendimentos, contratos, planos e emissão de guias',
    modulos: ['dashboard', 'dashboard_metricas', 'associados', 'associados_lista', 'associados_atendimentos', 'associados_contratos', 'associados_requisicoes', 'planos', 'planos_gestao', 'tutorial', 'tutorial_guia']
  },
  {
    id: 'financeiro_caixas',
    nome: 'Operador Financeiro & Caixa',
    descricao: 'Contas a receber, contas a pagar, movimentação de caixas e faturamento',
    modulos: ['dashboard', 'dashboard_metricas', 'financeiro', 'financeiro_receber', 'financeiro_pagar', 'financeiro_caixas', 'credenciados', 'credenciados_faturamentos', 'tutorial', 'tutorial_guia']
  },
  {
    id: 'funeraria_estoque',
    nome: 'Operações Funerárias & Estoque',
    descricao: 'Atendimentos, itens funerários, urnas e fornecedores',
    modulos: ['dashboard', 'dashboard_metricas', 'associados', 'associados_atendimentos', 'itens_funerarios', 'itens_estoque', 'administracao', 'administracao_fornecedores', 'tutorial', 'tutorial_guia']
  },
  {
    id: 'convenios_saude',
    nome: 'Gestão de Convênios & Rede Credenciada',
    descricao: 'Prestadores, procedimentos, exames, guias e faturamento',
    modulos: ['dashboard', 'dashboard_metricas', 'associados', 'associados_requisicoes', 'credenciados', 'credenciados_prestadores', 'credenciados_procedimentos', 'credenciados_faturamentos', 'tutorial', 'tutorial_guia']
  }
];

/**
 * Retorna todos os IDs válidos de módulos e submódulos do sistema.
 */
export const getAllModuleAndSubmoduleIds = (): string[] => {
  const ids: string[] = [];
  MODULOS_SISTEMA.forEach(m => {
    ids.push(m.id);
    m.subModulos.forEach(s => {
      ids.push(s.id);
    });
  });
  return ids;
};

/**
 * Retorna os IDs de sub-módulos pertencentes a um módulo principal.
 */
export const getSubmoduleIdsForModule = (moduleId: string): string[] => {
  const mod = MODULOS_SISTEMA.find(m => m.id === moduleId);
  return mod ? mod.subModulos.map(s => s.id) : [];
};

/**
 * Retorna o ID do módulo principal que contém um determinado sub-módulo.
 */
export const getParentModuleId = (subModuleId: string): string | null => {
  for (const mod of MODULOS_SISTEMA) {
    if (mod.id === subModuleId) return mod.id;
    if (mod.subModulos.some(s => s.id === subModuleId)) {
      return mod.id;
    }
  }
  return null;
};

/**
 * Verifica se um usuário possui acesso a um módulo, sub-módulo específico ou rota.
 * Regra estrita: Para rotas e submódulos específicos, o sub.id DEVE estar explicitamente
 * na lista de modulos_permitidos (ou o usuário ser super_admin / ter '*').
 * O fato de o módulo pai estar presente NÃO concede acesso a submódulos não marcados.
 */
export const hasModuleAccess = (
  user: Usuario | null | undefined,
  moduleIdOrPath: string
): boolean => {
  if (!user) return false;
  // Super Admin tem acesso irrestrito a todos os módulos
  if (user.nivel === 'super_admin') return true;

  // 1. Limpa parâmetros de URL ou hashes caso seja uma rota
  const cleanPath = moduleIdOrPath.split('?')[0].split('#')[0];

  // O Módulo de Tutorial é de orientação geral e é sempre liberado para qualquer usuário autenticado
  if (cleanPath === '/tutorial' || moduleIdOrPath === 'tutorial' || moduleIdOrPath === 'tutorial_guia') {
    return true;
  }

  const permitidos = user.modulos_permitidos || [];
  if (permitidos.includes('*')) return true;

  // 2. Se for uma verificação por ROTA / PATH (ex: '/financeiro/contas-a-pagar', '/associados', '/requisicoes'):
  // Primeiro verificamos se esta rota pertence a um SUB-MÓDULO mapeado
  let matchedSubModulo: SubModuloInfo | null = null;

  for (const m of MODULOS_SISTEMA) {
    for (const sub of m.subModulos) {
      const match = sub.paths.some(p => {
        if (p === '/') return cleanPath === '/';
        if (p.includes(':')) {
          const regex = new RegExp('^' + p.replace(/:[a-zA-Z0-9_]+/g, '[^/]+') + '$');
          return regex.test(cleanPath);
        }
        return cleanPath === p || cleanPath.startsWith(p + '/');
      });

      if (match) {
        matchedSubModulo = sub;
        break;
      }
    }
    if (matchedSubModulo) break;
  }

  // Se a rota pertence a um sub-módulo específico:
  // O usuário DEVE ter o ID do sub-módulo explicitamente permitido!
  if (matchedSubModulo) {
    return permitidos.includes(matchedSubModulo.id);
  }

  // Se a rota não pertence a nenhum sub-módulo específico, mas é uma rota genérica do módulo pai (ex: '/financeiro'):
  for (const m of MODULOS_SISTEMA) {
    const parentMatch = m.paths.some(p => {
      if (p === '/') return cleanPath === '/';
      return cleanPath === p || cleanPath.startsWith(p + '/');
    });

    if (parentMatch) {
      // Tem acesso à rota genérica se tiver o módulo pai OU qualquer um de seus submódulos
      return permitidos.includes(m.id) || m.subModulos.some(s => permitidos.includes(s.id));
    }
  }

  // 3. Se moduleIdOrPath for um ID de SUB-MÓDULO direto (ex: 'financeiro_pagar', 'associados_lista'):
  for (const m of MODULOS_SISTEMA) {
    const sub = m.subModulos.find(s => s.id === moduleIdOrPath);
    if (sub) {
      // Checa estritamente se o sub.id está na lista de permitidos
      return permitidos.includes(sub.id);
    }
  }

  // 4. Se moduleIdOrPath for um ID de MÓDULO PAI direto (ex: 'financeiro', 'associados', 'credenciados'):
  const parentMod = MODULOS_SISTEMA.find(m => m.id === moduleIdOrPath);
  if (parentMod) {
    // O módulo pai é permitido se o pai estiver na lista OU qualquer um de seus submódulos estiver ativo
    return permitidos.includes(parentMod.id) || parentMod.subModulos.some(s => permitidos.includes(s.id));
  }

  // 5. Fallback para comparação direta
  return permitidos.includes(moduleIdOrPath);
};

/**
 * Regra: Permitir ao Admin e Super Admin configurar e selecionar os módulos
 * que cada usuário terá acesso no sistema.
 */
export const canManageUserModules = (
  currentUser: Usuario | null | undefined
): boolean => {
  if (!currentUser) return false;
  return currentUser.nivel === 'super_admin' || currentUser.nivel === 'admin';
};

/**
 * Regra: Usuários de nível FUNCIONÁRIO NÃO possuem permissão para realizar EDIÇÕES
 * nos módulos: Financeiro, Planos PAX, Contratos e Atendimentos.
 * Apenas Super Admin, Admin e Gerente podem editar esses registros.
 * Bloqueado automaticamente quando offline.
 */
export const canEditFinanceiro = (user: Usuario | null | undefined, isOnline?: boolean): boolean => {
  if (isOnline === false) return false;
  if (!user) return false;
  return user.nivel === 'super_admin' || user.nivel === 'admin' || user.nivel === 'gerente';
};

export const canEditPlanos = (user: Usuario | null | undefined, isOnline?: boolean): boolean => {
  if (isOnline === false) return false;
  if (!user) return false;
  return user.nivel === 'super_admin' || user.nivel === 'admin' || user.nivel === 'gerente';
};

export const canEditContratos = (user: Usuario | null | undefined, isOnline?: boolean): boolean => {
  if (isOnline === false) return false;
  if (!user) return false;
  return user.nivel === 'super_admin' || user.nivel === 'admin' || user.nivel === 'gerente';
};

export const canEditAtendimentos = (user: Usuario | null | undefined, isOnline?: boolean): boolean => {
  if (isOnline === false) return false;
  if (!user) return false;
  return user.nivel === 'super_admin' || user.nivel === 'admin' || user.nivel === 'gerente';
};

export const canEditModule = (
  moduleName: 'financeiro' | 'planos' | 'contratos' | 'atendimentos',
  user: Usuario | null | undefined,
  isOnline?: boolean
): boolean => {
  switch (moduleName) {
    case 'financeiro': return canEditFinanceiro(user, isOnline);
    case 'planos': return canEditPlanos(user, isOnline);
    case 'contratos': return canEditContratos(user, isOnline);
    case 'atendimentos': return canEditAtendimentos(user, isOnline);
    default: return true;
  }
};

/**
 * Exibe mensagem de alerta padronizada bloqueando edição por falta de permissão.
 */
export const alertPermissionRestriction = (
  moduleName: string,
  action: string = 'realizar edições ou alterações'
) => {
  systemAlert(
    'Acesso Restrito - Permissão Insuficiente',
    `Usuários com nível de acesso Funcionário não possuem permissão para ${action} no módulo de ${moduleName}.\n\nCaso necessite realizar esta operação, solicite a alteração para seu Gerente ou Administrador do sistema.`,
    'warning'
  );
};

/**
 * Regra Global de Conectividade: Quando offline, o sistema opera em Modo de Visualização (Read-Only).
 * Nenhuma inclusão, alteração ou exclusão é permitida sem conexão com a internet.
 */
export const isOfflineReadOnly = (isOnline?: boolean): boolean => {
  return isOnline === false;
};

/**
 * Regra Global: Somente Super Admin e Admin podem realizar exclusões de registros no sistema.
 * Bloqueado automaticamente quando offline.
 */
export const canDelete = (user: Usuario | null | undefined, isOnline?: boolean): boolean => {
  if (isOnline === false) return false;
  if (!user) return false;
  return user.nivel === 'super_admin' || user.nivel === 'admin';
};

/**
 * Regra: Usuários de nível FUNCIONÁRIO NÃO possuem permissão para excluir dependentes.
 * Apenas Super Admin, Admin e Gerente podem excluir dependentes vinculados ao plano.
 * Bloqueado automaticamente quando offline.
 */
export const canDeleteDependente = (user: Usuario | null | undefined, isOnline?: boolean): boolean => {
  if (isOnline === false) return false;
  if (!user) return false;
  return user.nivel === 'super_admin' || user.nivel === 'admin' || user.nivel === 'gerente';
};

/**
 * Regra: Somente Super Admin pode incluir novas empresas no sistema (online).
 */
export const canCreateEmpresa = (user: Usuario | null | undefined, isOnline?: boolean): boolean => {
  if (isOnline === false) return false;
  if (!user) return false;
  return user.nivel === 'super_admin';
};

/**
 * Regra: Somente Super Admin pode excluir empresas (online).
 */
export const canDeleteEmpresa = (user: Usuario | null | undefined, isOnline?: boolean): boolean => {
  if (isOnline === false) return false;
  if (!user) return false;
  return user.nivel === 'super_admin';
};

/**
 * Regra: Somente o Super Admin pode editar qualquer empresa,
 * e o Admin pode editar os dados de sua respectiva empresa (online).
 */
export const canEditEmpresa = (
  user: Usuario | null | undefined,
  empresaId: string | null | undefined,
  isOnline?: boolean
): boolean => {
  if (isOnline === false) return false;
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
 * O próprio usuário autenticado pode editar seus dados de perfil e alterar sua senha (somente online).
 */
export const canEditUser = (
  currentUser: Usuario | null | undefined,
  targetUser: { id?: string; nivel: NivelAcesso; tenant_id?: string },
  isOnline?: boolean
): boolean => {
  if (isOnline === false) return false;
  if (!currentUser) return false;
  if (currentUser.nivel === 'super_admin') {
    return true;
  }
  // O próprio usuário pode editar seu perfil
  if (targetUser.id && currentUser.id === targetUser.id) {
    return true;
  }
  if (currentUser.nivel === 'admin') {
    // Admin NÃO pode editar outros Admins nem Super Admins
    if (targetUser.nivel === 'super_admin' || targetUser.nivel === 'admin') {
      return false;
    }
    // Admin só pode editar gerentes e funcionários do seu próprio tenant
    return currentUser.tenant_id === targetUser.tenant_id;
  }
  return false;
};

/**
 * Regra: Permitir ao respectivo usuário a edição da senha atual registrada.
 * Permitir ao usuário Super Admin realizar a alteração de senha de qualquer usuário independente do nível.
 */
export const canChangeUserPassword = (
  currentUser: Usuario | null | undefined,
  targetUser: { id?: string; nivel?: NivelAcesso; tenant_id?: string } | null | undefined,
  isOnline?: boolean
): boolean => {
  if (isOnline === false) return false;
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
  targetUser: { id?: string; nivel: NivelAcesso; tenant_id?: string },
  isOnline?: boolean
): boolean => {
  if (isOnline === false) return false;
  if (!currentUser) return false;
  // Não pode excluir a si mesmo
  if (targetUser.id && currentUser.id === targetUser.id) {
    return false;
  }
  if (currentUser.nivel === 'super_admin') {
    return true;
  }
  if (currentUser.nivel === 'admin') {
    if (targetUser.nivel === 'super_admin' || targetUser.nivel === 'admin') {
      return false;
    }
    return currentUser.tenant_id === targetUser.tenant_id;
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
