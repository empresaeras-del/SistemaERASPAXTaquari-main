import { describe, it, expect } from 'vitest';
import {
  indicePorLancamento,
  parcelaCasaClassificacao,
  type ClassificacaoLancamento,
} from './filtrosClassificacao';

const CONTA_A = 'conta-a';
const CONTA_B = 'conta-b';
const CENTRO_A = 'centro-a';
const CENTRO_B = 'centro-b';

const lancamentos = [
  { id: 'l1', conta_contabil_id: CONTA_A, centro_custo_id: CENTRO_A },
  { id: 'l2', conta_contabil_id: CONTA_B, centro_custo_id: CENTRO_B },
  { id: 'l3', conta_contabil_id: CONTA_A, centro_custo_id: null },
  { id: 'legado' },
];

const indice = indicePorLancamento(lancamentos);

describe('indicePorLancamento', () => {
  it('indexa cada lançamento pelo id', () => {
    expect(indice.size).toBe(4);
    expect(indice.get('l1')).toEqual({ conta_contabil_id: CONTA_A, centro_custo_id: CENTRO_A });
  });

  it('normaliza ausente para null, para a comparação não depender de undefined', () => {
    expect(indice.get('legado')).toEqual({ conta_contabil_id: null, centro_custo_id: null });
  });

  it('ignora entrada sem id em vez de quebrar', () => {
    const sujo = indicePorLancamento([{ id: '' }, { id: 'ok', conta_contabil_id: CONTA_A }]);
    expect(sujo.size).toBe(1);
    expect(sujo.has('ok')).toBe(true);
  });
});

describe('parcelaCasaClassificacao', () => {
  it('sem filtro, casa com tudo — inclusive o lançamento legado sem classificação', () => {
    expect(parcelaCasaClassificacao('legado', indice, {})).toBe(true);
    expect(parcelaCasaClassificacao('l1', indice, {})).toBe(true);
  });

  it('sem filtro, casa até com parcela órfã', () => {
    expect(parcelaCasaClassificacao(undefined, indice, {})).toBe(true);
    expect(parcelaCasaClassificacao('nao-existe', indice, {})).toBe(true);
  });

  it('filtra por conta contábil', () => {
    expect(parcelaCasaClassificacao('l1', indice, { contaContabilId: CONTA_A })).toBe(true);
    expect(parcelaCasaClassificacao('l2', indice, { contaContabilId: CONTA_A })).toBe(false);
  });

  it('filtra por centro de custo', () => {
    expect(parcelaCasaClassificacao('l1', indice, { centroCustoId: CENTRO_A })).toBe(true);
    expect(parcelaCasaClassificacao('l3', indice, { centroCustoId: CENTRO_A })).toBe(false);
  });

  it('os dois filtros somam: precisa casar nos dois', () => {
    const filtros = { contaContabilId: CONTA_A, centroCustoId: CENTRO_A };
    expect(parcelaCasaClassificacao('l1', indice, filtros)).toBe(true);
    // conta certa, centro vazio
    expect(parcelaCasaClassificacao('l3', indice, filtros)).toBe(false);
    // centro certo seria o B — nenhum dos dois casa
    expect(parcelaCasaClassificacao('l2', indice, filtros)).toBe(false);
  });

  it('com filtro, o lançamento legado sem classificação fica de fora', () => {
    expect(parcelaCasaClassificacao('legado', indice, { contaContabilId: CONTA_A })).toBe(false);
    expect(parcelaCasaClassificacao('legado', indice, { centroCustoId: CENTRO_A })).toBe(false);
  });

  it('com filtro, a parcela órfã fica de fora — senão apareceria em qualquer filtro', () => {
    expect(parcelaCasaClassificacao(undefined, indice, { contaContabilId: CONTA_A })).toBe(false);
    expect(parcelaCasaClassificacao('nao-existe', indice, { contaContabilId: CONTA_A })).toBe(false);
  });

  it('não confunde conta com centro: ids iguais em campos diferentes não casam por acaso', () => {
    const cruzado = indicePorLancamento([{ id: 'x', conta_contabil_id: 'mesmo-id', centro_custo_id: null }]);
    expect(parcelaCasaClassificacao('x', cruzado, { centroCustoId: 'mesmo-id' })).toBe(false);
    expect(parcelaCasaClassificacao('x', cruzado, { contaContabilId: 'mesmo-id' })).toBe(true);
  });

  it('aceita índice vazio sem quebrar', () => {
    const vazio = new Map<string, ClassificacaoLancamento>();
    expect(parcelaCasaClassificacao('l1', vazio, {})).toBe(true);
    expect(parcelaCasaClassificacao('l1', vazio, { contaContabilId: CONTA_A })).toBe(false);
  });
});
