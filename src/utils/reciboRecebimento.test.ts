import { describe, it, expect } from 'vitest';
import {
  TITULO_RECIBO_PADRAO,
  montarReciboDeRecebimento,
  numeroDoRecibo,
  type ParcelaParaRecibo,
} from './reciboRecebimento';

const parcela = (over: Partial<ParcelaParaRecibo> = {}): ParcelaParaRecibo => ({
  id: 'eb5ce46f-4b42-4cc2-a910-233d40b3b5af',
  numero_parcela: 2,
  total_parcelas: 12,
  descricao: 'Mensalidade 2/12 - PLANO TESTE',
  data_vencimento: '2026-10-10',
  devedor_nome: 'EDSON RENIS ALVES DA SILVA',
  devedor_cpf_cnpj: '01798921189',
  forma_pagamento: 'boleto',
  valor: 60,
  ...over,
});

describe('numeroDoRecibo', () => {
  it('são os 8 primeiros caracteres do id, em maiúsculas', () => {
    expect(numeroDoRecibo('eb5ce46f-4b42-4cc2-a910-233d40b3b5af')).toBe('EB5CE46F');
  });

  it('sem id, não inventa número', () => {
    expect(numeroDoRecibo(undefined)).toBe('—');
  });
});

describe('montarReciboDeRecebimento', () => {
  it('usa o que foi informado na baixa, não o que a parcela ainda guarda', () => {
    // A linha em memória logo depois da baixa ainda é a de antes: pendente, sem valor
    // recebido. Montar o recibo só a partir dela imprimiria o campo que mais importa vazio.
    const recibo = montarReciboDeRecebimento(
      parcela(),
      {
        dataLiquidacaoISO: '2026-09-14T15:00:00.000Z',
        valorRecebido: 55,
        formaPagamento: 'dinheiro',
        operadorNome: 'EDSON RENIS',
        observacao: 'Pago no balcão',
      },
    );

    expect(recibo.valor).toBe(55);
    expect(recibo.formaPagamento).toBe('DINHEIRO');
    expect(recibo.operadorNome).toBe('EDSON RENIS');
    expect(recibo.observacoes).toBe('Pago no balcão');
    expect(recibo.dataLiquidacao).not.toBe('-');
  });

  it('reimpressão: sem dados de baixa, lê o que ficou gravado na parcela', () => {
    const recibo = montarReciboDeRecebimento(
      parcela({
        valor_recebido: 60,
        recebido_em: '2026-09-14T15:00:00.000Z',
        recebido_por: 'EDSON RENIS',
        forma_pagamento_efetivo: 'pix',
        observacao_recebimento: 'ok',
      }),
    );

    expect(recibo.valor).toBe(60);
    expect(recibo.formaPagamento).toBe('PIX');
    expect(recibo.operadorNome).toBe('EDSON RENIS');
    expect(recibo.observacoes).toBe('ok');
  });

  it('recebimento de R$ 0,00 não vira o valor de face', () => {
    // `||` encadeado trataria zero como ausente e imprimiria 60 num comprovante de zero.
    const recibo = montarReciboDeRecebimento(parcela(), { valorRecebido: 0 });
    expect(recibo.valor).toBe(0);
  });

  it('sem liquidação nenhuma, não carimba a data de hoje', () => {
    const recibo = montarReciboDeRecebimento(parcela());
    expect(recibo.dataLiquidacao).toBe('-');
  });

  it('cai para o nome e o documento que a tela conhece quando a parcela não os tem', () => {
    const recibo = montarReciboDeRecebimento(
      parcela({ devedor_nome: undefined, devedor_cpf_cnpj: undefined }),
      {},
      { nomeFallback: 'MARIA DA SILVA', documentoFallback: '04653703140' },
    );
    expect(recibo.pagadorNome).toBe('MARIA DA SILVA');
    expect(recibo.pagadorDoc).toBe('04653703140');
  });

  it('descreve a parcela e o vencimento como as telas já mostravam', () => {
    const recibo = montarReciboDeRecebimento(parcela(), {}, { planoFallback: 'PLANO TESTE' });
    expect(recibo.titulo).toBe(TITULO_RECIBO_PADRAO);
    expect(recibo.tipo).toBe('recebimento');
    expect(recibo.parcelaInfo).toBe('Parcela 2 de 12');
    expect(recibo.vencimentoOriginal).toBe('10/10/2026');
    expect(recibo.planoInfo).toBe('PLANO TESTE');
  });

  it('o operador da baixa vence o que está gravado, e o fallback só vale sem os dois', () => {
    expect(montarReciboDeRecebimento(parcela({ recebido_por: 'ANTIGO' }), { operadorNome: 'NOVO' }).operadorNome).toBe('NOVO');
    expect(montarReciboDeRecebimento(parcela(), {}, { operadorFallback: 'OPERADOR' }).operadorNome).toBe('OPERADOR');
  });
});
