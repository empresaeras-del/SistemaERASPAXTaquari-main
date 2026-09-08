import { describe, it, expect } from 'vitest';
import {
  ORDEM_STATUS,
  agruparPorStatus,
  guiasDaRemessa,
  guiasFaltando,
  totaisGerais,
} from './faturamentosKanban';
import type { RemessaFaturamento, StatusRemessa } from '../types/faturamento';
import type { Requisicao } from '../types/requisicoes';

/** `omitir` reproduz o registro antigo em que a chave simplesmente não veio. */
const remessa = (
  over: Partial<RemessaFaturamento> & { id: string; status: StatusRemessa },
  omitir: (keyof RemessaFaturamento)[] = [],
): RemessaFaturamento => {
  const base: RemessaFaturamento = {
    tenant_id: 't1',
    codigo_remessa: 'REM-001',
    tipo_prestador: 'credenciado',
    credenciado_nome: 'Cred',
    data_criacao: '2026-09-01',
    requisicao_ids: [],
    qtd_guias: 0,
    valor_bruto: 0,
    valor_desconto_glosa: 0,
    valor_liquido: 0,
    ...over,
  };
  for (const chave of omitir) delete base[chave];
  return base;
};

const guia = (id: string): Requisicao => ({ id } as Requisicao);

describe('ORDEM_STATUS', () => {
  it('segue o ciclo de vida, com cancelada por último', () => {
    expect(ORDEM_STATUS.map((c) => c.status)).toEqual([
      'em_aberto', 'processando', 'fechada', 'paga', 'cancelada',
    ]);
  });
});

describe('agruparPorStatus', () => {
  const base = [
    remessa({ id: '1', status: 'em_aberto', qtd_guias: 2, valor_liquido: 100 }),
    remessa({ id: '2', status: 'em_aberto', qtd_guias: 3, valor_liquido: 250.5 }),
    remessa({ id: '3', status: 'paga', qtd_guias: 1, valor_liquido: 80 }),
  ];

  it('devolve sempre as cinco colunas, mesmo vazias', () => {
    // Coluna vazia é informação: mostra que nenhuma remessa está naquela etapa.
    const colunas = agruparPorStatus(base);
    expect(colunas).toHaveLength(5);
    expect(colunas.find((c) => c.status === 'cancelada')!.remessas).toEqual([]);
  });

  it('põe cada remessa na coluna do seu status', () => {
    const colunas = agruparPorStatus(base);
    expect(colunas.find((c) => c.status === 'em_aberto')!.remessas.map((r) => r.id)).toEqual(['1', '2']);
    expect(colunas.find((c) => c.status === 'paga')!.remessas.map((r) => r.id)).toEqual(['3']);
  });

  it('soma valor líquido e guias por coluna', () => {
    const aberto = agruparPorStatus(base).find((c) => c.status === 'em_aberto')!;
    expect(aberto.totalLiquido).toBeCloseTo(350.5, 2);
    expect(aberto.totalGuias).toBe(5);
  });

  it('trata valores ausentes como zero em vez de NaN', () => {
    const semValores = [remessa({ id: 'x', status: 'fechada' }, ['qtd_guias', 'valor_liquido'])];
    const col = agruparPorStatus(semValores).find((c) => c.status === 'fechada')!;
    expect(col.totalLiquido).toBe(0);
    expect(col.totalGuias).toBe(0);
  });

  it('lista vazia devolve as colunas zeradas', () => {
    const colunas = agruparPorStatus([]);
    expect(colunas.every((c) => c.remessas.length === 0 && c.totalLiquido === 0)).toBe(true);
  });
});

describe('guiasDaRemessa', () => {
  const guias = [guia('a'), guia('b'), guia('c')];

  it('devolve só as guias referenciadas pela remessa', () => {
    const r = remessa({ id: '1', status: 'fechada', requisicao_ids: ['a', 'c'] });
    expect(guiasDaRemessa(r, guias).map((g) => g.id)).toEqual(['a', 'c']);
  });

  it('remessa sem vínculo devolve vazio', () => {
    expect(guiasDaRemessa(remessa({ id: '1', status: 'fechada' }), guias)).toEqual([]);
  });

  it('não quebra quando requisicao_ids vem ausente — registro antigo', () => {
    const r = remessa({ id: '1', status: 'fechada' }, ['requisicao_ids']);
    expect(guiasDaRemessa(r, guias)).toEqual([]);
  });

  it('ignora id que não existe na lista carregada', () => {
    const r = remessa({ id: '1', status: 'fechada', requisicao_ids: ['a', 'inexistente'] });
    expect(guiasDaRemessa(r, guias).map((g) => g.id)).toEqual(['a']);
  });
});

describe('guiasFaltando', () => {
  const guias = [guia('a')];

  it('conta as referências que não foram encontradas', () => {
    const r = remessa({ id: '1', status: 'fechada', requisicao_ids: ['a', 'b', 'c'] });
    expect(guiasFaltando(r, guias)).toBe(2);
  });

  it('zero quando todas foram encontradas', () => {
    const r = remessa({ id: '1', status: 'fechada', requisicao_ids: ['a'] });
    expect(guiasFaltando(r, guias)).toBe(0);
  });

  it('nunca devolve negativo', () => {
    const r = remessa({ id: '1', status: 'fechada', requisicao_ids: [] });
    expect(guiasFaltando(r, [guia('a'), guia('b')])).toBe(0);
  });
});

describe('totaisGerais', () => {
  it('soma tudo, independente do status', () => {
    const t = totaisGerais([
      remessa({ id: '1', status: 'em_aberto', qtd_guias: 2, valor_liquido: 100 }),
      remessa({ id: '2', status: 'cancelada', qtd_guias: 1, valor_liquido: 50 }),
    ]);
    expect(t).toEqual({ qtdRemessas: 2, totalGuias: 3, totalLiquido: 150 });
  });

  it('lista vazia zera tudo', () => {
    expect(totaisGerais([])).toEqual({ qtdRemessas: 0, totalGuias: 0, totalLiquido: 0 });
  });
});
