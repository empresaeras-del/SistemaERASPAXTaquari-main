import { supabase, registrarAuditoria } from '../lib/supabase';
import { getAllFromIDB, saveToIDB, initDB } from '../lib/idb';

export interface TabelaInfo {
  nome: string;
  supabaseTable: string;
  idbStore: string;
  aliases?: string[];
  label: string;
  ordemImportacao: number;
  colunaTenant?: string;
}

/**
 * Lista de todas as tabelas do sistema, mapeadas por ordem de dependência relacional
 */
export const TABELAS_SISTEMA: TabelaInfo[] = [
  // 1. Core / Tenants e Usuários
  { nome: 'tenants', supabaseTable: 'tenants', idbStore: 'empresas', aliases: ['empresas'], label: 'Empresas / Filiais', ordemImportacao: 1 },
  { nome: 'users', supabaseTable: 'users', idbStore: 'usuarios', aliases: ['usuarios'], label: 'Usuários do Sistema', ordemImportacao: 2 },
  
  // 2. Parâmetros / Cadastros Base
  { nome: 'planos_pax', supabaseTable: 'planos_pax', idbStore: 'planos_pax', aliases: ['planos'], label: 'Planos PAX', ordemImportacao: 3, colunaTenant: 'tenant_id' },
  { nome: 'planos_pax_coberturas', supabaseTable: 'planos_pax_coberturas', idbStore: 'planos_pax_coberturas', label: 'Coberturas de Planos', ordemImportacao: 4 },
  { nome: 'planos_pax_faixas', supabaseTable: 'planos_pax_faixas', idbStore: 'planos_pax_faixas', label: 'Faixas Etárias de Planos', ordemImportacao: 5 },
  { nome: 'itens_funerarios', supabaseTable: 'itens_funerarios', idbStore: 'itens_funerarios', label: 'Itens Funerários / Estoque', ordemImportacao: 6, colunaTenant: 'tenant_id' },
  { nome: 'fornecedores', supabaseTable: 'fornecedores', idbStore: 'fornecedores', label: 'Fornecedores', ordemImportacao: 7, colunaTenant: 'tenant_id' },
  { nome: 'procedimentos', supabaseTable: 'procedimentos', idbStore: 'procedimentos', label: 'Procedimentos Médicos/Exames', ordemImportacao: 8, colunaTenant: 'tenant_id' },
  { nome: 'credenciados', supabaseTable: 'credenciados', idbStore: 'credenciados', label: 'Rede Credenciada', ordemImportacao: 9, colunaTenant: 'tenant_id' },
  { nome: 'credenciados_planos', supabaseTable: 'credenciados_planos', idbStore: 'credenciados_planos', label: 'Vínculos Credenciados-Planos', ordemImportacao: 10 },
  { nome: 'credenciados_procedimentos', supabaseTable: 'credenciados_procedimentos', idbStore: 'credenciados_procedimentos', label: 'Vínculos Credenciados-Procedimentos', ordemImportacao: 11 },
  { nome: 'contas_bancarias', supabaseTable: 'contas_bancarias', idbStore: 'contas_bancarias', aliases: ['caixas'], label: 'Contas Bancárias / Caixas', ordemImportacao: 12, colunaTenant: 'tenant_id' },
  { nome: 'documentos_padroes', supabaseTable: 'documentos_padroes', idbStore: 'documentos_padroes', label: 'Modelos de Documentos', ordemImportacao: 13, colunaTenant: 'tenant_id' },
  
  // 3. Associados e Dependentes
  { nome: 'associados', supabaseTable: 'associados', idbStore: 'associados', label: 'Associados (Titulares)', ordemImportacao: 14, colunaTenant: 'tenant_id' },
  { nome: 'dependentes', supabaseTable: 'dependentes', idbStore: 'dependentes', label: 'Dependentes', ordemImportacao: 15 },
  { nome: 'contratos', supabaseTable: 'contratos', idbStore: 'contratos', label: 'Contratos', ordemImportacao: 16, colunaTenant: 'tenant_id' },

  // 4. Operacional / Atendimentos / Requisições
  { nome: 'atendimentos', supabaseTable: 'atendimentos', idbStore: 'atendimentos', label: 'Atendimentos Funerários', ordemImportacao: 17, colunaTenant: 'tenant_id' },
  { nome: 'atendimento_itens', supabaseTable: 'atendimento_itens', idbStore: 'atendimento_itens', label: 'Itens de Atendimento', ordemImportacao: 18 },
  { nome: 'requisicoes', supabaseTable: 'requisicoes', idbStore: 'requisicoes', label: 'Guias de Requisição', ordemImportacao: 19, colunaTenant: 'tenant_id' },
  { nome: 'requisicao_itens', supabaseTable: 'requisicao_itens', idbStore: 'requisicao_itens', label: 'Itens de Requisição', ordemImportacao: 20 },
  { nome: 'remessas_faturamento', supabaseTable: 'remessas_faturamento', idbStore: 'remessas_faturamento', label: 'Remessas de Faturamento', ordemImportacao: 21, colunaTenant: 'tenant_id' },

  // 5. Financeiro / Caixa
  { nome: 'lotes_caixa', supabaseTable: 'lotes_caixa', idbStore: 'lotes_caixa', label: 'Lotes de Caixa (Sessões)', ordemImportacao: 22, colunaTenant: 'tenant_id' },
  { nome: 'movimentacoes_caixa', supabaseTable: 'movimentacoes_caixa', idbStore: 'movimentacoes_caixa', label: 'Movimentações de Caixa', ordemImportacao: 23, colunaTenant: 'tenant_id' },
  { nome: 'receitas', supabaseTable: 'receitas', idbStore: 'receitas', aliases: ['financeiro'], label: 'Contas a Receber (Receitas)', ordemImportacao: 24, colunaTenant: 'tenant_id' },
  { nome: 'parcelas_receber', supabaseTable: 'parcelas_receber', idbStore: 'parcelas_receber', aliases: ['titulos'], label: 'Parcelas a Receber / Mensalidades', ordemImportacao: 25 },
  { nome: 'despesas', supabaseTable: 'despesas', idbStore: 'despesas', label: 'Contas a Pagar (Despesas)', ordemImportacao: 26, colunaTenant: 'tenant_id' },
  { nome: 'parcelas_pagar', supabaseTable: 'parcelas_pagar', idbStore: 'parcelas_pagar', label: 'Parcelas a Pagar', ordemImportacao: 27 },

  // 6. Sistema / Logs
  { nome: 'auditoria', supabaseTable: 'auditoria', idbStore: 'auditoria', label: 'Logs de Auditoria', ordemImportacao: 28, colunaTenant: 'tenant_id' },
  { nome: 'notificacoes', supabaseTable: 'notificacoes', idbStore: 'notificacoes', label: 'Notificações do Sistema', ordemImportacao: 29, colunaTenant: 'tenant_id' },
  { nome: 'preferencias', supabaseTable: 'preferencias', idbStore: 'preferencias', label: 'Preferências do Sistema', ordemImportacao: 30, colunaTenant: 'tenant_id' },
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
 * Gera o backup completo do sistema com todas as tabelas
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
  const deveFiltrár = filtrarPorEmpresa === true && !!empresaId;

  for (let i = 0; i < TABELAS_SISTEMA.length; i++) {
    const tab = TABELAS_SISTEMA[i];
    if (onProgress) {
      onProgress(tab.label, i + 1, totalTabelas);
    }

    let registros: any[] = [];

    // 1. Tenta buscar do Supabase se online
    if (isOnline) {
      try {
        let query = supabase.from(tab.supabaseTable).select('*');
        if (deveFiltrár && tab.colunaTenant && tab.nome !== 'tenants') {
          query = query.eq(tab.colunaTenant, empresaId!);
        }
        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          registros = data;
        } else if (error) {
          console.warn(`Supabase fetch aviso para ${tab.supabaseTable}:`, error.message);
        }
      } catch (err) {
        console.warn(`Erro ao consultar tabela ${tab.supabaseTable} no Supabase:`, err);
      }
    }

    // 2. Se registros estiver vazio ou offline, tenta buscar do IndexedDB local
    if (registros.length === 0) {
      try {
        const localData = await getAllFromIDB(tab.idbStore);
        if (Array.isArray(localData)) {
          if (deveFiltrár && tab.colunaTenant && tab.nome !== 'tenants') {
            registros = localData.filter((item: any) => item[tab.colunaTenant!] === empresaId);
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
  const sufixo = deveFiltrár && empresaNome
    ? `_${empresaNome.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    : '_completo';
  const fileName = `eras_backup${sufixo}_${dataFormatada}_${horaFormatada}.json`;

  try {
    await registrarAuditoria('Gerar Backup Completo do Sistema', {
      file: fileName,
      empresa_id: empresaId,
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
      let registros: any[] = dadosBrutos[tab.nome] || dadosBrutos[tab.supabaseTable] || dadosBrutos[tab.idbStore] || [];
      
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
 * Restaura o backup
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

  for (let i = 0; i < tabelasOrdenadas.length; i++) {
    const tab = tabelasOrdenadas[i];
    let registros = analise.dadosNormalizados[tab.nome] || [];

    // Filtra registros pelo tenant_id da empresa alvo (exceto tabela de tenants)
    if (empresaAlvo && tab.colunaTenant && tab.nome !== 'tenants') {
      registros = registros.filter((r: any) => r[tab.colunaTenant!] === empresaAlvo);
    }

    if (onProgress) onProgress(tab.label, i + 1, tabelasOrdenadas.length, `Restaurando ${registros.length} registros...`);

    if (registros.length === 0) continue;

    try {
      for (const item of registros) await saveToIDB(tab.idbStore, item);

      if (isOnline) {
        const { error } = await supabase.from(tab.supabaseTable).upsert(registros);
        if (error) throw error;
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
