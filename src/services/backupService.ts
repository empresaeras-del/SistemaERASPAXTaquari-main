import { supabase, registrarAuditoria } from '../lib/supabase';
import { getAllFromIDB, saveToIDB, initDB } from '../lib/idb';

export interface TabelaInfo {
  nome: string;
  supabaseTable: string;
  idbStore: string;
  aliases?: string[];
  label: string;
  ordemImportacao: number;
  /** Coluna tenant_id nesta tabela (para tabelas primárias com isolamento direto) */
  colunaTenant?: string;
  /** Nome da tabela pai em TABELAS_SISTEMA (para tabelas secundárias sem tenant_id direto) */
  tabelaPai?: string;
  /** Coluna FK nesta tabela que aponta para o ID da tabela pai */
  colunaFkPai?: string;
}

/**
 * Lista de todas as tabelas do sistema, mapeadas por ordem de dependência relacional
 */
export const TABELAS_SISTEMA: TabelaInfo[] = [
  // 1. Core / Tenants e Usuários — sem tenant_id próprio
  { nome: 'tenants',   supabaseTable: 'tenants',   idbStore: 'empresas',   aliases: ['empresas'],   label: 'Empresas / Filiais',              ordemImportacao: 1 },
  { nome: 'users',     supabaseTable: 'users',     idbStore: 'usuarios',   aliases: ['usuarios'],   label: 'Usuários do Sistema',              ordemImportacao: 2, colunaTenant: 'tenant_id' },

  // 2. Parâmetros / Cadastros Base
  { nome: 'planos_pax',                   supabaseTable: 'planos_pax',                   idbStore: 'planos_pax',                   aliases: ['planos'], label: 'Planos PAX',                          ordemImportacao: 3,  colunaTenant: 'tenant_id' },
  { nome: 'planos_pax_coberturas',        supabaseTable: 'planos_pax_coberturas',        idbStore: 'planos_pax_coberturas',                             label: 'Coberturas de Planos',                ordemImportacao: 4,  tabelaPai: 'planos_pax',    colunaFkPai: 'plano_id' },
  { nome: 'planos_pax_faixas',            supabaseTable: 'planos_pax_faixas',            idbStore: 'planos_pax_faixas',                                 label: 'Faixas Etárias de Planos',            ordemImportacao: 5,  tabelaPai: 'planos_pax',    colunaFkPai: 'plano_id' },
  { nome: 'itens_funerarios',             supabaseTable: 'itens_funerarios',             idbStore: 'itens_funerarios',                                  label: 'Itens Funerários / Estoque',          ordemImportacao: 6,  colunaTenant: 'tenant_id' },
  { nome: 'fornecedores',                 supabaseTable: 'fornecedores',                 idbStore: 'fornecedores',                                      label: 'Fornecedores',                        ordemImportacao: 7,  colunaTenant: 'tenant_id' },
  { nome: 'procedimentos',                supabaseTable: 'procedimentos',                idbStore: 'procedimentos',                                     label: 'Procedimentos Médicos/Exames',        ordemImportacao: 8,  colunaTenant: 'tenant_id' },
  { nome: 'credenciados',                 supabaseTable: 'credenciados',                 idbStore: 'credenciados',                                      label: 'Rede Credenciada',                    ordemImportacao: 9,  colunaTenant: 'tenant_id' },
  { nome: 'credenciados_planos',          supabaseTable: 'credenciados_planos',          idbStore: 'credenciados_planos',                               label: 'Vínculos Credenciados-Planos',        ordemImportacao: 10, tabelaPai: 'credenciados', colunaFkPai: 'credenciado_id' },
  { nome: 'credenciados_procedimentos',   supabaseTable: 'credenciados_procedimentos',   idbStore: 'credenciados_procedimentos',                        label: 'Vínculos Credenciados-Procedimentos', ordemImportacao: 11, tabelaPai: 'credenciados', colunaFkPai: 'credenciado_id' },
  { nome: 'contas_bancarias',             supabaseTable: 'contas_bancarias',             idbStore: 'contas_bancarias',             aliases: ['caixas'], label: 'Contas Bancárias / Caixas',           ordemImportacao: 12, colunaTenant: 'tenant_id' },
  { nome: 'documentos_padroes',           supabaseTable: 'documentos_padroes',           idbStore: 'documentos_padroes',                                label: 'Modelos de Documentos',               ordemImportacao: 13, colunaTenant: 'tenant_id' },

  // 3. Associados e Dependentes
  { nome: 'associados',  supabaseTable: 'associados',  idbStore: 'associados',  label: 'Associados (Titulares)', ordemImportacao: 14, colunaTenant: 'tenant_id' },
  { nome: 'dependentes', supabaseTable: 'dependentes', idbStore: 'dependentes', label: 'Dependentes',            ordemImportacao: 15, tabelaPai: 'associados', colunaFkPai: 'associado_id' },
  { nome: 'contratos',   supabaseTable: 'contratos',   idbStore: 'contratos',   label: 'Contratos',              ordemImportacao: 16, colunaTenant: 'tenant_id' },

  // 4. Operacional / Atendimentos / Requisições
  { nome: 'atendimentos',     supabaseTable: 'atendimentos',     idbStore: 'atendimentos',     label: 'Atendimentos Funerários', ordemImportacao: 17, colunaTenant: 'tenant_id' },
  { nome: 'atendimento_itens',supabaseTable: 'atendimento_itens',idbStore: 'atendimento_itens',label: 'Itens de Atendimento',    ordemImportacao: 18, tabelaPai: 'atendimentos', colunaFkPai: 'atendimento_id' },
  { nome: 'requisicoes',      supabaseTable: 'requisicoes',      idbStore: 'requisicoes',      label: 'Guias de Requisição',     ordemImportacao: 19, colunaTenant: 'tenant_id' },
  { nome: 'requisicao_itens', supabaseTable: 'requisicao_itens', idbStore: 'requisicao_itens', label: 'Itens de Requisição',     ordemImportacao: 20, tabelaPai: 'requisicoes',  colunaFkPai: 'requisicao_id' },
  { nome: 'remessas_faturamento', supabaseTable: 'remessas_faturamento', idbStore: 'remessas_faturamento', label: 'Remessas de Faturamento', ordemImportacao: 21, colunaTenant: 'tenant_id' },

  // 5. Financeiro / Caixa
  { nome: 'lotes_caixa',       supabaseTable: 'lotes_caixa',       idbStore: 'lotes_caixa',       label: 'Lotes de Caixa (Sessões)',            ordemImportacao: 22, colunaTenant: 'tenant_id' },
  { nome: 'movimentacoes_caixa',supabaseTable: 'movimentacoes_caixa',idbStore: 'movimentacoes_caixa',label: 'Movimentações de Caixa',           ordemImportacao: 23, colunaTenant: 'tenant_id' },
  { nome: 'receitas',          supabaseTable: 'receitas',          idbStore: 'receitas',          aliases: ['financeiro'], label: 'Contas a Receber (Receitas)', ordemImportacao: 24, colunaTenant: 'tenant_id' },
  { nome: 'parcelas_receber',  supabaseTable: 'parcelas_receber',  idbStore: 'parcelas_receber',  aliases: ['titulos'],   label: 'Parcelas a Receber / Mensalidades', ordemImportacao: 25, tabelaPai: 'receitas',  colunaFkPai: 'receita_id' },
  { nome: 'despesas',          supabaseTable: 'despesas',          idbStore: 'despesas',          label: 'Contas a Pagar (Despesas)', ordemImportacao: 26, colunaTenant: 'tenant_id' },
  { nome: 'parcelas_pagar',    supabaseTable: 'parcelas_pagar',    idbStore: 'parcelas_pagar',    label: 'Parcelas a Pagar',          ordemImportacao: 27, tabelaPai: 'despesas',  colunaFkPai: 'despesa_id' },

  // 6. Sistema / Logs
  { nome: 'auditoria',    supabaseTable: 'auditoria',    idbStore: 'auditoria',    label: 'Logs de Auditoria',         ordemImportacao: 28, colunaTenant: 'tenant_id' },
  { nome: 'notificacoes', supabaseTable: 'notificacoes', idbStore: 'notificacoes', label: 'Notificações do Sistema',   ordemImportacao: 29, colunaTenant: 'tenant_id' },
  { nome: 'preferencias', supabaseTable: 'preferencias', idbStore: 'preferencias', label: 'Preferências do Sistema',  ordemImportacao: 30, colunaTenant: 'tenant_id' },
];


