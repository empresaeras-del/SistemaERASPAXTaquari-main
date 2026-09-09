import { describe, it, expect } from 'vitest';
import { codigoDeCentroCusto, ordenarCentrosCusto, centrosSelecionaveis } from './centrosCusto';
import type { CentroCusto } from '../types/centroCusto';

const centro = (over: Partial<CentroCusto> & { id: string; codigo: string }): CentroCusto => ({
  tenant_id: 't1',
  nome: `Centro ${over.codigo}`,
  ativo: true,
  ...over,
});

describe('codigoDeCentroCusto', () => {
  it('tira acento e sobe para maiúsculas', () => {
    expect(codigoDeCentroCusto('Funerária')).toBe('FUNERARIA');
    expect(codigoDeCentroCusto('Cemitério')).toBe('CEMITERIO');
  });

  it('colapsa separadores num hífen só', () => {
    expect(codigoDeCentroCusto('Comercial / Vendas')).toBe('COMERCIAL-VENDAS');
    expect(codigoDeCentroCusto('Rede   Assistencial')).toBe('REDE-ASSISTENCIAL');
  });

  it('não deixa hífen sobrando nas pontas', () => {
    expect(codigoDeCentroCusto('  Administrativo  ')).toBe('ADMINISTRATIVO');
    expect(codigoDeCentroCusto('/Financeiro/')).toBe('FINANCEIRO');
  });

  it('preserva número', () => {
    expect(codigoDeCentroCusto('Unidade 02')).toBe('UNIDADE-02');
  });

  it('nunca devolve vazio — a coluna é UNIQUE e string vazia colidiria', () => {
    expect(codigoDeCentroCusto('///')).toBe('CENTRO');
    expect(codigoDeCentroCusto('')).toBe('CENTRO');
  });

  it('bate com os códigos que o backfill em SQL gerou', () => {
    // Os seis da lista modelo, conferidos contra o resultado real da migration 20260909122939.
    const esperado: Array<[string, string]> = [
      ['Rede Assistencial', 'REDE-ASSISTENCIAL'],
      ['Funerária', 'FUNERARIA'],
      ['Cemitério', 'CEMITERIO'],
      ['Administrativo', 'ADMINISTRATIVO'],
      ['Financeiro', 'FINANCEIRO'],
      ['Comercial / Vendas', 'COMERCIAL-VENDAS'],
    ];
    for (const [nome, codigo] of esperado) {
      expect(codigoDeCentroCusto(nome)).toBe(codigo);
    }
  });
});

describe('ordenarCentrosCusto', () => {
  it('ordena por código e joga os desativados para o fim', () => {
    const lista = [
      centro({ id: 'c', codigo: 'ZETA' }),
      centro({ id: 'a', codigo: 'ALFA', ativo: false }),
      centro({ id: 'b', codigo: 'BETA' }),
    ];
    expect(ordenarCentrosCusto(lista).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('não altera o array recebido', () => {
    const lista = [centro({ id: 'z', codigo: 'ZETA' }), centro({ id: 'a', codigo: 'ALFA' })];
    ordenarCentrosCusto(lista);
    expect(lista.map((c) => c.id)).toEqual(['z', 'a']);
  });
});

describe('centrosSelecionaveis', () => {
  const lista = [
    centro({ id: 'ativo', codigo: 'ATIVO' }),
    centro({ id: 'off', codigo: 'OFF', ativo: false }),
    centro({ id: 'del', codigo: 'DEL', deleted_at: '2026-01-01' }),
  ];

  it('oferece só os ativos', () => {
    expect(centrosSelecionaveis(lista).map((c) => c.id)).toEqual(['ativo']);
  });

  it('mantém o centro já gravado mesmo desativado, para não apagar a classificação ao editar', () => {
    expect(centrosSelecionaveis(lista, 'off').map((c) => c.id)).toEqual(['ativo', 'off']);
  });

  it('não ressuscita centro excluído nem quando é o selecionado', () => {
    expect(centrosSelecionaveis(lista, 'del').map((c) => c.id)).toEqual(['ativo']);
  });
});
