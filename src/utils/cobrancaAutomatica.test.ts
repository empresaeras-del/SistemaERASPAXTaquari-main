import { describe, it, expect } from 'vitest';
import {
  DIAS_ATE_VENCIMENTO,
  avisoCobrancaExistente,
  dataLocalISO,
  deveOferecerCobranca,
  montarCobrancaAtendimento,
  montarCobrancaCoparticipacao,
  vencimentoPadrao,
} from './cobrancaAutomatica';

/** Gerador previsível, para as asserções não dependerem de UUID real. */
const idsSequenciais = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

describe('dataLocalISO', () => {
  it('usa o fuso local, não UTC', () => {
    // 21h em UTC-3 já é o dia seguinte em UTC: `toISOString()` daria 2026-09-12.
    const noite = new Date(2026, 8, 11, 21, 30);
    expect(dataLocalISO(noite)).toBe('2026-09-11');
  });

  it('preenche mês e dia com zero à esquerda', () => {
    expect(dataLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('vencimentoPadrao', () => {
  it('soma os dias do prazo padrão', () => {
    expect(DIAS_ATE_VENCIMENTO).toBe(2);
    expect(vencimentoPadrao(new Date(2026, 8, 11, 10, 0))).toBe('2026-09-13');
  });

  it('atravessa a virada de mês', () => {
    expect(vencimentoPadrao(new Date(2026, 8, 30))).toBe('2026-10-02');
  });

  it('atravessa a virada de ano', () => {
    expect(vencimentoPadrao(new Date(2026, 11, 31))).toBe('2027-01-02');
  });

  it('não é afetado pela hora do dia', () => {
    expect(vencimentoPadrao(new Date(2026, 8, 11, 23, 59))).toBe(
      vencimentoPadrao(new Date(2026, 8, 11, 0, 1)),
    );
  });
});

describe('deveOferecerCobranca', () => {
  it('oferece quando há valor positivo', () => {
    expect(deveOferecerCobranca(0.01)).toBe(true);
    expect(deveOferecerCobranca(1500)).toBe(true);
  });

  it('não oferece para zero, negativo ou valor inválido', () => {
    expect(deveOferecerCobranca(0)).toBe(false);
    expect(deveOferecerCobranca(-10)).toBe(false);
    expect(deveOferecerCobranca(NaN)).toBe(false);
    expect(deveOferecerCobranca(null)).toBe(false);
    expect(deveOferecerCobranca(undefined)).toBe(false);
  });
});

describe('montarCobrancaAtendimento', () => {
  const base = {
    novoId: idsSequenciais(),
    tenantId: 'emp-1',
    hoje: new Date(2026, 8, 11, 10, 0),
    valor: 800,
    atendimentoId: 'atd-1',
    falecidoNome: 'JOSÉ PEREIRA',
    falecidoCpf: '999.888.777-66',
    contaContabil: { id: 'cc-1', nome: 'Serviços Extras' },
  };

  it('para associado, cobra do titular e mantém o falecido como cliente', () => {
    const { receita, parcelas } = montarCobrancaAtendimento({
      ...base,
      novoId: idsSequenciais(),
      ehAssociado: true,
      associadoId: 'assoc-1',
      associadoNome: 'MARIA DA SILVA',
      associadoCpf: '046.537.031-40',
    });

    expect(receita.tipo_devedor).toBe('associado');
    expect(receita.associado_id).toBe('assoc-1');
    expect(receita.cliente_nome).toBe('JOSÉ PEREIRA');
    // Quem paga é o titular, não o falecido.
    expect(parcelas[0].devedor_nome).toBe('MARIA DA SILVA');
    expect(parcelas[0].devedor_cpf_cnpj).toBe('046.537.031-40');
  });

  it('para cliente externo, o devedor é o próprio cliente', () => {
    const { receita, parcelas } = montarCobrancaAtendimento({
      ...base,
      novoId: idsSequenciais(),
      ehAssociado: false,
    });

    expect(receita.tipo_devedor).toBe('cliente_pf');
    expect(receita.associado_id).toBeUndefined();
    expect(parcelas[0].devedor_nome).toBe('JOSÉ PEREIRA');
    expect(parcelas[0].devedor_cpf_cnpj).toBe('999.888.777-66');
  });

  it('vincula a receita ao atendimento e fecha o valor na parcela única', () => {
    const { receita, parcelas } = montarCobrancaAtendimento({
      ...base,
      novoId: idsSequenciais(),
      ehAssociado: false,
    });

    expect(receita.atendimento_id).toBe('atd-1');
    expect(receita.qtd_parcelas).toBe(1);
    expect(parcelas).toHaveLength(1);
    expect(parcelas[0].valor).toBe(receita.valor_total);
    expect(parcelas[0].receita_id).toBe(receita.id);
  });

  it('classifica pela conta contábil e cai para o rótulo antigo sem ela', () => {
    const com = montarCobrancaAtendimento({ ...base, novoId: idsSequenciais(), ehAssociado: false });
    expect(com.receita.categoria).toBe('Serviços Extras');
    expect(com.receita.conta_contabil_id).toBe('cc-1');

    const sem = montarCobrancaAtendimento({
      ...base, novoId: idsSequenciais(), ehAssociado: false, contaContabil: null,
    });
    expect(sem.receita.categoria).toBe('Serviço Extra');
    expect(sem.receita.conta_contabil_id).toBeNull();
  });

  it('vence no prazo padrão, em data local', () => {
    const { parcelas } = montarCobrancaAtendimento({
      ...base, novoId: idsSequenciais(), ehAssociado: false, hoje: new Date(2026, 8, 11, 23, 0),
    });
    expect(parcelas[0].data_vencimento).toBe('2026-09-13');
  });
});

describe('montarCobrancaCoparticipacao', () => {
  const base = {
    tenantId: 'emp-1',
    hoje: new Date(2026, 8, 11, 10, 0),
    valor: 120,
    requisicaoId: 'req-1',
    codigoGuia: 'GUIA-0007',
    associadoId: 'assoc-1',
    associadoNome: 'MARIA DA SILVA',
    associadoCpf: '046.537.031-40',
    contaContabil: { id: 'cc-1', nome: 'Serviços Extras' },
  };

  it('grava o vínculo com a guia — é o que permite avisar numa reedição', () => {
    const { receita } = montarCobrancaCoparticipacao({ ...base, novoId: idsSequenciais() });
    expect(receita.requisicao_id).toBe('req-1');
  });

  it('nomeia a receita e a parcela pelo código da guia', () => {
    const { receita, parcelas } = montarCobrancaCoparticipacao({ ...base, novoId: idsSequenciais() });
    expect(receita.descricao).toBe('Co-participação - Guia GUIA-0007');
    expect(parcelas[0].descricao).toBe(receita.descricao);
  });

  it('cobra do associado, em parcela única', () => {
    const { receita, parcelas } = montarCobrancaCoparticipacao({ ...base, novoId: idsSequenciais() });
    expect(receita.tipo_devedor).toBe('associado');
    expect(parcelas).toHaveLength(1);
    expect(parcelas[0].devedor_nome).toBe('MARIA DA SILVA');
    expect(parcelas[0].valor).toBe(120);
  });

  it('emite hoje e vence no prazo padrão, sem deslocar de fuso', () => {
    const { receita, parcelas } = montarCobrancaCoparticipacao({
      ...base, novoId: idsSequenciais(), hoje: new Date(2026, 8, 11, 22, 0),
    });
    expect(receita.data_emissao).toBe('2026-09-11');
    expect(parcelas[0].data_vencimento).toBe('2026-09-13');
  });
});

describe('avisoCobrancaExistente', () => {
  it('não avisa quando não há cobrança', () => {
    expect(avisoCobrancaExistente([], brl)).toBeNull();
  });

  it('avisa no singular com o valor', () => {
    const aviso = avisoCobrancaExistente([{ valor_total: 120, status: 'ativo' }], brl);
    expect(aviso).toContain('já gerou uma cobrança');
    expect(aviso).toContain('120,00');
  });

  it('avisa no plural somando os valores', () => {
    const aviso = avisoCobrancaExistente(
      [{ valor_total: 120, status: 'ativo' }, { valor_total: 80, status: 'quitado' }],
      brl,
    );
    expect(aviso).toContain('2 cobranças');
    expect(aviso).toContain('200,00');
  });

  it('ignora receita cancelada — ela não cobra ninguém', () => {
    // Avisar sobre uma cancelada faria o operador desistir de uma cobrança legítima.
    expect(avisoCobrancaExistente([{ valor_total: 120, status: 'cancelado' }], brl)).toBeNull();
    const aviso = avisoCobrancaExistente(
      [{ valor_total: 120, status: 'cancelado' }, { valor_total: 50, status: 'ativo' }],
      brl,
    );
    expect(aviso).toContain('uma cobrança');
    expect(aviso).toContain('50,00');
  });
});
