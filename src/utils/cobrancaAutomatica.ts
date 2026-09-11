/**
 * Montagem da cobrança que atendimento e requisição podem gerar — decidida aqui, em
 * funções puras, e executada pela tela.
 *
 * Até 11/09/2026 os dois fluxos criavam a receita **sozinhos**, no meio do salvamento.
 * Agora o operador é perguntado antes, e a resposta "não" precisa ser tão barata quanto
 * a "sim". Separar "montar o que seria cobrado" de "gravar" é o que torna isso possível:
 * a tela monta a proposta para mostrar o valor na pergunta, e só grava se ouvir sim.
 *
 * É também o que torna a regra testável sem navegador — os dois fluxos tinham a mesma
 * lógica escrita duas vezes, com pequenas divergências que ninguém tinha como comparar.
 */
import { Receita, ParcelaReceber } from '../services/financeiroService';

/** Prazo padrão entre a emissão e o vencimento da cobrança gerada automaticamente. */
export const DIAS_ATE_VENCIMENTO = 2;

export interface PropostaCobranca {
  receita: Receita;
  parcelas: ParcelaReceber[];
}

/**
 * Data no formato `YYYY-MM-DD` no fuso **local**, nunca em UTC.
 *
 * `new Date().toISOString()` é o horário em UTC: às 21h em UTC-3 ele já devolve o dia
 * seguinte, e a emissão de uma guia feita à noite ficava datada de amanhã. O fluxo de
 * atendimento já usava data local e o de requisição usava `toISOString()` — as duas
 * telas geravam a mesma cobrança com datas diferentes dependendo da hora. Aqui há uma
 * fonte só.
 */
