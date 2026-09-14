import { supabase, registrarAuditoria } from '../lib/supabase';
import { getAllFromIDB, saveToIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { generateUUID } from '../utils/uuid';
import { tenantDeRegistroExistente, MENSAGEM_TENANT_INDEFINIDO } from '../utils/tenant';
import { cadastroForaDeCirculacao } from '../utils/selecaoCadastro';
import {
  MENSAGEM_REATIVACAO_DESNECESSARIA,
  montarAssociadoReativado,
} from '../utils/reativacaoAssociado';
import type { ParcelaProjetada } from '../utils/mensalidadesAssociadoHelpers';
import { Associado, saveAssociado } from './associadosService';
import { salvarReceita } from './financeiroService';
import { resolverContaLancamento } from './planoContabilService';
import { CODIGO_CONTA_MENSALIDADE } from '../config/planoContabilPadrao.config';

/**
 * A gravação da reativação, num lugar só.
 *
 * O assistente decide **o quê** (com as funções puras de `utils/reativacaoAssociado.ts`) e
 * esta função grava — na ordem que importa, porque cada passo depende do estado que o
 * anterior deixou. Fazer isso dentro do componente, como o `NovoContratoWizard` ainda faz,
 * é o que torna impossível testar a ordem sem abrir a tela.
 */

export interface DadosReativacao {
  associado: Associado;
  /** Ids dos dependentes que voltam a ficar cobertos; os demais ficam `inativo`. */
  idsDependentesReativados: string[];
  planoId: string;
  planoNome: string;
  /** Mensalidade do contrato novo, sem a taxa de adesão. */
  valorPlano: number;
  taxaAdesao: number;
  numeroContrato: string;
  dataAdesao: string;
  qtdParcelas: number;
  parcelas: ParcelaProjetada[];
  observacoes?: string;
}

export interface ContextoReativacao {
  isOnline: boolean;
  empresaSelecionada: string | null;
  userTenantId?: string | null;
  userId?: string | null;
}

export interface ResultadoReativacao {
  associado: Associado;
  dependentesReativados: number;
  dependentesMantidosInativos: number;
  contratosArquivados: number;
  numeroContrato: string;
  receitaId: string;
  parcelasGeradas: number;
  valorTotal: number;
}

/**
 * Mensagem de uma reativação que gravou o cadastro e falhou nas mensalidades.
 *
 * É deliberadamente específica: um "erro ao reativar" genérico faria o operador repetir o
 * processo inteiro, e a segunda passada criaria um **segundo** contrato para o mesmo
 * associado. Aqui ele precisa saber que a parte irreversível já passou e que o que falta é
 * lançável na tela de Contas a Receber.
 */
export const MENSAGEM_MENSALIDADES_NAO_GERADAS =
  'O associado foi reativado e o contrato novo está registrado, mas as mensalidades não ' +
  'puderam ser geradas. Lance-as em Contas a Receber — não repita a reativação, ou o ' +
  'associado ficará com dois contratos.';

/**
 * Arquiva os contratos vigentes do associado, deixando `data_fim` no dia da troca.
 *
 * Roda **antes** de criar o contrato novo: `saveAssociado` procura o contrato ativo para
 * atualizar, e com dois ativos ao mesmo tempo ele atualizaria o errado.
 */
const arquivarContratosVigentes = async (
  associadoId: string,
  isOnline: boolean,
  dataFim: string,
): Promise<number> => {
  let arquivados = 0;

  if (isOnline) {
    const { data, error } = await supabase
      .from('contratos')
      .update({ status: 'inativo', data_fim: dataFim })
      .eq('associado_id', associadoId)
      .eq('status', 'ativo')
      .select('id');
    // Recusa do Postgres aqui é motivo para parar: seguir em frente criaria o contrato
    // novo ao lado de um antigo ainda ativo, e aí nem o app nem o banco sabem qual vale.
    if (error) throw error;
    arquivados = (data || []).length;
  }

  try {
    const locais = await getAllFromIDB<any>('contratos');
    for (const contrato of locais) {
      if (!contrato || contrato.associado_id !== associadoId || contrato.status !== 'ativo') continue;
      const atualizado = { ...contrato, status: 'inativo', data_fim: dataFim };
      await saveToIDB('contratos', atualizado);
      if (!isOnline) {
        await addToSyncQueue({ storeName: 'contratos', action: 'update', data: atualizado });
        arquivados += 1;
      }
    }
  } catch (e) {
    console.warn('Falha ao arquivar contratos no cache local:', e);
  }

  return arquivados;
};

/** Cria a linha do contrato novo, já ativa. */
const criarContratoDaReativacao = async (
  dados: DadosReativacao,
  tenantId: string,
  isOnline: boolean,
): Promise<string> => {
  const contrato = {
    id: generateUUID(),
    tenant_id: tenantId,
    empresa_id: tenantId,
    associado_id: dados.associado.id,
    plano_pax_id: dados.planoId,
    numero_contrato: dados.numeroContrato,
    data_inicio: dados.dataAdesao,
    data_adesao: dados.dataAdesao,
    data_fim: null,
    valor_mensalidade: Number(dados.valorPlano) || 0,
    taxa_adesao: Number(dados.taxaAdesao) || 0,
    status: 'ativo',
    observacoes: dados.observacoes || null,
  };

  if (isOnline) {
    const { error } = await supabase.from('contratos').insert(contrato);
    if (error) throw error;
  } else {
    // `insert` e `update` são processados igual pela fila (upsert); o tipo só aceita estes.
    await addToSyncQueue({ storeName: 'contratos', action: 'insert', data: contrato });
  }
  await saveToIDB('contratos', contrato);

  return contrato.id;
};

/**
 * Confere que a receita chegou mesmo ao Postgres.
 *
 * `salvarReceita` trata o `error` do Supabase com `console.error`, grava no IndexedDB e
 * devolve `void` — a armadilha que este projeto já documenta em `saveAtendimento`: a tela
 * diz "gerado com sucesso" e as mensalidades não existem para mais ninguém. Corrigir a
 * função compartilhada mudaria o comportamento de todos os seus chamadores de uma vez;
 * aqui, onde a operação é irreversível, a checagem é barata e dá ao operador a única
 * informação que muda o que ele faz em seguida.
 */
const receitaChegouAoServidor = async (receitaId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('receitas')
      .select('id')
      .eq('id', receitaId)
      .limit(1);
    if (error) return false;
    return (data || []).length > 0;
  } catch {
    // Falha de rede depois da gravação não é prova de que ela não entrou — e a fila de
    // sync existe exatamente para esse caso. Não é hora de assustar o operador.
    return true;
  }
};

