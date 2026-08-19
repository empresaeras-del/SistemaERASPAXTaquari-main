import { supabase, registrarAuditoria } from '../lib/supabase';
import { getAllFromIDB, saveToIDB, initDB } from '../lib/idb';

export interface TabelaInfo {
  nome: string;
  supabaseTable: string;
  idbStore: string;
  aliases?: string[];
  label: string;
  ordemImportacao: number;
}

/**
 * Lista de todas as tabelas do sistema, mapeadas por ordem de dependência relacional
 */
export const TABELAS_SISTEMA: TabelaInfo[] = [
  // 1. Core / Tenants e Usuários
  { nome: 'tenants', supabaseTable: 'tenants', idbStore: 'empresas', aliases: ['empresas'], label: 'Empresas / Filiais', ordemImportacao: 1 },
  { nome: 'users', supabaseTable: 'users', idbStore: 'usuarios', aliases: ['usuarios'], label: 'Usuários do Sistema', ordemImportacao: 2 },
  
  // 2. Parâmetros / Cadastros Base
  { nome: 'planos_pax', supabaseTable: 'planos_pax', idbStore: 'planos_pax', aliases: ['planos'], label: 'Planos PAX', ordemImportacao: 3 },
  { nome: 'planos_pax_coberturas', supabaseTable: 'planos_pax_coberturas', idbStore: 'planos_pax_coberturas', label: 'Coberturas de Planos', ordemImportacao: 4 },
  { nome: 'planos_pax_faixas', supabaseTable: 'planos_pax_faixas', idbStore: 'planos_pax_faixas', label: 'Faixas Etárias de Planos', ordemImportacao: 5 },
  { nome: 'itens_funerarios', supabaseTable: 'itens_funerarios', idbStore: 'itens_funerarios', label: 'Itens Funerários / Estoque', ordemImportacao: 6 },
  { nome: 'fornecedores', supabaseTable: 'fornecedores', idbStore: 'fornecedores', label: 'Fornecedores', ordemImportacao: 7 },
  { nome: 'procedimentos', supabaseTable: 'procedimentos', idbStore: 'procedimentos', label: 'Procedimentos Médicos/Exames', ordemImportacao: 8 },
  { nome: 'credenciados', supabaseTable: 'credenciados', idbStore: 'credenciados', label: 'Rede Credenciada', ordemImportacao: 9 },
  { nome: 'credenciados_planos', supabaseTable: 'credenciados_planos', idbStore: 'credenciados_planos', label: 'Vínculos Credenciados-Planos', ordemImportacao: 10 },
  { nome: 'credenciados_procedimentos', supabaseTable: 'credenciados_procedimentos', idbStore: 'credenciados_procedimentos', label: 'Vínculos Credenciados-Procedimentos', ordemImportacao: 11 },
  { nome: 'contas_bancarias', supabaseTable: 'contas_bancarias', idbStore: 'contas_bancarias', aliases: ['caixas'], label: 'Contas Bancárias / Caixas', ordemImportacao: 12 },
  { nome: 'documentos_padroes', supabaseTable: 'documentos_padroes', idbStore: 'documentos_padroes', label: 'Modelos de Documentos', ordemImportacao: 13 },
  
  // 3. Associados e Dependentes
  { nome: 'associados', supabaseTable: 'associados', idbStore: 'associados', label: 'Associados (Titulares)', ordemImportacao: 14 },
  { nome: 'dependentes', supabaseTable: 'dependentes', idbStore: 'dependentes', label: 'Dependentes', ordemImportacao: 15 },
  { nome: 'contratos', supabaseTable: 'contratos', idbStore: 'contratos', label: 'Contratos', ordemImportacao: 16 },

  // 4. Operacional / Atendimentos / Requisições
  { nome: 'atendimentos', supabaseTable: 'atendimentos', idbStore: 'atendimentos', label: 'Atendimentos Funerários', ordemImportacao: 17 },
  { nome: 'atendimento_itens', supabaseTable: 'atendimento_itens', idbStore: 'atendimento_itens', label: 'Itens de Atendimento', ordemImportacao: 18 },
  { nome: 'requisicoes', supabaseTable: 'requisicoes', idbStore: 'requisicoes', label: 'Guias de Requisição', ordemImportacao: 19 },
  { nome: 'requisicao_itens', supabaseTable: 'requisicao_itens', idbStore: 'requisicao_itens', label: 'Itens de Requisição', ordemImportacao: 20 },
  { nome: 'remessas_faturamento', supabaseTable: 'remessas_faturamento', idbStore: 'remessas_faturamento', label: 'Remessas de Faturamento', ordemImportacao: 21 },

  // 5. Financeiro / Caixa
  { nome: 'lotes_caixa', supabaseTable: 'lotes_caixa', idbStore: 'lotes_caixa', label: 'Lotes de Caixa (Sessões)', ordemImportacao: 22 },
  { nome: 'movimentacoes_caixa', supabaseTable: 'movimentacoes_caixa', idbStore: 'movimentacoes_caixa', label: 'Movimentações de Caixa', ordemImportacao: 23 },
  { nome: 'receitas', supabaseTable: 'receitas', idbStore: 'receitas', aliases: ['financeiro'], label: 'Contas a Receber (Receitas)', ordemImportacao: 24 },
  { nome: 'parcelas_receber', supabaseTable: 'parcelas_receber', idbStore: 'parcelas_receber', aliases: ['titulos'], label: 'Parcelas a Receber / Mensalidades', ordemImportacao: 25 },
  { nome: 'despesas', supabaseTable: 'despesas', idbStore: 'despesas', label: 'Contas a Pagar (Despesas)', ordemImportacao: 26 },
  { nome: 'parcelas_pagar', supabaseTable: 'parcelas_pagar', idbStore: 'parcelas_pagar', label: 'Parcelas a Pagar', ordemImportacao: 27 },

  // 6. Sistema / Logs
  { nome: 'auditoria', supabaseTable: 'auditoria', idbStore: 'auditoria', label: 'Logs de Auditoria', ordemImportacao: 28 },
  { nome: 'notificacoes', supabaseTable: 'notificacoes', idbStore: 'notificacoes', label: 'Notificações do Sistema', ordemImportacao: 29 },
  { nome: 'preferencias', supabaseTable: 'preferencias', idbStore: 'preferencias', label: 'Preferências do Sistema', ordemImportacao: 30 },
];