export function dataLocalISO(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Data de vencimento padrão: `DIAS_ATE_VENCIMENTO` dias depois de `hoje`, em data local. */
export function vencimentoPadrao(hoje: Date): string {
  const vencimento = new Date(hoje);
  vencimento.setDate(vencimento.getDate() + DIAS_ATE_VENCIMENTO);
  return dataLocalISO(vencimento);
}

/**
 * Se há o que cobrar, e portanto se a pergunta deve aparecer.
 *
 * Valor zero, negativo ou inválido não gera pergunta nenhuma: perguntar "deseja cobrar
 * R$ 0,00?" treina o operador a responder sem ler.
 */
export function deveOferecerCobranca(valor: number | null | undefined): boolean {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

/** Cobrança dos itens não cobertos pelo plano num atendimento. */
export function montarCobrancaAtendimento(params: {
  novoId: () => string;
  tenantId: string;
  hoje: Date;
  valor: number;
  atendimentoId: string;
  falecidoNome: string;
  falecidoCpf?: string;
  ehAssociado: boolean;
  associadoId?: string;
  associadoNome?: string;
  associadoCpf?: string;
  contaContabil?: { id: string; nome: string } | null;
}): PropostaCobranca {
  const {
    novoId, tenantId, hoje, valor, atendimentoId, falecidoNome, falecidoCpf,
    ehAssociado, associadoId, associadoNome, associadoCpf, contaContabil,
  } = params;

  const receitaId = novoId();
  const tipoDevedor = ehAssociado ? 'associado' : 'cliente_pf';
  const emissao = dataLocalISO(hoje);

  return {
    receita: {
      id: receitaId,
      tenant_id: tenantId,
      tipo_devedor: tipoDevedor,
      associado_id: ehAssociado ? associadoId : undefined,
      associado_nome: ehAssociado ? associadoNome : undefined,
      cliente_tipo: 'pf',
      cliente_nome: falecidoNome,
      cliente_cpf_cnpj: falecidoCpf,
      descricao: `Serviços Adicionais - Atendimento: ${falecidoNome}`,
      categoria: contaContabil?.nome || 'Serviço Extra',
      conta_contabil_id: contaContabil?.id || null,
      data_emissao: emissao,
      data_inicio_cobranca: emissao,
      valor_total: valor,
      qtd_parcelas: 1,
      forma_pagamento_padrao: 'Dinheiro',
      status: 'ativo',
      atendimento_id: atendimentoId,
    } as Receita,
    parcelas: [
      {
        id: novoId(),
        tenant_id: tenantId,
        receita_id: receitaId,
        numero_parcela: 1,
        descricao: `Parcela Única - Serviços Adicionais: ${falecidoNome}`,
        valor,
        data_vencimento: vencimentoPadrao(hoje),
        status: 'pendente',
        tipo_devedor: tipoDevedor,
        devedor_nome: ehAssociado ? associadoNome : falecidoNome,
        devedor_cpf_cnpj: ehAssociado ? associadoCpf : falecidoCpf,
        forma_pagamento: 'Dinheiro',
      } as ParcelaReceber,
    ],
  };
}

/** Cobrança da co-participação de uma guia de requisição. */
export function montarCobrancaCoparticipacao(params: {
  novoId: () => string;
  tenantId: string;
  hoje: Date;
  valor: number;
  requisicaoId: string;
  codigoGuia: string;
  associadoId: string;
  associadoNome: string;
  associadoCpf?: string;
  contaContabil?: { id: string; nome: string } | null;
}): PropostaCobranca {
  const {
    novoId, tenantId, hoje, valor, requisicaoId, codigoGuia,
    associadoId, associadoNome, associadoCpf, contaContabil,
  } = params;

  const receitaId = novoId();
  const descricao = `Co-participação - Guia ${codigoGuia}`;
  const emissao = dataLocalISO(hoje);
  const vencimento = vencimentoPadrao(hoje);

  return {
    receita: {
      id: receitaId,
      tenant_id: tenantId,
      tipo_devedor: 'associado',
      associado_id: associadoId,
      associado_nome: associadoNome,
      associado_cpf: associadoCpf,
      descricao,
      categoria: contaContabil?.nome || 'Serviço Extra',
      conta_contabil_id: contaContabil?.id || null,
      data_emissao: emissao,
      data_inicio_cobranca: vencimento,
      valor_total: valor,
      qtd_parcelas: 1,
      forma_pagamento_padrao: 'pix',
      status: 'ativo',
      // O vínculo que permite avisar, numa reedição, que esta guia já cobrou.
      requisicao_id: requisicaoId,
    } as Receita,
    parcelas: [
      {
        id: novoId(),
        tenant_id: tenantId,
        receita_id: receitaId,
        numero_parcela: 1,
        descricao,
        valor,
        data_vencimento: vencimento,
        status: 'pendente',
        tipo_devedor: 'associado',
        devedor_nome: associadoNome,
        devedor_cpf_cnpj: associadoCpf,
        forma_pagamento: 'pix',
      } as ParcelaReceber,
    ],
  };
}

/**
 * Aviso sobre cobranças que esta guia já gerou, para entrar na pergunta.
 *
 * Devolve `null` quando não há nenhuma — quem chama usa isso para decidir se acrescenta
 * a frase, em vez de exibir "nenhuma cobrança anterior", que é ruído no caso comum.
 *
 * **Receita cancelada não conta.** Ela existe no banco, mas não cobra ninguém: avisar
 * sobre ela faria o operador desistir de uma cobrança legítima achando que duplicaria.
 */
export function avisoCobrancaExistente(
  receitas: Pick<Receita, 'valor_total' | 'status'>[],
  formatarValor: (v: number) => string,
): string | null {
  const vigentes = (receitas || []).filter((r) => r && r.status !== 'cancelado');
  if (vigentes.length === 0) return null;

  const total = vigentes.reduce((acc, r) => acc + (Number(r.valor_total) || 0), 0);
  return vigentes.length === 1
    ? `Atenção: esta guia já gerou uma cobrança de ${formatarValor(total)}.`
    : `Atenção: esta guia já gerou ${vigentes.length} cobranças, somando ${formatarValor(total)}.`;
}