export const reativarAssociadoComNovoContrato = async (
  dados: DadosReativacao,
  contexto: ContextoReativacao,
): Promise<ResultadoReativacao> => {
  const { associado } = dados;
  const { isOnline } = contexto;

  // A recusa mora no ponto de escrita, não só no botão escondido: este caminho é alcançável
  // por qualquer chamador novo, e reativar quem já está ativo arquivaria o contrato vigente
  // para criar outro igual — com as mensalidades em aberto cobradas em duplicidade.
  if (!cadastroForaDeCirculacao(associado)) {
    throw new Error(MENSAGEM_REATIVACAO_DESNECESSARIA);
  }

  const tenantId = tenantDeRegistroExistente(
    associado.tenant_id,
    contexto.empresaSelecionada,
    contexto.userTenantId,
  );
  if (!tenantId) throw new Error(MENSAGEM_TENANT_INDEFINIDO);

  // O contrato anterior termina no dia em que o novo começa — a mesma data que entra na
  // linha do histórico, para os dois lados contarem a mesma história.
  const contratosArquivados = await arquivarContratosVigentes(
    associado.id,
    isOnline,
    dados.dataAdesao,
  );

  const idHistorico = generateUUID();
  await criarContratoDaReativacao(dados, tenantId, isOnline);

  const reativado = montarAssociadoReativado(
    associado,
    {
      planoId: dados.planoId,
      planoNome: dados.planoNome,
      valorPlano: dados.valorPlano,
      numeroContrato: dados.numeroContrato,
      dataAdesao: dados.dataAdesao,
      idsDependentesReativados: dados.idsDependentesReativados,
      idHistorico,
    },
  );
  await saveAssociado(reativado, isOnline);

  const receitaId = generateUUID();
  const valorTotal = dados.parcelas.reduce((acc, p) => acc + p.valor, 0);
  const contaContabil = await resolverContaLancamento(
    isOnline,
    tenantId,
    'receita',
    CODIGO_CONTA_MENSALIDADE,
  );

  const receitaMestre = {
    id: receitaId,
    tenant_id: tenantId,
    empresa_id: tenantId,
    tipo_devedor: 'associado',
    associado_id: reativado.id,
    associado_nome: reativado.nome,
    associado_cpf: reativado.cpf,
    associado_plano: dados.planoNome,
    descricao: `Contrato de Plano (Reativação): ${dados.planoNome} - ${dados.numeroContrato}`,
    categoria: contaContabil?.nome || 'Mensalidades',
    conta_contabil_id: contaContabil?.id || null,
    data_emissao: dados.dataAdesao,
    data_inicio_cobranca: dados.parcelas[0]?.data_vencimento,
    valor_total: valorTotal,
    qtd_parcelas: dados.qtdParcelas,
    forma_pagamento_padrao: 'boleto',
    status: 'ativo',
    criado_por: contexto.userId || null,
  };

  const parcelasGeradas = dados.parcelas.map((p) => ({
    id: generateUUID(),
    tenant_id: tenantId,
    empresa_id: tenantId,
    receita_id: receitaId,
    numero_parcela: p.numero_parcela,
    total_parcelas: dados.qtdParcelas,
    tipo_devedor: 'associado',
    devedor_nome: reativado.nome,
    devedor_cpf_cnpj: reativado.cpf || '',
    descricao: p.descricao,
    data_vencimento: p.data_vencimento,
    valor: p.valor,
    forma_pagamento: 'boleto',
    status: 'pendente',
  }));

  await salvarReceita(isOnline, receitaMestre as any, parcelasGeradas as any);

  const dependentesReativados = reativado.dependentes.filter((d) => d.status !== 'inativo').length;
  const dependentesMantidosInativos = reativado.dependentes.length - dependentesReativados;

  try {
    await registrarAuditoria('Reativar Associado com Novo Contrato', {
      associado_id: reativado.id,
      associado_nome: reativado.nome,
      status_anterior: associado.status,
      numero_contrato: dados.numeroContrato,
      numero_contrato_anterior: associado.numero_contrato || null,
      plano_anterior: associado.plano_nome || null,
      plano_novo: dados.planoNome,
      valor_mensalidade: dados.valorPlano,
      taxa_adesao: dados.taxaAdesao,
      contratos_arquivados: contratosArquivados,
      dependentes_reativados: dependentesReativados,
      dependentes_mantidos_inativos: dependentesMantidosInativos,
      receita_id: receitaId,
      parcelas_geradas: parcelasGeradas.length,
      valor_total: valorTotal,
    });
  } catch (e) {
    console.warn('Falha ao registrar auditoria da reativação:', e);
  }

  if (isOnline && !(await receitaChegouAoServidor(receitaId))) {
    throw new Error(MENSAGEM_MENSALIDADES_NAO_GERADAS);
  }

  return {
    associado: reativado,
    dependentesReativados,
    dependentesMantidosInativos,
    contratosArquivados,
    numeroContrato: dados.numeroContrato,
    receitaId,
    parcelasGeradas: parcelasGeradas.length,
    valorTotal,
  };
};
