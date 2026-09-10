import { describe, it, expect } from 'vitest';
import { mesclarComCacheLocal, idsPendentesDeSync } from './mesclagemOfflineFirst';

const reg = (id: string, over: { tenant_id?: string | null; deleted_at?: string | null; valor?: number } = {}) => ({
  id,
  tenant_id: 't1',
  ...over,
});

const T1 = 't1';

describe('idsPendentesDeSync', () => {
  it('coleta os ids do store pedido', () => {
    const fila = [
      { storeName: 'receitas', data: { id: 'r1' } },
      { storeName: 'receitas', data: { id: 'r2' } },
    ];
    expect(idsPendentesDeSync(fila, 'receitas')).toEqual(new Set(['r1', 'r2']));
  });

  it('ignora tarefa de outro store — id preso em despesas não preserva receita', () => {
    const fila = [{ storeName: 'despesas', data: { id: 'x1' } }];
    expect(idsPendentesDeSync(fila, 'receitas').size).toBe(0);
  });

  it('aceita a forma em que o data é o próprio id (usada pelo delete)', () => {
    expect(idsPendentesDeSync([{ storeName: 'receitas', data: 'r9' }], 'receitas')).toEqual(new Set(['r9']));
  });

  it('não quebra com fila vazia, nula ou tarefa malformada', () => {
    expect(idsPendentesDeSync([], 'receitas').size).toBe(0);
    expect(idsPendentesDeSync(null as never, 'receitas').size).toBe(0);
    expect(idsPendentesDeSync([{ storeName: 'receitas' }, { data: { id: 'z' } }], 'receitas').size).toBe(0);
  });
});

describe('mesclarComCacheLocal — os três casos que o merge antigo confundia', () => {
  it('1) presente nos dois lados: o remoto manda', () => {
    const { registros, orfaosParaRemover } = mesclarComCacheLocal({
      remotos: [reg('a', { valor: 100 })],
      locais: [reg('a', { valor: 999 })],
      pendentesDeSync: new Set(),
      tenantDaConsulta: T1,
    });
    expect(registros).toHaveLength(1);
    expect((registros[0] as { valor?: number }).valor).toBe(100);
    expect(orfaosParaRemover).toEqual([]);
  });

  it('2) só local COM sync pendente: criado offline, tem de ser preservado', () => {
    const { registros, orfaosParaRemover } = mesclarComCacheLocal({
      remotos: [],
      locais: [reg('novo')],
      pendentesDeSync: new Set(['novo']),
      tenantDaConsulta: T1,
    });
    expect(registros.map((r) => r.id)).toEqual(['novo']);
    expect(orfaosParaRemover).toEqual([]);
  });

  it('3) só local SEM sync pendente: excluído em outra sessão — some da lista e do cache', () => {
    // É o caso da receita 50be9316: excluída pelo app em 10/09, viva no IndexedDB alheio.
    const { registros, orfaosParaRemover } = mesclarComCacheLocal({
      remotos: [reg('viva')],
      locais: [reg('viva'), reg('fantasma')],
      pendentesDeSync: new Set(),
      tenantDaConsulta: T1,
    });
    expect(registros.map((r) => r.id)).toEqual(['viva']);
    expect(orfaosParaRemover).toEqual(['fantasma']);
  });

  it('o merge ANTIGO devolveria a fantasma — este teste trava a diferença', () => {
    const locais = [reg('fantasma')];
    const antigo = [...[], ...locais.filter((l) => !l.deleted_at)]; // comportamento anterior
    expect(antigo.map((r) => r.id)).toEqual(['fantasma']);

    const { registros } = mesclarComCacheLocal({
      remotos: [], locais, pendentesDeSync: new Set(), tenantDaConsulta: T1,
    });
    expect(registros).toEqual([]);
  });
});

describe('mesclarComCacheLocal — as salvaguardas', () => {
  it('registro de OUTRA empresa não é podado: ele está legitimamente fora da resposta', () => {
    // A consulta remota filtra por tenant. Podar aqui apagaria o cache da outra empresa
    // toda vez que o usuário trocasse de empresa na tela.
    const { registros, orfaosParaRemover } = mesclarComCacheLocal({
      remotos: [reg('a')],
      locais: [reg('a'), reg('de-outra', { tenant_id: 't2' })],
      pendentesDeSync: new Set(),
      tenantDaConsulta: T1,
    });
    expect(registros.map((r) => r.id).sort()).toEqual(['a', 'de-outra']);
    expect(orfaosParaRemover).toEqual([]);
  });

  it('sem filtro de tenant na consulta (all/vazio), tudo que sobra é órfão de verdade', () => {
    for (const tenant of ['all', '', null, undefined]) {
      const { orfaosParaRemover } = mesclarComCacheLocal({
        remotos: [],
        locais: [reg('x', { tenant_id: 't2' })],
        pendentesDeSync: new Set(),
        tenantDaConsulta: tenant,
      });
      expect(orfaosParaRemover).toEqual(['x']);
    }
  });

  it('registro sem tenant (catálogo compartilhado) é tratado como do escopo', () => {
    const { orfaosParaRemover } = mesclarComCacheLocal({
      remotos: [], locais: [reg('sem', { tenant_id: null })],
      pendentesDeSync: new Set(), tenantDaConsulta: T1,
    });
    expect(orfaosParaRemover).toEqual(['sem']);
  });

  it('local já excluído logicamente não é exibido nem entra na poda', () => {
    const { registros, orfaosParaRemover } = mesclarComCacheLocal({
      remotos: [],
      locais: [reg('soft', { deleted_at: '2026-09-10T00:00:00Z' })],
      pendentesDeSync: new Set(),
      tenantDaConsulta: T1,
    });
    expect(registros).toEqual([]);
    expect(orfaosParaRemover).toEqual([]);
  });

  it('remoto sem nada local devolve o remoto e não poda nada', () => {
    const { registros, orfaosParaRemover } = mesclarComCacheLocal({
      remotos: [reg('a'), reg('b')], locais: [],
      pendentesDeSync: new Set(), tenantDaConsulta: T1,
    });
    expect(registros).toHaveLength(2);
    expect(orfaosParaRemover).toEqual([]);
  });

  it('listas vazias e entradas sem id não quebram', () => {
    const { registros, orfaosParaRemover } = mesclarComCacheLocal({
      remotos: [{ id: '' } as never], locais: [{ id: '' } as never, null as never],
      pendentesDeSync: new Set(), tenantDaConsulta: T1,
    });
    expect(registros).toEqual([]);
    expect(orfaosParaRemover).toEqual([]);
  });
});