export interface BackupEstrutura {
  sistema: string;
  versao: string;
  timestamp: string;
  criado_por?: string;
  usuario_id?: string;
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
  onProgress?: (tabelaLabel: string, atual: number, total: number) => void;
}): Promise<{ backupData: BackupEstrutura; jsonString: string; fileName: string }> => {
  const { isOnline, usuarioNome, usuarioId, empresaId, onProgress } = options;

  const backupData: BackupEstrutura = {
    sistema: 'ERAS ERP',
    versao: '2.0',
    timestamp: new Date().toISOString(),
    criado_por: usuarioNome || 'Administrador',
    usuario_id: usuarioId || undefined,
    resumo: {
      tabelas_total: TABELAS_SISTEMA.length,
      registros_total: 0,
      contagens: {}
    },
    dados: {}
  };

  let totalRegistros = 0;
  const totalTabelas = TABELAS_SISTEMA.length;

  for (let i = 0; i < TABELAS_SISTEMA.length; i++) {
    const tab = TABELAS_SISTEMA[i];
    if (onProgress) {
      onProgress(tab.label, i + 1, totalTabelas);
    }

    let registros: any[] = [];

    // 1. Tenta buscar do Supabase se online
    if (isOnline) {
      try {
        const { data, error } = await supabase
          .from(tab.supabaseTable)
          .select('*');

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
        if (Array.isArray(localData) && localData.length > 0) {
          registros = localData;
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
  const fileName = `eras_backup_completo_${dataFormatada}_${horaFormatada}.json`;

  // Registra auditoria
  try {
    await registrarAuditoria('Gerar Backup Completo do Sistema', {
      file: fileName,
      tabelas_incluidas: TABELAS_SISTEMA.length,
      registros_total: totalRegistros
    });
    
    if (usuarioId && isOnline) {
      await supabase.rpc('registrar_audit', {
        p_usuario_id: usuarioId,
        p_acao: 'BACKUP_MANUAL_COMPLETO',
        p_tabela: 'sistema',
        p_dados_novos: { file: fileName, total_registros: totalRegistros },
        p_empresa_id: empresaId || null
      });
    }
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
      return { valido: false, mensagemErro: 'Arquivo JSON inválido ou vazio.', tabelas_total: 0, registros_total: 0, contagens: {}, dadosNormalizados: {} };
    }

    // Suporta formato v2.0 ({ dados: { ... } }) e formato v1.0 / raw ({ tabela: [...] })
    const dadosBrutos = raw.dados && typeof raw.dados === 'object' ? raw.dados : raw;
    const dadosNormalizados: Record<string, any[]> = {};
    const contagens: Record<string, { label: string; count: number }> = {};
    let totalRegistros = 0;
    let tabelasComDados = 0;

    for (const tab of TABELAS_SISTEMA) {
      let registros: any[] = [];

      // Procura pelo nome principal
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

      if (registros.length > 0) {
        tabelasComDados++;
      }

      dadosNormalizados[tab.nome] = registros;
      contagens[tab.nome] = {
        label: tab.label,
        count: registros.length
      };
      totalRegistros += registros.length;
    }

    if (totalRegistros === 0 && tabelasComDados === 0) {
      return {
        valido: false,
        mensagemErro: 'Nenhuma tabela compatível do sistema foi encontrada no arquivo informado.',
        tabelas_total: 0,
        registros_total: 0,
        contagens: {},
        dadosNormalizados: {}
      };
    }

    return {
      valido: true,
      sistema: raw.sistema || 'ERAS ERP (Backup)',
      versao: raw.versao || '1.0 (Legado)',
      timestamp: raw.timestamp || undefined,
      criado_por: raw.criado_por || undefined,
      tabelas_total: tabelasComDados,
      registros_total: totalRegistros,
      contagens,
      dadosNormalizados
    };
  } catch (err: any) {
    return {
      valido: false,
      mensagemErro: `Erro ao decodificar arquivo de backup: ${err.message || 'JSON inválido'}`,
      tabelas_total: 0,
      registros_total: 0,
      contagens: {},
      dadosNormalizados: {}
    };
  }
};

/**
 * Restaura o backup para o banco Supabase e para o IndexedDB
 */
export const restaurarBackup = async (options: {
  analise: AnaliseBackup;
  isOnline: boolean;
  modo: 'upsert' | 'substituir';
  usuarioId?: string;
  empresaId?: string;
  onProgress?: (tabelaLabel: string, progresso: number, totalTabelas: number, status: string) => void;
}): Promise<{ sucesso: boolean; tabelasRestauradas: number; registrosRestaurados: number; erros: string[] }> => {
  const { analise, isOnline, modo, usuarioId, empresaId, onProgress } = options;
  const erros: string[] = [];
  let tabelasRestauradas = 0;
  let registrosRestaurados = 0;

  // Garante inicialização do banco local
  await initDB();

  // Ordena tabelas conforme dependência relacional (ordemImportacao)
  const tabelasOrdenadas = [...TABELAS_SISTEMA].sort((a, b) => a.ordemImportacao - b.ordemImportacao);
  const total = tabelasOrdenadas.length;

  for (let i = 0; i < tabelasOrdenadas.length; i++) {
    const tab = tabelasOrdenadas[i];
    const registros = analise.dadosNormalizados[tab.nome] || [];

    if (onProgress) {
      onProgress(tab.label, i + 1, total, `Processando ${registros.length} registros...`);
    }

    if (registros.length === 0) continue;

    try {
      // 1. Restaura no IndexedDB local
      for (const item of registros) {
        if (item && (item.id || item.cpf || item.chave)) {
          await saveToIDB(tab.idbStore, item);
        }
      }

      // 2. Se online, envia para o Supabase em lotes de 50 registros
      if (isOnline) {
        const BATCH_SIZE = 50;
        for (let b = 0; b < registros.length; b += BATCH_SIZE) {
          const batch = registros.slice(b, b + BATCH_SIZE);
          
          const { error } = await supabase
            .from(tab.supabaseTable)
            .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

          if (error) {
            console.warn(`Erro no upsert em lote para ${tab.supabaseTable}:`, error.message);
            // Tenta inserir individualmente para salvar o máximo possível
            for (const item of batch) {
              try {
                await supabase.from(tab.supabaseTable).upsert(item, { onConflict: 'id' });
              } catch (indErr: any) {
                // Ignora erro pontual
              }
            }
          }
        }
      }

      tabelasRestauradas++;
      registrosRestaurados += registros.length;
    } catch (tabErr: any) {
      console.error(`Erro ao restaurar tabela ${tab.label}:`, tabErr);
      erros.push(`Tabela ${tab.label}: ${tabErr.message || 'Erro desconhecido'}`);
    }
  }

  // Registra auditoria
  try {
    await registrarAuditoria('Restaurar Backup do Sistema', {
      modo,
      tabelas_restauradas: tabelasRestauradas,
      registros_restaurados: registrosRestaurados,
      erros_quantidade: erros.length
    });

    if (usuarioId && isOnline) {
      await supabase.rpc('registrar_audit', {
        p_usuario_id: usuarioId,
        p_acao: 'RESTAURACAO_BACKUP',
        p_tabela: 'sistema',
        p_dados_novos: { modo, total_registros: registrosRestaurados },
        p_empresa_id: empresaId || null
      });
    }
  } catch (auditErr) {
    console.warn('Erro ao registrar log de auditoria da restauração:', auditErr);
  }

  return {
    sucesso: erros.length === 0,
    tabelasRestauradas,
    registrosRestaurados,
    erros
  };
};