export interface BackupEstrutura {
  sistema: string;
  versao: string;
  timestamp: string;
  criado_por?: string;
  usuario_id?: string;
  empresa_id?: string;
  resumo: {
    tabelas_total: number;
    registros_total: number;
    contagens: Record<string, number>;
  };
  dados: Record<string, any[]>;
}

export interface AnaliseBackup {
  valido: boolean;
  mensagemErro?: string;
  sistema?: string;
  versao?: string;
  timestamp?: string;
  criado_por?: string;
  empresa_id?: string;
  tabelas_total: number;
  registros_total: number;
  contagens: Record<string, { label: string; count: number }>;
  dadosNormalizados: Record<string, any[]>;
}

/**
 * Gera o backup do sistema com todas as tabelas — isolando estritamente por empresa quando solicitado
 */
export const gerarBackupCompleto = async (options: {
  isOnline: boolean;
  usuarioNome?: string;
  usuarioId?: string;
  empresaId?: string;
  /** Nome fantasia da empresa para uso no nome do arquivo */
  empresaNome?: string;
  /** Quando true, filtra os dados pelo tenant_id da empresa */
  filtrarPorEmpresa?: boolean;
  onProgress?: (tabelaLabel: string, atual: number, total: number) => void;
}): Promise<{ backupData: BackupEstrutura; jsonString: string; fileName: string }> => {
  const { isOnline, usuarioNome, usuarioId, empresaId, empresaNome, filtrarPorEmpresa, onProgress } = options;

  const backupData: BackupEstrutura = {
    sistema: 'ERAS ERP',
    versao: '2.0',
    timestamp: new Date().toISOString(),
    criado_por: usuarioNome || 'Administrador',
    usuario_id: usuarioId || undefined,
    empresa_id: empresaId || undefined,
    resumo: {
      tabelas_total: TABELAS_SISTEMA.length,
      registros_total: 0,
      contagens: {}
    },
    dados: {}
  };

  let totalRegistros = 0;
  const totalTabelas = TABELAS_SISTEMA.length;
  const deveFiltrar = filtrarPorEmpresa === true && Boolean(empresaId);

  for (let i = 0; i < TABELAS_SISTEMA.length; i++) {
    const tab = TABELAS_SISTEMA[i];
    if (onProgress) {
      onProgress(tab.label, i + 1, totalTabelas);
    }

    let registros: any[] = [];

    // Se a tabela for secundária, obtém os IDs dos registros pais já filtrados e coletados
    const parentIds: string[] = tab.tabelaPai && deveFiltrar
      ? (backupData.dados[tab.tabelaPai] || []).map((r: any) => r?.id).filter(Boolean)
      : [];

    // 1. Tenta buscar do Supabase se online
    if (isOnline) {
      try {
        if (deveFiltrar) {
          if (tab.nome === 'tenants') {
            // Tabela tenants: apenas a empresa selecionada
            const { data, error } = await supabase
              .from(tab.supabaseTable)
              .select('*')
              .eq('id', empresaId!);
            if (!error && Array.isArray(data)) registros = data;
          } else if (tab.colunaTenant) {
            // Tabela primária com isolamento direto por tenant_id
            const { data, error } = await supabase
              .from(tab.supabaseTable)
              .select('*')
              .eq(tab.colunaTenant, empresaId!);
            if (!error && Array.isArray(data)) registros = data;
          } else if (tab.tabelaPai && tab.colunaFkPai) {
            // Tabela secundária: busca somente registros cujos pais pertencem a esta empresa
            if (parentIds.length > 0) {
              const CHUNK_SIZE = 50;
              const fetched: any[] = [];
              for (let c = 0; c < parentIds.length; c += CHUNK_SIZE) {
                const chunk = parentIds.slice(c, c + CHUNK_SIZE);
                const { data, error } = await supabase
                  .from(tab.supabaseTable)
                  .select('*')
                  .in(tab.colunaFkPai, chunk);
                if (!error && Array.isArray(data)) {
                  fetched.push(...data);
                }
              }
              registros = fetched;
            } else {
              // Se não há registros pais para esta empresa, tabela secundária fica vazia
              registros = [];
            }
          }
        } else {
          // Backup global (todas as empresas)
          const { data, error } = await supabase
            .from(tab.supabaseTable)
            .select('*');
          if (!error && Array.isArray(data)) registros = data;
        }
      } catch (err) {
        console.warn(`Erro ao consultar tabela ${tab.supabaseTable} no Supabase:`, err);
      }
    }

    // 2. Se registros estiver vazio ou offline, tenta buscar do IndexedDB local
    if (registros.length === 0) {
      try {
        const localData = await getAllFromIDB(tab.idbStore);
        if (Array.isArray(localData) && localData.length > 0) {
          if (deveFiltrar) {
            if (tab.nome === 'tenants') {
              registros = localData.filter((item: any) => item?.id === empresaId);
            } else if (tab.colunaTenant) {
              registros = localData.filter((item: any) =>
                item?.[tab.colunaTenant!] === empresaId ||
                item?.tenant_id === empresaId ||
                item?.empresa_id === empresaId
              );
            } else if (tab.tabelaPai && tab.colunaFkPai) {
              if (parentIds.length > 0) {
                const parentIdSet = new Set(parentIds);
                registros = localData.filter((item: any) => parentIdSet.has(item?.[tab.colunaFkPai!]));
              } else {
                registros = [];
              }
            } else {
              registros = [];
            }
          } else {
            registros = localData;
          }
        }
      } catch (idbErr) {
        console.warn(`Erro ao buscar dados locais da store ${tab.idbStore}:`, idbErr);
      }
    }

    backupData.dados[tab.nome] = registros;
    backupData.resumo.contagens[tab.nome] = registros.length;
    totalRegistros += registros.length;
  }

  backupData.resumo.registros_total = totalRegistros;

  const jsonString = JSON.stringify(backupData, null, 2);
  const dataFormatada = new Date().toISOString().split('T')[0];
  const horaFormatada = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
  const sufixo = deveFiltrar && empresaNome
    ? `_${empresaNome.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    : deveFiltrar
    ? `_${empresaId}`
    : '_completo';
  const fileName = `eras_backup${sufixo}_${dataFormatada}_${horaFormatada}.json`;

  try {
    await registrarAuditoria('Gerar Backup do Sistema', {
      file: fileName,
      empresa_id: empresaId,
      filtrado_por_empresa: deveFiltrar,
      registros_total: totalRegistros
    });
  } catch (e) {
    console.warn('Erro ao registrar log de auditoria do backup:', e);
  }

  return { backupData, jsonString, fileName };
};

/**
 * Analisa e valida a estrutura de um arquivo de backup
 */
export const analisarArquivoBackup = (conteudoJson: string): AnaliseBackup => {
  try {
    const raw = JSON.parse(conteudoJson);
    if (!raw || typeof raw !== 'object') {
      return { valido: false, mensagemErro: 'Arquivo JSON inválido.', tabelas_total: 0, registros_total: 0, contagens: {}, dadosNormalizados: {} };
    }

    const dadosBrutos = raw.dados || raw;
    const dadosNormalizados: Record<string, any[]> = {};
    const contagens: Record<string, { label: string; count: number }> = {};
    let totalRegistros = 0;
    let tabelasComDados = 0;

    for (const tab of TABELAS_SISTEMA) {
      // Busca pelo nome principal, supabaseTable, idbStore e aliases (compatibilidade v1.0)
      let registros: any[] = [];
      if (Array.isArray(dadosBrutos[tab.nome])) {
        registros = dadosBrutos[tab.nome];
      } else if (Array.isArray(dadosBrutos[tab.supabaseTable])) {
        registros = dadosBrutos[tab.supabaseTable];
      } else if (Array.isArray(dadosBrutos[tab.idbStore])) {
        registros = dadosBrutos[tab.idbStore];
      } else if (tab.aliases) {
        for (const alias of tab.aliases) {
          if (Array.isArray(dadosBrutos[alias])) {
            registros = dadosBrutos[alias];
            break;
          }
        }
      }
      
      if (registros.length > 0) tabelasComDados++;

      dadosNormalizados[tab.nome] = registros;
      contagens[tab.nome] = { label: tab.label, count: registros.length };
      totalRegistros += registros.length;
    }

    return {
      valido: true,
      sistema: raw.sistema,
      versao: raw.versao,
      empresa_id: raw.empresa_id,
      tabelas_total: tabelasComDados,
      registros_total: totalRegistros,
      contagens,
      dadosNormalizados
    };
  } catch (err: any) {
    return { valido: false, mensagemErro: `Erro: ${err.message}`, tabelas_total: 0, registros_total: 0, contagens: {}, dadosNormalizados: {} };
  }
};

/**
 * Restaura o backup para o banco Supabase e IndexedDB, aplicando filtro estrito por empresa alvo
 */
export const restaurarBackup = async (options: {
  analise: AnaliseBackup;
  isOnline: boolean;
  modo: 'upsert' | 'substituir';
  usuarioId?: string;
  empresaId?: string;
  /** Se informado, filtra registros pelo tenant_id antes de restaurar */
  empresaAlvo?: string;
  onProgress?: (tabelaLabel: string, progresso: number, totalTabelas: number, status: string) => void;
}): Promise<{ sucesso: boolean; tabelasRestauradas: number; registrosRestaurados: number; erros: string[] }> => {
  const { analise, isOnline, modo, usuarioId, empresaId, empresaAlvo, onProgress } = options;
  const erros: string[] = [];
  let tabelasRestauradas = 0;
  let registrosRestaurados = 0;

  await initDB();
  const tabelasOrdenadas = [...TABELAS_SISTEMA].sort((a, b) => a.ordemImportacao - b.ordemImportacao);
  const restoredParentIds: Record<string, Set<string>> = {};

  for (let i = 0; i < tabelasOrdenadas.length; i++) {
    const tab = tabelasOrdenadas[i];
    let registros = analise.dadosNormalizados[tab.nome] || [];

    // Aplica filtro por empresa alvo se especificado
    if (empresaAlvo) {
      if (tab.nome === 'tenants') {
        registros = registros.filter((r: any) => r?.id === empresaAlvo);
      } else if (tab.colunaTenant) {
        registros = registros.filter((r: any) =>
          r?.[tab.colunaTenant!] === empresaAlvo ||
          r?.tenant_id === empresaAlvo ||
          r?.empresa_id === empresaAlvo
        );
      } else if (tab.tabelaPai && tab.colunaFkPai) {
        const validParentIds = restoredParentIds[tab.tabelaPai] || new Set();
        registros = registros.filter((r: any) => validParentIds.has(r?.[tab.colunaFkPai!]));
      }
    }

    // Mapeia IDs dos registros restaurados para filtrar tabelas filhas
    restoredParentIds[tab.nome] = new Set(registros.map((r: any) => r?.id).filter(Boolean));

    if (onProgress) onProgress(tab.label, i + 1, tabelasOrdenadas.length, `Restaurando ${registros.length} registros...`);

    if (registros.length === 0) continue;

    try {
      for (const item of registros) await saveToIDB(tab.idbStore, item);

      if (isOnline) {
        const BATCH_SIZE = 50;
        for (let b = 0; b < registros.length; b += BATCH_SIZE) {
          const batch = registros.slice(b, b + BATCH_SIZE);
          const { error } = await supabase.from(tab.supabaseTable).upsert(batch);
          if (error) throw error;
        }
      }
      
      tabelasRestauradas++;
      registrosRestaurados += registros.length;
    } catch (e: any) {
      erros.push(`${tab.label}: ${e.message}`);
    }
  }

  return {
    sucesso: erros.length === 0,
    tabelasRestauradas,
    registrosRestaurados,
    erros
  };
};

